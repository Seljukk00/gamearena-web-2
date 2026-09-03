// ==========================================
// ⚽ MİNİ FUTBOL - ANA GİRİŞ & SOKET YÖNETİMİ
// ==========================================

// ========================================
// EKRAN YÖNETİMİ (wrap)
// ========================================
const _prevShowScreenMini = showScreen;
showScreen = function(screenName) {
    _prevShowScreenMini(screenName);
    
    const screens = ["createMiniScreen", "miniLobbyScreen", "miniGameScreen"];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });
    
    if (screenName === "createMini") {
        const el = document.getElementById("createMiniScreen");
        if (el) el.classList.remove("hidden");
    }
    if (screenName === "miniLobby") {
        const el = document.getElementById("miniLobbyScreen");
        if (el) el.classList.remove("hidden");
    }
    if (screenName === "miniGame") {
        const el = document.getElementById("miniGameScreen");
        if (el) el.classList.remove("hidden");
    }
    
    // Oyun ekranından çıkınca tuş dinlemeyi kapat
    if (screenName !== "miniGame") {
        stopMiniGame();
    }
    
    // ✨ Mini futbol dışına çıktıysa ping'i de durdur
    const miniScreens = ["createMini", "miniLobby", "miniGame"];
    if (!miniScreens.includes(screenName)) {
        stopMiniPing();
        hideMiniChat();
    }
};

// ========================================
// MESAJ İŞLEME (wrap)
// ========================================
const _prevHandleMessageMini = handleMessage;
handleMessage = function(msg) {
    // ✨ KICK edildim - her ekrandan ana menüye at
    if (msg.type === "kick_blocked") {
        console.log("[KICK] Bu odadan atıldım!");
        
        // Tüm popup'ları kapat
        document.querySelectorAll(".overlay").forEach(o => o.classList.add("hidden"));
        
        // HP fizik motorunu durdur (varsa)
        if (typeof HP !== 'undefined' && HP.running) {
            HP.stopGame();
        }
        
        // Mini futbol oyununu durdur (varsa)
        if (typeof stopMiniGame === "function") {
            stopMiniGame();
        }
        
        // Mini data sıfırla
        inRoom = false;
        if (typeof miniData !== "undefined") {
            miniData.roomCode = "";
            miniData.playerId = null;
            miniData.players = [];
        }
        playerId = null;
        roomCode = "";
        
        // WS'i yenile
        if (ws) {
            try { ws.close(); } catch(e) {}
        }
        setTimeout(() => {
            connectWS();
        }, 300);
        
        // Ana ekrana dön
        showScreen("home");
        
        // Kick popup göster
        setTimeout(() => {
            const kickBox = document.getElementById("kickBlockedBox");
            if (kickBox) {
                kickBox.classList.remove("hidden");
            }
        }, 100);
        
        return;
    }
    
    if (msg.type && msg.type.startsWith("mini_")) {
        handleMiniMessage(msg);
        return;
    }
    _prevHandleMessageMini(msg);
};

