// ========================================
// MİNİ FUTBOL - HOST FİZİK MOTORU
// Backend'deki fiziğin JavaScript kopyası
// Sadece HOST tarayıcısında çalışır
// ========================================

const HP = {  // Host Physics namespace
    // === SABİTLER (default 1v1 - odaya göre startGame'de güncellenir) ===
    FIELD_WIDTH: 1000,
    FIELD_HEIGHT: 500,
    PLAYER_RADIUS: 20,
    BALL_RADIUS: 12,
    GOAL_WIDTH: 180,
    get GOAL_Y_TOP() { return (this.FIELD_HEIGHT - this.GOAL_WIDTH) / 2; },
    get GOAL_Y_BOTTOM() { return this.GOAL_Y_TOP + this.GOAL_WIDTH; },
    KICK_COOLDOWN: 1.0,
    STRONG_KICK_THRESHOLD: 12,
    HARD_BALL_THRESHOLD: 6.0,
    BALL_MAX_SPEED: 18.0,
    PLASE_POWER_MULT: 0.75,
    PLASE_SPIN_FORCE: 0.35,
    PLASE_SPIN_DECAY: 0.94,
    PLASE_SPRINT_BONUS: 1.35,
    PLASE_AFTERTOUCH_TIME: 0.2,
    CENTER_CIRCLE_RADIUS: 60,
    GOAL_POST_RADIUS: 6,
    get CENTER_LINE_X() { return this.FIELD_WIDTH / 2; },
    KICKOFF_TIMEOUT: 10.0,       // Default (settings.kickoffTimeout override eder)
    KICKOFF_WARNING_TIME: 3.0,
    AUTO_PASS_SPEED: 4.5,
    PLAYER_FRICTION: 0.90,
    BALL_FRICTION: 0.985,
    COLLISION_FORCE: 0.3,
    BALL_STICK_FACTOR: 0.85,
    FPS: 60,
    FRAME_TIME: 1.0 / 60,
    SPEED_PRESETS: {
        "yavas":  { player_speed: 2.0, player_accel: 0.4,  kick_power: 10,  plase_spin: 0.18 },
        "normal": { player_speed: 2.8, player_accel: 0.55, kick_power: 12, plase_spin: 0.25 },
        "hizli":  { player_speed: 3.5, player_accel: 0.8,  kick_power: 15, plase_spin: 0.35 }
    },
    SPRINT_MULTIPLIER: 1.5,
    SPRINT_MAX_ENERGY: 100.0,
    SPRINT_DRAIN_PER_SEC: 33.3,
    SPRINT_REFILL_PER_SEC: 16.7,
    SPRINT_KICK_MULTIPLIER: 1.3,
    WALL_BOUNCE: 0.55,
    MIN_BOUNCE_SPEED: 3.0,
    PLAYER_OUT_MARGIN: 55,
    
    // === HOST FİZİK STATE ===
    room: null,           // {players, ball, scores, ...}
    settings: null,       // {goalTarget, matchDuration, gameSpeed, allowPlase, advanced, ...}
    running: false,
    frameTimer: null,
    onStateUpdate: null,  // Callback: (state) => { network'e gönder }
    onGoal: null,         // Callback: (goalData) => { network'e gönder }
    onGameOver: null,     // Callback: (winData) => {}
    
    // ==========================================
    // BAŞLAT / DURDUR
    // ==========================================
    
    startGame(settings, playerList) {
        console.log("[HOST-PHYSICS] Oyun başlatılıyor", settings);
        this.settings = settings;
        // ✨ Odaya göre saha boyutlarını uygula
        if (settings.fieldWidth) this.FIELD_WIDTH = settings.fieldWidth;
        if (settings.fieldHeight) this.FIELD_HEIGHT = settings.fieldHeight;
        if (settings.goalWidth) this.GOAL_WIDTH = settings.goalWidth;
        console.log(`[HOST-PHYSICS] Saha: ${this.FIELD_WIDTH}x${this.FIELD_HEIGHT}, Kale: ${this.GOAL_WIDTH}`);
        this.initGameState(playerList);
        this.running = true;
        
        // ✨ Web Worker ile tick (arka planda da çalışır)
        try {
            this.worker = new Worker("/oyun_modlari/mini_futbol/mini_futbol_ticker.js");
            this.worker.onmessage = () => {
                if (this.running) this.tick();
            };
            this.worker.postMessage("start");
            console.log("[HOST-PHYSICS] Web Worker ticker başlatıldı ✓");
        } catch(e) {
            console.warn("[HOST-PHYSICS] Web Worker başarısız, setInterval'a düşülüyor:", e);
            // Fallback: normal setInterval
            this.frameTimer = setInterval(() => this.tick(), 1000 / 60);
        }
    },
    
    stopGame() {
        console.log("[HOST-PHYSICS] Oyun durduruluyor");
        this.running = false;
        if (this.frameTimer) {
            clearInterval(this.frameTimer);
            this.frameTimer = null;
        }
        // Web Worker kapat
        if (this.worker) {
            try {
                this.worker.postMessage("stop");
                this.worker.terminate();
            } catch(e) {}
            this.worker = null;
        }
        this.room = null;
    },
    
    pauseGame() {
        if (this.room && this.room.gameState) {
            this.room.gameState.state_before_pause = this.room.gameState.state;
            this.room.gameState.state = "paused";
            this.room.gameState.pause_time = performance.now() / 1000;
            // Tuşları sıfırla
            for (const pid in this.room.gameState.players) {
                const p = this.room.gameState.players[pid];
                for (const k in p.keys) p.keys[k] = false;
                p.vx = 0;
                p.vy = 0;
            }
        }
    },
    
    resumeGame() {
        if (this.room && this.room.gameState) {
            const now = performance.now() / 1000;
            const gs = this.room.gameState;
            const wasGoalWait = (gs.state_before_pause === "goal_wait" || gs.state === "goal_wait");
            
            // ✨ BUG FIX: Eski pending flag'ları temizle (double resume'da sorun olmasın)
            delete gs._pendingKickoffReset;
            delete gs._pendingCountdownStart;
            delete gs._silentGoalWait;
            
            // ✨ Pause anında goal_wait state ise → GOOOL yazısı 2 sn daha kalsın
            if (wasGoalWait) {
                // Kickoff hazırlığı yap
                const ovr_restricted = gs.kickoff_restricted_team_override;
                const ovr_receiving = gs.kickoff_receiving_team_override;
                
                if (ovr_restricted !== null && ovr_restricted !== undefined) {
                    gs.kickoff_restricted_team = ovr_restricted;
                    gs.kickoff_receiving_team = ovr_receiving;
                } else {
                    const scorer = gs.last_goal_scorer;
                    if (scorer) {
                        gs.kickoff_restricted_team = scorer;
                        gs.kickoff_receiving_team = scorer === 2 ? 1 : 2;
                    }
                }
                gs.kickoff_restricted_team_override = null;
                gs.kickoff_receiving_team_override = null;
                
                // ✨ 2 saniye GOOOL yazısı görünmeye devam etsin
                const extraDelay = 2.0;
                gs.state = "goal_wait";  // ✨ State goal_wait KALSIN (GOOOL yazısı görünür)
                gs.goal_wait_until = now + extraDelay;
                gs.pause_time = now;
                gs._silentGoalWait = true;  // ✨ Frontend'e "gol sesi çalma" sinyali
                
                // ✨ 2 sn sonra santraya ışınlan + 3-2-1 başlat
                gs._pendingKickoffReset = now + extraDelay;
                gs._pendingCountdownStart = now + extraDelay;
                
                // Santra kuralı hazırlığı
                const kickoffTimeout = (this.settings && this.settings.kickoffTimeout) || 10;
                const isUnlimited = kickoffTimeout >= 999;
                const redPid = this.room.active_red_player;
                const bluePid = this.room.active_blue_player;
                const soloMode = !redPid || !bluePid;
                
                if (gs.kickoff_restricted_team !== null && !soloMode && !isUnlimited) {
                    gs.kickoff_active = true;
                } else {
                    gs.kickoff_active = false;
                }
                return;  // Countdown'a şimdi geçme, fizik loop 2 sn sonra başlatacak
            }
            
            // Normal resume (gol yok, sadece pause) → hemen 3-2-1
            // ✨ Kalan süreyi kaydet (countdown bitince buradan devam edecek)
            gs._savedTimeLeft = gs.time_left;
            
            gs.state = "countdown";
            gs.countdown_start = now;
            gs.countdown_end = now + 3.5;
            delete gs.pause_time;
            gs._silentWhistle = true;  // ✨ Pause resume → düdük çalma
        }
    },
    
    restartMatch() {
        if (!this.room || !this.room.gameState) return;
        const gs = this.room.gameState;
        gs.scores = { 1: 0, 2: 0 };
        // Stats sıfırla
        for (const pid in this.room.players) {
            this.room.players[pid].goals = 0;
            this.room.players[pid].assists = 0;
            this.room.players[pid].passes = 0;
            this.room.players[pid].saves = 0;  // ✨
        }
        gs.kickoff_active = false;
        gs.kickoff_restricted_team = null;
        gs.kickoff_receiving_team = null;
        gs.kickoff_restricted_team_override = null;
        gs.kickoff_receiving_team_override = null;
        gs.last_ball_toucher = null;
        gs.second_last_toucher = null;
        gs.last_goal_scorer = null;
        gs.last_goal_own = false;
        gs.last_goal_assist = null;
        // ✨ BUG FIX: Restart'ta tüm pending flag'ları temizle
        delete gs._pendingKickoffReset;
        delete gs._pendingCountdownStart;
        delete gs._silentGoalWait;
        delete gs._skipGoalDetection;
        this.resetPositions();
        const now = performance.now() / 1000;
        gs.time_left = this.settings.matchDuration;
        gs.match_start = now + 3.5;
        gs.state = "countdown";
        gs.countdown_start = now;
        gs.countdown_end = now + 3.5;
        gs.pause_time = now;
        gs._silentWhistle = false;  // ✨ Restart → düdük çalsın
        for (const pid in gs.players) {
            const p = gs.players[pid];
            for (const k in p.keys) p.keys[k] = false;
            p.vx = 0;
            p.vy = 0;
            p.sprint_energy = this.SPRINT_MAX_ENERGY;
        }
    },
    
    // ==========================================
    // OYUNCU YÖNETİMİ (dışarıdan çağrılır)
    // ==========================================
    
    setKey(playerId, key, pressed) {
        if (!this.room || !this.room.gameState) return;
        const p = this.room.gameState.players[playerId];
        if (p && p.keys.hasOwnProperty(key)) {
            p.keys[key] = pressed;
        }
    },
    
    updatePlayerList(playerList) {
        // Takım değişikliği vs. için (pause sırasında)
        // playerList: [{id, name, team, is_split_slave}]
        for (const pl of playerList) {
            if (!this.room.players[pl.id]) {
                this.room.players[pl.id] = {
                    name: pl.name,
                    team: pl.team,
                    goals: 0, assists: 0, passes: 0
                };
            } else {
                this.room.players[pl.id].name = pl.name;
                this.room.players[pl.id].team = pl.team;
            }
            
            // ✨ FIX: gameState.players içindeki team'i de güncelle (render doğru renk çizsin)
            if (this.room.gameState && this.room.gameState.players[pl.id]) {
                this.room.gameState.players[pl.id].team = pl.team;
            }
        }
        // Silinmişler
        const activeIds = new Set(playerList.map(p => p.id));
        for (const pid in this.room.players) {
            if (!activeIds.has(parseInt(pid))) {
                delete this.room.players[pid];
            }
        }
    },
    
    // ==========================================
    // INIT
    // ==========================================
    
    initGameState(playerList) {
        const now = performance.now() / 1000;
        
        // Room struct
        this.room = {
            players: {},
            gameState: null
        };
        
        for (const pl of playerList) {
            this.room.players[pl.id] = {
                name: pl.name,
                team: pl.team,
                goals: 0, assists: 0, passes: 0, saves: 0  // ✨
            };
        }
        
        // ✨ TÜM kırmızı ve mavi oyuncuları al
        const redPlayers = playerList.filter(p => p.team === "red").sort((a,b) => a.id - b.id);
        const bluePlayers = playerList.filter(p => p.team === "blue").sort((a,b) => a.id - b.id);
        
        this.room.active_red_player = redPlayers.length ? redPlayers[0].id : null;
        this.room.active_blue_player = bluePlayers.length ? bluePlayers[0].id : null;
        this.room.active_red_players = redPlayers.map(p => p.id);
        this.room.active_blue_players = bluePlayers.map(p => p.id);
        
        // Y ekseninde dağılım helper
        const _calcYs = (count, height) => {
            if (count === 1) return [height / 2];
            const top = height * 0.15;
            const bottom = height * 0.85;
            const step = (bottom - top) / (count - 1);
            const ys = [];
            for (let i = 0; i < count; i++) ys.push(top + i * step);
            return ys;
        };
        
        const _spawnOffset = this.FIELD_WIDTH * 0.2;
        const _redYs = _calcYs(redPlayers.length, this.FIELD_HEIGHT);
        const _blueYs = _calcYs(bluePlayers.length, this.FIELD_HEIGHT);
        
        const gsPlayers = {};
        // Tüm kırmızı oyuncular
        redPlayers.forEach((pl, i) => {
            gsPlayers[pl.id] = {
                x: _spawnOffset,
                y: _redYs[i],
                vx: 0, vy: 0,
                keys: { up: false, down: false, left: false, right: false, kick: false, sprint: false },
                last_kick_time: 0,
                sprint_energy: this.SPRINT_MAX_ENERGY,
                last_frame_time: 0,
                team: "red"
            };
        });
        // Tüm mavi oyuncular
        bluePlayers.forEach((pl, i) => {
            gsPlayers[pl.id] = {
                x: this.FIELD_WIDTH - _spawnOffset,
                y: _blueYs[i],
                vx: 0, vy: 0,
                keys: { up: false, down: false, left: false, right: false, kick: false, sprint: false },
                last_kick_time: 0,
                sprint_energy: this.SPRINT_MAX_ENERGY,
                last_frame_time: 0,
                team: "blue"
            };
        });
        
        console.log(`[HP] Sahada: ${redPlayers.length} kırmızı, ${bluePlayers.length} mavi oyuncu`);
        
        this.room.gameState = {
            players: gsPlayers,
            ball: { x: this.FIELD_WIDTH / 2, y: this.FIELD_HEIGHT / 2, vx: 0, vy: 0, spin: 0 },
            scores: { 1: 0, 2: 0 },
            time_left: this.settings.matchDuration,
            match_start: now + 3.5,  // 3-2-1 sonrası başlar, süre buradan işler
            goal_wait_until: 0,
            last_goal_scorer: null,
            countdown_end: now + 3.5,
            countdown_start: now,
            state: "countdown",
            kickoff_active: false,
            kickoff_receiving_team: null,
            kickoff_restricted_team: null,
            kickoff_start_time: 0,
            kickoff_timeout: 0,
            last_ball_toucher: null,
            second_last_toucher: null,
            last_goal_own: false,
            last_goal_assist: null,
            kick_effects: [],
            hit_events: []   // ✨ Duvar/direk çarpma sesleri için
        };
    },
    
    resetPositions() {
        const gs = this.room.gameState;
        const receiving = gs.kickoff_receiving_team;
        const cx = this.FIELD_WIDTH / 2;
        const cy = this.FIELD_HEIGHT / 2;
        const _spawn = this.FIELD_WIDTH * 0.2;
        
        // Y ekseninde dağılım
        const _calcYs = (count, height) => {
            if (count === 1) return [height / 2];
            const top = height * 0.15;
            const bottom = height * 0.85;
            const step = (bottom - top) / (count - 1);
            const ys = [];
            for (let i = 0; i < count; i++) ys.push(top + i * step);
            return ys;
        };
        
        // ✨ TÜM takım oyuncularını topla
        const redPids = Object.keys(gs.players).filter(pid => gs.players[pid].team === "red").sort((a,b) => parseInt(a) - parseInt(b));
        const bluePids = Object.keys(gs.players).filter(pid => gs.players[pid].team === "blue").sort((a,b) => parseInt(a) - parseInt(b));
        
        const redYs = _calcYs(redPids.length, this.FIELD_HEIGHT);
        const blueYs = _calcYs(bluePids.length, this.FIELD_HEIGHT);
        
        // KIRMIZI TAKIM
        redPids.forEach((pid, i) => {
            const p = gs.players[pid];
            if (receiving === 1 && i === 0) {
                p.x = cx - 50;   // İlk kırmızı santra atacak
            } else {
                p.x = _spawn;
            }
            p.y = redYs[i];
            p.vx = 0; p.vy = 0;
            p.sprint_energy = this.SPRINT_MAX_ENERGY;
        });
        
        // MAVİ TAKIM
        bluePids.forEach((pid, i) => {
            const p = gs.players[pid];
            if (receiving === 2 && i === 0) {
                p.x = cx + 50;
            } else {
                p.x = this.FIELD_WIDTH - _spawn;
            }
            p.y = blueYs[i];
            p.vx = 0; p.vy = 0;
            p.sprint_energy = this.SPRINT_MAX_ENERGY;
        });
        
        // Top ortada
        gs.ball.x = cx;
        gs.ball.y = cy;
        gs.ball.vx = 0;
        gs.ball.vy = 0;
    },
    
    startKickoffCountdown() {
        const now = performance.now() / 1000;
        const gs = this.room.gameState;
        gs.state = "countdown";
        gs.countdown_start = now;
        gs.countdown_end = now + 3.5;
        gs.pause_time = now;
        
        const redPid = this.room.active_red_player;
        const bluePid = this.room.active_blue_player;
        const soloMode = !redPid || !bluePid;
        
        // ✨ Santra süresi settings'ten al (999 = sınırsız)
        const kickoffTimeout = (this.settings && this.settings.kickoffTimeout) || 10;
        const isUnlimited = kickoffTimeout >= 999;
        
        if (gs.kickoff_restricted_team !== null && !soloMode && !isUnlimited) {
            gs.kickoff_active = true;
        } else {
            gs.kickoff_active = false;
        }
    },
    
    // ==========================================
    // ANA TICK (60 FPS)
    // ==========================================
    
    tick() {
        if (!this.running || !this.room) return;
        
        const goalEvent = this.updatePhysics();
        const gs = this.room.gameState;
        const now = performance.now() / 1000;
        
        // Süre güncelle
        if (gs.state === "playing") {
            const elapsed = now - gs.match_start;
            if (elapsed < 0) {
                gs.time_left = this.settings.matchDuration;
            } else {
                gs.time_left = Math.max(0, this.settings.matchDuration - elapsed);
            }
        } else if (gs.state === "countdown") {
            if (gs._savedTimeLeft !== undefined) {
                // ✨ Resume sonrası countdown → kaydedilmiş süreyi göster
                gs.time_left = gs._savedTimeLeft;
            } else if (gs.pause_time) {
                // Gol sonrası countdown → mevcut değeri koru
            } else {
                // İlk başlangıç
                gs.time_left = this.settings.matchDuration;
            }
        }
        
        // Kick effects temizle
        gs.kick_effects = (gs.kick_effects || []).filter(k => now - k.time < 0.5);
        // ✨ Hit events temizle (0.3 sn'den eskiler)
        gs.hit_events = (gs.hit_events || []).filter(h => now - h.time < 0.3);
        
        // Countdown value
        let countdownValue = null;
        if (gs.state === "countdown") {
            const remaining = gs.countdown_end - now;
            const timeUntilStart = gs.countdown_start - now;
            
            // ✨ Countdown henüz başlamadı (ek bekleme süresi var) → ekranda gösterme
            if (timeUntilStart > 0) {
                countdownValue = null;  // Boş
            } else if (remaining > 0.5) {
                countdownValue = Math.floor(remaining) + 1;
                if (countdownValue > 3) countdownValue = 3;
            } else {
                countdownValue = 0;
            }
        }
        
        // Goal celebration
        let goalCelebration = null;
        if (gs.state === "goal_wait") {
            goalCelebration = {
                scorer_id: gs.last_goal_scorer,
                scorer_pid: gs.last_goal_scorer_pid,  // ✨ Gerçek oyuncu ID
                own_goal: gs.last_goal_own || false,
                assist_id: gs.last_goal_assist,
                wait_remaining: Math.max(0, gs.goal_wait_until - now),
                silent: gs._silentGoalWait === true  // ✨ Ses çalınmasın
            };
        }
        
        // Kickoff info
        let kickoffInfo = null;
        let ballWarning = false;
        let ballWarningTeam = null;
        if (gs.kickoff_active && gs.state === "playing") {
            const remaining = gs.kickoff_timeout - now;
            if (remaining > 0) {
                kickoffInfo = {
                    active: true,
                    restricted_team: gs.kickoff_restricted_team,
                    receiving_team: gs.kickoff_receiving_team,
                    time_remaining: Math.round(remaining * 10) / 10
                };
                if (remaining <= this.KICKOFF_WARNING_TIME) {
                    ballWarning = true;
                    ballWarningTeam = gs.kickoff_restricted_team;
                }
            }
        }
        
        // Sprint info
        const sprintInfo = {};
        for (const pid in gs.players) {
            const p = gs.players[pid];
            // ✨ typeof kontrolü (0 || 100 = 100 JS bugu)
            const energy = (typeof p.sprint_energy === "number") ? p.sprint_energy : this.SPRINT_MAX_ENERGY;
            const isActive = p.keys.sprint && energy > 0;
            sprintInfo[String(pid)] = {
                energy: Math.round(energy * 10) / 10,
                max_energy: this.SPRINT_MAX_ENERGY,
                active: isActive
            };
        }
        
        // Stats
        const statsInfo = {};
        for (const pid in this.room.players) {
            const p = this.room.players[pid];
            statsInfo[String(pid)] = {
                goals: p.goals || 0,
                assists: p.assists || 0,
                passes: p.passes || 0,
                saves: p.saves || 0  // ✨
            };
        }
        
        // Ball speed / on fire
        const ballSpeed = Math.sqrt(gs.ball.vx * gs.ball.vx + gs.ball.vy * gs.ball.vy);
        const ballOnFire = ballSpeed > this.STRONG_KICK_THRESHOLD;
        
        // State message
        const stateMsg = {
            type: "mini_state",
            sprint: sprintInfo,
            stats: statsInfo,
            silent_whistle: gs._silentWhistle === true,  // ✨ Düdük sessiz mi?
            players: {},
            ball: {
                x: Math.round(gs.ball.x * 10) / 10,
                y: Math.round(gs.ball.y * 10) / 10,
                on_fire: ballOnFire,
                warning: ballWarning,
                warning_team: ballWarningTeam,
                last_toucher: gs.last_ball_toucher
            },
            scores: { "1": gs.scores[1], "2": gs.scores[2] },
            time_left: Math.round(gs.time_left * 10) / 10,
            kick_effects: gs.kick_effects,
            hit_events: gs.hit_events || [],  // ✨
            game_state: gs.state,
            countdown: countdownValue,
            goal_celebration: goalCelebration,
            kickoff: kickoffInfo
        };
        for (const pid in gs.players) {
            stateMsg.players[String(pid)] = {
                x: Math.round(gs.players[pid].x * 10) / 10,
                y: Math.round(gs.players[pid].y * 10) / 10
            };
        }
        
        if (goalEvent) stateMsg.goal = goalEvent;
        
        // Callback ile dışarıya bildir (network gönderimi)
        if (this.onStateUpdate) this.onStateUpdate(stateMsg);
        
        // Kazanma kontrolü
        const goalTarget = this.settings.goalTarget || 3;
        let winnerId = null;
        if (gs.scores[1] >= goalTarget) winnerId = 1;
        else if (gs.scores[2] >= goalTarget) winnerId = 2;
        else if (gs.time_left <= 0) {
            if (gs.scores[1] > gs.scores[2]) winnerId = 1;
            else if (gs.scores[2] > gs.scores[1]) winnerId = 2;
            else winnerId = 0;
        }
        
        if (winnerId !== null) {
            this.stopGame();
            if (this.onGameOver) {
                this.onGameOver({
                    type: "mini_game_over",
                    winner_id: winnerId,
                    scores: { "1": gs.scores[1], "2": gs.scores[2] },
                    reason: (winnerId > 0 && (gs.scores[1] >= goalTarget || gs.scores[2] >= goalTarget)) ? "goal_target" : "time_up"
                });
            }
        }
    },
    
    // ==========================================
    // FİZİK GÜNCELLEMESİ (backend'in tam kopyası)
    // ==========================================
    
    updatePhysics() {
        const gs = this.room.gameState;
        const now = performance.now() / 1000;
        
        // Speed preset
        const preset = this.SPEED_PRESETS[this.settings.gameSpeed] || this.SPEED_PRESETS.normal;
        let PLAYER_SPEED = preset.player_speed;
        let PLAYER_ACCEL = preset.player_accel;
        let KICK_POWER = preset.kick_power;
        
        // Advanced settings
        const adv = this.settings.advancedEnabled ? this.settings.advanced : null;
        let ADV_SPRINT_KICK_BONUS = this.SPRINT_KICK_MULTIPLIER;
        let ADV_PLASE_POWER_MULT = this.PLASE_POWER_MULT;
        // ✨ Plase spin preset'ten al (hıza göre otomatik ayarlansın)
        let ADV_PLASE_SPIN_FORCE = preset.plase_spin || this.PLASE_SPIN_FORCE;
        let ADV_AFTERTOUCH_TIME = this.PLASE_AFTERTOUCH_TIME;
        let ADV_BALL_MAX_SPEED = this.BALL_MAX_SPEED;
        let ADV_SPRINT_MULT = this.SPRINT_MULTIPLIER;
        let ADV_SPRINT_DRAIN = this.SPRINT_DRAIN_PER_SEC;
        
        if (adv) {
            KICK_POWER = adv.kickPower || KICK_POWER;
            ADV_SPRINT_KICK_BONUS = 1.0 + ((adv.sprintKickBonus || 30) / 100.0);
            ADV_PLASE_POWER_MULT = (adv.plasePower || 75) / 100.0;
            ADV_PLASE_SPIN_FORCE = (adv.plaseSpin || 35) / 100.0;
            ADV_AFTERTOUCH_TIME = (adv.afterTouchTime || 200) / 1000.0;
            ADV_BALL_MAX_SPEED = adv.ballMaxSpeed || 18;
            ADV_SPRINT_MULT = (adv.sprintMultiplier || 150) / 100.0;
            const sd = adv.sprintDuration || 3;
            ADV_SPRINT_DRAIN = 100.0 / sd;
        }
        
        // Pause / quick_paused
        if (gs.state === "paused" || gs.state === "quick_paused") return null;
        
        // ✨ Gol sonrası bekleme - santra pozisyonlarını gecikmeli sıfırla
        if (gs._pendingKickoffReset && now >= gs._pendingKickoffReset) {
            this.resetPositions();
            delete gs._pendingKickoffReset;
            console.log("[HP] Santra pozisyonları sıfırlandı (gol sonrası bekleme)");
        }
        
        // ✨ 2 sn bekleme bitti → GOOOL yazısı kaybol + countdown (3-2-1) başlat
        if (gs._pendingCountdownStart && now >= gs._pendingCountdownStart) {
            gs.state = "countdown";
            gs.countdown_start = now;
            gs.countdown_end = now + 3.5;
            gs.pause_time = now;
            delete gs._pendingCountdownStart;
            console.log("[HP] Countdown başladı (gol sonrası)");
        }
        
        // ✨ Ek bekleme aktifse (gol sonrası, santra öncesi) gol algılamayı devre dışı bırak
        const inGoalWaitDelay = gs._pendingKickoffReset && now < gs._pendingKickoffReset;
        gs._skipGoalDetection = inGoalWaitDelay;
        
        // Countdown
        if (gs.state === "countdown") {
            const timeUntilStart = gs.countdown_start - now;
            
            if (now >= gs.countdown_end) {
                // Countdown bitti → oyun başlasın
                gs.state = "playing";
                
                if (gs._savedTimeLeft !== undefined) {
                    // ✨ Pause resume sonrası → kaydedilmiş süreden devam et
                    gs.match_start = now - (this.settings.matchDuration - gs._savedTimeLeft);
                    delete gs._savedTimeLeft;
                    delete gs.pause_time;
                } else if (gs.pause_time) {
                    // ✨ Gol sonrası santra countdown
                    const pauseDuration = now - gs.pause_time;
                    gs.match_start += pauseDuration;
                    delete gs.pause_time;
                } else {
                    // ✨ İlk başlangıç → süreyi tam şimdi başlat
                    gs.match_start = now;
                }
                
                if (gs.kickoff_active) {
                    gs.kickoff_start_time = now;
                    const kt = (this.settings && this.settings.kickoffTimeout) || 10;
                    gs.kickoff_timeout = now + kt;
                }
                gs._silentWhistle = false;  // ✨ Countdown bitti → bayrağı temizle (sonraki gol/santra için)
                return null;
            }
            
            // ✨ Ek bekleme süresindeyse (gol sonrası, ışınlanma öncesi) 
            //    fizik ÇALIŞSIN, oyuncular hareket edebilsin
            if (timeUntilStart > 0) {
                // Bu blok'tan çıkma → aşağıdaki fizik kodu çalışacak
            } else {
                // Normal countdown (3-2-1) → fizik dursun
                return null;
            }
        }
        
        // Goal wait
        if (gs.state === "goal_wait") {
            if (now >= gs.goal_wait_until) {
                const ovr_restricted = gs.kickoff_restricted_team_override;
                const ovr_receiving = gs.kickoff_receiving_team_override;
                if (ovr_restricted !== null && ovr_restricted !== undefined) {
                    gs.kickoff_restricted_team = ovr_restricted;
                    gs.kickoff_receiving_team = ovr_receiving;
                } else {
                    const scorer = gs.last_goal_scorer;
                    if (scorer) {
                        gs.kickoff_restricted_team = scorer;
                        gs.kickoff_receiving_team = scorer === 2 ? 1 : 2;
                    }
                }
                gs.kickoff_restricted_team_override = null;
                gs.kickoff_receiving_team_override = null;
                gs._silentGoalWait = false;  // ✨ Gol wait bitti → bir sonraki gol için sesi hazır et
                this.resetPositions();
                this.startKickoffCountdown();
                return null;
            }
        }
        
        // === OYUNCU HAREKETİ ===
        for (const pid in gs.players) {
            const p = gs.players[pid];
            const keys = p.keys;
            
            // Delta hesap
            let delta = this.FRAME_TIME;
            if (p.last_frame_time > 0) {
                delta = now - p.last_frame_time;
                if (delta > 0.1) delta = this.FRAME_TIME;
            }
            p.last_frame_time = now;
            
            // Sprint
            let isSprinting = false;
            let currentEnergy = (typeof p.sprint_energy === "number") ? p.sprint_energy : this.SPRINT_MAX_ENERGY;
            
            // ✨ Sprint etkin mi? (kapalıysa hiç sprint yok)
            const sprintEnabled = this.settings.sprintEnabled !== false;
            
            if (sprintEnabled && keys.sprint && currentEnergy > 0) {
                // Shift basılı VE enerji var → tüket
                isSprinting = true;
                currentEnergy -= ADV_SPRINT_DRAIN * delta;
                if (currentEnergy < 0) currentEnergy = 0;
            } else if (!keys.sprint || !sprintEnabled) {
                // Shift BIRAKILDI VEYA sprint kapalı → dolmaya başla
                currentEnergy += this.SPRINT_REFILL_PER_SEC * delta;
                if (currentEnergy > this.SPRINT_MAX_ENERGY) currentEnergy = this.SPRINT_MAX_ENERGY;
            }
            // Shift basılı ama enerji 0 → hiçbir şey yapma (0'da kalsın, normal hızla koşsun)
            p.sprint_energy = currentEnergy;
            
            // İvme (sprint bölgesinde biraz düşer)
            const cs = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            let accel = PLAYER_ACCEL;
            if (isSprinting && cs > PLAYER_SPEED * 0.95) {
                accel = PLAYER_ACCEL * 0.75;
            }
            
            if (keys.up) p.vy -= accel;
            if (keys.down) p.vy += accel;
            if (keys.left) p.vx -= accel;
            if (keys.right) p.vx += accel;
            
            // Max hız
            const maxSpeed = PLAYER_SPEED * (isSprinting ? ADV_SPRINT_MULT : 1.0);
            const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
            if (speed > maxSpeed) {
                p.vx = (p.vx / speed) * maxSpeed;
                p.vy = (p.vy / speed) * maxSpeed;
            }
            
            // Sürtünme
            p.vx *= this.PLAYER_FRICTION;
            p.vy *= this.PLAYER_FRICTION;
            if (Math.abs(p.vx) < 0.1) p.vx = 0;
            if (Math.abs(p.vy) < 0.1) p.vy = 0;
            
            // Pozisyon
            p.x += p.vx;
            p.y += p.vy;
            
            // Duvar
            const M = this.PLAYER_OUT_MARGIN;
            const R = this.PLAYER_RADIUS;
            if (p.x - R < -M) { p.x = -M + R; p.vx = 0; }
            if (p.x + R > this.FIELD_WIDTH + M) { p.x = this.FIELD_WIDTH + M - R; p.vx = 0; }
            if (p.y - R < -M) { p.y = -M + R; p.vy = 0; }
            if (p.y + R > this.FIELD_HEIGHT + M) { p.y = this.FIELD_HEIGHT + M - R; p.vy = 0; }
            
            // Santra kuralı (team bazlı - çoklu oyuncu destekli)
            if (gs.kickoff_active) {
                const restricted = gs.kickoff_restricted_team;
                const receiving = gs.kickoff_receiving_team;
                const pTeamId = p.team === "red" ? 1 : (p.team === "blue" ? 2 : null);
                
                if (pTeamId === restricted) {
                    // Gol atan takımdan HERKES çembere giremez
                    if (p.team === "red") {
                        const bx = this.CENTER_LINE_X - this.CENTER_CIRCLE_RADIUS;
                        if (p.x + R > bx) { p.x = bx - R; if (p.vx > 0) p.vx = 0; }
                    } else if (p.team === "blue") {
                        const bx = this.CENTER_LINE_X + this.CENTER_CIRCLE_RADIUS;
                        if (p.x - R < bx) { p.x = bx + R; if (p.vx < 0) p.vx = 0; }
                    }
                } else if (pTeamId === receiving) {
                    // Gol yiyen takımdan HERKES karşı çembere kadar gidebilir
                    if (p.team === "red") {
                        const bx = this.CENTER_LINE_X + this.CENTER_CIRCLE_RADIUS;
                        if (p.x + R > bx) { p.x = bx - R; if (p.vx > 0) p.vx = 0; }
                    } else if (p.team === "blue") {
                        const bx = this.CENTER_LINE_X - this.CENTER_CIRCLE_RADIUS;
                        if (p.x - R < bx) { p.x = bx + R; if (p.vx < 0) p.vx = 0; }
                    }
                }
            }
        }
        
        // === TOP HAREKETİ (CCD substep) ===
        const ball = gs.ball;
        const ballSpeedNow = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        const maxStep = 3;  // ✨ Sabit 3 px adım (tunneling engeli)
        let substeps = 1;
        if (ballSpeedNow > maxStep) {
            substeps = Math.floor(ballSpeedNow / maxStep) + 1;
            if (substeps > 20) substeps = 20;  // ✨ 8 → 20 (hızlı toplar için)
        }
        let stepVx = ball.vx / substeps;
        let stepVy = ball.vy / substeps;
        
        // ✨ Gol kontrolü flag (tunneling engeli için substep içinde algılansın)
        let substepGoal = null;
        
        for (let si = 0; si < substeps; si++) {
            ball.x += stepVx;
            ball.y += stepVy;
            
            // ✨ ANLIK GOL KONTROLÜ (substep içinde - top merkezi çizgiyi geçti mi?)
            const inGoalY = ball.y > this.GOAL_Y_TOP && ball.y < this.GOAL_Y_BOTTOM;
            // ✨ Sadece içeri DOĞRU giderken gol
            const inLeftGoal = ball.x <= 0 && inGoalY && ball.vx < 0;
            const inRightGoal = ball.x >= this.FIELD_WIDTH && inGoalY && ball.vx > 0;
            
            // ✨ Ek bekleme sırasında gol algılama YOK
            if ((inLeftGoal || inRightGoal) && gs.state !== "goal_wait" && !substepGoal && !gs._skipGoalDetection) {
                // Gol! Bilgiyi kaydet, substep bitince işlenecek
                substepGoal = inLeftGoal ? "left" : "right";
                break;  // Bu substep'te dur
            }
            
            // ✨ Substep içinde file kontrolü (tunneling engeli)
            const _GOAL_CURVE = 60;
            const _NET_R = 12 + 3;   // ✨ İnce file (top file'de kalsın ama girmeye izin ver)
            const _samples = 60;
            let netHit = false;
            for (let i = 0; i <= _samples; i++) {
                const t = i / _samples;
                const ny_ = (1-t)*(1-t)*this.GOAL_Y_TOP + 2*(1-t)*t*((this.GOAL_Y_TOP + this.GOAL_Y_BOTTOM)/2) + t*t*this.GOAL_Y_BOTTOM;
                const xOff = _GOAL_CURVE * 2 * (1-t) * t;
                
                // ✨ Sadece kavisin EN derinliği (top içeri girsin, arkada durdursun)
                if (xOff <= 40) continue;
                
                // Sol file
                let dxN = ball.x - (-xOff);
                let dyN = ball.y - ny_;
                let dN = Math.sqrt(dxN*dxN + dyN*dyN);
                if (dN < _NET_R && dN > 0) {
                    const nxN = dxN / dN;
                    const nyN = dyN / dN;
                    ball.x += nxN * (_NET_R - dN);
                    ball.y += nyN * (_NET_R - dN);
                    // ✨ Hızı sıfırla (top file'de takılı kalsın)
                    stepVx = 0;
                    stepVy = 0;
                    netHit = true;
                    break;
                }
                // Sağ file
                dxN = ball.x - (this.FIELD_WIDTH + xOff);
                dyN = ball.y - ny_;
                dN = Math.sqrt(dxN*dxN + dyN*dyN);
                if (dN < _NET_R && dN > 0) {
                    const nxN = dxN / dN;
                    const nyN = dyN / dN;
                    ball.x += nxN * (_NET_R - dN);
                    ball.y += nyN * (_NET_R - dN);
                    // ✨ Hızı sıfırla
                    stepVx = 0;
                    stepVy = 0;
                    netHit = true;
                    break;
                }
            }
            if (netHit) {
                // ✨ File çarpması → top TAMAMEN dursun
                ball.vx = 0;
                ball.vy = 0;
                ball.spin = 0;
                break;  // Substep loop'undan çık
            }
            
            let hit = false;
            for (const pid in gs.players) {
                const p = gs.players[pid];
                const dx = ball.x - p.x;
                const dy = ball.y - p.y;
                let dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = this.PLAYER_RADIUS + this.BALL_RADIUS;
                if (dist < minDist) {
                    let nx, ny;
                    if (dist < 0.1) {
                        const sp = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                        if (sp > 0.1) { nx = -ball.vx / sp; ny = -ball.vy / sp; }
                        else { nx = 1; ny = 0; }
                        dist = 0.1;
                    } else {
                        nx = dx / dist;
                        ny = dy / dist;
                    }
                    ball.x = p.x + nx * minDist;
                    ball.y = p.y + ny * minDist;
                    stepVx = 0;
                    stepVy = 0;
                    hit = true;
                    break;
                }
            }
            if (hit) break;
        }
        
        // ✨ SUBSTEP'te GOL algılandıysa ANINDA işle (tunneling engeli)
        if (substepGoal) {
            const isLeft = substepGoal === "left";
            if (isLeft) gs.scores[2] += 1;
            else gs.scores[1] += 1;
            
            const last = gs.last_ball_toucher;
            const second = gs.second_last_toucher;
            let own = false, assist = null;
            
            if (isLeft) {
                // ✨ Sol kaleye gol → topa son değen kırmızı takımdaysa OWN GOAL
                const lastTeam = (last && this.room.players[last]) ? this.room.players[last].team : null;
                if (lastTeam === "red") {
                    own = true;
                    gs.last_goal_scorer = 1;
                    gs.last_goal_scorer_pid = last;  // ✨ Gerçek oyuncu ID
                    gs.kickoff_restricted_team_override = 2;
                    gs.kickoff_receiving_team_override = 1;
                } else {
                    gs.last_goal_scorer = 2;
                    gs.last_goal_scorer_pid = last;  // ✨ Gerçek oyuncu ID
                    gs.kickoff_restricted_team_override = null;
                    gs.kickoff_receiving_team_override = null;
                    if (last && this.room.players[last]) {
                        this.room.players[last].goals = (this.room.players[last].goals || 0) + 1;
                    }
                    if (second && second !== last && this.room.players[second]) {
                        const st = this.room.players[last].team;
                        const at = this.room.players[second].team;
                        if (st === at && ["red", "blue"].includes(st)) {
                            assist = second;
                            this.room.players[second].assists = (this.room.players[second].assists || 0) + 1;
                        }
                    }
                }
            } else {
                // ✨ Sağ kaleye gol → topa son değen mavi takımdaysa OWN GOAL
                const lastTeam = (last && this.room.players[last]) ? this.room.players[last].team : null;
                if (lastTeam === "blue") {
                    own = true;
                    gs.last_goal_scorer = 2;
                    gs.kickoff_restricted_team_override = 1;
                    gs.kickoff_receiving_team_override = 2;
                } else {
                    gs.last_goal_scorer = 1;
                    gs.kickoff_restricted_team_override = null;
                    gs.kickoff_receiving_team_override = null;
                    if (last && this.room.players[last]) {
                        this.room.players[last].goals = (this.room.players[last].goals || 0) + 1;
                    }
                    if (second && second !== last && this.room.players[second]) {
                        const st = this.room.players[last].team;
                        const at = this.room.players[second].team;
                        if (st === at && ["red", "blue"].includes(st)) {
                            assist = second;
                            this.room.players[second].assists = (this.room.players[second].assists || 0) + 1;
                        }
                    }
                }
            }
            
            gs.last_goal_own = own;
            gs.last_goal_assist = assist;
            gs._silentGoalWait = false;  // ✨ Gerçek gol → ses çalsın
            gs.state = "goal_wait";
            gs.goal_wait_until = now + 4.0;
            gs.pause_time = now;
            // ✨ SAVE bayrağını temizle (gol oldu, kimse kurtaramadı)
            ball._shotTargetGoal = null;
            ball._shotBy = null;
            ball._shotByTeam = null;
            return { scorer: gs.last_goal_scorer, own_goal: own, assist: assist, scores: { ...gs.scores } };
        }
        
        ball.vx *= this.BALL_FRICTION;
        ball.vy *= this.BALL_FRICTION;
        
        // After-touch
        if (ball.last_kick_type === "plase") {
            const kickerId = ball.kicker_id;
            const kickTime = ball.kick_time || 0;
            if (now - kickTime < ADV_AFTERTOUCH_TIME && gs.players[kickerId]) {
                const kicker = gs.players[kickerId];
                const bs = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (bs > 1.0) {
                    const nx = ball.vx / bs;
                    const ny = ball.vy / bs;
                    const perp_x = -ny;
                    const perp_y = nx;
                    let in_x = 0, in_y = 0;
                    if (kicker.keys.right) in_x += 1;
                    if (kicker.keys.left) in_x -= 1;
                    if (kicker.keys.down) in_y += 1;
                    if (kicker.keys.up) in_y -= 1;
                    const cross = in_x * perp_x + in_y * perp_y;
                    if (Math.abs(cross) > 0.1) {
                        const spin_dir = cross > 0 ? 1 : -1;
                        const sb = (kicker.keys.sprint && kicker.sprint_energy > 0) ? 1.4 : 1.0;
                        ball.spin = ADV_PLASE_SPIN_FORCE * spin_dir * sb;
                    }
                }
            } else {
                ball.last_kick_type = null;
            }
        }
        
        // Spin
        const spin = ball.spin || 0;
        if (Math.abs(spin) > 0.001) {
            const bs = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (bs > 0.5) {
                const perp_x = -ball.vy / bs;
                const perp_y = ball.vx / bs;
                ball.vx += perp_x * spin;
                ball.vy += perp_y * spin;
            }
            ball.spin = spin * this.PLASE_SPIN_DECAY;
            if (Math.abs(ball.spin) < 0.005) ball.spin = 0;
        }
        if (Math.abs(ball.vx) < 0.05) ball.vx = 0;
        if (Math.abs(ball.vy) < 0.05) ball.vy = 0;
        
        // Oyuncu-oyuncu çarpışma (iteleme yok)
        const playerList = Object.entries(gs.players);
        for (let i = 0; i < playerList.length; i++) {
            for (let j = i + 1; j < playerList.length; j++) {
                const [pid1, p1] = playerList[i];
                const [pid2, p2] = playerList[j];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = this.PLAYER_RADIUS * 2;
                if (dist < minDist && dist > 0) {
                    const overlap = minDist - dist;
                    const nx = dx / dist;
                    const ny = dy / dist;
                    p1.x -= nx * overlap / 2;
                    p1.y -= ny * overlap / 2;
                    p2.x += nx * overlap / 2;
                    p2.y += ny * overlap / 2;
                    const v1_toward = p1.vx * nx + p1.vy * ny;
                    if (v1_toward > 0) {
                        p1.vx -= v1_toward * nx;
                        p1.vy -= v1_toward * ny;
                    }
                    const v2_toward = p2.vx * (-nx) + p2.vy * (-ny);
                    if (v2_toward > 0) {
                        p2.vx -= v2_toward * (-nx);
                        p2.vy -= v2_toward * (-ny);
                    }
                }
            }
        }
        
        // === ŞUT KONTROLÜ ===
        for (const pid in gs.players) {
            const p = gs.players[pid];
            if (p.keys.kick && !p.kick_was_pressed) {
                p.kick_was_pressed = true;
                const timeSinceLast = now - (p.last_kick_time || 0);
                if (timeSinceLast >= this.KICK_COOLDOWN) {
                    p.last_kick_time = now;
                    
                    // Efekt - enerji oranı (0'da bugu için typeof check)
                    const currentEnergyRaw = (typeof p.sprint_energy === "number") ? p.sprint_energy : this.SPRINT_MAX_ENERGY;
                    const currentEnergyPercent = currentEnergyRaw / this.SPRINT_MAX_ENERGY;
                    
                    const dx = ball.x - p.x;
                    const dy = ball.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    const minDist = this.PLAYER_RADIUS + this.BALL_RADIUS + 15;
                    
                    // ✨ hit_ball flag: sadece topa değince true olur (ses için)
                    const hitBall = dist < minDist && dist > 0;
                    
                    gs.kick_effects.push({
                        player_id: parseInt(pid),
                        x: p.x, y: p.y, time: now,
                        energy_at_kick: currentEnergyPercent,
                        hit_ball: hitBall  // ✨ Ses tetikleme için
                    });
                    
                    if (dist < minDist && dist > 0) {
                        if (gs.kickoff_active) {
                            // ✨ Team bazlı kontrol (oyuncu ID değil, takım ID)
                            const kickerTeamId = p.team === "red" ? 1 : (p.team === "blue" ? 2 : null);
                            if (kickerTeamId !== gs.kickoff_receiving_team) continue;
                            gs.kickoff_active = false;
                        }
                        
                        const nx = dx / dist;
                        const ny = dy / dist;
                        
                        // ✨ SAVE için: Bu şut hangi kaleye gidiyor?
                        const shooterId = parseInt(pid);
                        const shooterTeam = this.room.players[shooterId] ? this.room.players[shooterId].team : null;
                        
                        // ✨ Basit mantık: Şut atan takım hangi kaleye şut atar?
                        // Kırmızı takım (sol taraf) → sağ kaleye şut atar (mavi kalesi)
                        // Mavi takım (sağ taraf) → sol kaleye şut atar (kırmızı kalesi)
                        let targetGoal = null;
                        if (shooterTeam === "red") {
                            targetGoal = "right";  // Kırmızı → mavi kalesine
                        } else if (shooterTeam === "blue") {
                            targetGoal = "left";   // Mavi → kırmızı kalesine
                        }
                        
                        // Bayrağı topa koy (her şutta - kaleye gitse gitmese)
                        ball._shotBy = shooterId;
                        ball._shotByTeam = shooterTeam;
                        ball._shotTargetGoal = targetGoal;
                        ball._shotTime = now;
                        
                        // Köşe kontrolü
                        const ball_at_left = ball.x < this.BALL_RADIUS + 8;
                        const ball_at_right = ball.x > this.FIELD_WIDTH - this.BALL_RADIUS - 8;
                        const ball_at_top = ball.y < this.BALL_RADIUS + 8;
                        const ball_at_bottom = ball.y > this.FIELD_HEIGHT - this.BALL_RADIUS - 8;
                        const isStuck = ball_at_left || ball_at_right || ball_at_top || ball_at_bottom;
                        
                        if (isStuck) {
                            let kick_nx = nx, kick_ny = ny;
                            if (ball_at_left) kick_nx = Math.abs(kick_nx);
                            else if (ball_at_right) kick_nx = -Math.abs(kick_nx);
                            if (ball_at_top) kick_ny = Math.abs(kick_ny);
                            else if (ball_at_bottom) kick_ny = -Math.abs(kick_ny);
                            const vlen = Math.sqrt(kick_nx * kick_nx + kick_ny * kick_ny);
                            if (vlen > 0) { kick_nx /= vlen; kick_ny /= vlen; }
                            else { kick_nx = 1; kick_ny = 0; }
                            
                            ball.x += kick_nx * 5;
                            ball.y += kick_ny * 5;
                            if (ball.x < this.BALL_RADIUS) ball.x = this.BALL_RADIUS;
                            if (ball.x > this.FIELD_WIDTH - this.BALL_RADIUS) ball.x = this.FIELD_WIDTH - this.BALL_RADIUS;
                            if (ball.y < this.BALL_RADIUS) ball.y = this.BALL_RADIUS;
                            if (ball.y > this.FIELD_HEIGHT - this.BALL_RADIUS) ball.y = this.FIELD_HEIGHT - this.BALL_RADIUS;
                            
                            let corner_mult = 1.0;
                            if (p.keys.sprint && p.sprint_energy > 0) corner_mult = this.SPRINT_KICK_MULTIPLIER;
                            ball.vx = kick_nx * KICK_POWER * corner_mult;
                            ball.vy = kick_ny * KICK_POWER * corner_mult;
                        } else {
                            // Plase algıla
                            const perp_x = -ny, perp_y = nx;
                            let input_x = 0, input_y = 0;
                            if (p.keys.right) input_x += 1;
                            if (p.keys.left) input_x -= 1;
                            if (p.keys.down) input_y += 1;
                            if (p.keys.up) input_y -= 1;
                            const cross = input_x * perp_x + input_y * perp_y;
                            const isPlase = Math.abs(cross) > 0.3;
                            const sprintActive = p.keys.sprint && p.sprint_energy > 0;
                            const plaseAllowed = this.settings.allowPlase !== false || adv;
                            
                            if (isPlase && plaseAllowed) {
                                // ✨ Plase artık normal şut gücünde (yavaşlatma yok, sadece kavis atar)
                                let mult = 1.0;
                                if (sprintActive) mult = ADV_SPRINT_KICK_BONUS;
                                ball.vx = nx * KICK_POWER * mult;
                                ball.vy = ny * KICK_POWER * mult;
                                ball.spin = 0;
                                ball.last_kick_type = "plase";
                                ball.kick_time = now;
                                ball.kicker_id = parseInt(pid);
                                // ✨ Top oyuncudan uzağa it (yapışma tetiklenmesin)
                                ball.x = p.x + nx * (this.PLAYER_RADIUS + this.BALL_RADIUS + 8);
                                ball.y = p.y + ny * (this.PLAYER_RADIUS + this.BALL_RADIUS + 8);
                            } else {
                                let mult = 1.0;
                                if (sprintActive) mult = ADV_SPRINT_KICK_BONUS;
                                ball.vx = nx * KICK_POWER * mult;
                                ball.vy = ny * KICK_POWER * mult;
                                ball.spin = 0;
                                // ✨ Top oyuncudan uzağa it (bir sonraki frame'de yapışma tetiklenmesin)
                                ball.x = p.x + nx * (this.PLAYER_RADIUS + this.BALL_RADIUS + 2);
                                ball.y = p.y + ny * (this.PLAYER_RADIUS + this.BALL_RADIUS + 2);
                            }
                        }
                        
                        if (gs.last_ball_toucher !== parseInt(pid)) {
                            gs.second_last_toucher = gs.last_ball_toucher;
                            gs.last_ball_toucher = parseInt(pid);
                        }
                    }
                }
            }
        }
        for (const pid in gs.players) {
            const p = gs.players[pid];
            if (!p.keys.kick) p.kick_was_pressed = false;
        }
        
        // === TOP-OYUNCU DOKUNMA ===
        for (const pid in gs.players) {
            const p = gs.players[pid];
            
            // ✨ Şut sonrası 0.15 sn boyunca aynı oyuncu topa dokunamasın (yapışma engeli)
            if (p.last_kick_time && (now - p.last_kick_time) < 0.15) continue;
            
            const dx = ball.x - p.x;
            const dy = ball.y - p.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            const minDist = this.PLAYER_RADIUS + this.BALL_RADIUS;
            
            if (dist < minDist) {
                let nx, ny;
                if (dist < 0.1) { nx = 1; ny = 0; dist = 0.1; }
                else { nx = dx / dist; ny = dy / dist; }
                const overlap = minDist - dist;
                
                if (gs.kickoff_active) {
                    // ✨ Sert top geliyorsa kickoff kuralı ATLA (yapışma bug'ı engeli)
                    const bsKickoff = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                    if (bsKickoff > this.HARD_BALL_THRESHOLD) {
                        // Sert top → normal fizik çalışsın (aşağıya geç)
                    } else {
                        // ✨ Team bazlı kontrol (oyuncu ID değil, takım ID)
                        const toucherTeamId = p.team === "red" ? 1 : (p.team === "blue" ? 2 : null);
                        if (toucherTeamId === gs.kickoff_restricted_team) {
                            p.x -= nx * overlap;
                            p.y -= ny * overlap;
                            if (p.vx * nx + p.vy * ny > 0) { p.vx = 0; p.vy = 0; }
                            continue;
                        } else if (toucherTeamId === gs.kickoff_receiving_team) {
                            gs.kickoff_active = false;
                        }
                    }
                }
                
                if (gs.last_ball_toucher !== parseInt(pid)) {
                    const prev = gs.last_ball_toucher;
                    gs.second_last_toucher = prev;
                    gs.last_ball_toucher = parseInt(pid);
                    if (prev && prev !== parseInt(pid) && this.room.players[prev]) {
                        const prevTeam = this.room.players[prev].team;
                        const currTeam = this.room.players[pid].team;
                        if (prevTeam === currTeam && ["red", "blue"].includes(prevTeam)) {
                            this.room.players[prev].passes = (this.room.players[prev].passes || 0) + 1;
                        }
                    }
                    
                    // ✨ SAVE KONTROL: Şut kaleye gidiyordu, karşı takımdan biri dokundu → SAVE
                    if (ball._shotTargetGoal && ball._shotBy && ball._shotBy !== parseInt(pid)) {
                        // ✨ TIMEOUT: Şut atılalı 2 sn'den fazla olduysa save sayma
                        const shotAge = now - (ball._shotTime || 0);
                        const SAVE_TIMEOUT = 2.0;
                        
                        if (shotAge > SAVE_TIMEOUT) {
                            // Şut çok eski → save sayma, sadece bayrakları temizle
                            console.log(`[SAVE TIMEOUT] Şut ${shotAge.toFixed(1)}sn önce atılmıştı, save iptal`);
                            ball._shotTargetGoal = null;
                            ball._shotBy = null;
                            ball._shotByTeam = null;
                        } else {
                            const saverTeam = this.room.players[pid] ? this.room.players[pid].team : null;
                            const shooterTeam = ball._shotByTeam;
                            
                            // Debug
                            console.log(`[SAVE DEBUG] shooter=${ball._shotBy}(${shooterTeam}) saver=${pid}(${saverTeam}) target=${ball._shotTargetGoal} age=${shotAge.toFixed(1)}s`);
                            
                            // ✨ Basit şart: Farklı takım + top kaleye gidiyordu
                            if (saverTeam && shooterTeam && saverTeam !== shooterTeam) {
                                this.room.players[pid].saves = (this.room.players[pid].saves || 0) + 1;
                                console.log(`[SAVE] Oyuncu ${pid} kurtardı! (${this.room.players[pid].saves})`);
                            }
                            
                            // Bayrağı temizle (bir şut = bir save şansı)
                            ball._shotTargetGoal = null;
                            ball._shotBy = null;
                            ball._shotByTeam = null;
                        }
                    }
                }
                
                // ✨ Top kale ağzındaysa (Y ekseninde kale genişliğinin içindeyse) duvar sayma
                const inGoalY = ball.y > this.GOAL_Y_TOP && ball.y < this.GOAL_Y_BOTTOM;
                
                // Duvar kontrolü - sadece Y ekseninde kale dışındaki alan için
                const nearWallX = (ball.x < this.BALL_RADIUS + 5 || ball.x > this.FIELD_WIDTH - this.BALL_RADIUS - 5) && !inGoalY;
                const nearWallY = ball.y < this.BALL_RADIUS + 5 || ball.y > this.FIELD_HEIGHT - this.BALL_RADIUS - 5;
                
                if (nearWallX || nearWallY) {
                    p.x -= nx * overlap;
                    p.y -= ny * overlap;
                    
                    // ✨ Düzeltme: Oyuncu dış alana çıkabiliyorsa, sınır kontrolü de dış alana göre olmalı
                    const R = this.PLAYER_RADIUS;
                    const M = this.PLAYER_OUT_MARGIN;
                    
                    if (p.x - R < -M) p.x = -M + R;
                    if (p.x + R > this.FIELD_WIDTH + M) p.x = this.FIELD_WIDTH + M - R;
                    if (p.y - R < -M) p.y = -M + R;
                    if (p.y + R > this.FIELD_HEIGHT + M) p.y = this.FIELD_HEIGHT + M - R;
                } else {
                    // Top içeri (kaleye) itiliyor
                    ball.x += nx * overlap;
                    ball.y += ny * overlap;
                }
                
                const bs = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                // ✨ Yapışma gücü (0-100 arası veya true/false)
                let stickPower;
                if (typeof this.settings.ballStick === "number") {
                    stickPower = this.settings.ballStick / 100;  // 0-100 → 0.0-1.0
                } else {
                    stickPower = (this.settings.ballStick !== false) ? this.BALL_STICK_FACTOR : 0;
                }
                
                if (bs > this.HARD_BALL_THRESHOLD) {
                    // Hızlı top - her zaman yansır + oyuncuyu iter (kaleci gibi tutmasın)
                    const dot = ball.vx * nx + ball.vy * ny;
                    
                    // ✨ ÖNCE topu oyuncunun dışına zorla it (dot kontrolüne bakma)
                    // Bu her durumda çalışsın - yapışma bug'ının kesin çözümü
                    const safeDistance = this.PLAYER_RADIUS + this.BALL_RADIUS + 5;
                    ball.x = p.x + nx * safeDistance;
                    ball.y = p.y + ny * safeDistance;
                    
                    if (dot < 0) {
                        // ✨ Topu oyuncuyu itiyor - oyuncuya kuvvet ver (geriye itilsin)
                        const impactForce = Math.abs(dot) * 0.4;
                        p.vx += -nx * impactForce;
                        p.vy += -ny * impactForce;
                        
                        // ✨ Sekme (0.85 sekme oranı)
                        ball.vx = (ball.vx - 2 * dot * nx) * 0.85;
                        ball.vy = (ball.vy - 2 * dot * ny) * 0.85;
                        ball.vx += p.vx * 0.2;
                        ball.vy += p.vy * 0.2;
                        
                        // ✨ Minimum sekme hızı (yapışmasın)
                        const newSpeed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                        const MIN_BOUNCE = 7.0;  // Daha güçlü minimum (6 → 7)
                        if (newSpeed < MIN_BOUNCE) {
                            ball.vx = -nx * MIN_BOUNCE;
                            ball.vy = -ny * MIN_BOUNCE;
                        }
                    } else {
                        // ✨ Top oyuncudan uzaklaşıyor ama içindeydi (bug durumu)
                        // Küçük bir sekme ver, yapışmasın
                        ball.vx = -nx * 5.0;
                        ball.vy = -ny * 5.0;
                    }
                    ball.spin = (ball.spin || 0) * 0.3;
                } else if (stickPower > 0.01) {
                    // Yavaş top - yapışma (güç oranında)
                    ball.vx = ball.vx * (1 - stickPower) + p.vx * stickPower;
                    ball.vy = ball.vy * (1 - stickPower) + p.vy * stickPower;
                    ball.spin = 0;
                } else {
                    // Yapışma KAPALI (0) - top oyuncuya değince hafif iter, yapışmaz
                    const dot = ball.vx * nx + ball.vy * ny;
                    if (dot < 0) {
                        ball.vx = (ball.vx - 2 * dot * nx) * 0.6;
                        ball.vy = (ball.vy - 2 * dot * ny) * 0.6;
                    }
                    ball.vx += p.vx * 0.15;
                    ball.vy += p.vy * 0.15;
                    ball.spin = 0;
                }
                
                const bs2 = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                if (bs2 > ADV_BALL_MAX_SPEED) {
                    ball.vx = (ball.vx / bs2) * ADV_BALL_MAX_SPEED;
                    ball.vy = (ball.vy / bs2) * ADV_BALL_MAX_SPEED;
                }
            }
        }
        
        // Kickoff timeout
        if (gs.kickoff_active) {
            if (now >= gs.kickoff_timeout) {
                gs.kickoff_active = false;
                const restr = gs.kickoff_restricted_team;
                if (restr === 1) ball.vx = -this.AUTO_PASS_SPEED;
                else ball.vx = this.AUTO_PASS_SPEED;
                ball.vy = (Math.random() - 0.5) * 2;
            }
        }
        
        // === DUVAR + GOL ===
        const goalLock = gs.state === "goal_wait";
        
        // Sol kale
        // ✨ Kale ağzındaysa file'ye doğru girmesine izin ver (bounce yok)
        const ballInLeftGoalMouth = ball.y > this.GOAL_Y_TOP && ball.y < this.GOAL_Y_BOTTOM;
                
        if (ball.x <= 0) {
            // ✨ Sadece top içeri DOĞRU giderken gol say (vx < 0)
            // ✨ Ek bekleme sırasında gol algılama YOK
            if (ballInLeftGoalMouth && !goalLock && ball.vx < 0 && !gs._skipGoalDetection) {
                gs.scores[2] += 1;
                const last = gs.last_ball_toucher;
                const second = gs.second_last_toucher;
                let own = false, assist = null;
                // ✨ Takıma göre own goal kontrolü
                const lastTeam = (last && this.room.players[last]) ? this.room.players[last].team : null;
                if (lastTeam === "red") {
                    own = true;
                    gs.last_goal_scorer = 1;
                    gs.last_goal_scorer_pid = last;  // ✨ Gerçek oyuncu ID
                    gs.kickoff_restricted_team_override = 2;
                    gs.kickoff_receiving_team_override = 1;
                } else {
                    gs.last_goal_scorer = 2;
                    gs.last_goal_scorer_pid = last;  // ✨ Gerçek oyuncu ID
                    gs.kickoff_restricted_team_override = null;
                    gs.kickoff_receiving_team_override = null;
                    if (last && this.room.players[last]) {
                        this.room.players[last].goals = (this.room.players[last].goals || 0) + 1;
                    }
                    if (second && second !== last && this.room.players[second]) {
                        const st = this.room.players[last].team;
                        const at = this.room.players[second].team;
                        if (st === at && ["red", "blue"].includes(st)) {
                            assist = second;
                            this.room.players[second].assists = (this.room.players[second].assists || 0) + 1;
                        }
                    }
                }
                gs.last_goal_own = own;
                gs.last_goal_assist = assist;
                gs.state = "goal_wait";
                gs.goal_wait_until = now + 4.0;
                gs.pause_time = now;
                return { scorer: gs.last_goal_scorer, own_goal: own, assist: assist, scores: { ...gs.scores } };
            } else if (!ballInLeftGoalMouth) {
                // ✨ Kale ağzının DIŞINDA (direk üstü/altı) - duvar gibi seksin
                ball.x = this.BALL_RADIUS;
                ball.vx = -ball.vx * this.WALL_BOUNCE;
                if (Math.abs(ball.vx) < this.MIN_BOUNCE_SPEED) ball.vx = this.MIN_BOUNCE_SPEED;
                ball.vy *= 0.9;
                ball.spin = (ball.spin || 0) * 0.5;
                gs.hit_events.push({ type: "wall", time: now });
            }
        }
        
        // Sağ kale
        // ✨ Kale ağzındaysa file'ye doğru girmesine izin ver
        const ballInRightGoalMouth = ball.y > this.GOAL_Y_TOP && ball.y < this.GOAL_Y_BOTTOM;
        
        if (ball.x >= this.FIELD_WIDTH) {
            // ✨ Sadece top içeri DOĞRU giderken gol say (vx > 0)
            // Top zaten içeride ve duruyor/geri dönüyorsa (pause sonrası) → gol yok
            if (ballInRightGoalMouth && !goalLock && ball.vx > 0 && !gs._skipGoalDetection) {
                gs.scores[1] += 1;
                const last = gs.last_ball_toucher;
                const second = gs.second_last_toucher;
                let own = false, assist = null;
                // ✨ Takıma göre own goal kontrolü
                const lastTeam = (last && this.room.players[last]) ? this.room.players[last].team : null;
                if (lastTeam === "blue") {
                    own = true;
                    gs.last_goal_scorer = 2;
                    gs.kickoff_restricted_team_override = 1;
                    gs.kickoff_receiving_team_override = 2;
                } else {
                    gs.last_goal_scorer = 1;
                    gs.kickoff_restricted_team_override = null;
                    gs.kickoff_receiving_team_override = null;
                    if (last && this.room.players[last]) {
                        this.room.players[last].goals = (this.room.players[last].goals || 0) + 1;
                    }
                    if (second && second !== last && this.room.players[second]) {
                        const st = this.room.players[last].team;
                        const at = this.room.players[second].team;
                        if (st === at && ["red", "blue"].includes(st)) {
                            assist = second;
                            this.room.players[second].assists = (this.room.players[second].assists || 0) + 1;
                        }
                    }
                }
                gs.last_goal_own = own;
                gs.last_goal_assist = assist;
                gs.state = "goal_wait";
                gs.goal_wait_until = now + 4.0;
                gs.pause_time = now;
                return { scorer: gs.last_goal_scorer, own_goal: own, assist: assist, scores: { ...gs.scores } };
            } else if (!ballInRightGoalMouth) {
                // ✨ Kale ağzının DIŞINDA (direk üstü/altı) - duvar gibi seksin
                ball.x = this.FIELD_WIDTH - this.BALL_RADIUS;
                ball.vx = -ball.vx * this.WALL_BOUNCE;
                if (Math.abs(ball.vx) < this.MIN_BOUNCE_SPEED) ball.vx = -this.MIN_BOUNCE_SPEED;
                ball.vy *= 0.9;
                ball.spin = (ball.spin || 0) * 0.5;
                gs.hit_events.push({ type: "wall", time: now });
            }
        }
		
		// ✨ FILE İÇİ DURDURMA KUTUSU (top file'ye ulaşmasın, biraz içeride dursun)
        // Sol kale: top gol çizgisini geçtikten sonra biraz ileriye kadar gitsin
        if (ball.x < 0) {
            if (ball.x < -35) {
                ball.x = -35;
                if (ball.vx < 0) ball.vx = 0;
                ball.vy *= 0.5;
            }
            // Y ekseninde kale genişliği dışına çıkamasın
            if (ball.y < this.GOAL_Y_TOP + this.BALL_RADIUS) {
                ball.y = this.GOAL_Y_TOP + this.BALL_RADIUS;
                if (ball.vy < 0) ball.vy = 0;
            }
            if (ball.y > this.GOAL_Y_BOTTOM - this.BALL_RADIUS) {
                ball.y = this.GOAL_Y_BOTTOM - this.BALL_RADIUS;
                if (ball.vy > 0) ball.vy = 0;
            }
        }
        
        // Sağ kale: aynı şekilde
        if (ball.x > this.FIELD_WIDTH) {
            if (ball.x > this.FIELD_WIDTH + 35) {
                ball.x = this.FIELD_WIDTH + 35;
                if (ball.vx > 0) ball.vx = 0;
                ball.vy *= 0.5;
            }
            // Y ekseninde kale genişliği dışına çıkamasın
            if (ball.y < this.GOAL_Y_TOP + this.BALL_RADIUS) {
                ball.y = this.GOAL_Y_TOP + this.BALL_RADIUS;
                if (ball.vy < 0) ball.vy = 0;
            }
            if (ball.y > this.GOAL_Y_BOTTOM - this.BALL_RADIUS) {
                ball.y = this.GOAL_Y_BOTTOM - this.BALL_RADIUS;
                if (ball.vy > 0) ball.vy = 0;
            }
        }
        
        // ✨ Top kale arkasında mı? (yan duvarı geçmiş, x < 0 veya x > FIELD_WIDTH)
        const ballBehindGoal = ball.x < 0 || ball.x > this.FIELD_WIDTH;
        
        // Üst/alt duvar (kale arkasındaysa devre dışı)
        if (!ballBehindGoal) {
            if (ball.y - this.BALL_RADIUS <= 0) {
                ball.y = this.BALL_RADIUS;
                ball.vy = -ball.vy * this.WALL_BOUNCE;
                if (Math.abs(ball.vy) < this.MIN_BOUNCE_SPEED) ball.vy = this.MIN_BOUNCE_SPEED;
                ball.vx *= 0.9;
                ball.spin = (ball.spin || 0) * 0.5;
                gs.hit_events.push({ type: "wall", time: now });
            }
            if (ball.y + this.BALL_RADIUS >= this.FIELD_HEIGHT) {
                ball.y = this.FIELD_HEIGHT - this.BALL_RADIUS;
                ball.vy = -ball.vy * this.WALL_BOUNCE;
                if (Math.abs(ball.vy) < this.MIN_BOUNCE_SPEED) ball.vy = -this.MIN_BOUNCE_SPEED;
                ball.vx *= 0.9;
                ball.spin = (ball.spin || 0) * 0.5;
                gs.hit_events.push({ type: "wall", time: now });
            }
        }
        
        // Direk çarpışma (top) - kale arkasındaysa devre dışı
        const posts = [
            [0, this.GOAL_Y_TOP], [0, this.GOAL_Y_BOTTOM],
            [this.FIELD_WIDTH, this.GOAL_Y_TOP], [this.FIELD_WIDTH, this.GOAL_Y_BOTTOM]
        ];
        if (!ballBehindGoal) {
            for (const [px, py] of posts) {
                const dx = ball.x - px;
                const dy = ball.y - py;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = this.BALL_RADIUS + this.GOAL_POST_RADIUS;
                if (dist < minDist && dist > 0) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const overlap = minDist - dist;
                    ball.x += nx * overlap;
                    ball.y += ny * overlap;
                    const dot = ball.vx * nx + ball.vy * ny;
                    if (dot < 0) {
                        ball.vx = (ball.vx - 2 * dot * nx) * 0.75;
                        ball.vy = (ball.vy - 2 * dot * ny) * 0.75;
                        gs.hit_events.push({ type: "post", time: now });
                    }
                    ball.spin = (ball.spin || 0) * 0.3;
                }
            }
        }
        
        // Direk çarpışma (oyuncu)
        for (const pid in gs.players) {
            const p = gs.players[pid];
            for (const [px, py] of posts) {
                const dx = p.x - px;
                const dy = p.y - py;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const minDist = this.PLAYER_RADIUS + this.GOAL_POST_RADIUS;
                if (dist < minDist && dist > 0) {
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const overlap = minDist - dist;
                    p.x += nx * overlap;
                    p.y += ny * overlap;
                    const dot_p = p.vx * nx + p.vy * ny;
                    if (dot_p < 0) {
                        p.vx -= dot_p * nx;
                        p.vy -= dot_p * ny;
                    }
                }
            }
        }	
				        
        // Son güvenlik - top oyuncu içine gömülmesin (güçlü versiyon)
        const ballInGoalZone = (
            (ball.x < this.BALL_RADIUS + 2 && this.GOAL_Y_TOP < ball.y && ball.y < this.GOAL_Y_BOTTOM) ||
            (ball.x > this.FIELD_WIDTH - this.BALL_RADIUS - 2 && this.GOAL_Y_TOP < ball.y && ball.y < this.GOAL_Y_BOTTOM)
        );
        if (!ballInGoalZone) {
            for (let iter = 0; iter < 8; iter++) {  // ✨ 4 → 8 iterasyon
                let any = false;
                
                // ✨ İki oyuncu topa çok yakınsa "sıkışma modu" - topu ekstra kaçır
                const playersNearBall = [];
                for (const pid in gs.players) {
                    const p = gs.players[pid];
                    const dx = ball.x - p.x;
                    const dy = ball.y - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < this.PLAYER_RADIUS + this.BALL_RADIUS + 5) {
                        playersNearBall.push({ pid, p, dx, dy, dist });
                    }
                }
                
                // ✨ SIKIŞMA: 2+ oyuncu top'a çok yakın → topu iki oyuncunun ORTASINDAN ZIT yöne fırlat
                if (playersNearBall.length >= 2) {
                    // İki oyuncunun ortası
                    const midX = playersNearBall.reduce((s, x) => s + x.p.x, 0) / playersNearBall.length;
                    const midY = playersNearBall.reduce((s, x) => s + x.p.y, 0) / playersNearBall.length;
                    
                    // Oyuncuların ortalama yönü (mesela ikisi de yatay yan yanaysa dikey kaç)
                    // İki oyuncu arasındaki vektör
                    let escapeX = 0, escapeY = 0;
                    if (playersNearBall.length === 2) {
                        const p1 = playersNearBall[0].p;
                        const p2 = playersNearBall[1].p;
                        // İki oyuncu arasındaki eksen
                        const axisX = p2.x - p1.x;
                        const axisY = p2.y - p1.y;
                        const axisLen = Math.sqrt(axisX * axisX + axisY * axisY);
                        if (axisLen > 0.1) {
                            // Perpendicular (dik) yön → kaçış yönü
                            escapeX = -axisY / axisLen;
                            escapeY = axisX / axisLen;
                            
                            // Topun mevcut pozisyonuna göre hangi yöne (yukarı mı aşağı mı) kaçsın
                            const midDX = ball.x - midX;
                            const midDY = ball.y - midY;
                            const dotWithEscape = midDX * escapeX + midDY * escapeY;
                            if (dotWithEscape < 0) {
                                escapeX = -escapeX;
                                escapeY = -escapeY;
                            }
                            
                            // Topu dik yönde biraz uzaklaştır
                            ball.x += escapeX * 3;
                            ball.y += escapeY * 3;
                            // Ekstra teğet hız da ver
                            ball.vx += escapeX * 2;
                            ball.vy += escapeY * 2;
                            any = true;
                        }
                    }
                }
                
                // Normal itme (her oyuncu için)
                for (const nearInfo of playersNearBall) {
                    const p = nearInfo.p;
                    const dx = ball.x - p.x;
                    const dy = ball.y - p.y;
                    let dist = Math.sqrt(dx * dx + dy * dy);
                    const minDist = this.PLAYER_RADIUS + this.BALL_RADIUS;
                    if (dist < minDist) {
                        any = true;
                        let nx, ny;
                        if (dist < 0.1) {
                            const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                            if (sp > 0.1) { nx = -p.vx / sp; ny = -p.vy / sp; }
                            else { nx = 1; ny = 0; }
                        } else {
                            nx = dx / dist; ny = dy / dist;
                        }
                        const overlap = minDist - dist;
                        ball.x += nx * overlap;
                        ball.y += ny * overlap;
                        
                        const dot_b = ball.vx * (-nx) + ball.vy * (-ny);
                        if (dot_b > 0) {
                            ball.vx -= (-nx) * dot_b;
                            ball.vy -= (-ny) * dot_b;
                            
                            const tx1 = -ny, ty1 = nx;
                            const tx2 = ny, ty2 = -nx;
                            const dot_t1 = ball.vx * tx1 + ball.vy * ty1;
                            const dot_t2 = ball.vx * tx2 + ball.vy * ty2;
                            const tx = (dot_t1 >= dot_t2) ? tx1 : tx2;
                            const ty = (dot_t1 >= dot_t2) ? ty1 : ty2;
                            
                            const push = dot_b * 0.7;
                            ball.vx += tx * push;
                            ball.vy += ty * push;
                        }
                    }
                }
                if (!any) break;
            }
        }
        
        return null;
    }
};

console.log("Mini Futbol Host Physics yüklendi ✓");