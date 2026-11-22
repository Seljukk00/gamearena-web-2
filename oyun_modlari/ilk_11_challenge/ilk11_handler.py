import asyncio
import random

from oyun_modlari.bil_bakalim.footballers import ALL_FOOTBALLERS

# ==========================================
# SABİTLER
# ==========================================

POSITIONS = {
    'GK':  {'name': 'KALECİ',     'x': 0.50, 'y': 0.88, 'type': 'Kaleci'},
    'LB':  {'name': 'SOL BEK',    'x': 0.15, 'y': 0.68, 'type': 'Defans'},
    'CB1': {'name': 'STOPER',     'x': 0.38, 'y': 0.73, 'type': 'Defans'},
    'CB2': {'name': 'STOPER',     'x': 0.62, 'y': 0.73, 'type': 'Defans'},
    'RB':  {'name': 'SAĞ BEK',    'x': 0.85, 'y': 0.68, 'type': 'Defans'},
    'CM1': {'name': 'ORTA SAHA',  'x': 0.22, 'y': 0.48, 'type': 'Orta Saha'},
    'CM2': {'name': 'ORTA SAHA',  'x': 0.50, 'y': 0.52, 'type': 'Orta Saha'},
    'CM3': {'name': 'ORTA SAHA',  'x': 0.78, 'y': 0.48, 'type': 'Orta Saha'},
    'LW':  {'name': 'SOL KANAT',  'x': 0.18, 'y': 0.22, 'type': 'Forvet'},
    'ST':  {'name': 'FORVET',     'x': 0.50, 'y': 0.15, 'type': 'Forvet'},
    'RW':  {'name': 'SAĞ KANAT',  'x': 0.82, 'y': 0.22, 'type': 'Forvet'},
}

ILK11_SURE = 120  # saniye

# Adaylar footballers.py içindeki detailed_position değerine göre filtrelenir.
ILK11_POSITION_ROLES = {
    "GK": {"Kaleci"},
    "LB": {"SolBek"},
    "CB1": {"Stoper"},
    "CB2": {"Stoper"},
    "RB": {"SagBek"},
    "CM1": {"DOS", "MOS", "OOS"},
    "CM2": {"DOS", "MOS", "OOS"},
    "CM3": {"DOS", "MOS", "OOS"},
    "LW": {"SolKanat"},
    "ST": {"Santrafor"},
    "RW": {"SagKanat"},
}


def _handled(room_code, player_id):
    return {"handled": True, "room_code": room_code, "player_id": player_id}


def _not_handled(room_code, player_id):
    return {"handled": False, "room_code": room_code, "player_id": player_id}


def get_other_player_id(pid):
    return 2 if pid == 1 else 1


def normalize_position(pos):
    raw = str(pos or "").strip().lower()

    if raw == "gk" or "kaleci" in raw or "goalkeeper" in raw:
        return "Kaleci"

    if "orta saha" in raw or "ortasaha" in raw or "midfield" in raw:
        return "Orta Saha"

    if any(term in raw for term in ["defans", "stoper", "bek", "defender", "fullback", "back"]):
        return "Defans"

    if any(term in raw for term in ["forvet", "santrafor", "kanat", "forward", "striker", "wing"]):
        return "Forvet"

    return str(pos or "").strip()


# ==========================================
# RATING & KİMYA HESABI
# ==========================================

def calculate_rating(f, pos_type):
    rating = 55
    f_pos = normalize_position(f.get('position', 'Forvet'))
    pos_type = normalize_position(pos_type)

    if f_pos == pos_type:
        rating += 25
    elif pos_type == 'Orta Saha' and f_pos in ['Defans', 'Forvet']:
        rating += 10
    elif pos_type == 'Defans' and f_pos == 'Orta Saha':
        rating += 14
    elif pos_type == 'Forvet' and f_pos == 'Orta Saha':
        rating += 12
    elif pos_type == 'Kaleci' and f_pos != 'Kaleci':
        rating -= 25

    if f.get('ballondor'):
        rating += 10
    if f.get('ucl'):
        rating += 5
    if f.get('goals100'):
        rating += 4
    if f.get('worldcup'):
        rating += 4
    if f.get('europe'):
        rating += 2
    if f.get('captain'):
        rating += 2
    if f.get('young'):
        rating += 3
    elif f.get('over30'):
        rating += 1

    if f.get('league') in ['Premier', 'LaLiga', 'Bundesliga', 'SerieA']:
        rating += 3
    elif f.get('league') == 'SuperLig':
        rating += 1

    return min(99, max(40, rating))


