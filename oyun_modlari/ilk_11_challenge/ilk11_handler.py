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
    'CM1': {'name': 'ORTA SAHA',  'x': 0.22, 'y': 0.48, 'type': 'OrtaSaha'},
    'CM2': {'name': 'ORTA SAHA',  'x': 0.50, 'y': 0.52, 'type': 'OrtaSaha'},
    'CM3': {'name': 'ORTA SAHA',  'x': 0.78, 'y': 0.48, 'type': 'OrtaSaha'},
    'LW':  {'name': 'SOL KANAT',  'x': 0.18, 'y': 0.22, 'type': 'Forvet'},
    'ST':  {'name': 'FORVET',     'x': 0.50, 'y': 0.15, 'type': 'Forvet'},
    'RW':  {'name': 'SAĞ KANAT',  'x': 0.82, 'y': 0.22, 'type': 'Forvet'},
}

ILK11_SURE = 120  # saniye


def _handled(room_code, player_id):
    return {"handled": True, "room_code": room_code, "player_id": player_id}


def _not_handled(room_code, player_id):
    return {"handled": False, "room_code": room_code, "player_id": player_id}


def get_other_player_id(pid):
    return 2 if pid == 1 else 1


# ==========================================
# RATING & KİMYA HESABI
# ==========================================

def calculate_rating(f, pos_type):
    rating = 55
    f_pos = f.get('position', 'Forvet')

    if f_pos == pos_type:
        rating += 25
    elif pos_type == 'OrtaSaha' and f_pos in ['Defans', 'Forvet']:
        rating += 10
    elif pos_type == 'Defans' and f_pos == 'OrtaSaha':
        rating += 14
    elif pos_type == 'Forvet' and f_pos == 'OrtaSaha':
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

def get_options_for_position(pos_type, used_indices, count=5):
    suitable = []
    for idx, f in enumerate(ALL_FOOTBALLERS):
        if idx in used_indices:
            continue

        f_pos = f.get('position', 'Forvet')
        match = 0

        if f_pos == pos_type:
            match = 100
        elif pos_type == 'Kaleci':
            if f_pos == 'Kaleci':
                match = 100
            else:
                continue
        elif pos_type == 'Defans' and f_pos == 'OrtaSaha':
            match = 50
        elif pos_type == 'OrtaSaha' and f_pos in ['Defans', 'Forvet']:
            match = 40
        elif pos_type == 'Forvet' and f_pos == 'OrtaSaha':
            match = 45
        else:
            match = 10

        if match > 0:
            suitable.append((idx, match))

    if not suitable:
        suitable = [(i, 10) for i in range(len(ALL_FOOTBALLERS)) if i not in used_indices]

    suitable.sort(key=lambda x: x[1], reverse=True)
    top = suitable[:min(25, len(suitable))]

    if len(top) >= count:
        selected = random.sample(top, count)
    else:
        selected = top

    result = []
    for idx, _ in selected:
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
            "positions": positions_data
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
            "ilk11_task": None
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
            # Cache'deki bir futbolcu artık başka pozisyonda seçilmişse geçersiz
            still_valid = all(opt["index"] not in used for opt in cached_options)
            if still_valid:
                await safe_send(websocket, {
                    "type": "ilk11_options",
                    "pos_id": pos_id,
                    "pos_name": POSITIONS[pos_id]['name'],
                    "options": cached_options
                })
                return _handled(current_room_code, current_player_id)
        
        # Cache yok veya geçersiz → yeni üret
        pos_type = POSITIONS[pos_id]['type']
        options = get_options_for_position(pos_type, used, 5)
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

    # ---------- REMATCH ----------
    if msg_type == "ilk11_rematch":
        if current_player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host tekrar başlatabilir."})
            return _handled(current_room_code, current_player_id)
        if len(room["players"]) != 2:
            return _handled(current_room_code, current_player_id)
        await start_ilk11_game(room, safe_send, broadcast)
        return _handled(current_room_code, current_player_id)

    return _handled(current_room_code, current_player_id)