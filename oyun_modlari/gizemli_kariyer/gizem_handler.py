import asyncio
import random

from oyun_modlari.gizemli_kariyer.futbolcular import ALL_PLAYERS as GIZEM_PLAYERS
from oyun_modlari.gizemli_kariyer.takimlar import ALL_TEAMS as GIZEM_TEAMS


GIZEM_TOPLAM_TUR = 10
GIZEM_TUR_SURESI = 60
GIZEM_PUAN_DOGRU = 10
GIZEM_PUAN_ERKEN_BONUS = 5

# ✨ Zorluk seviyeleri
GIZEM_ZORLUKLAR = ["kolay", "orta", "zor", "karisik"]

# ✨ Karışık modda progresif zorluk dağılımı (10 tur):
# Tur 1-3: kolay, Tur 4-7: orta, Tur 8-10: zor
GIZEM_KARISIK_DAGILIM = ["kolay", "kolay", "kolay", "orta", "orta", "orta", "orta", "zor", "zor", "zor"]


def get_gizem_players_by_difficulty(difficulty):
    """Zorluk seviyesine gore futbolcu listesi (index, player) tuple'lari"""
    result = []
    for i, p in enumerate(GIZEM_PLAYERS):
        pdiff = p.get("difficulty", "orta")  # default orta
        if pdiff == difficulty and len(p.get("career", [])) >= 2:
            result.append((i, p))
    return result


def _handled(room_code, player_id):
    return {
        "handled": True,
        "room_code": room_code,
        "player_id": player_id
    }


def _not_handled(room_code, player_id):
    return {
        "handled": False,
        "room_code": room_code,
        "player_id": player_id
    }


