# ========================================
# MİNİ FUTBOL - BACKEND HANDLER
# Haxball tarzı gerçek zamanlı futbol
# ========================================

import asyncio
import random
import time

# ==========================================
# FİZİK SABİTLERİ
# ==========================================
FIELD_WIDTH = 1000   # ✨ Default (1v1) - odaya göre değişir
FIELD_HEIGHT = 500   # ✨ Default (1v1) - odaya göre değişir
PLAYER_RADIUS = 20
BALL_RADIUS = 12
GOAL_WIDTH = 180     # ✨ Default (1v1) - odaya göre değişir

# ✨ Oyuncu sayısına göre saha boyutları
# Anahtar: player_count (2=1v1, 4=2v2, 6=3v3, 8=4v4, 10=5v5)
FIELD_SIZES = {
    2:  {"width": 1000, "height": 500, "goal_width": 180},   # 1v1 - mevcut
    4:  {"width": 1200, "height": 600, "goal_width": 200},   # 2v2
    6:  {"width": 1400, "height": 700, "goal_width": 220},   # 3v3
    8:  {"width": 1600, "height": 800, "goal_width": 240},   # 4v4
    10: {"width": 1800, "height": 900, "goal_width": 260},   # 5v5
}

def get_field_size(player_count):
    """Oyuncu sayısına göre saha boyutlarını döndür"""
    return FIELD_SIZES.get(player_count, FIELD_SIZES[2])

def get_field_dims(room):
    """Odadan alan boyutlarını al (dinamik)"""
    return {
        "width": room.get("field_width", FIELD_WIDTH),
        "height": room.get("field_height", FIELD_HEIGHT),
        "goal_width": room.get("field_goal_width", GOAL_WIDTH)
    }

GOAL_Y_TOP = (FIELD_HEIGHT - GOAL_WIDTH) / 2  # 135
GOAL_Y_BOTTOM = GOAL_Y_TOP + GOAL_WIDTH  # 265

KICK_COOLDOWN = 1.0
STRONG_KICK_THRESHOLD = 12
HARD_BALL_THRESHOLD = 6.0  # ✨ Top bu hızın üstündeyse yapışmasın, seksin
BALL_MAX_SPEED = 18.0       # ✨ Top max hız sınırı (kontrolsüz uçmasın)

# ✨ PLASE (kavisli şut) sabitleri
PLASE_POWER_MULT = 0.75        # Normal şutun %75'i güçte
PLASE_SPIN_FORCE = 0.35        # Spin kuvveti (yüksek = daha belirgin kavis)
PLASE_SPIN_DECAY = 0.94        # ✨ Spin biraz daha hızlı sönümlensin (Kısa kavis)
PLASE_SPRINT_BONUS = 1.35      # ✨ Koşarak plase %35 daha hızlı (Hızlı Plase)
PLASE_AFTERTOUCH_TIME = 0.2    # ✨ Şuttan sonra 0.2 saniye boyunca kavis verilebilir (Hızlı tepki)

# ✨ Santra kuralı
CENTER_CIRCLE_RADIUS = 60  # Orta yuvarlağın yarıçapı

# ✨ Kale direği çarpışması (top ve oyuncu direkten geçemesin)
GOAL_POST_RADIUS = 6  # Direk daire yarıçapı
CENTER_LINE_X = FIELD_WIDTH / 2  # Orta çizgi (400)
KICKOFF_TIMEOUT = 10.0  # Gol yiyen kaç saniyede topa dokunmalı
KICKOFF_WARNING_TIME = 3.0  # Son 3 sn top yanıp söner
AUTO_PASS_SPEED = 4.5  # Otomatik pas hızı

# 60 FPS - Sabit değerler
PLAYER_FRICTION = 0.90
BALL_FRICTION = 0.985
COLLISION_FORCE = 0.3
BALL_STICK_FACTOR = 0.85   # ✨ TAM YAPIŞIK (top oyuncuya yapışsın)

FPS = 60
FRAME_TIME = 1.0 / FPS

# Hız seviyeleri: yavaş / normal / hızlı
SPEED_PRESETS = {
    "yavas": {
        "player_speed": 2.0,      # ✨ Daha yavaş (2.8 → 2.0)
        "player_accel": 0.4,
        "kick_power": 11,
        "plase_spin": 0.18,       # ✨ Az kavis (yavaş = az falso)
    },
    "normal": {
        "player_speed": 2.8,      # ✨ Eski yavaş
        "player_accel": 0.55,
        "kick_power": 13,
        "plase_spin": 0.25,       # ✨ Orta kavis
    },
    "hizli": {
        "player_speed": 3.5,      # ✨ Eski normal
        "player_accel": 0.8,
        "kick_power": 15,
        "plase_spin": 0.35,       # ✨ Klasik kavis
    }
}

# ✨ Sprint (Shift ile hızlanma) - ENERJİ SİSTEMİ
SPRINT_MULTIPLIER = 1.5           # Normal hızın 1.5 katı (%50 hızlı)
SPRINT_MAX_ENERGY = 100.0         # Max enerji
SPRINT_DRAIN_PER_SEC = 33.3       # Saniyede azalma (100/3 = 3 saniyede biter)
SPRINT_REFILL_PER_SEC = 16.7      # Saniyede dolma (100/6 = 6 saniyede dolar)
SPRINT_KICK_MULTIPLIER = 1.3      # Sprint sırasında şut %30 daha güçlü

# ==========================================
# LOBBY UPDATE
# ==========================================

async def send_minifutbol_lobby_update(room, broadcast):
    """Mini Futbol lobby güncellemesi - 3 sütun sistemi"""
    # Tüm oyuncular
    all_players = []
    for pid, pdata in sorted(room["players"].items()):
        all_players.append({
            "id": pid,
            "name": pdata["name"],
            "team": pdata.get("team", "spectator"),
            "is_split_slave": pdata.get("is_split_slave", False),
            "in_lobby": pdata.get("in_lobby", False)  # ✨ Lobide bekleyen mi?
        })
    
    _fd_lobby = get_field_dims(room)
    msg = {
        "type": "mini_lobby_update",
        "room_code": room["room_code"],
        "players": all_players,
        "red_team_name": room.get("red_team_name", "Kırmızı Takım"),
        "blue_team_name": room.get("blue_team_name", "Mavi Takım"),
        "goal_target": room.get("goal_target", 3),
        "match_duration": room.get("match_duration", 180),
        "game_speed": room.get("game_speed", "normal"),
        "allow_plase": room.get("allow_plase", True),
        "ball_stick": room.get("ball_stick", True),
        "sprint_enabled": room.get("sprint_enabled", True),
        "pass_assistance": room.get("pass_assistance", True),
        "player_count": room.get("player_count", 2),
        "spectator_count": room.get("spectator_count", 0),
        "kickoff_timeout": room.get("kickoff_timeout", 10),
        "field_width": _fd_lobby["width"],
        "field_height": _fd_lobby["height"],
        "field_goal_width": _fd_lobby["goal_width"],
        "advanced_enabled": room.get("advanced_enabled", False),
        "advanced": room.get("advanced_settings"),
        "red_team_color": room.get("red_team_color", "#ff6b6b"),
        "blue_team_color": room.get("blue_team_color", "#4dabf7"),
        "red_sprint_color": room.get("red_sprint_color", "#ffd43b"),
        "blue_sprint_color": room.get("blue_sprint_color", "#ffd43b"),
        "goal_music_mode": room.get("goal_music_mode", "team")
    }
    await broadcast(room, msg)


# ==========================================
# OYUN DURUMU İLK KUR
# ==========================================

def reset_player_stats(room):
    """Tüm oyuncuların istatistiklerini sıfırla (yeni oyun/rematch için)"""
    for pid, p in room["players"].items():
        p["goals"] = 0
        p["assists"] = 0
        p["passes"] = 0


def init_game_state(room):
    """Oyun için başlangıç fizik durumu - TÜM takım oyuncuları sahada"""
    now = time.time()
    
    # ✨ Odanın saha boyutlarını al
    fd = get_field_dims(room)
    fw = fd["width"]
    fh = fd["height"]
    spawn_offset = fw * 0.2  # Duvardan %20 içeride spawn
    
    # ✨ TÜM kırmızı ve mavi takım oyuncularını al
    red_players = [pid for pid, p in room["players"].items() if p.get("team") == "red"]
    blue_players = [pid for pid, p in room["players"].items() if p.get("team") == "blue"]
    red_players.sort()
    blue_players.sort()
    
    # Sahada oynayanları kaydet (backward compat: ilk oyuncular)
    room["active_red_player"] = red_players[0] if red_players else None
    room["active_blue_player"] = blue_players[0] if blue_players else None
    room["active_red_players"] = red_players  # ✨ TÜM liste
    room["active_blue_players"] = blue_players  # ✨ TÜM liste
    
    # ✨ Y ekseninde dağılım hesapla
    def calc_y_positions(count, height):
        """N oyuncuyu Y ekseninde eşit dağıt"""
        if count == 1:
            return [height / 2]
        # 0.15 ile 0.85 arası eşit dağılım
        top = height * 0.15
        bottom = height * 0.85
        step = (bottom - top) / (count - 1)
        return [top + i * step for i in range(count)]
    
    red_ys = calc_y_positions(len(red_players), fh)
    blue_ys = calc_y_positions(len(blue_players), fh)
    
    players_dict = {}
    # Tüm kırmızı oyuncuları ekle
    for i, pid in enumerate(red_players):
        players_dict[pid] = {
            "x": spawn_offset,
            "y": red_ys[i],
            "vx": 0, "vy": 0,
            "keys": {"up": False, "down": False, "left": False, "right": False, "kick": False, "sprint": False},
            "last_kick_time": 0,
            "sprint_energy": SPRINT_MAX_ENERGY,
            "last_frame_time": 0,
            "team": "red"
        }
    # Tüm mavi oyuncuları ekle
    for i, pid in enumerate(blue_players):
        players_dict[pid] = {
            "x": fw - spawn_offset,
            "y": blue_ys[i],
            "vx": 0, "vy": 0,
            "keys": {"up": False, "down": False, "left": False, "right": False, "kick": False, "sprint": False},
            "last_kick_time": 0,
            "sprint_energy": SPRINT_MAX_ENERGY,
            "last_frame_time": 0,
            "team": "blue"
        }
    
    print(f"[MINI] init_game_state: {len(red_players)} kırmızı, {len(blue_players)} mavi oyuncu sahada")
    
    room["game_state"] = {
        "players": players_dict,
        # Top
        "ball": {
            "x": fw / 2,
            "y": fh / 2,
            "vx": 0,
            "vy": 0,
            "spin": 0  # ✨ Plase kavis değeri (+ saat yönü, - saat yönü tersi)
        },
        # Skor (her iki takım için)
        "scores": {1: 0, 2: 0},  # 1=kırmızı toplam, 2=mavi toplam (skor takım bazlı)
        # Süre
        "time_left": room["match_duration"],
        "match_start": now + 3.5,
        # Gol bekle
        "goal_wait_until": 0,
        "last_goal_scorer": None,
        # Başlangıç geri sayımı
        "countdown_end": now + 3.5,
        "countdown_start": now,
        "state": "countdown",
        # ✨ SANTRA KURALI (kickoff)
        "kickoff_active": False,
        "kickoff_receiving_team": None,
        "kickoff_restricted_team": None,
        "kickoff_start_time": 0,
        "kickoff_timeout": 0,
        # ✨ Kendi kalesine gol + asist için
        "last_ball_toucher": None,  # Son topa dokunan oyuncu
        "second_last_toucher": None,  # Ondan önceki topa dokunan (asist)
        "last_goal_own": False,
        "last_goal_assist": None  # Asist yapan oyuncu ID (varsa)
    }


def reset_positions(room):
    """Gol sonrası pozisyonları sıfırla - TÜM takım oyuncuları"""
    gs = room["game_state"]
    fd = get_field_dims(room)
    fw = fd["width"]
    fh = fd["height"]
    spawn_offset = fw * 0.2
    
    receiving_team = gs.get("kickoff_receiving_team")
    
    center_x = fw / 2
    center_y = fh / 2
    
    # ✨ Y ekseninde dağılım
    def calc_y_positions(count, height):
        if count == 1:
            return [height / 2]
        top = height * 0.15
        bottom = height * 0.85
        step = (bottom - top) / (count - 1)
        return [top + i * step for i in range(count)]
    
    # ✨ Kırmızı takım oyuncularını topla
    red_pids = sorted([pid for pid, p in gs["players"].items() if p.get("team") == "red"])
    blue_pids = sorted([pid for pid, p in gs["players"].items() if p.get("team") == "blue"])
    
    red_ys = calc_y_positions(len(red_pids), fh)
    blue_ys = calc_y_positions(len(blue_pids), fh)
    
    # KIRMIZI TAKIM
    for i, pid in enumerate(red_pids):
        p = gs["players"][pid]
        # Sadece ilk kırmızı oyuncu topa yaklaşabilir (santra atacaksa)
        if receiving_team == 1 and i == 0:
            p["x"] = center_x - 50
        else:
            p["x"] = spawn_offset
        p["y"] = red_ys[i]
        p["vx"] = 0
        p["vy"] = 0
        p["sprint_energy"] = SPRINT_MAX_ENERGY
    
    # MAVİ TAKIM
    for i, pid in enumerate(blue_pids):
        p = gs["players"][pid]
        if receiving_team == 2 and i == 0:
            p["x"] = center_x + 50
        else:
            p["x"] = fw - spawn_offset
        p["y"] = blue_ys[i]
        p["vx"] = 0
        p["vy"] = 0
        p["sprint_energy"] = SPRINT_MAX_ENERGY
    
    # Top ortada
    gs["ball"]["x"] = center_x
    gs["ball"]["y"] = center_y
    gs["ball"]["vx"] = 0
    gs["ball"]["vy"] = 0


def start_kickoff_countdown(room):
    """Gol sonrası santra geri sayımı başlat (3-2-1)"""
    now = time.time()
    gs = room["game_state"]
    gs["state"] = "countdown"
    gs["countdown_start"] = now
    gs["countdown_end"] = now + 3.5
    gs["pause_time"] = now
    
    # ✨ Tek kişi kontrolü: Karşı takımda kimse yoksa santra kuralı YOK
    red_pid = room.get("active_red_player")
    blue_pid = room.get("active_blue_player")
    solo_mode = (red_pid is None) or (blue_pid is None)
    
    # ✨ SANTRA KURALINI HAZIRLA (kickoff_restricted_team zaten goal_wait bitişinde set edildi)
    if gs.get("kickoff_restricted_team") is not None and not solo_mode:
        # Santra kuralı aktif (iki oyuncu da varsa)
        gs["kickoff_active"] = True
    else:
        # İlk oyun VEYA tek kişi → kısıtlama yok
        gs["kickoff_active"] = False


# ==========================================
# FİZİK GÜNCELLEME (her frame)
# ==========================================

