import asyncio
import os
import random

from oyun_modlari.stadyum_tanima.stadyumlar import (
    STADYUMLAR,
    get_stadyum_by_img,
    check_answer
)

TOTAL_ROUNDS = 10
TIME_PER_QUESTION = 20
POINT_CORRECT = 10
POINT_WRONG = -3
POINT_FAST_BONUS = 5
JOKER_PENALTY = 2
MAX_JOKERS = 3


def _handled(room_code, player_id):
    return {"handled": True, "room_code": room_code, "player_id": player_id}


def _not_handled(room_code, player_id):
    return {"handled": False, "room_code": room_code, "player_id": player_id}


def get_other_player_id(pid):
    return 2 if pid == 1 else 1


def build_stadium_image_map():
    folder = "oyun_modlari/stadyum_tanima/images"
    image_map = {}
    if os.path.isdir(folder):
        for filename in os.listdir(folder):
            name_lower = filename.lower().rsplit(".", 1)[0].strip()
            image_map[name_lower] = filename
    return image_map


STAD_IMAGE_MAP = build_stadium_image_map()


def get_stadium_img_file(img_key):
    return STAD_IMAGE_MAP.get(img_key.lower().strip(), img_key + ".jpg")


def make_stadium_payload(stadyum):
    """Sadece resim + boş şıklar gönderilir. Şıklar ayrı üretilir."""
    return {
        "img": stadyum["img"],
        "img_file": get_stadium_img_file(stadyum["img"])
    }


def make_options_for_stadium(stadyum):
    """4 şık üret: 1 doğru + 3 yanlış (rastgele karışık)"""
    correct = stadyum["isim"]
    wrong_pool = [s["isim"] for s in STADYUMLAR if s["img"] != stadyum["img"]]

    if len(wrong_pool) < 3:
        wrong = wrong_pool
    else:
        wrong = random.sample(wrong_pool, 3)

    options = [correct] + wrong
    random.shuffle(options)

    correct_index = options.index(correct)
    return options, correct_index


def get_current_stadium(room):
    order = room.get("stad_order", [])
    round_no = room.get("stad_round", 0)
    if round_no < 0 or round_no >= len(order):
        return None
    return get_stadyum_by_img(order[round_no])


def get_5050_eliminated_indices(room):
    """Mevcut şıklardan 2 yanlış şıkkın indexlerini döndür"""
    options = room.get("stad_options", [])
    correct_idx = room.get("stad_correct_index", 0)
    already_elim = room.get("stad_eliminated_indices", [])

    wrong_indices = [
        i for i in range(len(options))
        if i != correct_idx and i not in already_elim
    ]

    if len(wrong_indices) < 2:
        return wrong_indices
    return random.sample(wrong_indices, 2)


async def send_stad_lobby_update(room, broadcast):
    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]
    await broadcast(room, {
        "type": "stad_lobby_update",
        "room_code": room["code"],
        "players": players,
        "can_start": len(room["players"]) == 2,
        "turn_seconds": room.get("turn_seconds", TIME_PER_QUESTION),
        "total_rounds": len(room.get("stad_order", [])) or TOTAL_ROUNDS
    })


async def stad_finish_game(room, broadcast):
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
        "type": "stad_game_over",
        "scores": room["scores"],
        "winner_id": winner
    })


async def stad_turn_timer(room, current_player, round_no, broadcast):
    try:
        seconds = room.get("turn_seconds", TIME_PER_QUESTION)
        await asyncio.sleep(seconds)

        if room.get("phase") != "playing":
            return
        if room.get("stad_current_player") != current_player:
            return
        if room.get("stad_round") != round_no:
            return
        if room.get("stad_answered"):
            return

        stadyum = get_current_stadium(room)
        if not stadyum:
            return

        room["stad_answered"] = True
        room["scores"][current_player] += POINT_WRONG

        await broadcast(room, {
            "type": "stad_answer_result",
            "player_id": current_player,
            "correct": False,
            "timeout": True,
            "selected_index": -1,
            "correct_index": room.get("stad_correct_index", 0),
            "correct_answer": stadyum["isim"],
            "earned": POINT_WRONG,
            "scores": room["scores"]
        })

        await asyncio.sleep(3)
        await stad_next_round(room, broadcast)

    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[STAD TIMER HATA] {e}")