def calculate_chemistry(team_indices):
    if not team_indices:
        return 0

    players = []
    for pos_id, idx in team_indices.items():
        if 0 <= idx < len(ALL_FOOTBALLERS):
            players.append(ALL_FOOTBALLERS[idx])

    chem = 0
    nations = [p.get('nationality', '') for p in players if p]
    for i in range(len(nations)):
        for j in range(i + 1, len(nations)):
            if nations[i] and nations[i] == nations[j]:
                chem += 3

    leagues = [p.get('league', '') for p in players if p]
    for i in range(len(leagues)):
        for j in range(i + 1, len(leagues)):
            if leagues[i] and leagues[i] == leagues[j]:
                chem += 2

    continents = [p.get('continent', '') for p in players if p]
    for i in range(len(continents)):
        for j in range(i + 1, len(continents)):
            if continents[i] and continents[i] == continents[j]:
                chem += 1

    return min(100, chem)


def calculate_total_score(team_indices):
    if not team_indices:
        return 0, 0, 0

    total_rating = 0
    for pos_id, idx in team_indices.items():
        if 0 <= idx < len(ALL_FOOTBALLERS):
            f = ALL_FOOTBALLERS[idx]
            pos_type = POSITIONS.get(pos_id, {}).get('type', 'Forvet')
            total_rating += calculate_rating(f, pos_type)

    chem = calculate_chemistry(team_indices)
    return total_rating, chem, total_rating + chem


# ==========================================
# YARDIMCI FONKSİYONLAR
# ==========================================

def is_player_eligible_for_position(player, pos_id):
    allowed_roles = ILK11_POSITION_ROLES.get(pos_id)
    if not allowed_roles:
        return False

    detailed_position = str(player.get("detailed_position") or "").strip()
    return detailed_position in allowed_roles


def get_options_for_position(pos_id, used_indices, count=5, excluded_indices=None):
    excluded = set(used_indices or [])
    if excluded_indices:
        excluded.update(excluded_indices)

    matching_indices = [
        idx for idx, f in enumerate(ALL_FOOTBALLERS)
        if idx not in excluded
        and is_player_eligible_for_position(f, pos_id)
    ]

    if not matching_indices:
        return []

    selected_indices = random.sample(
        matching_indices,
        min(count, len(matching_indices))
    )

    result = []
    for idx in selected_indices:
        f = ALL_FOOTBALLERS[idx]
        result.append({
            "index": idx,
            "name": f["name"],
            "img_file": f.get("img_file", f["img"] + ".webp"),
            "position": f.get("position", "?"),
            "league": f.get("league", "?"),
            "nationality": f.get("nationality", "?")
        })

    return result


def build_team_result(team_indices):
    result = []
    for pos_id in ['GK', 'LB', 'CB1', 'CB2', 'RB', 'CM1', 'CM2', 'CM3', 'LW', 'ST', 'RW']:
        idx = team_indices.get(pos_id, -1)
        if 0 <= idx < len(ALL_FOOTBALLERS):
            f = ALL_FOOTBALLERS[idx]
            pos_type = POSITIONS[pos_id]['type']
            rating = calculate_rating(f, pos_type)
            result.append({
                "pos_id": pos_id,
                "pos_name": POSITIONS[pos_id]['name'],
                "index": idx,
                "name": f["name"],
                "img_file": f.get("img_file", f["img"] + ".webp"),
                "rating": rating,
                "position": f.get("position", "?"),
                "nationality": f.get("nationality", "?"),
                "league": f.get("league", "?")
            })
        else:
            result.append({
                "pos_id": pos_id,
                "pos_name": POSITIONS[pos_id]['name'],
                "index": -1,
                "name": "BOŞ",
                "img_file": "",
                "rating": 0
            })
    return result


# ==========================================
# TIMER
# ==========================================