def update_physics(room):
    """Bir frame'lik fizik güncellemesi"""
    gs = room["game_state"]
    now = time.time()
    
    # Hız ayarını al
    speed_mode = room.get("game_speed", "normal")
    preset = SPEED_PRESETS.get(speed_mode, SPEED_PRESETS["normal"])
    PLAYER_SPEED = preset["player_speed"]
    PLAYER_ACCEL = preset["player_accel"]
    KICK_POWER = preset["kick_power"]
    
    # ✨ GELİŞMİŞ AYARLAR (varsa preset'i override et)
    adv = room.get("advanced_settings") if room.get("advanced_enabled") else None
    if adv:
        KICK_POWER = adv.get("kickPower", KICK_POWER)
        ADV_SPRINT_KICK_BONUS = 1.0 + (adv.get("sprintKickBonus", 30) / 100.0)  # %30 → 1.30
        ADV_PLASE_POWER_MULT = adv.get("plasePower", 75) / 100.0                  # %75 → 0.75
        ADV_PLASE_SPIN_FORCE = adv.get("plaseSpin", 35) / 100.0                   # 35 → 0.35
        ADV_AFTERTOUCH_TIME = adv.get("afterTouchTime", 200) / 1000.0             # 200ms → 0.2sn
        ADV_BALL_MAX_SPEED = adv.get("ballMaxSpeed", 18)
        ADV_SPRINT_MULT = adv.get("sprintMultiplier", 170) / 100.0                # %170 → 1.7
        ADV_SPRINT_DURATION = adv.get("sprintDuration", 3)
        # Sprint drain = max_energy / duration
        ADV_SPRINT_DRAIN = 100.0 / ADV_SPRINT_DURATION if ADV_SPRINT_DURATION > 0 else 33.3
    else:
        ADV_SPRINT_KICK_BONUS = SPRINT_KICK_MULTIPLIER
        ADV_PLASE_POWER_MULT = PLASE_POWER_MULT
        ADV_PLASE_SPIN_FORCE = PLASE_SPIN_FORCE
        ADV_AFTERTOUCH_TIME = PLASE_AFTERTOUCH_TIME
        ADV_BALL_MAX_SPEED = BALL_MAX_SPEED
        ADV_SPRINT_MULT = SPRINT_MULTIPLIER
        ADV_SPRINT_DRAIN = SPRINT_DRAIN_PER_SEC
    
    # ✨ PAUSE durumundaysa hiçbir şey yapma (hem ESC pause hem P pause)
    if gs.get("state") in ["paused", "quick_paused"]:
        return None
    
    # ✨ COUNTDOWN durumundaysa fizik durur
    if gs.get("state") == "countdown":
        if now >= gs.get("countdown_end", 0):
            # Geri sayım bitti, oyun başlasın
            gs["state"] = "playing"
            # Match süresini kaydır (duraklama telafisi)
            if "pause_time" in gs:
                pause_duration = now - gs["pause_time"]
                gs["match_start"] += pause_duration
                del gs["pause_time"]
            
            # ✨ Santra timer'ını başlat
            if gs.get("kickoff_active"):
                gs["kickoff_start_time"] = now
                gs["kickoff_timeout"] = now + KICKOFF_TIMEOUT
        return None
    
    # ✨ GOL KUTLAMASI durumundaysa - fizik devam eder ama süre durur
    if gs.get("state") == "goal_wait":
        if now >= gs.get("goal_wait_until", 0):
            # ✨ Kendi kalesine gol için override var mı?
            override_restricted = gs.get("kickoff_restricted_team_override")
            override_receiving = gs.get("kickoff_receiving_team_override")
            
            if override_restricted is not None:
                # Kendi kalesine gol - override kullan
                gs["kickoff_restricted_team"] = override_restricted
                gs["kickoff_receiving_team"] = override_receiving
            else:
                # Normal gol - klasik mantık
                scorer = gs.get("last_goal_scorer")
                if scorer:
                    gs["kickoff_restricted_team"] = scorer  # gol atan
                    gs["kickoff_receiving_team"] = 1 if scorer == 2 else 2  # gol yiyen
            
            # Override'ı temizle (sonraki gol için)
            gs["kickoff_restricted_team_override"] = None
            gs["kickoff_receiving_team_override"] = None
            
            reset_positions(room)
            start_kickoff_countdown(room)
            return None
        # ⚠️ Fizik devam etsin (oyuncular hareket edebilir), sadece süre durur
        # Ama gol algılamayı YAPMA (double gol olmasın)
    
    # ✨ PAUSE ise fizik durur (üstte handle edildi ama garanti olsun)
    if gs.get("state") == "paused":
        return None
    
    # === OYUNCU HAREKETİ ===
    for pid, p in gs["players"].items():
        keys = p["keys"]
        
        # ✨ Sprint aktifse ivme azalır (kademeli hızlansın, anlık zıplama olmasın)
        current_speed = (p["vx"]**2 + p["vy"]**2) ** 0.5
        is_sprint_pressed = p["keys"].get("sprint", False) and p.get("sprint_energy", 0) > 0
        
        # Sprint aktifken ve zaten normal max hızın üstündeysek ivmeyi düşür
        if is_sprint_pressed and current_speed > PLAYER_SPEED * 0.95:
            accel = PLAYER_ACCEL * 0.75  # Sprint bölgesinde biraz daha yavaş ivme
        else:
            accel = PLAYER_ACCEL  # Normal ivme
        
        # İvme uygula (WASD/Ok tuşlarına göre)
        if keys["up"]:
            p["vy"] -= accel
        if keys["down"]:
            p["vy"] += accel
        if keys["left"]:
            p["vx"] -= accel
        if keys["right"]:
            p["vx"] += accel
        
        # ✨ SPRINT ENERJİ SİSTEMİ
        # Delta time hesapla (kaç saniye geçti son frame'den)
        if p.get("last_frame_time", 0) == 0:
            delta = FRAME_TIME
        else:
            delta = now - p["last_frame_time"]
            if delta > 0.1:  # çok büyükse (lag) normale çek
                delta = FRAME_TIME
        p["last_frame_time"] = now
        
        # Sprint aktif mi?
        is_sprinting = False
        current_energy = p.get("sprint_energy", SPRINT_MAX_ENERGY)
        
        if p["keys"].get("sprint") and current_energy > 0:
            # Shift basılı VE enerji var → sprint aktif
            is_sprinting = True
            # Enerji tüket
            current_energy -= ADV_SPRINT_DRAIN * delta
            if current_energy < 0:
                current_energy = 0
        else:
            # Shift bırakılı VEYA enerji bitti → dolmaya başla
            current_energy += SPRINT_REFILL_PER_SEC * delta
            if current_energy > SPRINT_MAX_ENERGY:
                current_energy = SPRINT_MAX_ENERGY
        
        p["sprint_energy"] = current_energy
        
        # Max hız sınırı (sprint varsa arttır)
        max_speed = PLAYER_SPEED * (ADV_SPRINT_MULT if is_sprinting else 1.0)
        speed = (p["vx"]**2 + p["vy"]**2) ** 0.5
        if speed > max_speed:
            p["vx"] = (p["vx"] / speed) * max_speed
            p["vy"] = (p["vy"] / speed) * max_speed
        
        # Sürtünme
        p["vx"] *= PLAYER_FRICTION
        p["vy"] *= PLAYER_FRICTION
        
        # Çok küçük hızları sıfırla
        if abs(p["vx"]) < 0.1: p["vx"] = 0
        if abs(p["vy"]) < 0.1: p["vy"] = 0
        
        # Pozisyon güncelle
        p["x"] += p["vx"]
        p["y"] += p["vy"]
               
        
        # ✨ Duvar çarpışması - oyuncu sahanın biraz dışına çıkabilsin (dış yeşil alan)
        PLAYER_OUT_MARGIN = 55  # ✨ Oyuncu 55 px dışarı çıkabilir (frontend canvas margin ile eşit)
        
        if p["x"] - PLAYER_RADIUS < -PLAYER_OUT_MARGIN:
            p["x"] = -PLAYER_OUT_MARGIN + PLAYER_RADIUS
            p["vx"] = 0
        if p["x"] + PLAYER_RADIUS > FIELD_WIDTH + PLAYER_OUT_MARGIN:
            p["x"] = FIELD_WIDTH + PLAYER_OUT_MARGIN - PLAYER_RADIUS
            p["vx"] = 0
        if p["y"] - PLAYER_RADIUS < -PLAYER_OUT_MARGIN:
            p["y"] = -PLAYER_OUT_MARGIN + PLAYER_RADIUS
            p["vy"] = 0
        if p["y"] + PLAYER_RADIUS > FIELD_HEIGHT + PLAYER_OUT_MARGIN:
            p["y"] = FIELD_HEIGHT + PLAYER_OUT_MARGIN - PLAYER_RADIUS
            p["vy"] = 0
        
        # ✨ SANTRA KURALI - Team bazlı (2-5 kişi destekli)
        if gs.get("kickoff_active"):
            restricted = gs.get("kickoff_restricted_team")  # 1=kırmızı, 2=mavi
            receiving = gs.get("kickoff_receiving_team")
            p_team = p.get("team")
            # Team ID (1 veya 2) hesapla
            p_team_id = 1 if p_team == "red" else (2 if p_team == "blue" else None)
            
            if p_team_id == restricted:
                # 🚫 GOL ATAN takımdan HERKES - santra çemberine giremez
                if p_team == "red":
                    boundary_x = CENTER_LINE_X - CENTER_CIRCLE_RADIUS
                    if p["x"] + PLAYER_RADIUS > boundary_x:
                        p["x"] = boundary_x - PLAYER_RADIUS
                        if p["vx"] > 0: p["vx"] = 0
                elif p_team == "blue":
                    boundary_x = CENTER_LINE_X + CENTER_CIRCLE_RADIUS
                    if p["x"] - PLAYER_RADIUS < boundary_x:
                        p["x"] = boundary_x + PLAYER_RADIUS
                        if p["vx"] < 0: p["vx"] = 0
            
            elif p_team_id == receiving:
                # ⚽ GOL YİYEN takımdan HERKES - çemberin karşı tarafına kadar gidebilir
                if p_team == "red":
                    boundary_x = CENTER_LINE_X + CENTER_CIRCLE_RADIUS
                    if p["x"] + PLAYER_RADIUS > boundary_x:
                        p["x"] = boundary_x - PLAYER_RADIUS
                        if p["vx"] > 0: p["vx"] = 0
                elif p_team == "blue":
                    boundary_x = CENTER_LINE_X - CENTER_CIRCLE_RADIUS
                    if p["x"] - PLAYER_RADIUS < boundary_x:
                        p["x"] = boundary_x + PLAYER_RADIUS
                        if p["vx"] < 0: p["vx"] = 0
    
    # === TOP HAREKETİ (CCD - Substep ile tunneling engelli) ===
    ball = gs["ball"]
    
    # ✨ CCD: Top hızlıysa hareketi küçük adımlara böl (oyuncunun içinden geçmesin)
    ball_speed_now = (ball["vx"]**2 + ball["vy"]**2) ** 0.5
    # Max güvenli adım = oyuncu yarıçapının yarısı (10 px)
    max_step = PLAYER_RADIUS * 0.5
    if ball_speed_now > max_step:
        substeps = int(ball_speed_now / max_step) + 1
        if substeps > 8:
            substeps = 8  # aşırı çok bölme (performans)
    else:
        substeps = 1
    
    step_vx = ball["vx"] / substeps
    step_vy = ball["vy"] / substeps
    
    for _ in range(substeps):
        ball["x"] += step_vx
        ball["y"] += step_vy
        
        # Her substep'te oyuncularla çarpışma kontrol (tunneling engeli)
        for pid, p in gs["players"].items():
            dx_ = ball["x"] - p["x"]
            dy_ = ball["y"] - p["y"]
            dist_ = (dx_**2 + dy_**2) ** 0.5
            min_dist_ = PLAYER_RADIUS + BALL_RADIUS
            
            if dist_ < min_dist_:
                # Top oyuncunun içine girmeye çalışıyor → dışına it
                if dist_ < 0.1:
                    # Tam üstünde → topun hız yönüne ters it
                    speed_ = (ball["vx"]**2 + ball["vy"]**2) ** 0.5
                    if speed_ > 0.1:
                        nx_ = -ball["vx"] / speed_
                        ny_ = -ball["vy"] / speed_
                    else:
                        nx_ = 1
                        ny_ = 0
                    dist_ = 0.1
                else:
                    nx_ = dx_ / dist_
                    ny_ = dy_ / dist_
                
                # Topu oyuncunun dışına zorla al
                ball["x"] = p["x"] + nx_ * min_dist_
                ball["y"] = p["y"] + ny_ * min_dist_
                
                # Yönü ters çevir (yansıma) - substep bitince aşağıdaki normal çarpışma kodu hızları düzenleyecek
                # Ama tunneling'i durdurmak için step_vx/vy'yi de sıfırla
                step_vx = 0
                step_vy = 0
                break  # bu substep bitir
    
    ball["vx"] *= BALL_FRICTION
    ball["vy"] *= BALL_FRICTION
    
    # ✨ AFTER-TOUCH (Vurduktan sonra kavis verme)
    if ball.get("last_kick_type") == "plase":
        kicker_id = ball.get("kicker_id")
        kick_time = ball.get("kick_time", 0)
        
        # After-touch süresi dolmadıysa ve oyuncu hala odadaysa
        if now - kick_time < ADV_AFTERTOUCH_TIME and kicker_id in gs["players"]:
            kicker = gs["players"][kicker_id]
            
            # Şut yönünü dikkate alarak (vx, vy) dik bileşenleri hesapla
            ball_speed = (ball["vx"]**2 + ball["vy"]**2) ** 0.5
            if ball_speed > 1.0:
                nx = ball["vx"] / ball_speed
                ny = ball["vy"] / ball_speed
                perp_x = -ny
                perp_y = nx
                
                # Oyuncunun şu anki yön tuşları
                in_x = 0
                if kicker["keys"]["right"]: in_x += 1
                if kicker["keys"]["left"]: in_x -= 1
                in_y = 0
                if kicker["keys"]["down"]: in_y += 1
                if kicker["keys"]["up"]: in_y -= 1
                
                # Tuşların şut yönüne dik etkisi
                cross = in_x * perp_x + in_y * perp_y
                if abs(cross) > 0.1:
                    # Spin'i oyuncunun tuşuna göre anlık güncelle
                    spin_dir = 1 if cross > 0 else -1
                    # Koşuyorsa daha sert spin
                    sprint_bonus = 1.4 if (kicker["keys"]["sprint"] and kicker.get("sprint_energy", 0) > 0) else 1.0
                    ball["spin"] = ADV_PLASE_SPIN_FORCE * spin_dir * sprint_bonus
        else:
            # Süre doldu, After-touch bitti
            ball["last_kick_type"] = None

    # ✨ SPIN (plase kavisi) uygula
    spin = ball.get("spin", 0)
    if abs(spin) > 0.001:
        # Spin = hız vektörüne dik kuvvet uygular
        # Dik vektör: (vx,vy) → (-vy, vx) normalize edilmiş
        ball_speed = (ball["vx"]**2 + ball["vy"]**2) ** 0.5
        if ball_speed > 0.5:
            perp_x = -ball["vy"] / ball_speed
            perp_y = ball["vx"] / ball_speed
            ball["vx"] += perp_x * spin
            ball["vy"] += perp_y * spin
        # Spin azalt
        ball["spin"] = spin * PLASE_SPIN_DECAY
        if abs(ball["spin"]) < 0.005:
            ball["spin"] = 0
    
    # Top hızı çok küçükse dur
    if abs(ball["vx"]) < 0.05: ball["vx"] = 0
    if abs(ball["vy"]) < 0.05: ball["vy"] = 0
    # ⚠️ Sınır güvenliğini KALDIRDIK - artık duvar çarpışması + gol algılama halledecek
    
    # === OYUNCU-OYUNCU ÇARPIŞMASI (duvar gibi çarp, ama iteleme YOK) ===
    player_list = list(gs["players"].items())
    for i in range(len(player_list)):
        for j in range(i + 1, len(player_list)):
            pid1, p1 = player_list[i]
            pid2, p2 = player_list[j]
            
            dx = p2["x"] - p1["x"]
            dy = p2["y"] - p1["y"]
            dist = (dx**2 + dy**2) ** 0.5
            min_dist = PLAYER_RADIUS * 2
            
            if dist < min_dist and dist > 0:
                # Çakışmayı çöz (iki oyuncuyu birbirinden ayır)
                overlap = min_dist - dist
                nx = dx / dist
                ny = dy / dist
                
                # İki oyuncuyu birbirinden it (sadece pozisyon düzeltmesi)
                p1["x"] -= nx * overlap / 2
                p1["y"] -= ny * overlap / 2
                p2["x"] += nx * overlap / 2
                p2["y"] += ny * overlap / 2
                
                # ✨ Hız transferi YOK - sadece birbirlerine doğru olan hız bileşenini SIFIRLA
                # p1 → p2 yönüne gidiyorsa dursun (duvara çarpmış gibi)
                v1_toward = p1["vx"] * nx + p1["vy"] * ny  # p1'in p2'ye doğru hızı
                if v1_toward > 0:
                    p1["vx"] -= v1_toward * nx
                    p1["vy"] -= v1_toward * ny
                
                # p2 → p1 yönüne gidiyorsa dursun
                v2_toward = p2["vx"] * (-nx) + p2["vy"] * (-ny)  # p2'nin p1'e doğru hızı
                if v2_toward > 0:
                    p2["vx"] -= v2_toward * (-nx)
                    p2["vy"] -= v2_toward * (-ny)
    
    # === ŞUT KONTROLÜ (basma anında 1 kez - basılı tutma = tek şut) ===
    for pid, p in gs["players"].items():
        # ✨ Sadece bu frame'de yeni basıldıysa şut at (basılı tutma engelli)
        if p["keys"]["kick"] and not p.get("kick_was_pressed", False):
            p["kick_was_pressed"] = True  # bir sonraki frame'e "basıldı" bilgisi geç
            time_since_last = now - p.get("last_kick_time", 0)
            if time_since_last >= KICK_COOLDOWN:
                p["last_kick_time"] = now
                is_sprinting_log = p["keys"].get("sprint") and p.get("sprint_energy", 0) > 0
                print(f"[MINI ŞUT] Oyuncu {pid} şut çekiyor (sprint: {is_sprinting_log})")
                
                # Efekt (enerji bilgisiyle - parlaklık için)
                if "kick_effects" not in gs:
                    gs["kick_effects"] = []
                current_energy_percent = p.get("sprint_energy", SPRINT_MAX_ENERGY) / SPRINT_MAX_ENERGY
                gs["kick_effects"].append({
                    "player_id": pid,
                    "x": p["x"],
                    "y": p["y"],
                    "time": now,
                    "energy_at_kick": current_energy_percent  # ✨ Şut anındaki enerji %
                })
                
                # Topa değiyor mu kontrol et (mesafe toleransı arttırıldı)
                dx = ball["x"] - p["x"]
                dy = ball["y"] - p["y"]
                dist = (dx**2 + dy**2) ** 0.5
                min_dist = PLAYER_RADIUS + BALL_RADIUS + 15  # ✨ 5 → 15 (daha yakın kabul et)
                
                if dist < min_dist and dist > 0:
                    # ✨ SANTRA KURALI KONTROLÜ
                    if gs.get("kickoff_active"):
                        if pid != gs.get("kickoff_receiving_team"):
                            continue
                        gs["kickoff_active"] = False
                    
                    # Şut yönü: oyuncudan topa doğru
                    nx = dx / dist
                    ny = dy / dist
                    
                    # ✨ Top köşede/duvarda sıkışmış mı kontrol et
                    ball_at_left = ball["x"] < BALL_RADIUS + 8
                    ball_at_right = ball["x"] > FIELD_WIDTH - BALL_RADIUS - 8
                    ball_at_top = ball["y"] < BALL_RADIUS + 8
                    ball_at_bottom = ball["y"] > FIELD_HEIGHT - BALL_RADIUS - 8
                    
                    is_stuck = ball_at_left or ball_at_right or ball_at_top or ball_at_bottom
                    
                    if is_stuck:
                        # ✨ Top sıkışmış → oyuncudan uzağa doğru fırlat (ters yön)
                        # Yön = oyuncudan topa doğru DEĞİL, tam tersi
                        # Ama duvardan da uzaklaştır
                        
                        # Duvar ters yönü hesapla
                        kick_nx = nx
                        kick_ny = ny
                        
                        # X ekseninde duvar varsa X'i tersle
                        if ball_at_left:
                            kick_nx = abs(kick_nx)  # sağa gitsin
                        elif ball_at_right:
                            kick_nx = -abs(kick_nx)  # sola gitsin
                        
                        # Y ekseninde duvar varsa Y'yi tersle
                        if ball_at_top:
                            kick_ny = abs(kick_ny)  # aşağı gitsin
                        elif ball_at_bottom:
                            kick_ny = -abs(kick_ny)  # yukarı gitsin
                        
                        # Vektörü normalize et
                        vlen = (kick_nx**2 + kick_ny**2) ** 0.5
                        if vlen > 0:
                            kick_nx /= vlen
                            kick_ny /= vlen
                        else:
                            # Çok extreme durum - merkez'e doğru şut
                            cdx = FIELD_WIDTH / 2 - ball["x"]
                            cdy = FIELD_HEIGHT / 2 - ball["y"]
                            clen = (cdx**2 + cdy**2) ** 0.5
                            if clen > 0:
                                kick_nx = cdx / clen
                                kick_ny = cdy / clen
                            else:
                                kick_nx = 1
                                kick_ny = 0
                        
                        # Topu duvardan biraz uzaklaştır (sıkışmayı çöz)
                        ball["x"] += kick_nx * 5
                        ball["y"] += kick_ny * 5
                        
                        # Sınır kontrolü
                        if ball["x"] < BALL_RADIUS: ball["x"] = BALL_RADIUS
                        if ball["x"] > FIELD_WIDTH - BALL_RADIUS: ball["x"] = FIELD_WIDTH - BALL_RADIUS
                        if ball["y"] < BALL_RADIUS: ball["y"] = BALL_RADIUS
                        if ball["y"] > FIELD_HEIGHT - BALL_RADIUS: ball["y"] = FIELD_HEIGHT - BALL_RADIUS
                        
                        # ✨ Sprint aktifse köşe şutu da güçlü (enerji > 0 ve shift basılı)
                        corner_kick_mult = 1.0
                        if p["keys"].get("sprint") and p.get("sprint_energy", 0) > 0:
                            corner_kick_mult = SPRINT_KICK_MULTIPLIER
                        
                        # Güçlü şut ters yöne
                        ball["vx"] = kick_nx * KICK_POWER * corner_kick_mult
                        ball["vy"] = kick_ny * KICK_POWER * corner_kick_mult
                        
                        print(f"[MINI] Köşe şutu: top ({ball['x']:.0f}, {ball['y']:.0f}) → hız ({ball['vx']:.1f}, {ball['vy']:.1f})")
                    else:
                        # ✨ PLASE ALGILAMA
                        # Şut yönüne (nx,ny) dik olan hareket input'u varsa → plase
                        # Dik vektör: (-ny, nx)
                        perp_x = -ny
                        perp_y = nx
                        
                        # Oyuncunun yön input vektörü
                        input_x = 0
                        input_y = 0
                        if p["keys"]["right"]: input_x += 1
                        if p["keys"]["left"]: input_x -= 1
                        if p["keys"]["down"]: input_y += 1
                        if p["keys"]["up"]: input_y -= 1
                        
                        # Input'un şut yönüne dik bileşeni (dot product)
                        cross_component = input_x * perp_x + input_y * perp_y
                        
                        is_plase = abs(cross_component) > 0.3
                        
                        # ✨ Sprint kontrolü
                        sprint_active = p["keys"].get("sprint") and p.get("sprint_energy", 0) > 0
                        
                        # ✨ FALSO İZNİ KONTROLÜ (Gelişmiş ayarlar açıksa her zaman izinli)
                        plase_allowed = room.get("allow_plase", True) or adv is not None
                        
                        if is_plase and plase_allowed:
                            # PLASE ŞUT - daha zayıf
                            kick_mult = ADV_PLASE_POWER_MULT
                            if sprint_active:
                                kick_mult *= PLASE_SPRINT_BONUS
                            
                            ball["vx"] = nx * KICK_POWER * kick_mult
                            ball["vy"] = ny * KICK_POWER * kick_mult
                            
                            # ✨ AFTER-TOUCH BAŞLAT
                            ball["spin"] = 0
                            ball["last_kick_type"] = "plase"
                            ball["kick_time"] = now
                            ball["kicker_id"] = pid
                            
                            print(f"[MINI] Oyuncu {pid} PLASE! Güç: {KICK_POWER * kick_mult:.1f}, After-touch aktif")
                        else:
                            # NORMAL ŞUT (veya plase izin verilmiyorsa)
                            kick_mult = 1.0
                            if sprint_active:
                                kick_mult = ADV_SPRINT_KICK_BONUS
                                print(f"[MINI] Oyuncu {pid} SPRINT ŞUT! Güç: {KICK_POWER * kick_mult:.1f}")
                            
                            ball["vx"] = nx * KICK_POWER * kick_mult
                            ball["vy"] = ny * KICK_POWER * kick_mult
                            ball["spin"] = 0  # Düz şut spin'i sıfırla
                            
                            # ✨ Plase yapmaya çalıştı ama izin yok
                            if is_plase and not plase_allowed:
                                print(f"[MINI] Oyuncu {pid} plase denedi ama izin kapalı → düz şut oldu")
                        
                        # ✨ Şut çeken de last_toucher olur (asist kaydı da)
                        if gs.get("last_ball_toucher") != pid:
                            gs["second_last_toucher"] = gs.get("last_ball_toucher")
                            gs["last_ball_toucher"] = pid
    
    # ✨ Şut tuşu bırakıldıysa flag'ı sıfırla (yeni basma için)
    for pid, p in gs["players"].items():
        if not p["keys"].get("kick", False):
            p["kick_was_pressed"] = False
    
    # === TOP-OYUNCU ÇARPIŞMASI (dokunma) ===
    for pid, p in gs["players"].items():
        dx = ball["x"] - p["x"]
        dy = ball["y"] - p["y"]
        dist = (dx**2 + dy**2) ** 0.5
        min_dist = PLAYER_RADIUS + BALL_RADIUS
        
        if dist < min_dist:
            # dist=0 durumunu handle et (üst üste)
            if dist < 0.1:
                # Rastgele yön ver
                nx = 1
                ny = 0
                dist = 0.1
            else:
                nx = dx / dist
                ny = dy / dist
            
            overlap = min_dist - dist
            
            # ✨ SANTRA KURALI: Gol atan takım topa dokunamaz
            if gs.get("kickoff_active"):
                if pid == gs.get("kickoff_restricted_team"):
                    # Oyuncuyu topdan uzağa it (topu itme)
                    p["x"] -= nx * overlap
                    p["y"] -= ny * overlap
                    # Oyuncu topa yaklaşamaz, hız sıfır
                    if p["vx"] * nx + p["vy"] * ny > 0:  # topa doğru gidiyorsa dur
                        p["vx"] = 0
                        p["vy"] = 0
                    continue
                elif pid == gs.get("kickoff_receiving_team"):
                    # Gol yiyen topa dokundu → kural kalksın
                    gs["kickoff_active"] = False
            
            # ✨ Son dokunan oyuncuyu kaydet (kendi kalesine gol + asist için)
            if gs.get("last_ball_toucher") != pid:
                # Farklı oyuncu dokundu → önceki asist olabilir
                prev_toucher = gs.get("last_ball_toucher")
                gs["second_last_toucher"] = prev_toucher
                gs["last_ball_toucher"] = pid
                
                # ✨ PAS KONTROLÜ: önceki dokunan aynı takımdan ve gerçek bir oyuncuysa +1 pas
                if prev_toucher and prev_toucher != pid and prev_toucher in room["players"]:
                    prev_team = room["players"][prev_toucher].get("team")
                    curr_team = room["players"][pid].get("team")
                    if prev_team == curr_team and prev_team in ["red", "blue"]:
                        room["players"][prev_toucher]["passes"] = room["players"][prev_toucher].get("passes", 0) + 1
            
            # ✨ Duvara yakın mı kontrolü (top köşede olabilir)
            near_wall_x = ball["x"] < BALL_RADIUS + 5 or ball["x"] > FIELD_WIDTH - BALL_RADIUS - 5
            near_wall_y = ball["y"] < BALL_RADIUS + 5 or ball["y"] > FIELD_HEIGHT - BALL_RADIUS - 5
            
            if near_wall_x or near_wall_y:
                # Top duvara yakın → oyuncuyu geri it (topu itmek yerine)
                p["x"] -= nx * overlap
                p["y"] -= ny * overlap
                
                # Sınır kontrolü
                if p["x"] - PLAYER_RADIUS < 0: p["x"] = PLAYER_RADIUS
                if p["x"] + PLAYER_RADIUS > FIELD_WIDTH: p["x"] = FIELD_WIDTH - PLAYER_RADIUS
                if p["y"] - PLAYER_RADIUS < 0: p["y"] = PLAYER_RADIUS
                if p["y"] + PLAYER_RADIUS > FIELD_HEIGHT: p["y"] = FIELD_HEIGHT - PLAYER_RADIUS
            else:
                # Normal çarpışma → topu it
                ball["x"] += nx * overlap
                ball["y"] += ny * overlap
            
            # ✨ Top hızını kontrol et
            ball_speed = (ball["vx"]**2 + ball["vy"]**2) ** 0.5
            
            if ball_speed > HARD_BALL_THRESHOLD:
                # ⚡ Top HIZLI geliyor → YAPIŞMASIN, seksin (defans/kaleci gibi)
                # Elastik çarpışma - top oyuncuya çarpınca geri sekmeli
                
                # Topun hızını normalize et
                bvx = ball["vx"]
                bvy = ball["vy"]
                
                # Oyuncuya göre yansıt (reflection)
                # v' = v - 2 * (v . n) * n
                dot = bvx * nx + bvy * ny
                
                if dot < 0:  # Top oyuncuya doğru geliyorsa
                    # Yansıma - biraz kayıp ile (0.75)
                    ball["vx"] = (bvx - 2 * dot * nx) * 0.75
                    ball["vy"] = (bvy - 2 * dot * ny) * 0.75
                    
                    # Oyuncunun hızını da hafif ekle (blok yaparken hafif kontrol)
                    ball["vx"] += p["vx"] * 0.2
                    ball["vy"] += p["vy"] * 0.2
                
                ball["spin"] = ball.get("spin", 0) * 0.3  # ✨ Oyuncuya çarpınca spin çok azalır
            else:
                # 🐢 Top YAVAŞ → normal yapışma (sürüş)
                ball["vx"] = ball["vx"] * (1 - BALL_STICK_FACTOR) + p["vx"] * BALL_STICK_FACTOR
                ball["vy"] = ball["vy"] * (1 - BALL_STICK_FACTOR) + p["vy"] * BALL_STICK_FACTOR
                ball["spin"] = 0  # ✨ Yapışınca spin tamamen biter
            
            # ✨ Max hız sınırı (top çok hızlanmasın)
            ball_speed = (ball["vx"]**2 + ball["vy"]**2) ** 0.5
            if ball_speed > ADV_BALL_MAX_SPEED:
                ball["vx"] = (ball["vx"] / ball_speed) * ADV_BALL_MAX_SPEED
                ball["vy"] = (ball["vy"] / ball_speed) * ADV_BALL_MAX_SPEED
    
    # ✨ SANTRA TIMEOUT KONTROLÜ (10 sn)
    if gs.get("kickoff_active"):
        if now >= gs.get("kickoff_timeout", 0):
            # Süre bitti → CEZA! Top gol atan takıma verilir
            gs["kickoff_active"] = False
            restricted_team = gs.get("kickoff_restricted_team")  # gol atan
            
            # Top gol atan takıma doğru yavaşça gitsin
            if restricted_team == 1:
                # Sol takım (gol atan) → top sola gitsin
                ball["vx"] = -AUTO_PASS_SPEED
            else:
                # Sağ takım (gol atan) → top sağa gitsin
                ball["vx"] = AUTO_PASS_SPEED
            ball["vy"] = (random.random() - 0.5) * 2  # Hafif dikey rastgelelik
            
            print(f"[MINI] Santra ceza: Top {'sol' if restricted_team == 1 else 'sağ'} takıma verildi (gol atan)")
    
    # === TOP DUVAR ÇARPIŞMASI + GOL ALGILAMA ===
    WALL_BOUNCE = 0.55  # ✨ Daha güçlü sekme (0.35 → 0.55, köşede kalmasın)
    MIN_BOUNCE_SPEED = 3.0  # ✨ Minimum sekme hızı (yavaş top köşede kalmasın)
    
    # ✨ Gol kutlaması sırasında yeni gol OLMASIN
    goal_lock = gs.get("state") == "goal_wait"
    
    # Sol duvar (KALE) - Kırmızı takımın (1) kalesi
    if ball["x"] + BALL_RADIUS <= 0:
        if GOAL_Y_TOP < ball["y"] < GOAL_Y_BOTTOM and not goal_lock:
            # Sol kaleye gol → skor 2'ye
            gs["scores"][2] += 1
            
            last_toucher = gs.get("last_ball_toucher")
            second_toucher = gs.get("second_last_toucher")
            own_goal = False
            assist_pid = None
            
            if last_toucher == 1:
                # Kırmızı kendi kalesine attı
                own_goal = True
                gs["last_goal_scorer"] = 1
                gs["kickoff_restricted_team_override"] = 2
                gs["kickoff_receiving_team_override"] = 1
                print(f"[MINI GOL!] KENDİ KALESİNE - Kırmızı kendine attı!")
            else:
                # Normal gol - mavi attı
                gs["last_goal_scorer"] = 2
                gs["kickoff_restricted_team_override"] = None
                gs["kickoff_receiving_team_override"] = None
                print(f"[MINI GOL!] Sol kaleye gol - Oyuncu 2 attı!")
                
                # ✨ Gol atan oyuncuya +1 gol
                if last_toucher and last_toucher in room["players"]:
                    room["players"][last_toucher]["goals"] = room["players"][last_toucher].get("goals", 0) + 1
                
                # ✨ Asist kontrolü - önceki dokunan aynı takımdan mı?
                if second_toucher and second_toucher != last_toucher and second_toucher in room["players"]:
                    scorer_team = room["players"][last_toucher].get("team")
                    assister_team = room["players"][second_toucher].get("team")
                    if scorer_team == assister_team and scorer_team in ["red", "blue"]:
                        assist_pid = second_toucher
                        room["players"][second_toucher]["assists"] = room["players"][second_toucher].get("assists", 0) + 1
            
            gs["last_goal_own"] = own_goal
            gs["last_goal_assist"] = assist_pid
            gs["state"] = "goal_wait"
            gs["goal_wait_until"] = now + 15.0  # ✨ 15 saniye (5sn sevinç + 10sn replay)
            gs["pause_time"] = now
            return {
                "scorer": gs["last_goal_scorer"],
                "own_goal": own_goal,
                "assist": assist_pid,
                "scores": dict(gs["scores"])
            }
        else:
            ball["x"] = BALL_RADIUS
            ball["vx"] = -ball["vx"] * WALL_BOUNCE
            if abs(ball["vx"]) < MIN_BOUNCE_SPEED:
                ball["vx"] = MIN_BOUNCE_SPEED
            ball["vy"] *= 0.9
            ball["spin"] = ball.get("spin", 0) * 0.5  # ✨ Duvara çarpınca spin azalır
    
    # Sağ duvar (KALE) - Mavi takımın (2) kalesi
    if ball["x"] - BALL_RADIUS >= FIELD_WIDTH:
        if GOAL_Y_TOP < ball["y"] < GOAL_Y_BOTTOM and not goal_lock:
            gs["scores"][1] += 1
            
            last_toucher = gs.get("last_ball_toucher")
            second_toucher = gs.get("second_last_toucher")
            own_goal = False
            assist_pid = None
            
            if last_toucher == 2:
                # Mavi kendi kalesine attı
                own_goal = True
                gs["last_goal_scorer"] = 2
                gs["kickoff_restricted_team_override"] = 1
                gs["kickoff_receiving_team_override"] = 2
                print(f"[MINI GOL!] KENDİ KALESİNE - Mavi kendine attı!")
            else:
                gs["last_goal_scorer"] = 1
                gs["kickoff_restricted_team_override"] = None
                gs["kickoff_receiving_team_override"] = None
                print(f"[MINI GOL!] Sağ kaleye gol - Oyuncu 1 attı!")
                
                # ✨ Gol atan oyuncuya +1 gol
                if last_toucher and last_toucher in room["players"]:
                    room["players"][last_toucher]["goals"] = room["players"][last_toucher].get("goals", 0) + 1
                
                # ✨ Asist kontrolü
                if second_toucher and second_toucher != last_toucher and second_toucher in room["players"]:
                    scorer_team = room["players"][last_toucher].get("team")
                    assister_team = room["players"][second_toucher].get("team")
                    if scorer_team == assister_team and scorer_team in ["red", "blue"]:
                        assist_pid = second_toucher
                        room["players"][second_toucher]["assists"] = room["players"][second_toucher].get("assists", 0) + 1
            
            gs["last_goal_own"] = own_goal
            gs["last_goal_assist"] = assist_pid
            gs["state"] = "goal_wait"
            gs["goal_wait_until"] = now + 15.0  # ✨ 15 saniye (5sn sevinç + 10sn replay)
            gs["pause_time"] = now
            return {
                "scorer": gs["last_goal_scorer"],
                "own_goal": own_goal,
                "assist": assist_pid,
                "scores": dict(gs["scores"])
            }
        else:
            ball["x"] = FIELD_WIDTH - BALL_RADIUS
            ball["vx"] = -ball["vx"] * WALL_BOUNCE
            if abs(ball["vx"]) < MIN_BOUNCE_SPEED:
                ball["vx"] = -MIN_BOUNCE_SPEED
            ball["vy"] *= 0.9
            ball["spin"] = ball.get("spin", 0) * 0.5  # ✨ Duvara çarpınca spin azalır
    
    # Üst duvar
    if ball["y"] - BALL_RADIUS <= 0:
        ball["y"] = BALL_RADIUS
        ball["vy"] = -ball["vy"] * WALL_BOUNCE
        if abs(ball["vy"]) < MIN_BOUNCE_SPEED:
            ball["vy"] = MIN_BOUNCE_SPEED
        ball["vx"] *= 0.9
        ball["spin"] = ball.get("spin", 0) * 0.5  # ✨ Duvara çarpınca spin azalır
    
    # Alt duvar
    if ball["y"] + BALL_RADIUS >= FIELD_HEIGHT:
        ball["y"] = FIELD_HEIGHT - BALL_RADIUS
        ball["vy"] = -ball["vy"] * WALL_BOUNCE
        if abs(ball["vy"]) < MIN_BOUNCE_SPEED:
            ball["vy"] = -MIN_BOUNCE_SPEED
        ball["vx"] *= 0.9
        ball["spin"] = ball.get("spin", 0) * 0.5  # ✨ Duvara çarpınca spin azalır
    
    # ✨ KALE DİREKLERİ ÇARPIŞMASI (top)
    # Gol algılama zaten çalıştı, buraya geldiyse gol OLMAMIŞ demektir
    # Direkler kale ağzının hemen üstünde/altında - top oralara çarparsa seksin
    goal_posts = [
        (0, GOAL_Y_TOP),                # Sol üst direk
        (0, GOAL_Y_BOTTOM),             # Sol alt direk
        (FIELD_WIDTH, GOAL_Y_TOP),      # Sağ üst direk
        (FIELD_WIDTH, GOAL_Y_BOTTOM)    # Sağ alt direk
    ]
    for post_x, post_y in goal_posts:
        dx = ball["x"] - post_x
        dy = ball["y"] - post_y
        dist = (dx**2 + dy**2) ** 0.5
        min_dist = BALL_RADIUS + GOAL_POST_RADIUS
        
        if dist < min_dist and dist > 0:
            # Topu direkten uzağa it
            nx = dx / dist
            ny = dy / dist
            overlap = min_dist - dist
            ball["x"] += nx * overlap
            ball["y"] += ny * overlap
            
            # Yansıma (elastik - biraz enerji kaybı)
            dot = ball["vx"] * nx + ball["vy"] * ny
            if dot < 0:
                ball["vx"] = (ball["vx"] - 2 * dot * nx) * 0.75
                ball["vy"] = (ball["vy"] - 2 * dot * ny) * 0.75
            
            ball["spin"] = ball.get("spin", 0) * 0.3  # ✨ Direğe çarpınca spin çok azalır
            print(f"[MINI] Top direğe çarptı! Direk: ({post_x}, {post_y})")
    
    # ✨ KALE DİREKLERİ ÇARPIŞMASI (oyuncu)
    for pid, p in gs["players"].items():
        for post_x, post_y in goal_posts:
            dx = p["x"] - post_x
            dy = p["y"] - post_y
            dist = (dx**2 + dy**2) ** 0.5
            min_dist = PLAYER_RADIUS + GOAL_POST_RADIUS
            
            if dist < min_dist and dist > 0:
                nx = dx / dist
                ny = dy / dist
                overlap = min_dist - dist
                p["x"] += nx * overlap
                p["y"] += ny * overlap
                
                # Oyuncu direge doğru gidiyorsa dursun
                dot_p = p["vx"] * nx + p["vy"] * ny
                if dot_p < 0:
                    p["vx"] -= dot_p * nx
                    p["vy"] -= dot_p * ny
    
    # ✨ SON GÜVENLİK KATMANI: Top hiçbir oyuncunun içine gömülmesin
    # Top oyuncunun içindeyse SADECE topu it (oyuncu itilmez)
    # Kale çizgisi içindeyse (gol olabilir) bu katmanı atla
    ball_in_goal_zone = (
        (ball["x"] < BALL_RADIUS + 2 and GOAL_Y_TOP < ball["y"] < GOAL_Y_BOTTOM) or
        (ball["x"] > FIELD_WIDTH - BALL_RADIUS - 2 and GOAL_Y_TOP < ball["y"] < GOAL_Y_BOTTOM)
    )
    
    if not ball_in_goal_zone:
        for _resolve_iter in range(4):  # max 4 iterasyon (2 oyuncu arası sıkışma için yeterli)
            any_overlap = False
            for pid, p in gs["players"].items():
                dx = ball["x"] - p["x"]
                dy = ball["y"] - p["y"]
                dist = (dx**2 + dy**2) ** 0.5
                min_dist = PLAYER_RADIUS + BALL_RADIUS
                
                if dist < min_dist:
                    any_overlap = True
                    if dist < 0.1:
                        # Top oyuncunun tam üstünde → oyuncunun hız yönünün tersi
                        speed_p = (p["vx"]**2 + p["vy"]**2) ** 0.5
                        if speed_p > 0.1:
                            nx = -p["vx"] / speed_p
                            ny = -p["vy"] / speed_p
                        else:
                            nx = 1
                            ny = 0
                    else:
                        nx = dx / dist
                        ny = dy / dist
                    
                    overlap = min_dist - dist
                    # ✨ Topu oyuncunun dışına it
                    ball["x"] += nx * overlap
                    ball["y"] += ny * overlap
                    
                    # ✨ Top oyuncuya doğru hala hareket ediyorsa:
                    # Hızı SIFIRLAMA, TEĞET yöne çevir (yandan kaçsın - billiard topu gibi)
                    dot_b = ball["vx"] * (-nx) + ball["vy"] * (-ny)
                    if dot_b > 0:
                        # Topa doğru hızı kaldır (oyuncuya doğru gitmesin)
                        ball["vx"] -= (-nx) * dot_b
                        ball["vy"] -= (-ny) * dot_b
                        
                        # ✨ Teğet yön (2 tane var, birini seç)
                        # Perpendicular: (nx, ny) → (-ny, nx) veya (ny, -nx)
                        # Topun kendi mevcut hızıyla aynı yönde olanı seç
                        tx1 = -ny
                        ty1 = nx
                        tx2 = ny
                        ty2 = -nx
                        
                        # Hangi teğet yön topun mevcut hızıyla daha uyumlu?
                        dot_t1 = ball["vx"] * tx1 + ball["vy"] * ty1
                        dot_t2 = ball["vx"] * tx2 + ball["vy"] * ty2
                        
                        if dot_t1 >= dot_t2:
                            tx, ty = tx1, ty1
                        else:
                            tx, ty = tx2, ty2
                        
                        # Topa teğet yönde hafif itki ver (yandan kaçsın)
                        # İtki gücü: topun oyuncuya doğru olan hızının %70'i kadar
                        push = dot_b * 0.7
                        ball["vx"] += tx * push
                        ball["vy"] += ty * push
            
            if not any_overlap:
                break
    
    return None  # Gol yok


