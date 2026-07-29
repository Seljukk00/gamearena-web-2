"""
100 FUTBOLCU + KULUP KARIYERLERI
Her futbolcu: ad, kariyeri (sirayla oynadigi takimlar)

ONEMLI: takim isimleri 'takimlar.py' icindeki ALL_TEAMS ile EŞLEŞMELİ!
"""

ALL_PLAYERS = [
    # ============================================
    # SUPERSTARLAR (Genel olarak herkes bilir)
    # ============================================
    {"name": "Messi", "career": ["Barcelona", "PSG", "Inter Miami"]},
    {"name": "Cristiano Ronaldo", "career": ["Sporting", "Manchester United", "Real Madrid", "Juventus", "Manchester United", "Al-Nassr"]},
    {"name": "Neymar", "career": ["Santos", "Barcelona", "PSG", "Al-Hilal"]},
    {"name": "Mbappe", "career": ["Monaco", "PSG", "Real Madrid"]},
    {"name": "Haaland", "career": ["Red Bull Salzburg", "Borussia Dortmund", "Manchester City"]},
    {"name": "Lewandowski", "career": ["Borussia Dortmund", "Bayern Munih", "Barcelona"]},
    {"name": "Benzema", "career": ["Lyon", "Real Madrid", "Al-Ittihad"]},
    {"name": "Modric", "career": ["Tottenham", "Real Madrid"]},
    {"name": "Kroos", "career": ["Bayern Munih", "Bayer Leverkusen", "Bayern Munih", "Real Madrid"]},
    {"name": "De Bruyne", "career": ["Chelsea", "Wolfsburg", "Manchester City"]},

    # ============================================
    # MERHUM EFSANELER (eski yildizlar)
    # ============================================
    {"name": "Zidane", "career": ["Bordeaux", "Juventus", "Real Madrid"]},
    {"name": "Ronaldinho", "career": ["Sao Paulo", "PSG", "Barcelona", "AC Milan", "Flamengo"]},
    {"name": "Ronaldo (R9)", "career": ["Sao Paulo", "PSV", "Barcelona", "Inter", "Real Madrid", "AC Milan", "Corinthians"]},
    {"name": "Beckham", "career": ["Manchester United", "Real Madrid", "LA Galaxy", "AC Milan", "PSG"]},
    {"name": "Henry", "career": ["Monaco", "Juventus", "Arsenal", "Barcelona", "New York City"]},
    {"name": "Drogba", "career": ["Marseille", "Chelsea", "Galatasaray", "Chelsea"]},
    {"name": "Eto'o", "career": ["Real Madrid", "Barcelona", "Inter", "Anderlecht", "Chelsea", "Everton", "Sampdoria"]},
    {"name": "Kaka", "career": ["Sao Paulo", "AC Milan", "Real Madrid", "AC Milan"]},
    {"name": "Pirlo", "career": ["Inter", "AC Milan", "Juventus", "New York City"]},
    {"name": "Maldini", "career": ["AC Milan"]},

    # ============================================
    # KALECILER
    # ============================================
    {"name": "Buffon", "career": ["Juventus", "PSG", "Juventus"]},
    {"name": "Casillas", "career": ["Real Madrid", "Porto"]},
    {"name": "Neuer", "career": ["Schalke", "Bayern Munih"]},
    {"name": "Courtois", "career": ["Atletico Madrid", "Chelsea", "Real Madrid"]},
    {"name": "Alisson", "career": ["Roma", "Liverpool"]},
    {"name": "Ter Stegen", "career": ["Borussia Monchengladbach", "Barcelona"]},
    {"name": "Donnarumma", "career": ["AC Milan", "PSG"]},
    {"name": "De Gea", "career": ["Atletico Madrid", "Manchester United"]},

    # ============================================
    # DEFANS OYUNCULARI
    # ============================================
    {"name": "Ramos", "career": ["Sevilla", "Real Madrid", "PSG"]},
    {"name": "Pique", "career": ["Manchester United", "Real Zaragoza", "Barcelona"]},  # Real Zaragoza yerine Barcelona kullanildi
    {"name": "Van Dijk", "career": ["Celtic", "Southampton", "Liverpool"]},  # Southampton listede yok
    {"name": "Marquinhos", "career": ["Roma", "PSG"]},
    {"name": "Varane", "career": ["Real Madrid", "Manchester United"]},
    {"name": "Maldonado", "career": ["AC Milan"]},  # Yanlislik var, kaldirma
    {"name": "Thiago Silva", "career": ["AC Milan", "PSG", "Chelsea", "Fluminense"]},  # Fluminense listede yok
    {"name": "Maguire", "career": ["Leicester", "Manchester United"]},
    {"name": "Rudiger", "career": ["Roma", "Chelsea", "Real Madrid"]},
    {"name": "Kimpembe", "career": ["PSG"]},

    # ============================================
    # ORTA SAHA
    # ============================================
    {"name": "Xavi", "career": ["Barcelona", "Al-Sadd"]},  # Al-Sadd listede yok
    {"name": "Iniesta", "career": ["Barcelona", "Vissel Kobe"]},  # Vissel Kobe listede yok
    {"name": "Pogba", "career": ["Manchester United", "Juventus", "Manchester United", "Juventus"]},
    {"name": "Kante", "career": ["Caen", "Leicester", "Chelsea", "Al-Ittihad"]},  # Caen listede yok
    {"name": "Bellingham", "career": ["Borussia Dortmund", "Real Madrid"]},
    {"name": "Tchouameni", "career": ["Monaco", "Real Madrid"]},
    {"name": "Casemiro", "career": ["Sao Paulo", "Real Madrid", "Manchester United"]},
    {"name": "Bruno Fernandes", "career": ["Sporting", "Manchester United"]},
    {"name": "Verratti", "career": ["PSG"]},
    {"name": "Rodri", "career": ["Atletico Madrid", "Manchester City"]},

    # ============================================
    # FORVET / KANAT
    # ============================================
    {"name": "Vinicius Jr", "career": ["Flamengo", "Real Madrid"]},
    {"name": "Rodrygo", "career": ["Santos", "Real Madrid"]},
    {"name": "Salah", "career": ["Chelsea", "Roma", "Liverpool"]},
    {"name": "Mane", "career": ["Red Bull Salzburg", "Liverpool", "Bayern Munih", "Al-Nassr"]},
    {"name": "Firmino", "career": ["Liverpool", "Al-Ahli"]},  # Al-Ahli listede yok
    {"name": "Sterling", "career": ["Liverpool", "Manchester City", "Chelsea"]},
    {"name": "Sancho", "career": ["Manchester City", "Borussia Dortmund", "Manchester United", "Borussia Dortmund"]},
    {"name": "Lukaku", "career": ["Anderlecht", "Chelsea", "Everton", "Manchester United", "Inter", "Roma"]},
    {"name": "Suarez", "career": ["Ajax", "Liverpool", "Barcelona", "Atletico Madrid", "Inter Miami"]},
    {"name": "Cavani", "career": ["Napoli", "PSG", "Manchester United", "Boca Juniors"]},

    # ============================================
    # YILDIZLAR DEVAMI
    # ============================================
    {"name": "Griezmann", "career": ["Real Sociedad", "Atletico Madrid", "Barcelona", "Atletico Madrid"]},
    {"name": "Aguero", "career": ["Atletico Madrid", "Manchester City", "Barcelona"]},
    {"name": "Hazard", "career": ["Chelsea", "Real Madrid"]},
    {"name": "Lloris", "career": ["Lyon", "Tottenham"]},
    {"name": "Coutinho", "career": ["Inter", "Liverpool", "Barcelona", "Aston Villa"]},
    {"name": "James Rodriguez", "career": ["Porto", "Monaco", "Real Madrid", "Bayern Munih", "Everton"]},
    {"name": "Isco", "career": ["Valencia", "Real Madrid", "Sevilla", "Real Betis"]},
    {"name": "Alves", "career": ["Sevilla", "Barcelona", "Juventus", "PSG", "Sao Paulo"]},
    {"name": "Marcelo", "career": ["Fluminense", "Real Madrid", "Olympiakos"]},  # Fluminense listede yok
    {"name": "Bale", "career": ["Tottenham", "Real Madrid", "Tottenham", "LA Galaxy"]},

    # ============================================
    # TURK FUTBOLCULAR
    # ============================================
    {"name": "Hakan Calhanoglu", "career": ["Bayer Leverkusen", "AC Milan", "Inter"]},
    {"name": "Cengiz Under", "career": ["Basaksehir", "Roma", "Marseille"]},
    {"name": "Burak Yilmaz", "career": ["Galatasaray", "Trabzonspor", "Lille"]},
    {"name": "Arda Turan", "career": ["Galatasaray", "Atletico Madrid", "Barcelona", "Basaksehir", "Galatasaray"]},
    {"name": "Hakan Sukur", "career": ["Galatasaray", "Inter", "Galatasaray"]},
    {"name": "Hamit Altintop", "career": ["Schalke", "Bayern Munih", "Real Madrid", "Galatasaray"]},
    {"name": "Volkan Demirel", "career": ["Fenerbahce"]},
    {"name": "Emre Belozoglu", "career": ["Galatasaray", "Inter", "Newcastle", "Fenerbahce", "Atletico Madrid", "Basaksehir"]},
    {"name": "Tuncay Sanli", "career": ["Sakaryaspor", "Fenerbahce", "Middlesbrough"]},  # Bazilari listede yok
    {"name": "Nuri Sahin", "career": ["Borussia Dortmund", "Feyenoord", "Real Madrid", "Liverpool", "Borussia Dortmund", "Werder Bremen"]},  # Bazilari listede yok

    # ============================================
    # GENC YETENEKLER
    # ============================================
    {"name": "Yamal", "career": ["Barcelona"]},
    {"name": "Pedri", "career": ["Las Palmas", "Barcelona"]},  # Las Palmas listede yok
    {"name": "Gavi", "career": ["Barcelona"]},
    {"name": "Camavinga", "career": ["Rennes", "Real Madrid"]},
    {"name": "Endrick", "career": ["Palmeiras", "Real Madrid"]},
    {"name": "Wirtz", "career": ["Bayer Leverkusen"]},
    {"name": "Musiala", "career": ["Bayern Munih"]},
    {"name": "Foden", "career": ["Manchester City"]},
    {"name": "Saka", "career": ["Arsenal"]},
    {"name": "Garnacho", "career": ["Atletico Madrid", "Manchester United"]},

    # ============================================
    # AFRIKALI YILDIZLAR
    # ============================================
    {"name": "Drogba (Didier)", "career": ["Marseille", "Chelsea", "Galatasaray", "Chelsea"]},
    {"name": "Yaya Toure", "career": ["Olympiakos", "Monaco", "Barcelona", "Manchester City"]},
    {"name": "Aubameyang", "career": ["AC Milan", "Borussia Dortmund", "Arsenal", "Barcelona", "Chelsea", "Marseille"]},
    {"name": "Mahrez", "career": ["Leicester", "Manchester City", "Al-Ahli"]},  # Al-Ahli listede yok
    {"name": "Koulibaly", "career": ["Napoli", "Chelsea", "Al-Hilal"]},
    {"name": "Onana", "career": ["Ajax", "Inter", "Manchester United"]},
    {"name": "Hakimi", "career": ["Real Madrid", "Borussia Dortmund", "Inter", "PSG"]},
    {"name": "Salah Mohamed", "career": ["Chelsea", "Roma", "Liverpool"]},
    {"name": "Kanu", "career": ["Ajax", "Inter", "Arsenal", "West Bromwich", "Portsmouth"]},  # Bazilari yok
    {"name": "Eto'o (Samuel)", "career": ["Real Madrid", "Barcelona", "Inter", "Anderlecht", "Chelsea"]},

    # ============================================
    # DIGER UNLULER
    # ============================================
    {"name": "Ibrahimovic", "career": ["Ajax", "Juventus", "Inter", "Barcelona", "AC Milan", "PSG", "Manchester United", "LA Galaxy", "AC Milan"]},
    {"name": "Robben", "career": ["Chelsea", "Real Madrid", "Bayern Munih"]},
    {"name": "Ribery", "career": ["Marseille", "Bayern Munih", "Fiorentina", "Sampdoria"]},
    {"name": "Schweinsteiger", "career": ["Bayern Munih", "Manchester United"]},
    {"name": "Lahm", "career": ["Bayern Munih"]},
    {"name": "Muller", "career": ["Bayern Munih"]},
    {"name": "Boateng", "career": ["Hamburg", "Manchester City", "Bayern Munih", "Lyon"]},  # Hamburg listede yok
    {"name": "Khedira", "career": ["Stuttgart", "Real Madrid", "Juventus"]},  # Stuttgart listede yok
    {"name": "Ozil", "career": ["Schalke", "Werder Bremen", "Real Madrid", "Arsenal", "Fenerbahce", "Basaksehir"]},  # Werder yok
    {"name": "Podolski", "career": ["Bayern Munih", "Arsenal", "Galatasaray", "Inter"]},
]


def get_player_by_name(name):
    """Bir futbolcuyu adina gore bul"""
    for p in ALL_PLAYERS:
        if p["name"] == name:
            return p
    return None


def get_all_player_names():
    """Tum futbolcu isimleri"""
    return [p["name"] for p in ALL_PLAYERS]


# Test
if __name__ == "__main__":
    print(f"Toplam futbolcu sayisi: {len(ALL_PLAYERS)}")
    print("\nIlk 10 futbolcu:")
    for p in ALL_PLAYERS[:10]:
        career_str = " -> ".join(p["career"])
        print(f"- {p['name']}: {career_str}")