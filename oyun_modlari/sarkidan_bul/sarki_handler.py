"""
ŞARKIDAN BUL - Backend Handler
Deezer API kullanarak şarkı tanıma oyunu
"""

import asyncio
import random
import time
from .deezer_api import fetch_songs_by_artists
from .playlists import (
    get_artists,
    get_artist_objects,
    get_artists_by_tier,
    VALID_TURLER,
    get_tur_of_artist,
    get_tier_of_artist,
)


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
    """
    Deezer'dan şarkıları çeker ve room['song_pool']'a kaydeder.
    ✨ Kademeli yükleme: İlk 5 şarkı gelince oyun başlayabilir, gerisi arka planda yüklenir.
    """
    dil = room.get("dil", "karisik")
    tur = room.get("tur", None)
    artist_objs = get_artist_objects(dil, tur)  # dict listesi
    total_needed = room.get("total_songs", 10)
    
    random.shuffle(artist_objs)
    # ✨ Progresif mod için daha çok sanatçı çek (her tier'dan yeterli olsun)
    target_count = min(len(artist_objs), max(30, total_needed * 4))
    selected_artists = artist_objs[:target_count]
    
    print(f"[SARKI] 🎯 Havuz hedefi: {target_count} sanatçı, {total_needed} tur için")
    
    # ✨ İLK PARTİ: 5 sanatçıdan hızlıca şarkı çek (oyun başlayabilsin)
    first_batch_artists = selected_artists[:5]
    remaining_artists = selected_artists[5:]
    
    print(f"[SARKI] 🚀 İlk parti: {len(first_batch_artists)} sanatçı (hızlı başlangıç)")
    
    # ✨ İlerleme bildirimi - başlangıç
    if broadcast:
        try:
            await broadcast(room, {
                "type": "sarki_pool_status",
                "ready": False,
                "percent": 5,
                "message": "🎵 Deezer'a bağlanılıyor... (%5)"
            })
        except:
            pass
    
    # ==========================================
    # FAZ 1: İlk parti (5 sanatçı) - HIZLI
    # ==========================================
    first_songs = await asyncio.to_thread(
        fetch_songs_by_artists, first_batch_artists, 6
    )
    
    # Duplicate temizle
    seen_ids = set()
    songs = []
    for s in first_songs:
        if s["id"] not in seen_ids:
            seen_ids.add(s["id"])
            songs.append(s)
    
    # Havuza hemen ekle (oyun başlayabilir)
    random.shuffle(songs)
    room["song_pool"] = songs
    room["_pool_ready"] = True  # ✨ HAZIR flag'i - oyun başlayabilir!
    
    print(f"[SARKI] ⚡ FAZ 1 tamam: {len(songs)} şarkı hazır (oyun başlayabilir)")
    
    # Bildir: hazır ama arka planda yükleme devam ediyor
    if broadcast:
        try:
            await broadcast(room, {
                "type": "sarki_pool_status",
                "ready": True,
                "count": len(songs),
                "percent": 30,
                "background_loading": True,
                "message": f"🚀 Oyun başlayabilir! ({len(songs)} şarkı hazır, arka planda daha çok yükleniyor)"
            })
        except:
            pass
    
    # ==========================================
    # FAZ 2: Kalan sanatçılar - ARKA PLANDA
    # ==========================================
    if not remaining_artists:
        return
    
    print(f"[SARKI] 🔄 FAZ 2 başlıyor: {len(remaining_artists)} sanatçı daha (arka planda)")
    
    # Fake progress ticker (arka plan yükleme sırasında)
    progress_task_done = asyncio.Event()
    
    async def progress_ticker():
        """Arka planda yükleme sırasında %30'dan %90'a yavaş yavaş çık"""
        pct = 30
        try:
            while not progress_task_done.is_set() and pct < 90:
                if broadcast:
                    try:
                        await broadcast(room, {
                            "type": "sarki_pool_status",
                            "ready": True,
                            "count": len(room.get("song_pool", [])),
                            "percent": pct,
                            "background_loading": True,
                            "message": f"🎵 Arka planda yükleniyor... (%{pct})"
                        })
                    except:
                        pass
                await asyncio.sleep(0.6)
                pct += random.randint(2, 4)
                if pct > 90:
                    pct = 90
        except asyncio.CancelledError:
            pass
    
    ticker = asyncio.create_task(progress_ticker())
    
    try:
        # Kalan sanatçıları çek
        more_songs = await asyncio.to_thread(
            fetch_songs_by_artists, remaining_artists, 6
        )
    finally:
        progress_task_done.set()
        try:
            ticker.cancel()
            await asyncio.sleep(0)
        except:
            pass
    
    # Yeni şarkıları mevcut havuza ekle
    added_count = 0
    for s in more_songs:
        if s["id"] not in seen_ids:
            seen_ids.add(s["id"])
            room["song_pool"].append(s)
            added_count += 1
    
    print(f"[SARKI] ✅ FAZ 2 tamam: +{added_count} şarkı eklendi, toplam: {len(room['song_pool'])}")
    
    # ==========================================
    # FAZ 3: Yetersizse ek çek (yine paralel)
    # ==========================================
    if len(room["song_pool"]) < total_needed * 4 and len(artist_objs) > target_count:
        extra_artists = artist_objs[target_count:target_count + 20]
        extra_songs = await asyncio.to_thread(
            fetch_songs_by_artists, extra_artists, 6
        )
        for s in extra_songs:
            if s["id"] not in seen_ids:
                seen_ids.add(s["id"])
                room["song_pool"].append(s)
    
    # Son karıştırma
    random.shuffle(room["song_pool"])
    
    # ✨ %100 bildirimi
    if broadcast:
        try:
            await broadcast(room, {
                "type": "sarki_pool_status",
                "ready": True,
                "count": len(room["song_pool"]),
                "percent": 100,
                "background_loading": False,
                "message": f"✅ Havuz tamamen hazır! ({len(room['song_pool'])} şarkı)"
            })
        except:
            pass
    
    print(f"[SARKI] 🎉 TÜM havuz hazır: {len(room['song_pool'])} şarkı")
    
    # ✨ Tier istatistikleri yazdır
    tier_stats = {"efsane": 0, "cok_populer": 0, "populer": 0, "bilinen": 0}
    for s in songs:
        t = s.get("tier", "populer")
        if t in tier_stats:
            tier_stats[t] += 1
    print(f"[SARKI] 🎵 Deezer'dan çekildi: {len(songs)} şarkı ({dil})")
    print(f"[SARKI] 📊 Tier dağılımı: 🌟{tier_stats['efsane']} ⭐{tier_stats['cok_populer']} ✅{tier_stats['populer']} 📼{tier_stats['bilinen']}")
    