async def ilk11_timer(room, broadcast, safe_send):
    try:
        seconds = room.get("turn_seconds", ILK11_SURE)
        await asyncio.sleep(seconds)

        if room.get("phase") != "playing":
            return

        print("[ILK11 TIMER] Süre doldu, mevcut kadrolarla puanlanacak")

        # Otomatik doldurma YOK - herkesin mevcut kadrosu ile devam
        for pid in [1, 2]:
            if room["ilk11_finished"].get(pid):
                continue
            
            room["ilk11_finished"][pid] = True
            
            # Sadece süresi biten oyuncuya bildir
            team = room["ilk11_teams"].get(pid, {})
            missing_count = 11 - len(team)
            
            await safe_send(room["players"][pid]["ws"], {
                "type": "ilk11_time_up",
                "message": f"⏰ Süre bitti! {missing_count} pozisyon boş kaldı.",
                "filled_count": len(team)
            })

        await asyncio.sleep(1)
        await ilk11_show_result(room, broadcast)

    except asyncio.CancelledError:
        pass
    except Exception as e:
        print(f"[ILK11 TIMER HATA] {e}")


# ==========================================
# SONUÇ EKRANI
# ==========================================

async def ilk11_show_result(room, broadcast):
    room["phase"] = "result"

    team1 = room["ilk11_teams"].get(1, {})
    team2 = room["ilk11_teams"].get(2, {})

    rating1, chem1, total1 = calculate_total_score(team1)
    rating2, chem2, total2 = calculate_total_score(team2)

    if total1 > total2:
        winner = 1
    elif total2 > total1:
        winner = 2
    else:
        winner = 0

    await broadcast(room, {
        "type": "ilk11_result",
        "player1": {
            "name": room["players"][1]["name"],
            "team": build_team_result(team1),
            "total_rating": rating1,
            "chemistry": chem1,
            "total_score": total1
        },
        "player2": {
            "name": room["players"][2]["name"],
            "team": build_team_result(team2),
            "total_rating": rating2,
            "chemistry": chem2,
            "total_score": total2
        },
        "winner_id": winner
    })


# ==========================================
# OYUN BAŞLAT
# ==========================================

async def start_ilk11_game(room, safe_send, broadcast):
    old_task = room.get("ilk11_task")
    if old_task and not old_task.done():
        old_task.cancel()

    room["phase"] = "playing"
    room["ilk11_teams"] = {1: {}, 2: {}}
    room["ilk11_used"] = {1: set(), 2: set()}
    room["ilk11_finished"] = {1: False, 2: False}
    room["ilk11_options_cache"] = {1: {}, 2: {}}
    room["ilk11_rerolls_left"] = {1: 3, 2: 3}

    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]

    positions_data = {}
    for pos_id, pdata in POSITIONS.items():
        positions_data[pos_id] = {
            "name": pdata["name"],
            "x": pdata["x"],
            "y": pdata["y"],
            "type": pdata["type"]
        }

    for pid, pdata in room["players"].items():
        await safe_send(pdata["ws"], {
            "type": "ilk11_game_started",
            "player_id": pid,
            "players": players,
            "turn_seconds": room.get("turn_seconds", ILK11_SURE),
            "positions": positions_data,
            "rerolls_left": room["ilk11_rerolls_left"].get(pid, 3)
        })

    room["ilk11_task"] = asyncio.create_task(
        ilk11_timer(room, broadcast, safe_send)
    )


async def send_ilk11_lobby_update(room, broadcast):
    players = [
        {"id": pid, "name": pdata["name"]}
        for pid, pdata in sorted(room["players"].items())
    ]
    await broadcast(room, {
        "type": "ilk11_lobby_update",
        "room_code": room["code"],
        "players": players,
        "can_start": len(room["players"]) == 2,
        "turn_seconds": room.get("turn_seconds", ILK11_SURE)
    })


