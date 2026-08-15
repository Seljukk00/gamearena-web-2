"""
ŞARKIDAN BUL - Backend Handler
Deezer API kullanarak şarkı tanıma oyunu
"""

import asyncio
import random
import time
from .deezer_api import fetch_songs_by_artists
from .playlists import get_artists, VALID_TURLER, get_tur_of_artist


# ========================================
# LOBBY UPDATE
# ========================================

async def send_sarki_lobby_update(room, broadcast):
    """Şarkı Bul lobby güncellemesi"""
    players_data = []
    for pid, pdata in sorted(room["players"].items()):
        players_data.append({
            "id": pid,
            "name": pdata["name"]
        })
    
    msg = {
        "type": "sarki_lobby_update",
        "room_code": room["room_code"],
        "players": players_data,
        "max_players": room.get("max_players", 2),
        "dil": room.get("dil", "karisik"),
        "total_songs": room.get("total_songs", 10),
        "song_duration": room.get("song_duration", 10),
        "answer_duration": room.get("answer_duration", 10),
        "tur": room.get("tur", None),
    }
    await broadcast(room, msg)

# ========================================
# ARKA PLAN HAVUZ HAZIRLIĞI (oda oluştururken)
# ========================================

async def prefetch_song_pool(room, broadcast):
    """
    Oda oluşturulduğunda arka planda şarkı havuzunu HAZIRLA.
    Host beklemesin diye. Ayarlar değişince tekrar hazırlanır.
    """
    try:
        cache_key = f"{room.get('dil')}_{room.get('tur', 'all')}_{room.get('total_songs')}"
        current_pool_size = len(room.get("song_pool", []))
        needed = room.get("total_songs", 10) * 2
        
        print(f"[SARKI] 🔍 prefetch başladı: dil={room.get('dil')}, mevcut havuz={current_pool_size}, gerekli={needed}")
        
        if room.get("_pool_cache_key") == cache_key and current_pool_size >= needed:
            print(f"[SARKI] ✅ Havuz zaten hazır ({current_pool_size} şarkı)")
            room["_pool_ready"] = True
            await broadcast(room, {
                "type": "sarki_pool_status",
                "ready": True,
                "count": current_pool_size,
                "percent": 100
            })
            return
        
        # Havuz hazır DEĞİL - başlangıç mesajı
        room["_pool_ready"] = False
        try:
            await broadcast(room, {
                "type": "sarki_pool_status",
                "ready": False,
                "percent": 0,
                "message": "🎵 Şarkı havuzu hazırlanıyor... (%0)"
            })
        except:
            pass
        
        print(f"[SARKI] ⏳ Deezer'dan çekiliyor... (dil={room.get('dil')})")
        await _fetch_pool(room, broadcast)  # ✨ broadcast ilet
        room["_pool_cache_key"] = cache_key
        room["_pool_ready"] = True
        print(f"[SARKI] ✅ Havuz hazır ve cache'lendi: {len(room.get('song_pool', []))} şarkı")
        
        # Herkese "%100 hazır" bildir
        try:
            await broadcast(room, {
                "type": "sarki_pool_status",
                "ready": True,
                "count": len(room.get("song_pool", [])),
                "percent": 100
            })
        except Exception as e:
            print(f"[SARKI] pool_status broadcast HATA: {e}")
    except Exception as e:
        print(f"[SARKI] prefetch_song_pool HATA: {e}")
        import traceback
        traceback.print_exc()


