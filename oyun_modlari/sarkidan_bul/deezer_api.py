"""
DEEZER API - Şarkı Çekme
Deezer'ın public API'sini kullanır (kimlik bilgisi gerektirmez)
"""

import requests
import time
from typing import List, Dict, Optional


DEEZER_BASE = "https://api.deezer.com"
REQUEST_TIMEOUT = 10  # saniye


# ========================================
# PLAYLIST BAZLI ARAMA (ESKİ)
# ========================================

def fetch_playlist_songs(playlist_id: int, limit: int = 100) -> List[Dict]:
    """
    Bir Deezer playlist'inden şarkıları çeker.
    Sadece preview_url'i olan şarkılar döner.
    """
    url = f"{DEEZER_BASE}/playlist/{playlist_id}"
    
    try:
        response = requests.get(url, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"[DEEZER] HATA: Playlist {playlist_id} çekilemedi: {e}")
        return []
    
    if "tracks" not in data:
        print(f"[DEEZER] HATA: Playlist {playlist_id} boş veya hatalı")
        return []
    
    songs = []
    tracks = data["tracks"].get("data", [])
    
    for track in tracks[:limit]:
        preview = track.get("preview")
        if not preview:
            continue
        
        songs.append({
            "id": track.get("id"),
            "title": track.get("title", "?"),
            "artist": track.get("artist", {}).get("name", "?"),
            "album": track.get("album", {}).get("title", "?"),
            "cover": track.get("album", {}).get("cover_medium", ""),
            "preview_url": preview,
            "duration": track.get("duration", 30)
        })
    
    print(f"[DEEZER] Playlist {playlist_id}: {len(songs)}/{len(tracks)} şarkı (preview var)")
    return songs


def fetch_multiple_playlists(playlist_ids: List[int], limit_per_playlist: int = 100) -> List[Dict]:
    """Birden fazla playlist'ten şarkı çeker."""
    all_songs = []
    seen_ids = set()
    
    for pid in playlist_ids:
        songs = fetch_playlist_songs(pid, limit_per_playlist)
        for song in songs:
            if song["id"] not in seen_ids:
                seen_ids.add(song["id"])
                all_songs.append(song)
        time.sleep(0.3)
    
    print(f"[DEEZER] Toplam benzersiz şarkı: {len(all_songs)}")
    return all_songs


# ========================================
# SANATÇI BAZLI ARAMA (YENİ SİSTEM)
# ========================================

def search_artist_top_tracks(artist_name: str, limit: int = 10) -> List[Dict]:
    """
    Bir sanatçının en popüler şarkılarını çeker.
    ÖNCE Deezer Artist API ile sanatçıyı bulur (doğru ID),
    SONRA o sanatçının top track'lerini çeker.
    Bu yöntem exact match sağlar.
    """
    # 1. ADIM: Sanatçı ID'sini bul
    search_url = f"{DEEZER_BASE}/search/artist"
    params = {
        "q": artist_name,
        "limit": 5
    }
    
    try:
        response = requests.get(search_url, params=params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"[DEEZER] HATA: '{artist_name}' aranamadı: {e}")
        return []
    
    artists = data.get("data", [])
    if not artists:
        return []
    
    # En popüler sanatçıyı seç (fan sayısı en fazla olan)
    artists.sort(key=lambda x: x.get("nb_fan", 0), reverse=True)
    
    # İsim tam eşleşiyor mu kontrol et (case-insensitive)
    target_name = artist_name.lower().strip()
    best_artist = None
    for a in artists:
        if a.get("name", "").lower().strip() == target_name:
            best_artist = a
            break
    
    # Tam eşleşme yoksa en popüler olanı al (ama fan sayısı yüksek olmalı)
    if not best_artist and artists:
        first = artists[0]
        # Fan sayısı 1000'den az ise güvenilir değil
        if first.get("nb_fan", 0) >= 1000:
            best_artist = first
    
    if not best_artist:
        return []
    
    artist_id = best_artist.get("id")
    actual_name = best_artist.get("name")
    
    # 2. ADIM: Sanatçının top track'lerini çek
    top_url = f"{DEEZER_BASE}/artist/{artist_id}/top"
    top_params = {"limit": limit}
    
    try:
        response = requests.get(top_url, params=top_params, timeout=REQUEST_TIMEOUT)
        response.raise_for_status()
        data = response.json()
    except Exception as e:
        print(f"[DEEZER] HATA: '{actual_name}' top tracks alınamadı: {e}")
        return []
    
    tracks = data.get("data", [])
    if not tracks:
        return []
    
    songs = []
    for track in tracks:
        preview = track.get("preview")
        if not preview:
            continue
        
        songs.append({
            "id": track.get("id"),
            "title": track.get("title", "?"),
            "artist": actual_name,  # Doğru sanatçı adı
            "album": track.get("album", {}).get("title", "?"),
            "cover": track.get("album", {}).get("cover_medium", ""),
            "preview_url": preview,
            "duration": track.get("duration", 30)
        })
    
    return songs