# ==========================================
# SİMÜLASYON MOTORU (GERÇEKÇİ MAÇ MOTORU)
# ==========================================
async def run_ilk11_simulation(room, broadcast):
    try:
        room["phase"] = "simulation"
        team1 = room["ilk11_teams"].get(1, {})
        team2 = room["ilk11_teams"].get(2, {})
        
        r1, c1, t1 = calculate_total_score(team1)
        r2, c2, t2 = calculate_total_score(team2)
        
        p1_name = room["players"].get(1, {}).get("name", "1. Oyuncu")
        p2_name = room["players"].get(2, {}).get("name", "2. Oyuncu")
        
        def get_team_roster(team_dict):
            roster = {"GK": [], "DEF": [], "MID": [], "FWD": [], "ALL": []}
            for pos_id, idx in team_dict.items():
                if 0 <= idx < len(ALL_FOOTBALLERS):
                    f = ALL_FOOTBALLERS[idx]
                    pos_type = POSITIONS.get(pos_id, {}).get('type', 'Forvet')
                    rating = calculate_rating(f, pos_type)
                    p_obj = {"name": f["name"], "rating": rating, "pos_id": pos_id, "pos_type": pos_type}
                    roster["ALL"].append(p_obj)
                    if pos_type == 'Kaleci': roster["GK"].append(p_obj)
                    elif pos_type == 'Defans': roster["DEF"].append(p_obj)
                    elif pos_type == 'Orta Saha': roster["MID"].append(p_obj)
                    else: roster["FWD"].append(p_obj)
            return roster

        ros1 = get_team_roster(team1)
        ros2 = get_team_roster(team2)

        def pick_player(roster, line=None):
            pool = roster.get(line, []) if line and roster.get(line) else roster["ALL"]
            if not pool:
                pool = roster["ALL"]
            if not pool:
                return {"name": "Oyuncu", "rating": 70}
            return random.choice(pool)

        # Güç farkı hesaplama
        diff = t1 - t2
        # Sürpriz ihtimali (%12)
        upset = random.random() < 0.12
        if upset:
            diff = -diff * 0.5  # Sürpriz maç dengesi

        # Gol üretme katsayıları
        p1_atk_weight = max(10, t1 + (diff if diff > 0 else diff * 0.5))
        p2_atk_weight = max(10, t2 - (diff if diff < 0 else diff * 0.5))
        total_weight = p1_atk_weight + p2_atk_weight

        score1, score2 = 0, 0
        events = []

        # 90 Dakikalık Maç Zaman Çizelgesi (18 ila 22 Pozisyon)
        num_events = random.randint(18, 22)
        minutes = sorted(random.sample(range(2, 91), num_events))

        for minute in minutes:
            # Atak yapan takımı seç
            atk_team = 1 if random.uniform(0, total_weight) <= p1_atk_weight else 2
            def_team = 2 if atk_team == 1 else 1
            
            atk_ros = ros1 if atk_team == 1 else ros2
            def_ros = ros2 if atk_team == 1 else ros1
            atk_pname = p1_name if atk_team == 1 else p2_name
            
            # Pozisyon türünü belirle (%60 Forvet/Kanat, %25 Orta Saha, %15 Defans/Bek)
            pos_roll = random.random()
            if pos_roll < 0.60:
                shooter = pick_player(atk_ros, "FWD")
            elif pos_roll < 0.85:
                shooter = pick_player(atk_ros, "MID")
            else:
                shooter = pick_player(atk_ros, "DEF")

            defender = pick_player(def_ros, "DEF")
            gk = pick_player(def_ros, "GK")

            shooter_name = shooter.get("name", "Oyuncu")
            shooter_rating = shooter.get("rating", 70)
            gk_name = gk.get("name", "Kaleci")
            gk_rating = gk.get("rating", 70)
            def_name = defender.get("name", "Defans")
            def_rating = defender.get("rating", 70)

            # Gol Şansı Hesaplama (Oyuncu Reytingi vs Defans/Kaleci Reytingi)
            atk_power = shooter_rating + (t1 if atk_team == 1 else t2) * 0.05
            def_power = (gk_rating + def_rating) / 2 + (t2 if atk_team == 1 else t1) * 0.05
            
            goal_prob = 0.18 + (atk_power - def_power) * 0.003
            goal_prob = max(0.06, min(0.42, goal_prob))

            event_roll = random.random()
            event_type = "miss"
            is_goal = False

            if event_roll < goal_prob:
                is_goal = True
                event_type = "goal"
                if atk_team == 1: score1 += 1
                else: score2 += 1

                goal_texts = [
                    f"GOOOOL! {shooter_name} harika bir şutla ağları havalandırıyor!",
                    f"GOL GOL GOL! {shooter_name} ceza sahası dışından füze gönderdi!",
                    f"MUHTEŞEM GOL! {shooter_name} kaleci {gk_name}'yi çaresiz bıraktı!",
                    f"GOOOOL! {atk_pname} takımında {shooter_name} kafayla topu ağlara yolladı!",
                    f"MÜKEMMEL BİR BİTİRİŞ! {shooter_name} defansı ipe dizip golü attı!"
                ]
                text = random.choice(goal_texts)

            elif event_roll < goal_prob + 0.15:
                # Direkten Dönen Top
                event_type = "post"
                texts = [
                    f"DİREK! {shooter_name} vurdu, top üst direkte patladı!",
                    f"İnanılmaz an! {shooter_name}'in şutu yan direkten dışarı gitti!",
                    f"Son anda direk! {atk_pname} mutlak bir golden oldu!"
                ]
                text = random.choice(texts)

            elif event_roll < goal_prob + 0.40:
                # Kaleci Kurtarışı
                event_type = "save"
                texts = [
                    f"DEVLEŞTİ! Kaleci {gk_name}, {shooter_name}'in şutunu son anda kornere çeldi!",
                    f"İnanılmaz refleks! {gk_name} geçit vermiyor!",
                    f"{shooter_name} sert vurdu ama kaleci {gk_name} iki hamlede topa sahip oldu."
                ]
                text = random.choice(texts)

            elif event_roll < goal_prob + 0.50:
                # Sarı Kart / Faul
                event_type = "card"
                foul_player = pick_player(def_ros, "DEF")
                foul_name = foul_player.get("name", "Defans")
                texts = [
                    f"SARI KART! {foul_name}, {shooter_name}'i sert bir müdahaleyle durdurdu.",
                    f"Hakem düdüğünü çaldı. {foul_name} kontrolsüz kaydığı için sarı kart görüyor."
                ]
                text = random.choice(texts)

            else:
                # Dışarı giden şut / Blok
                event_type = "miss"
                texts = [
                    f"{shooter_name} ceza sahasına girdi, şutu az farkla üstten dışarı gitti.",
                    f"{def_name} kritik bir müdahaleyle {shooter_name}'in şutunu blokladı.",
                    f"{atk_pname} atağında {shooter_name} topu çerçeveye bulduramadı."
                ]
                text = random.choice(texts)

            events.append({
                "min": minute,
                "text": text,
                "score1": score1,
                "score2": score2,
                "is_goal": is_goal,
                "event_type": event_type,
                "team": atk_team
            })

        # Frontend'e tüm simülasyon paketini gönder
        await broadcast(room, {
            "type": "ilk11_sim_start",
            "p1": p1_name,
            "p2": p2_name,
            "events": events,
            "final_score1": score1,
            "final_score2": score2
        })
    except Exception as e:
        print(f"[ILK11 SIMULASYON HATASI] {e}")


