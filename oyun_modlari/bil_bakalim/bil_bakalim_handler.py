import asyncio
import random
import re
from oyun_modlari.bil_bakalim.footballers import ALL_FOOTBALLERS
from oyun_modlari.bil_bakalim.questions import ALL_QUESTIONS, check_question


def sanitize_string(text, max_length=50):
    """String'i temizle (XSS koruması)"""
    if not text:
        return ""
    text = str(text).strip()
    text = re.sub(r'<[^>]*>', '', text)
    text = re.sub(r'(javascript:|onerror=|onclick=|onload=)', '', text, flags=re.IGNORECASE)
    text = re.sub(r'[\x00-\x1f\x7f]', '', text)
    return text[:max_length]


def is_valid_room_code(code):
    if not code or len(code) != 6:
        return False
    return bool(re.match(r'^[A-Z0-9]{6}$', code))


GAME_MODE_LABELS = {
    "bil_bakalim": "Bil Bakalım",
    "takim_bilmece": "Takım Bilmece",
    "kim_milyoner": "Kim Milyoner",
    "haritadan_bul": "Haritadan Bul",
    "gizemli_kariyer": "Gizemli Kariyer",
    "ilk_11_challenge": "İlk 11 Challenge",
    "stadyum_tanima": "Stadyum Tanıma",
    "meme_arena": "🎭 Meme Arena",
    "mini_futbol": "⚽ Mini Futbol",
}


def get_other_player_id(player_id):
    return 2 if player_id == 1 else 1


def make_question_pack():
    return random.sample(range(len(ALL_QUESTIONS)), 6)


# ==========================================
# BIL BAKALIM - Yardımcı Fonksiyonlar
# ==========================================

async def send_lobby_update(room, broadcast):
    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]
    await broadcast(room, {
        "type": "lobby_update",
        "room_code": room["code"],
        "players": players,
        "can_start": len(room["players"]) == 2,
        "turn_seconds": room.get("turn_seconds", 45),
        "guess_limit": room.get("guess_limit", 0)
    })


async def start_round(room, safe_send, broadcast, reset_scores=False):
    if reset_scores or "scores" not in room:
        room["scores"] = {1: 0, 2: 0}

    room["footballer_indices"] = random.sample(range(len(ALL_FOOTBALLERS)), 32)
    room["footballers"] = [ALL_FOOTBALLERS[i] for i in room["footballer_indices"]]
    room["selections"] = {}
    room["remaining"] = {1: 32, 2: 32}
    room["turn"] = 1
    room["phase"] = "selection"
    room["question_pack"] = []
    room["pending_question"] = None

    guess_limit = room.get("guess_limit", 0)
    room["guesses_left"] = {1: guess_limit, 2: guess_limit}

    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]

    for pid, pdata in room["players"].items():
        await safe_send(pdata["ws"], {
            "type": "game_started",
            "footballers": room["footballers"],
            "questions": ALL_QUESTIONS,
            "scores": room["scores"],
            "players": players,
            "player_id": pid,
            "room_code": room["code"],
            "turn_seconds": room.get("turn_seconds", 45),
            "guess_limit": guess_limit,
            "guesses_left": room["guesses_left"]
        })

    room["selection_task"] = asyncio.create_task(selection_timer(room, safe_send, broadcast))


async def selection_timer(room, safe_send, broadcast):
    try:
        seconds = room.get("turn_seconds", 45)
        await asyncio.sleep(seconds)

        if room.get("phase") != "selection":
            return

        for pid in list(room["players"].keys()):
            if pid not in room["selections"]:
                random_index = random.randint(0, len(room["footballers"]) - 1)
                room["selections"][pid] = random_index
                fname = room["footballers"][random_index]["name"]

                await safe_send(room["players"][pid]["ws"], {
                    "type": "auto_selected",
                    "index": random_index,
                    "name": fname
                })

                other = get_other_player_id(pid)
                if other in room["players"]:
                    await safe_send(room["players"][other]["ws"], {
                        "type": "opponent_auto_selected",
                        "name": room["players"][pid]["name"]
                    })

        await broadcast(room, {
            "type": "selection_status",
            "selected_count": len(room["selections"])
        })

        if len(room["selections"]) == 2:
            room["phase"] = "playing"
            room["turn"] = 1
            await asyncio.sleep(1)
            await send_turn_update(room, safe_send, broadcast)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[SEÇİM TIMER HATA] {e}")


