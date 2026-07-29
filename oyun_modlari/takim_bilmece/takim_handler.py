import asyncio
import random

from oyun_modlari.takim_bilmece.teams import ALL_TEAMS

TAKIM_TOPLAM_SORU = 12
TAKIM_TUR_SURESI = 60

TAKIM_JOKER_AYARLARI = {
    "kolay": {"name": 3, "year": 3, "elim": 3, "pass": 3},
    "orta":  {"name": 2, "year": 2, "elim": 2, "pass": 1},
    "zor":   {"name": 1, "year": 0, "elim": 1, "pass": 0}
}


def _handled(room_code, player_id):
    return {"handled": True, "room_code": room_code, "player_id": player_id}


def _not_handled(room_code, player_id):
    return {"handled": False, "room_code": room_code, "player_id": player_id}


def get_other_player_id(pid):
    return 2 if pid == 1 else 1


def make_takim_questions():
    return random.sample(range(len(ALL_TEAMS)), TAKIM_TOPLAM_SORU)


def get_takim_team_data(room, question_no):
    team_index = room["questions"][question_no]
    team = ALL_TEAMS[team_index]
    return {
        "year": team["year"],
        "players": team["players"],
        "options": team["options"]
    }


async def takim_turn_timer(room, turn_id, question_no, broadcast):
    try:
        seconds = room.get("turn_seconds", 60)
        await asyncio.sleep(seconds)

        if room.get("phase") != "playing":
            return
        if room.get("turn") != turn_id:
            return
        if room.get("current_question") != question_no:
            return

        print(f"[TAKIM TIMER] Süre doldu, oyuncu {turn_id} için -1 puan")

        room["scores"][turn_id] -= 1

        await broadcast(room, {
            "type": "takim_answer_result",
            "player_id": turn_id,
            "correct": False,
            "timeout": True,
            "passed": False,
            "choice": -1,
            "correct_answer": ALL_TEAMS[room["questions"][question_no]]["answer"],
            "scores": room["scores"]
        })

        await asyncio.sleep(3)
        await takim_next_question(room, broadcast)
    except asyncio.CancelledError:
        print("[TAKIM TIMER] İptal edildi")
    except Exception as e:
        print(f"[TAKIM TIMER HATA] {e}")


async def takim_next_question(room, broadcast):
    room["current_question"] += 1

    if room["current_question"] >= TAKIM_TOPLAM_SORU:
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
            "type": "takim_game_over",
            "scores": room["scores"],
            "winner_id": winner
        })
        return

    room["turn"] = get_other_player_id(room["turn"])
    room["revealed_names"] = {}
    room["year_revealed"] = {1: False, 2: False}
    room["eliminated_options"] = {1: [], 2: []}
    room["answered"] = False

    await broadcast(room, {
        "type": "takim_new_question",
        "question_no": room["current_question"],
        "current_turn": room["turn"],
        "team_data": get_takim_team_data(room, room["current_question"]),
        "scores": room["scores"],
        "jokers_left": room["jokers_left"]
    })

    old_task = room.get("takim_task")
    if old_task and not old_task.done():
        old_task.cancel()

    room["takim_task"] = asyncio.create_task(
        takim_turn_timer(room, room["turn"], room["current_question"], broadcast)
    )


async def send_takim_lobby_update(room, broadcast):
    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]
    await broadcast(room, {
        "type": "takim_lobby_update",
        "room_code": room["code"],
        "players": players,
        "can_start": len(room["players"]) == 2,
        "difficulty": room.get("difficulty", "kolay"),
        "turn_seconds": room.get("turn_seconds", 60)
    })


