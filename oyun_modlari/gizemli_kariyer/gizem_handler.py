import asyncio
import random

from oyun_modlari.gizemli_kariyer.futbolcular import ALL_PLAYERS as GIZEM_PLAYERS
from oyun_modlari.gizemli_kariyer.takimlar import ALL_TEAMS as GIZEM_TEAMS


GIZEM_TOPLAM_TUR = 10
GIZEM_ALLOWED_ROUNDS = [5, 10, 15, 20]
GIZEM_TUR_SURESI = 60
GIZEM_PUAN_DOGRU = 10
GIZEM_PUAN_ERKEN_BONUS = 5
GIZEM_PUAN_YANLIS = -3   # ✨ Yanlış cezası

# ✨ Zorluk seviyeleri
GIZEM_ZORLUKLAR = ["kolay", "orta", "zor", "karisik"]

# ✨ Karışık modda progresif zorluk dağılımı (10 tur bazlı, dinamik ölçeklenir)
GIZEM_KARISIK_DAGILIM_BASE = ["kolay", "kolay", "kolay", "orta", "orta", "orta", "orta", "zor", "zor", "zor"]


def get_karisik_flow(total_rounds):
    """N tur için karışık zorluk dağılımı üret"""
    base = GIZEM_KARISIK_DAGILIM_BASE
    result = []
    for i in range(total_rounds):
        idx = int(i * len(base) / total_rounds)
        if idx >= len(base):
            idx = len(base) - 1
        result.append(base[idx])
    return result


def get_gizem_players_by_difficulty(difficulty):
    result = []
    for i, p in enumerate(GIZEM_PLAYERS):
        pdiff = p.get("difficulty", "orta")
        if pdiff == difficulty and len(p.get("career", [])) >= 2:
            result.append((i, p))
    return result


def _handled(room_code, player_id):
    return {"handled": True, "room_code": room_code, "player_id": player_id}


def _not_handled(room_code, player_id):
    return {"handled": False, "room_code": room_code, "player_id": player_id}


def get_next_gizem_turn_player(room):
    """Sıradaki oyuncu (round-robin, 2-5 kişi destekli)"""
    active_ids = sorted(room["players"].keys())
    if not active_ids:
        return None
    current = room.get("turn", active_ids[0])
    if current not in active_ids:
        return active_ids[0]
    idx = active_ids.index(current)
    next_idx = (idx + 1) % len(active_ids)
    return active_ids[next_idx]


def gizem_pick_question(exclude_indices=None, difficulty="karisik", round_no=0, history_indices=None, total_rounds=10):
    if exclude_indices is None:
        exclude_indices = []
    if history_indices is None:
        history_indices = set()
    else:
        history_indices = set(history_indices)
    
    target_difficulty = difficulty
    if difficulty == "karisik":
        flow = get_karisik_flow(total_rounds)
        if 0 <= round_no < len(flow):
            target_difficulty = flow[round_no]
        else:
            target_difficulty = "orta"

    fresh = [
        (i, p) for i, p in enumerate(GIZEM_PLAYERS)
        if p.get("difficulty", "orta") == target_difficulty
        and len(p.get("career", [])) >= 2
        and i not in exclude_indices
        and i not in history_indices
    ]
    
    if not fresh:
        fresh = [
            (i, p) for i, p in enumerate(GIZEM_PLAYERS)
            if p.get("difficulty", "orta") == target_difficulty
            and len(p.get("career", [])) >= 2
            and i not in exclude_indices
        ]
    
    if not fresh:
        fresh = [
            (i, p) for i, p in enumerate(GIZEM_PLAYERS)
            if p.get("difficulty", "orta") == target_difficulty
            and len(p.get("career", [])) >= 2
        ]
    
    if not fresh:
        fresh = [
            (i, p) for i, p in enumerate(GIZEM_PLAYERS)
            if len(p.get("career", [])) >= 2
        ]

    idx, player = random.choice(fresh)

    all_other_names = [p["name"] for p in GIZEM_PLAYERS if p["name"] != player["name"]]
    wrong = random.sample(all_other_names, min(5, len(all_other_names)))

    options = [player["name"]] + wrong
    random.shuffle(options)
    correct_idx = options.index(player["name"])

    career_data = []
    for team_name in player["career"]:
        team_info = GIZEM_TEAMS.get(team_name, {})
        tm_id = team_info.get("tm_id")
        logo_url = f"https://tmssl.akamaized.net/images/wappen/head/{tm_id}.png" if tm_id else ""
        career_data.append({
            "name": team_name,
            "logo_url": logo_url,
            "color": list(team_info.get("color", (100, 100, 100)))
        })

    return {
        "player_idx": idx,
        "player_name": player["name"],
        "career": career_data,
        "options": options,
        "correct_index": correct_idx
    }


