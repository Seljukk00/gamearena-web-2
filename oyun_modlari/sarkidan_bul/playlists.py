"""
DEEZER SANATÇI LİSTELERİ - Tier Sistemi
=========================================

Her sanatçı için tier atanmıştır:
- efsane      → Herkes bilir (10+ yaş herkesi kapsar)
- cok_populer → Çoğunluk bilir
- populer     → Gençler ve müzik severler bilir
- bilinen     → Meraklısı bilir (zor mod için)
"""

# ========================================
# TÜRKÇE POP (150+ sanatçı)
# ========================================
TURKCE_POP = [
    # 🌟 EFSANE
    {"name": "Tarkan", "tier": "efsane"},
    {"name": "Sezen Aksu", "tier": "efsane"},
    {"name": "Ajda Pekkan", "tier": "efsane"},
    {"name": "Nilüfer", "tier": "efsane"},
    {"name": "Sertab Erener", "tier": "efsane"},
    {"name": "Ferdi Özbeğen", "tier": "efsane"},
    {"name": "Erol Evgin", "tier": "efsane"},
    {"name": "Nükhet Duru", "tier": "efsane"},
    {"name": "Emel Sayın", "tier": "efsane"},
    {"name": "Kayahan", "tier": "efsane"},
    {"name": "Zerrin Özer", "tier": "efsane"},
    {"name": "Ayşegül Aldinç", "tier": "efsane"},

    # ⭐ ÇOK POPÜLER
    {"name": "Kenan Doğulu", "tier": "cok_populer"},
    {"name": "Mustafa Sandal", "tier": "cok_populer"},
    {"name": "Serdar Ortaç", "tier": "cok_populer"},
    {"name": "Hande Yener", "tier": "cok_populer"},
    {"name": "Gülşen", "tier": "cok_populer"},
    {"name": "Ebru Gündeş", "tier": "cok_populer"},
    {"name": "Yıldız Tilbe", "tier": "cok_populer"},
    {"name": "Demet Akalın", "tier": "cok_populer"},
    {"name": "Hadise", "tier": "cok_populer"},
    {"name": "Aleyna Tilki", "tier": "cok_populer"},
    {"name": "Simge", "tier": "cok_populer"},
    {"name": "Reynmen", "tier": "cok_populer"},
    {"name": "Bengü", "tier": "cok_populer"},
    {"name": "Işın Karaca", "tier": "cok_populer"},
    {"name": "Ziynet Sali", "tier": "cok_populer"},
    {"name": "Petek Dinçöz", "tier": "cok_populer"},
    {"name": "Nalan", "tier": "cok_populer"},
    {"name": "Rafet El Roman", "tier": "cok_populer"},
    {"name": "Gülben Ergen", "tier": "cok_populer"},
    {"name": "Deniz Seki", "tier": "cok_populer"},
    {"name": "Fatih Erkoç", "tier": "cok_populer"},
    {"name": "Aşkın Nur Yengi", "tier": "cok_populer"},
    {"name": "Nil Karaibrahimgil", "tier": "cok_populer"},
    {"name": "Sinan Özen", "tier": "cok_populer"},
    {"name": "Tuğba Ekinci", "tier": "cok_populer"},
    {"name": "Mustafa Ceceli", "tier": "cok_populer"},

    # ✅ POPÜLER
    {"name": "Edis", "tier": "populer"},
    {"name": "Murat Boz", "tier": "populer"},
    {"name": "Emre Aydın", "tier": "populer"},
    {"name": "İrem Derici", "tier": "populer"},
    {"name": "Buray", "tier": "populer"},
    {"name": "Zeynep Bastık", "tier": "populer"},
    {"name": "Semicenk", "tier": "populer"},
    {"name": "Yalın", "tier": "populer"},
    {"name": "Melek Mosso", "tier": "populer"},
    {"name": "Fettah Can", "tier": "populer"},
    {"name": "Berkay", "tier": "populer"},
    {"name": "Manuş Baba", "tier": "populer"},
    {"name": "Mabel Matiz", "tier": "populer"},
    {"name": "Merve Özbey", "tier": "populer"},
    {"name": "Ece Seçkin", "tier": "populer"},
    {"name": "Ceylan Ertem", "tier": "populer"},
    {"name": "Sıla", "tier": "populer"},
    {"name": "Yıldız Usmonova", "tier": "populer"},
    {"name": "Volkan Konak", "tier": "populer"},
    {"name": "Bora Duran", "tier": "populer"},
    {"name": "Gökhan Türkmen", "tier": "populer"},
    {"name": "Gökhan Özen", "tier": "populer"},
    {"name": "Alişan", "tier": "populer"},
    {"name": "Aydilge", "tier": "populer"},
    {"name": "Aynur Aydın", "tier": "populer"},
    {"name": "Sinan Akçıl", "tier": "populer"},
    {"name": "Hakan Altun", "tier": "populer"},
    {"name": "Onur Şan", "tier": "populer"},
    {"name": "Doğuş", "tier": "populer"},
    {"name": "Kutsi", "tier": "populer"},
    {"name": "Feridun Düzağaç", "tier": "populer"},
    {"name": "Grup Vitamin", "tier": "populer"},
    {"name": "Grup Nazar", "tier": "populer"},
    {"name": "Ceylan Koynat", "tier": "populer"},
    {"name": "Hakan Peker", "tier": "populer"},
    {"name": "Yaşar İpek", "tier": "populer"},
    {"name": "Cengiz Kurtoğlu", "tier": "populer"},
    {"name": "Rojin", "tier": "populer"},
    {"name": "Tan Taşçı", "tier": "populer"},
    {"name": "Server Uraz", "tier": "populer"},
    {"name": "Ozan Orhon", "tier": "populer"},
    {"name": "Nükhet Ruacan", "tier": "populer"},
    {"name": "Perihan Savaş", "tier": "populer"},

    # 📼 BİLİNEN
    {"name": "Ozan Doğulu", "tier": "bilinen"},
    {"name": "Kalben", "tier": "bilinen"},
    {"name": "Nazan Öncel", "tier": "bilinen"},
    {"name": "Mahsun Kırmızıgül", "tier": "bilinen"},
    {"name": "Ferhat Göçer", "tier": "bilinen"},
    {"name": "Levent Yüksel", "tier": "bilinen"},
    {"name": "Yasemin Sakallıoğlu", "tier": "bilinen"},
    {"name": "Zeynep Casalini", "tier": "bilinen"},
    {"name": "Kubat", "tier": "bilinen"},
    {"name": "Halil Sezai", "tier": "bilinen"},
    {"name": "Cem Adrian", "tier": "bilinen"},
    {"name": "Enbe Orkestrası", "tier": "bilinen"},
    {"name": "Ferman Akgül", "tier": "bilinen"},
    {"name": "Ceza", "tier": "bilinen"},
    {"name": "Sami Yusuf", "tier": "bilinen"},
    {"name": "Yaşar", "tier": "bilinen"},
    {"name": "Ayten Alpman", "tier": "bilinen"},
    {"name": "Nesrin Sipahi", "tier": "bilinen"},
    {"name": "Sezen Cumhur Önal", "tier": "bilinen"},
    {"name": "Bora Öztoprak", "tier": "bilinen"},
    {"name": "Ahmet Selçuk İlkan", "tier": "bilinen"},
    {"name": "Coşkun Sabah", "tier": "bilinen"},
    {"name": "Sevcan Orhan", "tier": "bilinen"},
    {"name": "Umut Kaya", "tier": "bilinen"},
    {"name": "Beyaz Kelebekler", "tier": "bilinen"},
    {"name": "Nadide Sultan", "tier": "bilinen"},
    {"name": "Yakup Uslu", "tier": "bilinen"},
    {"name": "Hüseyin Turan", "tier": "bilinen"},
    {"name": "Aslı Hünel", "tier": "bilinen"},
    {"name": "Kutlu Payaslı", "tier": "bilinen"},
    {"name": "Emrah Karaduman", "tier": "bilinen"},
    {"name": "Yıldız Kaplan", "tier": "bilinen"},
    {"name": "Nihan Akın", "tier": "bilinen"},
    {"name": "Volkan Sönmez", "tier": "bilinen"},
    {"name": "Bertuğ Cemil", "tier": "bilinen"},
    {"name": "Cansever", "tier": "bilinen"},
    {"name": "Sefo", "tier": "bilinen"},
    {"name": "Ayten Rasul", "tier": "bilinen"},
    {"name": "Yusuf Güney", "tier": "bilinen"},
    {"name": "Uğur Aslan", "tier": "bilinen"},
    {"name": "Berdan Mardini", "tier": "bilinen"},
]

