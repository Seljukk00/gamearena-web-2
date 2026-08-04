"""
Kim Milyoner - AI Soru Üretici
Google Gemini API ile Türkçe soru üretir (yeni google-genai paketi)
"""

import os
import json
import asyncio
import random
import time
from dotenv import load_dotenv
from google import genai
from google.genai import types

# .env dosyasından key yükle
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Global client
_client = None

if GEMINI_API_KEY:
    try:
        _client = genai.Client(api_key=GEMINI_API_KEY)
        print("[AI] Gemini API key yüklendi ✓")
    except Exception as e:
        print(f"[AI] Client oluşturma hatası: {e}")
        _client = None
else:
    print("[AI] UYARI: GEMINI_API_KEY bulunamadı!")


# Kullanılacak model (2025 güncel)
MODEL_NAME = "gemini-flash-lite-latest"


# Zorluk dağılımları (12 soru toplam)
DIFFICULTY_PROFILES = {
    "kolay":    {"kolay": 6, "orta": 6, "zor": 0, "cok_zor": 0},
    "orta":     {"kolay": 3, "orta": 5, "zor": 4, "cok_zor": 0},
    "zor":      {"kolay": 0, "orta": 3, "zor": 6, "cok_zor": 3},
    "cok_zor":  {"kolay": 0, "orta": 0, "zor": 5, "cok_zor": 7},
    "karisik":  {"kolay": 2, "orta": 3, "zor": 4, "cok_zor": 3}
}


def build_prompt(category, difficulty="karisik"):
    """Gemini için prompt oluştur"""

    # Rastgele futbol alt konuları (her seferinde farklı odak)
    futbol_odaklar = [
        "Türkiye Süper Ligi tarihi ve güncel takımlar",
        "Şampiyonlar Ligi finalleri ve efsane maçlar",
        "Dünya Kupası tarihi ve unutulmaz anlar",
        "Avrupa büyük ligleri (Premier, LaLiga, Serie A, Bundesliga)",
        "Efsane futbolcular ve teknik direktörler",
        "Milli takımlar ve EURO tarihi",
        "Transfer rekorları ve Ballon d'Or tarihi",
        "Türk futbolcuların Avrupa serüvenleri",
        "Fenerbahçe, Galatasaray, Beşiktaş tarihi",
        "Copa America ve Güney Amerika futbolu",
        "Modern futbol yıldızları (2020 sonrası)",
        "Emekli futbol efsaneleri (1990-2010 arası)"
    ]
    
    genel_odaklar = [
        "Türkiye tarihi ve coğrafyası",
        "Bilim ve teknoloji",
        "Edebiyat ve şiir",
        "Sinema ve dizi",
        "Müzik ve sanat",
        "Dünya tarihi",
        "Astronomi ve uzay",
        "Türkçe edebiyatı ve yazarlar",
        "İcatlar ve buluşlar",
        "Coğrafya ve ülkeler",
        "Sanat tarihi",
        "Popüler kültür"
    ]

    if category == "futbol":
        # Rastgele 4 alt odak seç
        secilen = random.sample(futbol_odaklar, 4)
        topic = f"futbol. Bu sorularda özellikle şu konulara odaklan: {', '.join(secilen)}"
    elif category == "genel_kultur":
        secilen = random.sample(genel_odaklar, 4)
        topic = f"genel kültür. Bu sorularda özellikle şu konulara odaklan: {', '.join(secilen)}"
    else:
        secilen_f = random.sample(futbol_odaklar, 2)
        secilen_g = random.sample(genel_odaklar, 2)
        topic = f"6 tanesi futbol ({', '.join(secilen_f)}), 6 tanesi genel kültür ({', '.join(secilen_g)}) karışık"

    # Rastgele seed (her seferinde farklı sorular için)
    random_seed = random.randint(10000, 999999)
    timestamp = int(time.time())

    # Zorluk dağılımını al
    dist = DIFFICULTY_PROFILES.get(difficulty, DIFFICULTY_PROFILES["karisik"])
    
    zorluk_aciklamasi = ""
    if difficulty == "kolay":
        zorluk_aciklamasi = "Genel oyuncular için KOLAY seviye. Herkesin bildiği temel sorular olsun."
    elif difficulty == "orta":
        zorluk_aciklamasi = "Ortalama futbol/kültür bilgisi olan biri için ORTA seviye."
    elif difficulty == "zor":
        zorluk_aciklamasi = "İyi bilgisi olan oyuncular için ZOR seviye. Uzmanlık gerektiren detaylı sorular."
    elif difficulty == "cok_zor":
        zorluk_aciklamasi = "Uzman seviye ÇOK ZOR sorular. Nadir bilinen istatistikler, tarihsel detaylar, spesifik bilgiler."
    else:
        zorluk_aciklamasi = "Klasik Milyoner formatı, aşamalı zorluk."

    prompt = f"""Sen bir "Kim Milyoner Olmak İster?" oyununun soru hazırlayıcısısın.

[Session ID: {random_seed}-{timestamp}]

12 tane TÜRKÇE soru üret. Konu: {topic}

ZORLUK PROFİLİ: {difficulty.upper()}
{zorluk_aciklamasi}

ZORLUK DAĞILIMI:
- {dist['kolay']} KOLAY (herkes bilir)
- {dist['orta']} ORTA (biraz düşünmek lazım)
- {dist['zor']} ZOR (uzmanlık gerektirir)
- {dist['cok_zor']} ÇOK ZOR (nadir bilinir)

⚠️ ÇOK ÖNEMLİ — YARATICILIK KURALLARI:
- YAPMAK ZORUNDA olduğun: HER SEFERİNDE FARKLI sorular üret. Aynı soruları tekrar etme!
- KAÇINACAKLARIN (klişe sorular — kesinlikle sorma):
  * "Türkiye'nin başkenti neresidir?"
  * "Bir futbol takımı sahada kaç oyuncu ile oynar?"
  * "İstanbul'un fethi hangi yıldadır?"
  * "Süper Lig'de kaç takım var?"
  * "Türkiye'nin en yüksek dağı hangisidir?"
  * "En son Dünya Kupası'nı kim kazandı?"
  * "Fenerbahçe/Galatasaray/Beşiktaş kaç yılında kuruldu?"
- Az bilinen, ilginç, düşündürücü sorular sor
- Rastgele ve orijinal ol — 12 farklı konuya değin
- Aynı takım/kişi/yıl 3'ten fazla soruda geçmesin

DİĞER KURALLAR:
1. Her soru 4 şıklı olsun (A, B, C, D)
2. Sadece 1 doğru cevap
3. Şıklar mantıklı ve karıştırıcı olsun
4. Türkiye ile ilgili sorular ağırlıklı olsun
5. Farklı zamanları kapsa (eski + yeni karışık)
6. Sorular birbirini tekrar etmesin, çeşitlendir!

CEVAP FORMATI - Sadece geçerli JSON dön, başka hiçbir şey yazma:

{{
  "sorular": [
    {{
      "soru": "Soru metni burada?",
      "secenekler": ["A) Şık 1", "B) Şık 2", "C) Şık 3", "D) Şık 4"],
      "cevap": "A",
      "zorluk": "kolay"
    }}
  ]
}}

ÖNEMLİ:
- Sadece JSON dön, markdown block kullanma
- Türkçe karakterler kullan
- Şıkların başında "A) ", "B) ", "C) ", "D) " olsun
- "cevap" alanı sadece harf olsun
- "zorluk" alanı: "kolay", "orta", "zor", "cok_zor" değerlerinden biri

Session ID {random_seed} için ÖZGÜN sorular üret. Önceki oturumlardan farklı olsun.
"""
    return prompt


