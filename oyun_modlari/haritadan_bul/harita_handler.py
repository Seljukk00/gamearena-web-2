import asyncio
import random
import time

from oyun_modlari.bil_bakalim.footballers import ALL_FOOTBALLERS
from oyun_modlari.haritadan_bul.harita_data import (
    COUNTRIES as HARITA_COUNTRIES,
    get_country_key,
    get_valid_footballer_indices,
    get_footballers_by_difficulty,
    make_progressive_order
)

HARITA_TOPLAM_TUR = 10
HARITA_ALLOWED_ROUNDS = [5, 10, 15, 20]

# ✨ Süre bonusu eşikleri
FAST_BONUS_SECONDS = 10  # 10 sn içinde doğru → +2
NORMAL_ANSWER_POINT = 1  # 10 sn sonrası doğru → +1
WRONG_ANSWER_PENALTY = -1  # yanlış / timeout → -1


def _handled(room_code, player_id):
    return {"handled": True, "room_code": room_code, "player_id": player_id}


def _not_handled(room_code, player_id):
    return {"handled": False, "room_code": room_code, "player_id": player_id}


def get_other_player_id(pid):
    """SADECE 2 kişilik için (geriye uyumluluk)"""
    return 2 if pid == 1 else 1


def get_next_harita_turn_player(room):
    """Sıradaki oyuncunun ID'sini döndür (round-robin, 2-5 kişi destekli)"""
    active_ids = sorted(room["players"].keys())
    if not active_ids:
        return None
    current = room.get("turn", active_ids[0])
    if current not in active_ids:
        return active_ids[0]
    idx = active_ids.index(current)
    next_idx = (idx + 1) % len(active_ids)
    return active_ids[next_idx]


def harita_get_valid_indices():
    return get_valid_footballer_indices(ALL_FOOTBALLERS)


async def harita_turn_timer(room, turn_id, round_no, broadcast):
    try:
        seconds = room.get("turn_seconds", 30)
        if seconds == 0:
            # Sınırsız süre - timer başlatma
            return
        await asyncio.sleep(seconds)

        if room.get("phase") != "playing":
            return
        if room.get("turn") != turn_id:
            return
        if room.get("harita_round") != round_no:
            return
        if room.get("harita_answered"):
            return
        # Oyuncu ayrılmışsa timer bir şey yapmaz
        if turn_id not in room.get("players", {}):
            return

        print(f"[HARITA TIMER] Süre doldu, oyuncu {turn_id}")

        room["harita_answered"] = True

        # Timeout = -1 ceza
        if turn_id in room["scores"]:
            room["scores"][turn_id] += WRONG_ANSWER_PENALTY

        idx = room["harita_order"][round_no]
        footballer = ALL_FOOTBALLERS[idx]
        correct_code = get_country_key(footballer.get("nationality", ""))
        correct_tr = HARITA_COUNTRIES.get(correct_code, {}).get("tr", "?") if correct_code else "?"

        await broadcast(room, {
            "type": "harita_answer_result",
            "player_id": turn_id,
            "correct": False,
            "timeout": True,
            "selected_code": None,
            "selected_tr": None,
            "correct_code": correct_code,
            "correct_tr": correct_tr,
            "scores": room["scores"],
            "score_delta": WRONG_ANSWER_PENALTY
        })

        await asyncio.sleep(3)
        await harita_next_round(room, broadcast)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[HARITA TIMER HATA] {e}")