# ========================================
# TÜRKÇE RAP (80+ sanatçı)
# ========================================
TURKCE_RAP = [
    # 🌟 EFSANE
    {"name": "Ceza", "tier": "efsane"},
    {"name": "Sagopa Kajmer", "tier": "efsane"},
    {"name": "Killa Hakan", "tier": "efsane"},
    {"name": "Fuat", "tier": "efsane"},

    # ⭐ ÇOK POPÜLER
    {"name": "Ezhel", "tier": "cok_populer"},
    {"name": "Ben Fero", "tier": "cok_populer"},
    {"name": "Uzi", "tier": "cok_populer"},
    {"name": "Norm Ender", "tier": "cok_populer"},
    {"name": "Motive", "tier": "cok_populer"},
    {"name": "Batuflex", "tier": "cok_populer"},
    {"name": "Blok3", "tier": "cok_populer"},
    {"name": "Ashocean", "tier": "cok_populer"},
    {"name": "Gazapizm", "tier": "cok_populer"},
    {"name": "Şehinşah", "tier": "cok_populer"},

    # ✅ POPÜLER
    {"name": "Heijan", "tier": "populer"},
    {"name": "Sansar Salvo", "tier": "populer"},
    {"name": "Ayaz Kaplı", "tier": "populer"},
    {"name": "Perdah", "tier": "populer"},
    {"name": "Velet", "tier": "populer"},
    {"name": "Şanışer", "tier": "populer"},
    {"name": "Beta", "tier": "populer"},
    {"name": "Da Poet", "tier": "populer"},
    {"name": "Allâme", "tier": "populer"},
    {"name": "Aspova", "tier": "populer"},
    {"name": "Bandolizm", "tier": "populer"},
    {"name": "Silahsız Kuvvet", "tier": "populer"},
    {"name": "Sokrat St", "tier": "populer"},
    {"name": "Cash Flow", "tier": "populer"},
    {"name": "No.1", "tier": "populer"},
    {"name": "Karaçalı", "tier": "populer"},
    {"name": "HateM", "tier": "populer"},
    {"name": "Elçin Orçun", "tier": "populer"},
    {"name": "Alper Egri", "tier": "populer"},
    {"name": "Aga B", "tier": "populer"},
    {"name": "Zen-G", "tier": "populer"},
    {"name": "Grogi", "tier": "populer"},
    {"name": "Şam", "tier": "populer"},
    {"name": "Rota", "tier": "populer"},

    # 📼 BİLİNEN
    {"name": "Contra", "tier": "bilinen"},
    {"name": "Ados", "tier": "bilinen"},
    {"name": "Massaka", "tier": "bilinen"},
    {"name": "Anıl Piyancı", "tier": "bilinen"},
    {"name": "Patron", "tier": "bilinen"},
    {"name": "Fuat Ergin", "tier": "bilinen"},
    {"name": "Kayra", "tier": "bilinen"},
    {"name": "Tepki", "tier": "bilinen"},
    {"name": "Ahiyan", "tier": "bilinen"},
    {"name": "Fedon", "tier": "bilinen"},
    {"name": "Meli", "tier": "bilinen"},
    {"name": "Diyar Pala", "tier": "bilinen"},
    {"name": "Erci-E", "tier": "bilinen"},
    {"name": "Farazi", "tier": "bilinen"},
    {"name": "Ademkan", "tier": "bilinen"},
    {"name": "HeaVy", "tier": "bilinen"},
    {"name": "Cegıd", "tier": "bilinen"},
    {"name": "Anka", "tier": "bilinen"},
    {"name": "Killer", "tier": "bilinen"},
    {"name": "Fatih Onur", "tier": "bilinen"},
    {"name": "Milla", "tier": "bilinen"},
    {"name": "Prens Vestern", "tier": "bilinen"},
    {"name": "Nakala", "tier": "bilinen"},
    {"name": "Skoçvan", "tier": "bilinen"},
    {"name": "Şoray", "tier": "bilinen"},
    {"name": "Sami Sinan", "tier": "bilinen"},
    {"name": "Bruno", "tier": "bilinen"},
    {"name": "Bego", "tier": "bilinen"},
    {"name": "Ben Fero", "tier": "bilinen"},
    {"name": "Levo", "tier": "bilinen"},
    {"name": "Rota", "tier": "bilinen"},
    {"name": "Zeo Jaweed", "tier": "bilinen"},
    {"name": "Motive", "tier": "bilinen"},
]