function handleMiniMessage(msg) {
    // ==========================================
    // ✨ WEBRTC SİGNALING mesajları
    // ==========================================
    if (msg.type === "mini_webrtc_offer") {
        MiniRTC.handleOffer(msg.from_pid, msg.offer).catch(e => {});
        return;
    }
    
    if (msg.type === "mini_webrtc_answer") {
        MiniRTC.handleAnswer(msg.from_pid, msg.answer).catch(e => {});
        return;
    }
    
    if (msg.type === "mini_webrtc_ice") {
        MiniRTC.handleIce(msg.from_pid, msg.candidate).catch(e => {});
        return;
    }
    
    // ✨ PAUSE/RESUME mesajları
    if (msg.type === "mini_paused") {
        console.log("[MINI] Oyun duraklatıldı");
        
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running) {
            HP.pauseGame();
            console.log("[HOST-PHYSICS] HP motoru pause edildi");
        }
        
        showMiniPauseLobby();
        miniReleaseAllKeys();
        return;
    }
    
    if (msg.type === "mini_resumed") {
        console.log("[MINI] Oyun devam ediyor");
        hideMiniPauseLobby();
        hideMiniGuestEscMenu();
        const guestBox = document.getElementById("miniGuestPausedBox");
        if (guestBox) guestBox.classList.add("hidden");
        const guestEsc = document.getElementById("miniGuestEscBox");
        if (guestEsc) guestEsc.classList.add("hidden");
        
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running) {
            HP.resumeGame();
            console.log("[HOST-PHYSICS] Devam et → 3-2-1 sayımı başlatıldı");
        }
        return;
    }
    
    // ✨ MAÇ YENİDEN BAŞLATILDI
    if (msg.type === "mini_restarted") {
        console.log("[MINI] Maç yeniden başlatıldı");
        miniData._teamOwnGoalsCount = { red: 0, blue: 0 }; 
        miniData._lastGoalSignature = null;
        miniData._goalSongPlayed = null;
        
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running) {
            HP.restartMatch();
            console.log("[HOST-PHYSICS] HP motoru yeniden başlatıldı ✓");
        }
        
        hideMiniPauseLobby();
        const guestBox = document.getElementById("miniGuestPausedBox");
        if (guestBox) guestBox.classList.add("hidden");
        hideMiniGuestEscMenu();
        if (typeof showToast === "function") {
            showToast("🔄 Yeniden Başladı", "Maç sıfırdan başlıyor!", null, "success");
        }
        return;
    }
    
    // ✨ HIZLI PAUSE (P tuşu)
    if (msg.type === "mini_quick_paused") {
        console.log("[MINI] Hızlı pause (P)");
        showMiniQuickPauseOverlay();
        return;
    }
    
    if (msg.type === "mini_quick_resumed") {
        console.log("[MINI] Hızlı devam (P)");
        hideMiniQuickPauseOverlay();
        return;
    }
    
    // ✨ Host lobiye döndü
    if (msg.type === "mini_returned_to_lobby") {
        console.log("[MINI] Host lobbye döndü, otomatik lobbye geçiliyor...");
        
        stopMiniGameOverCountdown();
        
        const overBox = document.getElementById("miniGameOverBox");
        if (overBox) overBox.classList.add("hidden");
        
        miniReplay.buffer = [];
        
        const menuBtn = document.getElementById("miniGameOverMenuBtn");
        if (menuBtn) {
            menuBtn.disabled = false;
            menuBtn.textContent = "🏠 Lobiye Dön";
        }
        const rematchBtn = document.getElementById("miniRematchBtn");
        if (rematchBtn) {
            rematchBtn.disabled = false;
        }
        
        const guestPausedBox = document.getElementById("miniGuestPausedBox");
        if (guestPausedBox) guestPausedBox.classList.add("hidden");
        
        hideMiniGuestEscMenu();
        hideMiniPauseLobby();
        hideMiniQuickPauseOverlay();
        
        stopMiniGame();
        showScreen("miniLobby");
        updateMiniLobby();
        return;
    }
    
    if (msg.type === "mini_active_players_changed") {
        miniData.playerNames = msg.players;
        console.log("[MINI] Aktif oyuncular güncellendi", msg);

        const redPidsMsg = msg.red_pids || (msg.red_pid ? [msg.red_pid] : []);
        const bluePidsMsg = msg.blue_pids || (msg.blue_pid ? [msg.blue_pid] : []);

        if (miniData.players) {
            redPidsMsg.forEach(id => {
                const p = miniData.players.find(pl => Number(pl.id) === Number(id));
                if (p) p.team = "red";
            });
            bluePidsMsg.forEach(id => {
                const p = miniData.players.find(pl => Number(pl.id) === Number(id));
                if (p) p.team = "blue";
            });
        }
        
        miniData.currentPositions = {};
        miniData.targetPositions = {};
        miniData.snapshots = [];
        miniData._renderSmoothed = {};
        miniData._ballRenderPos = null;
        
        if (msg.removed_pid) {
            const removedPid = msg.removed_pid;
            console.log(`[MINI] Ayrılan oyuncu ${removedPid} HP'den siliniyor`);
            
            if (miniData.gameState && miniData.gameState.players) {
                delete miniData.gameState.players[String(removedPid)];
            }
            
            if (typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players) {
                delete HP.room.gameState.players[removedPid];
            }
            if (typeof HP !== 'undefined' && HP.running && HP.room?.players) {
                delete HP.room.players[removedPid];
            }
        }
        
        // Host için HP Sync
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running && HP.room && HP.room.gameState) {
            const redPids = msg.red_pids || (msg.red_pid ? [msg.red_pid] : []);
            const bluePids = msg.blue_pids || (msg.blue_pid ? [msg.blue_pid] : []);
            const allActivePids = new Set([...redPids, ...bluePids]);
            const gs = HP.room.gameState;
            
            for (const pid in gs.players) {
                if (!allActivePids.has(parseInt(pid))) {
                    console.log(`[HP MULTI] Oyuncu ${pid} silindi (takım dışı)`);
                    delete gs.players[pid];
                }
            }
            
            const calcYs = (count, height) => {
                if (count === 1) return [height / 2];
                const top = height * 0.15;
                const bottom = height * 0.85;
                const step = (bottom - top) / (count - 1);
                const ys = [];
                for (let i = 0; i < count; i++) ys.push(top + i * step);
                return ys;
            };
            
            const spawnOffset = HP.FIELD_WIDTH * 0.2;
            const redYs = calcYs(redPids.length, HP.FIELD_HEIGHT);
            const blueYs = calcYs(bluePids.length, HP.FIELD_HEIGHT);
            
            function findBestYSlot(availableYs, existingYs) {
                if (existingYs.length === 0) return availableYs[0];
                let bestY = availableYs[0];
                let bestMinDist = -1;
                for (const y of availableYs) {
                    let minDist = Infinity;
                    for (const ey of existingYs) {
                        const d = Math.abs(y - ey);
                        if (d < minDist) minDist = d;
                    }
                    if (minDist > bestMinDist) {
                        bestMinDist = minDist;
                        bestY = y;
                    }
                }
                return bestY;
            }
            
            const existingRedYs = redPids
                .filter(pid => gs.players[pid] && gs.players[pid].team === "red")
                .map(pid => gs.players[pid].y);
            
            redPids.forEach((pid, i) => {
                if (!gs.players[pid]) {
                    const bestY = findBestYSlot(redYs, existingRedYs);
                    gs.players[pid] = {
                        x: spawnOffset, y: bestY,
                        vx: 0, vy: 0,
                        keys: { up: false, down: false, left: false, right: false, kick: false, sprint: false },
                        last_kick_time: 0,
                        sprint_energy: HP.SPRINT_MAX_ENERGY,
                        last_frame_time: 0,
                        team: "red"
                    };
                    existingRedYs.push(bestY);
                    console.log(`[HP MULTI] Yeni kırmızı ${pid} → Y=${bestY.toFixed(0)}`);
                } else {
                    const oldTeam = gs.players[pid].team;
                    gs.players[pid].team = "red";
                    if (oldTeam !== "red") {
                        const bestY = findBestYSlot(redYs, existingRedYs);
                        gs.players[pid].x = spawnOffset;
                        gs.players[pid].y = bestY;
                        gs.players[pid].vx = 0;
                        gs.players[pid].vy = 0;
                        existingRedYs.push(bestY);
                        console.log(`[HP MULTI] Oyuncu ${pid} ${oldTeam} → red, Y=${bestY.toFixed(0)}`);
                    }
                }
                if (!HP.room.players[pid]) {
                    HP.room.players[pid] = {
                        name: msg.players[String(pid)] || "P" + pid,
                        team: "red",
                        goals: 0, assists: 0, passes: 0, saves: 0
                    };
                } else {
                    HP.room.players[pid].team = "red";
                    if (msg.players[String(pid)]) HP.room.players[pid].name = msg.players[String(pid)];
                }
            });
            
            const existingBlueYs = bluePids
                .filter(pid => gs.players[pid] && gs.players[pid].team === "blue")
                .map(pid => gs.players[pid].y);
            
            bluePids.forEach((pid, i) => {
                if (!gs.players[pid]) {
                    const bestY = findBestYSlot(blueYs, existingBlueYs);
                    gs.players[pid] = {
                        x: HP.FIELD_WIDTH - spawnOffset, y: bestY,
                        vx: 0, vy: 0,
                        keys: { up: false, down: false, left: false, right: false, kick: false, sprint: false },
                        last_kick_time: 0,
                        sprint_energy: HP.SPRINT_MAX_ENERGY,
                        last_frame_time: 0,
                        team: "blue"
                    };
                    existingBlueYs.push(bestY);
                    console.log(`[HP MULTI] Yeni mavi ${pid} → Y=${bestY.toFixed(0)}`);
                } else {
                    const oldTeam = gs.players[pid].team;
                    gs.players[pid].team = "blue";
                    if (oldTeam !== "blue") {
                        const bestY = findBestYSlot(blueYs, existingBlueYs);
                        gs.players[pid].x = HP.FIELD_WIDTH - spawnOffset;
                        gs.players[pid].y = bestY;
                        gs.players[pid].vx = 0;
                        gs.players[pid].vy = 0;
                        existingBlueYs.push(bestY);
                        console.log(`[HP MULTI] Oyuncu ${pid} ${oldTeam} → blue, Y=${bestY.toFixed(0)}`);
                    }
                }
                if (!HP.room.players[pid]) {
                    HP.room.players[pid] = {
                        name: msg.players[String(pid)] || "P" + pid,
                        team: "blue",
                        goals: 0, assists: 0, passes: 0, saves: 0
                    };
                } else {
                    HP.room.players[pid].team = "blue";
                    if (msg.players[String(pid)]) HP.room.players[pid].name = msg.players[String(pid)];
                }
            });
            
            HP.room.active_red_player = redPids[0] || null;
            HP.room.active_blue_player = bluePids[0] || null;
            HP.room.active_red_players = redPids;
            HP.room.active_blue_players = bluePids;
            
            console.log(`[HP MULTI] Sahada: ${redPids.length} kırmızı, ${bluePids.length} mavi`);
        }
        
        updateMiniHUD();
        return;
    }
    
    // PING/PONG
    if (msg.type === "mini_pong") {
        let rttMs = 0;
        if (typeof msg.ts === "number" && msg.ts > 0) {
            rttMs = Date.now() - msg.ts;
        }
        if (rttMs < 0) rttMs = 0;
        if (rttMs > 9999) rttMs = 9999;
        
        send({ type: "mini_ping_report", ping: rttMs });
        if (!miniData.pings) miniData.pings = {};
        miniData.pings[miniData.playerId] = rttMs;
        updateMiniPingDisplay();
        return;
    }
    
    if (msg.type === "mini_pings_update") {
        const newPings = {};
        for (const pid in msg.pings) {
            newPings[parseInt(pid)] = msg.pings[pid];
        }
        miniData.pings = newPings;
        updateMiniPingDisplay();
        return;
    }
    
    if (msg.type === "mini_room_created" || msg.type === "mini_room_joined") {
        showMiniChat();
        miniData.roomCode = msg.room_code;
        miniData.playerId = msg.player_id;
        miniData.goalTarget = msg.goal_target;
        miniData.matchDuration = msg.match_duration;
        miniData.gameSpeed = msg.game_speed || "normal";
        if (msg.player_count !== undefined) miniData.playerCount = msg.player_count;
        if (msg.kickoff_timeout !== undefined) miniData.kickoffTimeout = msg.kickoff_timeout;
        if (msg.players && Array.isArray(msg.players)) {
            miniData.players = msg.players;
            syncPersistentJerseys();
        }
        inRoom = true;
        playerId = msg.player_id;
        
        startMiniPing();
        playGlobalSound("player_join.mp3", 0.6);
        
        if (msg.mid_game) {
            console.log("[MINI] Oyun devam ediyor, izleyici olarak katılıyorum...");
            if (msg.players && Array.isArray(msg.players)) miniData.players = msg.players;
            if (msg.field) miniData.fieldConfig = msg.field;
            if (msg.red_team_name) miniData.redTeamName = msg.red_team_name;
            if (msg.blue_team_name) miniData.blueTeamName = msg.blue_team_name;
            miniData.splitScreen = msg.split_screen || false;
            miniData.splitOwner = msg.split_owner || null;
            miniData.splitSlaveId = msg.split_slave_id || null;
            if (msg.game_state) miniData.gameState = msg.game_state;
            
            miniData.snapshots = [];
            miniData.currentPositions = {};
            miniData.targetPositions = {};
            miniData._renderSmoothed = {};
            miniData._hostRenderSmoothed = null;
            
            showScreen("miniGame");
            startMiniGame();
            
            if (msg.is_paused) {
                console.log("[MINI] Oyun pause'da, pause lobby açılıyor...");
                setTimeout(() => {
                    showMiniPauseLobby();
                }, 200);
            }
            return;
        }
        
        showScreen("miniLobby");
        return;
    }
    
    if (msg.type === "mini_lobby_update") {
        showMiniChat();
        if (miniData.playerId === 1 && msg.players) {
            msg.players.forEach(p => {
                if (p.id !== 1) {
                    MiniRTC.createPeerForGuest(p.id);
                }
            });
        }
        
        const hasHost = msg.players && msg.players.some(p => Number(p.id) === 1);
        if (!hasHost && miniData.playerId !== 1 && inRoom) {
            console.log("[MINI] Host odadan ayrıldı, katıl ekranına gidiyorum...");
            
            if (typeof HP !== 'undefined' && HP.running) HP.stopGame();
            stopMiniGame();
            stopMiniPing();
            
            document.querySelectorAll(".overlay").forEach(o => o.classList.add("hidden"));
            
            showToast("👑 Host Ayrıldı", "Oda kapandı, katıl ekranına yönlendiriliyorsun...", null, "warning");
            
            inRoom = false;
            miniData.roomCode = "";
            miniData.playerId = null;
            miniData.players = [];
            miniData.gameState = null;
            playerId = null;
            roomCode = "";
            
            if (ws) { try { ws.close(); } catch(e) {} }
            setTimeout(() => {
                connectWS();
                showScreen("join");
            }, 500);
            return;
        }
        
        miniData.roomCode = msg.room_code;
        miniData.players = msg.players;
        syncPersistentJerseys();
        miniData.goalTarget = msg.goal_target;
        miniData.matchDuration = msg.match_duration;
        miniData.gameSpeed = msg.game_speed || "normal";
        miniData.redTeamName = msg.red_team_name || "Kırmızı Takım";
        miniData.blueTeamName = msg.blue_team_name || "Mavi Takım";

        function resolvePresetOrStorage(teamKey, currentName, currentColor, currentSprint) {
            const norm = (currentName || "").trim().toLowerCase();
            let presetT = null, presetS = null;

            if (["türkiye", "turkiye"].includes(norm)) { presetT = "#e30a17"; presetS = "#e30a17"; }
            else if (["azerbaycan", "azerbaijan"].includes(norm)) { presetT = "#00a8e8"; presetS = "#ffffff"; }
            else if (["beşiktaş", "besiktas", "bjk"].includes(norm)) { presetT = "#111111"; presetS = "#ffffff"; }
            else if (["galatasaray", "gs"].includes(norm)) { presetT = "#a90429"; presetS = "#fdb913"; }
            else if (["fenerbahçe", "fenerbahce", "fb"].includes(norm)) { presetT = "#00205b"; presetS = "#ffed00"; }
            else if (["trabzonspor", "ts"].includes(norm)) { presetT = "#700018"; presetS = "#4ab3e8"; }

            const defaultCol = teamKey === "red" ? "#ff6b6b" : "#4dabf7";
            const isDefault = !currentColor || currentColor === defaultCol || currentColor === "#ff6b6b" || currentColor === "#4dabf7";

            let localCol = null, localSprint = null;
            try {
                const prefix = teamKey === "red" ? "miniRed" : "miniBlue";
                const sName = localStorage.getItem(prefix + "TeamName");
                if (sName && sName.trim().toLowerCase() === norm) {
                    localCol = localStorage.getItem(prefix + "TeamColor");
                    localSprint = localStorage.getItem(prefix + "SprintColor");
                }
            } catch(e) {}

            let finalCol = currentColor;
            let finalSprint = currentSprint;

            if (isDefault) {
                if (localCol) finalCol = localCol;
                else if (presetT) finalCol = presetT;

                if (localSprint) finalSprint = localSprint;
                else if (presetS) finalSprint = presetS;
            }

            return {
                col: finalCol || defaultCol,
                sprint: finalSprint || "#ffd43b",
                needsSync: isDefault && (finalCol !== currentColor || finalSprint !== currentSprint)
            };
        }

        const redResolved = resolvePresetOrStorage("red", miniData.redTeamName, msg.red_team_color, msg.red_sprint_color);
        const blueResolved = resolvePresetOrStorage("blue", miniData.blueTeamName, msg.blue_team_color, msg.blue_sprint_color);

        miniData.redTeamColor = redResolved.col;
        miniData.redSprintColor = redResolved.sprint;
        miniData.blueTeamColor = blueResolved.col;
        miniData.blueSprintColor = blueResolved.sprint;

        if (miniData.playerId === 1) {
            if (redResolved.needsSync) {
                send({
                    type: "mini_change_team_name",
                    team: "red",
                    name: miniData.redTeamName,
                    team_color: redResolved.col,
                    sprint_color: redResolved.sprint
                });
            }
            if (blueResolved.needsSync) {
                send({
                    type: "mini_change_team_name",
                    team: "blue",
                    name: miniData.blueTeamName,
                    team_color: blueResolved.col,
                    sprint_color: blueResolved.sprint
                });
            }
        }
        miniData.splitScreen = msg.split_screen || false;
        if (msg.goal_music_mode) {
            miniData.goalMusicMode = msg.goal_music_mode;
            try { localStorage.setItem("miniGoalMusicMode", msg.goal_music_mode); } catch(e) {}
        }
        miniData.allowPlase = msg.allow_plase !== false;
        miniData.ballStick = msg.ball_stick !== false;
        miniData.sprintEnabled = msg.sprint_enabled !== false;
        miniData.passAssistance = msg.pass_assistance !== false;
        miniData.advancedEnabled = msg.advanced_enabled || false;
        miniData.advancedSettings = msg.advanced || null;
        miniData.playerCount = msg.player_count || 2;
        if (msg.spectator_count !== undefined) miniData.spectatorCount = msg.spectator_count;
        miniData.kickoffTimeout = msg.kickoff_timeout || 10;
        if (msg.field_width) miniData.fieldWidth = msg.field_width;
        if (msg.field_height) miniData.fieldHeight = msg.field_height;
        if (msg.field_goal_width) miniData.fieldGoalWidth = msg.field_goal_width;
        if (msg.field_width && miniData.fieldConfig) {
            miniData.fieldConfig.width = msg.field_width;
            miniData.fieldConfig.height = msg.field_height;
            miniData.fieldConfig.goal_width = msg.field_goal_width;
        }
        if (msg.split_owner !== undefined) miniData.splitOwner = msg.split_owner;
        if (msg.split_slave_id !== undefined) miniData.splitSlaveId = msg.split_slave_id;
        
        if (miniData.playerId === 1) {
            try {
                localStorage.setItem("miniPlayerCount", String(miniData.playerCount));
                localStorage.setItem("miniSpectatorCount", String(miniData.spectatorCount));
                localStorage.setItem("miniCreateGoal", String(miniData.goalTarget));
                localStorage.setItem("miniCreateDuration", String(miniData.matchDuration));
                localStorage.setItem("miniCreateSpeed", miniData.gameSpeed);
                localStorage.setItem("miniCreateSplit", miniData.splitScreen ? "on" : "off");
                localStorage.setItem("miniAllowPlase", miniData.allowPlase ? "on" : "off");
                localStorage.setItem("miniBallStick", miniData.ballStick ? "on" : "off");
                localStorage.setItem("miniSprintEnabled", miniData.sprintEnabled ? "on" : "off");
                
                const raw = localStorage.getItem("miniAdvancedSettings");
                const advDict = raw ? JSON.parse(raw) : {};
                advDict._advGoalTarget = miniData.goalTarget;
                advDict._advMatchDurationMin = (miniData.matchDuration >= 99999) ? 9999 : Math.round(miniData.matchDuration / 60);
                localStorage.setItem("miniAdvancedSettings", JSON.stringify(advDict));
            } catch(e) {}
        }
        
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running && HP.settings) {
            const oldMatchDuration = parseInt(HP.settings.matchDuration);
            const newMatchDuration = parseInt(msg.match_duration);
            HP.settings.goalTarget = msg.goal_target;
            HP.settings.matchDuration = newMatchDuration;
            HP.settings.gameSpeed = msg.game_speed || "normal";
            HP.settings.allowPlase = msg.allow_plase !== false;
            HP.settings.ballStick = msg.ball_stick !== false;
            HP.settings.sprintEnabled = msg.sprint_enabled !== false;
            HP.settings.passAssistance = msg.pass_assistance !== false;
            HP.settings.kickoffTimeout = msg.kickoff_timeout || 10;
            HP.settings.advancedEnabled = msg.advanced_enabled || false;
            HP.settings.advanced = msg.advanced || null;
            const oldFW = HP.FIELD_WIDTH;
            const oldFH = HP.FIELD_HEIGHT;
            let fieldChanged = false;
            if (msg.field_width && msg.field_width !== oldFW) {
                HP.settings.fieldWidth = msg.field_width;
                HP.FIELD_WIDTH = msg.field_width;
                fieldChanged = true;
            }
            if (msg.field_height && msg.field_height !== oldFH) {
                HP.settings.fieldHeight = msg.field_height;
                HP.FIELD_HEIGHT = msg.field_height;
                fieldChanged = true;
            }
            if (msg.field_goal_width) {
                HP.settings.goalWidth = msg.field_goal_width;
                HP.GOAL_WIDTH = msg.field_goal_width;
            }
            if (fieldChanged) {
                console.log(`[HP] Saha değişti: ${oldFW}x${oldFH} → ${HP.FIELD_WIDTH}x${HP.FIELD_HEIGHT}`);
                if (miniData.fieldConfig) {
                    miniData.fieldConfig.width = HP.FIELD_WIDTH;
                    miniData.fieldConfig.height = HP.FIELD_HEIGHT;
                    miniData.fieldConfig.goal_width = HP.GOAL_WIDTH;
                }
                if (HP.room && HP.room.gameState) {
                    HP.resetPositions();
                    miniData.snapshots = [];
                    miniData.currentPositions = {};
                }
            }
            
            if (oldMatchDuration !== newMatchDuration && oldMatchDuration > 0 && HP.room && HP.room.gameState) {
                const now = performance.now() / 1000;
                HP.room.gameState.match_start = now;
                HP.room.gameState.time_left = newMatchDuration;
                if (HP.room.gameState.state === "paused" && HP.room.gameState.pause_time) {
                    HP.room.gameState.pause_time = now;
                }
                console.log(`[HOST-PHYSICS] Süre gerçekten değişti, maç sıfırlanıyor`);
            }
        }
        
        updateMiniLobby();
        
        const gameScreen = document.getElementById("miniGameScreen");
        if (gameScreen && !gameScreen.classList.contains("hidden")) {
            startMiniLocalPhysicsIfNeeded();
        }
        
        const pauseBox = document.getElementById("miniPauseLobbyBox");
        if (pauseBox && !pauseBox.classList.contains("hidden")) {
            updateMiniPauseLobby();
        }
        
        const settingsBox = document.getElementById("roomSettingsBox");
        if (settingsBox && !settingsBox.classList.contains("hidden") && miniData.playerId !== 1) {
            openMiniRoomSettings();
        }
        return;
    }
    
    if (msg.type === "mini_new_player_joined_room") {
        showToast("👋 Odaya Katıldı", `${msg.player_name} odaya katıldı!`, null, "success");
        playGlobalSound("player_join.mp3", 0.6);
        
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running) {
            if (HP.room && HP.room.gameState) {
                const stateMsg = Object.assign({}, HP.room.gameState);
                stateMsg.type = "mini_state";
                send({ type: "mini_host_state", state: stateMsg });
            }
        }

        if (miniData.pings) {
            const cleaned = {};
            cleaned[miniData.playerId] = miniData.pings[miniData.playerId] || 0;
            miniData.pings = cleaned;
        }
        updateMiniPingDisplay();
        return;
    }
    
    if (msg.type === "mini_player_left_game") {
        showToast("🚪 Lobiye Döndü", `${msg.player_name} lobiye döndü.`, null, "info");
        playGlobalSound("player_leave.mp3", 0.6);
        return;
    }
    
    if (msg.type === "mini_player_rejoined") {
        showToast("⚽ Oyuna Katıldı", `${msg.player_name} oyuna katıldı!`, null, "success");
        playGlobalSound("player_join.mp3", 0.6);
        return;
    }

    if (msg.type === "mini_opponent_left") {
        const playerName = msg.player_name || "Bir oyuncu";
        showToast("👋 Odadan Ayrıldı", `${playerName} odadan ayrıldı.`, null, "warning");
        playGlobalSound("player_leave.mp3", 0.6);
        
        if (msg.left_player_id) {
            const leftPid = msg.left_player_id;
            console.log(`[MINI] ${playerName} HP'den siliniyor`);
            
            if (miniData.gameState && miniData.gameState.players) {
                delete miniData.gameState.players[String(leftPid)];
            }
            
            if (typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players) {
                delete HP.room.gameState.players[leftPid];
            }
            if (typeof HP !== 'undefined' && HP.running && HP.room?.players) {
                delete HP.room.players[leftPid];
            }
            
            miniData.snapshots = [];
            miniData.currentPositions = {};
        }
        
        const remainingOthers = miniData.players ? 
            miniData.players.filter(p => p.id !== miniData.playerId && p.id !== msg.left_player_id).length : 0;
        
        if (remainingOthers === 0 && miniData.playerId === 1) {
            console.log("[WebRTC] Tüm misafirler ayrıldı, P2P kapatılıyor (host tek başına)");
            MiniRTC.reset();
            if (miniData.pings) {
                miniData.pings = {};
                miniData.pings[miniData.playerId] = 0;
            }
            updateMiniPingDisplay();
            updateMiniConnectionBadge();
        }
        return;
    }
    
    if (msg.type === "mini_settings_changed") {
        if (msg.changes && Array.isArray(msg.changes) && msg.changes.length > 0) {
            showMiniSettingsToast(msg.changes);
        }
        return;
    }
    
    if (msg.type === "mini_player_kicked") {
        showToast("🚫 Oyuncu Atıldı", `${msg.player_name} odadan atıldı`, null, "warning");
        playGlobalSound("player_leave.mp3", 0.6);
        return;
    }
    
    if (msg.type === "mini_team_full") {
        showMiniTeamFullPopup(msg.team, msg.team_name, msg.max_per_team, msg.mode_label);
        return;
    }
    
    if (msg.type === "mini_host_left") {
        console.log("[MINI] Host odadan ayrıldı");
        playGlobalSound("player_leave.mp3", 0.6);
        document.querySelectorAll(".overlay").forEach(o => o.classList.add("hidden"));
        
        if (typeof HP !== 'undefined' && HP.running) HP.stopGame();
        stopMiniGame();
        stopMiniPing();
        hideMiniChat();
        
        inRoom = false;
        miniData.roomCode = "";
        miniData.playerId = null;
        miniData.players = [];
        miniData.gameState = null;
        playerId = null;
        roomCode = "";
        
        showToast("👑 Host Ayrıldı", "Oda kapandı, katıl ekranına yönlendiriliyorsun...", null, "warning");
        
        if (ws) { try { ws.close(); } catch(e) {} }
        setTimeout(() => {
            connectWS();
            showScreen("join");
        }, 500);
        return;
    }
    
    if (msg.type === "mini_set_celebration") {
        const pid = msg.from_pid || msg.player_id;
        if (!miniData.playerCelebrationChoices) miniData.playerCelebrationChoices = {};
        miniData.playerCelebrationChoices[pid] = msg.celebration_type;

        if (miniData.playerId === 1 && typeof HP !== "undefined" && HP.running) {
            HP.applyCelebrationChoice(pid, msg.celebration_type);
        }
        return;
    }

    if (msg.type === "mini_game_started") {
        miniData.playerNames = msg.players;
        miniData.fieldConfig = msg.field;
        
        if (!MiniRTC.connected && miniData.playerId === 1) {
            console.log("[WebRTC] Oyun başladı ama P2P henüz kurulmadı, deniyor...");
            setTimeout(() => {
                if (miniData.players) {
                    miniData.players.forEach(p => {
                        if (p.id !== 1) {
                            MiniRTC.createPeerForGuest(p.id).catch(e => {
                                console.warn(`[WebRTC] Oyuncu ${p.id} için P2P hatası:`, e);
                            });
                        }
                    });
                }
            }, 100);
        }
        miniData.goalTarget = msg.goal_target;
        miniData.matchDuration = msg.match_duration;
        miniData.splitScreen = msg.split_screen || false;
        miniData.splitOwner = msg.split_owner || null;
        miniData.splitSlaveId = msg.split_slave_id || null;
        miniData.activeRedPids = msg.red_pids || (msg.red_pid ? [msg.red_pid] : []);
        miniData.activeBluePids = msg.blue_pids || (msg.blue_pid ? [msg.blue_pid] : []);
        
        miniData.activeRedPids.forEach(pid => {
            const p = miniData.players.find(pl => Number(pl.id) === Number(pid));
            if (p) p.team = "red";
        });
        miniData.activeBluePids.forEach(pid => {
            const p = miniData.players.find(pl => Number(pl.id) === Number(pid));
            if (p) p.team = "blue";
        });
        
        const overBox = document.getElementById("miniGameOverBox");
        if (overBox) overBox.classList.add("hidden");
        
        miniReplay.buffer = [];
        
        const menuBtn = document.getElementById("miniGameOverMenuBtn");
        if (menuBtn) {
            menuBtn.disabled = false;
            menuBtn.textContent = "🚪 Lobiye Dön";
        }
        
        const myPlayer = miniData.players.find(p => p.id === miniData.playerId);
        if (myPlayer && myPlayer.in_lobby && miniData.playerId !== 1) {
            console.log("[MINI] Ben lobide bekliyorum, oyun başlasa bile lobide kalıyorum");
            if (typeof showToast === "function") {
                showToast("⚽ Oyun Başladı", "Sen lobide bekliyorsun. Oyuna katılmak için 'Oyuna Katıl' bas.", null, "info");
            }
            updateMiniLobby();
            return;
        }
        
        showScreen("miniGame");
        startMiniGame();
        return;
    }
    
    if (msg.type === "mini_guest_input") {
        if (typeof HP !== 'undefined' && HP.running) {
            if (msg.from_player_id !== miniData.playerId) {
                HP.setKey(msg.target_pid, msg.key, msg.pressed);
            }
        }
        return;
    }
    
    if (msg.type === "mini_state") {
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running && !msg._local) {
            return;
        }
        
        if (msg.game_state === "playing" || msg.game_state === "countdown") {
            miniData._hasSkippedReplay = false;
        }
        
        miniData.gameState = msg;
        
        const rState = msg;
        const rIsGoalWait = (rState.game_state === "goal_wait" && rState.goal_celebration);
        const rWaitRemaining = rIsGoalWait ? rState.goal_celebration.wait_remaining : 999;
        const rReplayDuration = (rState.goal_celebration && rState.goal_celebration.replay_duration) || 10.0;
        const rLockThreshold = 3.2 + rReplayDuration;
        
        if (rState.game_state === "playing" || (rIsGoalWait && rWaitRemaining > rLockThreshold)) {
            if (rState.game_state === "playing") {
                miniReplay.lockedBuffer = null;
                miniReplay.replayStartTime = 0;
                miniReplay.playedReplayEvents = null;
            }
            const currentFrame = {
                ball: { x: rState.ball.x, y: rState.ball.y, on_fire: rState.ball.on_fire, warning: rState.ball.warning, warning_team: rState.ball.warning_team },
                players: {},
                kick_effects: (rState.kick_effects || []).map(k => ({ ...k })),
                hit_events: (rState.hit_events || []).map(h => ({ ...h })),
                goal_event: rState.goal ? { ...rState.goal, time: Date.now() } : null
            };
            for (const pid in rState.players) {
                const rp = rState.players[pid];
                currentFrame.players[pid] = {
                    x: rp.x,
                    y: rp.y,
                    sprint: rState.sprint?.[pid],
                    celebrating: rp.celebrating || false,
                    celebration_type: rp.celebration_type,
                    celebration_start: rp.celebration_start,
                    celebration_elapsed: rp.celebration_elapsed,
                    trail: rp.trail ? rp.trail.map(t => ({ ...t })) : null
                };
            }
            miniReplay.buffer.push({ t: Date.now(), data: currentFrame });
            const cutoff = Date.now() - (miniReplay.maxDuration || 10000);
            miniReplay.buffer = miniReplay.buffer.filter(f => f.t >= cutoff);
        }
        
        if (rIsGoalWait && rWaitRemaining <= rLockThreshold && !miniReplay.lockedBuffer && miniReplay.buffer.length > 0) {
            miniReplay.lockedBuffer = miniReplay.buffer.slice();
        }
        
        const now_ = performance.now();
        if (miniData.snapshots.length === 0) {
            if (msg.players) {
                for (const pid in msg.players) {
                    miniData.currentPositions["p" + pid] = {
                        x: msg.players[pid].x,
                        y: msg.players[pid].y
                    };
                }
            }
            if (msg.ball) {
                miniData.currentPositions.ball = { x: msg.ball.x, y: msg.ball.y };
            }
        }
        
        const snapshot = {
            t: now_,
            players: {},
            ball: msg.ball ? { x: msg.ball.x, y: msg.ball.y, vx: msg.ball.vx || 0, vy: msg.ball.vy || 0 } : null
        };
        if (msg.players) {
            for (const pid in msg.players) {
                snapshot.players[pid] = {
                    x: msg.players[pid].x,
                    y: msg.players[pid].y
                };
            }
        }
        miniData.snapshots.push(snapshot);
        
        const cutoffSnaps = now_ - 400;
        if (miniData.snapshots.length > 25) {
            miniData.snapshots = miniData.snapshots.filter(s => s.t >= cutoffSnaps);
        }
        return;
    }
    
    if (msg.type === "mini_host_visibility") {
        updateMiniHostVisibilityBadge(msg.hidden);
        return;
    }

    if (msg.type === "mini_game_over") {
        showMiniGameOver(msg);
        return;
    }

    if (msg.type === "mini_chat_typing") {
        if (msg.typing) {
            miniChat.typingPlayers[msg.player_id] = true;
        } else {
            delete miniChat.typingPlayers[msg.player_id];
        }
        return;
    }
    
    if (msg.type === "mini_chat_msg") {
        if (miniChat.typingPlayers[msg.sender_id]) {
            delete miniChat.typingPlayers[msg.sender_id];
        }
        addMiniChatMessage({
            sender_id: msg.sender_id,
            sender_name: msg.sender_name,
            text: msg.text,
            team: msg.team,
            ts: msg.ts
        });
        if (msg.sender_id !== miniData.playerId) {
            playGlobalSound("chat_notify.mp3", 0.6);
        }
        return;
    }

    if (msg.type === "mini_chat_history") {
        if (msg.messages && Array.isArray(msg.messages)) {
            const wasOpen = miniChat.open;
            miniChat.open = true;
            msg.messages.forEach(m => {
                addMiniChatMessage({
                    sender_id: m.sender_id,
                    sender_name: m.sender_name,
                    text: m.text,
                    team: m.team,
                    ts: m.ts,
                    system: m.system || false
                });
            });
            miniChat.open = wasOpen;
            miniChat.unread = 0;
            const badge = document.getElementById("miniChatBadge");
            if (badge) badge.style.display = "none";
        }
        return;
    }
}