# ========================================
# PROGRESİF MOD - ZORLUK HESAPLAMA
# ========================================

def calculate_round_difficulty(current_round: int, total_rounds: int) -> str:
    """
    Turun zorluğunu hesaplar: 'kolay', 'orta', 'zor'
    
    Toplam şarkıyı 3'e böler:
    - İlk 1/3 → kolay
    - Orta 1/3 → orta
    - Son 1/3 → zor
    """
    if total_rounds <= 0:
        return "orta"
    
    # Bölünme noktaları
    kolay_sinir = total_rounds // 3
    orta_sinir = (total_rounds * 2) // 3
    
    # 5 şarkı için özel durum: 2 kolay, 2 orta, 1 zor
    if total_rounds == 5:
        if current_round <= 2:
            return "kolay"
        elif current_round <= 4:
            return "orta"
        else:
            return "zor"
    
    # 6 şarkı için özel: 2 kolay, 2 orta, 2 zor
    if total_rounds == 6:
        if current_round <= 2:
            return "kolay"
        elif current_round <= 4:
            return "orta"
        else:
            return "zor"
    
    # Genel durum
    if current_round <= kolay_sinir:
        return "kolay"
    elif current_round <= orta_sinir:
        return "orta"
    else:
        return "zor"


def get_tiers_for_difficulty(difficulty: str) -> list:
    """
    Zorluk seviyesine göre hangi tier'lardan şarkı seçileceğini döner.
    """
    if difficulty == "kolay":
        # Bilindik şarkılar
        return ["efsane", "cok_populer"]
    elif difficulty == "orta":
        # Karışık - hem popüler hem az bilinen
        return ["cok_populer", "populer"]
    elif difficulty == "zor":
        # Bilinmedik - meraklısı bilir
        return ["populer", "bilinen"]
    else:
        return ["cok_populer", "populer"]