# ========================================
# TÜRKÇE ROCK (60+ sanatçı)
# ========================================
TURKCE_ROCK = [
    # 🌟 EFSANE
    {"name": "Duman", "tier": "efsane"},
    {"name": "MFÖ", "tier": "efsane"},
    {"name": "Cem Karaca", "tier": "efsane"},
    {"name": "Barış Manço", "tier": "efsane"},
    {"name": "Erkin Koray", "tier": "efsane"},
    {"name": "Kargo", "tier": "efsane"},

    # ⭐ ÇOK POPÜLER
    {"name": "Teoman", "tier": "cok_populer"},
    {"name": "Mor ve Ötesi", "tier": "cok_populer"},
    {"name": "Şebnem Ferah", "tier": "cok_populer"},
    {"name": "Hayko Cepkin", "tier": "cok_populer"},
    {"name": "Athena", "tier": "cok_populer"},
    {"name": "Manga", "tier": "cok_populer"},
    {"name": "Yüksek Sadakat", "tier": "cok_populer"},
    {"name": "Pentagram", "tier": "cok_populer"},

    # ✅ POPÜLER
    {"name": "Feridun Düzağaç", "tier": "populer"},
    {"name": "Bulutsuzluk Özlemi", "tier": "populer"},
    {"name": "Gripin", "tier": "populer"},
    {"name": "Model", "tier": "populer"},
    {"name": "Kırmızı", "tier": "populer"},
    {"name": "Kolpa", "tier": "populer"},
    {"name": "Pinhani", "tier": "populer"},
    {"name": "Zakkum", "tier": "populer"},
    {"name": "Yeni Türkü", "tier": "populer"},
    {"name": "Ezginin Günlüğü", "tier": "populer"},
    {"name": "Kızılırmak", "tier": "populer"},
    {"name": "Aylin Aslım", "tier": "populer"},
    {"name": "Mezarkabul", "tier": "populer"},
    {"name": "Melis Sökmen", "tier": "populer"},
    {"name": "Ali Kocatepe", "tier": "populer"},

    # 📼 BİLİNEN
    {"name": "Adamlar", "tier": "bilinen"},
    {"name": "Palmiyeler", "tier": "bilinen"},
    {"name": "Redd", "tier": "bilinen"},
    {"name": "Grup Yorum", "tier": "bilinen"},
    {"name": "Kesmeşeker", "tier": "bilinen"},
    {"name": "Rashit", "tier": "bilinen"},
    {"name": "Vega", "tier": "bilinen"},
    {"name": "Nemrut", "tier": "bilinen"},
    {"name": "Direc-t", "tier": "bilinen"},
    {"name": "Kramp", "tier": "bilinen"},
    {"name": "Son Feci Bisiklet", "tier": "bilinen"},
    {"name": "İkiye On Kala", "tier": "bilinen"},
    {"name": "Fikret Kızılok", "tier": "bilinen"},
    {"name": "Zülfü Livaneli", "tier": "bilinen"},
    {"name": "Ali Rıza Binboğa", "tier": "bilinen"},
    {"name": "Aksu Coşkun", "tier": "bilinen"},
    {"name": "Şahsenem", "tier": "bilinen"},
    {"name": "Sadık Gürbüz", "tier": "bilinen"},
    {"name": "Grup Gündoğarken", "tier": "bilinen"},
    {"name": "Metin Özülkü", "tier": "bilinen"},
    {"name": "Neyzen Tevfik", "tier": "bilinen"},
    {"name": "Livaneli", "tier": "bilinen"},
    {"name": "Ozbi", "tier": "bilinen"},
    {"name": "Tuğçe Kandemir", "tier": "bilinen"},
    {"name": "Ayben", "tier": "bilinen"},
    {"name": "Emir Can İğrek", "tier": "bilinen"},
    {"name": "Poyraz Karayel", "tier": "bilinen"},
    {"name": "Deli", "tier": "bilinen"},
]

