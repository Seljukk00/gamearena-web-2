"""
STADYUM TANIMA - Online Multiplayer
- Stadyum resmini gor, ismini yaz
- 30 saniye sure
- Sirayla oynanir (host once)
- 4 farkli joker
"""

import os
import sys
import time
import random
import pygame

from oyun_modlari.stadyum_tanima.stadyumlar import (
    STADYUMLAR, get_stadyum_by_img, check_answer
)


def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)


# ============================================================
# RENKLER
# ============================================================

WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
DARK = (18, 22, 32)
PANEL = (28, 34, 48)
PANEL_2 = (38, 45, 62)
GRAY = (150, 150, 150)
LIGHT_GRAY = (210, 210, 210)
GOLD = (255, 215, 0)
GREEN = (0, 180, 90)
RED = (210, 60, 60)
BLUE = (40, 120, 220)
CYAN = (0, 210, 210)
ORANGE = (255, 165, 0)
YELLOW = (255, 240, 120)
PURPLE = (150, 80, 180)


# ============================================================
# SABITLER
# ============================================================

TOTAL_ROUNDS = 10            # 5'er soru her oyuncuya
TIME_PER_QUESTION = 30.0
POINT_CORRECT = 10
POINT_WRONG = -3
POINT_FAST_BONUS = 5
JOKER_PENALTY = 3            # Joker kullanim cezasi
MAX_JOKERS = 3               # Her oyuncuya 3 joker hakki


# ============================================================
# ANA OYUN
# ============================================================