# ==========================================
# ANA HANDLER
# ==========================================

async def handle_ilk11_message(
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
    if not str(msg_type).startswith("ilk11_"):
        return _not_handled(room_code, player_id)

    current_room_code = room_code
    current_player_id = player_id

    # ---------- CREATE ----------
    if msg_type == "ilk11_create_room":
        name = (data.get("name") or "").strip()
        turn_seconds_raw = data.get("turn_seconds", ILK11_SURE)

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)

        try:
            turn_seconds = int(turn_seconds_raw)
            if turn_seconds not in [60, 90, 120, 180, 240]:
                turn_seconds = 120
        except:
            turn_seconds = 120

        current_room_code = make_room_code()
        current_player_id = 1

        rooms[current_room_code] = {
            "code": current_room_code,
            "mode": "ilk_11_challenge",
            "players": {1: {"ws": websocket, "name": name}},
            "phase": "lobby",
            "turn_seconds": turn_seconds,
            "ilk11_teams": {1: {}, 2: {}},
            "ilk11_used": {1: set(), 2: set()},
            "ilk11_finished": {1: False, 2: False},
            "ilk11_task": None,
            "chat_history": [],
            "chat_last_msg_time": {}
        }

        await safe_send(websocket, {
            "type": "ilk11_room_created",
            "room_code": current_room_code,
            "player_id": 1,
            "turn_seconds": turn_seconds
        })
        await send_ilk11_lobby_update(rooms[current_room_code], broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- JOIN ----------
    if msg_type == "ilk11_join_room":
        name = (data.get("name") or "").strip()
        join_code = (data.get("room_code") or "").strip().upper()

        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return _handled(current_room_code, current_player_id)
        if join_code not in rooms:
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            return _handled(current_room_code, current_player_id)

        room = rooms[join_code]
        if room.get("mode") != "ilk_11_challenge":
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
            "type": "ilk11_room_joined",
            "room_code": current_room_code,
            "player_id": 2,
            "turn_seconds": room.get("turn_seconds", ILK11_SURE)
        })
        
        # 💬 Chat geçmişini yeni katılana gönder
        if room.get("chat_history"):
            await safe_send(websocket, {
                "type": "ilk11_chat_history",
                "messages": room["chat_history"][-50:]
            })
        
        await send_ilk11_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- Oda kontrolü ----------
    if not current_room_code or current_room_code not in rooms:
        return _handled(current_room_code, current_player_id)

    room = rooms[current_room_code]
    if room.get("mode") != "ilk_11_challenge":
        return _handled(current_room_code, current_player_id)

    # ---------- UPDATE ROOM SETTINGS ----------
    if msg_type == "ilk11_update_settings":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host ayarları değiştirebilir."})
            return _handled(current_room_code, current_player_id)
        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Sadece lobbyde ayarları değiştirebilirsin."})
            return _handled(current_room_code, current_player_id)

        try:
            new_turn_sec = int(data.get("turn_seconds", room.get("turn_seconds", ILK11_SURE)))
            if new_turn_sec not in [60, 90, 120, 180, 240]:
                new_turn_sec = 120
        except:
            new_turn_sec = 120

        room["turn_seconds"] = new_turn_sec

        await send_ilk11_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- START ----------
    if msg_type == "ilk11_start_game":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return _handled(current_room_code, current_player_id)
        if len(room["players"]) != 2:
            await safe_send(websocket, {"type": "error", "message": "2 oyuncu gerekli."})
            return _handled(current_room_code, current_player_id)
        await start_ilk11_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- REROLL OPTIONS (mevki kartlarını değiştir) ----------
    if msg_type == "ilk11_reroll_options":
        pos_id = (data.get("pos_id") or "").strip()
        rerolls_by_player = room.setdefault("ilk11_rerolls_left", {1: 3, 2: 3})
        rerolls_left = rerolls_by_player.get(current_player_id, 0)

        options_cache = room.get("ilk11_options_cache", {})
        player_cache = options_cache.get(current_player_id, {})
        current_options = player_cache.get(pos_id, []) if isinstance(player_cache, dict) else []

        failure_message = ""
        if current_player_id not in room.get("players", {}):
            failure_message = "Oyuncu odada bulunamadı."
        elif room.get("phase") != "playing":
            failure_message = "Oyun devam etmiyor."
        elif pos_id not in POSITIONS:
            failure_message = "Geçersiz mevki."
        elif room.get("ilk11_finished", {}).get(current_player_id, False):
            failure_message = "Kadron tamamlandı; kartları değiştiremezsin."
        elif pos_id in room.get("ilk11_teams", {}).get(current_player_id, {}):
            failure_message = "Bu mevki zaten doldurulmuş."
        elif rerolls_left <= 0:
            failure_message = "Değiştirme hakkın kalmadı."
        elif not current_options:
            failure_message = "Bu mevki için futbolcu seçenekleri bulunamadı."

        if failure_message:
            await safe_send(websocket, {
                "type": "ilk11_options",
                "pos_id": pos_id,
                "pos_name": POSITIONS.get(pos_id, {}).get("name", ""),
                "options": current_options,
                "rerolls_left": rerolls_left,
                "reroll_success": False,
                "message": failure_message
            })
            return _handled(current_room_code, current_player_id)

        used = room.get("ilk11_used", {}).get(current_player_id, set())
        excluded_indices = {
            option.get("index")
            for option in current_options
            if isinstance(option, dict) and isinstance(option.get("index"), int)
        }
        new_options = get_options_for_position(
            pos_id,
            used,
            5,
            excluded_indices
        )

        if not new_options:
            await safe_send(websocket, {
                "type": "ilk11_options",
                "pos_id": pos_id,
                "pos_name": POSITIONS[pos_id]["name"],
                "options": current_options,
                "rerolls_left": rerolls_left,
                "reroll_success": False,
                "message": "Bu mevkiye uygun başka futbolcu kalmadı."
            })
            return _handled(current_room_code, current_player_id)

        rerolls_left -= 1
        rerolls_by_player[current_player_id] = rerolls_left
        player_cache[pos_id] = new_options

        await safe_send(websocket, {
            "type": "ilk11_options",
            "pos_id": pos_id,
            "pos_name": POSITIONS[pos_id]["name"],
            "options": new_options,
            "rerolls_left": rerolls_left,
            "reroll_success": True
        })
        return _handled(current_room_code, current_player_id)

    # ---------- GET OPTIONS (pozisyon için seçenek iste) ----------
    if msg_type == "ilk11_get_options":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)

        pos_id = (data.get("pos_id") or "").strip()
        if pos_id not in POSITIONS:
            return _handled(current_room_code, current_player_id)

        team = room["ilk11_teams"].get(current_player_id, {})
        if pos_id in team:
            await safe_send(websocket, {"type": "error", "message": "Bu pozisyon zaten dolu."})
            return _handled(current_room_code, current_player_id)

        # Önbellekten kontrol (aynı mevkiye aynı seçenekler)
        if "ilk11_options_cache" not in room:
            room["ilk11_options_cache"] = {1: {}, 2: {}}
        
        cache = room["ilk11_options_cache"][current_player_id]
        
        # Önbellekte varsa ve seçenekler hala geçerliyse (used'da değilse) kullan
        used = room["ilk11_used"].get(current_player_id, set())
        
        if pos_id in cache:
            cached_options = cache[pos_id]
            # Önbellek hem seçilmemiş hem de bu mevkiye uygun adaylardan oluşmalı
            still_valid = isinstance(cached_options, list) and all(
                isinstance(opt, dict)
                and isinstance(opt.get("index"), int)
                and 0 <= opt["index"] < len(ALL_FOOTBALLERS)
                and opt["index"] not in used
                and is_player_eligible_for_position(
                    ALL_FOOTBALLERS[opt["index"]],
                    pos_id
                )
                for opt in cached_options
            )
            if still_valid:
                await safe_send(websocket, {
                    "type": "ilk11_options",
                    "pos_id": pos_id,
                    "pos_name": POSITIONS[pos_id]['name'],
                    "options": cached_options
                })
                return _handled(current_room_code, current_player_id)
        
        # Cache yok veya geçersiz → yeni üret
        options = get_options_for_position(pos_id, used, 5)
        cache[pos_id] = options

        await safe_send(websocket, {
            "type": "ilk11_options",
            "pos_id": pos_id,
            "pos_name": POSITIONS[pos_id]['name'],
            "options": options
        })
        return _handled(current_room_code, current_player_id)

    # ---------- SELECT (futbolcu seç) ----------
    if msg_type == "ilk11_select":
        if room.get("phase") != "playing":
            return _handled(current_room_code, current_player_id)
        if room["ilk11_finished"].get(current_player_id):
            return _handled(current_room_code, current_player_id)

        pos_id = (data.get("pos_id") or "").strip()
        f_index = data.get("index")

        if pos_id not in POSITIONS:
            return _handled(current_room_code, current_player_id)
        if not isinstance(f_index, int) or f_index < 0 or f_index >= len(ALL_FOOTBALLERS):
            return _handled(current_room_code, current_player_id)

        team = room["ilk11_teams"].get(current_player_id, {})
        used = room["ilk11_used"].get(current_player_id, set())

        if pos_id in team:
            return _handled(current_room_code, current_player_id)

        if not is_player_eligible_for_position(ALL_FOOTBALLERS[f_index], pos_id):
            await safe_send(websocket, {
                "type": "error",
                "message": "Bu futbolcu seçilen mevkiye uygun değil."
            })
            return _handled(current_room_code, current_player_id)

        all_options_cache = room.get("ilk11_options_cache", {})
        player_options_cache = (
            all_options_cache.get(current_player_id, {})
            if isinstance(all_options_cache, dict)
            else {}
        )
        offered_options = (
            player_options_cache.get(pos_id, [])
            if isinstance(player_options_cache, dict)
            else []
        )

        if not any(
            isinstance(option, dict) and option.get("index") == f_index
            for option in offered_options
        ):
            await safe_send(websocket, {
                "type": "error",
                "message": "Bu futbolcu bu mevki için sunulan adaylar arasında değil."
            })
            return _handled(current_room_code, current_player_id)

        if f_index in used:
            await safe_send(websocket, {"type": "error", "message": "Bu futbolcu zaten seçildi."})
            return _handled(current_room_code, current_player_id)

        team[pos_id] = f_index
        used.add(f_index)
        room["ilk11_teams"][current_player_id] = team
        room["ilk11_used"][current_player_id] = used
        
        # Cache'den bu pozisyonu temizle (artık dolu)
        if "ilk11_options_cache" in room:
            cache = room["ilk11_options_cache"].get(current_player_id, {})
            if pos_id in cache:
                del cache[pos_id]

        f = ALL_FOOTBALLERS[f_index]
        count = len(team)

        await safe_send(websocket, {
            "type": "ilk11_selected",
            "pos_id": pos_id,
            "index": f_index,
            "name": f["name"],
            "img_file": f.get("img_file", f["img"] + ".webp"),
            "count": count
        })

        # Rakibe ilerleme bildir
        other_id = get_other_player_id(current_player_id)
        if other_id in room["players"]:
            await safe_send(room["players"][other_id]["ws"], {
                "type": "ilk11_opponent_progress",
                "count": count
            })

        # 11 tamamlandı mı?
        if count >= 11:
            room["ilk11_finished"][current_player_id] = True

            await safe_send(websocket, {
                "type": "ilk11_team_complete",
                "message": "Takımın hazır! Rakip bekleniyor..."
            })

            other_id = get_other_player_id(current_player_id)
            if other_id in room["players"]:
                await safe_send(room["players"][other_id]["ws"], {
                    "type": "ilk11_opponent_finished",
                    "name": room["players"][current_player_id]["name"]
                })

            # İkisi de bitirdiyse sonuç
            if room["ilk11_finished"].get(1) and room["ilk11_finished"].get(2):
                old_task = room.get("ilk11_task")
                if old_task and not old_task.done():
                    old_task.cancel()

                await asyncio.sleep(1)
                await ilk11_show_result(room, broadcast)

        return _handled(current_room_code, current_player_id)

    # ---------- SIMULATION START ----------
    if msg_type == "ilk11_start_simulation":
        if current_player_id != 1:
            return _handled(current_room_code, current_player_id)
        if room.get("phase") != "result":
            return _handled(current_room_code, current_player_id)
        
        # Simülasyonu arka planda başlat
        asyncio.create_task(run_ilk11_simulation(room, broadcast))
        return _handled(current_room_code, current_player_id)

    # ---------- SIMULATION SPEED ----------
    if msg_type == "ilk11_sim_speed":
        if current_player_id != 1:
            await safe_send(websocket, {
                "type": "error",
                "message": "Simülasyon hızını sadece oda yöneticisi değiştirebilir."
            })
            return _handled(current_room_code, current_player_id)

        speed = data.get("speed", 1)
        try:
            speed = float(speed)
        except:
            speed = 1.0
        await broadcast(room, {
            "type": "ilk11_sim_speed_updated",
            "speed": speed
        })
        return _handled(current_room_code, current_player_id)

    # ---------- REMATCH ----------
    if msg_type == "ilk11_rematch":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host tekrar başlatabilir."})
            return _handled(current_room_code, current_player_id)
        if len(room["players"]) != 2:
            return _handled(current_room_code, current_player_id)
        await start_ilk11_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    # ---------- BACK TO LOBBY ----------
    if msg_type == "ilk11_back_to_lobby":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host lobiye döndürebilir."})
            return _handled(current_room_code, current_player_id)
        
        room["phase"] = "lobby"
        
        old_task = room.get("ilk11_task")
        if old_task and not old_task.done():
            old_task.cancel()
        
        await broadcast(room, {"type": "ilk11_back_to_lobby"})
        await send_ilk11_lobby_update(room, broadcast)
        return _handled(current_room_code, current_player_id)

    # ==========================================
    # 💬 CHAT MESAJI GÖNDER
    # ==========================================
    if msg_type == "ilk11_chat_send":
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
            "type": "ilk11_chat_msg",
            "sender_id": current_player_id,
            "sender_name": sender_name,
            "text": text,
            "ts": now
        })
        
        return _handled(current_room_code, current_player_id)

    return _handled(current_room_code, current_player_id)