# ==========================================
# OYUN LOOP (60 FPS)
# ==========================================

async def game_loop(room, safe_send, broadcast):
    """Ana oyun döngüsü - 60 FPS"""
    try:
        while room.get("phase") == "playing":
            frame_start = time.time()
            
            # Fizik güncelle
            goal_event = update_physics(room)
            
            gs = room["game_state"]
            
            # ✨ Süre sadece "playing" state'inde işlesin
            if gs.get("state") == "playing":
                elapsed = time.time() - gs["match_start"]
                gs["time_left"] = max(0, room["match_duration"] - elapsed)
            
            # ✨ Top hızını hesapla (alev efekti için)
            ball_speed = (gs["ball"]["vx"]**2 + gs["ball"]["vy"]**2) ** 0.5
            ball_on_fire = ball_speed > STRONG_KICK_THRESHOLD
            
            # ✨ Son 0.5 saniyedeki kick effect'leri gönder
            recent_kicks = []
            if "kick_effects" in gs:
                cur_time = time.time()
                gs["kick_effects"] = [k for k in gs["kick_effects"] if cur_time - k["time"] < 0.5]
                recent_kicks = gs["kick_effects"]
            
            # ✨ COUNTDOWN bilgisi
            countdown_value = None
            if gs.get("state") == "countdown":
                remaining = gs.get("countdown_end", 0) - time.time()
                if remaining > 0.5:
                    countdown_value = int(remaining) + 1
                    if countdown_value > 3:
                        countdown_value = 3
                else:
                    countdown_value = 0
            
            # ✨ GOAL WAIT bilgisi
            goal_celebration = None
            if gs.get("state") == "goal_wait":
                scorer = gs.get("last_goal_scorer")
                goal_celebration = {
                    "scorer_id": scorer,
                    "own_goal": gs.get("last_goal_own", False),
                    "assist_id": gs.get("last_goal_assist"),
                    "wait_remaining": max(0, gs.get("goal_wait_until", 0) - time.time())
                }
            
            # ✨ SANTRA KURALI bilgisi
            kickoff_info = None
            ball_warning = False
            ball_warning_team = None  # ✨ Top hangi takıma gidecek?
            if gs.get("kickoff_active") and gs.get("state") == "playing":
                remaining = gs.get("kickoff_timeout", 0) - time.time()
                if remaining > 0:
                    kickoff_info = {
                        "active": True,
                        "restricted_team": gs.get("kickoff_restricted_team"),
                        "receiving_team": gs.get("kickoff_receiving_team"),
                        "time_remaining": round(remaining, 1)
                    }
                    # Son 3 saniye uyarı - top gol ATANA gidecek
                    if remaining <= KICKOFF_WARNING_TIME:
                        ball_warning = True
                        # Top gol atan takıma gidecek (ceza olarak)
                        ball_warning_team = gs.get("kickoff_restricted_team")
            
            # ✨ Sprint enerji bilgisi
            sprint_info = {}
            for pid, p in gs["players"].items():
                energy = p.get("sprint_energy", SPRINT_MAX_ENERGY)
                is_active = p["keys"].get("sprint", False) and energy > 0
                
                sprint_info[str(pid)] = {
                    "energy": round(energy, 1),          # 0-100
                    "max_energy": SPRINT_MAX_ENERGY,     # 100
                    "active": is_active                   # şu an sprint mi
                }
            
            # ✨ Stats bilgisi (TAB scoreboard için) - room["players"]'dan al
            stats_info = {}
            for pid, pdata in room["players"].items():
                stats_info[str(pid)] = {
                    "goals": pdata.get("goals", 0),
                    "assists": pdata.get("assists", 0),
                    "passes": pdata.get("passes", 0)
                }
            
            # Herkese state gönder
            state_msg = {
                "type": "mini_state",
                "sprint": sprint_info,  # ✨ Sprint bilgisi
                "stats": stats_info,     # ✨ Skorboard için (G/A/P)
                "players": {
                    str(pid): {
                        "x": round(p["x"], 1),
                        "y": round(p["y"], 1)
                    } for pid, p in gs["players"].items()
                },
                "ball": {
                    "x": round(gs["ball"]["x"], 1),
                    "y": round(gs["ball"]["y"], 1),
                    "on_fire": ball_on_fire,
                    "warning": ball_warning,
                    "warning_team": ball_warning_team,  # ✨ Hangi takıma gidecek?
                    "last_toucher": gs.get("last_ball_toucher")
                },
                "scores": {str(k): v for k, v in gs["scores"].items()},
                "time_left": round(gs["time_left"], 1),
                "kick_effects": recent_kicks,
                "game_state": gs.get("state", "playing"),
                "countdown": countdown_value,
                "goal_celebration": goal_celebration,
                "kickoff": kickoff_info  # ✨ Santra kuralı bilgisi
            }
            
            # Gol olduysa ekle
            if goal_event:
                state_msg["goal"] = goal_event
            
            await broadcast(room, state_msg)
            
            # Kazanma kontrolü
            goal_target = room.get("goal_target", 3)
            winner_id = None
            if gs["scores"][1] >= goal_target:
                winner_id = 1
            elif gs["scores"][2] >= goal_target:
                winner_id = 2
            elif gs["time_left"] <= 0:
                # Süre bitti - en çok gol atan kazanır
                if gs["scores"][1] > gs["scores"][2]:
                    winner_id = 1
                elif gs["scores"][2] > gs["scores"][1]:
                    winner_id = 2
                else:
                    winner_id = 0  # beraberlik
            
            if winner_id is not None:
                # Oyun bitti
                room["phase"] = "finished"
                await broadcast(room, {
                    "type": "mini_game_over",
                    "winner_id": winner_id,
                    "scores": {str(k): v for k, v in gs["scores"].items()},
                    "reason": "goal_target" if winner_id in [1, 2] and (gs["scores"][1] >= goal_target or gs["scores"][2] >= goal_target) else "time_up"
                })
                return
            
            # 60 FPS için bekle
            frame_time = time.time() - frame_start
            sleep_time = max(0, FRAME_TIME - frame_time)
            await asyncio.sleep(sleep_time)
    except asyncio.CancelledError:
        print(f"[MINI] Game loop iptal edildi")
    except Exception as e:
        print(f"[MINI GAME LOOP HATA] {e}")
        import traceback
        traceback.print_exc()