async def turn_timer(room, turn_id, safe_send, broadcast):
    try:
        seconds = room.get("turn_seconds", 45)
        await asyncio.sleep(seconds)

        if room.get("phase") != "playing":
            return
        if room.get("turn") != turn_id:
            return
        if room.get("pending_question"):
            return

        await broadcast(room, {
            "type": "turn_timeout",
            "player_id": turn_id
        })

        other_id = get_other_player_id(turn_id)
        room["turn"] = other_id
        await send_turn_update(room, safe_send, broadcast)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[TUR TIMER HATA] {e}")


async def answer_timer(room, safe_send, broadcast):
    try:
        seconds = room.get("turn_seconds", 45)
        await asyncio.sleep(seconds)

        pending = room.get("pending_question")
        if not pending:
            return

        asker_id = pending["asker_id"]
        other_id = get_other_player_id(asker_id)
        correct_answer = pending["correct_answer"]
        question_index = pending["question_index"]

        await safe_send(room["players"][asker_id]["ws"], {
            "type": "answer_result",
            "question_index": question_index,
            "answer": correct_answer,
            "auto": True
        })

        await safe_send(room["players"][other_id]["ws"], {
            "type": "answer_sent",
            "question_index": question_index,
            "answer": correct_answer,
            "auto": True
        })

        room["pending_question"] = None
        room["turn"] = other_id
        await send_turn_update(room, safe_send, broadcast)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[CEVAP TIMER HATA] {e}")


async def send_turn_update(room, safe_send, broadcast):
    room["question_pack"] = make_question_pack()

    old_task = room.get("turn_task")
    if old_task and not old_task.done():
        old_task.cancel()

    await broadcast(room, {
        "type": "turn_update",
        "current_turn": room["turn"],
        "question_indices": room["question_pack"],
        "scores": room["scores"],
        "remaining": room["remaining"],
        "turn_seconds": room.get("turn_seconds", 45),
        "guess_limit": room.get("guess_limit", 0),
        "guesses_left": room.get("guesses_left", {1: 0, 2: 0})
    })

    room["turn_task"] = asyncio.create_task(turn_timer(room, room["turn"], safe_send, broadcast))


# ==========================================
# ANA HANDLER FONKSİYONU
# ==========================================

