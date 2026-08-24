"""
Futbolcu Bil - Soru Verileri (Detaylı Pozisyonlar + Özel Sorular)
"""

ALL_QUESTIONS = [
    ("Genç yetenek mi?", "young", True),
    ("30 yaş üstünde mi?", "over30", True),
    ("Sakalı var mı?", "beard", True),
    ("Sarışın mı?", "blonde", True),
    ("Kel mi?", "bald", True),
    ("Saç bandı var mı?", "headband", True),
    ("Dövmesi var mı?", "tattoo", True),
    ("Ballon d'Or var mı?", "ballondor", True),
    ("100+ gol'e sahip mi?", "goals100", True),
    ("Şampiyonlar Ligi kazandı mı?", "ucl", True),
    ("Dünya Kupası kazandı mı?", "worldcup", True),
    ("Kaptan mı?", "captain", True),
    ("Sol ayaklı mı?", "leftfoot", True),
    ("Avrupada mı?", "europe", True),
    ("SüperLig geçmişi var mı?", "superlig", True),
    ("Afrikalı mı?", "african", True),
    ("10 numara mı?", "number10", True),
    ("9 numara mı?", "number9", True),
    ("7 numara mı?", "number7", True),
    
    # === YENİ ÖZEL SORULAR ===
    ("Real Madrid'de oynadı mı?", "real_madrid", True),
    ("Barcelona'da oynadı mı?", "barcelona", True),
    ("Serbest vuruş (frikik) ustası mı?", "freekick", True),
    ("Uzun boylu mu (1.88m+)?", "tall", True),
    ("Uzun saçlı mı?", "long_hair", True),
    ("Kıvırcık saçlı mı?", "curly_hair", True),
    ("Copa América kazandı mı?", "copa_america", True),

    # === MİLLİYET & KITA ===
    ("Brezilyalı mı?", "nationality", "Brezilya"),
    ("Arjantinli mi?", "nationality", "Arjantin"),
    ("Türk mü?", "nationality", "Turkiye"),
    ("Fransız mı?", "nationality", "Fransa"),
    ("İngiliz mi?", "nationality", "Ingiltere"),
    ("Portekizli mi?", "nationality", "Portekiz"),
    ("Alman mı?", "nationality", "Almanya"),
    ("İspanyol mu?", "nationality", "Ispanya"),
    ("Polonyalı mı?", "nationality", "Polonya"),
    ("Belçikalı mı?", "nationality", "Belcika"),
    ("Hollandalı mı?", "nationality", "Hollanda"),
    ("Koreli mi?", "nationality", "G.Kore"),
    ("Norveçli mi?", "nationality", "Norvec"),
    ("Kolombiyalı mı?", "nationality", "Kolombiya"),
    ("Uruguaylı mı?", "nationality", "Uruguay"),
    ("İsveçli mi?", "nationality", "Isvec"),
    ("Boşnak mı?", "nationality", "Bosna"),
    ("Hırvat mı?", "nationality", "Hirvatistan"),
    ("İtalyan mı?", "nationality", "Italya"),
    ("Çek mi?", "nationality", "Cek Cumhuriyeti"),
    ("Danimarkalı mı?", "nationality", "Danimarka"),
    ("Ukraynalı mı?", "nationality", "Ukrayna"),
    ("Rus mu?", "nationality", "Rusya"),
    ("Macar mı?", "nationality", "Macaristan"),
    ("Kuzey İrlandalı mı?", "nationality", "Kuzey irlanda"),
    ("Şilili mi?", "nationality", "Sili"),
    ("Galli mi?", "nationality", "Galler"),
    ("Avrupalı mı?", "continent", "Avrupa"),
    ("G.Amerikalı mı?", "continent", "G.Amerika"),
    ("Afrikalı (kıta)?", "continent", "Afrika"),
    ("Asyalı mı?", "continent", "Asya"),

    # === GENEL POZİSYONLAR ===
    ("Forvet mi?", "position", "Forvet"),
    ("Orta saha mı?", "position", "OrtaSaha"),
    ("Defans mı?", "position", "Defans"),
    ("Kaleci mi?", "position", "Kaleci"),

    # === DETAYLI POZİSYONLAR ===
    ("Santrafor / Forvet mi?", "detailed_position", "Santrafor"),
    ("Sağ Kanat mı?", "detailed_position", "SagKanat"),
    ("Sol Kanat mı?", "detailed_position", "SolKanat"),
    ("Defansif Orta Saha mı (DOS)?", "detailed_position", "DOS"),
    ("Merkez Orta Saha mı (MOS)?", "detailed_position", "MOS"),
    ("Ofansif Orta Saha mı (OOS)?", "detailed_position", "OOS"),
    ("Stoper mi?", "detailed_position", "Stoper"),
    ("Sağ Bek mi?", "detailed_position", "SagBek"),
    ("Sol Bek mi?", "detailed_position", "SolBek"),

    # === LİG DURUMLARI ===
    ("LaLiga'da mı?", "league", "LaLiga"),
    ("Premier Lig'de mi oynuyor?", "league", "Premier"),
    ("SüperLig'de mi oynuyor?", "league", "SuperLig"),
    ("Suudi Liginde mi oynuyor?", "league", "Suudi"),
    ("Ligue 1'de mi oynuyor?", "league", "Ligue1"),
    ("Serie A'da mı oynuyor?", "league", "SerieA"),
    ("Bundesliga'da mı oynuyor?", "league", "Bundesliga"),
    ("Emekli mi?", "league", "Emekli"),
    ("MLS'de mi oynuyor?", "league", "MLS"),
]