class StadyumTanimaGame:
    def __init__(self, screen, width, height, net, player_num, my_name):
        self.screen = screen
        self.width = width
        self.height = height
        self.net = net
        self.player_num = player_num
        self.my_name = my_name if my_name else ("Host" if player_num == 1 else "Oyuncu")
        self.running = True

        self.font_title = pygame.font.Font(None, 42)
        self.font_big = pygame.font.Font(None, 32)
        self.font_med = pygame.font.Font(None, 26)
        self.font_small = pygame.font.Font(None, 22)
        self.font_tiny = pygame.font.Font(None, 18)
        self.font_huge = pygame.font.Font(None, 56)
        self.font_timer = pygame.font.Font(None, 48)
        self.font_input = pygame.font.Font(None, 36)

        self.clock = pygame.time.Clock()

        self.my_score = 0
        self.opp_score = 0

        # Joker
        self.my_jokers_left = MAX_JOKERS
        self.opp_jokers_left = MAX_JOKERS
        self.used_jokers_this_round = []  # ["takim", "ulke", ...]

        # Sorular
        self.stadyum_order = []      # [img1, img2, ...]
        self.current_round = 0
        self.current_player = 1      # Sirayla oynanir

        # State
        self.state = "waiting_setup"
        self.message = "Baglanti kuruluyor..."

        # Cevap
        self.user_input = ""
        self.input_active = False
        self.answer_submitted = False
        self.last_correct = False
        self.last_real_answer = ""
        self.question_start_time = 0
        self.show_result_until = 0

        # Cache
        self.image_cache = {}

        # UI
        self.back_r = pygame.Rect(0, 0, 0, 0)
        self.image_r = pygame.Rect(0, 0, 0, 0)
        self.input_r = pygame.Rect(0, 0, 0, 0)
        self.submit_r = pygame.Rect(0, 0, 0, 0)
        self.timer_r = pygame.Rect(0, 0, 0, 0)
        # Joker butonlari
        self.joker_takim_r = pygame.Rect(0, 0, 0, 0)
        self.joker_ulke_r = pygame.Rect(0, 0, 0, 0)
        self.joker_harf_r = pygame.Rect(0, 0, 0, 0)
        self.joker_5050_r = pygame.Rect(0, 0, 0, 0)

        # Joker sonuclari (gosterilecek bilgiler)
        self.shown_takim = None
        self.shown_ulke = None
        self.shown_harf = None
        self.shown_5050 = None  # [(secenek1, secenek2)]

        self.update_layout()

        # Network handshake
        if self.player_num == 1:
            self.state = "waiting_client"
            self.message = "Rakip hazirlaniyor..."
        else:
            if self.net:
                self.net.send({"type": "stad_ready"})
            self.state = "waiting_setup"
            self.message = "Host hazirliyor..."

    # --------------------------------------------------------

    def update_layout(self):
        self.width, self.height = self.screen.get_size()

        self.back_r = pygame.Rect(20, 18, 110, 38)

        # Stadyum resmi - ortada buyuk
        img_w = min(700, self.width - 350)
        img_h = 400
        self.image_r = pygame.Rect(
            (self.width - img_w) // 2,
            95,
            img_w,
            img_h
        )

        # Input alani
        input_w = 500
        self.input_r = pygame.Rect(
            self.width // 2 - input_w // 2,
            self.image_r.bottom + 30,
            input_w,
            50
        )

        # Submit butonu
        self.submit_r = pygame.Rect(
            self.input_r.right + 15,
            self.input_r.y,
            120,
            50
        )

        # Timer (sag ust)
        self.timer_r = pygame.Rect(self.width - 200, 88, 160, 60)

        # Joker butonlari (sag yan panel)
        joker_x = self.width - 200
        joker_w = 180
        joker_h = 50
        joker_y = 180

        self.joker_takim_r = pygame.Rect(joker_x, joker_y, joker_w, joker_h)
        self.joker_ulke_r = pygame.Rect(joker_x, joker_y + 70, joker_w, joker_h)
        self.joker_harf_r = pygame.Rect(joker_x, joker_y + 140, joker_w, joker_h)
        self.joker_5050_r = pygame.Rect(joker_x, joker_y + 210, joker_w, joker_h)

    def load_image(self, img_key):
        if img_key in self.image_cache:
            return self.image_cache[img_key]

        img_folder = resource_path(os.path.join("oyun_modlari", "stadyum_tanima", "images"))

        for ext in [".jpg", ".jpeg", ".png", ".webp"]:
            p = os.path.join(img_folder, img_key + ext)
            if os.path.exists(p):
                try:
                    img = pygame.image.load(p).convert()
                    # Boyutu ayarla (image_r'a sigsin)
                    img = pygame.transform.smoothscale(img, (self.image_r.width, self.image_r.height))
                    self.image_cache[img_key] = img
                    return img
                except Exception as e:
                    print(f"[STADYUM] Resim yukleme hatasi: {e}")

        # Fallback
        surf = pygame.Surface((self.image_r.width, self.image_r.height))
        surf.fill((40, 60, 80))
        msg = self.font_big.render(f"Resim bulunamadi: {img_key}", True, WHITE)
        surf.blit(msg, (surf.get_width() // 2 - msg.get_width() // 2,
                        surf.get_height() // 2 - msg.get_height() // 2))
        self.image_cache[img_key] = surf
        return surf

    # --------------------------------------------------------

    def host_setup_match(self):
        if len(STADYUMLAR) < TOTAL_ROUNDS:
            print(f"[STADYUM] Sadece {len(STADYUMLAR)} stadyum var")
        
        # Stadyumlari karistir
        selected = random.sample(STADYUMLAR, min(TOTAL_ROUNDS, len(STADYUMLAR)))
        self.stadyum_order = [s["img"] for s in selected]

        if self.net:
            self.net.send({
                "type": "stad_setup",
                "stadyumlar": self.stadyum_order
            })

        self.current_round = 0
        self.start_round()

    def start_round(self):
        if self.current_round >= len(self.stadyum_order):
            self.state = "game_over"
            self.message = "Oyun bitti!"
            return

        # Sira degisimi
        self.current_player = 1 if self.current_round % 2 == 0 else 2

        self.user_input = ""
        self.input_active = True
        self.answer_submitted = False
        self.last_correct = False
        self.last_real_answer = ""
        self.question_start_time = time.time()
        self.used_jokers_this_round = []
        self.shown_takim = None
        self.shown_ulke = None
        self.shown_harf = None
        self.shown_5050 = None

        if self.current_player == self.player_num:
            self.state = "my_turn"
            self.message = "Stadyumun ismini yaz! (30 sn)"
        else:
            self.state = "watch"
            self.message = "Rakip cevapliyor, izliyorsun..."

    def end_round(self, correct, real_answer=""):
        if self.answer_submitted:
            return
        
        self.answer_submitted = True
        self.last_correct = correct
        self.last_real_answer = real_answer
        
        # Puanla
        if self.current_player == self.player_num:
            if correct:
                elapsed = time.time() - self.question_start_time
                points = POINT_CORRECT
                if elapsed < 10:
                    points += POINT_FAST_BONUS
                # Joker cezasi
                points -= len(self.used_jokers_this_round) * JOKER_PENALTY
                self.my_score += max(1, points)
            else:
                self.my_score += POINT_WRONG

        self.state = "result"
        self.show_result_until = time.time() + 3.5

    def next_round(self):
        self.current_round += 1
        if self.current_round >= len(self.stadyum_order):
            self.state = "game_over"
            self.message = "Oyun bitti!"
            if self.net:
                self.net.send({"type": "stad_end"})
        else:
            self.start_round()
            if self.net and self.player_num == 1:
                self.net.send({"type": "stad_next", "round": self.current_round})

    # --------------------------------------------------------

    def submit_answer(self):
        """Kullanici cevabi gonder"""
        if self.state != "my_turn" or self.answer_submitted:
            return

        stadyum_img = self.stadyum_order[self.current_round]
        stadyum = get_stadyum_by_img(stadyum_img)

        if not stadyum:
            return

        correct = check_answer(stadyum, self.user_input)

        # Network'e bildir
        if self.net:
            self.net.send({
                "type": "stad_answer",
                "round": self.current_round,
                "answer": self.user_input,
                "correct": correct,
                "real": stadyum["isim"]
            })

        self.end_round(correct, stadyum["isim"])

    # --------------------------------------------------------
    # JOKERLER
    # --------------------------------------------------------

    def use_joker(self, joker_type):
        if self.state != "my_turn":
            return
        if self.my_jokers_left <= 0:
            return
        if joker_type in self.used_jokers_this_round:
            return

        stadyum_img = self.stadyum_order[self.current_round]
        stadyum = get_stadyum_by_img(stadyum_img)
        if not stadyum:
            return

        self.my_jokers_left -= 1
        self.used_jokers_this_round.append(joker_type)

        if joker_type == "takim":
            self.shown_takim = stadyum["takim"]
        elif joker_type == "ulke":
            self.shown_ulke = stadyum["ulke"]
        elif joker_type == "harf":
            self.shown_harf = stadyum["isim"][0]
        elif joker_type == "5050":
            # 4 seçenek olustur (1 dogru + 3 yanlis)
            all_names = [s["isim"] for s in STADYUMLAR if s["img"] != stadyum_img]
            wrong = random.sample(all_names, min(3, len(all_names)))
            options = [stadyum["isim"]] + wrong[:1]  # Dogru + 1 yanlis = 2 secenek
            random.shuffle(options)
            self.shown_5050 = options

        # Network'e bildir
        if self.net:
            self.net.send({
                "type": "stad_joker_used",
                "player": self.player_num,
                "joker": joker_type
            })

    # --------------------------------------------------------

    def send_exit(self):
        try:
            if self.net and self.net.connected:
                self.net.send({"type": "stad_exit"})
        except Exception:
            pass

    def process_network(self):
        if not self.net:
            return

        for msg in self.net.get():
            t = msg.get("type")

            if t == "stad_ready":
                if self.player_num == 1 and self.state == "waiting_client":
                    print("[STADYUM] Client hazir, setup baslatiliyor")
                    self.host_setup_match()

            elif t == "stad_setup":
                self.stadyum_order = msg.get("stadyumlar", [])
                self.current_round = 0
                self.start_round()

            elif t == "stad_answer":
                if msg.get("round") != self.current_round:
                    continue
                correct = msg.get("correct", False)
                real = msg.get("real", "")
                
                # Rakip cevap verdi
                if correct:
                    self.opp_score += POINT_CORRECT
                else:
                    self.opp_score += POINT_WRONG
                
                self.end_round(correct, real)

            elif t == "stad_joker_used":
                player = msg.get("player")
                joker = msg.get("joker")
                if player != self.player_num:
                    self.opp_jokers_left -= 1

            elif t == "stad_next":
                self.current_round = msg.get("round", 0)
                self.start_round()

            elif t == "stad_end":
                self.state = "game_over"
                self.message = "Oyun bitti!"

            elif t == "stad_exit":
                self.state = "game_over"
                self.message = "Rakip cikti."

    # --------------------------------------------------------

    def handle_click(self, pos):
        if self.back_r.collidepoint(pos):
            self.send_exit()
            self.running = False
            return

        if self.state != "my_turn":
            return

        # Input alanina tikla
        if self.input_r.collidepoint(pos):
            self.input_active = True
            return

        # Submit
        if self.submit_r.collidepoint(pos) and self.user_input.strip():
            self.submit_answer()
            return

        # Joker butonlari
        if self.joker_takim_r.collidepoint(pos):
            self.use_joker("takim")
        elif self.joker_ulke_r.collidepoint(pos):
            self.use_joker("ulke")
        elif self.joker_harf_r.collidepoint(pos):
            self.use_joker("harf")
        elif self.joker_5050_r.collidepoint(pos):
            self.use_joker("5050")

    def handle_key(self, event):
        if self.state != "my_turn" or self.answer_submitted:
            return

        if event.key == pygame.K_RETURN:
            if self.user_input.strip():
                self.submit_answer()
        elif event.key == pygame.K_BACKSPACE:
            self.user_input = self.user_input[:-1]
        else:
            c = event.unicode
            if c and c.isprintable() and len(self.user_input) < 40:
                self.user_input += c

    def update(self):
        self.process_network()

        # Zaman dolduysa
        if self.state == "my_turn":
            elapsed = time.time() - self.question_start_time
            if elapsed >= TIME_PER_QUESTION:
                # Sure bitti, otomatik yanlis
                stadyum_img = self.stadyum_order[self.current_round]
                stadyum = get_stadyum_by_img(stadyum_img)
                if stadyum and self.net:
                    self.net.send({
                        "type": "stad_answer",
                        "round": self.current_round,
                        "answer": "(sure doldu)",
                        "correct": False,
                        "real": stadyum["isim"]
                    })
                self.end_round(False, stadyum["isim"] if stadyum else "")

        # Result -> Next
        if self.state == "result" and time.time() >= self.show_result_until:
            if self.player_num == 1:
                self.next_round()

    # --------------------------------------------------------

    def draw_button(self, rect, text, color, hover_color, border=WHITE, enabled=True):
        if enabled:
            hv = rect.collidepoint(pygame.mouse.get_pos())
            bg = hover_color if hv else color
        else:
            bg = (40, 40, 40)
        
        pygame.draw.rect(self.screen, bg, rect, border_radius=10)
        pygame.draw.rect(self.screen, border if enabled else GRAY, rect, 2, border_radius=10)
        
        txt_color = WHITE if enabled else GRAY
        txt = self.font_med.render(text, True, txt_color)
        self.screen.blit(txt, (rect.centerx - txt.get_width() // 2,
                               rect.centery - txt.get_height() // 2))

    def draw_header(self):
        pygame.draw.rect(self.screen, PANEL_2, (0, 0, self.width, 70))
        title = self.font_title.render("STADYUM TANIMA", True, GOLD)
        self.screen.blit(title, (self.width // 2 - title.get_width() // 2, 16))

        self.draw_button(self.back_r, "GERI", (70, 30, 30), (110, 40, 40), RED)

        # Tur
        q_num = min(self.current_round + 1, len(self.stadyum_order))
        total = max(len(self.stadyum_order), 1)
        q_txt = self.font_med.render(f"Tur: {q_num}/{total}", True, CYAN)
        self.screen.blit(q_txt, (150, 22))

        # Skor
        score_txt = self.font_small.render(
            f"{self.my_name[:10]}: {self.my_score}  |  Rakip: {self.opp_score}",
            True, WHITE
        )
        self.screen.blit(score_txt, (self.width - score_txt.get_width() - 220, 25))

    def draw_timer(self):
        if self.state != "my_turn":
            return

        elapsed = time.time() - self.question_start_time
        remaining = max(0, TIME_PER_QUESTION - elapsed)

        if remaining > 15:
            color = GREEN
        elif remaining > 5:
            color = ORANGE
        else:
            color = RED

        pygame.draw.rect(self.screen, (15, 15, 25), self.timer_r, border_radius=12)
        pygame.draw.rect(self.screen, color, self.timer_r, 3, border_radius=12)

        time_str = f"{int(remaining)}s"
        t = self.font_timer.render(time_str, True, color)
        self.screen.blit(t, (self.timer_r.centerx - t.get_width() // 2,
                             self.timer_r.centery - t.get_height() // 2))

    def draw_image(self):
        if not self.stadyum_order or self.current_round >= len(self.stadyum_order):
            return

        img_key = self.stadyum_order[self.current_round]
        img = self.load_image(img_key)

        # Cerceve
        pygame.draw.rect(self.screen, PANEL, self.image_r, border_radius=14)
        self.screen.blit(img, self.image_r.topleft)
        pygame.draw.rect(self.screen, GOLD, self.image_r, 3, border_radius=14)

    def draw_input(self):
        if self.state != "my_turn":
            return

        # Input box
        border_col = GOLD if self.input_active else GRAY
        pygame.draw.rect(self.screen, (30, 30, 45), self.input_r, border_radius=10)
        pygame.draw.rect(self.screen, border_col, self.input_r, 3, border_radius=10)

        # Text
        display_text = self.user_input if self.user_input else "Stadyum ismini yaz..."
        text_col = WHITE if self.user_input else GRAY
        t = self.font_input.render(display_text, True, text_col)
        # Sigmazsa kucult
        if t.get_width() > self.input_r.width - 30:
            t = self.font_med.render(display_text, True, text_col)
        self.screen.blit(t, (self.input_r.x + 15, self.input_r.centery - t.get_height() // 2))

        # Cursor
        if self.input_active and int(time.time() * 2) % 2:
            cx = self.input_r.x + 15 + t.get_width() if self.user_input else self.input_r.x + 15
            pygame.draw.line(self.screen, WHITE,
                            (cx, self.input_r.y + 12), (cx, self.input_r.bottom - 12), 2)

        # Submit butonu
        enabled = bool(self.user_input.strip())
        self.draw_button(self.submit_r, "GONDER", (25, 110, 55), (35, 150, 75), GREEN, enabled)

    def draw_jokers(self):
        if self.state not in ["my_turn", "result"]:
            return

        # Joker hak bilgisi
        j_label = self.font_small.render(f"Joker: {self.my_jokers_left}/{MAX_JOKERS}", True, GOLD)
        self.screen.blit(j_label, (self.joker_takim_r.x, self.joker_takim_r.y - 25))

        is_my_turn = (self.state == "my_turn")
        has_jokers = (self.my_jokers_left > 0)

        # TAKIM jokeri
        takim_used = "takim" in self.used_jokers_this_round
        enabled = is_my_turn and has_jokers and not takim_used
        self.draw_button(self.joker_takim_r, "TAKIM", (60, 30, 100), (120, 60, 180),
                         PURPLE, enabled)

        # ULKE jokeri
        ulke_used = "ulke" in self.used_jokers_this_round
        enabled = is_my_turn and has_jokers and not ulke_used
        self.draw_button(self.joker_ulke_r, "ULKE", (30, 60, 100), (60, 120, 180),
                         BLUE, enabled)

        # HARF jokeri
        harf_used = "harf" in self.used_jokers_this_round
        enabled = is_my_turn and has_jokers and not harf_used
        self.draw_button(self.joker_harf_r, "ILK HARF", (100, 60, 30), (180, 120, 60),
                         ORANGE, enabled)

        # 50:50 jokeri
        e5050_used = "5050" in self.used_jokers_this_round
        enabled = is_my_turn and has_jokers and not e5050_used
        self.draw_button(self.joker_5050_r, "50:50", (100, 30, 60), (180, 60, 120),
                         (255, 100, 150), enabled)

        # Joker sonuclari (image altinda)
        info_y = self.image_r.bottom - 100
        info_x = self.image_r.x + 15
        
        if self.shown_takim:
            ts = self.font_med.render(f"🏆 Takim: {self.shown_takim}", True, PURPLE)
            bg = pygame.Rect(info_x - 5, info_y - 3, ts.get_width() + 14, ts.get_height() + 6)
            pygame.draw.rect(self.screen, (0, 0, 0, 200), bg, border_radius=6)
            pygame.draw.rect(self.screen, PURPLE, bg, 1, border_radius=6)
            self.screen.blit(ts, (info_x + 2, info_y))
            info_y += 30

        if self.shown_ulke:
            ts = self.font_med.render(f"🌍 Ulke: {self.shown_ulke}", True, BLUE)
            bg = pygame.Rect(info_x - 5, info_y - 3, ts.get_width() + 14, ts.get_height() + 6)
            pygame.draw.rect(self.screen, (0, 0, 0, 200), bg, border_radius=6)
            pygame.draw.rect(self.screen, BLUE, bg, 1, border_radius=6)
            self.screen.blit(ts, (info_x + 2, info_y))
            info_y += 30

        if self.shown_harf:
            ts = self.font_med.render(f"🔤 Ilk Harf: {self.shown_harf}", True, ORANGE)
            bg = pygame.Rect(info_x - 5, info_y - 3, ts.get_width() + 14, ts.get_height() + 6)
            pygame.draw.rect(self.screen, (0, 0, 0, 200), bg, border_radius=6)
            pygame.draw.rect(self.screen, ORANGE, bg, 1, border_radius=6)
            self.screen.blit(ts, (info_x + 2, info_y))
            info_y += 30

        if self.shown_5050:
            opts = " VEYA ".join(self.shown_5050)
            ts = self.font_small.render(f"💡 {opts}", True, (255, 100, 150))
            bg = pygame.Rect(info_x - 5, info_y - 3, ts.get_width() + 14, ts.get_height() + 6)
            pygame.draw.rect(self.screen, (0, 0, 0, 200), bg, border_radius=6)
            pygame.draw.rect(self.screen, (255, 100, 150), bg, 1, border_radius=6)
            self.screen.blit(ts, (info_x + 2, info_y))

    def draw_result(self):
        if self.state != "result":
            return

        # Sonuc kutusu
        bg_w = 600
        bg_h = 120
        bg = pygame.Rect(
            self.width // 2 - bg_w // 2,
            self.image_r.bottom + 20,
            bg_w,
            bg_h
        )
        
        if self.last_correct:
            border = GREEN
            color = GREEN
            text = "DOGRU!"
        else:
            border = RED
            color = RED
            text = "YANLIS!"

        pygame.draw.rect(self.screen, (15, 15, 25), bg, border_radius=12)
        pygame.draw.rect(self.screen, border, bg, 3, border_radius=12)

        t1 = self.font_huge.render(text, True, color)
        self.screen.blit(t1, (bg.centerx - t1.get_width() // 2, bg.y + 10))

        if self.last_real_answer:
            t2 = self.font_med.render(f"Cevap: {self.last_real_answer}", True, GOLD)
            self.screen.blit(t2, (bg.centerx - t2.get_width() // 2, bg.bottom - 35))

    def draw_message(self):
        if self.message:
            bg = pygame.Rect(self.width // 2 - 300, self.height - 55, 600, 38)
            bs = pygame.Surface((bg.width, bg.height), pygame.SRCALPHA)
            bs.fill((0, 0, 0, 160))
            self.screen.blit(bs, bg.topleft)
            pygame.draw.rect(self.screen, GOLD, bg, 1, border_radius=8)

            msg = self.font_small.render(self.message, True, GOLD)
            self.screen.blit(msg, (bg.centerx - msg.get_width() // 2,
                                   bg.centery - msg.get_height() // 2))

    def draw_game_over(self):
        if self.state != "game_over":
            return

        overlay = pygame.Surface((self.width, self.height), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 200))
        self.screen.blit(overlay, (0, 0))

        box = pygame.Rect(self.width // 2 - 300, self.height // 2 - 180, 600, 360)
        pygame.draw.rect(self.screen, PANEL_2, box, border_radius=16)
        pygame.draw.rect(self.screen, GOLD, box, 3, border_radius=16)

        if self.my_score > self.opp_score:
            title_t = "KAZANDIN!"
            tc = GOLD
        elif self.my_score < self.opp_score:
            title_t = "KAYBETTIN!"
            tc = RED
        else:
            title_t = "BERABERE!"
            tc = CYAN

        t1 = self.font_title.render(title_t, True, tc)
        self.screen.blit(t1, (box.centerx - t1.get_width() // 2, box.y + 40))

        score_t = self.font_huge.render(f"{self.my_score} - {self.opp_score}", True, WHITE)
        self.screen.blit(score_t, (box.centerx - score_t.get_width() // 2, box.y + 120))

        n1 = self.font_med.render(self.my_name, True, GREEN)
        n2 = self.font_med.render("Rakip", True, ORANGE)
        self.screen.blit(n1, (box.x + 60, box.y + 200))
        self.screen.blit(n2, (box.right - 60 - n2.get_width(), box.y + 200))

        info = self.font_small.render("ESC ile cikabilirsin", True, LIGHT_GRAY)
        self.screen.blit(info, (box.centerx - info.get_width() // 2, box.y + 290))

    def draw_waiting(self):
        if self.state not in ["waiting_client", "waiting_setup"]:
            return

        msg = self.font_big.render(self.message, True, GOLD)
        self.screen.blit(msg, (self.width // 2 - msg.get_width() // 2,
                               self.height // 2 - msg.get_height() // 2))

        dots = "." * (int(time.time() * 2) % 4)
        d = self.font_med.render(dots, True, CYAN)
        self.screen.blit(d, (self.width // 2 - 20, self.height // 2 + 40))

    def draw_watch_indicator(self):
        """Rakip oynarken bilgi"""
        if self.state != "watch":
            return
        
        bg = pygame.Rect(self.width // 2 - 200, self.image_r.bottom + 25, 400, 50)
        pygame.draw.rect(self.screen, (50, 30, 0), bg, border_radius=10)
        pygame.draw.rect(self.screen, ORANGE, bg, 2, border_radius=10)
        
        msg = self.font_big.render("RAKIP OYNUYOR", True, ORANGE)
        self.screen.blit(msg, (bg.centerx - msg.get_width() // 2,
                               bg.centery - msg.get_height() // 2))

    def draw(self):
        self.screen.fill(DARK)
        self.draw_header()

        if self.state in ["waiting_client", "waiting_setup"]:
            self.draw_waiting()
        elif self.state in ["my_turn", "watch", "result"]:
            self.draw_image()
            self.draw_timer()
            
            if self.state == "my_turn":
                self.draw_input()
                self.draw_jokers()
            elif self.state == "watch":
                self.draw_watch_indicator()
            elif self.state == "result":
                self.draw_result()
            
            self.draw_message()

        self.draw_game_over()
        pygame.display.flip()

    # --------------------------------------------------------

    def run(self):
        while self.running:
            self.clock.tick(60)
            self.update_layout()

            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    self.send_exit()
                    self.running = False

                elif event.type == pygame.KEYDOWN:
                    if event.key == pygame.K_ESCAPE:
                        self.send_exit()
                        self.running = False
                    else:
                        self.handle_key(event)

                elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    self.handle_click(event.pos)

            self.update()
            self.draw()


# ============================================================
# DISARI ACILAN FONKSIYON
# ============================================================

def run_stadyum_online(screen, WIDTH, HEIGHT, net, player_num, my_name, _unused):
    game = StadyumTanimaGame(screen, WIDTH, HEIGHT, net, player_num, my_name)
    game.run()