# ========================================
# TÜRKÇE ARABESK (60+ sanatçı)
# ========================================
TURKCE_ARABESK = [
    # 🌟 EFSANE
    {"name": "İbrahim Tatlıses", "tier": "efsane"},
    {"name": "Orhan Gencebay", "tier": "efsane"},
    {"name": "Ferdi Tayfur", "tier": "efsane"},
    {"name": "Müslüm Gürses", "tier": "efsane"},
    {"name": "Bülent Ersoy", "tier": "efsane"},
    {"name": "Zeki Müren", "tier": "efsane"},
    {"name": "Ahmet Kaya", "tier": "efsane"},
    {"name": "Neşet Ertaş", "tier": "efsane"},
    {"name": "Selda Bağcan", "tier": "efsane"},
    {"name": "Aşık Veysel", "tier": "efsane"},
    {"name": "Ferdi Özbeğen", "tier": "efsane"},

    # ⭐ ÇOK POPÜLER
    {"name": "Küçük Emrah", "tier": "cok_populer"},
    {"name": "Sibel Can", "tier": "cok_populer"},
    {"name": "Kibariye", "tier": "cok_populer"},
    {"name": "Cengiz Kurtoğlu", "tier": "cok_populer"},
    {"name": "Hakan Peker", "tier": "cok_populer"},
    {"name": "Ebru Yaşar", "tier": "cok_populer"},
    {"name": "Muazzez Abacı", "tier": "cok_populer"},
    {"name": "Hülya Avşar", "tier": "cok_populer"},
    {"name": "Ceylan", "tier": "cok_populer"},
    {"name": "Emrah", "tier": "cok_populer"},
    {"name": "Azer Bülbül", "tier": "cok_populer"},

    # ✅ POPÜLER
    {"name": "Yaşar", "tier": "populer"},
    {"name": "Latif Doğan", "tier": "populer"},
    {"name": "Hüseyin Kağıt", "tier": "populer"},
    {"name": "İzzet Yıldızhan", "tier": "populer"},
    {"name": "Muazzez Ersoy", "tier": "populer"},
    {"name": "Nalan", "tier": "populer"},
    {"name": "Ekin", "tier": "populer"},
    {"name": "Onur Akın", "tier": "populer"},
    {"name": "Hakan Taşıyan", "tier": "populer"},
    {"name": "Metin Şentürk", "tier": "populer"},
    {"name": "Selami Şahin", "tier": "populer"},
    {"name": "Cihan Yalçın", "tier": "populer"},
    {"name": "Yıldız Tilbe", "tier": "populer"},
    {"name": "Ankaralı Namık", "tier": "populer"},
    {"name": "Ankaralı Yasemin", "tier": "populer"},

    # 📼 BİLİNEN
    {"name": "Bergen", "tier": "bilinen"},
    {"name": "Eyüp Sultan", "tier": "bilinen"},
    {"name": "Uğur Aslan", "tier": "bilinen"},
    {"name": "Mahmut Tuncer", "tier": "bilinen"},
    {"name": "Uğur Işılak", "tier": "bilinen"},
    {"name": "Nuray Hafiftaş", "tier": "bilinen"},
    {"name": "Ferdi Özbek", "tier": "bilinen"},
    {"name": "Cengiz Coşkuner", "tier": "bilinen"},
    {"name": "Adnan Şenses", "tier": "bilinen"},
    {"name": "Erol Köse", "tier": "bilinen"},
    {"name": "Ferdi Aydın", "tier": "bilinen"},
    {"name": "Hakan Altınbaş", "tier": "bilinen"},
    {"name": "Şahin Kendirci", "tier": "bilinen"},
    {"name": "Salih Bademci", "tier": "bilinen"},
    {"name": "Ali Kınık", "tier": "bilinen"},
    {"name": "Erdem Kınay", "tier": "bilinen"},
]