async def _fetch_pool(room, broadcast=None):
    """Deezer'dan şarkıları çeker ve room['song_pool']'a kaydeder"""
    dil = room.get("dil", "karisik")
    tur = room.get("tur", None)
    artists = get_artists(dil, tur)
    total_needed = room.get("total_songs", 10)
    
    random.shuffle(artists)
    target_artists = min(len(artists), max(15, total_needed * 2))
    selected_artists = artists[:target_artists]
    
    # ✨ Sanatçıları parça parça çek (progress için)
    songs = []
    seen_ids = set()
    chunk_size = 3  # Her seferinde 3 sanatçı çek
    total_chunks = (len(selected_artists) + chunk_size - 1) // chunk_size
    
    for i in range(0, len(selected_artists), chunk_size):
        chunk = selected_artists[i:i + chunk_size]
        chunk_songs = await asyncio.to_thread(
            fetch_songs_by_artists, chunk, 4
        )
        for s in chunk_songs:
            if s["id"] not in seen_ids:
                seen_ids.add(s["id"])
                songs.append(s)
        
        # ✨ Progress broadcast (yüzde hesapla)
        current_chunk = (i // chunk_size) + 1
        percent = int((current_chunk / total_chunks) * 100)
        # Yetersizse %85'te sabit tut (extra çekim gelecek)
        if percent > 90:
            percent = 90
        
        if broadcast:
            try:
                await broadcast(room, {
                    "type": "sarki_pool_status",
                    "ready": False,
                    "percent": percent,
                    "message": f"🎵 Şarkı havuzu hazırlanıyor... (%{percent})"
                })
            except:
                pass
    
    # Yetersizse ek çek
    if len(songs) < total_needed * 2 and len(artists) > target_artists:
        extra_artists = artists[target_artists:target_artists + 15]
        extra_songs = await asyncio.to_thread(
            fetch_songs_by_artists, extra_artists, 4
        )
        for s in extra_songs:
            if s["id"] not in seen_ids:
                seen_ids.add(s["id"])
                songs.append(s)
        
        # Extra çekim tamamlandı
        if broadcast:
            try:
                await broadcast(room, {
                    "type": "sarki_pool_status",
                    "ready": False,
                    "percent": 95,
                    "message": "🎵 Şarkı havuzu hazırlanıyor... (%95)"
                })
            except:
                pass
    
    random.shuffle(songs)
    room["song_pool"] = songs
    print(f"[SARKI] 🎵 Deezer'dan çekildi: {len(songs)} şarkı ({dil})")

# ========================================
# ŞARKI HAVUZU HAZIRLAMA
# ========================================

async def prepare_song_pool(room, safe_send, broadcast):
    """
    Şarkı havuzunu hazırla. Zaten arka planda hazırlandıysa direkt kullan.
    """
    total_needed = room.get("total_songs", 10)
    cache_key = f"{room.get('dil')}_{room.get('tur', 'all')}_{total_needed}"
    
    # Havuz zaten hazır mı?
    if room.get("_pool_cache_key") == cache_key and len(room.get("song_pool", [])) >= total_needed * 2:
        print(f"[SARKI] ✅ Havuz zaten hazır ({len(room['song_pool'])} şarkı), tekrar çekilmiyor")
        return len(room["song_pool"])
    
    # Değilse şimdi çek
    print(f"[SARKI] ⏳ Havuz hazır değil, şimdi çekiliyor...")
    await broadcast(room, {
        "type": "sarki_pool_status",
        "ready": False,
        "percent": 0,
        "message": "🎵 Şarkı havuzu hazırlanıyor... (%0)"
    })
    
    await _fetch_pool(room, broadcast)  # ✨ broadcast ilet
    room["_pool_cache_key"] = cache_key
    room["_pool_ready"] = True
    return len(room.get("song_pool", []))


# ========================================
# ANA MESAJ İŞLEYİCİ
# ========================================

async def handle_sarki_message(msg_type, data, websocket, rooms, room_code, player_id,
                               make_room_code, safe_send, broadcast):
    """Şarkı Bul mesajlarını işle"""
    
    # ODA OLUŞTUR
    if msg_type == "sarki_create_room":
        name = (data.get("name") or "").strip()[:15]
        max_players = int(data.get("max_players", 2))
        dil = data.get("dil", "karisik")
        total_songs = int(data.get("total_songs", 10))
        song_duration = int(data.get("song_duration", 10))
        answer_duration = int(data.get("answer_duration", 10))
        tur = data.get("tur", None)
        if tur not in VALID_TURLER:
            tur = None

        # Validasyon
        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if max_players not in [2, 3, 4, 5]:
            max_players = 2
        if dil not in ["tr", "yabanci", "karisik"]:
            dil = "karisik"
        if total_songs not in [5, 6, 10, 12, 15, 20, 25, 30]:
            total_songs = 10
        if song_duration not in [5, 10, 15, 20, 30]:
            song_duration = 10
        if answer_duration not in [5, 10, 15, 20, 30]:
            answer_duration = 10
        
        new_code = make_room_code()
        rooms[new_code] = {
            "room_code": new_code,
            "mode": "sarkidan_bul",
            "phase": "lobby",
            "players": {
                1: {"name": name, "ws": websocket, "score": 0}
            },
            "max_players": max_players,
            "dil": dil,
            "total_songs": total_songs,
            "song_duration": song_duration,
            "answer_duration": answer_duration,
            "tur": tur,
            "current_round": 0,
            "song_pool": [],
            "current_song": None,
            "current_options": [],
            "current_correct_index": 0,
            "song_start_time": 0,
            "player_answers": {},
            "current_turn": 1,       # ✨ Sıradaki oyuncu ID
            "turn_order": [],         # ✨ Oyuncu sıralaması
            "kicked_names": [],
            "chat_history": [],
            "chat_last_msg_time": {}
        }
        
        await safe_send(websocket, {
            "type": "sarki_room_created",
            "room_code": new_code,
            "player_id": 1,
            "max_players": max_players,
            "dil": dil,
            "total_songs": total_songs,
            "song_duration": song_duration,
            "answer_duration": answer_duration,
            "tur": tur
        })
        
        await send_sarki_lobby_update(rooms[new_code], broadcast)
        
        # ✨ Arka planda şarkı havuzunu HEMEN hazırla (host beklerken hazırlansın)
        room_obj = rooms[new_code]
        print(f"[SARKI] 🎵 Oda {new_code} oluşturuldu, HAVUZ HAZIRLAMA BAŞLIYOR...")
        asyncio.create_task(prefetch_song_pool(room_obj, broadcast))
        
        return {"handled": True, "room_code": new_code, "player_id": 1}
    
    # ODAYA KATIL
    if msg_type == "sarki_join_room":
        name = (data.get("name") or "").strip()[:15]
        join_code = (data.get("room_code") or "").strip().upper()
        
        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if join_code not in rooms:
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[join_code]
        
        if room.get("mode") != "sarkidan_bul":
            await safe_send(websocket, {"type": "error", "message": "Bu oda başka bir moda ait."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        max_p = room.get("max_players", 2)
        if len(room["players"]) >= max_p:
            await safe_send(websocket, {"type": "error", "message": "Oda dolu!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Oyun başladı, katılamazsın."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Aynı isim kontrolü
        existing_names = [p.get("name", "").lower().strip() for p in room["players"].values()]
        if name.lower().strip() in existing_names:
            await safe_send(websocket, {
                "type": "error",
                "message": f"Bu isimde ({name}) bir oyuncu zaten odada var."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Boş player_id bul
        new_pid = None
        for i in range(1, max_p + 1):
            if i not in room["players"]:
                new_pid = i
                break
        
        if new_pid is None:
            await safe_send(websocket, {"type": "error", "message": "Oda dolu!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room["players"][new_pid] = {"name": name, "ws": websocket, "score": 0}
        
        await safe_send(websocket, {
            "type": "sarki_room_joined",
            "room_code": join_code,
            "player_id": new_pid,
            "max_players": room["max_players"],
            "dil": room["dil"],
            "total_songs": room["total_songs"],
            "song_duration": room["song_duration"],
            "answer_duration": room["answer_duration"]
        })
        
        # Chat geçmişi
        if room.get("chat_history"):
            await safe_send(websocket, {
                "type": "sarki_chat_history",
                "messages": room["chat_history"][-50:]
            })
        
        # ✨ Yeni katılan oyuncuya havuz durumunu bildir
        pool_ready = room.get("_pool_ready", False)
        pool_count = len(room.get("song_pool", []))
        await safe_send(websocket, {
            "type": "sarki_pool_status",
            "ready": pool_ready,
            "count": pool_count,
            "message": "🎵 Şarkı havuzu hazırlanıyor..." if not pool_ready else None
        })
        
        await send_sarki_lobby_update(room, broadcast)
        return {"handled": True, "room_code": join_code, "player_id": new_pid}
    
    # ODA AYARLARINI GÜNCELLE (sadece host)
    if msg_type == "sarki_update_settings":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "sarkidan_bul":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host ayarları değiştirebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Sadece lobbyde değiştirebilirsin."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        max_players = int(data.get("max_players", 2))
        dil = data.get("dil", "karisik")
        total_songs = int(data.get("total_songs", 10))
        song_duration = int(data.get("song_duration", 10))
        answer_duration = int(data.get("answer_duration", 10))
        
        if max_players not in [2, 3, 4, 5]:
            max_players = 2
        if dil not in ["tr", "yabanci", "karisik"]:
            dil = "karisik"
        if total_songs not in [5, 6, 10, 12, 15, 20, 25, 30]:
            total_songs = 10
        if song_duration not in [5, 10, 15, 20, 30]:
            song_duration = 10
        if answer_duration not in [5, 10, 15, 20, 30]:
            answer_duration = 10
        tur = data.get("tur", None)
        if tur not in VALID_TURLER:
            tur = None

        if max_players < len(room["players"]):
            await safe_send(websocket, {
                "type": "error",
                "message": f"Odada {len(room['players'])} oyuncu var, daha az yapamazsın."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Dil veya toplam şarkı sayısı değiştiyse havuzu yenile
        old_dil = room.get("dil")
        old_total = room.get("total_songs")
        
        room["max_players"] = max_players
        room["dil"] = dil
        room["total_songs"] = total_songs
        room["song_duration"] = song_duration
        room["answer_duration"] = answer_duration
        old_tur = room.get("tur")
        room["tur"] = tur

        # ✨ Kritik ayar değiştiyse havuzu KOMPLE sıfırla + yeniden hazırla
        if old_dil != dil or old_total != total_songs or old_tur != tur:
            print(f"[SARKI] 🔄 Ayar değişti (dil: {old_dil}→{dil}, total: {old_total}→{total_songs}), havuz sıfırlanıyor")
            room["song_pool"] = []
            room["_pool_cache_key"] = None
            room["_pool_ready"] = False   # ✨ Hazır flag'ini de sıfırla
            
            # Herkese "havuz hazırlanıyor" bildir HEMEN
            await broadcast(room, {
                "type": "sarki_pool_status",
                "ready": False,
                "percent": 0,
                "message": "🎵 Şarkı havuzu hazırlanıyor... (%0)"
            })
            
            # Arka planda yeni havuzu hazırla
            asyncio.create_task(prefetch_song_pool(room, broadcast))
        
        await send_sarki_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # OYUNU BAŞLAT
    if msg_type == "sarki_start_game":
        # Room code + player_id yoksa websocket'ten bul
        if not room_code or room_code not in rooms:
            for code, rd in rooms.items():
                if rd.get("mode") == "sarkidan_bul":
                    for pid, pdata in rd["players"].items():
                        if pdata.get("ws") == websocket:
                            room_code = code
                            player_id = pid
                            break
                    if room_code and room_code in rooms:
                        break
        
        if not room_code or room_code not in rooms:
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        
        if room.get("mode") != "sarkidan_bul":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        # Host doğrulaması: websocket üzerinden player_id kontrol et
        actual_pid = None
        for pid, pdata in room["players"].items():
            if pdata.get("ws") == websocket:
                actual_pid = pid
                break
        
        if actual_pid != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        player_id = actual_pid
        
        if len(room["players"]) < 2:
            await safe_send(websocket, {"type": "error", "message": "En az 2 oyuncu gerekli."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Skorları sıfırla
        room["current_round"] = 0
        for pid in room["players"]:
            room["players"][pid]["score"] = 0
            room["players"][pid]["correct_count"] = 0
            room["players"][pid]["wrong_count"] = 0
        
        # Turn order: player id'lerini sırala
        room["turn_order"] = sorted(list(room["players"].keys()))
        room["current_turn"] = room["turn_order"][0]
        print(f"[SARKI] Turn order: {room['turn_order']}, ilk sıra: {room['current_turn']}")
        
        # ✨ Havuz hazır mı kontrol et
        needed = room["total_songs"] * 2
        current_pool = len(room.get("song_pool", []))
        
        if room.get("_pool_ready") and current_pool >= needed:
            # ✅ Havuz hazır, HEMEN başla (bekleme yok!)
            print(f"[SARKI] ✅ Havuz zaten hazır ({current_pool} şarkı), oyun HEMEN başlıyor")
        else:
            # ❌ Havuz hazır değil, bekleme mesajı gönder + hazırlaması bekle
            print(f"[SARKI] ⏳ Havuz hazır değil, hazırlanıyor... (mevcut: {current_pool}, gerekli: {needed})")
            await broadcast(room, {
                "type": "sarki_preparing",
                "message": "🎵 Şarkı havuzu hazırlanıyor..."
            })
            pool_size = await prepare_song_pool(room, safe_send, broadcast)
            
            if pool_size < room["total_songs"]:
                await broadcast(room, {
                    "type": "error",
                    "message": f"Yeterli şarkı bulunamadı ({pool_size}). Farklı dil seçmeyi deneyin."
                })
                return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # İlk turu başlat
        room["phase"] = "playing"
        await asyncio.sleep(0.5)
        await start_sarki_round(room, safe_send, broadcast)
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # CEVAP VER
    if msg_type == "sarki_answer":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "sarkidan_bul":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        answer_index = data.get("answer_index")
        if not isinstance(answer_index, int) or answer_index < 0 or answer_index > 3:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        await handle_sarki_answer(room, player_id, answer_index, safe_send, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # BACK TO LOBBY (rematch)
    if msg_type == "sarki_back_to_lobby":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "sarkidan_bul":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host lobiye döndürebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Task iptal
        old_task = room.get("sarki_task")
        if old_task and not old_task.done():
            old_task.cancel()
        room["sarki_task"] = None
        
        # Sıfırla
        room["phase"] = "lobby"
        room["current_round"] = 0
        room["song_pool"] = []
        room["current_song"] = None
        room["player_answers"] = {}
        for pid in room["players"]:
            room["players"][pid]["score"] = 0
            room["players"][pid]["correct_count"] = 0
            room["players"][pid]["wrong_count"] = 0
        
        await broadcast(room, {"type": "sarki_back_to_lobby"})
        await send_sarki_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # CHAT MESAJI
    if msg_type == "sarki_chat_send":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "sarkidan_bul":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id not in room["players"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        text = (data.get("text") or "").strip()[:100]
        if not text:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Spam kontrolü
        now = time.time()
        if "chat_last_msg_time" not in room:
            room["chat_last_msg_time"] = {}
        last_times = room["chat_last_msg_time"].get(player_id, [])
        last_times = [t for t in last_times if now - t < 1.0]
        if len(last_times) >= 3:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        last_times.append(now)
        room["chat_last_msg_time"][player_id] = last_times
        
        sender_name = room["players"][player_id].get("name", f"P{player_id}")
        
        chat_msg = {
            "sender_id": player_id,
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
            "type": "sarki_chat_msg",
            "sender_id": player_id,
            "sender_name": sender_name,
            "text": text,
            "ts": now
        })
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # HİÇBİR CASE TETİKLENMEDİ - handled=False dön
    return {"handled": False, "room_code": room_code, "player_id": player_id}


# ========================================
# TUR BAŞLAT
# ========================================

async def start_sarki_round(room, safe_send, broadcast):
    """Yeni tur başlatır - önce intro, sonra şarkı + 4 şık - sıradaki oyuncu cevaplar"""
    room["current_round"] = room.get("current_round", 0) + 1
    
    # Sıradaki oyuncuyu belirle (round-robin)
    turn_order = room.get("turn_order", [])
    if not turn_order:
        turn_order = sorted(list(room["players"].keys()))
        room["turn_order"] = turn_order
    
    turn_index = (room["current_round"] - 1) % len(turn_order)
    room["current_turn"] = turn_order[turn_index]
    
    # Sıradaki oyuncu odada mı? (ayrılmış olabilir)
    if room["current_turn"] not in room["players"]:
        # Bu sırayı atla, sonraki turn'a geç
        room["current_round"] -= 1  # tur sayısını geri al
        # Sıra atlama için turn_order'ı yenile
        room["turn_order"] = [pid for pid in room["turn_order"] if pid in room["players"]]
        if not room["turn_order"]:
            await end_sarki_game(room, safe_send, broadcast)
            return
        room["current_round"] += 1
        turn_index = (room["current_round"] - 1) % len(room["turn_order"])
        room["current_turn"] = room["turn_order"][turn_index]
    
    print(f"[SARKI] Round {room['current_round']}: Sıra Oyuncu {room['current_turn']} ({room['players'][room['current_turn']]['name']})'de")
    
    # Havuzdan rastgele bir şarkı seç
    pool = room.get("song_pool", [])
    if not pool:
        print("[SARKI] HATA: Şarkı havuzu boş!")
        await end_sarki_game(room, safe_send, broadcast)
        return
    
    # Şarkıyı havuzdan çıkar (tekrar gelmesin)
    correct_song = pool.pop(0)
    room["current_song"] = correct_song
    
    # 3 yanlış şık üret (farklı sanatçılardan)
    wrong_options = []
    correct_artist = correct_song["artist"].lower()
    correct_id = correct_song["id"]
    
    # Havuzdan farklı sanatçılı şarkı seç
    candidates = [s for s in pool 
                  if s["artist"].lower() != correct_artist 
                  and s["id"] != correct_id]
    
    # Yeterli aday yoksa daha esnek ol
    if len(candidates) < 3:
        candidates = [s for s in pool if s["id"] != correct_id]
    
    if len(candidates) >= 3:
        wrong_options = random.sample(candidates, 3)
    else:
        # Havuz çok küçük - oyunu bitir
        await end_sarki_game(room, safe_send, broadcast)
        return
    
    # 4 şıkkı karıştır, doğru olanın index'ini bul
    all_options = wrong_options + [correct_song]
    random.shuffle(all_options)
    correct_index = all_options.index(correct_song)
    
    # Şıkları oyunculara gönderilecek formata çevir (preview_url gönderme, cheating önle)
    display_options = []
    for opt in all_options:
        display_options.append({
            "title": opt["title"],
            "artist": opt["artist"]
        })
    
    room["current_options"] = all_options
    room["current_correct_index"] = correct_index
    room["player_answers"] = {}
    room["song_start_time"] = time.time()
    room["phase"] = "playing"
    
    print(f"[SARKI] Tur {room['current_round']}: {correct_song['artist']} - {correct_song['title']}")
    print(f"[SARKI] Doğru şık index: {correct_index}")
    
    # Herkese tur başlangıcı gönder + sıradaki oyuncu bilgisi
    current_turn_pid = room["current_turn"]
    current_turn_name = room["players"][current_turn_pid]["name"]
    
    # ✨ ÖNCE 2sn intro göster (şarkı çalmıyor, timer başlamıyor)
    # Oyuncu listesini de gönder (ilk tur için skor tablosunu hazırlamak)
    players_info = []
    for pid, pdata in sorted(room["players"].items()):
        players_info.append({
            "id": pid,
            "name": pdata["name"],
            "score": pdata.get("score", 0)
        })
    
    await broadcast(room, {
        "type": "sarki_turn_intro",
        "round_no": room["current_round"],
        "total_rounds": room["total_songs"],
        "current_turn": current_turn_pid,
        "current_turn_name": current_turn_name,
        "players_info": players_info
    })
    print(f"[SARKI] 🎬 Turn intro gösteriliyor (2sn)...")
    
    # 2 saniye bekle (intro ekranı açık kalsın)
    await asyncio.sleep(2)
    
    # ✨ SONRA gerçek tur başlangıcı - şarkı çalmaya başla, timer aktif
    room["song_start_time"] = time.time()  # Sıfırla (intro sonrası)
    
    song_tur = get_tur_of_artist(correct_song.get("artist", ""))
    await broadcast(room, {
        "type": "sarki_round_start",
        "round_no": room["current_round"],
        "total_rounds": room["total_songs"],
        "preview_url": correct_song["preview_url"],
        "cover": correct_song.get("cover", ""),
        "options": display_options,
        "song_duration": room["song_duration"],
        "answer_duration": room["answer_duration"],
        "current_turn": current_turn_pid,
        "current_turn_name": current_turn_name,
        "song_tur": song_tur
    })
    
    # Timer başlat: şarkı süresi + cevap süresi = toplam süre
    if room.get("sarki_task"):
        try:
            room["sarki_task"].cancel()
        except:
            pass
    
    room["sarki_task"] = asyncio.create_task(
        round_timer(room, safe_send, broadcast)
    )


async def round_timer(room, safe_send, broadcast):
    """Şarkı süresi + cevap süresi bitince otomatik sonuç"""
    try:
        total_wait = room["song_duration"] + room["answer_duration"]
        await asyncio.sleep(total_wait)
        
        if room.get("phase") != "playing":
            return
        
        print(f"[SARKI] Süre doldu, sonuç gösteriliyor")
        await show_round_result(room, safe_send, broadcast)
    except asyncio.CancelledError:
        print("[SARKI] Round timer iptal edildi")
    except Exception as e:
        print(f"[SARKI] Round timer HATA: {e}")


# ========================================
# CEVAP GELDİ
# ========================================

async def handle_sarki_answer(room, player_id, answer_index, safe_send, broadcast):
    """Oyuncu cevap verdi - SADECE SIRA ONDA İSE KABUL"""
    if room.get("phase") != "playing":
        return
    
    # ✨ Sıra onda mı kontrol et
    if room.get("current_turn") != player_id:
        print(f"[SARKI] Oyuncu {player_id} cevap vermek istedi ama sıra onda değil (sıra: {room.get('current_turn')})")
        return
    
    if player_id in room["player_answers"]:
        return  # Zaten cevap vermiş
    
    # Cevap zamanını kaydet
    now = time.time()
    elapsed = now - room["song_start_time"]
    
    room["player_answers"][player_id] = {
        "answer_index": answer_index,
        "time": elapsed
    }
    
    # Herkese "X cevapladı" bildir
    player_name = room["players"][player_id]["name"]
    await broadcast(room, {
        "type": "sarki_player_answered",
        "player_id": player_id,
        "player_name": player_name,
        "answered_count": 1,
        "total_players": 1  # Sadece sıradaki cevaplar
    })
    
    # Sıradaki cevapladıysa hemen sonuç
    print(f"[SARKI] {player_name} cevapladı, sonuç gösteriliyor")
    if room.get("sarki_task"):
        try:
            room["sarki_task"].cancel()
        except:
            pass
    room["sarki_task"] = None
    
    await asyncio.sleep(0.5)
    await show_round_result(room, safe_send, broadcast)


# ========================================
# TUR SONUCU
# ========================================

async def show_round_result(room, safe_send, broadcast):
    """Turu bitir, puanları hesapla, sonuçları göster"""
    room["phase"] = "result"
    
    correct_index = room["current_correct_index"]
    correct_song = room["current_song"]
    song_duration = room["song_duration"]
    
    # ✨ Sadece SIRADAKI OYUNCU için puan hesapla
    current_turn_pid = room.get("current_turn")
    current_pdata = room["players"].get(current_turn_pid)
    
    turn_result = None
    if current_pdata:
        answer_data = room["player_answers"].get(current_turn_pid)
        
        if not answer_data:
            points = -3
            status = "timeout"
            answer_time = 0
            answer_idx = -1
            print(f"[SARKI] ⏰ TIMEOUT: {current_pdata['name']} cevap vermedi → -3 puan")
        elif answer_data["answer_index"] == correct_index:
            answer_time = answer_data["time"]
            if answer_time < 3.0:
                points = 15
                status = "correct_fast"
                print(f"[SARKI] 🔥 HIZLI DOĞRU: {current_pdata['name']} → +15 puan")
            else:
                points = 10
                status = "correct"
                print(f"[SARKI] ✅ DOĞRU: {current_pdata['name']} → +10 puan")
            answer_idx = answer_data["answer_index"]
        else:
            points = -3
            status = "wrong"
            answer_time = answer_data["time"]
            answer_idx = answer_data["answer_index"]
            print(f"[SARKI] ❌ YANLIŞ: {current_pdata['name']} → -3 puan (cevap: {answer_idx}, doğru: {correct_index})")
        
        old_score = current_pdata.get("score", 0)
        current_pdata["score"] = old_score + points
        # ✨ Doğru/yanlış sayacı
        if status in ("correct", "correct_fast"):
            current_pdata["correct_count"] = current_pdata.get("correct_count", 0) + 1
        else:
            current_pdata["wrong_count"] = current_pdata.get("wrong_count", 0) + 1
        print(f"[SARKI] 💰 SKOR GÜNCELLENDİ: {current_pdata['name']}: {old_score} → {current_pdata['score']}")
        turn_result = {
            "player_id": current_turn_pid,
            "player_name": current_pdata["name"],
            "points": points,
            "total_score": current_pdata["score"],
            "status": status,
            "answer_time": round(answer_time, 1),
            "answer_index": answer_idx
        }
    
    # Tüm oyuncuların total_score'ları (sıralamak için)
    round_results = []
    for pid, pdata in room["players"].items():
        round_results.append({
            "player_id": pid,
            "player_name": pdata["name"],
            "points": turn_result["points"] if (turn_result and pid == current_turn_pid) else 0,
            "total_score": pdata.get("score", 0),
            "status": turn_result["status"] if (turn_result and pid == current_turn_pid) else "spectator",
            "answer_time": turn_result["answer_time"] if (turn_result and pid == current_turn_pid) else 0,
            "answer_index": turn_result["answer_index"] if (turn_result and pid == current_turn_pid) else -1,
            "is_turn": (pid == current_turn_pid)
        })
    
    # Toplam skora göre sırala
    round_results.sort(key=lambda x: x["total_score"], reverse=True)
    
    # Herkese sonuç gönder
    await broadcast(room, {
        "type": "sarki_round_result",
        "correct_index": correct_index,
        "correct_song": {
            "title": correct_song["title"],
            "artist": correct_song["artist"],
            "cover": correct_song.get("cover", "")
        },
        "results": round_results,
        "round_no": room["current_round"],
        "total_rounds": room["total_songs"]
    })
    
    # 6 saniye bekle: 3sn inline şık gösterimi + 2sn popup + 1sn geçiş
    await asyncio.sleep(6)
    
    if room["current_round"] >= room["total_songs"]:
        await end_sarki_game(room, safe_send, broadcast)
    else:
        await start_sarki_round(room, safe_send, broadcast)


# ========================================
# OYUN SONU
# ========================================

async def end_sarki_game(room, safe_send, broadcast):
    """Oyunu bitir, kazananı ilan et"""
    room["phase"] = "finished"
    
    # Task'i iptal et
    if room.get("sarki_task"):
        try:
            room["sarki_task"].cancel()
        except:
            pass
    room["sarki_task"] = None
    
    # Skorları sırala
    scores = []
    for pid, pdata in room["players"].items():
        scores.append({
            "player_id": pid,
            "player_name": pdata["name"],
            "score": pdata.get("score", 0),
            "correct_count": pdata.get("correct_count", 0),
            "wrong_count": pdata.get("wrong_count", 0)
        })
    scores.sort(key=lambda x: x["score"], reverse=True)
    
    winner = scores[0] if scores else None
    
    await broadcast(room, {
        "type": "sarki_game_over",
        "scores": scores,
        "winner_id": winner["player_id"] if winner else None,
        "winner_name": winner["player_name"] if winner else "?"
    })
    
    print(f"[SARKI] Oyun bitti! Kazanan: {winner['player_name'] if winner else '?'}")