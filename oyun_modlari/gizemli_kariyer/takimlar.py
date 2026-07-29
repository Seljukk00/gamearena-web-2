"""
100 TAKIM LISTESI
Her takim: renk (fallback), TM ID (logo icin)
Logo URL: https://tmssl.akamaized.net/images/wappen/head/{tm_id}.png
"""

ALL_TEAMS = {
    # ============================================
    # ISPANYA - La Liga (10)
    # ============================================
    "Barcelona":                {"color": (165, 0, 80),    "tm_id": 131},
    "Real Madrid":              {"color": (254, 254, 254), "tm_id": 418},
    "Atletico Madrid":          {"color": (200, 16, 46),   "tm_id": 13},
    "Sevilla":                  {"color": (211, 27, 30),   "tm_id": 368},
    "Valencia":                 {"color": (255, 99, 25),   "tm_id": 1049},
    "Villarreal":               {"color": (255, 215, 0),   "tm_id": 1050},
    "Real Sociedad":            {"color": (0, 71, 171),    "tm_id": 681},
    "Athletic Bilbao":          {"color": (238, 35, 35),   "tm_id": 621},
    "Real Betis":               {"color": (0, 150, 70),    "tm_id": 150},
    "Celta Vigo":               {"color": (135, 206, 250), "tm_id": 940},

    # ============================================
    # INGILTERE - Premier League (12)
    # ============================================
    "Manchester United":        {"color": (218, 41, 28),   "tm_id": 985},
    "Manchester City":          {"color": (108, 171, 221), "tm_id": 281},
    "Liverpool":                {"color": (200, 16, 46),   "tm_id": 31},
    "Chelsea":                  {"color": (3, 70, 148),    "tm_id": 631},
    "Arsenal":                  {"color": (239, 1, 7),     "tm_id": 11},
    "Tottenham":                {"color": (19, 34, 87),    "tm_id": 148},
    "Newcastle":                {"color": (45, 41, 38),    "tm_id": 762},
    "Leicester":                {"color": (0, 83, 160),    "tm_id": 1003},
    "West Ham":                 {"color": (122, 38, 58),   "tm_id": 379},
    "Everton":                  {"color": (39, 68, 136),   "tm_id": 29},
    "Aston Villa":              {"color": (149, 191, 229), "tm_id": 405},
    "Wolves":                   {"color": (253, 185, 19),  "tm_id": 543},

    # ============================================
    # ITALYA - Serie A (10)
    # ============================================
    "Juventus":                 {"color": (255, 255, 255), "tm_id": 506},
    "Inter":                    {"color": (0, 68, 148),    "tm_id": 46},
    "AC Milan":                 {"color": (251, 9, 13),    "tm_id": 5},
    "Roma":                     {"color": (138, 29, 27),   "tm_id": 12},
    "Napoli":                   {"color": (18, 165, 220),  "tm_id": 6195},
    "Lazio":                    {"color": (135, 206, 250), "tm_id": 398},
    "Atalanta":                 {"color": (0, 0, 0),       "tm_id": 800},
    "Fiorentina":               {"color": (89, 47, 144),   "tm_id": 430},
    "Torino":                   {"color": (139, 0, 0),     "tm_id": 416},
    "Sampdoria":                {"color": (0, 51, 153),    "tm_id": 1038},

    # ============================================
    # ALMANYA - Bundesliga (8)
    # ============================================
    "Bayern Munih":             {"color": (220, 5, 45),    "tm_id": 27},
    "Borussia Dortmund":        {"color": (253, 225, 0),   "tm_id": 16},
    "Bayer Leverkusen":         {"color": (227, 6, 19),    "tm_id": 15},
    "RB Leipzig":               {"color": (221, 4, 65),    "tm_id": 23826},
    "Schalke":                  {"color": (0, 78, 159),    "tm_id": 33},
    "Wolfsburg":                {"color": (101, 173, 32),  "tm_id": 82},
    "Eintracht Frankfurt":      {"color": (227, 35, 39),   "tm_id": 24},
    "Borussia Monchengladbach": {"color": (0, 0, 0),       "tm_id": 18},

    # ============================================
    # FRANSA - Ligue 1 (8)
    # ============================================
    "PSG":                      {"color": (0, 65, 138),    "tm_id": 583},
    "Marseille":                {"color": (47, 161, 207),  "tm_id": 244},
    "Monaco":                   {"color": (227, 27, 35),   "tm_id": 162},
    "Lyon":                     {"color": (255, 255, 255), "tm_id": 1041},
    "Lille":                    {"color": (200, 16, 46),   "tm_id": 1082},
    "Nice":                     {"color": (200, 16, 46),   "tm_id": 417},
    "Rennes":                   {"color": (200, 16, 46),   "tm_id": 273},
    "Bordeaux":                 {"color": (0, 0, 100),     "tm_id": 39},

    # ============================================
    # TURKIYE - Super Lig (8)
    # ============================================
    "Galatasaray":              {"color": (250, 180, 35),  "tm_id": 141},
    "Fenerbahce":               {"color": (252, 226, 5),   "tm_id": 36},
    "Besiktas":                 {"color": (255, 255, 255), "tm_id": 114},
    "Trabzonspor":              {"color": (143, 30, 56),   "tm_id": 449},
    "Basaksehir":               {"color": (255, 102, 0),   "tm_id": 6890},
    "Adana Demirspor":          {"color": (0, 70, 156),    "tm_id": 12474},
    "Konyaspor":                {"color": (0, 100, 50),    "tm_id": 2293},
    "Sivasspor":                {"color": (200, 16, 46),   "tm_id": 2381},

    # ============================================
    # HOLLANDA - Eredivisie (5)
    # ============================================
    "Ajax":                     {"color": (210, 16, 52),   "tm_id": 610},
    "PSV":                      {"color": (237, 28, 36),   "tm_id": 383},
    "Feyenoord":                {"color": (200, 16, 46),   "tm_id": 234},
    "AZ Alkmaar":               {"color": (200, 16, 46),   "tm_id": 1090},
    "Twente":                   {"color": (200, 16, 46),   "tm_id": 317},

    # ============================================
    # PORTEKIZ - Primeira Liga (5)
    # ============================================
    "Sporting":                 {"color": (0, 130, 95),    "tm_id": 336},
    "Benfica":                  {"color": (200, 16, 46),   "tm_id": 294},
    "Porto":                    {"color": (0, 56, 130),    "tm_id": 720},
    "Braga":                    {"color": (200, 16, 46),   "tm_id": 1075},
    "Vitoria":                  {"color": (255, 255, 255), "tm_id": 862},

    # ============================================
    # BREZILYA (5)
    # ============================================
    "Santos":                   {"color": (0, 0, 0),       "tm_id": 221},
    "Flamengo":                 {"color": (200, 16, 46),   "tm_id": 614},
    "Palmeiras":                {"color": (0, 100, 50),    "tm_id": 1023},
    "Corinthians":              {"color": (0, 0, 0),       "tm_id": 199},
    "Sao Paulo":                {"color": (200, 16, 46),   "tm_id": 585},

    # ============================================
    # ARJANTIN (3)
    # ============================================
    "Boca Juniors":             {"color": (0, 65, 138),    "tm_id": 189},
    "River Plate":              {"color": (200, 16, 46),   "tm_id": 209},
    "Newells Old Boys":         {"color": (200, 16, 46),   "tm_id": 1004},

    # ============================================
    # SUUDI ARABISTAN (3)
    # ============================================
    "Al-Nassr":                 {"color": (253, 225, 0),   "tm_id": 18544},
    "Al-Hilal":                 {"color": (0, 65, 138),    "tm_id": 1114},
    "Al-Ittihad":               {"color": (253, 225, 0),   "tm_id": 7801},

    # ============================================
    # ABD - MLS (3)
    # ============================================
    "Inter Miami":              {"color": (244, 116, 167), "tm_id": 69261},
    "LA Galaxy":                {"color": (0, 36, 90),     "tm_id": 1023},
    "New York City":            {"color": (108, 171, 221), "tm_id": 22592},

    # ============================================
    # DIGER ULKELER (12)
    # ============================================
    "Celtic":                   {"color": (0, 132, 61),    "tm_id": 371},
    "Rangers":                  {"color": (0, 65, 138),    "tm_id": 246},
    "Olympiakos":               {"color": (200, 16, 46),   "tm_id": 143},
    "Panathinaikos":            {"color": (0, 100, 50),    "tm_id": 124},
    "Shakhtar Donetsk":         {"color": (253, 225, 0),   "tm_id": 660},
    "Dynamo Kyiv":              {"color": (0, 65, 138),    "tm_id": 338},
    "Anderlecht":               {"color": (138, 29, 27),   "tm_id": 8},
    "Club Brugge":              {"color": (0, 65, 138),    "tm_id": 2282},
    "Red Bull Salzburg":        {"color": (227, 4, 65),    "tm_id": 409},
    "Zenit":                    {"color": (0, 65, 138),    "tm_id": 964},
    "Spartak Moskova":          {"color": (200, 16, 46),   "tm_id": 232},
    "CSKA Moskova":             {"color": (0, 65, 138),    "tm_id": 2410},
}


TM_LOGO_BASE = "https://tmssl.akamaized.net/images/wappen/head"


def get_team_color(team_name):
    """Bir takimin rengini dondurur"""
    team = ALL_TEAMS.get(team_name)
    if team:
        return team["color"]
    return (100, 100, 100)


def get_team_logo_url(team_name):
    """Bir takimin TM logo URL'ini dondurur (yoksa None)"""
    team = ALL_TEAMS.get(team_name)
    if team and team.get("tm_id"):
        return f"{TM_LOGO_BASE}/{team['tm_id']}.png"
    return None


def get_all_team_names():
    """Tum takim isimlerinin listesi"""
    return list(ALL_TEAMS.keys())


# Test
if __name__ == "__main__":
    print(f"Toplam takim sayisi: {len(ALL_TEAMS)}")
    for name, data in ALL_TEAMS.items():
        url = get_team_logo_url(name)
        print(f"- {name} -> {url}")