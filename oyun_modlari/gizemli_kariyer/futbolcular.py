"""
100 FUTBOLCU + KULUP KARIYERLERI
Her futbolcu: ad, kariyeri (sirayla oynadigi takimlar), zorluk (kolay/orta/zor)

ZORLUK:
- kolay: Herkes tanır (Messi, Ronaldo, Zidane...)
- orta:  Futbol izleyen bilir (Griezmann, Aubameyang, Bruno Fernandes...)
- zor:   Kariyer bilgisi lazım (eski oyuncular, az bilinenler)

ONEMLI: takim isimleri 'takimlar.py' icindeki ALL_TEAMS ile EŞLEŞMELİ!
"""

ALL_PLAYERS = [
    # ============================================
    # KOLAY - SUPERSTARLAR (herkes bilir)
    # ============================================
    {"name": "Messi", "career": ["Barcelona", "PSG", "Inter Miami"], "difficulty": "kolay"},
    {"name": "Cristiano Ronaldo", "career": ["Sporting", "Manchester United", "Real Madrid", "Juventus", "Manchester United", "Al-Nassr"], "difficulty": "kolay"},
    {"name": "Neymar", "career": ["Santos", "Barcelona", "PSG", "Al-Hilal"], "difficulty": "kolay"},
    {"name": "Mbappe", "career": ["Monaco", "PSG", "Real Madrid"], "difficulty": "kolay"},
    {"name": "Haaland", "career": ["Red Bull Salzburg", "Borussia Dortmund", "Manchester City"], "difficulty": "kolay"},
    {"name": "Lewandowski", "career": ["Borussia Dortmund", "Bayern Munih", "Barcelona"], "difficulty": "kolay"},
    {"name": "Benzema", "career": ["Lyon", "Real Madrid", "Al-Ittihad"], "difficulty": "kolay"},
    {"name": "Modric", "career": ["Tottenham", "Real Madrid"], "difficulty": "kolay"},
    {"name": "De Bruyne", "career": ["Chelsea", "Wolfsburg", "Manchester City"], "difficulty": "kolay"},
    {"name": "Salah", "career": ["Chelsea", "Roma", "Liverpool"], "difficulty": "kolay"},
    {"name": "Kroos", "career": ["Bayern Munih", "Bayer Leverkusen", "Bayern Munih", "Real Madrid"], "difficulty": "kolay"},
    {"name": "Vinicius Jr", "career": ["Flamengo", "Real Madrid"], "difficulty": "kolay"},
    {"name": "Bellingham", "career": ["Borussia Dortmund", "Real Madrid"], "difficulty": "kolay"},
    {"name": "Van Dijk", "career": ["Celtic", "Southampton", "Liverpool"], "difficulty": "kolay"},
    {"name": "Ibrahimovic", "career": ["Ajax", "Juventus", "Inter", "Barcelona", "AC Milan", "PSG", "Manchester United", "LA Galaxy", "AC Milan"], "difficulty": "kolay"},

    # ============================================
    # KOLAY - EFSANELER (eski yildizlar - herkes bilir)
    # ============================================
    {"name": "Zidane", "career": ["Bordeaux", "Juventus", "Real Madrid"], "difficulty": "kolay"},
    {"name": "Ronaldinho", "career": ["Sao Paulo", "PSG", "Barcelona", "AC Milan", "Flamengo"], "difficulty": "kolay"},
    {"name": "Ronaldo (R9)", "career": ["Sao Paulo", "PSV", "Barcelona", "Inter", "Real Madrid", "AC Milan", "Corinthians"], "difficulty": "kolay"},
    {"name": "Beckham", "career": ["Manchester United", "Real Madrid", "LA Galaxy", "AC Milan", "PSG"], "difficulty": "kolay"},
    {"name": "Henry", "career": ["Monaco", "Juventus", "Arsenal", "Barcelona", "New York City"], "difficulty": "kolay"},
    {"name": "Drogba", "career": ["Marseille", "Chelsea", "Galatasaray", "Chelsea"], "difficulty": "kolay"},
    {"name": "Kaka", "career": ["Sao Paulo", "AC Milan", "Real Madrid", "AC Milan"], "difficulty": "kolay"},
    {"name": "Suarez", "career": ["Ajax", "Liverpool", "Barcelona", "Atletico Madrid", "Inter Miami"], "difficulty": "kolay"},
    {"name": "Bale", "career": ["Tottenham", "Real Madrid", "Tottenham", "LA Galaxy"], "difficulty": "kolay"},
    {"name": "Aguero", "career": ["Atletico Madrid", "Manchester City", "Barcelona"], "difficulty": "kolay"},

    # ============================================
    # KOLAY - EK YILDIZLAR
    # ============================================
    {"name": "Rooney", "career": ["Everton", "Manchester United", "Everton", "DC United"], "difficulty": "kolay"},
    {"name": "Gerrard", "career": ["Liverpool", "LA Galaxy"], "difficulty": "kolay"},
    {"name": "Lampard", "career": ["West Ham", "Chelsea", "Manchester City", "New York City"], "difficulty": "kolay"},
    {"name": "Terry", "career": ["Chelsea", "Aston Villa"], "difficulty": "kolay"},
    {"name": "Rivaldo", "career": ["Palmeiras", "Deportivo", "Barcelona", "AC Milan", "Olympiakos"], "difficulty": "kolay"},
    {"name": "Del Piero", "career": ["Padova", "Juventus", "Sydney FC"], "difficulty": "kolay"},
    {"name": "Totti", "career": ["Roma"], "difficulty": "kolay"},
    {"name": "Raul", "career": ["Real Madrid", "Schalke", "Al-Sadd", "New York Cosmos"], "difficulty": "kolay"},
    {"name": "Nedved", "career": ["Sparta Prague", "Lazio", "Juventus"], "difficulty": "kolay"},
    {"name": "Figo", "career": ["Sporting", "Barcelona", "Real Madrid", "Inter"], "difficulty": "kolay"},
    {"name": "Cannavaro", "career": ["Napoli", "Parma", "Inter", "Juventus", "Real Madrid", "Al-Ahli"], "difficulty": "kolay"},
    {"name": "Rio Ferdinand", "career": ["West Ham", "Leeds", "Manchester United", "QPR"], "difficulty": "kolay"},
    {"name": "Toure Kolo", "career": ["Arsenal", "Manchester City", "Liverpool", "Celtic"], "difficulty": "kolay"},
    {"name": "Van Persie", "career": ["Feyenoord", "Arsenal", "Manchester United", "Fenerbahce", "Feyenoord"], "difficulty": "kolay"},
    {"name": "Torres", "career": ["Atletico Madrid", "Liverpool", "Chelsea", "AC Milan", "Atletico Madrid", "Sagan Tosu"], "difficulty": "kolay"},
    {"name": "Villa", "career": ["Zaragoza", "Valencia", "Barcelona", "Atletico Madrid", "New York City"], "difficulty": "kolay"},
    {"name": "Silva David", "career": ["Valencia", "Manchester City", "Real Sociedad"], "difficulty": "kolay"},
    {"name": "Xabi Alonso", "career": ["Real Sociedad", "Liverpool", "Real Madrid", "Bayern Munih"], "difficulty": "kolay"},
    {"name": "Fabregas", "career": ["Arsenal", "Barcelona", "Chelsea", "Monaco", "Como"], "difficulty": "kolay"},
    {"name": "Villa", "career": ["Sporting Gijon", "Zaragoza", "Valencia", "Barcelona", "Atletico Madrid"], "difficulty": "kolay"},
    {"name": "Ballack", "career": ["Kaiserslautern", "Bayer Leverkusen", "Bayern Munih", "Chelsea", "Bayer Leverkusen"], "difficulty": "kolay"},
    {"name": "Klose", "career": ["Kaiserslautern", "Werder Bremen", "Bayern Munih", "Lazio"], "difficulty": "kolay"},
    {"name": "Podolski Lukas", "career": ["Koln", "Bayern Munih", "Koln", "Arsenal", "Inter", "Galatasaray", "Vissel Kobe", "Antalyaspor"], "difficulty": "kolay"},
    {"name": "Toni Luca", "career": ["Palermo", "Fiorentina", "Bayern Munih", "Roma", "Genoa", "Al-Nassr", "Verona"], "difficulty": "kolay"},
    {"name": "Vieri", "career": ["Torino", "Atalanta", "Juventus", "Atletico Madrid", "Lazio", "Inter", "AC Milan", "Monaco", "Sampdoria", "Fiorentina", "Atalanta"], "difficulty": "kolay"},
    {"name": "Nesta", "career": ["Lazio", "AC Milan", "Montreal Impact"], "difficulty": "kolay"},
    {"name": "Puyol", "career": ["Barcelona"], "difficulty": "kolay"},
    {"name": "Deco", "career": ["Corinthians", "Salgueiros", "Porto", "Barcelona", "Chelsea", "Fluminense"], "difficulty": "kolay"},
    {"name": "Ballon Robinho", "career": ["Santos", "Real Madrid", "Manchester City", "AC Milan", "Santos", "Guangzhou", "AC Milan", "Atletico Mineiro", "Sivasspor"], "difficulty": "kolay"},
    {"name": "Fabio Cannavaro", "career": ["Napoli", "Parma", "Inter", "Juventus", "Real Madrid", "Al-Ahli"], "difficulty": "kolay"},
    {"name": "Adriano", "career": ["Flamengo", "Inter", "Parma", "Inter", "Sao Paulo", "Roma", "Corinthians", "Flamengo", "Atletico Paranaense"], "difficulty": "kolay"},
    {"name": "Roberto Carlos", "career": ["Palmeiras", "Inter", "Real Madrid", "Fenerbahce", "Corinthians", "Anzhi"], "difficulty": "kolay"},
    {"name": "Cafu", "career": ["Sao Paulo", "Real Zaragoza", "Palmeiras", "Roma", "AC Milan"], "difficulty": "kolay"},
    {"name": "Ronaldo Nazario", "career": ["Cruzeiro", "PSV", "Barcelona", "Inter", "Real Madrid", "AC Milan", "Corinthians"], "difficulty": "kolay"},
    {"name": "Baggio", "career": ["Vicenza", "Fiorentina", "Juventus", "AC Milan", "Bologna", "Inter", "Brescia"], "difficulty": "kolay"},
    {"name": "Zlatan Ibrahimovic", "career": ["Malmo", "Ajax", "Juventus", "Inter", "Barcelona", "AC Milan", "PSG", "Manchester United", "LA Galaxy", "AC Milan"], "difficulty": "kolay"},
    {"name": "Owen", "career": ["Liverpool", "Real Madrid", "Newcastle", "Manchester United", "Stoke"], "difficulty": "kolay"},
    {"name": "Shevchenko", "career": ["Dynamo Kyiv", "AC Milan", "Chelsea", "AC Milan", "Dynamo Kyiv"], "difficulty": "kolay"},
    {"name": "Nistelrooy", "career": ["Den Bosch", "Heerenveen", "PSV", "Manchester United", "Real Madrid", "Hamburg", "Malaga"], "difficulty": "kolay"},
    {"name": "Rooney Wayne", "career": ["Everton", "Manchester United", "Everton", "DC United", "Derby"], "difficulty": "kolay"},
    {"name": "Scholes", "career": ["Manchester United"], "difficulty": "kolay"},
    {"name": "Giggs", "career": ["Manchester United"], "difficulty": "kolay"},
    {"name": "Neville Gary", "career": ["Manchester United"], "difficulty": "kolay"},
    {"name": "Vidic", "career": ["Red Star", "Spartak Moskova", "Manchester United", "Inter"], "difficulty": "kolay"},
    {"name": "Evra", "career": ["Nice", "Monaco", "Manchester United", "Juventus", "Marseille", "West Ham"], "difficulty": "kolay"},
    {"name": "Fabregas Cesc", "career": ["Barcelona", "Arsenal", "Barcelona", "Chelsea", "Monaco", "Como"], "difficulty": "kolay"},
    {"name": "Wenger Fabianski", "career": ["Legia", "Arsenal", "Swansea", "West Ham"], "difficulty": "kolay"},
    {"name": "Ozil Mesut", "career": ["Schalke", "Werder Bremen", "Real Madrid", "Arsenal", "Fenerbahce", "Basaksehir"], "difficulty": "kolay"},
    {"name": "Coentrao", "career": ["Rio Ave", "Nacional", "Benfica", "Real Madrid", "Monaco", "Real Madrid", "Sporting"], "difficulty": "kolay"},
    {"name": "Marcelo Vieira", "career": ["Fluminense", "Real Madrid", "Olympiakos", "Fluminense"], "difficulty": "kolay"},
    {"name": "Diego Costa", "career": ["Braga", "Celta Vigo", "Albacete", "Atletico Madrid", "Real Valladolid", "Rayo Vallecano", "Atletico Madrid", "Chelsea", "Atletico Madrid", "Atletico Mineiro", "Wolves", "Botafogo", "Gremio"], "difficulty": "kolay"},
    {"name": "Falcao", "career": ["River Plate", "Porto", "Atletico Madrid", "Monaco", "Manchester United", "Chelsea", "Monaco", "Galatasaray", "Rayo Vallecano"], "difficulty": "kolay"},
    {"name": "Reus", "career": ["Rot Weiss Ahlen", "Borussia Monchengladbach", "Borussia Dortmund", "LA Galaxy"], "difficulty": "kolay"},
    {"name": "Gundogan", "career": ["Nurnberg", "Borussia Dortmund", "Manchester City", "Barcelona", "Manchester City"], "difficulty": "kolay"},
    {"name": "Kimmich", "career": ["Stuttgart", "RB Leipzig", "Bayern Munih"], "difficulty": "kolay"},
    {"name": "Sane", "career": ["Schalke", "Manchester City", "Bayern Munih"], "difficulty": "kolay"},
    {"name": "Gnabry", "career": ["Arsenal", "West Bromwich", "Werder Bremen", "Hoffenheim", "Bayern Munih"], "difficulty": "kolay"},
    {"name": "Kane", "career": ["Tottenham", "Bayern Munih"], "difficulty": "kolay"},
    {"name": "Rashford", "career": ["Manchester United", "Aston Villa"], "difficulty": "kolay"},
    {"name": "Grealish", "career": ["Aston Villa", "Manchester City", "Everton"], "difficulty": "kolay"},
    {"name": "Rice", "career": ["West Ham", "Arsenal"], "difficulty": "kolay"},
    {"name": "Alexander Arnold", "career": ["Liverpool", "Real Madrid"], "difficulty": "kolay"},
    {"name": "Robertson", "career": ["Queen Park", "Dundee", "Hull", "Liverpool"], "difficulty": "kolay"},
    {"name": "Kimmich Joshua", "career": ["Stuttgart", "RB Leipzig", "Bayern Munih"], "difficulty": "kolay"},
    {"name": "Havertz", "career": ["Bayer Leverkusen", "Chelsea", "Arsenal"], "difficulty": "kolay"},
    {"name": "Werner", "career": ["Stuttgart", "RB Leipzig", "Chelsea", "RB Leipzig", "Tottenham", "RB Leipzig"], "difficulty": "kolay"},
    {"name": "Alaba", "career": ["Bayern Munih", "Hoffenheim", "Bayern Munih", "Real Madrid"], "difficulty": "kolay"},
    {"name": "Kessie", "career": ["Atalanta", "Cesena", "Atalanta", "AC Milan", "Barcelona", "Al-Ahli"], "difficulty": "kolay"},
    {"name": "Chiellini", "career": ["Livorno", "Fiorentina", "Juventus", "LA FC"], "difficulty": "kolay"},
    {"name": "Bonucci", "career": ["Inter", "Treviso", "Pisa", "Bari", "Juventus", "AC Milan", "Juventus", "Union Berlin", "Fenerbahce"], "difficulty": "kolay"},
    {"name": "Barzagli", "career": ["Piacenza", "Ascoli", "Chievo", "Palermo", "Wolfsburg", "Juventus"], "difficulty": "kolay"},
    {"name": "Verratti Marco", "career": ["Pescara", "PSG", "Al-Arabi"], "difficulty": "kolay"},
    {"name": "Insigne", "career": ["Napoli", "Cavese", "Foggia", "Pescara", "Napoli", "Toronto"], "difficulty": "kolay"},
    {"name": "Immobile", "career": ["Juventus", "Siena", "Grosseto", "Pescara", "Juventus", "Genoa", "Torino", "Borussia Dortmund", "Sevilla", "Torino", "Lazio", "Besiktas"], "difficulty": "kolay"},
    {"name": "Barella", "career": ["Cagliari", "Como", "Cagliari", "Inter"], "difficulty": "kolay"},
    {"name": "Chiesa", "career": ["Fiorentina", "Juventus", "Liverpool"], "difficulty": "kolay"},
    {"name": "Zaniolo", "career": ["Inter", "Roma", "Galatasaray", "Aston Villa", "Fiorentina", "Udinese"], "difficulty": "kolay"},
    {"name": "Digne", "career": ["Lille", "PSG", "Roma", "Barcelona", "Everton", "Aston Villa"], "difficulty": "kolay"},

    # ============================================
    # ORTA - Genel yildizlar (futbol izleyen bilir)
    # ============================================
    {"name": "Eto'o", "career": ["Real Madrid", "Barcelona", "Inter", "Anderlecht", "Chelsea", "Everton", "Sampdoria"], "difficulty": "orta"},
    {"name": "Pirlo", "career": ["Inter", "AC Milan", "Juventus", "New York City"], "difficulty": "orta"},
    {"name": "Maldini", "career": ["AC Milan"], "difficulty": "orta"},
    {"name": "Buffon", "career": ["Juventus", "PSG", "Juventus"], "difficulty": "orta"},
    {"name": "Casillas", "career": ["Real Madrid", "Porto"], "difficulty": "orta"},
    {"name": "Neuer", "career": ["Schalke", "Bayern Munih"], "difficulty": "orta"},
    {"name": "Courtois", "career": ["Atletico Madrid", "Chelsea", "Real Madrid"], "difficulty": "orta"},
    {"name": "Alisson", "career": ["Roma", "Liverpool"], "difficulty": "orta"},
    {"name": "Ter Stegen", "career": ["Borussia Monchengladbach", "Barcelona"], "difficulty": "orta"},
    {"name": "Donnarumma", "career": ["AC Milan", "PSG"], "difficulty": "orta"},
    {"name": "De Gea", "career": ["Atletico Madrid", "Manchester United"], "difficulty": "orta"},
    {"name": "Ramos", "career": ["Sevilla", "Real Madrid", "PSG"], "difficulty": "orta"},
    {"name": "Pique", "career": ["Manchester United", "Real Zaragoza", "Barcelona"], "difficulty": "orta"},
    {"name": "Marquinhos", "career": ["Roma", "PSG"], "difficulty": "orta"},
    {"name": "Varane", "career": ["Real Madrid", "Manchester United"], "difficulty": "orta"},
    {"name": "Thiago Silva", "career": ["AC Milan", "PSG", "Chelsea", "Fluminense"], "difficulty": "orta"},
    {"name": "Maguire", "career": ["Leicester", "Manchester United"], "difficulty": "orta"},
    {"name": "Rudiger", "career": ["Roma", "Chelsea", "Real Madrid"], "difficulty": "orta"},
    {"name": "Kimpembe", "career": ["PSG"], "difficulty": "orta"},
    {"name": "Xavi", "career": ["Barcelona", "Al-Sadd"], "difficulty": "orta"},
    {"name": "Iniesta", "career": ["Barcelona", "Vissel Kobe"], "difficulty": "orta"},
    {"name": "Pogba", "career": ["Manchester United", "Juventus", "Manchester United", "Juventus"], "difficulty": "orta"},
    {"name": "Kante", "career": ["Caen", "Leicester", "Chelsea", "Al-Ittihad"], "difficulty": "orta"},
    {"name": "Tchouameni", "career": ["Monaco", "Real Madrid"], "difficulty": "orta"},
    {"name": "Casemiro", "career": ["Sao Paulo", "Real Madrid", "Manchester United"], "difficulty": "orta"},
    {"name": "Bruno Fernandes", "career": ["Sporting", "Manchester United"], "difficulty": "orta"},
    {"name": "Verratti", "career": ["PSG"], "difficulty": "orta"},
    {"name": "Rodri", "career": ["Atletico Madrid", "Manchester City"], "difficulty": "orta"},
    {"name": "Rodrygo", "career": ["Santos", "Real Madrid"], "difficulty": "orta"},
    {"name": "Mane", "career": ["Red Bull Salzburg", "Liverpool", "Bayern Munih", "Al-Nassr"], "difficulty": "orta"},
    {"name": "Firmino", "career": ["Liverpool", "Al-Ahli"], "difficulty": "orta"},
    {"name": "Sterling", "career": ["Liverpool", "Manchester City", "Chelsea"], "difficulty": "orta"},
    {"name": "Sancho", "career": ["Manchester City", "Borussia Dortmund", "Manchester United", "Borussia Dortmund"], "difficulty": "orta"},
    {"name": "Lukaku", "career": ["Anderlecht", "Chelsea", "Everton", "Manchester United", "Inter", "Roma"], "difficulty": "orta"},
    {"name": "Cavani", "career": ["Napoli", "PSG", "Manchester United", "Boca Juniors"], "difficulty": "orta"},
    {"name": "Griezmann", "career": ["Real Sociedad", "Atletico Madrid", "Barcelona", "Atletico Madrid"], "difficulty": "orta"},
    {"name": "Hazard", "career": ["Chelsea", "Real Madrid"], "difficulty": "orta"},
    {"name": "Lloris", "career": ["Lyon", "Tottenham"], "difficulty": "orta"},
    {"name": "Coutinho", "career": ["Inter", "Liverpool", "Barcelona", "Aston Villa"], "difficulty": "orta"},
    {"name": "James Rodriguez", "career": ["Porto", "Monaco", "Real Madrid", "Bayern Munih", "Everton"], "difficulty": "orta"},
    {"name": "Isco", "career": ["Valencia", "Real Madrid", "Sevilla", "Real Betis"], "difficulty": "orta"},
    {"name": "Alves", "career": ["Sevilla", "Barcelona", "Juventus", "PSG", "Sao Paulo"], "difficulty": "orta"},
    {"name": "Marcelo", "career": ["Fluminense", "Real Madrid", "Olympiakos"], "difficulty": "orta"},

    # ============================================
    # ORTA - TURK YILDIZLAR
    # ============================================
    {"name": "Hakan Calhanoglu", "career": ["Bayer Leverkusen", "AC Milan", "Inter"], "difficulty": "orta"},
    {"name": "Burak Yilmaz", "career": ["Galatasaray", "Trabzonspor", "Lille"], "difficulty": "orta"},
    {"name": "Arda Turan", "career": ["Galatasaray", "Atletico Madrid", "Barcelona", "Basaksehir", "Galatasaray"], "difficulty": "orta"},
    {"name": "Hakan Sukur", "career": ["Galatasaray", "Inter", "Galatasaray"], "difficulty": "orta"},
    {"name": "Volkan Demirel", "career": ["Fenerbahce"], "difficulty": "orta"},

    # ============================================
    # ORTA - Genc yetenekler
    # ============================================
    {"name": "Yamal", "career": ["Barcelona"], "difficulty": "orta"},
    {"name": "Pedri", "career": ["Las Palmas", "Barcelona"], "difficulty": "orta"},
    {"name": "Gavi", "career": ["Barcelona"], "difficulty": "orta"},
    {"name": "Camavinga", "career": ["Rennes", "Real Madrid"], "difficulty": "orta"},
    {"name": "Endrick", "career": ["Palmeiras", "Real Madrid"], "difficulty": "orta"},
    {"name": "Wirtz", "career": ["Bayer Leverkusen"], "difficulty": "orta"},
    {"name": "Musiala", "career": ["Bayern Munih"], "difficulty": "orta"},
    {"name": "Foden", "career": ["Manchester City"], "difficulty": "orta"},
    {"name": "Saka", "career": ["Arsenal"], "difficulty": "orta"},
    {"name": "Garnacho", "career": ["Atletico Madrid", "Manchester United"], "difficulty": "orta"},

    # ============================================
    # ORTA - Afrikali yildizlar
    # ============================================
    {"name": "Yaya Toure", "career": ["Olympiakos", "Monaco", "Barcelona", "Manchester City"], "difficulty": "orta"},
    {"name": "Aubameyang", "career": ["AC Milan", "Borussia Dortmund", "Arsenal", "Barcelona", "Chelsea", "Marseille"], "difficulty": "orta"},
    {"name": "Mahrez", "career": ["Leicester", "Manchester City", "Al-Ahli"], "difficulty": "orta"},
    {"name": "Koulibaly", "career": ["Napoli", "Chelsea", "Al-Hilal"], "difficulty": "orta"},
    {"name": "Onana", "career": ["Ajax", "Inter", "Manchester United"], "difficulty": "orta"},
    {"name": "Hakimi", "career": ["Real Madrid", "Borussia Dortmund", "Inter", "PSG"], "difficulty": "orta"},

    # ============================================
    # ORTA - Diger unluler
    # ============================================
    {"name": "Robben", "career": ["Chelsea", "Real Madrid", "Bayern Munih"], "difficulty": "orta"},
    {"name": "Ribery", "career": ["Marseille", "Bayern Munih", "Fiorentina", "Sampdoria"], "difficulty": "orta"},
    {"name": "Schweinsteiger", "career": ["Bayern Munih", "Manchester United"], "difficulty": "orta"},
    {"name": "Lahm", "career": ["Bayern Munih"], "difficulty": "orta"},
    {"name": "Muller", "career": ["Bayern Munih"], "difficulty": "orta"},
    {"name": "Boateng", "career": ["Hamburg", "Manchester City", "Bayern Munih", "Lyon"], "difficulty": "orta"},
    {"name": "Khedira", "career": ["Stuttgart", "Real Madrid", "Juventus"], "difficulty": "orta"},
    {"name": "Ozil", "career": ["Schalke", "Werder Bremen", "Real Madrid", "Arsenal", "Fenerbahce", "Basaksehir"], "difficulty": "orta"},
    {"name": "Podolski", "career": ["Bayern Munih", "Arsenal", "Galatasaray", "Inter"], "difficulty": "orta"},

    # ============================================
    # ORTA - EK YILDIZLAR
    # ============================================
    {"name": "Dybala", "career": ["Instituto", "Palermo", "Juventus", "Roma"], "difficulty": "orta"},
    {"name": "Icardi", "career": ["Sampdoria", "Inter", "PSG", "Galatasaray"], "difficulty": "orta"},
    {"name": "Higuain", "career": ["River Plate", "Real Madrid", "Napoli", "Juventus", "AC Milan", "Chelsea", "Juventus", "Inter Miami"], "difficulty": "orta"},
    {"name": "Di Maria", "career": ["Rosario Central", "Benfica", "Real Madrid", "Manchester United", "PSG", "Juventus", "Benfica"], "difficulty": "orta"},
    {"name": "Ozyakup", "career": ["Feyenoord", "Arsenal", "Besiktas", "Feyenoord", "Adana Demirspor", "Goztepe"], "difficulty": "orta"},
    {"name": "Sneijder", "career": ["Ajax", "Real Madrid", "Inter", "Galatasaray", "Nice", "Al-Gharafa"], "difficulty": "orta"},
    {"name": "Van Persie Robin", "career": ["Feyenoord", "Arsenal", "Manchester United", "Fenerbahce", "Feyenoord"], "difficulty": "orta"},
    {"name": "Fellaini", "career": ["Standard Liege", "Everton", "Manchester United", "Shandong Taishan"], "difficulty": "orta"},
    {"name": "Elmander", "career": ["Orebro", "Feyenoord", "Toulouse", "Bolton", "Galatasaray", "Norwich", "Copenhagen"], "difficulty": "orta"},
    {"name": "Wesley Sneijder", "career": ["Ajax", "Real Madrid", "Inter", "Galatasaray", "Nice", "Al-Gharafa"], "difficulty": "orta"},
    {"name": "Robinho", "career": ["Santos", "Real Madrid", "Manchester City", "AC Milan", "Santos", "Guangzhou", "AC Milan", "Atletico Mineiro", "Sivasspor"], "difficulty": "orta"},
    {"name": "Lucas Moura", "career": ["Sao Paulo", "PSG", "Tottenham", "Sao Paulo"], "difficulty": "orta"},
    {"name": "Ander Herrera", "career": ["Real Zaragoza", "Athletic Bilbao", "Manchester United", "PSG", "Athletic Bilbao", "Boca Juniors"], "difficulty": "orta"},
    {"name": "Nolito", "career": ["Barcelona B", "Benfica", "Granada", "Celta Vigo", "Manchester City", "Sevilla", "Celta Vigo"], "difficulty": "orta"},
    {"name": "Malcom", "career": ["Corinthians", "Bordeaux", "Barcelona", "Zenit", "Al-Hilal"], "difficulty": "orta"},
    {"name": "Depay", "career": ["PSV", "Manchester United", "Lyon", "Barcelona", "Atletico Madrid", "Corinthians"], "difficulty": "orta"},
    {"name": "Jese", "career": ["Real Madrid", "PSG", "Las Palmas", "Stoke", "Real Betis", "Sporting", "Ankaragucu"], "difficulty": "orta"},
    {"name": "Aspas", "career": ["Celta Vigo", "Liverpool", "Sevilla", "Celta Vigo"], "difficulty": "orta"},
    {"name": "Morata", "career": ["Real Madrid", "Juventus", "Chelsea", "Atletico Madrid", "Juventus", "Atletico Madrid", "AC Milan", "Galatasaray"], "difficulty": "orta"},
    {"name": "Callejon", "career": ["Espanyol", "Real Madrid", "Napoli", "Fiorentina", "Granada"], "difficulty": "orta"},
    {"name": "Hummels", "career": ["Bayern Munih", "Borussia Dortmund", "Bayern Munih", "Borussia Dortmund", "Roma"], "difficulty": "orta"},
    {"name": "Piszczek", "career": ["Hertha Berlin", "Borussia Dortmund", "Goczalkowice"], "difficulty": "orta"},
    {"name": "Subotic", "career": ["Mainz", "Borussia Dortmund", "Koln", "Saint Etienne", "Union Berlin", "Denizlispor"], "difficulty": "orta"},
    {"name": "Perisic", "career": ["Sochaux", "Club Brugge", "Borussia Dortmund", "Wolfsburg", "Inter", "Bayern Munih", "Inter", "Tottenham", "Hajduk Split"], "difficulty": "orta"},
    {"name": "Rakitic", "career": ["Basel", "Schalke", "Sevilla", "Barcelona", "Sevilla", "Al-Shabab"], "difficulty": "orta"},
    {"name": "Vidal", "career": ["Colo Colo", "Bayer Leverkusen", "Juventus", "Bayern Munih", "Barcelona", "Inter", "Flamengo", "Athletico Paranaense"], "difficulty": "orta"},
    {"name": "Alexis Sanchez", "career": ["Cobreloa", "Udinese", "Barcelona", "Arsenal", "Manchester United", "Inter", "Marseille", "Inter", "Udinese"], "difficulty": "orta"},
    {"name": "Bravo", "career": ["Colo Colo", "Real Sociedad", "Barcelona", "Manchester City", "Real Betis", "Colo Colo"], "difficulty": "orta"},
    {"name": "Medel", "career": ["Universidad Catolica", "Boca Juniors", "Sevilla", "Cardiff", "Inter", "Besiktas", "Bologna", "Vasco da Gama"], "difficulty": "orta"},
    {"name": "Vertonghen", "career": ["Ajax", "Tottenham", "Benfica", "Anderlecht"], "difficulty": "orta"},
    {"name": "Alderweireld", "career": ["Ajax", "Atletico Madrid", "Southampton", "Tottenham", "Al-Duhail", "Antwerp"], "difficulty": "orta"},
    {"name": "Witsel", "career": ["Standard Liege", "Benfica", "Zenit", "Tianjin", "Borussia Dortmund", "Atletico Madrid"], "difficulty": "orta"},
    {"name": "De Jong Frenkie", "career": ["Ajax", "Barcelona"], "difficulty": "orta"},
    {"name": "De Ligt", "career": ["Ajax", "Juventus", "Bayern Munih", "Manchester United"], "difficulty": "orta"},
    {"name": "Bergwijn", "career": ["PSV", "Tottenham", "Ajax"], "difficulty": "orta"},
    {"name": "Malen", "career": ["Arsenal", "PSV", "Borussia Dortmund", "Aston Villa"], "difficulty": "orta"},
    {"name": "Wijnaldum", "career": ["Feyenoord", "PSV", "Newcastle", "Liverpool", "PSG", "Roma", "Al-Ettifaq"], "difficulty": "orta"},

    # ============================================
    # ZOR - Az bilinen ama kariyeri karakteristik
    # ============================================
    {"name": "Cengiz Under", "career": ["Basaksehir", "Roma", "Marseille"], "difficulty": "zor"},
    {"name": "Hamit Altintop", "career": ["Schalke", "Bayern Munih", "Real Madrid", "Galatasaray"], "difficulty": "zor"},
    {"name": "Emre Belozoglu", "career": ["Galatasaray", "Inter", "Newcastle", "Fenerbahce", "Atletico Madrid", "Basaksehir"], "difficulty": "zor"},
    {"name": "Tuncay Sanli", "career": ["Sakaryaspor", "Fenerbahce", "Middlesbrough"], "difficulty": "zor"},
    {"name": "Nuri Sahin", "career": ["Borussia Dortmund", "Feyenoord", "Real Madrid", "Liverpool", "Borussia Dortmund", "Werder Bremen"], "difficulty": "zor"},
    {"name": "Kanu", "career": ["Ajax", "Inter", "Arsenal", "West Bromwich", "Portsmouth"], "difficulty": "zor"},

    # ============================================
    # ZOR - Az bilinen kariyerler / eski oyuncular
    # ============================================
    {"name": "Anelka", "career": ["PSG", "Arsenal", "Real Madrid", "PSG", "Liverpool", "Manchester City", "Fenerbahce", "Bolton", "Chelsea", "Shanghai Shenhua", "Juventus", "West Bromwich", "Mumbai City"], "difficulty": "zor"},
    {"name": "Crespo", "career": ["River Plate", "Parma", "Lazio", "Inter", "Chelsea", "AC Milan", "Chelsea", "Inter", "Genoa", "Parma"], "difficulty": "zor"},
    {"name": "Batistuta", "career": ["Newells Old Boys", "River Plate", "Boca Juniors", "Fiorentina", "Roma", "Inter", "Al-Arabi"], "difficulty": "zor"},
    {"name": "Veron", "career": ["Estudiantes", "Boca Juniors", "Sampdoria", "Parma", "Lazio", "Manchester United", "Chelsea", "Inter", "Estudiantes"], "difficulty": "zor"},
    {"name": "Riquelme", "career": ["Argentinos Juniors", "Boca Juniors", "Barcelona", "Villarreal", "Boca Juniors", "Argentinos Juniors"], "difficulty": "zor"},
    {"name": "Recoba", "career": ["Danubio", "Nacional", "Inter", "Venezia", "Inter", "Torino", "Panionios", "Nacional", "Danubio"], "difficulty": "zor"},
    {"name": "Zamorano", "career": ["Cobresal", "St Gallen", "Bologna", "Sevilla", "Real Madrid", "Inter", "America"], "difficulty": "zor"},
    {"name": "Salas", "career": ["Universidad Chile", "River Plate", "Lazio", "Juventus", "River Plate", "Universidad Chile"], "difficulty": "zor"},
    {"name": "Palermo Martin", "career": ["Estudiantes", "Boca Juniors", "Villarreal", "Real Betis", "Alaves", "Boca Juniors"], "difficulty": "zor"},
    {"name": "Aimar", "career": ["River Plate", "Valencia", "Zaragoza", "Benfica", "Malaysia", "Estudiantes"], "difficulty": "zor"},
    {"name": "Bergkamp", "career": ["Ajax", "Inter", "Arsenal"], "difficulty": "zor"},
    {"name": "Overmars", "career": ["Go Ahead Eagles", "Willem II", "Ajax", "Arsenal", "Barcelona", "Go Ahead Eagles"], "difficulty": "zor"},
    {"name": "Kluivert", "career": ["Ajax", "AC Milan", "Barcelona", "Newcastle", "Valencia", "PSV", "Lille"], "difficulty": "zor"},
    {"name": "Seedorf", "career": ["Ajax", "Sampdoria", "Real Madrid", "Inter", "AC Milan", "Botafogo"], "difficulty": "zor"},
    {"name": "Davids", "career": ["Ajax", "AC Milan", "Juventus", "Barcelona", "Inter", "Tottenham", "Ajax", "Crystal Palace", "Barnet"], "difficulty": "zor"},
    {"name": "Rijkaard", "career": ["Ajax", "Sporting", "Real Zaragoza", "AC Milan", "Ajax"], "difficulty": "zor"},
    {"name": "Van Basten", "career": ["Ajax", "AC Milan"], "difficulty": "zor"},
    {"name": "Gullit", "career": ["Haarlem", "Feyenoord", "PSV", "AC Milan", "Sampdoria", "AC Milan", "Sampdoria", "Chelsea"], "difficulty": "zor"},
    {"name": "Cruyff", "career": ["Ajax", "Barcelona", "LA Aztecs", "Washington", "Levante", "Ajax", "Feyenoord"], "difficulty": "zor"},
    {"name": "Weah", "career": ["Tonnerre", "Monaco", "PSG", "AC Milan", "Chelsea", "Manchester City", "Marseille", "Al-Jazira"], "difficulty": "zor"},
    {"name": "Blanc", "career": ["Montpellier", "Napoli", "Nimes", "Saint Etienne", "Auxerre", "Barcelona", "Marseille", "Inter", "Manchester United"], "difficulty": "zor"},
    {"name": "Deschamps", "career": ["Nantes", "Marseille", "Bordeaux", "Marseille", "Juventus", "Chelsea", "Valencia"], "difficulty": "zor"},
    {"name": "Petit", "career": ["Monaco", "Arsenal", "Barcelona", "Chelsea"], "difficulty": "zor"},
    {"name": "Karembeu", "career": ["Nantes", "Sampdoria", "Real Madrid", "Middlesbrough", "Olympiakos", "Servette"], "difficulty": "zor"},
    {"name": "Djorkaeff", "career": ["Grenoble", "Strasbourg", "Monaco", "PSG", "Inter", "Kaiserslautern", "Bolton", "Blackburn"], "difficulty": "zor"},
    {"name": "Desailly", "career": ["Nantes", "Marseille", "AC Milan", "Chelsea", "Al-Gharafa", "Qatar SC"], "difficulty": "zor"},
    {"name": "Barthez", "career": ["Toulouse", "Marseille", "Monaco", "Manchester United", "Marseille", "Nantes"], "difficulty": "zor"},
    {"name": "Vieira", "career": ["Cannes", "AC Milan", "Arsenal", "Juventus", "Inter", "Manchester City"], "difficulty": "zor"},
    {"name": "Makelele", "career": ["Nantes", "Marseille", "Celta Vigo", "Real Madrid", "Chelsea", "PSG"], "difficulty": "zor"},
    {"name": "Trezeguet", "career": ["Platense", "Monaco", "Juventus", "Hercules", "Baniyas", "River Plate", "Newells Old Boys"], "difficulty": "zor"},
    {"name": "Wiltord", "career": ["Rennes", "Deportivo", "Bordeaux", "Arsenal", "Lyon", "Rennes", "Marseille", "Metz", "Nantes"], "difficulty": "zor"},
    {"name": "Pires", "career": ["Metz", "Marseille", "Arsenal", "Villarreal", "Aston Villa"], "difficulty": "zor"},
    {"name": "Cisse Djibril", "career": ["Auxerre", "Liverpool", "Marseille", "Sunderland", "Panathinaikos", "Lazio", "QPR", "Kuban Krasnodar", "Bastia", "Al-Gharafa"], "difficulty": "zor"},
    {"name": "Micoud", "career": ["Bordeaux", "Parma", "Werder Bremen", "Bordeaux", "Al-Rayyan"], "difficulty": "zor"},
    {"name": "Govou", "career": ["Lyon", "Panathinaikos", "Evian", "Al-Shabab"], "difficulty": "zor"},
    {"name": "Reyes Jose Antonio", "career": ["Sevilla", "Arsenal", "Real Madrid", "Atletico Madrid", "Benfica", "Sevilla", "Espanyol", "Cordoba", "Extremadura"], "difficulty": "zor"},
    {"name": "Guti", "career": ["Real Madrid", "Besiktas"], "difficulty": "zor"},
    {"name": "Morientes", "career": ["Real Zaragoza", "Real Madrid", "Monaco", "Liverpool", "Valencia", "Marseille"], "difficulty": "zor"},
    {"name": "Solari", "career": ["River Plate", "Atletico Madrid", "Real Madrid", "Inter", "San Lorenzo"], "difficulty": "zor"},
    {"name": "Ronaldinho Jr", "career": ["Gremio", "PSG", "Barcelona", "AC Milan", "Flamengo", "Atletico Mineiro", "Queretaro", "Fluminense"], "difficulty": "zor"},
    {"name": "Ze Roberto", "career": ["Portuguesa", "Real Madrid", "Bayer Leverkusen", "Bayern Munih", "Santos", "Hamburg", "Al-Gharafa", "Gremio", "Palmeiras"], "difficulty": "zor"},
    {"name": "Denilson", "career": ["Sao Paulo", "Real Betis", "Bordeaux", "Sao Paulo", "FC Dallas", "Palmeiras", "Vitoria", "Hai Phong"], "difficulty": "zor"},
    {"name": "Juninho Pernambucano", "career": ["Sport Recife", "Vasco da Gama", "Lyon", "Al-Gharafa", "Vasco da Gama", "New York Red Bulls"], "difficulty": "zor"},
    {"name": "Emerson", "career": ["Gremio", "Bayer Leverkusen", "Roma", "Juventus", "Real Madrid", "AC Milan"], "difficulty": "zor"},
    {"name": "Lucio", "career": ["Internacional", "Bayer Leverkusen", "Bayern Munih", "Inter", "Juventus", "Sao Paulo", "Palmeiras", "FC Goa", "Brasiliense"], "difficulty": "zor"},
    {"name": "Anderson", "career": ["Gremio", "Porto", "Manchester United", "Fiorentina", "Internacional", "Coritiba"], "difficulty": "zor"},
    {"name": "Elano", "career": ["Santos", "Shakhtar Donetsk", "Manchester City", "Galatasaray", "Santos", "Gremio", "Flamengo", "Chapecoense"], "difficulty": "zor"},
    {"name": "Simao", "career": ["Sporting", "Barcelona", "Benfica", "Atletico Madrid", "Besiktas"], "difficulty": "zor"},
    {"name": "Pauleta", "career": ["Estoril", "Salamanca", "Deportivo", "Bordeaux", "PSG"], "difficulty": "zor"},
    {"name": "Nuno Gomes", "career": ["Boavista", "Benfica", "Fiorentina", "Benfica", "Braga", "Blackburn"], "difficulty": "zor"},
    {"name": "Rui Costa", "career": ["Benfica", "Fiorentina", "AC Milan", "Benfica"], "difficulty": "zor"},
    {"name": "Petit Portuguese", "career": ["Boavista", "Marseille", "Benfica", "Bolton", "Zurique", "Vitoria"], "difficulty": "zor"},
    {"name": "Costinha", "career": ["Nacional", "Monaco", "Porto", "Dynamo Moscow", "Atletico Madrid"], "difficulty": "zor"},
    {"name": "Maniche", "career": ["Benfica", "Alverca", "Porto", "Dynamo Moscow", "Chelsea", "Atletico Madrid", "Inter", "Koln", "Sporting", "Kavala"], "difficulty": "zor"},
    {"name": "Postiga", "career": ["Porto", "Tottenham", "Porto", "Panathinaikos", "Sporting", "Real Zaragoza", "Valencia", "Lazio", "Rangers", "Antalyaspor", "Deportivo", "Atromitos"], "difficulty": "zor"},
    {"name": "Almeida", "career": ["Sporting Braga", "Porto", "Werder Bremen", "Besiktas", "Hannover"], "difficulty": "zor"},
    {"name": "Meireles", "career": ["Porto", "Liverpool", "Chelsea", "Fenerbahce"], "difficulty": "zor"},
    {"name": "Amoroso", "career": ["Guarani", "Verona", "Udinese", "Parma", "Borussia Dortmund", "Malaga", "Corinthians", "Sao Paulo", "Grasshoppers", "Aris"], "difficulty": "zor"},
    {"name": "Vieri Christian", "career": ["Torino", "Pisa", "Ravenna", "Venezia", "Atalanta", "Juventus", "Atletico Madrid", "Lazio", "Inter", "AC Milan", "Monaco", "Sampdoria", "Atalanta", "Fiorentina"], "difficulty": "zor"},
    {"name": "Delvecchio", "career": ["Inter", "Roma", "Brescia", "Parma", "Ascoli", "Mantova", "Perugia"], "difficulty": "zor"},
    {"name": "Aldair", "career": ["Flamengo", "Benfica", "Roma", "Genoa", "Messina", "Murcia", "Vasco da Gama"], "difficulty": "zor"},
    {"name": "Costacurta", "career": ["AC Milan", "Monza"], "difficulty": "zor"},
    {"name": "Albertini", "career": ["AC Milan", "Padova", "Atletico Madrid", "Lazio", "Atalanta", "Barcelona"], "difficulty": "zor"},
    {"name": "Boban", "career": ["Dinamo Zagreb", "Bari", "AC Milan", "Celta Vigo"], "difficulty": "zor"},
    {"name": "Papin", "career": ["Valenciennes", "Club Brugge", "Marseille", "AC Milan", "Bayern Munih", "Bordeaux", "Guingamp"], "difficulty": "zor"},
    {"name": "Weah George", "career": ["Tonnerre", "Monaco", "PSG", "AC Milan", "Chelsea", "Manchester City", "Marseille", "Al-Jazira"], "difficulty": "zor"},
    {"name": "Boksic", "career": ["Hajduk Split", "Cannes", "Marseille", "Lazio", "Juventus", "Lazio", "Middlesbrough"], "difficulty": "zor"},
    {"name": "Prosinecki", "career": ["Red Star", "Real Madrid", "Real Oviedo", "Barcelona", "Sevilla", "Croatia Zagreb", "Standard Liege", "Portsmouth", "NK Zagreb"], "difficulty": "zor"},
    {"name": "Suker", "career": ["Osijek", "Dinamo Zagreb", "Sevilla", "Real Madrid", "Arsenal", "West Ham", "Munih 1860"], "difficulty": "zor"},
    {"name": "Bilic", "career": ["Hajduk Split", "Karlsruher", "West Ham", "Everton", "Hajduk Split"], "difficulty": "zor"},
    {"name": "Modric Luka", "career": ["Dinamo Zagreb", "Zrinjski", "Inter Zapresic", "Dinamo Zagreb", "Tottenham", "Real Madrid"], "difficulty": "zor"},
    {"name": "Kovacic", "career": ["Dinamo Zagreb", "Inter", "Real Madrid", "Chelsea", "Manchester City"], "difficulty": "zor"},
    {"name": "Mandzukic", "career": ["Marsonia", "Zagreb", "Dinamo Zagreb", "Wolfsburg", "Bayern Munih", "Atletico Madrid", "Juventus", "Al-Duhail", "AC Milan"], "difficulty": "zor"},
    {"name": "Olic", "career": ["Marsonia", "Hertha Berlin", "Zagreb", "CSKA Moskova", "Hamburg", "Bayern Munih", "Wolfsburg", "Hamburg", "TSV 1860"], "difficulty": "zor"},
    {"name": "Kranjcar", "career": ["Dinamo Zagreb", "Hajduk Split", "Portsmouth", "Tottenham", "QPR", "Dynamo Kyiv", "New York Cosmos", "Rangers"], "difficulty": "zor"},
    {"name": "Corluka", "career": ["Dinamo Zagreb", "Inter Zapresic", "Manchester City", "Tottenham", "Bayer Leverkusen", "Lokomotiv Moskova"], "difficulty": "zor"},
    {"name": "Srna", "career": ["Hajduk Split", "Shakhtar Donetsk", "Cagliari"], "difficulty": "zor"},
    {"name": "Ilhan Mansiz", "career": ["Samsunspor", "Antalyaspor", "Bochum", "Besiktas", "Hertha Berlin", "Kayserispor", "Ankaraspor", "Konyaspor"], "difficulty": "zor"},
    {"name": "Umit Karan", "career": ["Sarayonu", "Konyaspor", "Galatasaray", "Adana Demirspor", "Trabzonspor", "MKE Ankaragucu", "Malatyaspor", "Sivasspor", "Antalyaspor", "Denizlispor"], "difficulty": "zor"},
    {"name": "Nihat Kahveci", "career": ["Besiktas", "Real Sociedad", "Villarreal", "Besiktas"], "difficulty": "zor"},
    {"name": "Alpay Ozalan", "career": ["Altay", "Besiktas", "Fenerbahce", "Aston Villa", "Celta Vigo", "Koln", "Urawa Red", "Vestel Manisaspor"], "difficulty": "zor"},
    {"name": "Bulent Korkmaz", "career": ["Galatasaray", "Konyaspor"], "difficulty": "zor"},
    {"name": "Sergen Yalcin", "career": ["Besiktas", "Istanbulspor", "Fenerbahce", "Besiktas", "Trabzonspor", "Genclerbirligi", "Eskisehirspor"], "difficulty": "zor"},
    {"name": "Okan Buruk", "career": ["Fatih Karagumruk", "Sariyer", "Galatasaray", "Inter", "Galatasaray", "Genclerbirligi", "Basaksehir"], "difficulty": "zor"},
    {"name": "Rustu Recber", "career": ["Antalyaspor", "Fenerbahce", "Barcelona", "Fenerbahce", "Besiktas"], "difficulty": "zor"},
    {"name": "Suat Kaya", "career": ["Ankaragucu", "Galatasaray", "Trabzonspor"], "difficulty": "zor"},
    {"name": "Tugay Kerimoglu", "career": ["Galatasaray", "Rangers", "Blackburn"], "difficulty": "zor"},
    {"name": "Yildiray Basturk", "career": ["Bochum", "Bayer Leverkusen", "Hertha Berlin", "Stuttgart", "Blackburn", "Rangers"], "difficulty": "zor"},
    {"name": "Umit Davala", "career": ["Kartalspor", "Sariyer", "Galatasaray", "AC Milan", "Inter", "Werder Bremen", "Manisaspor"], "difficulty": "zor"},
    {"name": "Semih Senturk", "career": ["Fenerbahce", "Istanbulspor", "Fenerbahce", "Eskisehirspor", "Trabzonspor", "Bursaspor", "Antalyaspor"], "difficulty": "zor"},
    {"name": "Selcuk Sahin", "career": ["Fenerbahce", "Malatyaspor", "Fenerbahce", "Yeni Malatyaspor"], "difficulty": "zor"},
    {"name": "Gokdeniz Karadeniz", "career": ["Trabzonspor", "Rubin Kazan"], "difficulty": "zor"},
    {"name": "Mehmet Aurelio", "career": ["Portuguesa", "Sao Caetano", "Trabzonspor", "Fenerbahce", "Real Betis", "Vasco da Gama"], "difficulty": "zor"},
    {"name": "Fatih Tekke", "career": ["Genclerbirligi", "Karsiyaka", "Trabzonspor", "Zenit", "Rapid Vienna", "Bursaspor", "Trabzonspor"], "difficulty": "zor"},
    {"name": "Abdullah Avci", "career": ["Kartalspor", "Vefa"], "difficulty": "zor"},
    {"name": "Yusuf Simsek", "career": ["Genclerbirligi", "Fenerbahce", "Trabzonspor", "Bursaspor", "Konyaspor", "Denizlispor"], "difficulty": "zor"},
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


def get_players_by_difficulty(difficulty):
    """Zorluk seviyesine gore futbolcu listesi"""
    return [p for p in ALL_PLAYERS if p.get("difficulty") == difficulty]


# Test
if __name__ == "__main__":
    print(f"Toplam futbolcu sayisi: {len(ALL_PLAYERS)}")
    kolay = get_players_by_difficulty("kolay")
    orta = get_players_by_difficulty("orta")
    zor = get_players_by_difficulty("zor")
    print(f"Kolay: {len(kolay)}, Orta: {len(orta)}, Zor: {len(zor)}")