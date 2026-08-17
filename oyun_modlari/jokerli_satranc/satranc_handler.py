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
        "satranc_ignored": {},          # {square: {"owner": pid, "expires_move_count": N, "piece": {...}}} (Yok Say hayalet)
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


def rollback_captured_for_undo(room, board_current, move, mover_pid):
    """Undo sonrası captured listesini geri sarar."""
    try:
        # ÖNEMLİ: board_current zaten pop() yapılmış halidir. 
        # Ama hamlenin ne yediğini anlamak için board'un içindeki hamle bilgisini (is_capture) kullanırız.
        # move nesnesi zaten hamle yapıldığında oluşturulmuştu.
        
        # Eğer hamle bir taş yediyse
        # piece_at(move.to_square) pop'tan sonra geri gelen taşı verir.
        restored_piece = board_current.piece_at(move.to_square)
        
        if restored_piece:
            # mover_pid bu taşı yiyen kişiydi, şimdi ondan geri alıyoruz
            _remove_last_captured_piece(
                room,
                mover_pid,
                restored_piece.symbol().lower(),
                restored_piece.color
            )
            print(f"[UNDO] {mover_pid} id'li oyuncunun yediği {restored_piece.symbol()} geri verildi.")
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

        # ✨ Aynı isim kontrolü (case-insensitive)
        existing_names = [p["name"].strip().lower() for p in room["players"].values()]
        if name.lower() in existing_names:
            await safe_send(websocket, {
                "type": "error",
                "message": f"⚠️ Bu isimde ({name}) başka bir oyuncu zaten odada! Farklı bir isim seç."
            })
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
            room["satranc_joker_count"] = max(0, min(6, jc))
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

        # ✨ Jokersiz mod → direkt oyuna başla
        if joker_count == 0:
            for pid in room["players"]:
                room["satranc_jokers"][pid] = []
                room["satranc_selection_done"][pid] = True
            await _start_actual_game(room, broadcast, safe_send)
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        import time as _time
        room["satranc_selection_deadline"] = _time.time() + pick_seconds

        # Karışık modda direkt rastgele dağıt
        if pick_mode == "karisik":
            time_mode_check = room.get("satranc_time_mode", "blitz")
            excluded_ids = []
            if time_mode_check == "suresiz":
                excluded_ids = ["zaman_cal", "zamani_durdur", "ekstra_sure"]

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
        if time_mode_check == "suresiz" and joker_id in ("zaman_cal", "zamani_durdur", "ekstra_sure"):
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

        white_pid = room.get("satranc_white")
        black_pid = room.get("satranc_black")

        uci_move = data.get("move", "")
        promotion = data.get("promotion", "q")

        # ✨ JOKER KAYNAKLI PROMOSYON CEVABI
        # Not: bunu sıra kontrolünden ÖNCE yakalıyoruz.
        # Çünkü ışınlanma / yer değiştir / rakibi ışınla sonrası promosyon seçimi,
        # hamlenin devamı sayılıyor.
        pending_pre = room.get("satranc_pending_promotion")
        if pending_pre and pending_pre.get("pid") == player_id and pending_pre.get("source") in ("isinlan", "yer_degistir", "rakibi_isinla"):
            promo_map_pre = {"q": chess.QUEEN, "r": chess.ROOK, "b": chess.BISHOP, "n": chess.KNIGHT}
            chosen_promo_pre = promo_map_pre.get(promotion, chess.QUEEN)
            to_sq_name = pending_pre["to"]
            to_sq_idx = chess.parse_square(to_sq_name)
            my_color_promo = chess.WHITE if player_id == white_pid else chess.BLACK

            board.set_piece_at(to_sq_idx, chess.Piece(chosen_promo_pre, my_color_promo))
            room["satranc_pending_promotion"] = None

            # ✨ Joker hamlesi şimdi TAMAMLANMIŞ sayılır:
            # önce dönüşüm olur, SONRA sıra rakibe geçer
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

            board_state_pre = board_to_dict(board)
            piece_names_pre = {
                chess.QUEEN: "Vezir",
                chess.ROOK: "Kale",
                chess.BISHOP: "Fil",
                chess.KNIGHT: "At"
            }
            piece_icons_pre = {
                chess.QUEEN: "♛",
                chess.ROOK: "♜",
                chess.BISHOP: "♝",
                chess.KNIGHT: "♞"
            }

            await broadcast(room, {
                "type": "satranc_board_update",
                "board": board_state_pre,
                "last_move": None,
                "san_move": f"{to_sq_name}={promotion.upper()}",
                "mover_id": player_id,
                "clocks": {str(p): room["satranc_clocks"].get(p, 0) for p in room["satranc_clocks"]},
                "effects": get_effect_state(room),
                "captured_pieces": get_captured_pieces_payload(room),
                "promotion_done": {
                    "square": to_sq_name,
                    "type": promotion,
                    "label": piece_names_pre.get(chosen_promo_pre, "Vezir"),
                    "icon": piece_icons_pre.get(chosen_promo_pre, "♛"),
                }
            })

            opp_pid_promo = black_pid if player_id == white_pid else white_pid
            opp_ws_promo = room["players"].get(opp_pid_promo, {}).get("ws")
            if opp_ws_promo:
                await safe_send(opp_ws_promo, {
                    "type": "satranc_your_turn",
                    "legal_moves": get_legal_moves(board),
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC] Joker promosyon tamamlandı: {to_sq_name} → {promotion}")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # Sıra kontrolü
        expected_pid = white_pid if board.turn == chess.WHITE else black_pid

        if player_id != expected_pid:
            await safe_send(websocket, {"type": "error", "message": "Sıra sende değil!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

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

                # ✨ Joker kaynaklı promosyon mu? (Işınlama / Yer Değiştir / Rakibi Işınla)
                pending = room.get("satranc_pending_promotion")
                if pending and pending.get("source") in ("isinlan", "yer_degistir", "rakibi_isinla"):
                    # Piyon zaten target karede, sadece dönüştür
                    to_sq_name = pending["to"]
                    to_sq_idx = chess.parse_square(to_sq_name)
                    my_color_promo = chess.WHITE if player_id == white_pid else chess.BLACK
                    board.set_piece_at(to_sq_idx, chess.Piece(chosen_promo, my_color_promo))
                    room["satranc_pending_promotion"] = None

                    # Board güncelle + herkese bildir
                    board_state = board_to_dict(board)
                    piece_names_promo = {chess.QUEEN: "Vezir", chess.ROOK: "Kale",
                                          chess.BISHOP: "Fil", chess.KNIGHT: "At"}
                    piece_icons_promo = {chess.QUEEN: "♛", chess.ROOK: "♜",
                                          chess.BISHOP: "♝", chess.KNIGHT: "♞"}

                    await broadcast(room, {
                        "type": "satranc_board_update",
                        "board": board_state,
                        "last_move": None,
                        "san_move": None,
                        "mover_id": player_id,
                        "clocks": {str(p): room["satranc_clocks"].get(p, 0) for p in room["satranc_clocks"]},
                        "effects": get_effect_state(room),
                        "captured_pieces": get_captured_pieces_payload(room),
                        "promotion_done": {
                            "square": to_sq_name,
                            "type": promotion,
                            "label": piece_names_promo.get(chosen_promo, "Vezir"),
                            "icon": piece_icons_promo.get(chosen_promo, "♛"),
                        }
                    })
                    print(f"[SATRANC] Joker promosyon tamamlandı: {to_sq_name} → {promotion}")
                    return {"handled": True, "room_code": room_code, "player_id": player_id}

                move = chess.Move(move.from_square, move.to_square, promotion=chosen_promo)
                room["satranc_pending_promotion"] = None

            if move not in board.legal_moves:
                # ✨ Kalkanlı şah VEYA Hızlı Kaçış aktif şah özel hamlesi olabilir
                shielded_pre = room.get("satranc_shielded", {})
                hizli_kacis_pre = room.get("satranc_hizli_kacis", {})
                moving_p = board.piece_at(move.from_square)
                is_king_piece = moving_p and moving_p.piece_type == chess.KING
                is_shielded_king_move = (is_king_piece and 
                                          chess.square_name(move.from_square) in shielded_pre)
                is_hizli_kacis_move = (is_king_piece and hizli_kacis_pre.get(player_id))

                if not is_shielded_king_move and not is_hizli_kacis_move:
                    print(f"[SATRANC HAMLE HATA] Legal değil: {uci_move}, board turn: {board.turn}, promo: {promotion}")
                    await safe_send(websocket, {"type": "error", "message": "Geçersiz hamle!"})
                    return {"handled": True, "room_code": room_code, "player_id": player_id}
                
                # ✨ Kalkanlı şah ise: SADECE kalkanlı şah özel akışına düşsün
                # Ama RAKIP ŞAH'ı yemeye çalışıyorsa engelle (şah yenilemez!)
                target_at_dest = board.piece_at(move.to_square)
                if target_at_dest and target_at_dest.piece_type == chess.KING:
                    await safe_send(websocket, {"type": "error", "message": "Şahı yiyemezsin!"})
                    return {"handled": True, "room_code": room_code, "player_id": player_id}
                # Kalkanlı şah ise devam et (aşağıdaki kalkanlı şah bloğu yakalayacak)
                
            # ✨ HAYALET KARE KONTROLÜ (Yok Say jokeri)
            # Hayalet karesine gidilemez (üzerinden geçilir ama üstünde durulamaz)
            ignored_state = room.get("satranc_ignored", {})
            to_sq_pre_check = chess.square_name(move.to_square)
            if to_sq_pre_check in ignored_state:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "🚫 Bu kare hayalet! Üzerinden geçilir ama durulamaz."
                })
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

            # Dondurulmuş taş oynayamaz
            frozen = room.get("satranc_frozen", {})
            if from_sq in frozen:
                await safe_send(websocket, {
                    "type": "error",
                    "message": f"❄️ Bu taş donmuş! ({frozen[from_sq]} tur kaldı)"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ KALKAN KONTROLLERİ (yeni kural sistemi)
            shielded = room.get("satranc_shielded", {})
            invisible = room.get("satranc_invisible", {})
            captured_piece = board.piece_at(move.to_square)
            captured_invisible_owner = None

            moving_piece_shield_check = board.piece_at(move.from_square)
            i_am_king = moving_piece_shield_check and moving_piece_shield_check.piece_type == chess.KING
            i_am_shielded = from_sq in shielded

            # 1) Kalkanlı NORMAL taş (şah olmayan): HİÇBİR ŞEY yiyemez
            if i_am_shielded and not i_am_king and captured_piece:
                await safe_send(websocket, {
                    "type": "error",
                    "message": f"🛡️ Kalkanlı taş saldıramaz! ({shielded[from_sq]} tur kalkanlı)"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # 2) Hedef kalkanlıysa, rakip yiyemez (şah dahil HER ŞEY korunur)
            if captured_piece and to_sq in shielded:
                await safe_send(websocket, {
                    "type": "error",
                    "message": f"🛡️ Bu taş kalkanlı, yenilemez! ({shielded[to_sq]} tur kaldı)"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # 3) Görünmez taş yendiyse sahibini kaydet
            if captured_piece and to_sq in invisible:
                inv_owners_check = room.get("satranc_invisible_owners", {})
                captured_invisible_owner = inv_owners_check.get(to_sq)
                print(f"[SATRANC] Görünmez taş yendi! Kare={to_sq}, sahibi pid={captured_invisible_owner}")

            # ✨ KİLİT KONTROLÜ (max 1 kare hareket)
            locked = room.get("satranc_locked", {})
            if from_sq in locked:
                dist = chebyshev_distance(from_sq, to_sq)
                if dist > 1:
                    await safe_send(websocket, {
                        "type": "error",
                        "message": f"⛓️ Bu taş kilitli! Sadece 1 kare gidebilir ({locked[from_sq]} tur kaldı)."
                    })
                    return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ HIZLI KAÇIŞ KONTROLÜ (şah vezir gibi hareket eder - sınırsız yatay/dikey/çapraz)
            hizli_kacis = room.get("satranc_hizli_kacis", {})
            moving_piece = board.piece_at(move.from_square)
            is_king_move = moving_piece and moving_piece.piece_type == chess.KING

            if hizli_kacis.get(player_id) and is_king_move:
                target_piece_at_dest = board.piece_at(move.to_square)
                # Vezir hareketi kontrolü: aynı satır/sütun/çapraz + arada engel yok
                is_queen_like = _is_queen_like_move(board, move.from_square, move.to_square, moving_piece.color)
                target_ok = (not target_piece_at_dest or (target_piece_at_dest.color != moving_piece.color and target_piece_at_dest.piece_type != chess.KING))

                if is_queen_like and target_ok:
                    # Rakip taşı yediyse captured'a ekle
                    if target_piece_at_dest and target_piece_at_dest.piece_type != chess.KING:
                        captured_list = room["satranc_captured_pieces"].setdefault(player_id, [])
                        piece_symbol = target_piece_at_dest.symbol().lower()
                        piece_color_str = "w" if target_piece_at_dest.color == chess.WHITE else "b"
                        captured_list.append({"type": piece_symbol, "color": piece_color_str})

                    # Manuel şah hamlesi (vezir gibi)
                    board.remove_piece_at(move.from_square)
                    if target_piece_at_dest:
                        board.remove_piece_at(move.to_square)
                    board.set_piece_at(move.to_square, moving_piece)
                    board.turn = not board.turn
                    san_move = f"K{to_sq}(HK-Vezir)"

                    # Hızlı Kaçış efektini kaldır
                    hizli_kacis.pop(player_id, None)

                    room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
                    decrement_effect_counters(room, mover_pid=player_id)

                    # Efekt taşı
                    for effect_key in ["satranc_shielded", "satranc_frozen", "satranc_invisible", "satranc_locked"]:
                        effects = room.get(effect_key, {})
                        if from_sq in effects:
                            effects[to_sq] = effects.pop(from_sq)

                    # ✨ İKİ HAMLE / EKSTRA HAMLE kontrolü
                    continue_my_turn_hk = False
                    same_piece_forced_legal_hk = None

                    same_piece_double_hk = room.get("satranc_same_piece_double", {})
                    same_piece_state_hk = same_piece_double_hk.get(player_id)
                    extra_move_hk = room.get("satranc_extra_move", {})

                    if same_piece_state_hk and same_piece_state_hk.get("active"):
                        required_from_hk = same_piece_state_hk.get("required_from")

                        # İlk hızlı kaçış hamlesi bitti → aynı taşla 2. hamle var mı?
                        if not required_from_hk:
                            next_same_from_hk = to_sq

                            temp_board_hk = board.copy(stack=False)
                            temp_board_hk.turn = chess.WHITE if player_id == white_pid else chess.BLACK

                            candidate_legal_hk = [
                                m.uci() for m in temp_board_hk.legal_moves
                                if chess.square_name(m.from_square) == next_same_from_hk
                            ]

                            if candidate_legal_hk:
                                same_piece_state_hk["required_from"] = next_same_from_hk
                                same_piece_forced_legal_hk = candidate_legal_hk
                                board.turn = chess.WHITE if player_id == white_pid else chess.BLACK
                                san_move += " (+aynı taş)"
                                continue_my_turn_hk = True
                                print(f"[SATRANC IKI_HAMLE][HIZLI_KACIS] pid={player_id} ilk={from_sq}->{to_sq} ikinci_legal={candidate_legal_hk}")
                            else:
                                same_piece_double_hk.pop(player_id, None)
                                san_move += " (aynı taşla devam hamlesi yok)"
                                print(f"[SATRANC IKI_HAMLE][HIZLI_KACIS] pid={player_id} {next_same_from_hk} için ikinci hamle yok")
                        else:
                            # Zaten ikinci hamle yapıldıysa efekt bitsin
                            same_piece_double_hk.pop(player_id, None)
                            print(f"[SATRANC IKI_HAMLE][HIZLI_KACIS] pid={player_id} ikinci hamle tamamlandı: {from_sq}->{to_sq}")

                    # Hakkını Bana Ver vb. ekstra hamle
                    if not continue_my_turn_hk and extra_move_hk.get(player_id):
                        board.turn = not board.turn
                        extra_move_hk.pop(player_id, None)
                        san_move += " (+1)"
                        continue_my_turn_hk = True

                    board_state = board_to_dict(board)
                    next_pid = black_pid if player_id == white_pid else white_pid
                    next_legal = same_piece_forced_legal_hk if same_piece_forced_legal_hk is not None else get_legal_moves(board)

                    await broadcast(room, {
                        "type": "satranc_board_update",
                        "board": board_state,
                        "last_move": uci_move,
                        "san_move": san_move,
                        "mover_id": player_id,
                        "clocks": {str(p): room["satranc_clocks"].get(p, 0) for p in room["satranc_clocks"]},
                        "effects": get_effect_state(room),
                        "iki_hamle_active": continue_my_turn_hk,
                        "captured_pieces": get_captured_pieces_payload(room),
                    })

                    if continue_my_turn_hk:
                        my_ws_hk = room["players"].get(player_id, {}).get("ws")
                        if my_ws_hk:
                            await safe_send(my_ws_hk, {
                                "type": "satranc_your_turn",
                                "legal_moves": next_legal,
                                "is_check": board.is_check(),
                            })
                    else:
                        next_ws = room["players"].get(next_pid, {}).get("ws")
                        if next_ws:
                            await safe_send(next_ws, {
                                "type": "satranc_your_turn",
                                "legal_moves": next_legal,
                                "is_check": board.is_check(),
                            })

                    print(f"[SATRANC HIZLI KACIS] {room['players'][player_id]['name']} vezir gibi hareket: {from_sq}→{to_sq}")
                    return {"handled": True, "room_code": room_code, "player_id": player_id}

                # Hızlı Kaçış aktif ama geçersiz hedef → hata
                await safe_send(websocket, {
                    "type": "error",
                    "message": "🌪️ Hızlı Kaçış: Şah yatay/dikey/çapraz gidebilir (arada engel olmadan) - Geçersiz hedef!"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ KALKANLI ŞAH ÖZEL AKIŞ - şah kalkanlıysa tehdit kontrolü by-pass, 1 kare herhangi bir yöne
            shielded_check = room.get("satranc_shielded", {})
            if is_king_move and from_sq in shielded_check:
                target_piece_at_dest = board.piece_at(move.to_square)
                dist = chebyshev_distance(from_sq, to_sq)

                # Kalkanlı şah: 1 kare herhangi bir yöne, tehdit altında olsa bile
                if dist == 1 and (not target_piece_at_dest or target_piece_at_dest.color != moving_piece.color):
                    # Rakip taşı yediyse captured'a ekle
                    if target_piece_at_dest and target_piece_at_dest.piece_type != chess.KING:
                        captured_list = room["satranc_captured_pieces"].setdefault(player_id, [])
                        piece_symbol = target_piece_at_dest.symbol().lower()
                        piece_color_str = "w" if target_piece_at_dest.color == chess.WHITE else "b"
                        captured_list.append({"type": piece_symbol, "color": piece_color_str})

                    # Manuel hamle
                    board.remove_piece_at(move.from_square)
                    if target_piece_at_dest:
                        board.remove_piece_at(move.to_square)
                    board.set_piece_at(move.to_square, moving_piece)
                    board.turn = not board.turn
                    san_move = f"K{to_sq}(Kalkan)"
                    room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
                    decrement_effect_counters(room, mover_pid=player_id)
                    # Kalkan efekti şaha ait, from_sq → to_sq taşınmalı
                    for effect_key in ["satranc_shielded", "satranc_frozen", "satranc_invisible", "satranc_locked"]:
                        effects = room.get(effect_key, {})
                        if from_sq in effects:
                            effects[to_sq] = effects.pop(from_sq)
                    # Kalkan sayacını -1
                    sh_dict_check = room.get("satranc_shielded", {})
                    if to_sq in sh_dict_check:
                        sh_dict_check[to_sq] -= 1
                        if sh_dict_check[to_sq] <= 0:
                            del sh_dict_check[to_sq]

                    # Increment ekle
                    time_mode_sh = room.get("satranc_time_mode", "blitz")
                    tm_sh = TIME_MODES.get(time_mode_sh, TIME_MODES["blitz"])
                    if tm_sh["increment"] > 0 and time_mode_sh != "suresiz":
                        clocks_sh = room.get("satranc_clocks", {})
                        if player_id in clocks_sh:
                            clocks_sh[player_id] += tm_sh["increment"]

                    print(f"[SATRANC KALKAN ŞAH] Hamle sonrası shielded: {room.get('satranc_shielded', {})}")
                    # ✨ İKİ HAMLE KONTROLÜ (kalkanlı şah da aynı taşla 2. hamle yapabilmeli)
                    iki_hamle_2nd_shield = False
                    same_piece_double_sh = room.get("satranc_same_piece_double", {})
                    same_piece_state_sh = same_piece_double_sh.get(player_id)
                    extra_move_sh = room.get("satranc_extra_move", {})
                    
                    if same_piece_state_sh and same_piece_state_sh.get("active"):
                        required_from_sh = same_piece_state_sh.get("required_from")
                        if not required_from_sh:
                            # İlk hamle bitti, ikinci hamle aynı taşla
                            same_piece_state_sh["required_from"] = to_sq
                            board.turn = not board.turn  # Sıra tekrar bende
                            san_move += " (+aynı taş)"
                            iki_hamle_2nd_shield = True
                        else:
                            # 2. hamle de yapıldı
                            same_piece_double_sh.pop(player_id, None)
                    elif extra_move_sh.get(player_id):
                        board.turn = not board.turn  # Sıra tekrar bende
                        extra_move_sh.pop(player_id, None)
                        san_move += " (+1)"
                        iki_hamle_2nd_shield = True

                    board_state = board_to_dict(board)
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
                        "captured_pieces": get_captured_pieces_payload(room),
                        "iki_hamle_active": iki_hamle_2nd_shield,
                    })
                    
                    if iki_hamle_2nd_shield:
                        # Sıra hâlâ bende
                        my_ws_sh = room["players"].get(player_id, {}).get("ws")
                        if my_ws_sh:
                            await safe_send(my_ws_sh, {
                                "type": "satranc_your_turn",
                                "legal_moves": next_legal,
                                "is_check": board.is_check(),
                            })
                    else:
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
            decrement_effect_counters(room, mover_pid=player_id)
            
            # ✨ HAYALET TAŞLARI GERİ GETİR (Yok Say jokeri - süresi dolanları)
            ignored_state = room.get("satranc_ignored", {})
            current_mc = room.get("satranc_move_count", 0)
            expired_ignored = []
            for ig_sq, ig_data in list(ignored_state.items()):
                if current_mc >= ig_data.get("expires_move_count", 0):
                    # Süresi doldu, taşı geri getir (eğer o kare boşsa)
                    try:
                        ig_sq_idx = chess.parse_square(ig_sq)
                        if board.piece_at(ig_sq_idx) is None:
                            # Kare boş, taşı geri koy
                            restored_piece = chess.Piece(
                                ig_data["piece_type"],
                                chess.WHITE if ig_data["piece_color"] == "w" else chess.BLACK
                            )
                            board.set_piece_at(ig_sq_idx, restored_piece)
                            print(f"[SATRANC YOKSAY] {ig_sq} hayalet süresi doldu, taş geri geldi")
                        else:
                            # Kareye başka taş taşınmış, geri gelemiyor
                            print(f"[SATRANC YOKSAY] {ig_sq} hayalet süresi doldu ama kare dolu, taş yok oldu")
                    except Exception as e:
                        print(f"[SATRANC YOKSAY GERİ GETİRME HATA] {e}")
                    expired_ignored.append(ig_sq)
            for ig_sq in expired_ignored:
                del ignored_state[ig_sq]

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

            # ✨ Hedef karede kilitli/kalkanlı/donmuş taş varsa ve YENİLDİYSE efekti sil
            if captured_piece:
                for eff_key_kill in ["satranc_shielded", "satranc_frozen", "satranc_locked"]:
                    eff_dict_kill = room.get(eff_key_kill, {})
                    if to_sq in eff_dict_kill:
                        del eff_dict_kill[to_sq]
                        print(f"[SATRANC EFEKT SİLİNDİ] {eff_key_kill}: {to_sq} (taş yenildi)")
                if to_sq in room.get("satranc_ajan_disguised", {}):
                    del room["satranc_ajan_disguised"][to_sq]

            # Taşın taşındığı efektleri güncelle (kaynak → hedef)
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

            # ✨ KİLİTLİ TAŞLAR - SADECE o kilitli taş hareket ederse sayaç düşer
            # Not: efekt yukarıda from_sq → to_sq taşındı, yani to_sq'da locked varsa hareket etmiş demektir
            lk_dict = room.get("satranc_locked", {})
            if to_sq in lk_dict:
                lk_dict[to_sq] -= 1
                print(f"[SATRANC LOCKED SAYAÇ] {to_sq}: {lk_dict[to_sq]} tur kaldı")
                if lk_dict[to_sq] <= 0:
                    del lk_dict[to_sq]
                    print(f"[SATRANC LOCKED BİTTİ] {to_sq}")

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
            # ✨ KALKANLI ŞAH KONTROLÜ - eğer kaybeden tarafın şahı kalkanlıysa, mat sayılmaz
            shielded_check_gameover = room.get("satranc_shielded", {})
            loser_color_check = board.turn  # sıra kimdeyse o kaybedecek (mat durumunda)
            loser_king_sq = None
            for sq_check in chess.SQUARES:
                p_check = board.piece_at(sq_check)
                if p_check and p_check.piece_type == chess.KING and p_check.color == loser_color_check:
                    loser_king_sq = chess.square_name(sq_check)
                    break

            if board.is_checkmate() and loser_king_sq and loser_king_sq in shielded_check_gameover:
                # ✨ Şah kalkanlı, mat sayılmaz - oyun devam
                print(f"[SATRANC MAT ENGELLENDI] Şah kalkanlı ({loser_king_sq}), oyun devam!")
                # Boş bir bildirim gönder, normal akışa devam et
                # (aslında bu duruma pek gelinemez çünkü kalkanlı şah her yere gidebilir)
                # Alt akışa devam ediyoruz - board_state gönderiliyor
                pass
            else:
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
                "sansur_state": {str(p): room.get("satranc_sansur", {}).get(p, 0) for p in room["players"]},
            }
            # ✨ Görünmez taş yenildiyse frontend'e bildir (flash animasyonu için)
            if captured_invisible_owner is not None:
                # captured_piece = board.piece_at(move.to_square) idi push'tan önce
                # push sonrası board'da o taş yok ama captured_piece variable'ında hâlâ var
                reveal_type = None
                reveal_color = None
                if captured_piece:
                    reveal_type = captured_piece.symbol().lower()
                    reveal_color = "w" if captured_piece.color == chess.WHITE else "b"
                payload["invisible_revealed_kill"] = {
                    "square": to_sq,
                    "owner_id": captured_invisible_owner,
                    "piece_type": reveal_type,
                    "piece_color": reveal_color,
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

        # ⏱️ EKSTRA SÜRE (kendi saatine +120sn)
        if joker_id == "ekstra_sure":
            time_mode = room.get("satranc_time_mode", "blitz")
            if time_mode == "suresiz":
                await safe_send(websocket, {
                    "type": "error",
                    "message": "Süresiz modda Ekstra Süre kullanılamaz!"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            clocks = room.get("satranc_clocks", {})
            if player_id not in clocks:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "Saat verisi bulunamadı."
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            clocks[player_id] += 120
            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"⏱️ {room['players'][player_id]['name']} kendi süresine 2 dakika ekledi!",
                "clocks": {str(p): clocks[p] for p in clocks},
            })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Ekstra Süre (+120sn)")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ⏰ ZAMAN ÇAL
        if joker_id == "zaman_cal":
            white_pid = room.get("satranc_white")
            black_pid = room.get("satranc_black")
            opp_pid = black_pid if player_id == white_pid else white_pid

            # ✨ YANSIMA kontrolü
            final_attacker, final_victim, reflected = _check_and_consume_yansima(
                room, player_id, opp_pid
            )
            if reflected:
                await _notify_yansima(room, player_id, joker_info["name"], joker_info["icon"], safe_send)
                # Rolleri değiştir: saldıran kendi olmalı ama kurban değişti
                zaman_victim = final_victim  # aslında player_id kendisi
            else:
                zaman_victim = opp_pid

            clocks = room.get("satranc_clocks", {})
            if zaman_victim in clocks:
                # Süresiz modda çalışmaz
                time_mode = room.get("satranc_time_mode", "blitz")
                if time_mode == "suresiz":
                    await safe_send(websocket, {
                        "type": "error",
                        "message": "Süresiz modda Zaman Çal kullanılamaz!"
                    })
                    return {"handled": True, "room_code": room_code, "player_id": player_id}

                old_time = clocks[zaman_victim]
                clocks[zaman_victim] = max(1, clocks[zaman_victim] - 30)
                stolen = old_time - clocks[zaman_victim]

                # Kullanıldı olarak işaretle
                used.append(joker_id)

                msg_text = f"{room['players'][player_id]['name']} rakipten {stolen} saniye çaldı! ⏰"
                if reflected:
                    msg_text = f"🌀 YANSIMA! {room['players'][player_id]['name']} kendi süresinden {stolen} saniye kaybetti!"

                await broadcast(room, {
                    "type": "satranc_joker_used",
                    "joker_id": joker_id,
                    "joker_name": joker_info["name"],
                    "joker_icon": joker_info["icon"],
                    "user_id": player_id,
                    "user_name": room["players"][player_id]["name"],
                    "target_id": zaman_victim,
                    "target_name": room["players"][zaman_victim]["name"],
                    "message": msg_text,
                    "clocks": {str(p): clocks[p] for p in clocks},
                })

                print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Zaman Çal ({stolen}sn) reflected={reflected}")

                return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🔄 GERİ AL (YENİ MANTIK)
        # ==========================================
        if joker_id == "geri_al":
            if len(board.move_stack) == 0:
                await safe_send(websocket, {"type": "error", "message": "Geri Al: Henüz hamle yapılmadı."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            undo_moves = []
            opp_pid_undo = black_pid if player_id == white_pid else white_pid

            # ✨ SADECE 1 HAMLE GERİ AL - RAKİBİN SON HAMLESİ
            # Şu an sıra bende (Geri Al kullanıyorum) demek ki son hamle rakibin.
            rakip_move = board.pop()
            # pop sonrası taş tahtaya geri geldi. Captured listesinden de silelim:
            rollback_captured_for_undo(room, board, rakip_move, opp_pid_undo)
            undo_moves.append(rakip_move.uci())

            # ✨ SIRA BENDE KALIR (Geri Al kullanan kendi hamlesini yapacak)
            # board.pop() turn'ü değiştirir, o yüzden zorla kendime çevir
            my_color_chess = chess.WHITE if player_id == white_pid else chess.BLACK
            board.turn = my_color_chess

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
                "message": f"{room['players'][player_id]['name']} rakibin son hamlesini geri aldı! 🔄 Şimdi kendisi oynayacak.",
                "board": board_state,
                "undo_moves": undo_moves,
                "undo_count": len(undo_moves),
                "effects": get_effect_state(room),
                "captured_pieces": get_captured_pieces_payload(room),
            })

            # ✨ Sıra BENDE (Geri Al kullanan), kendime legal moves gönder
            await safe_send(websocket, {
                "type": "satranc_your_turn",
                "legal_moves": legal_moves,
                "is_check": board.is_check(),
            })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Geri Al (rakibin hamlesi geri alındı, sıra kendisinde)")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Son hamlenin RAKİBİN olduğunu kontrol et
            # move_stack'in son elemanı, henüz applied olan hamle
            # board.turn şu an bize dönmüş, demek ki son hamleyi rakip yapmış

            # Son hamle rakibin hamlesi.
            # Rakip bizim taşımızı yemiş olsa bile Geri Al buna izin verir:
            # board.pop() yenilen taşı tahtaya geri getirir,
            # rollback_captured_for_undo() da captured panelini geri sarar.
            last_move = board.move_stack[-1]

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
                    exclude_set.update({"zaman_cal", "zamani_durdur", "ekstra_sure"})

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
                    "message": f"🎁 Yeni joker kazandın: {get_public_joker_info(new_jokers_for_me)['name']}!",
                    "source": "karsilikli_ekstra"
                })

            # Rakibe: sadece +1 bildirimi (jokeri gizli)
            opp_pid = black_pid if player_id == white_pid else white_pid
            opp_ws = room["players"].get(opp_pid, {}).get("ws")
            if opp_ws and new_jokers_for_opp:
                opp_info = get_public_joker_info(new_jokers_for_opp)
                await safe_send(opp_ws, {
                    "type": "satranc_new_joker_gained",
                    "new_joker": opp_info,
                    "message": f"🎁 Rakip Karşılıklı Ekstra Joker kullandı, sen de yeni joker kazandın: {opp_info['name']}!",
                    "source": "karsilikli_ekstra"
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
        # 📦 KASA - CS:GO tarzı kasa aç, rastgele joker
        # ==========================================
        if joker_id == "kasa":
            # Havuzdan rastgele joker seç
            exclude_set = {"kasa", "once_basla"}
            time_mode_check = room.get("satranc_time_mode", "blitz")
            if time_mode_check == "suresiz":
                exclude_set.update({"zaman_cal", "zamani_durdur", "ekstra_sure"})

            current_jokers = room["satranc_jokers"].get(player_id, [])
            already_have = set(current_jokers)

            # Sahip olmadığın implemented jokerler
            available = [j for j in JOKERS
                         if j["id"] not in already_have
                         and j["id"] not in exclude_set
                         and j.get("implemented", False)]

            if not available:
                # Hepsine sahipsen sahip olduklarından ver
                available = [j for j in JOKERS
                             if j["id"] not in exclude_set
                             and j.get("implemented", False)]

            if not available:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "📦 Kasada verilecek joker kalmadı!"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Sonucu belirle
            winner_joker = random.choice(available)
            winner_info = get_public_joker_info(winner_joker["id"])

            # Animasyon için "rulet listesi" hazırla (25-30 kart)
            # Ortadaki (index 20) kazanan olacak
            reel_size = 25
            winner_index = 20  # Ortada duracak
            reel = []
            for i in range(reel_size):
                if i == winner_index:
                    reel.append(winner_info)
                else:
                    # Rastgele başka jokerler (görsel için)
                    rand_j = random.choice(JOKERS)
                    reel.append(get_public_joker_info(rand_j["id"]))

            # Yeni jokeri oyuncuya ver
            current_jokers.append(winner_joker["id"])
            room["satranc_jokers"][player_id] = current_jokers

            used.append(joker_id)

            # Herkese kasa animasyonu gönder (rakip de izler)
            await broadcast(room, {
                "type": "satranc_kasa_animation",
                "reel": reel,
                "winner_index": winner_index,
                "winner_joker": winner_info,
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
            })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Kasa açtı: {winner_joker['id']}")
            return {"handled": True, "room_code": room_code, "player_id": player_id}    

        # ==========================================
        # 👁️ JOKER GÖR
        # ==========================================
        if joker_id == "joker_gor":
            white_pid = room.get("satranc_white")
            black_pid = room.get("satranc_black")
            opp_pid = black_pid if player_id == white_pid else white_pid

            # ✨ YANSIMA kontrolü - rakip senin jokerlerini görür
            yansima_state = room.get("satranc_yansima", {})
            reflected_jg = False
            if yansima_state.get(opp_pid):
                yansima_state.pop(opp_pid, None)
                reflected_jg = True
                print(f"[SATRANC YANSIMA] Joker Gör yansıdı! Rakip senin jokerlerini görecek")

            if reflected_jg:
                # Rakip senin jokerlerini görsün
                viewer_pid = opp_pid
                target_pid = player_id
            else:
                viewer_pid = player_id
                target_pid = opp_pid

            target_jokers = room["satranc_jokers"].get(target_pid, [])
            target_used = room["satranc_used_jokers"].get(target_pid, [])

            revealed = []
            for jid in target_jokers:
                info = get_public_joker_info(jid)
                if info:
                    info["used"] = jid in target_used
                    revealed.append(info)

            used.append(joker_id)

            # Viewer'a panel gönder
            viewer_ws = room["players"].get(viewer_pid, {}).get("ws")
            if viewer_ws:
                await safe_send(viewer_ws, {
                    "type": "satranc_reveal_opp_jokers_panel",
                    "opponent_name": room["players"][target_pid]["name"],
                    "jokers": revealed,
                })

            # Target'a bildirim
            target_ws = room["players"].get(target_pid, {}).get("ws")
            if target_ws:
                if reflected_jg:
                    # Sen kullandın ama yansıdı, rakip senin jokerlerini gördü
                    await safe_send(target_ws, {
                        "type": "satranc_yansima_damage_popup",
                        "joker_name": joker_info["name"],
                        "joker_icon": joker_info["icon"],
                        "message": f"Rakip Yansıma kullandığı için {joker_info['icon']} {joker_info['name']} jokerin sana zarar verdi! Rakip senin jokerlerini gördü."
                    })
                else:
                    await safe_send(target_ws, {
                        "type": "satranc_toast_only",
                        "title": "👁️ Joker Gör",
                        "message": f"{room['players'][player_id]['name']} jokerlerini gördü!",
                        "toast_type": "warning"
                    })

            msg_text = f"👁️ {room['players'][player_id]['name']} rakibin jokerlerini gördü!"
            if reflected_jg:
                msg_text = f"🌀 YANSIMA! {room['players'][player_id]['name']} Joker Gör kullandı ama yansıdı - rakip onun jokerlerini gördü!"

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": msg_text,
            })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Joker Gör (reflected={reflected_jg})")
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
            # ✨ YANSIMA kontrolü - rakip ekstra hamle kazanır
            final_attacker, final_victim, reflected = _check_and_consume_yansima(
                room, player_id, opp_pid
            )
            if reflected:
                await _notify_yansima(room, player_id, joker_info["name"], joker_info["icon"], safe_send)
                extra_move_target = opp_pid  # rakip ekstra hamle alır
            else:
                extra_move_target = player_id

            extra_move = room.setdefault("satranc_extra_move", {})
            extra_move[extra_move_target] = True
            used.append(joker_id)

            msg_text = f"✋ {room['players'][player_id]['name']} Hakkını Bana Ver kullandı! Bu turda 2 hamle yapacak."
            if reflected:
                msg_text = f"🌀 YANSIMA! {room['players'][player_id]['name']} hediyeyi rakibe verdi! Rakip 2 hamle yapacak."

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": msg_text,
                "effects": get_effect_state(room),
            })

            # Sadece extra_move_target sırayı kullanacak - şu an sıra hâlâ player_id'de
            # Eğer reflected ise sıra bitince rakibe geçecek zaten (extra_move onda)
            # Eğer reflected değilse player_id 2. hamle yapacak
            legal_moves = get_legal_moves(board)
            await safe_send(websocket, {
                "type": "satranc_your_turn",
                "legal_moves": legal_moves,
                "is_check": board.is_check(),
            })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Hakkını Bana Ver reflected={reflected}")
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
        # 🔧 İYİLEŞTİR (bir aktif jokerin süresine +3 tur ekle)
        # ==========================================
        if joker_id == "iyilestir":
            target_effect = data.get("target_effect", "")  # örn "kalkan_a1", "sansur_opp"
            if not target_effect:
                # Aktif jokerleri listele ve popup için gönder
                active_list = _collect_active_boosts(room, player_id)
                if not active_list:
                    await safe_send(websocket, {
                        "type": "error",
                        "message": "🔧 Aktif iyileştirilebilecek bir jokerin yok."
                    })
                    return {"handled": True, "room_code": room_code, "player_id": player_id}

                await safe_send(websocket, {
                    "type": "satranc_iyilestir_menu",
                    "active_effects": active_list,
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Hedef efekt seçildi - +3 tur ekle
            boost_amount = 3
            success, applied_label = _apply_iyilestir(room, player_id, target_effect, boost_amount)
            if not success:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "🔧 Bu efekt artık aktif değil."
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            used.append(joker_id)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"🔧 {room['players'][player_id]['name']} '{applied_label}' jokerine +{boost_amount} tur ekledi!",
                "effects": get_effect_state(room),
                "sansur_state": {str(p): room.get("satranc_sansur", {}).get(p, 0) for p in room["players"]},
            })
            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → İyileştir ({target_effect} +{boost_amount})")
            return {"handled": True, "room_code": room_code, "player_id": player_id}    

        # ==========================================
        # ♻️ TAŞIMI GERİ VER
        # ==========================================
        if joker_id == "tasimi_geri_ver":
            # ✨ my_color'u burada tanımla (satranc_use_joker'da yok)
            my_color = chess.WHITE if player_id == white_pid else chess.BLACK

            # Rakibin BENDEN yediği taşlar = rakibin captured_pieces listesi
            captured_map = room.get("satranc_captured_pieces", {})
            # Rakip beni yiyor -> rakibin listesinde MY taşlarım var
            opp_captured_list = captured_map.get(opp_pid, [])

            # Sadece BENIM taşlarım (renk kontrolü)
            my_color_str = "w" if player_id == white_pid else "b"
            my_lost_pieces = [p for p in opp_captured_list
                              if p.get("color") == my_color_str and p.get("type") != "k"]

            if not my_lost_pieces:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "♻️ Rakip senden henüz taş yemedi, geri alınacak bir şey yok!"
                })
                # Joker kullanılmadı sayılsın, hemen çık
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Kullanıcı hangisini istediğini gönderdi mi?
            chosen_type = data.get("piece_type")  # "q", "r", "b", "n", "p"
            chosen_index = data.get("piece_index")  # kaçıncı? (aynı tipten çok varsa)

            if not chosen_type:
                # Menüyü gönder
                await safe_send(websocket, {
                    "type": "satranc_tasimi_geri_menu",
                    "lost_pieces": my_lost_pieces,
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Seçilen tipte taş var mı?
            matching = [i for i, p in enumerate(my_lost_pieces) if p.get("type") == chosen_type]
            if not matching:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "♻️ Bu taş listede yok!"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Yerleştirilecek kare bul
            piece_type_map = {
                "q": chess.QUEEN, "r": chess.ROOK, "b": chess.BISHOP,
                "n": chess.KNIGHT, "p": chess.PAWN
            }
            if chosen_type not in piece_type_map:
                await safe_send(websocket, {"type": "error", "message": "Geçersiz taş türü."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            my_pawn_rank = 2 if my_color_str == "w" else 7
            files = "abcdefgh"

            # Önce piyon satırında boş kare ara
            target_square = None
            for f in files:
                sq_name = f"{f}{my_pawn_rank}"
                sq_idx = chess.parse_square(sq_name)
                if board.piece_at(sq_idx) is None:
                    target_square = sq_idx
                    break

            # Boş yoksa yakın sıraya bak (3. sıra beyaz için, 6. siyah için)
            if target_square is None:
                fallback_rank = 3 if my_color_str == "w" else 6
                for f in files:
                    sq_name = f"{f}{fallback_rank}"
                    sq_idx = chess.parse_square(sq_name)
                    if board.piece_at(sq_idx) is None:
                        target_square = sq_idx
                        break

            # Hâlâ yoksa herhangi bir boş kare
            if target_square is None:
                for sq_idx in chess.SQUARES:
                    if board.piece_at(sq_idx) is None:
                        target_square = sq_idx
                        break

            if target_square is None:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "♻️ Yerleştirilecek boş kare yok!"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Taşı yerleştir
            board.set_piece_at(
                target_square,
                chess.Piece(piece_type_map[chosen_type], my_color)
            )

            # Rakibin captured listesinden kaldır (ilk eşleşen)
            for i, p in enumerate(opp_captured_list):
                if p.get("color") == my_color_str and p.get("type") == chosen_type:
                    opp_captured_list.pop(i)
                    break

            used.append(joker_id)

            # Hamle sayılır - sıra rakibe geç
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

            new_legal_moves = get_legal_moves(board)
            piece_names_tr = {"q": "Vezir", "r": "Kale", "b": "Fil", "n": "At", "p": "Piyon"}
            target_sq_name = chess.square_name(target_square)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"♻️ {room['players'][player_id]['name']} {piece_names_tr.get(chosen_type, 'Taş')}'ini geri aldı! ({target_sq_name.upper()}) - Sıra rakipte.",
                "board": board_to_dict(board),
                "target": target_sq_name,
                "effects": get_effect_state(room),
                "captured_pieces": get_captured_pieces_payload(room),
            })

            opp_ws = room["players"].get(opp_pid, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": new_legal_moves,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Taşımı Geri Ver ({chosen_type} → {target_sq_name})")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 💀 JOKER HIRSIZLIĞI
        # ==========================================
        if joker_id == "joker_hirsizligi":
            # ✨ YANSIMA kontrolü - rakip senden çalar
            final_attacker, final_victim, reflected = _check_and_consume_yansima(
                room, player_id, opp_pid
            )
            if reflected:
                await _notify_yansima(room, player_id, joker_info["name"], joker_info["icon"], safe_send)
                # Rakip senden çalar
                thief_pid = opp_pid
                victim_pid_h = player_id
            else:
                thief_pid = player_id
                victim_pid_h = opp_pid

            opp_jokers = room["satranc_jokers"].get(victim_pid_h, [])
            opp_used = room["satranc_used_jokers"].get(victim_pid_h, [])
            # Kullanılmamışlardan çal
            available = [j for j in opp_jokers if j not in opp_used and j != "joker_hirsizligi"]
            if not available:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "💀 Rakibin çalabileceğin bir jokeri yok."
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            stolen_id = random.choice(available)
            # victim'dan kaldır
            opp_jokers.remove(stolen_id)
            room["satranc_jokers"][victim_pid_h] = opp_jokers
            # thief'e ekle
            thief_jokers = room["satranc_jokers"].setdefault(thief_pid, [])
            thief_jokers.append(stolen_id)

            used.append(joker_id)  # her halükarda kullanıldı sayılır
            stolen_info = get_public_joker_info(stolen_id)

            thief_name = room["players"][thief_pid]["name"]
            victim_name = room["players"][victim_pid_h]["name"]

            # Hırsıza bildir
            thief_ws = room["players"].get(thief_pid, {}).get("ws")
            if thief_ws:
                await safe_send(thief_ws, {
                    "type": "satranc_new_joker_gained",
                    "new_joker": stolen_info,
                    "message": f"💀 {victim_name}'den çaldın: {stolen_info['name']}!"
                })

            # Kurbana bildir
            victim_ws = room["players"].get(victim_pid_h, {}).get("ws")
            if victim_ws:
                await safe_send(victim_ws, {
                    "type": "satranc_joker_stolen",
                    "stolen_joker": stolen_info,
                    "thief_name": thief_name,
                    "message": f"💀 {thief_name} '{stolen_info['name']}' jokerini çaldı!"
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
        # ⛔ SANSÜR - HAMLE SAYILIR
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

            # ✨ YANSIMA kontrolü - kendi sansürlenir
            final_attacker, final_victim, reflected = _check_and_consume_yansima(
                room, player_id, opp_pid
            )
            if reflected:
                await _notify_yansima(room, player_id, joker_info["name"], joker_info["icon"], safe_send)
                sansur_target = player_id
            else:
                sansur_target = opp_pid

            sansur_state = room.setdefault("satranc_sansur", {})
            sansur_state[sansur_target] = 3
            used.append(joker_id)

            # ✨ Sansür HAMLE SAYILIR - sıra rakibe geç
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

            new_legal_moves = get_legal_moves(board)

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"⛔ {room['players'][player_id]['name']} rakibi sansürledi! 3 tur joker kullanamayacak. Sıra rakipte.",
                "board": board_to_dict(board),
                "effects": get_effect_state(room),
                "sansur_state": {str(p): sansur_state.get(p, 0) for p in room["players"]},
                "captured_pieces": get_captured_pieces_payload(room),
            })

            opp_ws = room["players"].get(opp_pid, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": new_legal_moves,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Sansür - sıra rakibe")
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
                },
                "sansur_state": {str(p): room.get("satranc_sansur", {}).get(p, 0) for p in room["players"]},
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
    # JOKER HEDEF SORGULAMA (Dinamik Yasaklama)
    # ----------------------------------------
    if msg_type == "satranc_query_joker_targets":
        joker_id = data.get("joker_id")
        target1 = data.get("target1") # ilk seçilen kare
        
        room = rooms.get(room_code)
        if not room or not target1: return {"handled": True}
        
        board = room.get("satranc_game")
        if not board: return {"handled": True}
        
        white_pid = room.get("satranc_white")
        my_color = chess.WHITE if player_id == white_pid else chess.BLACK
        
        valid_targets = []
        
        if joker_id == "rakibi_isinla":
            # Target1 zaten seçildi, hangi Target2'ler şahı tehlikeye atmaz?
            t1_sq = chess.parse_square(target1)
            t1_piece = board.piece_at(t1_sq)
            
            for sq_idx in chess.SQUARES:
                t2_piece = board.piece_at(sq_idx)
                # Kriterler: Boş olmamalı, Şah olmamalı, Target1 ile aynı olmamalı
                if not t2_piece or t2_piece.piece_type == chess.KING or sq_idx == t1_sq:
                    continue
                
                # En az biri rakip taş olmalı
                if t1_piece.color == my_color and t2_piece.color == my_color:
                    continue
                
                # SİMÜLASYON: Yer değiştirince şah tehlikeye giriyor mu?
                board.remove_piece_at(t1_sq)
                board.remove_piece_at(sq_idx)
                board.set_piece_at(t1_sq, t2_piece)
                board.set_piece_at(sq_idx, t1_piece)
                
                temp_turn = board.turn
                board.turn = my_color
                if not board.is_check():
                    valid_targets.append(chess.square_name(sq_idx))
                board.turn = temp_turn
                
                # GERİ AL
                board.remove_piece_at(t1_sq)
                board.remove_piece_at(sq_idx)
                board.set_piece_at(t1_sq, t1_piece)
                board.set_piece_at(sq_idx, t2_piece)

        await safe_send(websocket, {
            "type": "satranc_joker_valid_targets",
            "joker_id": joker_id,
            "valid_targets": valid_targets
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

        # ✨ EFEKT ÇAKIŞMA KONTROLÜ — bir taşta zaten aktif efekt varsa yeni efekt eklenemez
        # Klon jokeri de aynı listede: efektli taş klonlanamaz
        efekt_jokerler = ["kalkan", "dondur", "kilitle", "gorunmez", "ajan", "klon"]
        if joker_id in efekt_jokerler:
            has_shield = target1 in room.get("satranc_shielded", {})
            has_frozen = target1 in room.get("satranc_frozen", {})
            has_locked = target1 in room.get("satranc_locked", {})
            has_invisible = target1 in room.get("satranc_invisible", {})
            has_ajan = target1 in room.get("satranc_ajan_disguised", {})

            active_effects = []
            if has_shield: active_effects.append("🛡️ Kalkan")
            if has_frozen: active_effects.append("🧊 Dondur")
            if has_locked: active_effects.append("⛓️ Kilitle")
            if has_invisible: active_effects.append("🧙 Görünmez")
            if has_ajan: active_effects.append("🕵️ Ajan")

            if active_effects:
                effect_list = ", ".join(active_effects)
                extra_msg = "Önce süresi bitsin!"
                if joker_id == "klon":
                    extra_msg = "Efektli taşlar klonlanamaz!"
                await safe_send(websocket, {
                    "type": "error",
                    "message": f"⚠️ Bu taşta zaten aktif efekt var: {effect_list}. {extra_msg}"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

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
            decrement_effect_counters(room, mover_pid=player_id)

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
        # 🛡️ KALKAN - HAMLE SAYILIR
        # ==========================================
        if joker_id == "kalkan":
            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Boş kare seçtin."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color != my_color:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            shielded = room.setdefault("satranc_shielded", {})
            shielded[target1] = 4
            used.append(joker_id)

            # ✨ Kalkan HAMLE SAYILIR - sıra rakibe geç
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

            new_legal_moves = get_legal_moves(board)
            opp_pid_kl = black_pid if player_id == white_pid else white_pid

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} taşına kalkan verdi! 🛡️ ({target1}) - Sıra rakipte.",
                "target": target1,
                "board": board_to_dict(board),
                "effects": get_effect_state(room),
                "captured_pieces": get_captured_pieces_payload(room),
            })

            opp_ws = room["players"].get(opp_pid_kl, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": new_legal_moves,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Kalkan ({target1}) - sıra rakibe")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🧊 DONDUR - HAMLE SAYILIR
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

            # ✨ YANSIMA kontrolü - kendi rastgele taşın donar
            opp_pid_dz = black_pid if player_id == white_pid else white_pid
            yansima_state = room.get("satranc_yansima", {})
            if yansima_state.get(opp_pid_dz):
                yansima_state.pop(opp_pid_dz, None)
                # Kendi rastgele taşını bul (şah hariç)
                my_pieces = []
                for sq_idx in chess.SQUARES:
                    p = board.piece_at(sq_idx)
                    if p and p.color == my_color and p.piece_type != chess.KING:
                        my_pieces.append(sq_idx)
                if my_pieces:
                    new_target_sq = random.choice(my_pieces)
                    target1_sq = new_target_sq
                    target1 = chess.square_name(new_target_sq)
                    await _notify_yansima(room, player_id, joker_info["name"], joker_info["icon"], safe_send)
                    print(f"[SATRANC YANSIMA] Dondur yansıdı! Yeni hedef: {target1}")

            frozen = room.setdefault("satranc_frozen", {})
            frozen[target1] = 3  # 3 tur
            used.append(joker_id)

            # ✨ Dondur HAMLE SAYILIR - sıra rakibe geç
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

            new_legal_moves = get_legal_moves(board)
            opp_pid_d = black_pid if player_id == white_pid else white_pid

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} rakip taşını dondurdu! 🧊 ({target1}) - Sıra rakipte.",
                "target": target1,
                "board": board_to_dict(board),
                "effects": get_effect_state(room),
                "captured_pieces": get_captured_pieces_payload(room),
            })

            opp_ws = room["players"].get(opp_pid_d, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": new_legal_moves,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Dondur ({target1}) - sıra rakibe")
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

            # ✨ PIYON PROMOSYON KONTROLÜ - Işınlama sonrası piyon son sıraya geldiyse
            if piece_to_move.piece_type == chess.PAWN:
                target2_rank = chess.square_rank(target2_sq)
                if (my_color == chess.WHITE and target2_rank == 7) or \
                   (my_color == chess.BLACK and target2_rank == 0):
                    my_captured = room.get("satranc_captured_pieces", {}).get(player_id, [])

                    room["satranc_pending_promotion"] = {
                        "pid": player_id,
                        "from": target1,
                        "to": target2,
                        "source": "isinlan"
                    }

                    await broadcast(room, {
                        "type": "satranc_joker_used",
                        "joker_id": joker_id,
                        "joker_name": joker_info["name"],
                        "joker_icon": joker_info["icon"],
                        "user_id": player_id,
                        "user_name": room["players"][player_id]["name"],
                        "message": f"{room['players'][player_id]['name']} taşını ışınladı! 🔮 ({target1} → {target2}) - Promosyon seçiliyor.",
                        "board": board_to_dict(board),
                        "effects": get_effect_state(room),
                        "captured_pieces": get_captured_pieces_payload(room),
                    })

                    await safe_send(websocket, {
                        "type": "satranc_promotion_needed",
                        "from": target1,
                        "to": target2,
                        "captured_pieces": my_captured,
                    })

                    print(f"[SATRANC] Işınlama sonrası piyon promosyon isteniyor: {target2}")
                    return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ Işınlanma HAMLE SAYILIR - sıra rakibe geç
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

            new_legal_moves = get_legal_moves(board)
            opp_pid_is = black_pid if player_id == white_pid else white_pid

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} taşını ışınladı! 🔮 ({target1} → {target2}) - Sıra rakipte.",
                "board": board_to_dict(board),
                "effects": get_effect_state(room),
                "captured_pieces": get_captured_pieces_payload(room),
            })

            # ✨ Sıra rakipte, ona legal moves gönder
            opp_ws = room["players"].get(opp_pid_is, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": new_legal_moves,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Işınlanma ({target1} → {target2}) - sıra rakibe")
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
            # ✨ Kendi taşına atılamasın
            if target1_piece.color == my_color:
                await safe_send(websocket, {"type": "error", "message": "💣 Kendi taşına bomba atamazsın!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ KALKANLI TAŞA BOMBA → taş patlamaz, kalkan 1 azalır
            shielded_bomb = room.get("satranc_shielded", {})
            if target1 in shielded_bomb:
                shielded_bomb[target1] -= 1
                shield_msg = ""
                if shielded_bomb[target1] <= 0:
                    del shielded_bomb[target1]
                    shield_msg = "Kalkan kırıldı!"
                else:
                    shield_msg = f"Kalkan dayanıyor! ({shielded_bomb[target1]} tur kaldı)"

                used.append(joker_id)

                board.turn = not board.turn
                room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
                decrement_effect_counters(room, mover_pid=player_id)

                opp_pid_bs = black_pid if player_id == white_pid else white_pid

                await broadcast(room, {
                    "type": "satranc_joker_used",
                    "joker_id": joker_id,
                    "joker_name": joker_info["name"],
                    "joker_icon": joker_info["icon"],
                    "user_id": player_id,
                    "user_name": room["players"][player_id]["name"],
                    "message": f"💣 {room['players'][player_id]['name']} bomba attı ama 🛡️ kalkan korudu! {shield_msg} Sıra rakipte.",
                    "board": board_to_dict(board),
                    "explosion_square": target1,
                    "effects": get_effect_state(room),
                    "captured_pieces": get_captured_pieces_payload(room),
                })

                opp_ws_bs = room["players"].get(opp_pid_bs, {}).get("ws")
                if opp_ws_bs:
                    await safe_send(opp_ws_bs, {
                        "type": "satranc_your_turn",
                        "legal_moves": get_legal_moves(board),
                        "is_check": board.is_check(),
                    })

                print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Bomba vs Kalkan ({target1}) - {shield_msg}")
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Taş bilgisi
            piece_names = {
                chess.PAWN: "Piyon", chess.ROOK: "Kale", chess.KNIGHT: "At",
                chess.BISHOP: "Fil", chess.QUEEN: "Vezir", chess.KING: "Şah"
            }
            piece_name = piece_names.get(target1_piece.piece_type, "Taş")
            piece_color = "beyaz" if target1_piece.color == chess.WHITE else "siyah"

            # ✨ YANSIMA kontrolü - kendi aynı türden taşı patlar
            reflected_bomb = False
            opp_pid_bx = black_pid if player_id == white_pid else white_pid
            if target1_piece.color != my_color:  # rakip taşı bombalıyor
                yansima_state = room.get("satranc_yansima", {})
                if yansima_state.get(opp_pid_bx):
                    yansima_state.pop(opp_pid_bx, None)
                    reflected_bomb = True
                    print(f"[SATRANC YANSIMA] Bomba yansıdı! Aynı tür ({piece_name}) kendi taşı aranıyor")

            if reflected_bomb:
                # Aynı türden kendi taşını bul
                same_type_squares = []
                for sq_idx in chess.SQUARES:
                    p = board.piece_at(sq_idx)
                    if p and p.color == my_color and p.piece_type == target1_piece.piece_type:
                        same_type_squares.append(sq_idx)

                if same_type_squares:
                    # Aynı türden bir taşı rastgele seç
                    new_victim_sq = random.choice(same_type_squares)
                    target1_sq = new_victim_sq
                    target1_piece = board.piece_at(new_victim_sq)
                    target1 = chess.square_name(new_victim_sq)
                    piece_color = "beyaz" if my_color == chess.WHITE else "siyah"
                    await _notify_yansima(room, player_id, joker_info["name"], joker_info["icon"], safe_send)
                else:
                    # Aynı türden yoksa herhangi bir taşını rastgele (şah hariç)
                    my_pieces_any = []
                    for sq_idx in chess.SQUARES:
                        p = board.piece_at(sq_idx)
                        if p and p.color == my_color and p.piece_type != chess.KING:
                            my_pieces_any.append(sq_idx)
                    if my_pieces_any:
                        new_victim_sq = random.choice(my_pieces_any)
                        target1_sq = new_victim_sq
                        target1_piece = board.piece_at(new_victim_sq)
                        target1 = chess.square_name(new_victim_sq)
                        piece_name = piece_names.get(target1_piece.piece_type, "Taş")
                        piece_color = "beyaz" if my_color == chess.WHITE else "siyah"
                        await _notify_yansima(room, player_id, joker_info["name"], joker_info["icon"], safe_send)
                    else:
                        await safe_send(websocket, {"type": "error", "message": "🌀 Yansıma tetiklendi ama patlatacak taşın yok!"})
                        return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ Rakip taşını bombaladıysak captured_pieces'a ekle (yediğim sayılsın)
            if not reflected_bomb and target1_piece.color != my_color:
                captured_list = room["satranc_captured_pieces"].setdefault(player_id, [])
                piece_symbol = target1_piece.symbol().lower()
                piece_color_str = "w" if target1_piece.color == chess.WHITE else "b"
                captured_list.append({"type": piece_symbol, "color": piece_color_str})
                print(f"[SATRANC BOMBA CAPTURED] pid={player_id} bomba ile yedi: {piece_color_str}{piece_symbol}")

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
            decrement_effect_counters(room, mover_pid=player_id)

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
                "captured_pieces": get_captured_pieces_payload(room),
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

            # ✨ Klon HAMLE SAYILIR - sıra rakibe geç
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

            new_legal_moves = get_legal_moves(board)
            opp_pid_k = black_pid if player_id == white_pid else white_pid

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} taşını klonladı! 🎭 ({target1} → {target2}) - Sıra rakipte.",
                "board": board_to_dict(board),
                "effects": get_effect_state(room),
                "captured_pieces": get_captured_pieces_payload(room),
            })

            # ✨ Sıra rakipte, ona legal moves gönder
            opp_ws = room["players"].get(opp_pid_k, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": new_legal_moves,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Klon ({target1} → {target2}) - sıra rakibe")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # 🧙 GÖRÜNMEZ (5 tur, rakipten tamamen gizli) - HAMLE SAYILIR
        # ==========================================
        if joker_id == "gorunmez":
            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.color != my_color:
                await safe_send(websocket, {"type": "error", "message": "Kendi taşını seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            # ✨ Zaten ajansa engelle
            if target1 in room.get("satranc_ajan_disguised", {}):
                await safe_send(websocket, {"type": "error", "message": "⚠️ Bu taş zaten Ajan, üstüne Görünmez eklenemez!"})
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

            # ✨ Görünmez HAMLE SAYILIR - sıra rakibe geç
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

            new_legal_moves = get_legal_moves(board)

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
                    "message": f"🧙 Taşını görünmez yaptın! ({target1}) - 5 tur sürecek. Sıra rakipte.",
                    "target": target1,
                    "invisible_turns": 5,
                    "board": board_to_dict(board),
                    "effects": get_effect_state_for_player(room, player_id),
                    "captured_pieces": get_captured_pieces_payload(room),
                })

            # ✨ Rakibe özel: taşı FEN'den sil (görmesin) + sıra bilgisi
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
                    "captured_pieces": get_captured_pieces_payload(room),
                })
                # ✨ Sıra rakibe geçti bildirimi
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": new_legal_moves,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Görünmez ({target1}) - sıra rakibe")
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
                await safe_send(websocket, {"type": "error", "message": "Bir taş seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.piece_type == chess.KING:
                await safe_send(websocket, {"type": "error", "message": "Şahı dönüştüremezsin!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Kendi veya rakip taşı dönüştürebilir (şah hariç)
            piece_color = target1_piece.color
            board.set_piece_at(target1_sq, chess.Piece(type_map[new_type], piece_color))
            used.append(joker_id)

            type_names = {"q": "Vezir", "r": "Kale", "b": "Fil", "n": "At", "p": "Piyon"}
            type_icons = {"q": "♛", "r": "♜", "b": "♝", "n": "♞", "p": "♟"}

            opp_pid_t = black_pid if player_id == white_pid else white_pid

            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

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

            # ✨ YANSIMA kontrolü - kendi rastgele taşın taşınır
            opp_pid_rz = black_pid if player_id == white_pid else white_pid
            yansima_state = room.get("satranc_yansima", {})
            if yansima_state.get(opp_pid_rz):
                yansima_state.pop(opp_pid_rz, None)
                my_pieces = []
                for sq_idx in chess.SQUARES:
                    p = board.piece_at(sq_idx)
                    if p and p.color == my_color and p.piece_type != chess.KING:
                        my_pieces.append(sq_idx)
                if my_pieces:
                    new_target_sq = random.choice(my_pieces)
                    target1_sq = new_target_sq
                    target1_piece = board.piece_at(new_target_sq)
                    target1 = chess.square_name(new_target_sq)
                    await _notify_yansima(room, player_id, joker_info["name"], joker_info["icon"], safe_send)
                    print(f"[SATRANC YANSIMA] Rakip Taş Yerleştir yansıdı! Yeni kaynak: {target1}")

            piece_to_move = target1_piece
            board.remove_piece_at(target1_sq)
            board.set_piece_at(target2_sq, piece_to_move)

            # ✨ ŞAH TEHDİT KONTROLÜ - kendi şahım tehdit altına girecek mi?
            temp_turn = board.turn
            board.turn = my_color
            king_in_danger = board.is_check()
            board.turn = temp_turn

            if king_in_danger:
                # Geri al - taşı eski haline getir
                board.remove_piece_at(target2_sq)
                board.set_piece_at(target1_sq, piece_to_move)
                await safe_send(websocket, {
                    "type": "error",
                    "message": "🎯 Buraya yerleştiremezsin - şahın tehdit altına girer!"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            for effect_key in ["satranc_shielded", "satranc_frozen", "satranc_invisible", "satranc_locked"]:
                effects = room.get(effect_key, {})
                if target1 in effects:
                    effects[target2] = effects.pop(target1)

            used.append(joker_id)

            opp_pid_r = black_pid if player_id == white_pid else white_pid

            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

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
        # ⚡ RAKİBİ IŞINLA (target1 + target2 = herhangi 2 taş, şah hariç)
        # ==========================================
        if joker_id == "rakibi_isinla":
            if not target2:
                await safe_send(websocket, {"type": "error", "message": "2. taş seçmelisin."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            try:
                target2_sq = chess.parse_square(target2)
            except Exception:
                await safe_send(websocket, {"type": "error", "message": "Geçersiz kare."})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            target2_piece = board.piece_at(target2_sq)

            if not target1_piece or not target2_piece:
                await safe_send(websocket, {"type": "error", "message": "İki dolu kare seçmelisin!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1_piece.piece_type == chess.KING or target2_piece.piece_type == chess.KING:
                await safe_send(websocket, {"type": "error", "message": "⚡ Şahı ışınlayamazsın!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            if target1 == target2:
                await safe_send(websocket, {"type": "error", "message": "Aynı kareyi 2 kez seçemezsin!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}
            # ✨ En az 1 taş rakibin olmalı (2 kendi taş = Yer Değiştir işi)
            if target1_piece.color == my_color and target2_piece.color == my_color:
                await safe_send(websocket, {
                    "type": "error",
                    "message": "⚡ Rakibi Işınla: En az 1 tanesi rakip taş olmalı! (2 kendi taş için Yer Değiştir kullan)"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Yer değiştir
            board.remove_piece_at(target1_sq)
            board.remove_piece_at(target2_sq)
            board.set_piece_at(target1_sq, target2_piece)
            board.set_piece_at(target2_sq, target1_piece)

            # ✨ ŞAH TEHDİT KONTROLÜ - benim şahım tehdit altına girer mi?
            temp_turn = board.turn
            board.turn = my_color
            king_in_danger = board.is_check()
            board.turn = temp_turn

            if king_in_danger:
                # Geri al
                board.remove_piece_at(target1_sq)
                board.remove_piece_at(target2_sq)
                board.set_piece_at(target1_sq, target1_piece)
                board.set_piece_at(target2_sq, target2_piece)
                await safe_send(websocket, {
                    "type": "error",
                    "message": "⚡ Bu değişimle şahın tehdit altına giriyor!"
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Efektleri de değiştir
            for effect_key in ["satranc_shielded", "satranc_frozen", "satranc_invisible", "satranc_locked", "satranc_ajan_disguised"]:
                effects = room.get(effect_key, {})
                v1 = effects.pop(target1, None)
                v2 = effects.pop(target2, None)
                if v1 is not None:
                    effects[target2] = v1
                if v2 is not None:
                    effects[target1] = v2

            # Görünmez sahiplik bilgisi de takas
            inv_owners = room.get("satranc_invisible_owners", {})
            o1 = inv_owners.pop(target1, None)
            o2 = inv_owners.pop(target2, None)
            if o1 is not None:
                inv_owners[target2] = o1
            if o2 is not None:
                inv_owners[target1] = o2

            used.append(joker_id)

            # ✨ PIYON PROMOSYON - kendi VEYA rakibin piyonu son sıraya geldiyse
            promo_needed_sq = None
            promo_from_sq = None
            promo_owner_pid = None
            promo_owner_ws = None
            promo_captured = []

            for check_sq_name, check_sq_idx in [(target1, target1_sq), (target2, target2_sq)]:
                p_at = board.piece_at(check_sq_idx)
                if not p_at or p_at.piece_type != chess.PAWN:
                    continue

                rank = chess.square_rank(check_sq_idx)
                if (p_at.color == chess.WHITE and rank == 7) or (p_at.color == chess.BLACK and rank == 0):
                    promo_needed_sq = check_sq_name
                    promo_from_sq = target2 if check_sq_name == target1 else target1
                    # Piyonun sahibi kim?
                    promo_owner_pid = white_pid if p_at.color == chess.WHITE else black_pid
                    promo_owner_ws = room["players"].get(promo_owner_pid, {}).get("ws")
                    promo_captured = room.get("satranc_captured_pieces", {}).get(promo_owner_pid, [])
                    break

            if promo_needed_sq and promo_owner_pid and promo_owner_ws:
                room["satranc_pending_promotion"] = {
                    "pid": promo_owner_pid,
                    "from": promo_from_sq,
                    "to": promo_needed_sq,
                    "source": "rakibi_isinla",
                    "initiator_pid": player_id,
                }

                bekleme_text = "Promosyon seçiliyor." if promo_owner_pid == player_id else "Rakip promosyon seçiyor."

                await broadcast(room, {
                    "type": "satranc_joker_used",
                    "joker_id": joker_id,
                    "joker_name": joker_info["name"],
                    "joker_icon": joker_info["icon"],
                    "user_id": player_id,
                    "user_name": room["players"][player_id]["name"],
                    "message": f"⚡ {room['players'][player_id]['name']} Rakibi Işınla! ({target1} ↔ {target2}) - {bekleme_text}",
                    "board": board_to_dict(board),
                    "effects": get_effect_state(room),
                    "captured_pieces": get_captured_pieces_payload(room),
                })

                # Popup piyonun SAHİBİNE gönderilir (sen de olabilir, rakip de)
                await safe_send(promo_owner_ws, {
                    "type": "satranc_promotion_needed",
                    "from": promo_from_sq,
                    "to": promo_needed_sq,
                    "captured_pieces": promo_captured,
                })

                print(f"[SATRANC] Rakibi Işınla sonrası piyon promosyon: {promo_needed_sq} | owner_pid={promo_owner_pid}")
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Hamle sayılır - sıra rakibe
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

            new_legal_moves = get_legal_moves(board)
            opp_pid_ri = black_pid if player_id == white_pid else white_pid

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"⚡ {room['players'][player_id]['name']} Rakibi Işınla! ({target1} ↔ {target2}) - Sıra rakipte.",
                "board": board_to_dict(board),
                "effects": get_effect_state(room),
                "captured_pieces": get_captured_pieces_payload(room),
            })

            opp_ws = room["players"].get(opp_pid_ri, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": new_legal_moves,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Rakibi Işınla ({target1} ↔ {target2})")
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

            # ✨ PIYON PROMOSYON - piyon son sıraya geldiyse (iki taşta da kontrol)
            promo_needed_sq = None
            promo_from_sq = None
            for check_sq_name, check_sq_idx in [(target1, target1_sq), (target2, target2_sq)]:
                p_at = board.piece_at(check_sq_idx)
                if p_at and p_at.piece_type == chess.PAWN and p_at.color == my_color:
                    rank = chess.square_rank(check_sq_idx)
                    if (my_color == chess.WHITE and rank == 7) or (my_color == chess.BLACK and rank == 0):
                        promo_needed_sq = check_sq_name
                        promo_from_sq = target2 if check_sq_name == target1 else target1
                        break

            if promo_needed_sq:
                my_captured = room.get("satranc_captured_pieces", {}).get(player_id, [])

                room["satranc_pending_promotion"] = {
                    "pid": player_id,
                    "from": promo_from_sq,
                    "to": promo_needed_sq,
                    "source": "yer_degistir"
                }

                await broadcast(room, {
                    "type": "satranc_joker_used",
                    "joker_id": joker_id,
                    "joker_name": joker_info["name"],
                    "joker_icon": joker_info["icon"],
                    "user_id": player_id,
                    "user_name": room["players"][player_id]["name"],
                    "message": f"{room['players'][player_id]['name']} taşlarının yerini değiştirdi! 🌀 ({target1} ↔ {target2}) - Promosyon seçiliyor.",
                    "board": board_to_dict(board),
                    "effects": get_effect_state(room),
                    "captured_pieces": get_captured_pieces_payload(room),
                })

                await safe_send(websocket, {
                    "type": "satranc_promotion_needed",
                    "from": promo_from_sq,
                    "to": promo_needed_sq,
                    "captured_pieces": my_captured,
                })

                print(f"[SATRANC] Yer Değiştir sonrası piyon promosyon: {promo_needed_sq}")
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ Yer Değiştir HAMLE SAYILIR - sıra rakibe geç
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

            new_legal_moves = get_legal_moves(board)
            opp_pid_y = black_pid if player_id == white_pid else white_pid

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} taşlarının yerini değiştirdi! 🌀 ({target1} ↔ {target2}) - Sıra rakipte.",
                "board": board_to_dict(board),
                "effects": get_effect_state(room),
                "captured_pieces": get_captured_pieces_payload(room),
            })

            # ✨ Sıra rakipte, ona legal moves gönder
            opp_ws = room["players"].get(opp_pid_y, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": new_legal_moves,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Yer Değiştir ({target1} ↔ {target2}) - sıra rakibe")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # ==========================================
        # ⛓️ KİLİTLE (target1 = rakip taş) - HAMLE SAYILIR
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

            # ✨ YANSIMA kontrolü - kendi rastgele taşın kilitlenir
            opp_pid_kz = black_pid if player_id == white_pid else white_pid
            yansima_state = room.get("satranc_yansima", {})
            if yansima_state.get(opp_pid_kz):
                yansima_state.pop(opp_pid_kz, None)
                my_pieces = []
                for sq_idx in chess.SQUARES:
                    p = board.piece_at(sq_idx)
                    if p and p.color == my_color and p.piece_type != chess.KING:
                        my_pieces.append(sq_idx)
                if my_pieces:
                    new_target_sq = random.choice(my_pieces)
                    target1_sq = new_target_sq
                    target1 = chess.square_name(new_target_sq)
                    await _notify_yansima(room, player_id, joker_info["name"], joker_info["icon"], safe_send)
                    print(f"[SATRANC YANSIMA] Kilitle yansıdı! Yeni hedef: {target1}")

            locked = room.setdefault("satranc_locked", {})
            locked[target1] = 3  # 3 tur - sadece kilitli taşın sahibi oynayınca düşer
            used.append(joker_id)

            # ✨ Kilitle HAMLE SAYILIR - sıra rakibe geç
            board.turn = not board.turn
            room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
            decrement_effect_counters(room, mover_pid=player_id)

            new_legal_moves = get_legal_moves(board)
            opp_pid_kl = black_pid if player_id == white_pid else white_pid

            await broadcast(room, {
                "type": "satranc_joker_used",
                "joker_id": joker_id,
                "joker_name": joker_info["name"],
                "joker_icon": joker_info["icon"],
                "user_id": player_id,
                "user_name": room["players"][player_id]["name"],
                "message": f"{room['players'][player_id]['name']} rakip taşını kilitledi! ⛓️ 3 tur sadece 1 kare gidebilir. Sıra rakipte.",
                "target": target1,
                "board": board_to_dict(board),
                "effects": get_effect_state(room),
                "captured_pieces": get_captured_pieces_payload(room),
            })

            opp_ws = room["players"].get(opp_pid_kl, {}).get("ws")
            if opp_ws:
                await safe_send(opp_ws, {
                    "type": "satranc_your_turn",
                    "legal_moves": new_legal_moves,
                    "is_check": board.is_check(),
                })

            print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Kilitle ({target1}) - sıra rakibe")
            return {"handled": True, "room_code": room_code, "player_id": player_id}
            
        # ==========================================
        # 🚫 TAŞI YOK SAY (hayalet - üzerinden geçilir, yenmez)
        # ==========================================
        if joker_id == "yoksay":
            if not target1_piece:
                await safe_send(websocket, {"type": "error", "message": "🚫 Bir taş seç!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            if target1_piece.piece_type == chess.KING:
                await safe_send(websocket, {"type": "error", "message": "🚫 Şahı yok sayamazsın!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ Şahtayken kullanılamaz
            if board.is_check():
                await safe_send(websocket, {"type": "error", "message": "🚫 Şahtayken bu joker kullanılamaz!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # ✨ Zaten hayaletse engelle
            if target1 in room.get("satranc_ignored", {}):
                await safe_send(websocket, {"type": "error", "message": "🚫 Bu taş zaten hayalet!"})
                return {"handled": True, "room_code": room_code, "player_id": player_id}

            # Taş bilgisini kaydet (geri getirmek için)
            piece_symbol_saved = target1_piece.symbol()
            piece_color_saved = target1_piece.color
            piece_type_saved = target1_piece.piece_type

            # ✨ Taşı geçici sil (hayalet efekti)
            board.remove_piece_at(target1_sq)

            # ✨ Ignored state'e kaydet - bir sonraki hamleden sonra geri gelecek
            ignored_state = room.setdefault("satranc_ignored", {})
            current_move_count = room.get("satranc_move_count", 0)
            ignored_state[target1] = {
                "owner": player_id,
                "expires_move_count": current_move_count + 1,  # 1 half-move sonra
                "piece_symbol": piece_symbol_saved,
                "piece_color": "w" if piece_color_saved == chess.WHITE else "b",
                "piece_type": piece_type_saved,
            }

            used.append(joker_id)

            # ✨ Şah kontrolü - taş silindikten SONRA şah var mı?
            white_pid_ys = room.get("satranc_white")
            black_pid_ys = room.get("satranc_black")
            opp_pid_ys = black_pid_ys if player_id == white_pid_ys else white_pid_ys
            my_color_ys = chess.WHITE if player_id == white_pid_ys else chess.BLACK

            # Şu an sıra bende, board.turn = my_color
            # Şah kontrolü: rakibin şahı tehdit altında mı? (yani ben şah çektim mi?)
            temp_board_check = board.copy()
            temp_board_check.turn = not my_color_ys  # rakip sırası varmış gibi
            opp_in_check = temp_board_check.is_check()

            # Kendi şahım tehdit altında mı? (yansıma etkisi - yok sayınca kendi şahım açığa çıktı)
            temp_board_check2 = board.copy()
            temp_board_check2.turn = my_color_ys
            my_in_check = temp_board_check2.is_check()

            any_check = opp_in_check or my_in_check

            piece_names_ys = {
                chess.PAWN: "Piyon", chess.ROOK: "Kale", chess.KNIGHT: "At",
                chess.BISHOP: "Fil", chess.QUEEN: "Vezir"
            }
            piece_name_ys = piece_names_ys.get(piece_type_saved, "Taş")

            if any_check:
                # ✨ Şah oluştu → sıra karşıya geç
                board.turn = not board.turn
                room["satranc_move_count"] = room.get("satranc_move_count", 0) + 1
                decrement_effect_counters(room, mover_pid=player_id)

                # Ignored expires güncelle (move_count değişti)
                ignored_state[target1]["expires_move_count"] = room["satranc_move_count"]

                board_state = board_to_dict(board)
                next_legal = get_legal_moves(board)

                check_msg = "Rakibe şah çekildi!" if opp_in_check else "KENDİ şahın açığa çıktı!"

                await broadcast(room, {
                    "type": "satranc_joker_used",
                    "joker_id": joker_id,
                    "joker_name": joker_info["name"],
                    "joker_icon": joker_info["icon"],
                    "user_id": player_id,
                    "user_name": room["players"][player_id]["name"],
                    "message": f"🚫 {room['players'][player_id]['name']} {piece_name_ys}'i hayalet yaptı! ({target1}) {check_msg} Sıra rakipte.",
                    "board": board_state,
                    "target": target1,
                    "ignored_squares": list(ignored_state.keys()),
                    "effects": get_effect_state(room),
                })

                opp_ws = room["players"].get(opp_pid_ys, {}).get("ws")
                if opp_ws:
                    await safe_send(opp_ws, {
                        "type": "satranc_your_turn",
                        "legal_moves": next_legal,
                        "is_check": board.is_check(),
                    })

                print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Taşı Yok Say ({target1}) ŞAH! - sıra rakibe")
            else:
                # ✨ Şah yok → sıra bende kalıyor, hamlemi yapabilirim
                board_state = board_to_dict(board)
                my_legal = get_legal_moves(board)

                await broadcast(room, {
                    "type": "satranc_joker_used",
                    "joker_id": joker_id,
                    "joker_name": joker_info["name"],
                    "joker_icon": joker_info["icon"],
                    "user_id": player_id,
                    "user_name": room["players"][player_id]["name"],
                    "message": f"🚫 {room['players'][player_id]['name']} {piece_name_ys}'i hayalet yaptı! ({target1}) - Hâlâ sırası, hamle yapacak.",
                    "board": board_state,
                    "target": target1,
                    "ignored_squares": list(ignored_state.keys()),
                    "effects": get_effect_state(room),
                })

                # Sıra bende, kendi legal moves'umu ben alırım
                my_ws_ys = room["players"].get(player_id, {}).get("ws")
                if my_ws_ys:
                    await safe_send(my_ws_ys, {
                        "type": "satranc_your_turn",
                        "legal_moves": my_legal,
                        "is_check": board.is_check(),
                    })

                print(f"[SATRANC JOKER] {room['players'][player_id]['name']} → Taşı Yok Say ({target1}) - sıra bende")

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
            # ✨ Zaten görünmezse engelle
            if target1 in room.get("satranc_invisible", {}):
                await safe_send(websocket, {"type": "error", "message": "⚠️ Bu taş zaten Görünmez, üstüne Ajan eklenemez!"})
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
            decrement_effect_counters(room, mover_pid=player_id)

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
                # ✨ is_check değerini GERÇEK board'dan al (sahte renk yüzünden yanlış hesaplanmasın)
                opp_board_state["is_check"] = board.is_check()
                opp_board_state["is_checkmate"] = board.is_checkmate()

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
        room["satranc_ignored"] = {}
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
    # REMATCH - Direkt joker seçim fazına geç
    # ----------------------------------------
    if msg_type == "satranc_rematch":
        if not room_code or room_code not in rooms:
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        room = rooms[room_code]
        if room.get("mode") != "jokerli_satranc":
            return {"handled": False, "room_code": room_code, "player_id": player_id}

        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host tekrar başlatabilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        if len(room["players"]) < 2:
            await safe_send(websocket, {"type": "error", "message": "2 oyuncu gerekli."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        # Task'ları iptal et
        for task_key in ["satranc_task", "satranc_clock_task", "satranc_selection_task"]:
            t = room.get(task_key)
            if t and not t.done():
                t.cancel()
            room[task_key] = None

        # Tüm state'i sıfırla
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
        room["satranc_invisible_owners"] = {}
        room["satranc_locked"] = {}
        room["satranc_extra_move"] = {}
        room["satranc_same_piece_double"] = {}
        room["satranc_hizli_kacis"] = {}
        room["satranc_clock_frozen_turn"] = {}
        room["satranc_yansima"] = {}
        room["satranc_sansur"] = {}
        room["satranc_move_count"] = 0

        # ✨ Joker seçim fazına geç (start_game'in mantığı)
        room["phase"] = "joker_selection"
        room["satranc_selected_slots"] = {pid: [] for pid in room["players"]}
        room["satranc_selection_done"] = {pid: False for pid in room["players"]}

        pick_mode = room.get("satranc_pick_mode", "karisik")
        pick_seconds = room.get("satranc_pick_seconds", 60)
        joker_count = room.get("satranc_joker_count", 3)

        # ✨ Jokersiz mod → direkt oyuna başla
        if joker_count == 0:
            for pid in room["players"]:
                room["satranc_jokers"][pid] = []
                room["satranc_selection_done"][pid] = True
            await _start_actual_game(room, broadcast, safe_send)
            print(f"[SATRANC REMATCH] {room_code} | Jokersiz mod")
            return {"handled": True, "room_code": room_code, "player_id": player_id}

        import time as _time
        room["satranc_selection_deadline"] = _time.time() + pick_seconds

        # Karışık modda direkt rastgele dağıt
        if pick_mode == "karisik":
            time_mode_check = room.get("satranc_time_mode", "blitz")
            excluded_ids = []
            if time_mode_check == "suresiz":
                excluded_ids = ["zaman_cal", "zamani_durdur", "ekstra_sure"]

            for pid in room["players"]:
                if excluded_ids:
                    available_jokers = [j for j in JOKERS if j["id"] not in excluded_ids]
                    random.shuffle(available_jokers)
                    room["satranc_jokers"][pid] = [j["id"] for j in available_jokers[:joker_count]]
                else:
                    random_jokers = get_random_jokers(joker_count)
                    room["satranc_jokers"][pid] = [j["id"] for j in random_jokers]
                room["satranc_selection_done"][pid] = True

        # Tüm oyunculara joker seçim mesajı
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

        # Süre bitiş task'ı başlat
        if pick_mode == "manuel":
            selection_task = asyncio.create_task(
                _joker_selection_timeout(room, broadcast, safe_send, pick_seconds)
            )
            room["satranc_selection_task"] = selection_task
        else:
            start_task = asyncio.create_task(
                _delayed_game_start(room, broadcast, safe_send, delay=3)
            )
            room["satranc_selection_task"] = start_task

        print(f"[SATRANC REMATCH] {room_code} | Mod={pick_mode} | Joker={joker_count}")
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

def decrement_effect_counters(room, mover_pid=None):
    """Kilitle sayacı burada DEĞİL - hamle handler'ında özel olarak düşürülüyor.
    Görünmez, Kalkan ve Dondur da özel mantık ile azalır - burada değil!"""
    pass


def square_neighbors(square_name):
    """Bir karenin 8 komşusunu (yatay + dikey + çapraz) döner."""
    file = square_name[0]  # a-h
    rank = square_name[1]  # 1-8
    neighbors = []
    files = "abcdefgh"
    file_idx = files.index(file)
    rank_int = int(rank)

    # 8 yön: yukarı/aşağı/sol/sağ + 4 çapraz
    for df in [-1, 0, 1]:
        for dr in [-1, 0, 1]:
            if df == 0 and dr == 0:
                continue  # kendi karesini atla
            new_file_idx = file_idx + df
            new_rank = rank_int + dr
            if 0 <= new_file_idx <= 7 and 1 <= new_rank <= 8:
                neighbors.append(f"{files[new_file_idx]}{new_rank}")

    return neighbors

def chebyshev_distance(sq1_name, sq2_name):
    """İki kare arasındaki Chebyshev mesafesi (satranç kral mesafesi)."""
    files = "abcdefgh"
    f1 = files.index(sq1_name[0])
    r1 = int(sq1_name[1])
    f2 = files.index(sq2_name[0])
    r2 = int(sq2_name[1])
    return max(abs(f1 - f2), abs(r1 - r2))


def _is_queen_like_move(board, from_sq_idx, to_sq_idx, mover_color):
    """Bir kareden diğerine vezir gibi hareket edebilir mi? (yatay/dikey/çapraz + arada engel yok)"""
    if from_sq_idx == to_sq_idx:
        return False
    f1 = chess.square_file(from_sq_idx)
    r1 = chess.square_rank(from_sq_idx)
    f2 = chess.square_file(to_sq_idx)
    r2 = chess.square_rank(to_sq_idx)
    df = f2 - f1
    dr = r2 - r1
    # Aynı satır/sütun/çapraz olmalı
    is_horizontal = (dr == 0 and df != 0)
    is_vertical = (df == 0 and dr != 0)
    is_diagonal = (abs(df) == abs(dr) and df != 0)
    if not (is_horizontal or is_vertical or is_diagonal):
        return False
    # Arada engel var mı? Adım adım kontrol
    step_f = 0 if df == 0 else (1 if df > 0 else -1)
    step_r = 0 if dr == 0 else (1 if dr > 0 else -1)
    steps = max(abs(df), abs(dr))
    for i in range(1, steps):
        check_f = f1 + step_f * i
        check_r = r1 + step_r * i
        check_sq = chess.square(check_f, check_r)
        if board.piece_at(check_sq):
            return False  # Yol kapalı
    return True

def get_effect_state(room):
    """Frontend'e gönderilecek efekt state'i (varsayılan - hepsi görünür)."""
    # Hayalet taşların detayları (frontend'de fake gösterim için)
    ignored_state = room.get("satranc_ignored", {})
    ignored_details = {}
    for sq, data in ignored_state.items():
        ignored_details[sq] = {
            "piece_type": data.get("piece_symbol", "").lower(),
            "piece_color": data.get("piece_color", "w"),
        }

    return {
        "shielded": list(room.get("satranc_shielded", {}).keys()),
        "shielded_details": dict(room.get("satranc_shielded", {})),
        "frozen": list(room.get("satranc_frozen", {}).keys()),
        "frozen_details": dict(room.get("satranc_frozen", {})),
        "invisible": list(room.get("satranc_invisible", {}).keys()),
        "locked": list(room.get("satranc_locked", {}).keys()),
        "locked_details": dict(room.get("satranc_locked", {})),
        "ignored": list(ignored_state.keys()),
        "ignored_details": ignored_details,
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

    # Hayalet taşların detayları (herkes görebilir - kimin taşı olduğu önemli değil, görsel için)
    ignored_state = room.get("satranc_ignored", {})
    ignored_details_visible = {}
    for sq, data in ignored_state.items():
        ignored_details_visible[sq] = {
            "piece_type": data.get("piece_symbol", "").lower(),
            "piece_color": data.get("piece_color", "w"),
        }

    return {
        "shielded": _visible_effect_keys("satranc_shielded"),
        "shielded_details": shielded_details_visible,
        "frozen": _visible_effect_keys("satranc_frozen"),
        "frozen_details": frozen_details_visible,
        "invisible": my_invisible,
        "invisible_details": my_invisible_details,
        "locked": _visible_effect_keys("satranc_locked"),
        "locked_details": {
            sq: room.get("satranc_locked", {})[sq]
            for sq in _visible_effect_keys("satranc_locked")
            if sq in room.get("satranc_locked", {})
        },
        "ignored": list(ignored_state.keys()),
        "ignored_details": ignored_details_visible,
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
            exclude_set.update({"zaman_cal", "zamani_durdur", "ekstra_sure"})

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
            exclude_set.update({"zaman_cal", "zamani_durdur", "ekstra_sure"})

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
        sansur[player_id] = 3
        result_msg = "3 tur boyunca joker kullanamazsın!"

    # ⛔ Rakip 3 Tur Yasağı
    elif dilim_id == "rakip_yasak":
        sansur = room.setdefault("satranc_sansur", {})
        sansur[opp_pid] = 3
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
        # İkisinde de var → ZAR AT!
        p1, p2 = once_basla_holders[0], once_basla_holders[1]
        p1_name = room["players"][p1]["name"]
        p2_name = room["players"][p2]["name"]

        # 1. Bildir: "Zar atılacak"
        await broadcast(room, {
            "type": "satranc_dice_intro",
            "p1_id": p1, "p1_name": p1_name,
            "p2_id": p2, "p2_name": p2_name,
            "message": "🎲 İki oyuncu da Önce Başla kullandı! Zar atılacak..."
        })
        await asyncio.sleep(3)

        # 2. Zar at (eşitse tekrar)
        max_tries = 10
        winner_pid = None
        for _ in range(max_tries):
            dice1 = random.randint(1, 6)
            dice2 = random.randint(1, 6)

            await broadcast(room, {
                "type": "satranc_dice_roll",
                "p1_id": p1, "p1_name": p1_name, "p1_dice": dice1,
                "p2_id": p2, "p2_name": p2_name, "p2_dice": dice2,
            })
            await asyncio.sleep(2.5)  # zar animasyonu

            if dice1 > dice2:
                winner_pid = p1
                break
            elif dice2 > dice1:
                winner_pid = p2
                break
            else:
                # Eşit → tekrar
                await broadcast(room, {
                    "type": "satranc_dice_tie",
                    "message": f"🎲 Eşitlik! ({dice1}-{dice2}) Zar tekrar atılıyor..."
                })
                await asyncio.sleep(1.5)

        if not winner_pid:
            winner_pid = p1  # fallback

        white_pid = winner_pid
        black_pid = p2 if winner_pid == p1 else p1

        # 3. Sonucu bildir
        await broadcast(room, {
            "type": "satranc_dice_result",
            "winner_id": winner_pid,
            "winner_name": room["players"][winner_pid]["name"],
            "message": f"🏆 {room['players'][winner_pid]['name']} beyaz oldu ve önce başlayacak!"
        })
        await asyncio.sleep(2.5)

        print(f"[SATRANC] Zar sonucu: {room['players'][winner_pid]['name']} beyaz")
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
        my_used = room["satranc_used_jokers"].get(pid, [])
        opp_pid = black_pid if pid == white_pid else white_pid
        opp_joker_count = len(room["satranc_jokers"].get(opp_pid, []))
        opp_used_list = room["satranc_used_jokers"].get(opp_pid, [])

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
            "my_used_jokers": my_used,  # ✨ kendi kullanılmış jokerlerim (Önce Başla için)
            "opp_joker_count": opp_joker_count,
            "opp_used_jokers": opp_used_list,  # ✨ rakibin kullanılmış jokerleri (Önce Başla için)
            "captured_pieces": get_captured_pieces_payload(room),
        })

    # Saati başlat
    if tm["seconds"] > 0:
        clock_task = asyncio.create_task(
            run_clock(room, broadcast, safe_send)
        )
        room["satranc_clock_task"] = clock_task

def _collect_active_boosts(room, player_id):
    """İyileştirilebilecek aktif jokerleri döner (kendi + sansürlediği rakip)."""
    result = []
    white_pid = room.get("satranc_white")
    black_pid = room.get("satranc_black")
    opp_pid = black_pid if player_id == white_pid else white_pid
    board = room.get("satranc_game")
    my_color = chess.WHITE if player_id == white_pid else chess.BLACK

    # Kalkan (kendi taşlarım)
    for sq, turns in room.get("satranc_shielded", {}).items():
        if turns <= 0 or not board:
            continue
        try:
            p = board.piece_at(chess.parse_square(sq))
            if p and p.color == my_color:
                result.append({
                    "id": f"kalkan_{sq}",
                    "type": "kalkan",
                    "icon": "🛡️",
                    "label": f"Kalkan ({sq.upper()})",
                    "current": turns,
                    "boosted": turns + 3,
                })
        except Exception:
            pass

    # Görünmez (kendi taşlarım)
    inv_owners = room.get("satranc_invisible_owners", {})
    for sq, turns in room.get("satranc_invisible", {}).items():
        if turns <= 0:
            continue
        if inv_owners.get(sq) != player_id:
            continue
        result.append({
            "id": f"gorunmez_{sq}",
            "type": "gorunmez",
            "icon": "🧙",
            "label": f"Görünmez ({sq.upper()})",
            "current": turns,
            "boosted": turns + 3,
        })

    # Ajan (kendi taşlarım)
    for sq, data in room.get("satranc_ajan_disguised", {}).items():
        if not isinstance(data, dict):
            continue
        if data.get("owner") != player_id:
            continue
        turns = data.get("turns", 0)
        if turns <= 0:
            continue
        result.append({
            "id": f"ajan_{sq}",
            "type": "ajan",
            "icon": "🕵️",
            "label": f"Ajan ({sq.upper()})",
            "current": turns,
            "boosted": turns + 3,
        })

    # Dondur (rakibin taşlarında)
    for sq, turns in room.get("satranc_frozen", {}).items():
        if turns <= 0 or not board:
            continue
        try:
            p = board.piece_at(chess.parse_square(sq))
            if p and p.color != my_color:
                result.append({
                    "id": f"dondur_{sq}",
                    "type": "dondur",
                    "icon": "🧊",
                    "label": f"Dondur ({sq.upper()})",
                    "current": turns,
                    "boosted": turns + 3,
                })
        except Exception:
            pass

    # Kilitle (rakibin taşlarında)
    for sq, turns in room.get("satranc_locked", {}).items():
        if turns <= 0 or not board:
            continue
        try:
            p = board.piece_at(chess.parse_square(sq))
            if p and p.color != my_color:
                result.append({
                    "id": f"kilitle_{sq}",
                    "type": "kilitle",
                    "icon": "⛓️",
                    "label": f"Kilitle ({sq.upper()})",
                    "current": turns,
                    "boosted": turns + 3,
                })
        except Exception:
            pass

    # Sansür (rakip üstünde)
    sansur_turns = room.get("satranc_sansur", {}).get(opp_pid, 0)
    if sansur_turns > 0:
        result.append({
            "id": "sansur_opp",
            "type": "sansur",
            "icon": "⛔",
            "label": "Rakip Sansür",
            "current": sansur_turns,
            "boosted": sansur_turns + 3,
        })

    return result


def _check_and_consume_yansima(room, attacker_pid, victim_pid):
    """
    Yansıma kontrolü: eğer victim (hedef) rakibi önceden yansıma kullandıysa,
    attacker (saldıran) ile victim yer değiştirir. Yansıma tüketilir.
    Return: (final_attacker, final_victim, was_reflected)
    """
    yansima_state = room.get("satranc_yansima", {})
    # Kurban (hedef) yansıma kullanmışsa → geri döner
    if yansima_state.get(victim_pid):
        yansima_state.pop(victim_pid, None)
        print(f"[SATRANC YANSIMA] pid={attacker_pid} jokeri pid={victim_pid}'e vuracaktı, YANSIDI!")
        return (victim_pid, attacker_pid, True)
    return (attacker_pid, victim_pid, False)


async def _notify_yansima(room, attacker_pid, joker_name, joker_icon, safe_send):
    """Yansıma olduğunda iki tarafa da bildirim.
    Attacker'a büyük popup (Tamam butonlu), victim'e toast."""
    white_pid = room.get("satranc_white")
    black_pid = room.get("satranc_black")
    victim_pid = black_pid if attacker_pid == white_pid else white_pid

    attacker_ws = room["players"].get(attacker_pid, {}).get("ws")
    victim_ws = room["players"].get(victim_pid, {}).get("ws")

    # Attacker'a büyük popup (zarar gördü)
    if attacker_ws:
        await safe_send(attacker_ws, {
            "type": "satranc_yansima_damage_popup",
            "joker_name": joker_name,
            "joker_icon": joker_icon,
            "message": f"Rakip Yansıma kullandığı için {joker_icon} {joker_name} jokerin sana zarar verdi!"
        })

    # Victim'e toast (yansıttı)
    if victim_ws:
        await safe_send(victim_ws, {
            "type": "satranc_yansima_triggered",
            "message": f"🌀 YANSIMA! Rakibin {joker_icon} {joker_name} jokerini geri yansıttın!",
            "is_attacker": False,
        })


def _apply_iyilestir(room, player_id, target_effect, boost):
    """Seçilen efektin süresine boost kadar tur ekler."""
    try:
        if target_effect == "sansur_opp":
            white_pid = room.get("satranc_white")
            black_pid = room.get("satranc_black")
            opp_pid = black_pid if player_id == white_pid else white_pid
            sansur = room.setdefault("satranc_sansur", {})
            if sansur.get(opp_pid, 0) <= 0:
                return (False, None)
            sansur[opp_pid] += boost
            return (True, "Sansür")

        # tip_kare formatı
        if "_" not in target_effect:
            return (False, None)
        etype, sq = target_effect.split("_", 1)
        key_map = {
            "kalkan": ("satranc_shielded", "Kalkan"),
            "dondur": ("satranc_frozen", "Dondur"),
            "gorunmez": ("satranc_invisible", "Görünmez"),
            "kilitle": ("satranc_locked", "Kilitle"),
        }
        if etype == "ajan":
            ajan = room.get("satranc_ajan_disguised", {})
            if sq not in ajan or not isinstance(ajan[sq], dict):
                return (False, None)
            if ajan[sq].get("turns", 0) <= 0:
                return (False, None)
            ajan[sq]["turns"] += boost
            return (True, f"Ajan ({sq.upper()})")

        if etype not in key_map:
            return (False, None)
        state_key, label = key_map[etype]
        effects = room.get(state_key, {})
        if sq not in effects or effects[sq] <= 0:
            return (False, None)
        effects[sq] += boost
        return (True, f"{label} ({sq.upper()})")
    except Exception as e:
        print(f"[SATRANC İYİLEŞTİR HATA] {e}")
        return (False, None)


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