def parse_gemini_response(text):
    """Gemini cevabını parse et"""
    try:
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        data = json.loads(text)
        return data.get("sorular", [])
    except Exception as e:
        print(f"[AI] JSON parse hatası: {e}")
        print(f"[AI] Ham cevap: {text[:500]}")
        return []


def validate_question(q):
    if not isinstance(q, dict):
        return False
    if "soru" not in q or "secenekler" not in q or "cevap" not in q:
        return False
    if not isinstance(q["secenekler"], list) or len(q["secenekler"]) != 4:
        return False
    if q["cevap"] not in ["A", "B", "C", "D"]:
        return False
    if not q["soru"].strip():
        return False
    return True


def organize_by_difficulty(questions):
    result = {"kolay": [], "orta": [], "zor": [], "cok_zor": []}

    for q in questions:
        if not validate_question(q):
            continue
        zorluk = q.get("zorluk", "orta")
        if zorluk not in result:
            zorluk = "orta"
        result[zorluk].append(q)

    return result


def generate_questions_sync(category="futbol", difficulty="karisik"):
    """Gemini'den 12 soru üret (sync)"""
    if not _client:
        print("[AI] Client yok")
        return None

    try:
        print(f"[AI] Soru üretiliyor... Kategori: {category} | Zorluk: {difficulty}")
        prompt = build_prompt(category, difficulty)

        # Yaratıcılık için yüksek temperature + rastgele seed
        response = _client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=1.2,        # Yüksek yaratıcılık (0.0-2.0 arası)
                top_p=0.95,             # Daha çeşitli cevaplar
                top_k=40,               # Cevap havuzu büyük
                max_output_tokens=4096  # Yeterli uzunluk
            )
        )

        if not response or not response.text:
            print("[AI] Gemini boş cevap döndü")
            return None

        questions = parse_gemini_response(response.text)

        if len(questions) < 8:
            print(f"[AI] Yetersiz soru: {len(questions)}")
            return None

        organized = organize_by_difficulty(questions)
        total = sum(len(v) for v in organized.values())
        print(f"[AI] Üretildi: kolay={len(organized['kolay'])}, orta={len(organized['orta'])}, zor={len(organized['zor'])}, cok_zor={len(organized['cok_zor'])} (toplam: {total})")

        return organized

    except Exception as e:
        print(f"[AI] Soru üretme hatası: {e}")
        import traceback
        traceback.print_exc()
        return None


async def generate_questions_async(category="futbol", difficulty="karisik"):
    """Async wrapper"""
    if not _client:
        return None
    try:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, generate_questions_sync, category, difficulty)
    except Exception as e:
        print(f"[AI] Async hata: {e}")
        return None


# Test
if __name__ == "__main__":
    print("\n=== TEST BAŞLADI ===\n")
    result = generate_questions_sync("futbol")
    if result:
        print("\n=== ÖRNEK SORULAR ===")
        for zorluk, sorular in result.items():
            if sorular:
                print(f"\n[{zorluk.upper()}]")
                q = sorular[0]
                print(f"S: {q['soru']}")
                for opt in q['secenekler']:
                    print(f"   {opt}")
                print(f"Cevap: {q['cevap']}")
    else:
        print("\n❌ Soru üretilemedi!")