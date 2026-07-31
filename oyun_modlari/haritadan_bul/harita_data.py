"""
Haritadan Bul - Ülke koordinatları ve alias verileri
"""

COUNTRIES = {
    # ============ AVRUPA ============
    "Turkiye":          {"x": 0.565, "y": 0.260, "tr": "Türkiye", "iso": "Turkey"},
    "Almanya":          {"x": 0.500, "y": 0.183, "tr": "Almanya", "iso": "DE"},
    "Ingiltere":        {"x": 0.470, "y": 0.170, "tr": "İngiltere", "iso": "United Kingdom"},
    "Fransa":           {"x": 0.482, "y": 0.210, "tr": "Fransa", "iso": "France"},
    "Ispanya":          {"x": 0.463, "y": 0.246, "tr": "İspanya", "iso": "ES"},
    "Italya":           {"x": 0.502, "y": 0.232, "tr": "İtalya", "iso": "Italy"},
    "Portekiz":         {"x": 0.449, "y": 0.259, "tr": "Portekiz", "iso": "PT"},
    "Hollanda":         {"x": 0.487, "y": 0.177, "tr": "Hollanda", "iso": "NL"},
    "Belcika":          {"x": 0.486, "y": 0.190, "tr": "Belçika", "iso": "BE"},
    "Isvicre":          {"x": 0.494, "y": 0.209, "tr": "İsviçre", "iso": "CH"},
    "Avusturya":        {"x": 0.509, "y": 0.207, "tr": "Avusturya", "iso": "AT"},
    "Polonya":          {"x": 0.518, "y": 0.178, "tr": "Polonya", "iso": "PL"},
    "Cekya":            {"x": 0.512, "y": 0.194, "tr": "Çekya", "iso": "CZ"},
    "Macaristan":       {"x": 0.522, "y": 0.211, "tr": "Macaristan", "iso": "HU"},
    "Hirvatistan":      {"x": 0.515, "y": 0.218, "tr": "Hırvatistan", "iso": "HR"},
    "Sirbistan":        {"x": 0.524, "y": 0.226, "tr": "Sırbistan", "iso": "RS"},
    "Yunanistan":       {"x": 0.535, "y": 0.265, "tr": "Yunanistan", "iso": "Greece"},
    "Romanya":          {"x": 0.536, "y": 0.219, "tr": "Romanya", "iso": "RO"},
    "Bulgaristan":      {"x": 0.537, "y": 0.236, "tr": "Bulgaristan", "iso": "BG"},
    "Ukrayna":          {"x": 0.544, "y": 0.191, "tr": "Ukrayna", "iso": "UA"},
    "Rusya":            {"x": 0.610, "y": 0.148, "tr": "Rusya", "iso": "Russian Federation"},
    "Norvec":           {"x": 0.494, "y": 0.125, "tr": "Norveç", "iso": "Norway"},
    "Isvec":            {"x": 0.511, "y": 0.125, "tr": "İsveç", "iso": "SE"},
    "Danimarka":        {"x": 0.497, "y": 0.155, "tr": "Danimarka", "iso": "Denmark"},
    "Finlandiya":       {"x": 0.532, "y": 0.114, "tr": "Finlandiya", "iso": "FI"},
    "Iskocya":          {"x": 0.466, "y": 0.147, "tr": "İskoçya", "iso": "United Kingdom"},
    "Irlanda":          {"x": 0.456, "y": 0.172, "tr": "İrlanda", "iso": "IE"},
    "Galler":           {"x": 0.463, "y": 0.179, "tr": "Galler", "iso": "United Kingdom"},
    "Izlanda":          {"x": 0.442, "y": 0.115, "tr": "İzlanda", "iso": "IS"},
    "Arnavutluk":       {"x": 0.528, "y": 0.240, "tr": "Arnavutluk", "iso": "AL"},
    "Bosna Hersek":     {"x": 0.517, "y": 0.223, "tr": "Bosna Hersek", "iso": "BA"},
    "Karadag":          {"x": 0.521, "y": 0.232, "tr": "Karadağ", "iso": "ME"},
    "Kuzey Makedonya":  {"x": 0.531, "y": 0.240, "tr": "Kuzey Makedonya", "iso": "MK"},
    "Slovenya":         {"x": 0.510, "y": 0.213, "tr": "Slovenya", "iso": "SI"},
    "Slovakya":         {"x": 0.520, "y": 0.198, "tr": "Slovakya", "iso": "SK"},
    "Estonya":          {"x": 0.535, "y": 0.150, "tr": "Estonya", "iso": "EE"},
    "Letonya":          {"x": 0.534, "y": 0.158, "tr": "Letonya", "iso": "LV"},
    "Litvanya":         {"x": 0.528, "y": 0.166, "tr": "Litvanya", "iso": "LT"},
    "Belarus":          {"x": 0.542, "y": 0.170, "tr": "Belarus", "iso": "BY"},
    "Moldova":          {"x": 0.546, "y": 0.204, "tr": "Moldova", "iso": "MD"},
    "Kosova":           {"x": 0.526, "y": 0.234, "tr": "Kosova", "iso": "XK"},
    "Luksemburg":       {"x": 0.491, "y": 0.195, "tr": "Lüksemburg", "iso": "LU"},

    # ============ GÜNEY AMERİKA ============
    "Brezilya":         {"x": 0.338, "y": 0.618, "tr": "Brezilya", "iso": "BR"},
    "Arjantin":         {"x": 0.302, "y": 0.715, "tr": "Arjantin", "iso": "Argentina"},
    "Uruguay":          {"x": 0.324, "y": 0.708, "tr": "Uruguay", "iso": "UY"},
    "Sili":             {"x": 0.292, "y": 0.748, "tr": "Şili", "iso": "Chile"},
    "Kolombiya":        {"x": 0.270, "y": 0.477, "tr": "Kolombiya", "iso": "CO"},
    "Peru":             {"x": 0.263, "y": 0.561, "tr": "Peru", "iso": "PE"},
    "Ekvador":          {"x": 0.253, "y": 0.508, "tr": "Ekvador", "iso": "EC"},
    "Paraguay":         {"x": 0.313, "y": 0.641, "tr": "Paraguay", "iso": "PY"},
    "Venezuela":        {"x": 0.279, "y": 0.445, "tr": "Venezuela", "iso": "VE"},
    "Bolivya":          {"x": 0.290, "y": 0.620, "tr": "Bolivya", "iso": "BO"},
    "Surinam":          {"x": 0.320, "y": 0.475, "tr": "Surinam", "iso": "SR"},
    "Guyana":           {"x": 0.310, "y": 0.470, "tr": "Guyana", "iso": "GY"},
    "Fransiz Guyanasi": {"x": 0.325, "y": 0.480, "tr": "Fransız Guyanası", "iso": "GF"},

    # ============ KUZEY AMERİKA ============
    "ABD":              {"x": 0.209, "y": 0.255, "tr": "ABD", "iso": "United States"},
    "Meksika":          {"x": 0.197, "y": 0.348, "tr": "Meksika", "iso": "MX"},
    "Kanada":           {"x": 0.238, "y": 0.138, "tr": "Kanada", "iso": "Canada"},
    "Kuba":             {"x": 0.265, "y": 0.365, "tr": "Küba", "iso": "CU"},
    "Jamaika":          {"x": 0.267, "y": 0.385, "tr": "Jamaika", "iso": "JM"},
    "Haiti":            {"x": 0.283, "y": 0.383, "tr": "Haiti", "iso": "HT"},
    "Dominik Cumhuriyeti":{"x": 0.290, "y": 0.383, "tr": "Dominik Cumhuriyeti", "iso": "DO"},
    "Guatemala":        {"x": 0.234, "y": 0.402, "tr": "Guatemala", "iso": "GT"},
    "Honduras":         {"x": 0.245, "y": 0.410, "tr": "Honduras", "iso": "HN"},
    "El Salvador":      {"x": 0.239, "y": 0.415, "tr": "El Salvador", "iso": "SV"},
    "Nikaragua":        {"x": 0.250, "y": 0.420, "tr": "Nikaragua", "iso": "NI"},
    "Kosta Rika":       {"x": 0.253, "y": 0.435, "tr": "Kosta Rika", "iso": "CR"},
    "Panama":           {"x": 0.263, "y": 0.445, "tr": "Panama", "iso": "PA"},
    "Belize":           {"x": 0.240, "y": 0.395, "tr": "Belize", "iso": "BZ"},
    "Gronland":         {"x": 0.360, "y": 0.070, "tr": "Grönland", "iso": "GL"},

    # ============ AFRİKA ============
    "Misir":            {"x": 0.550, "y": 0.334, "tr": "Mısır", "iso": "EG"},
    "Fas":              {"x": 0.452, "y": 0.304, "tr": "Fas", "iso": "MA"},
    "Cezayir":          {"x": 0.477, "y": 0.323, "tr": "Cezayir", "iso": "DZ"},
    "Tunus":            {"x": 0.497, "y": 0.282, "tr": "Tunus", "iso": "TN"},
    "Libya":            {"x": 0.520, "y": 0.335, "tr": "Libya", "iso": "LY"},
    "Sudan":            {"x": 0.550, "y": 0.410, "tr": "Sudan", "iso": "SD"},
    "Guney Sudan":      {"x": 0.545, "y": 0.450, "tr": "Güney Sudan", "iso": "SS"},
    "Bati Sahra":       {"x": 0.440, "y": 0.335, "tr": "Batı Sahra", "iso": "EH"},
    "Moritanya":        {"x": 0.445, "y": 0.375, "tr": "Moritanya", "iso": "MR"},
    "Mali":             {"x": 0.470, "y": 0.395, "tr": "Mali", "iso": "ML"},
    "Nijer":            {"x": 0.500, "y": 0.400, "tr": "Nijer", "iso": "NE"},
    "Cad":              {"x": 0.525, "y": 0.410, "tr": "Çad", "iso": "TD"},
    "Etiyopya":         {"x": 0.590, "y": 0.450, "tr": "Etiyopya", "iso": "ET"},
    "Eritre":           {"x": 0.585, "y": 0.420, "tr": "Eritre", "iso": "ER"},
    "Cibuti":           {"x": 0.605, "y": 0.435, "tr": "Cibuti", "iso": "DJ"},
    "Somali":           {"x": 0.625, "y": 0.470, "tr": "Somali", "iso": "SO"},
    "Kenya":            {"x": 0.585, "y": 0.500, "tr": "Kenya", "iso": "KE"},
    "Uganda":           {"x": 0.570, "y": 0.495, "tr": "Uganda", "iso": "UG"},
    "Ruanda":           {"x": 0.565, "y": 0.505, "tr": "Ruanda", "iso": "RW"},
    "Burundi":          {"x": 0.565, "y": 0.515, "tr": "Burundi", "iso": "BI"},
    "Tanzanya":         {"x": 0.575, "y": 0.535, "tr": "Tanzanya", "iso": "TZ"},
    "Kongo DC":         {"x": 0.535, "y": 0.505, "tr": "Kongo DC", "iso": "CD"},
    "Kongo":            {"x": 0.515, "y": 0.500, "tr": "Kongo", "iso": "CG"},
    "Orta Afrika Cum.": {"x": 0.535, "y": 0.465, "tr": "Orta Afrika Cumhuriyeti", "iso": "CF"},
    "Angola":           {"x": 0.525, "y": 0.575, "tr": "Angola", "iso": "Angola"},
    "Zambiya":          {"x": 0.555, "y": 0.580, "tr": "Zambiya", "iso": "ZM"},
    "Zimbabve":         {"x": 0.560, "y": 0.615, "tr": "Zimbabve", "iso": "ZW"},
    "Mozambik":         {"x": 0.578, "y": 0.610, "tr": "Mozambik", "iso": "MZ"},
    "Namibya":          {"x": 0.530, "y": 0.640, "tr": "Namibya", "iso": "NA"},
    "Botsvana":         {"x": 0.550, "y": 0.650, "tr": "Botsvana", "iso": "BW"},
    "Madagaskar":       {"x": 0.615, "y": 0.615, "tr": "Madagaskar", "iso": "MG"},
    "Malavi":           {"x": 0.573, "y": 0.585, "tr": "Malavi", "iso": "MW"},
    "Lesotho":          {"x": 0.555, "y": 0.685, "tr": "Lesotho", "iso": "LS"},
    "Esvatini":         {"x": 0.563, "y": 0.673, "tr": "Esvatini", "iso": "SZ"},
    "Guney Afrika":     {"x": 0.536, "y": 0.686, "tr": "Güney Afrika", "iso": "ZA"},
    "Senegal":          {"x": 0.433, "y": 0.412, "tr": "Senegal", "iso": "SN"},
    "Gambiya":          {"x": 0.427, "y": 0.420, "tr": "Gambiya", "iso": "GM"},
    "Gine":             {"x": 0.443, "y": 0.435, "tr": "Gine", "iso": "GN"},
    "Gine Bissau":      {"x": 0.430, "y": 0.428, "tr": "Gine-Bissau", "iso": "GW"},
    "Sierra Leone":     {"x": 0.440, "y": 0.445, "tr": "Sierra Leone", "iso": "SL"},
    "Liberya":          {"x": 0.448, "y": 0.455, "tr": "Liberya", "iso": "LR"},
    "Fildisi Sahili":   {"x": 0.455, "y": 0.453, "tr": "Fildişi Sahili", "iso": "CI"},
    "Gana":             {"x": 0.467, "y": 0.452, "tr": "Gana", "iso": "GH"},
    "Togo":             {"x": 0.475, "y": 0.450, "tr": "Togo", "iso": "TG"},
    "Benin":            {"x": 0.481, "y": 0.448, "tr": "Benin", "iso": "BJ"},
    "Nijerya":          {"x": 0.492, "y": 0.439, "tr": "Nijerya", "iso": "NG"},
    "Kamerun":          {"x": 0.505, "y": 0.469, "tr": "Kamerun", "iso": "CM"},
    "Gabon":            {"x": 0.510, "y": 0.495, "tr": "Gabon", "iso": "GA"},
    "Ekvator Ginesi":   {"x": 0.502, "y": 0.485, "tr": "Ekvator Ginesi", "iso": "GQ"},
    "Burkina Faso":     {"x": 0.470, "y": 0.428, "tr": "Burkina Faso", "iso": "BF"},

    # ============ ORTA DOĞU ============
    "Iran":             {"x": 0.614, "y": 0.290, "tr": "İran", "iso": "IR"},
    "Irak":             {"x": 0.590, "y": 0.295, "tr": "Irak", "iso": "IQ"},
    "Suriye":           {"x": 0.577, "y": 0.278, "tr": "Suriye", "iso": "SY"},
    "Israil":           {"x": 0.570, "y": 0.302, "tr": "İsrail", "iso": "IL"},
    "Filistin":         {"x": 0.572, "y": 0.303, "tr": "Filistin", "iso": "PS"},
    "Lubnan":           {"x": 0.573, "y": 0.290, "tr": "Lübnan", "iso": "LB"},
    "Urdun":            {"x": 0.577, "y": 0.305, "tr": "Ürdün", "iso": "JO"},
    "Suudi Arabistan":  {"x": 0.586, "y": 0.344, "tr": "Suudi Arabistan", "iso": "SA"},
    "Yemen":            {"x": 0.610, "y": 0.400, "tr": "Yemen", "iso": "YE"},
    "Umman":            {"x": 0.628, "y": 0.375, "tr": "Umman", "iso": "Oman"},
    "BAE":              {"x": 0.633, "y": 0.360, "tr": "Birleşik Arap Emirlikleri", "iso": "AE"},
    "Katar":            {"x": 0.625, "y": 0.353, "tr": "Katar", "iso": "QA"},
    "Bahreyn":          {"x": 0.620, "y": 0.348, "tr": "Bahreyn", "iso": "BH"},
    "Kuveyt":           {"x": 0.605, "y": 0.330, "tr": "Kuveyt", "iso": "KW"},
    "Ermenistan":       {"x": 0.593, "y": 0.253, "tr": "Ermenistan", "iso": "AM"},
    "Gurcistan":        {"x": 0.593, "y": 0.240, "tr": "Gürcistan", "iso": "GE"},
    "Azerbaycan":       {"x": 0.605, "y": 0.253, "tr": "Azerbaycan", "iso": "Azerbaijan"},

    # ============ ASYA ============
    "Japonya":          {"x": 0.831, "y": 0.276, "tr": "Japonya", "iso": "Japan"},
    "Cin":              {"x": 0.727, "y": 0.281, "tr": "Çin", "iso": "China"},
    "Guney Kore":       {"x": 0.804, "y": 0.274, "tr": "Güney Kore", "iso": "KR"},
    "Kuzey Kore":       {"x": 0.797, "y": 0.256, "tr": "Kuzey Kore", "iso": "KP"},
    "Hindistan":        {"x": 0.687, "y": 0.363, "tr": "Hindistan", "iso": "IN"},
    "Pakistan":         {"x": 0.673, "y": 0.320, "tr": "Pakistan", "iso": "PK"},
    "Afganistan":       {"x": 0.660, "y": 0.290, "tr": "Afganistan", "iso": "AF"},
    "Bangladeş":        {"x": 0.720, "y": 0.360, "tr": "Bangladeş", "iso": "BD"},
    "Butan":            {"x": 0.720, "y": 0.335, "tr": "Butan", "iso": "BT"},
    "Nepal":            {"x": 0.705, "y": 0.340, "tr": "Nepal", "iso": "NP"},
    "Sri Lanka":        {"x": 0.700, "y": 0.430, "tr": "Sri Lanka", "iso": "LK"},
    "Myanmar":          {"x": 0.745, "y": 0.365, "tr": "Myanmar", "iso": "MM"},
    "Tayland":          {"x": 0.760, "y": 0.395, "tr": "Tayland", "iso": "TH"},
    "Vietnam":          {"x": 0.780, "y": 0.395, "tr": "Vietnam", "iso": "VN"},
    "Laos":             {"x": 0.770, "y": 0.380, "tr": "Laos", "iso": "LA"},
    "Kamboçya":         {"x": 0.775, "y": 0.410, "tr": "Kamboçya", "iso": "KH"},
    "Malezya":          {"x": 0.783, "y": 0.465, "tr": "Malezya", "iso": "Malaysia"},
    "Endonezya":        {"x": 0.803, "y": 0.520, "tr": "Endonezya", "iso": "Indonesia"},
    "Filipinler":       {"x": 0.830, "y": 0.430, "tr": "Filipinler", "iso": "Philippines"},
    "Brunei":           {"x": 0.807, "y": 0.470, "tr": "Brunei", "iso": "BN"},
    "Dogu Timor":       {"x": 0.833, "y": 0.545, "tr": "Doğu Timor", "iso": "TL"},
    "Tayvan":           {"x": 0.815, "y": 0.340, "tr": "Tayvan", "iso": "TW"},
    "Mogolistan":       {"x": 0.760, "y": 0.220, "tr": "Moğolistan", "iso": "MN"},
    "Kazakistan":       {"x": 0.660, "y": 0.220, "tr": "Kazakistan", "iso": "KZ"},
    "Ozbekistan":       {"x": 0.647, "y": 0.240, "tr": "Özbekistan", "iso": "UZ"},
    "Turkmenistan":     {"x": 0.640, "y": 0.260, "tr": "Türkmenistan", "iso": "TM"},
    "Kirgizistan":      {"x": 0.680, "y": 0.240, "tr": "Kırgızistan", "iso": "KG"},
    "Tacikistan":       {"x": 0.673, "y": 0.260, "tr": "Tacikistan", "iso": "TJ"},

    # ============ OKYANUSYA ============
    "Avustralya":       {"x": 0.860, "y": 0.660, "tr": "Avustralya", "iso": "Australia"},
    "Yeni Zelanda":     {"x": 0.930, "y": 0.760, "tr": "Yeni Zelanda", "iso": "New Zealand"},
    "Papua Yeni Gine":  {"x": 0.880, "y": 0.550, "tr": "Papua Yeni Gine", "iso": "Papua New Guinea"},
}

