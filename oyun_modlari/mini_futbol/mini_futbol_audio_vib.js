// ========================================
// 🔊 MİNİ FUTBOL - SES & TİTREŞİM MOTORU
// ========================================

// ========================================
// 🔊 SES SİSTEMİ (Audio Manager)
// ========================================
const MiniAudio = {
    _unlocked: false,
    _cache: {},
    _lastPlayed: {},
    _unlocking: false,
    _audioCtx: null,

    preload(name) {
        if (!name) return;
        if (this._cache[name]) return;
        try {
            const audio = new Audio(`/oyun_modlari/mini_futbol/sounds/${name}`);
            audio.preload = "auto";
            // ✨ Production cold-cache: dosyayı gerçekten indirmeye zorla
            audio.load();
            this._cache[name] = audio;
        } catch (e) {}
    },

    unlock() {
        if (this._unlocked || this._unlocking) return;
        this._unlocking = true;

        try {
            // 1) WebAudio resume
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) {
                if (!this._audioCtx) this._audioCtx = new AC();
                if (this._audioCtx.state === "suspended") {
                    this._audioCtx.resume().catch(() => {});
                }
            }
        } catch (e) {}

        try {
            // 2) Sessiz HTMLAudio jesture kilidi
            const a = new Audio("/oyun_modlari/mini_futbol/sounds/kick_1.mp3");
            a.volume = 0.001;
            const p = a.play();
            if (p && typeof p.then === "function") {
                p.then(() => {
                    this._unlocked = true;
                    this._unlocking = false;
                    try { a.pause(); } catch (e) {}
                    console.log("[SES] Audio unlocked ✓");
                    this.preloadAll();
                }).catch(() => {
                    this._unlocking = false;
                    console.log("[SES] Audio unlock bekleniyor (jesture gerekli)");
                });
            } else {
                this._unlocked = true;
                this._unlocking = false;
            }
        } catch (e) {
            this._unlocking = false;
        }
    },

    _playOnce(name, volume) {
        let audio = this._cache[name];
        if (!audio) {
            audio = new Audio(`/oyun_modlari/mini_futbol/sounds/${name}`);
            audio.preload = "auto";
            this._cache[name] = audio;
        }
        const clone = audio.cloneNode();
        clone.volume = (volume !== undefined && !isNaN(volume)) ? volume : 0.6;
        return clone.play();
    },

    play(name, volume) {
        if (!name) return;
        if (!this._unlocked) this.unlock();

        // 🌟 GOL ŞARKISI KORUMASI: Gol şarkısı isteklerini kontrol edip 1-12 arasına güvenle mapliyoruz
        if (typeof name === "string" && name.includes("Goal_Songs/goal_song_")) {
            const match = name.match(/goal_song_(\d+)\.mp3/i);
            if (match) {
                let songId = parseInt(match[1]);
                
                // ⚽ Kendi kalesine gol durumunda şarkıyı otomatik olarak rakibe yönlendiriyoruz
                if (typeof miniData !== "undefined" && miniData.gameState) {
                    const gc = miniData.gameState.goal_celebration;
                    const isOwnGoal = miniData.gameState.last_goal_own || (gc && gc.own_goal);
                    const redirectPid = (gc && gc.own_goal_music_pid) || miniData.gameState._ownGoalMusicPid;
                    
                    if (isOwnGoal && redirectPid) {
                        console.log(`[SES YÖNLENDİRME] Kendi kalesine gol tespit edildi. Şarkı sahibi: ${songId} → Rakip: ${redirectPid}`);
                        songId = parseInt(redirectPid);
                    }
                }
                
                if (isNaN(songId) || songId <= 0) {
                    songId = 1;
                } else {
                    songId = ((songId - 1) % 12) + 1;
                }
                name = `Goal_Songs/goal_song_${songId}.mp3`;
            }
        }

        try {
            const p = this._playOnce(name, volume);
            if (p && typeof p.catch === "function") {
                p.catch(() => {
                    this._unlocked = false;
                    this.unlock();
                    setTimeout(() => {
                        try {
                            this._playOnce(name, volume).catch(() => {});
                        } catch (e) {}
                    }, 60);
                });
            }
        } catch (e) {}
    },

    playRandom(group, files, volume) {
        if (!files || files.length === 0) return;
        if (!this._unlocked) this.unlock();

        let available = files;
        const last = this._lastPlayed[group];
        if (files.length > 1 && last) {
            available = files.filter(f => f !== last);
        }

        const chosen = available[Math.floor(Math.random() * available.length)];
        this._lastPlayed[group] = chosen;
        this.play(chosen, volume);
    },

    preloadAll() {
        const files = [
            "explosion.mp3",
            "post_hit.mp3",
            "wall_hit_1.mp3", "wall_hit_2.mp3",
            "goal_1.mp3", "goal_2.mp3", "goal_3.mp3",
            "whistle.mp3",
            "fire_kick_1.mp3", "fire_kick_2.mp3", "fire_kick_3.mp3",
            "kick_1.mp3", "kick_2.mp3",
            "own_goal.mp3"
        ];
        files.forEach(f => this.preload(f));
        console.log("[SES] Hafif sesler preload edildi ✓");
    }
};

// Sayfa yüklenince sesleri cache'e al
setTimeout(() => MiniAudio.preloadAll(), 300);
setTimeout(() => MiniAudio.preloadAll(), 1500); // ✨ cold cache 2. dalga