async def gizem_turn_timer(room, turn_id, round_no, broadcast):
    try:
        seconds = room.get("turn_seconds", GIZEM_TUR_SURESI)
        await asyncio.sleep(seconds)

        if room.get("phase") != "playing":
            return
        if room.get("turn") != turn_id:
            return
        if room.get("gizem_round") != round_no:
            return
        if room.get("gizem_answered"):
            return
        if turn_id not in room.get("players", {}):
            return

        print(f"[GIZEM TIMER] Süre doldu, oyuncu {turn_id}")

        room["gizem_answered"] = True
        current_q = room.get("gizem_current_q", {})
        
        # ✨ Timeout cezası (-3)
        if turn_id in room["scores"]:
            room["scores"][turn_id] += GIZEM_PUAN_YANLIS

        await broadcast(room, {
            "type": "gizem_answer_result",
            "player_id": turn_id,
            "correct": False,
            "timeout": True,
            "passed": False,
            "selected_index": -1,
            "correct_index": current_q.get("correct_index", 0),
            "correct_name": current_q.get("player_name", "?"),
            "earned": GIZEM_PUAN_YANLIS,
            "scores": room["scores"]
        })

        await asyncio.sleep(3)
        await gizem_next_round(room, broadcast)

    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[GIZEM TIMER HATA] {e}")


async def gizem_next_round(room, broadcast):
    room["gizem_round"] += 1
    total_rounds = room.get("total_rounds", GIZEM_TOPLAM_TUR)

    if room["gizem_round"] >= total_rounds:
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
        if len(ranking) >= 2 and ranking[0]["score"] == ranking[1]["score"]:
            winner_id = 0

        await broadcast(room, {
            "type": "gizem_game_over",
            "scores": room["scores"],
            "winner_id": winner_id,
            "ranking": ranking
        })
        return

    room["turn"] = get_next_gizem_turn_player(room)
    if room["turn"] is None:
        return
    
    room["gizem_answered"] = False
    room["gizem_hidden_indices"] = []

    exclude = room.get("gizem_used_indices", [])
    difficulty = room.get("difficulty", "karisik")
    history = room.get("gizem_history_indices", set())
    q = gizem_pick_question(exclude, difficulty=difficulty, round_no=room["gizem_round"], history_indices=history, total_rounds=total_rounds)
    room["gizem_used_indices"] = exclude + [q["player_idx"]]
    history.add(q["player_idx"])
    room["gizem_history_indices"] = history
    room["gizem_current_q"] = q
    room["gizem_question_start"] = asyncio.get_running_loop().time()

    turn_diff = room.get("difficulty", "karisik")
    if turn_diff == "karisik":
        flow = get_karisik_flow(total_rounds)
        if 0 <= room["gizem_round"] < len(flow):
            turn_diff = flow[room["gizem_round"]]
    
    await broadcast(room, {
        "type": "gizem_new_round",
        "round_no": room["gizem_round"],
        "total_rounds": total_rounds,
        "current_turn": room["turn"],
        "career": q["career"],
        "options": q["options"],
        "scores": room["scores"],
        "jokers_left": room["gizem_jokers"],
        "round_difficulty": turn_diff
    })

    old_task = room.get("gizem_task")
    if old_task and not old_task.done():
        old_task.cancel()

    room["gizem_task"] = asyncio.create_task(
        gizem_turn_timer(room, room["turn"], room["gizem_round"], broadcast)
    )