async def start_takim_game(room, safe_send, broadcast):
    room["questions"] = make_takim_questions()
    room["current_question"] = 0
    room["scores"] = {1: 0, 2: 0}
    room["turn"] = 1
    room["phase"] = "playing"
    room["revealed_names"] = {}
    room["year_revealed"] = {1: False, 2: False}
    room["eliminated_options"] = {1: [], 2: []}
    room["answered"] = False

    difficulty = room.get("difficulty", "kolay")
    joker_config = TAKIM_JOKER_AYARLARI[difficulty]
    room["jokers_left"] = {
        1: dict(joker_config),
        2: dict(joker_config)
    }

    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]

    for pid, pdata in room["players"].items():
        await safe_send(pdata["ws"], {
            "type": "takim_game_started",
            "player_id": pid,
            "players": players,
            "difficulty": difficulty,
            "total_questions": TAKIM_TOPLAM_SORU,
            "turn_seconds": room.get("turn_seconds", 60),
            "current_turn": room["turn"],
            "question_no": 0,
            "team_data": get_takim_team_data(room, 0),
            "scores": room["scores"],
            "jokers_left": room["jokers_left"]
        })

    room["takim_task"] = asyncio.create_task(
        takim_turn_timer(room, room["turn"], 0, broadcast)
    )