async def harita_next_round(room, broadcast):
    room["harita_round"] += 1
    total_rounds = room.get("total_rounds", HARITA_TOPLAM_TUR)

    if room["harita_round"] >= min(len(room["harita_order"]), total_rounds):
        # Oyun bitti
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
        # Beraberlik kontrolü
        if len(ranking) >= 2 and ranking[0]["score"] == ranking[1]["score"]:
            winner_id = 0
        
        await broadcast(room, {
            "type": "harita_game_over",
            "scores": room["scores"],
            "winner_id": winner_id,
            "ranking": ranking
        })
        return

    # Sıradaki oyuncuya geç (2-5 kişi destekli)
    room["turn"] = get_next_harita_turn_player(room)
    if room["turn"] is None:
        # Oda boşaldı
        return
    
    room["harita_answered"] = False
    room["turn_start_time"] = time.time()  # ✨ Tur başlangıç zamanı

    idx = room["harita_order"][room["harita_round"]]
    footballer = ALL_FOOTBALLERS[idx]

    await broadcast(room, {
        "type": "harita_new_round",
        "round_no": room["harita_round"],
        "total_rounds": total_rounds,
        "current_turn": room["turn"],
        "footballer": {
            "name": footballer["name"],
            "img_file": footballer.get("img_file", footballer["img"] + ".webp")
        },
        "scores": room["scores"]
    })

    old_task = room.get("harita_task")
    if old_task and not old_task.done():
        old_task.cancel()
    room["harita_task"] = asyncio.create_task(
        harita_turn_timer(room, room["turn"], room["harita_round"], broadcast)
    )


async def start_harita_game(room, safe_send, broadcast):
    difficulty = room.get("difficulty", "karisik")
    total_rounds = room.get("total_rounds", HARITA_TOPLAM_TUR)
    
    if difficulty == "karisik":
        order = make_progressive_order(ALL_FOOTBALLERS, total_rounds)
    else:
        valid = get_footballers_by_difficulty(ALL_FOOTBALLERS, difficulty)
        random.shuffle(valid)
        order = valid[:min(total_rounds, len(valid))]
    
    if not order:
        valid = harita_get_valid_indices()
        random.shuffle(valid)
        order = valid[:total_rounds]
    
    # Yetmezse tekrar eklensin
    while len(order) < total_rounds:
        extra = harita_get_valid_indices()
        random.shuffle(extra)
        order.extend(extra)
    order = order[:total_rounds]
    
    active_ids = sorted(room["players"].keys())
    print(f"[HARITA] Oyun başladı — Zorluk: {difficulty}, Tur: {len(order)}, Oyuncu: {len(active_ids)}")

    room["phase"] = "playing"
    room["scores"] = {pid: 0 for pid in active_ids}
    room["harita_order"] = order
    room["harita_round"] = 0
    room["harita_answered"] = False
    room["turn"] = active_ids[0]  # İlk oyuncu başlar
    room["total_rounds"] = total_rounds
    room["turn_start_time"] = time.time()
    room["left_players"] = {}

    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]

    idx = order[0]
    footballer = ALL_FOOTBALLERS[idx]

    countries_data = {}
    for code, cdata in HARITA_COUNTRIES.items():
        countries_data[code] = {
            "x": cdata["x"],
            "y": cdata["y"],
            "tr": cdata["tr"],
            "iso": cdata.get("iso", "")
        }

    for pid, pdata in room["players"].items():
        await safe_send(pdata["ws"], {
            "type": "harita_game_started",
            "player_id": pid,
            "players": players,
            "turn_seconds": room.get("turn_seconds", 30),
            "total_rounds": total_rounds,
            "current_turn": room["turn"],
            "round_no": 0,
            "footballer": {
                "name": footballer["name"],
                "img_file": footballer.get("img_file", footballer["img"] + ".webp")
            },
            "countries": countries_data,
            "scores": room["scores"],
            "max_players": room.get("max_players", 2)
        })

    room["harita_task"] = asyncio.create_task(
        harita_turn_timer(room, room["turn"], 0, broadcast)
    )


async def send_harita_lobby_update(room, broadcast):
    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]
    max_players = room.get("max_players", 2)
    await broadcast(room, {
        "type": "harita_lobby_update",
        "room_code": room["code"],
        "players": players,
        "can_start": len(room["players"]) == max_players,
        "turn_seconds": room.get("turn_seconds", 30),
        "difficulty": room.get("difficulty", "karisik"),
        "max_players": max_players,
        "total_rounds": room.get("total_rounds", HARITA_TOPLAM_TUR)
    })


