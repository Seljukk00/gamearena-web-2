import random
import string
import os
from dotenv import load_dotenv
load_dotenv()  # .env dosyasını yükle
import time
import re
from collections import defaultdict, deque

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from oyun_modlari.bil_bakalim.footballers import ALL_FOOTBALLERS

# Handler import'ları
from oyun_modlari.bil_bakalim.bil_bakalim_handler import handle_bil_bakalim_message
from oyun_modlari.gizemli_kariyer.gizem_handler import handle_gizem_message
from oyun_modlari.haritadan_bul.harita_handler import handle_harita_message
from oyun_modlari.kim_milyoner.milyoner_handler import handle_milyoner_message
from oyun_modlari.takim_bilmece.takim_handler import handle_takim_message
from oyun_modlari.ilk_11_challenge.ilk11_handler import handle_ilk11_message
from oyun_modlari.stadyum_tanima.stadyum_handler import handle_stadyum_message

from oyun_modlari.sarkidan_bul.sarki_handler import handle_sarki_message
from oyun_modlari.mini_futbol.mini_futbol_handler import handle_mini_message
from oyun_modlari.jokerli_satranc.satranc_handler import handle_jokerli_satranc_message

app = FastAPI()

# ==========================================
# CORS
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://gamearena-web.onrender.com",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# ==========================================
# GÜVENLİK: RATE LIMITING
# ==========================================

request_history = defaultdict(lambda: deque(maxlen=100))
ws_connection_history = defaultdict(lambda: deque(maxlen=50))
room_creation_history = defaultdict(lambda: deque(maxlen=20))
ai_call_history = defaultdict(lambda: deque(maxlen=20))
banned_ips = {}


def get_client_ip(request_or_ws):
    if hasattr(request_or_ws, 'headers'):
        cf_ip = request_or_ws.headers.get("cf-connecting-ip")
        if cf_ip:
            return cf_ip
        x_forwarded = request_or_ws.headers.get("x-forwarded-for")
        if x_forwarded:
            return x_forwarded.split(",")[0].strip()
        if hasattr(request_or_ws, 'client'):
            return request_or_ws.client.host if request_or_ws.client else "unknown"
    return "unknown"


def is_banned(ip):
    if ip in banned_ips:
        if time.time() - banned_ips[ip] < 600:
            return True
        else:
            del banned_ips[ip]
    return False


def ban_ip(ip, reason=""):
    banned_ips[ip] = time.time()
    print(f"[SECURITY] IP banlandı: {ip} - Sebep: {reason}")


def check_rate_limit(ip, history_dict, max_per_minute=60, action="request"):
    if is_banned(ip):
        return False, "IP geçici olarak banlı (10 dakika)"

    now = time.time()
    history = history_dict[ip]
    recent = [t for t in history if now - t < 60]

    if len(recent) >= max_per_minute:
        ban_ip(ip, f"{action} rate limit aşıldı: {len(recent)}/dk")
        return False, f"Çok fazla istek. 10 dakika bekle."

    history.append(now)
    history_dict[ip] = deque([t for t in history if now - t < 60], maxlen=100)
    return True, "OK"


# ==========================================
# STATIC CACHE MIDDLEWARE
# Görselleri, ses dosyalarını uzun süre cache'le
# ==========================================
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

class StaticCacheMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        path = request.url.path
        
        # Görseller, ses, font gibi dosyalar için uzun cache
        static_exts = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg',
                       '.mp3', '.wav', '.ogg', '.woff', '.woff2', '.ttf', '.ico')
        if path.endswith(static_exts):
            # 30 gün cache (dosyalar değişmez genelde)
            response.headers["Cache-Control"] = "public, max-age=2592000, immutable"
        # HTML, JS, CSS için kısa cache (değişebilir)
        elif path.endswith(('.html', '.js', '.css')):
            response.headers["Cache-Control"] = "public, max-age=300"  # 5 dakika
        
        return response

app.add_middleware(StaticCacheMiddleware)


# ==========================================
# STATIC MOUNTS
# ==========================================
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/oyun_modlari", StaticFiles(directory="oyun_modlari"), name="oyun_modlari")
app.mount("/mod_resimleri", StaticFiles(directory="mod_resimleri"), name="mod_resimleri")
app.mount("/flags", StaticFiles(directory="oyun_modlari/takim_bilmece/flags"), name="flags")
app.mount("/ml_assets", StaticFiles(directory="oyun_modlari/kim_milyoner/assets"), name="ml_assets")
app.mount("/harita_assets", StaticFiles(directory="oyun_modlari/haritadan_bul"), name="harita_assets")
app.mount("/stadyum_images", StaticFiles(directory="oyun_modlari/stadyum_tanima/images"), name="stadyum_images")
app.mount("/takim_logolari", StaticFiles(directory="oyun_modlari/gizemli_kariyer/takim_logolari"), name="takim_logolari")
app.mount("/satranc_vendor", StaticFiles(directory="oyun_modlari/jokerli_satranc/vendor"), name="satranc_vendor")
app.mount("/satranc_sounds", StaticFiles(directory="oyun_modlari/jokerli_satranc/sounds"), name="satranc_sounds")


# ==========================================
# ORTAK FONKSİYONLAR
# ==========================================

def build_image_map():
    image_folder = "static/images"
    image_map = {}
    if os.path.isdir(image_folder):
        for filename in os.listdir(image_folder):
            name_lower = filename.lower().rsplit(".", 1)[0].strip()
            image_map[name_lower] = filename
    return image_map


IMAGE_MAP = build_image_map()


def get_image_filename(img_key):
    key = img_key.lower().strip()
    return IMAGE_MAP.get(key, img_key + ".webp")


for f in ALL_FOOTBALLERS:
    f["img_file"] = get_image_filename(f["img"])


rooms = {}


def make_room_code(length=6):
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choice(chars) for _ in range(length))
        if code not in rooms:
            return code


async def safe_send(ws: WebSocket, data: dict):
    try:
        await ws.send_json(data)
    except:
        pass


async def broadcast(room: dict, data: dict):
    for pdata in room["players"].values():
        await safe_send(pdata["ws"], data)


# ==========================================
# HTTP ENDPOINTS
# ==========================================

@app.get("/")
async def home(request: Request):
    ip = get_client_ip(request)
    if is_banned(ip):
        return JSONResponse(
            status_code=429,
            content={"error": "Çok fazla istek. Lütfen 10 dakika sonra tekrar deneyin."}
        )
    return FileResponse("static/index.html")