# Ülke ismi eşleştirme (nationality -> COUNTRIES key)
COUNTRY_ALIASES = {}

def _normalize(text):
    if not text:
        return ""
    import unicodedata
    text = str(text).strip().lower()
    text = text.replace("ı", "i").replace("ğ", "g").replace("ü", "u")
    text = text.replace("ş", "s").replace("ö", "o").replace("ç", "c")
    text = text.replace("_", " ").replace("-", " ")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return " ".join(text.split())

def _add_alias(country_key, *names):
    for n in names:
        COUNTRY_ALIASES[_normalize(n)] = country_key

# Otomatik alias
for _ckey, _cdata in COUNTRIES.items():
    _add_alias(_ckey, _ckey, _cdata["tr"])

# Ekstra alias'lar (eski)
_add_alias("Turkiye", "turkey", "turkiye", "türkiye")
_add_alias("Almanya", "germany", "almanya")
_add_alias("Ingiltere", "england", "ingiltere", "uk", "united kingdom", "britain")
_add_alias("Fransa", "france", "fransa")
_add_alias("Ispanya", "spain", "ispanya", "espana")
_add_alias("Italya", "italy", "italya", "italia")
_add_alias("Portekiz", "portugal", "portekiz")
_add_alias("Hollanda", "netherlands", "holland", "hollanda")
_add_alias("Belcika", "belgium", "belcika", "belçika")
_add_alias("Isvicre", "switzerland", "isvicre", "isviçre")
_add_alias("Avusturya", "austria", "avusturya")
_add_alias("Polonya", "poland", "polonya")
_add_alias("Cekya", "czech republic", "czechia", "cekya", "çekya", "czech")
_add_alias("Macaristan", "hungary", "macaristan")
_add_alias("Hirvatistan", "croatia", "hirvatistan", "hırvatistan")
_add_alias("Sirbistan", "serbia", "sirbistan", "sırbistan")
_add_alias("Yunanistan", "greece", "yunanistan")
_add_alias("Romanya", "romania", "romanya")
_add_alias("Bulgaristan", "bulgaria", "bulgaristan")
_add_alias("Ukrayna", "ukraine", "ukrayna")
_add_alias("Rusya", "russia", "rusya", "russian federation")
_add_alias("Norvec", "norway", "norvec", "norveç")
_add_alias("Isvec", "sweden", "isvec", "isveç")
_add_alias("Danimarka", "denmark", "danimarka")
_add_alias("Finlandiya", "finland", "finlandiya")
_add_alias("Iskocya", "scotland", "iskocya", "iskoçya")
_add_alias("Irlanda", "ireland", "irlanda")
_add_alias("Galler", "wales", "galler")
_add_alias("Izlanda", "iceland", "izlanda")
_add_alias("Arnavutluk", "albania", "arnavutluk")
_add_alias("Bosna Hersek", "bosnia", "bosnia and herzegovina", "bosna hersek")
_add_alias("Karadag", "montenegro", "karadag", "karadağ")
_add_alias("Kuzey Makedonya", "north macedonia", "macedonia", "kuzey makedonya", "makedonya")
_add_alias("Slovenya", "slovenia", "slovenya")
_add_alias("Slovakya", "slovakia", "slovakya")
_add_alias("Estonya", "estonia", "estonya")
_add_alias("Letonya", "latvia", "letonya")
_add_alias("Litvanya", "lithuania", "litvanya")
_add_alias("Belarus", "belarus", "belorusya", "belorussia")
_add_alias("Moldova", "moldova")
_add_alias("Kosova", "kosovo", "kosova")
_add_alias("Luksemburg", "luxembourg", "luksemburg", "lüksemburg")
_add_alias("Brezilya", "brazil", "brezilya", "brasil")
_add_alias("Arjantin", "argentina", "arjantin")
_add_alias("Uruguay", "uruguay", "urugay")
_add_alias("Sili", "chile", "sili", "şili")
_add_alias("Kolombiya", "colombia", "kolombiya")
_add_alias("Peru", "peru")
_add_alias("Ekvador", "ecuador", "ekvador")
_add_alias("Paraguay", "paraguay")
_add_alias("Venezuela", "venezuela")
_add_alias("Bolivya", "bolivia", "bolivya")
_add_alias("Surinam", "suriname", "surinam")
_add_alias("Guyana", "guyana")
_add_alias("Fransiz Guyanasi", "french guiana", "fransiz guyanasi", "fransız guyanası")
_add_alias("ABD", "usa", "united states", "amerika", "abd", "a.b.d.", "america")
_add_alias("Meksika", "mexico", "meksika")
_add_alias("Kanada", "canada", "kanada")
_add_alias("Kuba", "cuba", "kuba", "küba")
_add_alias("Jamaika", "jamaica", "jamaika")
_add_alias("Haiti", "haiti")
_add_alias("Dominik Cumhuriyeti", "dominican republic", "dominik cumhuriyeti")
_add_alias("Guatemala", "guatemala")
_add_alias("Honduras", "honduras")
_add_alias("El Salvador", "el salvador", "salvador")
_add_alias("Nikaragua", "nicaragua", "nikaragua")
_add_alias("Kosta Rika", "costa rica", "kosta rika")
_add_alias("Panama", "panama")
_add_alias("Belize", "belize")
_add_alias("Gronland", "greenland", "gronland", "grönland")
_add_alias("Misir", "egypt", "misir", "mısır")
_add_alias("Fas", "morocco", "fas")
_add_alias("Cezayir", "algeria", "cezayir")
_add_alias("Tunus", "tunisia", "tunus")
_add_alias("Libya", "libya")
_add_alias("Sudan", "sudan")
_add_alias("Guney Sudan", "south sudan", "guney sudan", "güney sudan")
_add_alias("Bati Sahra", "western sahara", "bati sahra", "batı sahra")
_add_alias("Moritanya", "mauritania", "moritanya")
_add_alias("Mali", "mali")
_add_alias("Nijer", "niger", "nijer")
_add_alias("Cad", "chad", "cad", "çad")
_add_alias("Etiyopya", "ethiopia", "etiyopya")
_add_alias("Eritre", "eritrea", "eritre")
_add_alias("Cibuti", "djibouti", "cibuti")
_add_alias("Somali", "somalia", "somali")
_add_alias("Kenya", "kenya")
_add_alias("Uganda", "uganda")
_add_alias("Ruanda", "rwanda", "ruanda")
_add_alias("Burundi", "burundi")
_add_alias("Tanzanya", "tanzania", "tanzanya")
_add_alias("Kongo DC", "dr congo", "democratic republic of the congo", "kongo dc", "congo dr")
_add_alias("Kongo", "congo", "republic of the congo", "kongo")
_add_alias("Orta Afrika Cum.", "central african republic", "orta afrika")
_add_alias("Angola", "angola")
_add_alias("Zambiya", "zambia", "zambiya")
_add_alias("Zimbabve", "zimbabwe", "zimbabve")
_add_alias("Mozambik", "mozambique", "mozambik")
_add_alias("Namibya", "namibia", "namibya")
_add_alias("Botsvana", "botswana", "botsvana")
_add_alias("Madagaskar", "madagascar", "madagaskar")
_add_alias("Malavi", "malawi", "malavi")
_add_alias("Lesotho", "lesotho")
_add_alias("Esvatini", "eswatini", "swaziland", "esvatini")
_add_alias("Guney Afrika", "south africa", "g. afrika", "guney afrika", "güney afrika")
_add_alias("Senegal", "senegal")
_add_alias("Gambiya", "gambia", "the gambia", "gambiya")
_add_alias("Gine", "guinea", "gine")
_add_alias("Gine Bissau", "guinea-bissau", "guinea bissau", "gine bissau", "gine-bissau")
_add_alias("Sierra Leone", "sierra leone")
_add_alias("Liberya", "liberia", "liberya")
_add_alias("Fildisi Sahili", "ivory coast", "cote d'ivoire", "fildisi sahili", "fildişi sahili")
_add_alias("Gana", "ghana", "gana")
_add_alias("Togo", "togo")
_add_alias("Benin", "benin")
_add_alias("Nijerya", "nigeria", "nijerya")
_add_alias("Kamerun", "cameroon", "kamerun")
_add_alias("Gabon", "gabon")
_add_alias("Ekvator Ginesi", "equatorial guinea", "ekvator ginesi")
_add_alias("Burkina Faso", "burkina faso", "burkina")
_add_alias("Iran", "iran")
_add_alias("Irak", "iraq", "irak")
_add_alias("Suriye", "syria", "suriye")
_add_alias("Israil", "israel", "israil", "i̇srail")
_add_alias("Filistin", "palestine", "filistin")
_add_alias("Lubnan", "lebanon", "lubnan", "lübnan")
_add_alias("Urdun", "jordan", "urdun", "ürdün")
_add_alias("Suudi Arabistan", "saudi arabia", "suudi arabistan")
_add_alias("Yemen", "yemen")
_add_alias("Umman", "oman", "umman")
_add_alias("BAE", "uae", "united arab emirates", "bae", "birlesik arap emirlikleri")
_add_alias("Katar", "qatar", "katar")
_add_alias("Bahreyn", "bahrain", "bahreyn")
_add_alias("Kuveyt", "kuwait", "kuveyt")
_add_alias("Ermenistan", "armenia", "ermenistan")
_add_alias("Gurcistan", "georgia", "gurcistan", "gürcistan")
_add_alias("Azerbaycan", "azerbaijan", "azerbaycan")
_add_alias("Japonya", "japan", "japonya")
_add_alias("Cin", "china", "cin", "çin")
_add_alias("Guney Kore", "south korea", "korea", "korea south", "g. kore", "guney kore", "güney kore")
_add_alias("Kuzey Kore", "north korea", "korea north", "kuzey kore")
_add_alias("Hindistan", "india", "hindistan")
_add_alias("Pakistan", "pakistan")
_add_alias("Afganistan", "afghanistan", "afganistan")
_add_alias("Bangladeş", "bangladesh", "bangladeş", "banglades")
_add_alias("Butan", "bhutan", "butan")
_add_alias("Nepal", "nepal")
_add_alias("Sri Lanka", "sri lanka")
_add_alias("Myanmar", "myanmar", "burma")
_add_alias("Tayland", "thailand", "tayland")
_add_alias("Vietnam", "vietnam", "viet nam")
_add_alias("Laos", "laos")
_add_alias("Kamboçya", "cambodia", "kambocya", "kamboçya")
_add_alias("Malezya", "malaysia", "malezya")
_add_alias("Endonezya", "indonesia", "endonezya")
_add_alias("Filipinler", "philippines", "filipinler")
_add_alias("Brunei", "brunei")
_add_alias("Dogu Timor", "east timor", "timor-leste", "dogu timor", "doğu timor")
_add_alias("Tayvan", "taiwan", "tayvan")
_add_alias("Mogolistan", "mongolia", "mogolistan", "moğolistan")
_add_alias("Kazakistan", "kazakhstan", "kazakistan")
_add_alias("Ozbekistan", "uzbekistan", "ozbekistan", "özbekistan")
_add_alias("Turkmenistan", "turkmenistan", "türkmenistan")
_add_alias("Kirgizistan", "kyrgyzstan", "kirgizistan", "kırgızistan")
_add_alias("Tacikistan", "tajikistan", "tacikistan")
_add_alias("Avustralya", "australia", "avustralya")
_add_alias("Yeni Zelanda", "new zealand", "yeni zelanda")
_add_alias("Papua Yeni Gine", "papua new guinea", "papua yeni gine")

def get_country_key(nationality):
    """Futbolcunun nationality değerinden COUNTRIES key'ini bul"""
    return COUNTRY_ALIASES.get(_normalize(nationality))

def get_valid_footballer_indices(all_footballers):
    """Ülkesi tanınan futbolcuların index listesi"""
    valid = []
    for i, f in enumerate(all_footballers):
        nat = f.get("nationality", "")
        if get_country_key(nat):
            valid.append(i)
    return valid