// ========================================
// LOCAL HP BAŞLATMA (Host)
// ========================================
function startMiniLocalPhysicsIfNeeded() {
    if (typeof HP === 'undefined') return false;
    if (!miniData.playerId) return false;
    if (!miniData.players || miniData.players.length === 0) return false;

    const isHost = miniData.playerId === 1;
    if (!isHost) {
        if (HP.running) HP.stopGame();
        console.log("[GUEST] Misafir modu: Saf ve pürüzsüz Snapshot Interpolasyonuna geçildi ✓");
        return true;
    }

    if (HP.running) return true;

    const fw = (miniData.fieldConfig && miniData.fieldConfig.width) || miniData.fieldWidth || 1000;
    const fh = (miniData.fieldConfig && miniData.fieldConfig.height) || miniData.fieldHeight || 500;
    const gw = (miniData.fieldConfig && miniData.fieldConfig.goal_width) || miniData.fieldGoalWidth || 180;
    
    let isAdvEnabled = miniData.advancedEnabled || false;
    let advSettings = miniData.advancedSettings || null;
    
    if (!advSettings) {
        try {
            isAdvEnabled = localStorage.getItem("miniAdvancedEnabled") === "true";
            const rawAdv = localStorage.getItem("miniAdvancedSettings");
            if (rawAdv) advSettings = JSON.parse(rawAdv);
        } catch(e) {}
    }

    const settings = {
        goalTarget: miniData.goalTarget,
        matchDuration: miniData.matchDuration,
        gameSpeed: miniData.gameSpeed,
        allowPlase: miniData.allowPlase !== false,
        ballStick: miniData.ballStick !== false,
        sprintEnabled: miniData.sprintEnabled !== false,
        kickoffTimeout: miniData.kickoffTimeout || 10,
        fieldWidth: fw,
        fieldHeight: fh,
        goalWidth: gw,
        advancedEnabled: isAdvEnabled,
        advanced: advSettings
    };

    const playerList = miniData.players.map(p => ({
        id: p.id,
        name: p.name,
        team: p.team,
        is_split_slave: p.is_split_slave || false,
        jersey_number: (miniData.persistentJerseys && miniData.persistentJerseys[p.id] !== undefined) 
            ? miniData.persistentJerseys[p.id] 
            : p.jersey_number
    }));

    HP.onStateUpdate = null;
    HP.onGoal = null;
    HP.onGameOver = null;

    console.log("[HOST-PHYSICS] Host fizik motoru kuruluyor (Sabit 60 FPS Akış)...");
    
    HP.onStateUpdate = (stateMsg) => {
        stateMsg._local = true;
        stateMsg._ts = performance.now();
        
        if (stateMsg.game_state === "goal_wait" && stateMsg.goal_celebration) {
            const _scores = stateMsg.scores ? `${stateMsg.scores["1"]}-${stateMsg.scores["2"]}` : "0-0";
            const _scorerPid = (stateMsg.goal_celebration.scorer_pid !== undefined && stateMsg.goal_celebration.scorer_pid !== null)
                ? stateMsg.goal_celebration.scorer_pid
                : stateMsg.goal_celebration.scorer_id;
            const goalSignature = `${_scorerPid}_${_scores}`;
            const isOwnGoal = stateMsg.goal_celebration.own_goal === true;
            
            if (miniData._lastGoalSigForSeed !== goalSignature) {
                miniData._lastGoalSigForSeed = goalSignature;
                
                let userChoice = (miniData.playerCelebrationChoices && miniData.playerCelebrationChoices[_scorerPid]) || "random";
                if (userChoice === "random") {
                    const celList = ["grow_explode", "rainbow_trail", "spotlight", "frostbite", "smiley_face", "eagle_wings", "snake"];
                    userChoice = celList[Math.floor(Math.random() * celList.length)];
                }
                miniData._hostSelectedCelebrationType = userChoice;
                
                const teamSongs = {
                    besiktas: ["goal_song_1.mp3", "goal_song_10.mp3", "goal_song_11.mp3", "goal_song_12.mp3", "goal_song_17.mp3", "goal_song_21.mp3", "goal_song_29.mp3"],
                    fenerbahce: ["goal_song_3.mp3", "goal_song_4.mp3", "goal_song_5.mp3", "goal_song_22.mp3", "goal_song_30.mp3", "goal_song_32.mp3"],
                    galatasaray: ["goal_song_6.mp3", "goal_song_23.mp3", "goal_song_31.mp3", "goal_song_33.mp3"],
                    trabzonspor: ["goal_song_13.mp3", "goal_song_14.mp3", "goal_song_16.mp3"]
                };

                const assignedSongs = new Set();
                for (const team in teamSongs) {
                    teamSongs[team].forEach(s => assignedSongs.add(s));
                }

                const generalPool = [];
                for (let i = 1; i <= 100; i++) {
                    const songName = `goal_song_${i}.mp3`;
                    if (!assignedSongs.has(songName)) {
                        generalPool.push(songName);
                    }
                }

                const pools = {
                    ...teamSongs,
                    general: generalPool
                };

                let actualScoringTeam = "red";
                const scoringTeamId = Number(stateMsg.goal_celebration.scorer_id);
                const realScorerPid = stateMsg.goal_celebration.scorer_pid;

                const songScorerObj = (realScorerPid !== undefined && realScorerPid !== null)
                    ? miniData.players.find(p => Number(p.id) === Number(realScorerPid))
                    : null;

                if (songScorerObj && (songScorerObj.team === "red" || songScorerObj.team === "blue")) {
                    actualScoringTeam = isOwnGoal
                        ? (songScorerObj.team === "red" ? "blue" : "red")
                        : songScorerObj.team;
                } else if (scoringTeamId === 1 || scoringTeamId === 2) {
                    actualScoringTeam = (scoringTeamId === 2) ? "blue" : "red";
                    if (isOwnGoal) {
                        actualScoringTeam = (actualScoringTeam === "red") ? "blue" : "red";
                    }
                }

                let teamPool = pools.general;
                const currentGoalMusicMode = miniData.goalMusicMode || "team";
                
                if (currentGoalMusicMode === "mixed") {
                    const allSongs = [];
                    for (const key in pools) {
                        pools[key].forEach(s => {
                            if (!allSongs.includes(s)) allSongs.push(s);
                        });
                    }
                    teamPool = allSongs;
                } else {
                    let teamName = actualScoringTeam === "red" ? miniData.redTeamName : miniData.blueTeamName;
                    if (teamName) {
                        const n = teamName.trim().toLowerCase();
                        if (["beşiktaş", "besiktas", "bjk"].includes(n)) teamPool = pools.besiktas;
                        else if (["galatasaray", "gs"].includes(n)) teamPool = pools.galatasaray;
                        else if (["fenerbahçe", "fenerbahce", "fb"].includes(n)) teamPool = pools.fenerbahce;
                        else if (["trabzonspor", "ts"].includes(n)) teamPool = pools.trabzonspor;
                    }
                }

                let availableSongs = teamPool;
                if (teamPool.length > 1 && miniData._lastPlayedSong) {
                    availableSongs = teamPool.filter(s => s !== miniData._lastPlayedSong);
                }
                
                const selectedSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];
                miniData._hostSelectedSong = selectedSong;
                miniData._lastPlayedSong = selectedSong;
            }
            
            stateMsg.goal_celebration.selected_song = miniData._hostSelectedSong;
            stateMsg.goal_celebration.celebration_type = isOwnGoal ? null : miniData._hostSelectedCelebrationType;
            
            if (stateMsg.players && stateMsg.players[_scorerPid]) {
                stateMsg.players[_scorerPid].celebrating = !isOwnGoal;
                stateMsg.players[_scorerPid].celebration_type = isOwnGoal ? null : miniData._hostSelectedCelebrationType;
            }
        } else {
            miniData._lastGoalSigForSeed = null;
            miniData._hostSelectedSong = null;
            miniData._hostSelectedCelebrationType = null;
        }

        handleMiniMessage(stateMsg);

        const cleanState = Object.assign({}, stateMsg);
        delete cleanState._local;
        
        let p2pSent = false;
        if (MiniRTC.connected) {
            p2pSent = MiniRTC.sendMessage(cleanState);
        }
        
        const otherPlayers = miniData.players ? miniData.players.filter(p => p.id !== 1) : [];
        const connectedP2PCount = Object.values(MiniRTC.peers || {}).filter(p => p.connected).length;
        
        if (!p2pSent || connectedP2PCount < otherPlayers.length) {
            send({ type: "mini_host_state", state: cleanState });
        }
    };

    HP.onGameOver = (winData) => {
        handleMiniMessage(winData);
        send({ type: "mini_host_state", state: winData });
    };

    HP.startGame(settings, playerList);
    return true;
}