@app.get("/health")
async def health():
    return {"status": "ok", "timestamp": time.time()}


@app.head("/")
async def head_root():
    return {"status": "ok"}


@app.head("/health")
async def head_health():
    return {"status": "ok"}


# ==========================================
# SELJUK ÖZEL İSİM DOĞRULAMA
# ==========================================
@app.post("/verify-seljuk")
async def verify_seljuk(request: Request):
    try:
        body = await request.json()
        password = str(body.get("password", "")).strip()
        
        # .env'den şifreyi oku
        correct_password = os.getenv("SELJUK_PASSWORD", "")
        
        if not correct_password:
            return JSONResponse(status_code=500, content={"ok": False, "error": "server_config"})
        
        if password == correct_password:
            return {"ok": True}
        else:
            return {"ok": False, "error": "wrong"}
    except Exception as e:
        return JSONResponse(status_code=400, content={"ok": False, "error": "bad_request"})


# ==========================================
# WEBSOCKET ENDPOINT
# ==========================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    client_ip = get_client_ip(websocket)

    if is_banned(client_ip):
        await websocket.close(code=1008, reason="IP banned")
        print(f"[SECURITY] Banlı IP bağlantı denemesi: {client_ip}")
        return

    ok, msg = check_rate_limit(client_ip, ws_connection_history, max_per_minute=20, action="ws_connect")
    if not ok:
        await websocket.close(code=1008, reason=msg)
        print(f"[SECURITY] WS rate limit aşıldı: {client_ip}")
        return

    await websocket.accept()
    print(f"[WS] Yeni bağlantı: {client_ip}")

    room_code = None
    player_id = None

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # ==========================================
            # ORTAK CHAT HANDLER (tüm modlar için)
            # ==========================================
            if msg_type == "bil_chat_send":
                if not room_code or room_code not in rooms:
                    continue
                room = rooms[room_code]
                if player_id not in room.get("players", {}):
                    continue

                text = str(data.get("text", "")).strip()
                if not text:
                    continue
                if len(text) > 100:
                    text = text[:100]

                # Basit rate limit (kişi başı 3 saniyede max 1 mesaj)
                chat_time = room.setdefault("chat_last_msg_time", {})
                now_ts = time.time()
                last_ts = chat_time.get(player_id, 0)
                if now_ts - last_ts < 1.0:
                    continue  # spam engel
                chat_time[player_id] = now_ts

                sender_name = room["players"][player_id]["name"]

                chat_msg = {
                    "type": "bil_chat_msg",
                    "sender_id": player_id,
                    "sender_name": sender_name,
                    "text": text,
                    "ts": now_ts
                }

                # Herkese broadcast
                await broadcast(room, chat_msg)

                # Chat geçmişine ekle (max 50)
                history = room.setdefault("chat_history", [])
                history.append({
                    "sender_id": player_id,
                    "sender_name": sender_name,
                    "text": text,
                    "ts": now_ts
                })
                if len(history) > 50:
                    history.pop(0)

                continue

            # ==========================================
            # ORTAK KICK HANDLER (tüm modlar için)
            # ==========================================
            if msg_type == "kick_player":
                if room_code and room_code in rooms:
                    room = rooms[room_code]
                    if player_id == 1 and room.get("phase") == "lobby":
                        target_id = data.get("target_id")
                        if isinstance(target_id, int) and target_id != 1 and target_id in room["players"]:
                            target_name = room["players"][target_id]["name"]
                            target_ws = room["players"][target_id]["ws"]

                            # Atılan oyuncunun ismini kaydet
                            if "kicked_names" not in room:
                                room["kicked_names"] = []
                            room["kicked_names"].append(target_name.lower().strip())

                            # Atılan oyuncuya bildir
                            await safe_send(target_ws, {
                                "type": "you_were_kicked",
                                "message": "Host tarafından odadan atıldın."
                            })

                            # Oyuncuyu çıkar
                            del room["players"][target_id]

                            # Diğerlerine bildir
                            await broadcast(room, {
                                "type": "player_kicked",
                                "message": f"{target_name} host tarafından atıldı."
                            })

                            # Modun lobby update fonksiyonunu çağır
                            room_mode = room.get("mode", "bil_bakalim")
                            try:
                                if room_mode == "bil_bakalim":
                                    from oyun_modlari.bil_bakalim.bil_bakalim_handler import send_lobby_update as slu
                                elif room_mode == "takim_bilmece":
                                    from oyun_modlari.takim_bilmece.takim_handler import send_takim_lobby_update as slu
                                elif room_mode == "kim_milyoner":
                                    from oyun_modlari.kim_milyoner.milyoner_handler import send_ml_lobby_update as slu
                                elif room_mode == "haritadan_bul":
                                    from oyun_modlari.haritadan_bul.harita_handler import send_harita_lobby_update as slu
                                elif room_mode == "gizemli_kariyer":
                                    from oyun_modlari.gizemli_kariyer.gizem_handler import send_gizem_lobby_update as slu
                                elif room_mode == "ilk_11_challenge":
                                    from oyun_modlari.ilk_11_challenge.ilk11_handler import send_ilk11_lobby_update as slu
                                elif room_mode == "stadyum_tanima":
                                    from oyun_modlari.stadyum_tanima.stadyum_handler import send_stad_lobby_update as slu
                                elif room_mode == "meme_arena":
                                    from oyun_modlari.meme_arena.meme_handler import send_meme_lobby_update as slu
                                elif room_mode == "sarkidan_bul":
                                    from oyun_modlari.sarkidan_bul.sarki_handler import send_sarki_lobby_update as slu
                                elif room_mode == "mini_futbol":
                                    from oyun_modlari.mini_futbol.mini_futbol_handler import send_minifutbol_lobby_update as slu
                                elif room_mode == "jokerli_satranc":
                                    from oyun_modlari.jokerli_satranc.satranc_handler import send_jokerli_satranc_lobby_update as slu
                                else:
                                    slu = None
                                if slu:
                                    await slu(room, broadcast)
                            except Exception as e:
                                print(f"[KICK LOBBY UPDATE HATA] {e}")
                continue

            # ==========================================
            # ORTAK MOD DEĞİŞTİRME (tüm modlar için)
            # ==========================================
            if msg_type == "mod_change_room":
                if not room_code or room_code not in rooms:
                    continue
                room = rooms[room_code]
                # Sadece host değiştirebilir
                if player_id != 1:
                    await safe_send(websocket, {"type": "error", "message": "Sadece host modu değiştirebilir."})
                    continue
                # Sadece lobide iken değiştirilebilir
                if room.get("phase") != "lobby":
                    await safe_send(websocket, {"type": "error", "message": "Sadece lobide mod değiştirilebilir."})
                    continue
                
                new_mode = data.get("new_mode", "").strip()
                valid_modes = ["bil_bakalim", "takim_bilmece", "kim_milyoner", "haritadan_bul",
                              "gizemli_kariyer", "ilk_11_challenge", "stadyum_tanima", "meme_arena",
                              "sarkidan_bul", "mini_futbol", "jokerli_satranc"]
                if new_mode not in valid_modes:
                    await safe_send(websocket, {"type": "error", "message": "Geçersiz mod."})
                    continue
                
                # Eski tasks'ları iptal et
                for task_key in ["turn_task", "selection_task", "answer_task",
                                 "takim_task", "ml_task", "ml_ai_generation_task",
                                 "harita_task", "gizem_task", "ilk11_task", "stad_task",
                                 "meme_task", "sarki_task", "mini_task"]:
                    task = room.get(task_key)
                    if task and not task.done():
                        task.cancel()
                
                # KORUNACAKLAR: oyuncular, oda kodu, kicked_names, chat_history
                preserved_players = room["players"]
                preserved_code = room.get("code", room_code)
                preserved_kicked = room.get("kicked_names", [])
                preserved_chat = room.get("chat_history", [])
                preserved_chat_time = room.get("chat_last_msg_time", {})
                
                # Odayı sıfırla ve yeni moda göre yeniden kur
                new_room = {
                    "code": preserved_code,
                    "room_code": preserved_code,  # Mini Futbol için farklı key kullanır
                    "mode": new_mode,
                    "phase": "lobby",
                    "players": preserved_players,
                    "kicked_names": preserved_kicked,
                    "chat_history": preserved_chat,
                    "chat_last_msg_time": preserved_chat_time,
                    "scores": {}
                }
                
                # Her modun default ayarları
                if new_mode == "bil_bakalim":
                    new_room.update({
                        "footballer_indices": [], "footballers": [], "selections": {},
                        "remaining": {1: 32, 2: 32}, "turn": 1, "question_pack": [],
                        "pending_question": None, "turn_seconds": 45, "guess_limit": 0,
                        "guesses_left": {1: 0, 2: 0},
                        "turn_task": None, "selection_task": None, "answer_task": None
                    })
                elif new_mode == "takim_bilmece":
                    new_room.update({
                        "difficulty": "kolay", "turn_seconds": 60, "max_players": 2,
                        "total_questions": 12, "turn": 1, "takim_task": None
                    })
                elif new_mode == "kim_milyoner":
                    new_room.update({
                        "ml_max_players": 2, "ml_category": "futbol", "ml_difficulty": "karisik",
                        "ml_total_questions": 12, "ml_turn_seconds": 60,
                        "ml_task": None, "ml_ai_generation_task": None,
                        "ml_current_player": 1, "ml_jokers": {}, "ml_player_q_idx": {}
                    })
                elif new_mode == "haritadan_bul":
                    new_room.update({
                        "max_players": 2, "total_rounds": 10, "difficulty": "karisik",
                        "turn_seconds": 30, "turn": 1, "harita_task": None
                    })
                elif new_mode == "gizemli_kariyer":
                    new_room.update({
                        "max_players": 2, "total_rounds": 10, "difficulty": "karisik",
                        "turn_seconds": 60, "turn": 1, "gizem_task": None,
                        "gizem_round": 0, "gizem_answered": False,
                        "gizem_used_indices": [], "gizem_hidden_indices": [],
                        "gizem_current_q": None, "gizem_jokers": {},
                        "gizem_history_indices": set(), "left_players": {}
                    })
                elif new_mode == "ilk_11_challenge":
                    new_room.update({
                        "turn_seconds": 120, "ilk11_task": None
                    })
                elif new_mode == "stadyum_tanima":
                    new_room.update({
                        "max_players": 2, "total_rounds": 10, "turn_seconds": 20,
                        "stad_current_player": 1, "stad_task": None,
                        "stad_jokers_left": {}, "stad_used_jokers": {}
                    })
                elif new_mode == "meme_arena":
                    new_room.update({
                        "max_players": 2, "total_rounds": 5,
                        "turn_seconds": 45, "vote_seconds": 15, "meme_task": None
                    })
                elif new_mode == "sarkidan_bul":
                    new_room.update({
                        "max_players": 2, "dil": "karisik",
                        "total_songs": 10, "song_duration": 10, "answer_duration": 10,
                        "current_round": 0, "song_pool": [],
                        "current_song": None, "current_options": [],
                        "current_correct_index": 0, "song_start_time": 0,
                        "player_answers": {}, "sarki_task": None,
                        "current_turn": 1, "turn_order": [],
                        "_pool_ready": False, "_pool_cache_key": None,
                        "phase": "lobby"
                    })
                    # Oyuncuların skorlarını sıfırla
                    for pid in new_room["players"]:
                        new_room["players"][pid]["score"] = 0
                elif new_mode == "jokerli_satranc":
                    new_room.update({
                        "satranc_time_mode": "blitz",
                        "satranc_joker_count": 3,
                        "satranc_pick_mode": "karisik",
                        "satranc_pick_seconds": 60,
                        "satranc_game": None,
                        "satranc_turn": None,
                        "satranc_white": None,
                        "satranc_black": None,
                        "satranc_jokers": {},
                        "satranc_used_jokers": {},
                        "satranc_clocks": {},
                        "satranc_task": None,
                        "satranc_clock_task": None,
                        "satranc_selection_task": None,
                    })
                elif new_mode == "mini_futbol":
                    new_room.update({
                        "max_players": 10, "player_count": 2,
                        "goal_target": 3, "match_duration": 180,
                        "game_speed": "normal", "red_team_name": "Kırmızı Takım",
                        "blue_team_name": "Mavi Takım", "allow_plase": True,
                        "ball_stick": True, "sprint_enabled": True,
                        "kickoff_timeout": 10, "mini_task": None
                    })
                    # Mini Futbol'da tüm oyuncuları spectator yap
                    for pid in new_room["players"]:
                        new_room["players"][pid]["team"] = "spectator"
                
                rooms[room_code] = new_room
                
                # Herkese "mod değişti, yeni ekrana geç" mesajı gönder
                # Her oyuncuya kendi player_id'sini ayrıca gönder
                for pid, pdata in new_room["players"].items():
                    await safe_send(pdata["ws"], {
                        "type": "mod_changed",
                        "new_mode": new_mode,
                        "room_code": preserved_code,
                        "player_id": pid
                    })
                
                # Sonra yeni modun lobby update'ini gönder
                try:
                    if new_mode == "bil_bakalim":
                        from oyun_modlari.bil_bakalim.bil_bakalim_handler import send_lobby_update as slu
                    elif new_mode == "takim_bilmece":
                        from oyun_modlari.takim_bilmece.takim_handler import send_takim_lobby_update as slu
                    elif new_mode == "kim_milyoner":
                        from oyun_modlari.kim_milyoner.milyoner_handler import send_ml_lobby_update as slu
                    elif new_mode == "haritadan_bul":
                        from oyun_modlari.haritadan_bul.harita_handler import send_harita_lobby_update as slu
                    elif new_mode == "gizemli_kariyer":
                        from oyun_modlari.gizemli_kariyer.gizem_handler import send_gizem_lobby_update as slu
                    elif new_mode == "ilk_11_challenge":
                        from oyun_modlari.ilk_11_challenge.ilk11_handler import send_ilk11_lobby_update as slu
                    elif new_mode == "stadyum_tanima":
                        from oyun_modlari.stadyum_tanima.stadyum_handler import send_stad_lobby_update as slu
                    elif new_mode == "meme_arena":
                        from oyun_modlari.meme_arena.meme_handler import send_meme_lobby_update as slu
                    elif new_mode == "sarkidan_bul":
                        from oyun_modlari.sarkidan_bul.sarki_handler import send_sarki_lobby_update as slu
                    elif new_mode == "mini_futbol":
                        from oyun_modlari.mini_futbol.mini_futbol_handler import send_minifutbol_lobby_update as slu
                    elif new_mode == "jokerli_satranc":
                        from oyun_modlari.jokerli_satranc.satranc_handler import send_jokerli_satranc_lobby_update as slu
                    else:
                        slu = None
                    if slu:
                        await slu(new_room, broadcast)
                except Exception as e:
                    print(f"[MOD CHANGE LOBBY UPDATE HATA] {e}")
                
                # ✨ Şarkıdan Bul moduna geçildiyse havuzu hemen hazırla (arka planda)
                if new_mode == "sarkidan_bul":
                    try:
                        from oyun_modlari.sarkidan_bul.sarki_handler import prefetch_song_pool
                        import asyncio as _asyncio
                        print(f"[SARKI] 🎵 Mod değişimi sonrası havuz hazırlanıyor... (oda: {room_code})")
                        _asyncio.create_task(prefetch_song_pool(new_room, broadcast))
                    except Exception as e:
                        print(f"[SARKI MOD CHANGE PREFETCH HATA] {e}")
                
                continue
            
            # ==========================================
            # ORTAK KICK BAN KONTROLÜ (tüm modlar için join)
            # ==========================================
            if msg_type in ["join_room", "takim_join_room", "ml_join_room", 
                           "harita_join_room", "gizem_join_room", 
                           "ilk11_join_room", "stad_join_room", "meme_join_room",
                           "sarki_join_room", "mini_join_room", "satranc_join_room"]:
                join_code = (data.get("room_code") or "").strip().upper()
                join_name = (data.get("name") or "").strip()
                if join_code in rooms:
                    kicked = rooms[join_code].get("kicked_names", [])
                    if join_name.lower().strip() in kicked:
                        await safe_send(websocket, {
                            "type": "error",
                            "message": "Bu odadan atıldınız!"
                        })
                        continue

            # ==========================================
            # MOD HANDLER'LARINA YÖNLENDIR
            # ==========================================

            # --- Gizemli Kariyer ---
            gizem_result = await handle_gizem_message(
                msg_type=msg_type, data=data, websocket=websocket,
                rooms=rooms, room_code=room_code, player_id=player_id,
                make_room_code=make_room_code, safe_send=safe_send, broadcast=broadcast
            )
            if gizem_result["handled"]:
                room_code = gizem_result["room_code"]
                player_id = gizem_result["player_id"]
                continue

            # --- Haritadan Bul ---
            harita_result = await handle_harita_message(
                msg_type=msg_type, data=data, websocket=websocket,
                rooms=rooms, room_code=room_code, player_id=player_id,
                make_room_code=make_room_code, safe_send=safe_send, broadcast=broadcast
            )
            if harita_result["handled"]:
                room_code = harita_result["room_code"]
                player_id = harita_result["player_id"]
                continue

            # --- Kim Milyoner ---
            ml_result = await handle_milyoner_message(
                msg_type=msg_type, data=data, websocket=websocket,
                rooms=rooms, room_code=room_code, player_id=player_id,
                make_room_code=make_room_code, safe_send=safe_send, broadcast=broadcast
            )
            if ml_result["handled"]:
                room_code = ml_result["room_code"]
                player_id = ml_result["player_id"]
                continue

            # --- Takım Bilmece ---
            takim_result = await handle_takim_message(
                msg_type=msg_type, data=data, websocket=websocket,
                rooms=rooms, room_code=room_code, player_id=player_id,
                make_room_code=make_room_code, safe_send=safe_send, broadcast=broadcast
            )
            if takim_result["handled"]:
                room_code = takim_result["room_code"]
                player_id = takim_result["player_id"]
                continue

            # --- İlk 11 Challenge ---
            ilk11_result = await handle_ilk11_message(
                msg_type=msg_type, data=data, websocket=websocket,
                rooms=rooms, room_code=room_code, player_id=player_id,
                make_room_code=make_room_code, safe_send=safe_send, broadcast=broadcast
            )
            if ilk11_result["handled"]:
                room_code = ilk11_result["room_code"]
                player_id = ilk11_result["player_id"]
                continue

            # --- Stadyum Tanıma ---
            stad_result = await handle_stadyum_message(
                msg_type=msg_type, data=data, websocket=websocket,
                rooms=rooms, room_code=room_code, player_id=player_id,
                make_room_code=make_room_code, safe_send=safe_send, broadcast=broadcast
            )
            if stad_result["handled"]:
                room_code = stad_result["room_code"]
                player_id = stad_result["player_id"]
                continue

            

            # --- Şarkıdan Bul ---
            sarki_result = await handle_sarki_message(
                msg_type=msg_type, data=data, websocket=websocket,
                rooms=rooms, room_code=room_code, player_id=player_id,
                make_room_code=make_room_code, safe_send=safe_send, broadcast=broadcast
            )
            if sarki_result["handled"]:
                room_code = sarki_result["room_code"]
                player_id = sarki_result["player_id"]
                continue

            # --- Mini Futbol ---
            mini_result = await handle_mini_message(
                msg_type=msg_type, data=data, websocket=websocket,
                rooms=rooms, room_code=room_code, player_id=player_id,
                make_room_code=make_room_code, safe_send=safe_send, broadcast=broadcast
            )
            if mini_result["handled"]:
                room_code = mini_result["room_code"]
                player_id = mini_result["player_id"]
                continue

            # --- Jokerli Satranç ---
            satranc_result = await handle_jokerli_satranc_message(
                msg_type=msg_type, data=data, websocket=websocket,
                rooms=rooms, room_code=room_code, player_id=player_id,
                make_room_code=make_room_code, safe_send=safe_send, broadcast=broadcast
            )
            if satranc_result["handled"]:
                room_code = satranc_result["room_code"]
                player_id = satranc_result["player_id"]
                continue

            # --- Bil Bakalım (en son, çünkü query_room_mode ve join_room burada) ---
            bil_result = await handle_bil_bakalim_message(
                msg_type=msg_type, data=data, websocket=websocket,
                rooms=rooms, room_code=room_code, player_id=player_id,
                make_room_code=make_room_code, safe_send=safe_send, broadcast=broadcast,
                check_rate_limit=check_rate_limit,
                request_history=request_history,
                room_creation_history=room_creation_history,
                client_ip=client_ip
            )
            if bil_result["handled"]:
                room_code = bil_result["room_code"]
                player_id = bil_result["player_id"]
                continue

    except WebSocketDisconnect:
        if room_code and room_code in rooms:
            room = rooms[room_code]
            room_mode = room.get("mode", "bil_bakalim")

            # Oyuncuyu çıkar
            left_name = "Rakip"
            if player_id in room["players"]:
                left_name = room["players"][player_id]["name"]
                del room["players"][player_id]

            # Eğer oda boşaldıysa sil
            if len(room["players"]) == 0:
                for task_key in ["turn_task", "selection_task", "answer_task",
                                 "takim_task", "ml_task", "ml_ai_generation_task",
                                 "harita_task", "gizem_task", "ilk11_task", "stad_task",
                                 "meme_task", "sarki_task", "mini_task",
                                 "satranc_task", "satranc_clock_task", "satranc_selection_task"]:
                    task = room.get(task_key)
                    if task and not task.done():
                        task.cancel()
                rooms.pop(room_code, None)
                return
            
            # ✨ HOST AYRILDIYSA - TÜM MODLAR için ortak akış
            # (Mini Futbol hariç - onun kendi özel akışı var)
            if player_id == 1 and room_mode != "mini_futbol":
                print(f"[HOST LEFT] Host ayrıldı, oda kapatılıyor: {room_code} (mod: {room_mode})")
                
                # Tüm task'ları iptal et
                for task_key in ["turn_task", "selection_task", "answer_task",
                                 "takim_task", "ml_task", "ml_ai_generation_task",
                                 "harita_task", "gizem_task", "ilk11_task", "stad_task",
                                 "meme_task", "sarki_task", "mini_task",
                                 "satranc_task", "satranc_clock_task", "satranc_selection_task"]:
                    task = room.get(task_key)
                    if task and not task.done():
                        task.cancel()
                
                # Kalan tüm oyunculara "host ayrıldı, oda kapandı" mesajı gönder
                for pid, pdata in list(room["players"].items()):
                    try:
                        await safe_send(pdata["ws"], {
                            "type": "host_left_room",
                            "message": f"Host ({left_name}) odayı kapattı.",
                            "host_name": left_name
                        })
                    except Exception as e:
                        print(f"[HOST LEFT SEND HATA] {e}")
                
                # Odayı sil
                rooms.pop(room_code, None)
                return

            # ✨ MINI FUTBOL - Özel davranış (multiplayer, oda kapanmaz)
            if room_mode == "mini_futbol":
                # Host ayrıldıysa oda tamamen kapansın
                if player_id == 1:
                    # Diğer oyunculara mini_ ön ekiyle bildir (Genel handler yakalamasın)
                    for pid, pdata in room["players"].items():
                        await safe_send(pdata["ws"], {
                            "type": "mini_host_left",
                            "message": "Host ayrıldı, oda kapatılıyor.",
                            "player_name": left_name
                        })
                    for task_key in ["mini_task"]:
                        task = room.get(task_key)
                        if task and not task.done():
                            task.cancel()
                    rooms.pop(room_code, None)
                    return
                
                # ✨ Normal oyuncu ayrıldı - oda AÇIK kalsın
                # Sadece diğerlerine mini_ ön ekiyle bildir
                await broadcast(room, {
                    "type": "mini_opponent_left",
                    "message": f"{left_name} odadan ayrıldı.",
                    "player_name": left_name,
                    "left_player_id": player_id  # ✨ Hangi ID'nin çıktığını da gönder (hayalet fix)
                })
                
                # Game state'ten oyuncuyu temizle
                gs = room.get("game_state", {})
                if gs and "players" in gs:
                    if player_id in gs["players"]:
                        del gs["players"][player_id]
                
                # Aktif oyunculardan da temizle
                if room.get("active_red_player") == player_id:
                    room["active_red_player"] = None
                if room.get("active_blue_player") == player_id:
                    room["active_blue_player"] = None
                
                # ✨ Aktif oyuncu değişikliğini herkese bildir (HP'ler güncellensin, hayalet kalmasın)
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
                    "blue_pid": blue_pid,
                    "removed_pid": player_id  # ✨ Silinmesi gereken oyuncu (hayalet fix)
                })
                
                # Lobby update gönder (kalan oyunculara)
                try:
                    from oyun_modlari.mini_futbol.mini_futbol_handler import send_minifutbol_lobby_update as slu
                    await slu(room, broadcast)
                except Exception as e:
                    print(f"[MINI DISCONNECT LOBBY UPDATE HATA] {e}")
                
                return
            
            # Oyun içindeyse (lobby değilse)
            if room.get("phase") not in ("lobby", None):
                # ✨ TAKIM BİLMECE 3+ KİŞİLİK - Özel davranış (oyun devam eder)
                if room_mode == "takim_bilmece" and room.get("max_players", 2) >= 3:
                    # Host çıktıysa oda kapansın (kimse host olamıyor)
                    if player_id == 1:
                        for pid, pdata in room["players"].items():
                            await safe_send(pdata["ws"], {
                                "type": "opponent_left",
                                "message": "Host odayı kapattı.",
                                "player_name": left_name
                            })
                        for task_key in ["takim_task"]:
                            task = room.get(task_key)
                            if task and not task.done():
                                task.cancel()
                        rooms.pop(room_code, None)
                        return
                    
                    # Normal oyuncu çıktı: sıralamadan sil, oyun devam etsin
                    # Skoru ve state'i temizle
                    if "scores" in room and player_id in room["scores"]:
                        # Ayrılan oyuncunun ismini sıralama için sakla
                        if "left_players" not in room:
                            room["left_players"] = {}
                        room["left_players"][player_id] = left_name
                        del room["scores"][player_id]
                    if "jokers_left" in room and player_id in room["jokers_left"]:
                        del room["jokers_left"][player_id]
                    if "revealed_names" in room and player_id in room["revealed_names"]:
                        del room["revealed_names"][player_id]
                    if "year_revealed" in room and player_id in room["year_revealed"]:
                        del room["year_revealed"][player_id]
                    if "eliminated_options" in room and player_id in room["eliminated_options"]:
                        del room["eliminated_options"][player_id]
                    
                    # Herkese ayrıldığını bildir (toast için)
                    await broadcast(room, {
                        "type": "takim_player_left",
                        "player_id": player_id,
                        "name": left_name,
                        "scores": room.get("scores", {}),
                        "players": [{"id": pid, "name": pdata["name"]} for pid, pdata in sorted(room["players"].items())]
                    })
                    
                    # Sıra ayrılandaysa → sıradaki oyuncuya geç
                    if room.get("turn") == player_id:
                        # Mevcut task'ı iptal et
                        old_task = room.get("takim_task")
                        if old_task and not old_task.done():
                            old_task.cancel()
                        # Sonraki sorulara otomatik geç
                        try:
                            from oyun_modlari.takim_bilmece.takim_handler import takim_next_question
                            import asyncio as _asyncio
                            _asyncio.create_task(takim_next_question(room, broadcast))
                        except Exception as e:
                            print(f"[TAKIM DISCONNECT next_question HATA] {e}")
                    
                    return
                
                # ✨ KİM MİLYONER 3+ KİŞİLİK - Özel davranış (oyun devam eder)
                if room_mode == "kim_milyoner" and room.get("ml_max_players", 2) >= 3:
                    # Host çıktıysa oda kapansın
                    if player_id == 1:
                        for pid, pdata in room["players"].items():
                            await safe_send(pdata["ws"], {
                                "type": "opponent_left",
                                "message": "Host odayı kapattı.",
                                "player_name": left_name
                            })
                        for task_key in ["ml_task", "ml_ai_generation_task"]:
                            task = room.get(task_key)
                            if task and not task.done():
                                task.cancel()
                        rooms.pop(room_code, None)
                        return
                    
                    # Normal oyuncu çıktı: state temizle
                    if "left_players" not in room:
                        room["left_players"] = {}
                    room["left_players"][player_id] = left_name
                    
                    if "scores" in room and player_id in room["scores"]:
                        del room["scores"][player_id]
                    if "ml_jokers" in room and player_id in room["ml_jokers"]:
                        del room["ml_jokers"][player_id]
                    if "ml_player_q_idx" in room and player_id in room["ml_player_q_idx"]:
                        del room["ml_player_q_idx"][player_id]
                    
                    await broadcast(room, {
                        "type": "ml_player_left",
                        "player_id": player_id,
                        "name": left_name,
                        "scores": room.get("scores", {}),
                        "players": [{"id": pid, "name": pdata["name"]} for pid, pdata in sorted(room["players"].items())]
                    })
                    
                    # Sıra ayrılandaysa → sıradakine geç
                    if room.get("ml_current_player") == player_id:
                        old_task = room.get("ml_task")
                        if old_task and not old_task.done():
                            old_task.cancel()
                        try:
                            from oyun_modlari.kim_milyoner.milyoner_handler import ml_next_turn
                            import asyncio as _asyncio
                            _asyncio.create_task(ml_next_turn(room, broadcast))
                        except Exception as e:
                            print(f"[ML DISCONNECT next_turn HATA] {e}")
                    
                    return
                
                # ✨ HARITADAN BUL 3+ KİŞİLİK - Özel davranış (oyun devam eder)
                if room_mode == "haritadan_bul" and room.get("max_players", 2) >= 3:
                    if player_id == 1:
                        for pid, pdata in room["players"].items():
                            await safe_send(pdata["ws"], {
                                "type": "opponent_left",
                                "message": "Host odayı kapattı.",
                                "player_name": left_name
                            })
                        for task_key in ["harita_task"]:
                            task = room.get(task_key)
                            if task and not task.done():
                                task.cancel()
                        rooms.pop(room_code, None)
                        return
                    
                    if "left_players" not in room:
                        room["left_players"] = {}
                    room["left_players"][player_id] = left_name
                    
                    if "scores" in room and player_id in room["scores"]:
                        del room["scores"][player_id]
                    
                    await broadcast(room, {
                        "type": "harita_player_left",
                        "player_id": player_id,
                        "name": left_name,
                        "scores": room.get("scores", {}),
                        "players": [{"id": pid, "name": pdata["name"]} for pid, pdata in sorted(room["players"].items())]
                    })
                    
                    if room.get("turn") == player_id:
                        old_task = room.get("harita_task")
                        if old_task and not old_task.done():
                            old_task.cancel()
                        try:
                            from oyun_modlari.haritadan_bul.harita_handler import harita_next_round
                            import asyncio as _asyncio
                            _asyncio.create_task(harita_next_round(room, broadcast))
                        except Exception as e:
                            print(f"[HARITA DISCONNECT next_round HATA] {e}")
                    
                    return
                
                # ✨ GIZEMLI KARIYER 3+ KİŞİLİK - Özel davranış (oyun devam eder)
                if room_mode == "gizemli_kariyer" and room.get("max_players", 2) >= 3:
                    if player_id == 1:
                        for pid, pdata in room["players"].items():
                            await safe_send(pdata["ws"], {
                                "type": "opponent_left",
                                "message": "Host odayı kapattı.",
                                "player_name": left_name
                            })
                        for task_key in ["gizem_task"]:
                            task = room.get(task_key)
                            if task and not task.done():
                                task.cancel()
                        rooms.pop(room_code, None)
                        return
                    
                    if "left_players" not in room:
                        room["left_players"] = {}
                    room["left_players"][player_id] = left_name
                    
                    if "scores" in room and player_id in room["scores"]:
                        del room["scores"][player_id]
                    if "gizem_jokers" in room and player_id in room["gizem_jokers"]:
                        del room["gizem_jokers"][player_id]
                    
                    await broadcast(room, {
                        "type": "gizem_player_left",
                        "player_id": player_id,
                        "name": left_name,
                        "scores": room.get("scores", {}),
                        "jokers_left": room.get("gizem_jokers", {}),
                        "players": [{"id": pid, "name": pdata["name"]} for pid, pdata in sorted(room["players"].items())]
                    })
                    
                    if room.get("turn") == player_id:
                        old_task = room.get("gizem_task")
                        if old_task and not old_task.done():
                            old_task.cancel()
                        try:
                            from oyun_modlari.gizemli_kariyer.gizem_handler import gizem_next_round
                            import asyncio as _asyncio
                            _asyncio.create_task(gizem_next_round(room, broadcast))
                        except Exception as e:
                            print(f"[GIZEM DISCONNECT next_round HATA] {e}")
                    
                    return
                    
                # ✨ ŞARKIDAN BUL 3+ KİŞİLİK - Özel davranış (oyun devam eder)
                if room_mode == "sarkidan_bul" and room.get("max_players", 2) >= 3:
                    if player_id == 1:
                        # Host çıktıysa oda kapansın
                        for pid, pdata in room["players"].items():
                            await safe_send(pdata["ws"], {
                                "type": "opponent_left",
                                "message": "Host odayı kapattı.",
                                "player_name": left_name
                            })
                        for task_key in ["sarki_task"]:
                            task = room.get(task_key)
                            if task and not task.done():
                                task.cancel()
                        rooms.pop(room_code, None)
                        return
                    
                    # Normal oyuncu çıktı: state temizle, oyun devam etsin
                    if "left_players" not in room:
                        room["left_players"] = {}
                    room["left_players"][player_id] = left_name
                    
                    # Turn order'dan çıkar
                    if "turn_order" in room and player_id in room["turn_order"]:
                        room["turn_order"].remove(player_id)
                    
                    # Cevaplarını temizle
                    if "player_answers" in room and player_id in room["player_answers"]:
                        del room["player_answers"][player_id]
                    
                    # Herkese bildir (frontend animasyonlu siler)
                    await broadcast(room, {
                        "type": "sarki_player_left",
                        "player_id": player_id,
                        "name": left_name,
                        "players": [{"id": pid, "name": pdata["name"], "score": pdata.get("score", 0)} 
                                   for pid, pdata in sorted(room["players"].items())]
                    })
                    
                    # Sıra çıkan oyuncudaysa → sonraki tur başlat (backend zaten turn_order üzerinden çalışıyor)
                    if room.get("current_turn") == player_id:
                        # Cevap timer'ını iptal et
                        old_task = room.get("sarki_task")
                        if old_task and not old_task.done():
                            old_task.cancel()
                        room["sarki_task"] = None
                        
                        # Sonraki tur başlat (asyncio task)
                        try:
                            from oyun_modlari.sarkidan_bul.sarki_handler import start_sarki_round
                            import asyncio as _asyncio
                            _asyncio.create_task(start_sarki_round(room, safe_send, broadcast))
                        except Exception as e:
                            print(f"[SARKI DISCONNECT next_round HATA] {e}")
                    
                    return    
                
                # ✨ STADYUM TANIMA 3+ KİŞİLİK - Özel davranış (oyun devam eder)
                if room_mode == "stadyum_tanima" and room.get("max_players", 2) >= 3:
                    if player_id == 1:
                        for pid, pdata in room["players"].items():
                            await safe_send(pdata["ws"], {
                                "type": "opponent_left",
                                "message": "Host odayı kapattı.",
                                "player_name": left_name
                            })
                        for task_key in ["stad_task"]:
                            task = room.get(task_key)
                            if task and not task.done():
                                task.cancel()
                        rooms.pop(room_code, None)
                        return
                    
                    if "left_players" not in room:
                        room["left_players"] = {}
                    room["left_players"][player_id] = left_name
                    
                    if "scores" in room and player_id in room["scores"]:
                        del room["scores"][player_id]
                    if "stad_jokers_left" in room and player_id in room["stad_jokers_left"]:
                        del room["stad_jokers_left"][player_id]
                    if "stad_used_jokers" in room and player_id in room["stad_used_jokers"]:
                        del room["stad_used_jokers"][player_id]
                    
                    await broadcast(room, {
                        "type": "stad_player_left",
                        "player_id": player_id,
                        "name": left_name,
                        "scores": room.get("scores", {}),
                        "jokers_left": room.get("stad_jokers_left", {}),
                        "players": [{"id": pid, "name": pdata["name"]} for pid, pdata in sorted(room["players"].items())]
                    })
                    
                    if room.get("stad_current_player") == player_id:
                        old_task = room.get("stad_task")
                        if old_task and not old_task.done():
                            old_task.cancel()
                        try:
                            from oyun_modlari.stadyum_tanima.stadyum_handler import stad_next_round
                            import asyncio as _asyncio
                            _asyncio.create_task(stad_next_round(room, broadcast))
                        except Exception as e:
                            print(f"[STAD DISCONNECT next_round HATA] {e}")
                    
                    return
                
                # Host ayrıldıysa → oda kapansın (misafir oynayamaz)
                if player_id == 1:
                    for pid, pdata in room["players"].items():
                        await safe_send(pdata["ws"], {
                            "type": "opponent_left",
                            "message": "Host odayı kapattı.",
                            "player_name": left_name
                        })
                    for task_key in ["turn_task", "selection_task", "answer_task",
                                     "takim_task", "ml_task", "ml_ai_generation_task",
                                     "harita_task", "gizem_task", "ilk11_task", "stad_task",
                                     "meme_task", "sarki_task", "mini_task"]:
                        task = room.get(task_key)
                        if task and not task.done():
                            task.cancel()
                    rooms.pop(room_code, None)
                    return
                
                # ✨ Misafir ayrıldıysa → oda AÇIK kalır, lobiye dön
                else:
                    # Task'ları iptal et
                    for task_key in ["turn_task", "selection_task", "answer_task",
                                     "takim_task", "ml_task",
                                     "harita_task", "gizem_task", "ilk11_task", "stad_task",
                                     "meme_task", "sarki_task",
                                     "satranc_task", "satranc_clock_task", "satranc_selection_task"]:
                        task = room.get(task_key)
                        if task and not task.done():
                            task.cancel()
                    
                    # Oda lobiye geri dönsün
                    room["phase"] = "lobby"
                    
                    # Host'a bildir → lobiye dön
                    for pid, pdata in room["players"].items():
                        await safe_send(pdata["ws"], {
                            "type": "opponent_left_to_lobby",
                            "message": f"{left_name} oyundan ayrıldı. Lobiye dönüldü.",
                            "player_name": left_name
                        })
                    
                    # Lobby güncelle
                    try:
                        room_mode = room.get("mode", "bil_bakalim")
                        if room_mode == "bil_bakalim":
                            from oyun_modlari.bil_bakalim.bil_bakalim_handler import send_lobby_update as slu
                        elif room_mode == "takim_bilmece":
                            from oyun_modlari.takim_bilmece.takim_handler import send_takim_lobby_update as slu
                        elif room_mode == "kim_milyoner":
                            from oyun_modlari.kim_milyoner.milyoner_handler import send_ml_lobby_update as slu
                        elif room_mode == "haritadan_bul":
                            from oyun_modlari.haritadan_bul.harita_handler import send_harita_lobby_update as slu
                        elif room_mode == "gizemli_kariyer":
                            from oyun_modlari.gizemli_kariyer.gizem_handler import send_gizem_lobby_update as slu
                        elif room_mode == "ilk_11_challenge":
                            from oyun_modlari.ilk_11_challenge.ilk11_handler import send_ilk11_lobby_update as slu
                        elif room_mode == "stadyum_tanima":
                            from oyun_modlari.stadyum_tanima.stadyum_handler import send_stad_lobby_update as slu
                        elif room_mode == "meme_arena":
                            from oyun_modlari.meme_arena.meme_handler import send_meme_lobby_update as slu
                        elif room_mode == "sarkidan_bul":
                            from oyun_modlari.sarkidan_bul.sarki_handler import send_sarki_lobby_update as slu
                        elif room_mode == "jokerli_satranc":
                            from oyun_modlari.jokerli_satranc.satranc_handler import send_jokerli_satranc_lobby_update as slu
                        else:
                            slu = None
                        if slu:
                            await slu(room, broadcast)
                    except Exception as e:
                        print(f"[LOBBY UPDATE HATA] {e}")
                    return

            # Lobbydeyse → host ayrıldıysa odayı kapat
            if player_id == 1 and len(room["players"]) > 0:
                # Host ayrıldı — tüm oyunculara bildir ve odayı kapat
                for pid, pdata in room["players"].items():
                    await safe_send(pdata["ws"], {
                        "type": "opponent_left",
                        "message": "Host odayı kapattı."
                    })
                for task_key in ["turn_task", "selection_task", "answer_task",
                                 "takim_task", "ml_task", "ml_ai_generation_task",
                                 "harita_task", "gizem_task", "ilk11_task", "stad_task",
                                 "meme_task", "sarki_task", "mini_task",
                                 "satranc_task", "satranc_clock_task", "satranc_selection_task"]:
                    task = room.get(task_key)
                    if task and not task.done():
                        task.cancel()
                rooms.pop(room_code, None)
                return

            # Misafir ayrıldıysa — kalan oyuncuyu host yap
            if 1 not in room["players"] and 2 in room["players"]:
                room["players"][1] = room["players"].pop(2)
                await safe_send(room["players"][1]["ws"], {
                    "type": "you_are_host_now",
                    "new_player_id": 1
                })

            # Moda göre lobby güncelle
            try:
                if room_mode == "bil_bakalim":
                    from oyun_modlari.bil_bakalim.bil_bakalim_handler import send_lobby_update as slu
                    await slu(room, broadcast)
                elif room_mode == "takim_bilmece":
                    from oyun_modlari.takim_bilmece.takim_handler import send_takim_lobby_update as slu
                    await slu(room, broadcast)
                elif room_mode == "kim_milyoner":
                    from oyun_modlari.kim_milyoner.milyoner_handler import send_ml_lobby_update as slu
                    await slu(room, broadcast)
                elif room_mode == "haritadan_bul":
                    from oyun_modlari.haritadan_bul.harita_handler import send_harita_lobby_update as slu
                    await slu(room, broadcast)
                elif room_mode == "gizemli_kariyer":
                    from oyun_modlari.gizemli_kariyer.gizem_handler import send_gizem_lobby_update as slu
                    await slu(room, broadcast)
                elif room_mode == "ilk_11_challenge":
                    from oyun_modlari.ilk_11_challenge.ilk11_handler import send_ilk11_lobby_update as slu
                    await slu(room, broadcast)
                elif room_mode == "stadyum_tanima":
                    from oyun_modlari.stadyum_tanima.stadyum_handler import send_stad_lobby_update as slu
                    await slu(room, broadcast)
                elif room_mode == "meme_arena":
                    from oyun_modlari.meme_arena.meme_handler import send_meme_lobby_update as slu
                    await slu(room, broadcast)
                elif room_mode == "sarkidan_bul":
                    from oyun_modlari.sarkidan_bul.sarki_handler import send_sarki_lobby_update as slu
                    await slu(room, broadcast)
                elif room_mode == "mini_futbol":
                    from oyun_modlari.mini_futbol.mini_futbol_handler import send_minifutbol_lobby_update as slu
                    await slu(room, broadcast)
                elif room_mode == "jokerli_satranc":
                    from oyun_modlari.jokerli_satranc.satranc_handler import send_jokerli_satranc_lobby_update as slu
                    await slu(room, broadcast)
            except Exception as e:
                print(f"[LOBBY UPDATE HATA] {e}")

            await broadcast(room, {
                "type": "player_left_lobby",
                "message": f"{left_name} odadan ayrıldı."
            })
            return
