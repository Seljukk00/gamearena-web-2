import random
import string
import os
import asyncio
import time
import re
from collections import defaultdict, deque

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from oyun_modlari.bil_bakalim.footballers import ALL_FOOTBALLERS
from oyun_modlari.bil_bakalim.questions import ALL_QUESTIONS, check_question

# Handler import'ları
from oyun_modlari.gizemli_kariyer.gizem_handler import handle_gizem_message
from oyun_modlari.haritadan_bul.harita_handler import handle_harita_message
from oyun_modlari.kim_milyoner.milyoner_handler import handle_milyoner_message
from oyun_modlari.takim_bilmece.takim_handler import handle_takim_message
from oyun_modlari.ilk_11_challenge.ilk11_handler import handle_ilk11_message
from oyun_modlari.stadyum_tanima.stadyum_handler import handle_stadyum_message

app = FastAPI()

# ==========================================
# GÜVENLİK: CORS AYARLARI
# ==========================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://futbolcubil-web.onrender.com",
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

# IP başına istek geçmişi
request_history = defaultdict(lambda: deque(maxlen=100))
ws_connection_history = defaultdict(lambda: deque(maxlen=50))
room_creation_history = defaultdict(lambda: deque(maxlen=20))
ai_call_history = defaultdict(lambda: deque(maxlen=20))

# Ban listesi (geçici ban - 10 dakika)
banned_ips = {}


def get_client_ip(request_or_ws):
    """Client IP'sini al (Render/Cloudflare arkasında bile)"""
    # Cloudflare header'ı
    if hasattr(request_or_ws, 'headers'):
        cf_ip = request_or_ws.headers.get("cf-connecting-ip")
        if cf_ip:
            return cf_ip
        # Standard proxy header
        x_forwarded = request_or_ws.headers.get("x-forwarded-for")
        if x_forwarded:
            return x_forwarded.split(",")[0].strip()
        # Direct IP
        if hasattr(request_or_ws, 'client'):
            return request_or_ws.client.host if request_or_ws.client else "unknown"
    return "unknown"


def is_banned(ip):
    """IP banlı mı kontrol et"""
    if ip in banned_ips:
        ban_time = banned_ips[ip]
        if time.time() - ban_time < 600:  # 10 dakika ban
            return True
        else:
            del banned_ips[ip]
    return False


def ban_ip(ip, reason=""):
    """IP'yi 10 dakika banla"""
    banned_ips[ip] = time.time()
    print(f"[SECURITY] IP banlandı: {ip} - Sebep: {reason}")


def check_rate_limit(ip, history_dict, max_per_minute=60, action="request"):
    """Rate limit kontrolü"""
    if is_banned(ip):
        return False, "IP geçici olarak banlı (10 dakika)"

    now = time.time()
    history = history_dict[ip]

    # Son 60 saniyedeki istekleri say
    recent = [t for t in history if now - t < 60]

    if len(recent) >= max_per_minute:
        # Rate limit aşıldı - banla
        ban_ip(ip, f"{action} rate limit aşıldı: {len(recent)}/dk")
        return False, f"Çok fazla istek. 10 dakika bekle."

    history.append(now)
    history_dict[ip] = deque([t for t in history if now - t < 60], maxlen=100)
    return True, "OK"


def sanitize_string(text, max_length=50):
    """String'i temizle (XSS koruması)"""
    if not text:
        return ""
    text = str(text).strip()
    # HTML tag'lerini kaldır
    text = re.sub(r'<[^>]*>', '', text)
    # JavaScript pattern'lerini engelle
    text = re.sub(r'(javascript:|onerror=|onclick=|onload=)', '', text, flags=re.IGNORECASE)
    # Kontrol karakterlerini kaldır
    text = re.sub(r'[\x00-\x1f\x7f]', '', text)
    # Maksimum uzunluk
    return text[:max_length]


def is_valid_room_code(code):
    """Oda kodu formatı doğru mu?"""
    if not code or len(code) != 6:
        return False
    return bool(re.match(r'^[A-Z0-9]{6}$', code))