// ========================================
// 🎮 GAME LIFECYCLE (START / STOP)
// ========================================
function startMiniGame() {
    console.log("[MINI] Oyun başladı! Player ID:", miniData.playerId, "Split:", miniData.splitScreen);
    
    try {
        MiniAudio.preloadAll();
        MiniAudio.unlock();
        setTimeout(() => {
            MiniAudio.unlock();
            MiniAudio.preloadAll();
        }, 100);
    } catch (e) {}

    try { document.body.classList.add("mini-game-active"); } catch (e) {}
    try {
        const list = getCelebPickerList();
        let savedPref = localStorage.getItem("miniPreferredCelebration");
        if (!savedPref && list.length > 0) savedPref = list[0].id;
        
        miniData.preferredCelebration = savedPref;
        const idx = list.findIndex(c => c.id === savedPref);
        const resolvedIdx = idx >= 0 ? idx : 0;
        
        miniData.celebPickerIndex = resolvedIdx;
        miniData.celebVirtualIndex = resolvedIdx;

        applyPreferredCelebration(savedPref);
        setTimeout(() => {
            if (miniData.preferredCelebration) {
                applyPreferredCelebration(miniData.preferredCelebration);
            }
        }, 350);
    } catch (e) {}
    
    if (!miniData.iceImage) {
        miniData.iceImage = new Image();
        miniData.iceImage.src = "/oyun_modlari/mini_futbol/ice_surface.jpg";
    }
    miniData.keysPressed = {};
    miniData.keysPressed2 = {};
    miniData._ownGoalsTracker = {}; 
    miniData._teamOwnGoalsCount = { red: 0, blue: 0 }; 
    miniData._teamPostHits = { red: 0, blue: 0 }; 

    document.querySelectorAll("footer, .footer, #footer, .site-footer").forEach(el => {
        el.style.setProperty("display", "none", "important");
    });
    
    if (miniData.playerId === 1) {
        if (!miniData._keepAliveAudio) {
            try {
                const silentWav = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
                const audioEl = new Audio(silentWav);
                audioEl.loop = true;
                audioEl.volume = 0.001;
                audioEl.play().catch(() => {});

                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                let ctxObj = null;
                if (AudioCtx) {
                    const ctx = new AudioCtx();
                    const oscillator = ctx.createOscillator();
                    const gainNode = ctx.createGain();
                    gainNode.gain.value = 0.000001;
                    oscillator.connect(gainNode);
                    gainNode.connect(ctx.destination);
                    oscillator.frequency.value = 1;
                    oscillator.start();
                    
                    const keepAliveInterval = setInterval(() => {
                        if (ctx.state === 'suspended') ctx.resume();
                    }, 1000);
                    ctxObj = { ctx, oscillator, interval: keepAliveInterval };
                }
                
                miniData._keepAliveAudio = { audioEl, webAudio: ctxObj };
                console.log("[HOST-PHYSICS] Sekme Canlı Tutma Zırhı Aktif ✓");
            } catch(e) {}
        }
    }
    
    startMiniLocalPhysicsIfNeeded();
    updateMiniHUD();
    
    window.addEventListener("keydown", miniKeyDown, true);
    window.addEventListener("keyup", miniKeyUp, true);
    MiniMobileInput.init();
    
    if (miniGamepad.connected && miniGamepad.enabled) {
        startGamepadPolling();
    }
    
    window.addEventListener("contextmenu", miniPreventContextMenu, true);
    
    miniData._blurHandler = () => {
        miniReleaseAllKeys();
        miniTabHeld = false;
        hideMiniScoreboard();
        if (miniScoreboardInterval) {
            clearInterval(miniScoreboardInterval);
            miniScoreboardInterval = null;
        }
    };
    miniData._visibilityHandler = () => {
        if (document.hidden) {
            miniReleaseAllKeys();
            miniTabHeld = false;
            hideMiniScoreboard();
            if (miniScoreboardInterval) {
                clearInterval(miniScoreboardInterval);
                miniScoreboardInterval = null;
            }
        }
        if (miniData.playerId === 1) {
            send({ type: "mini_host_visibility", hidden: document.hidden });
        }
    };
    
    window.addEventListener("blur", miniData._blurHandler, true);
    window.addEventListener("focusout", miniData._blurHandler, true);
    document.addEventListener("visibilitychange", miniData._visibilityHandler, true);
    
    miniData._mouseLeaveHandler = (e) => {
        if (!e.relatedTarget && !e.toElement) {
            miniReleaseAllKeys();
        }
    };
    document.documentElement.addEventListener("mouseleave", miniData._mouseLeaveHandler, true);
    
    miniData._focusCheckInterval = setInterval(() => {
        if (!document.hasFocus()) {
            miniReleaseAllKeys();
        }
    }, 500);
    
    updateMiniControlsInfo();
    
    if (miniAnimFrame) cancelAnimationFrame(miniAnimFrame);
    miniAnimFrame = requestAnimationFrame(miniRender);
    
    miniData.predictionActive = false;
    miniData.predictedSelf = null;
}

