import random
import asyncio
import chess

from oyun_modlari.jokerli_satranc.jokerler import (
    JOKERS, get_joker_by_id, get_public_joker_info, get_random_jokers
)

# ==========================================
# ROOM STATE HELPER
# ==========================================

def make_satranc_room(code, host_name, settings=None):
    s = settings or {}
    return {
        "code": code,
        "mode": "jokerli_satranc",
        "phase": "lobby",
        "players": {},
        "kicked_names": [],
        "chat_history": [],
        "chat_last_msg_time": {},
        "scores": {},
        "satranc_time_mode": s.get("time_mode", "blitz"),
        "satranc_joker_count": s.get("joker_count", 3),
        "satranc_pick_mode": s.get("pick_mode", "karisik"),
        "satranc_pick_seconds": s.get("pick_seconds", 60),
        "satranc_game": None,
        "satranc_turn": None,
        "satranc_white": None,
        "satranc_black": None,
        "satranc_jokers": {},           # {pid: [joker_id, ...]}
        "satranc_used_jokers": {},      # {pid: [joker_id, ...]}
        "satranc_shielded": {},         # {square: turns_left} (kalkan)
        "satranc_frozen": {},           # {square: turns_left} (dondur)
        "satranc_invisible": {},        # {square: turns_left} (görünmez)
        "satranc_locked": {},           # {square: turns_left} (kilitle - max 2 kare)
        "satranc_ajan_disguised": {},   # {square: "w"|"b"} (sadece görsel sahte renk)
        "satranc_captured_pieces": {},  # {pid: [{"type": "q", "color": "w"}, ...]} yenilen taşlar
        "satranc_pending_promotion": None,  # {"pid": X, "from": "a7", "to": "a8"} bekleyen promosyon
        "satranc_extra_move": {},       # {pid: bool} (Hakkını Bana Ver aktif mi)
        "satranc_same_piece_double": {},# {pid: {"active": bool, "required_from": str|None}} (İki Hamle)
        "satranc_hizli_kacis": {},      # {pid: bool} (Hızlı Kaçış aktif mi)
        "satranc_clock_frozen_turn": {},# {pid: bool} (Zamanı Durdur: sadece bu tur saati akmaz)
        "satranc_yansima": {},          # {pid: bool} (Yansıma bufferı - rakibin joker'i geri döner)
        "satranc_sansur": {},           # {pid: turns_left} (Sansür - kullanılamaz)
        "satranc_wants_white": [],      # [pid, ...] (Önce Başla jokerini kullananlar)
        "satranc_move_count": 0,        # Toplam hamle sayısı (efekt sayaçları için)
        "satranc_selected_slots": {},   # {pid: [joker_id, ...]} manuel seçim sırasında
        "satranc_selection_done": {},   # {pid: True/False}
        "satranc_selection_deadline": 0,
        "satranc_clocks": {},
        "satranc_task": None,
        "satranc_clock_task": None,
        "satranc_selection_task": None,
    }


# ==========================================
# LOBBY UPDATE
# ==========================================

async def send_jokerli_satranc_lobby_update(room, broadcast):
    players_list = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]
    await broadcast(room, {
        "type": "satranc_lobby_update",
        "room_code": room["code"],
        "players": players_list,
        "phase": room.get("phase", "lobby"),
        "time_mode": room.get("satranc_time_mode", "blitz"),
        "joker_count": room.get("satranc_joker_count", 3),
        "pick_mode": room.get("satranc_pick_mode", "karisik"),
        "pick_seconds": room.get("satranc_pick_seconds", 60),
    })


# ==========================================
# SÜRE MODLARI
# ==========================================

TIME_MODES = {
    "bullet":  {"label": "Bullet",  "seconds": 60,   "increment": 0},
    "blitz":   {"label": "Blitz",   "seconds": 180,  "increment": 2},
    "rapid":   {"label": "Rapid",   "seconds": 600,  "increment": 5},
    "klasik":  {"label": "Klasik",  "seconds": 1800, "increment": 30},
    "suresiz": {"label": "Süresiz", "seconds": 0,    "increment": 0},
}


# ==========================================
# BOARD STATE → JSON
# ==========================================

def board_to_dict(board):
    """python-chess board'u frontend'e gönderilebilir dict'e çevirir."""
    pieces = {}
    for square in chess.SQUARES:
        piece = board.piece_at(square)
        if piece:
            sq_name = chess.square_name(square)
            pieces[sq_name] = {
                "type": piece.symbol(),
                "color": "w" if piece.color == chess.WHITE else "b"
            }
    return {
        "fen": board.fen(),
        "pieces": pieces,
        "turn": "w" if board.turn == chess.WHITE else "b",
        "is_check": board.is_check(),
        "is_checkmate": board.is_checkmate(),
        "is_stalemate": board.is_stalemate(),
        "is_game_over": board.is_game_over(),
    }


def get_legal_moves(board):
    """Legal hamleleri UCI formatında liste olarak döner."""
    return [move.uci() for move in board.legal_moves]


def get_captured_pieces_payload(room):
    """Frontend'e güvenli captured pieces payload döner."""
    payload = {}
    captured_map = room.get("satranc_captured_pieces", {})
    for pid in room.get("players", {}):
        payload[str(pid)] = [dict(x) for x in captured_map.get(pid, [])]
    return payload


def _remove_last_captured_piece(room, capturer_pid, piece_type, piece_color):
    captured_map = room.setdefault("satranc_captured_pieces", {})
    captured_list = captured_map.setdefault(capturer_pid, [])
    wanted_type = piece_type.lower()
    wanted_color = "w" if piece_color == chess.WHITE else "b"

    for i in range(len(captured_list) - 1, -1, -1):
        item = captured_list[i]
        if item.get("type") == wanted_type and item.get("color") == wanted_color:
            captured_list.pop(i)
            break


def rollback_captured_for_undo(room, board_before_move, move, mover_pid):
    """Undo sonrası captured listesini geri sarar."""
    try:
        if not board_before_move.is_capture(move):
            return

        if board_before_move.is_en_passant(move):
            _remove_last_captured_piece(room, mover_pid, "p", not board_before_move.turn)
            return

        restored_piece = board_before_move.piece_at(move.to_square)
        if not restored_piece:
            return

        _remove_last_captured_piece(
            room,
            mover_pid,
            restored_piece.symbol().lower(),
            restored_piece.color
        )
    except Exception as e:
        print(f"[SATRANC UNDO CAPTURE ROLLBACK HATA] {e}")


# ==========================================
# SAAT SİSTEMİ
# ==========================================

async def run_clock(room, broadcast, safe_send):
    """Aktif oyuncunun saatini saniye saniye azaltır."""
    try:
        while True:
            await asyncio.sleep(1)

            if room.get("phase") != "playing":
                break

            board = room.get("satranc_game")
            if not board:
                break

            # Kimin sırası
            current_color = chess.WHITE if board.turn == chess.WHITE else chess.BLACK
            white_pid = room.get("satranc_white")
            black_pid = room.get("satranc_black")
            active_pid = white_pid if current_color == chess.WHITE else black_pid

            time_mode = room.get("satranc_time_mode", "blitz")

            # Süresiz modda saat yok
            if time_mode == "suresiz":
                await asyncio.sleep(5)
                continue

            clocks = room.get("satranc_clocks", {})
            if active_pid not in clocks:
                break

            clock_frozen_turn = room.get("satranc_clock_frozen_turn", {})
            if clock_frozen_turn.get(active_pid):
                continue

            clocks[active_pid] -= 1

            # Saat broadcast
            await broadcast(room, {
                "type": "satranc_clock_update",
                "clocks": {str(pid): clocks[pid] for pid in clocks},
                "active_player": active_pid
            })

            # Süre bitti
            if clocks[active_pid] <= 0:
                clocks[active_pid] = 0
                loser_pid = active_pid
                winner_pid = black_pid if loser_pid == white_pid else white_pid

                room["phase"] = "game_over"

                await broadcast(room, {
                    "type": "satranc_game_over",
                    "reason": "timeout",
                    "winner_id": winner_pid,
                    "loser_id": loser_pid,
                    "winner_name": room["players"].get(winner_pid, {}).get("name", "?"),
                    "loser_name": room["players"].get(loser_pid, {}).get("name", "?"),
                    "message": "Süre doldu!"
                })
                break

    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[SATRANC CLOCK HATA] {e}")


# ==========================================
# ANA HANDLER
# ==========================================

