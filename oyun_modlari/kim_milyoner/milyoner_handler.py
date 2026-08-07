import asyncio
import random
import os
import urllib.request
import urllib.parse
import json

from oyun_modlari.kim_milyoner.questions import QUESTIONS as ML_QUESTIONS
from oyun_modlari.kim_milyoner.ai_soru_uretici import generate_questions_async

# Turnstile secret (Cloudflare)
TURNSTILE_SECRET = os.getenv("TURNSTILE_SECRET", "")

# ==========================================
# ✨ SUPABASE - AI SORU HAVUZU
# ==========================================
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")

_supabase_client = None

def get_supabase():
    """Supabase client'ı lazy init - sadece ihtiyaç olduğunda oluştur"""
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("[SUPABASE] ⚠️ URL veya KEY tanımsız (.env kontrol et)")
        return None
    
    try:
        from supabase import create_client
        _supabase_client = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("[SUPABASE] ✓ Client oluşturuldu")
        return _supabase_client
    except Exception as e:
        print(f"[SUPABASE] ✗ Client hatası: {e}")
        return None


def supabase_save_question(category, level, question):
    """AI ürettiği soruyu Supabase'e kaydet (asenkron değil, hızlı)"""
    client = get_supabase()
    if not client:
        return
    
    try:
        # Karışık kategoride target'ı belirle
        target_cat = "futbol" if category == "karisik" else category
        
        # Zaten var mı? (aynı soruyu 2 kez kaydetme)
        existing = client.table("ai_questions").select("id").eq("soru", question["soru"]).limit(1).execute()
        if existing.data and len(existing.data) > 0:
            return  # Zaten var, ekleme
        
        # Kaydet
        client.table("ai_questions").insert({
            "category": target_cat,
            "level": level,
            "soru": question["soru"],
            "secenekler": question["secenekler"],
            "cevap": question["cevap"],
            "used_count": 0
        }).execute()
        print(f"[SUPABASE] ✓ Yeni soru kaydedildi: [{target_cat}][{level}]")
    except Exception as e:
        print(f"[SUPABASE] ✗ Kaydetme hatası: {e}")


def supabase_get_questions(category, level, exclude_soru_list):
    """Supabase'den kullanıcının görmediği soruları çek"""
    client = get_supabase()
    if not client:
        return []
    
    try:
        target_cat = "futbol" if category == "karisik" else category
        
        # Supabase'den tüm bu kategori+level sorularını çek
        # (karışıksa hem futbol hem genel_kultur)
        if category == "karisik":
            response = client.table("ai_questions").select("*").in_("category", ["futbol", "genel_kultur"]).eq("level", level).execute()
        else:
            response = client.table("ai_questions").select("*").eq("category", target_cat).eq("level", level).execute()
        
        if not response.data:
            return []
        
        # Görmediği soruları filtrele
        excluded = set(exclude_soru_list) if exclude_soru_list else set()
        available = [q for q in response.data if q["soru"] not in excluded]
        
        print(f"[SUPABASE] {len(available)}/{len(response.data)} kullanılabilir soru [{target_cat}][{level}]")
        return available
    except Exception as e:
        print(f"[SUPABASE] ✗ Sorgu hatası: {e}")
        return []


def verify_turnstile_token(token, remote_ip=""):
    """Cloudflare Turnstile token'ını doğrula"""
    if not TURNSTILE_SECRET:
        # Secret yoksa (dev ortamı) doğrulama atla
        print("[TURNSTILE] Secret yok, doğrulama atlandı")
        return True
    
    if not token:
        print("[TURNSTILE] Token yok, reddedildi")
        return False
    
    try:
        # Cloudflare'e istek gönder
        url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        data = urllib.parse.urlencode({
            "secret": TURNSTILE_SECRET,
            "response": token,
            "remoteip": remote_ip
        }).encode("utf-8")
        
        req = urllib.request.Request(url, data=data, method="POST")
        
        # 5 saniye timeout
        with urllib.request.urlopen(req, timeout=5) as response:
            result = json.loads(response.read().decode("utf-8"))
        
        if result.get("success"):
            print(f"[TURNSTILE] ✓ Doğrulama başarılı")
            return True
        else:
            errors = result.get("error-codes", [])
            print(f"[TURNSTILE] ✗ Doğrulama başarısız: {errors}")
            return False
    except Exception as e:
        print(f"[TURNSTILE] Hata: {e}")
        # Cloudflare'e ulaşılamıyorsa varsayılan olarak kabul et (site down olmasın)
        return True

