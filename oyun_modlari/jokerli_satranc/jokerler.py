# ==========================================
# ♟️ JOKERLİ SATRANÇ - 26 JOKER TANIMLARI
# ==========================================

# Her joker:
# id: benzersiz string (backend ve frontend için)
# name: görünen isim
# icon: emoji
# category: klasik / kaos / bilgi / ozel / ekstra / carkifelek
# desc: kısa açıklama
# phase: hangi fazda kullanılabilir ("anytime", "your_turn", "opponent_turn", "pregame")
# implemented: True/False (yavaş yavaş açacağız)

JOKERS = [
    # ==========================================
    # 🟢 KLASİK (6)
    # ==========================================
    {
        "id": "geri_al",
        "name": "Geri Al",
        "icon": "🔄",
        "category": "klasik",
        "desc": "Son yaptığın hamleyi iptal eder.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "kalkan",
        "name": "Kalkan",
        "icon": "🛡️",
        "category": "klasik",
        "desc": "Bir taşının 2 tur boyunca yenilemez olmasını sağlar.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "dondur",
        "name": "Dondur",
        "icon": "🧊",
        "category": "klasik",
        "desc": "Rakibin bir taşını 2 tur boyunca dondurur.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "vezire_yukselt",
        "name": "Vezire Yükselt",
        "icon": "👑",
        "category": "klasik",
        "desc": "Bir piyonunu anında vezire çevirir.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "isinlan",
        "name": "Işınlanma",
        "icon": "🔮",
        "category": "klasik",
        "desc": "Kendi taşını istediğin boş bir kareye ışınlar.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "iki_hamle",
        "name": "İki Hamle",
        "icon": "⚔️",
        "category": "klasik",
        "desc": "Bu turda aynı taşla 2 hamle yapmanı sağlar.",
        "phase": "your_turn",
        "implemented": True
    },

    # ==========================================
    # 🟡 KAOS (6)
    # ==========================================
    {
        "id": "bomba",
        "name": "Bomba",
        "icon": "💣",
        "category": "kaos",
        "desc": "Attığın taş ve etrafındaki 4 komşu patlar (şah hariç).",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "tas_donustur",
        "name": "Taş Dönüştür",
        "icon": "🃏",
        "category": "kaos",
        "desc": "Kendi taşını istediğin türe dönüştürür (şah hariç).",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "rakip_tas_yerlestir",
        "name": "Rakip Taş Yerleştir",
        "icon": "🎯",
        "category": "kaos",
        "desc": "Rakibin herhangi bir taşını (şah hariç) istediğin boş kareye taşır.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "yer_degistir",
        "name": "Yer Değiştir",
        "icon": "🌀",
        "category": "kaos",
        "desc": "Kendi 2 taşının yerini değiştirir (şah dahil).",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "klon",
        "name": "Klon",
        "icon": "🎭",
        "category": "kaos",
        "desc": "Kendi taşını komşu bir kareye kopyalar (şah hariç).",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "tasimi_geri_ver",
        "name": "Taşımı Geri Ver",
        "icon": "♻️",
        "category": "kaos",
        "desc": "Rakibin senden yediği taşlardan birini seç, kendi piyon satırına geri gelsin.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "yoksay",
        "name": "Taşı Yok Say",
        "icon": "🚫",
        "category": "kaos",
        "desc": "1 taşı (kendi/rakip, şah hariç) hayalet yapar. Şah oluşursa sıra karşıya, oluşmazsa hamlene devam edersin.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "zaman_cal",
        "name": "Zaman Çal",
        "icon": "⏰",
        "category": "kaos",
        "desc": "Rakibin süresinden 30 saniye alır.",
        "phase": "your_turn",
        "implemented": True
    },

    # ==========================================
    # 🔵 BİLGİ (1)
    # ==========================================
    {
        "id": "joker_gor",
        "name": "Joker Gör",
        "icon": "👁️",
        "category": "bilgi",
        "desc": "Rakibin sahip olduğu gizli jokerleri açığa çıkarır.",
        "phase": "your_turn",
        "implemented": True
    },

    # ==========================================
    # 🎬 ÖZEL (1)
    # ==========================================
    {
        "id": "once_basla",
        "name": "Önce Başla",
        "icon": "🎬",
        "category": "ozel",
        "desc": "Oyunu sen başlatırsın (sıra belirleme jokeri).",
        "phase": "pregame",
        "implemented": True
    },

    # ==========================================
    # 🆕 EKSTRA (8)
    # ==========================================
    {
        "id": "pas_ver",
        "name": "Pas Ver",
        "icon": "🔀",
        "category": "ekstra",
        "desc": "Sıranı geç, rakip 2 kez oynar.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "kilitle",
        "name": "Kilitle",
        "icon": "🔒",
        "category": "ekstra",
        "desc": "Bir rakip taş 3 tur boyunca hareket edemez.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "yavaslat",
        "name": "Yavaşlat",
        "icon": "🐌",
        "category": "ekstra",
        "desc": "Bir rakip taşı yavaşlatır - 3 tur boyunca sadece 1 kare hareket edebilir.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "ajan",
        "name": "Ajan",
        "icon": "🕵️",
        "category": "ekstra",
        "desc": "Kendi taşını rakip taşı gibi gösterir. Rengi değişir ama kontrol sende kalır.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "hizli_kacis",
        "name": "Hızlı Kaçış",
        "icon": "🌪️",
        "category": "ekstra",
        "desc": "Şah bu turda Vezir gibi hareket edebilir.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "gorunmez",
        "name": "Görünmez",
        "icon": "🧙",
        "category": "ekstra",
        "desc": "Bir taşın 1 tur boyunca görünmez olur (rakip yiyemez).",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "zaman_durdur",
        "name": "Hakkını Bana Ver",
        "icon": "✋",
        "category": "ekstra",
        "desc": "Bu turda 2 hamle yaparsın. İkinci hamlede farklı taş da oynayabilirsin.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "zamani_durdur",
        "name": "Zamanı Durdur",
        "icon": "🛑",
        "category": "ekstra",
        "desc": "Sadece bu tur boyunca saatin durur. Sıra rakibe geçince normale döner.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "rulet",
        "name": "Rulet",
        "icon": "🎰",
        "category": "ekstra",
        "desc": "4 farklı seçenekten biri rastgele gerçekleşir.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "yansima",
        "name": "Yansıma",
        "icon": "🌀",
        "category": "ekstra",
        "desc": "Rakibin sonraki joker etkisi kendisine döner.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "iyilestir",
        "name": "İyileştir",
        "icon": "🔧",
        "category": "ekstra",
        "desc": "Aktif bir jokerinin süresine 3 tur daha ekler (Kalkan, Dondur, Görünmez, Ajan, Kilitle, Sansür).",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "ekstra_sure",
        "name": "Ekstra Süre",
        "icon": "⏱️",
        "category": "ekstra",
        "desc": "Kendi saatine 2 dakika (120 saniye) ekler.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "rakibi_isinla",
        "name": "Rakibi Işınla",
        "icon": "⚡",
        "category": "ekstra",
        "desc": "Herhangi 2 taşı seç (kendi/rakip fark etmez, şah hariç), yer değişir.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "kasa",
        "name": "Kasa",
        "icon": "🛒",
        "category": "ekstra",
        "desc": "Kasa aç, Havuzdan rastgele 1 joker kazan!.",
        "phase": "your_turn",
        "implemented": True
    },

    # ==========================================
    # 🎡 ÇARKIFELEK GRUBU (4)
    # ==========================================
    {
        "id": "carkifelek",
        "name": "Çarkıfelek",
        "icon": "🎡",
        "category": "carkifelek",
        "desc": "Çark döner, 13 dilimden biri rastgele seçilir.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "joker_hirsizligi",
        "name": "Joker Hırsızlığı",
        "icon": "💀",
        "category": "carkifelek",
        "desc": "Rakipten 1 rastgele joker çalarsın.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "karsilikli_ekstra",
        "name": "Karşılıklı Ekstra Joker",
        "icon": "🎁",
        "category": "carkifelek",
        "desc": "İki tarafa da +1 rastgele joker verir.",
        "phase": "your_turn",
        "implemented": True
    },
    {
        "id": "sansur",
        "name": "Sansür",
        "icon": "⛔",
        "category": "carkifelek",
        "desc": "Rakip 3 tur boyunca yeni joker kullanamaz.",
        "phase": "your_turn",
        "implemented": True
    },
]


# ==========================================
# HELPER FONKSİYONLAR
# ==========================================

def get_joker_by_id(joker_id):
    """ID ile joker bilgisini döner."""
    for j in JOKERS:
        if j["id"] == joker_id:
            return j
    return None


def get_all_joker_ids():
    """Tüm joker ID'lerini liste olarak döner."""
    return [j["id"] for j in JOKERS]


def get_random_jokers(count, exclude_ids=None):
    """Havuzdan rastgele N tane joker seçer."""
    import random
    exclude_ids = exclude_ids or []
    available = [j for j in JOKERS if j["id"] not in exclude_ids]
    count = min(count, len(available))
    return random.sample(available, count)


def get_public_joker_info(joker_id):
    """Frontend'e gönderilecek güvenli joker bilgisi."""
    j = get_joker_by_id(joker_id)
    if not j:
        return None
    return {
        "id": j["id"],
        "name": j["name"],
        "icon": j["icon"],
        "category": j["category"],
        "desc": j["desc"],
        "phase": j["phase"],
    }