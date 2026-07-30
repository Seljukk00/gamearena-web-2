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
ML_FLOW = ["kolay", "kolay", "orta", "orta", "orta", "zor", "zor", "zor", "zor", "cok_zor", "cok_zor", "cok_zor"]
ML_TOPLAM_SORU = 12


def _handled(room_code, player_id):
    return {"handled": True, "room_code": room_code, "player_id": player_id}


def _not_handled(room_code, player_id):
    return {"handled": False, "room_code": room_code, "player_id": player_id}


def get_other_player_id(pid):
    return 2 if pid == 1 else 1


def ml_pick_question(room, q_idx):
    """Sorucular önce AI havuzundan, yoksa manuel havuzdan"""
    level = ML_FLOW[q_idx]
    played = room.get("ml_played", [])
    
    # AI soruları var mı?
    ai_pool = room.get("ml_ai_questions", {})
    
    # AI havuzundan dene
    if ai_pool and level in ai_pool:
        ai_sorular = [q for q in ai_pool[level] if q["soru"] not in played]
        if ai_sorular:
            q = random.choice(ai_sorular)
            played.append(q["soru"])
            room["ml_played"] = played
            return q
    
    # AI'de yoksa manuel havuzdan
    category = room.get("ml_category", "futbol")
    
    if category == "karisik":
        pool = []
        for cat in ["futbol", "genel_kultur"]:
            for q in ML_QUESTIONS.get(cat, {}).get(level, []):
                if q["soru"] not in played:
                    pool.append(q)
    else:
        pool = [q for q in ML_QUESTIONS.get(category, {}).get(level, []) if q["soru"] not in played]

    if not pool:
        room["ml_played"] = []
        return ml_pick_question(room, q_idx)

    q = random.choice(pool)
    played.append(q["soru"])
    room["ml_played"] = played
    return q


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

        print(f"[ML TIMER] Süre doldu, oyuncu {turn_id}")

        room["ml_answered"] = True
        q = room["ml_current_q"]

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
    current_player = room["ml_current_player"]
    other_player = get_other_player_id(current_player)

    room["ml_player_q_idx"][current_player] += 1

    next_player = other_player

    if room["ml_player_q_idx"][next_player] >= ML_TOPLAM_SORU:
        if room["ml_player_q_idx"][current_player] >= ML_TOPLAM_SORU:
            await ml_finish(room, broadcast)
            return
        next_player = current_player

    if room["ml_player_q_idx"][next_player] >= ML_TOPLAM_SORU:
        await ml_finish(room, broadcast)
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

    await broadcast(room, {
        "type": "ml_new_question",
        "current_player": next_player,
        "q_idx": q_idx,
        "question": q["soru"],
        "options": q["secenekler"],
        "prize": ML_PARA[q_idx],
        "prize_str": ML_PARA_STR[q_idx],
        "level": ML_FLOW[q_idx],
        "scores": room["scores"],
        "jokers": room["ml_jokers"]
    })

    old_task = room.get("ml_task")
    if old_task and not old_task.done():
        old_task.cancel()
    room["ml_task"] = asyncio.create_task(ml_turn_timer(room, next_player, q_idx, broadcast))


async def ml_finish(room, broadcast):
    room["phase"] = "over"
    s1 = room["scores"][1]
    s2 = room["scores"][2]

    if s1 > s2:
        winner = 1
    elif s2 > s1:
        winner = 2
    else:
        winner = 0

    await broadcast(room, {
        "type": "ml_game_over",
        "scores": room["scores"],
        "winner_id": winner
    })


async def start_ml_game(room, safe_send, broadcast):
    room["phase"] = "playing"
    room["scores"] = {1: 0, 2: 0}
    room["ml_played"] = []
    room["ml_player_q_idx"] = {1: 0, 2: 0}
    room["ml_answered"] = False
    room["ml_removed"] = []
    room["ml_jokers"] = {
        1: {"fifty": True, "audience": True, "phone": True},
        2: {"fifty": True, "audience": True, "phone": True}
    }
    
    # AI hazır değilse birazcık bekle
    if not room.get("ml_ai_ready") and room.get("ml_ai_generation_task"):
        print(f"[ML] AI hala hazır değil, bekleniyor...")
        
        for pid, pdata in room["players"].items():
            await safe_send(pdata["ws"], {
                "type": "ml_loading",
                "message": "⏳ Sorular hazırlanıyor, birazdan başlıyor..."
            })
        
        # AI task'ının bitmesini bekle (maks 10 saniye)
        try:
            await asyncio.wait_for(room["ml_ai_generation_task"], timeout=10.0)
        except asyncio.TimeoutError:
            print(f"[ML] AI timeout, manuel sorularla devam")
    
    if room.get("ml_ai_ready"):
        print(f"[ML] ✓ AI soruları kullanılacak")
    else:
        print(f"[ML] Manuel sorular kullanılacak")

    first_player = 1
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
            "prize": ML_PARA[q_idx],
            "prize_str": ML_PARA_STR[q_idx],
            "level": ML_FLOW[q_idx],
            "scores": room["scores"],
            "jokers": room["ml_jokers"],
            "para_agaci": ML_PARA_STR
        })

    room["ml_task"] = asyncio.create_task(ml_turn_timer(room, first_player, q_idx, broadcast))


