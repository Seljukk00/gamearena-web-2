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


# ========================================
# TÜRKÇE / İNGİLİZCE ŞARKI ALGILAMA
# ========================================

# Türkçe'ye özgü karakterler
TURKISH_CHARS = set("çÇğĞıİöÖşŞüÜ")

# En yaygın İngilizce kelimeler (title'da bunlardan varsa İngilizce ihtimali yüksek)
ENGLISH_KEYWORDS = {
    "love", "you", "your", "yours", "the", "and", "for", "with",
    "my", "me", "i'm", "im", "we", "our", "us", "they", "them",
    "this", "that", "have", "has", "had", "will", "would", "can",
    "is", "are", "was", "were", "be", "been", "being",
    "night", "day", "time", "life", "world", "girl", "boy", "baby",
    "heart", "soul", "mind", "eyes", "hands", "feel", "feeling",
    "wanna", "gonna", "gotta", "let", "get", "got", "give", "take",
    "know", "knew", "think", "thought", "want", "need",
    "feat", "featuring", "remix", "version", "english",
    "forever", "always", "never", "because", "why", "how", "what",
    "when", "where", "who", "everything", "nothing", "something",
    "yesterday", "tomorrow", "today", "tonight", "morning",
    "beautiful", "amazing", "perfect", "wonderful", "crazy",
    "song", "music", "dance", "party", "sing", "dream", "dreams",
    "story", "way", "home", "friend", "friends", "family",
    "goodbye", "hello", "please", "sorry", "thank"
}

def _is_probably_english(title: str) -> bool:
    """
    Şarkı title'ı büyük ihtimalle İngilizce mi?
    - Türkçe karakter varsa → False (kesin Türkçe)
    - Yoksa İngilizce anahtar kelime kontrolü yapar
    """
    if not title:
        return False
    
    # Parantezli kısmı da dahil et (örn: "Sen (English Version)")
    title_lower = title.lower().strip()
    
    # 1) Türkçe karakter varsa Türkçedir
    if any(ch in TURKISH_CHARS for ch in title):
        return False
    
    # 2) Title'ı kelimelere ayır
    # Noktalama işaretlerini boşluğa çevir
    import re
    clean = re.sub(r"[^\w\s']", " ", title_lower)
    words = [w for w in clean.split() if w]
    
    if not words:
        return False
    
    # 3) İngilizce kelime var mı?
    english_word_count = sum(1 for w in words if w in ENGLISH_KEYWORDS)
    
    # ✨ 3+ kelimelik title'da 1 bile İngilizce kelime varsa şüpheli
    if len(words) >= 3 and english_word_count >= 1:
        return True
    
    # ✨ 2 kelimelik title'da 1 İngilizce kelime → şüpheli
    if len(words) == 2 and english_word_count >= 1:
        return True
    
    # ✨ Tek kelime ve İngilizce → şüpheli
    if len(words) == 1 and words[0] in ENGLISH_KEYWORDS:
        return True
    
    # ✨ "English", "English Version" gibi açık ipuçları
    if "english" in title_lower or "version" in title_lower:
        return True
    
    return False


# ========================================
# TÜRK SANATÇI İSİMLERİ (dil filtresi için)
# ========================================
# Bu sanatçıların şarkıları Türkçe olmalı - İngilizce şarkıları filtrele
_TURKISH_ARTIST_NAMES_CACHE = None

def _get_turkish_artist_names():
    """Türk sanatçı isimlerini set olarak döner (cache'li)"""
    global _TURKISH_ARTIST_NAMES_CACHE
    if _TURKISH_ARTIST_NAMES_CACHE is not None:
        return _TURKISH_ARTIST_NAMES_CACHE
    
    try:
        from .playlists import TURKCE_SANATCILAR
        names = set()
        for a in TURKCE_SANATCILAR:
            if isinstance(a, dict):
                names.add(a.get("name", "").lower().strip())
            else:
                names.add(str(a).lower().strip())
        _TURKISH_ARTIST_NAMES_CACHE = names
        return names
    except Exception as e:
        print(f"[DEEZER] Türkçe sanatçı listesi yüklenemedi: {e}")
        return set()