def fetch_songs_by_artists(artist_list, songs_per_artist: int = 6) -> List[Dict]:
    """
    Sanatçı listesinden şarkı havuzu oluşturur.
    
    artist_list şu formatlardan birinde olabilir:
    - ["Tarkan", "Sezen Aksu"]  → eski format (string listesi)
    - [{"name": "Tarkan", "tier": "efsane"}, ...]  → yeni format (dict listesi)
    
    songs_per_artist: Her sanatçıdan çekilecek şarkı sayısı (default 6)
    Aynı sanatçı tuzağı için minimum 5-6 şarkı gereklidir.
    """
    all_songs = []
    seen_ids = set()
    success_count = 0
    fail_count = 0
    failed_artists = []
    
    for artist_item in artist_list:
        # Hem string hem dict formatını destekle
        if isinstance(artist_item, dict):
            artist_name = artist_item.get("name", "")
            artist_tier = artist_item.get("tier", "populer")
        else:
            artist_name = str(artist_item)
            artist_tier = "populer"
        
        if not artist_name:
            continue
        
        songs = search_artist_top_tracks(artist_name, limit=songs_per_artist)
        if songs:
            success_count += 1
            for song in songs:
                if song["id"] not in seen_ids:
                    seen_ids.add(song["id"])
                    # ✨ Şarkıya tier bilgisini de ekle (sanatçısından geliyor)
                    song["tier"] = artist_tier
                    all_songs.append(song)
        else:
            fail_count += 1
            failed_artists.append(artist_name)
        
        time.sleep(0.15)
    
    print(f"[DEEZER] Sanatçı bazlı: {success_count} başarılı, {fail_count} başarısız")
    print(f"[DEEZER] Toplam benzersiz şarkı: {len(all_songs)}")
    if failed_artists:
        print(f"[DEEZER] ❌ Bulunamayan sanatçılar ({len(failed_artists)}):")
        for name in failed_artists[:20]:  # İlk 20 tanesini göster
            print(f"   - {name}")
        if len(failed_artists) > 20:
            print(f"   ... ve {len(failed_artists) - 20} tane daha")
    return all_songs


# ========================================
# TESTLER
# ========================================

def test_deezer():
    """Eski playlist testi"""
    print("🎵 Deezer Playlist Testi...\n")
    print("📀 Global Top 100 çekiliyor...")
    songs = fetch_playlist_songs(3155776842, limit=10)
    
    if songs:
        print(f"\n✅ {len(songs)} şarkı bulundu!\n")
        for i, song in enumerate(songs[:5], 1):
            print(f"  {i}. {song['artist']} - {song['title']}")
    else:
        print("❌ Şarkı bulunamadı!")


def test_artist_search():
    """Yeni sanatçı bazlı arama testi"""
    print("🎵 SANATÇI ARAMA TESTİ\n")
    
    print("=" * 50)
    print("🇹🇷 TÜRKÇE SANATÇI TESTİ")
    print("=" * 50)
    for artist in ["Tarkan", "Sezen Aksu", "Ceza", "Duman", "Gülşen"]:
        print(f"\n🔍 '{artist}' araniyor...")
        songs = search_artist_top_tracks(artist, limit=3)
        if songs:
            for s in songs:
                print(f"   ✅ {s['artist']} - {s['title']}")
        else:
            print(f"   ❌ Şarkı bulunamadı")
    
    print("\n" + "=" * 50)
    print("🌍 YABANCI SANATÇI TESTİ")
    print("=" * 50)
    for artist in ["Taylor Swift", "The Weeknd", "Drake", "Coldplay", "Eminem"]:
        print(f"\n🔍 '{artist}' araniyor...")
        songs = search_artist_top_tracks(artist, limit=3)
        if songs:
            for s in songs:
                print(f"   ✅ {s['artist']} - {s['title']}")
        else:
            print(f"   ❌ Şarkı bulunamadı")


if __name__ == "__main__":
    test_artist_search()