app.mount("/static", StaticFiles(directory="static"), name="static")
app.mount("/mod_resimleri", StaticFiles(directory="mod_resimleri"), name="mod_resimleri")
app.mount("/flags", StaticFiles(directory="oyun_modlari/takim_bilmece/flags"), name="flags")
app.mount("/ml_assets", StaticFiles(directory="oyun_modlari/kim_milyoner/assets"), name="ml_assets")
app.mount("/harita_assets", StaticFiles(directory="oyun_modlari/haritadan_bul"), name="harita_assets")
#app.mount("/gizem_logolar", StaticFiles(directory="oyun_modlari/gizemli_kariyer/logolar"), name="gizem_logolar")
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


@app.get("/")
async def home(request: Request):
    ip = get_client_ip(request)
    
    # Ban kontrolü
    if is_banned(ip):
        return JSONResponse(
            status_code=429,
            content={"error": "Çok fazla istek. Lütfen 10 dakika sonra tekrar deneyin."}
        )
    
    return FileResponse("static/index.html")


@app.get("/health")
async def health():
    """Uptime Robot için sağlık kontrolü"""
    return {"status": "ok", "timestamp": time.time()}


def make_room_code(length=6):
    chars = string.ascii_uppercase + string.digits
    while True:
        code = "".join(random.choice(chars) for _ in range(length))
        if code not in rooms:
            return code


def get_other_player_id(player_id):
    return 2 if player_id == 1 else 1


def make_question_pack():
    return random.sample(range(len(ALL_QUESTIONS)), 6)


async def safe_send(ws: WebSocket, data: dict):
    try:
        await ws.send_json(data)
    except:
        pass


async def broadcast(room: dict, data: dict):
    for pdata in room["players"].values():
        await safe_send(pdata["ws"], data)


# ==========================================
# BIL BAKALIM - Yardımcı Fonksiyonlar
# ==========================================

async def send_lobby_update(room: dict):
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


async def start_round(room: dict, reset_scores=False):
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

    room["selection_task"] = asyncio.create_task(selection_timer(room))


async def selection_timer(room: dict):
    try:
        seconds = room.get("turn_seconds", 45)
        print(f"[SEÇİM TIMER] {seconds} saniye başladı")
        await asyncio.sleep(seconds)

        if room.get("phase") != "selection":
            print("[SEÇİM TIMER] Faz değişmiş, çıkılıyor")
            return

        print("[SEÇİM TIMER] Süre doldu, otomatik seçim yapılıyor")

        for pid in list(room["players"].keys()):
            if pid not in room["selections"]:
                random_index = random.randint(0, len(room["footballers"]) - 1)
                room["selections"][pid] = random_index
                fname = room["footballers"][random_index]["name"]
                print(f"[SEÇİM TIMER] Oyuncu {pid} için otomatik: {fname}")

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
            print("[SEÇİM TIMER] Oyun başlıyor")
            await asyncio.sleep(1)
            await send_turn_update(room)
    except asyncio.CancelledError:
        print("[SEÇİM TIMER] İptal edildi")
    except Exception as e:
        print(f"[SEÇİM TIMER HATA] {e}")


async def turn_timer(room: dict, turn_id: int):
    try:
        seconds = room.get("turn_seconds", 45)
        print(f"[TUR TIMER] Oyuncu {turn_id} için {seconds} sn başladı")
        await asyncio.sleep(seconds)

        if room.get("phase") != "playing":
            return
        if room.get("turn") != turn_id:
            return
        if room.get("pending_question"):
            return

        print(f"[TUR TIMER] Süre doldu, sıra geçiyor")

        await broadcast(room, {
            "type": "turn_timeout",
            "player_id": turn_id
        })

        other_id = get_other_player_id(turn_id)
        room["turn"] = other_id
        await send_turn_update(room)
    except asyncio.CancelledError:
        print("[TUR TIMER] İptal edildi")
    except Exception as e:
        print(f"[TUR TIMER HATA] {e}")