async def handle_jokerli_satranc_message(
    msg_type, data, websocket,
    rooms, room_code, player_id,
    make_room_code, safe_send, broadcast
):
    # ----------------------------------------
    # ODA OLUŞTUR
    # ----------------------------------------
    if msg_type == "satranc_create_room":
        name = (data.get("name") or "").strip()
        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gerekli."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        new_code = make_room_code()
        room = make_satranc_room(new_code, name, {
            "time_mode":    data.get("time_mode", "blitz"),
            "joker_count":  data.get("joker_count", 3),
            "pick_mode":    data.get("pick_mode", "karisik"),
            "pick_seconds": data.get("pick_seconds", 60),
        })
        room["players"][1] = {"ws": websocket, "name": name, "score": 0}
        rooms[new_code] = room

        print(f"[SATRANC] Oda oluşturuldu: {new_code} host={name}")

        await safe_send(websocket, {
            "type": "satranc_room_created",
            "room_code": new_code,
            "player_id": 1,
            "time_mode": room["satranc_time_mode"],
            "joker_count": room["satranc_joker_count"],
            "pick_mode": room["satranc_pick_mode"],
            "pick_seconds": room["satranc_pick_seconds"],
        })
        await send_jokerli_satranc_lobby_update(room, broadcast)
        return {"handled": True, "room_code": new_code, "player_id": 1}

    # ----------------------------------------
    # ODAYA KATIL
    # ----------------------------------------
    if msg_type == "satranc_join_room":
        name = (data.get("name") or "").strip()
        join_code = (data.get("room_code") or "").strip().upper()

        if not name or not join_code:
            await safe_send(websocket, {"type": "error", "message": "İsim ve oda kodu gerekli."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        if join_code not in rooms:
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        room = rooms[join_code]

        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Oyun zaten başladı."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        if len(room["players"]) >= 2:
            await safe_send(websocket, {"type": "error", "message": "Oda dolu."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        new_pid = 2 if 1 in room["players"] else 1
        room["players"][new_pid] = {"ws": websocket, "name": name, "score": 0}

        print(f"[SATRANC] {name} (pid={new_pid}) odaya katıldı: {join_code}")

        await safe_send(websocket, {
            "type": "satranc_room_joined",
            "room_code": join_code,
            "player_id": new_pid,
            "time_mode": room["satranc_time_mode"],
            "joker_count": room["satranc_joker_count"],
            "pick_mode": room["satranc_pick_mode"],
            "pick_seconds": room["satranc_pick_seconds"],
        })
        await send_jokerli_satranc_lobby_update(room, broadcast)
        return {"handled": True, "room_code": join_code, "player_id": new_pid}

    # ----------------------------------------
    # AYARLARI GÜNCELLE
    # ----------------------------------------
    if msg_type == "satranc_update_settings":
        if not room_code or room_code not in rooms:
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        room = rooms[room_code]
        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host ayar değiştirebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        if "time_mode" in data and data["time_mode"] in TIME_MODES:
            room["satranc_time_mode"] = data["time_mode"]
        if "joker_count" in data:
            jc = int(data["joker_count"])
            room["satranc_joker_count"] = max(1, min(6, jc))
        if "pick_mode" in data and data["pick_mode"] in ("manuel", "karisik"):
            room["satranc_pick_mode"] = data["pick_mode"]
        if "pick_seconds" in data:
            ps = int(data["pick_seconds"])
            # 0 = sınırsız, aksi halde 15-600 arası
            if ps == 0:
                room["satranc_pick_seconds"] = 0
            else:
                room["satranc_pick_seconds"] = max(15, min(600, ps))

        await send_jokerli_satranc_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}

    # ----------------------------------------
    # OYUNU BAŞLAT (Joker Seçim Fazına Geç)
    # ----------------------------------------
    if msg_type == "satranc_start_game":
        if not room_code or room_code not in rooms:
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        room = rooms[room_code]
        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        if len(room["players"]) < 2:
            await safe_send(websocket, {"type": "error", "message": "2 oyuncu gerekli."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        if room.get("phase") != "lobby":
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ✨ Joker seçim fazına geç
        room["phase"] = "joker_selection"
        room["satranc_selected_slots"] = {pid: [] for pid in room["players"]}
        room["satranc_selection_done"] = {pid: False for pid in room["players"]}
        room["satranc_jokers"] = {}

        pick_mode = room.get("satranc_pick_mode", "karisik")
        pick_seconds = room.get("satranc_pick_seconds", 60)
        joker_count = room.get("satranc_joker_count", 3)

        import time as _time
        room["satranc_selection_deadline"] = _time.time() + pick_seconds

        # Karışık modda direkt rastgele dağıt
        if pick_mode == "karisik":
            time_mode_check = room.get("satranc_time_mode", "blitz")
            excluded_ids = []
            if time_mode_check == "suresiz":
                excluded_ids = ["zaman_cal", "zamani_durdur"]

            for pid in room["players"]:
                if excluded_ids:
                    # Filtreli havuzdan rastgele seç
                    available_jokers = [j for j in JOKERS if j["id"] not in excluded_ids]
                    random.shuffle(available_jokers)
                    room["satranc_jokers"][pid] = [j["id"] for j in available_jokers[:joker_count]]
                else:
                    random_jokers = get_random_jokers(joker_count)
                    room["satranc_jokers"][pid] = [j["id"] for j in random_jokers]
                room["satranc_selection_done"][pid] = True

        # Tüm oyunculara joker seçim mesajı
        # Her oyuncuya sadece kendi jokerleri gizli olarak gösterilir
        current_time_mode = room.get("satranc_time_mode", "blitz")
        for pid, pdata in room["players"].items():
            my_jokers = room["satranc_jokers"].get(pid, [])
            await safe_send(pdata["ws"], {
                "type": "satranc_joker_selection_start",
                "pick_mode": pick_mode,
                "joker_count": joker_count,
                "pick_seconds": pick_seconds,
                "time_mode": current_time_mode,
                "all_jokers": [get_public_joker_info(j["id"]) for j in JOKERS],
                "my_jokers": [get_public_joker_info(jid) for jid in my_jokers],
                "already_done": room["satranc_selection_done"].get(pid, False),
            })

        # Süre bitiş task'ı başlat (manuel modda önemli)
        if pick_mode == "manuel":
            selection_task = asyncio.create_task(
                _joker_selection_timeout(room, broadcast, safe_send, pick_seconds)
            )
            room["satranc_selection_task"] = selection_task
        else:
            # Karışık modda 3 saniye sonra oyuna başla (kullanıcı jokerleri görsün)
            await asyncio.sleep(0)  # yield
            start_task = asyncio.create_task(
                _delayed_game_start(room, broadcast, safe_send, delay=3)
            )
            room["satranc_selection_task"] = start_task

        print(f"[SATRANC] Joker seçim fazı: {room_code} | Mod={pick_mode} | Joker={joker_count}")
        return {"handled": True, "room_code": room_code, "player_id": player_id}

    # ----------------------------------------
    # JOKER SEÇ (Manuel mod - kart tıklama)
    # ----------------------------------------
    if msg_type == "satranc_select_joker":
        if not room_code or room_code not in rooms:
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        room = rooms[room_code]
        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if room.get("phase") != "joker_selection":
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        if room.get("satranc_pick_mode") != "manuel":
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        joker_id = data.get("joker_id", "")
        joker_info = get_joker_by_id(joker_id)
        if not joker_info:
            await safe_send(websocket, {"type": "error", "message": "Geçersiz joker."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ✨ Süresiz modda saat jokerleri seçilemez
        time_mode_check = room.get("satranc_time_mode", "blitz")
        if time_mode_check == "suresiz" and joker_id in ("zaman_cal", "zamani_durdur"):
            await safe_send(websocket, {
                "type": "error",
                "message": "Süresiz modda bu joker seçilemez."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        joker_count = room.get("satranc_joker_count", 3)
        current_slots = room["satranc_selected_slots"].get(player_id, [])

        # Zaten seçilmiş mi?
        if joker_id in current_slots:
            await safe_send(websocket, {"type": "error", "message": "Bu jokeri zaten seçtin."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # Slot dolu mu?
        if len(current_slots) >= joker_count:
            await safe_send(websocket, {"type": "error", "message": "Tüm slotlar dolu."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        current_slots.append(joker_id)
        room["satranc_selected_slots"][player_id] = current_slots

        # Bu oyuncuya güncel slotları gönder
        await safe_send(websocket, {
            "type": "satranc_joker_slot_update",
            "selected": [get_public_joker_info(jid) for jid in current_slots],
            "slots_full": len(current_slots) >= joker_count
        })

        # Karşıya da "rakip X seçti" bilgisi gönder (hangisi olduğunu gizle)
        for pid, pdata in room["players"].items():
            if pid != player_id:
                await safe_send(pdata["ws"], {
                    "type": "satranc_opponent_selecting",
                    "selected_count": len(current_slots),
                    "total_needed": joker_count,
                    "opponent_name": room["players"][player_id]["name"]
                })

        return {"handled": True, "room_code": room_code, "player_id": player_id}

    # ----------------------------------------
    # JOKER SLOT SİL (Manuel - X butonu)
    # ----------------------------------------
    if msg_type == "satranc_remove_joker":
        if not room_code or room_code not in rooms:
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        room = rooms[room_code]
        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if room.get("phase") != "joker_selection":
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        joker_id = data.get("joker_id", "")
        current_slots = room["satranc_selected_slots"].get(player_id, [])

        if joker_id in current_slots:
            current_slots.remove(joker_id)
            room["satranc_selected_slots"][player_id] = current_slots

            await safe_send(websocket, {
                "type": "satranc_joker_slot_update",
                "selected": [get_public_joker_info(jid) for jid in current_slots],
                "slots_full": False
            })

        return {"handled": True, "room_code": room_code, "player_id": player_id}

    # ----------------------------------------
    # JOKER SEÇİMİ ONAYLA (Manuel - Tamamdır)
    # ----------------------------------------
    if msg_type == "satranc_confirm_jokers":
        if not room_code or room_code not in rooms:
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        room = rooms[room_code]
        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if room.get("phase") != "joker_selection":
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        current_slots = room["satranc_selected_slots"].get(player_id, [])

        # ✨ Eksikse rastgele DOLDURMA - kullanıcı ne seçtiyse o kalır
        # Boş bile olabilir (0 joker)

        room["satranc_jokers"][player_id] = current_slots
        room["satranc_selection_done"][player_id] = True

        await safe_send(websocket, {
            "type": "satranc_your_jokers_ready",
            "my_jokers": [get_public_joker_info(jid) for jid in current_slots]
        })

        # Rakibi de bilgilendir
        for pid, pdata in room["players"].items():
            if pid != player_id:
                await safe_send(pdata["ws"], {
                    "type": "satranc_opponent_ready",
                    "opponent_name": room["players"][player_id]["name"]
                })

        # İkisi de bitti mi? Oyun başlasın
        if all(room["satranc_selection_done"].values()):
            selection_task = room.get("satranc_selection_task")
            if selection_task and not selection_task.done():
                selection_task.cancel()
            await _start_actual_game(room, broadcast, safe_send)

        return {"handled": True, "room_code": room_code, "player_id": player_id}

    # ----------------------------------------
    # HAMLEYİ İŞLE
    # ----------------------------------------
    if msg_type == "satranc_make_move":
        if not room_code or room_code not in rooms:
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        room = rooms[room_code]
        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if room.get("phase") != "playing":
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        board = room.get("satranc_game")
        if not board:
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # Sıra kontrolü
        white_pid = room.get("satranc_white")
        black_pid = room.get("satranc_black")
        expected_pid = white_pid if board.turn == chess.WHITE else black_pid

        if player_id != expected_pid:
            await safe_send(websocket, {"type": "error", "message": "Sıra sende değil!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        uci_move = data.get("move", "")
        promotion = data.get("promotion", "q")

        # Hamleyi uygula
        try:
            # UCI 4 karakter ise (h2h1) promosyon olabilir - piyon kontrolü yap
            if len(uci_move) == 4:
                try:
                    from_sq_tmp = chess.parse_square(uci_move[:2])
                    to_sq_tmp = chess.parse_square(uci_move[2:4])
                    piece_tmp = board.piece_at(from_sq_tmp)
                    if (piece_tmp and piece_tmp.piece_type == chess.PAWN and
                        chess.square_rank(to_sq_tmp) in (0, 7)):
                        # Promosyon - "q" ekle ki parse edebilsin
                        uci_move = uci_move + "q"
                except Exception:
                    pass

            move = chess.Move.from_uci(uci_move)

            # Piyon terfisi kontrolü
            moving_piece_check = board.piece_at(move.from_square)
            is_promotion_move = (moving_piece_check and
                moving_piece_check.piece_type == chess.PAWN and
                chess.square_rank(move.to_square) in (0, 7))

            if is_promotion_move:
                if not data.get("promotion_confirmed"):
                    # Yenilen taşları listele (bu oyuncunun yediği taşlar)
                    my_captured = room.get("satranc_captured_pieces", {}).get(player_id, [])
                    from_sq_name = chess.square_name(move.from_square)
                    to_sq_name = chess.square_name(move.to_square)

                    print(f"[SATRANC PROMO] Piyon {from_sq_name}->{to_sq_name} promosyon isteniyor. Yenilenler: {my_captured}")

                    await safe_send(websocket, {
                        "type": "satranc_promotion_needed",
                        "from": from_sq_name,
                        "to": to_sq_name,
                        "captured_pieces": my_captured,
                    })
                    room["satranc_pending_promotion"] = {
                        "pid": player_id,
                        "from": from_sq_name,
                        "to": to_sq_name,
                    }
                    return {"handled": True, "room_code": room_code, "player_id": player_id}

                # Promosyon onaylandı - seçilen taşı uygula
                promo_map = {"q": chess.QUEEN, "r": chess.ROOK, "b": chess.BISHOP, "n": chess.KNIGHT}
                chosen_promo = promo_map.get(promotion, chess.QUEEN)
                move = chess.Move(move.from_square, move.to_square, promotion=chosen_promo)
                room["satranc_pending_promotion"] = None

            if move not in board.legal_moves:
                print(f"[SATRANC HAMLE HATA] Legal değil: {uci_move}, board turn: {board.turn}, promo: {promotion}")
                await safe_send(websocket, {"type": "error", "message": "Geçersiz hamle!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ EFEKT KONTROLLERİ
            from_sq = chess.square_name(move.from_square)
            to_sq = chess.square_name(move.to_square)

            same_piece_double = room.get("satranc_same_piece_double", {})
            same_piece_state = same_piece_double.get(player_id)
            if same_piece_state and same_piece_state.get("required_from"):
                if from_sq != same_piece_state["required_from"]:
                    await safe_send(websocket, {
                        "type": "error",
                        "message": f"⚔️ Bu ekstra hamlede sadece {same_piece_state['required_from'].upper()} karesindeki aynı taşı oynatabilirsin."
                    })
                    return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ Eğer hareket eden taş görünmezse, bu hamle bilgisi rakibe sızmamalı
            invisible_owners_before_move = room.get("satranc_invisible_owners", {})
            moved_invisible_piece = invisible_owners_before_move.get(from_sq) == player_id

            # Kalkan kontrolü (Saldırı engelleme)
            shielded = room.get("satranc_shielded", {})
            target_piece = board.piece_at(move.to_square)
            
            # Hedef kalkanlıysa yeme yapılamaz
            if to_sq in shielded:
                await safe_send(websocket, {"type": "error", "message": "🛡️ Bu taş kalkanlı, yenilemez!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Dondurulmuş taş oynayamaz
            frozen = room.get("satranc_frozen", {})
            if from_sq in frozen:
                await safe_send(websocket, {
                    "type": "error",
                    "message": f"❄️ Bu taş donmuş! ({frozen[from_sq]} tur kaldı)"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Kalkanlı taş yenilemez, ama görünmez yenilebilir (sürpriz!)
            shielded = room.get("satranc_shielded", {})
            invisible = room.get("satranc_invisible", {})
            captured_piece = board.piece_at(move.to_square)
            captured_invisible_owner = None  # görünmez taş yenildiyse sahibi

            # ✨ Kalkanlı TAŞ HİÇBİR ŞEY YİYEMEZ
            if from_sq in shielded and captured_piece:
                await safe_send(websocket, {
                    "type": "error",
                    "message": f"🛡️ Kalkanlı taş saldıramaz! ({shielded[from_sq]} tur kalkanlı)"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            if captured_piece:  # Bir taş yenmiş
                if to_sq in shielded:
                    await safe_send(websocket, {
                        "type": "error",
                        "message": f"🛡️ Bu taş kalkanlı! ({shielded[to_sq]} tur kaldı)"
                    })
                    return {"handled": True, "room_code": room_code, "player_id": player_id}
                # ✨ Görünmez taş yenilebilir - sahibi kim, not al
                if to_sq in invisible:
                    inv_owners_check = room.get("satranc_invisible_owners", {})
                    captured_invisible_owner = inv_owners_check.get(to_sq)
                    print(f"[SATRANC] Görünmez taş yendi! Kare={to_sq}, sahibi pid={captured_invisible_owner}")

            # ✨ KİLİT KONTROLÜ (max 2 kare hareket)
            locked = room.get("satranc_locked", {})
            if from_sq in locked:
                dist = chebyshev_distance(from_sq, to_sq)
                if dist > 2:
                    await safe_send(websocket, {
                        "type": "error",
                        "message": f"⛓️ Bu taş kilitli! Max 2 kare gidebilir ({locked[from_sq]} tur kaldı)."
                    })
                    return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ HIZLI KAÇIŞ KONTROLÜ (şah 4 kareye kadar gidebilir)
            hizli_kacis = room.get("satranc_hizli_kacis", {})
            moving_piece = board.piece_at(move.from_square)
            is_king_move = moving_piece and moving_piece.piece_type == chess.KING
            
            if hizli_kacis.get(player_id) and is_king_move:
                # Legal move olmasa bile 4 kareye kadar boş kareye izin ver
                dist = chebyshev_distance(from_sq, to_sq)
                target_piece_at_dest = board.piece_at(move.to_square)
                if move not in board.legal_moves:
                    if dist <= 4 and (not target_piece_at_dest or target_piece_at_dest.color != moving_piece.color):
                        # Manuel şah hamlesi (kural dışı ama joker sayesinde)
                        # Hedef kareye rakip taş varsa yiyip yerleş, boşsa taşın
                        board.remove_piece_at(move.from_square)
                        if target_piece_at_dest:
                            board.remove_piece_at(move.to_square)
                        board.set_piece_at(move.to_square, moving_piece)
                        # Turn'ü manuel çevir
                        board.turn = not board.turn
                        san_move = f"K{to_sq}(HK)"
                        # Hızlı Kaçış efektini kaldır
                        hizli_kacis.pop(player_id, None)
                        # Efekt sayaç ve hamle sayacı manuel güncelle
                        room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
                        decrement_effect_counters(room)
                        # Efekt taşı
                        for effect_key in ["satranc_shielded", "satranc_frozen", "satranc_invisible", "satranc_locked"]:
                            effects = room.get(effect_key, {})
                            if from_sq in effects:
                                effects[to_sq] = effects.pop(from_sq)
                        # Board güncelle
                        board_state = board_to_dict(board)
                        # Sıra kime?
                        next_pid = black_pid if player_id == white_pid else white_pid
                        next_legal = get_legal_moves(board)
                        await broadcast(room, {
                            "type": "satranc_board_update",
                            "board": board_state,
                            "last_move": uci_move,
                            "san_move": san_move,
                            "mover_id": player_id,
                            "clocks": {str(p): room["satranc_clocks"].get(p, 0) for p in room["satranc_clocks"]},
                            "effects": get_effect_state(room),
                        })
                        next_ws = room["players"].get(next_pid, {}).get("ws")
                        if next_ws:
                            await safe_send(next_ws, {
                                "type": "satranc_your_turn",
                                "legal_moves": next_legal,
                                "is_check": board.is_check(),
                            })
                        return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Yenilen taşı kaydet (push'tan ÖNCE)
            if captured_piece and captured_piece.piece_type != chess.KING:
                captured_list = room["satranc_captured_pieces"].setdefault(player_id, [])
                piece_symbol = captured_piece.symbol().lower()  # 'q', 'r', 'b', 'n', 'p'
                piece_color_str = "w" if captured_piece.color == chess.WHITE else "b"
                captured_list.append({"type": piece_symbol, "color": piece_color_str})
                print(f"[SATRANC CAPTURED] pid={player_id} yedi: {piece_color_str}{piece_symbol}")

            # Hamleyi uygula
            san_move = board.san(move)
            board.push(move)

            # Hamle sayacı artır + efekt sayaçlarını azalt
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room)

            # ✨ Sansür sayacı azalt (hamle sahibi için)
            sansur_state = room.get("satranc_sansur", {})
            if sansur_state.get(player_id, 0) > 0:
                sansur_state[player_id] -= 1
                if sansur_state[player_id] <= 0:
                    del sansur_state[player_id]

            # ✨ Görünmez taş yenildiyse ÖNCE onun efekt kayıtlarını temizle
            if captured_invisible_owner is not None:
                # to_sq'daki eski görünmez efekti sil (o taş öldü)
                if to_sq in room.get("satranc_invisible", {}):
                    del room["satranc_invisible"][to_sq]
                if to_sq in room.get("satranc_invisible_owners", {}):
                    del room["satranc_invisible_owners"][to_sq]

            # Taşın taşındığı efektleri güncelle (kaynak → hedef)
            if captured_piece and to_sq in room.get("satranc_ajan_disguised", {}):
                del room["satranc_ajan_disguised"][to_sq]

            for effect_key in ["satranc_shielded", "satranc_frozen", "satranc_invisible", "satranc_locked", "satranc_ajan_disguised"]:
                effects = room.get(effect_key, {})
                if from_sq in effects:
                    val = effects.pop(from_sq)
                    effects[to_sq] = val
                    print(f"[SATRANC EFEKT TAŞIMA] {effect_key}: {from_sq} → {to_sq}")

            # ✨ Görünmez SAHİPLİK bilgisi de taşınsın
            inv_owners = room.get("satranc_invisible_owners", {})
            moved_was_invisible = False
            if from_sq in inv_owners:
                owner = inv_owners.pop(from_sq)
                inv_owners[to_sq] = owner
                moved_was_invisible = True
                print(f"[SATRANC INVISIBLE OWNER TAŞIMA] {from_sq} → {to_sq} (pid={owner})")

            # ✨ Görünmez taş oynadıysa SAYACINI 1 AZALT
            # Not: to_sq'daki invisible değeri yukarıdaki loop'ta from→to taşındı
            if moved_was_invisible:
                inv_dict = room.get("satranc_invisible", {})
                if to_sq in inv_dict:
                    inv_dict[to_sq] -= 1
                    print(f"[SATRANC INVISIBLE SAYAÇ] {to_sq}: {inv_dict[to_sq]} tur kaldı")
                    if inv_dict[to_sq] <= 0:
                        del inv_dict[to_sq]
                        if to_sq in inv_owners:
                            del inv_owners[to_sq]
                        print(f"[SATRANC INVISIBLE BİTTİ] {to_sq}")

            # ✨ Kalkanlı taş oynadıysa SAYACINI 1 AZALT
            sh_dict = room.get("satranc_shielded", {})
            if to_sq in sh_dict and from_sq != to_sq:
                # to_sq'ya taşındı (from_sq'daki kalkan yukarıdaki loop'ta taşındı)
                sh_dict[to_sq] -= 1
                print(f"[SATRANC SHIELDED SAYAÇ] {to_sq}: {sh_dict[to_sq]} tur kaldı")
                if sh_dict[to_sq] <= 0:
                    del sh_dict[to_sq]
                    print(f"[SATRANC SHIELDED BİTTİ] {to_sq}")

            # ✨ DONMUŞ TAŞLAR - hamle yapan oyuncuya AİT dondurulmuş taşlar (her hamlede -1)
            # Bu oyuncu hamle yaptı, kendi taşlarındaki dondurma sayacı düşsün
            my_color_chess = chess.WHITE if player_id == white_pid else chess.BLACK
            fr_dict = room.get("satranc_frozen", {})
            expired_frozen = []
            for fr_sq, fr_turns in list(fr_dict.items()):
                # Bu kare hamle yapan oyuncunun kendi taşı mı?
                fr_piece = board.piece_at(chess.parse_square(fr_sq))
                if fr_piece and fr_piece.color == my_color_chess:
                    fr_dict[fr_sq] -= 1
                    print(f"[SATRANC FROZEN SAYAÇ] {fr_sq}: {fr_dict[fr_sq]} tur kaldı")
                    if fr_dict[fr_sq] <= 0:
                        expired_frozen.append(fr_sq)
            for fr_sq in expired_frozen:
                del fr_dict[fr_sq]
                print(f"[SATRANC FROZEN BİTTİ] {fr_sq}")

            # ✨ AJAN SAYACI - SADECE ajan taşı hareket edince azalsın
            # Not: efekt yukarıda from_sq -> to_sq taşındı, yani to_sq'da ajan varsa hareket etmiş demektir
            ajan_dict = room.get("satranc_ajan_disguised", {})
            expired_ajan = []
            if to_sq in ajan_dict:
                aj_data = ajan_dict[to_sq]
                if isinstance(aj_data, dict) and "turns" in aj_data:
                    # Sadece ajan sahibi kendi taşını oynatınca azalt
                    if aj_data.get("owner") == player_id:
                        aj_data["turns"] -= 1
                        print(f"[SATRANC AJAN SAYAÇ] {to_sq}: {aj_data['turns']} tur kaldı")
                        if aj_data["turns"] <= 0:
                            expired_ajan.append(to_sq)
            for aj_sq in expired_ajan:
                del ajan_dict[aj_sq]
                print(f"[SATRANC AJAN BİTTİ] {aj_sq} artık normal renkte")

            # ✨ EKSTRA HAMLE KONTROLLERİ
            extra_move = room.get("satranc_extra_move", {})
            same_piece_double = room.get("satranc_same_piece_double", {})
            same_piece_state = same_piece_double.get(player_id)

            iki_hamle_2nd = False
            same_piece_forced_legal = None

            # 1) İki Hamle → sadece AYNI taşla 2. hamle
            if same_piece_state and same_piece_state.get("active"):
                required_from = same_piece_state.get("required_from")

                # İlk hamle yeni bitti
                if not required_from:
                    next_same_from = to_sq

                    # Legal hesap için gerçek board'u bozma, kopya üstünde bak
                    temp_board = board.copy(stack=False)
                    temp_board.turn = chess.WHITE if player_id == white_pid else chess.BLACK

                    candidate_legal = [
                        m.uci() for m in temp_board.legal_moves
                        if chess.square_name(m.from_square) == next_same_from
                    ]

                    if candidate_legal:
                        same_piece_state["required_from"] = next_same_from
                        same_piece_forced_legal = candidate_legal

                        # Gerçek board'da sıra tekrar aynı oyuncuda kalsın
                        board.turn = chess.WHITE if player_id == white_pid else chess.BLACK

                        san_move += " (+aynı taş)"
                        iki_hamle_2nd = True
                        print(f"[SATRANC IKI_HAMLE] pid={player_id} ilk={from_sq}->{to_sq} ikinci_legal={candidate_legal}")
                    else:
                        same_piece_double.pop(player_id, None)
                        san_move += " (aynı taşla devam hamlesi yok)"
                        print(f"[SATRANC IKI_HAMLE] pid={player_id} {next_same_from} için ikinci hamle yok")
                else:
                    # 2. hamle de yapıldı, efekt bitsin
                    same_piece_double.pop(player_id, None)
                    print(f"[SATRANC IKI_HAMLE] pid={player_id} ikinci hamle tamamlandı: {from_sq}->{to_sq}")

            # 2) Hakkını Bana Ver → normal ekstra hamle, taş fark etmez
            if not iki_hamle_2nd and extra_move.get(player_id):
                board.turn = not board.turn
                extra_move.pop(player_id, None)
                san_move += " (+1)"
                iki_hamle_2nd = True

            # ✨ Zamanı Durdur → tur gerçekten bittiyse saat tekrar aksın
            clock_frozen_turn = room.get("satranc_clock_frozen_turn", {})
            current_turn_pid_after_move = white_pid if board.turn == chess.WHITE else black_pid
            if clock_frozen_turn.get(player_id) and current_turn_pid_after_move != player_id:
                clock_frozen_turn.pop(player_id, None)

            # Increment ekle
            time_mode = room.get("satranc_time_mode", "blitz")
            tm = TIME_MODES.get(time_mode, TIME_MODES["blitz"])
            if tm["increment"] > 0 and time_mode != "suresiz":
                clocks = room.get("satranc_clocks", {})
                if player_id in clocks:
                    clocks[player_id] += tm["increment"]

        except Exception as e:
            print(f"[SATRANC HAMLE HATA] {e}")
            await safe_send(websocket, {"type": "error", "message": "Geçersiz hamle!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        board_state = board_to_dict(board)

        # Oyun bitti mi?
        if board.is_game_over():
            room["phase"] = "game_over"

            # Saati durdur
            clock_task = room.get("satranc_clock_task")
            if clock_task and not clock_task.done():
                clock_task.cancel()

            winner_id = None
            reason = "draw"

            if board.is_checkmate():
                # Hamleyi yapan kazandı
                winner_id = player_id
                loser_id = black_pid if player_id == white_pid else white_pid
                reason = "checkmate"
            elif board.is_stalemate():
                reason = "stalemate"
            elif board.is_insufficient_material():
                reason = "insufficient"
            elif board.is_seventyfive_moves():
                reason = "seventyfive"
            elif board.is_fivefold_repetition():
                reason = "fivefold"

            await broadcast(room, {
                "type": "satranc_game_over",
                "reason": reason,
                "winner_id": winner_id,
                "loser_id": loser_id if reason == "checkmate" else None,
                "winner_name": room["players"].get(winner_id, {}).get("name", "?") if winner_id else None,
                "board": board_state,
                "last_move": uci_move,
                "san_move": san_move,
                "message": _game_over_message(reason)
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # Sonraki oyuncunun legal hamleleri
        next_pid = black_pid if player_id == white_pid else white_pid
        next_legal = same_piece_forced_legal if same_piece_forced_legal is not None else get_legal_moves(board)

        clocks = room.get("satranc_clocks", {})

        # ✨ Her oyuncuya kendi görüşüne göre board gönder (Görünmez için)
        invisible_owners = room.get("satranc_invisible_owners", {})
        invisible_active = room.get("satranc_invisible", {})

        for pid, pdata in room["players"].items():
            # Rakibin aktif görünmez taşlarını bu oyuncudan gizle
            player_board = board.copy()
            for sq_name, owner_pid in invisible_owners.items():
                if owner_pid != pid and sq_name in invisible_active:
                    try:
                        player_board.remove_piece_at(chess.parse_square(sq_name))
                    except Exception:
                        pass

            # ✨ Rakibin ajan taşlarını sahte renkte göster (sadece bu oyuncudan gizle)
            ajan_all = room.get("satranc_ajan_disguised", {})
            for sq_name, aj_data in ajan_all.items():
                if isinstance(aj_data, dict) and aj_data.get("owner") != pid:
                    try:
                        sq_idx = chess.parse_square(sq_name)
                        real_piece = player_board.piece_at(sq_idx)
                        if real_piece:
                            fake_c = aj_data.get("color", "b")
                            fake_chess_c = chess.BLACK if fake_c == "b" else chess.WHITE
                            player_board.set_piece_at(sq_idx, chess.Piece(real_piece.piece_type, fake_chess_c))
                    except Exception:
                        pass

            player_board_state = board_to_dict(player_board)

            # ✨ Görünmez taş hareket ettiyse rakip hamlenin nereden/nereye olduğunu görmesin
            hide_move_info = moved_invisible_piece and pid != player_id
            player_last_move = None if hide_move_info else uci_move
            player_san_move = None if hide_move_info else san_move

            payload = {
                "type": "satranc_board_update",
                "board": player_board_state,
                "last_move": player_last_move,
                "san_move": player_san_move,
                "mover_id": player_id,
                "clocks": {str(p): clocks.get(p, 0) for p in clocks},
                "effects": get_effect_state_for_player(room, pid),
                "iki_hamle_active": iki_hamle_2nd,
                "captured_pieces": get_captured_pieces_payload(room),
            }
            # ✨ Görünmez taş yenildiyse frontend'e bildir (flash animasyonu için)
            if captured_invisible_owner is not None:
                payload["invisible_revealed_kill"] = {
                    "square": to_sq,
                    "owner_id": captured_invisible_owner,
                }
            await safe_send(pdata["ws"], payload)

        # ✨ Sıradaki oyuncu için "görünmez yeme kareleri" listesi
        # Sıradaki oyuncunun rakibinin görünmez kareleri, o karede sıradaki oyuncu hamlesi legal mi?
        def _get_invisible_capture_squares(for_pid, legal_uci_list):
            inv_owners_local = room.get("satranc_invisible_owners", {})
            inv_active_local = room.get("satranc_invisible", {})
            # Bu oyuncunun rakibinin görünmez kareleri
            enemy_invisible_squares = [
                sq for sq, owner_pid in inv_owners_local.items()
                if owner_pid != for_pid and sq in inv_active_local
            ]
            # Legal hamlelerden hedef karesi görünmez olanları bul
            capture_squares = []
            for uci in legal_uci_list:
                if len(uci) >= 4:
                    to_sq_uci = uci[2:4]
                    if to_sq_uci in enemy_invisible_squares and to_sq_uci not in capture_squares:
                        capture_squares.append(to_sq_uci)
            return capture_squares

        # ✨ İki Hamle aktifse: sıra hâlâ bende, kendi legal moves'umu ben alırım
        if iki_hamle_2nd:
            my_ws = room["players"].get(player_id, {}).get("ws")
            if my_ws:
                await safe_send(my_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": next_legal,
                    "is_check": board.is_check(),
                    "invisible_capture_squares": _get_invisible_capture_squares(player_id, next_legal),
                })
        else:
            next_ws = room["players"].get(next_pid, {}).get("ws")
            if next_ws:
                await safe_send(next_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": next_legal,
                    "is_check": board.is_check(),
                    "invisible_capture_squares": _get_invisible_capture_squares(next_pid, next_legal),
                })

        return {"handled": True, "room_code": room_code, "player_id": player_id}
        
    # ----------------------------------------
    # JOKER KULLAN
    # ----------------------------------------
    if msg_type == "satranc_use_joker":
        if not room_code or room_code not in rooms:
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        room = rooms[room_code]
        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if room.get("phase") != "playing":
            await safe_send(websocket, {"type": "error", "message": "Oyun aktif değil."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        joker_id = data.get("joker_id", "")
        joker_info = get_joker_by_id(joker_id)
        if not joker_info:
            await safe_send(websocket, {"type": "error", "message": "Geçersiz joker."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # Bu joker sahip miyim?
        my_jokers = room["satranc_jokers"].get(player_id, [])
        if joker_id not in my_jokers:
            await safe_send(websocket, {"type": "error", "message": "Bu jokere sahip değilsin."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # Kullanıldı mı?
        used = room["satranc_used_jokers"].setdefault(player_id, [])
        if joker_id in used:
            await safe_send(websocket, {"type": "error", "message": "Bu joker zaten kullanıldı."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # Implemented mi?
        if not joker_info.get("implemented"):
            await safe_send(websocket, {
                "type": "error",
                "message": f"'{joker_info['name']}' henüz aktif değil."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ✨ SANSÜR KONTROLÜ - eğer bende sansür varsa joker kullanamam
        sansur = room.get("satranc_sansur", {})
        if sansur.get(player_id, 0) > 0:
            await safe_send(websocket, {
                "type": "error",
                "message": f"⛔ Sansürlüsün! {sansur[player_id]} hamle daha joker kullanamazsın."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ✨ GENEL SIRA KONTROLÜ - sadece kendi sırasında joker kullanabilir
        board = room.get("satranc_game")
        white_pid = room.get("satranc_white")
        black_pid = room.get("satranc_black")
        opp_pid = black_pid if player_id == white_pid else white_pid
        if board:
            current_turn_pid = white_pid if board.turn == chess.WHITE else black_pid
            if current_turn_pid != player_id:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "⚠️ Sıra sende değil! Sadece kendi sıranda joker kullanabilirsin."
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

        yansima = room.get("satranc_yansima", {})
        yansima_active = yansima.get(opp_pid, False)

        # ==========================================
        # JOKER EFEKTLERİ
        # ==========================================

        # ⏰ ZAMAN ÇAL
        if joker_id == "zaman_cal":
            white_pid = room.get("satranc_white")
            black_pid = room.get("satranc_black")
            opp_pid = black_pid if player_id == white_pid else white_pid

            clocks = room.get("satranc_clocks", {})
            if opp_pid in clocks:
                # Süresiz modda çalışmaz
                time_mode = room.get("satranc_time_mode", "blitz")
                if time_mode == "suresiz":
                    await safe_send(websocket, {
                        "type": "error",
                        "message": "Süresiz modda Zaman Çal kullanılamaz!"
                    })
                    return {"handled": True, "room_code": room_code, "player_id": player_id}

                old_time = clocks[opp_pid]
                clocks[opp_pid] = max(1, clocks[opp_pid] - 30)
                stolen = old_time - clocks[opp_pid]

                # Kullanıldı olarak işaretle
                used.append(joker_id)

                # Herkese bildir
                await broadcast(room, {
                    "type": "satranc_joker_used",
                    "joker_id": joker_id,
                    "joker_name": joker_info["name"],
                    "joker_icon": joker_info["icon"],
                    "user_id": player_id,
                    "user_name": room["players"][player_id]["name"],
                    "target_id": opp_pid,
                    "target_name": room["players"][opp_pid]["name"],
                    "message": f"{room['players'][player_id]['name']} rakipten {stolen} saniye çaldı! ⏰",
                    "clocks": {str(p): clocks[p] for p in clocks},
                })

                print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Zaman Çal ({stolen}sn)")

                return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🔄 GERİ AL (YENİ MANTIK)
        # ==========================================
        if joker_id == "geri_al":
            # Zaten yukarıda "sıra sende değilse hata" kontrolü var
            # Yani buraya geldiysek sıra bendedir
            # Board'da son hamle rakibinki (çünkü sıra bana geçti)

            if len(board.move_stack) == 0:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "Geri Al: Henüz hamle yapılmadı."
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Son hamlenin RAKİBİN olduğunu kontrol et
            # move_stack'in son elemanı, henüz applied olan hamle
            # board.turn şu an bize dönmüş, demek ki son hamleyi rakip yapmış

            # ✨ Rakibin son hamlesi bizim taşımızı yediyse
            last_move = board.move_stack[-1]

            # board şu anki state, popla önceki state'e dönüyoruz
            # Ama önce: rakip beni yedi mi kontrol et
            # Bunu anlamak için: son hamlenin geldiği kareye bakıp,
            # push edilmeden önceki halde bizim taşımız var mıydı?

            # Basit yol: FEN karşılaştırma - son hamleden ÖNCE ve SONRA
            # captured piece check: SAN string'inde 'x' varsa yeme var
            temp_board = board.copy()
            temp_board.pop()  # bir öncesi
            captured_piece = temp_board.piece_at(last_move.to_square)

            my_color = chess.WHITE if player_id == white_pid else chess.BLACK

            if captured_piece and captured_piece.color == my_color:
                # Rakip beni yedi
                await safe_send(websocket, {
                    "type": "error",
                    "message": "❌ Taşınız yendi, geri alınamaz!"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Rakip yemedi → hem rakip hem ben (2 half-move) geri
            # Ama ben belki henüz oynamadım? Yani sadece rakip 1 hamle yaptı?
            # move_stack'te sadece 1 hamle varsa (rakip beyaz, sen siyah, rakip ilk hamle) → 1 geri
            # 2+ varsa → 2 geri (rakibin + senin son hamlen)

            undo_moves = []
            opp_pid_undo = black_pid if player_id == white_pid else white_pid

            # Son (rakibin) hamlesini geri al
            rakip_move = board.pop()
            rollback_captured_for_undo(room, board, rakip_move, opp_pid_undo)
            undo_moves.append(rakip_move.uci())

            # Eğer benim de önceden bir hamlem varsa, onu da geri al
            if len(board.move_stack) > 0:
                benim_move = board.pop()
                rollback_captured_for_undo(room, board, benim_move, player_id)
                undo_moves.append(benim_move.uci())

            used.append(joker_id)
            board_state = board_to_dict(board)
            legal_moves = get_legal_moves(board)

            # Sıra hâlâ bende olmalı (2 hamle geriye gittikse veya sadece rakibin ilk hamlesini geri aldıysak)
            # Ama board.turn otomatik değişti pop() ile
            # Doğal olarak: rakip yaptı → benim sıram, pop → yine benim sıram olabilir
            # Kontrol: eğer sıra hâlâ bende değilse (yani 2 hamle geri, artık rakibin sırası) → board.turn'ü çevir
            if (board.turn == chess.WHITE and player_id != white_pid) or \
               (board.turn == chess.BLACK and player_id != black_pid):
                # Sıra bende olmalıydı ama değil → çevir
                board.turn = not board.turn
                board_state = board_to_dict(board)
                legal_moves = get_legal_moves(board)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} son hamleleri geri aldı! 🔄 ({len(undo_moves)} hamle geri)",
                "board": board_state,
                "undo_moves": undo_moves,
                "undo_count": len(undo_moves),
                "effects": get_effect_state(room),
                "captured_pieces": get_captured_pieces_payload(room),
            })

            # Sıra bende, bana legal moves gönder
            my_ws = room["players"].get(player_id, {}).get("ws")
            if my_ws:
                await safe_send(my_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": legal_moves,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Geri Al ({len(undo_moves)} hamle)")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🔀 PAS VER
        # ==========================================
        if joker_id == "pas_ver":
            board = room.get("satranc_game")
            if not board:
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            white_pid = room.get("satranc_white")
            black_pid = room.get("satranc_black")
            current_turn_pid = white_pid if board.turn == chess.WHITE else black_pid

            # Sadece kendi sıramda pas verebilirim
            if current_turn_pid != player_id:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "Pas Ver: Sadece kendi sıranda kullanabilirsin."
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Board'un turn'ünü çevir (null move)
            # python-chess: board.push(chess.Move.null()) → geçersiz olabilir
            # Onun yerine board.turn'ü direkt değiştiriyoruz
            # Ama bu FEN'de tutarsız olabilir. Alternatif: null move push
            try:
                board.push(chess.Move.null())
            except Exception:
                # Null move desteklenmiyorsa manuel çevir
                board.turn = not board.turn

            used.append(joker_id)

            board_state = board_to_dict(board)
            legal_moves = get_legal_moves(board)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} sırasını pas verdi! 🔀 Rakip 2 kez oynayacak.",
                "board": board_state,
            })

            # Sıra rakibe geçti, ona legal moves gönder
            opp_pid = black_pid if player_id == white_pid else white_pid
            opp_ws = room["players"].get(opp_pid, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": legal_moves,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Pas Ver")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🎁 KARŞILIKLI EKSTRA JOKER
        # ==========================================
        if joker_id == "karsilikli_ekstra":
            white_pid = room.get("satranc_white")
            black_pid = room.get("satranc_black")

            new_jokers_for_me = None
            new_jokers_for_opp = None

            for pid in room["players"]:
                current = room["satranc_jokers"].get(pid, [])
                already_ids = set(current)
                # ✨ Önce Başla oyun içinde anlamsız - hariç tut
                # Süresiz modda saat jokerleri hariç
                time_mode_check = room.get("satranc_time_mode", "blitz")
                exclude_set = {"once_basla"}
                if time_mode_check == "suresiz":
                    exclude_set.update({"zaman_cal", "zamani_durdur"})

                available = [j for j in JOKERS
                             if j["id"] not in already_ids
                             and j["id"] not in exclude_set
                             and j.get("implemented", False)]
                if not available:
                    available = [j for j in JOKERS
                                 if j["id"] not in already_ids
                                 and j["id"] not in exclude_set]
                if available:
                    new_j = random.choice(available)
                    current.append(new_j["id"])
                    room["satranc_jokers"][pid] = current

                    # ✨ Bu joker "once_basla" gibi oyun içinde anlamsız olsaydı otomatik used yapardık
                    # Ama artık listeden çıkardık, yine de garanti olsun:
                    if new_j["id"] == "once_basla":
                        used_list = room["satranc_used_jokers"].setdefault(pid, [])
                        if "once_basla" not in used_list:
                            used_list.append("once_basla")

                    if pid == player_id:
                        new_jokers_for_me = new_j["id"]
                    else:
                        new_jokers_for_opp = new_j["id"]

            used.append(joker_id)

            # Kullananın kendisine: yeni joker bilgisi
            if new_jokers_for_me:
                await safe_send(websocket, {
                    "type": "satranc_new_joker_gained",
                    "new_joker": get_public_joker_info(new_jokers_for_me),
                    "message": f"🎁 Yeni joker kazandın: {get_public_joker_info(new_jokers_for_me)['name']}!"
                })

            # Rakibe: sadece +1 bildirimi (jokeri gizli)
            opp_pid = black_pid if player_id == white_pid else white_pid
            opp_ws = room["players"].get(opp_pid, {}).get("ws")
            if opp_ws and new_jokers_for_opp:
                opp_info = get_public_joker_info(new_jokers_for_opp)
                await safe_send(opp_ws, {
                    "type": "satranc_new_joker_gained",
                    "new_joker": opp_info,
                    "message": f"🎁 Rakip Karşılıklı Ekstra Joker kullandı, sen de yeni joker kazandın: {opp_info['name']}!"
                })

            # Herkese ekstra joker sayısı bildir
            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} Karşılıklı Ekstra Joker kullandı! 🎁 Herkese +1 joker.",
                "opp_joker_counts": {
                    str(pid): len(room["satranc_jokers"].get(pid, []))
                    for pid in room["players"]
                }
            })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Karşılıklı Ekstra Joker")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 👁️ JOKER GÖR
        # ==========================================
        if joker_id == "joker_gor":
            white_pid = room.get("satranc_white")
            black_pid = room.get("satranc_black")
            opp_pid = black_pid if player_id == white_pid else white_pid

            opp_jokers = room["satranc_jokers"].get(opp_pid, [])
            opp_used = room["satranc_used_jokers"].get(opp_pid, [])

            revealed = []
            for jid in opp_jokers:
                info = get_public_joker_info(jid)
                if info:
                    info["used"] = jid in opp_used
                    revealed.append(info)

            used.append(joker_id)

            # ✨ Popup YOK - sağ panelde kalıcı göster
            await safe_send(websocket, {
                "type": "satranc_reveal_opp_jokers_panel",
                "opponent_name": room["players"][opp_pid]["name"],
                "jokers": revealed,
            })

            # Rakibe bildirim
            opp_ws = room["players"].get(opp_pid, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_toast_only",
                    "title": "👁️ Joker Gör",
                    "message": f"{room['players'][player_id]['name']} jokerlerini gördü!",
                    "toast_type": "warning"
                })

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"👁️ {room['players'][player_id]['name']} rakibin jokerlerini gördü!",
            })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Joker Gör (panel)")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # ⚔️ İKİ HAMLE (AYNI TAŞLA)
        # ==========================================
        if joker_id == "iki_hamle":
            same_piece_double = room.setdefault("satranc_same_piece_double", {})
            same_piece_double[player_id] = {
                "active": True,
                "required_from": None
            }
            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"⚔️ {room['players'][player_id]['name']} İki Hamle kullandı! İlk hamleyi yaptıktan sonra sadece aynı taşla bir kez daha oynayabilir.",
                "effects": get_effect_state(room),
            })

            legal_moves = get_legal_moves(board)
            await safe_send(websocket, {
                "type": "satranc_your_turn",
                "legal_moves": legal_moves,
                "is_check": board.is_check(),
            })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → İki Hamle (aynı taşla)")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🌪️ HIZLI KAÇIŞ
        # ==========================================
        if joker_id == "hizli_kacis":
            board = room.get("satranc_game")
            white_pid = room.get("satranc_white")
            black_pid = room.get("satranc_black")
            current_turn_pid = white_pid if board.turn == chess.WHITE else black_pid

            if current_turn_pid != player_id:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "Hızlı Kaçış: Sadece kendi sıranda kullanabilirsin."
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            hk = room.setdefault("satranc_hizli_kacis", {})
            hk[player_id] = True
            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} Hızlı Kaçış aktif! 🌪️ Şah 4 kareye kadar hareket edebilir.",
            })
            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Hızlı Kaçış")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # ✋ HAKKINI BANA VER
        # ==========================================
        if joker_id == "zaman_durdur":
            extra_move = room.setdefault("satranc_extra_move", {})
            extra_move[player_id] = True
            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"✋ {room['players'][player_id]['name']} Hakkını Bana Ver kullandı! Bu turda 2 hamle yapacak, ikinci hamlede farklı taş oynatabilir.",
                "effects": get_effect_state(room),
            })

            legal_moves = get_legal_moves(board)
            await safe_send(websocket, {
                "type": "satranc_your_turn",
                "legal_moves": legal_moves,
                "is_check": board.is_check(),
            })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Hakkını Bana Ver")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🛑 ZAMANI DURDUR
        # ==========================================
        if joker_id == "zamani_durdur":
            clock_frozen_turn = room.setdefault("satranc_clock_frozen_turn", {})
            clock_frozen_turn[player_id] = True
            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"🛑 {room['players'][player_id]['name']} Zamanı Durdur kullandı! Bu tur boyunca saati akmayacak.",
                "effects": get_effect_state(room),
            })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Zamanı Durdur")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🎬 ÖNCE BAŞLA (oyun içinde manuel kullanılmaz - _start_actual_game'de otomatik)
        # ==========================================
        if joker_id == "once_basla":
            await safe_send(websocket, {
                "type": "error",
                "message": "🎬 Bu joker oyun başlarken otomatik kullanıldı."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🌀 YANSIMA (buffer - rakip joker kullanınca ona döner)
        # ==========================================
        if joker_id == "yansima":
            ya = room.setdefault("satranc_yansima", {})
            ya[player_id] = True
            used.append(joker_id)

            await safe_send(websocket, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"🌀 Yansıma kalkanın aktif! Rakibin sonraki jokeri ona yansıyacak.",
            })

            # Rakibe gizli uyarı
            opp_ws = room["players"].get(opp_pid, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_toast_only",
                    "title": "❓ Rakip bir joker aktive etti",
                    "message": "Bir sonraki jokerini dikkatli kullan...",
                    "toast_type": "warning"
                })

            await broadcast(room, {
                "type": "satranc_joker_used_silent",
                "joker_id": joker_id,
                "user_id": player_id,
            })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Yansıma (hazır)")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 💀 JOKER HIRSIZLIĞI
        # ==========================================
        if joker_id == "joker_hirsizligi":
            opp_jokers = room["satranc_jokers"].get(opp_pid, [])
            opp_used = room["satranc_used_jokers"].get(opp_pid, [])
            # Kullanılmamışlardan çal
            available = [j for j in opp_jokers if j not in opp_used and j != "joker_hirsizligi"]
            if not available:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "💀 Rakibin çalabileceğin bir jokeri yok."
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            stolen_id = random.choice(available)
            # Rakipten kaldır
            opp_jokers.remove(stolen_id)
            room["satranc_jokers"][opp_pid] = opp_jokers
            # Bana ekle
            my_jokers = room["satranc_jokers"].setdefault(player_id, [])
            my_jokers.append(stolen_id)

            used.append(joker_id)
            stolen_info = get_public_joker_info(stolen_id)

            # Bana bildir
            await safe_send(websocket, {
                "type": "satranc_new_joker_gained",
                "new_joker": stolen_info,
                "message": f"💀 Rakipten çaldın: {stolen_info['name']}!"
            })

            # Rakibe bildir
            opp_ws = room["players"].get(opp_pid, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_joker_stolen",
                    "stolen_joker": stolen_info,
                    "thief_name": room["players"][player_id]["name"],
                    "message": f"💀 {room['players'][player_id]['name']} '{stolen_info['name']}' jokerini çaldı!"
                })

            # Herkese joker sayısı güncelle
            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} Joker Hırsızlığı yaptı! 💀",
                "opp_joker_counts": {
                    str(pid): len(room["satranc_jokers"].get(pid, []))
                    for pid in room["players"]
                }
            })
            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Joker Hırsızlığı ({stolen_id})")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # ⛔ SANSÜR
        # ==========================================
        if joker_id == "sansur":
            board = room.get("satranc_game")
            current_turn_pid = white_pid if board.turn == chess.WHITE else black_pid
            if current_turn_pid != player_id:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "Sansür: Sadece kendi sıranda kullanabilirsin."
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            sansur_state = room.setdefault("satranc_sansur", {})
            sansur_state[opp_pid] = 6  # 3 tur = 6 half-move (rakibin 3 hamlesi boyunca)
            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"⛔ {room['players'][player_id]['name']} rakibi sansürledi! 3 tur joker kullanamayacak.",
            })
            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Sansür")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🎰 RULET (4 sonuçtan biri rastgele)
        # ==========================================
        if joker_id == "rulet":
            board = room.get("satranc_game")
            current_turn_pid = white_pid if board.turn == chess.WHITE else black_pid
            if current_turn_pid != player_id:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "Rulet: Sadece kendi sıranda kullanabilirsin."
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            outcomes = [
                {"type": "opp_lose_piece", "label": "🎯 Rakip rastgele taş kaybeder"},
                {"type": "self_lose_piece", "label": "💀 Sen rastgele taş kaybedersin"},
                {"type": "extra_turn", "label": "🔁 Sıra tekrar sende"},
                {"type": "skip_opp", "label": "⏭️ Rakip sırası atlanır"},
            ]
            outcome = random.choice(outcomes)
            used.append(joker_id)

            # Efekti uygula
            result_msg = ""

            if outcome["type"] == "opp_lose_piece":
                # Rakibin rastgele taşını sil (şah hariç)
                opp_pieces = []
                for sq in chess.SQUARES:
                    p = board.piece_at(sq)
                    if p and p.color != (chess.WHITE if player_id == white_pid else chess.BLACK):
                        if p.piece_type != chess.KING:
                            opp_pieces.append(sq)
                if opp_pieces:
                    victim = random.choice(opp_pieces)
                    victim_name = chess.square_name(victim)
                    victim_piece = board.piece_at(victim)
                    board.remove_piece_at(victim)
                    result_msg = f"🎯 Rakibin taşı silindi: {victim_name}"
                else:
                    result_msg = "🎯 Rakibin silinecek taşı yok!"

            elif outcome["type"] == "self_lose_piece":
                my_pieces = []
                for sq in chess.SQUARES:
                    p = board.piece_at(sq)
                    if p and p.color == (chess.WHITE if player_id == white_pid else chess.BLACK):
                        if p.piece_type != chess.KING:
                            my_pieces.append(sq)
                if my_pieces:
                    victim = random.choice(my_pieces)
                    victim_name = chess.square_name(victim)
                    board.remove_piece_at(victim)
                    result_msg = f"💀 Senin taşın silindi: {victim_name}"
                else:
                    result_msg = "💀 Silinecek taşın yok!"

            elif outcome["type"] == "extra_turn":
                em = room.setdefault("satranc_extra_move", {})
                em[player_id] = True
                result_msg = "🔁 Bu turda 2 hamle yapacaksın!"

            elif outcome["type"] == "skip_opp":
                # Rakip sırası atla: turn'ü çevir
                try:
                    board.push(chess.Move.null())
                except Exception:
                    board.turn = not board.turn
                result_msg = "⏭️ Rakip sırası atlandı, tekrar sen oynuyorsun!"

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"🎰 {room['players'][player_id]['name']} Rulet çevirdi: {outcome['label']}",
                "rulet_outcome": outcome["type"],
                "rulet_label": outcome["label"],
                "rulet_result": result_msg,
                "board": board_to_dict(board),
                "effects": get_effect_state(room),
            })
            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Rulet ({outcome['type']})")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🎡 ÇARKIFELEK
        # ==========================================
        if joker_id == "carkifelek":
            board = room.get("satranc_game")
            current_turn_pid = white_pid if board.turn == chess.WHITE else black_pid
            if current_turn_pid != player_id:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "Çarkıfelek: Sadece kendi sıranda kullanabilirsin."
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Rastgele dilim seç
            dilim = random.choice(CARKIFELEK_DILIMLER)
            used.append(joker_id)

            # Önce animasyon bildir (herkes çarkı görsün)
            await broadcast(room, {
                "type": "satranc_carkifelek_spin",
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "dilim_id": dilim["id"],
                "dilim_icon": dilim["icon"],
                "dilim_label": dilim["label"],
                "dilim_color": dilim["color"],
                "all_dilimler": CARKIFELEK_DILIMLER,
            })

            # 3 saniye bekle (animasyon süresi)
            await asyncio.sleep(3.5)

            # Şimdi efekti uygula
            result = await _apply_carkifelek_dilim(
                room, player_id, dilim["id"], broadcast, safe_send
            )

            # Herkese sonucu bildir
            broadcast_data = {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"🎡 Çarkıfelek: {dilim['icon']} {dilim['label']} - {result['result_msg']}",
                "effects": get_effect_state(room),
                "opp_joker_counts": {
                    str(pid): len(room["satranc_jokers"].get(pid, []))
                    for pid in room["players"]
                }
            }
            if result["board_changed"]:
                broadcast_data["board"] = board_to_dict(board)

            # Saat güncellendiyse
            clocks = room.get("satranc_clocks", {})
            if clocks:
                broadcast_data["clocks"] = {str(p): clocks[p] for p in clocks}

            await broadcast(room, broadcast_data)

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Çarkıfelek ({dilim['id']})")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # Bilinmeyen implemented joker
        await safe_send(websocket, {
            "type": "error",
            "message": "Bu joker için efekt bulunamadı."
        })
        return {"handled": True, "room_code": room_code, "player_id": player_id}  

    # ----------------------------------------
    # HEDEFLİ JOKER KULLAN (kare seçimli)
    # ----------------------------------------
    if msg_type == "satranc_use_joker_target":
        if not room_code or room_code not in rooms:
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        room = rooms[room_code]
        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if room.get("phase") != "playing":
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        joker_id = data.get("joker_id", "")
        target1 = data.get("target1", "")  # örn "e4"
        target2 = data.get("target2", "")  # opsiyonel (Işınlanma, Klon)

        joker_info = get_joker_by_id(joker_id)
        if not joker_info:
            await safe_send(websocket, {"type": "error", "message": "Geçersiz joker."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        my_jokers = room["satranc_jokers"].get(player_id, [])
        if joker_id not in my_jokers:
            await safe_send(websocket, {"type": "error", "message": "Bu jokere sahip değilsin."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        used = room["satranc_used_jokers"].setdefault(player_id, [])
        if joker_id in used:
            await safe_send(websocket, {"type": "error", "message": "Bu joker zaten kullanıldı."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ✨ SANSÜR KONTROLÜ
        sansur = room.get("satranc_sansur", {})
        if sansur.get(player_id, 0) > 0:
            await safe_send(websocket, {
                "type": "error",
                "message": f"⛔ Sansürlüsün! {sansur[player_id]} hamle daha joker kullanamazsın."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        board = room.get("satranc_game")
        if not board:
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ✨ GENEL SIRA KONTROLÜ
        white_pid_check = room.get("satranc_white")
        black_pid_check = room.get("satranc_black")
        current_turn_pid = white_pid_check if board.turn == chess.WHITE else black_pid_check
        if current_turn_pid != player_id:
            await safe_send(websocket, {
                "type": "error",
                "message": "⚠️ Sıra sende değil! Sadece kendi sıranda joker kullanabilirsin."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        white_pid = room.get("satranc_white")
        black_pid = room.get("satranc_black")
        my_color = chess.WHITE if player_id == white_pid else chess.BLACK

        # Hedef kareyi parse et
        try:
            target1_sq = chess.parse_square(target1)
        except Exception:
            await safe_send(websocket, {"type": "error", "message": "Geçersiz kare."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        target1_piece = board.piece_at(target1_sq)

        # ==========================================
        # 👑 VEZİRE YÜKSELT - HAMLE SAYILIR
        # ==========================================
        if joker_id == "vezire_yukselt":
            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Boş kare seçtin."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color != my_color:
                await safe_send(websocket, {"type": "error", "message": "Kendi piyonunu seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.piece_type != chess.PAWN:
                await safe_send(websocket, {"type": "error", "message": "Sadece piyon vezire yükseltilir!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            board.set_piece_at(target1_sq, chess.Piece(chess.QUEEN, my_color))
            used.append(joker_id)

            opp_pid_v = black_pid if player_id == white_pid else white_pid

            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room)

            board_state = board_to_dict(board)
            next_legal = get_legal_moves(board)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} piyonunu vezire yükseltti! 👑 ({target1}) - Sıra rakipte.",
                "board": board_state,
                "target": target1,
                "transform_to": "q",
                "transform_label": "Vezir",
                "transform_icon": "♛",
                "effects": get_effect_state(room),
            })

            opp_ws = room["players"].get(opp_pid_v, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": next_legal,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Vezire Yükselt ({target1}) - sıra rakibe")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🛡️ KALKAN
        # ==========================================
        if joker_id == "kalkan":
            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Boş kare seçtin."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color != my_color:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            shielded = room.setdefault("satranc_shielded", {})
            shielded[target1] = 4  # 4 tur (sadece o taş oynadığında düşer)
            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} taşına kalkan verdi! 🛡️ ({target1})",
                "target": target1,
                "effects": get_effect_state(room),
            })
            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Kalkan ({target1})")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🧊 DONDUR
        # ==========================================
        if joker_id == "dondur":
            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Boş kare seçtin."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color == my_color:
                await safe_send(websocket, {"type": "error", "message": "Rakip taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.piece_type == chess.KING:
                await safe_send(websocket, {"type": "error", "message": "Şahı donduramazsın!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            frozen = room.setdefault("satranc_frozen", {})
            frozen[target1] = 2  # 2 tur (rakip başka taşla oynayınca -1)
            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} rakip taşını dondurdu! 🧊 ({target1})",
                "target": target1,
                "effects": get_effect_state(room),
            })
            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Dondur ({target1})")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🔮 IŞINLANMA (target1 = kendi taş, target2 = boş kare)
        # ==========================================
        if joker_id == "isinlan":
            if not target2:
                await safe_send(websocket, {"type": "error", "message": "Işınlanma için hedef kare gerekli."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            try:
                target2_sq = chess.parse_square(target2)
            except Exception:
                await safe_send(websocket, {"type": "error", "message": "Geçersiz hedef kare."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Işınlanacak taş seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color != my_color:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            target2_piece = board.piece_at(target2_sq)
            if target2_piece:
                await safe_send(websocket, {"type": "error", "message": "Hedef kare boş olmalı!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Taşı taşı
            piece_to_move = target1_piece
            board.remove_piece_at(target1_sq)
            board.set_piece_at(target2_sq, piece_to_move)

            # Efektleri taşı
            for effect_key in ["satranc_shielded", "satranc_frozen", "satranc_invisible"]:
                effects = room.get(effect_key, {})
                if target1 in effects:
                    effects[target2] = effects.pop(target1)

            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} taşını ışınladı! 🔮 ({target1} → {target2})",
                "board": board_to_dict(board),
                "effects": get_effect_state(room),
            })
            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Işınlanma ({target1} → {target2})")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 💣 BOMBA (target1 = SADECE o taş patlar) - HAMLE SAYILIR
        # ==========================================
        if joker_id == "bomba":
            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Bomba yerleştirilecek taş seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.piece_type == chess.KING:
                await safe_send(websocket, {"type": "error", "message": "Şahı bombalayamazsın!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Taş bilgisi
            piece_names = {
                chess.PAWN: "Piyon", chess.ROOK: "Kale", chess.KNIGHT: "At",
                chess.BISHOP: "Fil", chess.QUEEN: "Vezir", chess.KING: "Şah"
            }
            piece_name = piece_names.get(target1_piece.piece_type, "Taş")
            piece_color = "beyaz" if target1_piece.color == chess.WHITE else "siyah"

            # ✨ SADECE hedef taşı patlat
            board.remove_piece_at(target1_sq)

            # Efektleri sil
            for effect_key in ["satranc_shielded", "satranc_frozen", "satranc_invisible", "satranc_locked"]:
                effects = room.get(effect_key, {})
                if target1 in effects:
                    del effects[target1]

            used.append(joker_id)

            # ✨ Rakip pid hesapla (target handler'da yok, burada bulalım)
            white_pid_b = room.get("satranc_white")
            black_pid_b = room.get("satranc_black")
            opp_pid_b = black_pid_b if player_id == white_pid_b else white_pid_b

            # ✨ Sırayı rakibe geçir (Bomba hamle sayılır)
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room)

            board_state = board_to_dict(board)
            next_legal = get_legal_moves(board)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} BOMBA! 💣 {piece_color} {piece_name} patladı ({target1})! Sıra rakipte.",
                "board": board_state,
                "exploded": [target1],
                "explosion_square": target1,
                "effects": get_effect_state(room),
            })

            # ✨ Sıra rakipte, ona legal moves gönder
            opp_ws = room["players"].get(opp_pid_b, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": next_legal,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Bomba ({target1} = {piece_name}) - sıra rakibe")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🎭 KLON (target1 = kendi taş, target2 = komşu boş kare)
        # ==========================================
        if joker_id == "klon":
            if not target2:
                await safe_send(websocket, {"type": "error", "message": "Klonlanacak boş kare seç."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            try:
                target2_sq = chess.parse_square(target2)
            except Exception:
                await safe_send(websocket, {"type": "error", "message": "Geçersiz kare."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color != my_color:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.piece_type == chess.KING:
                await safe_send(websocket, {"type": "error", "message": "Şahı klonlayamazsın!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Komşu mu?
            neighbors = square_neighbors(target1)
            if target2 not in neighbors:
                await safe_send(websocket, {"type": "error", "message": "Klon hedefi komşu bir kare olmalı!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            if board.piece_at(target2_sq):
                await safe_send(websocket, {"type": "error", "message": "Hedef kare boş olmalı!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Klonla
            board.set_piece_at(target2_sq, chess.Piece(target1_piece.piece_type, my_color))
            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} taşını klonladı! 🎭 ({target1} → {target2})",
                "board": board_to_dict(board),
                "effects": get_effect_state(room),
            })
            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Klon ({target1} → {target2})")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🧙 GÖRÜNMEZ (5 tur, rakipten tamamen gizli)
        # ==========================================
        if joker_id == "gorunmez":
            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color != my_color:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ Rakip pid hesapla
            white_pid_g = room.get("satranc_white")
            black_pid_g = room.get("satranc_black")
            opp_pid = black_pid_g if player_id == white_pid_g else white_pid_g

            invisible = room.setdefault("satranc_invisible", {})
            invisible[target1] = 5  # ✨ 5 tur (her hamlede -1)
            # ✨ Kimin görünmez taşı olduğunu da sakla (rakipten gizlemek için)
            invisible_owners = room.setdefault("satranc_invisible_owners", {})
            invisible_owners[target1] = player_id
            used.append(joker_id)

            # ✨ Sahibi olan oyuncuya normal bildirim (kendi görüyor)
            my_ws = room["players"].get(player_id, {}).get("ws")
            if my_ws:
                await safe_send(my_ws, {
                    "type": "satranc_joker_used",
                    "joker_id": joker_id,
                    "joker_name": joker_info["name"],
                    "joker_icon": joker_info["icon"],
                    "user_id": player_id,
                    "user_name": room["players"][player_id]["name"],
                    "message": f"🧙 Taşını görünmez yaptın! ({target1}) - 5 tur sürecek",
                    "target": target1,
                    "invisible_turns": 5,
                    "effects": get_effect_state_for_player(room, player_id),
                })

            # ✨ Rakibe özel: taşı FEN'den sil (görmesin)
            opp_ws = room["players"].get(opp_pid, {}).get("ws")
            if opp_ws:
                # Rakip için özel FEN oluştur
                opp_board = board.copy()
                for sq_name, owner_pid in invisible_owners.items():
                    if owner_pid == player_id:  # Rakibin görmemesi gereken
                        try:
                            opp_board.remove_piece_at(chess.parse_square(sq_name))
                        except Exception:
                            pass
                opp_board_state = board_to_dict(opp_board)

                await safe_send(opp_ws, {
                    "type": "satranc_joker_used",
                    "joker_id": joker_id,
                    "joker_name": joker_info["name"],
                    "joker_icon": joker_info["icon"],
                    "user_id": player_id,
                    "user_name": room["players"][player_id]["name"],
                    "message": f"🧙 {room['players'][player_id]['name']} bir taşını görünmez yaptı! 5 tur sürecek.",
                    "board": opp_board_state,
                    "effects": get_effect_state_for_player(room, opp_pid),
                    "invisible_hidden_from_you": True,
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Görünmez ({target1}) - 5 tur")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🃏 TAŞ DÖNÜŞTÜR - HAMLE SAYILIR
        # ==========================================
        if joker_id == "tas_donustur":
            new_type = data.get("piece_type", "q")
            type_map = {"q": chess.QUEEN, "r": chess.ROOK, "b": chess.BISHOP, "n": chess.KNIGHT, "p": chess.PAWN}
            if new_type not in type_map:
                await safe_send(websocket, {"type": "error", "message": "Geçersiz taş türü."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color != my_color:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.piece_type == chess.KING:
                await safe_send(websocket, {"type": "error", "message": "Şahı dönüştüremezsin!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            board.set_piece_at(target1_sq, chess.Piece(type_map[new_type], my_color))
            used.append(joker_id)

            type_names = {"q": "Vezir", "r": "Kale", "b": "Fil", "n": "At", "p": "Piyon"}
            type_icons = {"q": "♛", "r": "♜", "b": "♝", "n": "♞", "p": "♟"}

            opp_pid_t = black_pid if player_id == white_pid else white_pid

            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room)

            board_state = board_to_dict(board)
            next_legal = get_legal_moves(board)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} taşını {type_names[new_type]}'e dönüştürdü! 🃏 ({target1}) - Sıra rakipte.",
                "board": board_state,
                "target": target1,
                "transform_to": new_type,
                "transform_label": type_names[new_type],
                "transform_icon": type_icons[new_type],
                "effects": get_effect_state(room),
            })

            opp_ws = room["players"].get(opp_pid_t, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": next_legal,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Taş Dönüştür ({target1} → {new_type}) - sıra rakibe")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🎯 RAKİP TAŞ YERLEŞTİR - HAMLE SAYILIR
        # ==========================================
        if joker_id == "rakip_tas_yerlestir":
            if not target2:
                await safe_send(websocket, {"type": "error", "message": "Hedef kare gerekli."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            try:
                target2_sq = chess.parse_square(target2)
            except Exception:
                await safe_send(websocket, {"type": "error", "message": "Geçersiz kare."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Rakip taşı seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color == my_color:
                await safe_send(websocket, {"type": "error", "message": "Rakip taşı seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.piece_type == chess.KING:
                await safe_send(websocket, {"type": "error", "message": "Şahı taşıyamazsın!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            if board.piece_at(target2_sq):
                await safe_send(websocket, {"type": "error", "message": "Hedef kare boş olmalı!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            piece_to_move = target1_piece
            board.remove_piece_at(target1_sq)
            board.set_piece_at(target2_sq, piece_to_move)

            for effect_key in ["satranc_shielded", "satranc_frozen", "satranc_invisible", "satranc_locked"]:
                effects = room.get(effect_key, {})
                if target1 in effects:
                    effects[target2] = effects.pop(target1)

            used.append(joker_id)

            opp_pid_r = black_pid if player_id == white_pid else white_pid

            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room)

            board_state = board_to_dict(board)
            next_legal = get_legal_moves(board)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} rakip taşı yerini değiştirdi! 🎯 ({target1} → {target2}) - Sıra rakipte.",
                "board": board_state,
                "effects": get_effect_state(room),
            })

            opp_ws = room["players"].get(opp_pid_r, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": next_legal,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Rakip Taş Yerleştir ({target1} → {target2}) - sıra rakibe")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🌀 YER DEĞİŞTİR (target1 = kendi taş, target2 = kendi taş)
        # ==========================================
        if joker_id == "yer_degistir":
            if not target2:
                await safe_send(websocket, {"type": "error", "message": "2. taş gerekli."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            try:
                target2_sq = chess.parse_square(target2)
            except Exception:
                await safe_send(websocket, {"type": "error", "message": "Geçersiz kare."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            target2_piece = board.piece_at(target2_sq)
            if not target1_piece or not target2_piece:
                await safe_send(websocket, {"type": "error", "message": "İki taş da seçmelisin!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color != my_color or target2_piece.color != my_color:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşlarını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1 == target2:
                await safe_send(websocket, {"type": "error", "message": "Farklı 2 taş seçmelisin."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Değiştir
            board.remove_piece_at(target1_sq)
            board.remove_piece_at(target2_sq)
            board.set_piece_at(target1_sq, target2_piece)
            board.set_piece_at(target2_sq, target1_piece)

            # Efektleri de değiştir
            for effect_key in ["satranc_shielded", "satranc_frozen", "satranc_invisible", "satranc_locked"]:
                effects = room.get(effect_key, {})
                v1 = effects.pop(target1, None)
                v2 = effects.pop(target2, None)
                if v1 is not None:
                    effects[target2] = v1
                if v2 is not None:
                    effects[target1] = v2

            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} taşlarının yerini değiştirdi! 🌀 ({target1} ↔ {target2})",
                "board": board_to_dict(board),
                "effects": get_effect_state(room),
            })
            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Yer Değiştir ({target1} ↔ {target2})")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # ⛓️ KİLİTLE (target1 = rakip taş)
        # ==========================================
        if joker_id == "kilitle":
            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Rakip taşı seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color == my_color:
                await safe_send(websocket, {"type": "error", "message": "Rakip taşı seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.piece_type == chess.KING:
                await safe_send(websocket, {"type": "error", "message": "Şahı kilitleyemezsin!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            locked = room.setdefault("satranc_locked", {})
            locked[target1] = 6  # 3 tur = 6 half-move
            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} rakip taşını kilitledi! ⛓️ 3 tur max 2 kare gidebilir.",
                "target": target1,
                "effects": get_effect_state(room),
            })
            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Kilitle ({target1})")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🕵️ AJAN (kendi taşını seç → görsel olarak rakip rengine döner, kontrol sende)
        # ==========================================
        if joker_id == "ajan":
            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color != my_color:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.piece_type == chess.KING:
                await safe_send(websocket, {"type": "error", "message": "Şahı ajan yapamazsın!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Gerçek renk DEĞIŞMEZ - sadece görsel kayıt + 6 tur limit
            ajan_disguised = room.setdefault("satranc_ajan_disguised", {})
            fake_color = "b" if my_color == chess.WHITE else "w"
            ajan_disguised[target1] = {"color": fake_color, "turns": 6, "owner": player_id}
            used.append(joker_id)

            white_pid_a = room.get("satranc_white")
            black_pid_a = room.get("satranc_black")
            opp_pid_a = black_pid_a if player_id == white_pid_a else white_pid_a

            # Sırayı rakibe geçir
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room)

            board_state = board_to_dict(board)
            next_legal = get_legal_moves(board)

            piece_names = {
                chess.PAWN: "Piyon", chess.ROOK: "Kale", chess.KNIGHT: "At",
                chess.BISHOP: "Fil", chess.QUEEN: "Vezir", chess.KING: "Şah"
            }
            piece_name = piece_names.get(target1_piece.piece_type, "Taş")

            # Sahibine: gerçek board + ajan bilgisi + sahte renk
            my_ws = room["players"].get(player_id, {}).get("ws")
            if my_ws:
                await safe_send(my_ws, {
                    "type": "satranc_joker_used",
                    "joker_id": joker_id,
                    "joker_name": joker_info["name"],
                    "joker_icon": joker_info["icon"],
                    "user_id": player_id,
                    "user_name": room["players"][player_id]["name"],
                    "message": f"🕵️ {piece_name}'ini ajan yaptın! ({target1}) - 6 tur boyunca rakibe siyah taş gibi görünecek.",
                    "board": board_state,
                    "target": target1,
                    "ajan_fake_color": fake_color,
                    "ajan_turns": 6,
                    "effects": get_effect_state_for_player(room, player_id),
                })

            # Rakibe: FEN'de o kareyi sahte renkte taşla değiştir
            opp_ws = room["players"].get(opp_pid_a, {}).get("ws")
            if opp_ws:
                fake_board = board.copy()
                fake_chess_color = chess.BLACK if fake_color == "b" else chess.WHITE
                fake_board.set_piece_at(target1_sq, chess.Piece(target1_piece.piece_type, fake_chess_color))
                opp_board_state = board_to_dict(fake_board)

                await safe_send(opp_ws, {
                    "type": "satranc_joker_used",
                    "joker_id": joker_id,
                    "joker_name": joker_info["name"],
                    "joker_icon": joker_info["icon"],
                    "user_id": player_id,
                    "user_name": room["players"][player_id]["name"],
                    "message": f"{room['players'][player_id]['name']} bir joker kullandı.",
                    "board": opp_board_state,
                    "effects": get_effect_state_for_player(room, opp_pid_a),
                })
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": next_legal,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Ajan ({target1}) sahte={fake_color} - sıra rakibe")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # Bilinmeyen
        await safe_send(websocket, {"type": "error", "message": "Bu hedefli joker için efekt yok."})
        return {"handled": True, "room_code": room_code, "player_id": player_id}     

    # ----------------------------------------
    # LOBİYE DÖN (ESC → Lobiye Dön)
    # ----------------------------------------
    if msg_type == "satranc_back_to_lobby":
        if not room_code or room_code not in rooms:
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        room = rooms[room_code]
        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host lobiye dönebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # Task'ları iptal et
        for task_key in ["satranc_task", "satranc_clock_task", "satranc_selection_task"]:
            t = room.get(task_key)
            if t and not t.done():
                t.cancel()
            room[task_key] = None

        # Oyun state'ini sıfırla
        room["phase"] = "lobby"
        room["satranc_game"] = None
        room["satranc_turn"] = None
        room["satranc_white"] = None
        room["satranc_black"] = None
        room["satranc_jokers"] = {}
        room["satranc_used_jokers"] = {}
        room["satranc_clocks"] = {}
        room["satranc_ajan_disguised"] = {}
        room["satranc_captured_pieces"] = {}
        room["satranc_pending_promotion"] = None
        room["satranc_shielded"] = {}
        room["satranc_frozen"] = {}
        room["satranc_invisible"] = {}
        room["satranc_locked"] = {}
        room["satranc_ajan_disguised"] = {}
        room["satranc_captured_pieces"] = {}
        room["satranc_pending_promotion"] = None
        room["satranc_extra_move"] = {}
        room["satranc_same_piece_double"] = {}
        room["satranc_hizli_kacis"] = {}
        room["satranc_clock_frozen_turn"] = {}
        room["satranc_yansima"] = {}
        room["satranc_sansur"] = {}
        room["satranc_selected_slots"] = {}
        room["satranc_selection_done"] = {}

        # Herkese lobiye dön mesajı
        await broadcast(room, {
            "type": "satranc_back_to_lobby_broadcast",
            "message": "Host oyunu sonlandırdı, lobiye dönüldü."
        })

        # Lobby update
        await send_jokerli_satranc_lobby_update(room, broadcast)

        print(f"[SATRANC] Host lobiye döndü: {room_code}")
        return {"handled": True, "room_code": room_code, "player_id": player_id}    

    # ----------------------------------------
    # İSTİFA ET
    # ----------------------------------------
    if msg_type == "satranc_resign":
        if not room_code or room_code not in rooms:
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        room = rooms[room_code]
        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if room.get("phase") != "playing":
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        white_pid = room.get("satranc_white")
        black_pid = room.get("satranc_black")
        winner_id = black_pid if player_id == white_pid else white_pid
        loser_id = player_id

        room["phase"] = "game_over"

        clock_task = room.get("satranc_clock_task")
        if clock_task and not clock_task.done():
            clock_task.cancel()

        print(f"[SATRANC] İstifa: {room['players'][player_id]['name']} ({room_code})")

        await broadcast(room, {
            "type": "satranc_game_over",
            "reason": "resign",
            "winner_id": winner_id,
            "loser_id": loser_id,
            "winner_name": room["players"].get(winner_id, {}).get("name", "?"),
            "loser_name": room["players"].get(loser_id, {}).get("name", "?"),
            "message": f"{room['players'][loser_id]['name']} istifa etti."
        })
        return {"handled": True, "room_code": room_code, "player_id": player_id}

    # ----------------------------------------
    # REMATCH
    # ----------------------------------------
    if msg_type == "satranc_rematch":
        if not room_code or room_code not in rooms:
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        room = rooms[room_code]
        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if player_id != 1:
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # Sıfırla
        room["phase"] = "lobby"
        room["satranc_game"] = None
        room["satranc_turn"] = None
        room["satranc_white"] = None
        room["satranc_black"] = None
        room["satranc_jokers"] = {}
        room["satranc_used_jokers"] = {}
        room["satranc_clocks"] = {}
        room["satranc_ajan_disguised"] = {}
        room["satranc_captured_pieces"] = {}
        room["satranc_pending_promotion"] = None

        clock_task = room.get("satranc_clock_task")
        if clock_task and not clock_task.done():
            clock_task.cancel()
        room["satranc_clock_task"] = None

        await send_jokerli_satranc_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}

    # ----------------------------------------
    # Bu handler'a ait değil
    # ----------------------------------------
    return {"handled": False, "room_code": room_code, "player_id": player_id}

# ==========================================
# JOKER SEÇİM YARDIMCI FONKSİYONLARI
# ==========================================

async def _joker_selection_timeout(room, broadcast, safe_send, pick_seconds):
    """Süre bitince oyunu başlat - kim ne seçtiyse o kalır (doldurulmaz)."""
    try:
        # Sınırsız (0) modda timeout yok
        if pick_seconds <= 0:
            return
        await asyncio.sleep(pick_seconds)

        if room.get("phase") != "joker_selection":
            return

        # ✨ Her oyuncunun mevcut seçimini kilitle - EKLEME YOK
        for pid in room["players"]:
            if room["satranc_selection_done"].get(pid):
                continue

            current_slots = room["satranc_selected_slots"].get(pid, [])
            room["satranc_jokers"][pid] = current_slots
            room["satranc_selection_done"][pid] = True

            pdata = room["players"].get(pid)
            if pdata:
                await safe_send(pdata["ws"], {
                    "type": "satranc_your_jokers_ready",
                    "my_jokers": [get_public_joker_info(jid) for jid in current_slots],
                    "auto_filled": False,
                    "time_up": True,
                })

        # Oyunu başlat
        await _start_actual_game(room, broadcast, safe_send)

    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[SATRANC JOKER TIMEOUT HATA] {e}")


async def _delayed_game_start(room, broadcast, safe_send, delay=3):
    """Karışık modda birkaç saniye bekleyip oyunu başlatır."""
    try:
        await asyncio.sleep(delay)
        if room.get("phase") == "joker_selection":
            await _start_actual_game(room, broadcast, safe_send)
    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[SATRANC DELAYED START HATA] {e}")

# ==========================================
# JOKER EFEKT YÖNETİMİ
# ==========================================

def decrement_effect_counters(room):
    """Her hamleden sonra kilitle sayacını azalt.
    Görünmez, Kalkan ve Dondur özel mantık ile azalır - burada değil!"""
    for effect_key in ["satranc_locked"]:
        effects = room.get(effect_key, {})
        expired = []
        for sq, turns in list(effects.items()):
            effects[sq] = turns - 1
            if effects[sq] <= 0:
                expired.append(sq)
        for sq in expired:
            del effects[sq]


def square_neighbors(square_name):
    """Bir karenin 4 komşusunu (yukarı, aşağı, sol, sağ) döner."""
    file = square_name[0]  # a-h
    rank = square_name[1]  # 1-8
    neighbors = []
    files = "abcdefgh"
    file_idx = files.index(file)
    rank_int = int(rank)

    # Yukarı
    if rank_int < 8:
        neighbors.append(f"{file}{rank_int + 1}")
    # Aşağı
    if rank_int > 1:
        neighbors.append(f"{file}{rank_int - 1}")
    # Sol
    if file_idx > 0:
        neighbors.append(f"{files[file_idx - 1]}{rank_int}")
    # Sağ
    if file_idx < 7:
        neighbors.append(f"{files[file_idx + 1]}{rank_int}")

    return neighbors

def chebyshev_distance(sq1_name, sq2_name):
    """İki kare arasındaki Chebyshev mesafesi (satranç kral mesafesi)."""
    files = "abcdefgh"
    f1 = files.index(sq1_name[0])
    r1 = int(sq1_name[1])
    f2 = files.index(sq2_name[0])
    r2 = int(sq2_name[1])
    return max(abs(f1 - f2), abs(r1 - r2))

def get_effect_state(room):
    """Frontend'e gönderilecek efekt state'i (varsayılan - hepsi görünür)."""
    return {
        "shielded": list(room.get("satranc_shielded", {}).keys()),
        "shielded_details": dict(room.get("satranc_shielded", {})),
        "frozen": list(room.get("satranc_frozen", {}).keys()),
        "frozen_details": dict(room.get("satranc_frozen", {})),
        "invisible": list(room.get("satranc_invisible", {}).keys()),
        "locked": list(room.get("satranc_locked", {}).keys()),
        "ajan_disguised": {},
    }

def get_effect_state_for_player(room, player_id):
    """Player'a özel efekt state'i - rakibin görünmez taşları ve onların kare izleri GİZLİ."""
    invisible_owners = room.get("satranc_invisible_owners", {})
    invisible_all = room.get("satranc_invisible", {})

    # Bu oyuncudan gizlenmesi gereken aktif görünmez kareler
    hidden_from_player = {
        sq for sq, owner_pid in invisible_owners.items()
        if owner_pid != player_id and sq in invisible_all
    }

    # Sadece kendi görünmez taşlarım
    my_invisible = []
    my_invisible_details = {}
    for sq, owner_pid in invisible_owners.items():
        if owner_pid == player_id and sq in invisible_all:
            my_invisible.append(sq)
            my_invisible_details[sq] = invisible_all[sq]  # kalan half-move

    def _visible_effect_keys(effect_key):
        return [
            sq for sq in room.get(effect_key, {}).keys()
            if sq not in hidden_from_player
        ]

    # Kalkan detaylarını da göster (rakip görebilir)
    shielded_all = room.get("satranc_shielded", {})
    shielded_details_visible = {
        sq: shielded_all[sq] for sq in shielded_all
        if sq not in hidden_from_player
    }

    frozen_all = room.get("satranc_frozen", {})
    frozen_details_visible = {
        sq: frozen_all[sq] for sq in frozen_all
        if sq not in hidden_from_player
    }

    # Ajan disguised: sadece SAHİBİ görsün
    my_ajan = {}
    for sq, data in room.get("satranc_ajan_disguised", {}).items():
        if isinstance(data, dict) and data.get("owner") == player_id:
            my_ajan[sq] = data

    return {
        "shielded": _visible_effect_keys("satranc_shielded"),
        "shielded_details": shielded_details_visible,
        "frozen": _visible_effect_keys("satranc_frozen"),
        "frozen_details": frozen_details_visible,
        "invisible": my_invisible,
        "invisible_details": my_invisible_details,
        "locked": _visible_effect_keys("satranc_locked"),
        "ajan_disguised": my_ajan,
    }
    
# ==========================================
# ÇARKIFELEK DİLİMLERİ
# ==========================================

CARKIFELEK_DILIMLER = [
    {"id": "karsilikli_ekstra", "icon": "🎁", "label": "Karşılıklı +1 Joker", "color": "#51cf66"},
    {"id": "karsilikli_vezir", "icon": "💰", "label": "Karşılıklı Vezir", "color": "#ffd43b"},
    {"id": "karsilikli_sure", "icon": "⏱️", "label": "Karşılıklı +60sn", "color": "#4dabf7"},
    {"id": "karsilikli_tas_sil", "icon": "🗑️", "label": "Karşılıklı Taş Sil", "color": "#ff6b6b"},
    {"id": "karsilikli_random_tas", "icon": "🎲", "label": "Karşılıklı Random Taş Sil", "color": "#ff8787"},
    {"id": "piyon_katliami", "icon": "🔫", "label": "Piyon Katliamı", "color": "#e74c3c"},
    {"id": "joker_degisimi", "icon": "🃏", "label": "Karşılıklı Joker Değişimi", "color": "#c084fc"},
    {"id": "sen_ekstra", "icon": "🎁", "label": "Sadece Sen +1 Joker", "color": "#20c997"},
    {"id": "joker_cal", "icon": "💀", "label": "Joker Çal (+1/-1)", "color": "#845ef7"},
    {"id": "joker_kaybi", "icon": "❌", "label": "Joker Kaybı (-1)", "color": "#e67e22"},
    {"id": "sen_tas_sil", "icon": "💀", "label": "Taşlarından Birisi Silinecek", "color": "#c0392b"},
    {"id": "sen_kilit", "icon": "🔒", "label": "Sen 3 Tur Joker Yasağı", "color": "#95a5a6"},
    {"id": "rakip_yasak", "icon": "⛔", "label": "Rakip 3 Tur Joker Yasağı", "color": "#f39c12"},
] 

async def _apply_carkifelek_dilim(room, player_id, dilim_id, broadcast, safe_send):
    """Çarkıfeleğin seçilen dilimini uygular."""
    board = room.get("satranc_game")
    white_pid = room.get("satranc_white")
    black_pid = room.get("satranc_black")
    opp_pid = black_pid if player_id == white_pid else white_pid
    my_color = chess.WHITE if player_id == white_pid else chess.BLACK
    opp_color = not my_color

    result_msg = ""
    board_changed = False

    # 🎁 Karşılıklı Ekstra Joker
    if dilim_id == "karsilikli_ekstra":
        # ✨ Önce Başla oyun içinde anlamsız - hariç
        exclude_set = {"once_basla"}
        time_mode_check = room.get("satranc_time_mode", "blitz")
        if time_mode_check == "suresiz":
            exclude_set.update({"zaman_cal", "zamani_durdur"})

        for pid in room["players"]:
            current = room["satranc_jokers"].get(pid, [])
            already = set(current)
            available = [j for j in JOKERS
                         if j["id"] not in already
                         and j["id"] not in exclude_set
                         and j.get("implemented", False)]
            if not available:
                available = [j for j in JOKERS
                             if j["id"] not in already
                             and j["id"] not in exclude_set]
            if available:
                new_j = random.choice(available)
                current.append(new_j["id"])
                room["satranc_jokers"][pid] = current
                pdata = room["players"].get(pid)
                if pdata:
                    await safe_send(pdata["ws"], {
                        "type": "satranc_new_joker_gained",
                        "new_joker": get_public_joker_info(new_j["id"]),
                        "message": f"🎁 Çarkıfelek'ten yeni joker: {new_j['name']}!"
                    })
        result_msg = "Her iki oyuncu da +1 rastgele joker kazandı!"

    # 💰 Karşılıklı Vezir (rastgele bir piyon vezir olur)
    elif dilim_id == "karsilikli_vezir":
        for color, pid in [(chess.WHITE, white_pid), (chess.BLACK, black_pid)]:
            pawns = [sq for sq in chess.SQUARES
                    if board.piece_at(sq) and board.piece_at(sq).piece_type == chess.PAWN
                    and board.piece_at(sq).color == color]
            if pawns:
                target = random.choice(pawns)
                board.set_piece_at(target, chess.Piece(chess.QUEEN, color))
        result_msg = "Her iki oyuncunun da rastgele bir piyonu vezire dönüştü!"
        board_changed = True

    # ⏱️ Karşılıklı Süre Bonus
    elif dilim_id == "karsilikli_sure":
        clocks = room.get("satranc_clocks", {})
        time_mode = room.get("satranc_time_mode", "blitz")
        if time_mode == "suresiz":
            result_msg = "Süresiz modda süre bonusu yok!"
        else:
            for pid in clocks:
                clocks[pid] += 60
            result_msg = "Her iki oyuncuya da +60 saniye eklendi!"

    # 🗑️ Karşılıklı Random Taş Sil (şah hariç)
    elif dilim_id == "karsilikli_tas_sil" or dilim_id == "karsilikli_random_tas":
        for color, pid in [(chess.WHITE, white_pid), (chess.BLACK, black_pid)]:
            pieces = [sq for sq in chess.SQUARES
                     if board.piece_at(sq) and board.piece_at(sq).color == color
                     and board.piece_at(sq).piece_type != chess.KING]
            if pieces:
                victim = random.choice(pieces)
                board.remove_piece_at(victim)
        result_msg = "Her iki oyuncunun rastgele bir taşı silindi!"
        board_changed = True

    # 🔫 Piyon Katliamı (herkesin 5-6 piyonu random)
    elif dilim_id == "piyon_katliami":
        kill_count = random.randint(5, 6)
        total_killed = 0
        for color in [chess.WHITE, chess.BLACK]:
            pawns = [sq for sq in chess.SQUARES
                    if board.piece_at(sq) and board.piece_at(sq).piece_type == chess.PAWN
                    and board.piece_at(sq).color == color]
            random.shuffle(pawns)
            actual_kill = min(kill_count, len(pawns))
            for i in range(actual_kill):
                board.remove_piece_at(pawns[i])
                total_killed += 1
        result_msg = f"🔫 KATLİAM! {total_killed} piyon uçtu!"
        board_changed = True

    # 🃏 Karşılıklı Joker Değişimi (1 rastgele joker takas)
    elif dilim_id == "joker_degisimi":
        my_jokers = room["satranc_jokers"].get(player_id, [])
        opp_jokers = room["satranc_jokers"].get(opp_pid, [])
        my_used = room["satranc_used_jokers"].get(player_id, [])
        opp_used = room["satranc_used_jokers"].get(opp_pid, [])

        my_available = [j for j in my_jokers if j not in my_used and j != "carkifelek"]
        opp_available = [j for j in opp_jokers if j not in opp_used and j != "carkifelek"]

        if my_available and opp_available:
            mine = random.choice(my_available)
            his = random.choice(opp_available)
            # Değiştir
            my_jokers.remove(mine)
            my_jokers.append(his)
            opp_jokers.remove(his)
            opp_jokers.append(mine)
            room["satranc_jokers"][player_id] = my_jokers
            room["satranc_jokers"][opp_pid] = opp_jokers

            # Herkese kendi yeni jokerini bildir
            my_ws = room["players"].get(player_id, {}).get("ws")
            opp_ws = room["players"].get(opp_pid, {}).get("ws")
            if my_ws:
                await safe_send(my_ws, {
                    "type": "satranc_new_joker_gained",
                    "new_joker": get_public_joker_info(his),
                    "message": f"🃏 Yeni joker (takas): {get_public_joker_info(his)['name']}"
                })
                await safe_send(my_ws, {
                    "type": "satranc_joker_stolen",
                    "stolen_joker": get_public_joker_info(mine),
                    "thief_name": "Çarkıfelek",
                    "message": f"🃏 Kaybettin (takas): {get_public_joker_info(mine)['name']}"
                })
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_new_joker_gained",
                    "new_joker": get_public_joker_info(mine),
                    "message": f"🃏 Yeni joker (takas): {get_public_joker_info(mine)['name']}"
                })
                await safe_send(opp_ws, {
                    "type": "satranc_joker_stolen",
                    "stolen_joker": get_public_joker_info(his),
                    "thief_name": "Çarkıfelek",
                    "message": f"🃏 Kaybettin (takas): {get_public_joker_info(his)['name']}"
                })
            result_msg = "Bir joker karşılıklı takas edildi!"
        else:
            result_msg = "Takas için uygun joker yok."

    # 🎁 Sadece Sen Ekstra Joker
    elif dilim_id == "sen_ekstra":
        current = room["satranc_jokers"].get(player_id, [])
        already = set(current)
        # ✨ Önce Başla oyun içinde anlamsız - hariç
        exclude_set = {"once_basla"}
        # Süresiz modda saat jokerleri hariç
        time_mode_check = room.get("satranc_time_mode", "blitz")
        if time_mode_check == "suresiz":
            exclude_set.update({"zaman_cal", "zamani_durdur"})

        available = [j for j in JOKERS
                     if j["id"] not in already
                     and j["id"] not in exclude_set
                     and j.get("implemented", False)]
        if not available:
            available = [j for j in JOKERS
                         if j["id"] not in already
                         and j["id"] not in exclude_set]
        if available:
            new_j = random.choice(available)
            current.append(new_j["id"])
            room["satranc_jokers"][player_id] = current
            my_ws = room["players"].get(player_id, {}).get("ws")
            if my_ws:
                await safe_send(my_ws, {
                    "type": "satranc_new_joker_gained",
                    "new_joker": get_public_joker_info(new_j["id"]),
                    "message": f"🎁 Şanslısın! Ekstra joker: {new_j['name']}"
                })
            result_msg = f"Şanslısın! +1 joker kazandın."
        else:
            result_msg = "Ekleyecek joker yok."

    # 💀 Joker Çal (sen +1, rakip -1)
    elif dilim_id == "joker_cal":
        opp_jokers = room["satranc_jokers"].get(opp_pid, [])
        opp_used = room["satranc_used_jokers"].get(opp_pid, [])
        available = [j for j in opp_jokers if j not in opp_used and j != "carkifelek"]
        if available:
            stolen = random.choice(available)
            opp_jokers.remove(stolen)
            my_jokers = room["satranc_jokers"].setdefault(player_id, [])
            my_jokers.append(stolen)
            room["satranc_jokers"][opp_pid] = opp_jokers

            info = get_public_joker_info(stolen)
            my_ws = room["players"].get(player_id, {}).get("ws")
            opp_ws = room["players"].get(opp_pid, {}).get("ws")
            if my_ws:
                await safe_send(my_ws, {
                    "type": "satranc_new_joker_gained",
                    "new_joker": info,
                    "message": f"💀 Rakipten çaldın: {info['name']}"
                })
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_joker_stolen",
                    "stolen_joker": info,
                    "thief_name": "Çarkıfelek",
                    "message": f"💀 Çarkıfelek jokerini çaldı: {info['name']}"
                })
            result_msg = f"Rakipten '{info['name']}' jokerini çaldın!"
        else:
            result_msg = "Rakibin çalınacak jokeri yok."

    # ❌ Joker Kaybı (sen -1)
    elif dilim_id == "joker_kaybi":
        my_jokers = room["satranc_jokers"].get(player_id, [])
        my_used = room["satranc_used_jokers"].get(player_id, [])
        available = [j for j in my_jokers if j not in my_used and j != "carkifelek"]
        if available:
            lost = random.choice(available)
            my_jokers.remove(lost)
            room["satranc_jokers"][player_id] = my_jokers
            info = get_public_joker_info(lost)
            my_ws = room["players"].get(player_id, {}).get("ws")
            if my_ws:
                await safe_send(my_ws, {
                    "type": "satranc_joker_stolen",
                    "stolen_joker": info,
                    "thief_name": "Çarkıfelek",
                    "message": f"❌ Kaybettin: {info['name']}"
                })
            result_msg = f"'{info['name']}' jokerini kaybettin!"
        else:
            result_msg = "Kaybedilecek jokerin yok."

    # 💀 Taşlarından Birisi Silinecek → ekstra mini çarkıfelek
    elif dilim_id == "sen_tas_sil":
        my_pieces = [sq for sq in chess.SQUARES
                    if board.piece_at(sq) and board.piece_at(sq).color == my_color
                    and board.piece_at(sq).piece_type != chess.KING]
        if my_pieces:
            # Rastgele kurban seç (backend karar veriyor ki animasyon sonrası tutarlı olsun)
            victim = random.choice(my_pieces)
            victim_name = chess.square_name(victim)
            victim_piece = board.piece_at(victim)

            piece_type_map = {
                chess.PAWN: "p", chess.ROOK: "r", chess.KNIGHT: "n",
                chess.BISHOP: "b", chess.QUEEN: "q", chess.KING: "k"
            }
            piece_names_tr = {
                "p": "Piyon", "r": "Kale", "n": "At",
                "b": "Fil", "q": "Vezir", "k": "Şah"
            }

            # Tüm taşları çark dilimleri olarak hazırla
            my_color_str = "w" if my_color == chess.WHITE else "b"
            all_pieces_data = []
            for sq_idx in my_pieces:
                p = board.piece_at(sq_idx)
                p_type = piece_type_map.get(p.piece_type, "p")
                all_pieces_data.append({
                    "square": chess.square_name(sq_idx),
                    "type": p_type,
                    "color": my_color_str,
                    "name": piece_names_tr.get(p_type, "Taş"),
                })

            # Mini çark için özel mesaj gönder (broadcast HERKESE ki rakip de görsün)
            await broadcast(room, {
                "type": "satranc_mini_carkifelek",
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "pieces": all_pieces_data,
                "victim_square": victim_name,
                "victim_type": piece_type_map.get(victim_piece.piece_type, "p"),
                "victim_color": my_color_str,
                "victim_name": piece_names_tr.get(piece_type_map.get(victim_piece.piece_type, "p"), "Taş"),
            })

            # Animasyon bekleyelim (mini çark ~4 saniye)
            await asyncio.sleep(4.5)

            # Şimdi gerçekten sil
            board.remove_piece_at(victim)
            result_msg = f"💀 {piece_names_tr.get(piece_type_map.get(victim_piece.piece_type, 'p'), 'Taş')} ({victim_name}) silindi!"
            board_changed = True
        else:
            result_msg = "Silinecek taşın yok."

    # 🔒 Sen Kilit (3 tur joker yasağı)
    elif dilim_id == "sen_kilit":
        sansur = room.setdefault("satranc_sansur", {})
        sansur[player_id] = 6  # 3 tur = 6 half-move
        result_msg = "3 tur boyunca joker kullanamazsın!"

    # ⛔ Rakip 3 Tur Yasağı
    elif dilim_id == "rakip_yasak":
        sansur = room.setdefault("satranc_sansur", {})
        sansur[opp_pid] = 6
        result_msg = "Rakip 3 tur joker kullanamayacak!"

    return {
        "result_msg": result_msg,
        "board_changed": board_changed
    }   

async def _start_actual_game(room, broadcast, safe_send):
    """Joker seçim bitti, satranç oyununu asıl başlat."""
    if room.get("phase") == "playing":
        return  # Zaten başlamış

    # ✨ ÖNCE BAŞLA jokeri kontrolü
    pids = list(room["players"].keys())
    once_basla_holders = []
    for pid in pids:
        if "once_basla" in room["satranc_jokers"].get(pid, []):
            once_basla_holders.append(pid)

    # ✨ HER DURUMDA: Önce Başla kimde varsa otomatik "kullanıldı" işaretle (üstü çizik)
    for pid in once_basla_holders:
        used = room["satranc_used_jokers"].setdefault(pid, [])
        if "once_basla" not in used:
            used.append("once_basla")

    if len(once_basla_holders) == 1:
        # Tek kişide varsa → o beyaz olur
        white_pid = once_basla_holders[0]
        black_pid = [p for p in pids if p != white_pid][0]
        print(f"[SATRANC] Önce Başla jokeri: {room['players'][white_pid]['name']} beyaz oldu (üstü çizik)")
    elif len(once_basla_holders) == 2:
        # İkisinde de varsa → rastgele belirle (ikisi de zaten üstü çizik)
        random.shuffle(pids)
        white_pid = pids[0]
        black_pid = pids[1]
        print(f"[SATRANC] Önce Başla iki kişide de var → rastgele, ikisinde de üstü çizik")
    else:
        # Kimsede yok → rastgele
        random.shuffle(pids)
        white_pid = pids[0]
        black_pid = pids[1]

    room["satranc_white"] = white_pid
    room["satranc_black"] = black_pid

    # Board oluştur
    room["satranc_captured_pieces"] = {pid: [] for pid in room["players"]}
    board = chess.Board()
    room["satranc_game"] = board
    room["phase"] = "playing"

    # Saatleri başlat
    time_mode = room.get("satranc_time_mode", "blitz")
    tm = TIME_MODES.get(time_mode, TIME_MODES["blitz"])
    if tm["seconds"] > 0:
        room["satranc_clocks"] = {
            white_pid: tm["seconds"],
            black_pid: tm["seconds"]
        }
    else:
        room["satranc_clocks"] = {
            white_pid: 0,
            black_pid: 0
        }

    board_state = board_to_dict(board)
    legal_moves = get_legal_moves(board)

    print(f"[SATRANC] Oyun başladı: {room['code']} | Beyaz={room['players'][white_pid]['name']} Siyah={room['players'][black_pid]['name']}")

    # Her oyuncuya ayrı mesaj (renk + jokerler)
    for pid, pdata in room["players"].items():
        my_color = "w" if pid == white_pid else "b"
        my_jokers = room["satranc_jokers"].get(pid, [])
        opp_pid = black_pid if pid == white_pid else white_pid
        opp_joker_count = len(room["satranc_jokers"].get(opp_pid, []))

        await safe_send(pdata["ws"], {
            "type": "satranc_game_started",
            "white_id": white_pid,
            "black_id": black_pid,
            "white_name": room["players"][white_pid]["name"],
            "black_name": room["players"][black_pid]["name"],
            "my_color": my_color,
            "board": board_state,
            "legal_moves": legal_moves if my_color == "w" else [],
            "time_mode": time_mode,
            "clocks": {str(p): room["satranc_clocks"][p] for p in room["satranc_clocks"]},
            "increment": tm["increment"],
            "my_jokers": [get_public_joker_info(jid) for jid in my_jokers],
            "opp_joker_count": opp_joker_count,
            "opp_used_jokers": [],  # ✨ başlangıçta boş
            "captured_pieces": get_captured_pieces_payload(room),
        })

    # Saati başlat
    if tm["seconds"] > 0:
        clock_task = asyncio.create_task(
            run_clock(room, broadcast, safe_send)
        )
        room["satranc_clock_task"] = clock_task

def _game_over_message(reason):
    messages = {
        "checkmate": "Şah Mat! 🏆",
        "stalemate": "Pat! Berabere 🤝",
        "insufficient": "Yetersiz Materyal! Berabere 🤝",
        "seventyfive": "75 Hamle Kuralı! Berabere 🤝",
        "fivefold": "Beş Tekrar! Berabere 🤝",
        "timeout": "Süre Doldu! ⏰",
        "resign": "İstifa! 🏳️",
        "draw": "Berabere 🤝"
    }
    return messages.get(reason, "Oyun Bitti!")