async def start_gizem_game(room, safe_send, broadcast):
    old_task = room.get("gizem_task")
    if old_task and not old_task.done():
        old_task.cancel()

    active_ids = sorted(room["players"].keys())
    total_rounds = room.get("total_rounds", GIZEM_TOPLAM_TUR)
    
    room["phase"] = "playing"
    room["scores"] = {pid: 0 for pid in active_ids}
    room["gizem_round"] = 0
    room["gizem_answered"] = False
    room["gizem_used_indices"] = []
    room["gizem_hidden_indices"] = []
    room["left_players"] = {}
    
    # ✨ Her oyuncuya joker
    room["gizem_jokers"] = {
        pid: {"hint": True, "pass": True} for pid in active_ids
    }
    room["turn"] = active_ids[0]
    
    history = room.get("gizem_history_indices", set())
    total_players = len(GIZEM_PLAYERS)
    
    if len(history) >= total_players * 0.75:
        print(f"[GIZEM] Havuz büyük ölçüde tüketildi ({len(history)}/{total_players}), sıfırlanıyor")
        history = set()
    room["gizem_history_indices"] = history

    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]

    difficulty = room.get("difficulty", "karisik")
    q = gizem_pick_question([], difficulty=difficulty, round_no=0, history_indices=history, total_rounds=total_rounds)
    room["gizem_used_indices"] = [q["player_idx"]]
    history.add(q["player_idx"])
    room["gizem_history_indices"] = history
    room["gizem_current_q"] = q
    room["gizem_question_start"] = asyncio.get_running_loop().time()
    
    first_round_diff = difficulty
    if difficulty == "karisik":
        flow = get_karisik_flow(total_rounds)
        first_round_diff = flow[0]

    for pid, pdata in room["players"].items():
        await safe_send(pdata["ws"], {
            "type": "gizem_game_started",
            "player_id": pid,
            "players": players,
            "turn_seconds": room.get("turn_seconds", GIZEM_TUR_SURESI),
            "total_rounds": total_rounds,
            "current_turn": room["turn"],
            "round_no": 0,
            "career": q["career"],
            "options": q["options"],
            "scores": room["scores"],
            "jokers_left": room["gizem_jokers"],
            "difficulty": difficulty,
            "round_difficulty": first_round_diff,
            "max_players": room.get("max_players", 2)
        })

    room["gizem_task"] = asyncio.create_task(
        gizem_turn_timer(room, room["turn"], 0, broadcast)
    )


async def send_gizem_lobby_update(room, broadcast):
    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]
    max_players = room.get("max_players", 2)

    await broadcast(room, {
        "type": "gizem_lobby_update",
        "room_code": room["code"],
        "players": players,
        "can_start": len(room["players"]) == max_players,
        "turn_seconds": room.get("turn_seconds", GIZEM_TUR_SURESI),
        "difficulty": room.get("difficulty", "karisik"),
        "max_players": max_players,
        "total_rounds": room.get("total_rounds", GIZEM_TOPLAM_TUR)
    })