# ==========================================
# ANA MESAJ İŞLEYİCİ
# ==========================================

async def handle_mini_message(msg_type, data, websocket, rooms, room_code, player_id,
                              make_room_code, safe_send, broadcast):
    """Mini Futbol mesajlarını işle"""
    
    # ==========================================
    # ⚡ WEBRTC SIGNALING RELAY (ÇOKLU P2P DESTEKLİ)
    # ==========================================
    if msg_type == "mini_webrtc_offer":
        if room_code in rooms:
            room = rooms[room_code]
            target_pid = data.get("target_pid")
            if target_pid and target_pid in room["players"]:
                await safe_send(room["players"][target_pid]["ws"], {
                    "type": "mini_webrtc_offer",
                    "from_pid": player_id,
                    "offer": data.get("offer")
                })
        return {"handled": True, "room_code": room_code, "player_id": player_id}

    if msg_type == "mini_webrtc_answer":
        if room_code in rooms:
            room = rooms[room_code]
            target_pid = data.get("target_pid", 1)
            if target_pid and target_pid in room["players"]:
                await safe_send(room["players"][target_pid]["ws"], {
                    "type": "mini_webrtc_answer",
                    "from_pid": player_id,
                    "answer": data.get("answer")
                })
        return {"handled": True, "room_code": room_code, "player_id": player_id}

    if msg_type == "mini_webrtc_ice":
        if room_code in rooms:
            room = rooms[room_code]
            target_pid = data.get("target_pid")
            if target_pid and target_pid in room["players"]:
                await safe_send(room["players"][target_pid]["ws"], {
                    "type": "mini_webrtc_ice",
                    "from_pid": player_id,
                    "candidate": data.get("candidate")
                })
        return {"handled": True, "room_code": room_code, "player_id": player_id}

    # 🎉 GOL SEVİNCİ SEÇİMİNİ TÜM ODAYA İLET (HOST ALSIN DİYE)
    if msg_type == "mini_set_celebration":
        if room_code in rooms:
            room = rooms[room_code]
            await broadcast(room, {
                "type": "mini_set_celebration",
                "player_id": player_id,
                "from_pid": player_id,
                "celebration_type": data.get("celebration_type")
            })
        return {"handled": True, "room_code": room_code, "player_id": player_id}

    # ==========================================
    # ODA OLUŞTUR
    # ==========================================
    if msg_type == "mini_create_room":
        name = (data.get("name") or "").strip()[:15]
        goal_target = int(data.get("goal_target", 3))
        match_duration = int(data.get("match_duration", 180))
        game_speed = (data.get("game_speed") or "normal").strip()
        allow_plase_init = bool(data.get("allow_plase", True))
        ball_stick_init = bool(data.get("ball_stick", True))
        sprint_enabled_init = bool(data.get("sprint_enabled", True))
        pass_assistance_init = bool(data.get("pass_assistance", True))
        player_count_init = int(data.get("player_count", 2))
        # ✨ Takım isimleri (client'tan geliyorsa kullan, yoksa default)
        red_team_name_init = (data.get("red_team_name") or "Kırmızı Takım").strip()[:20]
        blue_team_name_init = (data.get("blue_team_name") or "Mavi Takım").strip()[:20]
        if player_count_init not in [2, 4, 6, 8, 10]:
            player_count_init = 2
        
        # ✨ Santra süresi (5-999 sn, 999 = sınırsız)
        kickoff_timeout_init = int(data.get("kickoff_timeout", 10))
        if kickoff_timeout_init not in [5, 10, 15, 20, 30, 60, 999]:
            kickoff_timeout_init = 10
        
        # ✨ İzleyici sayısı (0-5)
        spectator_count_init = int(data.get("spectator_count", 0))
        if spectator_count_init < 0: spectator_count_init = 0
        if spectator_count_init > 5: spectator_count_init = 5
        
        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Gelişmiş açıksa özgür değer, değilse preset
        advanced_enabled_create = bool(data.get("advanced_enabled", False))
        
        if advanced_enabled_create:
            # Özgür değer: sadece sınırla
            if goal_target < 1: goal_target = 1
            if goal_target > 9999: goal_target = 9999
            if match_duration < 1: match_duration = 1
            if match_duration > 99999: match_duration = 99999
        else:
            # Preset dışında ise defaulta çek
            if goal_target not in [1, 3, 5, 7, 10, 15, 20, 30, 999]:
                goal_target = 3
            if match_duration not in [60, 120, 180, 300, 600, 900, 1200, 1500, 1800, 2700, 4200, 5400, 7200, 99999]:
                match_duration = 180
        
        if game_speed not in ["yavas", "normal", "hizli"]:
            game_speed = "normal"
        
        new_code = make_room_code()
        # ✨ Saha boyutlarını player_count'a göre belirle
        _fs_create = get_field_size(player_count_init)
        rooms[new_code] = {
            "room_code": new_code,
            "mode": "mini_futbol",
            "phase": "lobby",
            "players": {
                1: {"name": name, "ws": websocket, "score": 0, "team": "spectator"}
            },
            "goal_target": goal_target,
            "match_duration": match_duration,
            "game_speed": game_speed,
            "max_players": player_count_init + spectator_count_init,
            "red_team_name": red_team_name_init,
            "blue_team_name": blue_team_name_init,
            "allow_plase": allow_plase_init,
            "ball_stick": ball_stick_init,
            "sprint_enabled": sprint_enabled_init,
            "pass_assistance": pass_assistance_init,
            "player_count": player_count_init,
            "spectator_count": spectator_count_init,
            "field_width": _fs_create["width"],
            "field_height": _fs_create["height"],
            "field_goal_width": _fs_create["goal_width"],
            "kickoff_timeout": kickoff_timeout_init,
            "kicked_names": [],
            "chat_history": [],
            "chat_last_msg_time": {},
            "red_team_color": "#ff6b6b",
            "blue_team_color": "#4dabf7",
            "red_sprint_color": "#ffd43b",
            "blue_sprint_color": "#ffd43b",
            "goal_music_mode": (data.get("goal_music_mode") or "team").strip()
        }
        
        # ✨ Gelişmiş ayarları da uygula (varsa)
        if advanced_enabled_create:
            adv_vals = data.get("advanced", {}) or {}
            if isinstance(adv_vals, dict):
                def clamp(val, lo, hi, default):
                    try:
                        v = float(val)
                        if v < lo: return lo
                        if v > hi: return hi
                        return v
                    except:
                        return default
                
                safe_adv = {}
                safe_adv["kickPower"]        = clamp(adv_vals.get("kickPower"), 8, 25, 14)
                safe_adv["sprintKickBonus"]  = clamp(adv_vals.get("sprintKickBonus"), 0, 100, 30)
                safe_adv["plasePower"]       = clamp(adv_vals.get("plasePower"), 40, 100, 75)
                safe_adv["plaseSpin"]        = clamp(adv_vals.get("plaseSpin"), 10, 100, 35)
                safe_adv["afterTouchTime"]   = clamp(adv_vals.get("afterTouchTime"), 0, 1000, 200)
                safe_adv["ballMaxSpeed"]    = clamp(adv_vals.get("ballMaxSpeed"), 10, 35, 18)
                safe_adv["sprintMultiplier"] = clamp(adv_vals.get("sprintMultiplier"), 100, 250, 150)
                safe_adv["sprintDuration"]   = clamp(adv_vals.get("sprintDuration"), 1, 10, 3)
                safe_adv["passAssistPower"]  = clamp(adv_vals.get("passAssistPower"), 0, 100, 50)  # ✨ Pas yardım gücü
                safe_adv["ballStick"]        = clamp(adv_vals.get("ballStick"), 0, 100, 85)  # ✨ Top yapışma
                
                rooms[new_code]["advanced_enabled"] = True
                rooms[new_code]["advanced_settings"] = safe_adv
                print(f"[MINI ADVANCED] Oda oluşturmada gelişmiş aktif: {safe_adv}")
        
        await safe_send(websocket, {
            "type": "mini_room_created",
            "room_code": new_code,
            "player_id": 1,
            "goal_target": goal_target,
            "match_duration": match_duration,
            "game_speed": game_speed,
            "player_count": player_count_init,  # ✨ Client'a bildir
            "kickoff_timeout": kickoff_timeout_init  # ✨ Santra süresi
        })
        
        await send_minifutbol_lobby_update(rooms[new_code], broadcast)
        return {"handled": True, "room_code": new_code, "player_id": 1}
    
    # ==========================================
    # ODAYA KATIL
    # ==========================================
    if msg_type == "mini_join_room":
        name = (data.get("name") or "").strip()[:15]
        join_code = (data.get("room_code") or "").strip().upper()
        
        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if join_code not in rooms:
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[join_code]
        
        if room.get("mode") != "mini_futbol":
            await safe_send(websocket, {"type": "error", "message": "Bu oda başka bir moda ait."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Aynı isim var mı? (case-insensitive)
        existing_names = [p.get("name", "").lower().strip() for p in room["players"].values()]
        if name.lower().strip() in existing_names:
            await safe_send(websocket, {
                "type": "error", 
                "message": f"Bu isimde ({name}) bir oyuncu zaten odada var. Farklı bir isim seç."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Toplam oyuncu limiti (10)
        if len(room["players"]) >= room.get("max_players", 10):
            await safe_send(websocket, {"type": "error", "message": "Oda dolu!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Oyun başladıysa yine izleyici olarak katılabilir
        is_mid_game = room.get("phase") != "lobby"
        
        # Yeni player_id ver (kullanılmayan en küçük)
        new_pid = 1
        while new_pid in room["players"]:
            new_pid += 1
        
        # ✨ Yeni katılan otomatik izleyici
        room["players"][new_pid] = {
            "name": name,
            "ws": websocket,
            "score": 0,
            "team": "spectator"
        }
        
        # ✨ Oyun çalışıyorsa ve pause aktifse bilgi gönder
        is_paused = False
        if is_mid_game:
            gs = room.get("game_state", {})
            is_paused = gs.get("state") == "paused"
        
        await safe_send(websocket, {
            "type": "mini_room_joined",
            "room_code": join_code,
            "player_id": new_pid,
            "goal_target": room["goal_target"],
            "match_duration": room["match_duration"],
            "game_speed": room.get("game_speed", "normal"),
            "player_count": room.get("player_count", 2),
            "kickoff_timeout": room.get("kickoff_timeout", 10),
            "mid_game": is_mid_game,
            "is_paused": is_paused,
            "red_team_name": room.get("red_team_name", "Kırmızı Takım"),
            "blue_team_name": room.get("blue_team_name", "Mavi Takım"),
            "field": ({
                "width": get_field_dims(room)["width"],
                "height": get_field_dims(room)["height"],
                "player_radius": PLAYER_RADIUS,
                "ball_radius": BALL_RADIUS,
                "goal_width": get_field_dims(room)["goal_width"]
            } if is_mid_game else None)
        })
        
        # ✨ Oyun içindeyse aktif oyuncu isimlerini de gönder (canvas için gerekli)
        if is_mid_game:
            active_players_info = {}
            red_pid = room.get("active_red_player")
            blue_pid = room.get("active_blue_player")
            if red_pid and red_pid in room["players"]:
                active_players_info[str(red_pid)] = room["players"][red_pid]["name"]
            if blue_pid and blue_pid in room["players"]:
                active_players_info[str(blue_pid)] = room["players"][blue_pid]["name"]
            
            await safe_send(websocket, {
                "type": "mini_active_players_changed",
                "players": active_players_info,
                "red_pid": red_pid,
                "blue_pid": blue_pid
            })
        
        # 💬 Yeni katılana chat geçmişini gönder
        if room.get("chat_history"):
            await safe_send(websocket, {
                "type": "mini_chat_history",
                "messages": room["chat_history"][-50:]
            })
        
        # ✨ Toast göster diğerlerine (oyun içinde VEYA lobide - fark etmez, herkes görsün)
        for pid, pdata in room["players"].items():
            if pid != new_pid:
                await safe_send(pdata["ws"], {
                    "type": "mini_new_player_joined_room",
                    "player_name": name
                })
        
        await send_minifutbol_lobby_update(room, broadcast)
        return {"handled": True, "room_code": join_code, "player_id": new_pid}
    
    # ==========================================
    # ODA AYARLARINI GÜNCELLE
    # ==========================================
    if msg_type == "mini_update_settings":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host ayarları değiştirebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Lobby VEYA pause sırasında değişebilir
        is_paused = room.get("phase") == "playing" and room.get("game_state", {}).get("state") == "paused"
        if room.get("phase") != "lobby" and not is_paused:
            await safe_send(websocket, {"type": "error", "message": "Sadece lobby/pause sırasında ayarları değiştirebilirsin."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        goal_target = int(data.get("goal_target", 3))
        match_duration = int(data.get("match_duration", 180))
        game_speed = (data.get("game_speed") or "normal").strip()
        allow_plase = bool(data.get("allow_plase", True))
        ball_stick = bool(data.get("ball_stick", True))
        sprint_enabled = bool(data.get("sprint_enabled", True))
        pass_assistance = bool(data.get("pass_assistance", True))
        new_player_count = int(data.get("player_count", room.get("player_count", 2)))
        advanced_enabled = bool(data.get("advanced_enabled", False))
        advanced_values = data.get("advanced", {}) or {}
        
        # ✨ Santra süresi güncelle
        new_kickoff_timeout = int(data.get("kickoff_timeout", room.get("kickoff_timeout", 10)))
        if new_kickoff_timeout not in [5, 10, 15, 20, 30, 60, 999]:
            new_kickoff_timeout = 10
        room["kickoff_timeout"] = new_kickoff_timeout
        
        # ✨ İzleyici sayısı güncelle
        new_spectator_count = int(data.get("spectator_count", room.get("spectator_count", 0)))
        if new_spectator_count < 0: new_spectator_count = 0
        if new_spectator_count > 5: new_spectator_count = 5
        
        # ✨ Şu anki spectator sayısı yeni limitin üstündeyse reddet
        current_specs = sum(1 for p in room["players"].values() if p.get("team") == "spectator")
        if current_specs > new_spectator_count:
            await safe_send(websocket, {
                "type": "error",
                "message": f"Şu an {current_specs} izleyici var, {new_spectator_count}'ye düşürülemez!"
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Eski değer sakla (toast için)
        old_spectator_count = room.get("spectator_count", 0)
        room["spectator_count"] = new_spectator_count
        
        # ✨ Oyuncu sayısı kontrol
        if new_player_count not in [2, 4, 6, 8, 10]:
            new_player_count = 2
        
        # ✨ Mevcut takımdaki oyuncu sayısı yeni limitin üstündeyse reddet
        current_team_players = sum(1 for p in room["players"].values() if p.get("team") in ["red", "blue"])
        if current_team_players > new_player_count:
            mode_labels = {2:"1v1", 4:"2v2", 6:"3v3", 8:"4v4", 10:"5v5"}
            mode_label = mode_labels.get(new_player_count, f"{new_player_count//2}v{new_player_count//2}")
            await safe_send(websocket, {
                "type": "error", 
                "message": f"Bu oda {mode_label} için uygun değil! Takımda {current_team_players} kişi var, {new_player_count}'e düşürülemez."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room["player_count"] = new_player_count
        # ✨ Saha boyutlarını yeni player_count'a göre güncelle
        _fs_update = get_field_size(new_player_count)
        room["field_width"] = _fs_update["width"]
        room["field_height"] = _fs_update["height"]
        room["field_goal_width"] = _fs_update["goal_width"]
        
        # ✨ max_players = player_count + spectator_count (dinamik)
        room["max_players"] = new_player_count + room.get("spectator_count", 0)
        
        # ✨ Gelişmiş açıksa özgür değer kabul et
        if advanced_enabled:
            if goal_target < 1: goal_target = 1
            if goal_target > 9999: goal_target = 9999
            if match_duration < 1: match_duration = 1
            if match_duration > 99999: match_duration = 99999
        else:
            if goal_target not in [1, 3, 5, 7, 10, 15, 20, 30, 999]:
                goal_target = 3
            if match_duration not in [60, 120, 180, 300, 600, 900, 1200, 1500, 1800, 2700, 4200, 5400, 7200, 99999]:
                match_duration = 180
        
        if game_speed not in ["yavas", "normal", "hizli"]:
            game_speed = "normal"
        
        # ✨ ESKİ değerleri sakla (toast için değişiklik tespiti)
        old_match_duration = room.get("match_duration", 180)
        old_goal_target = room.get("goal_target", 3)
        old_game_speed = room.get("game_speed", "normal")
        old_allow_plase = room.get("allow_plase", True)
        old_ball_stick = room.get("ball_stick", True)
        old_sprint_enabled = room.get("sprint_enabled", True)
        old_pass_assistance = room.get("pass_assistance", True)
        old_kickoff_timeout = room.get("kickoff_timeout", 10)
        old_player_count = room.get("player_count", 2)
        
        room["goal_target"] = goal_target
        room["match_duration"] = match_duration
        room["game_speed"] = game_speed
        room["allow_plase"] = allow_plase  # ✨ Falso izni
        room["ball_stick"] = ball_stick    # ✨ Top yapışma
        room["sprint_enabled"] = sprint_enabled  # ✨ Sprint aktif
        room["pass_assistance"] = pass_assistance # ✨ Pas yardımı
        
        # 🎵 Gol Müziği Modu
        old_goal_music_mode = room.get("goal_music_mode", "team")
        new_goal_music_mode = (data.get("goal_music_mode") or "team").strip()
        if new_goal_music_mode not in ["team", "mixed"]:
            new_goal_music_mode = "team"
        room["goal_music_mode"] = new_goal_music_mode
        
        # ✨ Oyun içindeyse ve süre değiştiyse match_start'ı yeniden başlat
        if room.get("phase") == "playing" and old_match_duration != match_duration:
            gs = room.get("game_state")
            if gs:
                now = time.time()
                # Match'i yeniden başlat
                gs["match_start"] = now
                gs["time_left"] = match_duration
                # Eğer pause'daysa pause_time'ı da güncelle (kilitli kalır)
                if gs.get("state") == "paused" and "pause_time" in gs:
                    gs["pause_time"] = now
                print(f"[MINI] Süre değişti ({old_match_duration}→{match_duration}), maç baştan başlıyor")
        
        # ✨ GELİŞMİŞ AYARLAR - kaydet
        room["advanced_enabled"] = advanced_enabled
        if advanced_enabled and isinstance(advanced_values, dict):
            # Değerleri güvenlik için sınırla
            safe_adv = {}
            def clamp(val, lo, hi, default):
                try:
                    v = float(val)
                    if v < lo: return lo
                    if v > hi: return hi
                    return v
                except:
                    return default
            
            safe_adv["kickPower"]         = clamp(advanced_values.get("kickPower"), 8, 25, 14)
            safe_adv["sprintKickBonus"]   = clamp(advanced_values.get("sprintKickBonus"), 0, 100, 30)
            safe_adv["plasePower"]        = clamp(advanced_values.get("plasePower"), 40, 100, 75)
            safe_adv["plaseSpin"]         = clamp(advanced_values.get("plaseSpin"), 10, 80, 35)
            safe_adv["afterTouchTime"]    = clamp(advanced_values.get("afterTouchTime"), 0, 1000, 200)
            safe_adv["ballMaxSpeed"]      = clamp(advanced_values.get("ballMaxSpeed"), 10, 35, 18)
            safe_adv["sprintMultiplier"]  = clamp(advanced_values.get("sprintMultiplier"), 100, 250, 150)
            safe_adv["sprintDuration"]    = clamp(advanced_values.get("sprintDuration"), 1, 10, 3)
            safe_adv["passAssistPower"]   = clamp(advanced_values.get("passAssistPower"), 0, 100, 50)  # ✨ Pas yardım gücü
            safe_adv["ballStick"]         = clamp(advanced_values.get("ballStick"), 0, 100, 85)  # ✨ Top yapışma
            
            room["advanced_settings"] = safe_adv
            print(f"[MINI ADVANCED] Gelişmiş ayarlar aktif: {safe_adv}")
        else:
            room["advanced_settings"] = None
            print(f"[MINI ADVANCED] Gelişmiş ayarlar KAPALI - klasik preset kullanılıyor")
        
        
        
        # ✨ DEĞİŞEN AYARLAR İÇİN TOAST BROADCAST
        changes = []
        
        # Oyuncu sayısı
        if old_player_count != new_player_count:
            mode_labels = {2:"1v1", 4:"2v2", 6:"3v3", 8:"4v4", 10:"5v5"}
            changes.append({
                "msg": f"👥 Oyuncu Sayısı: {mode_labels.get(new_player_count, str(new_player_count))} olarak değiştirildi"
            })
        
        # Kazanma skoru
        if old_goal_target != goal_target:
            if goal_target >= 999:
                score_text = "♾️ Sınırsız"
            else:
                score_text = f"{goal_target} gol"
            changes.append({
                "msg": f"⚽ Kazanma Skoru: {score_text} olarak değiştirildi"
            })
        
        # Maç süresi
        if old_match_duration != match_duration:
            if match_duration >= 99999:
                dur_text = "♾️ Sınırsız"
            elif match_duration >= 60:
                dur_text = f"{match_duration // 60} dk"
            else:
                dur_text = f"{match_duration} sn"
            changes.append({
                "msg": f"⏱️ Maç Süresi: {dur_text} olarak değiştirildi"
            })
        
        # Oyun hızı
        if old_game_speed != game_speed:
            speed_labels = {"yavas": "🐢 Yavaş", "normal": "🚶 Normal", "hizli": "🏃 Hızlı"}
            changes.append({
                "msg": f"⚡ Oyun Hızı: {speed_labels.get(game_speed, game_speed)} olarak değiştirildi"
            })
        
        # Santra süresi
        if old_kickoff_timeout != new_kickoff_timeout:
            if new_kickoff_timeout >= 999:
                kt_text = "♾️ Sınırsız (Kural Kapalı)"
            else:
                kt_text = f"{new_kickoff_timeout} saniye"
            changes.append({
                "msg": f"⏱️ Santra Süresi: {kt_text} olarak değiştirildi"
            })
        
        # İzleyici sayısı
        old_spectator_count = room.get("spectator_count", 0)  
        if old_spectator_count != new_spectator_count:
            spec_text = "İzleyici yok" if new_spectator_count == 0 else f"{new_spectator_count} izleyici"
            changes.append({
                "msg": f"👁️ İzleyici Sayısı: {spec_text} olarak değiştirildi"
            })
        
        
        
        # Falso izni
        if old_allow_plase != allow_plase:
            if allow_plase:
                changes.append({"msg": "🌀 Falso etkinleştirildi"})
            else:
                changes.append({"msg": "🌀 Falso devre dışı bırakıldı"})
        
        # Top yapışma
        if old_ball_stick != ball_stick:
            if ball_stick:
                changes.append({"msg": "🧲 Top Kontrolü (topa yapışma) özelliği etkinleştirildi"})
            else:
                changes.append({"msg": "🧲 Top Kontrolü (topa yapışma) devre dışı bırakıldı"})
        
        # Sprint
        if old_sprint_enabled != sprint_enabled:
            if sprint_enabled:
                changes.append({"msg": "⚡ Sprint etkinleştirildi"})
            else:
                changes.append({"msg": "⚡ Sprint devre dışı bırakıldı"})
        
        # Pas yardımı
        if old_pass_assistance != pass_assistance:
            if pass_assistance:
                changes.append({"msg": "🤝 Pas Yardımı etkinleştirildi"})
            else:
                changes.append({"msg": "🤝 Pas Yardımı devre dışı bırakıldı"})
        
        # 🎵 Gol Müziği Modu
        if old_goal_music_mode != new_goal_music_mode:
            if new_goal_music_mode == "mixed":
                changes.append({"msg": "🎵 Gol Müziği: Karışık (tüm şarkılardan rastgele)"})
            else:
                changes.append({"msg": "🎵 Gol Müziği: Takıma Göre (BJK→BJK, GS→GS)"})
        
        # ✨ Gelişmiş Mod Toggle
        old_advanced_enabled = room.get("advanced_enabled", False)
        if old_advanced_enabled != advanced_enabled:
            if advanced_enabled:
                changes.append({"msg": "🔧 Gelişmiş ayarlar etkinleştirildi"})
            else:
                changes.append({"msg": "🔧 Gelişmiş ayarlar devre dışı bırakıldı"})
        
        # ✨ Değişiklikleri herkese broadcast et (host dahil)
        if changes:
            await broadcast(room, {
                "type": "mini_settings_changed",
                "changes": changes
            })
            print(f"[MINI] {len(changes)} ayar değişikliği toast gönderildi (herkese)")
        
        await send_minifutbol_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # OYUNU BAŞLAT
    # ==========================================
    if msg_type == "mini_start_game":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Oyuncu sayısı kontrolü kaldırıldı - host istediği zaman başlatabilir
        red_players = [p for p in room["players"].values() if p.get("team") == "red"]
        blue_players = [p for p in room["players"].values() if p.get("team") == "blue"]
        total_team_players = len(red_players) + len(blue_players)
        
        print(f"[MINI FUTBOL] Oyun başlatıldı: {room_code} - Fizik HOST tarayıcısında çalışacak")
        
        # ✨ Eski game_task varsa iptal et
        old_task = room.get("mini_task")
        if old_task and not old_task.done():
            old_task.cancel()
        
        # ✨ Skorları sıfırla (rematch için)
        for pid in room["players"]:
            room["players"][pid]["score"] = 0
        
        room["phase"] = "playing"
        reset_player_stats(room)  # ✨ Stats sıfırla (yeni oyun/rematch)
        init_game_state(room)
        # ✨ Backend fizik yapmıyor artık, host yapıyor → game_loop başlatma
        room["host_mode"] = True  # Bu odada host authoritative
        
        # ✨ TÜM takım oyuncularının isimleri
        active_players_info = {}
        red_pids = room.get("active_red_players", [])
        blue_pids = room.get("active_blue_players", [])
        # Backward compat: sadece 1 aktif oyuncu varsa da ekle
        if not red_pids and room.get("active_red_player"):
            red_pids = [room["active_red_player"]]
        if not blue_pids and room.get("active_blue_player"):
            blue_pids = [room["active_blue_player"]]
        for pid in red_pids + blue_pids:
            if pid in room["players"]:
                active_players_info[str(pid)] = room["players"][pid]["name"]
        
        _fd_start = get_field_dims(room)
        await broadcast(room, {
            "type": "mini_game_started",
            "players": active_players_info,
            "red_pid": red_pids[0] if red_pids else None,       # backward compat
            "blue_pid": blue_pids[0] if blue_pids else None,    # backward compat
            "red_pids": red_pids,   # ✨ TÜM liste
            "blue_pids": blue_pids, # ✨ TÜM liste
            "red_team_name": room.get("red_team_name", "Kırmızı Takım"),
            "blue_team_name": room.get("blue_team_name", "Mavi Takım"),
            "goal_target": room["goal_target"],
            "match_duration": room["match_duration"],
            "field": {
                "width": _fd_start["width"],
                "height": _fd_start["height"],
                "player_radius": PLAYER_RADIUS,
                "ball_radius": BALL_RADIUS,
                "goal_width": _fd_start["goal_width"]
            }
        })
        
        # ✨ Backend fizik yapmıyor - host tarayıcısı yapıyor
        # game_loop başlatmıyoruz artık
        # room["mini_task"] = asyncio.create_task(game_loop(room, safe_send, broadcast))
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # TUŞ BASMA / BIRAKMA
    # ==========================================
    if msg_type == "mini_key":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "playing":
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        key = data.get("key")
        pressed = data.get("pressed", False)
        target_pid = player_id  # ✨ Split-Screen kaldırıldı, herkes kendi karakterini kontrol eder
        
        # ✨ HOST MODE: Tuşu gönderen hariç herkese ilet
        # Böylece:
        # - Host, misafir input'unu alır
        # - Misafir de host input'unu alır
        # - Her client kendi local HP'sinde rakip input'unu işler
        if room.get("host_mode"):
            relay_msg = {
                "type": "mini_guest_input",
                "from_player_id": player_id,
                "target_pid": target_pid,
                "key": key,
                "pressed": bool(pressed)
            }
            for pid, pdata in room["players"].items():
                if pid == player_id:
                    continue
                ws_target = pdata.get("ws")
                if ws_target:
                    await safe_send(ws_target, relay_msg)
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # HOST STATE - Host'tan gelen fizik state'ini misafirlere ilet
    # ==========================================
    if msg_type == "mini_host_state":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        # Sadece host gönderebilir
        if player_id != 1:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # State'i misafirlere ilet
        state_payload = data.get("state")
        if state_payload:
            # Host'a gönderme (kendisi zaten var), sadece diğerleri
            for pid, pdata in room["players"].items():
                if pid == 1:
                    continue
                ws = pdata.get("ws")
                if ws:
                    await safe_send(ws, state_payload)
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # OYUNU DURDUR (Pause) - Sadece host
    # ==========================================
    if msg_type == "mini_pause":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host duraklatabilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "playing":
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        gs = room.get("game_state")
        if not gs:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Zaten pause'da mı?
        if gs.get("state") == "paused":
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Tüm oyuncuların tuşlarını sıfırla (pause sırasında hareket etmesin)
        for pid, p in gs["players"].items():
            for k in p["keys"]:
                p["keys"][k] = False
            p["vx"] = 0
            p["vy"] = 0
        
        # Pause durumuna geç
        gs["state_before_pause"] = "playing"  # Devam ederken bilelim
        gs["state"] = "paused"
        gs["pause_time"] = time.time()  # Süre durdurulacak
        
        print(f"[MINI] Oyun DURAKLATILDI (host: {room['players'][1]['name']})")
        
        await broadcast(room, {
            "type": "mini_paused",
            "message": "Oyun duraklatıldı!"
        })
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # HOST SEKME DEĞİŞTİRDİ (Gecikme Uyarısı İçin)
    # ==========================================
    if msg_type == "mini_host_visibility":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if player_id != 1:  # Sadece host gönderebilir
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        is_hidden = bool(data.get("hidden", False))
        
        # Sadece misafirlere bildir
        for pid, pdata in room["players"].items():
            if pid != 1 and pdata.get("ws"):
                await safe_send(pdata["ws"], {
                    "type": "mini_host_visibility",
                    "hidden": is_hidden
                })
        return {"handled": True, "room_code": room_code, "player_id": player_id}

    # ==========================================
    # P TUŞU - HIZLI PAUSE (Lobby açmaz, sadece durdur)
    # ==========================================
    if msg_type == "mini_quick_pause":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "playing":
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        gs = room.get("game_state")
        if not gs:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        current_state = gs.get("state")
        
        # ✨ Şu an oynanıyor → hızlı pause
        if current_state == "playing":
            # Tuşları sıfırla
            for pid, p in gs["players"].items():
                for k in p["keys"]:
                    p["keys"][k] = False
                p["vx"] = 0
                p["vy"] = 0
            
            gs["state"] = "quick_paused"  # ✨ Farklı state (lobby açmaz)
            gs["pause_time"] = time.time()
            
            print(f"[MINI] HIZLI PAUSE (P tuşu)")
            
            await broadcast(room, {
                "type": "mini_quick_paused",
                "message": "Oyun duraklatıldı!"
            })
        
        # ✨ Şu an hızlı pause → 3-2-1 geri sayım ile devam
        elif current_state == "quick_paused":
            now = time.time()
            gs["state"] = "countdown"
            gs["countdown_start"] = now
            gs["countdown_end"] = now + 3.5
            gs["_silentWhistle"] = True  # ✨ Quick resume → düdük çalma
            
            print(f"[MINI] HIZLI RESUME (P tuşu, 3-2-1)")
            
            await broadcast(room, {
                "type": "mini_quick_resumed",
                "message": "Devam ediyor!"
            })
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # OYUNU DEVAM ETTİR (Resume) - Sadece host
    # ==========================================
    if msg_type == "mini_resume":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        gs = room.get("game_state")
        if not gs or gs.get("state") != "paused":
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Aktif takım değiştiyse (host takımları değiştirdiyse) 
        # yeni oyuncuları belirle
        red_players_lobby = [(pid, p) for pid, p in room["players"].items() if p.get("team") == "red"]
        blue_players_lobby = [(pid, p) for pid, p in room["players"].items() if p.get("team") == "blue"]
        
        if red_players_lobby and blue_players_lobby:
            new_red_pid = red_players_lobby[0][0]
            new_blue_pid = blue_players_lobby[0][0]
            
            old_red_pid = room.get("active_red_player")
            old_blue_pid = room.get("active_blue_player")
            
            # Değişiklik var mı?
            if new_red_pid != old_red_pid or new_blue_pid != old_blue_pid:
                print(f"[MINI] Aktif oyuncular değişti! Red: {old_red_pid}→{new_red_pid}, Blue: {old_blue_pid}→{new_blue_pid}")
                
                # Eski oyuncuları çıkar
                if old_red_pid in gs["players"]:
                    del gs["players"][old_red_pid]
                if old_blue_pid in gs["players"] and old_blue_pid != old_red_pid:
                    del gs["players"][old_blue_pid]
                
                # Yeni oyuncuları ekle
                gs["players"][new_red_pid] = {
                    "x": 200, "y": FIELD_HEIGHT / 2,
                    "vx": 0, "vy": 0,
                    "keys": {"up": False, "down": False, "left": False, "right": False, "kick": False, "sprint": False},
                    "last_kick_time": 0,
                    "sprint_energy": SPRINT_MAX_ENERGY,
                    "last_frame_time": 0,
                    "team": "red"
                }
                gs["players"][new_blue_pid] = {
                    "x": FIELD_WIDTH - 200, "y": FIELD_HEIGHT / 2,
                    "vx": 0, "vy": 0,
                    "keys": {"up": False, "down": False, "left": False, "right": False, "kick": False, "sprint": False},
                    "last_kick_time": 0,
                    "sprint_energy": SPRINT_MAX_ENERGY,
                    "last_frame_time": 0,
                    "team": "blue"
                }
                
                room["active_red_player"] = new_red_pid
                room["active_blue_player"] = new_blue_pid
                
                # Client'a yeni oyuncu bilgisi gönder
                active_players_info = {}
                if new_red_pid in room["players"]:
                    active_players_info[str(new_red_pid)] = room["players"][new_red_pid]["name"]
                if new_blue_pid in room["players"]:
                    active_players_info[str(new_blue_pid)] = room["players"][new_blue_pid]["name"]
                
                await broadcast(room, {
                    "type": "mini_active_players_changed",
                    "players": active_players_info,
                    "red_pid": new_red_pid,
                    "blue_pid": new_blue_pid
                })
        
        # ✨ 3-2-1 geri sayımla devam et
        now = time.time()
        gs["state"] = "countdown"
        gs["countdown_start"] = now
        gs["countdown_end"] = now + 3.5
        # pause_time zaten var, countdown bitince süre kaydırılacak
        
        print(f"[MINI] Oyun DEVAM ediyor (3-2-1 geri sayım)")
        
        await broadcast(room, {
            "type": "mini_resumed",
            "message": "Oyun devam ediyor!"
        })
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # MAÇI YENİDEN BAŞLAT (sadece host, pause sırasında)
    # ==========================================
    if msg_type == "mini_restart_match":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host yeniden başlatabilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "playing":
            await safe_send(websocket, {"type": "error", "message": "Sadece oyun sırasında yeniden başlatılabilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        gs = room.get("game_state")
        if not gs:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        print(f"[MINI] Maç YENİDEN BAŞLATILDI (host)")
        
        # Skorları sıfırla
        gs["scores"] = {1: 0, 2: 0}
        
        # Oyuncu stats sıfırla
        reset_player_stats(room)
        
        # Top ve oyuncu pozisyonlarını sıfırla (santra)
        gs["kickoff_active"] = False
        gs["kickoff_restricted_team"] = None
        gs["kickoff_receiving_team"] = None
        gs["kickoff_restricted_team_override"] = None
        gs["kickoff_receiving_team_override"] = None
        gs["last_ball_toucher"] = None
        gs["second_last_toucher"] = None
        gs["last_goal_scorer"] = None
        gs["last_goal_own"] = False
        gs["last_goal_assist"] = None
        reset_positions(room)
        
        # Süreyi sıfırla ve 3-2-1 geri sayım başlat
        now = time.time()
        gs["time_left"] = room["match_duration"]
        gs["match_start"] = now + 3.5  # countdown bittikten sonra sayacak
        gs["state"] = "countdown"
        gs["countdown_start"] = now
        gs["countdown_end"] = now + 3.5
        gs["pause_time"] = now  # emniyet
        
        # Tuşları sıfırla
        for pid, p in gs["players"].items():
            for k in p["keys"]:
                p["keys"][k] = False
            p["vx"] = 0
            p["vy"] = 0
            p["sprint_energy"] = SPRINT_MAX_ENERGY
        
        await broadcast(room, {
            "type": "mini_restarted",
            "message": "Maç yeniden başlatıldı!"
        })
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # OYUNCUYU TAKIMA AT (sadece host, lobby VEYA pause)
    # ==========================================
    if msg_type == "mini_move_player":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host oyuncu taşıyabilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Lobby VEYA pause sırasında değişebilir
        is_paused = room.get("phase") == "playing" and room.get("game_state", {}).get("state") == "paused"
        if room.get("phase") != "lobby" and not is_paused:
            await safe_send(websocket, {"type": "error", "message": "Sadece lobby/pause sırasında takım değiştirilebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        target_pid = data.get("target_id")
        new_team = data.get("team")  # "red", "blue", "spectator"
        
        if not isinstance(target_pid, int) or target_pid not in room["players"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if new_team not in ["red", "blue", "spectator"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Lobide bekleyen oyuncu takıma alınamaz (kendisi dönene kadar)
        if room["players"][target_pid].get("in_lobby") and new_team in ["red", "blue"]:
            await safe_send(websocket, {
                "type": "error",
                "message": "Bu oyuncu lobide bekliyor, oyuna dönmesini beklemen gerek."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Takım limiti kontrolü (her takım için ayrı: half_max)
        if new_team in ["red", "blue"]:
            # Zaten bu takımdaysa mevcut sayıdan çıkart
            was_already_in = room["players"][target_pid].get("team") == new_team
            current_team_count = sum(1 for p in room["players"].values() if p.get("team") == new_team)
            new_team_count = current_team_count if was_already_in else (current_team_count + 1)
            
            max_total = room.get("player_count", 2)
            half_max = max_total // 2
            
            if new_team_count > half_max:
                # ✨ Takım dolu - özel popup mesajı
                team_name_tr = "Kırmızı Takım" if new_team == "red" else "Mavi Takım"
                mode_labels = {2:"1v1", 4:"2v2", 6:"3v3", 8:"4v4", 10:"5v5"}
                mode_label = mode_labels.get(max_total, f"{half_max}v{half_max}")
                await safe_send(websocket, {
                    "type": "mini_team_full",
                    "team": new_team,
                    "team_name": team_name_tr,
                    "max_per_team": half_max,
                    "mode_label": mode_label
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room["players"][target_pid]["team"] = new_team
        print(f"[MINI] Oyuncu {target_pid} → {new_team} takıma atıldı")
        
        # ✨ Oyun içindeyse (playing veya pause) aktif oyuncu listesini güncelle
        is_playing_now = room.get("phase") == "playing"
        if is_playing_now:
            gs = room.get("game_state")
            if gs:
                # ✨ TÜM takım oyuncularını topla (çoklu oyuncu destekli)
                red_players_lobby = sorted([pid for pid, p in room["players"].items() if p.get("team") == "red"])
                blue_players_lobby = sorted([pid for pid, p in room["players"].items() if p.get("team") == "blue"])
                
                new_red_pid = red_players_lobby[0] if red_players_lobby else None
                new_blue_pid = blue_players_lobby[0] if blue_players_lobby else None
                
                # ✨ Aktif oyuncu listelerini güncelle
                room["active_red_player"] = new_red_pid
                room["active_blue_player"] = new_blue_pid
                room["active_red_players"] = red_players_lobby
                room["active_blue_players"] = blue_players_lobby
                
                # ✨ Y ekseninde dağılım
                fd = get_field_dims(room)
                fw = fd["width"]
                fh = fd["height"]
                spawn_offset = fw * 0.2
                
                def calc_y_positions(count, height):
                    if count == 1:
                        return [height / 2]
                    top = height * 0.15
                    bottom = height * 0.85
                    step = (bottom - top) / (count - 1)
                    return [top + i * step for i in range(count)]
                
                red_ys = calc_y_positions(len(red_players_lobby), fh)
                blue_ys = calc_y_positions(len(blue_players_lobby), fh)
                
                # ✨ Game_state'te olmayan oyuncuları sil (takım dışı olanlar)
                keep_pids = set(red_players_lobby + blue_players_lobby)
                for pid in list(gs["players"].keys()):
                    if pid not in keep_pids:
                        del gs["players"][pid]
                        print(f"[MINI] Oyuncu {pid} game_state'ten silindi (takımdan çıktı)")
                
                # ✨ Kırmızı oyuncuları ekle/güncelle
                for i, pid in enumerate(red_players_lobby):
                    if pid not in gs["players"]:
                        gs["players"][pid] = {
                            "x": spawn_offset, "y": red_ys[i],
                            "vx": 0, "vy": 0,
                            "keys": {"up": False, "down": False, "left": False, "right": False, "kick": False, "sprint": False},
                            "last_kick_time": 0,
                            "sprint_energy": SPRINT_MAX_ENERGY,
                            "last_frame_time": 0,
                            "team": "red"
                        }
                        print(f"[MINI] Yeni kırmızı oyuncu {pid} eklendi")
                    else:
                        gs["players"][pid]["team"] = "red"
                        gs["players"][pid]["x"] = spawn_offset
                        gs["players"][pid]["y"] = red_ys[i]
                        gs["players"][pid]["vx"] = 0
                        gs["players"][pid]["vy"] = 0
                
                # ✨ Mavi oyuncuları ekle/güncelle
                for i, pid in enumerate(blue_players_lobby):
                    if pid not in gs["players"]:
                        gs["players"][pid] = {
                            "x": fw - spawn_offset, "y": blue_ys[i],
                            "vx": 0, "vy": 0,
                            "keys": {"up": False, "down": False, "left": False, "right": False, "kick": False, "sprint": False},
                            "last_kick_time": 0,
                            "sprint_energy": SPRINT_MAX_ENERGY,
                            "last_frame_time": 0,
                            "team": "blue"
                        }
                        print(f"[MINI] Yeni mavi oyuncu {pid} eklendi")
                    else:
                        gs["players"][pid]["team"] = "blue"
                        gs["players"][pid]["x"] = fw - spawn_offset
                        gs["players"][pid]["y"] = blue_ys[i]
                        gs["players"][pid]["vx"] = 0
                        gs["players"][pid]["vy"] = 0
                
                # ✨ Herkese bildir - TÜM oyuncu listesi
                active_players_info = {}
                for pid in red_players_lobby + blue_players_lobby:
                    if pid in room["players"]:
                        active_players_info[str(pid)] = room["players"][pid]["name"]
                
                await broadcast(room, {
                    "type": "mini_active_players_changed",
                    "players": active_players_info,
                    "red_pid": new_red_pid,
                    "blue_pid": new_blue_pid,
                    "red_pids": red_players_lobby,
                    "blue_pids": blue_players_lobby
                })
        
        # ✨ Eski pause kodu kaldırıldı (yukarıya taşındı)
        is_paused = False  # gereksiz ama uyumluluk için
        if False:  # eski blok devre dışı
            gs = room["game_state"]
            
            # Yeni aktif oyuncuları belirle
            red_players_lobby = [(pid, p) for pid, p in room["players"].items() if p.get("team") == "red"]
            blue_players_lobby = [(pid, p) for pid, p in room["players"].items() if p.get("team") == "blue"]
            
            new_red_pid = red_players_lobby[0][0] if red_players_lobby else None
            new_blue_pid = blue_players_lobby[0][0] if blue_players_lobby else None
            
            old_red_pid = room.get("active_red_player")
            old_blue_pid = room.get("active_blue_player")
            
            # Değişiklik var mı?
            if new_red_pid != old_red_pid or new_blue_pid != old_blue_pid:
                print(f"[MINI PAUSE] Aktif oyuncular değişti! Red: {old_red_pid}→{new_red_pid}, Blue: {old_blue_pid}→{new_blue_pid}")
                
                # Eski oyuncuları game_state'ten sil (yeni takımlarda değilse)
                players_to_remove = []
                for pid in list(gs["players"].keys()):
                    if pid != new_red_pid and pid != new_blue_pid:
                        players_to_remove.append(pid)
                
                for pid in players_to_remove:
                    del gs["players"][pid]
                    print(f"[MINI PAUSE] Oyuncu {pid} game_state'ten silindi")
                
                # Yeni oyuncuları game_state'e ekle (yoksa) VEYA team alanını güncelle (varsa)
                if new_red_pid:
                    if new_red_pid not in gs["players"]:
                        # Yeni oyuncu ekle
                        gs["players"][new_red_pid] = {
                            "x": 200, "y": FIELD_HEIGHT / 2,
                            "vx": 0, "vy": 0,
                            "keys": {"up": False, "down": False, "left": False, "right": False, "kick": False, "sprint": False},
                            "last_kick_time": 0,
                            "sprint_energy": SPRINT_MAX_ENERGY,
                            "last_frame_time": 0,
                            "team": "red"
                        }
                        print(f"[MINI PAUSE] Yeni kırmızı oyuncu {new_red_pid} eklendi")
                    else:
                        # ✨ Zaten var → team alanını güncelle + pozisyonu sıfırla
                        gs["players"][new_red_pid]["team"] = "red"
                        gs["players"][new_red_pid]["x"] = 200
                        gs["players"][new_red_pid]["y"] = FIELD_HEIGHT / 2
                        gs["players"][new_red_pid]["vx"] = 0
                        gs["players"][new_red_pid]["vy"] = 0
                        print(f"[MINI PAUSE] Oyuncu {new_red_pid} team güncellendi → red")
                
                if new_blue_pid:
                    if new_blue_pid not in gs["players"]:
                        # Yeni oyuncu ekle
                        gs["players"][new_blue_pid] = {
                            "x": FIELD_WIDTH - 200, "y": FIELD_HEIGHT / 2,
                            "vx": 0, "vy": 0,
                            "keys": {"up": False, "down": False, "left": False, "right": False, "kick": False, "sprint": False},
                            "last_kick_time": 0,
                            "sprint_energy": SPRINT_MAX_ENERGY,
                            "last_frame_time": 0,
                            "team": "blue"
                        }
                        print(f"[MINI PAUSE] Yeni mavi oyuncu {new_blue_pid} eklendi")
                    else:
                        # ✨ Zaten var → team alanını güncelle + pozisyonu sıfırla
                        gs["players"][new_blue_pid]["team"] = "blue"
                        gs["players"][new_blue_pid]["x"] = FIELD_WIDTH - 200
                        gs["players"][new_blue_pid]["y"] = FIELD_HEIGHT / 2
                        gs["players"][new_blue_pid]["vx"] = 0
                        gs["players"][new_blue_pid]["vy"] = 0
                        print(f"[MINI PAUSE] Oyuncu {new_blue_pid} team güncellendi → blue")
                
                room["active_red_player"] = new_red_pid
                room["active_blue_player"] = new_blue_pid
                
                # Client'a yeni oyuncu bilgisi gönder
                active_players_info = {}
                if new_red_pid and new_red_pid in room["players"]:
                    active_players_info[str(new_red_pid)] = room["players"][new_red_pid]["name"]
                if new_blue_pid and new_blue_pid in room["players"]:
                    active_players_info[str(new_blue_pid)] = room["players"][new_blue_pid]["name"]
                
                await broadcast(room, {
                    "type": "mini_active_players_changed",
                    "players": active_players_info,
                    "red_pid": new_red_pid,
                    "blue_pid": new_blue_pid
                })
        
        await send_minifutbol_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
            
    # ==========================================
    # OYUNCU İSMİ DEĞİŞTİR (kendi ismini veya kendi P2'sini)
    # ==========================================
    if msg_type == "mini_change_name":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        target_pid = data.get("target_id")
        new_name = (data.get("name") or "").strip()[:15]
        is_p2 = bool(data.get("is_p2", False))
        
        if not new_name:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if not isinstance(target_pid, int) or target_pid not in room["players"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Aynı isim başkasında var mı? (kendisi hariç)
        final_check_name = new_name
        if is_p2:
            final_check_name = f"{new_name} (P2)"
        existing_names = [
            p.get("name", "").lower().strip() 
            for pid, p in room["players"].items() 
            if pid != target_pid
        ]
        if final_check_name.lower().strip() in existing_names:
            await safe_send(websocket, {
                "type": "error",
                "message": f"Bu isimde ({final_check_name}) başka bir oyuncu var. Farklı bir isim seç."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ İzin kontrolü
        # - Kendi ismini değiştirebilir
        # - Kendi split-slave (P2) ismini değiştirebilir (sadece owner)
        can_change = False
        if target_pid == player_id:
            can_change = True
        else:
            target_player = room["players"][target_pid]
            if (target_player.get("is_split_slave") and 
                target_pid == room.get("split_slave_id") and
                player_id == room.get("split_owner")):
                can_change = True
        
        if not can_change:
            await safe_send(websocket, {"type": "error", "message": "Sadece kendi ismini değiştirebilirsin."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ P2 için sonuna " (P2)" ekle
        final_name = new_name
        if is_p2:
            final_name = f"{new_name} (P2)"
        
        room["players"][target_pid]["name"] = final_name
        print(f"[MINI] Oyuncu {target_pid} ismi değişti: {final_name}")
        
        # ✨ Oyun içindeyse aktif oyuncu isimlerini de güncelle
        if room.get("phase") == "playing":
            gs = room.get("game_state")
            if gs:
                active_players_info = {}
                red_pid = room.get("active_red_player")
                blue_pid = room.get("active_blue_player")
                if red_pid and red_pid in room["players"]:
                    active_players_info[str(red_pid)] = room["players"][red_pid]["name"]
                if blue_pid and blue_pid in room["players"]:
                    active_players_info[str(blue_pid)] = room["players"][blue_pid]["name"]
                
                await broadcast(room, {
                    "type": "mini_active_players_changed",
                    "players": active_players_info,
                    "red_pid": red_pid,
                    "blue_pid": blue_pid
                })
        
        # Lobby güncelle
        await send_minifutbol_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # TAKIM İSMİ DEĞİŞTİR (sadece host)
    # ==========================================
    if msg_type == "mini_change_team_name":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host takım ayarlarını değiştirebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        is_paused = room.get("phase") == "playing" and room.get("game_state", {}).get("state") == "paused"
        if room.get("phase") != "lobby" and not is_paused:
            await safe_send(websocket, {"type": "error", "message": "Takım ayarları sadece lobby/pause sırasında değiştirilebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        team = data.get("team")
        new_name = (data.get("name") or "").strip()[:20]
        team_color = (data.get("team_color") or "").strip()
        sprint_color = (data.get("sprint_color") or "").strip()
        reset_colors = bool(data.get("reset_colors", False))
        
        if team not in ["red", "blue"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        def _valid_hex(c):
            import re
            return bool(re.match(r"^#[0-9A-Fa-f]{6}$", c or ""))
        
        if reset_colors:
            if team == "red":
                room["red_team_color"] = "#ff6b6b"
                room["red_sprint_color"] = "#ffd43b"
            else:
                room["blue_team_color"] = "#4dabf7"
                room["blue_sprint_color"] = "#ffd43b"
        else:
            if new_name:
                if team == "red":
                    room["red_team_name"] = new_name
                else:
                    room["blue_team_name"] = new_name
            if _valid_hex(team_color):
                if team == "red":
                    room["red_team_color"] = team_color.lower()
                else:
                    room["blue_team_color"] = team_color.lower()
            if _valid_hex(sprint_color):
                if team == "red":
                    room["red_sprint_color"] = sprint_color.lower()
                else:
                    room["blue_sprint_color"] = sprint_color.lower()
        
        await send_minifutbol_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host takım ismini değiştirebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Sadece lobby veya ESC pause sırasında izin ver
        is_paused = room.get("phase") == "playing" and room.get("game_state", {}).get("state") == "paused"
        if room.get("phase") != "lobby" and not is_paused:
            await safe_send(websocket, {"type": "error", "message": "Takım ismi sadece lobby/pause sırasında değiştirilebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        team = data.get("team")  # "red" veya "blue"
        new_name = (data.get("name") or "").strip()[:20]  # max 20 karakter
        
        if not new_name or team not in ["red", "blue"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if team == "red":
            room["red_team_name"] = new_name
        else:
            room["blue_team_name"] = new_name
        
        print(f"[MINI] Takım ismi değişti: {team} → {new_name}")
        await send_minifutbol_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # PING/PONG SİSTEMİ
    # ==========================================
    if msg_type == "mini_ping":
        # Client ping attı, hemen pong dön
        await safe_send(websocket, {
            "type": "mini_pong",
            "ts": data.get("ts")  # Client'ın gönderdiği timestamp
        })
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    if msg_type == "mini_ping_report":
        # Client kendi hesapladığı pingi gönderdi, herkese broadcast
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        ping_ms = int(data.get("ping", 0))
        if ping_ms < 0: ping_ms = 0
        if ping_ms > 9999: ping_ms = 9999
        
        # Ping bilgisini oda seviyesinde tut
        if "pings" not in room:
            room["pings"] = {}
        room["pings"][player_id] = ping_ms
        
        # Herkese güncel ping tablosunu gönder
        pings_dict = {str(pid): ping for pid, ping in room["pings"].items()}
        await broadcast(room, {
            "type": "mini_pings_update",
            "pings": pings_dict
        })
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # ZORLA LOBBY'E DÖN (pause sırasında host'un komutu)
    # ==========================================
    if msg_type == "mini_force_return_to_lobby":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host lobbye döndürebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Sadece playing veya finished fazında çalışır
        if room.get("phase") not in ["playing", "finished"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        print(f"[MINI] Host zorla lobbye döndü: {room_code}")
        
        # Eski game task'ı iptal et
        old_task = room.get("mini_task")
        if old_task and not old_task.done():
            old_task.cancel()
        room["mini_task"] = None
        
        # Faz'ı lobby'ye çevir
        room["phase"] = "lobby"
        
        # Game state'i temizle
        if "game_state" in room:
            del room["game_state"]
        
        # Aktif oyuncuları sıfırla
        room["active_red_player"] = None
        room["active_blue_player"] = None
        
        # ✨ TÜM oyuncuların in_lobby bayrağını sıfırla (host lobiye dönünce herkes müsait)
        for pid in room["players"]:
            room["players"][pid]["in_lobby"] = False
        
        # ✨ Herkese "lobby'e dön" komutu gönder
        await broadcast(room, {
            "type": "mini_returned_to_lobby",
            "message": "Host oyunu bitirdi, herkes lobbye döndü"
        })
        
        # Lobby update gönder
        await send_minifutbol_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # LOBBY'E DÖN (oyun bittikten sonra)
    # ==========================================
    if msg_type == "mini_return_to_lobby":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        # ✨ Otomatik dönüş mü, manuel mi?
        is_auto = bool(data.get("auto", False))
        
        # ✨ MİSAFİR "Lobiye Dön" bastıysa → kendisini izleyici yap
        if player_id != 1:
            if player_id in room["players"]:
                player_name = room["players"][player_id].get("name", f"P{player_id}")
                room["players"][player_id]["team"] = "spectator"
                
                # ✨ SADECE MANUEL dönüşte in_lobby=True yap (rematch'te alınmasın)
                # OTOMATİK dönüşte in_lobby=False (host rematch derse otomatik oyuna girsin)
                if not is_auto:
                    room["players"][player_id]["in_lobby"] = True
                    print(f"[MINI] Misafir {player_name} MANUEL lobbye döndü (in_lobby=True, spectator)")
                else:
                    room["players"][player_id]["in_lobby"] = False
                    print(f"[MINI] Misafir {player_name} OTOMATİK lobbye döndü (in_lobby=False)")
                
                # Diğerlerine bildir (host görsün)
                for pid, pdata in room["players"].items():
                    if pid != player_id:
                        await safe_send(pdata["ws"], {
                            "type": "mini_player_left_game",
                            "player_name": player_name
                        })
            await send_minifutbol_lobby_update(room, broadcast)
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ HOST → Lobby'de ise zaten dönmüş, sadece update gönder
        if room.get("phase") == "lobby":
            await send_minifutbol_lobby_update(room, broadcast)
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        print(f"[MINI] Host lobbye döndü: {room_code} (phase={room.get('phase')})")
        
        # Faz'ı lobby'ye çevir (playing veya finished fark etmez)
        room["phase"] = "lobby"
        
        # Eski game task'ı iptal et (varsa)
        old_task = room.get("mini_task")
        if old_task and not old_task.done():
            old_task.cancel()
        room["mini_task"] = None
        
        # Game state'i temizle (yeni oyun için)
        if "game_state" in room:
            del room["game_state"]
        
        # Aktif oyuncuları sıfırla
        room["active_red_player"] = None
        room["active_blue_player"] = None
        
        # ✨ TÜM oyuncuların in_lobby bayrağını sıfırla (host lobiye dönünce herkes müsait)
        for pid in room["players"]:
            room["players"][pid]["in_lobby"] = False
        
        # ✨ Herkese "lobby'e dön" komutu gönder (client otomatik yönlensin)
        await broadcast(room, {
            "type": "mini_returned_to_lobby",
            "message": "Host lobbye döndü"
        })
        
        # Lobby update gönder
        await send_minifutbol_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # KULLANICI OYUNDAN ÇIKIP İZLEYİCİYE GEÇSİN (oyun devam ederken)
    # ==========================================
    if msg_type == "mini_guest_return_lobby":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id == 1:
            # Host için ayrı komut var
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if player_id not in room["players"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        player_name = room["players"][player_id].get("name", f"P{player_id}")
        old_team = room["players"][player_id].get("team", "spectator")
        
        # İzleyici yap ve "lobide" bayrağı ekle (oyuna dönene kadar takıma alınamasın)
        room["players"][player_id]["team"] = "spectator"
        room["players"][player_id]["in_lobby"] = True  # ✨ Lobide bekliyor
        
        print(f"[MINI] {player_name} oyundan çıkıp lobide izleyici oldu")
        
        # ✨ Host'a ve diğerlerine toast bildir
        for pid, pdata in room["players"].items():
            if pid != player_id:
                await safe_send(pdata["ws"], {
                    "type": "mini_player_left_game",
                    "player_name": player_name
                })
        
        # ✨ Aktif oyuncuları güncelle (host HP'sine bildirilecek)
        red_players_lobby = [(pid, p) for pid, p in room["players"].items() if p.get("team") == "red"]
        blue_players_lobby = [(pid, p) for pid, p in room["players"].items() if p.get("team") == "blue"]
        
        new_red_pid = red_players_lobby[0][0] if red_players_lobby else None
        new_blue_pid = blue_players_lobby[0][0] if blue_players_lobby else None
        
        room["active_red_player"] = new_red_pid
        room["active_blue_player"] = new_blue_pid
        
        active_players_info = {}
        if new_red_pid and new_red_pid in room["players"]:
            active_players_info[str(new_red_pid)] = room["players"][new_red_pid]["name"]
        if new_blue_pid and new_blue_pid in room["players"]:
            active_players_info[str(new_blue_pid)] = room["players"][new_blue_pid]["name"]
        
        await broadcast(room, {
            "type": "mini_active_players_changed",
            "players": active_players_info,
            "red_pid": new_red_pid,
            "blue_pid": new_blue_pid
        })
        
        # Lobby update
        await send_minifutbol_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # KULLANICI LOBIDEN OYUNA GERİ DÖNSÜN (in_lobby bayrağını kaldır)
    # ==========================================
    if msg_type == "mini_guest_rejoin_game":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id not in room["players"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        player_name = room["players"][player_id].get("name", f"P{player_id}")
        
        # Lobide bayrağını kaldır
        room["players"][player_id]["in_lobby"] = False
        # spectator olarak kalır, host takıma sürükleyebilir artık
        print(f"[MINI] {player_name} lobiden oyuna geri döndü")
        
        # ✨ Diğerlerine (özellikle host) toast bildir
        for pid, pdata in room["players"].items():
            if pid != player_id:
                await safe_send(pdata["ws"], {
                    "type": "mini_player_rejoined",
                    "player_name": player_name
                })
        
        await send_minifutbol_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # OYUNCUYU ODADAN AT (sadece host - lobby VEYA oyun içi)
    # ==========================================
    if msg_type == "mini_kick_player":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host kick atabilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        target_pid = data.get("target_id")
        if not isinstance(target_pid, int) or target_pid not in room["players"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if target_pid == 1:
            await safe_send(websocket, {"type": "error", "message": "Host kendini atamaz."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        target_name = room["players"][target_pid].get("name", f"P{target_pid}")
        target_ws = room["players"][target_pid].get("ws")
        
        # Kicked names listesine ekle (tekrar giremesin)
        if "kicked_names" not in room:
            room["kicked_names"] = []
        room["kicked_names"].append(target_name.lower())
        
        # ✨ ÖNCE oyuncuyu odadan sil (disconnect handler çift silme yapmasın)
        del room["players"][target_pid]
        print(f"[MINI KICK] {target_name} (id={target_pid}) odadan atıldı")
        
        # Kullanıcıya "atıldınız" mesajı + WS kapat
        if target_ws:
            try:
                await safe_send(target_ws, {"type": "kick_blocked", "message": "Bu odadan atıldınız"})
                await asyncio.sleep(0.3)
                await target_ws.close()
            except Exception as e:
                print(f"[MINI KICK] WS kapatılırken hata: {e}")
        
        # Aktif oyuncularsa güncelle
        if room.get("active_red_player") == target_pid:
            room["active_red_player"] = None
        if room.get("active_blue_player") == target_pid:
            room["active_blue_player"] = None
        
        # Diğerlerine bilgi (toast)
        await broadcast(room, {
            "type": "mini_player_kicked",
            "player_name": target_name
        })
        
        # Yeni aktif oyuncuları hesapla ve broadcast (HP güncellenmesi için)
        red_players_lobby = [(pid, p) for pid, p in room["players"].items() if p.get("team") == "red"]
        blue_players_lobby = [(pid, p) for pid, p in room["players"].items() if p.get("team") == "blue"]
        
        new_red_pid = red_players_lobby[0][0] if red_players_lobby else None
        new_blue_pid = blue_players_lobby[0][0] if blue_players_lobby else None
        
        room["active_red_player"] = new_red_pid
        room["active_blue_player"] = new_blue_pid
        
        if room.get("phase") == "playing":
            active_players_info = {}
            if new_red_pid and new_red_pid in room["players"]:
                active_players_info[str(new_red_pid)] = room["players"][new_red_pid]["name"]
            if new_blue_pid and new_blue_pid in room["players"]:
                active_players_info[str(new_blue_pid)] = room["players"][new_blue_pid]["name"]
            
            await broadcast(room, {
                "type": "mini_active_players_changed",
                "players": active_players_info,
                "red_pid": new_red_pid,
                "blue_pid": new_blue_pid
            })
        
        await send_minifutbol_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # TAKIM İSİMLERİNİ SIFIRLA (sadece host)
    # ==========================================
    if msg_type == "mini_reset_team_names":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host takım isimlerini sıfırlayabilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        is_paused = room.get("phase") == "playing" and room.get("game_state", {}).get("state") == "paused"
        if room.get("phase") != "lobby" and not is_paused:
            await safe_send(websocket, {"type": "error", "message": "Takım isimleri sadece lobby/pause sırasında sıfırlanabilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room["red_team_name"] = "Kırmızı Takım"
        room["blue_team_name"] = "Mavi Takım"
        room["red_team_color"] = "#ff6b6b"
        room["blue_team_color"] = "#4dabf7"
        room["red_sprint_color"] = "#ffd43b"
        room["blue_sprint_color"] = "#ffd43b"
        
        await send_minifutbol_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # 💬 CHAT - YAZMA GÖSTERGESİ
    # ==========================================
    if msg_type == "mini_chat_typing":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id not in room["players"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        is_typing = bool(data.get("typing", False))
        
        # Gönderen hariç herkese ilet
        typing_msg = {
            "type": "mini_chat_typing",
            "player_id": player_id,
            "typing": is_typing
        }
        for pid, pdata in room["players"].items():
            if pid == player_id:
                continue
            ws_target = pdata.get("ws")
            if ws_target:
                await safe_send(ws_target, typing_msg)
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # ⏭️ REPLAY SKIP (ATLA) SİSTEMİ
    # ==========================================
    if msg_type == "mini_skip_replay":
        if room_code in rooms:
            room = rooms[room_code]
            if room.get("host_mode"):
                # Bu bilgiyi sadece host'a ilet (Host fiziği yönetecek)
                host_ws = room["players"].get(1, {}).get("ws")
                if host_ws:
                    await safe_send(host_ws, {
                        "type": "mini_guest_skip",
                        "from_pid": player_id
                    })
        return {"handled": True, "room_code": room_code, "player_id": player_id}

    # ==========================================
    # 💬 CHAT MESAJI GÖNDER
    # ==========================================
    if msg_type == "mini_chat_send":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "mini_futbol":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id not in room["players"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        text = (data.get("text") or "").strip()
        if not text or len(text) > 100:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Spam kontrolü (saniyede max 3 mesaj)
        now = time.time()
        if "chat_last_msg_time" not in room:
            room["chat_last_msg_time"] = {}
        last_times = room["chat_last_msg_time"].get(player_id, [])
        # Son 1 saniyedeki mesajları filtrele
        last_times = [t for t in last_times if now - t < 1.0]
        if len(last_times) >= 3:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        last_times.append(now)
        room["chat_last_msg_time"][player_id] = last_times
        
        sender_name = room["players"][player_id].get("name", f"P{player_id}")
        sender_team = room["players"][player_id].get("team", "spectator")
        
        chat_msg = {
            "sender_id": player_id,
            "sender_name": sender_name,
            "text": text,
            "team": sender_team,
            "ts": now
        }
        
        # Geçmişe ekle (max 50)
        if "chat_history" not in room:
            room["chat_history"] = []
        room["chat_history"].append(chat_msg)
        if len(room["chat_history"]) > 50:
            room["chat_history"] = room["chat_history"][-50:]
        
        # Herkese broadcast
        await broadcast(room, {
            "type": "mini_chat_msg",
            "sender_id": player_id,
            "sender_name": sender_name,
            "text": text,
            "team": sender_team,
            "ts": now
        })
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    return {"handled": False, "room_code": room_code, "player_id": player_id}