def gizem_pick_question(exclude_indices=None, difficulty="karisik", round_no=0, history_indices=None):
    """
    difficulty: kolay/orta/zor → sadece o zorluk
                karisik → round_no'ya göre progresif (GIZEM_KARISIK_DAGILIM)
    exclude_indices: bu oyunda kullanılanlar (kesin dışlanır)
    history_indices: önceki oyunlarda kullanılanlar (öncelik olarak dışlanır)
    """
    if exclude_indices is None:
        exclude_indices = []
    if history_indices is None:
        history_indices = set()
    else:
        history_indices = set(history_indices)
    
    # ✨ Zorluk belirle
    target_difficulty = difficulty
    if difficulty == "karisik":
        # Progresif: round'a göre kolay/orta/zor
        if 0 <= round_no < len(GIZEM_KARISIK_DAGILIM):
            target_difficulty = GIZEM_KARISIK_DAGILIM[round_no]
        else:
            target_difficulty = "orta"  # fallback

    # ✨ Adım 1: Fresh (bu oyunda VE önceki oyunlarda kullanılmamış)
    fresh = [
        (i, p) for i, p in enumerate(GIZEM_PLAYERS)
        if p.get("difficulty", "orta") == target_difficulty
        and len(p.get("career", [])) >= 2
        and i not in exclude_indices
        and i not in history_indices
    ]
    
    # ✨ Adım 2: Fresh yoksa → history'de var ama bu oyunda yok
    if not fresh:
        fresh = [
            (i, p) for i, p in enumerate(GIZEM_PLAYERS)
            if p.get("difficulty", "orta") == target_difficulty
            and len(p.get("career", [])) >= 2
            and i not in exclude_indices
        ]
    
    # ✨ Adım 3: O da yoksa → sadece zorluğa göre (exclude'u yoksay)
    if not fresh:
        fresh = [
            (i, p) for i, p in enumerate(GIZEM_PLAYERS)
            if p.get("difficulty", "orta") == target_difficulty
            and len(p.get("career", [])) >= 2
        ]
    
    # ✨ Adım 4: Yine yoksa (hiç yok), herhangi birini al (güvenlik)
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

        print(f"[GIZEM TIMER] Süre doldu, oyuncu {turn_id}")

        room["gizem_answered"] = True
        current_q = room.get("gizem_current_q", {})

        await broadcast(room, {
            "type": "gizem_answer_result",
            "player_id": turn_id,
            "correct": False,
            "timeout": True,
            "passed": False,
            "selected_index": -1,
            "correct_index": current_q.get("correct_index", 0),
            "correct_name": current_q.get("player_name", "?"),
            "earned": 0,
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

    if room["gizem_round"] >= GIZEM_TOPLAM_TUR:
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
            "type": "gizem_game_over",
            "scores": room["scores"],
            "winner_id": winner
        })
        return

    room["turn"] = 1 if room["gizem_round"] % 2 == 0 else 2
    room["gizem_answered"] = False
    room["gizem_hidden_indices"] = []

    exclude = room.get("gizem_used_indices", [])
    difficulty = room.get("difficulty", "karisik")
    history = room.get("gizem_history_indices", set())
    q = gizem_pick_question(exclude, difficulty=difficulty, round_no=room["gizem_round"], history_indices=history)
    room["gizem_used_indices"] = exclude + [q["player_idx"]]
    # ✨ History'ye de ekle (rematch için)
    history.add(q["player_idx"])
    room["gizem_history_indices"] = history
    room["gizem_current_q"] = q
    room["gizem_question_start"] = asyncio.get_running_loop().time()

    # ✨ Bu turun zorluğu (progresif için client bilsin)
    turn_diff = room.get("difficulty", "karisik")
    if turn_diff == "karisik" and 0 <= room["gizem_round"] < len(GIZEM_KARISIK_DAGILIM):
        turn_diff = GIZEM_KARISIK_DAGILIM[room["gizem_round"]]
    
    await broadcast(room, {
        "type": "gizem_new_round",
        "round_no": room["gizem_round"],
        "total_rounds": GIZEM_TOPLAM_TUR,
        "current_turn": room["turn"],
        "career": q["career"],
        "options": q["options"],
        "scores": room["scores"],
        "jokers_left": room["gizem_jokers"],
        "round_difficulty": turn_diff  # ✨ Bu tur zorluğu
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

    room["phase"] = "playing"
    room["scores"] = {1: 0, 2: 0}
    room["gizem_round"] = 0
    room["gizem_answered"] = False
    room["gizem_used_indices"] = []
    room["gizem_hidden_indices"] = []
    room["gizem_jokers"] = {
        1: {"hint": True, "pass": True},
        2: {"hint": True, "pass": True}
    }
    room["turn"] = 1
    
    # ✨ HISTORY — Önceki oyunlarda kullanılan futbolcuları hatırla
    history = room.get("gizem_history_indices", set())
    total_players = len(GIZEM_PLAYERS)
    
    # Havuzun %75'i tüketildiyse sıfırla
    if len(history) >= total_players * 0.75:
        print(f"[GIZEM] Havuz büyük ölçüde tüketildi ({len(history)}/{total_players}), sıfırlanıyor")
        history = set()
    room["gizem_history_indices"] = history

    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]

    difficulty = room.get("difficulty", "karisik")
    history = room.get("gizem_history_indices", set())
    q = gizem_pick_question([], difficulty=difficulty, round_no=0, history_indices=history)
    room["gizem_used_indices"] = [q["player_idx"]]
    # ✨ History'ye ekle
    history.add(q["player_idx"])
    room["gizem_history_indices"] = history
    room["gizem_current_q"] = q
    room["gizem_question_start"] = asyncio.get_running_loop().time()
    
    # ✨ İlk turun zorluğu (progresif için)
    first_round_diff = difficulty
    if difficulty == "karisik":
        first_round_diff = GIZEM_KARISIK_DAGILIM[0]

    for pid, pdata in room["players"].items():
        await safe_send(pdata["ws"], {
            "type": "gizem_game_started",
            "player_id": pid,
            "players": players,
            "turn_seconds": room.get("turn_seconds", GIZEM_TUR_SURESI),
            "total_rounds": GIZEM_TOPLAM_TUR,
            "current_turn": 1,
            "round_no": 0,
            "career": q["career"],
            "options": q["options"],
            "scores": room["scores"],
            "jokers_left": room["gizem_jokers"],
            "difficulty": difficulty,           # ✨ Oda zorluğu
            "round_difficulty": first_round_diff  # ✨ Bu tur zorluğu
        })

    room["gizem_task"] = asyncio.create_task(
        gizem_turn_timer(room, 1, 0, broadcast)
    )


async def send_gizem_lobby_update(room, broadcast):
    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]

    await broadcast(room, {
        "type": "gizem_lobby_update",
        "room_code": room["code"],
        "players": players,
        "can_start": len(room["players"]) == 2,
        "turn_seconds": room.get("turn_seconds", GIZEM_TUR_SURESI),
        "difficulty": room.get("difficulty", "karisik")  # ✨ Zorluk bilgisi
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
        difficulty = (data.get("difficulty") or "karisik").strip().lower()  # ✨

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)

        try:
            gizem_turn_seconds = int(turn_seconds_raw)
            if gizem_turn_seconds not in [30, 45, 60, 90, 120]:
                gizem_turn_seconds = 60
        except:
            gizem_turn_seconds = 60
        
        # ✨ Zorluk kontrol
        if difficulty not in GIZEM_ZORLUKLAR:
            difficulty = "karisik"

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
            "difficulty": difficulty,  # ✨ Zorluk
            "scores": {1: 0, 2: 0},
            "gizem_round": 0,
            "gizem_answered": False,
            "gizem_used_indices": [],
            "gizem_hidden_indices": [],
            "gizem_current_q": None,
            "gizem_jokers": {
                1: {"hint": True, "pass": True},
                2: {"hint": True, "pass": True}
            },
            "turn": 1,
            "gizem_task": None,
            "gizem_history_indices": set()  # ✨ Önceki oyunlarda kullanılan futbolcular
        }

        await safe_send(websocket, {
            "type": "gizem_room_created",
            "room_code": current_room_code,
            "player_id": 1,
            "turn_seconds": gizem_turn_seconds,
            "difficulty": difficulty  # ✨
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
            "type": "gizem_room_joined",
            "room_code": current_room_code,
            "player_id": 2,
            "turn_seconds": room.get("turn_seconds", GIZEM_TUR_SURESI),
            "difficulty": room.get("difficulty", "karisik")  # ✨
        })
        await send_gizem_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    if not current_room_code or current_room_code not in rooms:
        return _handled(current_room_code, current_player_id)

    room = rooms[current_room_code]

    if room.get("mode") != "gizemli_kariyer":
        return _handled(current_room_code, current_player_id)

    # ---------- UPDATE ROOM SETTINGS ----------
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
        
        # ✨ Zorluk güncelle
        new_diff = (data.get("difficulty") or room.get("difficulty", "karisik")).strip().lower()
        if new_diff not in GIZEM_ZORLUKLAR:
            new_diff = room.get("difficulty", "karisik")

        room["turn_seconds"] = new_turn_sec
        room["difficulty"] = new_diff  # ✨

        await send_gizem_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    if msg_type == "gizem_start_game":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return _handled(current_room_code, current_player_id)

        if len(room["players"]) != 2:
            await safe_send(websocket, {"type": "error", "message": "2 oyuncu gerekli."})
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

        jokers = room["gizem_jokers"][current_player_id]
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

        jokers = room["gizem_jokers"][current_player_id]
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

        if len(room["players"]) != 2:
            return _handled(current_room_code, current_player_id)

        await start_gizem_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    return _handled(current_room_code, current_player_id)