ML_PARA = [500, 1000, 2000, 3000, 5000, 7500, 15000, 30000, 60000, 125000, 250000, 1000000]
ML_PARA_STR = ["500", "1.000", "2.000", "3.000", "5.000", "7.500", "15.000", "30.000", "60.000", "125.000", "250.000", "1.000.000"]
# ✨ Karışık için klasik progresif zorluk sırası (12 soruluk)
ML_FLOW_KARISIK_BASE = ["kolay", "kolay", "orta", "orta", "orta", "zor", "zor", "zor", "zor", "cok_zor", "cok_zor", "cok_zor"]
ML_TOPLAM_SORU = 12
ML_ALLOWED_TOTAL_Q = [6, 8, 10, 12, 15, 20, 25]


def get_ml_flow(difficulty, total_q=12):
    """Zorluk seçimine göre N soruluk zorluk dizisini döndür"""
    if difficulty == "karisik":
        # Base 12'yi total_q'ya ölçekle
        base = ML_FLOW_KARISIK_BASE
        result = []
        for i in range(total_q):
            idx = int(i * len(base) / total_q)
            if idx >= len(base):
                idx = len(base) - 1
            result.append(base[idx])
        return result
    elif difficulty in ["kolay", "orta", "zor", "cok_zor"]:
        return [difficulty] * total_q
    else:
        return get_ml_flow("karisik", total_q)


def get_ml_prize(q_idx, total_q):
    """Soru index'ine göre ödül miktarını hesapla (12 dışı sayılar için ölçekle)"""
    if total_q == 12:
        return ML_PARA[q_idx], ML_PARA_STR[q_idx]
    # 12'den farklıysa ML_PARA'yı ölçekle
    idx = int(q_idx * (len(ML_PARA) - 1) / max(1, total_q - 1))
    if idx >= len(ML_PARA):
        idx = len(ML_PARA) - 1
    return ML_PARA[idx], ML_PARA_STR[idx]


def get_ml_para_agaci(total_q):
    """N soruluk oyun için para ağacı string listesi"""
    if total_q == 12:
        return ML_PARA_STR[:]
    result = []
    for i in range(total_q):
        _, ps = get_ml_prize(i, total_q)
        result.append(ps)
    return result


def _handled(room_code, player_id):
    return {"handled": True, "room_code": room_code, "player_id": player_id}


def _not_handled(room_code, player_id):
    return {"handled": False, "room_code": room_code, "player_id": player_id}


def get_other_player_id(pid):
    """SADECE 2 kişilik oyunlar için - artık kullanılmıyor"""
    return 2 if pid == 1 else 1


def get_next_ml_turn_player(room):
    """Sıradaki oyuncunun ID'sini döndür (2-5 kişi destekli, round-robin)"""
    active_ids = sorted(room["players"].keys())
    if not active_ids:
        return None
    current = room.get("ml_current_player", active_ids[0])
    if current not in active_ids:
        return active_ids[0]
    idx = active_ids.index(current)
    next_idx = (idx + 1) % len(active_ids)
    return active_ids[next_idx]


def ml_pick_question(room, q_idx):
    """
    ✨ Öncelik Sırası:
    1. Manuel havuz (questions.py)
    2. Supabase havuzu
    3. Oda AI havuzu
    4. Fallback
    """
    difficulty = room.get("ml_difficulty", "karisik")
    total_q = room.get("ml_total_questions", ML_TOPLAM_SORU)
    flow = get_ml_flow(difficulty, total_q)
    # q_idx toplam soruyu geçerse son level
    if q_idx >= len(flow):
        level = flow[-1]
    else:
        level = flow[q_idx]
    played = room.get("ml_played", [])  # Bu oyun içinde gösterilenler
    seen_hashes = room.get("ml_seen_hashes", set())  # Kullanıcının geçmişte gördükleri
    category = room.get("ml_category", "futbol")
    
    # --- 1. MANUEL HAVUZDAN dene (questions.py) ---
    if category == "karisik":
        pool = []
        for cat in ["futbol", "genel_kultur"]:
            for q in ML_QUESTIONS.get(cat, {}).get(level, []):
                if q["soru"] not in played and q["soru"] not in seen_hashes:
                    pool.append(q)
    else:
        pool = [q for q in ML_QUESTIONS.get(category, {}).get(level, []) 
                if q["soru"] not in played and q["soru"] not in seen_hashes]

    if pool:
        q = random.choice(pool)
        played.append(q["soru"])
        room["ml_played"] = played
        print(f"[ML] Manuel havuzdan seçildi (level={level})")
        return q
    
    # --- 2. SUPABASE havuzundan dene (AI'nın önceden ürettikleri, kalıcı) ---
    excluded = list(played) + list(seen_hashes)
    supabase_pool = supabase_get_questions(category, level, excluded)
    if supabase_pool:
        q = random.choice(supabase_pool)
        played.append(q["soru"])
        room["ml_played"] = played
        print(f"[ML] Supabase havuzundan seçildi (level={level})")
        # Formatı düzelt (secenekler zaten liste olmalı)
        return {
            "soru": q["soru"],
            "secenekler": q["secenekler"] if isinstance(q["secenekler"], list) else json.loads(q["secenekler"]),
            "cevap": q["cevap"]
        }
    
    # --- 3. ODA AI HAVUZUNDAN dene (varsa) ---
    ai_pool = room.get("ml_ai_questions", {})
    if ai_pool and level in ai_pool:
        ai_sorular = [q for q in ai_pool[level] 
                      if q["soru"] not in played and q["soru"] not in seen_hashes]
        if ai_sorular:
            q = random.choice(ai_sorular)
            played.append(q["soru"])
            room["ml_played"] = played
            print(f"[ML] Oda AI havuzundan seçildi (level={level})")
            supabase_save_question(category, level, q)
            return q
    
    # --- 4. FALLBACK: history dikkate almadan tekrar dene (kullanıcı bu sorulari zaten görmüş ama başka çare yok) ---
    print(f"[ML] ⚠️ Yeni soru bulunamadı, tekrarlanan soru gösterilebilir (level={level})")
    
    if category == "karisik":
        pool = []
        for cat in ["futbol", "genel_kultur"]:
            for q in ML_QUESTIONS.get(cat, {}).get(level, []):
                if q["soru"] not in played:
                    pool.append(q)
    else:
        pool = [q for q in ML_QUESTIONS.get(category, {}).get(level, []) if q["soru"] not in played]
    
    if pool:
        q = random.choice(pool)
        played.append(q["soru"])
        room["ml_played"] = played
        return q
    
    # Bu oyunda gösterilenleri sıfırla
    room["ml_played"] = []
    return ml_pick_question(room, q_idx)