# ========================================
# YABANCI POP
# ========================================
YABANCI_POP = [
    # 🌟 EFSANE
    {"name": "Michael Jackson", "tier": "efsane"},
    {"name": "Madonna", "tier": "efsane"},
    {"name": "Whitney Houston", "tier": "efsane"},
    {"name": "ABBA", "tier": "efsane"},
    {"name": "Céline Dion", "tier": "efsane"},
    {"name": "Cher", "tier": "efsane"},
    {"name": "Tina Turner", "tier": "efsane"},
    {"name": "George Michael", "tier": "efsane"},

    # ⭐ ÇOK POPÜLER
    {"name": "Taylor Swift", "tier": "cok_populer"},
    {"name": "Ariana Grande", "tier": "cok_populer"},
    {"name": "Ed Sheeran", "tier": "cok_populer"},
    {"name": "Adele", "tier": "cok_populer"},
    {"name": "Rihanna", "tier": "cok_populer"},
    {"name": "Beyoncé", "tier": "cok_populer"},
    {"name": "Justin Bieber", "tier": "cok_populer"},
    {"name": "The Weeknd", "tier": "cok_populer"},
    {"name": "Bruno Mars", "tier": "cok_populer"},
    {"name": "Katy Perry", "tier": "cok_populer"},
    {"name": "Lady Gaga", "tier": "cok_populer"},
    {"name": "Justin Timberlake", "tier": "cok_populer"},
    {"name": "Christina Aguilera", "tier": "cok_populer"},
    {"name": "Britney Spears", "tier": "cok_populer"},
    {"name": "Pink", "tier": "cok_populer"},
    {"name": "Shakira", "tier": "cok_populer"},
    {"name": "Enrique Iglesias", "tier": "cok_populer"},

    # ✅ POPÜLER
    {"name": "Billie Eilish", "tier": "populer"},
    {"name": "Dua Lipa", "tier": "populer"},
    {"name": "Shawn Mendes", "tier": "populer"},
    {"name": "Doja Cat", "tier": "populer"},
    {"name": "Olivia Rodrigo", "tier": "populer"},
    {"name": "Harry Styles", "tier": "populer"},
    {"name": "Sam Smith", "tier": "populer"},
    {"name": "Charlie Puth", "tier": "populer"},
    {"name": "Camila Cabello", "tier": "populer"},
    {"name": "Miley Cyrus", "tier": "populer"},
    {"name": "Selena Gomez", "tier": "populer"},
    {"name": "Kelly Clarkson", "tier": "populer"},
    {"name": "Alicia Keys", "tier": "populer"},
    {"name": "Mariah Carey", "tier": "populer"},
    {"name": "Usher", "tier": "populer"},
    {"name": "Halsey", "tier": "populer"},
    {"name": "Bebe Rexha", "tier": "populer"},
    {"name": "Anne-Marie", "tier": "populer"},
    {"name": "Rita Ora", "tier": "populer"},
    {"name": "Meghan Trainor", "tier": "populer"},
    {"name": "Zayn", "tier": "populer"},
    {"name": "One Direction", "tier": "populer"},
    {"name": "Sia", "tier": "populer"},

    # 📼 BİLİNEN
    {"name": "SZA", "tier": "bilinen"},
    {"name": "Lana Del Rey", "tier": "bilinen"},
    {"name": "Lizzo", "tier": "bilinen"},
    {"name": "Sabrina Carpenter", "tier": "bilinen"},
    {"name": "Tate McRae", "tier": "bilinen"},
    {"name": "Chappell Roan", "tier": "bilinen"},
    {"name": "Benson Boone", "tier": "bilinen"},
    {"name": "Noah Kahan", "tier": "bilinen"},
    {"name": "Zara Larsson", "tier": "bilinen"},
    {"name": "Niall Horan", "tier": "bilinen"},
    {"name": "Jorja Smith", "tier": "bilinen"},
    {"name": "Arlo Parks", "tier": "bilinen"},
    {"name": "PinkPantheress", "tier": "bilinen"},
    {"name": "Raye", "tier": "bilinen"},
    {"name": "Griff", "tier": "bilinen"},
    {"name": "FKA Twigs", "tier": "bilinen"},
    {"name": "Kylie Minogue", "tier": "bilinen"},
    {"name": "Nelly Furtado", "tier": "bilinen"},
    {"name": "Avril Lavigne", "tier": "bilinen"},
    {"name": "Backstreet Boys", "tier": "bilinen"},
    {"name": "NSYNC", "tier": "bilinen"},
    {"name": "Spice Girls", "tier": "bilinen"},
    {"name": "Jonas Brothers", "tier": "bilinen"},
    {"name": "Little Mix", "tier": "bilinen"},
    {"name": "Charli XCX", "tier": "bilinen"},
]

