"""
TAKIM LISTESI (Duplicate'ler temizlendi)
Her takim: renk (fallback), TM ID (logo icin)
Logo dosyasi: /takim_logolari/{slug}.png
"""

ALL_TEAMS = {
    # ============================================
    # ISPANYA - La Liga
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
    "Real Zaragoza":            {"color": (0, 68, 148),    "tm_id": 237},
    "Las Palmas":               {"color": (255, 215, 0),   "tm_id": 472},
    "Deportivo":                {"color": (0, 100, 200),   "tm_id": 897},
    "Sporting Gijon":           {"color": (200, 16, 46),   "tm_id": 979},
    "Espanyol":                 {"color": (0, 100, 200),   "tm_id": 714},
    "Granada":                  {"color": (200, 16, 46),   "tm_id": 861},
    "Malaga":                   {"color": (0, 100, 200),   "tm_id": 1084},
    "Alaves":                   {"color": (0, 100, 200),   "tm_id": 1108},
    "Cordoba":                  {"color": (255, 255, 255), "tm_id": 993},
    "Hercules":                 {"color": (0, 0, 0),       "tm_id": 990},
    "Real Oviedo":              {"color": (0, 100, 200),   "tm_id": 2497},
    "Real Valladolid":          {"color": (139, 0, 195),   "tm_id": 366},
    "Rayo Vallecano":           {"color": (200, 16, 46),   "tm_id": 367},
    "Levante":                  {"color": (0, 100, 50),    "tm_id": 3368},

    # ============================================
    # INGILTERE - Premier League
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
    "Southampton":              {"color": (215, 25, 32),   "tm_id": 180},
    "Middlesbrough":            {"color": (200, 16, 46),   "tm_id": 641},
    "West Bromwich":            {"color": (0, 32, 91),     "tm_id": 1025},
    "Portsmouth":               {"color": (0, 44, 131),    "tm_id": 1032},
    "Derby":                    {"color": (255, 255, 255), "tm_id": 22},
    "Leeds":                    {"color": (255, 255, 255), "tm_id": 399},
    "QPR":                      {"color": (0, 100, 200),   "tm_id": 189},
    "Stoke":                    {"color": (200, 16, 46),   "tm_id": 556},
    "Hull":                     {"color": (255, 140, 0),   "tm_id": 349},
    "Norwich":                  {"color": (255, 200, 0),   "tm_id": 1123},
    "Sunderland":               {"color": (200, 16, 46),   "tm_id": 289},
    "Bolton":                   {"color": (255, 255, 255), "tm_id": 1085},
    "Blackburn":                {"color": (0, 100, 200),   "tm_id": 164},
    "Cardiff":                  {"color": (150, 25, 40),   "tm_id": 603},
    "Crystal Palace":           {"color": (0, 100, 200),   "tm_id": 873},
    "Swansea":                  {"color": (255, 255, 255), "tm_id": 383},

    # ============================================
    # ITALYA - Serie A
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
    "Parma":                    {"color": (255, 215, 0),   "tm_id": 130},
    "Palermo":                  {"color": (255, 105, 180), "tm_id": 452},
    "Verona":                   {"color": (0, 100, 200),   "tm_id": 276},
    "Genoa":                    {"color": (200, 16, 46),   "tm_id": 252},
    "Bologna":                  {"color": (200, 16, 46),   "tm_id": 1025},
    "Brescia":                  {"color": (0, 100, 200),   "tm_id": 142},
    "Padova":                   {"color": (200, 16, 46),   "tm_id": 907},
    "Cesena":                   {"color": (255, 255, 255), "tm_id": 148},
    "Venezia":                  {"color": (255, 165, 0),   "tm_id": 607},
    "Vicenza":                  {"color": (200, 16, 46),   "tm_id": 1046},
    "Ravenna":                  {"color": (200, 16, 46),   "tm_id": 1015},
    "Pisa":                     {"color": (0, 100, 200),   "tm_id": 262},
    "Bari":                     {"color": (200, 16, 46),   "tm_id": 332},
    "Piacenza":                 {"color": (200, 16, 46),   "tm_id": 1023},
    "Ascoli":                   {"color": (0, 0, 0),       "tm_id": 331},
    "Chievo":                   {"color": (255, 215, 0),   "tm_id": 1272},
    "Monza":                    {"color": (200, 16, 46),   "tm_id": 2919},
    "Livorno":                  {"color": (139, 0, 0),     "tm_id": 1049},
    "Treviso":                  {"color": (0, 100, 200),   "tm_id": 895},
    "Perugia":                  {"color": (200, 16, 46),   "tm_id": 356},
    "Como":                     {"color": (0, 100, 200),   "tm_id": 46},
    "Udinese":                  {"color": (0, 0, 0),       "tm_id": 410},
    "Cagliari":                 {"color": (200, 16, 46),   "tm_id": 1390},
    "Mantova":                  {"color": (200, 16, 46),   "tm_id": 5232},
    "Messina":                  {"color": (255, 165, 0),   "tm_id": 1104},
    "Foggia":                   {"color": (200, 16, 46),   "tm_id": 999},
    "Pescara":                  {"color": (0, 100, 200),   "tm_id": 525},
    "Siena":                    {"color": (0, 0, 0),       "tm_id": 1075},
    "Grosseto":                 {"color": (200, 16, 46),   "tm_id": 1301},
    "Cavese":                   {"color": (0, 0, 0),       "tm_id": 1080},

    # ============================================
    # ALMANYA - Bundesliga
    # ============================================
    "Bayern Munih":             {"color": (220, 5, 45),    "tm_id": 27},
    "Borussia Dortmund":        {"color": (253, 225, 0),   "tm_id": 16},
    "Bayer Leverkusen":         {"color": (227, 6, 19),    "tm_id": 15},
    "RB Leipzig":               {"color": (221, 4, 65),    "tm_id": 23826},
    "Schalke":                  {"color": (0, 78, 159),    "tm_id": 33},
    "Wolfsburg":                {"color": (101, 173, 32),  "tm_id": 82},
    "Eintracht Frankfurt":      {"color": (227, 35, 39),   "tm_id": 24},
    "Borussia Monchengladbach": {"color": (0, 0, 0),       "tm_id": 18},
    "Werder Bremen":            {"color": (30, 155, 90),   "tm_id": 86},
    "Hamburg":                  {"color": (0, 60, 120),    "tm_id": 41},
    "Stuttgart":                {"color": (255, 255, 255), "tm_id": 79},
    "Kaiserslautern":           {"color": (200, 16, 46),   "tm_id": 2},
    "Koln":                     {"color": (200, 16, 46),   "tm_id": 3},
    "Hertha Berlin":            {"color": (0, 100, 200),   "tm_id": 44},
    "Hoffenheim":               {"color": (0, 100, 200),   "tm_id": 533},
    "Nurnberg":                 {"color": (200, 16, 46),   "tm_id": 4},
    "Mainz":                    {"color": (200, 16, 46),   "tm_id": 39},
    "Bochum":                   {"color": (0, 100, 200),   "tm_id": 80},
    "Karlsruher":               {"color": (0, 100, 200),   "tm_id": 46},
    "Hannover":                 {"color": (200, 16, 46),   "tm_id": 42},
    "Union Berlin":             {"color": (200, 16, 46),   "tm_id": 89},
    "Rot Weiss Ahlen":          {"color": (200, 16, 46),   "tm_id": 84},

    # ============================================
    # FRANSA - Ligue 1
    # ============================================
    "PSG":                      {"color": (0, 65, 138),    "tm_id": 583},
    "Marseille":                {"color": (47, 161, 207),  "tm_id": 244},
    "Monaco":                   {"color": (227, 27, 35),   "tm_id": 162},
    "Lyon":                     {"color": (255, 255, 255), "tm_id": 1041},
    "Lille":                    {"color": (200, 16, 46),   "tm_id": 1082},
    "Nice":                     {"color": (200, 16, 46),   "tm_id": 417},
    "Rennes":                   {"color": (200, 16, 46),   "tm_id": 273},
    "Bordeaux":                 {"color": (0, 0, 100),     "tm_id": 39},
    "Caen":                     {"color": (200, 30, 40),   "tm_id": 1162},
    "Toulouse":                 {"color": (100, 0, 150),   "tm_id": 415},
    "Cannes":                   {"color": (200, 16, 46),   "tm_id": 895},
    "Nantes":                   {"color": (255, 215, 0),   "tm_id": 995},
    "Auxerre":                  {"color": (255, 255, 255), "tm_id": 290},
    "Nimes":                    {"color": (200, 16, 46),   "tm_id": 1424},
    "Saint Etienne":            {"color": (0, 100, 50),    "tm_id": 618},
    "Montpellier":              {"color": (200, 16, 46),   "tm_id": 969},
    "Grenoble":                 {"color": (0, 100, 200),   "tm_id": 1421},
    "Strasbourg":               {"color": (0, 100, 200),   "tm_id": 667},
    "Metz":                     {"color": (200, 16, 46),   "tm_id": 305},
    "Bastia":                   {"color": (0, 100, 200),   "tm_id": 1231},
    "Guingamp":                 {"color": (200, 16, 46),   "tm_id": 968},
    "Valenciennes":             {"color": (200, 16, 46),   "tm_id": 1240},
    "Evian":                    {"color": (255, 165, 0),   "tm_id": 3707},
    "Sochaux":                  {"color": (0, 100, 200),   "tm_id": 1237},

    # ============================================
    # TURKIYE - Super Lig
    # ============================================
    "Galatasaray":              {"color": (250, 180, 35),  "tm_id": 141},
    "Fenerbahce":               {"color": (252, 226, 5),   "tm_id": 36},
    "Besiktas":                 {"color": (255, 255, 255), "tm_id": 114},
    "Trabzonspor":              {"color": (143, 30, 56),   "tm_id": 449},
    "Basaksehir":               {"color": (255, 102, 0),   "tm_id": 6890},
    "Adana Demirspor":          {"color": (0, 70, 156),    "tm_id": 12474},
    "Konyaspor":                {"color": (0, 100, 50),    "tm_id": 2293},
    "Sivasspor":                {"color": (200, 16, 46),   "tm_id": 2381},
    "Sakaryaspor":              {"color": (0, 100, 50),    "tm_id": 1460},
    "Antalyaspor":              {"color": (200, 16, 46),   "tm_id": 589},
    "Bursaspor":                {"color": (0, 100, 50),    "tm_id": 619},
    "Ankaragucu":               {"color": (255, 255, 255), "tm_id": 620},
    "Kartalspor":               {"color": (0, 0, 0),       "tm_id": 2445},
    "Sariyer":                  {"color": (0, 100, 200),   "tm_id": 1568},
    "Vefa":                     {"color": (100, 100, 100), "tm_id": 15498},
    "Malatyaspor":              {"color": (200, 16, 46),   "tm_id": 606},
    "Yeni Malatyaspor":         {"color": (255, 165, 0),   "tm_id": 5220},
    "Fatih Karagumruk":         {"color": (200, 16, 46),   "tm_id": 8970},
    "Karsiyaka":                {"color": (0, 100, 50),    "tm_id": 616},
    "Genclerbirligi":           {"color": (200, 16, 46),   "tm_id": 615},
    "Eskisehirspor":            {"color": (255, 165, 0),   "tm_id": 590},
    "Denizlispor":              {"color": (0, 100, 50),    "tm_id": 610},
    "Manisaspor":               {"color": (200, 16, 46),   "tm_id": 611},
    "Istanbulspor":             {"color": (255, 165, 0),   "tm_id": 601},
    "Samsunspor":               {"color": (200, 16, 46),   "tm_id": 596},
    "Altay":                    {"color": (0, 0, 0),       "tm_id": 641},
    "Kayserispor":              {"color": (200, 16, 46),   "tm_id": 2903},
    "Ankaraspor":               {"color": (0, 100, 200),   "tm_id": 2896},
    "Goztepe":                  {"color": (200, 16, 46),   "tm_id": 613},

    # ============================================
    # HOLLANDA - Eredivisie
    # ============================================
    "Ajax":                     {"color": (210, 16, 52),   "tm_id": 610},
    "PSV":                      {"color": (237, 28, 36),   "tm_id": 383},
    "Feyenoord":                {"color": (200, 16, 46),   "tm_id": 234},
    "AZ Alkmaar":               {"color": (200, 16, 46),   "tm_id": 1090},
    "Twente":                   {"color": (200, 16, 46),   "tm_id": 317},
    "Den Bosch":                {"color": (255, 255, 255), "tm_id": 1443},
    "Heerenveen":               {"color": (0, 100, 200),   "tm_id": 322},
    "Willem II":                {"color": (200, 16, 46),   "tm_id": 336},
    "Go Ahead Eagles":          {"color": (255, 215, 0),   "tm_id": 1444},
    "Haarlem":                  {"color": (200, 16, 46),   "tm_id": 6884},

    # ============================================
    # PORTEKIZ - Primeira Liga
    # ============================================
    "Sporting":                 {"color": (0, 130, 95),    "tm_id": 336},
    "Benfica":                  {"color": (200, 16, 46),   "tm_id": 294},
    "Porto":                    {"color": (0, 56, 130),    "tm_id": 720},
    "Braga":                    {"color": (200, 16, 46),   "tm_id": 1075},
    "Vitoria":                  {"color": (255, 255, 255), "tm_id": 862},
    "Rio Ave":                  {"color": (200, 16, 46),   "tm_id": 1076},
    "Nacional":                 {"color": (200, 16, 46),   "tm_id": 866},
    "Murcia":                   {"color": (200, 16, 46),   "tm_id": 10611},
    "Boavista":                 {"color": (0, 0, 0),       "tm_id": 719},
    "Estoril":                  {"color": (255, 255, 255), "tm_id": 1074},
    "Alverca":                  {"color": (200, 16, 46),   "tm_id": 1069},
    "Salamanca":                {"color": (0, 100, 50),    "tm_id": 4353},

    # ============================================
    # BREZILYA
    # ============================================
    "Santos":                   {"color": (0, 0, 0),       "tm_id": 221},
    "Flamengo":                 {"color": (200, 16, 46),   "tm_id": 614},
    "Palmeiras":                {"color": (0, 100, 50),    "tm_id": 1023},
    "Corinthians":              {"color": (0, 0, 0),       "tm_id": 199},
    "Sao Paulo":                {"color": (200, 16, 46),   "tm_id": 585},
    "Fluminense":               {"color": (128, 0, 0),     "tm_id": 2462},
    "Cruzeiro":                 {"color": (0, 100, 200),   "tm_id": 609},
    "Vasco da Gama":            {"color": (0, 0, 0),       "tm_id": 978},
    "Atletico Mineiro":         {"color": (0, 0, 0),       "tm_id": 330},
    "Athletico Paranaense":     {"color": (200, 16, 46),   "tm_id": 1039},
    "Botafogo":                 {"color": (0, 0, 0),       "tm_id": 537},
    "Gremio":                   {"color": (0, 100, 200),   "tm_id": 210},
    "Internacional":            {"color": (200, 16, 46),   "tm_id": 6600},
    "Coritiba":                 {"color": (0, 100, 50),    "tm_id": 762},
    "Chapecoense":              {"color": (0, 100, 50),    "tm_id": 4325},
    "Guarani":                  {"color": (0, 100, 50),    "tm_id": 985},
    "Portuguesa":               {"color": (200, 16, 46),   "tm_id": 986},
    "Sao Caetano":              {"color": (200, 16, 46),   "tm_id": 976},
    "Sport Recife":             {"color": (200, 16, 46),   "tm_id": 1024},
    "Salgueiros":               {"color": (200, 16, 46),   "tm_id": 12490},

    # ============================================
    # ARJANTIN
    # ============================================
    "Boca Juniors":             {"color": (0, 65, 138),    "tm_id": 189},
    "River Plate":              {"color": (200, 16, 46),   "tm_id": 209},
    "Newells Old Boys":         {"color": (200, 16, 46),   "tm_id": 1004},
    "Estudiantes":              {"color": (200, 16, 46),   "tm_id": 331},
    "Argentinos Juniors":       {"color": (200, 16, 46),   "tm_id": 1030},
    "Rosario Central":          {"color": (0, 100, 200),   "tm_id": 1029},
    "Instituto":                {"color": (200, 16, 46),   "tm_id": 1017},
    "Platense":                 {"color": (139, 69, 19),   "tm_id": 12470},
    "San Lorenzo":              {"color": (200, 16, 46),   "tm_id": 1213},

    # ============================================
    # SUUDI ARABISTAN / KATAR / BAE
    # ============================================
    "Al-Nassr":                 {"color": (253, 225, 0),   "tm_id": 18544},
    "Al-Hilal":                 {"color": (0, 65, 138),    "tm_id": 1114},
    "Al-Ittihad":               {"color": (253, 225, 0),   "tm_id": 8023},
    "Al-Ahli":                  {"color": (0, 100, 50),    "tm_id": 18487},
    "Al-Shabab":                {"color": (255, 255, 255), "tm_id": 8023},
    "Al-Ettifaq":               {"color": (200, 16, 46),   "tm_id": 8016},
    "Al-Gharafa":               {"color": (0, 0, 0),       "tm_id": 15316},
    "Al-Rayyan":                {"color": (200, 16, 46),   "tm_id": 3229},
    "Al-Duhail":                {"color": (200, 16, 46),   "tm_id": 26091},
    "Al-Arabi":                 {"color": (200, 16, 46),   "tm_id": 15481},
    "Al-Jazira":                {"color": (0, 100, 50),    "tm_id": 15311},
    "Qatar SC":                 {"color": (100, 100, 100), "tm_id": 15319},
    "Baniyas":                  {"color": (200, 16, 46),   "tm_id": 15328},
    "Al-Sadd":                  {"color": (255, 255, 255), "tm_id": 656},

    # ============================================
    # ABD - MLS
    # ============================================
    "Inter Miami":              {"color": (244, 116, 167), "tm_id": 69261},
    "LA Galaxy":                {"color": (0, 36, 90),     "tm_id": 1061},
    "New York City":            {"color": (108, 171, 221), "tm_id": 22592},
    "DC United":                {"color": (0, 0, 0),       "tm_id": 2440},
    "LA FC":                    {"color": (0, 0, 0),       "tm_id": 51828},
    "New York Cosmos":          {"color": (0, 100, 200),   "tm_id": 4835},
    "New York Red Bulls":       {"color": (200, 16, 46),   "tm_id": 623},
    "Toronto":                  {"color": (200, 16, 46),   "tm_id": 5299},
    "Montreal Impact":          {"color": (0, 100, 200),   "tm_id": 5300},
    "FC Dallas":                {"color": (200, 16, 46),   "tm_id": 4711},
    "Washington":               {"color": (200, 16, 46),   "tm_id": 813},
    "LA Aztecs":                {"color": (255, 215, 0),   "tm_id": 30000},

    # ============================================
    # DIGER ULKELER
    # ============================================
    "Celtic":                   {"color": (0, 132, 61),    "tm_id": 371},
    "Rangers":                  {"color": (0, 65, 138),    "tm_id": 246},
    "Olympiakos":               {"color": (200, 16, 46),   "tm_id": 683},
    "Panathinaikos":            {"color": (0, 100, 50),    "tm_id": 124},
    "Shakhtar Donetsk":         {"color": (253, 225, 0),   "tm_id": 660},
    "Dynamo Kyiv":              {"color": (0, 65, 138),    "tm_id": 338},
    "Anderlecht":               {"color": (138, 29, 27),   "tm_id": 8},
    "Club Brugge":              {"color": (0, 65, 138),    "tm_id": 2282},
    "Red Bull Salzburg":        {"color": (227, 4, 65),    "tm_id": 409},
    "Zenit":                    {"color": (0, 65, 138),    "tm_id": 964},
    "Spartak Moskova":          {"color": (200, 16, 46),   "tm_id": 232},
    "CSKA Moskova":             {"color": (0, 65, 138),    "tm_id": 2410},
    "Vissel Kobe":              {"color": (200, 16, 46),   "tm_id": 26498},
    "Sparta Prague":            {"color": (200, 16, 46),   "tm_id": 197},
    "Standard Liege":           {"color": (200, 16, 46),   "tm_id": 733},
    "Antwerp":                  {"color": (200, 16, 46),   "tm_id": 1349},
    "Basel":                    {"color": (200, 16, 46),   "tm_id": 296},
    "Grasshoppers":             {"color": (0, 100, 200),   "tm_id": 3057},
    "Servette":                 {"color": (200, 16, 46),   "tm_id": 3070},
    "Zurique":                  {"color": (0, 100, 200),   "tm_id": 3131},
    "St Gallen":                {"color": (0, 100, 50),    "tm_id": 3068},
    "Rapid Vienna":             {"color": (0, 100, 50),    "tm_id": 86},
    "Legia":                    {"color": (0, 100, 50),    "tm_id": 336},
    "Osijek":                   {"color": (0, 100, 200),   "tm_id": 8103},
    "Dinamo Zagreb":            {"color": (0, 100, 200),   "tm_id": 419},
    "Zrinjski":                 {"color": (0, 100, 200),   "tm_id": 5977},
    "Inter Zapresic":           {"color": (200, 16, 46),   "tm_id": 4907},
    "Zagreb":                   {"color": (0, 100, 200),   "tm_id": 3067},
    "Hajduk Split":             {"color": (0, 100, 200),   "tm_id": 447},
    "Croatia Zagreb":           {"color": (0, 100, 200),   "tm_id": 419},
    "NK Zagreb":                {"color": (0, 100, 200),   "tm_id": 3067},
    "Red Star":                 {"color": (200, 16, 46),   "tm_id": 1154},
    "Dynamo Moscow":            {"color": (0, 100, 200),   "tm_id": 361},
    "Lokomotiv Moskova":        {"color": (0, 100, 50),    "tm_id": 235},
    "Rubin Kazan":              {"color": (200, 16, 46),   "tm_id": 964},
    "Tianjin":                  {"color": (200, 16, 46),   "tm_id": 22540},
    "Anzhi":                    {"color": (255, 215, 0),   "tm_id": 2698},
    "Kuban Krasnodar":          {"color": (200, 16, 46),   "tm_id": 4147},
    "Shanghai Shenhua":         {"color": (0, 100, 200),   "tm_id": 3183},
    "Shandong Taishan":         {"color": (255, 165, 0),   "tm_id": 10421},
    "Guangzhou":                {"color": (200, 16, 46),   "tm_id": 33922},
    "Sydney FC":                {"color": (0, 100, 200),   "tm_id": 6960},
    "Panionios":                {"color": (0, 100, 200),   "tm_id": 132},
    "Aris":                     {"color": (255, 215, 0),   "tm_id": 100},
    "Kavala":                   {"color": (0, 100, 200),   "tm_id": 3092},
    "Cobreloa":                 {"color": (255, 165, 0),   "tm_id": 12483},
    "Cobresal":                 {"color": (255, 165, 0),   "tm_id": 12484},
    "Colo Colo":                {"color": (0, 0, 0),       "tm_id": 12471},
    "Universidad Chile":        {"color": (0, 100, 200),   "tm_id": 12482},
    "Universidad Catolica":     {"color": (0, 100, 200),   "tm_id": 12489},
    "America":                  {"color": (255, 215, 0),   "tm_id": 12486},
    "Queretaro":                {"color": (0, 0, 0),       "tm_id": 12500},
    "Danubio":                  {"color": (0, 0, 0),       "tm_id": 12472},
    "Tonnerre":                 {"color": (200, 16, 46),   "tm_id": 30001},
    "Barnet":                   {"color": (200, 16, 46),   "tm_id": 1189},
    "Mumbai City":              {"color": (0, 100, 200),   "tm_id": 30002},
    "FC Goa":                   {"color": (255, 165, 0),   "tm_id": 30003},
    "Hai Phong":                {"color": (200, 16, 46),   "tm_id": 30004},
    "Malaysia":                 {"color": (100, 100, 100), "tm_id": 30005},
    "Copenhagen":               {"color": (200, 16, 46),   "tm_id": 174},
    "Munih 1860":               {"color": (0, 100, 200),   "tm_id": 484},
    "Brasiliense":              {"color": (255, 215, 0),   "tm_id": 4680},
    "Sagan Tosu":               {"color": (255, 105, 180), "tm_id": 3936},
    "Barcelona B":              {"color": (165, 0, 80),    "tm_id": 2988},
}