async def ml_turn_timer(room, turn_id, question_no, broadcast):
    try:
        seconds = room.get("turn_seconds", 60)
        await asyncio.sleep(seconds)

        if room.get("phase") != "playing":
            return
        if room.get("ml_current_player") != turn_id:
            return
        if room.get("ml_q_idx") != question_no:
            return
        if room.get("ml_answered"):
            return
        if turn_id not in room.get("players", {}):
            return

        print(f"[ML TIMER] Süre doldu, oyuncu {turn_id}")

        room["ml_answered"] = True
        q = room["ml_current_q"]
        
        q_idx = room.get("ml_q_idx", 0)
        total_q = room.get("ml_total_questions", ML_TOPLAM_SORU)
        prize, _ = get_ml_prize(q_idx, total_q)
        if turn_id in room["scores"]:
            room["scores"][turn_id] -= prize

        await broadcast(room, {
            "type": "ml_answer_result",
            "player_id": turn_id,
            "correct": False,
            "timeout": True,
            "selected": None,
            "correct_answer": q["cevap"],
            "scores": room["scores"]
        })

        await asyncio.sleep(3)
        await ml_next_turn(room, broadcast)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[ML TIMER HATA] {e}")


async def ml_next_turn(room, broadcast):
    """Sıra bitti → sıradaki oyuncuya geç, gerektiğinde q_idx artır"""
    current_player = room["ml_current_player"]
    total_q = room.get("ml_total_questions", ML_TOPLAM_SORU)
    
    # Şu anki oyuncunun soru sayacını artır
    if current_player in room["ml_player_q_idx"]:
        room["ml_player_q_idx"][current_player] += 1
    
    # Sıradaki oyuncuyu bul (round-robin, aktif oyuncular arasında)
    next_player = get_next_ml_turn_player(room)
    if next_player is None:
        await ml_finish(room, broadcast)
        return
    
    # Sıradaki oyuncu total_q'ya ulaştıysa oyun bitti
    if room["ml_player_q_idx"].get(next_player, 0) >= total_q:
        # Herkesin sorusu bitti mi?
        all_done = all(
            room["ml_player_q_idx"].get(pid, 0) >= total_q
            for pid in room["players"].keys()
        )
        if all_done:
            await ml_finish(room, broadcast)
            return
        # Bir tur daha at (bu oyuncu bitti ama diğerleri devam)
        # Sıra atlama: bu oyuncuyu pas geç, sıra bir sonraki oyuncuya
        room["ml_current_player"] = next_player  # geçici
        await ml_next_turn(room, broadcast)
        return

    q_idx = room["ml_player_q_idx"][next_player]
    q = ml_pick_question(room, q_idx)
    q = {
        "soru": q["soru"],
        "secenekler": list(q["secenekler"]),
        "cevap": q["cevap"]
    }

    room["ml_current_player"] = next_player
    room["ml_q_idx"] = q_idx
    room["ml_current_q"] = q
    room["ml_answered"] = False
    room["ml_removed"] = []
    
    difficulty = room.get("ml_difficulty", "karisik")
    flow = get_ml_flow(difficulty, total_q)
    prize, prize_str = get_ml_prize(q_idx, total_q)

    await broadcast(room, {
        "type": "ml_new_question",
        "current_player": next_player,
        "q_idx": q_idx,
        "question": q["soru"],
        "options": q["secenekler"],
        "prize": prize,
        "prize_str": prize_str,
        "level": flow[q_idx] if q_idx < len(flow) else flow[-1],
        "scores": room["scores"],
        "jokers": room["ml_jokers"],
        "total_questions": total_q
    })

    old_task = room.get("ml_task")
    if old_task and not old_task.done():
        old_task.cancel()
    room["ml_task"] = asyncio.create_task(ml_turn_timer(room, next_player, q_idx, broadcast))