async def stad_next_round(room, broadcast):
    room["stad_round"] += 1

    if room["stad_round"] >= len(room["stad_order"]):
        await stad_finish_game(room, broadcast)
        return

    room["stad_current_player"] = 1 if room["stad_round"] % 2 == 0 else 2
    room["stad_answered"] = False
    room["stad_used_jokers"] = {1: [], 2: []}
    room["stad_eliminated_indices"] = []

    stadyum = get_current_stadium(room)
    if not stadyum:
        await stad_finish_game(room, broadcast)
        return

    options, correct_index = make_options_for_stadium(stadyum)
    room["stad_options"] = options
    room["stad_correct_index"] = correct_index

    await broadcast(room, {
        "type": "stad_new_round",
        "round_no": room["stad_round"],
        "total_rounds": len(room["stad_order"]),
        "current_player": room["stad_current_player"],
        "stadium": make_stadium_payload(stadyum),
        "options": options,
        "scores": room["scores"],
        "jokers_left": room["stad_jokers_left"]
    })

    old_task = room.get("stad_task")
    if old_task and not old_task.done():
        old_task.cancel()

    room["stad_question_start"] = asyncio.get_running_loop().time()
    room["stad_task"] = asyncio.create_task(
        stad_turn_timer(room, room["stad_current_player"], room["stad_round"], broadcast)
    )


async def start_stad_game(room, safe_send, broadcast):
    old_task = room.get("stad_task")
    if old_task and not old_task.done():
        old_task.cancel()

    selected = random.sample(STADYUMLAR, min(TOTAL_ROUNDS, len(STADYUMLAR)))
    order = [s["img"] for s in selected]

    room["phase"] = "playing"
    room["scores"] = {1: 0, 2: 0}
    room["stad_order"] = order
    room["stad_round"] = 0
    room["stad_current_player"] = 1
    room["stad_answered"] = False
    room["stad_jokers_left"] = {1: MAX_JOKERS, 2: MAX_JOKERS}
    room["stad_used_jokers"] = {1: [], 2: []}
    room["stad_eliminated_indices"] = []

    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]

    stadyum = get_current_stadium(room)
    if not stadyum:
        return

    options, correct_index = make_options_for_stadium(stadyum)
    room["stad_options"] = options
    room["stad_correct_index"] = correct_index

    for pid, pdata in room["players"].items():
        await safe_send(pdata["ws"], {
            "type": "stad_game_started",
            "player_id": pid,
            "players": players,
            "turn_seconds": room.get("turn_seconds", TIME_PER_QUESTION),
            "total_rounds": len(order),
            "current_player": 1,
            "round_no": 0,
            "stadium": make_stadium_payload(stadyum),
            "options": options,
            "scores": room["scores"],
            "jokers_left": room["stad_jokers_left"]
        })

    room["stad_question_start"] = asyncio.get_running_loop().time()
    room["stad_task"] = asyncio.create_task(
        stad_turn_timer(room, 1, 0, broadcast)
    )