async def handle_harita_message(
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
    if not str(msg_type).startswith("harita_"):
        return _not_handled(room_code, player_id)

    current_room_code = room_code
    current_player_id = player_id

    # ---------- CREATE ----------
    if msg_type == "harita_create_room":
        name = (data.get("name") or "").strip()
        turn_seconds_raw = data.get("turn_seconds", 30)
        difficulty = (data.get("difficulty") or "karisik").strip().lower()
        max_players_raw = data.get("max_players", 2)
        total_rounds_raw = data.get("total_rounds", HARITA_TOPLAM_TUR)

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)

        try:
            harita_turn_seconds = int(turn_seconds_raw)
            if harita_turn_seconds not in [0, 15, 20, 30, 45, 60, 90, 120]:
                harita_turn_seconds = 30
        except:
            harita_turn_seconds = 30

        if difficulty not in ["kolay", "orta", "zor", "karisik"]:
            difficulty = "karisik"

        try:
            max_players = int(max_players_raw)
            if max_players not in [1, 2, 3, 4, 5]:
                max_players = 2
        except:
            max_players = 2

        try:
            total_rounds = int(total_rounds_raw)
            if total_rounds not in HARITA_ALLOWED_ROUNDS:
                total_rounds = HARITA_TOPLAM_TUR
        except:
            total_rounds = HARITA_TOPLAM_TUR

        print(f"[HARITA ODA] Zorluk: {difficulty} | Süre: {harita_turn_seconds}sn | Oyuncu: {max_players} | Tur: {total_rounds}")

        current_room_code = make_room_code()
        current_player_id = 1

        rooms[current_room_code] = {
            "code": current_room_code,
            "mode": "haritadan_bul",
            "players": {1: {"ws": websocket, "name": name}},
            "phase": "lobby",
            "turn_seconds": harita_turn_seconds,
            "difficulty": difficulty,
            "max_players": max_players,
            "total_rounds": total_rounds,
            "chat_history": [],
            "chat_last_msg_time": {},
            "scores": {},
            "harita_order": [],
            "harita_round": 0,
            "harita_answered": False,
            "turn": 1,
            "turn_start_time": 0,
            "harita_task": None,
            "left_players": {}
        }

        await safe_send(websocket, {
            "type": "harita_room_created",
            "room_code": current_room_code,
            "player_id": 1,
            "difficulty": difficulty,
            "turn_seconds": harita_turn_seconds,
            "max_players": max_players,
            "total_rounds": total_rounds
        })
        await send_harita_lobby_update(rooms[current_room_code], broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- JOIN ----------
    if msg_type == "harita_join_room":
        name = (data.get("name") or "").strip()
        join_code = (data.get("room_code") or "").strip().upper()

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)
        if join_code not in rooms:
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            return _handled(current_room_code, current_player_id)

        room = rooms[join_code]
        if room.get("mode") != "haritadan_bul":
            await safe_send(websocket, {"type": "error", "message": "Bu oda farklı bir mod için."})
            return _handled(current_room_code, current_player_id)
        
        max_players = room.get("max_players", 2)
        if len(room["players"]) >= max_players:
            await safe_send(websocket, {"type": "error", "message": f"Oda dolu ({max_players}/{max_players})."})
            return _handled(current_room_code, current_player_id)
        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Oyun zaten başlamış."})
            return _handled(current_room_code, current_player_id)
        
        # ✨ Aynı isim var mı? (case-insensitive)
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
            "type": "harita_room_joined",
            "room_code": current_room_code,
            "player_id": new_pid,
            "difficulty": room.get("difficulty", "karisik"),
            "turn_seconds": room.get("turn_seconds", 30),
            "max_players": max_players,
            "total_rounds": room.get("total_rounds", HARITA_TOPLAM_TUR)
        })
        
        # 💬 Chat geçmişini yeni katılana gönder
        if room.get("chat_history"):
            await safe_send(websocket, {
                "type": "harita_chat_history",
                "messages": room["chat_history"][-50:]
            })
        
        await send_harita_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- Oda kontrolü ----------
    if not current_room_code or current_room_code not in rooms:
        return _handled(current_room_code, current_player_id)

    room = rooms[current_room_code]
    if room.get("mode") != "haritadan_bul":
        return _handled(current_room_code, current_player_id)

    # ---------- UPDATE ROOM SETTINGS ----------
    if msg_type == "harita_update_settings":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host ayarları değiştirebilir."})
            return _handled(current_room_code, current_player_id)
        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Sadece lobbyde ayarları değiştirebilirsin."})
            return _handled(current_room_code, current_player_id)

        try:
            new_turn_sec = int(data.get("turn_seconds", room.get("turn_seconds", 30)))
            if new_turn_sec not in [0, 15, 20, 30, 45, 60, 90, 120]:
                new_turn_sec = 30
        except:
            new_turn_sec = 30

        new_difficulty = (data.get("difficulty") or room.get("difficulty", "karisik")).strip().lower()
        if new_difficulty not in ["kolay", "orta", "zor", "karisik"]:
            new_difficulty = "karisik"

        try:
            new_max = int(data.get("max_players", room.get("max_players", 2)))
            if new_max not in [1, 2, 3, 4, 5]:
                new_max = room.get("max_players", 2)
            if new_max < len(room["players"]):
                new_max = room.get("max_players", 2)
        except:
            new_max = room.get("max_players", 2)

        try:
            new_total_rounds = int(data.get("total_rounds", room.get("total_rounds", HARITA_TOPLAM_TUR)))
            if new_total_rounds not in HARITA_ALLOWED_ROUNDS:
                new_total_rounds = room.get("total_rounds", HARITA_TOPLAM_TUR)
        except:
            new_total_rounds = room.get("total_rounds", HARITA_TOPLAM_TUR)

        room["turn_seconds"] = new_turn_sec
        room["difficulty"] = new_difficulty
        room["max_players"] = new_max
        room["total_rounds"] = new_total_rounds

        await send_harita_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- START ----------
    if msg_type == "harita_start_game":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return _handled(current_room_code, current_player_id)
        max_players = room.get("max_players", 2)
        player_count = len(room["players"])
        if max_players == 1:
            if player_count < 1:
                await safe_send(websocket, {"type": "error", "message": "En az 1 oyuncu gerekli."})
                return _handled(current_room_code, current_player_id)
        elif player_count != max_players:
            await safe_send(websocket, {"type": "error", "message": f"{max_players} oyuncu gerekli."})
            return _handled(current_room_code, current_player_id)
        await start_harita_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- VIEW SYNC ----------
    if msg_type == "harita_view_sync":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("turn") != current_player_id:
            return _handled(current_room_code, current_player_id)

        # Sıra kimdeyse - diğerlerine yolla
        for pid, pdata in room["players"].items():
            if pid != current_player_id:
                await safe_send(pdata["ws"], {
                    "type": "harita_view_sync",
                    "player_id": current_player_id,
                    "zoom": data.get("zoom", 1.0),
                    "pan_x": data.get("pan_x", 0),
                    "pan_y": data.get("pan_y", 0)
                })
        return _handled(current_room_code, current_player_id)

    # ---------- CONFIRM POPUP SYNC ----------
    if msg_type == "harita_confirm_sync":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("turn") != current_player_id:
            return _handled(current_room_code, current_player_id)

        for pid, pdata in room["players"].items():
            if pid != current_player_id:
                await safe_send(pdata["ws"], {
                    "type": "harita_confirm_sync",
                    "player_id": current_player_id,
                    "action": data.get("action"),
                    "country_code": data.get("country_code")
                })
        return _handled(current_room_code, current_player_id)

    # ---------- MOUSE SYNC ----------
    if msg_type == "harita_mouse_sync":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("turn") != current_player_id:
            return _handled(current_room_code, current_player_id)

        for pid, pdata in room["players"].items():
            if pid != current_player_id:
                await safe_send(pdata["ws"], {
                    "type": "harita_mouse_sync",
                    "player_id": current_player_id,
                    "x": data.get("x", 0),
                    "y": data.get("y", 0),
                    "country": data.get("country")
                })
        return _handled(current_room_code, current_player_id)

    # ---------- ANSWER ----------
    if msg_type == "harita_answer":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("turn") != current_player_id:
            return _handled(current_room_code, current_player_id)
        if room.get("harita_answered"):
            return _handled(current_room_code, current_player_id)

        selected_code = (data.get("country_code") or "").strip()
        if not selected_code or selected_code not in HARITA_COUNTRIES:
            return _handled(current_room_code, current_player_id)

        round_no = room.get("harita_round", 0)
        idx = room["harita_order"][round_no]
        footballer = ALL_FOOTBALLERS[idx]
        correct_code = get_country_key(footballer.get("nationality", ""))

        correct = (selected_code == correct_code)
        
        # ✨ Süre bonusu hesapla
        turn_start = room.get("turn_start_time", time.time())
        elapsed = time.time() - turn_start
        
        score_delta = 0
        if correct:
            if elapsed < FAST_BONUS_SECONDS:
                score_delta = 2  # Hızlı doğru: +2
            else:
                score_delta = 1  # Normal doğru: +1
        else:
            score_delta = WRONG_ANSWER_PENALTY  # Yanlış: -1
        
        if current_player_id in room["scores"]:
            room["scores"][current_player_id] += score_delta

        room["harita_answered"] = True

        old_task = room.get("harita_task")
        if old_task and not old_task.done():
            old_task.cancel()

        selected_tr = HARITA_COUNTRIES.get(selected_code, {}).get("tr", selected_code)
        correct_tr = HARITA_COUNTRIES.get(correct_code, {}).get("tr", "?") if correct_code else "?"

        await broadcast(room, {
            "type": "harita_answer_result",
            "player_id": current_player_id,
            "correct": correct,
            "timeout": False,
            "selected_code": selected_code,
            "selected_tr": selected_tr,
            "correct_code": correct_code,
            "correct_tr": correct_tr,
            "scores": room["scores"],
            "score_delta": score_delta,
            "answer_time": round(elapsed, 1)
        })

        await asyncio.sleep(3)
        await harita_next_round(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- REMATCH ----------
    if msg_type == "harita_rematch":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host tekrar başlatabilir."})
            return _handled(current_room_code, current_player_id)
        if len(room["players"]) < 1:
            return _handled(current_room_code, current_player_id)
        # Rematch'te odada kaç kişi varsa onlarla başla
        room["max_players"] = len(room["players"])
        await start_harita_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- BACK TO LOBBY ----------
    if msg_type == "harita_back_to_lobby":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host lobiye döndürebilir."})
            return _handled(current_room_code, current_player_id)
        
        room["phase"] = "lobby"
        room["max_players"] = len(room["players"])
        
        old_task = room.get("harita_task")
        if old_task and not old_task.done():
            old_task.cancel()
        
        await broadcast(room, {"type": "harita_back_to_lobby"})
        await send_harita_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ==========================================
    # 💬 CHAT MESAJI GÖNDER
    # ==========================================
    if msg_type == "harita_chat_send":
        if current_player_id not in room["players"]:
            return _handled(current_room_code, current_player_id)
        
        import time as _time
        text = (data.get("text") or "").strip()[:100]
        if not text:
            return _handled(current_room_code, current_player_id)
        
        # Spam kontrolü (saniyede max 3 mesaj)
        now = _time.time()
        if "chat_last_msg_time" not in room:
            room["chat_last_msg_time"] = {}
        last_times = room["chat_last_msg_time"].get(current_player_id, [])
        last_times = [t for t in last_times if now - t < 1.0]
        if len(last_times) >= 3:
            return _handled(current_room_code, current_player_id)
        last_times.append(now)
        room["chat_last_msg_time"][current_player_id] = last_times
        
        sender_name = room["players"][current_player_id].get("name", f"P{current_player_id}")
        
        chat_msg = {
            "sender_id": current_player_id,
            "sender_name": sender_name,
            "text": text,
            "ts": now
        }
        
        if "chat_history" not in room:
            room["chat_history"] = []
        room["chat_history"].append(chat_msg)
        if len(room["chat_history"]) > 50:
            room["chat_history"] = room["chat_history"][-50:]
        
        await broadcast(room, {
            "type": "harita_chat_msg",
            "sender_id": current_player_id,
            "sender_name": sender_name,
            "text": text,
            "ts": now
        })
        
        return _handled(current_room_code, current_player_id)

    return _handled(current_room_code, current_player_id)