async def send_ml_lobby_update(room, broadcast):
    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]
    await broadcast(room, {
        "type": "ml_lobby_update",
        "room_code": room["code"],
        "players": players,
        "can_start": len(room["players"]) == 2,
        "category": room.get("ml_category", "futbol"),
        "difficulty": room.get("ml_difficulty", "karisik"),
        "turn_seconds": room.get("turn_seconds", 60),
        "ai_ready": room.get("ml_ai_ready", False)
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
            print(f"[ML BG] ⚠️ Global AI rate limit aşıldı, manuel sorular kullanılacak")
            room["ml_ai_questions"] = {}
            room["ml_ai_ready"] = True  # Ready olarak işaretle (manuel devreye girsin)
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
        else:
            room["ml_ai_questions"] = {}
            room["ml_ai_ready"] = False
            print(f"[ML BG] ✗ AI başarısız, manuel sorular kullanılacak")
        
        # Lobby'yi güncelle (AI hazır olduğunu bildir)
        if room.get("phase") == "lobby":
            await send_ml_lobby_update(room, broadcast)
    except asyncio.CancelledError:
        print("[ML BG] Arka plan üretim iptal edildi")
    except Exception as e:
        print(f"[ML BG] Hata: {e}")
        room["ml_ai_ready"] = False


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
            "ml_played": [],
            "ml_player_q_idx": {1: 0, 2: 0},
            "ml_current_player": 1,
            "ml_q_idx": 0,
            "ml_current_q": None,
            "ml_answered": False,
            "ml_removed": [],
            "ml_task": None,
            "ml_ai_questions": {},
            "ml_ai_ready": False,
            "ml_ai_generation_task": None,
            "ml_jokers": {
                1: {"fifty": True, "audience": True, "phone": True},
                2: {"fifty": True, "audience": True, "phone": True}
            },
            "scores": {1: 0, 2: 0}
        }

        await safe_send(websocket, {
            "type": "ml_room_created",
            "room_code": current_room_code,
            "player_id": 1,
            "category": category,
            "difficulty": difficulty,
            "turn_seconds": ml_turn_seconds
        })
        await send_ml_lobby_update(rooms[current_room_code], broadcast)
        
        # 🤖 AI sorularını ARKA PLANDA üretmeye başla
        room_ref = rooms[current_room_code]
        room_ref["ml_ai_generation_task"] = asyncio.create_task(
            _background_generate_ai_questions(room_ref, broadcast)
        )
        
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
        if len(room["players"]) >= 2:
            await safe_send(websocket, {"type": "error", "message": "Oda dolu."})
            return _handled(current_room_code, current_player_id)

        current_room_code = join_code
        current_player_id = 2
        room["players"][2] = {"ws": websocket, "name": name}
        room["phase"] = "lobby"

        await safe_send(websocket, {
            "type": "ml_room_joined",
            "room_code": current_room_code,
            "player_id": 2,
            "category": room.get("ml_category", "futbol"),
            "turn_seconds": room.get("turn_seconds", 60)
        })
        await send_ml_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- Oda kontrolü ----------
    if not current_room_code or current_room_code not in rooms:
        return _handled(current_room_code, current_player_id)

    room = rooms[current_room_code]
    if room.get("mode") != "kim_milyoner":
        return _handled(current_room_code, current_player_id)

    # ---------- START ----------
    if msg_type == "ml_start_game":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return _handled(current_room_code, current_player_id)
        if len(room["players"]) != 2:
            await safe_send(websocket, {"type": "error", "message": "2 oyuncu gerekli."})
            return _handled(current_room_code, current_player_id)
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
            pick = correct_letter if random.random() <= 0.9 else random.choice(
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

    # ---------- REMATCH ----------
    if msg_type == "ml_rematch":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host tekrar başlatabilir."})
            return _handled(current_room_code, current_player_id)
        if len(room["players"]) != 2:
            await safe_send(websocket, {"type": "error", "message": "2 oyuncu gerekli."})
            return _handled(current_room_code, current_player_id)
        await start_ml_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    return _handled(current_room_code, current_player_id)