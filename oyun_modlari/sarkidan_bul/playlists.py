"""
DEEZER SANATÇI LİSTELERİ
Deezer Search API ile sanatçı bazlı şarkı çekme sistemi.
Playlist ID kullanmıyoruz çünkü Deezer'ın public playlist'leri sık değişiyor.
"""

# ========================================
# TÜRKÇE SANATÇILAR (100+ sanatçı)
# ========================================
TURKCE_SANATCILAR = [
    # Klasik Türkçe Pop
    "Tarkan", "Sezen Aksu", "Ajda Pekkan", "Nilüfer",
    "Sertab Erener", "Kenan Doğulu", "Mustafa Sandal", "Serdar Ortaç",
    "Hande Yener", "Gülşen", "Aleyna Tilki", "Hadise",
    "Demet Akalın", "Simge", "Ebru Gündeş", "Yıldız Tilbe",
    
    # Yeni Nesil Pop
    "Edis", "Murat Boz", "Emre Aydın", "İrem Derici",
    "Buray", "Zeynep Bastık", "Semicenk", "Aleyna Tilki",
    "Aynur Aydın", "Yalın", "Gülden", "Melek Mosso",
    
    # Rap / Hip-Hop
    "Ceza", "Sagopa Kajmer", "Sansar Salvo", "Ezhel",
    "Ben Fero", "Killa Hakan", "Şehinşah", "Norm Ender",
    "Reynmen", "Motive", "Uzi", "Heijan",
    "Contra", "Ados", "Massaka", "Anıl Piyancı",
    
    # Rock
    "Duman", "MFÖ", "Cem Karaca", "Barış Manço",
    "Teoman", "Mor ve Ötesi", "Şebnem Ferah", "Hayko Cepkin",
    "Athena", "Manga", "Feridun Düzağaç", "Bulutsuzluk Özlemi",
    
    # Arabesk / Halk
    "İbrahim Tatlıses", "Orhan Gencebay", "Ferdi Tayfur",
    "Müslüm Gürses", "Bülent Ersoy", "Zeki Müren",
    "Neşet Ertaş", "Aşık Veysel", "Selda Bağcan",
    
    # Türkü / Fantezi
    "Ahmet Kaya", "Yaşar", "Mahsun Kırmızıgül",
    "Ferhat Göçer", "Levent Yüksel", "Nazan Öncel",
    
    # Yeni Kuşak
    "Mabel Matiz", "Melis Danişmend", "Manuş Baba",
    "Erkin Koray", "Kalben", "Zeynep Casalini",
    "Fettah Can", "Ozan Doğulu", "Berkay",
    
    # İndie / Alternative
    "Kim Ki O", "Adamlar", "Palmiyeler", "Redd",
    "Athena", "Grup Yorum", "Jehan Barbur"
]

# ========================================
# YABANCI SANATÇILAR (100+ sanatçı)
# ========================================
YABANCI_SANATCILAR = [
    # Pop Yıldızları
    "Taylor Swift", "Ariana Grande", "Billie Eilish", "Dua Lipa",
    "The Weeknd", "Bruno Mars", "Ed Sheeran", "Adele",
    "Rihanna", "Beyoncé", "Justin Bieber", "Shawn Mendes",
    "Post Malone", "Doja Cat", "Olivia Rodrigo", "Harry Styles",
    "Miley Cyrus", "Selena Gomez", "Katy Perry", "Lady Gaga",
    "Charlie Puth", "Sam Smith", "Camila Cabello", "Halsey",
    "Sabrina Carpenter", "Tate McRae", "Chappell Roan",
    
    # Rap / Hip-Hop
    "Drake", "Kendrick Lamar", "Eminem", "Kanye West",
    "Travis Scott", "J. Cole", "Lil Wayne", "Nicki Minaj",
    "Cardi B", "Megan Thee Stallion", "21 Savage", "Future",
    "Central Cee", "Ice Spice", "Metro Boomin", "Playboi Carti",
    
    # Rock / Alternative
    "Coldplay", "Imagine Dragons", "Maroon 5", "OneRepublic",
    "Twenty One Pilots", "The Killers", "Arctic Monkeys", "Muse",
    "Green Day", "Foo Fighters", "Linkin Park", "Nirvana",
    "Red Hot Chili Peppers", "Radiohead", "The Beatles", "Queen",
    "Pink Floyd", "AC/DC", "Metallica", "Guns N' Roses",
    
    # Electronic / Dance
    "Calvin Harris", "David Guetta", "Marshmello", "Alan Walker",
    "Kygo", "Zedd", "Martin Garrix", "Tiësto",
    "Avicii", "Diplo", "Skrillex", "The Chainsmokers",
    
    # Klasik / Legendaries
    "Michael Jackson", "Elvis Presley", "Frank Sinatra", "Bob Marley",
    "Stevie Wonder", "Whitney Houston", "Madonna", "Prince",
    "David Bowie", "Elton John", "Freddie Mercury", "John Lennon",
    
    # 2020'ler Yeni Yıldızlar
    "SZA", "Lana Del Rey", "Lizzo", "Bad Bunny",
    "Karol G", "Rosalía", "Peso Pluma", "Feid",
    "Morgan Wallen", "Zach Bryan", "Noah Kahan", "Benson Boone"
]


# ========================================
# KATEGORİ SEÇİCİ
# ========================================

def get_artists(dil: str) -> list:
    """
    Dil seçimine göre sanatçı listesi döner.
    
    Args:
        dil: "tr" (Türkçe), "yabanci" (Yabancı), "karisik" (Karışık)
    
    Returns:
        Sanatçı isim listesi
    """
    if dil == "tr":
        return TURKCE_SANATCILAR
    elif dil == "yabanci":
        return YABANCI_SANATCILAR
    elif dil == "karisik":
        return TURKCE_SANATCILAR + YABANCI_SANATCILAR
    else:
        return TURKCE_SANATCILAR + YABANCI_SANATCILAR


# ========================================
# TEST
# ========================================

def test_artists():
    """Sanatçı listelerinin doğru olduğunu doğrula"""
    print("🎵 SANATÇI LİSTELERİ TESTİ\n")
    print(f"🇹🇷 Türkçe sanatçı sayısı: {len(TURKCE_SANATCILAR)}")
    print(f"🌍 Yabancı sanatçı sayısı: {len(YABANCI_SANATCILAR)}")
    print(f"🎭 Karışık toplam: {len(TURKCE_SANATCILAR) + len(YABANCI_SANATCILAR)}\n")
    
    print("İlk 10 Türkçe sanatçı:")
    for i, s in enumerate(TURKCE_SANATCILAR[:10], 1):
        print(f"  {i}. {s}")
    
    print("\nİlk 10 Yabancı sanatçı:")
    for i, s in enumerate(YABANCI_SANATCILAR[:10], 1):
        print(f"  {i}. {s}")


if __name__ == "__main__":
    test_artists()