["pointerdown", "touchstart", "click", "keydown"].forEach(evt => {
    document.addEventListener(evt, () => MiniAudio.unlock(), { passive: true, capture: true });
});

// ========================================
// 📳 GAMEPAD TİTREŞİM SİSTEMİ
// ========================================
const MiniVibration = {
    lastVibration: 0,
    minInterval: 20,  // ✨ Min 20ms arayla
    
    isEnabled() {
        try {
            return localStorage.getItem("miniVibrationEnabled") !== "false";
        } catch(e) { return true; }
    },
    
    getPower(type) {
        const defaults = {
            kick: 25,       // Şut - hafif
            firekick: 50,   // Alevli şut - orta
            wall: 15,       // Duvara çarpma - hafif
            post: 90,       // Direğe çarpma - güçlü
            goal: 50,       // Gol - orta
            whistle: 10     // Santra/düdük - çok hafif
        };
        try {
            const raw = localStorage.getItem("miniVibrationPower_" + type);
            if (raw !== null) {
                const val = parseInt(raw);
                if (!isNaN(val) && val >= 0 && val <= 100) return val;
            }
        } catch(e) {}
        return defaults[type] || 50;
    },
    
    vibrate(strong, weak, duration) {
        if (!this.isEnabled()) return;
        if (!miniGamepad.connected) return;
        if (!miniGamepad.enabled) return;
        if (strong <= 0.01 && weak <= 0.01) return;
        
        const now = performance.now();
        if (now - this.lastVibration < this.minInterval) return;
        this.lastVibration = now;
        
        try {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            const pad = pads[miniGamepad.index];
            if (!pad) return;
            
            if (pad.vibrationActuator && pad.vibrationActuator.playEffect) {
                pad.vibrationActuator.playEffect("dual-rumble", {
                    startDelay: 0,
                    duration: duration,
                    strongMagnitude: Math.min(1.0, Math.max(0, strong)),
                    weakMagnitude: Math.min(1.0, Math.max(0, weak))
                }).catch(() => {});
            }
            else if (pad.hapticActuators && pad.hapticActuators.length > 0) {
                pad.hapticActuators[0].pulse(Math.max(strong, weak), duration).catch(() => {});
            }
        } catch(e) {}
    },
    
    kick(sprintActive) {
        const p = this.getPower("kick") / 100;
        if (sprintActive) {
            this.vibrate(0.8 * p, 0.6 * p, 100);
        } else {
            this.vibrate(0.6 * p, 0.4 * p, 80);
        }
    },
    
    firekick() {
        const p = this.getPower("firekick") / 100;
        this.vibrate(1.0 * p, 0.8 * p, 150);
    },
    
    ballTouch() {
        const p = this.getPower("kick") / 100;
        this.vibrate(0.3 * p, 0.5 * p, 40);
    },
    
    wallHit() {
        const p = this.getPower("wall") / 100;
        this.vibrate(0.8 * p, 0.7 * p, 80);
    },
    
    postHit() {
        const p = this.getPower("post") / 100;
        this.vibrate(1.0 * p, 0.9 * p, 200);
    },
    
    goalScored() {
        const p = this.getPower("goal") / 100;
        this.vibrate(0.9 * p, 0.7 * p, 250);
        setTimeout(() => {
            this.vibrate(0.7 * p, 0.5 * p, 180);
        }, 350);
    },
    
    goalConceded() {
        const p = this.getPower("goal") / 100;
        this.vibrate(0.6 * p, 0.4 * p, 200);
    },
    
    playerCollision() {
        this.vibrate(0.2, 0.15, 60);
    },
    
    countdown() {
        const p = this.getPower("whistle") / 100;
        this.vibrate(0.6 * p, 0.8 * p, 30);
    },
    
    whistle() {
        const p = this.getPower("whistle") / 100;
        this.vibrate(0.8 * p, 1.0 * p, 100);
    },
    
    _testInterval: null,
    testVibrate(type, durationMs) {
        const p = this.getPower(type) / 100;
        if (p <= 0) return;
        
        if (this._testInterval) {
            clearInterval(this._testInterval);
            this._testInterval = null;
        }
        
        const callPreset = () => {
            switch(type) {
                case "kick": this.kick(false); break;
                case "firekick": this.firekick(); break;
                case "wall": this.wallHit(); break;
                case "post": this.postHit(); break;
                case "goal": this.goalScored(); break;
                case "whistle": this.whistle(); break;
            }
        };
        
        callPreset();
        
        const intervalMap = {
            kick: 150,
            firekick: 200,
            wall: 130,
            post: 250,
            goal: 400,
            whistle: 180
        };
        const interval = intervalMap[type] || 200;
        
        const totalDuration = durationMs || 3000;
        const endTime = Date.now() + totalDuration;
        
        this._testInterval = setInterval(() => {
            if (Date.now() >= endTime) {
                clearInterval(this._testInterval);
                this._testInterval = null;
                return;
            }
            callPreset();
        }, interval);
    },
    
    stop() {
        if (this._testInterval) {
            clearInterval(this._testInterval);
            this._testInterval = null;
        }
        
        if (!miniGamepad.connected) return;
        try {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            const pad = pads[miniGamepad.index];
            if (pad && pad.vibrationActuator) {
                pad.vibrationActuator.reset();
            }
        } catch(e) {}
    }
};