# ========================================
# YABANCI RAP
# ========================================
YABANCI_RAP = [
    # 🌟 EFSANE
    {"name": "Eminem", "tier": "efsane"},
    {"name": "2Pac", "tier": "efsane"},
    {"name": "The Notorious B.I.G.", "tier": "efsane"},
    {"name": "Snoop Dogg", "tier": "efsane"},
    {"name": "Dr. Dre", "tier": "efsane"},
    {"name": "Jay-Z", "tier": "efsane"},

    # ⭐ ÇOK POPÜLER
    {"name": "Drake", "tier": "cok_populer"},
    {"name": "Kendrick Lamar", "tier": "cok_populer"},
    {"name": "Kanye West", "tier": "cok_populer"},
    {"name": "Nicki Minaj", "tier": "cok_populer"},
    {"name": "Post Malone", "tier": "cok_populer"},
    {"name": "Travis Scott", "tier": "cok_populer"},
    {"name": "J. Cole", "tier": "cok_populer"},
    {"name": "Bad Bunny", "tier": "cok_populer"},
    {"name": "Cardi B", "tier": "cok_populer"},
    {"name": "50 Cent", "tier": "cok_populer"},
    {"name": "Wiz Khalifa", "tier": "cok_populer"},
    {"name": "Lil Wayne", "tier": "cok_populer"},
    {"name": "Ice Cube", "tier": "cok_populer"},

    # ✅ POPÜLER
    {"name": "21 Savage", "tier": "populer"},
    {"name": "Future", "tier": "populer"},
    {"name": "Karol G", "tier": "populer"},
    {"name": "Rosalía", "tier": "populer"},
    {"name": "Megan Thee Stallion", "tier": "populer"},
    {"name": "Metro Boomin", "tier": "populer"},
    {"name": "Tyler The Creator", "tier": "populer"},
    {"name": "A$AP Rocky", "tier": "populer"},
    {"name": "Lil Baby", "tier": "populer"},
    {"name": "Roddy Ricch", "tier": "populer"},
    {"name": "DaBaby", "tier": "populer"},
    {"name": "Lil Uzi Vert", "tier": "populer"},
    {"name": "Juice WRLD", "tier": "populer"},
    {"name": "XXXTENTACION", "tier": "populer"},
    {"name": "Migos", "tier": "populer"},

    # 📼 BİLİNEN
    {"name": "Central Cee", "tier": "bilinen"},
    {"name": "Ice Spice", "tier": "bilinen"},
    {"name": "Playboi Carti", "tier": "bilinen"},
    {"name": "Peso Pluma", "tier": "bilinen"},
    {"name": "Feid", "tier": "bilinen"},
    {"name": "Gunna", "tier": "bilinen"},
    {"name": "Ski Mask", "tier": "bilinen"},
    {"name": "YoungBoy Never Broke Again", "tier": "bilinen"},
    {"name": "Polo G", "tier": "bilinen"},
    {"name": "Denzel Curry", "tier": "bilinen"},
    {"name": "JID", "tier": "bilinen"},
    {"name": "Baby Keem", "tier": "bilinen"},
    {"name": "Doechii", "tier": "bilinen"},
    {"name": "Latto", "tier": "bilinen"},
    {"name": "Chief Keef", "tier": "bilinen"},
]

# ========================================
# YABANCI ROCK
# ========================================
YABANCI_ROCK = [
    # 🌟 EFSANE
    {"name": "The Beatles", "tier": "efsane"},
    {"name": "Queen", "tier": "efsane"},
    {"name": "Pink Floyd", "tier": "efsane"},
    {"name": "AC/DC", "tier": "efsane"},
    {"name": "Metallica", "tier": "efsane"},
    {"name": "Nirvana", "tier": "efsane"},
    {"name": "Guns N' Roses", "tier": "efsane"},
    {"name": "Led Zeppelin", "tier": "efsane"},
    {"name": "The Rolling Stones", "tier": "efsane"},
    {"name": "U2", "tier": "efsane"},
    {"name": "Bon Jovi", "tier": "efsane"},
    {"name": "Aerosmith", "tier": "efsane"},
    {"name": "David Bowie", "tier": "efsane"},
    {"name": "Elton John", "tier": "efsane"},
    {"name": "The Doors", "tier": "efsane"},

    # ⭐ ÇOK POPÜLER
    {"name": "Coldplay", "tier": "cok_populer"},
    {"name": "Imagine Dragons", "tier": "cok_populer"},
    {"name": "Maroon 5", "tier": "cok_populer"},
    {"name": "OneRepublic", "tier": "cok_populer"},
    {"name": "Twenty One Pilots", "tier": "cok_populer"},
    {"name": "Foo Fighters", "tier": "cok_populer"},
    {"name": "Linkin Park", "tier": "cok_populer"},
    {"name": "Green Day", "tier": "cok_populer"},
    {"name": "Red Hot Chili Peppers", "tier": "cok_populer"},
    {"name": "Bruce Springsteen", "tier": "cok_populer"},
    {"name": "Deep Purple", "tier": "cok_populer"},
    {"name": "Black Sabbath", "tier": "cok_populer"},
    {"name": "The Who", "tier": "cok_populer"},
    {"name": "Iron Maiden", "tier": "cok_populer"},

    # ✅ POPÜLER
    {"name": "The Killers", "tier": "populer"},
    {"name": "Arctic Monkeys", "tier": "populer"},
    {"name": "Muse", "tier": "populer"},
    {"name": "Radiohead", "tier": "populer"},
    {"name": "Panic! At The Disco", "tier": "populer"},
    {"name": "Fall Out Boy", "tier": "populer"},
    {"name": "My Chemical Romance", "tier": "populer"},
    {"name": "Paramore", "tier": "populer"},
    {"name": "System Of A Down", "tier": "populer"},
    {"name": "Mumford & Sons", "tier": "populer"},
    {"name": "Florence + The Machine", "tier": "populer"},
    {"name": "Oasis", "tier": "populer"},
    {"name": "The Smiths", "tier": "populer"},
    {"name": "The Cure", "tier": "populer"},
    {"name": "Depeche Mode", "tier": "populer"},
    {"name": "R.E.M.", "tier": "populer"},
    {"name": "Pearl Jam", "tier": "populer"},
    {"name": "Smashing Pumpkins", "tier": "populer"},

    # 📼 BİLİNEN
    {"name": "Arcade Fire", "tier": "bilinen"},
    {"name": "Vampire Weekend", "tier": "bilinen"},
    {"name": "The Strokes", "tier": "bilinen"},
    {"name": "Kings of Leon", "tier": "bilinen"},
    {"name": "The Neighbourhood", "tier": "bilinen"},
    {"name": "Cage The Elephant", "tier": "bilinen"},
    {"name": "Alt-J", "tier": "bilinen"},
    {"name": "Tame Impala", "tier": "bilinen"},
    {"name": "Glass Animals", "tier": "bilinen"},
    {"name": "MGMT", "tier": "bilinen"},
    {"name": "Two Door Cinema Club", "tier": "bilinen"},
    {"name": "Foster The People", "tier": "bilinen"},
    {"name": "Bon Iver", "tier": "bilinen"},
    {"name": "Soundgarden", "tier": "bilinen"},
    {"name": "Alice In Chains", "tier": "bilinen"},
    {"name": "Rage Against The Machine", "tier": "bilinen"},
    {"name": "Slipknot", "tier": "bilinen"},
    {"name": "Korn", "tier": "bilinen"},
    {"name": "Disturbed", "tier": "bilinen"},
    {"name": "Breaking Benjamin", "tier": "bilinen"},
    {"name": "Three Days Grace", "tier": "bilinen"},
    {"name": "Shinedown", "tier": "bilinen"},
]