async def handle_bil_bakalim_message(
    msg_type, data, websocket, rooms, room_code, player_id,
    make_room_code, safe_send, broadcast,
    check_rate_limit=None, request_history=None, room_creation_history=None,
    client_ip=None
):
    """
    Bil Bakalım mesajlarını işler.
    Dönüş: {"handled": bool, "room_code": str, "player_id": int}
    """
    result = {"handled": False, "room_code": room_code, "player_id": player_id}

    # --- QUERY ROOM MODE CHECK (sadece bilgi, odaya girmez) ---
    if msg_type == "query_room_mode_check":
        query_code = sanitize_string(data.get("room_code", ""), max_length=6).upper()

        if not is_valid_room_code(query_code):
            await safe_send(websocket, {
                "type": "room_mode_check_result",
                "found": False,
                "room_code": query_code
            })
            result["handled"] = True
            return result

        if query_code not in rooms:
            await safe_send(websocket, {
                "type": "room_mode_check_result",
                "found": False,
                "room_code": query_code
            })
            result["handled"] = True
            return result

        room_mode = rooms[query_code].get("mode", "bil_bakalim")
        mode_name = GAME_MODE_LABELS.get(room_mode, room_mode)
        await safe_send(websocket, {
            "type": "room_mode_check_result",
            "found": True,
            "mode": room_mode,
            "mode_name": mode_name,
            "room_code": query_code
        })
        result["handled"] = True
        return result

    # --- QUERY ROOM MODE ---
    if msg_type == "query_room_mode":
        if check_rate_limit and client_ip:
            ok, msg = check_rate_limit(client_ip, request_history, max_per_minute=20, action="query_room")
            if not ok:
                await safe_send(websocket, {"type": "error", "message": msg})
                result["handled"] = True
                return result

        query_code = sanitize_string(data.get("room_code", ""), max_length=6).upper()
        from_join_btn = bool(data.get("_from_join_btn", False))

        if not is_valid_room_code(query_code):
            await safe_send(websocket, {
                "type": "room_mode_result",
                "found": False,
                "room_code": query_code,
                "_from_join_btn": from_join_btn
            })
            result["handled"] = True
            return result

        if query_code not in rooms:
            await safe_send(websocket, {
                "type": "room_mode_result",
                "found": False,
                "room_code": query_code,
                "_from_join_btn": from_join_btn
            })
            result["handled"] = True
            return result

        room_mode = rooms[query_code].get("mode", "bil_bakalim")
        mode_name = GAME_MODE_LABELS.get(room_mode, room_mode)
        await safe_send(websocket, {
            "type": "room_mode_result",
            "found": True,
            "mode": room_mode,
            "mode_name": mode_name,
            "room_code": query_code,
            "_from_join_btn": from_join_btn
        })
        result["handled"] = True
        return result

    # --- CREATE ROOM ---
    if msg_type == "create_room":
        if check_rate_limit and client_ip:
            ok, msg = check_rate_limit(client_ip, room_creation_history, max_per_minute=5, action="create_room")
            if not ok:
                await safe_send(websocket, {"type": "error", "message": msg})
                result["handled"] = True
                return result

        name = sanitize_string(data.get("name", ""), max_length=15)
        turn_seconds_raw = data.get("turn_seconds", 45)
        guess_limit_raw = data.get("guess_limit", 0)

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            result["handled"] = True
            return result

        try:
            turn_seconds = int(turn_seconds_raw)
            if turn_seconds < 20 or turn_seconds > 120:
                turn_seconds = 45
        except:
            turn_seconds = 45

        try:
            guess_limit = int(guess_limit_raw)
            if guess_limit < 0 or guess_limit > 15:
                guess_limit = 0
        except:
            guess_limit = 0

        new_room_code = make_room_code()
        new_player_id = 1

        rooms[new_room_code] = {
            "code": new_room_code,
            "mode": "bil_bakalim",
            "players": {1: {"ws": websocket, "name": name}},
            "phase": "lobby",
            "scores": {1: 0, 2: 0},
            "footballer_indices": [],
            "footballers": [],
            "selections": {},
            "remaining": {1: 32, 2: 32},
            "turn": 1,
            "question_pack": [],
            "pending_question": None,
            "turn_seconds": turn_seconds,
            "guess_limit": guess_limit,
            "guesses_left": {1: guess_limit, 2: guess_limit},
            "turn_task": None,
            "selection_task": None,
            "answer_task": None
        }

        await safe_send(websocket, {
            "type": "room_created",
            "room_code": new_room_code,
            "player_id": 1,
            "turn_seconds": turn_seconds,
            "guess_limit": guess_limit
        })
        await send_lobby_update(rooms[new_room_code], broadcast)

        result["handled"] = True
        result["room_code"] = new_room_code
        result["player_id"] = new_player_id
        return result

    # --- JOIN ROOM ---
    if msg_type == "join_room":
        if check_rate_limit and client_ip:
            ok, msg = check_rate_limit(client_ip, request_history, max_per_minute=15, action="join_room")
            if not ok:
                await safe_send(websocket, {"type": "error", "message": msg})
                result["handled"] = True
                return result

        name = sanitize_string(data.get("name", ""), max_length=15)
        join_code = sanitize_string(data.get("room_code", ""), max_length=6).upper()

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            result["handled"] = True
            return result

        if not is_valid_room_code(join_code):
            await safe_send(websocket, {"type": "error", "message": "Geçersiz oda kodu formatı."})
            result["handled"] = True
            return result

        if join_code not in rooms:
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            result["handled"] = True
            return result

        room = rooms[join_code]
        
        # Atılmış kişi kontrolü
        kicked_names = room.get("kicked_names", [])
        if name.lower().strip() in kicked_names:
            await safe_send(websocket, {"type": "error", "message": "Bu odadan atıldınız!"})
            result["handled"] = True
            return result

        if len(room["players"]) >= 2:
            await safe_send(websocket, {"type": "error", "message": "Oda dolu."})
            result["handled"] = True
            return result

        if room.get("mode", "bil_bakalim") != "bil_bakalim":
            await safe_send(websocket, {"type": "error", "message": "Bu oda farklı bir mod için."})
            result["handled"] = True
            return result
        
        # ✨ Aynı isim var mı? (case-insensitive)
        existing_names = [p.get("name", "").lower().strip() for p in room["players"].values()]
        if name.lower().strip() in existing_names:
            await safe_send(websocket, {
                "type": "error",
                "message": f"Bu isimde ({name}) bir oyuncu zaten odada var. Farklı bir isim seç."
            })
            result["handled"] = True
            return result

        new_player_id = 2
        room["players"][2] = {"ws": websocket, "name": name}
        room["phase"] = "lobby"

        await safe_send(websocket, {
            "type": "room_joined",
            "room_code": join_code,
            "player_id": 2,
            "turn_seconds": room.get("turn_seconds", 45)
        })
        await send_lobby_update(room, broadcast)

        result["handled"] = True
        result["room_code"] = join_code
        result["player_id"] = new_player_id
        return result

    # Buradan sonrası oda gerekli
    if not room_code or room_code not in rooms:
        return result

    room = rooms[room_code]

    # Sadece bil_bakalim modundaki odalarda çalış
    if room.get("mode") != "bil_bakalim":
        return result

    # --- UPDATE ROOM SETTINGS (sadece host, sadece lobbyde) ---
    if msg_type == "update_room_settings":
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host ayarları değiştirebilir."})
            result["handled"] = True
            return result

        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Sadece lobbyde ayarları değiştirebilirsin."})
            result["handled"] = True
            return result

        # Tur Süresi
        turn_seconds_raw = data.get("turn_seconds", room.get("turn_seconds", 45))
        try:
            turn_seconds = int(turn_seconds_raw)
            if turn_seconds < 20 or turn_seconds > 120:
                turn_seconds = 45
        except:
            turn_seconds = 45

        # Tahmin Hakkı
        guess_limit_raw = data.get("guess_limit", room.get("guess_limit", 0))
        try:
            guess_limit = int(guess_limit_raw)
            if guess_limit < 0 or guess_limit > 15:
                guess_limit = 0
        except:
            guess_limit = 0

        room["turn_seconds"] = turn_seconds
        room["guess_limit"] = guess_limit
        room["guesses_left"] = {1: guess_limit, 2: guess_limit}

        await send_lobby_update(room, broadcast)

        result["handled"] = True
        return result

    # --- KICK PLAYER (sadece host, sadece lobbyde) ---
    if msg_type == "kick_player":
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host oyuncu atabilir."})
            result["handled"] = True
            return result

        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Sadece lobbyde oyuncu atabilirsin."})
            result["handled"] = True
            return result

        target_id = data.get("target_id")
        if not isinstance(target_id, int) or target_id == 1:
            result["handled"] = True
            return result

        if target_id not in room["players"]:
            result["handled"] = True
            return result

        target_name = room["players"][target_id]["name"]
        target_ws = room["players"][target_id]["ws"]

        # Atılan oyuncunun ismini kaydet (tekrar giremesin)
        if "kicked_names" not in room:
            room["kicked_names"] = []
        room["kicked_names"].append(target_name.lower().strip())

        # Atılan oyuncuya bildir
        await safe_send(target_ws, {
            "type": "you_were_kicked",
            "message": "Host tarafından odadan atıldın."
        })

        # Atılan oyuncuyu çıkar
        del room["players"][target_id]

        # Diğerlerine bildir
        await broadcast(room, {
            "type": "player_kicked",
            "message": f"{target_name} host tarafından atıldı."
        })
        await send_lobby_update(room, broadcast)

        result["handled"] = True
        return result

    # --- START GAME ---
    if msg_type == "start_game":
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            result["handled"] = True
            return result
        if len(room["players"]) != 2:
            await safe_send(websocket, {"type": "error", "message": "2 oyuncu gerekli."})
            result["handled"] = True
            return result
        reset_scores = room["phase"] == "lobby"
        await start_round(room, safe_send, broadcast, reset_scores=reset_scores)
        result["handled"] = True
        return result

    # --- SELECT SECRET ---
    if msg_type == "select_secret":
        if room["phase"] != "selection":
            result["handled"] = True
            return result

        index = data.get("index")
        if not isinstance(index, int):
            result["handled"] = True
            return result
        if index < 0 or index >= len(room["footballers"]):
            result["handled"] = True
            return result

        room["selections"][player_id] = index

        await broadcast(room, {
            "type": "selection_status",
            "selected_count": len(room["selections"])
        })

        if len(room["selections"]) == 2:
            sel_task = room.get("selection_task")
            if sel_task and not sel_task.done():
                sel_task.cancel()
            room["phase"] = "playing"
            room["turn"] = 1
            await send_turn_update(room, safe_send, broadcast)

        result["handled"] = True
        return result

    # --- ASK QUESTION ---
    if msg_type == "ask_question":
        if room["phase"] != "playing":
            result["handled"] = True
            return result
        if room["turn"] != player_id:
            await safe_send(websocket, {"type": "error", "message": "Sıra sende değil."})
            result["handled"] = True
            return result

        question_index = data.get("question_index")
        if not isinstance(question_index, int):
            result["handled"] = True
            return result
        if question_index not in room["question_pack"]:
            await safe_send(websocket, {"type": "error", "message": "Bu soru pakette yok."})
            result["handled"] = True
            return result

        other_id = get_other_player_id(player_id)
        if other_id not in room["players"]:
            result["handled"] = True
            return result

        other_secret_index = room["selections"].get(other_id)
        if other_secret_index is None:
            result["handled"] = True
            return result

        secret_footballer = room["footballers"][other_secret_index]
        correct_answer = check_question(secret_footballer, question_index)

        old_task = room.get("turn_task")
        if old_task and not old_task.done():
            old_task.cancel()

        room["pending_question"] = {
            "asker_id": player_id,
            "question_index": question_index,
            "correct_answer": correct_answer
        }

        await safe_send(room["players"][player_id]["ws"], {
            "type": "waiting_for_answer",
            "question_index": question_index,
            "opponent_name": room["players"][other_id]["name"]
        })

        await safe_send(room["players"][other_id]["ws"], {
            "type": "answer_prompt",
            "question_index": question_index,
            "correct_answer": correct_answer,
            "asker_name": room["players"][player_id]["name"],
            "turn_seconds": room.get("turn_seconds", 45)
        })

        room["answer_task"] = asyncio.create_task(answer_timer(room, safe_send, broadcast))
        result["handled"] = True
        return result

    # --- SUBMIT ANSWER ---
    if msg_type == "submit_answer":
        if room["phase"] != "playing":
            result["handled"] = True
            return result

        pending = room.get("pending_question")
        if not pending:
            result["handled"] = True
            return result

        other_id = get_other_player_id(pending["asker_id"])
        if player_id != other_id:
            result["handled"] = True
            return result

        correct_answer = pending["correct_answer"]
        final_answer = correct_answer
        asker_id = pending["asker_id"]
        question_index = pending["question_index"]

        ans_task = room.get("answer_task")
        if ans_task and not ans_task.done():
            ans_task.cancel()

        await safe_send(room["players"][asker_id]["ws"], {
            "type": "answer_result",
            "question_index": question_index,
            "answer": final_answer
        })

        await safe_send(room["players"][other_id]["ws"], {
            "type": "answer_sent",
            "question_index": question_index,
            "answer": final_answer
        })

        room["pending_question"] = None
        room["turn"] = other_id
        await send_turn_update(room, safe_send, broadcast)
        result["handled"] = True
        return result

    # --- REMAINING UPDATE ---
    if msg_type == "remaining_update":
        count = data.get("count")
        if isinstance(count, int):
            room["remaining"][player_id] = count
            await broadcast(room, {
                "type": "remaining_update",
                "player_id": player_id,
                "count": count
            })
        result["handled"] = True
        return result

    # --- GUESS ---
    if msg_type == "guess":
        if room["phase"] != "playing":
            result["handled"] = True
            return result
        if room["turn"] != player_id:
            await safe_send(websocket, {"type": "error", "message": "Sıra sende değil."})
            result["handled"] = True
            return result

        guessed_index = data.get("index")
        if not isinstance(guessed_index, int):
            result["handled"] = True
            return result
        if guessed_index < 0 or guessed_index >= len(room["footballers"]):
            result["handled"] = True
            return result

        other_id = get_other_player_id(player_id)
        other_secret_index = room["selections"].get(other_id)
        if other_secret_index is None:
            result["handled"] = True
            return result

        guessed_name = room["footballers"][guessed_index]["name"]
        guessed_img = room["footballers"][guessed_index].get("img_file", "")

        old_task = room.get("turn_task")
        if old_task and not old_task.done():
            old_task.cancel()

        guess_limit = room.get("guess_limit", 0)

        if guessed_index == other_secret_index:
            room["scores"][player_id] += 1
            room["phase"] = "over"

            reveal = {
                "1": room["selections"].get(1),
                "2": room["selections"].get(2)
            }

            await broadcast(room, {
                "type": "game_over",
                "winner_id": player_id,
                "scores": room["scores"],
                "reveal": reveal,
                "guessed_name": guessed_name,
                "guesser_name": room["players"][player_id]["name"]
            })
        else:
            if guess_limit == 0:
                await broadcast(room, {
                    "type": "wrong_guess_continue",
                    "guesser_id": player_id,
                    "guesser_name": room["players"][player_id]["name"],
                    "guessed_name": guessed_name,
                    "guessed_img": guessed_img
                })
                room["turn"] = other_id
                await send_turn_update(room, safe_send, broadcast)
            else:
                room["guesses_left"][player_id] -= 1
                left = room["guesses_left"][player_id]

                if left <= 0:
                    room["scores"][other_id] += 1
                    room["phase"] = "over"

                    reveal = {
                        "1": room["selections"].get(1),
                        "2": room["selections"].get(2)
                    }

                    await broadcast(room, {
                        "type": "game_over",
                        "winner_id": other_id,
                        "loser_id": player_id,
                        "scores": room["scores"],
                        "reveal": reveal,
                        "wrong_guess": True,
                        "guessed_name": guessed_name,
                        "guesser_name": room["players"][player_id]["name"],
                        "out_of_guesses": True
                    })
                else:
                    await broadcast(room, {
                        "type": "wrong_guess_continue",
                        "guesser_id": player_id,
                        "guesser_name": room["players"][player_id]["name"],
                        "guessed_name": guessed_name,
                        "guessed_img": guessed_img,
                        "guesses_left": room["guesses_left"]
                    })
                    room["turn"] = other_id
                    await send_turn_update(room, safe_send, broadcast)

        result["handled"] = True
        return result

    return result