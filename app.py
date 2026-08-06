import random
import string
import os
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
from oyun_modlari.meme_arena.meme_handler import handle_meme_message
from oyun_modlari.mini_futbol.mini_futbol_handler import handle_mini_message

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
# STATIC MOUNTS
# ==========================================
app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/oyun_modlari", StaticFiles(directory="oyun_modlari"), name="oyun_modlari")
app.mount("/mod_resimleri", StaticFiles(directory="mod_resimleri"), name="mod_resimleri")
app.mount("/flags", StaticFiles(directory="oyun_modlari/takim_bilmece/flags"), name="flags")
app.mount("/ml_assets", StaticFiles(directory="oyun_modlari/kim_milyoner/assets"), name="ml_assets")
app.mount("/harita_assets", StaticFiles(directory="oyun_modlari/haritadan_bul"), name="harita_assets")
app.mount("/stadyum_images", StaticFiles(directory="oyun_modlari/stadyum_tanima/images"), name="stadyum_images")


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
                                elif room_mode == "mini_futbol":
                                    from oyun_modlari.mini_futbol.mini_futbol_handler import send_minifutbol_lobby_update as slu
                                else:
                                    slu = None
                                if slu:
                                    await slu(room, broadcast)
                            except Exception as e:
                                print(f"[KICK LOBBY UPDATE HATA] {e}")
                continue

            # ==========================================
            # ORTAK KICK BAN KONTROLÜ (tüm modlar için join)
            # ==========================================
            if msg_type in ["join_room", "takim_join_room", "ml_join_room", 
                           "harita_join_room", "gizem_join_room", 
                           "ilk11_join_room", "stad_join_room", "meme_join_room",
                           "mini_join_room"]:
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

            # --- Meme Arena ---
            meme_result = await handle_meme_message(
                msg_type=msg_type, data=data, websocket=websocket,
                rooms=rooms, room_code=room_code, player_id=player_id,
                make_room_code=make_room_code, safe_send=safe_send, broadcast=broadcast
            )
            if meme_result["handled"]:
                room_code = meme_result["room_code"]
                player_id = meme_result["player_id"]
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
                                 "meme_task", "mini_task"]:
                    task = room.get(task_key)
                    if task and not task.done():
                        task.cancel()
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
                    "player_name": left_name
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
                
                # Lobby update gönder (kalan oyunculara)
                try:
                    from oyun_modlari.mini_futbol.mini_futbol_handler import send_minifutbol_lobby_update as slu
                    await slu(room, broadcast)
                except Exception as e:
                    print(f"[MINI DISCONNECT LOBBY UPDATE HATA] {e}")
                
                return
            
            # Oyun içindeyse (lobby değilse)
            if room.get("phase") not in ("lobby", None):
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
                                     "meme_task", "mini_task"]:
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
                                     "meme_task"]:
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
                                 "meme_task", "mini_task"]:
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
                elif room_mode == "mini_futbol":
                    from oyun_modlari.mini_futbol.mini_futbol_handler import send_minifutbol_lobby_update as slu
                    await slu(room, broadcast)
            except Exception as e:
                print(f"[LOBBY UPDATE HATA] {e}")

            await broadcast(room, {
                "type": "player_left_lobby",
                "message": f"{left_name} odadan ayrıldı."
            })
            return