# ========================================
# YABANCI ELECTRONIC
# ========================================
YABANCI_ELECTRONIC = [
    # 🌟 EFSANE
    {"name": "Daft Punk", "tier": "efsane"},
    {"name": "Avicii", "tier": "efsane"},
    {"name": "Calvin Harris", "tier": "efsane"},
    {"name": "David Guetta", "tier": "efsane"},

    # ⭐ ÇOK POPÜLER
    {"name": "Marshmello", "tier": "cok_populer"},
    {"name": "Alan Walker", "tier": "cok_populer"},
    {"name": "Martin Garrix", "tier": "cok_populer"},
    {"name": "Tiësto", "tier": "cok_populer"},
    {"name": "The Chainsmokers", "tier": "cok_populer"},
    {"name": "Deadmau5", "tier": "cok_populer"},
    {"name": "Armin van Buuren", "tier": "cok_populer"},

    # ✅ POPÜLER
    {"name": "Kygo", "tier": "populer"},
    {"name": "Zedd", "tier": "populer"},
    {"name": "Diplo", "tier": "populer"},
    {"name": "Skrillex", "tier": "populer"},
    {"name": "Steve Aoki", "tier": "populer"},
    {"name": "Hardwell", "tier": "populer"},
    {"name": "Afrojack", "tier": "populer"},
    {"name": "Timmy Trumpet", "tier": "populer"},
    {"name": "Prodigy", "tier": "populer"},
    {"name": "Chemical Brothers", "tier": "populer"},

    # 📼 BİLİNEN
    {"name": "ILLENIUM", "tier": "bilinen"},
    {"name": "Porter Robinson", "tier": "bilinen"},
    {"name": "Madeon", "tier": "bilinen"},
    {"name": "Odesza", "tier": "bilinen"},
    {"name": "Flume", "tier": "bilinen"},
    {"name": "Rüfüs Du Sol", "tier": "bilinen"},
    {"name": "Bonobo", "tier": "bilinen"},
    {"name": "Tycho", "tier": "bilinen"},
    {"name": "Above & Beyond", "tier": "bilinen"},
]

# ========================================
# YABANCI KLASİKLER
# ========================================
YABANCI_KLASIK = [
    # 🌟 EFSANE
    {"name": "Elvis Presley", "tier": "efsane"},
    {"name": "Frank Sinatra", "tier": "efsane"},
    {"name": "Bob Marley", "tier": "efsane"},
    {"name": "Stevie Wonder", "tier": "efsane"},
    {"name": "Prince", "tier": "efsane"},
    {"name": "John Lennon", "tier": "efsane"},
    {"name": "Aretha Franklin", "tier": "efsane"},
    {"name": "Ray Charles", "tier": "efsane"},
    {"name": "Marvin Gaye", "tier": "efsane"},
    {"name": "James Brown", "tier": "efsane"},

    # ⭐ ÇOK POPÜLER
    {"name": "Diana Ross", "tier": "cok_populer"},
    {"name": "Barbra Streisand", "tier": "cok_populer"},
    {"name": "Lionel Richie", "tier": "cok_populer"},
    {"name": "Simon & Garfunkel", "tier": "cok_populer"},
    {"name": "Cyndi Lauper", "tier": "cok_populer"},
    {"name": "Phil Collins", "tier": "cok_populer"},
    {"name": "Sting", "tier": "cok_populer"},
    {"name": "Rod Stewart", "tier": "cok_populer"},
    {"name": "Billy Joel", "tier": "cok_populer"},

    # ✅ POPÜLER
    {"name": "Tracy Chapman", "tier": "populer"},
    {"name": "Fleetwood Mac", "tier": "populer"},
    {"name": "Eagles", "tier": "populer"},

    # 📼 BİLİNEN
    {"name": "Morgan Wallen", "tier": "bilinen"},
    {"name": "Zach Bryan", "tier": "bilinen"},
    {"name": "Chuck Berry", "tier": "bilinen"},
    {"name": "Little Richard", "tier": "bilinen"},
]