# ============================================
# ALIAS SISTEMI (Duplicate isimler)
# Kariyer verilerinde eski isim kullanılırsa,
# yeni ismi otomatik bulur.
# ============================================
TEAM_ALIASES = {
    "Zaragoza": "Real Zaragoza",
    "MKE Ankaragucu": "Ankaragucu",
    "Vestel Manisaspor": "Manisaspor",
    "Atletico Paranaense": "Athletico Paranaense",
    "Sporting Braga": "Braga",
    "TSV 1860": "Munih 1860",
    "Marsonia": None,   # tm_id=30000 sahte, kullanılamaz
    "Sarayonu": None,   # tm_id=30000 sahte, kullanılamaz
}


def resolve_team_name(name):
    """Alias'ı çöz - eski isim geldiyse yeni isme çevir"""
    if name in ALL_TEAMS:
        return name
    if name in TEAM_ALIASES:
        return TEAM_ALIASES[name]  # None dönebilir
    return name  # Bulunamadıysa aynen döndür (fallback tetiklenir)


TM_LOGO_BASE = "https://tmssl.akamaized.net/images/wappen/head"


def get_team_color(team_name):
    """Bir takimin rengini dondurur"""
    resolved = resolve_team_name(team_name)
    if resolved and resolved in ALL_TEAMS:
        return ALL_TEAMS[resolved]["color"]
    return (100, 100, 100)


def get_team_logo_url(team_name):
    """Bir takimin TM logo URL'ini dondurur (yoksa None)"""
    resolved = resolve_team_name(team_name)
    if resolved and resolved in ALL_TEAMS:
        team = ALL_TEAMS[resolved]
        if team.get("tm_id"):
            return f"{TM_LOGO_BASE}/{team['tm_id']}.png"
    return None


def get_all_team_names():
    """Tum takim isimlerinin listesi"""
    return list(ALL_TEAMS.keys())


# Test
if __name__ == "__main__":
    print(f"Toplam takim sayisi: {len(ALL_TEAMS)}")
    print(f"Alias sayisi: {len(TEAM_ALIASES)}")
    print("\n--- Alias testi ---")
    for old in TEAM_ALIASES:
        new = resolve_team_name(old)
        print(f"{old} -> {new}")