async def handle_gizem_message(
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
    if not str(msg_type).startswith("gizem_"):
        return _not_handled(room_code, player_id)

    current_room_code = room_code
    current_player_id = player_id

    if msg_type == "gizem_create_room":
        name = (data.get("name") or "").strip()
        turn_seconds_raw = data.get("turn_seconds", GIZEM_TUR_SURESI)
        difficulty = (data.get("difficulty") or "karisik").strip().lower()
        max_players_raw = data.get("max_players", 2)
        total_rounds_raw = data.get("total_rounds", GIZEM_TOPLAM_TUR)

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)

        try:
            gizem_turn_seconds = int(turn_seconds_raw)
            if gizem_turn_seconds not in [30, 45, 60, 90, 120]:
                gizem_turn_seconds = 60
        except:
            gizem_turn_seconds = 60
        
        if difficulty not in GIZEM_ZORLUKLAR:
            difficulty = "karisik"

        try:
            max_players = int(max_players_raw)
            if max_players not in [2, 3, 4, 5]:
                max_players = 2
        except:
            max_players = 2

        try:
            total_rounds = int(total_rounds_raw)
            if total_rounds not in GIZEM_ALLOWED_ROUNDS:
                total_rounds = GIZEM_TOPLAM_TUR
        except:
            total_rounds = GIZEM_TOPLAM_TUR

        current_room_code = make_room_code()
        current_player_id = 1

        rooms[current_room_code] = {
            "code": current_room_code,
            "mode": "gizemli_kariyer",
            "players": {
                1: {"ws": websocket, "name": name}
            },
            "phase": "lobby",
            "turn_seconds": gizem_turn_seconds,
            "difficulty": difficulty,
            "max_players": max_players,
            "total_rounds": total_rounds,
            "chat_history": [],
            "chat_last_msg_time": {},
            "scores": {},
            "gizem_round": 0,
            "gizem_answered": False,
            "gizem_used_indices": [],
            "gizem_hidden_indices": [],
            "gizem_current_q": None,
            "gizem_jokers": {},
            "turn": 1,
            "gizem_task": None,
            "gizem_history_indices": set(),
            "left_players": {}
        }

        await safe_send(websocket, {
            "type": "gizem_room_created",
            "room_code": current_room_code,
            "player_id": 1,
            "turn_seconds": gizem_turn_seconds,
            "difficulty": difficulty,
            "max_players": max_players,
            "total_rounds": total_rounds
        })
        await send_gizem_lobby_update(rooms[current_room_code], broadcast)
        return _handled(current_room_code, current_player_id)

    if msg_type == "gizem_join_room":
        name = (data.get("name") or "").strip()
        join_code = (data.get("room_code") or "").strip().upper()

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)

        if join_code not in rooms:
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            return _handled(current_room_code, current_player_id)

        room = rooms[join_code]

        if room.get("mode") != "gizemli_kariyer":
            await safe_send(websocket, {"type": "error", "message": "Bu oda farklı bir mod için."})
            return _handled(current_room_code, current_player_id)

        max_players = room.get("max_players", 2)
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
            "type": "gizem_room_joined",
            "room_code": current_room_code,
            "player_id": new_pid,
            "turn_seconds": room.get("turn_seconds", GIZEM_TUR_SURESI),
            "difficulty": room.get("difficulty", "karisik"),
            "max_players": max_players,
            "total_rounds": room.get("total_rounds", GIZEM_TOPLAM_TUR)
        })
        
        # 💬 Chat geçmişini yeni katılana gönder
        if room.get("chat_history"):
            await safe_send(websocket, {
                "type": "gizem_chat_history",
                "messages": room["chat_history"][-50:]
            })
        
        await send_gizem_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    if not current_room_code or current_room_code not in rooms:
        return _handled(current_room_code, current_player_id)

    room = rooms[current_room_code]

    if room.get("mode") != "gizemli_kariyer":
        return _handled(current_room_code, current_player_id)

    if msg_type == "gizem_update_settings":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host ayarları değiştirebilir."})
            return _handled(current_room_code, current_player_id)
        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Sadece lobbyde ayarları değiştirebilirsin."})
            return _handled(current_room_code, current_player_id)

        try:
            new_turn_sec = int(data.get("turn_seconds", room.get("turn_seconds", 60)))
            if new_turn_sec not in [30, 45, 60, 90, 120]:
                new_turn_sec = 60
        except:
            new_turn_sec = 60
        
        new_diff = (data.get("difficulty") or room.get("difficulty", "karisik")).strip().lower()
        if new_diff not in GIZEM_ZORLUKLAR:
            new_diff = room.get("difficulty", "karisik")

        try:
            new_max = int(data.get("max_players", room.get("max_players", 2)))
            if new_max not in [2, 3, 4, 5]:
                new_max = room.get("max_players", 2)
            if new_max < len(room["players"]):
                new_max = room.get("max_players", 2)
        except:
            new_max = room.get("max_players", 2)

        try:
            new_total = int(data.get("total_rounds", room.get("total_rounds", GIZEM_TOPLAM_TUR)))
            if new_total not in GIZEM_ALLOWED_ROUNDS:
                new_total = room.get("total_rounds", GIZEM_TOPLAM_TUR)
        except:
            new_total = room.get("total_rounds", GIZEM_TOPLAM_TUR)

        room["turn_seconds"] = new_turn_sec
        room["difficulty"] = new_diff
        room["max_players"] = new_max
        room["total_rounds"] = new_total

        await send_gizem_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    if msg_type == "gizem_start_game":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return _handled(current_room_code, current_player_id)

        max_players = room.get("max_players", 2)
        if len(room["players"]) != max_players:
            await safe_send(websocket, {"type": "error", "message": f"{max_players} oyuncu gerekli."})
            return _handled(current_room_code, current_player_id)

        await start_gizem_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    if msg_type == "gizem_answer":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("turn") != current_player_id:
            return _handled(current_room_code, current_player_id)
        if room.get("gizem_answered"):
            return _handled(current_room_code, current_player_id)

        choice = data.get("index")
        if not isinstance(choice, int) or choice < 0 or choice > 5:
            return _handled(current_room_code, current_player_id)

        if choice in room.get("gizem_hidden_indices", []):
            return _handled(current_room_code, current_player_id)

        current_q = room.get("gizem_current_q", {})
        correct_idx = current_q.get("correct_index", 0)
        correct = (choice == correct_idx)

        earned = 0
        if correct:
            earned = GIZEM_PUAN_DOGRU
            elapsed = asyncio.get_running_loop().time() - room.get("gizem_question_start", 0)
            if elapsed < 30:
                earned += GIZEM_PUAN_ERKEN_BONUS
        else:
            # ✨ Yanlış cezası
            earned = GIZEM_PUAN_YANLIS
        
        if current_player_id in room["scores"]:
            room["scores"][current_player_id] += earned

        room["gizem_answered"] = True

        old_task = room.get("gizem_task")
        if old_task and not old_task.done():
            old_task.cancel()

        await broadcast(room, {
            "type": "gizem_answer_result",
            "player_id": current_player_id,
            "correct": correct,
            "timeout": False,
            "passed": False,
            "selected_index": choice,
            "correct_index": correct_idx,
            "correct_name": current_q.get("player_name", "?"),
            "earned": earned,
            "scores": room["scores"]
        })

        await asyncio.sleep(3)
        await gizem_next_round(room, broadcast)
        return _handled(current_room_code, current_player_id)

    if msg_type == "gizem_joker_hint":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("turn") != current_player_id:
            return _handled(current_room_code, current_player_id)
        if room.get("gizem_answered"):
            return _handled(current_room_code, current_player_id)

        jokers = room["gizem_jokers"].get(current_player_id, {})
        if not jokers.get("hint"):
            return _handled(current_room_code, current_player_id)
        if room.get("gizem_hidden_indices"):
            return _handled(current_room_code, current_player_id)

        jokers["hint"] = False

        current_q = room.get("gizem_current_q", {})
        correct_idx = current_q.get("correct_index", 0)
        wrong_indices = [i for i in range(6) if i != correct_idx]
        to_hide = random.sample(wrong_indices, min(3, len(wrong_indices)))
        room["gizem_hidden_indices"] = to_hide

        await broadcast(room, {
            "type": "gizem_joker_used",
            "player_id": current_player_id,
            "joker_type": "hint",
            "hidden_indices": to_hide,
            "jokers_left": room["gizem_jokers"]
        })
        return _handled(current_room_code, current_player_id)

    if msg_type == "gizem_joker_pass":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room.get("turn") != current_player_id:
            return _handled(current_room_code, current_player_id)
        if room.get("gizem_answered"):
            return _handled(current_room_code, current_player_id)

        jokers = room["gizem_jokers"].get(current_player_id, {})
        if not jokers.get("pass"):
            return _handled(current_room_code, current_player_id)

        jokers["pass"] = False
        room["gizem_answered"] = True

        current_q = room.get("gizem_current_q", {})

        old_task = room.get("gizem_task")
        if old_task and not old_task.done():
            old_task.cancel()

        await broadcast(room, {
            "type": "gizem_answer_result",
            "player_id": current_player_id,
            "correct": False,
            "timeout": False,
            "passed": True,
            "selected_index": -1,
            "correct_index": current_q.get("correct_index", 0),
            "correct_name": current_q.get("player_name", "?"),
            "earned": 0,
            "scores": room["scores"],
            "jokers_left": room["gizem_jokers"]
        })

        await asyncio.sleep(3)
        await gizem_next_round(room, broadcast)
        return _handled(current_room_code, current_player_id)

    if msg_type == "gizem_rematch":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host tekrar başlatabilir."})
            return _handled(current_room_code, current_player_id)

        if len(room["players"]) < 2:
            return _handled(current_room_code, current_player_id)
        
        # Rematch'te odada kaç kişi varsa onlarla başla
        room["max_players"] = len(room["players"])

        await start_gizem_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- BACK TO LOBBY ----------
    if msg_type == "gizem_back_to_lobby":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host lobiye döndürebilir."})
            return _handled(current_room_code, current_player_id)
        
        room["phase"] = "lobby"
        room["max_players"] = len(room["players"])
        
        old_task = room.get("gizem_task")
        if old_task and not old_task.done():
            old_task.cancel()
        
        await broadcast(room, {"type": "gizem_back_to_lobby"})
        await send_gizem_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ==========================================
    # 💬 CHAT MESAJI GÖNDER
    # ==========================================
    if msg_type == "gizem_chat_send":
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
            "type": "gizem_chat_msg",
            "sender_id": current_player_id,
            "sender_name": sender_name,
            "text": text,
            "ts": now
        })
        
        return _handled(current_room_code, current_player_id)

    return _handled(current_room_code, current_player_id)