async def handle_takim_message(
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
    if not str(msg_type).startswith("takim_"):
        return _not_handled(room_code, player_id)

    current_room_code = room_code
    current_player_id = player_id

    # ---------- CREATE ----------
    if msg_type == "takim_create_room":
        name = (data.get("name") or "").strip()
        difficulty = data.get("difficulty", "kolay")
        turn_seconds_raw = data.get("turn_seconds", 60)

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)

        if difficulty not in TAKIM_JOKER_AYARLARI:
            difficulty = "kolay"

        try:
            takim_turn_seconds = int(turn_seconds_raw)
            if takim_turn_seconds not in [15, 30, 45, 60, 120]:
                takim_turn_seconds = 60
        except:
            takim_turn_seconds = 60

        print(f"[TAKIM ODA] Zorluk: {difficulty} | Süre: {takim_turn_seconds}sn")

        current_room_code = make_room_code()
        current_player_id = 1

        rooms[current_room_code] = {
            "code": current_room_code,
            "mode": "takim_bilmece",
            "players": {1: {"ws": websocket, "name": name}},
            "phase": "lobby",
            "difficulty": difficulty,
            "turn_seconds": takim_turn_seconds,
            "scores": {1: 0, 2: 0},
            "questions": [],
            "current_question": 0,
            "turn": 1,
            "revealed_names": {},
            "year_revealed": {1: False, 2: False},
            "eliminated_options": {1: [], 2: []},
            "answered": False,
            "jokers_left": {1: {}, 2: {}},
            "takim_task": None
        }

        await safe_send(websocket, {
            "type": "takim_room_created",
            "room_code": current_room_code,
            "player_id": 1,
            "difficulty": difficulty
        })
        await send_takim_lobby_update(rooms[current_room_code], broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- JOIN ----------
    if msg_type == "takim_join_room":
        name = (data.get("name") or "").strip()
        join_code = (data.get("room_code") or "").strip().upper()

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)
        if join_code not in rooms:
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            return _handled(current_room_code, current_player_id)

        room = rooms[join_code]
        if room.get("mode") != "takim_bilmece":
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
            "type": "takim_room_joined",
            "room_code": current_room_code,
            "player_id": 2,
            "difficulty": room.get("difficulty", "kolay")
        })
        await send_takim_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- Oda kontrolü ----------
    if not current_room_code or current_room_code not in rooms:
        return _handled(current_room_code, current_player_id)

    room = rooms[current_room_code]
    if room.get("mode") != "takim_bilmece":
        return _handled(current_room_code, current_player_id)

    # ---------- START ----------
    if msg_type == "takim_start_game":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return _handled(current_room_code, current_player_id)
        if len(room["players"]) != 2:
            await safe_send(websocket, {"type": "error", "message": "2 oyuncu gerekli."})
            return _handled(current_room_code, current_player_id)
        await start_takim_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- REMATCH ----------
    if msg_type == "takim_rematch":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host tekrar başlatabilir."})
            return _handled(current_room_code, current_player_id)
        if len(room["players"]) != 2:
            return _handled(current_room_code, current_player_id)
        await start_takim_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- JOKER NAME START ----------
    if msg_type == "takim_joker_name_start":
        if room["phase"] != "playing":
            return _handled(current_room_code, current_player_id)
        if room["turn"] != current_player_id:
            return _handled(current_room_code, current_player_id)
        if room["answered"]:
            return _handled(current_room_code, current_player_id)

        jokers = room["jokers_left"][current_player_id]
        if jokers["name"] <= 0:
            return _handled(current_room_code, current_player_id)

        jokers["name"] -= 1
        room["pending_name_joker"] = room.get("pending_name_joker", {})
        room["pending_name_joker"][current_player_id] = True

        await broadcast(room, {
            "type": "takim_joker_preview",
            "player_id": current_player_id,
            "joker_type": "name",
            "jokers_left": room["jokers_left"]
        })
        return _handled(current_room_code, current_player_id)

    # ---------- JOKER NAME CANCEL ----------
    if msg_type == "takim_joker_name_cancel":
        if room["phase"] != "playing":
            return _handled(current_room_code, current_player_id)
        if room["turn"] != current_player_id:
            return _handled(current_room_code, current_player_id)

        pending = room.get("pending_name_joker", {})
        if not pending.get(current_player_id):
            return _handled(current_room_code, current_player_id)

        jokers = room["jokers_left"][current_player_id]
        jokers["name"] += 1
        pending[current_player_id] = False

        await broadcast(room, {
            "type": "takim_joker_cancel",
            "player_id": current_player_id,
            "joker_type": "name",
            "jokers_left": room["jokers_left"]
        })
        return _handled(current_room_code, current_player_id)

    # ---------- JOKER NAME ----------
    if msg_type == "takim_joker_name":
        if room["phase"] != "playing":
            return _handled(current_room_code, current_player_id)
        if room["turn"] != current_player_id:
            return _handled(current_room_code, current_player_id)
        if room["answered"]:
            return _handled(current_room_code, current_player_id)

        idx = data.get("player_index")
        if not isinstance(idx, int):
            return _handled(current_room_code, current_player_id)

        pending = room.get("pending_name_joker", {})
        if not pending.get(current_player_id):
            jokers = room["jokers_left"][current_player_id]
            if jokers["name"] <= 0:
                return _handled(current_room_code, current_player_id)
            jokers["name"] -= 1

        if current_player_id not in room["revealed_names"]:
            room["revealed_names"][current_player_id] = {}
        if idx in room["revealed_names"][current_player_id]:
            return _handled(current_room_code, current_player_id)

        team = ALL_TEAMS[room["questions"][room["current_question"]]]
        if idx < 0 or idx >= len(team["players"]):
            return _handled(current_room_code, current_player_id)

        if pending.get(current_player_id):
            pending[current_player_id] = False

        player_name = team["players"][idx]["name"]
        room["revealed_names"][current_player_id][idx] = player_name

        await broadcast(room, {
            "type": "takim_joker_used",
            "player_id": current_player_id,
            "joker_type": "name",
            "player_index": idx,
            "player_name": player_name,
            "jokers_left": room["jokers_left"]
        })
        return _handled(current_room_code, current_player_id)

    # ---------- JOKER YEAR ----------
    if msg_type == "takim_joker_year":
        if room["phase"] != "playing":
            return _handled(current_room_code, current_player_id)
        if room["turn"] != current_player_id:
            return _handled(current_room_code, current_player_id)
        if room["answered"]:
            return _handled(current_room_code, current_player_id)

        jokers = room["jokers_left"][current_player_id]
        if jokers["year"] <= 0:
            return _handled(current_room_code, current_player_id)
        if room["year_revealed"][current_player_id]:
            return _handled(current_room_code, current_player_id)

        jokers["year"] -= 1
        room["year_revealed"][current_player_id] = True

        team = ALL_TEAMS[room["questions"][room["current_question"]]]

        await broadcast(room, {
            "type": "takim_joker_used",
            "player_id": current_player_id,
            "joker_type": "year",
            "year": team["year"],
            "jokers_left": room["jokers_left"]
        })
        return _handled(current_room_code, current_player_id)

    # ---------- JOKER ELIM ----------
    if msg_type == "takim_joker_elim":
        if room["phase"] != "playing":
            return _handled(current_room_code, current_player_id)
        if room["turn"] != current_player_id:
            return _handled(current_room_code, current_player_id)
        if room["answered"]:
            return _handled(current_room_code, current_player_id)

        jokers = room["jokers_left"][current_player_id]
        if jokers["elim"] <= 0:
            return _handled(current_room_code, current_player_id)

        team = ALL_TEAMS[room["questions"][room["current_question"]]]
        correct = team["answer"]
        already_elim = room["eliminated_options"][current_player_id]

        wrong = [i for i in range(4) if i != correct and i not in already_elim]
        if len(wrong) < 2:
            return _handled(current_room_code, current_player_id)

        jokers["elim"] -= 1
        remove = random.sample(wrong, 2)
        room["eliminated_options"][current_player_id].extend(remove)

        await broadcast(room, {
            "type": "takim_joker_used",
            "player_id": current_player_id,
            "joker_type": "elim",
            "eliminated": room["eliminated_options"][current_player_id],
            "jokers_left": room["jokers_left"]
        })
        return _handled(current_room_code, current_player_id)

    # ---------- JOKER PASS ----------
    if msg_type == "takim_joker_pass":
        if room["phase"] != "playing":
            return _handled(current_room_code, current_player_id)
        if room["turn"] != current_player_id:
            return _handled(current_room_code, current_player_id)
        if room["answered"]:
            return _handled(current_room_code, current_player_id)

        jokers = room["jokers_left"][current_player_id]
        if jokers["pass"] <= 0:
            return _handled(current_room_code, current_player_id)

        jokers["pass"] -= 1
        room["answered"] = True

        team = ALL_TEAMS[room["questions"][room["current_question"]]]

        old_task = room.get("takim_task")
        if old_task and not old_task.done():
            old_task.cancel()

        await broadcast(room, {
            "type": "takim_answer_result",
            "player_id": current_player_id,
            "correct": False,
            "timeout": False,
            "passed": True,
            "choice": -1,
            "correct_answer": team["answer"],
            "scores": room["scores"],
            "jokers_left": room["jokers_left"]
        })

        await asyncio.sleep(3)
        await takim_next_question(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- ANSWER ----------
    if msg_type == "takim_answer":
        if room["phase"] != "playing":
            return _handled(current_room_code, current_player_id)
        if room["turn"] != current_player_id:
            return _handled(current_room_code, current_player_id)
        if room["answered"]:
            return _handled(current_room_code, current_player_id)

        choice = data.get("choice")
        if not isinstance(choice, int) or choice < 0 or choice > 3:
            return _handled(current_room_code, current_player_id)
        if choice in room["eliminated_options"][current_player_id]:
            return _handled(current_room_code, current_player_id)

        team = ALL_TEAMS[room["questions"][room["current_question"]]]
        correct = (choice == team["answer"])

        if correct:
            room["scores"][current_player_id] += 3
        else:
            room["scores"][current_player_id] -= 1

        room["answered"] = True

        old_task = room.get("takim_task")
        if old_task and not old_task.done():
            old_task.cancel()

        await broadcast(room, {
            "type": "takim_answer_result",
            "player_id": current_player_id,
            "correct": correct,
            "timeout": False,
            "passed": False,
            "choice": choice,
            "correct_answer": team["answer"],
            "scores": room["scores"]
        })

        await asyncio.sleep(3)
        await takim_next_question(room, broadcast)
        return _handled(current_room_code, current_player_id)

    return _handled(current_room_code, current_player_id)