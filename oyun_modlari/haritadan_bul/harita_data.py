"""
Haritadan Bul - Ülke koordinatları ve alias verileri
"""

COUNTRIES = {
    # ============ AVRUPA ============
    "Turkiye":          {"x": 0.565, "y": 0.260, "tr": "Türkiye"},
    "Almanya":          {"x": 0.500, "y": 0.183, "tr": "Almanya"},
    "Ingiltere":        {"x": 0.470, "y": 0.170, "tr": "İngiltere"},
    "Fransa":           {"x": 0.482, "y": 0.210, "tr": "Fransa"},
    "Ispanya":          {"x": 0.463, "y": 0.246, "tr": "İspanya"},
    "Italya":           {"x": 0.502, "y": 0.232, "tr": "İtalya"},
    "Portekiz":         {"x": 0.449, "y": 0.259, "tr": "Portekiz"},
    "Hollanda":         {"x": 0.487, "y": 0.177, "tr": "Hollanda"},
    "Belcika":          {"x": 0.486, "y": 0.190, "tr": "Belçika"},
    "Isvicre":          {"x": 0.494, "y": 0.209, "tr": "İsviçre"},
    "Avusturya":        {"x": 0.509, "y": 0.207, "tr": "Avusturya"},
    "Polonya":          {"x": 0.518, "y": 0.178, "tr": "Polonya"},
    "Cekya":            {"x": 0.512, "y": 0.194, "tr": "Çekya"},
    "Macaristan":       {"x": 0.522, "y": 0.211, "tr": "Macaristan"},
    "Hirvatistan":      {"x": 0.515, "y": 0.218, "tr": "Hırvatistan"},
    "Sirbistan":        {"x": 0.524, "y": 0.226, "tr": "Sırbistan"},
    "Yunanistan":       {"x": 0.535, "y": 0.265, "tr": "Yunanistan"},
    "Romanya":          {"x": 0.536, "y": 0.219, "tr": "Romanya"},
    "Bulgaristan":      {"x": 0.537, "y": 0.236, "tr": "Bulgaristan"},
    "Ukrayna":          {"x": 0.544, "y": 0.191, "tr": "Ukrayna"},
    "Rusya":            {"x": 0.579, "y": 0.148, "tr": "Rusya"},
    "Norvec":           {"x": 0.494, "y": 0.125, "tr": "Norveç"},
    "Isvec":            {"x": 0.511, "y": 0.125, "tr": "İsveç"},
    "Danimarka":        {"x": 0.497, "y": 0.155, "tr": "Danimarka"},
    "Finlandiya":       {"x": 0.532, "y": 0.114, "tr": "Finlandiya"},
    "Iskocya":          {"x": 0.466, "y": 0.147, "tr": "İskoçya"},
    "Irlanda":          {"x": 0.456, "y": 0.172, "tr": "İrlanda"},
    "Galler":           {"x": 0.463, "y": 0.179, "tr": "Galler"},

    # ============ GÜNEY AMERİKA ============
    "Brezilya":         {"x": 0.338, "y": 0.618, "tr": "Brezilya"},
    "Arjantin":         {"x": 0.302, "y": 0.715, "tr": "Arjantin"},
    "Uruguay":          {"x": 0.324, "y": 0.708, "tr": "Uruguay"},
    "Sili":             {"x": 0.292, "y": 0.748, "tr": "Şili"},
    "Kolombiya":        {"x": 0.270, "y": 0.477, "tr": "Kolombiya"},
    "Peru":             {"x": 0.263, "y": 0.561, "tr": "Peru"},
    "Ekvador":          {"x": 0.253, "y": 0.508, "tr": "Ekvador"},
    "Paraguay":         {"x": 0.313, "y": 0.641, "tr": "Paraguay"},
    "Venezuela":        {"x": 0.279, "y": 0.445, "tr": "Venezuela"},

    # ============ KUZEY AMERİKA ============
    "ABD":              {"x": 0.209, "y": 0.255, "tr": "ABD"},
    "Meksika":          {"x": 0.197, "y": 0.348, "tr": "Meksika"},
    "Kanada":           {"x": 0.238, "y": 0.138, "tr": "Kanada"},

    # ============ AFRİKA ============
    "Misir":            {"x": 0.550, "y": 0.334, "tr": "Mısır"},
    "Fas":              {"x": 0.452, "y": 0.304, "tr": "Fas"},
    "Cezayir":          {"x": 0.477, "y": 0.323, "tr": "Cezayir"},
    "Tunus":            {"x": 0.497, "y": 0.282, "tr": "Tunus"},
    "Senegal":          {"x": 0.433, "y": 0.412, "tr": "Senegal"},
    "Nijerya":          {"x": 0.492, "y": 0.439, "tr": "Nijerya"},
    "Kamerun":          {"x": 0.505, "y": 0.469, "tr": "Kamerun"},
    "Gana":             {"x": 0.467, "y": 0.452, "tr": "Gana"},
    "Fildisi Sahili":   {"x": 0.455, "y": 0.453, "tr": "Fildişi Sahili"},
    "Guney Afrika":     {"x": 0.536, "y": 0.686, "tr": "Güney Afrika"},

    # ============ ASYA ============
    "Japonya":          {"x": 0.831, "y": 0.276, "tr": "Japonya"},
    "Cin":              {"x": 0.727, "y": 0.281, "tr": "Çin"},
    "Guney Kore":       {"x": 0.804, "y": 0.274, "tr": "Güney Kore"},
    "Suudi Arabistan":  {"x": 0.586, "y": 0.344, "tr": "Suudi Arabistan"},
    "Iran":             {"x": 0.614, "y": 0.290, "tr": "İran"},
    "Hindistan":        {"x": 0.687, "y": 0.363, "tr": "Hindistan"},
    "Avustralya":       {"x": 0.822, "y": 0.650, "tr": "Avustralya"},
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

# Ekstra alias'lar
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
_add_alias("Rusya", "russia", "rusya")
_add_alias("Norvec", "norway", "norvec", "norveç")
_add_alias("Isvec", "sweden", "isvec", "isveç")
_add_alias("Danimarka", "denmark", "danimarka")
_add_alias("Finlandiya", "finland", "finlandiya")
_add_alias("Iskocya", "scotland", "iskocya", "iskoçya")
_add_alias("Irlanda", "ireland", "irlanda")
_add_alias("Galler", "wales", "galler")
_add_alias("Brezilya", "brazil", "brezilya", "brasil")
_add_alias("Arjantin", "argentina", "arjantin")
_add_alias("Uruguay", "uruguay", "urugay")
_add_alias("Sili", "chile", "sili", "şili")
_add_alias("Kolombiya", "colombia", "kolombiya")
_add_alias("Peru", "peru")
_add_alias("Ekvador", "ecuador", "ekvador")
_add_alias("Paraguay", "paraguay")
_add_alias("Venezuela", "venezuela")
_add_alias("ABD", "usa", "united states", "amerika", "abd", "a.b.d.", "america")
_add_alias("Meksika", "mexico", "meksika")
_add_alias("Kanada", "canada", "kanada")
_add_alias("Misir", "egypt", "misir", "mısır")
_add_alias("Fas", "morocco", "fas")
_add_alias("Cezayir", "algeria", "cezayir")
_add_alias("Tunus", "tunisia", "tunus")
_add_alias("Senegal", "senegal")
_add_alias("Nijerya", "nigeria", "nijerya")
_add_alias("Kamerun", "cameroon", "kamerun")
_add_alias("Gana", "ghana", "gana")
_add_alias("Fildisi Sahili", "ivory coast", "cote d'ivoire", "fildisi sahili", "fildişi sahili")
_add_alias("Guney Afrika", "south africa", "g. afrika", "guney afrika", "güney afrika")
_add_alias("Japonya", "japan", "japonya")
_add_alias("Cin", "china", "cin", "çin")
_add_alias("Guney Kore", "south korea", "korea", "g. kore", "guney kore", "güney kore")
_add_alias("Suudi Arabistan", "saudi arabia", "suudi arabistan")
_add_alias("Iran", "iran")
_add_alias("Hindistan", "india", "hindistan")
_add_alias("Avustralya", "australia", "avustralya")

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