async def ml_finish(room, broadcast):
    room["phase"] = "over"
    
    # Sıralama (yüksekten alçağa)
    sorted_scores = sorted(room["scores"].items(), key=lambda x: -x[1])
    ranking = []
    for pid, score in sorted_scores:
        pname = "?"
        if pid in room["players"]:
            pname = room["players"][pid]["name"]
        elif pid in room.get("left_players", {}):
            pname = room["left_players"][pid]
        ranking.append({"player_id": pid, "name": pname, "score": score})
    
    winner_id = ranking[0]["player_id"] if ranking else 0
    # Beraberlik
    if len(ranking) >= 2 and ranking[0]["score"] == ranking[1]["score"]:
        winner_id = 0

    await broadcast(room, {
        "type": "ml_game_over",
        "scores": room["scores"],
        "winner_id": winner_id,
        "ranking": ranking
    })


async def start_ml_game(room, safe_send, broadcast):
    room["phase"] = "playing"
    active_ids = sorted(room["players"].keys())
    total_q = room.get("ml_total_questions", ML_TOPLAM_SORU)
    
    room["scores"] = {pid: 0 for pid in active_ids}
    room["ml_played"] = []
    room["ml_player_q_idx"] = {pid: 0 for pid in active_ids}
    room["ml_answered"] = False
    room["ml_removed"] = []
    room["left_players"] = {}
    if "ml_seen_hashes" not in room:
        room["ml_seen_hashes"] = set()
    room["ml_jokers"] = {
        pid: {"fifty": True, "audience": True, "phone": True}
        for pid in active_ids
    }
    
    print(f"[ML] Oyun başlıyor - Oyuncu: {len(active_ids)}, Soru: {total_q}")

    first_player = active_ids[0]
    q_idx = 0
    q = ml_pick_question(room, q_idx)
    q = {
        "soru": q["soru"],
        "secenekler": list(q["secenekler"]),
        "cevap": q["cevap"]
    }

    room["ml_current_player"] = first_player
    room["ml_q_idx"] = q_idx
    room["ml_current_q"] = q
    
    difficulty = room.get("ml_difficulty", "karisik")
    flow = get_ml_flow(difficulty, total_q)
    prize, prize_str = get_ml_prize(q_idx, total_q)
    para_agaci = get_ml_para_agaci(total_q)

    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]

    for pid, pdata in room["players"].items():
        await safe_send(pdata["ws"], {
            "type": "ml_game_started",
            "player_id": pid,
            "players": players,
            "category": room.get("ml_category", "futbol"),
            "turn_seconds": room.get("turn_seconds", 60),
            "current_player": first_player,
            "q_idx": q_idx,
            "question": q["soru"],
            "options": q["secenekler"],
            "prize": prize,
            "prize_str": prize_str,
            "level": flow[q_idx] if q_idx < len(flow) else flow[-1],
            "scores": room["scores"],
            "jokers": room["ml_jokers"],
            "para_agaci": para_agaci,
            "total_questions": total_q,
            "max_players": room.get("ml_max_players", 2)
        })

    room["ml_task"] = asyncio.create_task(ml_turn_timer(room, first_player, q_idx, broadcast))


async def send_ml_lobby_update(room, broadcast):
    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]
    max_players = room.get("ml_max_players", 2)
    await broadcast(room, {
        "type": "ml_lobby_update",
        "room_code": room["code"],
        "players": players,
        "can_start": len(room["players"]) == max_players,
        "category": room.get("ml_category", "futbol"),
        "difficulty": room.get("ml_difficulty", "karisik"),
        "turn_seconds": room.get("turn_seconds", 60),
        "ai_ready": room.get("ml_ai_ready", False),
        "max_players": max_players,
        "total_questions": room.get("ml_total_questions", ML_TOPLAM_SORU)
    })


# Global AI rate limit (herkes için)
_last_ai_calls = []
_MAX_AI_PER_MINUTE = 10  # Tüm siteden dakikada max 10 AI çağrısı


