// ==========================================
// 🌐 WEBRTC MANAGER (Çoklu Oyuncu P2P - Star Mesh)
// ==========================================
const MiniRTC = {
    peers: {},          // { targetPid: { pc, channel, connected } }
    connected: false,   // Genel P2P durumu
    isHost: false,
    
    config: {
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" }
        ]
    },

    // Host: Belirli bir misafir oyuncu için P2P tüneli aç
    async createPeerForGuest(targetPid) {
        if (miniData.playerId !== 1) return;
        if (this.peers[targetPid] && this.peers[targetPid].connected) return;

        console.log(`[WebRTC] Host: Oyuncu ${targetPid} için P2P bağlantısı başlatılıyor...`);
        this.isHost = true;

        if (this.peers[targetPid]) {
            this.closePeer(targetPid);
        }

        const pc = new RTCPeerConnection(this.config);
        const channel = pc.createDataChannel(`mini_${targetPid}`, {
            ordered: false,
            maxRetransmits: 0
        });

        const peerObj = { pc, channel, connected: false, pid: targetPid };
        this.peers[targetPid] = peerObj;

        this._setupChannel(channel, targetPid);

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                send({
                    type: "mini_webrtc_ice",
                    target_pid: targetPid,
                    candidate: e.candidate
                });
            }
        };

        pc.onconnectionstatechange = () => {
            console.log(`[WebRTC] Oyuncu ${targetPid} durum:`, pc.connectionState);
            if (pc.connectionState === "connected") {
                peerObj.connected = true;
                this.updateOverallStatus();
                console.log(`[WebRTC] ✅ Oyuncu ${targetPid} ile P2P kuruldu!`);
            } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
                peerObj.connected = false;
                this.updateOverallStatus();
                console.log(`[WebRTC] ❌ Oyuncu ${targetPid} P2P koptu.`);
            }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        send({
            type: "mini_webrtc_offer",
            target_pid: targetPid,
            offer: offer
        });
    },

    // Misafir: Host'tan gelen offer'ı al
    async handleOffer(fromPid, offer) {
        console.log(`[WebRTC] Misafir: Host'tan (${fromPid}) offer alındı...`);
        this.isHost = false;
        this.reset();

        const pc = new RTCPeerConnection(this.config);
        const peerObj = { pc, channel: null, connected: false, pid: fromPid };
        this.peers[fromPid] = peerObj;

        pc.ondatachannel = (e) => {
            console.log("[WebRTC] Host DataChannel yakalandı");
            peerObj.channel = e.channel;
            this._setupChannel(e.channel, fromPid);
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                send({
                    type: "mini_webrtc_ice",
                    target_pid: fromPid,
                    candidate: e.candidate
                });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === "connected") {
                peerObj.connected = true;
                this.updateOverallStatus();
                console.log("[WebRTC] ✅ Host ile P2P bağlantı kuruldu!");
            } else if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
                peerObj.connected = false;
                this.updateOverallStatus();
            }
        };

        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        send({
            type: "mini_webrtc_answer",
            target_pid: fromPid,
            answer: answer
        });
    },

    async handleAnswer(fromPid, answer) {
        if (this.peers[fromPid] && this.peers[fromPid].pc) {
            await this.peers[fromPid].pc.setRemoteDescription(answer);
        }
    },

    async handleIce(fromPid, candidate) {
        if (this.peers[fromPid] && this.peers[fromPid].pc && candidate) {
            try {
                await this.peers[fromPid].pc.addIceCandidate(candidate);
            } catch(e) {}
        }
    },

    _setupChannel(channel, peerPid) {
        channel.onopen = () => {
            console.log(`[WebRTC] Peer ${peerPid} DataChannel AÇIK!`);
            if (this.peers[peerPid]) this.peers[peerPid].connected = true;
            this.updateOverallStatus();
        };

        channel.onclose = () => {
            if (this.peers[peerPid]) this.peers[peerPid].connected = false;
            this.updateOverallStatus();
        };

        channel.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);

                if (msg.type === "mini_ping_p2p") {
                    this.sendMessageToPeer(peerPid, { type: "mini_pong_p2p", ts: msg.ts });
                    return;
                }

                if (msg.type === "mini_pong_p2p") {
                    const rtt = Date.now() - msg.ts;
                    if (!miniData.pings) miniData.pings = {};
                    miniData.pings[miniData.playerId] = rtt;
                    send({ type: "mini_ping_report", ping: rtt });
                    updateMiniPingDisplay();
                    return;
                }

                // HOST: Misafirden gelen tuş girdisini işle
                if (miniData.playerId === 1 && msg.type === "mini_key") {
                    const targetPid = msg.from_player_id || peerPid;
                    if (targetPid && typeof HP !== 'undefined' && HP.running) {
                        HP.setKey(targetPid, msg.key, msg.pressed);
                    }
                    return;
                }

                // ✨ HOST: Misafirden P2P üzerinden gelen "Skip" (Atla) komutunu işle
                if (miniData.playerId === 1 && msg.type === "mini_skip_replay") {
                    if (typeof HP !== 'undefined' && HP.running) {
                        HP.registerSkip(msg.from_pid || peerPid);
                    }
                    return;
                }

                if (miniData.playerId === 1 && msg.type === "mini_set_celebration") {
                    if (typeof HP !== 'undefined' && HP.running) {
                        HP.applyCelebrationChoice(msg.from_pid || peerPid, msg.celebration_type);
                    }
                    return;
                }

                // ✨ HOST: Sevinç seçimi (1/2)
                if (miniData.playerId === 1 && msg.type === "mini_set_celebration") {
                    if (typeof HP !== 'undefined' && HP.running) {
                        HP.applyCelebrationChoice(msg.from_pid || peerPid, msg.celebration_type);
                    }
                    return;
                }

                // MİSAFİR: Host'tan gelen oyun durumunu işle
                if (miniData.playerId !== 1 && msg.type === "mini_state") {
                    handleMiniMessage(msg);
                    return;
                }

                handleMiniMessage(msg);
            } catch(err) {}
        };
    },

    // Host tüm bağlı misafirlere durum (state) gönderir
    sendMessage(data) {
        let sentAny = false;
        const jsonStr = JSON.stringify(data);

        for (const pid in this.peers) {
            const p = this.peers[pid];
            if (p.connected && p.channel && p.channel.readyState === "open") {
                try {
                    p.channel.send(jsonStr);
                    sentAny = true;
                } catch(e) {}
            }
        }

        if (!sentAny && miniData.playerId !== 1) {
            send(data); // Fallback: WS
        }
        return sentAny;
    },

    sendMessageToPeer(targetPid, data) {
        if (this.peers[targetPid] && this.peers[targetPid].connected && this.peers[targetPid].channel) {
            try {
                this.peers[targetPid].channel.send(JSON.stringify(data));
                return true;
            } catch(e) {}
        }
        send(data);
        return false;
    },

    updateOverallStatus() {
        let anyConnected = false;
        for (const pid in this.peers) {
            if (this.peers[pid].connected) {
                anyConnected = true;
                break;
            }
        }
        this.connected = anyConnected;
        if (typeof updateMiniConnectionBadge === "function") {
            updateMiniConnectionBadge();
        }
    },

    closePeer(pid) {
        if (this.peers[pid]) {
            try { this.peers[pid].channel.close(); } catch(e) {}
            try { this.peers[pid].pc.close(); } catch(e) {}
            delete this.peers[pid];
        }
        this.updateOverallStatus();
    },

    reset() {
        for (const pid in this.peers) {
            this.closePeer(pid);
        }
        this.peers = {};
        this.connected = false;
        this.isHost = false;
        this.updateOverallStatus();
    }
};

// ========================================
// MİNİ FUTBOL - FRONTEND
// ========================================

let miniData = {
    roomCode: "",
    playerId: null,
    players: [],
    goalTarget: 3,
    matchDuration: 180,
    gameSpeed: "normal",
    playerCount: 2,  // ✨ Default 1v1
    spectatorCount: 0,  // ✨ Default izleyici yok
    redTeamName: "Kırmızı Takım",
    blueTeamName: "Mavi Takım",
    redTeamColor: "#ff6b6b",
    blueTeamColor: "#4dabf7",
    redSprintColor: "#ffd43b",
    blueSprintColor: "#ffd43b",
    splitScreen: false,
    splitOwner: null,        // ✨ Split sahibi (playerId 1)
    splitSlaveId: null,      // ✨ Split'in 2. oyuncu ID'si
    keysPressed2: {},        // ✨ P2 için ayrı tuş takibi (split-screen)
    // Oyun state
    playerNames: {},
    fieldConfig: null,
    gameState: null,
    keysPressed: {},
    currentPositions: {},
    targetPositions: {},
    // ✨ SNAPSHOT INTERPOLATION - Server jitter'ı yok etmek için
    snapshots: [],           // {t: timestamp, players: {pid: {x,y}}, ball: {x,y}}
    interpDelay: 50,         // ✨ 50ms buffer: ağ jitter'ını yutar, akıcılık artar (hâlâ düşük gecikme)
    serverTimeOffset: null,  // İlk paket geldiğinde ayarlanır
    // ✨ PING sistemi
    pings: {},           // {playerId: ping_ms}
    pingInterval: null,  // setInterval handle
    lastPingSent: 0,
    
    // ✨ CLIENT-SIDE PREDICTION (misafir için)
    predictedSelf: null,     // {x, y, vx, vy} - kendi karakterimin tahmini pozisyonu
    predictedKeys: {up:false, down:false, left:false, right:false, sprint:false},
    predictionActive: false, // Sadece misafirse aktif olur
    iceImage: null, // ❄️ Buz dokusu resmi
    persistentJerseys: (() => {
        try {
            const saved = localStorage.getItem("miniPersistentJerseys");
            return saved ? JSON.parse(saved) : {};
        } catch(e) { return {}; }
    })(),
    // ✨ GOL VİDEOSU KAYDEDİCİ
    isExportingVideo: false,
    audioBuffers: {},
    // 🎉 Gol sevinci seçici (1/2)
    celebPickerOpen: false,
    celebPickerIndex: 0,
    preferredCelebration: (() => {
        try {
            return localStorage.getItem("miniPreferredCelebration") || null;
        } catch (e) { return null; }
    })(),
    // 🎵 Gol Müziği Modu: "team" (takıma göre) veya "mixed" (karışık)
    goalMusicMode: (() => {
        try {
            return localStorage.getItem("miniGoalMusicMode") || "team";
        } catch (e) { return "team"; }
    })(),
    // 🎭 Oyuncuların anlık gol sevinci tercihleri tablosu
    playerCelebrationChoices: {}
};

let miniAnimFrame = null;

// ✨ Kalıcı forma numaralarını sunucudan gelen listeye giydirme yardımcısı
function syncPersistentJerseys() {
    if (!miniData.players || !miniData.persistentJerseys) return;
    miniData.players.forEach(p => {
        const savedNum = miniData.persistentJerseys[String(p.id)];
        if (savedNum !== undefined) {
            p.jersey_number = savedNum;
        }
    });
}

// 🎆 BALON PATLAMA & YIRTILAN LASTİK PARTİKÜL SİSTEMİ
function triggerPlayerExplosion(x, y, teamColor) {
    if (!miniData.celebrationParticles) miniData.celebrationParticles = [];
    
    const colors = [teamColor, "#ffffff", shadeHexColor(teamColor, 0.3), shadeHexColor(teamColor, -0.3)];
    const particleCount = 55;
    
    // 1) Yırtılan Balon Lastiği Parçacıkları (Rubbers & Confetti)
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 15;
        miniData.celebrationParticles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 5 + Math.random() * 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1.0,
            decay: 0.018 + Math.random() * 0.02,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.4,
            type: "rubber_shard"
        });
    }
    
    // 2) Şok Dalgası Halkası (Shockwave Ring)
    miniData.celebrationParticles.push({
        x: x,
        y: y,
        radius: 10,
        maxRadius: 110,
        color: teamColor,
        alpha: 1.0,
        decay: 0.04,
        type: "ring"
    });
    
    // Ses ve Titreşim efekti
    MiniAudio.play("explosion.mp3", 0.9); // Yeni patlama sesi
    MiniVibration.firekick();
}

function updateAndDrawCelebrationParticles(ctx) {
    if (!miniData.celebrationParticles || miniData.celebrationParticles.length === 0) return;
    
    ctx.save();
    for (let i = miniData.celebrationParticles.length - 1; i >= 0; i--) {
        const pt = miniData.celebrationParticles[i];
        
        if (pt.type === "ring") {
            pt.radius += 5;
            pt.alpha -= pt.decay;
            if (pt.alpha <= 0 || pt.radius >= pt.maxRadius) {
                miniData.celebrationParticles.splice(i, 1);
                continue;
            }
            ctx.strokeStyle = pt.color;
            ctx.globalAlpha = Math.max(0, pt.alpha);
            ctx.lineWidth = 4;
            ctx.shadowBlur = 15;
            ctx.shadowColor = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.vx *= 0.94;
            pt.vy *= 0.94;
            pt.alpha -= pt.decay;
            pt.size *= 0.96;
            
            if (pt.alpha <= 0 || pt.size <= 0.5) {
                miniData.celebrationParticles.splice(i, 1);
                continue;
            }
            
            ctx.save();
            ctx.translate(pt.x, pt.y);
            if (pt.type === "rubber_shard") {
                pt.rot += pt.rotSpeed;
                ctx.rotate(pt.rot);
                ctx.fillStyle = pt.color;
                ctx.globalAlpha = Math.max(0, pt.alpha);
                ctx.shadowBlur = 8;
                ctx.shadowColor = pt.color;
                // Yırtık balon parçası (düzensiz elastik şekil)
                ctx.beginPath();
                ctx.ellipse(0, 0, pt.size, pt.size * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = pt.color;
                ctx.globalAlpha = Math.max(0, pt.alpha);
                ctx.shadowBlur = 10;
                ctx.shadowColor = pt.color;
                ctx.beginPath();
                ctx.arc(0, 0, pt.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }
    ctx.restore();
}

// ========================================
// 🎥 REPLAY SİSTEMİ (v10 Özel - 10 Saniye Tamponlu)
// ========================================
let miniReplay = {
    buffer: [],          // Frame kayıtları
    lockedBuffer: null,  // Gol anında dondurulan klip
    replayStartTime: 0,  // Replay başlangıç zamanı
    maxDuration: 10000   // 10 saniyelik net tampon (8.2sn gol öncesi + 1.8sn gol sonrası)
};

// 🔊 Global ses çalma yardımcısı (mlVolumeRange uyumlu)
function playGlobalSound(name, volMultiplier = 1) {
    let vol = 0.5;
    const volRange = document.getElementById("mlVolumeRange");
    if (volRange) {
        vol = parseFloat(volRange.value);
        if (isNaN(vol)) vol = 0.5;
    }
    const audio = new Audio(`/static/sounds/${name}`);
    audio.volume = Math.max(0, Math.min(1, vol * volMultiplier));
    audio.play().catch(e => console.warn("[MINI SOUND] Ses çalınamadı:", e));
}

// ========================================
// 💬 CHAT SİSTEMİ
// ========================================
let miniChat = {
    open: false,
    unread: 0,
    messages: [],    // {sender_id, sender_name, text, team, ts}
    maxMessages: 50,
    typingPlayers: {},  // {playerId: true} - şu an yazan oyuncular
    lastTypingSent: 0    // spam engeli
};

// ✨ Drag & Drop state
let miniDragPlayerId = null;
let miniDragFromTeam = null;

// ========================================
// 🎮 GAMEPAD DESTEĞİ
// ========================================
let miniGamepad = {
    connected: false,      // Kontrolcü bağlı mı
    index: -1,             // navigator.getGamepads() içindeki index
    name: "",              // Kontrolcü adı
    slot: "off",           // "off" / "p1" / "p2"
    pollInterval: null,    // Polling loop handle
    enabled: true          // ✨ Kullanıcı tarafından etkinleştirilmiş mi (default: true)
};

// ✨ localStorage'dan enabled durumunu oku
function loadGamepadEnabled() {
    try {
        const saved = localStorage.getItem("miniGamepadEnabled");
        if (saved !== null) miniGamepad.enabled = (saved !== "false");
    } catch(e) {}
}

function saveGamepadEnabled() {
    try {
        localStorage.setItem("miniGamepadEnabled", miniGamepad.enabled ? "true" : "false");
    } catch(e) {}
}

// Sayfa yüklendiğinde oku
loadGamepadEnabled();

function initGamepadListeners() {
    // Kontrolcü takıldığında
    window.addEventListener("gamepadconnected", (e) => {
        console.log(`[GAMEPAD] Bağlandı: ${e.gamepad.id} (index: ${e.gamepad.index})`);
        miniGamepad.connected = true;
        miniGamepad.index = e.gamepad.index;
        miniGamepad.name = e.gamepad.id;
        miniGamepad.slot = "p1";
        updateGamepadUI();
        
        // ✨ Oyun ekranındaysa VE kullanıcı etkinleştirmişse polling'i başlat
        if (miniGamepad.enabled) {
            const gameScreen = document.getElementById("miniGameScreen");
            if (gameScreen && !gameScreen.classList.contains("hidden")) {
                startGamepadPolling();
            }
        }
    });
    
    // Kontrolcü çıkarıldığında
    window.addEventListener("gamepaddisconnected", (e) => {
        console.log(`[GAMEPAD] Ayrıldı: ${e.gamepad.id}`);
        if (e.gamepad.index === miniGamepad.index) {
            miniGamepad.connected = false;
            miniGamepad.index = -1;
            miniGamepad.name = "";
            miniGamepad.slot = "off";
            stopGamepadPolling();
            updateGamepadUI();
        }
    });
    
    // Sayfa yüklendiğinde zaten takılıysa algıla
    checkExistingGamepads();
}

function checkExistingGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let found = false;
    for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) {
            miniGamepad.connected = true;
            miniGamepad.index = pads[i].index;
            miniGamepad.name = pads[i].id;
            miniGamepad.slot = "p1";  // ✨ Otomatik P1
            console.log(`[GAMEPAD] Kontrolcü hazır: ${pads[i].id} (P1)`);
            found = true;
            break;
        }
    }
    
    // ✨ Hiç kontrolcü yoksa sıfırla
    if (!found && miniGamepad.connected) {
        miniGamepad.connected = false;
        miniGamepad.index = -1;
        miniGamepad.name = "";
        miniGamepad.slot = "off";
        stopGamepadPolling();
    }
    
    updateGamepadUI();
}

function updateGamepadUI() {
    const section = document.getElementById("miniGamepadSection");
    if (section) {
        // ✨ Split-Screen kaldırıldı, bu section artık kullanılmıyor
        section.classList.add("hidden");
    }
    // Kısayol tuşları güncel
    updateKeyBindingsUI();
}

function updateKeyBindingsUI() {
    const p1TextEl = document.getElementById("miniKeyP1Text");
    const p2Div = document.getElementById("miniKeyP2");
    
    if (!p1TextEl) return;
    
    // P1 kısayolları (klavye + gamepad birlikte)
    if (miniGamepad.connected) {
        p1TextEl.innerHTML = `⌨️ <b>Klavye</b>: WASD | Space | Shift &nbsp;+&nbsp; 🎮 <b>Kontrolcü</b>: Stick | X/Kare | R2`;
    } else {
        p1TextEl.innerHTML = `⌨️ <b>Klavye</b>: WASD hareket | Space şut | Sol Shift sprint`;
    }
    
    // P2 alanını komple gizle (split-screen kaldırıldı)
    if (p2Div) p2Div.classList.add("hidden");
}

// ========================================
// 🎮 GAMEPAD INPUT OKUMA (polling)
// ========================================

// Önceki tuş state (basıldı/bırakıldı algılamak için)
let gpPrevState = {
    up: false, down: false, left: false, right: false,
    kick: false, sprint: false,
    start: false, select: false,  // ✨ START (ESC) ve SELECT (TAB)
    l1: false, r1: false
};

const GP_DEADZONE = 0.25;  // Analog stick ölü bölge

function startGamepadPolling() {
    if (miniGamepad.pollInterval) return;
    // Her 30ms (33 FPS) kontrolcüyü oku
    miniGamepad.pollInterval = setInterval(pollGamepad, 30);
    console.log("[GAMEPAD] Polling başladı");
}

function stopGamepadPolling() {
    if (miniGamepad.pollInterval) {
        clearInterval(miniGamepad.pollInterval);
        miniGamepad.pollInterval = null;
        console.log("[GAMEPAD] Polling durdu");
        // Tüm gamepad tuşlarını bırak
        releaseAllGamepadKeys();
    }
}

function releaseAllGamepadKeys() {
    // Aktif tüm gamepad tuşlarını bırak
    ["up", "down", "left", "right", "kick", "sprint"].forEach(key => {
        if (gpPrevState[key]) {
            sendGamepadKey(key, false);
            gpPrevState[key] = false;
        }
    });
    // ✨ start/select durum flagsları sıfırla (event simülasyonu olduğu için send yok)
    gpPrevState.start = false;
    gpPrevState.select = false;
}

function pollGamepad() {
    if (!miniGamepad.connected) return;
    if (!miniGamepad.enabled) return;  // ✨ Kullanıcı kapatmış
    
    // Oyun ekranında değilsek gönderme
    const gameScreen = document.getElementById("miniGameScreen");
    if (!gameScreen || gameScreen.classList.contains("hidden")) return;
    
    // Kontrolcüyü oku
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[miniGamepad.index];
    if (!pad) return;
    
    // Replay modunda mıyız kontrol et
    const gc = miniData.gameState && miniData.gameState.goal_celebration;
    const rDurationK = (gc && gc.replay_duration) || 10.0;
    const isReplayMode = miniData.gameState &&
        miniData.gameState.game_state === "goal_wait" &&
        gc &&
        typeof gc.wait_remaining === "number" &&
        gc.wait_remaining <= rDurationK;

    // === START (Button 9) → Replay'de ENTER (Atla), Normalde ESC gibi davran ===
    const btnStart = pad.buttons[9] && pad.buttons[9].pressed;
    if (btnStart && !gpPrevState.start) {
        gpPrevState.start = true;
        if (isReplayMode) {
            // ENTER keydown event simüle et (Atlama tetiklensin)
            const enterEvent = new KeyboardEvent("keydown", {
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                which: 13,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(enterEvent);
            console.log("[GAMEPAD] START → ENTER (Replay Atla)");
        } else {
            // ESC keydown event simüle et
            const escEvent = new KeyboardEvent("keydown", {
                key: "Escape",
                code: "Escape",
                keyCode: 27,
                which: 27,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(escEvent);
            console.log("[GAMEPAD] START → ESC");
        }
    } else if (!btnStart && gpPrevState.start) {
        gpPrevState.start = false;
    }
    
    // === L1 (Button 4) & R1 (Button 5) → Gol Sevinci Değiştirme (1 ve 2 tuşları) ===
    const btnL1 = pad.buttons[4] && pad.buttons[4].pressed;
    const btnR1 = pad.buttons[5] && pad.buttons[5].pressed;
    
    if (btnL1 && !gpPrevState.l1) {
        gpPrevState.l1 = true;
        handleCelebPickerKey(-1);
        console.log("[GAMEPAD] L1 → Sevinç Sola (1)");
    } else if (!btnL1) {
        gpPrevState.l1 = false;
    }
    
    if (btnR1 && !gpPrevState.r1) {
        gpPrevState.r1 = true;
        handleCelebPickerKey(1);
        console.log("[GAMEPAD] R1 → Sevinç Sağa (2)");
    } else if (!btnR1) {
        gpPrevState.r1 = false;
    }

    // === SELECT (Button 8) → TAB gibi davran (basılı tutulunca skorboard) ===
    const btnSelect = pad.buttons[8] && pad.buttons[8].pressed;
    if (btnSelect && !gpPrevState.select) {
        gpPrevState.select = true;
        // TAB keydown event
        const tabEvent = new KeyboardEvent("keydown", {
            key: "Tab",
            code: "Tab",
            keyCode: 9,
            which: 9,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(tabEvent);
        console.log("[GAMEPAD] SELECT basıldı → TAB");
    } else if (!btnSelect && gpPrevState.select) {
        gpPrevState.select = false;
        // TAB keyup event
        const tabUpEvent = new KeyboardEvent("keyup", {
            key: "Tab",
            code: "Tab",
            keyCode: 9,
            which: 9,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(tabUpEvent);
        console.log("[GAMEPAD] SELECT bırakıldı → TAB kapandı");
    }
    
    // Pause popup veya Replay açıkken hareket/şut gönderme
    const pauseBox = document.getElementById("miniPauseLobbyBox");
    if (pauseBox && !pauseBox.classList.contains("hidden")) return;
    if (isReplayMode) return;
    
    // === HAREKET (Sol stick + D-Pad) ===
    let leftX = pad.axes[0] || 0;
    let leftY = pad.axes[1] || 0;
    
    // D-Pad butonları (standart mapping)
    const dpadUp    = pad.buttons[12] && pad.buttons[12].pressed;
    const dpadDown  = pad.buttons[13] && pad.buttons[13].pressed;
    const dpadLeft  = pad.buttons[14] && pad.buttons[14].pressed;
    const dpadRight = pad.buttons[15] && pad.buttons[15].pressed;
    
    // D-Pad varsa stick'i override et
    if (dpadUp) leftY = -1;
    else if (dpadDown) leftY = 1;
    if (dpadLeft) leftX = -1;
    else if (dpadRight) leftX = 1;
    
    // Deadzone uygula
    const up    = leftY < -GP_DEADZONE;
    const down  = leftY > GP_DEADZONE;
    const left  = leftX < -GP_DEADZONE;
    const right = leftX > GP_DEADZONE;
    
    // === ŞUT (X = 0, Kare = 2) ===
    const btnX      = pad.buttons[0] && pad.buttons[0].pressed;   // Cross/A
    const btnSquare = pad.buttons[2] && pad.buttons[2].pressed;   // Square/X
    const kick = btnX || btnSquare;
    
    // === SPRINT (R2=7, L2=6) ===
    const btnR2 = pad.buttons[7] && pad.buttons[7].pressed;
    const btnL2 = pad.buttons[6] && pad.buttons[6].pressed;
    const sprint = btnR2 || btnL2;
    
    // === Değişimleri backend'e gönder ===
    const newState = { up, down, left, right, kick, sprint };
    
    for (const key in newState) {
        if (newState[key] !== gpPrevState[key]) {
            sendGamepadKey(key, newState[key]);
            gpPrevState[key] = newState[key];
        }
    }
}

function sendGamepadKey(key, pressed) {
    // ✨ Gamepad her zaman kendi oyuncumuza gider (P1 = klavye ile aynı)
    const msg = { type: "mini_key", key: key, pressed: pressed };
    const targetPid = miniData.playerId;
    
    // Local HP'ye bildir (host + misafir)
    if (typeof HP !== 'undefined' && HP.running) {
        HP.setKey(targetPid, key, pressed);
    }
    
    send(msg);
}

// Sayfa yüklendiğinde gamepad listener'larını başlat
setTimeout(() => {
    initGamepadListeners();
}, 200);

function clearMiniDropHighlights() {
    const ids = [
        "miniRedColumn", "miniSpecColumn", "miniBlueColumn",
        "miniPauseRedCol", "miniPauseSpecCol", "miniPauseBlueCol"
    ];
    
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.style.backgroundColor = "";
    });
}

function setupMiniDropZone(container, teamKey) {
    if (!container) return;
    
    container.style.minHeight = "72px";
    container.title = miniData.playerId === 1 ? "Oyuncuyu buraya sürükleyip bırak" : "";
    
    container.ondragover = (e) => {
        if (miniData.playerId !== 1 || !miniDragPlayerId) return;
        
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        
        clearMiniDropHighlights();
        container.style.outline = "2px dashed #ffd43b";
        container.style.outlineOffset = "4px";
        container.style.backgroundColor = "rgba(255, 212, 59, 0.08)";
    };
    
    container.ondrop = (e) => {
        if (miniData.playerId !== 1 || !miniDragPlayerId) return;
        
        e.preventDefault();
        
        const targetId = miniDragPlayerId;
        const fromTeam = miniDragFromTeam;
        
        miniDragPlayerId = null;
        miniDragFromTeam = null;
        clearMiniDropHighlights();
        
        if (!targetId || fromTeam === teamKey) return;
        
        console.log(`[MINI DND] Oyuncu ${targetId}: ${fromTeam} → ${teamKey}`);
        movePlayer(targetId, teamKey);
    };
    
    container.ondragleave = (e) => {
        const nextEl = e.relatedTarget;
        if (nextEl && container.contains(nextEl)) return;
        
        container.style.outline = "";
        container.style.outlineOffset = "";
        container.style.backgroundColor = "";
    };
}

function setupMiniDraggableRow(row, playerObj, teamKey) {
    if (!row || !playerObj) return;
    
    if (miniData.playerId !== 1) {
        row.draggable = false;
        row.style.cursor = "";
        row.title = "";
        return;
    }
    
    // ✨ Lobide bekleyen oyuncu sürüklenemez
    if (playerObj.in_lobby) {
        row.draggable = false;
        row.style.cursor = "not-allowed";
        row.style.opacity = "0.6";
        row.title = "Bu oyuncu lobide bekliyor, oyuna dönmesini bekleyin";
        return;
    }
    
    row.draggable = true;
    row.style.cursor = "grab";
    row.title = `${playerObj.name} oyuncusunu sürükle`;
    
    row.ondragstart = (e) => {
        miniDragPlayerId = playerObj.id;
        miniDragFromTeam = teamKey;
        
        row.style.opacity = "0.6";
        row.style.transform = "scale(0.98)";
        
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(playerObj.id));
        }
    };
    
    row.ondragend = () => {
        row.style.opacity = "";
        row.style.transform = "";
        miniDragPlayerId = null;
        miniDragFromTeam = null;
        clearMiniDropHighlights();
    };
}

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
    
    // ✨ KICK edildim - her ekrandan ana menüye at
    if (msg.type === "kick_blocked") {
        console.log("[MINI] Bu odadan atıldım!");
        
        // Tüm popup'ları kapat
        document.querySelectorAll(".overlay").forEach(o => o.classList.add("hidden"));
        
        // HP fizik motorunu durdur (varsa)
        if (typeof HP !== 'undefined' && HP.running) {
            HP.stopGame();
        }
        
        // Oyunu durdur
        stopMiniGame();
        
        // Mini data sıfırla
        inRoom = false;
        miniData.roomCode = "";
        miniData.playerId = null;
        miniData.players = [];
        
        // WS bağlantısı zaten backend tarafında kapanmış, yenile
        if (typeof ws !== "undefined" && ws) {
            try { ws.close(); } catch(e) {}
        }
        setTimeout(() => {
            if (typeof connectWS === "function") connectWS();
        }, 300);
        
        // Kick popup göster
        const kickBox = document.getElementById("kickBlockedBox");
        if (kickBox) {
            kickBox.classList.remove("hidden");
        }
        
        // Ana ekrana dön
        showScreen("home");
        return;
    }
    
    // ✨ PAUSE/RESUME mesajları
    if (msg.type === "mini_paused") {
        console.log("[MINI] Oyun duraklatıldı");
        
        // ✨ HOST ise HP motorunu da pause et (süre dursun)
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running) {
            HP.pauseGame();
            console.log("[HOST-PHYSICS] HP motoru pause edildi");
        }
        
        // ✨ Host VE kullanıcı → aynı pause lobby popup (butonlar farklı olacak)
        showMiniPauseLobby();
        miniReleaseAllKeys();
        return;
    }
    
    if (msg.type === "mini_resumed") {
        console.log("[MINI] Oyun devam ediyor");
        hideMiniPauseLobby();
        // Kullanıcı ESC menüsü de açıksa kapat
        hideMiniGuestEscMenu();
        // ✨ Tüm popup'ları kapat (eski + yeni)
        const guestBox = document.getElementById("miniGuestPausedBox");
        if (guestBox) guestBox.classList.add("hidden");
        const guestEsc = document.getElementById("miniGuestEscBox");
        if (guestEsc) guestEsc.classList.add("hidden");
        
        // ✨ HOST ise HP motorunu 3-2-1 sayımlı devam ettir
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running) {
            HP.resumeGame();
            console.log("[HOST-PHYSICS] Devam et → 3-2-1 sayımı başlatıldı");
        }
        return;
    }
    
    // ✨ MAÇ YENİDEN BAŞLATILDI
    if (msg.type === "mini_restarted") {
        console.log("[MINI] Maç yeniden başlatıldı");
        miniData._teamOwnGoalsCount = { red: 0, blue: 0 }; // ✨ Maç sıfırlanınca takım own goal sayaçlarını sıfırla
        miniData._lastGoalSignature = null;
        miniData._goalSongPlayed = null;
        
        // ✨ HOST ise HP motorunu da restart et
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running) {
            HP.restartMatch();
            console.log("[HOST-PHYSICS] HP motoru yeniden başlatıldı ✓");
        }
        
        // Pause popup varsa kapat
        hideMiniPauseLobby();
        const guestBox = document.getElementById("miniGuestPausedBox");
        if (guestBox) guestBox.classList.add("hidden");
        hideMiniGuestEscMenu();
        // Toast bildirim
        if (typeof showToast === "function") {
            showToast("🔄 Yeniden Başladı", "Maç sıfırdan başlıyor!", null, "success");
        }
        return;
    }
    
    // ✨ HIZLI PAUSE (P tuşu) - lobby yok, sadece overlay
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
    
	// ✨ Host lobbye döndü - herkes otomatik lobby'e atlasın
    if (msg.type === "mini_returned_to_lobby") {
        console.log("[MINI] Host lobbye döndü, otomatik lobbye geçiliyor...");
        
        // ✨ Countdown sayacı varsa durdur
        stopMiniGameOverCountdown();
        
        // Oyun sonu popup'ı varsa kapat + butonları resetle
        const overBox = document.getElementById("miniGameOverBox");
        if (overBox) overBox.classList.add("hidden");
        
        // Replay kaydını sıfırla
        miniReplay.buffer = [];
        
        // ✨ "Dönülüyor..." takılı kalmasın - butonu resetle
        const menuBtn = document.getElementById("miniGameOverMenuBtn");
        if (menuBtn) {
            menuBtn.disabled = false;
            menuBtn.textContent = "🏠 Lobiye Dön";
        }
        const rematchBtn = document.getElementById("miniRematchBtn");
        if (rematchBtn) {
            rematchBtn.disabled = false;
        }
        
        // ✨ Kullanıcının duraklatıldı ekranını kapat
        const guestPausedBox = document.getElementById("miniGuestPausedBox");
        if (guestPausedBox) guestPausedBox.classList.add("hidden");
        
        // Kullanıcı ESC menüsü de açıksa kapat
        hideMiniGuestEscMenu();
        
        // Pause popup varsa kapat
        hideMiniPauseLobby();
        hideMiniQuickPauseOverlay();
        
        // Oyun döngüsünü durdur
        stopMiniGame();
        
        // Lobby'e geç
        showScreen("miniLobby");
        updateMiniLobby();
        return;
    }
    
    if (msg.type === "mini_active_players_changed") {
        // Aktif oyuncular değişti (pause sırasında takım değişikliği)
        miniData.playerNames = msg.players;
        console.log("[MINI] Aktif oyuncular güncellendi", msg);

        // ✨ Takım değiştiren oyuncuların takım bilgisini ön bellekte da anında güncelle
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
        
        // ✨ Interpolation pozisyonlarını temizle (eski oyuncuların hayaleti kalmasın)
        miniData.currentPositions = {};
        miniData.targetPositions = {};
        
        // ✨ Snapshot buffer'ı temizle (eski oyuncunun hayaleti kalmasın)
        miniData.snapshots = [];
        
        // ✨ Render smoothing state'ini de temizle
        miniData._renderSmoothed = {};
        miniData._ballRenderPos = null;
        
        // ✨ Ayrılan oyuncu varsa HP'den ve game_state'ten sil
        if (msg.removed_pid) {
            const removedPid = msg.removed_pid;
            console.log(`[MINI] Ayrılan oyuncu ${removedPid} HP'den siliniyor`);
            
            // Frontend game state
            if (miniData.gameState && miniData.gameState.players) {
                delete miniData.gameState.players[String(removedPid)];
            }
            
            // HP motoru
            if (typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players) {
                delete HP.room.gameState.players[removedPid];
            }
            if (typeof HP !== 'undefined' && HP.running && HP.room?.players) {
                delete HP.room.players[removedPid];
            }
        }
        
        // ✨ HOST ise HP motoruna da yeni oyuncuları bildir
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running) {
            const newRedPid = msg.red_pid;
            const newBluePid = msg.blue_pid;
            
            if (HP.room && HP.room.gameState) {
                const gs = HP.room.gameState;
                const oldRedPid = HP.room.active_red_player;
                const oldBluePid = HP.room.active_blue_player;
                
                // Değişiklik var mı?
                if (newRedPid !== oldRedPid || newBluePid !== oldBluePid) {
                    console.log(`[HOST-PHYSICS] Aktif oyuncular değişti: Red ${oldRedPid}→${newRedPid}, Blue ${oldBluePid}→${newBluePid}`);
                    
                    // Eski oyuncuları HP'den sil (yeni takımlarda değilse)
                    const playersToRemove = [];
                    for (const pid in gs.players) {
                        const pidInt = parseInt(pid);
                        if (pidInt !== newRedPid && pidInt !== newBluePid) {
                            playersToRemove.push(pidInt);
                        }
                    }
                    for (const pid of playersToRemove) {
                        delete gs.players[pid];
                    }
                    
                    // Yeni kırmızı oyuncu ekle VEYA mevcut oyuncuyu kırmızıya taşı
                    const _spawnR = HP.FIELD_WIDTH * 0.2;
                    if (newRedPid) {
                        if (!gs.players[newRedPid]) {
                            // Yeni oyuncu ekle
                            gs.players[newRedPid] = {
                                x: _spawnR, y: HP.FIELD_HEIGHT / 2,
                                vx: 0, vy: 0,
                                keys: { up: false, down: false, left: false, right: false, kick: false, sprint: false },
                                last_kick_time: 0,
                                sprint_energy: HP.SPRINT_MAX_ENERGY,
                                last_frame_time: 0,
                                team: "red"
                            };
                        } else {
                            // ✨ Zaten var olan oyuncuyu kırmızı takım pozisyonuna ışınla
                            gs.players[newRedPid].x = _spawnR;
                            gs.players[newRedPid].y = HP.FIELD_HEIGHT / 2;
                            gs.players[newRedPid].vx = 0;
                            gs.players[newRedPid].vy = 0;
                            gs.players[newRedPid].team = "red";
                        }
                        // room.players'a da ekle/güncelle (stats için)
                        if (!HP.room.players[newRedPid]) {
                            HP.room.players[newRedPid] = {
                                name: msg.players[String(newRedPid)] || "P" + newRedPid,
                                team: "red",
                                goals: 0, assists: 0, passes: 0
                            };
                        } else {
                            HP.room.players[newRedPid].team = "red";
                        }
                    }
                    
                    // Yeni mavi oyuncu ekle VEYA mevcut oyuncuyu maviye taşı
                    const _spawnB = HP.FIELD_WIDTH * 0.2;
                    if (newBluePid) {
                        if (!gs.players[newBluePid]) {
                            gs.players[newBluePid] = {
                                x: HP.FIELD_WIDTH - _spawnB, y: HP.FIELD_HEIGHT / 2,
                                vx: 0, vy: 0,
                                keys: { up: false, down: false, left: false, right: false, kick: false, sprint: false },
                                last_kick_time: 0,
                                sprint_energy: HP.SPRINT_MAX_ENERGY,
                                last_frame_time: 0,
                                team: "blue"
                            };
                        } else {
                            // ✨ Zaten var olan oyuncuyu mavi takım pozisyonuna ışınla
                            gs.players[newBluePid].x = HP.FIELD_WIDTH - _spawnB;
                            gs.players[newBluePid].y = HP.FIELD_HEIGHT / 2;
                            gs.players[newBluePid].vx = 0;
                            gs.players[newBluePid].vy = 0;
                            gs.players[newBluePid].team = "blue";
                        }
                        if (!HP.room.players[newBluePid]) {
                            HP.room.players[newBluePid] = {
                                name: msg.players[String(newBluePid)] || "P" + newBluePid,
                                team: "blue",
                                goals: 0, assists: 0, passes: 0
                            };
                        } else {
                            HP.room.players[newBluePid].team = "blue";
                        }
                    }
                    
                    HP.room.active_red_player = newRedPid;
                    HP.room.active_blue_player = newBluePid;
                    console.log("[HOST-PHYSICS] Aktif oyuncular HP'de güncellendi + pozisyonlar sıfırlandı ✓");
                }
            }
        }
        
        // ✨ ÇOKLU OYUNCU: red_pids ve blue_pids listelerine göre HP'ye tüm oyuncuları ekle
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running && HP.room && HP.room.gameState) {
            const redPids = msg.red_pids || (msg.red_pid ? [msg.red_pid] : []);
            const bluePids = msg.blue_pids || (msg.blue_pid ? [msg.blue_pid] : []);
            const allActivePids = new Set([...redPids, ...bluePids]);
            const gs = HP.room.gameState;
            
            // Aktif olmayan oyuncuları HP'den sil
            for (const pid in gs.players) {
                if (!allActivePids.has(parseInt(pid))) {
                    console.log(`[HP MULTI] Oyuncu ${pid} silindi (takım dışı)`);
                    delete gs.players[pid];
                }
            }
            
            // Y ekseninde dağılım
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
            
            // ✨ YARDIMCI: Mevcut oyuncuların Y pozisyonlarına en uzak Y slot'unu bul
            //           (üst üste binmesin)
            function findBestYSlot(availableYs, existingYs) {
                if (existingYs.length === 0) return availableYs[0];
                // Her aday Y için, mevcut oyunculara en yakın mesafeyi bul
                // → En uzak Y'yi tercih et
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
            
            // ✨ Kırmızı: mevcut oyuncuların Y pozisyonlarını topla
            const existingRedYs = redPids
                .filter(pid => gs.players[pid] && gs.players[pid].team === "red")
                .map(pid => gs.players[pid].y);
            
            // Kırmızı oyuncuları ekle/güncelle
            redPids.forEach((pid, i) => {
                if (!gs.players[pid]) {
                    // ✨ Yeni oyuncu → mevcut oyunculara en uzak Y slot'una koy
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
                    existingRedYs.push(bestY);  // Bir sonraki için hesaba kat
                    console.log(`[HP MULTI] Yeni kırmızı ${pid} → Y=${bestY.toFixed(0)}`);
                } else {
                    // Mevcut oyuncu
                    const oldTeam = gs.players[pid].team;
                    gs.players[pid].team = "red";
                    // Sadece TAKIM DEĞİŞTİYSE pozisyonu sıfırla
                    if (oldTeam !== "red") {
                        const bestY = findBestYSlot(redYs, existingRedYs);
                        gs.players[pid].x = spawnOffset;
                        gs.players[pid].y = bestY;
                        gs.players[pid].vx = 0;
                        gs.players[pid].vy = 0;
                        existingRedYs.push(bestY);
                        console.log(`[HP MULTI] Oyuncu ${pid} ${oldTeam} → red, Y=${bestY.toFixed(0)}`);
                    }
                    // Aynı takımdaysa yerinde kalsın
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
            
            // ✨ Mavi: mevcut oyuncuların Y pozisyonlarını topla
            const existingBlueYs = bluePids
                .filter(pid => gs.players[pid] && gs.players[pid].team === "blue")
                .map(pid => gs.players[pid].y);
            
            // Mavi oyuncuları ekle/güncelle
            bluePids.forEach((pid, i) => {
                if (!gs.players[pid]) {
                    // ✨ Yeni oyuncu → boş slot'a koy
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
        
        // HUD'ı güncelle
        updateMiniHUD();
        return;
    }
    
    // ✨ PING/PONG
    if (msg.type === "mini_pong") {
        // Backend'den gelen timestamp'e göre RTT hesapla
        let rttMs = 0;
        if (typeof msg.ts === "number" && msg.ts > 0) {
            rttMs = Date.now() - msg.ts;
        }
        // Sınırla (0 - 9999 ms)
        if (rttMs < 0) rttMs = 0;
        if (rttMs > 9999) rttMs = 9999;
        
        // Kendi pingimizi backend'e raporla (broadcast için)
        send({ type: "mini_ping_report", ping: rttMs });
        // Kendi ping'imizi hemen ekranda güncelle
        if (!miniData.pings) miniData.pings = {};
        miniData.pings[miniData.playerId] = rttMs;
        updateMiniPingDisplay();
        return;
    }
    
    if (msg.type === "mini_pings_update") {
        // Backend'den güncel ping tablosu
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
        // ✨ Odaya katılırken gelen tüm oyuncu listesini hafızaya kaydet
        if (msg.players && Array.isArray(msg.players)) {
            miniData.players = msg.players;
            syncPersistentJerseys(); // ✨ Kalıcı numaraları giydir
        }
        inRoom = true;
        playerId = msg.player_id;
        
        // ✨ Ping'i başlat
        startMiniPing();
        
        // 🔊 Oda oluşturulunca / katılınca giriş sesi (static/sounds konumundan)
        playGlobalSound("player_join.mp3", 0.6);
        
        // ✨ Oyun devam ediyorsa direkt oyun ekranına git (izleyici olarak)
        if (msg.mid_game) {
            console.log("[MINI] Oyun devam ediyor, izleyici olarak katılıyorum...");
            
            // Field config, oyuncu listesi ve takım isimlerini tam kaydet
            if (msg.players && Array.isArray(msg.players)) miniData.players = msg.players;
            if (msg.field) miniData.fieldConfig = msg.field;
            if (msg.red_team_name) miniData.redTeamName = msg.red_team_name;
            if (msg.blue_team_name) miniData.blueTeamName = msg.blue_team_name;
            miniData.splitScreen = msg.split_screen || false;
            miniData.splitOwner = msg.split_owner || null;
            miniData.splitSlaveId = msg.split_slave_id || null;
            
            // Anlık oyun durumu geldiyse kaydet (boş ekranı önler)
            if (msg.game_state) miniData.gameState = msg.game_state;
            
            // ✨ Yeniden katılan oyuncunun donmuş önbelleğini tamamen sıfırla
            miniData.snapshots = [];
            miniData.currentPositions = {};
            miniData.targetPositions = {};
            miniData._renderSmoothed = {};
            miniData._hostRenderSmoothed = null;
            
            // Oyun ekranına git
            showScreen("miniGame");
            startMiniGame();
            
            // ✨ Pause aktifse pause popup'ı da aç
            if (msg.is_paused) {
                console.log("[MINI] Oyun pause'da, pause lobby açılıyor...");
                setTimeout(() => {
                    showMiniPauseLobby();
                }, 200);
            }
            return;
        }
        
        // Normal katılış - lobby ekranı
        showScreen("miniLobby");
        return;
    }
    
    if (msg.type === "mini_lobby_update") {
        // 💬 Chat'i göster (odadaysa her zaman görünmeli)
        showMiniChat();
        
        // ✨ Çoklu P2P: Odaya giren HER misafir için P2P Tüneli Başlat
        if (miniData.playerId === 1 && msg.players) {
            msg.players.forEach(p => {
                if (p.id !== 1) {
                    MiniRTC.createPeerForGuest(p.id);
                }
            });
        }
        
        // ✨ Host (player_id=1) listede yoksa → kullanıcı için oda kapandı, katıl ekranına at
        const hasHost = msg.players && msg.players.some(p => Number(p.id) === 1);
        if (!hasHost && miniData.playerId !== 1 && inRoom) {
            console.log("[MINI] Host odadan ayrıldı, katıl ekranına gidiyorum...");
            
            // Temizle
            if (typeof HP !== 'undefined' && HP.running) HP.stopGame();
            if (typeof stopMiniGame === "function") stopMiniGame();
            if (typeof stopMiniPing === "function") stopMiniPing();
            
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
        syncPersistentJerseys(); // ✨ Kalıcı numaraları giydir
        miniData.goalTarget = msg.goal_target;
        miniData.matchDuration = msg.match_duration;
        miniData.gameSpeed = msg.game_speed || "normal";
        miniData.redTeamName = msg.red_team_name || "Kırmızı Takım";
        miniData.blueTeamName = msg.blue_team_name || "Mavi Takım";

        // ✨ Takım renklerini otomatik çöz (Hazır takım veya localStorage senkronizasyonu)
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

        // ✨ Eğer Host isek ve sunucudan gelen renk varsayılan kalmışsa öz renkleri sunucuya anında senkronize et
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
        // 🎵 Gol müziği modu (sunucudan geliyorsa kullan, yoksa localStorage)
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
        // ✨ player_count her zaman güncelle (default 2)
        miniData.playerCount = msg.player_count || 2;
        // ✨ İzleyici sayısı
        if (msg.spectator_count !== undefined) miniData.spectatorCount = msg.spectator_count;
        // ✨ Santra süresi
        miniData.kickoffTimeout = msg.kickoff_timeout || 10;
        // ✨ Saha boyutları (backend'den gelir)
        if (msg.field_width) miniData.fieldWidth = msg.field_width;
        if (msg.field_height) miniData.fieldHeight = msg.field_height;
        if (msg.field_goal_width) miniData.fieldGoalWidth = msg.field_goal_width;
        // ✨ fieldConfig'i de güncelle (render için)
        if (msg.field_width && miniData.fieldConfig) {
            miniData.fieldConfig.width = msg.field_width;
            miniData.fieldConfig.height = msg.field_height;
            miniData.fieldConfig.goal_width = msg.field_goal_width;
        }
        if (msg.split_owner !== undefined) miniData.splitOwner = msg.split_owner;
        if (msg.split_slave_id !== undefined) miniData.splitSlaveId = msg.split_slave_id;
        console.log("[MINI DEBUG] lobby_update: playerCount =", miniData.playerCount, "msg:", msg.player_count);
        
        // ✨ SENKRON: Backend'den gelen ayarları localStorage'a otomatik kaydet
        // (Oda kurma ekranı bir sonraki açılışta bu değerleri alır)
        // Sadece host için (kullanıcının ayarları etkilenmesin)
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
                
                // Gelişmişteki özgür değerler (dakika olarak)
                const raw = localStorage.getItem("miniAdvancedSettings");
                const advDict = raw ? JSON.parse(raw) : {};
                advDict._advGoalTarget = miniData.goalTarget;
                // Süre dakikaya çevir
                advDict._advMatchDurationMin = (miniData.matchDuration >= 99999) ? 9999 : Math.round(miniData.matchDuration / 60);
                localStorage.setItem("miniAdvancedSettings", JSON.stringify(advDict));
            } catch(e) {}
        }
        
        // ✨ HOST ise HP motoruna ayarları da bildir (oyun içi ayar değişikliği)
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
            // ✨ Saha boyutları (lobby'de player_count değişirse)
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
            // ✨ Saha değiştiyse: oyuncuları sığdır, topu ortala, canvas güncelle
            if (fieldChanged) {
                console.log(`[HP] Saha değişti: ${oldFW}x${oldFH} → ${HP.FIELD_WIDTH}x${HP.FIELD_HEIGHT}`);
                // Canvas fieldConfig'i güncelle (render için)
                if (miniData.fieldConfig) {
                    miniData.fieldConfig.width = HP.FIELD_WIDTH;
                    miniData.fieldConfig.height = HP.FIELD_HEIGHT;
                    miniData.fieldConfig.goal_width = HP.GOAL_WIDTH;
                }
                // Oyuncuları yeni sahaya ışınla (santra pozisyonuna)
                if (HP.room && HP.room.gameState) {
                    HP.resetPositions();
                    // Snapshot'ları temizle (eski pozisyonlar kalmasın)
                    miniData.snapshots = [];
                    miniData.currentPositions = {};
                }
            }
            
            // ✨ Süre GERÇEKTEN değiştiyse VE oyun playing/countdown/paused değil,
            // yani sadece lobby'den gerçek ayar değişiminde sıfırla
            // (pause sonrası aynı süre geliyor ama sıfırlanmasın)
            if (oldMatchDuration !== newMatchDuration && oldMatchDuration > 0 && HP.room && HP.room.gameState) {
                const now = performance.now() / 1000;
                HP.room.gameState.match_start = now;
                HP.room.gameState.time_left = newMatchDuration;
                if (HP.room.gameState.state === "paused" && HP.room.gameState.pause_time) {
                    HP.room.gameState.pause_time = now;
                }
                console.log(`[HOST-PHYSICS] Süre gerçekten değişti (${oldMatchDuration}→${newMatchDuration}), maç baştan başlıyor`);
            } else {
                console.log(`[HOST-PHYSICS] Ayarlar güncellendi (süre değişmedi: ${oldMatchDuration}=${newMatchDuration})`);
            }
        }
        
        updateMiniLobby();
        
        // ✨ Misafir için local HP'yi başlatmayı dene (eğer oyun ekranındaysa)
        const gameScreen = document.getElementById("miniGameScreen");
        if (gameScreen && !gameScreen.classList.contains("hidden")) {
            startMiniLocalPhysicsIfNeeded();
        }
        
        // ✨ Pause lobby açıksa onu da güncelle
        const pauseBox = document.getElementById("miniPauseLobbyBox");
        if (pauseBox && !pauseBox.classList.contains("hidden")) {
            updateMiniPauseLobby();
        }
        
        // ✨ Oda Ayarları popup açıksa (kullanıcı için canlı güncelleme)
        const settingsBox = document.getElementById("roomSettingsBox");
        if (settingsBox && !settingsBox.classList.contains("hidden") && miniData.playerId !== 1) {
            // Popup'ı kapat ve yeniden aç (güncel değerlerle)
            openMiniRoomSettings();
        }
        return;
    }
    
    // Yeni oyuncu katıldı (oyun içi - eski mesaj, artık kullanılmıyor ama kalsın)
    if (msg.type === "mini_player_joined") {
        showToast("🎮 Oyuna Katıldı", `${msg.player_name} oyuna dahil oldu!`, null, "success");
        return;
    }
    
    // ✨ Yeni biri odaya katıldı (oyunda VEYA lobide - fark etmez)
    if (msg.type === "mini_new_player_joined_room") {
        showToast("👋 Odaya Katıldı", `${msg.player_name} odaya katıldı!`, null, "success");
        playGlobalSound("player_join.mp3", 0.6); // 🔊 Katılma Sesi (static/sounds konumundan)
        
        // ✨ Host isek ve oyun aktifse: Yeni katılan oyuncunun boş saha görmemesi için anlık state yayınla
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running) {
            if (HP.room && HP.room.gameState) {
                const stateMsg = Object.assign({}, HP.room.gameState);
                stateMsg.type = "mini_state";
                send({ type: "mini_host_state", state: stateMsg });
            }
        }

        // Ping'i temizle (yeni ölçüm başlasın)
        if (miniData.pings) {
            const cleaned = {};
            cleaned[miniData.playerId] = miniData.pings[miniData.playerId] || 0;
            miniData.pings = cleaned;
        }
        updateMiniPingDisplay();
        
        return;
    }
    
    // ✨ Oyuncu oyundan çıkıp lobiye döndü (ESC menüsünden "Lobiye Dön" diyerek)
    if (msg.type === "mini_player_left_game") {
        showToast("🚪 Lobiye Döndü", `${msg.player_name} lobiye döndü.`, null, "info");
        playGlobalSound("player_leave.mp3", 0.6); // 🔊 Ayrılma Sesi (static/sounds konumundan)
        return;
    }
    
    // ✨ Oyuncu lobiden oyuna geri döndü (Oyuna Katıl butonu)
    if (msg.type === "mini_player_rejoined") {
        showToast("⚽ Oyuna Katıldı", `${msg.player_name} oyuna katıldı!`, null, "success");
        playGlobalSound("player_join.mp3", 0.6); // 🔊 Katılma Sesi (static/sounds konumundan)
        return;
    }

    // ✨ Bir oyuncu tamamen odadan/sayfadan ayrıldı (Disconnect)
    if (msg.type === "mini_opponent_left") {
        const playerName = msg.player_name || "Bir oyuncu";
        showToast("👋 Odadan Ayrıldı", `${playerName} odadan ayrıldı.`, null, "warning");
        playGlobalSound("player_leave.mp3", 0.6); // 🔊 Ayrılma Sesi (static/sounds konumundan)
        
        // ✨ HP'den ve game state'ten sil (hayalet kalmasın)
        if (msg.left_player_id) {
            const leftPid = msg.left_player_id;
            console.log(`[MINI] ${playerName} (id=${leftPid}) HP'den siliniyor`);
            
            if (miniData.gameState && miniData.gameState.players) {
                delete miniData.gameState.players[String(leftPid)];
            }
            
            if (typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players) {
                delete HP.room.gameState.players[leftPid];
            }
            if (typeof HP !== 'undefined' && HP.running && HP.room?.players) {
                delete HP.room.players[leftPid];
            }
            
            // Snapshot'ları temizle
            miniData.snapshots = [];
            miniData.currentPositions = {};
        }
        
        // ✨ Bu ayrılan bendim değilse ve odada kimse kalmadıysa WebRTC'yi kapat
        // (Yeni misafir katılınca tekrar kurulacak)
        const remainingOthers = miniData.players ? 
            miniData.players.filter(p => p.id !== miniData.playerId && p.id !== msg.left_player_id).length : 0;
        
        if (remainingOthers === 0 && miniData.playerId === 1) {
            console.log("[WebRTC] Tüm misafirler ayrıldı, P2P kapatılıyor (host tek başına)");
            MiniRTC.reset();
            
            // Ping'i sıfırla
            if (miniData.pings) {
                miniData.pings = {};
                miniData.pings[miniData.playerId] = 0;
            }
            updateMiniPingDisplay();
            updateMiniConnectionBadge();
        }
        
        return;
    }
	
	// ✨ Host ayarları değiştirdi - tek toast'ta alt alta göster
    if (msg.type === "mini_settings_changed") {
        if (msg.changes && Array.isArray(msg.changes) && msg.changes.length > 0) {
            showMiniSettingsToast(msg.changes);
        }
        return;
    }
    
    // ✨ Oyuncu odadan atıldı
    if (msg.type === "mini_player_kicked") {
        showToast("🚫 Oyuncu Atıldı", `${msg.player_name} odadan atıldı`, null, "warning");
        playGlobalSound("player_leave.mp3", 0.6); // 🔊 Ayrılma Sesi (static/sounds konumundan)
        return;
    }
    
    // ✨ Takım dolu - özel popup
    if (msg.type === "mini_team_full") {
        showMiniTeamFullPopup(msg.team, msg.team_name, msg.max_per_team, msg.mode_label);
        return;
    }
    
    // ✨ Host ayrıldı - kullanıcıyı katıl ekranına at
    if (msg.type === "mini_host_left") {
        console.log("[MINI] Host odadan ayrıldı");
        
        // 🔊 Host (Admin) çıktığı için ayrılma sesini çal (static/sounds konumundan)
        playGlobalSound("player_leave.mp3", 0.6);
        
        // Tüm popup'ları kapat
        document.querySelectorAll(".overlay").forEach(o => o.classList.add("hidden"));
        
        // HP fizik motorunu durdur (host değilim ama garanti)
        if (typeof HP !== 'undefined' && HP.running) {
            HP.stopGame();
        }
        
        // Oyunu durdur
        if (typeof stopMiniGame === "function") stopMiniGame();
        
        // Ping durdur
        stopMiniPing();
        
        // Chat gizle
        hideMiniChat();
        
        // Mini data sıfırla
        inRoom = false;
        miniData.roomCode = "";
        miniData.playerId = null;
        miniData.players = [];
        miniData.gameState = null;
        playerId = null;
        roomCode = "";
        
        // Toast göster
        showToast("👑 Host Ayrıldı", "Oda kapandı, katıl ekranına yönlendiriliyorsun...", null, "warning");
        
        // WS yenile + katıl ekranına git
        if (ws) {
            try { ws.close(); } catch(e) {}
        }
        setTimeout(() => {
            connectWS();
            showScreen("join");
        }, 500);
        
        return;
    }
    
    // 🎉 Gol sevinci seçimi (1/2) — host HP'ye uygular
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
        
        // ✨ WebRTC zaten lobby'de kurulmuş olmalı, ama garanti için tekrar dene
        if (!MiniRTC.connected && miniData.playerId === 1) {
            console.log("[WebRTC] Oyun başladı ama P2P henüz kurulmadı, deniyor...");
            setTimeout(() => {
                // ✨ Host: Odadaki tüm misafirler için P2P bağlantısını tetikle
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
        // ✨ Split-screen bilgileri
        miniData.splitScreen = msg.split_screen || false;
        miniData.splitOwner = msg.split_owner || null;
        miniData.splitSlaveId = msg.split_slave_id || null;
        // ✨ TÜM aktif oyuncular (çoklu oyuncu için)
        miniData.activeRedPids = msg.red_pids || (msg.red_pid ? [msg.red_pid] : []);
        miniData.activeBluePids = msg.blue_pids || (msg.blue_pid ? [msg.blue_pid] : []);
        
        // ✨ HP'nin doğru playerList'le başlaması için miniData.players'ı sync et
        // Aktif oyunculara takım bilgisini zorla ata (backend'ten miniData.players spectator olabilir)
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
        
        // Replay kaydını sıfırla
        miniReplay.buffer = [];
        
        // ✨ Buton state'ini resetle
        const menuBtn = document.getElementById("miniGameOverMenuBtn");
        if (menuBtn) {
            menuBtn.disabled = false;
            menuBtn.textContent = "🚪 Lobiye Dön";
        }
        
        // ✨ Ben in_lobby (lobide bekleyen) misafirsem → oyuna girme, lobide kal
        const myPlayer = miniData.players.find(p => p.id === miniData.playerId);
        if (myPlayer && myPlayer.in_lobby && miniData.playerId !== 1) {
            console.log("[MINI] Ben lobide bekliyorum, oyun başlasa bile lobide kalıyorum");
            // Lobide kal, sadece bilgi ver
            if (typeof showToast === "function") {
                showToast("⚽ Oyun Başladı", "Sen lobide bekliyorsun. Oyuna katılmak için 'Oyuna Katıl' bas.", null, "info");
            }
            // Lobby update göster (lobide kal)
            updateMiniLobby();
            return;
        }
        
        showScreen("miniGame");
        startMiniGame();
        return;
    }
    
    // ✨ Rakip veya misafir tuşu → Her iki taraf da kendi HP'sine işlesin
    if (msg.type === "mini_guest_input") {
        if (typeof HP !== 'undefined' && HP.running) {
            // Eğer bu tuş zaten benimse (ben gönderdiysem) tekrar işleme (zaten keyDown'da işledik)
            if (msg.from_player_id !== miniData.playerId) {
                HP.setKey(msg.target_pid, msg.key, msg.pressed);
            }
        }
        return;
    }
    
    if (msg.type === "mini_state") {
        // ✨ HOST ise backend'den gelen state'i YOKSAY
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running && !msg._local) {
            return;
        }
        
        // ✨ Maç normale döndüğünde skip bayrağını kesin olarak sıfırla
        if (msg.game_state === "playing" || msg.game_state === "countdown") {
            miniData._hasSkippedReplay = false;
        }
        
        miniData.gameState = msg;
        
        // ✨ ARKA PLAN SEKME BUG FIX (Replay Kaydı Buraya Taşındı!)
        // Sekme arka plandayken bile soket mesajları geldiği için kayıt kusursuz alınır.
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
        // 1.8 saniye dolunca kaydı kilitle (Dinamik baraj)
        if (rIsGoalWait && rWaitRemaining <= rLockThreshold && !miniReplay.lockedBuffer && miniReplay.buffer.length > 0) {
            miniReplay.lockedBuffer = miniReplay.buffer.slice();
        }
        
        // ✨ MİSAFİR: HP'yi server state'ine yaklaştır (reconciliation)
        // Sadece kendi karakterimi hariç tut (kendi karakterimde tam prediction istiyoruz)
        if (miniData.playerId !== 1 && typeof HP !== 'undefined' && HP.running &&
            HP.room && HP.room.gameState) {
            const lgs = HP.room.gameState;
            const sgs = msg;
            
            // ✨ Rakip oyuncuları HP'ye çekme: sadece çok büyük farkta snap
            // (Rakipler artık interpolation'dan çiziliyor, HP sadece fizik için)
            if (sgs.players && lgs.players) {
                for (const pid in sgs.players) {
                    const pidInt = parseInt(pid);
                    if (pidInt === miniData.playerId) continue;
                    if (!lgs.players[pidInt]) continue;
                    
                    const sp = sgs.players[pid];
                    const lp = lgs.players[pidInt];
                    const dx = sp.x - lp.x;
                    const dy = sp.y - lp.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 150) {
                        // Çok uzak → snap (teleport / takım değişimi)
                        lp.x = sp.x;
                        lp.y = sp.y;
                    }
                    // Geri kalan farklar render'ı etkilemiyor
                    // çünkü rakipler artık interpolation buffer'dan çiziliyor
                }
                
                // ✨ Kendi karakterim: SADECE ciddi ayrışmada müdahale et
                // Küçük farkları yoksay → input lag hissi olmasın
                const myPid = miniData.playerId;
                if (sgs.players[myPid] && lgs.players[myPid]) {
                    const sme = sgs.players[myPid];
                    const lme = lgs.players[myPid];
                    const dx = sme.x - lme.x;
                    const dy = sme.y - lme.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 200) {
                        // Sadece BÜYÜK ayrışmada snap (teleport/hile önleme)
                        lme.x = sme.x;
                        lme.y = sme.y;
                        console.log("[RECONCILE] Kendi karakter snap edildi, fark:", dist.toFixed(1));
                    }
                    // 200px altına HİÇ dokunma → misafir kendi HP'sinde tam kontrol
                }
            }
            
            // ✨ Top reconciliation - 4 durum:
            //   a) Şut prediction ilk 300ms → HP tam kontrol (sadece hızı al)
            //   b) Şut sonrası smooth geçiş 700ms → yavaş yavaş server'a yaklaş
            //   c) Ben top sürüyorum → HP pozisyon kontrol
            //   d) Uzakta → server otoriter
            if (sgs.ball && lgs.ball) {
                const dx = sgs.ball.x - lgs.ball.x;
                const dy = sgs.ball.y - lgs.ball.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const nowMs = performance.now();
                
                // Ben topa yakın mıyım? (hysteresis)
                let iAmNearBall = false;
                const myLocalPlayer = lgs.players[miniData.playerId];
                if (myLocalPlayer) {
                    const pdx = lgs.ball.x - myLocalPlayer.x;
                    const pdy = lgs.ball.y - myLocalPlayer.y;
                    const pdist = Math.sqrt(pdx*pdx + pdy*pdy);
                    
                    const wasNear = miniData._wasNearBall === true;
                    if (wasNear) {
                        iAmNearBall = pdist < 90;
                    } else {
                        iAmNearBall = pdist < 50;
                    }
                    miniData._wasNearBall = iAmNearBall;
                }
                
                // ✨ Şut prediction aktif mi?
                const shotPredicting = miniData._shotPredictionUntil && 
                                       nowMs < miniData._shotPredictionUntil;
                // ✨ Şut sonrası smooth geçiş süresi (prediction bitince 700ms)
                const shotSmoothing = miniData._shotPredictionUntil && 
                                      nowMs >= miniData._shotPredictionUntil &&
                                      nowMs < miniData._shotPredictionUntil + 700;
                
                if (shotPredicting) {
                    // Şut prediction: HP kontrolde ama orta düzeyde çekiş
                    if (dist > 200) {
                        // Büyük fark → snap
                        lgs.ball.x = sgs.ball.x;
                        lgs.ball.y = sgs.ball.y;
                    } else if (dist > 5) {
                        // Orta fark → yavaş yaklaş (fizik ayrışması düzelsin)
                        lgs.ball.x += dx * 0.15;
                        lgs.ball.y += dy * 0.15;
                    }
                    // Hızlar server'a %30 yaklaş (fizik senkron kalsın)
                    if (typeof sgs.ball.vx === "number") {
                        lgs.ball.vx += (sgs.ball.vx - lgs.ball.vx) * 0.3;
                    }
                    if (typeof sgs.ball.vy === "number") {
                        lgs.ball.vy += (sgs.ball.vy - lgs.ball.vy) * 0.3;
                    }
                    if (typeof sgs.ball.spin === "number") lgs.ball.spin = sgs.ball.spin;
                } else if (shotSmoothing) {
                    // ✨ Şut sonrası smooth geçiş - yavaş yavaş server'a yaklaş
                    // (Işınlanma yerine yumuşak düzeltme)
                    if (dist > 300) {
                        lgs.ball.x = sgs.ball.x;
                        lgs.ball.y = sgs.ball.y;
                    } else {
                        // Yumuşak çekme (0.15 = yavaş, gözle görülmez)
                        lgs.ball.x += dx * 0.15;
                        lgs.ball.y += dy * 0.15;
                    }
                    if (typeof sgs.ball.vx === "number") lgs.ball.vx = sgs.ball.vx;
                    if (typeof sgs.ball.vy === "number") lgs.ball.vy = sgs.ball.vy;
                    if (typeof sgs.ball.spin === "number") lgs.ball.spin = sgs.ball.spin;
                } else if (iAmNearBall) {
                    // ✨ Top sürüyorum - orta hızda server'a yaklaş
                    if (dist > 150) {
                        // Büyük fark → snap
                        lgs.ball.x = sgs.ball.x;
                        lgs.ball.y = sgs.ball.y;
                    } else if (dist > 8) {
                        // Yumuşak yaklaş (top yapışıklığı korunur ama server'la senkron)
                        lgs.ball.x += dx * 0.20;
                        lgs.ball.y += dy * 0.20;
                    }
                    // Hızları da yumuşak güncelle
                    if (typeof sgs.ball.vx === "number") {
                        lgs.ball.vx += (sgs.ball.vx - lgs.ball.vx) * 0.25;
                    }
                    if (typeof sgs.ball.vy === "number") {
                        lgs.ball.vy += (sgs.ball.vy - lgs.ball.vy) * 0.25;
                    }
                    if (typeof sgs.ball.spin === "number") lgs.ball.spin = sgs.ball.spin;
                } else {
                    // Uzakta / rakip sürüyor → HP'yi server'a yaklaştır
                    if (dist > 300) {
                        lgs.ball.x = sgs.ball.x;
                        lgs.ball.y = sgs.ball.y;
                    } else if (dist > 5) {
                        // Yumuşak lerp
                        lgs.ball.x += dx * 0.3;
                        lgs.ball.y += dy * 0.3;
                    }
                    if (typeof sgs.ball.vx === "number") lgs.ball.vx = sgs.ball.vx;
                    if (typeof sgs.ball.vy === "number") lgs.ball.vy = sgs.ball.vy;
                    if (typeof sgs.ball.spin === "number") lgs.ball.spin = sgs.ball.spin;
                }
            }
        }
        
        // ✨ AKILLI SNAPSHOT BUFFER (Zaman Damgalı ve Jitter Korumalı)
        const now_ = performance.now();
        
        // İlk snapshot ise pozisyonları direkt eşle
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
        
        // Buffer'ı optimize tut (son 400ms verisi yeterlidir)
        const cutoff = now_ - 400;
        if (miniData.snapshots.length > 25) {
            miniData.snapshots = miniData.snapshots.filter(s => s.t >= cutoff);
        }
        
        return;
    }
    
    if (msg.type === "mini_host_visibility") {
        // ✨ Host sekme değiştirdiğinde sol üstte uyarı rozeti çıkar/kapat
        updateMiniHostVisibilityBadge(msg.hidden);
        return;
    }

    if (msg.type === "mini_game_over") {
        showMiniGameOver(msg);
        return;
    }

    // 💬 Yazan oyuncu göstergesi
    if (msg.type === "mini_chat_typing") {
        if (msg.typing) {
            miniChat.typingPlayers[msg.player_id] = true;
        } else {
            delete miniChat.typingPlayers[msg.player_id];
        }
        return;
    }
    
    // 💬 CHAT mesajları
    if (msg.type === "mini_chat_msg") {
        // Mesaj geldi = yazma bitti (typing flag'ini kaldır)
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
        
        // 🔊 Rakip chat mesaj bildirimi sesi (Sadece başkası yazınca çalar)
        if (msg.sender_id !== miniData.playerId) {
            playGlobalSound("chat_notify.mp3", 0.6);
        }
        return;
    }

    if (msg.type === "mini_chat_history") {
        // Yeni katılana son mesajlar (popup gösterme, sadece history'e ekle)
        if (msg.messages && Array.isArray(msg.messages)) {
            const wasOpen = miniChat.open;
            miniChat.open = true;  // Popup tetiklenmesin diye geçici açık say
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
            miniChat.open = wasOpen;  // Eski haline döndür
            // Badge de sıfırla (geçmiş mesajlar okunmamış sayılmasın)
            miniChat.unread = 0;
            const badge = document.getElementById("miniChatBadge");
            if (badge) badge.style.display = "none";
        }
        return;
    }
}

// ========================================
// LOBBY GÜNCELLEME
// ========================================
function updateMiniLobby() {
    // ✨ Mod göstergesi (1v1, 2v2, 3v3, 4v4, 5v5)
    const lobbyMode = document.getElementById("miniLobbyMode");
    if (lobbyMode) {
        const modeLabels = {2:"1v1", 4:"2v2", 6:"3v3", 8:"4v4", 10:"5v5"};
        lobbyMode.textContent = modeLabels[miniData.playerCount] || `${(miniData.playerCount||2)/2}v${(miniData.playerCount||2)/2}`;
    }
    // Ayarlar bilgisi
    const lobbyGoal = document.getElementById("miniLobbyGoalTarget");
    const lobbyDur = document.getElementById("miniLobbyDuration");
    const lobbySpeed = document.getElementById("miniLobbySpeed");
    if (lobbyGoal) {
        if (miniData.goalTarget >= 999) {
            lobbyGoal.textContent = "♾️";
        } else {
            lobbyGoal.textContent = miniData.goalTarget;
        }
    }
    if (lobbyDur) {
        const dur = miniData.matchDuration;
        if (dur >= 99999) {
            lobbyDur.textContent = "♾️ Sınırsız";
        } else {
            lobbyDur.textContent = dur >= 60 ? `${dur / 60} dk` : `${dur} sn`;
        }
    }
    if (lobbySpeed) {
        const speedLabels = {
            "yavas": "🐢 Yavaş",
            "normal": "🚶 Normal",
            "hizli": "🏃 Hızlı"
        };
        lobbySpeed.textContent = speedLabels[miniData.gameSpeed] || "🚶 Normal";
    }
    
    // ✨ Takım isimleri ve Kutu Renkleri
    const dynRedL = miniData.redTeamColor || "#ff6b6b";
    const dynBlueL = miniData.blueTeamColor || "#4dabf7";

    const redNameEl = document.getElementById("miniRedTeamName");
    const blueNameEl = document.getElementById("miniBlueTeamName");
    // ✨ Sadece gerçek siyah/gri koyu renklerde beyaz çerçeve (Beşiktaş).
    // GS / FB / TS gibi doygun koyu renkler kendi takım renginde kalsın.
    const isColorDark = (hex) => {
        const rgb = hexToRgbParts(hex);
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        const max = Math.max(rgb.r, rgb.g, rgb.b);
        const min = Math.min(rgb.r, rgb.g, rgb.b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        return brightness < 55 && saturation < 0.22;
    };

    if (redNameEl) {
        redNameEl.textContent = miniData.redTeamName;
        const isDark = isColorDark(dynRedL);
        redNameEl.style.color = isDark ? "#ffffff" : dynRedL; // Koyuysa ismi beyaz yap
        const redBox = redNameEl.closest(".miniTeamColumn") || redNameEl.closest(".miniTeamBox") || redNameEl.closest(".miniLobbyColumn") || redNameEl.parentElement;
        if (redBox) {
            redBox.style.borderColor = isDark ? "#ffffff" : dynRedL; // Koyuysa çerçeveyi beyaz yap
            redBox.style.borderWidth = isDark ? "2px" : "1px";
            redBox.style.background = isDark ? "rgba(255, 255, 255, 0.05)" : `linear-gradient(180deg, ${hexToRgba(dynRedL, 0.15)}, ${hexToRgba(dynRedL, 0.05)})`;
        }
    }
    if (blueNameEl) {
        blueNameEl.textContent = miniData.blueTeamName;
        const isDark = isColorDark(dynBlueL);
        blueNameEl.style.color = isDark ? "#ffffff" : dynBlueL; // Koyuysa ismi beyaz yap
        const blueBox = blueNameEl.closest(".miniTeamColumn") || blueNameEl.closest(".miniTeamBox") || blueNameEl.closest(".miniLobbyColumn") || blueNameEl.parentElement;
        if (blueBox) {
            blueBox.style.borderColor = isDark ? "#ffffff" : dynBlueL; // Koyuysa çerçeveyi beyaz yap
            blueBox.style.borderWidth = isDark ? "2px" : "1px";
            blueBox.style.background = isDark ? "rgba(255, 255, 255, 0.05)" : `linear-gradient(180deg, ${hexToRgba(dynBlueL, 0.15)}, ${hexToRgba(dynBlueL, 0.05)})`;
        }
    }
    
    // ✨ Oyuncuları takımlara ayır
    const redPlayers = miniData.players.filter(p => p.team === "red");
    const bluePlayers = miniData.players.filter(p => p.team === "blue");
    const spectators = miniData.players.filter(p => p.team === "spectator" || !p.team);
    
    // ✨ 3 sütun render
    renderTeamColumn("miniRedColumn", redPlayers, "red");
    renderTeamColumn("miniSpecColumn", spectators, "spectator");
    renderTeamColumn("miniBlueColumn", bluePlayers, "blue");
    
    // Takım sayaçları (toplam limit / oyuncu sayısı)
    const totalMax = miniData.playerCount || 2;
    const halfMax = Math.floor(totalMax / 2);
    const totalTeamPlayers = redPlayers.length + bluePlayers.length;
    const redCount = document.getElementById("miniRedCount");
    const blueCount = document.getElementById("miniBlueCount");
    const specCount = document.getElementById("miniSpecCount");
    if (redCount) redCount.textContent = `(${redPlayers.length}/${halfMax})`;
    if (blueCount) blueCount.textContent = `(${bluePlayers.length}/${halfMax})`;
    if (specCount) specCount.textContent = `(${spectators.length})`;
    
    // Toplam takım bilgisi lobby msg'ın yanına
    const modeLabels = {2:"1v1", 4:"2v2", 6:"3v3", 8:"4v4", 10:"5v5"};
    const modeLabel = modeLabels[totalMax] || `${totalMax/2}v${totalMax/2}`;
    
    // Başlat butonu - host için her zaman görünsün
    const startBtn = document.getElementById("miniStartBtn");
    if (startBtn) {
        if (miniData.playerId === 1) {
            startBtn.classList.remove("hidden");
        } else {
            startBtn.classList.add("hidden");
        }
    }
    
    // ✨ Kullanıcı "Oyuna Katıl" butonu - lobide bekliyorsa VE oyun devam ediyorsa göster
    const rejoinBtn = document.getElementById("miniRejoinGameBtn");
    if (rejoinBtn) {
        const myPlayer = miniData.players.find(p => p.id === miniData.playerId);
        const isInLobby = myPlayer && myPlayer.in_lobby;
        // Backend'in host_mode true olması "oyun aktif" demek - ama bilmiyoruz frontend'de
        // Alternatif: eğer kendisi in_lobby ise ve host değilse göster
        if (isInLobby && miniData.playerId !== 1) {
            rejoinBtn.classList.remove("hidden");
        } else {
            rejoinBtn.classList.add("hidden");
        }
    }
    
    // Oda Ayarları butonu (herkese görünür, host değilse readonly modda açar)
    const settingsBtn = document.getElementById("miniRoomSettingsBtn");
    if (settingsBtn) {
        settingsBtn.classList.remove("hidden");
        settingsBtn.style.setProperty("display", "inline-block", "important");
        settingsBtn.style.background = "#6741d9";
        settingsBtn.textContent = "⚙️ Oda Ayarları";
    }
    
    // ✨ Mod Değiştir butonu - sadece host görsün
    const changeModeBtn = document.getElementById("miniChangeModeBtn");
    if (changeModeBtn) {
        if (miniData.playerId === 1) {
            changeModeBtn.classList.remove("hidden");
            changeModeBtn.style.setProperty("display", "inline-block", "important");
        } else {
            changeModeBtn.classList.add("hidden");
            changeModeBtn.style.display = "none";
        }
    }
    
    // Takım ismi düzenleme butonları (sadece host)
    const editRedBtn = document.getElementById("miniEditRedBtn");
    const editBlueBtn = document.getElementById("miniEditBlueBtn");
    const resetNamesBtn = document.getElementById("miniResetNamesBtn");
    if (resetNamesBtn) resetNamesBtn.style.display = "none";
    if (editRedBtn && editBlueBtn) {
        if (miniData.playerId === 1) {
            editRedBtn.style.display = "inline-block";
            editBlueBtn.style.display = "inline-block";
        } else {
            editRedBtn.style.display = "none";
            editBlueBtn.style.display = "none";
        }
    }
    
    // Alt mesaj
    const lobbyMsg = document.getElementById("miniLobbyMsg");
    if (lobbyMsg) {
        const totalTeamPlayers = redPlayers.length + bluePlayers.length;
        if (totalTeamPlayers < 1) {
            lobbyMsg.textContent = "ℹ️ Takımlar boş. İzleyici modunda başlatabilirsin.";
            lobbyMsg.style.color = "#adb5bd";
        } else {
            let msg = "✅ Takımlar hazır! Host oyunu başlatabilir.";
            if (miniData.splitScreen) {
                msg += " 🎮 Split-Screen AÇIK";
            }
            lobbyMsg.textContent = msg;
            lobbyMsg.style.color = "#51cf66";
        }
    }
    
    // Ortak oda kodu + link
    if (window.setupRoomCodeAndLink) {
        const helper = window.setupRoomCodeAndLink({
            codeTextId: "miniRoomCodeText",
            codeEyeBtnId: "miniRoomCodeEyeBtn",
            copyHintId: "miniCopyHint",
            linkTextId: "miniInviteLinkText",
            linkEyeBtnId: "miniInviteLinkEyeBtn",
            linkHintId: "miniInviteLinkHint",
            getRoomCode: () => miniData.roomCode,
            getPlayerId: () => miniData.playerId
        });
        if (helper) {
            helper.renderCode();
            helper.renderLink();
        }
    }
}

// ✨ Takım sütunu render
function renderTeamColumn(containerId, players, teamKey) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    
    // ✨ Sütun drop alanı olsun
    setupMiniDropZone(container, teamKey);
    
    if (players.length === 0) {
        const empty = document.createElement("div");
        empty.className = "miniTeamEmpty";
        empty.textContent = teamKey === "spectator" ? "İzleyici yok" : "Boş";
        container.appendChild(empty);
        return;
    }
    
    players.forEach(p => {
        const row = document.createElement("div");
        row.className = "miniPlayerRow";
        if (teamKey === "red") {
            row.classList.add("teamRed");
            row.style.borderLeft = `3px solid ${miniData.redTeamColor || "#ff6b6b"}`;
        } else if (teamKey === "blue") {
            row.classList.add("teamBlue");
            row.style.borderLeft = `3px solid ${miniData.blueTeamColor || "#4dabf7"}`;
        } else {
            row.classList.add("teamSpec");
        }
        
        // ✨ Host için sürüklenebilir satır
        setupMiniDraggableRow(row, p, teamKey);
        
        // İsim (sola yaslı + dinamik takım rengi)
        const nameSpan = document.createElement("span");
        nameSpan.className = "miniPlayerName";
        nameSpan.style.flex = "1";
        nameSpan.style.textAlign = "left";
        let tCol, tNameNorm = "";
        if (teamKey === "red") {
            tCol = miniData.redTeamColor || "#ff6b6b";
            tNameNorm = (miniData.redTeamName || "").trim().toLowerCase();
        } else if (teamKey === "blue") {
            tCol = miniData.blueTeamColor || "#4dabf7";
            tNameNorm = (miniData.blueTeamName || "").trim().toLowerCase();
        } else {
            tCol = "#adb5bd"; // ✨ İzleyici rengi (Gri)
        }
        
        if (teamKey === "spectator") {
            nameSpan.style.color = tCol;
        } else if (["fenerbahçe", "fenerbahce", "fb"].includes(tNameNorm)) {
            // ✨ Fenerbahçe: oyuncu adları sarı
            nameSpan.style.color = "#ffed00";
        } else if (["galatasaray", "gs"].includes(tNameNorm)) {
            // ✨ Galatasaray: oyuncu adları sprint sarısı
            nameSpan.style.color = "#fdb913";
        } else if (["trabzonspor", "ts"].includes(tNameNorm)) {
            // ✨ Trabzonspor: oyuncu adları mavi
            nameSpan.style.color = "#4ab3e8";
        } else {
            // ✨ Sadece Beşiktaş gibi siyah/gri takımlarda isim beyaz
            const _trgb = hexToRgbParts(tCol);
            const _tBright = (_trgb.r * 299 + _trgb.g * 587 + _trgb.b * 114) / 1000;
            const _tMax = Math.max(_trgb.r, _trgb.g, _trgb.b);
            const _tMin = Math.min(_trgb.r, _trgb.g, _trgb.b);
            const _tSat = _tMax === 0 ? 0 : (_tMax - _tMin) / _tMax;
            const isTColDark = _tBright < 55 && _tSat < 0.22;
            nameSpan.style.color = isTColDark ? "#ffffff" : tCol;
        }
        let displayName = p.id === miniData.playerId ? `${p.name} (Sen)` : p.name;
        if (p.id === 1) displayName += " 👑";  // ✨ Host tacı
        if (p.in_lobby) displayName += " (lobide)";  // ✨ Lobide bekliyor
        nameSpan.textContent = displayName;
        row.appendChild(nameSpan);
        
        // ✨ KULÜP TAKIMLARINDA ADMIN OYUNCULARA SAĞ TIKLAYINCA NUMARA DEĞİŞTİRME
        const pTeamName = p.team === "red" ? miniData.redTeamName : (p.team === "blue" ? miniData.blueTeamName : "");
        if (miniData.playerId === 1 && (p.team === "red" || p.team === "blue") && isClubTeam(pTeamName)) {
            row.style.cursor = "context-menu";
            row.title = "Sağ tık → Forma Numarası Değiştir 👕";
            row.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showJerseyNumberEditor(p);
            };
        }
        
        // ✨ PING göstergesi (sağda)
        const pingSpan = document.createElement("span");
        pingSpan.className = "miniPlayerPing";
        pingSpan.dataset.playerId = p.id;
        const pingVal = (miniData.pings && miniData.pings[p.id] !== undefined) ? miniData.pings[p.id] : null;
        if (pingVal !== null) {
            pingSpan.textContent = `${pingVal}ms`;
            // Renk: iyi/orta/kötü
            if (pingVal < 80) pingSpan.style.color = "#51cf66";
            else if (pingVal < 200) pingSpan.style.color = "#ffd43b";
            else pingSpan.style.color = "#ff6b6b";
        } else {
            pingSpan.textContent = "...";
            pingSpan.style.color = "#adb5bd";
        }
        row.appendChild(pingSpan);
        
        // Host için kick butonu (sadece kendisi değilse)
        if (miniData.playerId === 1 && p.id !== miniData.playerId) {
            const btnKick = document.createElement("button");
            btnKick.className = "miniMoveBtn miniMoveBtnKick";
            btnKick.textContent = "❌";
            btnKick.title = "Odadan at";
            btnKick.style.marginLeft = "8px";
            btnKick.onclick = (e) => {
                e.stopPropagation();
                openMiniKickConfirm(p.id, p.name);
            };
            row.appendChild(btnKick);
        }
        
        container.appendChild(row);
    });
}

function movePlayer(targetId, team) {
    send({ type: "mini_move_player", target_id: targetId, team: team });
}

// ✨ KULÜP TAKIMI KONTROLÜ (Milli takımlarda forma numarası elle değiştirilmez)
function isClubTeam(teamName) {
    if (!teamName) return false;
    const n = teamName.trim().toLowerCase();
    return ["beşiktaş", "besiktas", "bjk", "galatasaray", "gs", "fenerbahçe", "fenerbahce", "fb", "trabzonspor", "ts"].includes(n);
}

// ✨ FORMA NUMARASI DEĞİŞTİRME POPUP (Sadece Admin / Hazır Kulüp Takımları İçin)
function showJerseyNumberEditor(playerObj) {
    const existing = document.getElementById("miniJerseyEditor");
    if (existing) existing.remove();
    
    let currentNum = 10;
    const pIdStr = String(playerObj.id);
    
    // Öncelik: Kalıcı hafızadaki forma numarası
    if (miniData.persistentJerseys && miniData.persistentJerseys[pIdStr] !== undefined) {
        currentNum = miniData.persistentJerseys[pIdStr];
    } else if (typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players?.[playerObj.id]) {
        const num = HP.room.gameState.players[playerObj.id].jersey_number;
        if (num !== undefined) currentNum = num;
    } else {
        const p = miniData.players.find(pl => pl.id === playerObj.id);
        if (p && p.jersey_number !== undefined) {
            currentNum = p.jersey_number;
        } else {
            const sameTeamPlayers = miniData.players.filter(pl => pl.team === playerObj.team);
            const playerTeamIdx = sameTeamPlayers.findIndex(pl => pl.id === playerObj.id);
            const jerseyNumbersPool = [10, 7, 9, 11, 8, 1, 5, 4, 6, 2];
            currentNum = jerseyNumbersPool[playerTeamIdx >= 0 ? playerTeamIdx % jerseyNumbersPool.length : 0];
        }
    }
    
    const teamColor = playerObj.team === "red" ? (miniData.redTeamColor || "#ff6b6b") : (miniData.blueTeamColor || "#4dabf7");
    const teamGlow = hexToRgba(teamColor, 0.4);
    
    const overlay = document.createElement("div");
    overlay.id = "miniJerseyEditor";
    overlay.className = "overlay";
    overlay.style.zIndex = "999999";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:400px; border:2px solid ${teamColor}; box-shadow: 0 0 40px ${teamGlow};">
            <div style="font-size:60px; margin:10px 0;">👕</div>
            <h2 style="color:${teamColor}; margin:10px 0 15px 0;">Forma Numarası Değiştir</h2>
            <p style="color:#adb5bd; font-size:14px; margin:0 0 20px 0; line-height:1.5;">
                <b style="color:#fff;">${playerObj.name}</b> için yeni forma numarası seç (0 - 99):
            </p>
            <input id="miniJerseyInput" type="number" 
                   min="0" max="99"
                   value="${currentNum}"
                   style="width:120px; padding:12px; font-size:26px; font-weight:bold;
                          border-radius:10px; border:2px solid ${teamColor}; 
                          background:#1a1e2e; color:#fff; text-align:center;
                          font-family:inherit; outline:none; margin-bottom: 20px;">
            <div class="confirmButtons">
                <button id="miniJerseySaveBtn" class="bigBtn greenBtn">💾 KAYDET</button>
                <button id="miniJerseyCancelBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const input = document.getElementById("miniJerseyInput");
    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
    
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            document.getElementById("miniJerseySaveBtn").click();
        } else if (e.key === "Escape") {
            e.preventDefault();
            document.getElementById("miniJerseyCancelBtn").click();
        }
    });
    
    document.getElementById("miniJerseySaveBtn").onclick = () => {
        let num = parseInt(input.value, 10);
        if (isNaN(num) || num < 0 || num > 99) {
            input.style.borderColor = "#ff3333";
            input.focus();
            return;
        }
        
        overlay.remove();
        
        const pIdStr = String(playerObj.id);
        
        // ✨ Kalıcı hafızaya ve tarayıcı belleğine kaydet
        if (!miniData.persistentJerseys) miniData.persistentJerseys = {};
        miniData.persistentJerseys[pIdStr] = num;
        try {
            localStorage.setItem("miniPersistentJerseys", JSON.stringify(miniData.persistentJerseys));
        } catch(e) {}
        
        // miniData oyuncu listesinde forma numarasını güncelle
        const p = miniData.players.find(pl => pl.id === playerObj.id);
        if (p) p.jersey_number = num;

        // Eğer oyun başladıysa HP fizik motorunu hemen güncelle
        if (typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players?.[playerObj.id]) {
            HP.room.gameState.players[playerObj.id].jersey_number = num;
            console.log(`[JERSEY] Oyuncu ${playerObj.id} forma numarası ${num} yapıldı (HP)`);
            
            // HP anında yeni durumu misafirlere yayınlasın
            HP.tick();
        }
        
        // ✨ Pause menüsü açıksa listeyi canlı yenile
        const pauseBox = document.getElementById("miniPauseLobbyBox");
        if (pauseBox && !pauseBox.classList.contains("hidden")) {
            updateMiniPauseLobby();
        }
        
        if (typeof showToast === "function") {
            showToast("👕 Forma Numarası", `${playerObj.name} artık ${num} numara!`, null, "success");
        }
    };
    
    document.getElementById("miniJerseyCancelBtn").onclick = () => {
        overlay.remove();
    };
}

function editTeamName(team) {
    const currentName = team === "red" ? miniData.redTeamName : miniData.blueTeamName;
    showMiniTeamNameEditor(team, currentName);
}

function getTeamColors(team) {
    if (team === "blue") {
        return {
            team: miniData.blueTeamColor || "#4dabf7",
            sprint: miniData.blueSprintColor || "#ffd43b",
            defaultTeam: "#4dabf7",
            defaultSprint: "#ffd43b"
        };
    }
    return {
        team: miniData.redTeamColor || "#ff6b6b",
        sprint: miniData.redSprintColor || "#ffd43b",
        defaultTeam: "#ff6b6b",
        defaultSprint: "#ffd43b"
    };
}

function hexToRgba(hex, alpha) {
    const h = (hex || "#ffffff").replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(full, 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ✨ Hex rengi {r,g,b} bileşenlerine ayır (alevli şut / glow efektleri için)
function hexToRgbParts(hex) {
    const h = (hex || "#ffffff").replace("#", "");
    const full = h.length === 3 ? h.split("").map(c => c + c).join("") : h;
    const n = parseInt(full, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

// ✨ Hex rengi aç/koyulaştır (percent: -1..0 koyulaştır, 0..1 açar)
function shadeHexColor(hex, percent) {
    const { r, g, b } = hexToRgbParts(hex);
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent);
    const nr = Math.round((t - r) * p) + r;
    const ng = Math.round((t - g) * p) + g;
    const nb = Math.round((t - b) * p) + b;
    return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
}

function showMiniTeamNameEditor(team, currentName) {
    const existing = document.getElementById("miniTeamNameEditor");
    if (existing) existing.remove();
    
    const isRed = team === "red";
    const colors = getTeamColors(team);
    const teamColor = colors.team;
    const sprintColor = colors.sprint;
    const teamGlow = hexToRgba(teamColor, 0.4);
    const teamLabel = isRed ? "Kırmızı Takım" : "Mavi Takım";
    const displayTitle = (currentName && currentName.trim()) ? currentName.trim() : teamLabel;
    
    // ✨ Mevcut takım kontrolü
    const normName = (currentName || "").trim().toLowerCase();
    const isCurrentTurkey = normName === "türkiye" || normName === "turkiye";
    const isCurrentAzerbaijan = normName === "azerbaycan" || normName === "azerbaijan";
    
    const overlay = document.createElement("div");
    overlay.id = "miniTeamNameEditor";
    overlay.className = "overlay";
    overlay.style.zIndex = "999999";
    overlay.style.pointerEvents = "auto";
    overlay.innerHTML = `
        <div id="miniTeamEditorCard" class="overlayCard" style="max-width:480px; border:2px solid ${teamColor}; box-shadow: 0 0 40px ${teamGlow}; transition: border-color 0.15s, box-shadow 0.15s;">
            <div id="miniTeamPreviewCircle" style="width:60px; height:60px; margin:10px auto; border-radius:50%; background:${teamColor}; box-shadow: 0 0 22px ${teamGlow}, inset 0 -8px 14px rgba(0,0,0,0.28); transition: background 0.15s, box-shadow 0.15s;"></div>
            <h2 id="miniTeamEditorTitle" style="color:${teamColor}; margin:10px 0 15px 0; transition: color 0.15s;">${displayTitle} Ayarları</h2>
            
            <p style="color:#adb5bd; font-size:13px; margin:0 0 8px 0; text-align:left;">Takım İsmi (max 20)</p>
            <input id="miniTeamNameInput" type="text" 
                   value="${(currentName || "").replace(/"/g, '&quot;')}" 
                   maxlength="20"
                   style="width:100%; padding:12px; font-size:16px; font-weight:bold;
                          border-radius:10px; border:2px solid ${teamColor}; 
                          background:#1a1e2e; color:#fff; text-align:center;
                          font-family:inherit; outline:none; margin-bottom:16px;
                          box-sizing:border-box; transition: border-color 0.15s;">
            
            <div style="display:flex; gap:12px; margin-bottom:14px;">
                <div style="flex:1; background:rgba(0,0,0,0.25); border-radius:12px; padding:14px; border:1px solid rgba(255,255,255,0.08);">
                    <div style="color:#fff; font-weight:700; font-size:13px; margin-bottom:10px;">🎨 Takım Rengi</div>
                    <div id="miniTeamColorSwatch" style="position:relative; width:100%; height:52px; border-radius:10px; overflow:hidden; border:2px solid rgba(255,255,255,0.18); cursor:pointer;">
                        <div id="miniTeamColorFill" style="position:absolute; inset:0; background:${teamColor}; transition:background 0.15s;"></div>
                        <input id="miniTeamColorInput" type="color" value="${teamColor}"
                               style="position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; border:none; padding:0; margin:0;">
                    </div>
                    <div style="text-align:center; margin-top:8px;">
                        <span id="miniTeamColorHex" style="color:#adb5bd; font-family:monospace; font-size:12px; letter-spacing:0.5px;">${teamColor}</span>
                    </div>
                    <p style="color:#6c757d; font-size:11px; margin:8px 0 0 0;">Oyuncu, isim, skor, lobi rengi</p>
                </div>
                <div style="flex:1; background:rgba(0,0,0,0.25); border-radius:12px; padding:14px; border:1px solid rgba(255,255,255,0.08);">
                    <div style="color:#fff; font-weight:700; font-size:13px; margin-bottom:10px;">⚡ Sprint Rengi</div>
                    <div id="miniSprintColorSwatch" style="position:relative; width:100%; height:52px; border-radius:10px; overflow:hidden; border:2px solid rgba(255,255,255,0.18); cursor:pointer;">
                        <div id="miniSprintColorFill" style="position:absolute; inset:0; background:${sprintColor}; transition:background 0.15s;"></div>
                        <input id="miniSprintColorInput" type="color" value="${sprintColor}"
                               style="position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; border:none; padding:0; margin:0;">
                    </div>
                    <div style="text-align:center; margin-top:8px;">
                        <span id="miniSprintColorHex" style="color:#adb5bd; font-family:monospace; font-size:12px; letter-spacing:0.5px;">${sprintColor}</span>
                    </div>
                    <p style="color:#6c757d; font-size:11px; margin:8px 0 0 0;">Enerji halkası + şut parlaması</p>
                </div>
            </div>
            
            <!-- ✨ HAZIR TAKIMLAR KUTUSU -->
            <div style="background:rgba(0,0,0,0.25); border-radius:12px; padding:12px; border:1px solid rgba(255,255,255,0.08); margin-bottom:12px;">
                <div style="color:#fff; font-weight:700; font-size:13px; margin-bottom:8px;">🏆 Hazır Takımlar</div>
                <select id="miniPresetTeamSelect" style="width:100%; padding:10px; font-size:14px; border-radius:8px; background:#1a1e2e; color:#fff; border:1px solid rgba(255,255,255,0.2); outline:none; cursor:pointer;">
                    <option value="">-- Bir takım seç --</option>
                    <option value="turkiye">🇹🇷 Türkiye</option>
                    <option value="azerbaycan">🇦🇿 Azerbaycan</option>
                    <option value="besiktas">🦅 Beşiktaş</option>
                    <option value="galatasaray">🦁 Galatasaray</option>
                    <option value="fenerbahce">🐣 Fenerbahçe</option>
                    <option value="trabzonspor">🐟 Trabzonspor</option>
                </select>
            </div>
            
            <button id="miniTeamColorResetBtn" class="bigBtn" style="width:100%; background:#495057; margin-bottom:16px;">
                🔄 Takım İsim ve Rengini Sıfırla
            </button>
            
            <div class="confirmButtons">
                <button id="miniTeamNameSaveBtn" class="bigBtn greenBtn">💾 KAYDET</button>
                <button id="miniTeamNameCancelBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const input = document.getElementById("miniTeamNameInput");
    const teamColorInput = document.getElementById("miniTeamColorInput");
    const sprintColorInput = document.getElementById("miniSprintColorInput");
    const teamHex = document.getElementById("miniTeamColorHex");
    const sprintHex = document.getElementById("miniSprintColorHex");
    
    function applyLocalColors(tColor, sColor, tName) {
        if (team === "red") {
            miniData.redTeamColor = tColor;
            miniData.redSprintColor = sColor;
            // ✨ Maç içinde ESC'den takım değişince gol şarkısı havuzu anında güncellensin
            if (tName !== undefined && tName !== null && String(tName).trim() !== "") {
                miniData.redTeamName = String(tName).trim();
            }
        } else {
            miniData.blueTeamColor = tColor;
            miniData.blueSprintColor = sColor;
            if (tName !== undefined && tName !== null && String(tName).trim() !== "") {
                miniData.blueTeamName = String(tName).trim();
            }
        }
        try { updateMiniLobby(); } catch(e) {}
        try { updateMiniPauseLobby(); } catch(e) {}
        try { updateMiniHUD(); } catch(e) {}
    }
    
    function pushColors(payload) {
        send(Object.assign({
            type: "mini_change_team_name",
            team: team
        }, payload));
    }
    
    // ✨ Popup içindeki canlı önizleme elementleri (daire, kart kenarlığı, isim inputu, swatch)
    const previewCircle = document.getElementById("miniTeamPreviewCircle");
    const editorCard = document.getElementById("miniTeamEditorCard");
    const editorTitle = document.getElementById("miniTeamEditorTitle");
    const teamColorFill = document.getElementById("miniTeamColorFill");
    const sprintColorFill = document.getElementById("miniSprintColorFill");
    
    function refreshTeamColorPreview(c) {
        teamHex.textContent = c;
        if (teamColorFill) teamColorFill.style.background = c;
        if (previewCircle) {
            previewCircle.style.background = c;
            previewCircle.style.boxShadow = `0 0 22px ${hexToRgba(c, 0.4)}, inset 0 -8px 14px rgba(0,0,0,0.28)`;
        }
        if (editorCard) {
            editorCard.style.borderColor = c;
            editorCard.style.boxShadow = `0 0 40px ${hexToRgba(c, 0.4)}`;
        }
        if (editorTitle) editorTitle.style.color = c;
        if (input) input.style.borderColor = c;
    }
    
    // ✨ Takım ismi yazıldıkça başlığı canlı güncelle
    input.addEventListener("input", () => {
        const newTitle = input.value.trim() || teamLabel;
        if (editorTitle) editorTitle.textContent = `${newTitle} Ayarları`;
        
        const val = input.value.trim().toLowerCase();
        if (presetSelect) {
            if (val === "türkiye" || val === "turkiye") presetSelect.value = "turkiye";
            else if (val === "azerbaycan" || val === "azerbaijan") presetSelect.value = "azerbaycan";
            else presetSelect.value = "";
        }
    });

    function saveStorageTeam(tName, tCol, sCol) {
        try {
            if (team === "red") {
                if (tName) localStorage.setItem("miniRedTeamName", tName);
                if (tCol) localStorage.setItem("miniRedTeamColor", tCol);
                if (sCol) localStorage.setItem("miniRedSprintColor", sCol);
            } else {
                if (tName) localStorage.setItem("miniBlueTeamName", tName);
                if (tCol) localStorage.setItem("miniBlueTeamColor", tCol);
                if (sCol) localStorage.setItem("miniBlueSprintColor", sCol);
            }
        } catch(e) {}
    }

    teamColorInput.addEventListener("input", () => {
        const c = teamColorInput.value;
        const nameVal = input.value.trim() || currentName;
        refreshTeamColorPreview(c);
        applyLocalColors(c, sprintColorInput.value, nameVal);
        saveStorageTeam(nameVal, c, sprintColorInput.value);
        // ✨ Takım rengi elle değiştirilince hazır takım seçimi sıfırlansın
        const ps = document.getElementById("miniPresetTeamSelect");
        if (ps) ps.value = "";
        pushColors({
            name: nameVal,
            team_color: c,
            sprint_color: sprintColorInput.value
        });
    });
    
    sprintColorInput.addEventListener("input", () => {
        const c = sprintColorInput.value;
        const nameVal = input.value.trim() || currentName;
        sprintHex.textContent = c;
        if (sprintColorFill) sprintColorFill.style.background = c;
        applyLocalColors(teamColorInput.value, c, nameVal);
        saveStorageTeam(nameVal, teamColorInput.value, c);
        // ✨ Sprint rengi elle değiştirilince hazır takım seçimi sıfırlansın
        const ps = document.getElementById("miniPresetTeamSelect");
        if (ps) ps.value = "";
        pushColors({
            name: nameVal,
            team_color: teamColorInput.value,
            sprint_color: c
        });
    });
    
    // ✨ Hazır Takım Seçimi
    const presetSelect = document.getElementById("miniPresetTeamSelect");
    if (presetSelect) {
        // ✨ Pencere her açıldığında mevcut takımı kontrol et ve seçili yap
        const initNorm = (currentName || "").trim().toLowerCase();
        if (["türkiye", "turkiye"].includes(initNorm)) presetSelect.value = "turkiye";
        else if (["azerbaycan", "azerbaijan"].includes(initNorm)) presetSelect.value = "azerbaycan";
        else if (["beşiktaş", "besiktas", "bjk"].includes(initNorm)) presetSelect.value = "besiktas";
        else if (["galatasaray", "gs"].includes(initNorm)) presetSelect.value = "galatasaray";
        else if (["fenerbahçe", "fenerbahce", "fb"].includes(initNorm)) presetSelect.value = "fenerbahce";
        else if (["trabzonspor", "ts"].includes(initNorm)) presetSelect.value = "trabzonspor";

        presetSelect.addEventListener("change", () => {
            const val = presetSelect.value;
            if (!val) return;

            // ✨ Hazır takım seçildiğinde önce eski özel ayarları sıfırla
            try {
                if (team === "red") {
                    localStorage.removeItem("miniRedTeamName");
                    localStorage.removeItem("miniRedTeamColor");
                    localStorage.removeItem("miniRedSprintColor");
                } else {
                    localStorage.removeItem("miniBlueTeamName");
                    localStorage.removeItem("miniBlueTeamColor");
                    localStorage.removeItem("miniBlueSprintColor");
                }
            } catch(e) {}

            let tName = "", tColor = "", tSprint = "";

            if (val === "turkiye") {
                tName = "Türkiye";
                tColor = "#e30a17"; // Bayrak Kırmızısı
                tSprint = "#e30a17";
            } else if (val === "azerbaycan") {
                tName = "Azerbaycan";
                tColor = "#00a8e8";
                tSprint = "#ffffff"; // ✨ Bayraktaki hilal/yıldız beyazı — forma ile uyumlu
            } else if (val === "besiktas") {
                tName = "Beşiktaş";
                tColor = "#111111";
                tSprint = "#ffffff";
            } else if (val === "galatasaray") {
                tName = "Galatasaray";
                tColor = "#a90429";
                tSprint = "#fdb913";
            } else if (val === "fenerbahce") {
                tName = "Fenerbahçe";
                tColor = "#00205b";
                tSprint = "#ffed00";
            } else if (val === "trabzonspor") {
                tName = "Trabzonspor";
                tColor = "#700018";
                tSprint = "#4ab3e8";
            }

            if (tName) {
                input.value = tName;
                if (editorTitle) editorTitle.textContent = `${tName} Ayarları`;
                teamColorInput.value = tColor;
                sprintColorInput.value = tSprint;
                
                refreshTeamColorPreview(tColor);
                sprintHex.textContent = tSprint;
                if (sprintColorFill) sprintColorFill.style.background = tSprint;
                
                saveStorageTeam(tName, tColor, tSprint);
                // ✨ İsim + renk anında miniData'ya yaz (gol şarkısı bir sonraki golde doğru havuzdan)
                applyLocalColors(tColor, tSprint, tName);
                pushColors({ name: tName, team_color: tColor, sprint_color: tSprint });
            }
        });
        
        // ✨ İsim elle değiştirilirse hazır takım listesini canlı güncelle
        input.addEventListener("input", () => {
            const val = input.value.trim().toLowerCase();
            if (["türkiye", "turkiye"].includes(val)) presetSelect.value = "turkiye";
            else if (["azerbaycan", "azerbaijan"].includes(val)) presetSelect.value = "azerbaycan";
            else if (["beşiktaş", "besiktas", "bjk"].includes(val)) presetSelect.value = "besiktas";
            else if (["galatasaray", "gs"].includes(val)) presetSelect.value = "galatasaray";
            else if (["fenerbahçe", "fenerbahce", "fb"].includes(val)) presetSelect.value = "fenerbahce";
            else if (["trabzonspor", "ts"].includes(val)) presetSelect.value = "trabzonspor";
            else presetSelect.value = "";
        });
    }
    
    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
    
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            document.getElementById("miniTeamNameSaveBtn").click();
        } else if (e.key === "Escape") {
            e.preventDefault();
            document.getElementById("miniTeamNameCancelBtn").click();
        }
    });
    
    document.getElementById("miniTeamColorResetBtn").onclick = () => {
        const existingConfirm = document.getElementById("miniTeamColorResetConfirm");
        if (existingConfirm) existingConfirm.remove();
        
        const confirmOverlay = document.createElement("div");
        confirmOverlay.id = "miniTeamColorResetConfirm";
        confirmOverlay.className = "overlay";
        confirmOverlay.style.zIndex = "1000000";
        confirmOverlay.style.pointerEvents = "auto";
        confirmOverlay.innerHTML = `
            <div class="overlayCard" style="max-width:400px; border:2px solid #adb5bd; box-shadow: 0 0 40px rgba(173,181,189,0.3);">
                <div style="width:56px; height:56px; margin:10px auto; border-radius:50%; background:rgba(173,181,189,0.15); display:flex; align-items:center; justify-content:center; font-size:30px;">🔄</div>
                <h2 style="color:#fff; margin:12px 0 12px 0; font-size:19px;">İsim ve Rengi Sıfırla</h2>
                <p style="color:#adb5bd; font-size:14px; margin:0 0 24px 0; line-height:1.5;">
                    <b style="color:${teamColor};">${teamLabel}</b> ismi, rengi ve sprint rengi varsayılana dönecek.<br>
                    <span style="font-size:13px;">Sıfırlamak istediğinize emin misiniz?</span>
                </p>
                <div class="confirmButtons">
                    <button id="miniTeamColorResetYesBtn" class="bigBtn greenBtn">✅ EVET, SIFIRLA</button>
                    <button id="miniTeamColorResetNoBtn" class="bigBtn redBtn">İPTAL</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmOverlay);
        
        document.getElementById("miniTeamColorResetYesBtn").onclick = () => {
            confirmOverlay.remove();
            const defName = team === "red" ? "Kırmızı Takım" : "Mavi Takım";
            const defT = colors.defaultTeam;
            const defS = colors.defaultSprint;
            
            input.value = defName;
            if (editorTitle) editorTitle.textContent = `${defName} Ayarları`;
            if (presetSelect) presetSelect.value = "";
            
            teamColorInput.value = defT;
            sprintColorInput.value = defS;
            refreshTeamColorPreview(defT);
            sprintHex.textContent = defS;
            if (sprintColorFill) sprintColorFill.style.background = defS;
            
            try {
                if (team === "red") {
                    localStorage.removeItem("miniRedTeamName");
                    localStorage.removeItem("miniRedTeamColor");
                    localStorage.removeItem("miniRedSprintColor");
                } else {
                    localStorage.removeItem("miniBlueTeamName");
                    localStorage.removeItem("miniBlueTeamColor");
                    localStorage.removeItem("miniBlueSprintColor");
                }
            } catch(e) {}
            
            applyLocalColors(defT, defS, defName);
            pushColors({ reset_colors: true, name: defName, team_color: defT, sprint_color: defS });
            if (typeof showToast === "function") {
                showToast("🔄 Sıfırlandı", "Takım ismi ve rengi varsayılana döndü", null, "info");
            }
        };
        document.getElementById("miniTeamColorResetNoBtn").onclick = () => {
            confirmOverlay.remove();
        };
    };
    
    document.getElementById("miniTeamNameSaveBtn").onclick = () => {
        const newName = input.value.trim();
        if (!newName) {
            input.style.borderColor = "#ff3333";
            input.focus();
            return;
        }
        overlay.remove();
        try {
            if (team === "red") {
                localStorage.setItem("miniRedTeamName", newName);
                localStorage.setItem("miniRedTeamColor", teamColorInput.value);
                localStorage.setItem("miniRedSprintColor", sprintColorInput.value);
            } else {
                localStorage.setItem("miniBlueTeamName", newName);
                localStorage.setItem("miniBlueTeamColor", teamColorInput.value);
                localStorage.setItem("miniBlueSprintColor", sprintColorInput.value);
            }
        } catch(e) {}
        // ✨ Kaydet'te de ismi anında uygula (ESC menüsü → devam → gol)
        applyLocalColors(teamColorInput.value, sprintColorInput.value, newName);
        pushColors({
            name: newName,
            team_color: teamColorInput.value,
            sprint_color: sprintColorInput.value
        });
    };
    
    document.getElementById("miniTeamNameCancelBtn").onclick = () => {
        overlay.remove();
    };
}

// ✨ BUG FIX: Bu fonksiyon eskiden bir "function" sarmalayıcısı olmadan
// tanımlanmıştı, yani sayfa yüklenir yüklenmez (kullanıcı hiçbir butona
// basmadan) çalışıp arka planda gizli bir overlay oluşturuyordu ve
// "resetTeamNames()" çağrıları hataya düşüyordu. Şimdi düzgün bir
// fonksiyon olarak tanımlandı.
function resetTeamNames() {
    // Eski popup varsa kaldır
    const existing = document.getElementById("miniResetNamesConfirm");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "miniResetNamesConfirm";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:450px; border:2px solid #adb5bd; box-shadow: 0 0 40px rgba(173,181,189,0.3);">
            <div style="width:56px; height:56px; margin:10px auto; border-radius:50%; background:rgba(173,181,189,0.15); display:flex; align-items:center; justify-content:center; font-size:30px;">🔄</div>
            <h2 style="color:#fff; margin:12px 0 12px 0; font-size:19px;">Takım İsimlerini Sıfırla</h2>
            <p style="color:#adb5bd; font-size:14px; margin:0 0 24px 0; line-height:1.5;">
                Takım isimleri <b style="color:#ff6b6b;">Kırmızı Takım</b> ve <b style="color:#4dabf7;">Mavi Takım</b> olarak sıfırlanacak.<br>
                <span style="font-size:13px;">Sıfırlamak istediğinize emin misiniz?</span>
            </p>
            <div class="confirmButtons">
                <button id="miniResetNamesYesBtn" class="bigBtn greenBtn">🔄 EVET, SIFIRLA</button>
                <button id="miniResetNamesNoBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("miniResetNamesYesBtn").onclick = () => {
        overlay.remove();
        // ✨ localStorage'dan da temizle
        try {
            localStorage.removeItem("miniRedTeamName");
            localStorage.removeItem("miniBlueTeamName");
            localStorage.removeItem("miniRedTeamColor");
            localStorage.removeItem("miniBlueTeamColor");
            localStorage.removeItem("miniRedSprintColor");
            localStorage.removeItem("miniBlueSprintColor");
        } catch(e) {}
        send({ type: "mini_reset_team_names" });
    };
    document.getElementById("miniResetNamesNoBtn").onclick = () => {
        overlay.remove();
    };
}

// ========================================
// ODA AYARLARI
// ========================================
function openMiniRoomSettings() {
    if (!window.openRoomSettingsGeneric) return;
    
    // ✨ Kullanıcı (host değil) için readonly mod
    const readonly = miniData.playerId !== 1;
    
    window.openRoomSettingsGeneric({
        title: "Mini Futbol - Oda Ayarları",
        readonly: readonly,
        showAdvancedGoalDuration: true,  // ✨ Gelişmişte Skor+Süre input'ları göster
        currentGoalTarget: miniData.goalTarget || 3,
        currentMatchDuration: miniData.matchDuration || 180,
        fields: [
            {
                id: "playerCount",
                label: "👥 Oyuncu Sayısı",
                current: miniData.playerCount || 2,
                minValue: (function() {
                    // Sadece aktif oyuncular (spectator hariç)
                    if (!miniData.players || miniData.players.length === 0) return null;
                    const activePlayers = miniData.players.filter(p => p.team === "red" || p.team === "blue");
                    return activePlayers.length > 2 ? activePlayers.length : null;
                })(),
                valueMapping: function(v) { return v; },  // 2→2, 4→4, ...
                options: [
                    {value: 2, label: "1v1"},
                    {value: 4, label: "2v2"},
                    {value: 6, label: "3v3"},
                    {value: 8, label: "4v4"},
                    {value: 10, label: "5v5"}
                ]
            },
            {
                id: "spectatorCount",
                label: "👁️ İzleyici Sayısı",
                current: miniData.spectatorCount || 0,
                options: [
                    {value: 0, label: "İzleyici yok"},
                    {value: 1, label: "1 İzleyici"},
                    {value: 2, label: "2 İzleyici"},
                    {value: 3, label: "3 İzleyici"},
                    {value: 4, label: "4 İzleyici"},
                    {value: 5, label: "5 İzleyici"}
                ]
            },
            {
                id: "goalTarget",
                label: "⚽ Kazanma Skoru",
                current: miniData.goalTarget || 3,
                disableOnAdvanced: true,  // ✨ Gelişmiş modda devre dışı
                options: [
                    {value: 1, label: "1 Gol (Hızlı)"},
                    {value: 3, label: "3 Gol (Klasik)"},
                    {value: 5, label: "5 Gol"},
                    {value: 7, label: "7 Gol"},
                    {value: 10, label: "10 Gol (Uzun)"},
                    {value: 15, label: "15 Gol"},
                    {value: 20, label: "20 Gol"},
                    {value: 30, label: "30 Gol (Maraton)"},
                    {value: 999, label: "♾️ Sınırsız (Sadece Süreye Bağlı)"}
                ]
            },
            {
                id: "matchDuration",
                label: "⏱️ Maç Süresi",
                current: miniData.matchDuration || 180,
                disableOnAdvanced: true,  // ✨ Gelişmiş modda devre dışı
                options: [
                    {value: 60, label: "1 Dakika"},
                    {value: 120, label: "2 Dakika"},
                    {value: 180, label: "3 Dakika (Klasik)"},
                    {value: 300, label: "5 Dakika"},
                    {value: 600, label: "10 Dakika"},
                    {value: 900, label: "15 Dakika"},
                    {value: 1200, label: "20 Dakika"},
                    {value: 1500, label: "25 Dakika"},
                    {value: 1800, label: "30 Dakika"},
                    {value: 2700, label: "45 Dakika"},
                    {value: 4200, label: "70 Dakika"},
                    {value: 5400, label: "90 Dakika"},
                    {value: 7200, label: "120 Dakika"},
                    {value: 99999, label: "♾️ Sınırsız (Sadece Gol Sayısı)"}
                ]
            },
            {
                id: "gameSpeed",
                label: "⚡ Oyun Hızı",
                current: miniData.gameSpeed || "normal",
                disableOnAdvanced: true,  // ✨ Gelişmiş modda kapalı olsun
                options: [
                    {value: "yavas", label: "🐢 Yavaş"},
                    {value: "normal", label: "🚶 Normal (Varsayılan)"},
                    {value: "hizli", label: "🏃 Hızlı"}
                ]
            },
			{
                id: "kickoffTimeout",
                label: "⏱️ Santra Süresi (Gol Yiyen Topa Dokunma Süresi)",
                current: miniData.kickoffTimeout || 10,
                options: [
                    {value: 5, label: "5 Saniye (Hızlı)"},
                    {value: 10, label: "10 Saniye (Klasik)"},
                    {value: 15, label: "15 Saniye"},
                    {value: 20, label: "20 Saniye"},
                    {value: 30, label: "30 Saniye"},
                    {value: 60, label: "60 Saniye"},
                    {value: 999, label: "♾️ Sınırsız (Kural Devre Dışı)"}
                ]
            },
            
            {
                id: "allowPlase",
                label: "🌀 Falso'ya İzin Ver (Plase Şutu)",
                current: (function(){
                    if (miniData.allowPlase !== undefined) return miniData.allowPlase ? "on" : "off";
                    try {
                        const saved = localStorage.getItem("miniAllowPlase");
                        if (saved === "off") return "off";
                    } catch(e) {}
                    return "on";
                })(),
                disableOnAdvanced: true,
                options: [
                    {value: "on", label: "✅ Açık (Plase Kavis Atar)"},
                    {value: "off", label: "❌ Kapalı (Sadece Düz Şut)"}
                ]
            },
            {
                id: "passAssistance",
                label: "🤝 Pas Yardımı (Oto-Hedef)",
                current: (function(){
                    if (miniData.passAssistance !== undefined) return miniData.passAssistance ? "on" : "off";
                    try {
                        const saved = localStorage.getItem("miniPassAssistance");
                        if (saved === "off") return "off";
                    } catch(e) {}
                    return "on";
                })(),
                disableOnAdvanced: true,
                options: [
                    {value: "on", label: "✅ Açık (Takım Arkadaşına Yönelir)"},
                    {value: "off", label: "❌ Kapalı (Tamamen Manuel)"}
                ]
            },
            {
                id: "ballStick",
                label: "🧲 Top Kontrolü (Sürüş)",
                current: (function(){
                    if (miniData.ballStick !== undefined) return miniData.ballStick ? "on" : "off";
                    try {
                        const saved = localStorage.getItem("miniBallStick");
                        if (saved === "off") return "off";
                    } catch(e) {}
                    return "on";
                })(),
                disableOnAdvanced: true,
                options: [
                    {value: "on", label: "✅ Açık (Top Yapışır - Klasik)"},
                    {value: "off", label: "❌ Kapalı (Bilardo Tarzı)"}
                ]
            },
            {
                id: "goalMusicMode",
                label: "🎵 Gol Müziği",
                current: miniData.goalMusicMode || "team",
                options: [
                    {value: "team", label: "🏟️ Takıma Göre (BJK→BJK, GS→GS)"},
                    {value: "mixed", label: "🎲 Karışık (Tüm Şarkılardan Rastgele)"}
                ]
            },
            {
                id: "sprintEnabled",
                label: "⚡ Sprint Etkinleştir",
                current: (function(){
                    if (miniData.sprintEnabled !== undefined) return miniData.sprintEnabled ? "on" : "off";
                    try {
                        const saved = localStorage.getItem("miniSprintEnabled");
                        if (saved === "off") return "off";
                    } catch(e) {}
                    return "on";
                })(),
                options: [
                    {value: "on", label: "✅ Açık (Shift ile Hızlan)"},
                    {value: "off", label: "❌ Kapalı (Sprint Yok)"}
                ]
            }
        ],
        // ✨ GELİŞMİŞ AYARLAR (fizik/oyun mekaniği)
        advancedFields: [
            {
                id: "kickPower",
                label: "⚽ Şut Gücü",
                current: 14, min: 8, max: 25, step: 1,
                desc: "Normal şut hızı (varsayılan: 14)"
            },
            {
                id: "sprintKickBonus",
                label: "🔥 Sprint Şut Bonusu",
                current: 30, min: 0, max: 100, step: 5, unit: "%",
                desc: "Sprint sırasında şut gücü artışı (varsayılan: %30)"
            },
            {
                id: "plasePower",
                label: "🌀 Plase Gücü Oranı",
                current: 75, min: 40, max: 100, step: 5, unit: "%",
                desc: "Plase şutun normal şuta oranı (varsayılan: %75)"
            },
            {
                id: "plaseSpin",
                label: "🎯 Plase Kavis Şiddeti",
                current: 35, min: 10, max: 100, step: 5, unit: "/100",
                desc: "Falso miktarı (yüksek = daha çok kavis)"
            },
            {
                id: "afterTouchTime",
                label: "⏱️ After-Touch Süresi",
                current: 200, min: 0, max: 1000, step: 50, unit: "ms",
                desc: "Şut sonrası kavis verme süresi (varsayılan: 200ms)"
            },
            {
                id: "passAssistPower",
                label: "🎯 Pas Yardım Gücü",
                current: 50, min: 0, max: 100, step: 5, unit: "%",
                desc: "Pas atarken takım arkadaşına kilitlenme oranı (varsayılan: %50)"
            },
            {
                id: "ballMaxSpeed",
                label: "💨 Top Max Hızı",
                current: 18, min: 10, max: 35, step: 1,
                desc: "Topun ulaşabileceği en yüksek hız (varsayılan: 18)"
            },
            {
                id: "sprintMultiplier",
                label: "🏃 Sprint Hız Çarpanı",
                current: 150, min: 100, max: 250, step: 10, unit: "%",
                desc: "Normal hızın kaç katı (varsayılan: %150)"
            },
            {
                id: "sprintDuration",
                label: "⚡ Sprint Süresi",
                current: 3, min: 1, max: 10, step: 1, unit: "sn",
                desc: "Enerji tam doluyken kaç saniye sprint yapılabilir"
            },
            {
                id: "ballStick",
                label: "🧲 Top Kontrolü",
                current: 85, min: 0, max: 100, step: 5, unit: "",
                desc: "0 = Bilardo tarzı (yapışmaz), 100 = Tam yapışık"
            }
        ],
        onSave: (values, advancedValues) => {
            // ✨ Gelişmiş ayarlar aktif mi?
            const advToggle = document.getElementById("advancedToggle");
            const advancedEnabled = advToggle ? advToggle.checked : false;
            
            const allowPlase = values.allowPlase !== "off";  // default açık
            const ballStick = values.ballStick !== "off";    // default açık
            const sprintEnabled = values.sprintEnabled !== "off";  // default açık
            const passAssistance = values.passAssistance !== "off"; // default açık
            
            // 🎵 Gol Müziği Modu
            const goalMusicMode = values.goalMusicMode || "team";
            miniData.goalMusicMode = goalMusicMode;
            try { localStorage.setItem("miniGoalMusicMode", goalMusicMode); } catch(e) {}
            const goalTarget = parseInt(values.goalTarget) || 3;
            const matchDuration = parseInt(values.matchDuration) || 180;
            const gameSpeed = values.gameSpeed || "normal";
           const splitScreen = miniData.splitScreen === true;
            
            // ✨ Tüm ayarları localStorage'a kaydet (oda oluşturma ekranıyla senkron)
            try {
                localStorage.setItem("miniAllowPlase", allowPlase ? "on" : "off");
                localStorage.setItem("miniBallStick", ballStick ? "on" : "off");
                localStorage.setItem("miniPassAssistance", passAssistance ? "on" : "off");
                localStorage.setItem("miniSprintEnabled", sprintEnabled ? "on" : "off");
                if (!advancedEnabled) {
                    // Preset değerleri kaydet (advanced modda özgür değerler kaydetme)
                    localStorage.setItem("miniCreateGoal", String(goalTarget));
                    localStorage.setItem("miniCreateDuration", String(matchDuration));
                }
                localStorage.setItem("miniCreateSpeed", gameSpeed);
                localStorage.setItem("miniCreateSplit", splitScreen ? "on" : "off");
            } catch(e) {}
            
            const kickoffTimeout = parseInt(values.kickoffTimeout) || 10;
            
            // localStorage'a kaydet
            try {
                localStorage.setItem("miniKickoffTimeout", String(kickoffTimeout));
            } catch(e) {}
            
            const payload = {
                type: "mini_update_settings",
                goal_target: goalTarget,
                match_duration: matchDuration,
                game_speed: gameSpeed,
                split_screen: splitScreen,
                allow_plase: allowPlase,
                ball_stick: ballStick,
                sprint_enabled: sprintEnabled,
                pass_assistance: passAssistance,
                goal_music_mode: goalMusicMode,
                player_count: values.playerCount ? parseInt(values.playerCount) : miniData.playerCount,
                spectator_count: values.spectatorCount ? parseInt(values.spectatorCount) : miniData.spectatorCount,
                kickoff_timeout: kickoffTimeout,  // ✨ Santra süresi
                advanced_enabled: advancedEnabled
            };
            
            // Gelişmiş ayarlar açıksa değerleri de gönder
            if (advancedEnabled && advancedValues) {
                payload.advanced = advancedValues;
                try {
                    localStorage.setItem("miniAdvancedSettings", JSON.stringify(advancedValues));
                    localStorage.setItem("miniAdvancedEnabled", "true");
                } catch(e) {}
            } else {
                localStorage.setItem("miniAdvancedEnabled", "false");
            }
            
            send(payload);
        }
    });
}

// ========================================
// LOCAL HP BAŞLATMA (Host + Misafir)
// ========================================
function startMiniLocalPhysicsIfNeeded() {
    if (typeof HP === 'undefined') return false;
    if (!miniData.playerId) return false;
    if (!miniData.players || miniData.players.length === 0) return false;

    const isHost = miniData.playerId === 1;

    // ✨ Sadece HOST yerel fizik motorunu çalıştırır (Misafirde çift fizik savaşı ve titreme engellenir)
    if (!isHost) {
        if (HP.running) HP.stopGame();
        console.log("[GUEST] Misafir modu: Saf ve pürüzsüz Snapshot Interpolasyonuna geçildi ✓");
        return true;
    }

    if (HP.running) return true;

    // ✨ Saha boyutlarını fieldConfig'ten al
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
        // ✨ Kalıcı hafızada bu oyuncunun numarası varsa onu gönder, yoksa lobi verisini kullan
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
        
        // 🌀 GOL SEVİNCİ VE ŞARKISI İÇİN ÜST ÜSTE TEKRAR ETMEYEN GÜÇLÜ KONTROL (Host Otoritesi)
        if (stateMsg.game_state === "goal_wait" && stateMsg.goal_celebration) {
            const _scores = stateMsg.scores ? `${stateMsg.scores["1"]}-${stateMsg.scores["2"]}` : "0-0";
            // scorer_pid = oyuncu, scorer_id = takım (1/2). Animasyon için oyuncu ID şart.
            const _scorerPid = (stateMsg.goal_celebration.scorer_pid !== undefined && stateMsg.goal_celebration.scorer_pid !== null)
                ? stateMsg.goal_celebration.scorer_pid
                : stateMsg.goal_celebration.scorer_id;
            const goalSignature = `${_scorerPid}_${_scores}`;
            const isOwnGoal = stateMsg.goal_celebration.own_goal === true;
            
            if (miniData._lastGoalSigForSeed !== goalSignature) {
                miniData._lastGoalSigForSeed = goalSignature;
                
                // 1) 🎭 GERÇEK GOL SEVİNCİNİ KESİN OLARAK AYARLA (Hizalama ve Zorlama)
                let userChoice = (miniData.playerCelebrationChoices && miniData.playerCelebrationChoices[_scorerPid]) || "random";
                if (userChoice === "random") {
                    const celList = ["grow_explode", "rainbow_trail", "spotlight", "frostbite", "smiley_face", "eagle_wings", "snake"];
                    userChoice = celList[Math.floor(Math.random() * celList.length)];
                }
                miniData._hostSelectedCelebrationType = userChoice;
                
                // 2) 🏆 Takım Havuzları
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

                // Golü atan TAKIMI tespit et
                // ÖNEMLİ:
                //   scorer_id  = Takım ID (1=kırmızı/sol, 2=mavi/sağ)  → MÜZİK buna göre
                //   scorer_pid = Oyuncu ID (admin sağa geçse bile doğru kişi)
                // Takım değişiminde scorer_id'yi oyuncu id sanmak BJK↔GS şarkı tersliğini yapıyordu!
                let actualScoringTeam = "red";
                const scoringTeamId = Number(stateMsg.goal_celebration.scorer_id);
                const realScorerPid = stateMsg.goal_celebration.scorer_pid;

                // 1) Önce gerçek oyuncu ID ile takımı bul (takım değişiminde en doğru kaynak)
                const songScorerObj = (realScorerPid !== undefined && realScorerPid !== null)
                    ? miniData.players.find(p => Number(p.id) === Number(realScorerPid))
                    : null;

                if (songScorerObj && (songScorerObj.team === "red" || songScorerObj.team === "blue")) {
                    actualScoringTeam = isOwnGoal
                        ? (songScorerObj.team === "red" ? "blue" : "red")
                        : songScorerObj.team;
                } else if (scoringTeamId === 1 || scoringTeamId === 2) {
                    // 2) Fallback: scorer_id TAKIM numarasıdır (oyuncu id değil!)
                    actualScoringTeam = (scoringTeamId === 2) ? "blue" : "red";
                    if (isOwnGoal) {
                        actualScoringTeam = (actualScoringTeam === "red") ? "blue" : "red";
                    }
                }

                // Havuzu belirle
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

                // 🛑 ÜST ÜSTE AYNI ŞARKI ÇALMASIN FİLTRESİ
                let availableSongs = teamPool;
                if (teamPool.length > 1 && miniData._lastPlayedSong) {
                    availableSongs = teamPool.filter(s => s !== miniData._lastPlayedSong);
                }
                
                const selectedSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];
                miniData._hostSelectedSong = selectedSong;
                miniData._lastPlayedSong = selectedSong;
            }
            
            // Seçilen şarkıyı ve gol sevincini tüm pakete zorla yazıyoruz (Misafirler de aynısını görsün)
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
        
        // ✨ WebRTC P2P ile bağlı olan misafirlere direkt gönder
        let p2pSent = false;
        if (MiniRTC.connected) {
            p2pSent = MiniRTC.sendMessage(cleanState);
        }
        
        // ✨ P2P tüneli kurulmamış veya sunucu üzerinden bağlı misafirler için WS rölesi
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

// ==========================================================================
// 📱 MOBİL KONTROLLER VE SOKET TETİKLEYİCİSİ
// ==========================================================================
const MiniMobileInput = {
    joystickActive: false,
    joystickTouchId: null,
    joystickStart: { x: 0, y: 0 },
    JOYSTICK_MAX_DIST: 45, // sanal topun ne kadar sürüklenebileceği (px)
    
    // Mobil kontrol panelini ekrana bas
    init() {
        this.destroy(); // Eski kalıntı varsa sil
        
        // 1. Ekran Yan Çevirme Uyarısı Ekle
        const warning = document.createElement("div");
        warning.id = "miniOrientationWarning";
        warning.innerHTML = `
            <div class="warning-content">
                <span class="warning-icon">🔄</span>
                <h3 style="color:#ffd43b; margin:10px 0;">Cihazı Yan Döndürün</h3>
                <p style="font-size:14px; color:#adb5bd; line-height:1.5;">
                    Mini Futbol oynamak için cihazınızı yan döndürün (Landscape) ve otomatik döndürmeyi açın.
                </p>
            </div>
        `;
        document.body.appendChild(warning);
        
        // 2. Joystick ve Butonları Ekle
        const controls = document.createElement("div");
        controls.id = "miniMobileControls";
        controls.innerHTML = `
            <div id="miniJoystickContainer">
                <div id="miniJoystickKnob"></div>
            </div>
            <div id="miniMobileButtons">
                <div id="miniBtnSprint" class="mobileBtn">🏃</div>
                <div id="miniBtnKick" class="mobileBtn">⚽</div>
            </div>
        `;
        document.body.appendChild(controls);
        
        this.setupListeners();
    },
    
    setupListeners() {
        const container = document.getElementById("miniJoystickContainer");
        const knob = document.getElementById("miniJoystickKnob");
        const btnSprint = document.getElementById("miniBtnSprint");
        const btnKick = document.getElementById("miniBtnKick");
        
        if (!container || !knob) return;
        
        // === 🕹️ JOYSTICK HAREKETLERİ ===
        container.addEventListener("touchstart", (e) => {
            e.preventDefault();
            if (this.joystickTouchId !== null) return;
            
            const touch = e.changedTouches[0];
            this.joystickTouchId = touch.identifier;
            this.joystickActive = true;
            
            const rect = container.getBoundingClientRect();
            this.joystickStart = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };
        }, { passive: false });
        
        window.addEventListener("touchmove", (e) => {
            if (!this.joystickActive || this.joystickTouchId === null) return;
            
            let touch = null;
            for (let i = 0; i < e.touches.length; i++) {
                if (e.touches[i].identifier === this.joystickTouchId) {
                    touch = e.touches[i];
                    break;
                }
            }
            if (!touch) return;
            
            const dx = touch.clientX - this.joystickStart.x;
            const dy = touch.clientY - this.joystickStart.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            let knobX = dx;
            let knobY = dy;
            
            if (dist > this.JOYSTICK_MAX_DIST) {
                knobX = (dx / dist) * this.JOYSTICK_MAX_DIST;
                knobY = (dy / dist) * this.JOYSTICK_MAX_DIST;
            }
            
            knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
            
            // Hassas yön tayini (threshold: deadzone katsayısı)
            const threshold = 0.35;
            const moveRight = dx > this.JOYSTICK_MAX_DIST * threshold;
            const moveLeft  = dx < -this.JOYSTICK_MAX_DIST * threshold;
            const moveDown  = dy > this.JOYSTICK_MAX_DIST * threshold;
            const moveUp    = dy < -this.JOYSTICK_MAX_DIST * threshold;
            
            this.sendMobileKey("left", moveLeft);
            this.sendMobileKey("right", moveRight);
            this.sendMobileKey("up", moveUp);
            this.sendMobileKey("down", moveDown);
        }, { passive: false });
        
        const resetJoystick = (e) => {
            if (this.joystickTouchId === null) return;
            
            // Bu event biten touch ile mi alakalı kontrol et
            let touchFinished = false;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === this.joystickTouchId) {
                    touchFinished = true;
                    break;
                }
            }
            
            if (touchFinished) {
                this.joystickTouchId = null;
                this.joystickActive = false;
                knob.style.transform = `translate(0px, 0px)`;
                
                this.sendMobileKey("left", false);
                this.sendMobileKey("right", false);
                this.sendMobileKey("up", false);
                this.sendMobileKey("down", false);
            }
        };
        
        container.addEventListener("touchend", resetJoystick, { passive: false });
        container.addEventListener("touchcancel", resetJoystick, { passive: false });
        
        // === 🏃 DEPAR BUTONU ===
        if (btnSprint) {
            btnSprint.addEventListener("touchstart", (e) => {
                e.preventDefault();
                this.sendMobileKey("sprint", true);
            }, { passive: false });
            
            const releaseSprint = (e) => {
                e.preventDefault();
                this.sendMobileKey("sprint", false);
            };
            btnSprint.addEventListener("touchend", releaseSprint, { passive: false });
            btnSprint.addEventListener("touchcancel", releaseSprint, { passive: false });
        }
        
        // === ⚽ ŞUT BUTONU ===
        if (btnKick) {
            btnKick.addEventListener("touchstart", (e) => {
                e.preventDefault();
                this.sendMobileKey("kick", true);
            }, { passive: false });
            
            const releaseKick = (e) => {
                e.preventDefault();
                this.sendMobileKey("kick", false);
            };
            btnKick.addEventListener("touchend", releaseKick, { passive: false });
            btnKick.addEventListener("touchcancel", releaseKick, { passive: false });
        }
    },
    
    // Klavyeyi taklit eden soket ve yerel HP tetikleyicisi
    sendMobileKey(key, pressed) {
        // ✨ Mobil: Replay sırasında tuş girdilerini engelle (Sadece Enter tuşu geçebilir)
        if (pressed) {
            const gcMob = miniData.gameState && miniData.gameState.goal_celebration;
            const rDurationMob = (gcMob && gcMob.replay_duration) || 10.0;
            const isReplayMob = miniData.gameState &&
                miniData.gameState.game_state === "goal_wait" &&
                gcMob &&
                typeof gcMob.wait_remaining === "number" &&
                gcMob.wait_remaining <= rDurationMob;

            if (isReplayMob) {
                return; // Replay modunda hareket/şut gönderme
            }
        }

        const keyList = miniData.keysPressed;
        if (keyList[key] === pressed) return; // Değişiklik yoksa es geç (Spam engeli)
        
        keyList[key] = pressed;
        
        // 1. Yerel HP fizik motoruna anlık bildir (0 Gecikme hissi)
        if (typeof HP !== 'undefined' && HP.running) {
            HP.setKey(miniData.playerId, key, pressed);
        }
        
        // 2. Şut çekilirse misafir için prediction süresini başlat
        if (key === "kick" && pressed && miniData.playerId !== 1) {
            miniData._recentKickTime = performance.now();
            miniData._shotPredictionUntil = performance.now() + 200;
            miniData._wasNearBall = true;
        }
        
        // 3. WebRTC veya Render WS üzerinden sunucuya gönder
        const msg = { type: "mini_key", key: key, pressed: pressed };
        if (MiniRTC.connected && miniData.playerId !== 1) {
            msg.from_player_id = miniData.playerId;
            msg.target_pid = miniData.playerId;
            MiniRTC.sendMessage(msg);
        } else {
            send(msg);
        }
    },
    
    destroy() {
        this.joystickTouchId = null;
        this.joystickActive = false;
        
        const warning = document.getElementById("miniOrientationWarning");
        if (warning) warning.remove();
        
        const controls = document.getElementById("miniMobileControls");
        if (controls) controls.remove();
    }
};

// ========================================
// OYUN BAŞLATMA
// ========================================
function startMiniGame() {
    console.log("[MINI] Oyun başladı! Player ID:", miniData.playerId, "Split:", miniData.splitScreen);
    
    // ✨ SES FIX (Ctrl+F5 / online cold start)
    try {
        MiniAudio.preloadAll();
        MiniAudio.unlock();
        // Bir frame sonra tekrar (bazı tarayıcılarda ilk jesture geç gelir)
        setTimeout(() => {
            MiniAudio.unlock();
            MiniAudio.preloadAll();
        }, 100);
    } catch (e) {}

    try { document.body.classList.add("mini-game-active"); } catch (e) {}
    // ✨ Kayıtlı gol sevincini hatırla ve hem yerel motora hem host'a anında ilet
    try {
        const list = getCelebPickerList();
        let savedPref = localStorage.getItem("miniPreferredCelebration");
        if (!savedPref && list.length > 0) savedPref = list[0].id;
        
        miniData.preferredCelebration = savedPref;
        const idx = list.findIndex(c => c.id === savedPref);
        const resolvedIdx = idx >= 0 ? idx : 0;
        
        miniData.celebPickerIndex = resolvedIdx;
        miniData.celebVirtualIndex = resolvedIdx;

        // Hem anında hem de WebRTC/soket tam otursun diye 350ms sonra host'a bildir
        applyPreferredCelebration(savedPref);
        setTimeout(() => {
            if (miniData.preferredCelebration) {
                applyPreferredCelebration(miniData.preferredCelebration);
            }
        }, 350);
    } catch (e) {}
    
    // ❄️ Buz resmini yükle
    if (!miniData.iceImage) {
        miniData.iceImage = new Image();
        miniData.iceImage.src = "/oyun_modlari/mini_futbol/ice_surface.jpg";
    }
    miniData.keysPressed = {};
    miniData.keysPressed2 = {};
    miniData._ownGoalsTracker = {}; // ✨ Her yeni maç başında kendi kalesine gol sayaçlarını sıfırla
    miniData._teamOwnGoalsCount = { red: 0, blue: 0 }; // ✨ Takım bazlı kendi kalesine gol sayacı
    miniData._teamPostHits = { red: 0, blue: 0 }; // ✨ Takım bazlı direğe çarpan şut sayacı

    // 🎯 Sitenin footer / Yasal Bilgi kısmını oyun esnasında gizle
    document.querySelectorAll("footer, .footer, #footer, .site-footer").forEach(el => {
        el.style.setProperty("display", "none", "important");
    });
    
    // ✨ HOST SEKMESİ ZIRHI: Admin başka sekmeye geçse bile tarayıcının sekme uykusuna girmesini engeller (Chrome Throttling Zırhı)
    if (miniData.playerId === 1) {
        if (!miniData._keepAliveAudio) {
            try {
                // 1) Sessiz Medya Oynatıcı (Chrome'un pil/sekme uykusu tasarruf modunu tamamen kilitler)
                const silentWav = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==";
                const audioEl = new Audio(silentWav);
                audioEl.loop = true;
                audioEl.volume = 0.001;
                audioEl.play().catch(() => {});

                // 2) Web Audio API Döngüsü (CPU işlemcisini yüksek frekansta canlı tutar)
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
                console.log("[HOST-PHYSICS] Sekme Canlı Tutma Zırhı (Medya + WebAudio) Aktif ✓");
            } catch(e) {}
        }
    }
    
    // ✨ Local HP başlatmayı dene (Host veya Guest fark etmez)
    startMiniLocalPhysicsIfNeeded();
    
    // Skor tablosunu güncelle
    updateMiniHUD();
    
    // Klavye dinle
    window.addEventListener("keydown", miniKeyDown, true);
    window.addEventListener("keyup", miniKeyUp, true);
    
    // Mobil Dokunmatik Kontrolleri Başlat
    MiniMobileInput.init();
    
    // ✨ Gamepad bağlı VE etkinse polling başlat
    if (miniGamepad.connected && miniGamepad.enabled) {
        startGamepadPolling();
    }
    
    // Sağ tık -> context menü engelle
    window.addEventListener("contextmenu", miniPreventContextMenu, true);
    
    // ✨ Sağ tık -> context menü engelle
    // (Fare tıklaması ile skip kaldırıldı, sadece Enter tuşu geçebilir)
    
    // ✨ Named function referansları (stopMiniGame'de kaldırılabilsin - memory leak fix)
    // ✨ Focus kaybında AGRESSİF tuş bırakma (chrome sekme bar sağ tık bug'ı)
    miniData._blurHandler = () => {
        // TAB basılı bile olsa focus kaybında tuşları bırak (bug engeli)
        miniReleaseAllKeys();
        miniTabHeld = false;  // TAB flag'ı sıfırla
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
        // ✨ Host sekme değiştirdiğinde misafirlere "Gecikme olabilir" bildirimi gönder
        if (miniData.playerId === 1) {
            send({ type: "mini_host_visibility", hidden: document.hidden });
        }
    };
    // ✨ Fare canvas dışına çıkarsa da tuşları bırak (extra güvenlik)
    miniData._mouseLeaveHandler = () => {
        // Sadece belirli koşullarda (opsiyonel - istersen aç)
        // miniReleaseAllKeys();
    };
    
    window.addEventListener("blur", miniData._blurHandler, true);
    window.addEventListener("focusout", miniData._blurHandler, true);
    document.addEventListener("visibilitychange", miniData._visibilityHandler, true);
    
    // ✨ Fare belge dışına çıktı (chrome title bar, tab bar, browser UI)
    // → HEMEN tuşları bırak (Chrome native menu klavye focus'u çalıyor)
    miniData._mouseLeaveHandler = (e) => {
        // Fare gerçekten belge dışına çıktı mı? (e.relatedTarget null olur)
        if (!e.relatedTarget && !e.toElement) {
            miniReleaseAllKeys();
        }
    };
    document.documentElement.addEventListener("mouseleave", miniData._mouseLeaveHandler, true);
    
    // ✨ Ek güvenlik: her 500ms focus kontrolü
    // Chrome context menu açıksa document.hasFocus() false döner
    miniData._focusCheckInterval = setInterval(() => {
        if (!document.hasFocus()) {
            miniReleaseAllKeys();
        }
    }, 500);
    
    // ✨ Kontrol bilgisini güncelle (kullanıcı ayarlarına göre dinamik)
    updateMiniControlsInfo();
    
    // Render başlat
    if (miniAnimFrame) cancelAnimationFrame(miniAnimFrame);
    miniAnimFrame = requestAnimationFrame(miniRender);
    
    // ✨ MİSAFİR için ilkel prediction kapatıldı. Local HP fizik motoru artık tek başına yetkilidir ✓
    miniData.predictionActive = false;
    miniData.predictedSelf = null;
}

// ✨ Kontrol bilgisini güncelle (klavye + gamepad + kullanıcı ayarlarına göre)
function updateMiniControlsInfo() {
    const controlsEl = document.getElementById("miniControlsInfo");
    if (!controlsEl) return;
    
    const p1Keys = getSavedKeys("p1");
    
    // Klavye tuşlarını okunabilir formatta
    const kMove = `${keyLabel(p1Keys.up)} ${keyLabel(p1Keys.left)} ${keyLabel(p1Keys.down)} ${keyLabel(p1Keys.right)}`;
    const kKick = keyLabel(p1Keys.kick);
    const kSprint = keyLabel(p1Keys.sprint);
    
    // Gamepad P1'de mi?
    const gpP1 = miniGamepad.connected && miniGamepad.slot === "p1";
    // Gamepad P2'de mi?
    const gpP2 = miniGamepad.connected && miniGamepad.slot === "p2";
    
    // Split-screen aktif mi?
    const isSplitOwner = miniData.splitScreen && miniData.splitOwner === miniData.playerId;
    
    // === TEK OYUNCU (P1) ===
    if (!isSplitOwner) {
        if (gpP1) {
            controlsEl.innerHTML = `
                <div style="color:#c084fc;">
                    🎮 <b>Kontrolcü:</b> Sol Stick / D-Pad hareket &nbsp;|&nbsp; X / Kare şut &nbsp;|&nbsp; R2 sprint &nbsp;|&nbsp; <b>START</b> Atla ⏭️
                </div>
                <div style="color:#adb5bd; margin-top:4px; font-size:12px;">
                    ⌨️ (Klavye: ${kMove} | ${kKick} | ${kSprint} &nbsp;|&nbsp; <b>ENTER</b> Replay Atla)
                </div>
            `;
        } else {
            controlsEl.innerHTML = `<b>Hareket:</b> ${kMove} / Ok Tuşları &nbsp;|&nbsp; <b>Şut:</b> ${kKick} / Num 0 &nbsp;|&nbsp; <b>Sprint:</b> ${kSprint} ⚡ &nbsp;|&nbsp; <b>Replay Atla:</b> ENTER ⏭️`;
        }
        return;
    }
    
    // === SPLIT-SCREEN (P1 + P2) ===
    let p1Line = "";
    let p2Line = "";
    
    if (gpP1) {
        p1Line = `🎮 <b>P1:</b> Stick | X / Kare şut | R2 sprint | <b>START</b> Atla ⏭️`;
    } else {
        p1Line = `⌨️ <b>P1:</b> ${kMove} | ${kKick} | ${kSprint} | <b>ENTER</b> Atla ⏭️`;
    }
    
    if (gpP2) {
        p2Line = `🎮 <b>P2:</b> Stick | X / Kare şut | R2 sprint | <b>START</b> Atla ⏭️`;
    } else {
        p2Line = `⌨️ <b>P2:</b> Oklar | Num 0 şut | Num 1 sprint | <b>ENTER</b> Atla ⏭️`;
    }
    
    controlsEl.innerHTML = `
        <div style="color:#ff6b6b;">${p1Line}</div>
        <div style="color:#4dabf7; margin-top:4px;">${p2Line}</div>
    `;
}

// ✨ Oyun içinde sağ tık context menüsünü engelle (Oyuncu satırlarına izin ver)
function miniPreventContextMenu(e) {
    // Sadece oyun ekranındaysa engelle
    const gameScreen = document.getElementById("miniGameScreen");
    if (gameScreen && !gameScreen.classList.contains("hidden")) {
        // ✨ ESC Duraklatma Menüsündeki oyuncu satırlarına sağ tık serbest (Forma numarası değiştirebilsin)
        if (e.target && (e.target.closest(".miniPlayerRow") || e.target.closest("#miniJerseyEditor"))) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
    }
}

// ✨ Tüm basılı tuşları serbest bırak (P1 + P2)
function miniReleaseAllKeys() {
    // P1
    for (const key in miniData.keysPressed) {
        if (miniData.keysPressed[key]) {
            miniData.keysPressed[key] = false;
            send({ type: "mini_key", key: key, pressed: false });
            // ✨ HOST fizik motoruna da bildir (0 latency)
            if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running) {
                HP.setKey(miniData.playerId, key, false);
            }
        }
    }
    // P2 (split-screen)
    for (const key in miniData.keysPressed2) {
        if (miniData.keysPressed2[key]) {
            miniData.keysPressed2[key] = false;
            const msg = { type: "mini_key", key: key, pressed: false };
            if (miniData.splitSlaveId) msg.for_player_id = miniData.splitSlaveId;
            send(msg);
            // ✨ HOST fizik motoruna da bildir
            if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running && miniData.splitSlaveId) {
                HP.setKey(miniData.splitSlaveId, key, false);
            }
        }
    }
    // ✨ Gamepad tuşlarını da bırak
    if (typeof gpPrevState !== "undefined") {
        for (const key in gpPrevState) {
            if (gpPrevState[key]) {
                gpPrevState[key] = false;
                sendGamepadKey(key, false);
            }
        }
    }
}

// ========================================
// 💬 CHAT FONKSİYONLARI
// ========================================

function showMiniChat() {
    const container = document.getElementById("miniChatContainer");
    if (container) container.style.display = "block";
}

function hideMiniChat() {
    const container = document.getElementById("miniChatContainer");
    if (container) container.style.display = "none";
    closeMiniChatPanel();
    miniChat.messages = [];
    miniChat.unread = 0;
    miniChat.typingPlayers = {};
    const msgBox = document.getElementById("miniChatMessages");
    if (msgBox) msgBox.innerHTML = "";
    // 💬 Popup baloncukları da temizle
    clearMiniChatPopups();
}

function toggleMiniChatPanel() {
    if (miniChat.open) {
        closeMiniChatPanel();
    } else {
        openMiniChatPanel();
    }
}

function openMiniChatPanel() {
    miniChat.open = true;
    miniChat.unread = 0;
    const panel = document.getElementById("miniChatPanel");
    const badge = document.getElementById("miniChatBadge");
    if (panel) {
        panel.style.setProperty("display", "flex", "important");
    }
    if (badge) badge.style.display = "none";
    // 💬 Popup baloncukları temizle
    clearMiniChatPopups();
    
    // ✨ Chat dışına tıklayınca kapatma dinleyicisi
    setTimeout(() => {
        document.addEventListener("mousedown", miniChatOutsideClickHandler, true);
    }, 100);
    // Scroll aşağı
    const msgBox = document.getElementById("miniChatMessages");
    if (msgBox) setTimeout(() => { msgBox.scrollTop = msgBox.scrollHeight; }, 50);
    // Input'a focus
    const input = document.getElementById("miniChatInput");
    if (input) setTimeout(() => input.focus(), 100);
}

function closeMiniChatPanel() {
    miniChat.open = false;
    const panel = document.getElementById("miniChatPanel");
    if (panel) panel.style.display = "none";
    // ✨ Outside click dinleyicisini kaldır
    document.removeEventListener("mousedown", miniChatOutsideClickHandler, true);
    // ✨ Input'u temizle
    const input = document.getElementById("miniChatInput");
    if (input && input.value) input.value = "";
}

// Chat dışına tıklandığında paneli kapat
function miniChatOutsideClickHandler(e) {
    const container = document.getElementById("miniChatContainer");
    if (!container) return;
    // Tıklama chat container içindeyse yoksay
    if (container.contains(e.target)) return;
    // Dışarıya tıklandı → kapat
    closeMiniChatPanel();
}

function sendMiniChatMessage() {
    const input = document.getElementById("miniChatInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    if (text.length > 100) return;
    input.value = "";
    // ✨ Chat her zaman WS'den gitsin (chat history için backend gerekli)
    send({ type: "mini_chat_send", text: text });
}

function showMiniChatPopup(msg) {
    // Chat açıksa popup gösterme
    if (miniChat.open) return;
    // Sistem mesajı popup olmasın
    if (msg.system) return;

    const stack = document.getElementById("miniChatPopupStack");
    if (!stack) return;
    stack.style.display = "flex";

    const popup = document.createElement("div");
    popup.className = "miniChatPopup";
    if (msg.team === "red") popup.classList.add("teamRed");
    else if (msg.team === "blue") popup.classList.add("teamBlue");
    else popup.classList.add("teamSpec");

    // İsim rengi
    let nameColor = "#adb5bd";
    if (msg.team === "red") nameColor = "#ff8a8a";
    else if (msg.team === "blue") nameColor = "#7abfff";

    const nameSpan = document.createElement("span");
    nameSpan.className = "miniChatPopupName";
    nameSpan.style.color = nameColor;
    nameSpan.textContent = msg.sender_name;

    const textSpan = document.createElement("span");
    textSpan.className = "miniChatPopupText";
    textSpan.textContent = msg.text;

    popup.appendChild(nameSpan);
    popup.appendChild(textSpan);
    stack.appendChild(popup);

    // Max 5 popup - fazlaysa en eskisini hemen sil
    while (stack.children.length > 5) {
        stack.removeChild(stack.firstChild);
    }

    // 3 saniye sonra çıkış animasyonu
    setTimeout(() => {
        popup.classList.add("leaving");
        setTimeout(() => {
            if (popup.parentNode) popup.parentNode.removeChild(popup);
            // Stack boşsa gizle
            if (stack.children.length === 0) stack.style.display = "none";
        }, 350);
    }, 3000);
}

function clearMiniChatPopups() {
    const stack = document.getElementById("miniChatPopupStack");
    if (!stack) return;
    stack.innerHTML = "";
    stack.style.display = "none";
}

function addMiniChatMessage(msg) {
    // msg: {sender_id, sender_name, text, team, ts, system}
    miniChat.messages.push(msg);
    if (miniChat.messages.length > miniChat.maxMessages) {
        miniChat.messages.shift();
    }

    const msgBox = document.getElementById("miniChatMessages");
    if (!msgBox) return;

    const div = document.createElement("div");
    div.className = "miniChatMsg";

    if (msg.system) {
        div.classList.add("systemMsg");
        div.textContent = msg.text;
    } else {
        const nameSpan = document.createElement("span");
        nameSpan.className = "chatName";
        // İsim rengi takıma göre
        if (msg.team === "red") nameSpan.style.color = "#ff8a8a";
        else if (msg.team === "blue") nameSpan.style.color = "#7abfff";
        else nameSpan.style.color = "#adb5bd";
        nameSpan.textContent = msg.sender_name + ":";

        const textSpan = document.createElement("span");
        textSpan.className = "chatText";
        textSpan.textContent = " " + msg.text;

        div.appendChild(nameSpan);
        div.appendChild(textSpan);
    }

    msgBox.appendChild(div);

    // Max mesaj aşımında eski DOM elemanlarını sil
    while (msgBox.children.length > miniChat.maxMessages) {
        msgBox.removeChild(msgBox.firstChild);
    }

    // Scroll aşağı (panel açıksa)
    if (miniChat.open) {
        msgBox.scrollTop = msgBox.scrollHeight;
    }

    // Panel kapalıysa badge güncelle + popup göster
    if (!miniChat.open && !msg.system) {
        miniChat.unread++;
        const badge = document.getElementById("miniChatBadge");
        if (badge) {
            badge.textContent = miniChat.unread;
            badge.style.display = "flex";
            // Pop animasyonu tekrar tetikle
            badge.style.animation = "none";
            badge.offsetHeight; // reflow
            badge.style.animation = "chatBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        }
        // 💬 Popup baloncuk göster (3 sn)
        showMiniChatPopup(msg);
    }
}

function stopMiniGame() {
    window.removeEventListener("keydown", miniKeyDown, true);
    window.removeEventListener("keyup", miniKeyUp, true);
    window.removeEventListener("contextmenu", miniPreventContextMenu, true);
    
    // Mobil Dokunmatik Kontrolleri Kaldır
    MiniMobileInput.destroy();
    
    // ✨ Blur + visibilitychange listener'larını kaldır (memory leak fix)
    if (miniData._blurHandler) {
        window.removeEventListener("blur", miniData._blurHandler, true);
        window.removeEventListener("focusout", miniData._blurHandler, true);  // ✨ Ek
        miniData._blurHandler = null;
    }
    if (miniData._visibilityHandler) {
        document.removeEventListener("visibilitychange", miniData._visibilityHandler, true);
        miniData._visibilityHandler = null;
    }
    
    // ✨ Mouse leave + focus check interval temizle
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
    // Tüm tuşları bırak (P1 + P2)
    miniReleaseAllKeys();
    miniData.keysPressed = {};
    miniData.keysPressed2 = {};
    
    // ✨ Local fizik motorunu durdur ve callbackleri temizle
    if (typeof HP !== 'undefined') {
        HP.onStateUpdate = null;
        HP.onGoal = null;
        HP.onGameOver = null;
        if (HP.running) HP.stopGame();
    }
    
    // ✨ Keep-alive audio kapat
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
    
    // ✨ Gamepad polling'i durdur
    stopGamepadPolling();
    
    // ✨ Titreşimi durdur
    if (typeof MiniVibration !== "undefined") {
        MiniVibration.stop();
    }
    
    // ✨ WebRTC bağlantısını kapat
    MiniRTC.reset();
    console.log("[WebRTC] Bağlantı kapatıldı (oyun bitti).");
    
    // ✨ Bağlantı göstergesini kaldır
    const badge = document.getElementById("miniConnBadge");
    if (badge) badge.style.display = "none";
    
    const hostBadge = document.getElementById("miniHostVisibilityBadge");
    if (hostBadge) hostBadge.style.display = "none";
    
    // ✨ Tıklama dinleyicisini temizle
    if (miniData._canvasClickHandler) {
        window.removeEventListener("click", miniData._canvasClickHandler, true);
        miniData._canvasClickHandler = null;
    }
    
    // ✨ Prediction'ı sıfırla
    miniData.predictionActive = false;
    miniData.predictedSelf = null;
    miniData.predictedKeys = {up:false, down:false, left:false, right:false, sprint:false};
    
    // ✨ Render smoothing state'ini temizle
    miniData._renderSmoothed = {};
    miniData._ballRenderPos = null;
    miniData._hostRenderSmoothed = null; // ✨ Host interpolasyon önbelleğini temizle

    try {
        document.body.classList.remove("mini-game-active");
        closeCelebPicker(true);
    } catch (e) {}

    // 🎯 Oyundan çıkınca footer'ı geri göster
    document.querySelectorAll("footer, .footer, #footer, .site-footer").forEach(el => {
        el.style.removeProperty("display");
    });
}

// ========================================
// KLAVYE (Split-screen destekli)
// ========================================
function miniKeyDown(e) {
    // ✨ Herhangi bir input/textarea odakta ise oyun tuşlarını yoksay
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;  // Yazı yazıyor, oyun kontrolüne izin verme
    }
    
    // ✨ Herhangi bir popup açıksa oyun tuşlarını yoksay
    const openPopups = [
        "miniNameEditor", "miniTeamNameEditor", "miniResetNamesConfirm",
        "miniRestartConfirm", "miniLobbyReturnConfirm", "miniGuestLobbyConfirm",
        "miniKickConfirm", "miniControlSettings", "roomSettingsBox"
    ];
    for (const id of openPopups) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains("hidden")) {
            return;  // Popup açık, oyun kontrolüne izin verme
        }
    }
    
    // ✨ SADECE REPLAY MODUNDA skip + hareket kilidi
    // Gol sevinci (wait_remaining > replay_duration) → hareket SERBEST, skip SAYILMAZ
    const gc = miniData.gameState && miniData.gameState.goal_celebration;
    const rDurationK = (gc && gc.replay_duration) || 10.0;
    const isReplayMode = miniData.gameState &&
        miniData.gameState.game_state === "goal_wait" &&
        gc &&
        typeof gc.wait_remaining === "number" &&
        gc.wait_remaining <= rDurationK;

    // Sevinç aşamasında skip bayrağını temiz tut (yanlışlıkla kilitlenmesin)
    if (miniData.gameState &&
        miniData.gameState.game_state === "goal_wait" &&
        gc &&
        typeof gc.wait_remaining === "number" &&
        gc.wait_remaining > rDurationK) {
        miniData._hasSkippedReplay = false;
    }

    if (isReplayMode) {
        // ✨ TAB tuşuna izin ver (Replay sırasında Scoreboard açılabilsin)
        if (e.key === "Tab") return;

        // 🎉 1/2 tuşlarıyla gol sevinci değiştirmeye izin ver (Replay sırasında da)
        if (!e.repeat && (e.key === "1" || e.code === "Digit1" || e.code === "Numpad1" ||
                          e.key === "2" || e.code === "Digit2" || e.code === "Numpad2")) {
            e.preventDefault();
            e.stopPropagation();
            const dir = (e.key === "1" || e.code === "Digit1" || e.code === "Numpad1") ? -1 : 1;
            handleCelebPickerKey(dir);
            return;
        }

        e.preventDefault();
        e.stopPropagation();
        
        // ✨ SADECE ENTER TUŞU İLE SKIP! (Diğer tuşlar atlamaz)
        const isEnterKey = (e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter");
        
        if (isEnterKey && !miniData._hasSkippedReplay) {
            miniData._hasSkippedReplay = true;
            const myPid = parseInt(miniData.playerId, 10);
            
            if (myPid === 1 && typeof HP !== 'undefined' && HP.running) {
                HP.registerSkip(1);
            } else {
                const skipMsg = { type: "mini_skip_replay", from_pid: myPid };
                if (typeof MiniRTC !== "undefined" && MiniRTC.connected) {
                    MiniRTC.sendMessage(skipMsg);
                }
                send(skipMsg);
            }
        }
        return; // Replay'de karakter hareket etmesin
    }

    // 🎉 GOL SEVİNCİ SEÇİCİ — 1 sola, 2 sağa
    if (!e.repeat && (e.key === "1" || e.code === "Digit1" || e.code === "Numpad1" ||
                      e.key === "2" || e.code === "Digit2" || e.code === "Numpad2")) {
        // Chat/input zaten yukarıda elendi
        e.preventDefault();
        e.stopPropagation();
        const dir = (e.key === "1" || e.code === "Digit1" || e.code === "Numpad1") ? -1 : 1;
        handleCelebPickerKey(dir);
        return;
    }

    // ✨ Oyun Tuşunu Al (Fix)
    const result = getMiniKey(e);
    if (!result) return;
    
    // ✨ Sayfanın aşağı kaymasını (Space/Ok Tuşları) ÖNCE engelle!
    e.preventDefault();
    e.stopPropagation();
    
    const { key, forPlayer } = result;
    
    // Hangi tuş listesi kullanılacak?
    const keyList = (forPlayer === 2) ? miniData.keysPressed2 : miniData.keysPressed;
    
    // ✨ Zaten basılıysa tekrar gönderme - AMA KICK için istisna
    if (keyList[key]) return;
    
    keyList[key] = true;
    
    // ✨ Local HP'ye işle (host + misafir)
    if (typeof HP !== 'undefined' && HP.running) {
        const targetPid = (forPlayer === 2 && miniData.splitSlaveId) ? miniData.splitSlaveId : miniData.playerId;
        HP.setKey(targetPid, key, true);
    }
    
    // ✨ Şut çektiysem misafirsen: KISA süre HP kontrolde (çok uzun olursa fizik farkı büyür)
    if (key === "kick" && miniData.playerId !== 1) {
        miniData._recentKickTime = performance.now();
        miniData._shotPredictionUntil = performance.now() + 200;  // Sadece 200ms tam kontrol
        // "topu sürüyor" flag'ini de zorla true yap
        miniData._wasNearBall = true;
    }
    
    // ✨ WebRTC bağlıysa DataChannel'dan gönder, değilse Render WS
    const msg = { type: "mini_key", key: key, pressed: true };
    if (forPlayer === 2 && miniData.splitSlaveId) {
        msg.for_player_id = miniData.splitSlaveId;
    }
    if (MiniRTC.connected && miniData.playerId !== 1) {
        // ✨ Misafir: kendi player_id'sini ekle ki host bilsin
        msg.from_player_id = miniData.playerId;
        msg.target_pid = miniData.playerId;
        MiniRTC.sendMessage(msg);
    } else {
        send(msg);
    }
}

function miniKeyUp(e) {
    // ✨ Input/textarea odakta ise yoksay
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        return;
    }
    
    const result = getMiniKey(e);
    if (!result) return;
    
    e.preventDefault();
    
    const { key, forPlayer } = result;
    const keyList = (forPlayer === 2) ? miniData.keysPressed2 : miniData.keysPressed;
    
    if (!keyList[key]) return;
    
    keyList[key] = false;
    
    // ✨ Local HP'ye işle (host + misafir)
    if (typeof HP !== 'undefined' && HP.running) {
        const targetPid = (forPlayer === 2 && miniData.splitSlaveId) ? miniData.splitSlaveId : miniData.playerId;
        HP.setKey(targetPid, key, false);
    }
    
    const msg = { type: "mini_key", key: key, pressed: false };
    if (forPlayer === 2 && miniData.splitSlaveId) {
        msg.for_player_id = miniData.splitSlaveId;
    }
    if (MiniRTC.connected && miniData.playerId !== 1) {
        // ✨ Misafir: kendi player_id'sini ekle
        msg.from_player_id = miniData.playerId;
        msg.target_pid = miniData.playerId;
        MiniRTC.sendMessage(msg);
    } else {
        send(msg);
    }
}

function getMiniKey(e) {
    const k = e.key.toLowerCase();
    const code = e.code;
    const isSplit = miniData.splitScreen && miniData.splitOwner === miniData.playerId;
    
    // ✨ Kullanıcının kaydettiği tuşları oku
    const p1Keys = getSavedKeys("p1");
    
    // === P1 KONTROLLERI (kullanıcı ayarlarına göre) ===
    if (code === p1Keys.up || (p1Keys.up === "w" && k === "w")) return { key: "up", forPlayer: 1 };
    if (code === p1Keys.down || (p1Keys.down === "s" && k === "s")) return { key: "down", forPlayer: 1 };
    if (code === p1Keys.left || (p1Keys.left === "a" && k === "a")) return { key: "left", forPlayer: 1 };
    if (code === p1Keys.right || (p1Keys.right === "d" && k === "d")) return { key: "right", forPlayer: 1 };
    if (code === p1Keys.kick || (p1Keys.kick === "Space" && (k === " " || code === "Space"))) return { key: "kick", forPlayer: 1 };
    if (code === p1Keys.sprint) return { key: "sprint", forPlayer: 1 };
    
    // === P2 KONTROLLERI (Ok Tuşları + Sağ Shift/Num1 sprint + Num0/Sağ Ctrl şut) ===
    if (isSplit) {
        // Split-screen aktifse P2 tuşları P2'ye gider
        if (k === "arrowup") return { key: "up", forPlayer: 2 };
        if (k === "arrowdown") return { key: "down", forPlayer: 2 };
        if (k === "arrowleft") return { key: "left", forPlayer: 2 };
        if (k === "arrowright") return { key: "right", forPlayer: 2 };
        if (code === "Numpad0" || code === "ControlRight") return { key: "kick", forPlayer: 2 };
        if (code === "ShiftRight" || code === "Numpad1") return { key: "sprint", forPlayer: 2 };  // ✨ Num1 eklendi
    } else {
        // Split kapalıysa Ok Tuşları da P1'e gider (klasik davranış)
        if (k === "arrowup") return { key: "up", forPlayer: 1 };
        if (k === "arrowdown") return { key: "down", forPlayer: 1 };
        if (k === "arrowleft") return { key: "left", forPlayer: 1 };
        if (k === "arrowright") return { key: "right", forPlayer: 1 };
        if (code === "Numpad0") return { key: "kick", forPlayer: 1 };
        if (code === "ShiftRight" || code === "Numpad1") return { key: "sprint", forPlayer: 1 };  // ✨ Num1 eklendi
    }
    
    return null;
}

// ========================================
// RENDER (60 FPS)
// ========================================
function miniRender() {
    const canvas = document.getElementById("miniCanvas");
    if (!canvas) {
        miniAnimFrame = requestAnimationFrame(miniRender);
        return;
    }
    
    const ctx = canvas.getContext("2d");
    const cfg = miniData.fieldConfig;
    if (!cfg) {
        miniAnimFrame = requestAnimationFrame(miniRender);
        return;
    }
    
    // ✨ Canvas boyutu - sahadan biraz geniş
    const OUT_MARGIN = 55;
    canvas.width = cfg.width + OUT_MARGIN * 2;
    canvas.height = cfg.height + OUT_MARGIN * 2;
    
    // ✨ Koordinat sistemini kaydır
    ctx.save();
    ctx.translate(OUT_MARGIN, OUT_MARGIN);
    
    // === DIŞ ALAN (Saha dışı, koyu yeşil) ===
    ctx.fillStyle = "#1e5828";
    ctx.fillRect(-OUT_MARGIN, -OUT_MARGIN, cfg.width + OUT_MARGIN * 2, cfg.height + OUT_MARGIN * 2);
    
    // === SAHA (İç alan) ===
    ctx.fillStyle = "#2f7d3f";
    ctx.fillRect(0, 0, cfg.width, cfg.height);
    
    // Çizgili desen
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let i = 0; i < cfg.width; i += 60) {
        if ((i / 60) % 2 === 0) {
            ctx.fillRect(i, 0, 60, cfg.height);
        }
    }
    
    // Orta çizgi
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cfg.width / 2, 0);
    ctx.lineTo(cfg.width / 2, cfg.height);
    ctx.stroke();
    
    // Orta yuvarlak
    const kickoffActive = miniData.gameState && miniData.gameState.kickoff && miniData.gameState.kickoff.active;
    if (kickoffActive) {
        ctx.strokeStyle = "rgba(255, 107, 107, 0.7)";
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
    }
    ctx.beginPath();
    ctx.arc(cfg.width / 2, cfg.height / 2, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Orta çizgi (santra kısıtlaması)
    if (kickoffActive && miniData.gameState && miniData.gameState.kickoff) {
        const restrictedTeam = miniData.gameState.kickoff.restricted_team;
        ctx.strokeStyle = "rgba(255, 107, 107, 0.6)";
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        if (restrictedTeam === 1) {
            ctx.moveTo(cfg.width / 2, 0);
            ctx.lineTo(cfg.width / 2, cfg.height);
        } else {
            ctx.moveTo(cfg.width / 2, 0);
            ctx.lineTo(cfg.width / 2, cfg.height);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = "rgba(255, 80, 80, 0.08)";
        if (restrictedTeam === 1) {
            ctx.fillRect(0, 0, cfg.width / 2, cfg.height);
        } else {
            ctx.fillRect(cfg.width / 2, 0, cfg.width / 2, cfg.height);
        }
    }
    
    // === KALELER ===
    const goalY = (cfg.height - cfg.goal_width) / 2;
    const postRadius = 6;
    const goalCurve = 60;
    
    // Sol Kale
    const leftGoalX = 0;
    ctx.fillStyle = "#ffcccc";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(leftGoalX, goalY, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(leftGoalX, goalY + cfg.goal_width, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftGoalX, goalY);
    ctx.bezierCurveTo(
        leftGoalX - goalCurve, goalY + 15,
        leftGoalX - goalCurve, goalY + cfg.goal_width - 15,
        leftGoalX, goalY + cfg.goal_width
    );
    ctx.stroke();
    
    // Sağ Kale
    const rightGoalX = cfg.width;
    ctx.fillStyle = "#ccddff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rightGoalX, goalY, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(rightGoalX, goalY + cfg.goal_width, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rightGoalX, goalY);
    ctx.bezierCurveTo(
        rightGoalX + goalCurve, goalY + 15,
        rightGoalX + goalCurve, goalY + cfg.goal_width - 15,
        rightGoalX, goalY + cfg.goal_width
    );
    ctx.stroke();
    
    // === OYUNCULAR ve TOP ===
        const state = miniData.gameState;
        if (state) {
            // === 🎥 REPLAY KONTROLÜ (DİNAMİK AKICI + SES) ===
            let isReplayMode = false;
            let replayFrameData = null;
            
            const isGoalWait = (state.game_state === "goal_wait" && state.goal_celebration);
            const waitRemaining = isGoalWait ? state.goal_celebration.wait_remaining : 999;
            const rDuration = (state.goal_celebration && state.goal_celebration.replay_duration) || 10.0;
            
            // ✨ (Arkaplan sekme hatasını önlemek için kayıt işlemi socket/network handler içine taşındı)
            
            // Replay Oynat (Dinamik Süreli %100 Senkronize Oynatıcı)
            if (isGoalWait && waitRemaining <= rDuration) {
                const clip = miniReplay.lockedBuffer || miniReplay.buffer;
                if (clip && clip.length > 0) {
                    if (!miniReplay.playedReplayEvents) {
                        miniReplay.playedReplayEvents = new Set();
                    }
                    
                    const maxReplayWindow = rDuration * 1000; // Replay yayın süresi penceresi (ms)
                    // ⏱️ %100 SENKRONİZE SÜRE HESABI:
                    const elapsed = Math.max(0, Math.min(maxReplayWindow, (rDuration - waitRemaining) * 1000));
                    
                    const totalClipDuration = clip[clip.length - 1].t - clip[0].t; // Klibin gerçek uzunluğu (ms)
                    
                    // ✨ BAŞLANGIÇTA TAM 1 SANİYE (1000ms) DONMA / BEKLEME
                    const startDelay = 1000;
                    
                    let targetTimeOffset = 0;
                    let activePlaybackStarted = false;
                    
                    if (elapsed < startDelay) {
                        // Sinematik Başlangıç: 1 saniye boyunca başlangıç karesinde donup beklesin
                        targetTimeOffset = 0;
                        activePlaybackStarted = false;
                    } else {
                        // ✨ %100 GERÇEK ZAMANLI AKICI REPLAY (Slow-Motion Yavaşlatması Kaldırıldı!)
                        const activeElapsed = elapsed - startDelay;
                        
                        // Klip canlı oynandığı andaki birebir gerçek hızıyla (1.0x) akar, bitince gol anında sabit kalır
                        targetTimeOffset = Math.min(totalClipDuration, activeElapsed);
                        activePlaybackStarted = true;
                    }
                
                // Binary Search ile hedef zamana en yakın frame'i anında bul (Takılmayı önler)
                let low = 0;
                let high = clip.length - 1;
                let frameIndex = 0;
                while (low <= high) {
                    const mid = Math.floor((low + high) / 2);
                    const frameOffset = clip[mid].t - clip[0].t;
                    if (frameOffset <= targetTimeOffset) {
                        frameIndex = mid;
                        low = mid + 1;
                    } else {
                        high = mid - 1;
                    }
                }
                
                replayFrameData = clip[frameIndex].data;
                isReplayMode = true;

                // 🔊 Replay Sesleri - Sadece donma süresi bittiğinde ve gerçek akış başladığında çal
                if (replayFrameData && activePlaybackStarted) {
                    if (!miniReplay.playedReplayEvents) miniReplay.playedReplayEvents = new Set();

                    // ⚽ REPLAY GOL SESİ: Top ağlara girdiği an tribün coşkusu çalsın!
                    if (replayFrameData.goal_event) {
                        const g = replayFrameData.goal_event;
                        const key = `g_${g.scorer}_${g.scores ? (g.scores['1'] + '_' + g.scores['2']) : g.time}`;
                        if (!miniReplay.playedReplayEvents.has(key)) {
                            miniReplay.playedReplayEvents.add(key);
                            MiniAudio.playRandom("goal", ["goal_1.mp3", "goal_2.mp3", "goal_3.mp3"], 0.7);
                        }
                    }

                    if (replayFrameData.kick_effects && replayFrameData.kick_effects.length > 0) {
                        replayFrameData.kick_effects.forEach(k => {
                            const key = `k_${k.player_id}_${k.time}`;
                            if (!miniReplay.playedReplayEvents.has(key)) {
                                miniReplay.playedReplayEvents.add(key);
                                if (k.hit_ball) {
                                    const isFire = replayFrameData.ball && replayFrameData.ball.on_fire;
                                    if (isFire) {
                                        MiniAudio.playRandom("fire_kick", ["fire_kick_1.mp3", "fire_kick_2.mp3", "fire_kick_3.mp3"], 0.7);
                                    } else {
                                        MiniAudio.playRandom("kick", ["kick_1.mp3", "kick_2.mp3"], 0.5);
                                    }
                                }
                            }
                        });
                    }

                    if (replayFrameData.hit_events && replayFrameData.hit_events.length > 0) {
                        replayFrameData.hit_events.forEach(h => {
                            const key = `h_${h.type}_${h.time}`;
                            if (!miniReplay.playedReplayEvents.has(key)) {
                                miniReplay.playedReplayEvents.add(key);
                                if (h.type === "wall") {
                                    MiniAudio.playRandom("wall", ["wall_hit_1.mp3", "wall_hit_2.mp3"], 0.4);
                                } else if (h.type === "post") {
                                    MiniAudio.play("post_hit.mp3", 0.6);
                                }
                            }
                        });
                    }
                }
            }
        }

        // ✨ PÜRÜZSÜZ HERMITE/LINEAR SNAPSHOT İNTERPOLASYONU (60 FPS Akıcılık)
        const renderTime = performance.now() - (miniData.interpDelay || 45);
        const snaps = miniData.snapshots;
        
        if (snaps.length >= 2) {
            let before = null;
            let after = null;
            for (let i = snaps.length - 2; i >= 0; i--) {
                if (snaps[i].t <= renderTime && snaps[i + 1].t >= renderTime) {
                    before = snaps[i];
                    after = snaps[i + 1];
                    break;
                }
            }
            
            if (before && after) {
                const span = after.t - before.t;
                const alpha = span > 0 ? Math.max(0, Math.min(1, (renderTime - before.t) / span)) : 0;
                
                // Oyuncuları enterpole et
                for (const pid in after.players) {
                    if (before.players && before.players[pid]) {
                        const bx = before.players[pid].x;
                        const by = before.players[pid].y;
                        const ax = after.players[pid].x;
                        const ay = after.players[pid].y;
                        miniData.currentPositions["p" + pid] = {
                            x: bx + (ax - bx) * alpha,
                            y: by + (ay - by) * alpha
                        };
                    } else {
                        miniData.currentPositions["p" + pid] = {
                            x: after.players[pid].x,
                            y: after.players[pid].y
                        };
                    }
                }
                
                // Topu enterpole et
                if (before.ball && after.ball) {
                    miniData.currentPositions.ball = {
                        x: before.ball.x + (after.ball.x - before.ball.x) * alpha,
                        y: before.ball.y + (after.ball.y - before.ball.y) * alpha
                    };
                }
            } else if (snaps.length > 0) {
                // Buffer sınırında en son kareye yumuşakça yaklaş (Extrapolation koruması)
                const last = snaps[snaps.length - 1];
                for (const pid in last.players) {
                    const cur = miniData.currentPositions["p" + pid];
                    if (cur) {
                        cur.x += (last.players[pid].x - cur.x) * 0.4;
                        cur.y += (last.players[pid].y - cur.y) * 0.4;
                    } else {
                        miniData.currentPositions["p" + pid] = { x: last.players[pid].x, y: last.players[pid].y };
                    }
                }
                if (last.ball) {
                    const curB = miniData.currentPositions.ball;
                    if (curB) {
                        curB.x += (last.ball.x - curB.x) * 0.4;
                        curB.y += (last.ball.y - curB.y) * 0.4;
                    } else {
                        miniData.currentPositions.ball = { x: last.ball.x, y: last.ball.y };
                    }
                }
            }
        }
        
        // ✨ Şut efekti
        const kickedPlayers = {};  
        if (state.kick_effects && state.kick_effects.length > 0) {
            const now = performance.now() / 1000;
            state.kick_effects.forEach(k => {
                if (now - k.time < 0.3) {
                    kickedPlayers[k.player_id] = k.energy_at_kick || 1.0;
                }
            });
        }
        const kickedPlayerIds = new Set(Object.keys(kickedPlayers).map(k => parseInt(k)));

        // 🔊 ŞUT SESİ
        if (kickedPlayerIds.size > 0) {
            if (!miniData._lastKickFrame) miniData._lastKickFrame = new Set();

            const hitMap = {};
            const sprintMap = {};
            if (state.kick_effects) {
                state.kick_effects.forEach(k => {
                    if (k.hit_ball) hitMap[k.player_id] = true;
                    if (k.energy_at_kick !== undefined) sprintMap[k.player_id] = k.energy_at_kick;
                });
            }

            kickedPlayerIds.forEach(pid => {
                if (miniData._lastKickFrame.has(pid)) return;
                if (!hitMap[pid]) return;
                
                miniData._lastKickFrame.add(pid);

                const isFireKick = state.ball && state.ball.on_fire === true;
                if (isFireKick) {
                    MiniAudio.playRandom("fire_kick",
                        ["fire_kick_1.mp3", "fire_kick_2.mp3", "fire_kick_3.mp3"], 0.7);
                } else {
                    MiniAudio.playRandom("kick",
                        ["kick_1.mp3", "kick_2.mp3"], 0.5);
                }
                
                if (pid === miniData.playerId) {
                    if (isFireKick) {
                        MiniVibration.firekick();
                    } else {
                        const sprintActive = (sprintMap[pid] || 0) > 0.5;
                        MiniVibration.kick(sprintActive);
                    }
                }
            });
        }
        
        if (miniData._lastKickFrame) {
            const activeIds = new Set();
            if (state.kick_effects) {
                const now = performance.now() / 1000;
                state.kick_effects.forEach(k => {
                    if (now - k.time < 0.3) activeIds.add(k.player_id);
                });
            }
            for (const pid of miniData._lastKickFrame) {
                if (!activeIds.has(pid)) miniData._lastKickFrame.delete(pid);
            }
        }

        // 🔊 DUVAR + DİREK SESLERİ + TİTREŞİM
        if (state.hit_events && state.hit_events.length > 0) {
            if (!miniData._playedHits) miniData._playedHits = new Set();
            if (!miniData._teamPostHits) miniData._teamPostHits = { red: 0, blue: 0 };
            const nowHit = performance.now() / 1000;

            state.hit_events.forEach(h => {
                const key = `${h.type}_${h.time}`;
                if (miniData._playedHits.has(key)) return;
                if (nowHit - h.time > 0.3) return;

                miniData._playedHits.add(key);

                if (h.type === "wall") {
                    MiniAudio.playRandom("wall",
                        ["wall_hit_1.mp3", "wall_hit_2.mp3"], 0.4);
                    if (state.ball && state.ball.last_toucher === miniData.playerId) {
                        MiniVibration.wallHit();
                    }
                } else if (h.type === "post") {
                    MiniAudio.play("post_hit.mp3", 0.6);
                    MiniVibration.postHit();

                    // ✨ Direğe vuran şutu şutörün takımına ekle (Kaleyi Bulan Şut için)
                    const lastToucherId = state.ball && state.ball.last_toucher;
                    if (lastToucherId) {
                        const shooter = miniData.players.find(p => p.id === lastToucherId);
                        if (shooter && (shooter.team === "red" || shooter.team === "blue")) {
                            miniData._teamPostHits[shooter.team] = (miniData._teamPostHits[shooter.team] || 0) + 1;
                        }
                    }
                }
            });

            if (miniData._playedHits.size > 100) {
                miniData._playedHits.clear();
            }
        }
        
        if (miniData.predictionActive) {
            updateMiniPrediction();
        }
        
        // ✨ GUEST RECONCILIATION: Yerel fizik motorunu sunucu state'i ile eşle (sapmaları yok eder)
        if (miniData.playerId !== 1) {
            syncLocalHPWithServer();
        }
        
        // 🎉 GOL SEVİNCİ KUYRUKLARI (Takım Renkleri & Gökkuşağı Sevinci)
        const allowTrail = (state.game_state === "goal_wait");
        
        if (allowTrail) {
            const playersSource = (isReplayMode && replayFrameData && replayFrameData.players) 
                ? replayFrameData.players 
                : state.players;
            for (const pid in playersSource) {
                const pData = playersSource[pid];
                if (!pData) continue;
                const celType = pData.celebration_type || "grow_explode";
                if (celType === "rainbow_trail" && pData.celebrating && pData.trail && pData.trail.length > 0) {
                    const trail = pData.trail;
                    const timeShift = (Date.now() / 100) % 360;
                    
                    let trailTeam = null;
                    const trailPlayer = miniData.players.find(p => p.id === parseInt(pid));
                    if (trailPlayer) trailTeam = trailPlayer.team;
                    
                    const tName = (trailTeam === "red") ? miniData.redTeamName : (trailTeam === "blue" ? miniData.blueTeamName : "");
                    const normName = (tName || "").trim().toLowerCase();
                    
                    // Takımlara özel renk paletleri
                    let customColors = null;
                    if (normName === "türkiye" || normName === "turkiye") {
                        customColors = ["#e30a17", "#ffffff"]; // Kırmızı - Beyaz
                    } else if (normName === "azerbaycan" || normName === "azerbaijan") {
                        customColors = ["#00a8e8", "#e63946", "#009246"]; // Mavi - Kırmızı - Yeşil
                    } else if (["beşiktaş", "besiktas", "bjk"].includes(normName)) {
                        customColors = ["#111111", "#ffffff"]; // Siyah - Beyaz
                    } else if (["galatasaray", "gs"].includes(normName)) {
                        customColors = ["#a90429", "#fdb913"]; // Kırmızı - Sarı
                    } else if (["fenerbahçe", "fenerbahce", "fb"].includes(normName)) {
                        customColors = ["#00205b", "#ffed00"]; // Lacivert - Sarı
                    } else if (["trabzonspor", "ts"].includes(normName)) {
                        customColors = ["#700018", "#4ab3e8"]; // Bordo - Mavi
                    }
                    
                    for (let i = 0; i < trail.length; i++) {
                        const pt = trail[i];
                        const age = (trail.length - i) / trail.length;
                        const alpha = 1 - age * 0.85;
                        const size = cfg.player_radius * (0.9 - age * 0.7);

                        if (customColors && customColors.length > 0) {
                            // ✨ Takım renkleri arasında tırtıl/yanıp sönme olmadan akıcı yumuşak geçiş (Gökkuşağı kalitesi)
                            const tVal = (i * 0.25 + Date.now() / 180) % customColors.length;
                            const idx1 = Math.floor(tVal);
                            const idx2 = (idx1 + 1) % customColors.length;
                            const frac = tVal - idx1;
                            
                            const c1 = hexToRgbParts(customColors[idx1]);
                            const c2 = hexToRgbParts(customColors[idx2]);
                            
                            const r = Math.round(c1.r + (c2.r - c1.r) * frac);
                            const g = Math.round(c1.g + (c2.g - c1.g) * frac);
                            const b = Math.round(c1.b + (c2.b - c1.b) * frac);
                            
                            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.8})`;
                            ctx.shadowBlur = 12;
                            ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
                        } else {
                            // Klasik Orijinal Gökkuşağı
                            const hue = (i * 25 + timeShift) % 360;
                            ctx.fillStyle = `hsla(${hue}, 100%, 55%, ${alpha * 0.7})`;
                            ctx.shadowBlur = 15;
                            ctx.shadowColor = `hsla(${hue}, 100%, 60%, ${alpha})`;
                        }

                        ctx.beginPath();
                        ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.shadowBlur = 0;
                }
            }
        }

        // 🎆 PATLAMA SEVİNCİ PARTİKÜLLERİNİ ÇİZ
        updateAndDrawCelebrationParticles(ctx);

        // ❄️ BUZ DEVRI GERÇEKÇİ PİST EFEKTİ (Kenarlıklar dahil tüm ekranı kaplar)
        let frostbiteActive = false;
        if (!isReplayMode && state.game_state === "goal_wait") {
            for (const fpid in state.players) {
                const fp = state.players[fpid];
                if (fp && fp.celebrating && fp.celebration_type === "frostbite") {
                    frostbiteActive = true;
                    break;
                }
            }
        }

        if (frostbiteActive) {
            ctx.save();
            const M = 55; // OUT_MARGIN (Saha dışındaki yeşil alanı da tamamen kaplamak için)
            const totalW = cfg.width + M * 2;
            const totalH = cfg.height + M * 2;

             // 1) Gerçekçi Buz Katmanı (Dışarılar Bulanık, Saha İçi Keskin & Kaleler Net)
            if (miniData.iceImage && miniData.iceImage.complete) {
                ctx.save();
                
                // A) Dış Marjlar (Göz yormayan hafif bulanık buz kaplaması)
                try { ctx.filter = "blur(6px)"; } catch(e) {}
                ctx.globalAlpha = 0.82;
                ctx.drawImage(miniData.iceImage, -M, -M, totalW, totalH);
                
                // B) Saha İçi (Net, keskin ve kaleleri/çizgileri belirgin gösteren katman)
                try { ctx.filter = "none"; } catch(e) {}
                ctx.beginPath();
                ctx.rect(0, 0, cfg.width, cfg.height);
                ctx.clip(); // Keskinliği sadece saha içine sınırla
                ctx.globalAlpha = 0.88; // Çizgilerin ve kalelerin belirgin görünmesi için ideal saydamlık
                ctx.drawImage(miniData.iceImage, -M, -M, totalW, totalH);
                
                ctx.restore();
            } else {
                // Resim yüklenene kadar düz mavi fallback
                ctx.fillStyle = "rgba(130, 172, 220, 0.90)";
                ctx.fillRect(-M, -M, totalW, totalH);
            }

            // 3) Bütün Ekran Üzerinde Süzülen Kar Taneleri
            if (!miniData._snowflakes) {
                miniData._snowflakes = [];
                for (let s = 0; s < 70; s++) {
                    miniData._snowflakes.push({
                        x: -M + Math.random() * totalW,
                        y: -M + Math.random() * totalH,
                        r: 1.2 + Math.random() * 3.0,
                        spd: 0.5 + Math.random() * 1.3,
                        drift: (Math.random() - 0.5) * 0.6,
                        a: 0.4 + Math.random() * 0.5
                    });
                }
            }
            for (const sn of miniData._snowflakes) {
                sn.y += sn.spd;
                sn.x += sn.drift + Math.sin(Date.now() / 800 + sn.y * 0.02) * 0.2;
                if (sn.y > cfg.height + M) { sn.y = -M - 5; sn.x = -M + Math.random() * totalW; }
                if (sn.x < -M) sn.x = cfg.width + M;
                if (sn.x > cfg.width + M) sn.x = -M;

                ctx.fillStyle = `rgba(255, 255, 255, ${sn.a})`;
                ctx.beginPath();
                ctx.arc(sn.x, sn.y, sn.r, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        } else {
            // Replay başlayınca tüm buz dokularını ve kar tanelerini temizle
            miniData._snowflakes = null;
            miniData._iceScratches = null;
            miniData._icePatches = null;
        }
        
        // Oyuncular
        for (const pid in state.players) {
            const pidInt = parseInt(pid, 10);
            let smoothPos;
            
            if (isReplayMode && replayFrameData && replayFrameData.players[pid]) {
                // Replay modunda kayıtlı replay karesi
                smoothPos = {
                    x: replayFrameData.players[pid].x,
                    y: replayFrameData.players[pid].y
                };
            } else if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running &&
                       HP.room?.gameState?.players?.[pid]) {
                // HOST: Doğrudan kendi yerel fizik motorundan 0 gecikmeli çiz
                const hpPlayer = HP.room.gameState.players[pid];
                smoothPos = { x: hpPlayer.x, y: hpPlayer.y };
            } else {
                // MİSAFİR: Pürüzsüz Snapshot Interpolasyonundan çiz
                smoothPos = miniData.currentPositions["p" + pid] || state.players[pid];
            }
            
            const p = { x: smoothPos.x, y: smoothPos.y };
            const isMe = pidInt === miniData.playerId;
            
            let playerTeam = null;
            const playerInfo = miniData.players.find(pl => pl.id === parseInt(pid));
            if (playerInfo) {
                playerTeam = playerInfo.team;
            } else {
                if (parseInt(pid) === (miniData.gameState?.red_pid)) playerTeam = "red";
                else if (parseInt(pid) === (miniData.gameState?.blue_pid)) playerTeam = "blue";
            }
            
            const color = playerTeam === "blue"
                ? (miniData.blueTeamColor || "#4dabf7")
                : (miniData.redTeamColor || "#ff6b6b");
            const justKicked = kickedPlayerIds.has(parseInt(pid));
            
            // 🎭 GOL SEVİNCİ EFEKTLERİ HESABI
            const rawP = (isReplayMode && replayFrameData && replayFrameData.players && replayFrameData.players[pid]) 
                ? replayFrameData.players[pid] 
                : state.players[pid];
            let currentRadius = cfg.player_radius;
            let skipPlayerDraw = false;
            
            if (rawP && rawP.celebrating) {
                const celType = rawP.celebration_type || "grow_explode";
                const celStart = rawP.celebration_start || 0;
                const nowSec = performance.now() / 1000;
                const celElapsed = Math.max(0, nowSec - celStart);
                
                const syncElapsed = rawP.celebration_elapsed !== undefined 
                    ? rawP.celebration_elapsed 
                    : celElapsed;

                if (celType === "grow_explode") {
                    if (syncElapsed < 3.8) {
                        const growProgress = Math.min(1.0, syncElapsed / 3.8);
                        
                        // ✨ Hava doldukça hafif esneme ve titreme (wobble)
                        const jiggle = Math.sin(syncElapsed * 28) * (2 + growProgress * 4);
                        currentRadius = cfg.player_radius * (1.0 + growProgress * 2.6) + jiggle * 0.2;
                        
                        ctx.save();
                        
                        // 1. Balon Alt Düğümü (Latex Bağlantı Ucu)
                        const knotY = p.y + currentRadius + 2;
                        const knotSize = 5 + growProgress * 4;
                        ctx.fillStyle = shadeHexColor(color, -0.2);
                        ctx.beginPath();
                        ctx.moveTo(p.x - knotSize, knotY + knotSize);
                        ctx.lineTo(p.x + knotSize, knotY + knotSize);
                        ctx.lineTo(p.x, knotY - 2);
                        ctx.closePath();
                        ctx.fill();
                        
                        // 2. 3D Küresel Balon Gövdesi (Gradient Glow)
                        const balloonGrad = ctx.createRadialGradient(
                            p.x - currentRadius * 0.3, 
                            p.y - currentRadius * 0.3, 
                            currentRadius * 0.1, 
                            p.x, p.y, currentRadius
                        );
                        balloonGrad.addColorStop(0, "#ffffff");
                        balloonGrad.addColorStop(0.3, color);
                        balloonGrad.addColorStop(1, shadeHexColor(color, -0.35));
                        
                        ctx.shadowBlur = 20 * growProgress;
                        ctx.shadowColor = color;
                        ctx.fillStyle = balloonGrad;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
                        ctx.fill();
                        
                        // 3. Balon Üzerindeki Parlak Latex Yansıması (Glossy Highlight)
                        ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
                        ctx.beginPath();
                        ctx.arc(
                            p.x - currentRadius * 0.35, 
                            p.y - currentRadius * 0.35, 
                            currentRadius * 0.25, 
                            0, Math.PI * 2
                        );
                        ctx.fill();
                        
                        ctx.restore();
                    } else {
                        skipPlayerDraw = true;
                        
                        const expKey = pid + "_" + celStart;
                        if (!miniData._explodedKeys) miniData._explodedKeys = new Set();
                        
                        if (!miniData._explodedKeys.has(expKey)) {
                            miniData._explodedKeys.add(expKey);
                            triggerPlayerExplosion(p.x, p.y, color);
                        }
                    }
                } else if (celType === "frostbite") {
                    // ❄️ Buz Devri: saha buz pistine döner, kar yağar (replay'de kapalı)
                    if (!isReplayMode && syncElapsed < 5.0) {
                        // Saha buz kaplaması (bir kez çizilsin diye flag)
                        if (!miniData._frostFieldDrawn) {
                            miniData._frostFieldDrawn = true;
                        }
                    }
                } else if (celType === "frostbite") {
                    // ❄️ Oyuncu üzerinde extra buhar/efekt çizilmez, sadece saha buz tutar
                } else if (celType === "spotlight") {
                    if (!isReplayMode && syncElapsed < 5.0) {
                        ctx.save();
                        
                        // 1) Saha Karartması + Gol Atanın Üstüne Dairesel Işık Alanı
                        const spotRadius = 240; 
                        const darkGrad = ctx.createRadialGradient(p.x, p.y, 25, p.x, p.y, spotRadius);
                        darkGrad.addColorStop(0, "rgba(0, 0, 0, 0)");           // Tam merkez (tam aydınlık)
                        darkGrad.addColorStop(0.35, "rgba(0, 0, 0, 0.25)");     // Yumuşak geçiş
                        darkGrad.addColorStop(0.7, "rgba(0, 0, 0, 0.72)");      // Karanlık saha
                        darkGrad.addColorStop(1, "rgba(0, 0, 0, 0.82)");        // Dış stadyum karanlığı
                        
                        // Tüm sahaya karanlık katman ser
                        ctx.fillStyle = darkGrad;
                        ctx.fillRect(-cfg.player_radius * 10, -cfg.player_radius * 10, cfg.width * 3, cfg.height * 3);

                        // 2) Gol Atanın Altında Parlak Beyaz Aura / Spot Halkası
                        const glowRadius = cfg.player_radius * 1.6;
                        const pulse = Math.sin(syncElapsed * 10) * 0.2 + 0.8;
                        
                        ctx.shadowBlur = 25 * pulse;
                        ctx.shadowColor = "#ffffff";
                        ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
                        ctx.lineWidth = 3.5;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
                        ctx.stroke();

                        // 3) Gökten Oyuncuya Vuran Işık Hüzmesi (God Ray / Stadyum Spotu)
                        const beamGrad = ctx.createLinearGradient(p.x, p.y - 250, p.x, p.y);
                        beamGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
                        beamGrad.addColorStop(0.7, "rgba(255, 255, 255, 0.15)");
                        beamGrad.addColorStop(1, "rgba(255, 255, 255, 0.45)");

                        ctx.fillStyle = beamGrad;
                        ctx.beginPath();
                        ctx.moveTo(p.x - 30, p.y - 250);
                        ctx.lineTo(p.x + 30, p.y - 250);
                        ctx.lineTo(p.x + cfg.player_radius + 12, p.y + cfg.player_radius);
                        ctx.lineTo(p.x - cfg.player_radius - 12, p.y + cfg.player_radius);
                        ctx.closePath();
                        ctx.fill();

                        ctx.restore();
                    }
                } else if (celType === "lightning") {
                    if (syncElapsed < 4.0) {
                        ctx.save();
                        
                        // 1) Elektrik Aurası (Mavi/Turkuaz Parlama)
                        const auraRadius = cfg.player_radius + 6 + Math.sin(syncElapsed * 25) * 3;
                        ctx.shadowBlur = 20;
                        ctx.shadowColor = "#00f0ff";
                        ctx.strokeStyle = "#00f0ff";
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, auraRadius, 0, Math.PI * 2);
                        ctx.stroke();

                        // 2) Gökten Oyuncunun Üstüne Çakan Şimşekler (Zig-Zag)
                        if (Math.random() < 0.45) {
                            ctx.strokeStyle = Math.random() < 0.5 ? "#ffffff" : "#00f0ff";
                            ctx.lineWidth = 2 + Math.random() * 3;
                            ctx.shadowBlur = 15;
                            ctx.shadowColor = "#00f0ff";
                            ctx.beginPath();
                            
                            let startX = p.x + (Math.random() - 0.5) * 50;
                            let startY = p.y - 280; // Yüksekten başla
                            ctx.moveTo(startX, startY);
                            
                            const steps = 6;
                            for (let s = 1; s <= steps; s++) {
                                const targetY = startY + (280 / steps) * s;
                                const targetX = (s === steps) ? p.x : startX + (Math.random() - 0.5) * 35;
                                ctx.lineTo(targetX, targetY);
                                startX = targetX;
                                startY = targetY;
                            }
                            ctx.stroke();
                        }

                        // 3) Karakter Etrafında Cızırdayan Elektrik Arkları
                        for (let a = 0; a < 3; a++) {
                            const angle = Math.random() * Math.PI * 2;
                            const r1 = cfg.player_radius * 0.7;
                            const r2 = cfg.player_radius * (1.4 + Math.random() * 0.8);
                            const x1 = p.x + Math.cos(angle) * r1;
                            const y1 = p.y + Math.sin(angle) * r1;
                            const x2 = p.x + Math.cos(angle) * r2 + (Math.random() - 0.5) * 10;
                            const y2 = p.y + Math.sin(angle) * r2 + (Math.random() - 0.5) * 10;

                            ctx.strokeStyle = "#ffffff";
                            ctx.lineWidth = 2;
                            ctx.beginPath();
                            ctx.moveTo(x1, y1);
                            ctx.lineTo((x1 + x2) / 2 + (Math.random() - 0.5) * 8, (y1 + y2) / 2 + (Math.random() - 0.5) * 8);
                            ctx.lineTo(x2, y2);
                            ctx.stroke();
                        }
                        ctx.restore();
                    }
                }
            }
            
            if (skipPlayerDraw) continue;

            // 😄 SMILEY FACE — gol atan gülen yüze dönüşür (takım fark etmez)
            const isSmiley = rawP && rawP.celebrating && (rawP.celebration_type || "") === "smiley_face";
            if (isSmiley) {
                const R = currentRadius;
                const nowS = performance.now() / 1000;
                const celStartS = rawP.celebration_start || 0;
                const syncS = (rawP.celebration_elapsed !== undefined)
                    ? rawP.celebration_elapsed
                    : Math.max(0, nowS - celStartS);
                // Hafif neşe zıplaması
                const bounce = Math.sin(syncS * 10) * 2.5;

                ctx.save();
                ctx.translate(0, bounce);

                // Gölge
                ctx.fillStyle = "rgba(0,0,0,0.35)";
                ctx.beginPath();
                ctx.ellipse(p.x + 2, p.y + R * 0.85, R * 0.85, R * 0.28, 0, 0, Math.PI * 2);
                ctx.fill();

                // Sarı yüz (3D hissi)
                const faceGrad = ctx.createRadialGradient(
                    p.x - R * 0.25, p.y - R * 0.3, R * 0.1,
                    p.x, p.y, R
                );
                faceGrad.addColorStop(0, "#ffe566");
                faceGrad.addColorStop(0.55, "#ffd43b");
                faceGrad.addColorStop(1, "#f59f00");
                ctx.fillStyle = faceGrad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = "rgba(0,0,0,0.35)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
                ctx.stroke();

                // Gözler
                const eyeY = p.y - R * 0.18;
                const eyeDX = R * 0.28;
                const eyeR = Math.max(2.2, R * 0.11);
                ctx.fillStyle = "#1a1b1e";
                ctx.beginPath();
                ctx.arc(p.x - eyeDX, eyeY, eyeR, 0, Math.PI * 2);
                ctx.arc(p.x + eyeDX, eyeY, eyeR, 0, Math.PI * 2);
                ctx.fill();
                // Göz parıltısı
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(p.x - eyeDX - eyeR * 0.25, eyeY - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
                ctx.arc(p.x + eyeDX - eyeR * 0.25, eyeY - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
                ctx.fill();

                // Gülümseme
                ctx.strokeStyle = "#1a1b1e";
                ctx.lineWidth = Math.max(2.5, R * 0.12);
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.arc(p.x, p.y + R * 0.08, R * 0.42, 0.15 * Math.PI, 0.85 * Math.PI);
                ctx.stroke();

                // Yanak allığı
                ctx.fillStyle = "rgba(255, 107, 107, 0.35)";
                ctx.beginPath();
                ctx.ellipse(p.x - R * 0.42, p.y + R * 0.12, R * 0.14, R * 0.1, 0, 0, Math.PI * 2);
                ctx.ellipse(p.x + R * 0.42, p.y + R * 0.12, R * 0.14, R * 0.1, 0, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();

                // İsim (düz, emoji üstünde)
                let pname = miniData.playerNames[pid] || `P${pid}`;
                let nameColor = "#ffd43b";
                ctx.font = `bold 14px Segoe UI`;
                ctx.textAlign = "center";
                ctx.shadowBlur = 5;
                ctx.shadowColor = "#000";
                ctx.fillStyle = nameColor;
                ctx.fillText(pname, p.x, p.y - R - 12);
                ctx.shadowBlur = 0;

                continue; // normal forma/oyuncu çizimini atla
            }

            // 🦅 EFSANEVİ KARA KARTAL GOL SEVİNCİ (Majestic Flapping Wings VFX)
            const isEagle = rawP && rawP.celebrating && (rawP.celebration_type || "") === "eagle_wings";
            let hoverY = 0;
            if (isEagle) {
                const R = currentRadius; 
                const nowE = performance.now() / 1000;
                const celStartE = rawP.celebration_start || 0;
                const syncE = (rawP.celebration_elapsed !== undefined)
                    ? rawP.celebration_elapsed
                    : Math.max(0, nowE - celStartE);

                // 1) Dinamik Yükseklik ve Çırpınma Hesapları
                const flapAngle = Math.sin(syncE * 14) * 0.55; // Kanat çırpınma genliği
                hoverY = Math.sin(syncE * 5) * 8 - 18;   // Yerden yükselip süzülme (y-offset)

                // 2) Süzülen Tüy Partikülleri (Feather Drift VFX)
                if (!miniData._eagleFeathers) miniData._eagleFeathers = [];
                if (Math.random() < 0.40 && miniData._eagleFeathers.length < 40) {
                    miniData._eagleFeathers.push({
                        x: p.x + (Math.random() - 0.5) * R * 2.5,
                        y: p.y + hoverY + (Math.random() - 0.5) * R,
                        vx: (Math.random() - 0.5) * 1.2,
                        vy: 0.8 + Math.random() * 1.5,
                        rot: Math.random() * Math.PI * 2,
                        rotSpd: (Math.random() - 0.5) * 0.15,
                        size: 2.5 + Math.random() * 5.5,
                        alpha: 1.0,
                        color: Math.random() < 0.45 ? "#ffffff" : "#141414"
                    });
                }

                // Tüyleri Güncelle ve Çiz
                ctx.save();
                for (let f = miniData._eagleFeathers.length - 1; f >= 0; f--) {
                    const ftr = miniData._eagleFeathers[f];
                    ftr.x += ftr.vx + Math.sin(Date.now() / 400 + ftr.y) * 0.3;
                    ftr.y += ftr.vy;
                    ftr.rot += ftr.rotSpd;
                    ftr.alpha -= 0.015;

                    if (ftr.alpha <= 0) {
                        miniData._eagleFeathers.splice(f, 1);
                        continue;
                    }

                    ctx.save();
                    ctx.translate(ftr.x, ftr.y);
                    ctx.rotate(ftr.rot);
                    ctx.fillStyle = ftr.color;
                    ctx.globalAlpha = Math.max(0, ftr.alpha);
                    ctx.shadowBlur = ftr.color === "#ffffff" ? 4 : 0;
                    ctx.shadowColor = "#ffffff";
                    ctx.beginPath();
                    ctx.ellipse(0, 0, ftr.size, ftr.size * 0.35, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                ctx.restore();

                // 3) Sahadaki Dinamik Derinlik Gölgesi (Yer hizasında sabit kalır ve solar)
                ctx.save();
                const shadowScale = Math.max(0.5, 1.0 - Math.abs(hoverY) * 0.022);
                ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
                ctx.beginPath();
                ctx.ellipse(p.x, p.y + 10, R * 1.2 * shadowScale, R * 0.4 * shadowScale, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // 4) Kanatları Çiz (Orijinal gövdenin arkasından çırpınır)
                const drawMajesticWing = (side) => {
                    ctx.save();
                    ctx.translate(p.x, p.y + hoverY);
                    ctx.scale(side, 1); // Sol için -1, Sağ için 1
                    ctx.rotate(flapAngle);

                    // Kanat tüy katmanları
                    for (let layer = 0; pt = [1.2, 1.6, 2.1, 2.5][layer], layer < 4; layer++) {
                        const featherLen = R * pt;
                        const featherAngle = -0.15 + (layer * 0.18);

                        ctx.save();
                        ctx.rotate(featherAngle);

                        // Muazzam Siyah-Beyaz Geçişli Kanat Gradyanı
                        const wingGrad = ctx.createLinearGradient(R * 0.5, 0, featherLen, 0);
                        wingGrad.addColorStop(0, "#0e0e10");
                        wingGrad.addColorStop(0.5, "#22252a");
                        wingGrad.addColorStop(0.85, "#495057");
                        wingGrad.addColorStop(1, "#f8f9fa");

                        ctx.fillStyle = wingGrad;
                        ctx.strokeStyle = "rgba(255,255,255,0.22)";
                        ctx.lineWidth = 1;
                        
                        ctx.beginPath();
                        ctx.moveTo(R * 0.4, 0);
                        ctx.quadraticCurveTo(featherLen * 0.7, -R * 0.22, featherLen, 0);
                        ctx.quadraticCurveTo(featherLen * 0.7, R * 0.22, R * 0.4, R * 0.12);
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                        ctx.restore();
                    }

                    ctx.restore();
                };

                // Sol Kanat (-1) ve Sağ Kanat (1)
                drawMajesticWing(-1);
                drawMajesticWing(1);

                // 5) 🌟 SÜZÜLME HİLESİ: Karakterin asıl y-koordinatını havaya kaldırıyoruz.
                // Böylece aşağıdaki kodlar orijinal fener/bjk formasını direkt havada çizecek!
                p.y += hoverY;
            }

            // 🐍 YILAN GOL SEVİNCİ (Snake VFX — Takım Renginde Kıvrılan Gövde)
            const isSnake = rawP && rawP.celebrating && (rawP.celebration_type || "") === "snake";
            if (isSnake) {
                const R = currentRadius;
                const nowSn = performance.now() / 1000;
                const celStartSn = rawP.celebration_start || 0;
                const syncSn = (rawP.celebration_elapsed !== undefined)
                    ? rawP.celebration_elapsed
                    : Math.max(0, nowSn - celStartSn);

                // 🎨 DİNAMİK TAKIM RENK HAVUZU ÇÖZÜCÜ (Fenerbahçe, GS, BJK vb. Çift Renk Desteği)
                let primaryColor = color;
                let secondaryColor = playerTeam === "blue" ? (miniData.blueSprintColor || "#ffd43b") : (miniData.redSprintColor || "#ffd43b");
                
                const tName = (playerTeam === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
                const normName = tName.trim().toLowerCase();

                let colorList = [primaryColor, secondaryColor]; // Varsayılan: Takım Rengi + Sprint Rengi

                // Hazır takımlar için mükemmel renk kalıpları
                if (["beşiktaş", "besiktas", "bjk"].includes(normName)) {
                    colorList = ["#111111", "#ffffff"]; // Siyah - Beyaz
                } else if (["galatasaray", "gs"].includes(normName)) {
                    colorList = ["#a90429", "#fdb913"]; // Kırmızı - Sarı
                } else if (["fenerbahçe", "fenerbahce", "fb"].includes(normName)) {
                    colorList = ["#00205b", "#ffed00"]; // Lacivert - Sarı
                } else if (["trabzonspor", "ts"].includes(normName)) {
                    colorList = ["#700018", "#4ab3e8"]; // Bordo - Mavi
                } else if (["türkiye", "turkiye"].includes(normName)) {
                    colorList = ["#e30a17", "#ffffff"]; // Kırmızı - Beyaz
                } else if (["azerbaycan", "azerbaijan"].includes(normName)) {
                    colorList = ["#00b5e2", "#e32118", "#38a047"]; // Mavi - Kırmızı - Yeşil (3 Şerit)
                }

                // ⚠️ Hata Önleyici Değişkenler (Kafadaki burun pulu vb. diğer referanslar için fallback)
                const snakeBaseColor = colorList[0];
                const snakeDarkColor = shadeHexColor(snakeBaseColor, -0.35);
                const snakeLightColor = shadeHexColor(snakeBaseColor, 0.3);

                // 1) KUYRUK SEGMENTLERİ (Trail tabanlı — hareket ettikçe büyür)
                const snakeKey = "snake_" + pid;
                if (!miniData._snakeTrails) miniData._snakeTrails = {};
                if (!miniData._snakeTrails[snakeKey]) miniData._snakeTrails[snakeKey] = [];
                
                const trail = miniData._snakeTrails[snakeKey];
                
                // Her frame'de mevcut pozisyonu başa ekle
                trail.unshift({ x: p.x, y: p.y });
                
                // Maksimum 22 segment tut
                if (trail.length > 22) trail.length = 22;
                
                // Kuyruk segmentlerini çiz (sondan başa — kuyruk arkada kalacak)
                for (let si = trail.length - 1; si >= 1; si--) {
                    const seg = trail[si];
                    const age = si / trail.length; // 0 = baş, 1 = kuyruk ucu
                    const segRadius = R * (0.85 - age * 0.55); // Baş kalın, kuyruk incelir
                    
                    if (segRadius < 2) continue;
                    
                    // Pul deseni (Diamond pattern — her ikinci segment daha koyu)
                    const isDark = si % 2 === 0;
                    const pulseWave = Math.sin(syncSn * 8 + si * 0.5) * 0.08;
                    
                    ctx.save();
                    
                    // Gölge
                    ctx.fillStyle = "rgba(0,0,0,0.3)";
                    ctx.beginPath();
                    ctx.arc(seg.x + 2, seg.y + 2, segRadius, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Sırasıyla renk havuzundan o segmentin rengini çek
                    const segColor = colorList[si % colorList.length];
                    const segLightColor = shadeHexColor(segColor, 0.3);
                    const segDarkColor = shadeHexColor(segColor, -0.35);

                    // Ana gövde segmenti
                    const segGrad = ctx.createRadialGradient(
                        seg.x - segRadius * 0.3, seg.y - segRadius * 0.3, segRadius * 0.1,
                        seg.x, seg.y, segRadius
                    );
                    segGrad.addColorStop(0, segLightColor);
                    segGrad.addColorStop(0.5, segColor);
                    segGrad.addColorStop(1, segDarkColor);
                    
                    ctx.fillStyle = segGrad;
                    ctx.globalAlpha = 1.0 - age * 0.15;
                    ctx.beginPath();
                    ctx.arc(seg.x, seg.y, segRadius, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Pul deseni (elmas şekli) — her 3. segmentte
                    if (si % 3 === 0) {
                        ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + pulseWave})`;
                        ctx.beginPath();
                        const ds = segRadius * 0.45;
                        ctx.moveTo(seg.x, seg.y - ds);
                        ctx.lineTo(seg.x + ds * 0.6, seg.y);
                        ctx.lineTo(seg.x, seg.y + ds);
                        ctx.lineTo(seg.x - ds * 0.6, seg.y);
                        ctx.closePath();
                        ctx.fill();
                    }
                    
                    // Segment çevresi (yumuşak kontur)
                    ctx.strokeStyle = `rgba(0, 0, 0, ${0.25 - age * 0.15})`;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(seg.x, seg.y, segRadius, 0, Math.PI * 2);
                    ctx.stroke();
                    
                    ctx.restore();
                }
                
                // 2) YILAN BAŞI (Karakterin pozisyonunda — sivri burun)
                ctx.save();
                ctx.translate(p.x, p.y);
                
                // Hareket yönünü hesapla (baş yönüne dönsün)
                let headAngle = 0;
                if (trail.length >= 2) {
                    const dx = trail[0].x - trail[1].x;
                    const dy = trail[0].y - trail[1].y;
                    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                        headAngle = Math.atan2(dy, dx);
                    }
                }
                ctx.rotate(headAngle);
                
                // Baş gölgesi
                ctx.fillStyle = "rgba(0,0,0,0.35)";
                ctx.beginPath();
                ctx.ellipse(2, 2, R * 1.1, R * 0.85, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Baş gövdesi (Takımın asil ana renginde parlar)
                const headColor = colorList[0];
                const headLight = shadeHexColor(headColor, 0.3);
                const headDark = shadeHexColor(headColor, -0.35);

                const headGrad = ctx.createRadialGradient(-R * 0.2, -R * 0.15, R * 0.1, 0, 0, R * 1.05);
                headGrad.addColorStop(0, headLight);
                headGrad.addColorStop(0.5, headColor);
                headGrad.addColorStop(1, headDark);
                
                ctx.fillStyle = headGrad;
                ctx.beginPath();
                ctx.ellipse(0, 0, R * 1.1, R * 0.85, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Baş konturu
                ctx.strokeStyle = "rgba(0,0,0,0.4)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(0, 0, R * 1.1, R * 0.85, 0, 0, Math.PI * 2);
                ctx.stroke();
                
                // Burun ucundaki pul deseni (V şekli)
                ctx.fillStyle = snakeDarkColor;
                ctx.beginPath();
                ctx.moveTo(R * 0.85, 0);
                ctx.lineTo(R * 0.4, -R * 0.35);
                ctx.lineTo(R * 0.5, 0);
                ctx.lineTo(R * 0.4, R * 0.35);
                ctx.closePath();
                ctx.fill();
                
                // 3) GÖZLER (Altın sarısı dikey dilimli kobra gözleri)
                const eyeOffsetX = R * 0.2;
                const eyeOffsetY = R * 0.35;
                const eyeR = R * 0.18;
                
                // Sol göz
                ctx.fillStyle = "#ffd43b";
                ctx.shadowBlur = 6;
                ctx.shadowColor = "#ffd43b";
                ctx.beginPath();
                ctx.arc(-eyeOffsetX, -eyeOffsetY, eyeR, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                
                // Sol göz dilimi (dikey kedi/yılan gözü)
                ctx.fillStyle = "#111111";
                ctx.beginPath();
                ctx.ellipse(-eyeOffsetX, -eyeOffsetY, eyeR * 0.3, eyeR * 0.9, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Sol göz parlaması
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(-eyeOffsetX - eyeR * 0.25, -eyeOffsetY - eyeR * 0.3, eyeR * 0.2, 0, Math.PI * 2);
                ctx.fill();
                
                // Sağ göz
                ctx.fillStyle = "#ffd43b";
                ctx.shadowBlur = 6;
                ctx.shadowColor = "#ffd43b";
                ctx.beginPath();
                ctx.arc(-eyeOffsetX, eyeOffsetY, eyeR, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                
                // Sağ göz dilimi
                ctx.fillStyle = "#111111";
                ctx.beginPath();
                ctx.ellipse(-eyeOffsetX, eyeOffsetY, eyeR * 0.3, eyeR * 0.9, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Sağ göz parlaması
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(-eyeOffsetX - eyeR * 0.25, eyeOffsetY - eyeR * 0.3, eyeR * 0.2, 0, Math.PI * 2);
                ctx.fill();
                
                // 4) ÇATAL DİL (Titreyen kırmızı çatal dil)
                const tongueFlicker = Math.sin(syncSn * 18) * R * 0.15;
                const tongueLen = R * 0.7 + tongueFlicker;
                
                ctx.strokeStyle = "#e03131";
                ctx.lineWidth = 2.5;
                ctx.lineCap = "round";
                
                // Ana dil gövdesi
                ctx.beginPath();
                ctx.moveTo(R * 0.9, 0);
                ctx.lineTo(R * 0.9 + tongueLen * 0.7, 0);
                ctx.stroke();
                
                // Çatal uçları
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(R * 0.9 + tongueLen * 0.7, 0);
                ctx.lineTo(R * 0.9 + tongueLen, -R * 0.15);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(R * 0.9 + tongueLen * 0.7, 0);
                ctx.lineTo(R * 0.9 + tongueLen, R * 0.15);
                ctx.stroke();
                
                ctx.lineCap = "butt";
                
                ctx.restore(); // Baş rotasyonu bitir
                
                // İsim (Yılanın üstünde, takımın en canlı renginde parlar)
                let pnameSn = miniData.playerNames[pid] || `P${pid}`;
                ctx.font = "bold 14px Segoe UI";
                ctx.textAlign = "center";
                ctx.shadowBlur = 5;
                ctx.shadowColor = "#000";
                ctx.fillStyle = colorList[0];
                ctx.fillText(pnameSn, p.x, p.y - R - 12);
                ctx.shadowBlur = 0;
                
                continue; // Normal karakter çizimini atla (yılan başı onun yerini aldı)
            }

            // ✨ spin_rush: KARAKTER ŞEKLİ SABİT — sadece etrafında dönen efekt
            let spinRushAngle = 0;
            let isSpinRush = false;
            if (rawP && rawP.celebrating && (rawP.celebration_type || "") === "spin_rush") {
                isSpinRush = true;
                const nowSecSR = performance.now() / 1000;
                const celStartSR = rawP.celebration_start || 0;
                const syncSR = (rawP.celebration_elapsed !== undefined)
                    ? rawP.celebration_elapsed
                    : Math.max(0, nowSecSR - celStartSR);
                // ~2.5 tur/sn (daha okunaklı)
                spinRushAngle = syncSR * Math.PI * 5;
            }

            if (isSpinRush) {
                ctx.save();
                // Dış pulse halkası
                const pulseR = currentRadius + 7 + Math.sin(performance.now() / 70) * 2.5;
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.45;
                ctx.lineWidth = 3;
                ctx.shadowBlur = 14;
                ctx.shadowColor = color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, pulseR, 0, Math.PI * 2);
                ctx.stroke();

                // Dönen yaylar (oyuncu DÖNMEZ, efekt döner)
                ctx.globalAlpha = 0.9;
                ctx.lineWidth = 3;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.arc(p.x, p.y, currentRadius + 11, spinRushAngle, spinRushAngle + Math.PI * 0.65);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(p.x, p.y, currentRadius + 11, spinRushAngle + Math.PI, spinRushAngle + Math.PI + Math.PI * 0.65);
                ctx.stroke();

                // Dönen küçük noktalar (yörünge)
                ctx.globalAlpha = 1;
                ctx.shadowBlur = 8;
                for (let s = 0; s < 3; s++) {
                    const a = spinRushAngle + (s * Math.PI * 2) / 3;
                    const ox = p.x + Math.cos(a) * (currentRadius + 14);
                    const oy = p.y + Math.sin(a) * (currentRadius + 14);
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(ox, oy, 3.2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = "#ffffff";
                    ctx.beginPath();
                    ctx.arc(ox, oy, 1.4, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.lineCap = "butt";
                ctx.restore();
            }

            // Gölge (Kartal sevinci hariç çizilir, kartalın kendi gölgesi yerdedir)
            if (!isEagle) {
                ctx.fillStyle = "rgba(0,0,0,0.4)";
                ctx.beginPath();
                ctx.arc(p.x + 3, p.y + 3, currentRadius, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Oyuncu — şekil/forma HİÇ döndürülmez
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
            ctx.fill();
            
            let energyPercent = 1.0;
            let sprintActive = false;
            if (parseInt(pid) === miniData.playerId && miniData.playerId === 1 && 
                typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players?.[pid]) {
                const hpp = HP.room.gameState.players[pid];
                energyPercent = (hpp.sprint_energy || 0) / 100;
                sprintActive = hpp.keys.sprint && hpp.sprint_energy > 1;
            } else if (state.sprint && state.sprint[pid]) {
                const sprintData = state.sprint[pid];
                energyPercent = sprintData.energy / sprintData.max_energy;
                sprintActive = sprintData.active && sprintData.energy > 1;
            }
            
            const lineW = isMe ? 3 : 2;
            
            ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
            ctx.lineWidth = lineW;
            ctx.beginPath();
            // ✨ Oyuncu büyürken dış siyah sınır çizgisi de balonla beraber büyür!
            ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            let energyColor = playerTeam === "blue"
                ? (miniData.blueSprintColor || "#ffd43b")
                : (miniData.redSprintColor || "#ffd43b");
            let energyShadow = energyColor;

            // ✨ Azerbaycan: 3 Renkli Mükemmel Sprint Halkası! (Hangi renk nerdeyse o renk yanar)
            const _azTeamName = (playerTeam === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
            const _azNorm = _azTeamName.trim().toLowerCase();
            if (["azerbaycan", "azerbaijan"].includes(_azNorm)) {
                const azGrad = ctx.createLinearGradient(p.x, p.y - currentRadius, p.x, p.y + currentRadius);
                azGrad.addColorStop(0, "#00b5e2");
                azGrad.addColorStop(0.32, "#00b5e2");
                azGrad.addColorStop(0.34, "#e32118");
                azGrad.addColorStop(0.66, "#e32118");
                azGrad.addColorStop(0.68, "#38a047");
                azGrad.addColorStop(1, "#38a047");
                energyColor = azGrad;
                energyShadow = "#ffffff"; // Gölge (Glow) efekti için mecburi tek renk
            }
            
            // ✨ Oyuncu sevinç balonuyken ortada sarı bir zar/gösterge kalmasın diye sprint göstergesi çizilmez!
            if (energyPercent > 0.01 && (!rawP || !rawP.celebrating)) {
                ctx.strokeStyle = energyColor;
                ctx.lineWidth = lineW;
                ctx.lineCap = "round";
                
                if (sprintActive) {
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = energyShadow;
                }
                
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle - (Math.PI * 2 * energyPercent);
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, cfg.player_radius, startAngle, endAngle, true);
                ctx.stroke();
                
                ctx.shadowBlur = 0;
                ctx.lineCap = "butt";
            }
            
            if (justKicked) {
                const kickEnergyPercent = kickedPlayers[parseInt(pid)] || 1.0;
                const glowStrength = Math.max(0.15, kickEnergyPercent);
                
                const kickFireHex = playerTeam === "blue"
                    ? (miniData.blueTeamColor || "#4dabf7")
                    : (miniData.redTeamColor || "#ff6b6b");
                const kickFireRgb = hexToRgbParts(kickFireHex);
                const teamColorRGB = `${kickFireRgb.r}, ${kickFireRgb.g}, ${kickFireRgb.b}`;
                
                const innerGlow = glowStrength * 0.05;
                const innerGrad = ctx.createRadialGradient(
                    p.x, p.y, 0,
                    p.x, p.y, cfg.player_radius
                );
                innerGrad.addColorStop(0, `rgba(${teamColorRGB}, ${innerGlow})`);
                innerGrad.addColorStop(0.4, `rgba(${teamColorRGB}, ${innerGlow * 0.7})`);
                innerGrad.addColorStop(1, `rgba(${teamColorRGB}, 0)`);
                ctx.fillStyle = innerGrad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, cfg.player_radius, 0, Math.PI * 2);
                ctx.fill();
                
                let sprintHex = playerTeam === "blue"
                    ? (miniData.blueSprintColor || "#ffd43b")
                    : (miniData.redSprintColor || "#ffd43b");
                
                let kickGlowColor = sprintHex;
                let kickGlowRGB = (() => {
                    const h = sprintHex.replace("#", "");
                    const n = parseInt(h.length === 3 ? h.split("").map(c=>c+c).join("") : h, 16);
                    return `${(n>>16)&255}, ${(n>>8)&255}, ${n&255}`;
                })();
                let kickStrokeStyle = `rgba(${kickGlowRGB}, ${glowStrength})`;

                // ✨ Azerbaycan: Şut çekince de 3 renkli alev patlaması!
                const _azKickName = (playerTeam === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
                if (["azerbaycan", "azerbaijan"].includes(_azKickName.trim().toLowerCase())) {
                    const azGradKick = ctx.createLinearGradient(p.x, p.y - cfg.player_radius, p.x, p.y + cfg.player_radius);
                    azGradKick.addColorStop(0, `rgba(0, 181, 226, ${glowStrength})`);
                    azGradKick.addColorStop(0.32, `rgba(0, 181, 226, ${glowStrength})`);
                    azGradKick.addColorStop(0.34, `rgba(227, 33, 24, ${glowStrength})`);
                    azGradKick.addColorStop(0.66, `rgba(227, 33, 24, ${glowStrength})`);
                    azGradKick.addColorStop(0.68, `rgba(56, 160, 71, ${glowStrength})`);
                    azGradKick.addColorStop(1, `rgba(56, 160, 71, ${glowStrength})`);
                    kickStrokeStyle = azGradKick;
                    kickGlowColor = "#ffffff";
                }
                
                ctx.shadowBlur = 30 * glowStrength;
                ctx.shadowColor = kickGlowColor;
                ctx.strokeStyle = kickStrokeStyle;
                ctx.lineWidth = 4 + (2 * glowStrength);
                ctx.beginPath();
                ctx.arc(p.x, p.y, cfg.player_radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
            
            // ✨ Takım Forması Kontrolleri (Milli Takımlar + 4 Büyükler)
            let isTurkeyTeam = false;
            let isAzerbaijanTeam = false;
            let isBesiktasTeam = false;
            let isGalatasarayTeam = false;
            let isFenerbahceTeam = false;
            let isTrabzonsporTeam = false;

            const matchTeam = (teamName, keywords) => {
                if (!teamName) return false;
                const n = teamName.trim().toLowerCase();
                return keywords.some(k => n === k);
            };

            const tName = (playerTeam === "red") ? miniData.redTeamName : miniData.blueTeamName;

            if (matchTeam(tName, ["türkiye", "turkiye"])) isTurkeyTeam = true;
            else if (matchTeam(tName, ["azerbaycan", "azerbaijan"])) isAzerbaijanTeam = true;
            else if (matchTeam(tName, ["beşiktaş", "besiktas", "bjk"])) isBesiktasTeam = true;
            else if (matchTeam(tName, ["galatasaray", "gs"])) isGalatasarayTeam = true;
            else if (matchTeam(tName, ["fenerbahçe", "fenerbahce", "fb"])) isFenerbahceTeam = true;
            else if (matchTeam(tName, ["trabzonspor", "ts"])) isTrabzonsporTeam = true;
            
            const kickGlow = justKicked ? 1.0 : 0;
            let kitNumber = null;

            // ✨ Oyuncunun takımdaki sırasına göre efsane forma numaraları ver (10, 7, 9, 11, 8, 5...)
            const jerseyNumbersPool = [10, 7, 9, 11, 8, 1, 5, 4, 6, 2];
            const sameTeamPlayers = miniData.players.filter(pl => pl.team === playerTeam);
            const playerTeamIdx = sameTeamPlayers.findIndex(pl => pl.id === parseInt(pid));
            const defaultNum = jerseyNumbersPool[playerTeamIdx >= 0 ? playerTeamIdx % jerseyNumbersPool.length : 0];
            
            // ✨ Eğer Admin forma numarasını el ile değiştirdiyse onu çiz, yoksa default listeyi kullan
            let jerseyNum = defaultNum;
            const pidStr = String(pid);
            if (miniData.persistentJerseys && miniData.persistentJerseys[pidStr] !== undefined) {
                jerseyNum = miniData.persistentJerseys[pidStr];
            } else {
                const stateP = state.players[pid];
                if (stateP && stateP.jersey_number !== undefined && stateP.jersey_number !== null) {
                    jerseyNum = stateP.jersey_number;
                } else if (isReplayMode && replayFrameData?.players?.[pid]?.jersey_number !== undefined) {
                    jerseyNum = replayFrameData.players[pid].jersey_number;
                } else {
                    const lobbyP = miniData.players.find(pl => pl.id === parseInt(pid));
                    if (lobbyP && lobbyP.jersey_number !== undefined) {
                        jerseyNum = lobbyP.jersey_number;
                    }
                }
            }

            // ✨ BALONLA BERABER BÜYÜYEN FORMA TASARIMI
            // Çizim fonksiyonlarına sabit yarıçap (20) yerine o anki balon yarıçapını (currentRadius) gönderiyoruz
            if (isTurkeyTeam) {
                drawTurkishStar(ctx, p.x, p.y, currentRadius, kickGlow);
            } else if (isAzerbaijanTeam) {
                drawAzerbaijanFlag(ctx, p.x, p.y, currentRadius, kickGlow);
            } else if (isBesiktasTeam) {
                drawBesiktasKit(ctx, p.x, p.y, currentRadius, kickGlow);
                kitNumber = jerseyNum;
            } else if (isGalatasarayTeam) {
                drawGalatasarayKit(ctx, p.x, p.y, currentRadius, kickGlow);
                kitNumber = jerseyNum;
            } else if (isFenerbahceTeam) {
                drawFenerbahceKit(ctx, p.x, p.y, currentRadius, kickGlow);
                kitNumber = jerseyNum;
            } else if (isTrabzonsporTeam) {
                drawTrabzonsporKit(ctx, p.x, p.y, currentRadius, kickGlow);
                kitNumber = jerseyNum;
            }

            // ✨ Forma Numarasını da Balonla Beraber Ölçeklendir
            if (kitNumber !== null) {
                ctx.save();
                // Font boyutu artık currentRadius'a bağlı olarak büyüyecek
                const dynamicFontSize = Math.round(currentRadius * 0.9);
                ctx.font = `bold ${dynamicFontSize}px 'Segoe UI', sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.shadowBlur = 4;
                ctx.shadowColor = "#000000";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 3;
                ctx.fillStyle = "#ffffff";
                ctx.strokeText(String(kitNumber), p.x, p.y);
                ctx.fillText(String(kitNumber), p.x, p.y);
                ctx.restore();
            }

            let pname = miniData.playerNames[pid] || `P${pid}`;
            // ✨ Fenerbahçe saha üstü isimleri sarı
            const _fieldTeamName = (playerTeam === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
            const _fieldNorm = _fieldTeamName.trim().toLowerCase();
            let nameColor;
            if (["fenerbahçe", "fenerbahce", "fb"].includes(_fieldNorm)) {
                nameColor = "#ffed00";
            } else if (["galatasaray", "gs"].includes(_fieldNorm)) {
                nameColor = "#fdb913"; // GS sprint sarısı
            } else {
                nameColor = playerTeam === "blue"
                    ? (miniData.blueTeamColor || "#7abfff")
                    : (miniData.redTeamColor || "#ff8a8a");
            }
            let nameFontSize = 14;
            if (cfg.width >= 1800) nameFontSize = 22;
            else if (cfg.width >= 1600) nameFontSize = 20;
            else if (cfg.width >= 1400) nameFontSize = 18;
            else if (cfg.width >= 1200) nameFontSize = 16;
            
            const maxNameWidth = cfg.player_radius * 2.4;
            ctx.font = `bold ${nameFontSize}px Segoe UI`;
            let measuredW = ctx.measureText(pname).width;
            while (measuredW > maxNameWidth && nameFontSize > 8) {
                nameFontSize -= 1;
                ctx.font = `bold ${nameFontSize}px Segoe UI`;
                measuredW = ctx.measureText(pname).width;
            }
            
            ctx.textAlign = "center";
            ctx.shadowBlur = 5;
            ctx.shadowColor = "#000";
            ctx.fillStyle = nameColor;
            ctx.fillText(pname, p.x, p.y - cfg.player_radius - nameFontSize * 0.6);
            ctx.shadowBlur = 0;

            // ✨ spin_rush rotate restore (forma/numara döndü; isim düz kalsın diye isimden sonra)
            // Not: isim de döndüyse düz isim için ismi restore sonrası çizmek gerekir.
            // Aşağıda ismi düz tutmak için spin restore'u isimden ÖNCE yapıyoruz — BUL 6.
        }
        
        // Top
        let bSmooth;
        if (isReplayMode && replayFrameData && replayFrameData.ball) {
            bSmooth = replayFrameData.ball;
        } else if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running &&
                   HP.room?.gameState?.ball) {
            // HOST: Kendi yerel HP topunu çiz
            const hpBall = HP.room.gameState.ball;
            bSmooth = { x: hpBall.x, y: hpBall.y };
        } else {
            // MİSAFİR: Snapshot Interpolasyonlu Pürüzsüz Top
            bSmooth = miniData.currentPositions.ball || state.ball;
        }
        const b = {
            x: bSmooth.x,
            y: bSmooth.y,
            on_fire: isReplayMode ? (replayFrameData?.ball?.on_fire) : state.ball.on_fire,
            warning: isReplayMode ? (replayFrameData?.ball?.warning) : state.ball.warning
        };
        const onFire = b.on_fire === true;
        const warning = b.warning === true;
        
        if (warning) {
            const blink = Math.floor(Date.now() / 200) % 2 === 0;
            if (blink) {
                const warningTeam = state.ball.warning_team;
                let warningColor, warningColorLight;
                if (warningTeam === 2) {
                    warningColor = "#4dabf7";
                    warningColorLight = "rgba(77, 171, 247, 0.5)";
                } else {
                    warningColor = "#ff3333";
                    warningColorLight = "rgba(255, 51, 51, 0.5)";
                }
                
                ctx.shadowBlur = 30;
                ctx.shadowColor = warningColor;
                ctx.fillStyle = warningColorLight;
                ctx.beginPath();
                ctx.arc(b.x, b.y, cfg.ball_radius + 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
        
        if (onFire) {
            const lastToucher = state.ball.last_toucher;
            let toucherTeam = null;
            if (lastToucher) {
                const toucherInfo = miniData.players.find(pl => pl.id === lastToucher);
                if (toucherInfo) toucherTeam = toucherInfo.team;
            }
            const fireHex = toucherTeam === "blue"
                ? (miniData.blueTeamColor || "#4dabf7")
                : (miniData.redTeamColor || "#ff6b00");
            const fireRgb = hexToRgbParts(fireHex);
            let flameR = fireRgb.r, flameG = fireRgb.g, flameB = fireRgb.b;
            let glowColor = fireHex;
            
            const time = Date.now() / 100;
            for (let i = 3; i > 0; i--) {
                ctx.fillStyle = `rgba(${flameR}, ${flameG + i * 30}, ${flameB}, ${0.3 - i * 0.05})`;
                ctx.shadowBlur = 30;
                ctx.shadowColor = glowColor;
                ctx.beginPath();
                const wave = Math.sin(time + i) * 2;
                ctx.arc(b.x, b.y, cfg.ball_radius + 6 + i * 3 + wave, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }
        
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath();
        ctx.arc(b.x + 2, b.y + 2, cfg.ball_radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (onFire) {
            const lastToucher = state.ball.last_toucher;
            let toucherTeam2 = null;
            if (lastToucher) {
                const toucherInfo2 = miniData.players.find(pl => pl.id === lastToucher);
                if (toucherInfo2) toucherTeam2 = toucherInfo2.team;
            }
            const fireHex2 = toucherTeam2 === "blue"
                ? (miniData.blueTeamColor || "#4dabf7")
                : (miniData.redTeamColor || "#ff6b00");
            const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, cfg.ball_radius);
            grad.addColorStop(0, "#fff");
            grad.addColorStop(0.6, shadeHexColor(fireHex2, 0.35));
            grad.addColorStop(1, shadeHexColor(fireHex2, -0.15));
            ctx.fillStyle = grad;
        } else if (warning) {
            const blink = Math.floor(Date.now() / 200) % 2 === 0;
            const warningTeam = state.ball.warning_team;
            const warningColor = warningTeam === 2 ? "#4dabf7" : "#ff3333";
            ctx.fillStyle = blink ? warningColor : "#fff";
        } else {
            ctx.fillStyle = "#fff";
        }
        ctx.beginPath();
        ctx.arc(b.x, b.y, cfg.ball_radius, 0, Math.PI * 2);
        ctx.fill();
        
        if (!onFire) {
            ctx.fillStyle = "#333";
            ctx.beginPath();
            ctx.arc(b.x, b.y, cfg.ball_radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        let ballBorderColor = "#000";
        if (onFire) {
            const lastToucher = state.ball.last_toucher;
            let toucherTeam3 = null;
            if (lastToucher) {
                const toucherInfo3 = miniData.players.find(pl => pl.id === lastToucher);
                if (toucherInfo3) toucherTeam3 = toucherInfo3.team;
            }
            const fireHex3 = toucherTeam3 === "blue"
                ? (miniData.blueTeamColor || "#4dabf7")
                : (miniData.redTeamColor || "#ff6b00");
            ballBorderColor = shadeHexColor(fireHex3, -0.35);
        }
        ctx.strokeStyle = ballBorderColor;
        ctx.lineWidth = onFire ? 3 : 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, cfg.ball_radius, 0, Math.PI * 2);
        ctx.stroke();
    } // <-- TOP VE OYUNCU (state) ÇİZİM BLOĞUNUN KAPANIŞI
    
    if (state) {
        const rDurationR = (state.goal_celebration && state.goal_celebration.replay_duration) || 10.0;
        const isReplayRunning = state.game_state === "goal_wait" &&
            state.goal_celebration &&
            typeof state.goal_celebration.wait_remaining === "number" &&
            state.goal_celebration.wait_remaining <= rDurationR;

        if (isReplayRunning) {
            // ✨ Sadece Replay başladığı an tuşları bırak (sevinçte bırakma!)
            if (!miniData._keysReleasedInReplay) {
                miniReleaseAllKeys();
                miniData._keysReleasedInReplay = true;
            }
        } else {
            // Sevinç / playing / countdown → kilit yok
            miniData._keysReleasedInReplay = false;
            // Sevinçteyken skip sayacını da sıfırla ki replay'e temiz girsin
            if (state.game_state === "goal_wait" &&
                state.goal_celebration &&
                state.goal_celebration.wait_remaining > rDurationR) {
                miniData._hasSkippedReplay = false;
            }
        }

        if (state.game_state === "countdown" && state.countdown !== null && state.countdown !== undefined) {
            drawCountdownOverlay(ctx, cfg, state.countdown);
        } else if (state.game_state === "goal_wait" && state.goal_celebration) {
            drawGoalCelebration(ctx, cfg, state.goal_celebration);
        } else {
            miniData._lastGoalSignature = null;
            miniData._goalSongPlayed = null; // ✨ Müzik kilidini sıfırla (sonraki golde müzik çalabilsin)
        }
        if (state.kickoff && state.kickoff.active) {
            drawKickoffInfo(ctx, cfg, state.kickoff);
        }
    }
    
    ctx.restore();
    
    if (miniData._goalSongAudio) {
        let vol = 0.5;
        if (typeof window.getGlobalVolume === "function") {
            const gv = window.getGlobalVolume();
            if (typeof gv === "number" && !isNaN(gv)) vol = gv;
        }
        try {
            const audio = miniData._goalSongAudio;
            audio.volume = Math.max(0, Math.min(1, vol));

            // ✨ Gol şarkısı santraya/maça geçilse bile kesilmez, kendi kendine bitene kadar çalmaya devam eder!
            if (vol > 0 && audio.paused && !audio.ended) {
                audio.play().catch(() => {});
            }

            // Şarkı süresi bittiğinde referansı temizle
            if (audio.ended) {
                miniData._goalSongAudio = null;
            }
        } catch(e) {}
    }
    
    updateMiniHUD();
    miniAnimFrame = requestAnimationFrame(miniRender);
}

// ========================================
// COUNTDOWN OVERLAY (3-2-1-BAŞLA!)
// ========================================
function drawCountdownOverlay(ctx, cfg, countdown) {
    // ✨ Font ölçekleme
    const fontScale = Math.max(1, cfg.width / 1000);
    
    // 🔊 DÜDÜK (BAŞLA! anında çal, sadece 1 kez)
    // ✨ Sadece maç başı VEYA gol sonrası santrada çalsın (pause resume'da çalmasın)
    const state = miniData.gameState;
    const silentWhistle = state && state.silent_whistle === true;
    
    if (countdown === 0 && !miniData._whistlePlayed && !silentWhistle) {
        MiniAudio.play("whistle.mp3", 0.6);
        miniData._whistlePlayed = true;
        // ✨ Düdükte çok hafif titreşim (santra)
        MiniVibration.whistle();
    } else if (countdown > 0) {
        // Countdown başladığında flag'i sıfırla (yeni maç için tekrar çalsın)
        miniData._whistlePlayed = false;
        
        // ✨ Her sayımda kısa tik titreşimi (3, 2, 1)
        if (!miniData._countdownTicked) miniData._countdownTicked = new Set();
        const tickKey = `count_${countdown}_${Math.floor(Date.now() / 1500)}`;
        if (!miniData._countdownTicked.has(tickKey)) {
            miniData._countdownTicked.add(tickKey);
            MiniVibration.countdown();
            // Setı çok büyütmemek için temizle
            if (miniData._countdownTicked.size > 20) miniData._countdownTicked.clear();
        }
    }

    // Yarı saydam arkaplan
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, cfg.width, cfg.height);
    
    // Sayı veya BAŞLA yazısı
    let text = "";
    let color = "#ffd43b";
    let fontSize = 120 * fontScale;
    
    if (countdown === 0) {
        text = "BAŞLA!";
        color = "#51cf66";
        fontSize = 80 * fontScale;
    } else {
        text = String(countdown);
        // Renk sayıya göre
        if (countdown === 3) color = "#51cf66";  // Yeşil
        else if (countdown === 2) color = "#ffd43b";  // Sarı
        else if (countdown === 1) color = "#ff6b6b";  // Kırmızı
    }
    
    // Pulse efekti (frame'e göre)
    const pulse = Math.sin(Date.now() / 100) * 0.1 + 1;
    fontSize *= pulse;
    
    ctx.save();
    ctx.translate(cfg.width / 2, cfg.height / 2);
    
    // Gölge (arka)
    ctx.font = `bold ${fontSize}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Glow
    ctx.shadowBlur = 30;
    ctx.shadowColor = color;
    ctx.fillStyle = color;
    ctx.fillText(text, 0, 0);
    
    // Kenarlık
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeText(text, 0, 0);
    
    ctx.restore();
}

// ========================================
// SANTRA (KICKOFF) UYARISI
// ========================================
function drawKickoffInfo(ctx, cfg, kickoff) {
    if (!kickoff || !kickoff.active) return;
    
    const remaining = kickoff.time_remaining;
    if (remaining <= 0) return;
    
    // ✨ Font ölçekleme: 1v1 (1000px) baz alınır, büyük sahalarda font büyür
    const fontScale = Math.max(1, cfg.width / 1000);
    
    const receivingTeam = kickoff.receiving_team;
    const restrictedTeam = kickoff.restricted_team;
    // ✨ Takım ID'si ile karşılaştır (oyuncu ID değil!)
    const myPlayer = miniData.players.find(p => p.id === miniData.playerId);
    const myTeamId = myPlayer ? (myPlayer.team === "red" ? 1 : (myPlayer.team === "blue" ? 2 : null)) : null;
    const isMyTeamReceiving = receivingTeam === myTeamId;
    const isMyTeamRestricted = restrictedTeam === myTeamId;
    
    // Alt kısımda bilgi göster
    ctx.save();
    
    // Süre gösterimi (üstte küçük)
    const timerText = `⏱️ ${remaining.toFixed(1)} sn`;
    ctx.font = `bold ${Math.round(20 * fontScale)}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    // Uyarı rengi (son 3 sn kırmızı)
    const isWarning = remaining <= 3;
    const blink = Math.floor(Date.now() / 200) % 2 === 0;
    ctx.fillStyle = isWarning ? (blink ? "#ff3333" : "#ffd43b") : "#ffd43b";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#000";
    ctx.fillText(timerText, cfg.width / 2, 10);
    
    // Bilgi metni (kim topa dokunmalı)
    let infoText = "";
    let infoColor = "#fff";
    if (isMyTeamReceiving) {
        infoText = "⚽ TOP SENDE! Topa git!";
        infoColor = "#51cf66";
    } else if (isMyTeamRestricted) {
        infoText = "⛔ Santra! Karşıya geçemezsin";
        infoColor = "#ff6b6b";
    } else {
        const teamName = receivingTeam === 1 ? "Kırmızı" : "Mavi";
        infoText = `${teamName} takım santra atacak`;
        infoColor = "#adb5bd";
    }
    
    ctx.font = `bold ${Math.round(16 * fontScale)}px Segoe UI`;
    ctx.fillStyle = infoColor;
    ctx.fillText(infoText, cfg.width / 2, 38);
    
    ctx.restore();
}


// ========================================
// GOL KUTLAMASI OVERLAY
// ========================================
function drawGoalCelebration(ctx, cfg, celebration) {
    // ✨ Font ölçekleme
    const fontScale = Math.max(1, cfg.width / 1000);
    const isOwnGoal = celebration.own_goal === true; 
    
    // ✨ İsimleri ve Asisti Önceden Al (Replay ekranı için lazım)
    const scorerPid = celebration.scorer_pid || celebration.scorer_id;
    const scorerTeamId = celebration.scorer_id;  
    
    let scorerName = "Oyuncu";
    const scorerPlayer = miniData.players.find(p => Number(p.id) === Number(scorerPid));
    if (scorerPlayer) {
        scorerName = scorerPlayer.name;
    } else if (miniData.playerNames[String(scorerPid)]) {
        scorerName = miniData.playerNames[String(scorerPid)];
    }
    
    const assistId = celebration.assist_id;
    let assistName = null;
    if (assistId) {
        const assistPlayer = miniData.players.find(p => Number(p.id) === Number(assistId));
        assistName = assistPlayer ? assistPlayer.name : miniData.playerNames[String(assistId)];
    }
    
    // ✨ GOL REPLAY GEÇİŞİ (Dinamik Replay Süresi)
        const rDurationUI = celebration.replay_duration || 10.0;
        const isReplayMode = celebration.wait_remaining <= rDurationUI;
        if (isReplayMode) {
            ctx.save();
            
            // ✨ SOL ÜSTTE REPLAY YAZISI (Kırmızı)
            ctx.fillStyle = "#ff3333";
            ctx.beginPath();
            ctx.arc(15 * fontScale, 20 * fontScale, 6 * fontScale, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = "#ff3333";
            ctx.font = `bold ${20 * fontScale}px 'Segoe UI', sans-serif`;
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText("Replay", 30 * fontScale, 20 * fontScale);
        
        // ✨ ALT BİLGİLER (Arkaplansız, merkeze hizalı, daha küçük ve alt kenara yakın)
        let textColor = "#ffd43b";
        const dynRedReplay = miniData.redTeamColor || "#ff6b6b";
        const dynBlueReplay = miniData.blueTeamColor || "#4dabf7";
        const scorerPlayerObj = miniData.players.find(p => p.id === scorerPid);
        if (scorerPlayerObj && (scorerPlayerObj.team === "red" || scorerPlayerObj.team === "blue")) {
            textColor = scorerPlayerObj.team === "red" ? dynRedReplay : dynBlueReplay;
        } else if (scorerTeamId === 1) {
            textColor = dynRedReplay;
        } else if (scorerTeamId === 2) {
            textColor = dynBlueReplay;
        }
        
        const centerX = cfg.width / 2;
        
        // ✨ Gol bilgileri saha çizgisinin hemen üstünde, skip haplarının hemen üstünde
        const line1Y = cfg.height - 28 * fontScale; 
        const line2Y = cfg.height - 10 * fontScale; 

        ctx.textAlign = "center";
        
        // Okunabilirlik için çok hafif siyah gölge
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        
        // ✨ Takımlara Özel "Gol: Oyuncu Adı" Renk Paletleri
        let scorerTeamKey = "red";
        if (scorerPlayerObj && (scorerPlayerObj.team === "red" || scorerPlayerObj.team === "blue")) {
            scorerTeamKey = isOwnGoal ? (scorerPlayerObj.team === "red" ? "blue" : "red") : scorerPlayerObj.team;
        } else if (scorerTeamId === 2) {
            scorerTeamKey = "blue";
        }
        const scorerTeamName = (scorerTeamKey === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
        const normScorerTeam = scorerTeamName.trim().toLowerCase();

        const fontH = 16 * fontScale;
        ctx.font = `bold ${fontH}px 'Segoe UI'`;

        let golLabelColor = textColor;
        let playerNameColor = textColor;
        let isAzGrad = false;

        if (["türkiye", "turkiye"].includes(normScorerTeam)) {
            golLabelColor = "#ffffff";
            playerNameColor = "#e30a17";
        } else if (["azerbaycan", "azerbaijan"].includes(normScorerTeam)) {
            golLabelColor = "#00a8e8";
            isAzGrad = true; // Yarısı kırmızı, yarısı yeşil
        } else if (["beşiktaş", "besiktas", "bjk"].includes(normScorerTeam)) {
            golLabelColor = "#111111";
            playerNameColor = "#ffffff";
        } else if (["galatasaray", "gs"].includes(normScorerTeam)) {
            golLabelColor = "#a90429";
            playerNameColor = "#fdb913";
        } else if (["fenerbahçe", "fenerbahce", "fb"].includes(normScorerTeam)) {
            golLabelColor = "#00205b";
            playerNameColor = "#ffed00";
        } else if (["trabzonspor", "ts"].includes(normScorerTeam)) {
            golLabelColor = "#700018";
            playerNameColor = "#4ab3e8";
        }

        // 🇦🇿 Azerbaycan Oyuncu İsmi: Üst Yarısı Kırmızı, Alt Yarısı Yeşil Degrade
        if (isAzGrad) {
            const azGrad = ctx.createLinearGradient(0, line1Y - fontH * 0.45, 0, line1Y + fontH * 0.45);
            azGrad.addColorStop(0, "#e32118");   // Üst Yarısı Kırmızı
            azGrad.addColorStop(0.48, "#e32118");
            azGrad.addColorStop(0.52, "#38a047"); // Alt Yarısı Yeşil
            azGrad.addColorStop(1, "#38a047");
            playerNameColor = azGrad;
        }

        // Parçalı Metin Çizimi (Gol Etiketi + Oyuncu Adı + Asist)
        const labelGolText = "⚽ Gol: ";
        const nameScorerText = scorerName;
        const sepText = "   |   ";
        const labelAssistText = "🤝 Asist: ";
        const nameAssistText = assistName || "";

        const wLabelGol = ctx.measureText(labelGolText).width;
        const wNameScorer = ctx.measureText(nameScorerText).width;
        const wSep = assistName ? ctx.measureText(sepText).width : 0;
        const wLabelAssist = assistName ? ctx.measureText(labelAssistText).width : 0;
        const wNameAssist = assistName ? ctx.measureText(nameAssistText).width : 0;

        const totalRow1W = wLabelGol + wNameScorer + wSep + wLabelAssist + wNameAssist;
        let startXRow1 = centerX - (totalRow1W / 2);

        ctx.textAlign = "left";

        // 1. "⚽ Gol:"
        ctx.fillStyle = golLabelColor;
        ctx.fillText(labelGolText, startXRow1, line1Y);
        startXRow1 += wLabelGol;

        // 2. Golü Atan Oyuncu Adı
        ctx.fillStyle = playerNameColor;
        ctx.fillText(nameScorerText, startXRow1, line1Y);
        startXRow1 += wNameScorer;

        // 3. Asist Varsa (İsteğe Bağlı)
        if (assistName) {
            ctx.fillStyle = "#adb5bd";
            ctx.fillText(sepText, startXRow1, line1Y);
            startXRow1 += wSep;

            ctx.fillStyle = golLabelColor;
            ctx.fillText(labelAssistText, startXRow1, line1Y);
            startXRow1 += wLabelAssist;

            ctx.fillStyle = playerNameColor;
            ctx.fillText(nameAssistText, startXRow1, line1Y);
        }
        
        // Alt Satır: Hız ve Mesafe (Dinamik Renkler)
        ctx.font = `bold ${14 * fontScale}px 'Segoe UI'`;
        
        // Hız Renk Mantığı
        let speedColor = "#ffd43b"; // Yavaş (Sarı)
        if (celebration.speed > 80) speedColor = "#ff4d4d"; // Çok Hızlı (Kırmızı)
        else if (celebration.speed >= 40) speedColor = "#51cf66"; // Normal (Yeşil)
        
        // Mesafe Renk Mantığı
        let distColor = "#ffd43b"; // Yakın (Sarı)
        if (celebration.dist > 20) distColor = "#ff4d4d"; // Uzak (Kırmızı)
        else if (celebration.dist >= 8) distColor = "#51cf66"; // Normal (Yeşil)
        
        const speedStr = `⚡ Şut Hızı: ${celebration.speed} km/s`;
        const sepStr = `   |   `;
        const distStr = `📏 Mesafe: ${celebration.dist}m`;
        
        // Yazıların genişliklerini hesapla (Tam ortaya hizalamak için)
        const w1 = ctx.measureText(speedStr).width;
        const w2 = ctx.measureText(sepStr).width;
        const w3 = ctx.measureText(distStr).width;
        const totalW = w1 + w2 + w3;
        
        let startX = centerX - totalW / 2;
        ctx.textAlign = "left";
        
        // 1. Şut Hızı (Dinamik Renk)
        ctx.fillStyle = speedColor;
        ctx.fillText(speedStr, startX, line2Y);
        startX += w1;
        
        // 2. Ayırıcı Çizgi (Gri)
        ctx.fillStyle = "#adb5bd";
        ctx.fillText(sepStr, startX, line2Y);
        startX += w2;
        
        // 3. Mesafe (Dinamik Renk)
        ctx.fillStyle = distColor;
        ctx.fillText(distStr, startX, line2Y);
        
        // ==========================================
        // ⏭️ REPLAY SKIP (ATLA) UI KUTUSU (ARKAPLANSIZ, ORTALANMIŞ, SAHA DIŞI)
        // ==========================================
        // ✨ ID'leri number'a çevir (host/misafir uyuşmazlığı olmasın)
        const skipVotes = (celebration.skip_votes || []).map(id => parseInt(id, 10));
        const activePlayers = miniData.players.filter(p => p.team === "red" || p.team === "blue");
        const waitingFor = activePlayers.filter(p => !skipVotes.includes(parseInt(p.id, 10)));
        
        // ✨ Saha dışı (out_margin = 55px). Tam ortası: cfg.height + 27.5
        const boxY = cfg.height + 27.5; 
        
        if (waitingFor.length === 0) {
            // ✨ HERKES ATLADI!
            ctx.fillStyle = "#51cf66"; // Yeşil
            ctx.shadowColor = "#51cf66";
            ctx.shadowBlur = 10;
            ctx.font = `bold ${18 * fontScale}px 'Segoe UI'`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("⏭️ Geçiliyor...", centerX, boxY);
        } else {
            // 1. Yazıyı kaldırdık, sadece hapları merkeze hizalıyoruz
            ctx.font = `bold ${14 * fontScale}px 'Segoe UI'`;
            const padding = 12 * fontScale;
            const gap = 10 * fontScale; // Haplar arası boşluk
            
            let pillsTotalW = 0;
            const pillWidths = [];
            
            waitingFor.forEach(p => {
                const w = ctx.measureText(p.name || "Oyuncu").width + (padding * 2);
                pillWidths.push(w);
                pillsTotalW += w;
            });
            
            // Toplam genişlik = Haplar + (Haplar arası boşluklar)
            const totalW = pillsTotalW + (waitingFor.length > 1 ? (waitingFor.length - 1) * gap : 0);
            
            // Tam ortadan başlayacak noktayı bul!
            let startX_skip = centerX - (totalW / 2);
            
            // 2. Oyuncu Haplarını Çiz
            waitingFor.forEach((p, index) => {
                const isRed = p.team === "red";
                const tColor = isRed ? dynRedReplay : dynBlueReplay;
                const pTeamName = (isRed ? miniData.redTeamName : miniData.blueTeamName) || "";
                const normName = pTeamName.trim().toLowerCase();
                
                // ✨ Beşiktaş gibi koyu/siyah takımlarda kutunun siyah, yazının beyaz olmasını sağlayan kontrol
                const rgb = hexToRgbParts(tColor);
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                const max = Math.max(rgb.r, rgb.g, rgb.b);
                const min = Math.min(rgb.r, rgb.g, rgb.b);
                const saturation = max === 0 ? 0 : (max - min) / max;
                const isDark = brightness < 55 && saturation < 0.22;

                let pColor = isDark ? "#ffffff" : tColor;
                if (["galatasaray", "gs"].includes(normName)) {
                    pColor = "#fdb913";
                } else if (["fenerbahçe", "fenerbahce", "fb"].includes(normName)) {
                    pColor = "#ffed00";
                } else if (["trabzonspor", "ts"].includes(normName)) {
                    pColor = "#4ab3e8";
                }

                const pName = p.name || "Oyuncu";
                
                const pillW = pillWidths[index];
                const pillH = 26 * fontScale;
                const pillY = boxY - (pillH/2);
                
                // ✨ Pill Arka Planı (Koyu takımlarda siyah kutu + net beyaz çerçeve, diğerlerinde takım rengi)
                ctx.fillStyle = isDark ? "rgba(17, 17, 17, 0.88)" : hexToRgba(tColor, 0.25);
                ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.75)" : hexToRgba(tColor, 0.7);
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 0; // Kutuya blur verme, sadece metne vereceğiz
                
                // Yuvarlak dikdörtgen çizimi
                ctx.beginPath();
                ctx.roundRect(startX_skip, pillY, pillW, pillH, 13 * fontScale);
                ctx.fill();
                ctx.stroke();
                
                // Oyuncu İsmi
                ctx.fillStyle = pColor;
                ctx.shadowColor = isDark ? "#ffffff" : pColor;
                ctx.shadowBlur = isDark ? 3 : 6;
                ctx.textAlign = "center";
                ctx.fillText(pName, startX_skip + (pillW/2), boxY);
                
                startX_skip += pillW + gap; 
            });
        }
        
        ctx.restore();
        return; // Ortadaki GOOOL yazısını çizmeyi atla
    }

    // 🔊 GOL SESİ - Her yeni gol için 1 kez çal
    // ✨ İmza: skorlar + scorer_pid (yeni gol → skor değişir → imza değişir)
    const _gs = miniData.gameState;
    const _scores = _gs ? `${_gs.scores["1"]}-${_gs.scores["2"]}` : "0-0";
    const _scorerPidForSig = celebration.scorer_pid || celebration.scorer_id;
    const goalSignature = `${_scorerPidForSig}_${_scores}`;
    
    if (celebration.silent === true) {
        // Pause sonrası aynı gol → ses çalma
        // İmzayı "silent" ile işaretle → bir sonraki gerçek gol farklı imza sayılır
        miniData._lastGoalSignature = "silent_" + goalSignature;
    } else if (miniData._lastGoalSignature !== goalSignature) {
        // Yeni gol → ses çal
        MiniAudio.playRandom("goal",
            ["goal_1.mp3", "goal_2.mp3", "goal_3.mp3"], 0.7);
        miniData._lastGoalSignature = goalSignature;
        
        // 🛡️ Takım Bazlı 2. Kendi Kalesine Gol Kontrolü:
        if (isOwnGoal && _scorerPidForSig) {
            // Atan oyuncunun takımını bulalım
            const scorerPlayerObj = miniData.players.find(p => p.id === _scorerPidForSig);
            let ownGoalTeam = null;
            if (scorerPlayerObj && (scorerPlayerObj.team === "red" || scorerPlayerObj.team === "blue")) {
                ownGoalTeam = scorerPlayerObj.team;
            } else {
                // fallback (oyuncu verisi bulunamazsa)
                const ownGoalTeamId = (scorerTeamId === 1) ? 2 : 1;
                ownGoalTeam = (ownGoalTeamId === 1) ? "red" : "blue";
            }
            
            if (ownGoalTeam) {
                if (!miniData._teamOwnGoalsCount) {
                    miniData._teamOwnGoalsCount = { red: 0, blue: 0 };
                }
                
                // Takımın kendi kalesine gol sayısını bir artır
                miniData._teamOwnGoalsCount[ownGoalTeam] = (miniData._teamOwnGoalsCount[ownGoalTeam] || 0) + 1;
                
                // Eğer bu takım toplamda tam 2. kez kendi kalesine gol attıysa troll sesini çal!
                if (miniData._teamOwnGoalsCount[ownGoalTeam] === 2) {
                    let vol = 0.5;
                    if (typeof window.getGlobalVolume === "function") {
                        const gv = window.getGlobalVolume();
                        if (typeof gv === "number" && !isNaN(gv)) vol = gv;
                    }
                    
                    // Normal gol sesinin hemen ardından (400ms rötarla) troll ses çalsın
                    setTimeout(() => {
                        MiniAudio.play("own_goal.mp3", Math.max(0, Math.min(1, vol * 1.2))); // Komedi etkisi için %20 daha yüksek sesle!
                    }, 400);
                }
            }
        }
        
        // ✨ TİTREŞİM - Ben mi attım, yedim mi?
        // Benim takımım scorer takımıyla aynı mı?
        const myPlayer = miniData.players.find(p => p.id === miniData.playerId);
        const myTeam = myPlayer ? myPlayer.team : null;
        const scorerTeam = scorerTeamId === 1 ? "red" : "blue";
        
        if (myTeam === "red" || myTeam === "blue") {
            // Takımdayım
            let iScored = (myTeam === scorerTeam);
            if (isOwnGoal) iScored = !iScored;  // Kendi kalesineyse ters çevir
            
            if (iScored) {
                MiniVibration.goalScored();
            } else {
                MiniVibration.goalConceded();
            }
        }
        // İzleyiciyim → titreşim yok
    }

    // Hafif arkaplan — Yılan/Kartal gibi görsel sevinçlerde karartma yapma (renkler boğulmasın)
    let skipDarken = false;
    if (miniData.gameState && miniData.gameState.players) {
        for (const _pid in miniData.gameState.players) {
            const _rp = miniData.gameState.players[_pid];
            if (_rp && _rp.celebrating) {
                const _ct = _rp.celebration_type || "";
                if (_ct === "snake" || _ct === "eagle_wings" || _ct === "rainbow_trail") {
                    skipDarken = true;
                    break;
                }
            }
        }
    }
    // celebration_type doğrudan goal_celebration paketinden de gelebilir
    if (celebration.celebration_type === "snake" || 
        celebration.celebration_type === "eagle_wings" || 
        celebration.celebration_type === "rainbow_trail") {
        skipDarken = true;
    }

    if (!skipDarken) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fillRect(0, 0, cfg.width, cfg.height);
    }
    
    // 🎉 Gol şarkısı (Kendi kalesine DEĞİLSE + yeni gol ise herkes için çal)
    if (!isOwnGoal && miniData._lastGoalSignature === goalSignature && !celebration.silent) {
        if (!miniData._goalSongPlayed || miniData._goalSongPlayed !== goalSignature) {
            miniData._goalSongPlayed = goalSignature;
            
            // ✨ Ses seviyesini güvenli oku (0 olsa bile şarkı nesnesini başlatacağız)
            let vol = 0.5;
            if (typeof window.getGlobalVolume === "function") {
                const gv = window.getGlobalVolume();
                if (typeof gv === "number" && !isNaN(gv)) vol = gv;
            }
            
            // Eski şarkı çalıyorsa hemen durdur ve sıfırla
            if (miniData._goalSongAudio) {
                try { 
                    miniData._goalSongAudio.pause();
                    miniData._goalSongAudio.currentTime = 0;
                } catch(e) {}
            }

            // Host'un tüm odaya senkronize ettiği, üst üste çalmayan şarkıyı al
            let selectedSong = celebration.selected_song;
            
            // Eğer ola ki bir ağ paket kaybından dolayı boş gelirse (Fallback güvenlik sistemi)
            if (!selectedSong) {
                const defaultPool = ["goal_song_1.mp3", "goal_song_2.mp3", "goal_song_3.mp3"];
                selectedSong = defaultPool[Math.floor(Math.random() * defaultPool.length)];
            }

            const song = new Audio(`/oyun_modlari/mini_futbol/sounds/Goal_Songs/${selectedSong}`);
            song.loop = false;
            
            // ✨ Başlangıç senkronizasyonu: Şarkıyı o anki saniyesine kurşun gibi oturt
            // (Replay süresine göre dinamik olarak elapsed hesaplıyoruz)
            const rDur = celebration.replay_duration || 10.0;
            const totalWait = 5.0 + rDur;
            const elapsed = totalWait - celebration.wait_remaining;
            if (elapsed > 0 && elapsed < totalWait) {
                song.currentTime = elapsed;
            }

            // 🛡️ OTOMATİK HATA KURTARMA (FALLBACK):
            song.onerror = () => {
                const fb = new Audio(`/oyun_modlari/mini_futbol/sounds/Goal_Songs/goal_song_1.mp3`);
                fb.currentTime = song.currentTime;
                fb.play().catch(() => {});
                miniData._goalSongAudio = fb;
            };

            song.play().catch(() => {});
            miniData._goalSongAudio = song;
        }
    }
    
    // Pulse
    const pulse = Math.sin(Date.now() / 150) * 0.05 + 1;
    
    ctx.save();
    ctx.translate(cfg.width / 2, cfg.height / 2);
    
    // ============ GOOOL! yazısı (üstte, büyük) ============
    const goolY = -60;
    ctx.font = `bold ${Math.round(75 * pulse * fontScale)}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 35;
    
    const dynRed = miniData.redTeamColor || "#ff6b6b";
    const dynBlue = miniData.blueTeamColor || "#4dabf7";

    // ✨ Kulüp takımları için GOOOL Dolgu (Inner) ve Kenarlık (Stroke) renkleri
    const getGoalTextTheme = (teamKey, fallbackColor) => {
        const tName = (teamKey === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
        const norm = tName.trim().toLowerCase();
        
        if (["fenerbahçe", "fenerbahce", "fb"].includes(norm)) 
            return { fill: "#ffed00", stroke: "#00205b" }; // Sarı dolgu, Lacivert kenar
        if (["galatasaray", "gs"].includes(norm)) 
            return { fill: "#fdb913", stroke: "#a90429" }; // Sarı dolgu, Kırmızı kenar
        if (["trabzonspor", "ts"].includes(norm)) 
            return { fill: "#4ab3e8", stroke: "#700018" }; // Mavi dolgu, Bordo kenar
        if (["beşiktaş", "besiktas", "bjk"].includes(norm)) 
            return { fill: "#ffffff", stroke: "#111111" }; // Beyaz dolgu, Siyah kenar
            
        return { fill: fallbackColor, stroke: "#ffffff" }; // Diğerleri: Takım rengi dolgu, Beyaz kenar
    };
    
    let theme = { fill: "#ffd43b", stroke: "#ffffff" };
    if (isOwnGoal) {
        let ownTeamKey = "red";
        const scorerPlayerObj = miniData.players.find(p => p.id === scorerPid);
        if (scorerPlayerObj && scorerPlayerObj.team === "blue") ownTeamKey = "blue";
        else if (scorerPlayerObj && scorerPlayerObj.team === "red") ownTeamKey = "red";
        else if (scorerTeamId === 2) ownTeamKey = "blue";
        
        const fallback = ownTeamKey === "blue" ? dynBlue : dynRed;
        theme = getGoalTextTheme(ownTeamKey, fallback);
    } else {
        const teamKey = scorerTeamId === 1 ? "red" : "blue";
        const fallback = scorerTeamId === 1 ? dynRed : dynBlue;
        theme = getGoalTextTheme(teamKey, fallback);
    }

    // Yazı Dolgusu (Artık beyaz değil, senin istediğin renk)
    ctx.shadowBlur = 35;
    ctx.shadowColor = theme.fill;
    ctx.fillStyle = theme.fill;
    ctx.fillText("⚽ GOOOL!", 0, goolY);
    
    // Kenarlık (Stroke)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = theme.stroke;
    ctx.lineWidth = 3.5; // Daha belirgin olması için hafif kalınlaştırıldı
    ctx.strokeText("⚽ GOOOL!", 0, goolY);
    
    // ============ ALT BİLGİ ============
    if (isOwnGoal) {
        let ownTeamKey = "red";
        const scorerPlayerObj = miniData.players.find(p => p.id === scorerPid);
        if (scorerPlayerObj && scorerPlayerObj.team === "blue") ownTeamKey = "blue";
        else if (scorerPlayerObj && scorerPlayerObj.team === "red") ownTeamKey = "red";
        else if (scorerTeamId === 2) ownTeamKey = "blue";
        
        const fallback = ownTeamKey === "blue" ? dynBlue : dynRed;
        const ownColor = getGoalTextTheme(ownTeamKey, fallback).fill;

        ctx.font = `bold ${Math.round(28 * fontScale)}px Segoe UI`;
        ctx.shadowBlur = 20;
        ctx.shadowColor = ownColor;
        ctx.fillStyle = ownColor;
        ctx.fillText(`${scorerName} Kendi Kalesine Attı`, 0, 20);
    } else {
        const scorerTeamKey = scorerTeamId === 1 ? "red" : "blue";
        const scorerTeamColor = getGoalTextTheme(
            scorerTeamKey,
            scorerTeamId === 1 ? dynRed : dynBlue
        ).fill;
        
        // Golü Atan satırı
        ctx.font = `bold ${Math.round(26 * fontScale)}px Segoe UI`;
        ctx.shadowBlur = 0;
        ctx.textAlign = "center";
        
        // ✨ "Golü Atan: " kısmı (takım rengi)
        const label1 = "Golü Atan: ";
        const label1W = ctx.measureText(label1).width;
        const nameW = ctx.measureText(scorerName).width;
        const totalW = label1W + nameW;
        
        ctx.textAlign = "left";
        ctx.shadowBlur = 15;
        ctx.shadowColor = scorerTeamColor;
        ctx.fillStyle = scorerTeamColor;
        ctx.fillText(label1, -totalW / 2, 15);
        
        // İsim (aynı renk)
        ctx.fillText(scorerName, -totalW / 2 + label1W, 15);
        
        // Asist satırı (varsa)
        if (assistName) {
            ctx.font = `bold ${Math.round(22 * fontScale)}px Segoe UI`;
            
            const label2 = "Asist: ";
            const label2W = ctx.measureText(label2).width;
            const assistW = ctx.measureText(assistName).width;
            const totalW2 = label2W + assistW;
            
            ctx.textAlign = "left";
            ctx.shadowBlur = 15;
            ctx.shadowColor = scorerTeamColor;
            ctx.fillStyle = scorerTeamColor;
            ctx.fillText(label2, -totalW2 / 2, 55);
            
            // Asist ismi (aynı renk)
            ctx.fillText(assistName, -totalW2 / 2 + label2W, 55);
        }
    }
    
    ctx.restore();
}

// ========================================
// 🌐 P2P BAĞLANTI GÖSTERGESİ
// ========================================
function updateMiniConnectionBadge() {
    let badge = document.getElementById("miniConnBadge");
    
    if (!badge) {
        badge = document.createElement("div");
        badge.id = "miniConnBadge";
        badge.style.cssText = `
            position: fixed;
            top: 12px;
            right: 12px;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            font-family: 'Segoe UI', sans-serif;
            z-index: 9998;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            pointer-events: none;
        `;
        document.body.appendChild(badge);
    }
    
    const gameScreen = document.getElementById("miniGameScreen");
    const lobbyScreen = document.getElementById("miniLobbyScreen");
    const inGame = gameScreen && !gameScreen.classList.contains("hidden");
    const inLobby = lobbyScreen && !lobbyScreen.classList.contains("hidden");
    
    if (!inGame && !inLobby) {
        badge.style.display = "none";
        return;
    }
    
    badge.style.display = "block";
    
    const isHost = miniData.playerId === 1;
    const otherCount = miniData.players ? miniData.players.filter(p => p.id !== miniData.playerId).length : 0;
    
    if (isHost && otherCount === 0) {
        badge.innerHTML = "🏠 Yalnız (Local)";
        badge.style.background = "rgba(148, 168, 255, 0.9)";
        badge.style.color = "#fff";
        return;
    }
    
    let connectedCount = 0;
    for (const pid in MiniRTC.peers) {
        if (MiniRTC.peers[pid].connected) connectedCount++;
    }

    if (MiniRTC.connected || connectedCount > 0) {
        badge.innerHTML = isHost ? `🚀 P2P (${connectedCount}/${otherCount} Oyuncu)` : "🚀 P2P Direkt";
        badge.style.background = "rgba(81, 207, 102, 0.9)";
        badge.style.color = "#fff";
    } else {
        badge.innerHTML = "☁️ Sunucu";
        badge.style.background = "rgba(255, 169, 77, 0.9)";
        badge.style.color = "#fff";
    }
}

// ========================================
// ⚠️ HOST SEKME DEĞİŞTİRME UYARISI (Sol Üst)
// ========================================
function updateMiniHostVisibilityBadge(isHidden) {
    let badge = document.getElementById("miniHostVisibilityBadge");
    
    if (!badge) {
        badge = document.createElement("div");
        badge.id = "miniHostVisibilityBadge";
        badge.style.cssText = `
            position: fixed;
            top: 12px;
            left: 12px;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            font-family: 'Segoe UI', sans-serif;
            z-index: 9998;
            transition: all 0.3s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
            pointer-events: none;
            background: rgba(255, 107, 107, 0.95);
            color: #fff;
            display: none;
        `;
        badge.innerHTML = "⚠️ Host Başka Sekmede (Gecikme Olabilir)";
        document.body.appendChild(badge);
    }
    
    // Sadece oyun ekranındaysa ve gizlendiyse göster
    const gameScreen = document.getElementById("miniGameScreen");
    if (!gameScreen || gameScreen.classList.contains("hidden")) {
        badge.style.display = "none";
        return;
    }
    
    badge.style.display = isHidden ? "block" : "none";
}

// ========================================
// HUD (Skor + Süre)
// ========================================
function updateMiniHUD() {
    const state = miniData.gameState;
    if (!state) return;
    
    const scoreEl = document.getElementById("miniScoreDisplay");
    const timeEl = document.getElementById("miniTimeDisplay");
    const sprintEl = document.getElementById("miniSprintDisplay");
    
    // ✨ P2P bağlantı göstergesi
    updateMiniConnectionBadge();
    
    const s1 = state.scores["1"] || 0;
    const s2 = state.scores["2"] || 0;
    
    // ✨ Takıma göre isim al (ID'ye göre değil)
    const redPlayer = miniData.players.find(p => p.team === "red");
    const bluePlayer = miniData.players.find(p => p.team === "blue");
    const n1 = redPlayer ? redPlayer.name : (miniData.redTeamName || "Kırmızı");
    const n2 = bluePlayer ? bluePlayer.name : (miniData.blueTeamName || "Mavi");
    
    if (scoreEl) {
        const rc = miniData.redTeamColor || "#ff6b6b";
        const bc = miniData.blueTeamColor || "#4dabf7";

        // 🏆 Tüm Takımlar İçin Sadece Harf İçinde Akan Temiz Renk Kayma Animasyonu
        if (!document.getElementById("teamHudAnimationStyles")) {
            const style = document.createElement("style");
            style.id = "teamHudAnimationStyles";
            style.textContent = `
                @keyframes teamColorShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .bjk-animated-hud-text {
                    background: linear-gradient(90deg, #111111 0%, #777777 25%, #ffffff 50%, #777777 75%, #111111 100%);
                    background-size: 400% 100%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: teamColorShift 22s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));
                    font-weight: 800;
                    display: inline-block;
                }
                .gs-animated-hud-text {
                    background: linear-gradient(90deg, #a90429 0%, #d4671e 25%, #fdb913 50%, #d4671e 75%, #a90429 100%);
                    background-size: 400% 100%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: teamColorShift 22s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));
                    font-weight: 800;
                    display: inline-block;
                }
                .fb-animated-hud-text {
                    background: linear-gradient(90deg, #00205b 0%, #006097 25%, #ffed00 50%, #006097 75%, #00205b 100%);
                    background-size: 400% 100%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: teamColorShift 22s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));
                    font-weight: 800;
                    display: inline-block;
                }
                .ts-animated-hud-text {
                    background: linear-gradient(90deg, #700018 0%, #5d59a8 25%, #4ab3e8 50%, #5d59a8 75%, #700018 100%);
                    background-size: 400% 100%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: teamColorShift 22s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));
                    font-weight: 800;
                    display: inline-block;
                }
                .tr-animated-hud-text {
                    background: linear-gradient(90deg, #e30a17 0%, #f1858c 25%, #ffffff 50%, #f1858c 75%, #e30a17 100%);
                    background-size: 400% 100%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: teamColorShift 22s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));
                    font-weight: 800;
                    display: inline-block;
                }
                .az-animated-hud-text {
                    background: linear-gradient(90deg, #00a8e8 0%, #7165cf 25%, #e32118 50%, #8ca630 75%, #38a047 100%);
                    background-size: 400% 100%;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: teamColorShift 22s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.9));
                    font-weight: 800;
                    display: inline-block;
                }
            `;
            document.head.appendChild(style);
        }

        // ✨ Sivil/Kulüp takımları için özel HUD metin stili (Canlı ipeksi animasyonlu)
        const getHUDNameStyle = (teamName, teamColor) => {
            const norm = (teamName || "").trim().toLowerCase();
            if (["beşiktaş", "besiktas", "bjk"].includes(norm)) return `class="bjk-animated-hud-text"`;
            if (["galatasaray", "gs"].includes(norm)) return `class="gs-animated-hud-text"`;
            if (["fenerbahçe", "fenerbahce", "fb"].includes(norm)) return `class="fb-animated-hud-text"`;
            if (["trabzonspor", "ts"].includes(norm)) return `class="ts-animated-hud-text"`;
            if (["türkiye", "turkiye"].includes(norm)) return `class="tr-animated-hud-text"`;
            if (["azerbaycan", "azerbaijan"].includes(norm)) return `class="az-animated-hud-text"`;

            let color = teamColor;
            const rgb = hexToRgbParts(teamColor);
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            if (brightness < 50) color = "#ffffff";

            const shadow = "0 0 5px rgba(0,0,0,0.5)";
            return `style="color:${color}; text-shadow:${shadow};"`;
        };

        const redStyle = getHUDNameStyle(miniData.redTeamName, rc);
        const blueStyle = getHUDNameStyle(miniData.blueTeamName, bc);

        const targetHtml = `
            <span ${redStyle}>${n1}</span>
            <span style="margin: 0 15px; font-size:32px; color:#ffd43b; text-shadow: 0 0 15px rgba(255,212,59,0.3);">${s1} - ${s2}</span>
            <span ${blueStyle}>${n2}</span>
        `;

        // ✨ 60 FPS'de DOM elemanının sürekli silinip animasyonun donmasını engellemek için akıllı önbellek
        if (miniData._cachedScoreHtml !== targetHtml) {
            miniData._cachedScoreHtml = targetHtml;
            scoreEl.innerHTML = targetHtml;
        }
    }
    
    if (timeEl) {
        // ✨ Sınırsız süre kontrolü
        if (miniData.matchDuration >= 99999) {
            timeEl.textContent = "♾️";
            timeEl.style.color = "#ffd43b";
        } else {
            // ✨ Yukarı yuvarla (0:59 yerine 1:00 gösterir)
            const t = Math.max(0, Math.ceil(state.time_left || 0));
            const min = Math.floor(t / 60);
            const sec = t % 60;
            timeEl.textContent = `${min}:${sec.toString().padStart(2, "0")}`;
            if (t <= 10) {
                timeEl.style.color = "#ff6b6b";
            } else {
                timeEl.style.color = "#ffd43b";
            }
        }
    }
    
    // ✨ SPRINT ENERJİ gösterimi (bar)
    // ✨ HOST ise HP'den direkt oku (backend'in eski state'i karışmasın)
    let mySprint = null;
    if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players?.[1]) {
        const p = HP.room.gameState.players[1];
        mySprint = {
            energy: p.sprint_energy || 0,
            max_energy: 100,
            active: p.keys.sprint && p.sprint_energy > 0
        };
    } else if (state.sprint) {
        mySprint = state.sprint[String(miniData.playerId)];
    }
    
    if (sprintEl && mySprint) {
        {
            const energyPercent = (mySprint.energy / mySprint.max_energy) * 100;
            const energyRounded = Math.round(energyPercent);
            const isActive = mySprint.active;
            
            let color, bg;
            if (isActive) {
                color = "#ffd43b";
                bg = "rgba(255,212,59,0.25)";
            } else if (energyPercent >= 50) {
                color = "#51cf66";
                bg = "rgba(81,207,102,0.15)";
            } else if (energyPercent > 0) {
                color = "#ffa94d";
                bg = "rgba(255,169,77,0.15)";
            } else {
                color = "#ff6b6b";
                bg = "rgba(255,107,107,0.15)";
            }
            
            sprintEl.innerHTML = `⚡ Sprint: ${energyRounded}%`;
            sprintEl.style.color = color;
            sprintEl.style.background = bg;
        }
    }
}

// ========================================
// OYUN SONU
// ========================================
function showMiniGameOver(msg) {
    // ✨ HP fizik motorunu durdur ama render'ı bırak (arka planda oyun görünsün)
    if (typeof HP !== 'undefined' && HP.running) HP.stopGame();
    
    const box = document.getElementById("miniGameOverBox");
    if (!box) return;
    box.classList.remove("hidden");
    
    const s1 = msg.scores["1"] || 0;
    const s2 = msg.scores["2"] || 0;
    
    // === BAŞLIK ===
    const title = document.getElementById("miniGameOverTitle");
    if (msg.winner_id === miniData.playerId) {
        title.textContent = "🏆 KAZANDIN!";
        title.style.color = "#51cf66";
        if (typeof startConfetti === "function") startConfetti();
    } else if (msg.winner_id === 0) {
        title.textContent = "🤝 BERABERE!";
        title.style.color = "#ffd43b";
    } else {
        title.textContent = "😢 KAYBETTİN";
        title.style.color = "#ff6b6b";
    }
    
    // === SKOR SATIRI ===
    const dynRed = miniData.redTeamColor || "#ff6b6b";
    const dynBlue = miniData.blueTeamColor || "#4dabf7";

    const isGameOverColorDark = (hex) => {
        const rgb = hexToRgbParts(hex);
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        const max = Math.max(rgb.r, rgb.g, rgb.b);
        const min = Math.min(rgb.r, rgb.g, rgb.b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        return brightness < 55 && saturation < 0.22;
    };

    const redTextCol = isGameOverColorDark(dynRed) ? "#ffffff" : dynRed;
    const blueTextCol = isGameOverColorDark(dynBlue) ? "#ffffff" : dynBlue;

    const scoreLine = document.getElementById("miniGameOverScoreLine");
    if (scoreLine) {
        scoreLine.innerHTML = `
            <span style="color:${redTextCol}; text-shadow: ${isGameOverColorDark(dynRed) ? '0 0 10px rgba(255,255,255,0.5)' : 'none'};">${miniData.redTeamName || "Kırmızı"}</span>
            <span style="margin:0 18px; color:#ffd43b;">${s1} - ${s2}</span>
            <span style="color:${blueTextCol}; text-shadow: ${isGameOverColorDark(dynBlue) ? '0 0 10px rgba(255,255,255,0.5)' : 'none'};">${miniData.blueTeamName || "Mavi"}</span>
        `;
    }
    
    // Stats al (son state'ten)
    const stats = (miniData.gameState && miniData.gameState.stats) || {};

    // ✨ MVP HESAPLAMA (Görsel olarak doğrudan tablodaki satıra giydirilir)
    let mvpId = null;
    let maxMvpScore = -1;
    
    // MVP Puanı: Gol=3, Asist=2, Kurtarış=2, Pas=0.5
    miniData.players.forEach(p => {
        if (p.team === "spectator") return;
        const st = stats[String(p.id)] || { goals: 0, assists: 0, passes: 0, saves: 0 };
        const playerScore = (st.goals * 3) + (st.assists * 2) + (st.saves * 2) + (st.passes * 0.5);
        
        if (playerScore > maxMvpScore && playerScore > 0) {
            maxMvpScore = playerScore;
            mvpId = p.id;
        }
    });
    
    // Eski MVP kutusunu kaldır (artık üstte gösterilmeyecek)
    const oldMvp = document.getElementById("miniGameOverMvpBox");
    if (oldMvp) oldMvp.remove();
    
    // SCOREBOARD
    // Takım başlıkları
    const redTitle = document.getElementById("miniGameOverRedTitle");
    const blueTitle = document.getElementById("miniGameOverBlueTitle");
    if (redTitle) {
        redTitle.innerHTML = `<span style="color:${redTextCol}; font-size:18px;">●</span> ${miniData.redTeamName || "Kırmızı Takım"}`;
        redTitle.style.color = redTextCol;
    }
    if (blueTitle) {
        blueTitle.innerHTML = `<span style="color:${blueTextCol}; font-size:18px;">●</span> ${miniData.blueTeamName || "Mavi Takım"}`;
        blueTitle.style.color = blueTextCol;
    }
    
    // ✨ Kartın taşmasını engelle & oyuncu sütunlarının daralmasını önle
    const overCard = box.querySelector(".overlayCard");
    if (overCard) {
        overCard.style.maxHeight = "90vh";
        overCard.style.overflowY = "auto";
    }

    // Sütun kutularının arka planı/kenarlığı ve min-height ayarı
    const redCol = document.getElementById("miniGameOverRedCol");
    const blueCol = document.getElementById("miniGameOverBlueCol");
    const specCol = document.getElementById("miniGameOverSpecCol") || (box && box.querySelector(".teamSpec"));

    if (redCol) {
        const isRedDark = isGameOverColorDark(dynRed);
        if (isRedDark) {
            redCol.style.setProperty("border", "2px solid #ffffff", "important");
            redCol.style.setProperty("background", "linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04))", "important");
            redCol.style.setProperty("box-shadow", "0 0 20px rgba(255, 255, 255, 0.25)", "important");
        } else {
            redCol.style.setProperty("border", "1px solid " + hexToRgba(dynRed, 0.35), "important");
            redCol.style.setProperty("background", hexToRgba(dynRed, 0.08), "important");
            redCol.style.setProperty("box-shadow", "none", "important");
        }
        redCol.style.minHeight = "130px";
    }
    if (blueCol) {
        const isBlueDark = isGameOverColorDark(dynBlue);
        if (isBlueDark) {
            blueCol.style.setProperty("border", "2px solid #ffffff", "important");
            blueCol.style.setProperty("background", "linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04))", "important");
            blueCol.style.setProperty("box-shadow", "0 0 20px rgba(255, 255, 255, 0.25)", "important");
        } else {
            blueCol.style.setProperty("border", "1px solid " + hexToRgba(dynBlue, 0.35), "important");
            blueCol.style.setProperty("background", hexToRgba(dynBlue, 0.08), "important");
            blueCol.style.setProperty("box-shadow", "none", "important");
        }
        blueCol.style.minHeight = "130px";
    }
    
    // Oyuncuları takımlara ayır
    const redTeam = miniData.players.filter(p => p.team === "red");
    const blueTeam = miniData.players.filter(p => p.team === "blue");
    const spectators = miniData.players.filter(p => p.team !== "red" && p.team !== "blue");

    // =========================================================================
    // 📊 TAKIM KARŞILAŞTIRMA İSTATİSTİK ÇUBUKLARI (MATCH STATS COMPARISON)
    // =========================================================================
    const _rematchBtn = document.getElementById("miniRematchBtn");
    const _menuBtn = document.getElementById("miniGameOverMenuBtn");
    let statsContainer = document.getElementById("miniGameOverTeamStats");
    const btnBox = (_rematchBtn && _rematchBtn.parentElement) || (_menuBtn && _menuBtn.parentElement) || document.querySelector("#miniGameOverBox .confirmButtons");
    
    if (!statsContainer && btnBox) {
        statsContainer = document.createElement("div");
        statsContainer.id = "miniGameOverTeamStats";
        statsContainer.style.cssText = `
            margin: 12px 0;
            padding: 10px 14px;
            background: rgba(0, 0, 0, 0.35);
            border-radius: 10px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            display: flex;
            flex-direction: column;
            gap: 6px;
            box-sizing: border-box;
            width: 100%;
            flex-shrink: 0;
        `;
        btnBox.insertAdjacentElement("beforebegin", statsContainer);
    }

    if (statsContainer) {
        // Toplam İstatistikleri Hesapla
        let rPasses = 0, bPasses = 0;
        let rSaves = 0, bSaves = 0;
        let rAssists = 0, bAssists = 0;

        redTeam.forEach(p => {
            const st = stats[String(p.id)] || {};
            rPasses += (st.passes || 0);
            rSaves += (st.saves || 0);
            rAssists += (st.assists || 0);
        });
        blueTeam.forEach(p => {
            const st = stats[String(p.id)] || {};
            bPasses += (st.passes || 0);
            bSaves += (st.saves || 0);
            bAssists += (st.assists || 0);
        });

        // Kaleyi Bulan Şutlar (Goller + Rakip Kalecinin Kurtarışları + Takımın Direk Hits)
        const rPostHits = (miniData._teamPostHits && miniData._teamPostHits.red) || 0;
        const bPostHits = (miniData._teamPostHits && miniData._teamPostHits.blue) || 0;
        const rShots = s1 + bSaves + rPostHits;
        const bShots = s2 + rSaves + bPostHits;
        const totShots = rShots + bShots;

        // ⚽ Topa Sahip Olma % (Gerçekçi pas ağırlıklı topla oynama yüzdesi hesabı)
        const rPossPts = (rPasses * 10) + (rAssists * 5) + (s1 * 5);
        const bPossPts = (bPasses * 10) + (bAssists * 5) + (s2 * 5);
        const totalPossPts = rPossPts + bPossPts;

        let rPoss = 50, bPoss = 50;
        if (totalPossPts > 0) {
            rPoss = Math.round((rPossPts / totalPossPts) * 100);
            bPoss = 100 - rPoss;
        }

        const statRows = [
            { title: "⚽ Topa Sahip Olma", rVal: `%${rPoss}`, bVal: `%${bPoss}`, rPct: rPoss, bPct: bPoss },
            { title: "🎯 Kaleyi Bulan Şut", rVal: rShots, bVal: bShots, rPct: (totShots > 0) ? Math.round((rShots / totShots) * 100) : 50, bPct: (totShots > 0) ? Math.round((bShots / totShots) * 100) : 50 },
            { title: "⚽ Goller", rVal: s1, bVal: s2, rPct: (s1 + s2 > 0) ? Math.round((s1 / (s1 + s2)) * 100) : 50, bPct: (s1 + s2 > 0) ? Math.round((s2 / (s1 + s2)) * 100) : 50 },
            { title: "🤝 Toplam Pas", rVal: rPasses, bVal: bPasses, rPct: (rPasses + bPasses > 0) ? Math.round((rPasses / (rPasses + bPasses)) * 100) : 50, bPct: (rPasses + bPasses > 0) ? Math.round((bPasses / (rPasses + bPasses)) * 100) : 50 },
            { title: "🧤 Kurtarışlar", rVal: rSaves, bVal: bSaves, rPct: (rSaves + bSaves > 0) ? Math.round((rSaves / (rSaves + bSaves)) * 100) : 50, bPct: (rSaves + bSaves > 0) ? Math.round((bSaves / (rSaves + bSaves)) * 100) : 50 }
        ];

        let statsHtml = `
            <div style="font-size:10px; font-weight:800; color:#adb5bd; letter-spacing:1px; text-transform:uppercase; text-align:center; margin-bottom:2px;">
                📊 Takım Maç İstatistikleri
            </div>
        `;

        // ✨ Beşiktaş gibi koyu takımlarda istatistik yazılarının ve çubuklarının beyaz görünmesini sağlayan renk kontrolü
        const getStatBarColor = (teamName, teamColor) => {
            const norm = (teamName || "").trim().toLowerCase();
            if (["beşiktaş", "besiktas", "bjk"].includes(norm)) return "#ffffff";
            const rgb = hexToRgbParts(teamColor);
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            return brightness < 55 ? "#ffffff" : teamColor;
        };

        const rStatCol = getStatBarColor(miniData.redTeamName, dynRed);
        const bStatCol = getStatBarColor(miniData.blueTeamName, dynBlue);

        statRows.forEach(sr => {
            statsHtml += `
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:bold; margin-bottom:2px;">
                        <span style="color:${rStatCol}; font-family:monospace; font-size:12px;">${sr.rVal}</span>
                        <span style="color:#e0e0e0; font-size:10px;">${sr.title}</span>
                        <span style="color:${bStatCol}; font-family:monospace; font-size:12px;">${sr.bVal}</span>
                    </div>
                    <div style="display:flex; height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                        <div style="width:${sr.rPct}%; background:${rStatCol}; transition:width 0.8s cubic-bezier(0.25, 1, 0.5, 1); border-top-left-radius:3px; border-bottom-left-radius:3px;"></div>
                        <div style="width:${sr.bPct}%; background:${bStatCol}; transition:width 0.8s cubic-bezier(0.25, 1, 0.5, 1); border-top-right-radius:3px; border-bottom-right-radius:3px;"></div>
                    </div>
                </div>
            `;
        });

        statsContainer.innerHTML = statsHtml;
    }
    
    // Takım listesi render
    function renderTeamList(containerId, players, nameColor, teamKey) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = "";
        
        if (players.length === 0) {
            container.innerHTML = `<div class="miniGameOverSpecEmpty">Boş</div>`;
            return;
        }

        const tName = (teamKey === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
        const normName = tName.trim().toLowerCase();
        let resolvedNameColor = nameColor;
        if (["fenerbahçe", "fenerbahce", "fb"].includes(normName)) {
            resolvedNameColor = "#ffed00";
        } else if (["galatasaray", "gs"].includes(normName)) {
            resolvedNameColor = "#fdb913";
        } else if (["trabzonspor", "ts"].includes(normName)) {
            resolvedNameColor = "#4ab3e8";
        } else if (["beşiktaş", "besiktas", "bjk"].includes(normName)) {
            resolvedNameColor = "#ffffff";
        }
        
        // Header
        const header = document.createElement("div");
        header.className = "miniGameOverHeader";
        header.innerHTML = `
            <div style="text-align:left; padding-left:4px;">İsim</div>
            <div title="Gol">Gol</div>
            <div title="Asist">Asist</div>
            <div title="Pas">Pas</div>
            <div title="Kurtarış">Kurtarış</div>
            <div title="Ping">Ping</div>
        `;
        container.appendChild(header);
        
        // Satırlar (animasyon delay ile)
        players.forEach((p, i) => {
            const st = stats[String(p.id)] || { goals: 0, assists: 0, passes: 0 };
            const isMe = p.id === miniData.playerId;
            const isMvp = p.id === mvpId;
            const crown = p.id === 1 ? " 👑" : "";
            const meMark = isMe ? ' <span style="color:#909090;font-size:10px;">(sen)</span>' : '';
            
            // Ping bilgisi
            const ping = (miniData.pings && miniData.pings[p.id] !== undefined) ? miniData.pings[p.id] : null;
            let pingText = "-";
            let pingColor = "#909090";
            if (ping !== null) {
                pingText = `${ping}ms`;
                if (ping < 80) pingColor = "#51cf66";
                else if (ping < 200) pingColor = "#ffd43b";
                else pingColor = "#ff6b6b";
            }
            
            // ✨ UZUN İSİMLERİ SIĞDIRMA ALGORİTMASI (Font-size auto scaling)
            const rawName = p.name || "";
            let nameFontSize = 13.5;
            // İsim uzunluğu 10 karakteri aşarsa font-size'ı yumuşakça küçült (min 9px)
            if (rawName.length > 10) {
                nameFontSize = Math.max(9, 13.5 - (rawName.length - 10) * 0.3);
            }
            
            const row = document.createElement("div");
            row.className = "miniGameOverRow";
            row.style.animationDelay = (0.7 + i * 0.1) + "s";
            
            // ✨ MVP SATIR TASARIMI (Sarı parlama, altın çerçeve, özel degrade arka plan)
            if (isMvp) {
                row.style.setProperty("border", "2px solid #ffd43b", "important");
                row.style.setProperty("background", "linear-gradient(90deg, rgba(255, 212, 59, 0.18), rgba(255, 212, 59, 0.05))", "important");
                row.style.setProperty("box-shadow", "0 0 15px rgba(255, 212, 59, 0.35)", "important");
                row.style.setProperty("border-radius", "8px", "important");
            }
            
            row.innerHTML = `
                <span class="miniGameOverName" style="color:${isMvp ? '#ffd43b' : nameColor}; font-size:${nameFontSize}px; white-space:nowrap; overflow:hidden; text-overflow:clip; display:inline-block; line-height:1.2; padding-left:4px; ${isMe ? 'font-weight:800;' : ''}">
                    ${rawName}${crown}${meMark}
                </span>
                <span class="miniGameOverStat" style="${isMvp ? 'color:#ffd43b; font-weight:bold;' : ''}">${st.goals}</span>
                <span class="miniGameOverStat" style="${isMvp ? 'color:#ffd43b; font-weight:bold;' : ''}">${st.assists}</span>
                <span class="miniGameOverStat" style="${isMvp ? 'color:#ffd43b; font-weight:bold;' : ''}">${st.passes}</span>
                <span class="miniGameOverStat" style="${isMvp ? 'color:#ffd43b; font-weight:bold;' : ''}">${st.saves || 0}</span>
                <span class="miniGameOverStat" style="color:${pingColor}; font-family:monospace; font-size:12px;">${pingText}</span>
            `;
            container.appendChild(row);
        });
    }
    
    // İzleyici listesi
    function renderSpecList(players) {
        const container = document.getElementById("miniGameOverSpecList");
        if (!container) return;
        container.innerHTML = "";
        
        if (players.length === 0) {
            container.innerHTML = `<div class="miniGameOverSpecEmpty">İzleyici yok</div>`;
            return;
        }
        
        players.forEach((p, i) => {
            const isMe = p.id === miniData.playerId;
            const crown = p.id === 1 ? " 👑" : "";
            const meMark = isMe ? ' <span style="color:#909090;font-size:10px;">(sen)</span>' : '';
            
            // ✨ Ping bilgisi
            const ping = (miniData.pings && miniData.pings[p.id] !== undefined) ? miniData.pings[p.id] : null;
            let pingText = "-";
            let pingColor = "#909090";
            if (ping !== null) {
                pingText = `${ping}ms`;
                if (ping < 80) pingColor = "#51cf66";
                else if (ping < 200) pingColor = "#ffd43b";
                else pingColor = "#ff6b6b";
            }
            
            const row = document.createElement("div");
            row.className = "miniGameOverSpecRow";
            row.style.animationDelay = (0.7 + i * 0.1) + "s";
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.innerHTML = `
                <span style="color:${isMe ? '#fff' : '#c0c0c0'};${isMe?'font-weight:700;':''}">
                    ${p.name}${crown}${meMark}
                </span>
                <span style="color:${pingColor}; font-family:monospace; font-size:12px; font-weight:bold;">${pingText}</span>
            `;
            container.appendChild(row);
        });
    }
    
    if (redTitle) redTitle.style.color = dynRed;
    if (blueTitle) blueTitle.style.color = dynBlue;

    renderTeamList("miniGameOverRedList", redTeam, dynRed, "red");
    renderTeamList("miniGameOverBlueList", blueTeam, dynBlue, "blue");
    renderSpecList(spectators);
    
    // === BUTONLAR ===
    // Rematch sadece host
    const rematchBtn = document.getElementById("miniRematchBtn");
    if (rematchBtn) {
        if (miniData.playerId === 1) {
            rematchBtn.classList.remove("hidden");
        } else {
            rematchBtn.classList.add("hidden");
        }
    }
    
    // ✨ Tuşları bırak (oyun bitti, karakter hareket etmesin)
    miniReleaseAllKeys();
    
    // ✨ 30 SANİYE OTOMATİK LOBIYE DÖNÜŞ SAYACI
    startMiniGameOverCountdown();
}

// ========================================
// OYUN SONU OTOMATİK GERİ SAYIM (60 sn / 1 Dk)
// ========================================
let miniGameOverCountdownInterval = null;

function startMiniGameOverCountdown() {
    // Eski interval varsa temizle
    stopMiniGameOverCountdown();
    
    let seconds = 60;
    
    // Countdown metnini popup'a ekle (yoksa)
    let countdownEl = document.getElementById("miniGameOverCountdown");
    if (!countdownEl) {
        const box = document.getElementById("miniGameOverBox");
        const card = box ? box.querySelector(".overlayCard") : null;
        if (card) {
            countdownEl = document.createElement("p");
            countdownEl.id = "miniGameOverCountdown";
            countdownEl.style.cssText = "margin-top:15px; color:#adb5bd; font-size:14px; text-align:center;";
            card.appendChild(countdownEl);
        }
    }
    
    function updateText() {
        if (!countdownEl) return;
        countdownEl.innerHTML = `⏳ <span style="color:#ffd43b; font-weight:bold;">${seconds}</span> saniye sonra otomatik lobiye dönülecek`;
    }
    updateText();
    
    miniGameOverCountdownInterval = setInterval(() => {
        seconds--;
        updateText();
        
        if (seconds <= 0) {
            stopMiniGameOverCountdown();
            
            // Popup açık mı? (kullanıcı zaten kapatmamış mı?)
            const overBox = document.getElementById("miniGameOverBox");
            if (overBox && !overBox.classList.contains("hidden")) {
                console.log("[MINI] 30 sn doldu, otomatik lobiye dönülüyor...");
                
                // ✨ OTOMATİK dönüş - manuel gibi davranma!
                // Sadece popup'ı kapat + lobiye geç (backend'e in_lobby işaretleme)
                overBox.classList.add("hidden");
                
                // Buton state'lerini resetle
                const menuBtn = document.getElementById("miniGameOverMenuBtn");
                const rematchBtn = document.getElementById("miniRematchBtn");
                if (menuBtn) {
                    menuBtn.disabled = false;
                    menuBtn.textContent = "🚪 Lobiye Dön";
                }
                if (rematchBtn) rematchBtn.disabled = false;
                
                if (miniData.playerId === 1) {
                    // HOST: backend'e "otomatik" flag ile bildir
                    send({ type: "mini_return_to_lobby", auto: true });
                } else {
                    // MİSAFİR: sadece kendi ekranını lobiye çevir, backend'e izleyici olma isteği gönderme
                    stopMiniGame();
                    showScreen("miniLobby");
                    updateMiniLobby();
                }
            }
        }
    }, 1000);
}

function stopMiniGameOverCountdown() {
    if (miniGameOverCountdownInterval) {
        clearInterval(miniGameOverCountdownInterval);
        miniGameOverCountdownInterval = null;
    }
    // Sayaç yazısını sil
    const countdownEl = document.getElementById("miniGameOverCountdown");
    if (countdownEl) countdownEl.remove();
}

// ========================================
// BUTON OLAYLARI
// ========================================
setTimeout(() => {
    const miniCard = document.querySelector('.mod-card[data-mod="mini_futbol"]');
    if (miniCard) {
        miniCard.addEventListener("click", () => {
            // ✨ Normal giriş: isim + buton normale döndür
            const nameInputR = document.getElementById("createMiniNameInput");
            if (nameInputR) {
                const nameBox = nameInputR.closest(".centerBox");
                if (nameBox) nameBox.style.display = "";
            }
            const createBtnEl = document.getElementById("createMiniBtn");
            if (createBtnEl) createBtnEl.textContent = "🎮 Oda Oluştur";
            window._pendingModeChangeCtx = null;

            showScreen("createMini");
            const nameInput = document.getElementById("createMiniNameInput");
            if (nameInput) {
                const savedName = localStorage.getItem("playerName");
                if (savedName) nameInput.value = savedName;
                nameInput.focus();
            }
            // ✨ Create ekranı her açıldığında gelişmiş ayarları yeniden setup et
            // (localStorage'dan güncel değerleri yüklesin)
            setupCreateMiniAdvancedFields();
        });
    }
	
	// ✨ Oda oluşturma ekranındaki gelişmiş ayarları hazırla (ilk yükleme)
    setupCreateMiniAdvancedFields();
    
    const createBtn = document.getElementById("createMiniBtn");
    if (createBtn) {
        // ✨ Tüm ayarları localStorage'dan yükle (varsa)
        function loadSavedCreateSettings() {
            try {
                const goalEl = document.getElementById("miniGoalTargetSelect");
                const durEl = document.getElementById("miniDurationSelect");
                const speedEl = document.getElementById("miniSpeedSelect");
                const splitEl = null;  // Split kaldırıldı
                const plaseEl = document.getElementById("miniAllowPlaseSelect");
                const stickEl = document.getElementById("miniBallStickSelect");
                const sprintEnEl = document.getElementById("miniSprintEnabledSelect");
                const passAssistEl = document.getElementById("miniPassAssistanceSelect"); // ✨ Eklendi
                const musicModeEl = document.getElementById("miniGoalMusicModeSelect");
                const pcEl = document.getElementById("miniPlayerCountSelect");
                
                const savedGoal = localStorage.getItem("miniCreateGoal");
                const savedDur = localStorage.getItem("miniCreateDuration");
                const savedSpeed = localStorage.getItem("miniCreateSpeed");
                const savedSplit = localStorage.getItem("miniCreateSplit");
                const savedPlase = localStorage.getItem("miniAllowPlase");
                const savedStick = localStorage.getItem("miniBallStick");
                const savedSprintEn = localStorage.getItem("miniSprintEnabled");
                const savedPassAssist = localStorage.getItem("miniPassAssistance"); // ✨ Eklendi
                const savedMusicMode = localStorage.getItem("miniGoalMusicMode");
                const savedPc = localStorage.getItem("miniPlayerCount");
                const savedSpec = localStorage.getItem("miniSpectatorCount");
                const savedKt = localStorage.getItem("miniKickoffTimeout");
                
                if (savedGoal && goalEl) {
                    const opt = [...goalEl.options].find(o => o.value === savedGoal);
                    if (opt) goalEl.value = savedGoal;
                }
                if (savedDur && durEl) {
                    const opt = [...durEl.options].find(o => o.value === savedDur);
                    if (opt) durEl.value = savedDur;
                }
                if (savedSpeed && speedEl) {
                    const opt = [...speedEl.options].find(o => o.value === savedSpeed);
                    if (opt) speedEl.value = savedSpeed;
                }
                
                if (savedPlase && plaseEl) {
                    plaseEl.value = savedPlase;
                }
                if (savedStick && stickEl) {
                    stickEl.value = savedStick;
                }
                if (savedSprintEn && sprintEnEl) {
                    sprintEnEl.value = savedSprintEn;
                }
                if (savedPassAssist && passAssistEl) { // ✨ Eklendi
                    passAssistEl.value = savedPassAssist;
                }
                if (savedMusicMode && musicModeEl) {
                    musicModeEl.value = savedMusicMode;
                }
                if (savedPc && pcEl) {
                    const opt = [...pcEl.options].find(o => o.value === savedPc);
                    if (opt) pcEl.value = savedPc;
                }
                if (savedSpec) {
                    const specEl = document.getElementById("miniSpectatorCountSelect");
                    if (specEl) {
                        const opt = [...specEl.options].find(o => o.value === savedSpec);
                        if (opt) specEl.value = savedSpec;
                    }
                }
                if (savedKt) {
                    const ktEl = document.getElementById("miniKickoffTimeoutSelect");
                    if (ktEl) {
                        const opt = [...ktEl.options].find(o => o.value === savedKt);
                        if (opt) ktEl.value = savedKt;
                    }
                }
            } catch(e) {}
        }
        loadSavedCreateSettings();
        
        // ✨ Kartı açtığında da yüklensin (setTimeout içinde ilk kez yüklendi ama)
        // Ana menüden Mini Futbol'a her tıklandığında güncel değerler gelsin
        const miniCardBtn = document.querySelector('.mod-card[data-mod="mini_futbol"]');
        if (miniCardBtn) {
            miniCardBtn.addEventListener("click", () => {
                setTimeout(loadSavedCreateSettings, 50);
            });
        }
        
        createBtn.onclick = async () => {
            const nameInputEl = document.getElementById("createMiniNameInput");
            const name = nameInputEl ? nameInputEl.value.trim() : "";
            
            // ✨ MOD DEĞİŞİMİ mi? (isim boş olabilir, host zaten odada)
            const _pendingModeChangeEarly = window._pendingModeChangeCtx;
            const _isModeChange = _pendingModeChangeEarly && 
                                  _pendingModeChangeEarly.newMode === "mini_futbol" && 
                                  _pendingModeChangeEarly.createScreen === "createMini";
            
            if (!_isModeChange) {
                // Normal akış → isim zorunlu
                if (!name) {
                    const msg = document.getElementById("createMiniMsg");
                    msg.textContent = "İsim gir.";
                    msg.style.color = "#ff6b6b";
                    return;
                }
                
                // 🔒 SELJUK KORUMASI (sadece normal akışta)
                if (isSeljukName(name) && !isSeljukVerified()) {
                    const ok = await showSeljukPasswordPopup();
                    if (!ok) {
                        nameInputEl.value = "";
                        return;
                    }
                }
                
                localStorage.setItem("playerName", name);
            }
            
            // ✨ Gelişmiş toggle
            const advToggle = document.getElementById("createMiniAdvancedToggle");
            const advancedEnabled = advToggle ? advToggle.checked : false;
            
            // Skor + Süre - gelişmiş açıksa custom input'tan, değilse dropdown'dan
            let goalTarget, matchDuration;
            if (advancedEnabled) {
                const gEl = document.getElementById("createAdvGoalTarget");
                const dEl = document.getElementById("createAdvMatchDuration");
                goalTarget = gEl ? parseInt(gEl.value) : 3;
                let matchDurationMin = dEl ? parseInt(dEl.value) : 3;  // ✨ Dakika olarak alındı
                // 0 girilirse sınırsız kabul et
                if (!goalTarget || goalTarget <= 0) goalTarget = 999;
                if (!matchDurationMin || matchDurationMin <= 0) matchDurationMin = 9999;
                // Üst sınır
                if (goalTarget > 9999) goalTarget = 9999;
                if (matchDurationMin > 9999) matchDurationMin = 9999;
                // ✨ Dakikayı saniyeye çevir (backend saniye bekliyor)
                matchDuration = (matchDurationMin >= 9999) ? 99999 : matchDurationMin * 60;
            } else {
                goalTarget = parseInt(document.getElementById("miniGoalTargetSelect").value);
                matchDuration = parseInt(document.getElementById("miniDurationSelect").value);
            }
            
            const gameSpeed = document.getElementById("miniSpeedSelect").value;
            const splitScreen = false;  // Split-screen kaldırıldı
            const allowPlaseValEl = document.getElementById("miniAllowPlaseSelect");
            const allowPlase = allowPlaseValEl ? allowPlaseValEl.value !== "off" : true;
            
            const ballStickValEl = document.getElementById("miniBallStickSelect");
            const ballStick = ballStickValEl ? ballStickValEl.value !== "off" : true;
            
            const sprintEnabledEl = document.getElementById("miniSprintEnabledSelect");
            const sprintEnabled = sprintEnabledEl ? sprintEnabledEl.value !== "off" : true;
            
            const passAssistanceValEl = document.getElementById("miniPassAssistanceSelect");
            const passAssistance = passAssistanceValEl ? passAssistanceValEl.value !== "off" : true;
            
            // ✨ Oyuncu sayısı (1v1=2, 2v2=4, ..., 5v5=10)
            const playerCountEl = document.getElementById("miniPlayerCountSelect");
            const playerCount = playerCountEl ? parseInt(playerCountEl.value) : 2;
            
            // ✨ İzleyici sayısı (0-5)
            const specCountEl = document.getElementById("miniSpectatorCountSelect");
            const spectatorCount = specCountEl ? parseInt(specCountEl.value) : 0;
            
            // ✨ Gelişmiş ayarlar slider değerleri (varsa)
            let advancedValues = null;
            if (advancedEnabled) {
                advancedValues = {};
                MINI_ADVANCED_FIELDS.forEach(field => {
                    const slider = document.getElementById("createAdvField_" + field.id);
                    if (slider) advancedValues[field.id] = parseFloat(slider.value);
                });
                // ✨ Özgür Kazanma Skoru + Maç Süresi'ni de kaydet (dakika olarak)
                const gEl = document.getElementById("createAdvGoalTarget");
                const dEl = document.getElementById("createAdvMatchDuration");
                if (gEl) advancedValues._advGoalTarget = parseInt(gEl.value) || 3;
                if (dEl) advancedValues._advMatchDurationMin = parseInt(dEl.value) || 3;
                
                // localStorage'a kaydet
                try {
                    localStorage.setItem("miniAdvancedSettings", JSON.stringify(advancedValues));
                    localStorage.setItem("miniAdvancedEnabled", "true");
                } catch(e) {}
            } else {
                localStorage.setItem("miniAdvancedEnabled", "false");
            }
            
            // ✨ localStorage'a tüm ayarları kaydet (sonraki açılışta hatırlansın)
            try {
                localStorage.setItem("miniAllowPlase", allowPlase ? "on" : "off");
                localStorage.setItem("miniBallStick", ballStick ? "on" : "off");
                localStorage.setItem("miniPassAssistance", passAssistance ? "on" : "off");
                localStorage.setItem("miniSprintEnabled", sprintEnabled ? "on" : "off");
                if (!advancedEnabled) {
                    // Sadece preset seçildiyse kaydet (özgür değerler kaydetme)
                    localStorage.setItem("miniCreateGoal", String(goalTarget));
                    localStorage.setItem("miniCreateDuration", String(matchDuration));
                }
                localStorage.setItem("miniCreateSpeed", gameSpeed);
                localStorage.setItem("miniCreateSplit", splitScreen ? "on" : "off");
            } catch(e) {}
            
            // ✨ Takım isimleri ve Renkleri localStorage'dan (varsa)
            let savedRedName = "Kırmızı Takım";
            let savedBlueName = "Mavi Takım";
            let savedRedColor = "#ff6b6b";
            let savedBlueColor = "#4dabf7";
            let savedRedSprint = "#ffd43b";
            let savedBlueSprint = "#ffd43b";
            try {
                const r = localStorage.getItem("miniRedTeamName");
                const b = localStorage.getItem("miniBlueTeamName");
                const rc = localStorage.getItem("miniRedTeamColor");
                const bc = localStorage.getItem("miniBlueTeamColor");
                const rs = localStorage.getItem("miniRedSprintColor");
                const bs = localStorage.getItem("miniBlueSprintColor");
                if (r) savedRedName = r;
                if (b) savedBlueName = b;
                if (rc) savedRedColor = rc;
                if (bc) savedBlueColor = bc;
                if (rs) savedRedSprint = rs;
                if (bs) savedBlueSprint = bs;
            } catch(e) {}
            
            // ✨ Santra süresi (dropdown'dan, yoksa localStorage'dan)
            let savedKickoffTimeout = 10;
            const kickoffEl = document.getElementById("miniKickoffTimeoutSelect");
            if (kickoffEl) {
                const val = parseInt(kickoffEl.value);
                if ([5, 10, 15, 20, 30, 60, 999].includes(val)) {
                    savedKickoffTimeout = val;
                }
            } else {
                try {
                    const kt = parseInt(localStorage.getItem("miniKickoffTimeout"));
                    if (!isNaN(kt) && [5, 10, 15, 20, 30, 60, 999].includes(kt)) {
                        savedKickoffTimeout = kt;
                    }
                } catch(e) {}
            }
            // localStorage'a da kaydet
            try { localStorage.setItem("miniKickoffTimeout", String(savedKickoffTimeout)); } catch(e) {}
            
            // 🎵 Gol Müziği Modu (Dropdown Seçimini Oku ve Kaydet)
            const goalMusicModeEl = document.getElementById("miniGoalMusicModeSelect");
            const goalMusicMode = goalMusicModeEl ? goalMusicModeEl.value : "team";
            try {
                localStorage.setItem("miniGoalMusicMode", goalMusicMode);
            } catch(e) {}
            
            const payload = {
                type: "mini_create_room",
                name: name,
                goal_target: goalTarget,
                match_duration: matchDuration,
                game_speed: gameSpeed,
                split_screen: splitScreen,
                allow_plase: allowPlase,
                ball_stick: ballStick,
                sprint_enabled: sprintEnabled,
                pass_assistance: passAssistance,
                goal_music_mode: goalMusicMode,
                player_count: playerCount,
                spectator_count: spectatorCount,
                kickoff_timeout: savedKickoffTimeout,  // ✨ Santra süresi
                red_team_name: savedRedName,
                blue_team_name: savedBlueName,
                red_team_color: savedRedColor,
                blue_team_color: savedBlueColor,
                red_sprint_color: savedRedSprint,
                blue_sprint_color: savedBlueSprint,
                advanced_enabled: advancedEnabled
            };
            if (advancedValues) payload.advanced = advancedValues;
            
            // ✨ localStorage'a player_count + spectator_count
            try { 
                localStorage.setItem("miniPlayerCount", String(playerCount));
                localStorage.setItem("miniSpectatorCount", String(spectatorCount));
            } catch(e) {}

            // ✨ MOD DEĞİŞİMİ mi? (advanced yok, sadece temel ayarlar)
            const pendingModeChange = window._pendingModeChangeCtx;
            if (pendingModeChange && pendingModeChange.newMode === "mini_futbol" && pendingModeChange.createScreen === "createMini") {
                console.log("[MODE CHANGE] Mini Futbol için mod_change_room gönderiliyor");
                const msgEl = document.getElementById("createMiniMsg");
                if (msgEl) {
                    msgEl.textContent = "Mod değiştiriliyor...";
                    msgEl.style.color = "#51cf66";
                }
                send({
                    type: "mod_change_room",
                    new_mode: "mini_futbol",
                    mode_settings: {
                        goal_target: goalTarget,
                        match_duration: matchDuration,
                        game_speed: gameSpeed,
                        split_screen: splitScreen,
                        allow_plase: allowPlase,
                        ball_stick: ballStick,
                        sprint_enabled: sprintEnabled,
                        player_count: playerCount,
                        spectator_count: spectatorCount,
                        kickoff_timeout: savedKickoffTimeout,
                        red_team_name: savedRedName,
                        blue_team_name: savedBlueName,
                        red_team_color: savedRedColor,
                        blue_team_color: savedBlueColor,
                        red_sprint_color: savedRedSprint,
                        blue_sprint_color: savedBlueSprint
                    }
                });
                return;
            }
            
            send(payload);
        };
    }
    
    const backBtn = document.getElementById("createMiniBackBtn");
    if (backBtn) backBtn.onclick = () => {
        const pendingModeChange = window._pendingModeChangeCtx;
        if (pendingModeChange && pendingModeChange.newMode === "mini_futbol" && pendingModeChange.createScreen === "createMini") {
            const returnScreen = pendingModeChange.returnScreen || "miniLobby";
            window._pendingModeChangeCtx = null;
            const msgEl = document.getElementById("createMiniMsg");
            if (msgEl) msgEl.textContent = "";

            showScreen(returnScreen);

            setTimeout(() => {
                if (typeof openChangeModeModal === "function") openChangeModeModal();
            }, 200);
            return;
        }
        showScreen("modselect");
    };
    
    const leaveBtn = document.getElementById("miniLobbyLeaveBtn");
    if (leaveBtn) leaveBtn.onclick = () => window._showLeaveConfirmPopup();
    
    const startBtn = document.getElementById("miniStartBtn");
    if (startBtn) {
        startBtn.addEventListener("click", () => {
            send({ type: "mini_start_game" });
        });
    }
    
    // ✨ Kullanıcı "Oyuna Katıl" butonu
    const rejoinBtn = document.getElementById("miniRejoinGameBtn");
    if (rejoinBtn) {
        rejoinBtn.addEventListener("click", () => {
            send({ type: "mini_guest_rejoin_game" });
            // Oyun ekranına da dön (izleyici olarak, host takıma sürükleyene kadar)
            showScreen("miniGame");
            startMiniGame();
        });
    }
    
    const settingsBtn = document.getElementById("miniRoomSettingsBtn");
    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => openMiniRoomSettings());
    }
    
    // ✨ Mod Değiştir butonu
    const _miniChangeModeBtn = document.getElementById("miniChangeModeBtn");
    if (_miniChangeModeBtn) {
        _miniChangeModeBtn.addEventListener("click", () => {
            if (typeof openChangeModeModal === "function") {
                openChangeModeModal();
            }
        });
    }
    
    // ✨ Kontrol Ayarları butonu (lobby)
    const ctrlBtn = document.getElementById("miniControlSettingsBtn");
    if (ctrlBtn) {
        ctrlBtn.addEventListener("click", () => showMiniControlSettings());
    }
    
    // ✨ Kontrol Ayarları butonu (pause)
    const pauseCtrlBtn = document.getElementById("miniPauseControlBtn");
    if (pauseCtrlBtn) {
        pauseCtrlBtn.addEventListener("click", () => showMiniControlSettings());
    }
    
    // 💬 CHAT buton event'leri
    const chatToggle = document.getElementById("miniChatToggleBtn");
    if (chatToggle) chatToggle.addEventListener("click", toggleMiniChatPanel);

    const chatClose = document.getElementById("miniChatCloseBtn");
    if (chatClose) chatClose.addEventListener("click", closeMiniChatPanel);

    const chatSend = document.getElementById("miniChatSendBtn");
    if (chatSend) chatSend.addEventListener("click", sendMiniChatMessage);

    const chatInput = document.getElementById("miniChatInput");
    if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                sendMiniChatMessage();
                closeMiniChatPanel();  // ✨ Mesaj gönderdikten sonra chat kapansın
                return;
            }
            // Chat input açıkken oyun tuşları çalışmasın (zaten miniKeyDown'da input kontrolü var)
            e.stopPropagation();
        });
    }

    const nameInput = document.getElementById("createMiniNameInput");
    if (nameInput) {
        nameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") document.getElementById("createMiniBtn").click();
        });
    }
    
    const gameBackBtn = document.getElementById("miniBackBtn");
    if (gameBackBtn) gameBackBtn.onclick = () => showEscPopup();
    
    // ✨ Takım ismi düzenleme
    const editRedBtn = document.getElementById("miniEditRedBtn");
    if (editRedBtn) editRedBtn.onclick = () => editTeamName("red");
    
    const editBlueBtn = document.getElementById("miniEditBlueBtn");
    if (editBlueBtn) editBlueBtn.onclick = () => editTeamName("blue");
    
    const resetNamesBtn = document.getElementById("miniResetNamesBtn");
    if (resetNamesBtn) resetNamesBtn.onclick = () => resetTeamNames();
    
    // Oyun sonu butonları
    const rematchBtn = document.getElementById("miniRematchBtn");
    if (rematchBtn) {
        rematchBtn.onclick = () => {
            stopMiniGameOverCountdown();  // ✨ Sayacı durdur
            document.getElementById("miniGameOverBox").classList.add("hidden");
            send({ type: "mini_start_game" });
        };
    }
    
    const menuBtn = document.getElementById("miniGameOverMenuBtn");
    if (menuBtn) {
        menuBtn.onclick = () => {
            stopMiniGameOverCountdown();  // ✨ Sayacı durdur
            
            // ✨ HOST → backend'den broadcast bekle (herkesi lobiye atsın)
            // ✨ MİSAFİR → direkt kendi ekranını lobiye çevir (backend sadece bize update yollayacak)
            
            if (miniData.playerId === 1) {
                // HOST: broadcast bekle
                send({ type: "mini_return_to_lobby" });
                menuBtn.disabled = true;
                menuBtn.textContent = "⌛ Dönülüyor...";
            } else {
                // MİSAFİR: backend'e izleyici yap komutu gönder + kendisi lobbye geç
                send({ type: "mini_return_to_lobby" });
                
                // Popup'ı kapat
                const overBox = document.getElementById("miniGameOverBox");
                if (overBox) overBox.classList.add("hidden");
                
                // Oyun döngüsünü durdur
                stopMiniGame();
                
                // Lobby'e geç
                showScreen("miniLobby");
                updateMiniLobby();
                
                // Butonu resetle (bir sonraki oyun için)
                menuBtn.disabled = false;
                menuBtn.textContent = "🚪 Lobiye Dön";
            }
        };
    }
    
    // ✨ PAUSE LOBBY butonları
    const resumeBtn = document.getElementById("miniPauseResumeBtn");
    if (resumeBtn) {
        resumeBtn.onclick = () => {
            send({ type: "mini_resume" });
        };
    }
    
    const pauseSettingsBtn = document.getElementById("miniPauseSettingsBtn");
    if (pauseSettingsBtn) {
        pauseSettingsBtn.onclick = () => openMiniRoomSettings();
    }
    
    // ✨ YENİDEN BAŞLAT butonu (sadece host)
    const pauseRestartBtn = document.getElementById("miniPauseRestartBtn");
    if (pauseRestartBtn) {
        pauseRestartBtn.onclick = () => {
            if (miniData.playerId !== 1) return;
            showMiniRestartConfirm();
        };
    }
    
    const pauseEditRedBtn = document.getElementById("miniPauseEditRedBtn");
    if (pauseEditRedBtn) pauseEditRedBtn.onclick = () => editTeamName("red");
    
    const pauseEditBlueBtn = document.getElementById("miniPauseEditBlueBtn");
    if (pauseEditBlueBtn) pauseEditBlueBtn.onclick = () => editTeamName("blue");
    
    const pauseLeaveBtn = document.getElementById("miniPauseLeaveBtn");
    if (pauseLeaveBtn) {
        pauseLeaveBtn.onclick = () => {
            // ✨ Sadece host için (butonu zaten sadece host görüyor ama garanti)
            if (miniData.playerId !== 1) return;
            
            showMiniLobbyReturnConfirm();
        };
    }
    
    // ✨ Kullanıcı için "Odadan Ayrıl" butonu
    const guestLeaveBtn = document.getElementById("miniPauseGuestLeaveBtn");
    if (guestLeaveBtn) {
        guestLeaveBtn.onclick = () => {
            hideMiniPauseLobby();
            showEscPopup();
        };
    }
    
    // ✨ KULLANICI ESC MENÜSÜ butonları
    const guestLobby = document.getElementById("miniGuestEscLobbyBtn");
    if (guestLobby) {
        guestLobby.onclick = () => {
            hideMiniGuestEscMenu();
            showMiniGuestLobbyConfirm();
        };
    }
    
    const guestSettings = document.getElementById("miniGuestEscSettingsBtn");
    if (guestSettings) {
        guestSettings.onclick = () => {
            hideMiniGuestEscMenu();
            showMiniControlSettings();
            // ✨ Kullanıcı popup'ı kapatınca pause popup'a geri dön (host pause'daysa)
            setupPopupReturnToPause("miniControlSettings");
        };
    }
    
    const guestRoomSet = document.getElementById("miniGuestEscRoomSettingsBtn");
    if (guestRoomSet) {
        guestRoomSet.onclick = () => {
            hideMiniGuestEscMenu();
            openMiniRoomSettings();
            // ✨ Kullanıcı popup'ı kapatınca pause popup'a geri dön (host pause'daysa)
            setupPopupReturnToPause("roomSettingsBox");
        };
    }
    
    const guestHome = document.getElementById("miniGuestEscHomeBtn");
    if (guestHome) {
        guestHome.onclick = () => {
            hideMiniGuestEscMenu();
            showEscPopup();  // Var olan "Çıkmak istediğine emin misin" popup
            // ✨ Popup kapanınca (İptal veya ESC) → ESC menüsüne geri dön
            setupPopupReturnToPause("escConfirmBox");
        };
    }
    
    // ✨ Kullanıcı ESC menüsünde "Devam Et" butonu
    const guestResume = document.getElementById("miniGuestEscResumeBtn");
    if (guestResume) {
        guestResume.onclick = () => {
            hideMiniGuestEscMenu();
        };
    }
}, 100);

// ========================================
// HIZLI PAUSE OVERLAY (P tuşu - basit)
// ========================================

function showMiniQuickPauseOverlay() {
    let overlay = document.getElementById("miniQuickPauseOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "miniQuickPauseOverlay";
        overlay.className = "miniQuickPauseOverlay";
        overlay.innerHTML = `
            <div class="miniQuickPauseContent">
                <div style="font-size:80px;">⏸️</div>
                <h1 style="color:#ffd43b; font-size:48px; margin:10px 0;">DURAKLATILDI</h1>
                <p style="color:#adb5bd; font-size:18px; margin-top:15px;">
                    Devam etmek için <b style="color:#51cf66;">P</b> tuşuna bas
                </p>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = "flex";
    miniReleaseAllKeys();
}

function hideMiniQuickPauseOverlay() {
    const overlay = document.getElementById("miniQuickPauseOverlay");
    if (overlay) overlay.style.display = "none";
}


// ========================================
// PAUSE LOBBY (Oyun içi ESC popup)
// ========================================

function updateMiniPauseHostControls() {
    const isHost = miniData.playerId === 1;
    
    // Host'a özel butonlar (sadece host görür)
    const hostOnlyIds = [
        "miniPauseResumeBtn",
        "miniPauseRestartBtn",
        "miniPauseEditRedBtn",
        "miniPauseEditBlueBtn",
        "miniPauseResetNamesBtn",
        "miniPauseLeaveBtn"
    ];
    
    hostOnlyIds.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        
        if (isHost) {
            el.classList.remove("hidden");
            el.style.display = "inline-block";
        } else {
            el.classList.add("hidden");
            el.style.display = "none";
        }
    });
    
    // ✨ Oda Ayarları ve Ayarlar butonları HEM host HEM kullanıcıya görünsün
    const sharedBtns = ["miniPauseSettingsBtn", "miniPauseControlBtn"];
    sharedBtns.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.classList.remove("hidden");
            el.style.display = "inline-block";
        }
    });
    
    // ✨ Kullanıcı (host değilse) "Odadan Ayrıl" görsün
    const guestLeaveBtn = document.getElementById("miniPauseGuestLeaveBtn");
    if (guestLeaveBtn) {
        if (isHost) {
            guestLeaveBtn.classList.add("hidden");
            guestLeaveBtn.style.display = "none";
        } else {
            guestLeaveBtn.classList.remove("hidden");
            guestLeaveBtn.style.display = "inline-block";
        }
    }
    
    // Host değilse bilgi mesajı göster
    const waitMsg = document.getElementById("miniPauseWaitMsg");
    if (waitMsg) {
        if (isHost) {
            waitMsg.classList.add("hidden");
        } else {
            waitMsg.classList.remove("hidden");
        }
    }
    
    // ✨ Kullanıcı için takım isim düzenleme butonları GİZLE (küçük ✏️ butonları)
    const editBtns = ["miniPauseEditRedBtn", "miniPauseEditBlueBtn"];
    editBtns.forEach(id => {
        const el = document.getElementById(id);
        if (el && !isHost) {
            el.style.display = "none";
        }
    });
}

function showMiniPauseLobby() {
    const box = document.getElementById("miniPauseLobbyBox");
    if (!box) return;
    box.classList.remove("hidden");
    
    // ✨ Eski guest paused box (kullanılmıyor artık) kesin kapalı olsun
    const oldGuestBox = document.getElementById("miniGuestPausedBox");
    if (oldGuestBox) oldGuestBox.classList.add("hidden");
    
    // Klavye dinleyicileri geçici durdur (oyuncu hareket etmesin)
    miniReleaseAllKeys();
    
    // Lobby içeriğini render et
    updateMiniPauseLobby();
    
    // ✨ Pause popup host kontrolleri
    updateMiniPauseHostControls();
    
    // ✨ Gamepad UI'yı güncelle (zaten takılıysa göster)
    checkExistingGamepads();
    updateGamepadUI();
}

function hideMiniPauseLobby() {
    const box = document.getElementById("miniPauseLobbyBox");
    if (box) box.classList.add("hidden");
}

function updateMiniPauseLobby() {
    // ✨ Oda kodu + davet linki (pause popup)
    if (window.setupRoomCodeAndLink) {
        const helper = window.setupRoomCodeAndLink({
            codeTextId: "miniPauseRoomCodeText",
            codeEyeBtnId: "miniPauseRoomCodeEyeBtn",
            copyHintId: "miniPauseCopyHint",
            linkTextId: "miniPauseInviteLinkText",
            linkEyeBtnId: "miniPauseInviteLinkEyeBtn",
            linkHintId: "miniPauseInviteLinkHint",
            getRoomCode: () => miniData.roomCode,
            getPlayerId: () => miniData.playerId
        });
        if (helper) {
            helper.renderCode();
            helper.renderLink();
        }
    }
    
    // Takım isimleri ve Kutu Renkleri (Pause)
    const dynRedP = miniData.redTeamColor || "#ff6b6b";
    const dynBlueP = miniData.blueTeamColor || "#4dabf7";

    const redName = document.getElementById("miniPauseRedName");
    const blueName = document.getElementById("miniPauseBlueName");
    
    // ✨ Sadece gerçek siyah/gri koyu renklerde beyaz çerçeve (Beşiktaş).
    // GS kırmızısı, FB laciverti, TS bordo kendi renginde kalsın.
    const isPColorDark = (hex) => {
        const rgb = hexToRgbParts(hex);
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        const max = Math.max(rgb.r, rgb.g, rgb.b);
        const min = Math.min(rgb.r, rgb.g, rgb.b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        return brightness < 55 && saturation < 0.22;
    };

    if (redName) {
        redName.textContent = miniData.redTeamName;
        const isPDark = isPColorDark(dynRedP);
        redName.style.color = isPDark ? "#ffffff" : dynRedP;
        const redBox = redName.closest(".miniTeamColumn") || redName.closest(".miniTeamBox") || redName.closest(".miniLobbyColumn") || redName.parentElement;
        if (redBox) {
            redBox.style.borderColor = isPDark ? "#ffffff" : dynRedP;
            redBox.style.borderWidth = isPDark ? "2px" : "1px";
            redBox.style.background = isPDark ? "rgba(255, 255, 255, 0.05)" : `linear-gradient(180deg, ${hexToRgba(dynRedP, 0.15)}, ${hexToRgba(dynRedP, 0.05)})`;
        }
    }
    if (blueName) {
        blueName.textContent = miniData.blueTeamName;
        const isPDark = isPColorDark(dynBlueP);
        blueName.style.color = isPDark ? "#ffffff" : dynBlueP;
        const blueBox = blueName.closest(".miniTeamColumn") || blueName.closest(".miniTeamBox") || blueName.closest(".miniLobbyColumn") || blueName.parentElement;
        if (blueBox) {
            blueBox.style.borderColor = isPDark ? "#ffffff" : dynBlueP;
            blueBox.style.borderWidth = isPDark ? "2px" : "1px";
            blueBox.style.background = isPDark ? "rgba(255, 255, 255, 0.05)" : `linear-gradient(180deg, ${hexToRgba(dynBlueP, 0.15)}, ${hexToRgba(dynBlueP, 0.05)})`;
        }
    }
    
    // Oyuncuları takımlara ayır (aynı lobby gibi)
    const redPlayers = miniData.players.filter(p => p.team === "red");
    const bluePlayers = miniData.players.filter(p => p.team === "blue");
    const spectators = miniData.players.filter(p => p.team === "spectator" || !p.team);
    
    renderTeamColumn("miniPauseRedCol", redPlayers, "red");
    renderTeamColumn("miniPauseSpecCol", spectators, "spectator");
    renderTeamColumn("miniPauseBlueCol", bluePlayers, "blue");
    
    // Sayaçlar (toplam limit / oyuncu sayısı)
    const totalMax = miniData.playerCount || 2;
    const halfMax = Math.floor(totalMax / 2);
    const redCount = document.getElementById("miniPauseRedCount");
    const blueCount = document.getElementById("miniPauseBlueCount");
    const specCount = document.getElementById("miniPauseSpecCount");
    if (redCount) redCount.textContent = `(${redPlayers.length}/${halfMax})`;
    if (blueCount) blueCount.textContent = `(${bluePlayers.length}/${halfMax})`;
    if (specCount) specCount.textContent = `(${spectators.length})`;
    
    // ✨ Pause popup host kontrolleri güncel kalsın
    updateMiniPauseHostControls();
}

// ✨ Pause lobby ve ping için ek işlemler - handleMiniMessage içine gömdük
// (Wrap tekrarını önlemek için)

// ✨ ESC - Host için pause/resume, Kullanıcı için özel menü
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    
    // ✨ Chat açıksa önce chat'i kapat
    if (miniChat.open) {
        e.preventDefault();
        e.stopPropagation();
        closeMiniChatPanel();
        return;
    }
    
    // Sadece mini futbol oyun ekranında
    const gameScreen = document.getElementById("miniGameScreen");
    if (!gameScreen || gameScreen.classList.contains("hidden")) return;
    
    // ✨ ALT POPUP'LAR ÖNCELİKLİ - açıklarsa sadece onlar kapansın (arka menü etkilenmesin)
    const subPopups = [
        "roomSettingsBox",         // Oda Ayarları
        "miniControlSettings",      // Ayarlar (Kontrol)
        "miniLobbyReturnConfirm",   // Lobiye Dön onay
        "miniRestartConfirm",       // Yeniden Başlat onay
        "miniResetNamesConfirm",    // İsim sıfırla onay
        "miniTeamNameEditor",       // Takım ismi düzenle
        "miniNameEditor",           // Oyuncu ismi düzenle
        "miniJerseyEditor",         // ✨ Forma Numarası Değiştir onay
        "kickConfirmBox",           // Kick onay
        "escConfirmBox",            // Ana Menü çıkış onay
        "miniGuestLobbyConfirm"     // Kullanıcı Lobiye Dön onay
    ];
    for (const id of subPopups) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains("hidden")) {
            e.preventDefault();
            e.stopPropagation();
            el.classList.add("hidden");
            // ✨ Sadece dinamik popup'ları sil, kalıcı olanları (roomSettingsBox) sadece gizle
            const dynamicPopups = [
                "miniLobbyReturnConfirm", "miniRestartConfirm", "miniResetNamesConfirm",
                "miniTeamNameEditor", "miniNameEditor", "miniJerseyEditor", "miniGuestLobbyConfirm",
                "miniKickConfirm", "miniControlSettings"
            ];
            if (dynamicPopups.includes(id)) {
                el.remove();
            }
            
            // ✨ Kullanıcı için: Alt popup kapandıysa küçük ESC menüsüne geri dön
            if (miniData.playerId !== 1) {
                setTimeout(() => showMiniGuestEscMenu(), 50);
            }
            return;
        }
    }
    
    // === HOST ===
    if (miniData.playerId === 1) {
        // Pause popup açıksa kapat (Devam et)
        const box = document.getElementById("miniPauseLobbyBox");
        if (box && !box.classList.contains("hidden")) {
            e.preventDefault();
            e.stopPropagation();
            send({ type: "mini_resume" });
            return;
        }
        // Popup kapalıysa aç (Pause)
        e.preventDefault();
        e.stopPropagation();
        send({ type: "mini_pause" });
        return;
    }
    
    // === KULLANICI (Guest) ===
    e.preventDefault();
    e.stopPropagation();
    
    // Zaten kullanıcı ESC menüsü açıksa kapat
    const guestBox = document.getElementById("miniGuestEscBox");
    if (guestBox && !guestBox.classList.contains("hidden")) {
        guestBox.classList.add("hidden");
        return;
    }
    
    // Host pause popup açıksa (kullanıcı pause ekranı görüyor) → gizle ve menü aç
    const guestPausedBox = document.getElementById("miniGuestPausedBox");
    if (guestPausedBox && !guestPausedBox.classList.contains("hidden")) {
        guestPausedBox.classList.add("hidden");  // Geçici gizle
        showMiniGuestEscMenu();
        return;
    }
    
    // Normal durum → kullanıcı ESC menüsünü aç
    showMiniGuestEscMenu();
}, true);

// ✨ Popup kapandığında (hidden class eklenince) kullanıcı ESC menüsünü geri getir
function setupPopupReturnToPause(popupId) {
    // Sadece kullanıcı (host değil) için
    if (miniData.playerId === 1) return;
    
    const el = document.getElementById(popupId);
    if (!el) return;
    
    // MutationObserver ile hidden class'ı izle
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.attributeName === "class") {
                const isHidden = el.classList.contains("hidden");
                if (isHidden) {
                    observer.disconnect();
                    // ESC menüsünü tekrar aç
                    setTimeout(() => showMiniGuestEscMenu(), 50);
                    return;
                }
            }
        }
    });
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    
    // Element silinirse de yakala (miniControlSettings dinamik)
    const removeObserver = new MutationObserver(() => {
        if (!document.body.contains(el)) {
            observer.disconnect();
            removeObserver.disconnect();
            setTimeout(() => showMiniGuestEscMenu(), 50);
        }
    });
    removeObserver.observe(document.body, { childList: true, subtree: false });
}

function showMiniGuestEscMenu() {
    const box = document.getElementById("miniGuestEscBox");
    if (box) box.classList.remove("hidden");
    miniReleaseAllKeys();
}

function hideMiniGuestEscMenu() {
    const box = document.getElementById("miniGuestEscBox");
    if (box) box.classList.add("hidden");
}

// ========================================
// 📊 SCOREBOARD (TAB tuşu ile açılır)
// ========================================

function createMiniScoreboard() {
    if (document.getElementById("miniScoreboard")) return;
    
    // ✨ Kayıtlı TAB opacity (default %5)
    let tabOpacity = 5;
    try {
        const saved = localStorage.getItem("miniTabOpacity");
        if (saved !== null) tabOpacity = parseInt(saved);
        if (isNaN(tabOpacity)) tabOpacity = 5;
    } catch(e) {}
    const opAlpha = tabOpacity / 100;
    
    const overlay = document.createElement("div");
    overlay.id = "miniScoreboard";
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(15, 20, 30, ${opAlpha});
        display: none; justify-content: center; align-items: center;
        z-index: 9999999;
        font-family: 'Segoe UI', sans-serif;
    `;
    overlay.innerHTML = `
        <div style="background: rgba(30, 35, 50, 0.70); border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.08); padding: 24px;
                    min-width: 700px; max-width: 90vw; box-shadow: 0 8px 32px rgba(0,0,0,0.4);">
            <div style="text-align:center; margin-bottom: 20px;
                        color: #e0e0e0; font-size: 18px; font-weight: 500; letter-spacing: 1px;">
                📊 SKOR TABLOSU
            </div>
            
            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
                <!-- KIRMIZI TAKIM -->
                <div id="scoreRedCol" style="background: rgba(255,107,107,0.08);
                                             border: 1px solid rgba(255,107,107,0.25);
                                             border-radius: 8px; padding: 14px;">
                    <div id="scoreRedTitle" style="color: #ff8a8a; font-size: 14px; font-weight: 600;
                                                    text-align: center; margin-bottom: 12px;
                                                    padding-bottom: 8px; border-bottom: 1px solid rgba(255,107,107,0.2);">
                        🔴 Kırmızı Takım
                    </div>
                    <div id="scoreRedList"></div>
                </div>
                
                <!-- İZLEYİCİLER -->
                <div style="background: rgba(150,150,150,0.06);
                            border: 1px solid rgba(150,150,150,0.2);
                            border-radius: 8px; padding: 14px;">
                    <div style="color: #b0b0b0; font-size: 14px; font-weight: 600;
                                text-align: center; margin-bottom: 12px;
                                padding-bottom: 8px; border-bottom: 1px solid rgba(150,150,150,0.15);">
                          İzleyiciler
                    </div>
                    <div id="scoreSpecList"></div>
                </div>
                
                <!-- MAVİ TAKIM -->
                <div id="scoreBlueCol" style="background: rgba(77,171,247,0.08);
                                              border: 1px solid rgba(77,171,247,0.25);
                                              border-radius: 8px; padding: 14px;">
                    <div id="scoreBlueTitle" style="color: #7abfff; font-size: 14px; font-weight: 600;
                                                     text-align: center; margin-bottom: 12px;
                                                     padding-bottom: 8px; border-bottom: 1px solid rgba(77,171,247,0.2);">
                        🔵 Mavi Takım
                    </div>
                    <div id="scoreBlueList"></div>
                </div>
            </div>
            
            <div id="scoreFinalScore" style="text-align:center; margin-top: 20px;
                                              padding: 14px 0 6px 0;
                                              color: #e0e0e0; font-size: 42px; font-weight: 700;
                                              letter-spacing: 6px;
                                              border-top: 1px solid rgba(255,255,255,0.08);">
                0 - 0
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function renderMiniScoreboard() {
    createMiniScoreboard();
    
    const state = miniData.gameState;
    if (!state) return;
    
    const stats = state.stats || {};
    const pings = miniData.pings || {};
    
    // Oyuncuları takımlara göre grupla
    const redTeam = [];
    const blueTeam = [];
    const spectators = [];
    
    miniData.players.forEach(p => {
        if (p.team === "red") redTeam.push(p);
        else if (p.team === "blue") blueTeam.push(p);
        else spectators.push(p);
    });
    
    const dynRed = miniData.redTeamColor || "#ff6b6b";
    const dynBlue = miniData.blueTeamColor || "#4dabf7";

    // Takım kutularının arkaplanlarını ve kenarlıklarını dinamik yap
    const redColEl = document.getElementById("scoreRedCol");
    const blueColEl = document.getElementById("scoreBlueCol");
    if (redColEl) {
        redColEl.style.background = hexToRgba(dynRed, 0.08);
        redColEl.style.borderColor = hexToRgba(dynRed, 0.25);
    }
    if (blueColEl) {
        blueColEl.style.background = hexToRgba(dynBlue, 0.08);
        blueColEl.style.borderColor = hexToRgba(dynBlue, 0.25);
    }

    // Takım başlıkları (Renkli ● noktası ile)
    const redTitleEl = document.getElementById("scoreRedTitle");
    const blueTitleEl = document.getElementById("scoreBlueTitle");
    if (redTitleEl) {
        redTitleEl.innerHTML = `<span style="color:${dynRed}; font-size:18px;">●</span> ${miniData.redTeamName || "Kırmızı Takım"}`;
        redTitleEl.style.color = dynRed;
        redTitleEl.style.borderBottomColor = hexToRgba(dynRed, 0.2);
    }
    if (blueTitleEl) {
        blueTitleEl.innerHTML = `<span style="color:${dynBlue}; font-size:18px;">●</span> ${miniData.blueTeamName || "Mavi Takım"}`;
        blueTitleEl.style.color = dynBlue;
        blueTitleEl.style.borderBottomColor = hexToRgba(dynBlue, 0.2);
    }
    
    // Takım kartı HTML üretici
    // teamSide: "red" | "blue" — Fener sarı / BJK beyaz için isim okunur
    function makeTeamRows(players, teamColor, teamSide) {
        if (players.length === 0) {
            return `<div style="text-align:center; color: #6c757d; font-size: 12px; padding: 12px;
                                font-style: italic;">Boş</div>`;
        }
        
        // Header
        let html = `<div style="display:grid; grid-template-columns: 1fr 28px 28px 28px 28px 45px;
                                gap: 6px; color: #909090; font-size: 10px; font-weight: 600;
                                text-transform: uppercase; letter-spacing: 0.5px;
                                margin-bottom: 6px; padding: 0 4px;">
            <div>İsim</div>
            <div style="text-align:center;" title="Gol">G</div>
            <div style="text-align:center;" title="Asist">A</div>
            <div style="text-align:center;" title="Pas">P</div>
            <div style="text-align:center;" title="Kurtarış">K</div>
            <div style="text-align:right;">Ping</div>
        </div>`;
        
        // ✨ TAB skorboard isim rengi: Fener sarı, GS sarı, Trabzon mavi, Beşiktaş beyaz, diğerleri takım rengi
        const sideName = (teamSide === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
        const sideNorm = sideName.trim().toLowerCase();
        let resolvedNameColor = teamColor || "#d0d0d0";
        if (["fenerbahçe", "fenerbahce", "fb"].includes(sideNorm)) {
            resolvedNameColor = "#ffed00";
        } else if (["galatasaray", "gs"].includes(sideNorm)) {
            resolvedNameColor = "#fdb913";
        } else if (["trabzonspor", "ts"].includes(sideNorm)) {
            resolvedNameColor = "#4ab3e8";
        } else if (["beşiktaş", "besiktas", "bjk"].includes(sideNorm)) {
            resolvedNameColor = "#ffffff";
        } else {
            // Gerçekten siyah/gri koyu renkse beyaz (okunabilirlik)
            try {
                const rgb = hexToRgbParts(resolvedNameColor);
                const bright = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                const mx = Math.max(rgb.r, rgb.g, rgb.b);
                const mn = Math.min(rgb.r, rgb.g, rgb.b);
                const sat = mx === 0 ? 0 : (mx - mn) / mx;
                if (bright < 55 && sat < 0.22) resolvedNameColor = "#ffffff";
            } catch (e) {}
        }
        
        players.forEach(p => {
            const st = stats[String(p.id)] || { goals: 0, assists: 0, passes: 0 };
            const ping = pings[p.id];
            let pingText = "-";
            let pingColor = "#909090";
            if (ping !== undefined && ping !== null) {
                pingText = `${ping}ms`;
                if (ping < 80) pingColor = "#7dcc8b";
                else if (ping < 200) pingColor = "#ddb84b";
                else pingColor = "#e08585";
            }
            const isMe = p.id === miniData.playerId;
            // ✨ İsim rengi (Fener sarı / BJK beyaz)
            const nameColor = resolvedNameColor;
            
            html += `<div style="display:grid; grid-template-columns: 1fr 28px 28px 28px 28px 45px;
                                 gap: 6px; padding: 6px 4px; font-size: 13px;
                                 font-weight: ${isMe ? '700' : '500'};
                                 border-bottom: 1px solid rgba(255,255,255,0.04);">
                <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color: ${nameColor};">
                    ${p.name}${p.id === 1 ? ' 👑' : ''}${isMe ? ' <span style="color:#909090;font-size:10px;">(sen)</span>' : ''}
                </div>
                <div style="text-align:center; color: #d0d0d0;">${st.goals}</div>
                <div style="text-align:center; color: #d0d0d0;">${st.assists}</div>
                <div style="text-align:center; color: #d0d0d0;">${st.passes}</div>
                <div style="text-align:center; color: #d0d0d0;">${st.saves || 0}</div>
                <div style="text-align:right; color: ${pingColor}; font-family: monospace; font-size: 11px;">${pingText}</div>
            </div>`;
        });
        
        return html;
    }
    
    // İzleyiciler için basit liste
    function makeSpecRows(players) {
        if (players.length === 0) {
            return `<div style="text-align:center; color: #6c757d; font-size: 12px; padding: 12px;
                                font-style: italic;">İzleyici yok</div>`;
        }
        let html = "";
        players.forEach(p => {
            const ping = pings[p.id];
            let pingText = "-";
            let pingColor = "#909090";
            if (ping !== undefined && ping !== null) {
                pingText = `${ping}ms`;
                if (ping < 80) pingColor = "#7dcc8b";
                else if (ping < 200) pingColor = "#ddb84b";
                else pingColor = "#e08585";
            }
            const isMe = p.id === miniData.playerId;
            html += `<div style="display:flex; justify-content:space-between; align-items:center;
                                 padding: 6px 4px; font-size: 13px;
                                 color: ${isMe ? '#ffffff' : '#c0c0c0'}; font-weight: ${isMe ? '600' : '400'};
                                 border-bottom: 1px solid rgba(255,255,255,0.04);">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    👁️ ${p.name}${p.id === 1 ? ' 👑' : ''}${isMe ? ' <span style="color:#909090;font-size:10px;">(sen)</span>' : ''}
                </span>
                <span style="color: ${pingColor}; font-family: monospace; font-size: 11px;">${pingText}</span>
            </div>`;
        });
        return html;
    }
    
    document.getElementById("scoreRedList").innerHTML = makeTeamRows(redTeam, dynRed, "red");
    document.getElementById("scoreBlueList").innerHTML = makeTeamRows(blueTeam, dynBlue, "blue");
    document.getElementById("scoreSpecList").innerHTML = makeSpecRows(spectators);
    
    // ✨ Final skor kaldırıldı (kullanıcı isteği)
    const finalEl = document.getElementById("scoreFinalScore");
    if (finalEl) finalEl.style.display = "none";
}

function showMiniScoreboard() {
    // ✨ Kayıtlı opaklığı oku
    let tabOpacity = 5;
    try {
        const saved = localStorage.getItem("miniTabOpacity");
        if (saved !== null) {
            const parsed = parseInt(saved);
            tabOpacity = isNaN(parsed) ? 5 : parsed;
        }
    } catch(e) {}
    
    // ✨ %0 ise scoreboard hiç açılmasın
    if (tabOpacity <= 0) return;
    
    createMiniScoreboard();
    renderMiniScoreboard();
    const overlay = document.getElementById("miniScoreboard");
    if (overlay) {
        overlay.style.background = `rgba(15, 20, 30, ${tabOpacity / 100})`;
        overlay.style.display = "flex";
    }
}

function hideMiniScoreboard() {
    const overlay = document.getElementById("miniScoreboard");
    if (overlay) overlay.style.display = "none";
}

// ✨ TAB tuşu - Scoreboard göster (basılı tuttukça)
let miniTabHeld = false;
let miniScoreboardInterval = null;

document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    
    // Sadece mini futbol oyun ekranında
    const gameScreen = document.getElementById("miniGameScreen");
    if (!gameScreen || gameScreen.classList.contains("hidden")) return;
    
    // ✨ Herhangi bir popup açıksa TAB'ı yoksay
    const pauseBox = document.getElementById("miniPauseLobbyBox");
    const guestBox = document.getElementById("miniGuestEscBox");
    const guestPaused = document.getElementById("miniGuestPausedBox");
    const teamNameBox = document.getElementById("miniTeamNameEditor");
    const nameBox = document.getElementById("miniNameEditor");
    const settingsBox = document.getElementById("roomSettingsBox");
    const ctrlBox = document.getElementById("miniControlSettings");
    const returnBox = document.getElementById("miniLobbyReturnConfirm");
    const resetBox = document.getElementById("miniResetNamesConfirm");
    const escBox = document.getElementById("escConfirmBox");
    const quickPause = document.getElementById("miniQuickPauseOverlay");
    
    const anyPopupOpen = [
        pauseBox, guestBox, guestPaused, teamNameBox, nameBox, 
        settingsBox, ctrlBox, returnBox, resetBox, escBox
    ].some(el => el && !el.classList.contains("hidden"));
    
    // Quick pause overlay display:flex kontrol
    const quickPauseOpen = quickPause && quickPause.style.display === "flex";
    
    if (anyPopupOpen || quickPauseOpen) {
        e.preventDefault();  // Yine de browser focus değişmesini engelle
        return;
    }
    
    e.preventDefault();
    
    // Basılı tutma tekrarı engelle
    if (e.repeat) return;
    
    if (!miniTabHeld) {
        miniTabHeld = true;
        showMiniScoreboard();
        // Canlı güncelleme (her 300ms)
        if (miniScoreboardInterval) clearInterval(miniScoreboardInterval);
        miniScoreboardInterval = setInterval(() => {
            if (miniTabHeld) renderMiniScoreboard();
        }, 300);
    }
}, true);

document.addEventListener("keyup", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    miniTabHeld = false;
    hideMiniScoreboard();
    if (miniScoreboardInterval) {
        clearInterval(miniScoreboardInterval);
        miniScoreboardInterval = null;
    }
}, true);

// ✨ T TUŞU - Chat aç + input'a focus (CS/Minecraft tarzı)
document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k !== "t") return;
    
    // Sadece mini futbol ekranlarında (lobby/oyun)
    const gameScreen = document.getElementById("miniGameScreen");
    const lobbyScreen = document.getElementById("miniLobbyScreen");
    const inMini = (gameScreen && !gameScreen.classList.contains("hidden")) ||
                   (lobbyScreen && !lobbyScreen.classList.contains("hidden"));
    if (!inMini) return;
    
    // Input/textarea odakta ise yoksay (zaten yazıyor)
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
    
    // Chat container görünmüyorsa yoksay (oda dışında)
    const container = document.getElementById("miniChatContainer");
    if (!container || container.style.display === "none") return;
    
    // Chat zaten açıksa yoksay (T harfi input'a yazılsın diye engelleme)
    if (miniChat.open) return;
    
    // Herhangi bir popup açıksa yoksay
    const openPopups = [
        "miniPauseLobbyBox", "miniGuestEscBox", "miniGuestPausedBox",
        "roomSettingsBox", "miniControlSettings", "miniTeamNameEditor",
        "miniNameEditor", "escConfirmBox", "miniLobbyReturnConfirm",
        "miniRestartConfirm", "miniResetNamesConfirm", "miniKickConfirm",
        "miniGuestLobbyConfirm", "miniGameOverBox"
    ];
    for (const id of openPopups) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains("hidden") && el.style.display !== "none") {
            return;
        }
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    // ✨ Tüm basılı tuşları bırak (karakter dursun)
    miniReleaseAllKeys();
    
    // Chat'i aç + input'a focus
    openMiniChatPanel();
}, true);

// ✨ P TUŞU - HIZLI PAUSE (Lobby açmaz)
document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k !== "p") return;
    
    // Sadece mini futbol oyun ekranında
    const gameScreen = document.getElementById("miniGameScreen");
    if (!gameScreen || gameScreen.classList.contains("hidden")) return;
    
    // Sadece host
    if (miniData.playerId !== 1) return;
    
    // ESC popup açıksa çalışma
    const escBox = document.getElementById("miniPauseLobbyBox");
    if (escBox && !escBox.classList.contains("hidden")) return;
    
    e.preventDefault();
    e.stopPropagation();
    send({ type: "mini_quick_pause" });
}, true);

// ========================================
// ✨ CREATE EKRANI - GELİŞMİŞ AYARLAR
// ========================================

// Gelişmiş ayarlar tanımı (create + settings için ortak)
const MINI_ADVANCED_FIELDS = [
    { id: "kickPower",         label: "⚽ Şut Gücü",             current: 14,  min: 8,   max: 25,   step: 1 },
    { id: "sprintKickBonus",   label: "🔥 Sprint Şut Bonusu",   current: 30,  min: 0,   max: 100,  step: 5,  unit: "%" },
    { id: "plasePower",        label: "🌀 Plase Gücü Oranı",    current: 75,  min: 40,  max: 100,  step: 5,  unit: "%" },
    { id: "plaseSpin",         label: "🎯 Plase Kavis Şiddeti", current: 35,  min: 10,  max: 100,  step: 5 },
    { id: "afterTouchTime",    label: "⏱️ After-Touch Süresi", current: 200, min: 0,   max: 1000, step: 50, unit: "ms" },
    { id: "passAssistPower",   label: "🎯 Pas Yardım Gücü",     current: 50,  min: 0,   max: 100,  step: 5,  unit: "%" },
    { id: "ballMaxSpeed",      label: "💨 Top Max Hızı",         current: 18,  min: 10,  max: 35,   step: 1 },
    { id: "sprintMultiplier",  label: "🏃 Sprint Hız Çarpanı",  current: 150, min: 100, max: 250,  step: 10, unit: "%" },
    { id: "sprintDuration",    label: "⚡ Sprint Süresi",        current: 3,   min: 1,   max: 10,   step: 1,  unit: "sn" },
    { id: "ballStick",         label: "🧲 Top Kontrolü",         current: 85,  min: 0,   max: 100,  step: 5,  unit: "" }
];

function setupCreateMiniAdvancedFields() {
    const container = document.getElementById("createMiniAdvancedFields");
    if (!container) return;
    
    // ✨ localStorage'dan advanced değerleri yükle (varsa)
    let savedAdv = {};
    try {
        const raw = localStorage.getItem("miniAdvancedSettings");
        if (raw) savedAdv = JSON.parse(raw);
    } catch(e) {}
    
    // ✨ Özgür Kazanma Skoru + Maç Süresi'ni geri yükle (varsa)
    const gEl = document.getElementById("createAdvGoalTarget");
    const dEl = document.getElementById("createAdvMatchDuration");
    if (gEl && savedAdv._advGoalTarget !== undefined) {
        gEl.value = savedAdv._advGoalTarget;
    }
    if (dEl && savedAdv._advMatchDurationMin !== undefined) {
        dEl.value = savedAdv._advMatchDurationMin;
    }
    
    // Alan HTML'i oluştur
    let html = "";
    MINI_ADVANCED_FIELDS.forEach(field => {
        // Kayıtlı değer varsa onu kullan
        const val = (savedAdv[field.id] !== undefined) ? savedAdv[field.id] : field.current;
        
        html += `<div style="margin-bottom:14px;">
            <label style="display:flex; justify-content:space-between; align-items:center;
                          color:#c084fc; font-weight:bold; margin-bottom:6px; font-size:13px;">
                <span>${field.label}</span>
                <span id="createAdvVal_${field.id}" style="color:#ffd43b; font-family:monospace;
                                                             background:rgba(0,0,0,0.3);
                                                             padding:2px 8px; border-radius:5px; font-size:12px;">
                    ${val}${field.unit || ""}
                </span>
            </label>
            <input type="range" id="createAdvField_${field.id}"
                   min="${field.min}" max="${field.max}" step="${field.step || 1}"
                   value="${val}"
                   style="width:100%; height:5px; cursor:pointer; accent-color:#c084fc;">
        </div>`;
    });
    container.innerHTML = html;
    
    // Slider değişince canlı güncelle
    MINI_ADVANCED_FIELDS.forEach(field => {
        const slider = document.getElementById("createAdvField_" + field.id);
        const valSpan = document.getElementById("createAdvVal_" + field.id);
        if (slider && valSpan) {
            slider.addEventListener("input", () => {
                valSpan.textContent = slider.value + (field.unit || "");
            });
        }
    });
    
    // Toggle animasyonu + Oyun Hızı disable
    const toggle = document.getElementById("createMiniAdvancedToggle");
    const content = document.getElementById("createMiniAdvancedContent");
    const speedSelect = document.getElementById("miniSpeedSelect");
    const speedLabel = speedSelect ? speedSelect.previousElementSibling : null;
    
    if (toggle && content) {
        // ✨ Devre dışı bırakılacak ayarlar
        const disableList = ["miniSpeedSelect", "miniAllowPlaseSelect", "miniGoalTargetSelect", "miniDurationSelect", "miniBallStickSelect", "miniPassAssistanceSelect"];
        
        function setFieldsDisabled(disabled) {
            disableList.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.disabled = disabled;
                if (el.parentElement) {
                    el.parentElement.style.opacity = disabled ? "0.4" : "1";
                    el.parentElement.style.pointerEvents = disabled ? "none" : "auto";
                }
            });
        }
        
        toggle.addEventListener("change", () => {
            // ✨ Toggle değişimini localStorage'a kaydet
            try {
                localStorage.setItem("miniAdvancedEnabled", toggle.checked ? "true" : "false");
            } catch(e) {}
            
            if (toggle.checked) {
                content.style.maxHeight = content.scrollHeight + "px";
                setTimeout(() => {
                    if (toggle.checked) content.style.maxHeight = "3000px";
                }, 400);
                
                setFieldsDisabled(true);
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
                setTimeout(() => {
                    content.style.maxHeight = "0";
                }, 10);
                
                setFieldsDisabled(false);
            }
        });
        
        // ✨ Sayfa yüklenirken localStorage'dan toggle durumunu yükle
        try {
            const savedEnabled = localStorage.getItem("miniAdvancedEnabled") === "true";
            if (savedEnabled) {
                toggle.checked = true;
                // Animasyonsuz aç (sayfa henüz görünmediği için)
                setTimeout(() => {
                    content.style.maxHeight = "5000px";
                    setFieldsDisabled(true);
                }, 100);
            } else {
                toggle.checked = false;
                content.style.maxHeight = "0";
                setFieldsDisabled(false);
            }
        } catch(e) {}
    }
    
    // Sıfırla butonu
    const resetBtn = document.getElementById("createMiniAdvResetBtn");
    if (resetBtn) {
        resetBtn.onclick = () => {
            MINI_ADVANCED_FIELDS.forEach(field => {
                const slider = document.getElementById("createAdvField_" + field.id);
                const valSpan = document.getElementById("createAdvVal_" + field.id);
                if (slider) slider.value = field.current;
                if (valSpan) valSpan.textContent = field.current + (field.unit || "");
            });
        };
    }
    
    // Dışa Aktar / Yükle butonları (Adım 4'te backend'e bağlanacak)
    const exportBtn = document.getElementById("createMiniAdvExportBtn");
    const importBtn = document.getElementById("createMiniAdvImportBtn");
    if (exportBtn) exportBtn.onclick = () => alert("Dışa Aktar - Yakında Güncellenecek");
    if (importBtn) importBtn.onclick = () => alert("Yükle - Yakında Güncellenecek");
}

// ========================================
// 🎮 KONTROL AYARLARI POPUP
// ========================================

// Default klavye tuşları (localStorage'a kaydedilir)
const DEFAULT_KEYS_P1 = {
    up: "w", down: "s", left: "a", right: "d",
    kick: "Space", sprint: "ShiftLeft"
};

function getSavedKeys(slot) {
    // slot: "p1"
    try {
        const raw = localStorage.getItem("miniKeys_" + slot);
        if (raw) return JSON.parse(raw);
    } catch(e) {}
    return slot === "p1" ? { ...DEFAULT_KEYS_P1 } : { ...DEFAULT_KEYS_P1 };
}

function saveKeys(slot, keys) {
    try {
        localStorage.setItem("miniKeys_" + slot, JSON.stringify(keys));
    } catch(e) {}
}

function keyLabel(code) {
    // Klavye code'unu okunabilir hale getir
    const map = {
        "Space": "SPACE",
        "ShiftLeft": "Sol SHIFT",
        "ShiftRight": "Sağ SHIFT",
        "ControlLeft": "Sol CTRL",
        "ControlRight": "Sağ CTRL",
        "ArrowUp": "↑", "ArrowDown": "↓",
        "ArrowLeft": "←", "ArrowRight": "→",
        "Numpad0": "Num 0", "Numpad1": "Num 1"
    };
    if (map[code]) return map[code];
    if (code.length === 1) return code.toUpperCase();
    return code;
}

function showMiniControlSettings() {
    // Eski popup varsa kaldır
    const existing = document.getElementById("miniControlSettings");
    if (existing) existing.remove();
    
    const p1Keys = getSavedKeys("p1");
    
    // Bağlı gamepad'leri al
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let connectedPads = [];
    for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) {
            connectedPads.push({ index: pads[i].index, name: pads[i].id.split("(")[0].trim() });
        }
    }
    
    // === GAMEPAD BÖLÜMÜ ===
    let gamepadHtml = "";
    if (connectedPads.length === 0) {
        gamepadHtml = `<p style="color:#adb5bd; font-size:13px; text-align:center; padding:15px;
                                 background:rgba(0,0,0,0.2); border-radius:8px;">
            🎮 Kontrolcü bağlı değil. USB/Bluetooth ile bir kontrolcü tak.
        </p>`;
    } else {
        gamepadHtml = `<div style="display:flex; flex-direction:column; gap:10px;">`;
        connectedPads.forEach((pad, i) => {
            const isActive = miniGamepad.index === pad.index;
            const isEnabled = miniGamepad.enabled && isActive;
            const borderColor = isEnabled ? "#51cf66" : "#495057";
            const bgColor = isEnabled ? "rgba(81,207,102,0.1)" : "rgba(73,80,87,0.1)";
            const titleColor = isEnabled ? "#51cf66" : "#adb5bd";
            
            gamepadHtml += `
                <div style="padding:12px 14px; background:${bgColor}; 
                            border:1px solid ${borderColor}; border-radius:8px; transition:all 0.3s;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="color:${titleColor}; font-weight:bold; font-size:13px;">
                            🎮 ${pad.name || "Kontrolcü"}
                        </span>
                    </div>
                    
                    <!-- ✨ Kontrolcüyü Etkinleştir toggle -->
                    <label style="display:flex; align-items:center; cursor:pointer; user-select:none;
                                  padding:8px 10px; background:rgba(0,0,0,0.25); border-radius:6px;
                                  margin-top:4px;">
                        <input type="checkbox" id="miniGamepadEnableToggle" ${isEnabled ? 'checked' : ''}
                               style="margin-right:10px; width:16px; height:16px; cursor:pointer; accent-color:#51cf66;">
                        <span style="color:#51cf66; font-weight:bold; font-size:13px;">
                            🎮 Kontrolcüyü Etkinleştir
                        </span>
                    </label>
                    <p style="color:#adb5bd; font-size:11px; margin:6px 0 0 0; text-align:center;">
                        ${isEnabled ? '✅ Klavye ile birlikte 1. Oyuncuyu kontrol eder' : '⏸️ Sadece klavye çalışır'}
                    </p>
                </div>
            `;
        });
        gamepadHtml += `</div>`;
    }
    
    // === TİTREŞİM AYARLARI ===
    const vibrationEnabled = MiniVibration.isEnabled();
    const vibrationTypes = [
        { id: "kick",     label: "⚽ Şut Titreşimi",       default: 25 },
        { id: "firekick", label: "🔥 Alevli Şut Titreşimi", default: 50 },
        { id: "wall",     label: "🧱 Duvara Çarpma",       default: 15 },
        { id: "post",     label: "🥅 Direğe Çarpma",       default: 90 },
        { id: "goal",     label: "🎯 Gol Titreşimi",       default: 50 },
        { id: "whistle",  label: "📢 Santra / Düdük",      default: 10 }
    ];
    
    let vibrationHtml = "";
    if (connectedPads.length > 0) {
        // Ana toggle
        vibrationHtml = `
            <label style="display:flex; align-items:center; cursor:pointer; user-select:none;
                          padding:10px 14px; background:rgba(255,169,77,0.1);
                          border:1px solid #ffa94d; border-radius:8px; margin-bottom:10px;">
                <input type="checkbox" id="miniVibrationMasterToggle" ${vibrationEnabled ? 'checked' : ''}
                       style="margin-right:12px; width:18px; height:18px; cursor:pointer; accent-color:#ffa94d;">
                <span style="color:#ffa94d; font-weight:bold; font-size:14px;">
                    📳 Titreşimi Etkinleştir
                </span>
            </label>
            
            <div id="miniVibrationContent" style="max-height:${vibrationEnabled ? '2000px' : '0'}; 
                 overflow:hidden; transition:max-height 0.4s ease-out;">
                <div style="padding:12px; background:rgba(255,169,77,0.05); border-radius:8px;
                            border-left:3px solid #ffa94d;">
                    <p style="color:#adb5bd; font-size:11px; margin:0 0 12px 0; font-style:italic;">
                        Her titreşim gücünü ayrı ayrı ayarla. Test butonuyla dene!
                    </p>
        `;
        
        vibrationTypes.forEach(vt => {
            const currentVal = MiniVibration.getPower(vt.id);
            vibrationHtml += `
                <div style="margin-bottom:12px; padding:8px 10px; background:rgba(0,0,0,0.2); border-radius:6px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <span style="color:#ffd43b; font-weight:bold; font-size:12px;">${vt.label}</span>
                        <span id="miniVibVal_${vt.id}" style="color:#ffa94d; font-family:monospace;
                                                              background:rgba(0,0,0,0.4); padding:2px 8px;
                                                              border-radius:4px; font-size:11px; font-weight:bold;">
                            %${currentVal}
                        </span>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <input type="range" id="miniVibRange_${vt.id}" data-vib-type="${vt.id}"
                               min="0" max="100" step="1" value="${currentVal}"
                               style="flex:1; height:5px; cursor:pointer; accent-color:#ffa94d;">
                        <button class="miniVibTestBtn" data-vib-type="${vt.id}"
                                style="background:#0ca678; color:#fff; border:none; padding:5px 10px;
                                       border-radius:5px; font-size:11px; font-weight:bold; cursor:pointer;
                                       min-width:110px; white-space:nowrap;">
                            🔊 Test Et
                        </button>
                    </div>
                </div>
            `;
        });
        
        vibrationHtml += `
                </div>
            </div>
        `;
    }
    
    // Klavye kısayolları
    let keyBindHtml = `<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px;">`;
    const keyDefs = [
        { id: "up", label: "⬆️ Yukarı" },
        { id: "down", label: "⬇️ Aşağı" },
        { id: "left", label: "⬅️ Sol" },
        { id: "right", label: "➡️ Sağ" },
        { id: "kick", label: "⚽ Şut" },
        { id: "sprint", label: "🏃 Sprint" }
    ];
    keyDefs.forEach(k => {
        keyBindHtml += `
            <div style="display:flex; align-items:center; gap:8px; padding:6px 10px;
                        background:rgba(0,0,0,0.2); border-radius:6px;">
                <span style="color:#adb5bd; font-size:12px; flex:1;">${k.label}:</span>
                <button class="miniKeyBindBtn" data-key-id="${k.id}"
                        style="background:#ffd43b; color:#000; border:none; padding:4px 12px;
                               border-radius:4px; font-family:monospace; font-weight:bold;
                               cursor:pointer; font-size:12px; min-width:70px;">
                    ${keyLabel(p1Keys[k.id])}
                </button>
            </div>
        `;
    });
    keyBindHtml += `</div>`;
    
    // ✨ TAB Görünürlüğü kayıtlı değeri yükle (default %5)
    let savedTabOpacity = 5;
    try {
        const saved = localStorage.getItem("miniTabOpacity");
        if (saved !== null) savedTabOpacity = parseInt(saved);
        if (isNaN(savedTabOpacity)) savedTabOpacity = 5;
        if (savedTabOpacity < 0) savedTabOpacity = 0;
        if (savedTabOpacity > 100) savedTabOpacity = 100;
    } catch(e) {}
    
    const overlay = document.createElement("div");
    overlay.id = "miniControlSettings";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:640px; max-height:88vh; overflow-y:auto;
                                        border:2px solid #0ca678; box-shadow: 0 0 40px rgba(12,166,120,0.3);">
            <div style="font-size:50px; margin:10px 0;">⚙️</div>
            <h2 style="color:#0ca678; margin:5px 0 20px 0;">Ayarlar</h2>
            
            <!-- KONTROLCÜ BİLGİSİ -->
            <div style="text-align:left; margin-bottom:20px;">
                <h3 style="color:#c084fc; font-size:15px; margin:0 0 10px 0; text-align:center;">
                    🎮 Bağlı Kontrolcüler
                </h3>
                ${gamepadHtml}
            </div>
            
            <!-- TİTREŞİM AYARLARI (Sadece kontrolcü varsa VE etkinse) -->
            <div id="miniVibrationSection" style="text-align:left; margin:20px 0 15px 0; padding-top:20px; 
                 border-top:1px dashed #3b4c63; display:${(connectedPads.length > 0 && miniGamepad.enabled) ? 'block' : 'none'};">
                <h3 style="color:#ffa94d; font-size:15px; margin:0 0 10px 0; text-align:center;">
                    📳 Titreşim Ayarları
                </h3>
                ${vibrationHtml}
            </div>
            
            <!-- TAB GÖRÜNÜRLÜĞÜ -->
            <div style="text-align:left; margin:20px 0 15px 0; padding-top:20px; border-top:1px dashed #3b4c63;">
                <h3 style="color:#4dabf7; font-size:15px; margin:0 0 10px 0; text-align:center;">
                    📊 TAB Skorboard Görünürlüğü
                </h3>
                <p style="color:#adb5bd; font-size:11px; text-align:center; margin:0 0 12px 0;">
                    TAB'a bastığında arka planın koyuluğu
                </p>
                <div style="padding:12px 15px; background:rgba(77,171,247,0.08); 
                            border:1px solid rgba(77,171,247,0.3); border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="color:#4dabf7; font-weight:bold; font-size:13px;">Koyuluk</span>
                        <span id="miniTabOpacityVal" style="color:#ffd43b; font-family:monospace; 
                                                            background:rgba(0,0,0,0.3); padding:3px 10px;
                                                            border-radius:5px; font-size:12px;">
                            %${savedTabOpacity}
                        </span>
                    </div>
                    <input type="range" id="miniTabOpacityRange" 
                           min="0" max="100" step="1" value="${savedTabOpacity}"
                           style="width:100%; height:5px; cursor:pointer; accent-color:#4dabf7;">
                    <div style="display:flex; justify-content:space-between; color:#6c757d; 
                                font-size:10px; margin-top:2px;">
                        <span>Görünmez (%0)</span>
                        <span>Koyu (%100)</span>
                    </div>
                </div>
            </div>
            
            <!-- KLAVYE KISAYOL TUŞLARI -->
            <div style="text-align:left; margin:25px 0 15px 0; padding-top:20px; border-top:1px dashed #3b4c63;">
                <h3 style="color:#ffd43b; font-size:15px; margin:0 0 10px 0; text-align:center;">
                    ⌨️ Klavye Kısayolları
                </h3>
                <p style="color:#adb5bd; font-size:11px; text-align:center; margin:0 0 12px 0;">
                    Değiştirmek için üstüne tıkla, sonra yeni tuşa bas
                </p>
                ${keyBindHtml}
            </div>
            
            <div class="confirmButtons" style="margin-top:20px;">
                <button id="miniCtrlResetBtn" class="bigBtn" style="background:#e67e22;">
                    🔄 Varsayılana Sıfırla
                </button>
                <button id="miniCtrlCloseBtn" class="bigBtn greenBtn">
                    ✅ Kapat
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // ✨ TAB opaklığı slider dinleyicisi (canlı değiştir)
    const opacitySlider = document.getElementById("miniTabOpacityRange");
    const opacityVal = document.getElementById("miniTabOpacityVal");
    if (opacitySlider && opacityVal) {
        opacitySlider.addEventListener("input", () => {
            const val = parseInt(opacitySlider.value);
            opacityVal.textContent = `%${val}`;
            // Anlık localStorage'a kaydet
            try { localStorage.setItem("miniTabOpacity", String(val)); } catch(e) {}
            // Scoreboard varsa opacity'sini anlık güncelle
            const sb = document.getElementById("miniScoreboard");
            if (sb) sb.style.background = `rgba(15, 20, 30, ${val / 100})`;
        });
    }
	
	// ✨ GAMEPAD ETKİNLEŞTİRME TOGGLE
    const gpEnableToggle = document.getElementById("miniGamepadEnableToggle");
    if (gpEnableToggle) {
        gpEnableToggle.addEventListener("change", () => {
            miniGamepad.enabled = gpEnableToggle.checked;
            saveGamepadEnabled();
            
            if (miniGamepad.enabled) {
                // Etkinleştirildi → polling'i başlat (oyun içindeyse)
                const gameScreen = document.getElementById("miniGameScreen");
                if (gameScreen && !gameScreen.classList.contains("hidden")) {
                    startGamepadPolling();
                }
                showToast("🎮 Kontrolcü", "Kontrolcü etkinleştirildi!", null, "success");
            } else {
                // Devre dışı → polling'i durdur + titreşimi kes
                stopGamepadPolling();
                MiniVibration.stop();
                showToast("⏸️ Kontrolcü", "Kontrolcü devre dışı bırakıldı", null, "info");
            }
            
            // Popup'ı yenile (titreşim bölümü gizlensin/görünsün + border rengi vs)
            const overlay = document.getElementById("miniControlSettings");
            if (overlay) {
                overlay.remove();
                showMiniControlSettings();
            }
        });
    }
    
    // ✨ TİTREŞİM MASTER TOGGLE
    const vibToggle = document.getElementById("miniVibrationMasterToggle");
    const vibContent = document.getElementById("miniVibrationContent");
    if (vibToggle && vibContent) {
        vibToggle.addEventListener("change", () => {
            try {
                localStorage.setItem("miniVibrationEnabled", vibToggle.checked ? "true" : "false");
            } catch(e) {}
            
            if (vibToggle.checked) {
                vibContent.style.maxHeight = vibContent.scrollHeight + "px";
                setTimeout(() => {
                    if (vibToggle.checked) vibContent.style.maxHeight = "3000px";
                }, 400);
            } else {
                vibContent.style.maxHeight = vibContent.scrollHeight + "px";
                setTimeout(() => {
                    vibContent.style.maxHeight = "0";
                }, 10);
            }
        });
    }
    
    // ✨ TİTREŞİM SLİDER'LARI (canlı % güncelle + localStorage + aktif teste yansıma)
    overlay.querySelectorAll('input[id^="miniVibRange_"]').forEach(slider => {
        const type = slider.dataset.vibType;
        const valSpan = document.getElementById("miniVibVal_" + type);
        slider.addEventListener("input", () => {
            const val = parseInt(slider.value);
            if (valSpan) valSpan.textContent = `%${val}`;
            try {
                localStorage.setItem("miniVibrationPower_" + type, String(val));
            } catch(e) {}
            
            // ✨ Bu tipin aktif testi varsa titreşimi anlık güncelle
            const testBtn = overlay.querySelector(`.miniVibTestBtn[data-vib-type="${type}"]`);
            if (testBtn && testBtn.dataset.testing === "true") {
                // Yeni % ile tekrar başlat (kalan süre kadar)
                const remainingMs = testBtn._testEndTime ? Math.max(500, testBtn._testEndTime - Date.now()) : 3000;
                MiniVibration.stop();
                MiniVibration.testVibrate(type, remainingMs);
            }
        });
    });
    
    // Diğer test butonlarını kilitle/aç
    function setOtherTestBtnsDisabled(activeBtn, disabled) {
        overlay.querySelectorAll(".miniVibTestBtn").forEach(b => {
            if (b === activeBtn) return;
            if (disabled) {
                b.style.opacity = "0.4";
                b.style.cursor = "not-allowed";
                b.dataset.locked = "true";
            } else {
                b.style.opacity = "1";
                b.style.cursor = "pointer";
                b.dataset.locked = "false";
            }
        });
    }
    
    // Test butonunu normale döndürme fonksiyonu
    function resetTestBtn(btn) {
        btn.dataset.testing = "false";
        btn.textContent = "🔊 Test Et";
        btn.style.background = "#0ca678";
        if (btn._testTimeout) {
            clearTimeout(btn._testTimeout);
            btn._testTimeout = null;
        }
        btn._testEndTime = null;
        // Diğer butonları da serbest bırak
        setOtherTestBtnsDisabled(btn, false);
    }
    
    // ✨ TEST BUTONLARI (3 saniye titret + kırmızı "Durdur" butonu)
    overlay.querySelectorAll(".miniVibTestBtn").forEach(btn => {
        btn.addEventListener("click", () => {
            const type = btn.dataset.vibType;
            
            // ✨ Başka test aktifse (bu buton kilitliyse) bir şey yapma
            if (btn.dataset.locked === "true") {
                showToast("⏸️ Bekle", "Önce diğer testi durdur!", null, "warning");
                return;
            }
            
            // Zaten aktif test var mı? (durdur modunda mı)
            if (btn.dataset.testing === "true") {
                // Durdurma modu → titreşimi kes
                MiniVibration.stop();
                clearTimeout(btn._testTimeout);
                resetTestBtn(btn);
                return;
            }
            
            // Kontrolcü bağlı mı?
            if (!miniGamepad.connected) {
                showToast("⚠️ Kontrolcü Yok", "Test için kontrolcü bağla!", null, "warning");
                return;
            }
            
            // Titreşim etkin mi?
            if (!MiniVibration.isEnabled()) {
                showToast("⚠️ Titreşim Kapalı", "Önce titreşimi etkinleştir!", null, "warning");
                return;
            }
            
            // Gamepad etkin mi?
            if (!miniGamepad.enabled) {
                showToast("⚠️ Kontrolcü Kapalı", "Önce kontrolcüyü etkinleştir!", null, "warning");
                return;
            }
            
            // % 0 ise test etme
            const power = MiniVibration.getPower(type);
            if (power <= 0) {
                showToast("⚠️ Güç 0", "Titreşim gücünü artır!", null, "warning");
                return;
            }
            
            // TEST BAŞLAT
            btn.dataset.testing = "true";
            btn.textContent = "⏹ Durdur";
            btn.style.background = "#e03131";
            btn._testEndTime = Date.now() + 3000;  // ✨ Test bitiş zamanı
            
            // ✨ Diğer test butonlarını kilitle
            setOtherTestBtnsDisabled(btn, true);
            
            // 3 saniye boyunca titret (uzun titreşim)
            MiniVibration.testVibrate(type, 3000);
            
            // 3 saniye sonra otomatik geri dön
            btn._testTimeout = setTimeout(() => {
                MiniVibration.stop();
                resetTestBtn(btn);
            }, 3000);
        });
    });
    
    // Tuş değiştirme (bind)
    let waitingForKey = null;
    overlay.querySelectorAll(".miniKeyBindBtn").forEach(btn => {
        btn.onclick = () => {
            if (waitingForKey) return;
            waitingForKey = btn.dataset.keyId;
            btn.textContent = "... tuşa bas";
            btn.style.background = "#ff6b6b";
            btn.style.color = "#fff";
        };
    });
    
    // Yeni tuş yakalama
    const keyListener = (e) => {
        if (!waitingForKey) return;
        e.preventDefault();
        e.stopPropagation();
        
        const btn = overlay.querySelector(`.miniKeyBindBtn[data-key-id="${waitingForKey}"]`);
        if (!btn) return;
        
        const code = e.code;
        p1Keys[waitingForKey] = code;
        saveKeys("p1", p1Keys);
        
        btn.textContent = keyLabel(code);
        btn.style.background = "#ffd43b";
        btn.style.color = "#000";
        waitingForKey = null;
        
        // ✨ Oyun ekranındaki kontrol bilgisini de güncelle
        updateMiniControlsInfo();
    };
    window.addEventListener("keydown", keyListener, true);
	
	// ✨ Popup açıkken kontrolcü tuşu algılama (bağlı olmadığı durumda)
    // Her 300ms'de bir gamepad kontrol et
    let gamepadCheckInterval = null;
    if (connectedPads.length === 0) {
        gamepadCheckInterval = setInterval(() => {
            const currentPads = navigator.getGamepads ? navigator.getGamepads() : [];
            let foundNew = false;
            for (let i = 0; i < currentPads.length; i++) {
                if (currentPads[i] && currentPads[i].connected) {
                    // Bir buton basıldı mı kontrol et (aktif kullanım varsa algıla)
                    const hasActivity = currentPads[i].buttons.some(b => b.pressed) ||
                                       currentPads[i].axes.some(a => Math.abs(a) > 0.3);
                    
                    if (hasActivity || !miniGamepad.connected) {
                        // Kontrolcü var VE aktivite var (veya ilk kez bağlanıyor)
                        miniGamepad.connected = true;
                        miniGamepad.index = currentPads[i].index;
                        miniGamepad.name = currentPads[i].id;
                        miniGamepad.slot = "p1";
                        foundNew = true;
                        console.log(`[GAMEPAD] Popup açıkken algılandı: ${currentPads[i].id}`);
                        break;
                    }
                }
            }
            
            if (foundNew) {
                // Popup'ı yenile (kontrolcü göründüğü için)
                clearInterval(gamepadCheckInterval);
                gamepadCheckInterval = null;
                overlay.remove();
                showMiniControlSettings();
                showToast("🎮 Kontrolcü Algılandı", miniGamepad.name.split("(")[0].trim(), null, "success");
            }
        }, 300);
    }
    
    // Kapat
    overlay.querySelector("#miniCtrlCloseBtn").onclick = () => {
        window.removeEventListener("keydown", keyListener, true);
        // Aktif titreşim testleri varsa durdur
        MiniVibration.stop();
        overlay.querySelectorAll(".miniVibTestBtn").forEach(b => {
            if (b._testTimeout) clearTimeout(b._testTimeout);
        });
        // Gamepad check interval'i temizle
        if (gamepadCheckInterval) {
            clearInterval(gamepadCheckInterval);
            gamepadCheckInterval = null;
        }
        overlay.remove();
    };
    
    // Sıfırla
    overlay.querySelector("#miniCtrlResetBtn").onclick = () => {
        if (!confirm("Ayarları varsayılana sıfırla?\n(Klavye tuşları + TAB görünürlüğü + Titreşim ayarları)")) return;
        try { 
            localStorage.removeItem("miniKeys_p1");
            localStorage.setItem("miniTabOpacity", "5");  // ✨ Default %5
            // ✨ Titreşim ayarlarını sıfırla
            localStorage.removeItem("miniVibrationEnabled");
            localStorage.removeItem("miniVibrationPower_kick");
            localStorage.removeItem("miniVibrationPower_firekick");
            localStorage.removeItem("miniVibrationPower_wall");
            localStorage.removeItem("miniVibrationPower_post");
            localStorage.removeItem("miniVibrationPower_goal");
            localStorage.removeItem("miniVibrationPower_whistle");
        } catch(e) {}
        MiniVibration.stop();
        window.removeEventListener("keydown", keyListener, true);
        overlay.remove();
        showMiniControlSettings();
    };
}

// ========================================
// MODERN CONFIRM POPUP - Lobbye Dön
// ========================================
function showMiniLobbyReturnConfirm() {
    // Popup zaten varsa kaldır
    const existing = document.getElementById("miniLobbyReturnConfirm");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "miniLobbyReturnConfirm";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:450px; border:2px solid #e67e22; box-shadow: 0 0 40px rgba(230,126,34,0.4);">
            <div style="font-size:60px; margin:10px 0;">🚪</div>
            <h2 style="color:#e67e22; margin:10px 0 15px 0;">Lobiye Dönmek İster misin?</h2>
            <p style="color:#adb5bd; font-size:15px; margin:0 0 25px 0; line-height:1.5;">
                Oyunu bitirip <b style="color:#ffd43b;">herkesi lobbye</b> döndürmek istiyor musun?<br>
                <span style="font-size:13px;">Skorlar sıfırlanır ama oda açık kalır.</span>
            </p>
            <div class="confirmButtons">
                <button id="miniLobbyReturnYesBtn" class="bigBtn greenBtn">🚪 EVET, DÖN</button>
                <button id="miniLobbyReturnNoBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("miniLobbyReturnYesBtn").onclick = () => {
        overlay.remove();
        hideMiniPauseLobby();
        send({ type: "mini_force_return_to_lobby" });
    };
    
    document.getElementById("miniLobbyReturnNoBtn").onclick = () => {
        overlay.remove();
    };
}

// ========================================
// MODERN CONFIRM POPUP - Kullanıcı Lobiye Dön
// ========================================
function showMiniGuestLobbyConfirm() {
    const existing = document.getElementById("miniGuestLobbyConfirm");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "miniGuestLobbyConfirm";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:450px; border:2px solid #e67e22; box-shadow: 0 0 40px rgba(230,126,34,0.4);">
            <div style="font-size:60px; margin:10px 0;">🚪</div>
            <h2 style="color:#e67e22; margin:10px 0 15px 0;">Lobiye Dönmek İster misin?</h2>
            <p style="color:#adb5bd; font-size:15px; margin:0 0 25px 0; line-height:1.5;">
                Oyundan çıkacaksın, <b style="color:#ffd43b;">izleyici</b> olacaksın.<br>
                <span style="font-size:13px;">Oda hala açık kalır.</span>
            </p>
            <div class="confirmButtons">
                <button id="miniGuestLobbyYesBtn" class="bigBtn greenBtn">🚪 EVET, DÖN</button>
                <button id="miniGuestLobbyNoBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("miniGuestLobbyYesBtn").onclick = () => {
        overlay.remove();
        // Backend'e bildir: kullanıcı izleyici olsun
        send({ type: "mini_guest_return_lobby" });
        // Lobby ekranına geç
        showScreen("miniLobby");
        updateMiniLobby();
    };
    
    document.getElementById("miniGuestLobbyNoBtn").onclick = () => {
        overlay.remove();
    };
}

// ========================================
// MODERN CONFIRM POPUP - Oyuncuyu At (Mini Futbol)
// ========================================
function openMiniKickConfirm(targetId, targetName) {
    const existing = document.getElementById("miniKickConfirm");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "miniKickConfirm";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:450px; border:2px solid #ff6b6b; box-shadow: 0 0 40px rgba(255,107,107,0.4);">
            <div style="font-size:60px; margin:10px 0;">⚠️</div>
            <h2 style="color:#ff6b6b; margin:10px 0 15px 0;">Oyuncuyu At?</h2>
            <p style="color:#adb5bd; font-size:15px; margin:0 0 25px 0; line-height:1.5;">
                <b style="color:#fff;">${targetName}</b> odadan atılacak.<br>
                <span style="font-size:13px;">Bu odaya tekrar katılamaz.</span>
            </p>
            <div class="confirmButtons">
                <button id="miniKickYesBtn" class="bigBtn redBtn">🚫 EVET, AT</button>
                <button id="miniKickNoBtn" class="bigBtn greenBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("miniKickYesBtn").onclick = () => {
        overlay.remove();
        send({ type: "mini_kick_player", target_id: targetId });
    };
    
    document.getElementById("miniKickNoBtn").onclick = () => {
        overlay.remove();
    };
}

// ========================================
// MODERN POPUP - Takım Dolu Uyarısı
// ========================================
function showMiniTeamFullPopup(team, teamName, maxPerTeam, modeLabel) {
    const existing = document.getElementById("miniTeamFullBox");
    if (existing) existing.remove();
    
    const isRed = team === "red";
    const teamColor = isRed ? (miniData.redTeamColor || "#ff6b6b") : (miniData.blueTeamColor || "#4dabf7");
    const teamGlow = hexToRgba(teamColor, 0.4);
    
    const overlay = document.createElement("div");
    overlay.id = "miniTeamFullBox";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:450px; border:2px solid ${teamColor}; 
                                         box-shadow: 0 0 40px ${teamGlow};">
            <div style="margin:10px auto; width:70px; height:70px; border-radius:50%; background:${teamColor}; box-shadow: 0 0 25px ${teamGlow}, inset 0 -6px 12px rgba(0,0,0,0.25);"></div>
            <h2 style="color:${teamColor}; margin:10px 0 15px 0;">Takım Dolu!</h2>
            <p style="color:#adb5bd; font-size:15px; margin:0 0 25px 0; line-height:1.6;">
                <b style="color:${teamColor};">${teamName}</b> dolu.<br>
                <span style="font-size:13px;">
                    Bu oda <b style="color:#ffd43b;">${modeLabel}</b> modunda,<br>
                    her takımda en fazla <b style="color:#ffd43b;">${maxPerTeam} oyuncu</b> olabilir.
                </span>
            </p>
            <div class="confirmButtons">
                <button id="miniTeamFullOkBtn" class="bigBtn greenBtn">Anladım</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("miniTeamFullOkBtn").onclick = () => {
        overlay.remove();
    };
}

// ========================================
// MODERN CONFIRM POPUP - Maçı Yeniden Başlat
// ========================================
function showMiniRestartConfirm() {
    // Popup zaten varsa kaldır
    const existing = document.getElementById("miniRestartConfirm");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "miniRestartConfirm";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:450px; border:2px solid #ffd43b; box-shadow: 0 0 40px rgba(255,212,59,0.4);">
            <div style="font-size:60px; margin:10px 0;">🔄</div>
            <h2 style="color:#ffd43b; margin:10px 0 15px 0;">Maçı Yeniden Başlat?</h2>
            <p style="color:#adb5bd; font-size:15px; margin:0 0 25px 0; line-height:1.5;">
                Maç <b style="color:#ffd43b;">sıfırdan</b> başlayacak.<br>
                <span style="font-size:13px;">Skorlar (0-0) ve süre sıfırlanır. Ayarlar korunur.</span>
            </p>
            <div class="confirmButtons">
                <button id="miniRestartYesBtn" class="bigBtn greenBtn">🔄 EVET, BAŞLAT</button>
                <button id="miniRestartNoBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("miniRestartYesBtn").onclick = () => {
        overlay.remove();
        hideMiniPauseLobby();
        send({ type: "mini_restart_match" });
    };
    
    document.getElementById("miniRestartNoBtn").onclick = () => {
        overlay.remove();
    };
}

// ========================================
// ✨ PING SİSTEMİ
// ========================================
function startMiniPing() {
    if (miniData.pingInterval) return;
    
    // ✨ Host tek başınaysa ping ATMA (kendi kendine ping = 0)
    function _shouldPing() {
        const isHost = miniData.playerId === 1;
        const otherCount = miniData.players ? miniData.players.filter(p => p.id !== miniData.playerId).length : 0;
        
        if (isHost && otherCount === 0) {
            // Host + kimse yok → ping'i sıfırla, gönderme
            if (!miniData.pings) miniData.pings = {};
            miniData.pings[miniData.playerId] = 0;
            updateMiniPingDisplay();
            return false;
        }
        return true;
    }
    
    // Her 3 saniyede bir ping at
    miniData.pingInterval = setInterval(() => {
        if (!_shouldPing()) return;
        
        // ✨ P2P bağlıysa DataChannel'dan ping ölç (daha doğru)
        if (MiniRTC.connected) {
            MiniRTC.sendMessage({ type: "mini_ping_p2p", ts: Date.now() });
        } else if (ws && ws.readyState === WebSocket.OPEN) {
            send({ type: "mini_ping", ts: Date.now() });
        }
    }, 3000);
    
    // İlk ping'i hemen at
    setTimeout(() => {
        if (!_shouldPing()) return;
        
        if (MiniRTC.connected) {
            MiniRTC.sendMessage({ type: "mini_ping_p2p", ts: Date.now() });
        } else if (ws && ws.readyState === WebSocket.OPEN) {
            send({ type: "mini_ping", ts: Date.now() });
        }
    }, 500);
}

function stopMiniPing() {
    if (miniData.pingInterval) {
        clearInterval(miniData.pingInterval);
        miniData.pingInterval = null;
    }
}

function updateMiniPingDisplay() {
    // Lobby ve pause popup'taki ping değerlerini güncelle
    const pingSpans = document.querySelectorAll(".miniPlayerPing");
    pingSpans.forEach(span => {
        const pid = parseInt(span.dataset.playerId);
        const pingVal = miniData.pings ? miniData.pings[pid] : null;
        if (pingVal !== undefined && pingVal !== null) {
            span.textContent = `${pingVal}ms`;
            if (pingVal < 80) span.style.color = "#51cf66";
            else if (pingVal < 200) span.style.color = "#ffd43b";
            else span.style.color = "#ff6b6b";
        }
    });
}

// ========================================
// 📳 GAMEPAD TİTREŞİM SİSTEMİ
// ========================================
const MiniVibration = {
    lastVibration: 0,
    minInterval: 20,  // ✨ Min 20ms arayla (test için biraz esnek)
    
    // Ayarları localStorage'dan oku
    isEnabled() {
        try {
            return localStorage.getItem("miniVibrationEnabled") !== "false";
        } catch(e) { return true; }
    },
    
    getPower(type) {
        // type: "kick", "firekick", "wall", "post", "goal", "whistle"
        // Default değerler:
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
    
    // Titreşim gönder
    // strong: güçlü motor (düşük frekans, sarsıntı)
    // weak: zayıf motor (yüksek frekans, buzz)
    // duration: milisaniye
    vibrate(strong, weak, duration) {
        if (!this.isEnabled()) return;
        if (!miniGamepad.connected) return;
        if (!miniGamepad.enabled) return;  // ✨ Gamepad kapalıysa titreşim yok
        // Güç 0 ise titreşme
        if (strong <= 0.01 && weak <= 0.01) return;
        
        // Spam engeli - çok sık titreşim gelmesin
        const now = performance.now();
        if (now - this.lastVibration < this.minInterval) return;
        this.lastVibration = now;
        
        try {
            const pads = navigator.getGamepads ? navigator.getGamepads() : [];
            const pad = pads[miniGamepad.index];
            if (!pad) return;
            
            // Modern API: dual-rumble
            if (pad.vibrationActuator && pad.vibrationActuator.playEffect) {
                pad.vibrationActuator.playEffect("dual-rumble", {
                    startDelay: 0,
                    duration: duration,
                    strongMagnitude: Math.min(1.0, Math.max(0, strong)),
                    weakMagnitude: Math.min(1.0, Math.max(0, weak))
                }).catch(() => {});
            }
            // Eski API: hapticActuators
            else if (pad.hapticActuators && pad.hapticActuators.length > 0) {
                pad.hapticActuators[0].pulse(Math.max(strong, weak), duration).catch(() => {});
            }
        } catch(e) {
            // Titreşim desteklemiyorsa sessizce geç
        }
    },
    
    // Preset titreşimler (kullanıcının % ayarını okur)
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
        // Topa dokunma - kick ayarının 1/4'ü kadar
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
        // Kısa ikinci pulse
        setTimeout(() => {
            this.vibrate(0.7 * p, 0.5 * p, 180);
        }, 350);
    },
    
    goalConceded() {
        const p = this.getPower("goal") / 100;
        this.vibrate(0.6 * p, 0.4 * p, 200);
    },
    
    playerCollision() {
        // Sabit hafif (ayar yok)
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
    
    // ✨ TEST fonksiyonu - Gerçek oyundaki preset'i çağırır, verilen süre boyunca tekrarlar
    _testInterval: null,
    testVibrate(type, durationMs) {
        const p = this.getPower(type) / 100;
        if (p <= 0) return;
        
        // Eski test intervalı varsa temizle
        if (this._testInterval) {
            clearInterval(this._testInterval);
            this._testInterval = null;
        }
        
        // Preset fonksiyonunu çağır (gerçek oyundaki gibi)
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
        
        // İlk pulse hemen
        callPreset();
        
        // Preset sürelerine göre tekrar aralığı
        // kick: 80ms, firekick: 150ms, wall: 80ms, post: 200ms, goal: 250ms, whistle: 100ms
        const intervalMap = {
            kick: 150,
            firekick: 200,
            wall: 130,
            post: 250,
            goal: 400,
            whistle: 180
        };
        const interval = intervalMap[type] || 200;
        
        // Süre bitene kadar tekrarla
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
    
    // Titreşimi durdur
    stop() {
        // ✨ Aktif test intervalı varsa temizle
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

// ✨ Ping başlatma & pause lobby update - handleMiniMessage içine gömdük (aşağıda)

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

    // Chrome autoplay: jesture sonrası unlock (tekrar denenebilir)
    unlock() {
        if (this._unlocked || this._unlocking) return;
        this._unlocking = true;

        try {
            // 1) WebAudio resume (en stabil yöntem)
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
                    // Unlock olduktan sonra cache'i ısıt
                    this.preloadAll();
                }).catch(() => {
                    // Jesture yoksa unlocked false kalsın; sonraki tıkta tekrar denenecek
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

    // Tek ses çal (unlock yoksa dene, fail olursa 1 kez retry)
    play(name, volume) {
        if (!name) return;

        // Unlock yoksa önce dene (oda join tıkı ile gelmiş olabilir)
        if (!this._unlocked) this.unlock();

        try {
            const p = this._playOnce(name, volume);
            if (p && typeof p.catch === "function") {
                p.catch(() => {
                    // ✨ Production fix: ilk play fail → unlock + kısa retry
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

        // Unlock yoksa da çalmayı dene (içeride unlock/retry var)
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

// Daha fazla jesture kaynağı (mobile + desktop)
["pointerdown", "touchstart", "click", "keydown"].forEach(evt => {
    document.addEventListener(evt, () => MiniAudio.unlock(), { passive: true, capture: true });
});

// ========================================
// ✨ CLIENT-SIDE PREDICTION (Misafir için)
// ========================================

// Prediction sabitleri (host physics ile aynı olmalı)
const PRED_PLAYER_SPEED_MAP = {
    "yavas": 2.0,
    "normal": 2.8,
    "hizli": 3.5
};
const PRED_PLAYER_ACCEL_MAP = {
    "yavas": 0.4,
    "normal": 0.55,
    "hizli": 0.8
};
const PRED_FRICTION = 0.90;
const PRED_SPRINT_MULT = 1.5;
// ✨ Fallback default değerler (fieldConfig'ten gerçek boyut alınır)
const PRED_FIELD_WIDTH = 1000;
const PRED_FIELD_HEIGHT = 500;

function getPredFieldWidth() {
    if (miniData.fieldConfig && miniData.fieldConfig.width) return miniData.fieldConfig.width;
    if (miniData.fieldWidth) return miniData.fieldWidth;
    return PRED_FIELD_WIDTH;
}
function getPredFieldHeight() {
    if (miniData.fieldConfig && miniData.fieldConfig.height) return miniData.fieldConfig.height;
    if (miniData.fieldHeight) return miniData.fieldHeight;
    return PRED_FIELD_HEIGHT;
}
const PRED_PLAYER_RADIUS = 20;
const PRED_PLAYER_OUT_MARGIN = 55;
const PRED_LERP_SPEED = 0.4;  // ✨ 0.25 → 0.4 (daha hızlı server sync)

// Prediction her frame çalışır (~60fps)
function updateMiniPrediction() {
    if (!miniData.predictionActive) return;
    if (!miniData.gameState) return;
    if (!miniData.playerId) return;
    
    // Kendi ID'mizin gerçek pozisyonu server'dan
    const serverPos = miniData.gameState.players[String(miniData.playerId)];
    if (!serverPos) return;
    
    // İlk kez → server pozisyonundan başlat
    if (!miniData.predictedSelf) {
        miniData.predictedSelf = {
            x: serverPos.x,
            y: serverPos.y,
            vx: 0,
            vy: 0
        };
        return;
    }
    
    const p = miniData.predictedSelf;
    // 🎯 BUG FIX: predictedKeys yerine her zaman güncel olan keysPressed kullanılarak mobildeki ağırlık çözüldü
    const keys = miniData.keysPressed;
    
    // Hız ayarı
    const speedMode = miniData.gameSpeed || "normal";
    const PLAYER_SPEED = PRED_PLAYER_SPEED_MAP[speedMode] || 2.8;
    const PLAYER_ACCEL = PRED_PLAYER_ACCEL_MAP[speedMode] || 0.55;
    
    // Sprint kontrolü (basit - enerjiye bakmıyoruz)
    const sprintActive = keys.sprint;
    const maxSpeed = PLAYER_SPEED * (sprintActive ? PRED_SPRINT_MULT : 1.0);
    
    // İvme uygula
    if (keys.up) p.vy -= PLAYER_ACCEL;
    if (keys.down) p.vy += PLAYER_ACCEL;
    if (keys.left) p.vx -= PLAYER_ACCEL;
    if (keys.right) p.vx += PLAYER_ACCEL;
    
    // Max hız
    const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (spd > maxSpeed) {
        p.vx = (p.vx / spd) * maxSpeed;
        p.vy = (p.vy / spd) * maxSpeed;
    }
    
    // Sürtünme
    p.vx *= PRED_FRICTION;
    p.vy *= PRED_FRICTION;
    if (Math.abs(p.vx) < 0.1) p.vx = 0;
    if (Math.abs(p.vy) < 0.1) p.vy = 0;
    
    // Pozisyon güncelle
    p.x += p.vx;
    p.y += p.vy;
    
    // Duvar sınırı (basit) - saha boyutları dinamik
    const R = PRED_PLAYER_RADIUS;
    const M = PRED_PLAYER_OUT_MARGIN;
    const _pfw = getPredFieldWidth();
    const _pfh = getPredFieldHeight();
    if (p.x - R < -M) { p.x = -M + R; p.vx = 0; }
    if (p.x + R > _pfw + M) { p.x = _pfw + M - R; p.vx = 0; }
    if (p.y - R < -M) { p.y = -M + R; p.vy = 0; }
    if (p.y + R > _pfh + M) { p.y = _pfh + M - R; p.vy = 0; }
    
    // ✨ SERVER RECONCILIATION - server pozisyonuna yumuşakça yaklaş
    // Tahminim serverdan çok uzaksa → snap et
    const dx = serverPos.x - p.x;
    const dy = serverPos.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 40) {
        // Çok uzak → snap (ışınlan)
        p.x = serverPos.x;
        p.y = serverPos.y;
        p.vx = 0;
        p.vy = 0;
    } else if (dist > 2) {
        // Ufak fark → hızlıca yaklaş
        p.x += dx * 0.5;
        p.y += dy * 0.5;
    }
}

// ✨ RECONCILIATION: Yerel HP motorunu, server'dan gelen gerçek veriyle hizala
function syncLocalHPWithServer() {
    if (typeof HP === 'undefined' || !HP.running || !HP.room || !HP.room.gameState) return;
    if (!miniData.gameState || miniData.playerId === 1) return; // Host zaten otorite, sync gerekmez

    const localGS = HP.room.gameState;
    const serverGS = miniData.gameState;

    // 1) Topu senkronize et (Yumuşak lerp)
    if (serverGS.ball && localGS.ball) {
        const dx = serverGS.ball.x - localGS.ball.x;
        const dy = serverGS.ball.y - localGS.ball.y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist > 80) {
            localGS.ball.x = serverGS.ball.x;
            localGS.ball.y = serverGS.ball.y;
            localGS.ball.vx = serverGS.ball.vx || 0;
            localGS.ball.vy = serverGS.ball.vy || 0;
        } else if (dist > 1) {
            localGS.ball.x += dx * 0.3;
            localGS.ball.y += dy * 0.3;
        }
    }

    // 2) Oyuncuları senkronize et (Loose Reconciliation - Sıfır Rubberbanding)
    if (serverGS.players) {
        for (const pid in serverGS.players) {
            const sP = serverGS.players[pid];
            const lP = localGS.players[pid];
            if (!lP) continue;

            const dx = sP.x - lP.x;
            const dy = sP.y - lP.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            const isMe = parseInt(pid) === miniData.playerId;
            // Kendi karakterimiz ise toleransı yüksek, diğer oyuncular ise dar tutuyoruz
            const threshold = isMe ? 150 : 50; 
            const lerpSpeed = isMe ? 0.12 : 0.35; // Kendi karakterimizde yumuşak senkronizasyon (titreşimi tamamen sıfırlar)

            if (dist > threshold) {
                lP.x = sP.x;
                lP.y = sP.y;
            } else if (dist > 0.5) {
                lP.x += dx * lerpSpeed;
                lP.y += dy * lerpSpeed;
            }
        }
    }
}

// ========================================
// ⚙️ AYAR DEĞİŞİKLİĞİ TOAST (birden fazla ayarı alt alta gösterir)
// ========================================
function showMiniSettingsToast(changes) {
    // Eski toast varsa kaldır
    const existing = document.getElementById("miniSettingsToast");
    if (existing) existing.remove();
    
    // Toast oluştur
    const toast = document.createElement("div");
    toast.id = "miniSettingsToast";
    toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: linear-gradient(135deg, rgba(30, 40, 60, 0.98), rgba(20, 30, 45, 0.98));
        border: 2px solid #4dabf7;
        border-radius: 12px;
        padding: 16px 20px;
        box-shadow: 0 10px 40px rgba(77, 171, 247, 0.4), 0 0 60px rgba(77, 171, 247, 0.2);
        z-index: 100000;
        min-width: 320px;
        max-width: 450px;
        color: #fff;
        font-family: 'Segoe UI', sans-serif;
        animation: settingsToastSlideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    
    // Başlık
    let html = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px; 
                    padding-bottom:10px; border-bottom:1px solid rgba(77,171,247,0.3);">
            <span style="font-size:24px;">⚙️</span>
            <div style="flex:1;">
                <div style="color:#4dabf7; font-weight:700; font-size:15px;">
                    Oda Ayarları Güncellendi
                </div>
                <div style="color:#adb5bd; font-size:11px;">
                    ${changes.length} ayar değiştirildi
                </div>
            </div>
        </div>
    `;
    
    // Her değişiklik için satır
    changes.forEach((change, i) => {
        html += `
            <div style="padding:6px 0; font-size:13px; color:#e0e0e0; line-height:1.5;
                        animation: settingsRowFadeIn 0.3s ease-out ${i * 0.08}s both;">
                ${change.msg}
            </div>
        `;
    });
    
    toast.innerHTML = html;
    document.body.appendChild(toast);
    
    // Animasyon CSS'i (yoksa ekle)
    if (!document.getElementById("miniSettingsToastStyles")) {
        const style = document.createElement("style");
        style.id = "miniSettingsToastStyles";
        style.textContent = `
            @keyframes settingsToastSlideIn {
                from { opacity: 0; transform: translateX(400px); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes settingsToastSlideOut {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(400px); }
            }
            @keyframes settingsRowFadeIn {
                from { opacity: 0; transform: translateX(15px); }
                to { opacity: 1; transform: translateX(0); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // ✨ Otomatik kapat (değişiklik sayısına göre süre ayarla - her satır +500ms)
    const displayTime = Math.min(3000 + changes.length * 500, 8000);  // min 3s, max 8s
    setTimeout(() => {
        toast.style.animation = "settingsToastSlideOut 0.3s ease-in forwards";
        setTimeout(() => toast.remove(), 300);
    }, displayTime);
}

// ========================================
// 🇹🇷 AY-YILDIZ ÇİZİM (Seljuk için özel)
// Türk Bayrağı standartları:
// Hilal dış çap = 1/2 bayrak yüksekliği
// Hilal iç çap = 2/5 bayrak yüksekliği  
// Yıldız çap = 1/4 bayrak yüksekliği
// ========================================
function drawTurkishStar(ctx, cx, cy, radius, glowIntensity) {
    const flagH = radius * 2;
    
    ctx.save();
    ctx.translate(cx, cy);
    
    if (glowIntensity > 0.01) {
        ctx.shadowBlur = 25 * glowIntensity;
        ctx.shadowColor = "#e30a17";
        ctx.fillStyle = "#ffffff";
    }
    
    ctx.fillStyle = "#ffffff";
    
    const moonOuterR = flagH * 0.25;
    const moonInnerR = moonOuterR * 0.8;
    const moonCenterX = -radius * 0.15;
    const moonCutOffset = moonOuterR * 0.25;
    
    ctx.beginPath();
    ctx.arc(moonCenterX, 0, moonOuterR, 0, Math.PI * 2);
    ctx.arc(moonCenterX + moonCutOffset, 0, moonInnerR, 0, Math.PI * 2, true);
    ctx.fill();
    
    const starOuterR = flagH * 0.15;
    const starInnerR = starOuterR * 0.38;
    const starX = moonCenterX + moonOuterR * 1.1;
    const starY = 0;
    
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const isOuter = (i % 2 === 0);
        const r = isOuter ? starOuterR : starInnerR;
        const angle = -Math.PI / 2 + (i * Math.PI / 5);
        const x = starX + Math.cos(angle) * r;
        const y = starY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

// 🇦🇿 AZERBAYCAN BAYRAĞI (Üç Yatay Şerit + Hilal & 8 Köşeli Yıldız)
function drawAzerbaijanFlag(ctx, cx, cy, radius, glowIntensity) {
    ctx.save();
    ctx.translate(cx, cy);
    
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    
    // ✨ Görsel Alan Dengelemesi (Daire içinde 3 rengin eşit görünmesi için ortayı hafif daraltıyoruz)
    const midH = radius * 0.36; 
    
    // Üst - Mavi
    ctx.fillStyle = "#00b5e2"; 
    ctx.fillRect(-radius, -radius, radius * 2, radius - midH + 1); // +1px çizgi boşluğu kalmasın diye
    
    // Orta - Kırmızı
    ctx.fillStyle = "#e32118";
    ctx.fillRect(-radius, -midH, radius * 2, midH * 2);
    
    // Alt - Yeşil
    ctx.fillStyle = "#38a047";
    ctx.fillRect(-radius, midH - 1, radius * 2, radius - midH + 1);
    
    if (glowIntensity > 0.01) {
        ctx.shadowBlur = 20 * glowIntensity;
        ctx.shadowColor = "#ffffff";
    }
    
    ctx.fillStyle = "#ffffff";
    
    const moonOuterR = radius * 0.26;
    const moonInnerR = moonOuterR * 0.8;
    const moonCenterX = -radius * 0.12;
    const moonCutOffset = moonOuterR * 0.25;
    
    ctx.beginPath();
    ctx.arc(moonCenterX, 0, moonOuterR, 0, Math.PI * 2);
    ctx.arc(moonCenterX + moonCutOffset, 0, moonInnerR, 0, Math.PI * 2, true);
    ctx.fill();
    
    const starOuterR = radius * 0.16;
    const starInnerR = starOuterR * 0.45;
    const starX = moonCenterX + moonOuterR * 1.15;
    const starY = 0;
    
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
        const isOuter = (i % 2 === 0);
        const r = isOuter ? starOuterR : starInnerR;
        const angle = (i * Math.PI / 8);
        const x = starX + Math.cos(angle) * r;
        const y = starY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
}

// 🦅 BEŞİKTAŞ FORMASI (Siyah-Beyaz Çubuklu)
function drawBesiktasKit(ctx, cx, cy, radius, glowIntensity) {
    ctx.save();
    ctx.translate(cx, cy);
    
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    
    // Siyah Dikey Çubuklar
    ctx.fillStyle = "#111111";
    const stripeW = (radius * 2) / 5;
    ctx.fillRect(-radius, -radius, stripeW, radius * 2);
    ctx.fillRect(-radius + stripeW * 2, -radius, stripeW, radius * 2);
    ctx.fillRect(-radius + stripeW * 4, -radius, stripeW, radius * 2);
    
    // Göğüste Türk Bayrağı / Kırmızı Amblem Detayı
    if (glowIntensity > 0.01) {
        ctx.shadowBlur = 15 * glowIntensity;
        ctx.shadowColor = "#e30a17";
    }
    ctx.fillStyle = "#e30a17";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// 🦁 GALATASARAY FORMASI (Parçalı - Sol Sarı, Sağ Kırmızı)
function drawGalatasarayKit(ctx, cx, cy, radius, glowIntensity) {
    ctx.save();
    ctx.translate(cx, cy);
    
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    
    // Sol Parça (Kırmızı)
    ctx.fillStyle = "#a90429";
    ctx.fillRect(-radius, -radius, radius, radius * 2);
    
    // Sağ Parça (Sarı)
    ctx.fillStyle = "#fdb913";
    ctx.fillRect(0, -radius, radius, radius * 2);
    
    if (glowIntensity > 0.01) {
        ctx.shadowBlur = 15 * glowIntensity;
        ctx.shadowColor = "#fdb913";
    }
    
    ctx.restore();
}

// 🐤 FENERBAHÇE FORMASI (Sarı-Lacivert Çubuklu)
function drawFenerbahceKit(ctx, cx, cy, radius, glowIntensity) {
    ctx.save();
    ctx.translate(cx, cy);
    
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    
    ctx.fillStyle = "#ffed00"; // Sarı Zemin
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    
    // Lacivert Dikey Çubuklar
    ctx.fillStyle = "#00205b";
    const stripeW = (radius * 2) / 5;
    ctx.fillRect(-radius, -radius, stripeW, radius * 2);
    ctx.fillRect(-radius + stripeW * 2, -radius, stripeW, radius * 2);
    ctx.fillRect(-radius + stripeW * 4, -radius, stripeW, radius * 2);
    
    if (glowIntensity > 0.01) {
        ctx.shadowBlur = 15 * glowIntensity;
        ctx.shadowColor = "#ffed00";
    }
    
    ctx.restore();
}

// 🌊 TRABZONSPOR FORMASI (Bordo-Mavi Çubuklu)
function drawTrabzonsporKit(ctx, cx, cy, radius, glowIntensity) {
    ctx.save();
    ctx.translate(cx, cy);
    
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    
    ctx.fillStyle = "#4ab3e8"; // Mavi Zemin
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    
    // Bordo Dikey Çubuklar
    ctx.fillStyle = "#700018";
    const stripeW = (radius * 2) / 5;
    ctx.fillRect(-radius, -radius, stripeW, radius * 2);
    ctx.fillRect(-radius + stripeW * 2, -radius, stripeW, radius * 2);
    ctx.fillRect(-radius + stripeW * 4, -radius, stripeW, radius * 2);
    
    if (glowIntensity > 0.01) {
        ctx.shadowBlur = 15 * glowIntensity;
        ctx.shadowColor = "#4ab3e8";
    }
    
    ctx.restore();
}

// ========================================
// 🔒 SELJUK ÖZEL İSİM KORUMASI
// ========================================
const SELJUK_LOCK_KEY = "seljukLockUntil";
const SELJUK_ATTEMPTS_KEY = "seljukAttempts";
const SELJUK_VERIFIED_KEY = "seljukVerified";

function isSeljukName(name) {
    const n = (name || "").trim();
    return n === "Seljuk" || n === "seljuk" || n === "SELJUK";
}

function isSeljukLocked() {
    try {
        const until = parseInt(localStorage.getItem(SELJUK_LOCK_KEY) || "0");
        if (until && Date.now() < until) {
            return until - Date.now();  // Kalan ms
        }
    } catch(e) {}
    return 0;
}

function isSeljukVerified() {
    // Doğrulama 24 saat geçerli
    try {
        const verifiedUntil = parseInt(localStorage.getItem(SELJUK_VERIFIED_KEY) || "0");
        if (verifiedUntil && Date.now() < verifiedUntil) {
            return true;
        }
    } catch(e) {}
    return false;
}

function markSeljukVerified() {
    try {
        // 24 saat geçerli
        const until = Date.now() + (24 * 60 * 60 * 1000);
        localStorage.setItem(SELJUK_VERIFIED_KEY, String(until));
        localStorage.setItem(SELJUK_ATTEMPTS_KEY, "0");  // Denemeleri sıfırla
    } catch(e) {}
}

function formatLockTime(ms) {
    const mins = Math.ceil(ms / 60000);
    if (mins >= 60) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h} saat ${m} dakika`;
    }
    return `${mins} dakika`;
}

// Şifre popup göster - Promise döner (true/false)
// Şifre popup göster - Promise döner (true/false)
function showSeljukPasswordPopup() {
    return new Promise((resolve) => {
        // Kilit kontrol
        const lockedMs = isSeljukLocked();
        if (lockedMs > 0) {
            showSeljukLockedPopup(lockedMs);
            resolve(false);
            return;
        }
        
        // Eski popup varsa kaldır
        const existing = document.getElementById("seljukPasswordBox");
        if (existing) existing.remove();
        
        const attempts = parseInt(localStorage.getItem(SELJUK_ATTEMPTS_KEY) || "0");
        const remaining = 3 - attempts;
        
        const overlay = document.createElement("div");
        overlay.id = "seljukPasswordBox";
        overlay.className = "overlay";
        overlay.style.zIndex = "9999999";
        overlay.innerHTML = `
            <div class="overlayCard" style="max-width:450px; border:2px solid #ff6b6b; 
                                             box-shadow: 0 0 40px rgba(255,107,107,0.5);">
                <div style="font-size:60px; margin:10px 0;">🔒</div>
                <h2 style="color:#ff6b6b; margin:10px 0 15px 0;">Korumalı İsim</h2>
                <p style="color:#adb5bd; font-size:14px; margin:0 0 20px 0; line-height:1.5;">
                    <b style="color:#fff;">Seljuk</b> ismi korumalı.<br>
                    <span style="font-size:12px;">Devam etmek için şifre gir.</span>
                </p>
                <input id="seljukPwInput" type="password" 
                       placeholder="Şifre"
                       maxlength="20"
                       style="width:100%; padding:14px; font-size:20px; font-weight:bold;
                              border-radius:10px; border:2px solid #ff6b6b; 
                              background:#1a1e2e; color:#fff; text-align:center;
                              font-family:monospace; letter-spacing:5px; outline:none;">
                <p style="color:#ffd43b; font-size:12px; text-align:center; margin:10px 0 15px 0;">
                    Kalan hak: <b>${remaining}/3</b>
                </p>
                <div class="confirmButtons">
                    <button id="seljukPwOkBtn" class="bigBtn greenBtn">✓ TAMAM</button>
                    <button id="seljukPwCancelBtn" class="bigBtn redBtn">✗ İPTAL</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        const input = document.getElementById("seljukPwInput");
        setTimeout(() => input.focus(), 50);
        
        input.addEventListener("keydown", (e) => {
            e.stopPropagation();  // Oyun tuşları etkilenmesin
            if (e.key === "Enter") {
                e.preventDefault();
                document.getElementById("seljukPwOkBtn").click();
            } else if (e.key === "Escape") {
                e.preventDefault();
                document.getElementById("seljukPwCancelBtn").click();
            }
        });
        
        document.getElementById("seljukPwOkBtn").onclick = async () => {
            const password = input.value.trim();
            if (!password) {
                input.style.borderColor = "#ff3333";
                input.focus();
                return;
            }
            
            // Backend'e gönder
            try {
                const resp = await fetch("/verify-seljuk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ password: password })
                });
                const data = await resp.json();
                
                if (data.ok) {
                    // Doğru şifre
                    markSeljukVerified();
                    overlay.remove();
                    resolve(true);
                } else {
                    // Yanlış şifre
                    let newAttempts = parseInt(localStorage.getItem(SELJUK_ATTEMPTS_KEY) || "0") + 1;
                    localStorage.setItem(SELJUK_ATTEMPTS_KEY, String(newAttempts));
                    
                    if (newAttempts >= 3) {
                        // 3 yanlış → 1 saat kilit
                        const lockUntil = Date.now() + (60 * 60 * 1000);  // 1 saat
                        localStorage.setItem(SELJUK_LOCK_KEY, String(lockUntil));
                        localStorage.setItem(SELJUK_ATTEMPTS_KEY, "0");
                        overlay.remove();
                        showSeljukLockedPopup(60 * 60 * 1000);
                        resolve(false);
                    } else {
                        // Hala hak var
                        const remaining = 3 - newAttempts;
                        input.value = "";
                        input.style.borderColor = "#ff3333";
                        input.style.animation = "shake 0.4s";
                        setTimeout(() => { input.style.animation = ""; }, 400);
                        
                        // Uyarı güncelle
                        const warnP = overlay.querySelector("p[style*='ffd43b']");
                        if (warnP) {
                            warnP.innerHTML = `❌ Yanlış! Kalan hak: <b>${remaining}/3</b>`;
                            warnP.style.color = "#ff6b6b";
                        }
                        input.focus();
                    }
                }
            } catch(e) {
                console.error("Şifre doğrulama hatası:", e);
                showToast("❌ Hata", "Bağlantı sorunu, tekrar dene", null, "error");
            }
        };
        
        document.getElementById("seljukPwCancelBtn").onclick = () => {
            overlay.remove();
            resolve(false);
        };
    });
}

function showSeljukLockedPopup(remainingMs) {
    const existing = document.getElementById("seljukLockedBox");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "seljukLockedBox";
    overlay.className = "overlay";
    overlay.style.zIndex = "9999999";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:450px; border:2px solid #e03131; 
                                         box-shadow: 0 0 40px rgba(224,49,49,0.5);">
            <div style="font-size:60px; margin:10px 0;">⛔</div>
            <h2 style="color:#e03131; margin:10px 0 15px 0;">Kilitli!</h2>
            <p style="color:#adb5bd; font-size:15px; margin:0 0 25px 0; line-height:1.5;">
                Çok fazla yanlış deneme yaptın.<br>
                <b style="color:#ffd43b;">${formatLockTime(remainingMs)}</b> sonra tekrar dene.
            </p>
            <div class="confirmButtons">
                <button id="seljukLockedOkBtn" class="bigBtn redBtn">Anladım</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("seljukLockedOkBtn").onclick = () => {
        overlay.remove();
    };
}

// Shake animasyonu için CSS
(function addShakeStyle() {
    if (document.getElementById("seljukShakeStyle")) return;
    const style = document.createElement("style");
    style.id = "seljukShakeStyle";
    style.textContent = `
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-8px); }
            75% { transform: translateX(8px); }
        }
    `;
    document.head.appendChild(style);
})();

// ========================================
// 🎉 GOL SEVİNCİ SEÇİCİ (1 / 2)
// ========================================
const MINI_CELEB_CARDS = [
    {
        id: "random",
        icon: "🎲",
        name: "Rastgele",
        desc: "Her golde sürpriz rastgele sevinç!"
    },
    {
        id: "spin_rush",
        icon: "🌪️",
        name: "Dönerek Koş",
        desc: "Hızlan + etrafında halka. Çarpınca rakibi patlatır!"
    },
    {
        id: "grow_explode",
        icon: "🎈",
        name: "Balon Patlama",
        desc: "Şişen balonlar — süre sonunda konfeti patlaması."
    },
    {
        id: "rainbow_trail",
        icon: "🌈",
        name: "Gökkuşağı Kuyruk",
        desc: "Arkanda takım renkli ışıltılı kuyruk bırak."
    },
    {
        id: "spotlight",
        icon: "🔦",
        name: "Spot Işık",
        desc: "Saha kararır, üzerinde stadyum ışığı yanar."
    },
    {
        id: "frostbite",
        icon: "❄️",
        name: "Buz Devri",
        desc: "Saha buz pistine döner, herkes kayar."
    },
    {
        id: "smiley_face",
        icon: "😄",
        name: "Gülen Yüz",
        desc: "Gol atan sarı gülen yüze dönüşür!"
    },
    {
        id: "eagle_wings",
        icon: "🦅",
        name: "Kartal",
        desc: "Kartala dönüş, kanatlar çırpınır!"
    },
    {
        id: "snake",
        icon: "🐍",
        name: "Yılan",
        desc: "Yılana dönüş, arkanda kıvrılan kuyruk!"
    }
];

function getCelebPickerList() {
    return MINI_CELEB_CARDS;
}

function ensureCelebPickerDOM() {
    let root = document.getElementById("miniCelebPicker");

    // ✨ Saha alt şeridine (canvas wrapper içi) bağla — kırmızı bölge
    const host =
        document.querySelector(".miniCanvasWrapper") ||
        document.getElementById("miniGameScreen") ||
        document.body;

    // CSS (saha alt bandına oturur, ortalanır)
    if (!document.getElementById("celebPickerStyles")) {
        const style = document.createElement("style");
        style.id = "celebPickerStyles";
        style.textContent = `
            .miniCanvasWrapper {
                position: relative !important;
            }
            #miniCelebPicker {
                position: absolute;
                left: 50%;
                bottom: 6px;              /* ✨ saha alt yeşil şerit */
                transform: translateX(-50%) translateY(12px);
                z-index: 30;
                width: calc(100% - 24px);
                max-width: 720px;
                pointer-events: none;
                opacity: 0;
                transition: transform 0.28s cubic-bezier(0.34, 1.4, 0.64, 1), opacity 0.2s ease;
                font-family: 'Segoe UI', sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            #miniCelebPicker.open {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
                pointer-events: auto;
            }
            .celebHeader {
                display: none; /* saha içinde sade kalsın */
            }
            .miniCelebTrackWrap {
                position: relative;
                width: 100%;
                overflow: hidden;
                display: flex;
                align-items: center;
                height: 52px;
            }
            .miniCelebTrack {
                position: absolute;
                left: 50%;
                margin-left: -24px; /* 48px kart genişliğinin yarısı ile %100 tam merkezleme */
                display: flex;
                align-items: center;
                gap: 8px;
                transition: transform 0.22s ease-out;
                height: 100%;
            }
            .miniCelebCard {
                position: relative;
                flex: 0 0 48px;
                width: 48px;
                height: 48px;
                background: rgba(10, 14, 24, 0.82);
                border: 2px solid rgba(0, 100, 255, 0.85);
                border-radius: 8px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                transition: all 0.2s ease;
                opacity: 0.55;
                transform: scale(0.88);
                box-shadow: 0 3px 10px rgba(0,0,0,0.45);
                box-sizing: border-box;
            }
            .miniCelebCard.active {
                opacity: 1;
                transform: scale(1.18);
                border-color: #ffd43b;
                border-width: 3px;
                background: linear-gradient(145deg, rgba(35, 45, 70, 0.95), rgba(12, 16, 28, 0.96));
                box-shadow: 0 0 14px rgba(255, 212, 59, 0.55);
                z-index: 5;
            }
            .miniCelebCardIcon {
                font-size: 22px;
                line-height: 1;
                filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));
            }
            .miniCelebCard.active .miniCelebCardIcon {
                font-size: 24px;
            }
            .miniCelebCardName {
                display: none;
            }
            .miniCelebCard.active .miniCelebCardName {
                display: block;
                position: absolute;
                top: -16px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 10px;
                color: #ffd43b;
                white-space: nowrap;
                font-weight: 800;
                text-shadow: 0 1px 3px #000, 0 0 6px rgba(0,0,0,0.8);
                pointer-events: none;
            }
        `;
        document.head.appendChild(style);
    }

    if (!root) {
        root = document.createElement("div");
        root.id = "miniCelebPicker";
        root.innerHTML = `
            <div class="celebHeader"><kbd>1</kbd> / <kbd>2</kbd></div>
            <div class="miniCelebTrackWrap">
                <div class="miniCelebTrack" id="miniCelebTrack"></div>
            </div>
        `;
    }

    // Her açılışta doğru host'a taşı (saha kutusunun içi)
    if (root.parentElement !== host) {
        host.appendChild(root);
    }
    return root;
}

const CELEB_REPEAT_SETS = 5; // 5 tekrarlı sonsuz dairesel şerit
const CELEB_BASE_SET = 2;    // Merkez set (Set 2: 16-23 arası)

function renderCelebPickerCards(animate = true) {
    const track = document.getElementById("miniCelebTrack");
    if (!track) return;
    const list = getCelebPickerList();
    const len = list.length;
    const step = 56; // 48px kart + 8px boşluk

    if (miniData.celebVirtualIndex === undefined || miniData.celebVirtualIndex === null) {
        miniData.celebVirtualIndex = miniData.celebPickerIndex || 0;
    }

    const baseOffset = CELEB_BASE_SET * len; // 16
    const totalCards = len * CELEB_REPEAT_SETS;

    // Şerit DOM'u daha önce kurulmamışsa 5 set olarak doldur
    if (track.children.length !== totalCards) {
        let fullHtml = "";
        for (let s = 0; s < CELEB_REPEAT_SETS; s++) {
            for (let i = 0; i < len; i++) {
                const c = list[i];
                fullHtml += `
                    <div class="miniCelebCard" data-type="${c.id}" data-index="${i}">
                        <div class="miniCelebCardIcon">${c.icon}</div>
                        <div class="miniCelebCardName">${c.name}</div>
                    </div>
                `;
            }
        }
        track.innerHTML = fullHtml;
    }

    const targetPos = baseOffset + miniData.celebVirtualIndex;

    // Tüm kartların aktiflik durumunu güncelle
    const cards = track.children;
    for (let i = 0; i < cards.length; i++) {
        if (i === targetPos) {
            cards[i].classList.add("active");
        } else {
            cards[i].classList.remove("active");
        }
    }

    // ✨ Kesintisiz Sonsuz Kaydırma Animasyonu
    if (!animate) {
        track.style.transition = "none";
    } else {
        track.style.transition = "transform 0.22s cubic-bezier(0.25, 1, 0.5, 1)";
    }

    const offsetPx = - (targetPos * step);
    track.style.transform = `translateX(${offsetPx}px)`;

    // ✨ Şerit sınırına yaklaşıldığında kullanıcıya hissettirmeden merkezi sete sıfırla
    if (Math.abs(miniData.celebVirtualIndex) >= len) {
        if (miniData._celebResetTimeout) clearTimeout(miniData._celebResetTimeout);
        miniData._celebResetTimeout = setTimeout(() => {
            const normalized = ((miniData.celebVirtualIndex % len) + len) % len;
            miniData.celebVirtualIndex = normalized;
            miniData.celebPickerIndex = normalized;
            renderCelebPickerCards(false); // animasyonsuz, göz kırpmadan sıfırla
        }, 230);
    }
}

function openCelebPicker() {
    ensureCelebPickerDOM();
    miniData.celebPickerOpen = true;
    const root = document.getElementById("miniCelebPicker");
    if (root) root.classList.add("open");

    const list = getCelebPickerList();
    const pref = miniData.preferredCelebration;
    const idx = list.findIndex(c => c.id === pref);
    const resolvedIdx = idx >= 0 ? idx : 0;
    
    miniData.celebPickerIndex = resolvedIdx;
    miniData.celebVirtualIndex = resolvedIdx;
    renderCelebPickerCards(false);
}

function closeCelebPicker(immediate) {
    miniData.celebPickerOpen = false;
    const root = document.getElementById("miniCelebPicker");
    if (!root) return;
    if (immediate) {
        root.classList.remove("open");
        return;
    }
    root.classList.remove("open");
}

function applyPreferredCelebration(celebId) {
    miniData.preferredCelebration = celebId;
    try { localStorage.setItem("miniPreferredCelebration", celebId); } catch (e) {}

    // Kendi seçimimizi yerel belleğe de yazalım
    if (!miniData.playerCelebrationChoices) miniData.playerCelebrationChoices = {};
    miniData.playerCelebrationChoices[miniData.playerId] = celebId;

    // Host'a bildir (canlı sevinç + sonraki gol tercihi)
    const msg = {
        type: "mini_set_celebration",
        celebration_type: celebId,
        from_pid: miniData.playerId
    };

    // Yerelde host isek HP'ye hemen uygula
    if (miniData.playerId === 1 && typeof HP !== "undefined" && HP.running && HP.room?.gameState) {
        HP.applyCelebrationChoice(miniData.playerId, celebId);
    }

    if (typeof MiniRTC !== "undefined" && MiniRTC.connected && miniData.playerId !== 1) {
        MiniRTC.sendMessage(msg);
    }
    if (typeof send === "function") send(msg);
}

function handleCelebPickerKey(dir) {
    // Oyun ekranı değilse yok say
    const gameScreen = document.getElementById("miniGameScreen");
    if (!gameScreen || gameScreen.classList.contains("hidden")) return;

    const list = getCelebPickerList();
    if (!list.length) return;

    if (!miniData.celebPickerOpen) {
        openCelebPicker();
    }

    if (miniData.celebVirtualIndex === undefined) {
        miniData.celebVirtualIndex = miniData.celebPickerIndex || 0;
    }

    // ✨ Sola (-1) veya Sağa (+1) sonsuz kaydır
    miniData.celebVirtualIndex += dir;
    const normalizedIdx = ((miniData.celebVirtualIndex % list.length) + list.length) % list.length;
    miniData.celebPickerIndex = normalizedIdx;

    renderCelebPickerCards(true);

    const chosen = list[normalizedIdx];
    if (chosen) {
        applyPreferredCelebration(chosen.id);
    }

    // 4 sn işlem yoksa kapat
    if (miniData._celebPickerCloseTimer) clearTimeout(miniData._celebPickerCloseTimer);
    miniData._celebPickerCloseTimer = setTimeout(() => {
        closeCelebPicker();
    }, 4000);
}

console.log("Mini Futbol JS yüklendi ✓");