import asyncio
import random

from oyun_modlari.bil_bakalim.footballers import ALL_FOOTBALLERS
from oyun_modlari.haritadan_bul.harita_data import (
    COUNTRIES as HARITA_COUNTRIES,
    get_country_key,
    get_valid_footballer_indices,
    get_footballers_by_difficulty,
    make_progressive_order
)

HARITA_TOPLAM_TUR = 10


def _handled(room_code, player_id):
    return {"handled": True, "room_code": room_code, "player_id": player_id}


def _not_handled(room_code, player_id):
    return {"handled": False, "room_code": room_code, "player_id": player_id}


def get_other_player_id(pid):
    return 2 if pid == 1 else 1


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

        print(f"[HARITA TIMER] Süre doldu, oyuncu {turn_id}")

        room["harita_answered"] = True

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
            "scores": room["scores"]
        })

        await asyncio.sleep(3)
        await harita_next_round(room, broadcast)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[HARITA TIMER HATA] {e}")


async def harita_next_round(room, broadcast):
    room["harita_round"] += 1

    if room["harita_round"] >= len(room["harita_order"]):
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
            "type": "harita_game_over",
            "scores": room["scores"],
            "winner_id": winner
        })
        return

    room["turn"] = 1 if room["harita_round"] % 2 == 0 else 2
    room["harita_answered"] = False

    idx = room["harita_order"][room["harita_round"]]
    footballer = ALL_FOOTBALLERS[idx]

    await broadcast(room, {
        "type": "harita_new_round",
        "round_no": room["harita_round"],
        "total_rounds": len(room["harita_order"]),
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
    
    if difficulty == "karisik":
        # Karışık mod: progresif (kolay → orta → zor)
        order = make_progressive_order(ALL_FOOTBALLERS, HARITA_TOPLAM_TUR)
    else:
        # Belirli zorluk seviyesi
        valid = get_footballers_by_difficulty(ALL_FOOTBALLERS, difficulty)
        random.shuffle(valid)
        order = valid[:min(HARITA_TOPLAM_TUR, len(valid))]
    
    if not order:
        # Fallback: eğer o zorlukta futbolcu yoksa tümünü kullan
        valid = harita_get_valid_indices()
        random.shuffle(valid)
        order = valid[:HARITA_TOPLAM_TUR]
    
    print(f"[HARITA] Oyun başladı — Zorluk: {difficulty}, Futbolcu sayısı: {len(order)}")

    room["phase"] = "playing"
    room["scores"] = {1: 0, 2: 0}
    room["harita_order"] = order
    room["harita_round"] = 0
    room["harita_answered"] = False
    room["turn"] = 1

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
            "total_rounds": len(order),
            "current_turn": 1,
            "round_no": 0,
            "footballer": {
                "name": footballer["name"],
                "img_file": footballer.get("img_file", footballer["img"] + ".webp")
            },
            "countries": countries_data,
            "scores": room["scores"]
        })

    room["harita_task"] = asyncio.create_task(
        harita_turn_timer(room, 1, 0, broadcast)
    )


async def send_harita_lobby_update(room, broadcast):
    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]
    await broadcast(room, {
        "type": "harita_lobby_update",
        "room_code": room["code"],
        "players": players,
        "can_start": len(room["players"]) == 2,
        "turn_seconds": room.get("turn_seconds", 30),
        "difficulty": room.get("difficulty", "karisik")
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

        current_room_code = make_room_code()
        current_player_id = 1

        rooms[current_room_code] = {
            "code": current_room_code,
            "mode": "haritadan_bul",
            "players": {1: {"ws": websocket, "name": name}},
            "phase": "lobby",
            "turn_seconds": harita_turn_seconds,
            "difficulty": difficulty,
            "scores": {1: 0, 2: 0},
            "harita_order": [],
            "harita_round": 0,
            "harita_answered": False,
            "turn": 1,
            "harita_task": None
        }

        await safe_send(websocket, {
            "type": "harita_room_created",
            "room_code": current_room_code,
            "player_id": 1,
            "difficulty": difficulty,
            "turn_seconds": harita_turn_seconds
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
        if len(room["players"]) >= 2:
            await safe_send(websocket, {"type": "error", "message": "Oda dolu."})
            return _handled(current_room_code, current_player_id)
        
        # ✨ Aynı isim var mı? (case-insensitive)
        existing_names = [p.get("name", "").lower().strip() for p in room["players"].values()]
        if name.lower().strip() in existing_names:
            await safe_send(websocket, {
                "type": "error",
                "message": f"Bu isimde ({name}) bir oyuncu zaten odada var. Farklı bir isim seç."
            })
            return _handled(current_room_code, current_player_id)

        current_room_code = join_code
        current_player_id = 2
        room["players"][2] = {"ws": websocket, "name": name}
        room["phase"] = "lobby"

        await safe_send(websocket, {
            "type": "harita_room_joined",
            "room_code": current_room_code,
            "player_id": 2,
            "difficulty": room.get("difficulty", "karisik"),
            "turn_seconds": room.get("turn_seconds", 30)
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

        room["turn_seconds"] = new_turn_sec
        room["difficulty"] = new_difficulty

        await send_harita_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- START ----------
    if msg_type == "harita_start_game":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return _handled(current_room_code, current_player_id)
        if len(room["players"]) != 2:
            await safe_send(websocket, {"type": "error", "message": "2 oyuncu gerekli."})
            return _handled(current_room_code, current_player_id)
        await start_harita_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- VIEW SYNC ----------
    if msg_type == "harita_view_sync":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("turn") != current_player_id:
            return _handled(current_room_code, current_player_id)

        other_id = get_other_player_id(current_player_id)
        if other_id in room["players"]:
            await safe_send(room["players"][other_id]["ws"], {
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

        other_id = get_other_player_id(current_player_id)
        if other_id in room["players"]:
            await safe_send(room["players"][other_id]["ws"], {
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

        other_id = get_other_player_id(current_player_id)
        if other_id in room["players"]:
            await safe_send(room["players"][other_id]["ws"], {
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
        if correct:
            room["scores"][current_player_id] += 1

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
            "scores": room["scores"]
        })

        await asyncio.sleep(3)
        await harita_next_round(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- REMATCH ----------
    if msg_type == "harita_rematch":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host tekrar başlatabilir."})
            return _handled(current_room_code, current_player_id)
        if len(room["players"]) != 2:
            return _handled(current_room_code, current_player_id)
        await start_harita_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    return _handled(current_room_code, current_player_id)