def _check_global_ai_rate_limit():
    """Global AI rate limit kontrolü"""
    global _last_ai_calls
    import time
    now = time.time()
    _last_ai_calls = [t for t in _last_ai_calls if now - t < 60]
    if len(_last_ai_calls) >= _MAX_AI_PER_MINUTE:
        return False
    _last_ai_calls.append(now)
    return True


async def _background_generate_ai_questions(room, broadcast):
    """Oda oluştururken arka planda AI sorularını üret"""
    try:
        # Global AI rate limit kontrolü
        if not _check_global_ai_rate_limit():
            print(f"[ML BG] ⚠️ Global AI rate limit aşıldı → Manuel havuz devreye girdi (547 soru)")
            room["ml_ai_questions"] = {}
            room["ml_ai_ready"] = True
            if room.get("phase") == "lobby":
                await send_ml_lobby_update(room, broadcast)
            return
        
        category = room.get("ml_category", "futbol")
        difficulty = room.get("ml_difficulty", "karisik")
        
        print(f"[ML BG] Arka planda AI soruları üretiliyor... Kategori: {category} | Zorluk: {difficulty}")
        
        ai_questions = await generate_questions_async(category, difficulty)
        
        if ai_questions:
            room["ml_ai_questions"] = ai_questions
            room["ml_ai_ready"] = True
            print(f"[ML BG] ✓ AI soruları hazır!")
            
            # ✨ SUPABASE'E DE KAYDET (kalıcı olsun, ileride kullanılsın)
            saved_count = 0
            for level, questions in ai_questions.items():
                for q in questions:
                    try:
                        supabase_save_question(category, level, q)
                        saved_count += 1
                    except Exception as e:
                        print(f"[ML BG] Supabase kayıt hatası: {e}")
            print(f"[ML BG] ✓ {saved_count} soru Supabase'e kaydedildi")
        else:
            # ✨ AI başarısız olsa bile havuz hazır (questions.py + Supabase var)
            room["ml_ai_questions"] = {}
            room["ml_ai_ready"] = True
            print(f"[ML BG] ✗ AI başarısız, ama manuel havuz + Supabase kullanılabilir → HAZIR")
        
        # Lobby'yi güncelle (AI hazır olduğunu bildir)
        if room.get("phase") == "lobby":
            await send_ml_lobby_update(room, broadcast)
    except asyncio.CancelledError:
        print("[ML BG] Arka plan üretim iptal edildi")
    except Exception as e:
        print(f"[ML BG] Hata: {e} - Manuel sorulara geçildi")
        room["ml_ai_questions"] = {}
        room["ml_ai_ready"] = True  # Manuel havuz hazır, bekletme