async def answer_timer(room: dict):
    try:
        seconds = room.get("turn_seconds", 45)
        print(f"[CEVAP TIMER] {seconds} sn başladı")
        await asyncio.sleep(seconds)

        pending = room.get("pending_question")
        if not pending:
            return

        print("[CEVAP TIMER] Süre doldu, otomatik doğru cevap gönderiliyor")

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
        await send_turn_update(room)
    except asyncio.CancelledError:
        print("[CEVAP TIMER] İptal edildi")
    except Exception as e:
        print(f"[CEVAP TIMER HATA] {e}")


async def send_turn_update(room: dict):
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

    room["turn_task"] = asyncio.create_task(turn_timer(room, room["turn"]))


# ==========================================
# WEBSOCKET ENDPOINT
# ==========================================

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    # IP kontrolü
    client_ip = get_client_ip(websocket)
    
    # Ban kontrolü
    if is_banned(client_ip):
        await websocket.close(code=1008, reason="IP banned")
        print(f"[SECURITY] Banlı IP bağlantı denemesi: {client_ip}")
        return
    
    # WebSocket bağlantı rate limit (dakikada 20)
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

            # ==========================================
            # BIL BAKALIM + ORTAK HANDLER'LAR
            # ==========================================

            # --- QUERY ROOM MODE ---
            if msg_type == "query_room_mode":
                # Rate limit: Oda arama (dakikada 20)
                ok, msg = check_rate_limit(client_ip, request_history, max_per_minute=20, action="query_room")
                if not ok:
                    await safe_send(websocket, {"type": "error", "message": msg})
                    continue
                
                query_code = sanitize_string(data.get("room_code", ""), max_length=6).upper()
                
                # Oda kodu formatı doğru mu?
                if not is_valid_room_code(query_code):
                    await safe_send(websocket, {"type": "room_mode_result", "found": False})
                    continue
                
                if query_code not in rooms:
                    await safe_send(websocket, {"type": "room_mode_result", "found": False})
                    continue
                room_mode = rooms[query_code].get("mode", "bil_bakalim")
                await safe_send(websocket, {
                    "type": "room_mode_result",
                    "found": True,
                    "mode": room_mode,
                    "room_code": query_code
                })
                continue

            # --- CREATE ROOM (Bil Bakalım) ---
            if msg_type == "create_room":
                # Rate limit: Oda oluşturma (dakikada 5)
                ok, msg = check_rate_limit(client_ip, room_creation_history, max_per_minute=5, action="create_room")
                if not ok:
                    await safe_send(websocket, {"type": "error", "message": msg})
                    continue
                
                # Input validation
                name = sanitize_string(data.get("name", ""), max_length=15)
                turn_seconds_raw = data.get("turn_seconds", 45)
                guess_limit_raw = data.get("guess_limit", 0)

                if not name:
                    await safe_send(websocket, {"type": "error", "message": "İsim gir."})
                    continue

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

                print(f"[ODA OLUSTURULDU] Süre: {turn_seconds} sn | Tahmin Hakkı: {'Sınırsız' if guess_limit == 0 else guess_limit}")

                room_code = make_room_code()
                player_id = 1

                rooms[room_code] = {
                    "code": room_code,
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
                    "room_code": room_code,
                    "player_id": 1,
                    "turn_seconds": turn_seconds,
                    "guess_limit": guess_limit
                })
                await send_lobby_update(rooms[room_code])
                continue

            # --- JOIN ROOM (Bil Bakalım) ---
            if msg_type == "join_room":
                # Rate limit: Katılım denemeleri (dakikada 15)
                ok, msg = check_rate_limit(client_ip, request_history, max_per_minute=15, action="join_room")
                if not ok:
                    await safe_send(websocket, {"type": "error", "message": msg})
                    continue
                
                # Input validation
                name = sanitize_string(data.get("name", ""), max_length=15)
                join_code = sanitize_string(data.get("room_code", ""), max_length=6).upper()

                if not name:
                    await safe_send(websocket, {"type": "error", "message": "İsim gir."})
                    continue
                
                # Oda kodu formatı doğru mu?
                if not is_valid_room_code(join_code):
                    await safe_send(websocket, {"type": "error", "message": "Geçersiz oda kodu formatı."})
                    continue
                
                if join_code not in rooms:
                    await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
                    continue

                room = rooms[join_code]
                if len(room["players"]) >= 2:
                    await safe_send(websocket, {"type": "error", "message": "Oda dolu."})
                    continue
                if room.get("mode", "bil_bakalim") != "bil_bakalim":
                    await safe_send(websocket, {"type": "error", "message": "Bu oda farklı bir mod için."})
                    continue

                room_code = join_code
                player_id = 2
                room["players"][2] = {"ws": websocket, "name": name}
                room["phase"] = "lobby"

                await safe_send(websocket, {
                    "type": "room_joined",
                    "room_code": room_code,
                    "player_id": 2,
                    "turn_seconds": room.get("turn_seconds", 45)
                })
                await send_lobby_update(room)
                continue

            # Buradan sonrası oda gerekli
            if not room_code or room_code not in rooms:
                await safe_send(websocket, {"type": "error", "message": "Önce odaya gir."})
                continue

            room = rooms[room_code]

            # --- START GAME (Bil Bakalım) ---
            if msg_type == "start_game":
                if player_id != 1:
                    await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
                    continue
                if len(room["players"]) != 2:
                    await safe_send(websocket, {"type": "error", "message": "2 oyuncu gerekli."})
                    continue
                reset_scores = room["phase"] == "lobby"
                await start_round(room, reset_scores=reset_scores)
                continue

            # --- SELECT SECRET ---
            if msg_type == "select_secret":
                if room["phase"] != "selection":
                    continue

                index = data.get("index")
                if not isinstance(index, int):
                    continue
                if index < 0 or index >= len(room["footballers"]):
                    continue

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
                    await send_turn_update(room)
                continue

            # --- ASK QUESTION ---
            if msg_type == "ask_question":
                if room["phase"] != "playing":
                    continue
                if room["turn"] != player_id:
                    await safe_send(websocket, {"type": "error", "message": "Sıra sende değil."})
                    continue

                question_index = data.get("question_index")
                if not isinstance(question_index, int):
                    continue
                if question_index not in room["question_pack"]:
                    await safe_send(websocket, {"type": "error", "message": "Bu soru pakette yok."})
                    continue

                other_id = get_other_player_id(player_id)
                if other_id not in room["players"]:
                    continue

                other_secret_index = room["selections"].get(other_id)
                if other_secret_index is None:
                    continue

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

                room["answer_task"] = asyncio.create_task(answer_timer(room))
                continue

            # --- SUBMIT ANSWER ---
            if msg_type == "submit_answer":
                if room["phase"] != "playing":
                    continue

                pending = room.get("pending_question")
                if not pending:
                    continue

                other_id = get_other_player_id(pending["asker_id"])
                if player_id != other_id:
                    continue

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
                await send_turn_update(room)
                continue

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
                continue

            # --- GUESS ---
            if msg_type == "guess":
                if room["phase"] != "playing":
                    continue
                if room["turn"] != player_id:
                    await safe_send(websocket, {"type": "error", "message": "Sıra sende değil."})
                    continue

                guessed_index = data.get("index")
                if not isinstance(guessed_index, int):
                    continue
                if guessed_index < 0 or guessed_index >= len(room["footballers"]):
                    continue

                other_id = get_other_player_id(player_id)
                other_secret_index = room["selections"].get(other_id)
                if other_secret_index is None:
                    continue

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
                        await send_turn_update(room)
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
                            await send_turn_update(room)
                continue

    except WebSocketDisconnect:
        if room_code and room_code in rooms:
            room = rooms[room_code]
            for pid, pdata in room["players"].items():
                if pid != player_id:
                    await safe_send(pdata["ws"], {
                        "type": "opponent_left",
                        "message": "Rakip ayrıldı. Oda kapandı."
                    })
            for task_key in ["turn_task", "selection_task", "answer_task",
                             "takim_task", "ml_task", "ml_ai_generation_task",
                             "harita_task", "gizem_task", "ilk11_task", "stad_task"]:
                task = room.get(task_key)
                if task and not task.done():
                    task.cancel()
            rooms.pop(room_code, None)