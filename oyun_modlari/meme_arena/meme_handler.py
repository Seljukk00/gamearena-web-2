# ========================================
# MEME ARENA - BACKEND HANDLER
# ========================================

import os
import random
import asyncio
from .durumlar import DURUMLAR


def get_meme_cards():
    """meme_kartlari klasöründeki tüm görsel dosyalarını listeler (GIF + Foto)"""
    base_dir = os.path.dirname(__file__)
    meme_dir = os.path.join(base_dir, "meme_kartlari")
    if not os.path.exists(meme_dir):
        return {"all": [], "gifs": [], "photos": []}
    
    all_files = [f for f in os.listdir(meme_dir) 
                 if f.lower().endswith((".png", ".webp", ".jpg", ".jpeg", ".gif"))]
    gifs = [f for f in all_files if f.lower().endswith(".gif")]
    photos = [f for f in all_files if not f.lower().endswith(".gif")]
    
    return {
        "all": sorted(all_files),
        "gifs": sorted(gifs),
        "photos": sorted(photos)
    }


MEM_DATA = get_meme_cards()
TUM_MEMLER = MEM_DATA["all"]
GIF_MEMLER = MEM_DATA["gifs"]
PHOTO_MEMLER = MEM_DATA["photos"]
print(f"[MEME] Toplam mem: {len(TUM_MEMLER)} | GIF: {len(GIF_MEMLER)} | Foto: {len(PHOTO_MEMLER)}")


def dagit_karisim(sayi=5):
    """5 kart dağıt - GIF ve fotoğraf karışımı"""
    if len(TUM_MEMLER) == 0:
        return []
    
    # Eğer sadece bir tür varsa direkt onu döndür
    if not GIF_MEMLER:
        return random.sample(PHOTO_MEMLER, min(sayi, len(PHOTO_MEMLER)))
    if not PHOTO_MEMLER:
        return random.sample(GIF_MEMLER, min(sayi, len(GIF_MEMLER)))
    
    # Karışım oranı: %40 GIF, %60 foto (kaba)
    gif_sayisi = min(2, len(GIF_MEMLER))  # en az 1-2 GIF olsun
    foto_sayisi = sayi - gif_sayisi
    
    if foto_sayisi > len(PHOTO_MEMLER):
        foto_sayisi = len(PHOTO_MEMLER)
        gif_sayisi = sayi - foto_sayisi
    
    secilen_gifler = random.sample(GIF_MEMLER, min(gif_sayisi, len(GIF_MEMLER)))
    secilen_fotolar = random.sample(PHOTO_MEMLER, min(foto_sayisi, len(PHOTO_MEMLER)))
    
    karisim = secilen_gifler + secilen_fotolar
    random.shuffle(karisim)
    return karisim


def dagit_karisim_hafizali(seen_cards, sayi=5):
    """Görülen kartları hariç tutar. Havuz biterse resetler."""
    if len(TUM_MEMLER) == 0:
        return [], seen_cards
    
    # Görülmemiş GIF ve fotoğrafları filtrele
    yeni_gifler = [g for g in GIF_MEMLER if g not in seen_cards]
    yeni_fotolar = [p for p in PHOTO_MEMLER if p not in seen_cards]
    
    toplam_yeni = len(yeni_gifler) + len(yeni_fotolar)
    
    # Havuz biterse resetle (tüm memler görüldü)
    if toplam_yeni < sayi:
        print(f"[MEME] Havuz bitti ({toplam_yeni}/{sayi}), reset yapılıyor")
        seen_cards = set()
        yeni_gifler = list(GIF_MEMLER)
        yeni_fotolar = list(PHOTO_MEMLER)
    
    # Karışım: %40 GIF, %60 foto
    gif_sayisi = min(2, len(yeni_gifler))
    foto_sayisi = sayi - gif_sayisi
    
    if foto_sayisi > len(yeni_fotolar):
        foto_sayisi = len(yeni_fotolar)
        gif_sayisi = sayi - foto_sayisi
    
    if gif_sayisi > len(yeni_gifler):
        gif_sayisi = len(yeni_gifler)
        foto_sayisi = sayi - gif_sayisi
    
    secilen_gifler = random.sample(yeni_gifler, min(gif_sayisi, len(yeni_gifler)))
    secilen_fotolar = random.sample(yeni_fotolar, min(foto_sayisi, len(yeni_fotolar)))
    
    karisim = secilen_gifler + secilen_fotolar
    random.shuffle(karisim)
    karisim = karisim[:sayi]
    
    # Seçilen kartları seen'e ekle
    for c in karisim:
        seen_cards.add(c)
    
    return karisim, seen_cards


# ==========================================
# LOBBY UPDATE
# ==========================================