async def handle_milyoner_message(
    *,
    msg_type,
    data,
    websocket,
    rooms,
    room_code,
    player_id,
    make_room_code,
    safe_send,
    broadcast
):
    if not str(msg_type).startswith("ml_"):
        return _not_handled(room_code, player_id)

    current_room_code = room_code
    current_player_id = player_id

    # ---------- CREATE ----------
    if msg_type == "ml_create_room":
        name = (data.get("name") or "").strip()
        category = (data.get("category") or "futbol").strip()
        difficulty = (data.get("difficulty") or "karisik").strip()
        turn_seconds_raw = data.get("turn_seconds", 60)
        turnstile_token = data.get("turnstile_token", "")
        max_players_raw = data.get("max_players", 2)
        total_q_raw = data.get("total_questions", ML_TOPLAM_SORU)

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)
        
        # Turnstile doğrulama (bot koruması)
        client_ip = ""
        try:
            if hasattr(websocket, 'client') and websocket.client:
                client_ip = websocket.client.host
        except:
            pass
        
        if not verify_turnstile_token(turnstile_token, client_ip):
            await safe_send(websocket, {
                "type": "error",
                "message": "Güvenlik doğrulaması başarısız. Sayfayı yenileyip tekrar deneyin."
            })
            return _handled(current_room_code, current_player_id)

        if category not in ["futbol", "genel_kultur", "karisik"]:
            category = "futbol"

        if difficulty not in ["kolay", "orta", "zor", "cok_zor", "karisik"]:
            difficulty = "karisik"

        try:
            ml_turn_seconds = int(turn_seconds_raw)
            if ml_turn_seconds not in [15, 30, 45, 60, 120]:
                ml_turn_seconds = 60
        except:
            ml_turn_seconds = 60

        try:
            max_players = int(max_players_raw)
            if max_players not in [2, 3, 4, 5]:
                max_players = 2
        except:
            max_players = 2

        try:
            total_q = int(total_q_raw)
            if total_q not in ML_ALLOWED_TOTAL_Q:
                total_q = ML_TOPLAM_SORU
        except:
            total_q = ML_TOPLAM_SORU

        current_room_code = make_room_code()
        current_player_id = 1

        rooms[current_room_code] = {
            "code": current_room_code,
            "mode": "kim_milyoner",
            "players": {1: {"ws": websocket, "name": name}},
            "phase": "lobby",
            "turn_seconds": ml_turn_seconds,
            "ml_category": category,
            "ml_difficulty": difficulty,
            "ml_max_players": max_players,
            "ml_total_questions": total_q,
            "ml_played": [],
            "ml_player_q_idx": {},
            "ml_current_player": 1,
            "ml_q_idx": 0,
            "ml_current_q": None,
            "ml_answered": False,
            "ml_removed": [],
            "ml_task": None,
            "ml_ai_questions": {},
            "ml_ai_ready": False,
            "ml_ai_generation_task": None,
            "ml_jokers": {},
            "scores": {},
            "left_players": {}
        }

        await safe_send(websocket, {
            "type": "ml_room_created",
            "room_code": current_room_code,
            "player_id": 1,
            "category": category,
            "difficulty": difficulty,
            "turn_seconds": ml_turn_seconds,
            "max_players": max_players,
            "total_questions": total_q
        })
        await send_ml_lobby_update(rooms[current_room_code], broadcast)
        
        # ✨ Manuel havuz + Supabase yeterli, AI'yı SADECE oyun sırasında ihtiyaç olursa çağırırız
        # (Böylece oda hemen hazır olur, kullanıcı Start basabilir)
        room_ref = rooms[current_room_code]
        room_ref["ml_ai_ready"] = True  # Havuz hazır
        room_ref["ml_ai_questions"] = {}
        print(f"[ML] Oda hazır, Start basılabilir (AI ihtiyaç anında devreye girer)")
        
        return _handled(current_room_code, current_player_id)

    # ---------- JOIN ----------
    if msg_type == "ml_join_room":
        name = (data.get("name") or "").strip()
        join_code = (data.get("room_code") or "").strip().upper()

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)
        if join_code not in rooms:
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            return _handled(current_room_code, current_player_id)

        room = rooms[join_code]
        if room.get("mode") != "kim_milyoner":
            await safe_send(websocket, {"type": "error", "message": "Bu oda farklı bir mod için."})
            return _handled(current_room_code, current_player_id)
        
        max_players = room.get("ml_max_players", 2)
        if len(room["players"]) >= max_players:
            await safe_send(websocket, {"type": "error", "message": f"Oda dolu ({max_players}/{max_players})."})
            return _handled(current_room_code, current_player_id)
        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Oyun zaten başlamış."})
            return _handled(current_room_code, current_player_id)
        
        existing_names = [p.get("name", "").lower().strip() for p in room["players"].values()]
        if name.lower().strip() in existing_names:
            await safe_send(websocket, {
                "type": "error",
                "message": f"Bu isimde ({name}) bir oyuncu zaten odada var. Farklı bir isim seç."
            })
            return _handled(current_room_code, current_player_id)

        # Boş slot bul
        used_ids = set(room["players"].keys())
        new_pid = None
        for pid in range(1, max_players + 1):
            if pid not in used_ids:
                new_pid = pid
                break
        if new_pid is None:
            await safe_send(websocket, {"type": "error", "message": "Oda dolu."})
            return _handled(current_room_code, current_player_id)

        current_room_code = join_code
        current_player_id = new_pid
        room["players"][new_pid] = {"ws": websocket, "name": name}

        await safe_send(websocket, {
            "type": "ml_room_joined",
            "room_code": current_room_code,
            "player_id": new_pid,
            "category": room.get("ml_category", "futbol"),
            "difficulty": room.get("ml_difficulty", "karisik"),
            "turn_seconds": room.get("turn_seconds", 60),
            "max_players": max_players,
            "total_questions": room.get("ml_total_questions", ML_TOPLAM_SORU)
        })
        await send_ml_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- Oda kontrolü ----------
    if not current_room_code or current_room_code not in rooms:
        return _handled(current_room_code, current_player_id)

    room = rooms[current_room_code]
    if room.get("mode") != "kim_milyoner":
        return _handled(current_room_code, current_player_id)

    # ---------- UPDATE ROOM SETTINGS ----------
    if msg_type == "ml_update_settings":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host ayarları değiştirebilir."})
            return _handled(current_room_code, current_player_id)
        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Sadece lobbyde ayarları değiştirebilirsin."})
            return _handled(current_room_code, current_player_id)

        try:
            new_turn_sec = int(data.get("turn_seconds", room.get("turn_seconds", 60)))
            if new_turn_sec not in [15, 30, 45, 60, 120]:
                new_turn_sec = 60
        except:
            new_turn_sec = 60

        try:
            new_max = int(data.get("max_players", room.get("ml_max_players", 2)))
            if new_max not in [2, 3, 4, 5]:
                new_max = room.get("ml_max_players", 2)
            if new_max < len(room["players"]):
                new_max = room.get("ml_max_players", 2)
        except:
            new_max = room.get("ml_max_players", 2)

        try:
            new_total_q = int(data.get("total_questions", room.get("ml_total_questions", ML_TOPLAM_SORU)))
            if new_total_q not in ML_ALLOWED_TOTAL_Q:
                new_total_q = room.get("ml_total_questions", ML_TOPLAM_SORU)
        except:
            new_total_q = room.get("ml_total_questions", ML_TOPLAM_SORU)

        new_cat = (data.get("category") or room.get("ml_category", "futbol")).strip()
        if new_cat not in ["futbol", "genel_kultur", "karisik"]:
            new_cat = room.get("ml_category", "futbol")

        new_diff = (data.get("difficulty") or room.get("ml_difficulty", "karisik")).strip()
        if new_diff not in ["kolay", "orta", "zor", "cok_zor", "karisik"]:
            new_diff = room.get("ml_difficulty", "karisik")

        room["turn_seconds"] = new_turn_sec
        room["ml_max_players"] = new_max
        room["ml_total_questions"] = new_total_q
        room["ml_category"] = new_cat
        room["ml_difficulty"] = new_diff

        await send_ml_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- START ----------
    if msg_type == "ml_start_game":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return _handled(current_room_code, current_player_id)
        max_players = room.get("ml_max_players", 2)
        if len(room["players"]) != max_players:
            await safe_send(websocket, {"type": "error", "message": f"{max_players} oyuncu gerekli."})
            return _handled(current_room_code, current_player_id)
        
        # ✨ Her iki oyuncudan da seen_hashes al ve birleştir
        # (Frontend'den gelen seen_hashes host'un, ama misafirinki de dahil edilmeli)
        # Şimdilik sadece host'un history'sini kullan
        seen_hashes = data.get("seen_hashes", [])
        if isinstance(seen_hashes, list):
            room["ml_seen_hashes"] = set(seen_hashes)
            print(f"[ML] Host history: {len(seen_hashes)} soru dışlanacak")
        else:
            room["ml_seen_hashes"] = set()
        
        await start_ml_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- ANSWER ----------
    if msg_type == "ml_answer":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("ml_current_player") != current_player_id:
            await safe_send(websocket, {"type": "error", "message": "Sıra sende değil."})
            return _handled(current_room_code, current_player_id)
        if room.get("ml_answered"):
            return _handled(current_room_code, current_player_id)

        letter = (data.get("letter") or "").strip().upper()
        if letter not in ["A", "B", "C", "D"]:
            return _handled(current_room_code, current_player_id)

        q = room.get("ml_current_q")
        if not q:
            return _handled(current_room_code, current_player_id)

        correct_letter = q["cevap"]
        correct = (letter == correct_letter)

        q_idx = room.get("ml_q_idx", 0)
        if correct:
            room["scores"][current_player_id] += ML_PARA[q_idx]
        else:
            # ✨ Yanlış cevap → soru değeri kadar - puan
            room["scores"][current_player_id] -= ML_PARA[q_idx]

        room["ml_answered"] = True

        old_task = room.get("ml_task")
        if old_task and not old_task.done():
            old_task.cancel()

        await broadcast(room, {
            "type": "ml_answer_result",
            "player_id": current_player_id,
            "correct": correct,
            "timeout": False,
            "selected": letter,
            "correct_answer": correct_letter,
            "scores": room["scores"]
        })

        await asyncio.sleep(3)
        await ml_next_turn(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- JOKER ----------
    if msg_type == "ml_joker":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("ml_current_player") != current_player_id:
            await safe_send(websocket, {"type": "error", "message": "Sıra sende değil."})
            return _handled(current_room_code, current_player_id)
        if room.get("ml_answered"):
            return _handled(current_room_code, current_player_id)

        joker = (data.get("joker") or "").strip().lower()
        if joker not in ["fifty", "audience", "phone"]:
            return _handled(current_room_code, current_player_id)

        jok = room["ml_jokers"][current_player_id]
        if not jok.get(joker, False):
            return _handled(current_room_code, current_player_id)

        q = room.get("ml_current_q")
        if not q:
            return _handled(current_room_code, current_player_id)

        jok[joker] = False

        # 50:50
        if joker == "fifty":
            correct_letter = q["cevap"]
            wrong = [l for l in ["A", "B", "C", "D"] if l != correct_letter]
            removed = random.sample(wrong, 2)

            new_opts = []
            for opt in q["secenekler"]:
                if opt and len(opt) >= 2 and opt[0] in removed:
                    new_opts.append(f"{opt[0]}) ---")
                else:
                    new_opts.append(opt)

            room["ml_removed"] = removed
            room["ml_current_q"]["secenekler"] = new_opts

            await broadcast(room, {
                "type": "ml_joker_result",
                "player_id": current_player_id,
                "joker": "fifty",
                "removed": removed,
                "options": new_opts,
                "jokers": room["ml_jokers"]
            })
            return _handled(current_room_code, current_player_id)

        # Audience
        if joker == "audience":
            correct_letter = q["cevap"]
            cp = random.randint(50, 85)
            rem = 100 - cp
            ws = [l for l in ["A", "B", "C", "D"] if l != correct_letter]
            vs = []
            for _ in range(2):
                v = random.randint(0, rem)
                vs.append(v)
                rem -= v
            vs.append(rem)
            random.shuffle(vs)

            result = {correct_letter: cp}
            for i, w in enumerate(ws):
                result[w] = vs[i]

            await broadcast(room, {
                "type": "ml_joker_result",
                "player_id": current_player_id,
                "joker": "audience",
                "result": result,
                "jokers": room["ml_jokers"]
            })
            return _handled(current_room_code, current_player_id)

        # Phone
        if joker == "phone":
            correct_letter = q["cevap"]
            
            # Frontend'den gelen is_bad bilgisi
            # is_bad=True → %20 doğru (kötü karakter)
            # is_bad=False → %80 doğru (iyi karakter)
            is_bad = data.get("is_bad", False)
            success_rate = 0.20 if is_bad else 0.80
            
            pick = correct_letter if random.random() <= success_rate else random.choice(
                [l for l in ["A", "B", "C", "D"] if l != correct_letter]
            )

            result_text = pick
            for s in q["secenekler"]:
                if s and s.startswith(pick):
                    result_text = s
                    break

            await broadcast(room, {
                "type": "ml_joker_result",
                "player_id": current_player_id,
                "joker": "phone_calling",
                "jokers": room["ml_jokers"]
            })

            await broadcast(room, {
                "type": "ml_joker_result",
                "player_id": current_player_id,
                "joker": "phone_result",
                "result": result_text,
                "jokers": room["ml_jokers"]
            })
            return _handled(current_room_code, current_player_id)

        return _handled(current_room_code, current_player_id)
        
    # ---------- TELEFON POPUP GÖSTER (relay) ----------
    if msg_type == "ml_phone_popup_show":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        # Sadece oynayan gönderebilir
        if room.get("ml_current_player") != current_player_id:
            return _handled(current_room_code, current_player_id)
        
        # Diğer oyunculara (izleyicilere) ilet
        contacts = data.get("contacts", [])
        for pid, pdata in room["players"].items():
            if pid != current_player_id:
                await safe_send(pdata["ws"], {
                    "type": "ml_phone_popup_show",
                    "contacts": contacts,
                    "player_id": current_player_id
                })
        return _handled(current_room_code, current_player_id)
    
    # ---------- TELEFON KİŞİ SEÇİLDİ (relay) ----------
    if msg_type == "ml_phone_contact_selected":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("ml_current_player") != current_player_id:
            return _handled(current_room_code, current_player_id)
        
        # Diğer oyunculara (izleyicilere) hangi kişi seçildiğini bildir
        contact_index = data.get("contact_index", 0)
        for pid, pdata in room["players"].items():
            if pid != current_player_id:
                await safe_send(pdata["ws"], {
                    "type": "ml_phone_contact_selected",
                    "contact_index": contact_index,
                    "player_id": current_player_id
                })
        return _handled(current_room_code, current_player_id)
    
    # ---------- REMATCH ----------
    if msg_type == "ml_rematch":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host tekrar başlatabilir."})
            return _handled(current_room_code, current_player_id)
        if len(room["players"]) < 2:
            return _handled(current_room_code, current_player_id)
        
        # Rematch'te odada kaç kişi varsa onlarla başla
        room["ml_max_players"] = len(room["players"])
        
        seen_hashes = data.get("seen_hashes", [])
        if isinstance(seen_hashes, list):
            room["ml_seen_hashes"] = set(seen_hashes)
        
        await start_ml_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- BACK TO LOBBY ----------
    if msg_type == "ml_back_to_lobby":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host lobiye döndürebilir."})
            return _handled(current_room_code, current_player_id)
        
        room["phase"] = "lobby"
        room["ml_max_players"] = len(room["players"])
        
        old_task = room.get("ml_task")
        if old_task and not old_task.done():
            old_task.cancel()
        
        await broadcast(room, {"type": "ml_back_to_lobby"})
        await send_ml_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    return _handled(current_room_code, current_player_id)