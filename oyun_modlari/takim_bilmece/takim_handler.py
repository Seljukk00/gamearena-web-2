import asyncio
import random

from oyun_modlari.takim_bilmece.teams import ALL_TEAMS

TAKIM_TOPLAM_SORU = 12
TAKIM_TUR_SURESI = 60

TAKIM_JOKER_AYARLARI = {
    "kolay":  {"name": 3, "year": 3, "elim": 3, "pass": 3},
    "orta":   {"name": 2, "year": 2, "elim": 2, "pass": 1},
    "zor":    {"name": 1, "year": 0, "elim": 1, "pass": 0},
    "klasik": {"name": 3, "year": 3, "elim": 3, "pass": 3}
}


def _handled(room_code, player_id):
    return {"handled": True, "room_code": room_code, "player_id": player_id}


def _not_handled(room_code, player_id):
    return {"handled": False, "room_code": room_code, "player_id": player_id}


def get_other_player_id(pid):
    """SADECE 2 kişilik oyun için: karşı taraf."""
    return 2 if pid == 1 else 1


def get_next_turn_player(room):
    """Sıradaki oyuncunun ID'sini döndür (2+ kişi destekli).
    Odada kalan oyuncuların içinden mevcut sıradan sonrakini bulur."""
    active_ids = sorted(room["players"].keys())
    if not active_ids:
        return None
    current = room.get("turn", active_ids[0])
    if current not in active_ids:
        # Sıradaki oyuncu ayrılmış, ilkine dön
        return active_ids[0]
    idx = active_ids.index(current)
    next_idx = (idx + 1) % len(active_ids)
    return active_ids[next_idx]


def get_teams_by_difficulty(difficulty):
    """Belirli zorluktaki takım index'lerini döndür"""
    indices = []
    for i, t in enumerate(ALL_TEAMS):
        if t.get("difficulty", "orta") == difficulty:
            indices.append(i)
    return indices


def make_takim_questions(difficulty="klasik", used_indices=None):
    """Zorluğa göre 12 takım seç. used_indices: önceki oyunlarda kullanılanlar (öncelik olarak dışlanır)"""
    
    if used_indices is None:
        used_indices = set()
    else:
        used_indices = set(used_indices)
    
    def pick_from(pool, count):
        """Pool'dan önce kullanılmamışları, sonra kullanılmışları seç"""
        fresh = [i for i in pool if i not in used_indices]
        used = [i for i in pool if i in used_indices]
        random.shuffle(fresh)
        random.shuffle(used)
        # Önce fresh, yetmezse used'dan tamamla
        combined = fresh + used
        return combined[:count]
    
    if difficulty == "klasik":
        # Progresif: 4 kolay + 4 orta + 4 zor
        kolay = get_teams_by_difficulty("kolay")
        orta = get_teams_by_difficulty("orta")
        zor = get_teams_by_difficulty("zor")
        
        selected = []
        selected.extend(pick_from(kolay, 4))
        selected.extend(pick_from(orta, 4))
        selected.extend(pick_from(zor, 4))
        
        # Eksik varsa doldur (herhangi bir zorluktan)
        while len(selected) < TAKIM_TOPLAM_SORU:
            all_valid = list(range(len(ALL_TEAMS)))
            remaining = [i for i in all_valid if i not in selected]
            if not remaining:
                break
            # Kullanılmamış varsa onu, yoksa herhangi biri
            fresh = [i for i in remaining if i not in used_indices]
            if fresh:
                selected.append(random.choice(fresh))
            else:
                selected.append(random.choice(remaining))
        
        return selected[:TAKIM_TOPLAM_SORU]
    
    else:
        # Kolay/Orta/Zor: sadece o zorluktan
        valid = get_teams_by_difficulty(difficulty)
        selected = pick_from(valid, TAKIM_TOPLAM_SORU)
        
        # Yetmiyorsa diğer zorluklardan tamamla
        if len(selected) < TAKIM_TOPLAM_SORU:
            all_valid = list(range(len(ALL_TEAMS)))
            remaining = [i for i in all_valid if i not in selected]
            fresh = [i for i in remaining if i not in used_indices]
            used = [i for i in remaining if i in used_indices]
            random.shuffle(fresh)
            random.shuffle(used)
            combined = fresh + used
            while len(selected) < TAKIM_TOPLAM_SORU and combined:
                selected.append(combined.pop(0))
        
        return selected[:TAKIM_TOPLAM_SORU]