async def send_meme_lobby_update(room, broadcast):
    """Meme Arena lobby güncellemesi"""
    players_data = []
    for pid, pdata in sorted(room["players"].items()):
        players_data.append({
            "id": pid,
            "name": pdata["name"]
        })
    
    msg = {
        "type": "meme_lobby_update",
        "room_code": room["room_code"],
        "players": players_data,
        "turn_seconds": room.get("turn_seconds", 45),
        "vote_seconds": room.get("vote_seconds", 15),
        "total_rounds": room.get("total_rounds", 5),
        "max_players": room.get("max_players", 2)
    }
    await broadcast(room, msg)


# ==========================================
# ANA MESAJ İŞLEYİCİ
# ==========================================

async def handle_meme_message(msg_type, data, websocket, rooms, room_code, player_id,
                              make_room_code, safe_send, broadcast):
    """Meme Arena mesajlarını işle"""
    
    # ODA OLUŞTUR
    if msg_type == "meme_create_room":
        name = (data.get("name") or "").strip()[:15]
        turn_seconds = int(data.get("turn_seconds", 45))
        vote_seconds = int(data.get("vote_seconds", 15))
        total_rounds = int(data.get("total_rounds", 5))
        max_players = int(data.get("max_players", 2))
        
        # Validasyon
        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if turn_seconds not in [30, 45, 60, 90]:
            turn_seconds = 45
        if vote_seconds not in [10, 15, 20, 30]:
            vote_seconds = 15
        if total_rounds not in [3, 5, 7, 10]:
            total_rounds = 5
        if max_players not in [2, 3, 4, 5]:
            max_players = 2
        
        new_code = make_room_code()
        rooms[new_code] = {
            "room_code": new_code,
            "mode": "meme_arena",
            "phase": "lobby",
            "players": {
                1: {"name": name, "ws": websocket, "score": 0}
            },
            "turn_seconds": turn_seconds,
            "vote_seconds": vote_seconds,
            "total_rounds": total_rounds,
            "max_players": max_players,
            "current_round": 0,
            "current_durum": None,
            "used_durumlar": [],
            "player_cards": {},
            "player_selections": {},
            "player_seen_cards": {},  # Oyuncu bazlı görülen kartlar
            "kicked_names": [],
            "chat_history": [],
            "chat_last_msg_time": {}
        }
        
        await safe_send(websocket, {
            "type": "meme_room_created",
            "room_code": new_code,
            "player_id": 1,
            "turn_seconds": turn_seconds,
            "vote_seconds": vote_seconds,
            "total_rounds": total_rounds,
            "max_players": max_players
        })
        
        await send_meme_lobby_update(rooms[new_code], broadcast)
        return {"handled": True, "room_code": new_code, "player_id": 1}
    
    # ODAYA KATIL
    if msg_type == "meme_join_room":
        name = (data.get("name") or "").strip()[:15]
        join_code = (data.get("room_code") or "").strip().upper()
        
        if not name:
            await safe_send(websocket, {"type": "error", "message": "İsim gir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if join_code not in rooms:
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[join_code]
        
        if room.get("mode") != "meme_arena":
            await safe_send(websocket, {"type": "error", "message": "Bu oda başka bir moda ait."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        max_p = room.get("max_players", 2)
        if len(room["players"]) >= max_p:
            await safe_send(websocket, {"type": "error", "message": "Oda dolu!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Oyun başladı, katılamazsın."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # ✨ Aynı isim var mı? (case-insensitive)
        existing_names = [p.get("name", "").lower().strip() for p in room["players"].values()]
        if name.lower().strip() in existing_names:
            await safe_send(websocket, {
                "type": "error",
                "message": f"Bu isimde ({name}) bir oyuncu zaten odada var. Farklı bir isim seç."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Yeni player_id ver (1'den başlayarak boş olanı bul)
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
            "type": "meme_room_joined",
            "room_code": join_code,
            "player_id": new_pid,
            "turn_seconds": room["turn_seconds"],
            "vote_seconds": room["vote_seconds"],
            "total_rounds": room["total_rounds"],
            "max_players": room["max_players"]
        })
        
        # 💬 Chat geçmişini yeni katılana gönder
        if room.get("chat_history"):
            await safe_send(websocket, {
                "type": "meme_chat_history",
                "messages": room["chat_history"][-50:]
            })
        
        await send_meme_lobby_update(room, broadcast)
        return {"handled": True, "room_code": join_code, "player_id": new_pid}
    
    # ==========================================
    # ODA AYARLARINI GÜNCELLE (sadece host, sadece lobbyde)
    # ==========================================
    if msg_type == "meme_update_settings":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "meme_arena":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host ayarları değiştirebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "lobby":
            await safe_send(websocket, {"type": "error", "message": "Sadece lobbyde ayarları değiştirebilirsin."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Değerleri al ve doğrula
        max_players = int(data.get("max_players", 2))
        total_rounds = int(data.get("total_rounds", 5))
        turn_seconds = int(data.get("turn_seconds", 45))
        vote_seconds = int(data.get("vote_seconds", 15))
        
        if max_players not in [2, 3, 4, 5]:
            max_players = 2
        if total_rounds not in [3, 5, 7, 10]:
            total_rounds = 5
        if turn_seconds not in [30, 45, 60, 90]:
            turn_seconds = 45
        if vote_seconds not in [10, 15, 20, 30]:
            vote_seconds = 15
        
        # Mevcut oyuncu sayısından az olamaz
        if max_players < len(room["players"]):
            await safe_send(websocket, {
                "type": "error",
                "message": f"Odada zaten {len(room['players'])} oyuncu var! Daha az yapamazsın."
            })
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room["max_players"] = max_players
        room["total_rounds"] = total_rounds
        room["turn_seconds"] = turn_seconds
        room["vote_seconds"] = vote_seconds
        
        await send_meme_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # OYUNU BAŞLAT (sadece host)
    # ==========================================
    if msg_type == "meme_start_game":
        print(f"[MEME START] room_code={room_code}, player_id={player_id}")
        
        # Room code yoksa websocket'ten oyuncuyu bul
        if not room_code or room_code not in rooms:
            # WebSocket ile oyuncuyu bul
            for code, room_data in rooms.items():
                if room_data.get("mode") == "meme_arena":
                    for pid, pdata in room_data["players"].items():
                        if pdata["ws"] == websocket:
                            room_code = code
                            player_id = pid
                            print(f"[MEME START] Bulundu: room={code}, pid={pid}")
                            break
                    if room_code and room_code in rooms:
                        break
        
        if not room_code or room_code not in rooms:
            print("[MEME START] HATA: Oda bulunamadı!")
            await safe_send(websocket, {"type": "error", "message": "Oda bulunamadı."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        
        if room.get("mode") != "meme_arena":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            print(f"[MEME START] HATA: player_id={player_id}, host değil!")
            await safe_send(websocket, {"type": "error", "message": "Sadece host başlatabilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if len(room["players"]) < 2:
            await safe_send(websocket, {"type": "error", "message": "En az 2 oyuncu gerekli."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if len(TUM_MEMLER) < 5:
            await safe_send(websocket, {"type": "error", "message": "Yeterli mem kartı yok! (En az 5 lazım)"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        print(f"[MEME START] Oyun başlatılıyor: {room_code}")
        # ✨ Rematch: skorları ve tur sayısını sıfırla
        room["current_round"] = 0
        for pid in room["players"]:
            room["players"][pid]["score"] = 0
        await start_meme_round(room, safe_send, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # DURUM YENİLE (rastgele başka bir durum çek) 🔄
    # ==========================================
    if msg_type == "meme_shuffle_durum":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "meme_arena":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "selecting":
            await safe_send(websocket, {"type": "error", "message": "Şu an durum değiştiremezsin."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if player_id in room.get("player_selections", {}):
            await safe_send(websocket, {"type": "error", "message": "Kartını seçtiğin için durumu değiştiremezsin!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        eski_durum = room["player_durum"].get(player_id, "")
        kullanilmayan = [d for d in DURUMLAR if d not in room.get("used_durumlar", []) and d != eski_durum]
        
        if not kullanilmayan:
            room["used_durumlar"] = [eski_durum] if eski_durum else []
            kullanilmayan = [d for d in DURUMLAR if d != eski_durum]
        
        if not kullanilmayan:
            await safe_send(websocket, {"type": "error", "message": "Başka durum bulunamadı."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        yeni_durum = random.choice(kullanilmayan)
        room["player_durum"][player_id] = yeni_durum
        room["used_durumlar"].append(yeni_durum)
        
        await safe_send(websocket, {
            "type": "meme_my_durum_changed",
            "new_durum": yeni_durum
        })
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # KENDİ DURUMUNU YAZ ✏️
    # ==========================================
    if msg_type == "meme_write_durum":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "meme_arena":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "selecting":
            await safe_send(websocket, {"type": "error", "message": "Şu an durum değiştiremezsin."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if player_id in room.get("player_selections", {}):
            await safe_send(websocket, {"type": "error", "message": "Kartını seçtiğin için durumu değiştiremezsin!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Metni temizle
        custom_durum = (data.get("durum") or "").strip()
        
        # Basit temizleme
        import re
        custom_durum = re.sub(r'<[^>]*>', '', custom_durum)  # HTML tag
        custom_durum = re.sub(r'[\x00-\x1f\x7f]', '', custom_durum)  # kontrol karakterleri
        custom_durum = custom_durum[:150]  # max 150 karakter
        
        if len(custom_durum) < 3:
            await safe_send(websocket, {"type": "error", "message": "En az 3 karakter yaz!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room["player_durum"][player_id] = custom_durum
        
        await safe_send(websocket, {
            "type": "meme_my_durum_changed",
            "new_durum": custom_durum
        })
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # KART SEÇ
    # ==========================================
    if msg_type == "meme_select_card":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "meme_arena":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "selecting":
            print(f"[SELECT] Phase 'selecting' değil ({room.get('phase')}), yoksayılıyor")
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        card_index = data.get("card_index")
        if not isinstance(card_index, int):
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Oyuncunun kartlarını al
        my_cards = room["player_cards"].get(player_id, [])
        if card_index < 0 or card_index >= len(my_cards):
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Seçimi kaydet
        room["player_selections"][player_id] = card_index
        
        selected_count = len(room["player_selections"])
        total_players = len(room["players"])
        
        print(f"[SELECT] Oyuncu {player_id} kart seçti. Toplam: {selected_count}/{total_players}")
        print(f"[SELECT] player_selections: {dict(room['player_selections'])}")
        
        # Herkese bildir
        await broadcast(room, {
            "type": "meme_player_selected",
            "player_id": player_id,
            "player_name": room["players"][player_id]["name"],
            "selected_count": selected_count,
            "total_players": total_players
        })
        
        # Herkes seçti mi kontrol et
        if selected_count >= total_players:
            print(f"[SELECT] Herkes seçti! start_voting_phase çağrılıyor")
            # ✨ selection_timer'ı iptal et (çift çağrı olmasın)
            sel_task = room.get("meme_task")
            if sel_task and not sel_task.done():
                sel_task.cancel()
                print("[SELECT] selection_timer iptal edildi")
            room["meme_task"] = None
            
            # Phase'i hemen değiştir ki timer da AFK saymasın
            room["phase"] = "voting"
            
            await asyncio.sleep(0.5)
            await start_voting_phase(room, safe_send, broadcast)
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # SEÇİMİ İPTAL ET
    # ==========================================
    if msg_type == "meme_cancel_selection":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "meme_arena":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "selecting":
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        if player_id in room["player_selections"]:
            del room["player_selections"][player_id]
        
        await broadcast(room, {
            "type": "meme_player_unselected",
            "player_id": player_id,
            "player_name": room["players"][player_id]["name"],
            "selected_count": len(room["player_selections"]),
            "total_players": len(room["players"])
        })
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # OY VER
    # ==========================================
    if msg_type == "meme_vote":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "meme_arena":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "voting":
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        vote_value = data.get("vote")
        if vote_value not in [-1, 1, 2]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Şu anki oylanan oyuncu
        voting_index = room.get("voting_index", 0)
        voting_order = room.get("voting_order", [])
        if voting_index >= len(voting_order):
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        current_pid = voting_order[voting_index]
        
        # Kart sahibi kendine oy veremez
        if player_id == current_pid:
            await safe_send(websocket, {"type": "error", "message": "Kendi kartına oy veremezsin!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Oy zaten verildiyse
        if "current_votes" not in room:
            room["current_votes"] = {}
        
        if player_id in room["current_votes"]:
            await safe_send(websocket, {"type": "error", "message": "Zaten oy verdin!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room["current_votes"][player_id] = vote_value
        
        # Kaç kişi oy verdi?
        total_voters = len(room["players"]) - 1  # kart sahibi hariç
        voted_count = len(room["current_votes"])
        
        # Herkese bildir
        await broadcast(room, {
            "type": "meme_vote_progress",
            "voted_count": voted_count,
            "total_voters": total_voters,
            "voter_id": player_id,
            "voter_name": room["players"][player_id]["name"]
        })
        
        # Herkes oy verdiyse hemen bir sonrakine geç
        if voted_count >= total_voters:
            await finalize_current_voting(room, safe_send, broadcast)
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # KART DEĞİŞTİR (JOKER) - Aynı kart gelmesin!
    # ==========================================
    if msg_type == "meme_shuffle_cards":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "meme_arena":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if room.get("phase") != "selecting":
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        jokers = room["player_jokers"].get(player_id, 0)
        if jokers <= 0:
            await safe_send(websocket, {"type": "error", "message": "Joker hakkın kalmadı!"})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Joker kullanıldı
        room["player_jokers"][player_id] = jokers - 1
        
        # Hafızalı sistem: hem mevcut kartları hem de görülen tüm kartları hariç tut
        eski_kartlar = set(room["player_cards"].get(player_id, []))
        
        if "player_seen_cards" not in room:
            room["player_seen_cards"] = {}
        if player_id not in room["player_seen_cards"]:
            room["player_seen_cards"][player_id] = set()
        
        # Görülen kartlar + mevcut eldeki kartlar
        yasakli = set(room["player_seen_cards"][player_id]) | eski_kartlar
        
        new_cards, updated_seen = dagit_karisim_hafizali(yasakli, 5)
        
        # Yasaklıya sadece yeni gelenleri ekle (eski görülenler zaten seen'de)
        room["player_seen_cards"][player_id] = set(room["player_seen_cards"][player_id]) | set(new_cards)
        
        print(f"[MEME SHUFFLE] Eski: {len(eski_kartlar)}, Yeni kartlar: {new_cards}")
        
        room["player_cards"][player_id] = new_cards
        
        # Seçimi de sıfırla (varsa)
        if player_id in room["player_selections"]:
            del room["player_selections"][player_id]
        
        await safe_send(websocket, {
            "type": "meme_new_cards",
            "cards": new_cards,
            "jokers_left": room["player_jokers"][player_id]
        })
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # BACK TO LOBBY
    # ==========================================
    if msg_type == "meme_back_to_lobby":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "meme_arena":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id != 1:
            await safe_send(websocket, {"type": "error", "message": "Sadece host lobiye döndürebilir."})
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Task iptal et
        old_task = room.get("meme_task")
        if old_task and not old_task.done():
            old_task.cancel()
        room["meme_task"] = None
        
        # Phase lobiye çevir + skorları sıfırla
        room["phase"] = "lobby"
        room["current_round"] = 0
        for pid in room["players"]:
            room["players"][pid]["score"] = 0
        
        await broadcast(room, {"type": "meme_back_to_lobby"})
        await send_meme_lobby_update(room, broadcast)
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    # ==========================================
    # 💬 CHAT MESAJI GÖNDER
    # ==========================================
    if msg_type == "meme_chat_send":
        if room_code not in rooms:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        room = rooms[room_code]
        if room.get("mode") != "meme_arena":
            return {"handled": False, "room_code": room_code, "player_id": player_id}
        
        if player_id not in room["players"]:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        import time as _time
        text = (data.get("text") or "").strip()[:100]
        if not text:
            return {"handled": True, "room_code": room_code, "player_id": player_id}
        
        # Spam kontrolü (saniyede max 3 mesaj)
        now = _time.time()
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
            "type": "meme_chat_msg",
            "sender_id": player_id,
            "sender_name": sender_name,
            "text": text,
            "ts": now
        })
        
        return {"handled": True, "room_code": room_code, "player_id": player_id}
    
    return {"handled": False, "room_code": room_code, "player_id": player_id}


# ==========================================
# TUR BAŞLAT (YARDIMCI)
# ==========================================

async def start_meme_round(room, safe_send, broadcast):
    """Yeni bir tur başlatır - her oyuncuya farklı durum!"""
    print(f"[START_ROUND] Yeni tur başlıyor. Mevcut round: {room.get('current_round', 0)}")
    room["phase"] = "selecting"
    room["current_round"] = room.get("current_round", 0) + 1
    
    # Her oyuncuya kendi durumu, kartı, jokeri
    room["player_cards"] = {}
    room["player_selections"] = {}
    room["player_jokers"] = {}
    room["player_durum"] = {}
    
    # ✨ Voting state'i temizle (yeni tur için)
    room["voting_order"] = []
    room["voting_index"] = 0
    room["round_votes"] = {}
    room["current_votes"] = {}
    room["afk_players"] = []
    
    # Kullanılan durumlar (havuzu koruyalım)
    if "used_durumlar" not in room:
        room["used_durumlar"] = []
    
    # Oyuncu bazlı görülen kart havuzunu hazırla
    if "player_seen_cards" not in room:
        room["player_seen_cards"] = {}
    
    for pid in room["players"].keys():
        # Her oyuncuya farklı bir durum ata
        kullanilmayan = [d for d in DURUMLAR if d not in room["used_durumlar"]]
        if not kullanilmayan:
            # Havuz bitti, sıfırla
            room["used_durumlar"] = []
            kullanilmayan = list(DURUMLAR)
        
        durum = random.choice(kullanilmayan)
        room["used_durumlar"].append(durum)
        room["player_durum"][pid] = durum
        
        # Bu oyuncunun daha önce gördüğü kartlar
        if pid not in room["player_seen_cards"]:
            room["player_seen_cards"][pid] = set()
        seen = room["player_seen_cards"][pid]
        
        # Kartları hafızalı dağıt
        cards, updated_seen = dagit_karisim_hafizali(seen, 5)
        room["player_seen_cards"][pid] = updated_seen
        room["player_cards"][pid] = cards
        room["player_jokers"][pid] = 3
    
    # Herkese kendi durumunu ve kartlarını gönder
    for pid, pdata in room["players"].items():
        await safe_send(pdata["ws"], {
            "type": "meme_round_start",
            "round_no": room["current_round"],
            "total_rounds": room["total_rounds"],
            "durum": room["player_durum"][pid],  # ✨ KENDİ DURUMU
            "my_cards": room["player_cards"][pid],
            "jokers_left": room["player_jokers"][pid],
            "turn_seconds": room["turn_seconds"],
            "total_players": len(room["players"])
        })
    
    # Timer başlat
    if room.get("meme_task"):
        try:
            room["meme_task"].cancel()
        except:
            pass
    
    room["meme_task"] = asyncio.create_task(
        selection_timer(room, safe_send, broadcast)
    )


async def selection_timer(room, safe_send, broadcast):
    """Kart seçim süresi bitince: seçmeyene -3 ceza, sonra oy verme fazına geç"""
    try:
        await asyncio.sleep(room["turn_seconds"])
        
        if room.get("phase") != "selecting":
            print(f"[SELECTION TIMER] Phase 'selecting' değil, çıkılıyor: {room.get('phase')}")
            return
        
        # ✨ Kart seçmeyenleri işaretle (ceza için)
        room["afk_players"] = []
        for pid in room["players"].keys():
            if pid not in room["player_selections"]:
                room["afk_players"].append(pid)
        
        # AFK olanları herkese bildir
        if room["afk_players"]:
            afk_names = [room["players"][pid]["name"] for pid in room["afk_players"]]
            await broadcast(room, {
                "type": "meme_afk_penalty",
                "afk_names": afk_names,
                "penalty": -3
            })
        
        # ✨ meme_task'i temizle ki start_voting_phase yeni task oluşturabilsin
        room["meme_task"] = None
        
        print("[SELECTION TIMER] start_voting_phase çağrılıyor...")
        await start_voting_phase(room, safe_send, broadcast)
    except asyncio.CancelledError:
        print("[SELECTION TIMER] İptal edildi")
    except Exception as e:
        print(f"[MEME SELECTION TIMER HATA] {e}")
        import traceback
        traceback.print_exc()


async def start_voting_phase(room, safe_send, broadcast):
    """Oy verme fazına geç - AFK olanlar atlanır, ceza alır"""
    print(f"[START_VOTING] Başladı. Şu anki selections: {dict(room.get('player_selections', {}))}")
    
    # ✨ Zaten voting fazına geçildiyse tekrar çalıştırma
    if room.get("voting_order") is not None and len(room.get("voting_order", [])) > 0:
        print("[START_VOTING] Zaten voting başladı, atlanıyor")
        return
    
    room["phase"] = "voting"
    room["meme_task"] = None
    
    # ✨ AFK olanlara -3 ceza uygula (oy verme fazına dahil değiller)
    afk_players = room.get("afk_players", [])
    for pid in afk_players:
        room["players"][pid]["score"] = room["players"][pid].get("score", 0) - 3
    
    # ✨ Sadece kart SEÇENLER oy verme sırasına dahil
    voter_ids = [pid for pid in room["players"].keys() if pid not in afk_players]
    random.shuffle(voter_ids)
    room["voting_order"] = voter_ids
    room["voting_index"] = 0
    room["round_votes"] = {}
    
    # Tüm oyunculara başlangıç skoru sıfırla (round_votes için)
    for pid in room["players"].keys():
        # AFK olanların "round_score"u -3 olarak kaydedilsin
        if pid in afk_players:
            room["round_votes"][pid] = {"score": -3, "votes": {}, "afk": True}
        else:
            room["round_votes"][pid] = {"score": 0, "votes": {}, "afk": False}
    
    # Kart seçen yoksa direkt skor tablosu (BUG FIX)
    if not voter_ids:
        print(f"[MEME] Kimse kart seçmedi! AFK: {afk_players}")
        print(f"[MEME] Broadcast: meme_all_afk gönderiliyor...")
        try:
            await broadcast(room, {
                "type": "meme_all_afk",
                "message": "Kimse kart seçmedi! Puan tablosuna geçiliyor..."
            })
            print("[MEME] meme_all_afk broadcast tamamlandı, 3sn bekleniyor...")
        except Exception as e:
            print(f"[MEME HATA - broadcast all_afk]: {e}")
        
        # asyncio.sleep'i ayrı try içinde koy
        try:
            await asyncio.sleep(3)
            print("[MEME] 3sn geçti, show_round_scoreboard çağrılıyor...")
        except asyncio.CancelledError:
            print("[MEME] AFK sleep iptal edildi!")
            return
        except Exception as e:
            print(f"[MEME HATA - sleep 3sn]: {e}")
            return
        
        try:
            await show_round_scoreboard(room, safe_send, broadcast)
            print("[MEME] show_round_scoreboard tamamlandı!")
        except Exception as e:
            print(f"[MEME HATA - show_round_scoreboard çağrısı]: {e}")
            import traceback
            traceback.print_exc()
        return
    
    # İlk oyuncuyu göster
    await show_next_voting_card(room, safe_send, broadcast)


async def show_next_voting_card(room, safe_send, broadcast):
    """Sıradaki oyuncunun kartını göster (kart + o kişinin durumu birlikte)"""
    voting_index = room["voting_index"]
    voting_order = room["voting_order"]
    
    if voting_index >= len(voting_order):
        await show_round_scoreboard(room, safe_send, broadcast)
        return
    
    current_pid = voting_order[voting_index]
    
    card_index = room["player_selections"].get(current_pid, 0)
    my_cards = room["player_cards"].get(current_pid, [])
    if not my_cards:
        room["voting_index"] += 1
        await show_next_voting_card(room, safe_send, broadcast)
        return
    
    selected_card = my_cards[card_index] if card_index < len(my_cards) else my_cards[0]
    
    # ✨ O oyuncunun KENDİ durumunu al (player_durum sözlüğünden)
    if "player_durum" not in room:
        room["player_durum"] = {}
    owner_durum = room["player_durum"].get(current_pid, "?")
    
    # DEBUG LOG
    print(f"[MEME VOTING] Sıra: Oyuncu {current_pid} ({room['players'][current_pid]['name']})")
    print(f"[MEME VOTING] Onun durumu: {owner_durum}")
    print(f"[MEME VOTING] Tüm durumlar: {room['player_durum']}")
    
    room["current_votes"] = {}
    
    for pid, pdata in room["players"].items():
        is_owner = (pid == current_pid)
        await safe_send(pdata["ws"], {
            "type": "meme_voting_card",
            "durum": owner_durum,  # ✨ Kart sahibinin durumu (HERKESE AYNI!)
            "card_file": selected_card,
            "card_owner_id": current_pid,
            "card_owner_name": room["players"][current_pid]["name"],
            "is_my_card": is_owner,
            "vote_seconds": room["vote_seconds"],
            "current_index": voting_index + 1,
            "total_players": len(voting_order)
        })
    
    if room.get("meme_task"):
        try:
            room["meme_task"].cancel()
        except:
            pass
    
    room["meme_task"] = asyncio.create_task(
        voting_timer(room, current_pid, safe_send, broadcast)
    )
    
    # Timer başlat
    if room.get("meme_task"):
        try:
            room["meme_task"].cancel()
        except:
            pass
    
    room["meme_task"] = asyncio.create_task(
        voting_timer(room, current_pid, safe_send, broadcast)
    )


async def voting_timer(room, expected_owner_id, safe_send, broadcast):
    """Oy verme süresi - bitince oy vermeyene otomatik +1 (Normal) ver"""
    try:
        await asyncio.sleep(room["vote_seconds"])
        
        if room.get("phase") != "voting":
            print(f"[MEME VOTING TIMER] Phase 'voting' değil: {room.get('phase')}")
            return
        
        # ✨ Oy vermeyenlere otomatik +1 (Normal) ver
        voting_index = room.get("voting_index", 0)
        voting_order = room.get("voting_order", [])
        if voting_index < len(voting_order):
            current_pid = voting_order[voting_index]
            
            if "current_votes" not in room:
                room["current_votes"] = {}
            
            # Kart sahibi hariç herkes için kontrol
            for pid in room["players"].keys():
                if pid == current_pid:
                    continue  # kart sahibi oy veremez
                if pid in room.get("afk_players", []):
                    continue  # AFK olan zaten oy vermez
                if pid not in room["current_votes"]:
                    room["current_votes"][pid] = 1
                    print(f"[MEME] Oyuncu {pid} oy vermedi, otomatik +1 verildi")
        
        print(f"[MEME VOTING TIMER] finalize_current_voting çağrılıyor...")
        await finalize_current_voting(room, safe_send, broadcast)
    except asyncio.CancelledError:
        print("[MEME VOTING TIMER] İptal edildi")
    except Exception as e:
        print(f"[MEME VOTING TIMER HATA] {e}")
        import traceback
        traceback.print_exc()


async def finalize_current_voting(room, safe_send, broadcast):
    """Şu anki karta gelen oyları puana ekle, sonraki karta geç"""
    voting_index = room["voting_index"]
    voting_order = room["voting_order"]
    
    print(f"[MEME FINALIZE] voting_index={voting_index}, voting_order={voting_order}")
    
    if voting_index >= len(voting_order):
        print("[MEME FINALIZE] Tüm oylar bitti, scoreboard'a geçiliyor")
        await show_round_scoreboard(room, safe_send, broadcast)
        return
    
    current_pid = voting_order[voting_index]
    
    # Şu anki oyları topla
    votes = room.get("current_votes", {})
    total_score = sum(votes.values())
    
    print(f"[MEME FINALIZE] Oyuncu {current_pid} → toplam puan: {total_score} (oylar: {votes})")
    
    room["round_votes"][current_pid]["score"] = total_score
    room["round_votes"][current_pid]["votes"] = dict(votes)
    
    # Oyuncunun toplam skoruna ekle
    room["players"][current_pid]["score"] = room["players"][current_pid].get("score", 0) + total_score
    
    # Sonraki oyuncuya geç
    room["voting_index"] += 1
    await asyncio.sleep(1)
    await show_next_voting_card(room, safe_send, broadcast)


async def show_round_scoreboard(room, safe_send, broadcast):
    """Tur bitti, skor tablosu göster - broadcast + yeni task başlat"""
    print(f"[MEME] show_round_scoreboard başladı, phase: {room.get('phase')}")
    
    try:
        room["phase"] = "scoreboard"
        
        # ✨ ESKI meme_task'i null'a çek (iptal etme, çünkü içindeyiz olabilir)
        room["meme_task"] = None
        
        # round_votes yoksa oluştur
        if "round_votes" not in room:
            room["round_votes"] = {}
        
        # Skorları hazırla (büyükten küçüğe)
        scores = []
        for pid, pdata in room["players"].items():
            rv = room["round_votes"].get(pid, {})
            scores.append({
                "player_id": pid,
                "player_name": pdata["name"],
                "score": pdata.get("score", 0),
                "round_score": rv.get("score", 0),
                "afk": rv.get("afk", False)
            })
        scores.sort(key=lambda x: x["score"], reverse=True)
        
        print(f"[MEME] Scoreboard broadcast ediliyor: {scores}")
        await broadcast(room, {
            "type": "meme_scoreboard",
            "scores": scores,
            "round_no": room["current_round"],
            "total_rounds": room["total_rounds"]
        })
        print("[MEME] Scoreboard broadcast tamamlandı, YENİ TASK başlatılıyor (5sn beklemek için)")
        
        # ✨ 5sn bekleme ve yeni tur başlatmayı AYRI bir task'te çalıştır
        # Böylece bu fonksiyon bitince mevcut task da biter, yeni task iptal olmaz
        room["meme_task"] = asyncio.create_task(
            _scoreboard_wait_and_next(room, safe_send, broadcast)
        )
    except Exception as e:
        print(f"[MEME HATA - show_round_scoreboard]: {e}")
        import traceback
        traceback.print_exc()


async def _scoreboard_wait_and_next(room, safe_send, broadcast):
    """Skor tablosu gösterildi, 5sn bekle, yeni tur veya oyun sonu"""
    try:
        print("[SCOREBOARD WAIT] 5sn bekleniyor...")
        await asyncio.sleep(5)
        
        print(f"[SCOREBOARD WAIT] 5sn geçti. current_round={room['current_round']}, total_rounds={room['total_rounds']}")
        
        if room["current_round"] >= room["total_rounds"]:
            print("[SCOREBOARD WAIT] Oyun bitti, end_meme_game çağrılıyor")
            await end_meme_game(room, safe_send, broadcast)
        else:
            print("[SCOREBOARD WAIT] Yeni tur başlatılıyor")
            await start_meme_round(room, safe_send, broadcast)
    except asyncio.CancelledError:
        print("[SCOREBOARD WAIT] İptal edildi!")
    except Exception as e:
        print(f"[SCOREBOARD WAIT HATA]: {e}")
        import traceback
        traceback.print_exc()


async def end_meme_game(room, safe_send, broadcast):
    """Oyun bitti, kazananı ilan et"""
    room["phase"] = "finished"
    
    scores = []
    for pid, pdata in room["players"].items():
        scores.append({
            "player_id": pid,
            "player_name": pdata["name"],
            "score": pdata.get("score", 0)
        })
    scores.sort(key=lambda x: x["score"], reverse=True)
    
    winner = scores[0] if scores else None
    
    await broadcast(room, {
        "type": "meme_game_over",
        "scores": scores,
        "winner_id": winner["player_id"] if winner else None,
        "winner_name": winner["player_name"] if winner else "?"
    })