def should_use_same_artist_trap(difficulty: str) -> bool:
    """
    Aynı sanatçı tuzağı kullanılsın mı?
    - Kolay: %25 ihtimalle (bazen sürpriz)
    - Orta: %100 (her zaman)
    - Zor: %100 (her zaman)
    """
    if difficulty == "kolay":
        return random.random() < 0.25  # %25
    elif difficulty in ("orta", "zor"):
        return True
    return False    

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
        
        # ✨ Havuz hazır mı kontrol et (kademeli sistem için minimum: total_songs kadar)
        needed = room["total_songs"]  # ✨ 2 katı değil, tam sayı yeterli (arka planda dolacak)
        current_pool = len(room.get("song_pool", []))
        
        if room.get("_pool_ready") and current_pool >= needed:
            # ✅ Havuz hazır, HEMEN başla
            print(f"[SARKI] ✅ Havuz hazır ({current_pool} şarkı, gerekli: {needed}), oyun BAŞLIYOR")
        elif room.get("_pool_ready") and current_pool >= 5:
            # ✅ En az 5 şarkı var, kademeli sistemde başlayabiliriz
            print(f"[SARKI] ⚡ Kademeli başlangıç: {current_pool} şarkı hazır, arka planda daha çok geliyor")
        else:
            # ❌ Yeterli şarkı yok, bekleme mesajı
            print(f"[SARKI] ⏳ Havuz yetersiz, bekleniyor... (mevcut: {current_pool}, gerekli en az: 5)")
            await broadcast(room, {
                "type": "sarki_preparing",
                "message": "🎵 Şarkı havuzu hazırlanıyor..."
            })
            pool_size = await prepare_song_pool(room, safe_send, broadcast)
            
            if pool_size < 5:
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
    
    # BACK TO LOBBY
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
        
        # ✨ Havuz cache'ini de sıfırla ki yeni oyunda taze havuz gelsin
        room["_pool_ready"] = False
        room["_pool_cache_key"] = None
        
        # ✨ MISAFIRLERE ÖNCE gönder (host zaten kendi ekranını çevirdi)
        # Sıralı await yerine PARALEL gönder → tüm misafirler eş zamanlı alır
        import asyncio as _asyncio
        back_msg = {"type": "sarki_back_to_lobby"}
        send_tasks = []
        for pid, pdata in room["players"].items():
            ws_target = pdata.get("ws")
            if ws_target:
                send_tasks.append(safe_send(ws_target, back_msg))
        if send_tasks:
            await _asyncio.gather(*send_tasks, return_exceptions=True)
        
        # ✨ Lobby update de paralel
        await send_sarki_lobby_update(room, broadcast)
        
        # ✨ Arka planda yeni havuzu hazırla (oda hazır olsun)
        _asyncio.create_task(prefetch_song_pool(room, broadcast))
        
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
    """
    Yeni tur başlatır - PROGRESİF MOD.
    - İlk 1/3: Kolay (efsane şarkılar, 4 farklı sanatçı)
    - Orta 1/3: Orta (popüler, 1 aynı sanatçı tuzağı)
    - Son 1/3: Zor (bilinmedik, 1 aynı sanatçı tuzağı)
    """
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
        room["current_round"] -= 1
        room["turn_order"] = [pid for pid in room["turn_order"] if pid in room["players"]]
        if not room["turn_order"]:
            await end_sarki_game(room, safe_send, broadcast)
            return
        room["current_round"] += 1
        turn_index = (room["current_round"] - 1) % len(room["turn_order"])
        room["current_turn"] = room["turn_order"][turn_index]
    
    # ✨ ZORLUK HESAPLA (Progresif mod)
    total_rounds = room.get("total_songs", 10)
    difficulty = calculate_round_difficulty(room["current_round"], total_rounds)
    target_tiers = get_tiers_for_difficulty(difficulty)
    use_trap = should_use_same_artist_trap(difficulty)
    
    difficulty_emoji = {"kolay": "🟢", "orta": "🟡", "zor": "🔴"}[difficulty]
    print(f"[SARKI] Round {room['current_round']}/{total_rounds}: "
          f"{difficulty_emoji} {difficulty.upper()} | "
          f"Sıra: {room['players'][room['current_turn']]['name']} | "
          f"Tuzak: {'✅' if use_trap else '❌'} | "
          f"Hedef tier: {target_tiers}")
    
    # Havuzdan şarkı seç
    pool = room.get("song_pool", [])
    if not pool:
        print("[SARKI] HATA: Şarkı havuzu boş!")
        await end_sarki_game(room, safe_send, broadcast)
        return
    
    # ✨ ZORLUKA UYGUN ŞARKI SEÇ
    # Önce hedef tier'daki şarkılardan seç
    tier_matching = [s for s in pool if s.get("tier") in target_tiers]
    
    if tier_matching:
        correct_song = random.choice(tier_matching)
        pool.remove(correct_song)
    else:
        # Uygun tier yoksa herhangi bir şarkı al (fallback)
        print(f"[SARKI] ⚠️ {difficulty} zorluk için uygun şarkı yok, rastgele seçiliyor")
        correct_song = pool.pop(0)
    
    room["current_song"] = correct_song
    correct_artist = correct_song["artist"].lower()
    correct_id = correct_song["id"]
    correct_tur = get_tur_of_artist(correct_song["artist"])
    
    print(f"[SARKI] 🎵 Doğru şarkı: {correct_song['artist']} - {correct_song['title']} "
          f"(tier: {correct_song.get('tier', '?')}, tür: {correct_tur})")
    
    # ✨ YANLIŞ ŞIK ÜRETME (Zorluk odaklı)
    wrong_options = []
    
    # 1) Önce AYNI TÜRDEN adayları topla
    same_tur_candidates = [s for s in pool 
                          if s["artist"].lower() != correct_artist 
                          and s["id"] != correct_id
                          and get_tur_of_artist(s["artist"]) == correct_tur]
    
    # 2) Aynı türden de aynı zorluğa yakın olanları önceliklendir
    same_tier_candidates = [s for s in same_tur_candidates 
                           if s.get("tier") in target_tiers]
    
    # ✨ AYNI SANATÇI TUZAĞI
    if use_trap:
        # Aynı sanatçının başka şarkısını bul
        same_artist_songs = [s for s in pool 
                            if s["artist"].lower() == correct_artist 
                            and s["id"] != correct_id]
        
        if same_artist_songs:
            trap_song = random.choice(same_artist_songs)
            wrong_options.append(trap_song)
            pool.remove(trap_song)
            print(f"[SARKI] 🪤 Aynı sanatçı tuzağı eklendi: {trap_song['title']}")
    
    # Kalan yanlış şık sayısı
    remaining_needed = 3 - len(wrong_options)
    
    # 3) Önce aynı tür + aynı tier'dan seç
    used_ids = {opt["id"] for opt in wrong_options}
    tier_pool = [s for s in same_tier_candidates if s["id"] not in used_ids]
    
    if len(tier_pool) >= remaining_needed:
        selected = random.sample(tier_pool, remaining_needed)
        wrong_options.extend(selected)
    else:
        # Yeterli değilse: aynı tür (herhangi tier'dan) + kalanı tüm havuzdan
        wrong_options.extend(tier_pool)
        used_ids = {opt["id"] for opt in wrong_options}
        remaining_needed = 3 - len(wrong_options)
        
        # Aynı türden (tier fark etmez)
        tur_fallback = [s for s in same_tur_candidates if s["id"] not in used_ids]
        if len(tur_fallback) >= remaining_needed:
            wrong_options.extend(random.sample(tur_fallback, remaining_needed))
        else:
            wrong_options.extend(tur_fallback)
            used_ids = {opt["id"] for opt in wrong_options}
            remaining_needed = 3 - len(wrong_options)
            
            # Son çare: tüm havuzdan
            any_fallback = [s for s in pool 
                          if s["artist"].lower() != correct_artist 
                          and s["id"] not in used_ids
                          and s["id"] != correct_id]
            if len(any_fallback) >= remaining_needed:
                wrong_options.extend(random.sample(any_fallback, remaining_needed))
            else:
                # Havuz çok küçük - oyunu bitir
                print(f"[SARKI] ❌ Yeterli yanlış şık yok ({len(wrong_options)}/3)")
                await end_sarki_game(room, safe_send, broadcast)
                return
    
    # 4 şıkkı karıştır
    all_options = wrong_options + [correct_song]
    random.shuffle(all_options)
    correct_index = all_options.index(correct_song)
    
    # Şıkları oyunculara gönderilecek formata çevir
    display_options = []
    for opt in all_options:
        display_options.append({
            "title": opt["title"],
            "artist": opt["artist"]
        })
    
    room["current_options"] = all_options
    room["current_correct_index"] = correct_index
    room["current_difficulty"] = difficulty  # ✨ Frontend'e gönderelim
    room["player_answers"] = {}
    room["song_start_time"] = time.time()
    room["phase"] = "playing"
    
    print(f"[SARKI] Şıklar:")
    for i, opt in enumerate(all_options):
        marker = "✅" if i == correct_index else "❌"
        print(f"   {marker} {i+1}. {opt['artist']} - {opt['title']}")
    
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
    # ✨ Server timestamp gönder (senkronizasyon için)
    server_start_ts = time.time()
    room["_round_start_ts"] = server_start_ts
    
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
        "song_tur": song_tur,
        "difficulty": room.get("current_difficulty", "orta"),
        "server_start_ts": server_start_ts  # ✨ Timer başlangıç zamanı
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
            points = -5
            status = "timeout"
            answer_time = 0
            answer_idx = -1
            print(f"[SARKI] ⏰ TIMEOUT: {current_pdata['name']} cevap vermedi → -5 puan")
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
            points = -5
            status = "wrong"
            answer_time = answer_data["time"]
            answer_idx = answer_data["answer_index"]
            print(f"[SARKI] ❌ YANLIŞ: {current_pdata['name']} → -5 puan (cevap: {answer_idx}, doğru: {correct_index})")
        
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