function stopMiniGame() {
    window.removeEventListener("keydown", miniKeyDown, true);
    window.removeEventListener("keyup", miniKeyUp, true);
    window.removeEventListener("contextmenu", miniPreventContextMenu, true);
    
    MiniMobileInput.destroy();
    
    if (miniData._blurHandler) {
        window.removeEventListener("blur", miniData._blurHandler, true);
        window.removeEventListener("focusout", miniData._blurHandler, true);
        miniData._blurHandler = null;
    }
    if (miniData._visibilityHandler) {
        document.removeEventListener("visibilitychange", miniData._visibilityHandler, true);
        miniData._visibilityHandler = null;
    }
    
    if (miniData._mouseLeaveHandler) {
        document.documentElement.removeEventListener("mouseleave", miniData._mouseLeaveHandler, true);
        miniData._mouseLeaveHandler = null;
    }
    if (miniData._focusCheckInterval) {
        clearInterval(miniData._focusCheckInterval);
        miniData._focusCheckInterval = null;
    }
    
    if (miniAnimFrame) {
        cancelAnimationFrame(miniAnimFrame);
        miniAnimFrame = null;
    }
    miniReleaseAllKeys();
    miniData.keysPressed = {};
    miniData.keysPressed2 = {};
    
    if (typeof HP !== 'undefined') {
        HP.onStateUpdate = null;
        HP.onGoal = null;
        HP.onGameOver = null;
        if (HP.running) HP.stopGame();
    }
    
    if (miniData._keepAliveAudio) {
        try {
            if (miniData._keepAliveAudio.audioEl) {
                miniData._keepAliveAudio.audioEl.pause();
                miniData._keepAliveAudio.audioEl.src = "";
            }
            if (miniData._keepAliveAudio.webAudio) {
                clearInterval(miniData._keepAliveAudio.webAudio.interval);
                miniData._keepAliveAudio.webAudio.oscillator.stop();
                miniData._keepAliveAudio.webAudio.ctx.close();
            }
        } catch(e) {}
        miniData._keepAliveAudio = null;
    }
    
    stopGamepadPolling();
    
    if (typeof MiniVibration !== "undefined") {
        MiniVibration.stop();
    }
    
    MiniRTC.reset();
    console.log("[WebRTC] Bağlantı kapatıldı.");
    
    const badge = document.getElementById("miniConnBadge");
    if (badge) badge.style.display = "none";
    
    const hostBadge = document.getElementById("miniHostVisibilityBadge");
    if (hostBadge) hostBadge.style.display = "none";
    
    if (miniData._canvasClickHandler) {
        window.removeEventListener("click", miniData._canvasClickHandler, true);
        miniData._canvasClickHandler = null;
    }
    
    miniData.predictionActive = false;
    miniData.predictedSelf = null;
    miniData.predictedKeys = {up:false, down:false, left:false, right:false, sprint:false};
    
    miniData._renderSmoothed = {};
    miniData._ballRenderPos = null;
    miniData._hostRenderSmoothed = null;

    try {
        document.body.classList.remove("mini-game-active");
        closeCelebPicker(true);
    } catch (e) {}

    document.querySelectorAll("footer, .footer, #footer, .site-footer").forEach(el => {
        el.style.removeProperty("display");
    });
}

console.log("Mini Futbol - Ana Giriş Motoru yüklendi ✓");