# ========================================
# BİRLEŞTİRME
# ========================================
TURKCE_SANATCILAR = TURKCE_POP + TURKCE_RAP + TURKCE_ROCK + TURKCE_ARABESK
YABANCI_SANATCILAR = YABANCI_POP + YABANCI_RAP + YABANCI_ROCK + YABANCI_ELECTRONIC + YABANCI_KLASIK

# ========================================
# TÜR HARİTASI (dil → tür → sanatçı objeleri)
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
VALID_TIERS = ["efsane", "cok_populer", "populer", "bilinen"]


# ========================================
# FONKSİYONLAR
# ========================================

def get_artists(dil: str, tur: str = None) -> list:
    """
    Dil + tür seçimine göre sanatçı isim listesi döner.
    Geriye uyumluluk için sadece isim listesi döner (eski API).
    """
    artist_objs = get_artist_objects(dil, tur)
    return [a["name"] for a in artist_objs]


def get_artist_objects(dil: str, tur: str = None) -> list:
    """
    Dil + tür seçimine göre sanatçı OBJESİ (name + tier) listesi döner.
    """
    if not tur:
        if dil == "tr":
            return TURKCE_SANATCILAR
        elif dil == "yabanci":
            return YABANCI_SANATCILAR
        else:  # karisik
            return TURKCE_SANATCILAR + YABANCI_SANATCILAR

    if dil == "karisik":
        result = []
        for lang in ["tr", "yabanci"]:
            if tur in TUR_BY_DIL.get(lang, {}):
                result += TUR_BY_DIL[lang][tur]
        return result if result else (TURKCE_SANATCILAR + YABANCI_SANATCILAR)

    if dil in TUR_BY_DIL and tur in TUR_BY_DIL[dil]:
        return TUR_BY_DIL[dil][tur]

    # Fallback
    if dil == "tr":
        return TURKCE_SANATCILAR
    elif dil == "yabanci":
        return YABANCI_SANATCILAR
    return TURKCE_SANATCILAR + YABANCI_SANATCILAR


def get_artists_by_tier(dil: str, tur: str = None, tiers: list = None) -> list:
    """
    Belirli tier'daki sanatçıları döner (isim listesi).
    
    Args:
        dil: "tr", "yabanci", "karisik"
        tur: "pop", "rap", vs. veya None
        tiers: ["efsane", "cok_populer"] gibi tier listesi
    """
    all_artists = get_artist_objects(dil, tur)
    if not tiers:
        return [a["name"] for a in all_artists]
    return [a["name"] for a in all_artists if a.get("tier") in tiers]


# ========================================
# ARTIST → TÜR YARDIMCISI
# ========================================
ARTIST_TO_TUR = {}
ARTIST_TO_TIER = {}


def _build_maps():
    """Sanatçı → tür ve sanatçı → tier haritası oluştur"""
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
            name_key = a["name"].lower().strip()
            ARTIST_TO_TUR[name_key] = tur
            ARTIST_TO_TIER[name_key] = a.get("tier", "populer")


_build_maps()


def get_tur_of_artist(artist_name: str) -> str:
    """Sanatçının türünü döner. Bulamazsa 'karisik' döner."""
    if not artist_name:
        return "karisik"
    return ARTIST_TO_TUR.get(artist_name.lower().strip(), "karisik")


def get_tier_of_artist(artist_name: str) -> str:
    """Sanatçının tier'ını döner. Bulamazsa 'populer' döner."""
    if not artist_name:
        return "populer"
    return ARTIST_TO_TIER.get(artist_name.lower().strip(), "populer")


# ========================================
# İSTATİSTİK (debug için)
# ========================================
def print_stats():
    """Sanatçı sayısı istatistiklerini yazdır"""
    print("\n" + "=" * 50)
    print("📊 SANATÇI İSTATİSTİKLERİ")
    print("=" * 50)
    
    categories = [
        ("🇹🇷 TR Pop", TURKCE_POP),
        ("🎤 TR Rap", TURKCE_RAP),
        ("🎸 TR Rock", TURKCE_ROCK),
        ("🎻 TR Arabesk", TURKCE_ARABESK),
        ("🌍 Yabancı Pop", YABANCI_POP),
        ("🎤 Yabancı Rap", YABANCI_RAP),
        ("🎸 Yabancı Rock", YABANCI_ROCK),
        ("🎛️ Electronic", YABANCI_ELECTRONIC),
        ("👑 Klasik", YABANCI_KLASIK),
    ]
    
    total = 0
    for name, lst in categories:
        tier_counts = {"efsane": 0, "cok_populer": 0, "populer": 0, "bilinen": 0}
        for a in lst:
            tier_counts[a.get("tier", "populer")] += 1
        print(f"{name}: {len(lst)} sanatçı "
              f"(⭐{tier_counts['efsane']} 🔥{tier_counts['cok_populer']} "
              f"✅{tier_counts['populer']} 📼{tier_counts['bilinen']})")
        total += len(lst)
    
    print("=" * 50)
    print(f"🎵 TOPLAM: {total} sanatçı")
    print("=" * 50)


if __name__ == "__main__":
    print_stats()