def _fetch_single_artist(artist_item, songs_per_artist, turkish_names):
    """
    Tek bir sanatçı için şarkı çeker.
    Thread-safe: paralel çalışabilir.
    Returns: (songs_list, artist_name, is_success, filtered_count)
    """
    if isinstance(artist_item, dict):
        artist_name = artist_item.get("name", "")
        artist_tier = artist_item.get("tier", "populer")
    else:
        artist_name = str(artist_item)
        artist_tier = "populer"
    
    if not artist_name:
        return ([], "", False, 0)
    
    is_turkish_artist = artist_name.lower().strip() in turkish_names
    fetch_count = songs_per_artist * 2 if is_turkish_artist else songs_per_artist
    
    songs = search_artist_top_tracks(artist_name, limit=fetch_count)
    
    if not songs:
        return ([], artist_name, False, 0)
    
    filtered_count = 0
    result_songs = []
    for song in songs:
        # Türk sanatçının İngilizce şarkısını atla
        if is_turkish_artist:
            title = song.get("title", "")
            if _is_probably_english(title):
                filtered_count += 1
                continue
        
        song["tier"] = artist_tier
        result_songs.append(song)
        
        if len(result_songs) >= songs_per_artist:
            break
    
    return (result_songs, artist_name, True, filtered_count)


def fetch_songs_by_artists(artist_list, songs_per_artist: int = 6) -> List[Dict]:
    """
    Sanatçı listesinden şarkı havuzu oluşturur - PARALEL VERSİYON.
    
    ✨ Her sanatçı için ayrı thread'de HTTP çağrısı yapar (~10x hızlı)
    ✨ Türk sanatçıların İngilizce şarkıları otomatik filtrelenir.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    all_songs = []
    seen_ids = set()
    success_count = 0
    fail_count = 0
    failed_artists = []
    turkish_names = _get_turkish_artist_names()
    filtered_english_count = 0
    
    start_time = time.time()
    
    # ✨ 10 paralel worker (Deezer'ı yormamak için makul bir sayı)
    max_workers = 10
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # Tüm sanatçıları paralel gönder
        future_to_artist = {
            executor.submit(_fetch_single_artist, artist_item, songs_per_artist, turkish_names): artist_item
            for artist_item in artist_list
        }
        
        # Sonuçları geldikçe topla
        for future in as_completed(future_to_artist):
            try:
                songs, artist_name, is_success, filtered = future.result(timeout=30)
                
                if is_success:
                    success_count += 1
                    filtered_english_count += filtered
                    
                    # Duplicate ID kontrolü (paralel olduğu için burada)
                    for song in songs:
                        if song["id"] not in seen_ids:
                            seen_ids.add(song["id"])
                            all_songs.append(song)
                else:
                    fail_count += 1
                    if artist_name:
                        failed_artists.append(artist_name)
            except Exception as e:
                fail_count += 1
                print(f"[DEEZER] Paralel çekim hatası: {e}")
    
    elapsed = time.time() - start_time
    
    print(f"[DEEZER] ⚡ Paralel çekim tamamlandı: {elapsed:.1f} saniye ({max_workers} worker)")
    print(f"[DEEZER] Sanatçı bazlı: {success_count} başarılı, {fail_count} başarısız")
    print(f"[DEEZER] Toplam benzersiz şarkı: {len(all_songs)}")
    if filtered_english_count > 0:
        print(f"[DEEZER] 🇹🇷 Filtrelenen İngilizce şarkı sayısı: {filtered_english_count}")
    if failed_artists:
        print(f"[DEEZER] ❌ Bulunamayan sanatçılar ({len(failed_artists)}):")
        for name in failed_artists[:20]:
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