def check_question(footballer, question_index):
    """Bir futbolcunun soruya cevabini kontrol eder"""
    text, key, value = ALL_QUESTIONS[question_index]

    pos = footballer.get("position", "")
    dp = footballer.get("detailed_position", "")

    # 1) Genel Pozisyon Kontrolü (Forvet mi? Defans mı? Orta saha mı? Kaleci mi?)
    if key == "position":
        if value == "Forvet":
            return pos in ["Forvet", "Santrafor", "Sağ Kanat", "Sol Kanat"] or dp in ["Santrafor", "SagKanat", "SolKanat"]
        elif value in ["OrtaSaha", "Orta Saha"]:
            return pos in ["Orta Saha", "OrtaSaha", "Defansif Orta Saha", "Merkez Orta Saha", "Ofansif Orta Saha"] or dp in ["DOS", "MOS", "OOS"]
        elif value == "Defans":
            return pos in ["Defans", "Stoper", "Sağ Bek", "Sol Bek"] or dp in ["Stoper", "SagBek", "SolBek"]
        elif value == "Kaleci":
            return pos in ["Kaleci"] or dp == "Kaleci"

    # 2) Detaylı Pozisyon Kontrolü (Santrafor mu? Sol Bek mi? vb.)
    if key == "detailed_position":
        if value == "Santrafor": return dp == "Santrafor" or pos == "Santrafor"
        if value == "SagKanat": return dp == "SagKanat" or pos == "Sağ Kanat"
        if value == "SolKanat": return dp == "SolKanat" or pos == "Sol Kanat"
        if value == "DOS": return dp == "DOS" or pos == "Defansif Orta Saha"
        if value == "MOS": return dp == "MOS" or pos == "Merkez Orta Saha"
        if value == "OOS": return dp == "OOS" or pos == "Ofansif Orta Saha"
        if value == "Stoper": return dp == "Stoper" or pos == "Stoper"
        if value == "SagBek": return dp == "SagBek" or pos == "Sağ Bek"
        if value == "SolBek": return dp == "SolBek" or pos == "Sol Bek"
        return dp == value or pos == value

    # 3) Boolean Özellikler (real_madrid, freekick, tall, long_hair vb.)
    if isinstance(value, bool):
        return bool(footballer.get(key, False)) == value

    # 4) Metin Eşleşmeleri (nationality, continent, league vb.)
    return footballer.get(key) == value