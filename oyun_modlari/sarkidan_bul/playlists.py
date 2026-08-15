"""
DEEZER SANATÇI LİSTELERİ
"""

# ========================================
# TÜRKÇE SANATÇILAR - TÜRLERE GÖRE
# ========================================
TURKCE_POP = [
    "Tarkan", "Sezen Aksu", "Ajda Pekkan", "Nilüfer",
    "Sertab Erener", "Kenan Doğulu", "Mustafa Sandal", "Serdar Ortaç",
    "Hande Yener", "Gülşen", "Aleyna Tilki", "Hadise",
    "Demet Akalın", "Simge", "Ebru Gündeş", "Yıldız Tilbe",
    "Edis", "Murat Boz", "Emre Aydın", "İrem Derici",
    "Buray", "Zeynep Bastık", "Semicenk",
    "Yalın", "Melek Mosso", "Fettah Can", "Ozan Doğulu", "Berkay",
    "Mabel Matiz", "Manuş Baba", "Kalben", "Nazan Öncel",
    "Mahsun Kırmızıgül", "Ferhat Göçer", "Levent Yüksel"
]

TURKCE_RAP = [
    "Ceza", "Sagopa Kajmer", "Sansar Salvo", "Ezhel",
    "Ben Fero", "Killa Hakan", "Şehinşah", "Norm Ender",
    "Reynmen", "Uzi", "Heijan",
    "Contra", "Ados", "Massaka", "Anıl Piyancı"
]

TURKCE_ROCK = [
    "Duman", "MFÖ", "Cem Karaca", "Barış Manço",
    "Teoman", "Mor ve Ötesi", "Şebnem Ferah", "Hayko Cepkin",
    "Athena", "Manga", "Feridun Düzağaç", "Bulutsuzluk Özlemi",
    "Erkin Koray", "Adamlar", "Palmiyeler", "Redd", "Grup Yorum"
]

TURKCE_ARABESK = [
    "İbrahim Tatlıses", "Orhan Gencebay", "Ferdi Tayfur",
    "Müslüm Gürses", "Bülent Ersoy", "Zeki Müren",
    "Neşet Ertaş", "Selda Bağcan", "Ahmet Kaya",
    "Yaşar", "Aşık Veysel"
]

TURKCE_SANATCILAR = TURKCE_POP + TURKCE_RAP + TURKCE_ROCK + TURKCE_ARABESK

# ========================================
# YABANCI SANATÇILAR - TÜRLERE GÖRE
# ========================================
YABANCI_POP = [
    "Taylor Swift", "Ariana Grande", "Billie Eilish", "Dua Lipa",
    "The Weeknd", "Bruno Mars", "Ed Sheeran", "Adele",
    "Rihanna", "Beyoncé", "Justin Bieber", "Shawn Mendes",
    "Doja Cat", "Olivia Rodrigo", "Harry Styles",
    "Miley Cyrus", "Selena Gomez", "Katy Perry", "Lady Gaga",
    "Charlie Puth", "Sam Smith", "Camila Cabello",
    "Sabrina Carpenter", "Tate McRae", "Chappell Roan",
    "SZA", "Lana Del Rey", "Lizzo", "Benson Boone", "Noah Kahan"
]

YABANCI_RAP = [
    "Drake", "Kendrick Lamar", "Eminem", "Kanye West",
    "Travis Scott", "J. Cole", "Lil Wayne", "Nicki Minaj",
    "Cardi B", "Megan Thee Stallion", "21 Savage", "Future",
    "Central Cee", "Ice Spice", "Metro Boomin", "Playboi Carti",
    "Bad Bunny", "Karol G", "Rosalía", "Peso Pluma", "Feid",
    "Post Malone"
]

YABANCI_ROCK = [
    "Coldplay", "Imagine Dragons", "Maroon 5", "OneRepublic",
    "Twenty One Pilots", "The Killers", "Arctic Monkeys", "Muse",
    "Green Day", "Foo Fighters", "Linkin Park", "Nirvana",
    "Red Hot Chili Peppers", "Radiohead", "The Beatles", "Queen",
    "Pink Floyd", "AC/DC", "Metallica", "Guns N' Roses",
    "David Bowie", "Elton John", "Freddie Mercury"
]

YABANCI_ELECTRONIC = [
    "Calvin Harris", "David Guetta", "Marshmello", "Alan Walker",
    "Kygo", "Zedd", "Martin Garrix", "Tiësto",
    "Avicii", "Diplo", "Skrillex", "The Chainsmokers"
]

YABANCI_KLASIK = [
    "Michael Jackson", "Elvis Presley", "Frank Sinatra", "Bob Marley",
    "Stevie Wonder", "Whitney Houston", "Madonna", "Prince",
    "John Lennon", "Morgan Wallen", "Zach Bryan"
]

YABANCI_SANATCILAR = YABANCI_POP + YABANCI_RAP + YABANCI_ROCK + YABANCI_ELECTRONIC + YABANCI_KLASIK

# ========================================
# TÜR HARİTASI (dil → tür → sanatçılar)
# ========================================
TUR_BY_DIL = {
    "tr": {
        "pop": TURKCE_POP,
        "rap": TURKCE_RAP,
        "rock": TURKCE_ROCK,
        "arabesk": TURKCE_ARABESK,
    },
    "yabanci": {
        "pop": YABANCI_POP,
        "rap": YABANCI_RAP,
        "rock": YABANCI_ROCK,
        "electronic": YABANCI_ELECTRONIC,
        "klasikler": YABANCI_KLASIK,
    },
}

VALID_TURLER = ["pop", "rap", "rock", "arabesk", "electronic", "klasikler"]


def get_artists(dil: str, tur: str = None) -> list:
    """
    Dil + tür seçimine göre sanatçı listesi döner.
    """
    if not tur:
        if dil == "tr":
            return TURKCE_SANATCILAR
        elif dil == "yabanci":
            return YABANCI_SANATCILAR
        else:
            return TURKCE_SANATCILAR + YABANCI_SANATCILAR

    if dil == "karisik":
        result = []
        for lang in ["tr", "yabanci"]:
            if tur in TUR_BY_DIL.get(lang, {}):
                result += TUR_BY_DIL[lang][tur]
        return result if result else TURKCE_SANATCILAR + YABANCI_SANATCILAR

    if dil in TUR_BY_DIL and tur in TUR_BY_DIL[dil]:
        return TUR_BY_DIL[dil][tur]

    if dil == "tr":
        return TURKCE_SANATCILAR
    elif dil == "yabanci":
        return YABANCI_SANATCILAR
    return TURKCE_SANATCILAR + YABANCI_SANATCILAR
    
# ========================================
# ARTIST → TÜR YARDIMCISI
# ========================================
ARTIST_TO_TUR = {}

def _build_artist_tur_map():
    """Sanatçı → tür haritası oluştur (arama için hızlı)"""
    mapping = {
        "pop": TURKCE_POP + YABANCI_POP,
        "rap": TURKCE_RAP + YABANCI_RAP,
        "rock": TURKCE_ROCK + YABANCI_ROCK,
        "arabesk": TURKCE_ARABESK,
        "electronic": YABANCI_ELECTRONIC,
        "klasikler": YABANCI_KLASIK,
    }
    for tur, artists in mapping.items():
        for a in artists:
            ARTIST_TO_TUR[a.lower().strip()] = tur

_build_artist_tur_map()


def get_tur_of_artist(artist_name: str) -> str:
    """Sanatçının türünü döner. Bulamazsa 'karışık' döner."""
    if not artist_name:
        return "karisik"
    return ARTIST_TO_TUR.get(artist_name.lower().strip(), "karisik")    