async def handle_stadyum_message(
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
    if not str(msg_type).startswith("stad_"):
        return _not_handled(room_code, player_id)

    current_room_code = room_code
    current_player_id = player_id

    # CREATE
    if msg_type == "stad_create_room":
        name = (data.get("name") or "").strip()
        turn_seconds_raw = data.get("turn_seconds", TIME_PER_QUESTION)

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)

        try:
            turn_seconds = int(turn_seconds_raw)
            if turn_seconds not in [20, 30, 45, 60]:
                turn_seconds = 30
        except:
            turn_seconds = 30

        current_room_code = make_room_code()
        current_player_id = 1

        rooms[current_room_code] = {
            "code": current_room_code,
            "mode": "stadyum_tanima",
            "players": {
                1: {"ws": websocket, "name": name}
            },
            "phase": "lobby",
            "turn_seconds": turn_seconds,
            "scores": {1: 0, 2: 0},
            "stad_order": [],
            "stad_round": 0,
            "stad_current_player": 1,
            "stad_answered": False,
            "stad_jokers_left": {1: MAX_JOKERS, 2: MAX_JOKERS},
            "stad_used_jokers": {1: [], 2: []},
            "stad_question_start": 0,
            "stad_task": None
        }

        await safe_send(websocket, {
            "type": "stad_room_created",
            "room_code": current_room_code,
            "player_id": 1,
            "turn_seconds": turn_seconds
        })
        await send_stad_lobby_update(rooms[current_room_code], broadcast)
        return _handled(current_room_code, current_player_id)

    # JOIN
    if msg_type == "stad_join_room":
        name = (data.get("name") or "").strip()
        join_code = (data.get("room_code") or "").strip().upper()

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)

        if join_code not in rooms:
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            return _handled(current_room_code, current_player_id)

        room = rooms[join_code]

        if room.get("mode") != "stadyum_tanima":
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
            "type": "stad_room_joined",
            "room_code": current_room_code,
            "player_id": 2,
            "turn_seconds": room.get("turn_seconds", TIME_PER_QUESTION)
        })
        await send_stad_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # Oda kontrolü
    if not current_room_code or current_room_code not in rooms:
        return _handled(current_room_code, current_player_id)

    room = rooms[current_room_code]

    if room.get("mode") != "stadyum_tanima":
        return _handled(current_room_code, current_player_id)

    # UPDATE ROOM SETTINGS
    if msg_type == "stad_update_settings":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host ayarları değiştirebilir."})
            return _handled(current_room_code, current_player_id)
        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Sadece lobbyde ayarları değiştirebilirsin."})
            return _handled(current_room_code, current_player_id)

        try:
            new_turn_sec = int(data.get("turn_seconds", room.get("turn_seconds", 20)))
            if new_turn_sec not in [15, 20, 30, 45]:
                new_turn_sec = 20
        except:
            new_turn_sec = 20

        room["turn_seconds"] = new_turn_sec

        await send_stad_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # START
    if msg_type == "stad_start_game":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return _handled(current_room_code, current_player_id)

        if len(room["players"]) != 2:
            await safe_send(websocket, {"type": "error", "message": "2 oyuncu gerekli."})
            return _handled(current_room_code, current_player_id)

        await start_stad_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # JOKER
    if msg_type == "stad_use_joker":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("stad_current_player") != current_player_id:
            return _handled(current_room_code, current_player_id)
        if room.get("stad_answered"):
            return _handled(current_room_code, current_player_id)

        joker_type = (data.get("joker") or "").strip().lower()
        if joker_type not in ["takim", "ulke", "5050"]:
            return _handled(current_room_code, current_player_id)

        if room["stad_jokers_left"][current_player_id] <= 0:
            return _handled(current_room_code, current_player_id)

        used = room["stad_used_jokers"].get(current_player_id, [])
        if joker_type in used:
            return _handled(current_room_code, current_player_id)

        stadyum = get_current_stadium(room)
        if not stadyum:
            return _handled(current_room_code, current_player_id)

        room["stad_jokers_left"][current_player_id] -= 1
        used.append(joker_type)
        room["stad_used_jokers"][current_player_id] = used

        reveal_value = None
        eliminated_indices = None

        if joker_type == "takim":
            reveal_value = stadyum.get("takim", "")
        elif joker_type == "ulke":
            reveal_value = stadyum.get("ulke", "")
        elif joker_type == "5050":
            new_elim = get_5050_eliminated_indices(room)
            existing = room.get("stad_eliminated_indices", [])
            room["stad_eliminated_indices"] = existing + new_elim
            eliminated_indices = room["stad_eliminated_indices"]

        # Herkese aynı bilgiyi gönder (50:50 herkeste gözüksün)
        await broadcast(room, {
            "type": "stad_joker_result",
            "player_id": current_player_id,
            "joker_type": joker_type,
            "value": reveal_value,
            "eliminated_indices": eliminated_indices,
            "jokers_left": room["stad_jokers_left"]
        })

        return _handled(current_room_code, current_player_id)

    # ANSWER (şık seçimi)
    if msg_type == "stad_submit_answer":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("stad_current_player") != current_player_id:
            return _handled(current_room_code, current_player_id)
        if room.get("stad_answered"):
            return _handled(current_room_code, current_player_id)

        selected_index = data.get("index")
        if not isinstance(selected_index, int):
            return _handled(current_room_code, current_player_id)

        options = room.get("stad_options", [])
        if selected_index < 0 or selected_index >= len(options):
            return _handled(current_room_code, current_player_id)

        # 50:50 ile elenmiş şıkka basılamaz
        if selected_index in room.get("stad_eliminated_indices", []):
            return _handled(current_room_code, current_player_id)

        stadyum = get_current_stadium(room)
        if not stadyum:
            return _handled(current_room_code, current_player_id)

        correct_index = room.get("stad_correct_index", 0)
        correct = (selected_index == correct_index)
        earned = POINT_WRONG

        if correct:
            elapsed = asyncio.get_running_loop().time() - room.get("stad_question_start", 0)
            earned = POINT_CORRECT
            if elapsed < 10:
                earned += POINT_FAST_BONUS

            used_count = len(room["stad_used_jokers"].get(current_player_id, []))
            earned -= used_count * JOKER_PENALTY
            earned = max(1, earned)

        room["scores"][current_player_id] += earned
        room["stad_answered"] = True

        old_task = room.get("stad_task")
        if old_task and not old_task.done():
            old_task.cancel()

        await broadcast(room, {
            "type": "stad_answer_result",
            "player_id": current_player_id,
            "correct": correct,
            "timeout": False,
            "selected_index": selected_index,
            "correct_index": correct_index,
            "correct_answer": stadyum["isim"],
            "earned": earned,
            "scores": room["scores"]
        })

        await asyncio.sleep(3)
        await stad_next_round(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # REMATCH
    if msg_type == "stad_rematch":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host tekrar başlatabilir."})
            return _handled(current_room_code, current_player_id)

        if len(room["players"]) != 2:
            return _handled(current_room_code, current_player_id)

        await start_stad_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    return _handled(current_room_code, current_player_id)