def get_takim_team_data(room, question_no):
    team_index = room["questions"][question_no]
    team = ALL_TEAMS[team_index]
    return {
        "year": team["year"],
        "players": team["players"],
        "options": team["options"],
        "difficulty": team.get("difficulty", "orta")
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
        # Oyuncu ayrılmışsa timer bir şey yapmaz
        if turn_id not in room.get("players", {}):
            return

        print(f"[TAKIM TIMER] Süre doldu, oyuncu {turn_id} için -1 puan")

        if turn_id in room["scores"]:
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
    total_questions = room.get("total_questions", TAKIM_TOPLAM_SORU)

    if room["current_question"] >= total_questions:
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
        # Beraberlik kontrolü (ilk 2 aynı skorda mı?)
        if len(ranking) >= 2 and ranking[0]["score"] == ranking[1]["score"]:
            winner_id = 0

        await broadcast(room, {
            "type": "takim_game_over",
            "scores": room["scores"],
            "winner_id": winner_id,
            "ranking": ranking
        })
        return

    # Sıradaki oyuncuya geç (2+ destekli)
    room["turn"] = get_next_turn_player(room)
    # Tüm oyuncular için state'i sıfırla
    all_pids = list(room["players"].keys())
    room["revealed_names"] = {pid: {} for pid in all_pids}
    room["year_revealed"] = {pid: False for pid in all_pids}
    room["eliminated_options"] = {pid: [] for pid in all_pids}
    room["answered"] = False
    room["pending_name_joker"] = {}

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
    max_players = room.get("max_players", 2)
    await broadcast(room, {
        "type": "takim_lobby_update",
        "room_code": room["code"],
        "players": players,
        "can_start": len(room["players"]) == max_players,
        "difficulty": room.get("difficulty", "klasik"),
        "turn_seconds": room.get("turn_seconds", 60),
        "max_players": max_players,
        "total_questions": room.get("total_questions", TAKIM_TOPLAM_SORU)
    })


async def start_takim_game(room, safe_send, broadcast):
    difficulty = room.get("difficulty", "klasik")
    total_questions = room.get("total_questions", TAKIM_TOPLAM_SORU)
    
    # ✨ Önceki oyunlarda kullanılan takımları hatırla, tekrar gelme ihtimalini azalt
    used_history = room.get("used_teams_history", set())
    
    # Havuzun çoğu kullanıldıysa sıfırla
    total_teams = len(ALL_TEAMS)
    if len(used_history) >= total_teams * 0.75:
        print(f"[TAKIM] Havuz büyük ölçüde tüketildi ({len(used_history)}/{total_teams}), sıfırlanıyor")
        used_history = set()
    
    # Soru sayısı için make_takim_questions'ı override et
    all_questions = make_takim_questions(difficulty, used_indices=used_history)
    # Gerektiğinde çoğalt veya kes
    if len(all_questions) < total_questions:
        # Yetmiyorsa tekrar üret
        extra_needed = total_questions - len(all_questions)
        extra = make_takim_questions(difficulty, used_indices=used_history | set(all_questions))
        all_questions.extend(extra[:extra_needed])
    room["questions"] = all_questions[:total_questions]
    room["total_questions"] = total_questions
    
    # Bu oyunda kullanılanları history'e ekle
    used_history.update(room["questions"])
    room["used_teams_history"] = used_history
    
    # Aktif oyuncu ID'leri
    active_ids = sorted(room["players"].keys())
    print(f"[TAKIM] Oyun başladı — Zorluk: {difficulty}, Soru: {len(room['questions'])}, Oyuncu: {len(active_ids)}")
    
    room["current_question"] = 0
    room["scores"] = {pid: 0 for pid in active_ids}
    room["turn"] = active_ids[0]  # İlk oyuncu başlar
    room["phase"] = "playing"
    room["revealed_names"] = {pid: {} for pid in active_ids}
    room["year_revealed"] = {pid: False for pid in active_ids}
    room["eliminated_options"] = {pid: [] for pid in active_ids}
    room["answered"] = False
    room["pending_name_joker"] = {}
    room["left_players"] = {}  # Ayrılan oyuncuların isimleri (sıralama için)

    joker_config = TAKIM_JOKER_AYARLARI[difficulty]
    room["jokers_left"] = {pid: dict(joker_config) for pid in active_ids}

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
            "total_questions": total_questions,
            "turn_seconds": room.get("turn_seconds", 60),
            "current_turn": room["turn"],
            "question_no": 0,
            "team_data": get_takim_team_data(room, 0),
            "scores": room["scores"],
            "jokers_left": room["jokers_left"],
            "max_players": room.get("max_players", 2)
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
        difficulty = data.get("difficulty", "klasik")
        turn_seconds_raw = data.get("turn_seconds", 60)
        max_players_raw = data.get("max_players", 2)
        total_q_raw = data.get("total_questions", TAKIM_TOPLAM_SORU)

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)

        if difficulty not in TAKIM_JOKER_AYARLARI:
            difficulty = "klasik"

        try:
            takim_turn_seconds = int(turn_seconds_raw)
            if takim_turn_seconds not in [15, 30, 45, 60, 120]:
                takim_turn_seconds = 60
        except:
            takim_turn_seconds = 60

        try:
            max_players = int(max_players_raw)
            if max_players not in [2, 3, 4, 5]:
                max_players = 2
        except:
            max_players = 2

        try:
            total_q = int(total_q_raw)
            if total_q not in [6, 9, 12, 15, 20, 25]:
                total_q = TAKIM_TOPLAM_SORU
        except:
            total_q = TAKIM_TOPLAM_SORU

        print(f"[TAKIM ODA] Zorluk: {difficulty} | Süre: {takim_turn_seconds}sn | Oyuncu: {max_players} | Soru: {total_q}")

        current_room_code = make_room_code()
        current_player_id = 1

        rooms[current_room_code] = {
            "code": current_room_code,
            "mode": "takim_bilmece",
            "players": {1: {"ws": websocket, "name": name}},
            "phase": "lobby",
            "difficulty": difficulty,
            "turn_seconds": takim_turn_seconds,
            "max_players": max_players,
            "total_questions": total_q,
            "scores": {},
            "questions": [],
            "current_question": 0,
            "turn": 1,
            "revealed_names": {},
            "year_revealed": {},
            "eliminated_options": {},
            "answered": False,
            "jokers_left": {},
            "takim_task": None,
            "used_teams_history": set(),
            "left_players": {}
        }

        await safe_send(websocket, {
            "type": "takim_room_created",
            "room_code": current_room_code,
            "player_id": 1,
            "difficulty": difficulty,
            "max_players": max_players,
            "total_questions": total_q,
            "turn_seconds": takim_turn_seconds
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
        
        max_players = room.get("max_players", 2)
        if len(room["players"]) >= max_players:
            await safe_send(websocket, {"type": "error", "message": f"Oda dolu ({max_players}/{max_players})."})
            return _handled(current_room_code, current_player_id)
        # Oyun başladıktan sonra katılım kapalı
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

        # Boş slot bul (1..max_players)
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
            "type": "takim_room_joined",
            "room_code": current_room_code,
            "player_id": new_pid,
            "difficulty": room.get("difficulty", "klasik"),
            "max_players": max_players,
            "total_questions": room.get("total_questions", TAKIM_TOPLAM_SORU),
            "turn_seconds": room.get("turn_seconds", 60)
        })
        await send_takim_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- Oda kontrolü ----------
    if not current_room_code or current_room_code not in rooms:
        return _handled(current_room_code, current_player_id)

    room = rooms[current_room_code]
    if room.get("mode") != "takim_bilmece":
        return _handled(current_room_code, current_player_id)

    # ---------- UPDATE ROOM SETTINGS ----------
    if msg_type == "takim_update_settings":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host ayarları değiştirebilir."})
            return _handled(current_room_code, current_player_id)

        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Sadece lobbyde ayarları değiştirebilirsin."})
            return _handled(current_room_code, current_player_id)

        difficulty = data.get("difficulty", room.get("difficulty", "klasik"))
        if difficulty not in TAKIM_JOKER_AYARLARI:
            difficulty = "klasik"

        try:
            new_turn_sec = int(data.get("turn_seconds", room.get("turn_seconds", 60)))
            if new_turn_sec not in [15, 30, 45, 60, 120]:
                new_turn_sec = 60
        except:
            new_turn_sec = 60

        try:
            new_max = int(data.get("max_players", room.get("max_players", 2)))
            if new_max not in [2, 3, 4, 5]:
                new_max = room.get("max_players", 2)
            # Mevcut oyuncu sayısından az yapamayız
            if new_max < len(room["players"]):
                new_max = room.get("max_players", 2)
        except:
            new_max = room.get("max_players", 2)

        try:
            new_total_q = int(data.get("total_questions", room.get("total_questions", TAKIM_TOPLAM_SORU)))
            if new_total_q not in [6, 9, 12, 15, 20, 25]:
                new_total_q = room.get("total_questions", TAKIM_TOPLAM_SORU)
        except:
            new_total_q = room.get("total_questions", TAKIM_TOPLAM_SORU)

        room["difficulty"] = difficulty
        room["turn_seconds"] = new_turn_sec
        room["max_players"] = new_max
        room["total_questions"] = new_total_q

        await send_takim_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- START ----------
    if msg_type == "takim_start_game":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return _handled(current_room_code, current_player_id)
        max_players = room.get("max_players", 2)
        if len(room["players"]) != max_players:
            await safe_send(websocket, {"type": "error", "message": f"{max_players} oyuncu gerekli."})
            return _handled(current_room_code, current_player_id)
        await start_takim_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- REMATCH ----------
    if msg_type == "takim_rematch":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host tekrar başlatabilir."})
            return _handled(current_room_code, current_player_id)
        max_players = room.get("max_players", 2)
        if len(room["players"]) < 2:
            return _handled(current_room_code, current_player_id)
        # Rematch'te odada kaç kişi varsa onlarla başla (max_players'ı düşür)
        room["max_players"] = len(room["players"])
        await start_takim_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- BACK TO LOBBY ----------
    if msg_type == "takim_back_to_lobby":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host lobiye döndürebilir."})
            return _handled(current_room_code, current_player_id)
        
        # Oda durumunu lobiye çevir
        room["phase"] = "lobby"
        room["max_players"] = len(room["players"])  # Kaç kişi kaldıysa o
        
        # Aktif task'ı iptal et
        old_task = room.get("takim_task")
        if old_task and not old_task.done():
            old_task.cancel()
        
        # Herkese lobiye dön mesajı
        await broadcast(room, {
            "type": "takim_back_to_lobby"
        })
        
        # Lobby update gönder
        await send_takim_lobby_update(room, broadcast)
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