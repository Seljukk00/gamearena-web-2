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
    interpDelay: 75,         // ✨ 1v1 için daha düşük buffer: daha az input lag, daha canlı top
    serverTimeOffset: null,  // İlk paket geldiğinde ayarlanır
    // ✨ PING sistemi
    pings: {},           // {playerId: ping_ms}
    pingInterval: null,  // setInterval handle
    lastPingSent: 0,
    
    // ✨ CLIENT-SIDE PREDICTION (misafir için)
    predictedSelf: null,     // {x, y, vx, vy} - kendi karakterimin tahmini pozisyonu
    predictedKeys: {up:false, down:false, left:false, right:false, sprint:false},
    predictionActive: false, // Sadece misafirse aktif olur
    
    };



let miniAnimFrame = null;

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
    start: false, select: false  // ✨ START (ESC) ve SELECT (TAB)
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
    
    // === START (Button 9) → ESC gibi davran ===
    const btnStart = pad.buttons[9] && pad.buttons[9].pressed;
    if (btnStart && !gpPrevState.start) {
        gpPrevState.start = true;
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
    } else if (!btnStart && gpPrevState.start) {
        gpPrevState.start = false;
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
    
    // Pause popup açıksa hareket/şut gönderme (START/SELECT çalışsın diye yukarıda)
    const pauseBox = document.getElementById("miniPauseLobbyBox");
    if (pauseBox && !pauseBox.classList.contains("hidden")) return;
    
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
    
    // === SPRINT (R2=7, L2=6, R1=5, L1=4) ===
    const btnR2 = pad.buttons[7] && pad.buttons[7].pressed;
    const btnL2 = pad.buttons[6] && pad.buttons[6].pressed;
    const btnR1 = pad.buttons[5] && pad.buttons[5].pressed;
    const sprint = btnR2 || btnL2 || btnR1;
    
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
    // ✨ KICK edildim - ekranı temizle, katıl ekranına at
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
        inRoom = true;
        playerId = msg.player_id;
        
        // ✨ Ping'i başlat
        startMiniPing();
        
        // ✨ Oyun devam ediyorsa direkt oyun ekranına git (izleyici olarak)
        if (msg.mid_game) {
            console.log("[MINI] Oyun devam ediyor, izleyici olarak katılıyorum...");
            
            // Field config ve takım isimlerini kaydet
            if (msg.field) miniData.fieldConfig = msg.field;
            if (msg.red_team_name) miniData.redTeamName = msg.red_team_name;
            if (msg.blue_team_name) miniData.blueTeamName = msg.blue_team_name;
            miniData.splitScreen = msg.split_screen || false;
            miniData.splitOwner = msg.split_owner || null;
            miniData.splitSlaveId = msg.split_slave_id || null;
            
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
        
        // ✨ Host (player_id=1) listede yoksa → kullanıcı için oda kapandı, katıl ekranına at
        const hasHost = msg.players && msg.players.some(p => p.id === 1);
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
        miniData.goalTarget = msg.goal_target;
        miniData.matchDuration = msg.match_duration;
        miniData.gameSpeed = msg.game_speed || "normal";
        miniData.redTeamName = msg.red_team_name || "Kırmızı Takım";
        miniData.blueTeamName = msg.blue_team_name || "Mavi Takım";
        miniData.splitScreen = msg.split_screen || false;
        miniData.allowPlase = msg.allow_plase !== false;
        miniData.ballStick = msg.ball_stick !== false;
        miniData.sprintEnabled = msg.sprint_enabled !== false;
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
            HP.settings.kickoffTimeout = msg.kickoff_timeout || 10;
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
        return;
    }
    
    // ✨ Oyuncu oyundan çıkıp lobiye döndü (ESC menüsünden "Lobiye Dön" diyerek)
    if (msg.type === "mini_player_left_game") {
        showToast("🚪 Lobiye Döndü", `${msg.player_name} lobiye döndü.`, null, "info");
        return;
    }
    
    // ✨ Oyuncu lobiden oyuna geri döndü (Oyuna Katıl butonu)
    if (msg.type === "mini_player_rejoined") {
        showToast("⚽ Oyuna Katıldı", `${msg.player_name} oyuna katıldı!`, null, "success");
        return;
    }

    // ✨ Bir oyuncu tamamen odadan/sayfadan ayrıldı (Disconnect)
    if (msg.type === "mini_opponent_left") {
        const playerName = msg.player_name || "Bir oyuncu";
        showToast("👋 Odadan Ayrıldı", `${playerName} odadan ayrıldı.`, null, "warning");
        
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
    
    if (msg.type === "mini_game_started") {
        miniData.playerNames = msg.players;
        miniData.fieldConfig = msg.field;
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
            const p = miniData.players.find(pl => pl.id === pid);
            if (p) p.team = "red";
        });
        miniData.activeBluePids.forEach(pid => {
            const p = miniData.players.find(pl => pl.id === pid);
            if (p) p.team = "blue";
        });
        
        const overBox = document.getElementById("miniGameOverBox");
        if (overBox) overBox.classList.add("hidden");
        
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
        // ✨ HOST ise backend'den gelen state'i YOKSAY (backend fizik yapmıyor artık ama garanti)
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running && !msg._local) {
            return;
        }
        
        miniData.gameState = msg;
        
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
        
        // ✨ SNAPSHOT INTERPOLATION - Her state'i timestamp ile buffer'a at
        const now_ = performance.now();
        
        // İlk snapshot ise current pozisyonları ayarla (jump olmasın)
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
        
        // Snapshot'ı buffer'a ekle
        const snapshot = {
            t: now_,
            players: {},
            ball: null
        };
        if (msg.players) {
            for (const pid in msg.players) {
                snapshot.players[pid] = {
                    x: msg.players[pid].x,
                    y: msg.players[pid].y
                };
            }
        }
        if (msg.ball) {
            snapshot.ball = { x: msg.ball.x, y: msg.ball.y };
        }
        miniData.snapshots.push(snapshot);
        
        // Buffer'ı temizle (300ms'den eski olanları at, gereksiz hafıza şişmesin)
        const cutoff = now_ - 300;
        miniData.snapshots = miniData.snapshots.filter(s => s.t >= cutoff);
        
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
    
    // ✨ Takım isimleri
    const redNameEl = document.getElementById("miniRedTeamName");
    const blueNameEl = document.getElementById("miniBlueTeamName");
    if (redNameEl) redNameEl.textContent = miniData.redTeamName;
    if (blueNameEl) blueNameEl.textContent = miniData.blueTeamName;
    
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
    if (editRedBtn && editBlueBtn && resetNamesBtn) {
        if (miniData.playerId === 1) {
            editRedBtn.style.display = "inline-block";
            editBlueBtn.style.display = "inline-block";
            resetNamesBtn.style.display = "inline-block";
        } else {
            editRedBtn.style.display = "none";
            editBlueBtn.style.display = "none";
            resetNamesBtn.style.display = "none";
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
        if (teamKey === "red") row.classList.add("teamRed");
        else if (teamKey === "blue") row.classList.add("teamBlue");
        else row.classList.add("teamSpec");
        
        // ✨ Host için sürüklenebilir satır
        setupMiniDraggableRow(row, p, teamKey);
        
        // İsim (sola yaslı)
        const nameSpan = document.createElement("span");
        nameSpan.className = "miniPlayerName";
        nameSpan.style.flex = "1";
        nameSpan.style.textAlign = "left";
        let displayName = p.id === miniData.playerId ? `${p.name} (Sen)` : p.name;
        if (p.id === 1) displayName += " 👑";  // ✨ Host tacı
        if (p.in_lobby) displayName += " (lobide)";  // ✨ Lobide bekliyor
        nameSpan.textContent = displayName;
        row.appendChild(nameSpan);
        
        // ✨ Kendi ismine VEYA kendi split-slave (P2) ismine sağ tık → isim değiştir
        const isMyself = p.id === miniData.playerId;
        const isMyP2 = p.is_split_slave && miniData.splitSlaveId === p.id && miniData.splitOwner === miniData.playerId;
        
        if (isMyself || isMyP2) {
            row.style.cursor = "context-menu";
            row.title = "Sağ tık → ismi değiştir";
            row.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showNameEditor(p, isMyP2);
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

// ========================================
// 👤 İSİM DEĞİŞTİRME POPUP
// ========================================
function showNameEditor(playerObj, isP2) {
    // Eski popup varsa kaldır
    const existing = document.getElementById("miniNameEditor");
    if (existing) existing.remove();
    
    // P2 için "(P2)" ekini soyup göster (backend'e "(P2)" olmadan gidecek)
    let rawName = playerObj.name;
    if (isP2 && rawName.endsWith(" (P2)")) {
        rawName = rawName.substring(0, rawName.length - 5);
    }
    
    const teamColor = isP2 ? "#4dabf7" : "#51cf66";
    const teamGlow = isP2 ? "rgba(77,171,247,0.4)" : "rgba(81,207,102,0.4)";
    const teamEmoji = isP2 ? "🎮" : "👤";
    const teamLabel = isP2 ? "2. Oyuncunun (P2) İsmi" : "Kendi İsmin";
    
    const overlay = document.createElement("div");
    overlay.id = "miniNameEditor";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:460px; border:2px solid ${teamColor}; box-shadow: 0 0 40px ${teamGlow};">
            <div style="font-size:60px; margin:10px 0;">${teamEmoji}</div>
            <h2 style="color:${teamColor}; margin:10px 0 15px 0;">${teamLabel}</h2>
            <p style="color:#adb5bd; font-size:14px; margin:0 0 20px 0;">
                Yeni isim yaz (max 15 karakter)${isP2 ? '<br><span style="color:#4dabf7; font-size:12px;">💡 Sonuna otomatik "(P2)" eklenir</span>' : ''}
            </p>
            <input id="miniNameInput" type="text" 
                   value="${rawName.replace(/"/g, '&quot;')}" 
                   maxlength="15"
                   style="width:100%; padding:14px; font-size:18px; font-weight:bold;
                          border-radius:10px; border:2px solid ${teamColor}; 
                          background:#1a1e2e; color:#fff; text-align:center;
                          font-family:inherit; outline:none;">
            <p style="color:#adb5bd; font-size:12px; text-align:right; margin:8px 0 20px 0;">
                <span id="miniNameCount">0</span>/15 karakter
            </p>
            <div class="confirmButtons">
                <button id="miniNameSaveBtn" class="bigBtn greenBtn">💾 KAYDET</button>
                <button id="miniNameCancelBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const input = document.getElementById("miniNameInput");
    const counter = document.getElementById("miniNameCount");
    
    function updateCounter() {
        counter.textContent = input.value.length;
    }
    updateCounter();
    input.addEventListener("input", updateCounter);
    
    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
    
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            document.getElementById("miniNameSaveBtn").click();
        } else if (e.key === "Escape") {
            e.preventDefault();
            document.getElementById("miniNameCancelBtn").click();
        }
    });
    
    document.getElementById("miniNameSaveBtn").onclick = async () => {
        const newName = input.value.trim();
        if (!newName) {
            input.style.borderColor = "#ff3333";
            input.focus();
            return;
        }
        
        // 🔒 SELJUK KORUMASI
        if (isSeljukName(newName) && !isSeljukVerified()) {
            const ok = await showSeljukPasswordPopup();
            if (!ok) {
                // İptal → input'u temizle, popup açık kalsın
                input.value = "";
                input.focus();
                return;
            }
        }
        
        overlay.remove();
        
        // Backend'e gönder
        send({
            type: "mini_change_name",
            target_id: playerObj.id,
            name: newName,
            is_p2: isP2  // Backend "(P2)" ekleyecek mi
        });
    };
    
    document.getElementById("miniNameCancelBtn").onclick = () => {
        overlay.remove();
    };
}

function editTeamName(team) {
    const currentName = team === "red" ? miniData.redTeamName : miniData.blueTeamName;
    showMiniTeamNameEditor(team, currentName);
}

function showMiniTeamNameEditor(team, currentName) {
    // Eski popup varsa kaldır
    const existing = document.getElementById("miniTeamNameEditor");
    if (existing) existing.remove();
    
    const isRed = team === "red";
    const teamColor = isRed ? "#ff6b6b" : "#4dabf7";
    const teamGlow = isRed ? "rgba(255,107,107,0.4)" : "rgba(77,171,247,0.4)";
    const teamEmoji = isRed ? "🔴" : "🔵";
    const teamLabel = isRed ? "Kırmızı Takım" : "Mavi Takım";
    
    const overlay = document.createElement("div");
    overlay.id = "miniTeamNameEditor";
    overlay.className = "overlay";
    overlay.style.zIndex = "999999";  // ✨ Pause popup'ın üstüne
    overlay.style.pointerEvents = "auto";  // ✨ Tıklanabilir olsun
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:480px; border:2px solid ${teamColor}; box-shadow: 0 0 40px ${teamGlow};">
            <div style="font-size:60px; margin:10px 0;">${teamEmoji}</div>
            <h2 style="color:${teamColor}; margin:10px 0 15px 0;">${teamLabel} İsmi</h2>
            <p style="color:#adb5bd; font-size:14px; margin:0 0 20px 0;">
                Yeni takım ismini yaz (max 20 karakter)
            </p>
            <input id="miniTeamNameInput" type="text" 
                   value="${currentName.replace(/"/g, '&quot;')}" 
                   maxlength="20"
                   style="width:100%; padding:14px; font-size:18px; font-weight:bold;
                          border-radius:10px; border:2px solid ${teamColor}; 
                          background:#1a1e2e; color:#fff; text-align:center;
                          font-family:inherit; outline:none;">
            <p style="color:#adb5bd; font-size:12px; text-align:right; margin:8px 0 20px 0;">
                <span id="miniTeamNameCount">0</span>/20 karakter
            </p>
            <div class="confirmButtons">
                <button id="miniTeamNameSaveBtn" class="bigBtn greenBtn">💾 KAYDET</button>
                <button id="miniTeamNameCancelBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const input = document.getElementById("miniTeamNameInput");
    const counter = document.getElementById("miniTeamNameCount");
    
    // Karakter sayacı
    function updateCounter() {
        counter.textContent = input.value.length;
    }
    updateCounter();
    input.addEventListener("input", updateCounter);
    
    // Otomatik seç + focus
    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
    
    // Enter → kaydet
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            document.getElementById("miniTeamNameSaveBtn").click();
        } else if (e.key === "Escape") {
            e.preventDefault();
            document.getElementById("miniTeamNameCancelBtn").click();
        }
    });
    
    // Butonlar
    document.getElementById("miniTeamNameSaveBtn").onclick = () => {
        const newName = input.value.trim();
        if (!newName) {
            input.style.borderColor = "#ff3333";
            input.focus();
            return;
        }
        overlay.remove();
        // ✨ localStorage'a kaydet (sonraki odalarda hatırlansın)
        try {
            if (team === "red") localStorage.setItem("miniRedTeamName", newName);
            else if (team === "blue") localStorage.setItem("miniBlueTeamName", newName);
        } catch(e) {}
        send({ type: "mini_change_team_name", team: team, name: newName });
    };
    
    document.getElementById("miniTeamNameCancelBtn").onclick = () => {
        overlay.remove();
    };
}

function resetTeamNames() {
    // Eski popup varsa kaldır
    const existing = document.getElementById("miniResetNamesConfirm");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "miniResetNamesConfirm";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:450px; border:2px solid #adb5bd; box-shadow: 0 0 40px rgba(173,181,189,0.3);">
            <div style="font-size:60px; margin:10px 0;">🔄</div>
            <h2 style="color:#adb5bd; margin:10px 0 15px 0;">Takım İsimlerini Sıfırla</h2>
            <p style="color:#adb5bd; font-size:15px; margin:0 0 25px 0; line-height:1.5;">
                Takım isimleri <b style="color:#ff6b6b;">Kırmızı Takım</b> ve <b style="color:#4dabf7;">Mavi Takım</b> olarak sıfırlanacak.<br>
                <span style="font-size:13px;">Emin misin?</span>
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
                current: 35, min: 10, max: 80, step: 5, unit: "/100",
                desc: "Falso miktarı (yüksek = daha çok kavis)"
            },
            {
                id: "afterTouchTime",
                label: "⏱️ After-Touch Süresi",
                current: 200, min: 0, max: 1000, step: 50, unit: "ms",
                desc: "Şut sonrası kavis verme süresi (varsayılan: 200ms)"
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
            const goalTarget = parseInt(values.goalTarget) || 3;
            const matchDuration = parseInt(values.matchDuration) || 180;
            const gameSpeed = values.gameSpeed || "normal";
           const splitScreen = miniData.splitScreen === true;
            
            // ✨ Tüm ayarları localStorage'a kaydet (oda oluşturma ekranıyla senkron)
            try {
                localStorage.setItem("miniAllowPlase", allowPlase ? "on" : "off");
                localStorage.setItem("miniBallStick", ballStick ? "on" : "off");
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
                player_count: parseInt(values.playerCount) || 2,
                spectator_count: parseInt(values.spectatorCount) || 0,
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
    if (!miniData.playerId || HP.running) return true;
    if (!miniData.players || miniData.players.length === 0) return false;

    const isHost = miniData.playerId === 1;
    // ✨ Saha boyutlarını fieldConfig'ten al (backend'in gönderdiği)
    const fw = (miniData.fieldConfig && miniData.fieldConfig.width) || miniData.fieldWidth || 1000;
    const fh = (miniData.fieldConfig && miniData.fieldConfig.height) || miniData.fieldHeight || 500;
    const gw = (miniData.fieldConfig && miniData.fieldConfig.goal_width) || miniData.fieldGoalWidth || 180;
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
        advancedEnabled: false,
        advanced: null
    };

    const playerList = miniData.players.map(p => ({
        id: p.id,
        name: p.name,
        team: p.team,
        is_split_slave: p.is_split_slave || false
    }));

    HP.onStateUpdate = null;
    HP.onGoal = null;
    HP.onGameOver = null;

    if (isHost) {
        console.log("[HOST-PHYSICS] Host fizik motoru kuruluyor...");
        // ✨ Oyuncu sayısına göre broadcast frekansı
        // 1v1-2v2: 30 Hz (her 2 frame'de bir)
        // 3v3-4v4: 24 Hz (her 2-3 frame'de bir)
        // 5v5: 20 Hz (her 3 frame'de bir)
        const totalPlayers = miniData.players.length;
        let netSkip = 1;  // ✨ 1v1 için 60 Hz state gönder
        if (totalPlayers >= 8) netSkip = 3;      // 4v4+ → 20 Hz
        else if (totalPlayers >= 6) netSkip = 2; // 3v3 → 30 Hz
        else if (totalPlayers >= 4) netSkip = 2; // 2v2 → 30 Hz
        
        miniData._netFrameCounter = 0;
        miniData._netSkip = netSkip;
        console.log(`[HOST-PHYSICS] Network frekansı: ${Math.round(60/netSkip)} Hz (${totalPlayers} oyuncu)`);
        
        HP.onStateUpdate = (stateMsg) => {
            stateMsg._local = true;
            handleMiniMessage(stateMsg);

            // Network throttle
            miniData._netFrameCounter = (miniData._netFrameCounter || 0) + 1;
            if (miniData._netFrameCounter % (miniData._netSkip || 2) !== 0) return;

            const cleanState = Object.assign({}, stateMsg);
            delete cleanState._local;
            send({ type: "mini_host_state", state: cleanState });
        };

        HP.onGameOver = (winData) => {
            handleMiniMessage(winData);
            send({ type: "mini_host_state", state: winData });
        };
    } else {
        console.log("[GUEST-HP] Misafir local fizik motoru başlatıldı ✓");
    }

    HP.startGame(settings, playerList);
    return true;
}

// ========================================
// OYUN BAŞLATMA
// ========================================
function startMiniGame() {
    console.log("[MINI] Oyun başladı! Player ID:", miniData.playerId, "Split:", miniData.splitScreen);
    miniData.keysPressed = {};
    miniData.keysPressed2 = {};
    
    // ✨ HOST ise sekmeyi canlı tut
    if (miniData.playerId === 1) {
        if (!miniData._keepAliveAudio) {
            try {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (AudioCtx) {
                    const ctx = new AudioCtx();
                    const oscillator = ctx.createOscillator();
                    const gainNode = ctx.createGain();
                    gainNode.gain.value = 0.0001;
                    oscillator.connect(gainNode);
                    gainNode.connect(ctx.destination);
                    oscillator.frequency.value = 20;
                    oscillator.start();
                    miniData._keepAliveAudio = { ctx, oscillator };
                }
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
    
    // ✨ Gamepad bağlı VE etkinse polling başlat
    if (miniGamepad.connected && miniGamepad.enabled) {
        startGamepadPolling();
    }
    
    // ✨ Sağ tık → context menü açılmasın (oyun içi bug engeli)
    // Ama isim değiştirme sağ tık'ı ekranın DIŞINDA çalışsın (canvas üzerinde engelle)
    window.addEventListener("contextmenu", miniPreventContextMenu, true);
    
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
    
    // ✨ MİSAFİR ise prediction başlat (host için gerek yok)
    if (miniData.playerId !== 1) {
        miniData.predictionActive = true;
        miniData.predictedSelf = null;  // İlk state gelince set edilecek
        console.log("[PREDICTION] Misafir prediction aktif");
    } else {
        miniData.predictionActive = false;
    }
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
                    🎮 <b>Kontrolcü:</b> Sol Stick / D-Pad hareket &nbsp;|&nbsp; X / Kare şut &nbsp;|&nbsp; R2 sprint
                </div>
                <div style="color:#adb5bd; margin-top:4px; font-size:12px;">
                    ⌨️ (Klavye de aktif: ${kMove} hareket | ${kKick} şut | ${kSprint} sprint)
                </div>
            `;
        } else {
            controlsEl.innerHTML = `<b>Hareket:</b> ${kMove} / Ok Tuşları &nbsp;|&nbsp; <b>Şut:</b> ${kKick} / Num 0 &nbsp;|&nbsp; <b>Sprint:</b> ${kSprint} ⚡`;
        }
        return;
    }
    
    // === SPLIT-SCREEN (P1 + P2) ===
    let p1Line = "";
    let p2Line = "";
    
    if (gpP1) {
        p1Line = `🎮 <b>P1 (Kontrolcü):</b> Sol Stick / D-Pad hareket | X / Kare şut | R2 sprint`;
    } else {
        p1Line = `⌨️ <b>P1 (Klavye):</b> ${kMove} hareket | ${kKick} şut | ${kSprint} sprint`;
    }
    
    if (gpP2) {
        p2Line = `🎮 <b>P2 (Kontrolcü):</b> Sol Stick / D-Pad hareket | X / Kare şut | R2 sprint`;
    } else {
        p2Line = `⌨️ <b>P2 (Klavye):</b> Ok Tuşları hareket | Num 0 / Sağ Ctrl şut | Sağ Shift / Num 1 sprint`;
    }
    
    controlsEl.innerHTML = `
        <div style="color:#ff6b6b;">${p1Line}</div>
        <div style="color:#4dabf7; margin-top:4px;">${p2Line}</div>
    `;
}

// ✨ Oyun içinde sağ tık context menüsünü engelle (bug önlemi)
function miniPreventContextMenu(e) {
    // Sadece oyun ekranındaysa engelle
    const gameScreen = document.getElementById("miniGameScreen");
    if (gameScreen && !gameScreen.classList.contains("hidden")) {
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
            miniData._keepAliveAudio.oscillator.stop();
            miniData._keepAliveAudio.ctx.close();
        } catch(e) {}
        miniData._keepAliveAudio = null;
    }
    
    // ✨ Gamepad polling'i durdur
    stopGamepadPolling();
    
    // ✨ Titreşimi durdur
    if (typeof MiniVibration !== "undefined") {
        MiniVibration.stop();
    }
    
    // ✨ Prediction'ı sıfırla
    miniData.predictionActive = false;
    miniData.predictedSelf = null;
    miniData.predictedKeys = {up:false, down:false, left:false, right:false, sprint:false};
    
    // ✨ Render smoothing state'ini temizle
    miniData._renderSmoothed = {};
    miniData._ballRenderPos = null;
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
    
    const result = getMiniKey(e);
    if (!result) return;
    
    e.preventDefault();
    e.stopPropagation();  // ✨ Diğer handler'lara gitmesin (sprint+space çakışması)
    
    const { key, forPlayer } = result;
    
    // Hangi tuş listesi kullanılacak?
    const keyList = (forPlayer === 2) ? miniData.keysPressed2 : miniData.keysPressed;
    
    // ✨ Zaten basılıysa tekrar gönderme - AMA KICK için istisna
    // (kick tuşuna basılı tutunca kesintiye uğramasın)
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
    
    // Backend'e gönder
    const msg = { type: "mini_key", key: key, pressed: true };
    if (forPlayer === 2 && miniData.splitSlaveId) {
        msg.for_player_id = miniData.splitSlaveId;
    }
    send(msg);
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
    send(msg);
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
    
    // (Sürekli top reconciliation kaldırıldı - artık interpolation buffer kullanılıyor)
    
    const ctx = canvas.getContext("2d");
    const cfg = miniData.fieldConfig;
    if (!cfg) {
        miniAnimFrame = requestAnimationFrame(miniRender);
        return;
    }
    
    // ✨ Canvas boyutu - sahadan biraz geniş (oyuncu tam sığsın)
    const OUT_MARGIN = 55;  // Oyuncu çıkışı (30px) + oyuncu yarıçapı (20) + biraz margin (5)
    canvas.width = cfg.width + OUT_MARGIN * 2;
    canvas.height = cfg.height + OUT_MARGIN * 2;
    
    // ✨ Koordinat sistemini kaydır (saha 100 px içeriden başlasın)
    ctx.save();
    ctx.translate(OUT_MARGIN, OUT_MARGIN);
    
    // === DIŞ ALAN (Saha dışı, koyu yeşil) ===
    ctx.fillStyle = "#1e5828";  // Koyu yeşil
    ctx.fillRect(-OUT_MARGIN, -OUT_MARGIN, cfg.width + OUT_MARGIN * 2, cfg.height + OUT_MARGIN * 2);
    
    // === SAHA (İç alan) ===
    ctx.fillStyle = "#2f7d3f";
    ctx.fillRect(0, 0, cfg.width, cfg.height);
    
    // Çizgili desen (alternatif yeşil şeritler)
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
    
    // Orta yuvarlak (santra aktifse kırmızı)
    const kickoffActive = miniData.gameState && miniData.gameState.kickoff && miniData.gameState.kickoff.active;
    if (kickoffActive) {
        // Kısıtlı bölge - kırmızı
        ctx.strokeStyle = "rgba(255, 107, 107, 0.7)";
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
    }
    ctx.beginPath();
    ctx.arc(cfg.width / 2, cfg.height / 2, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);  // reset
    
    // Orta çizgi (santra aktifse kısıtlı tarafın yarısı kırmızı)
    if (kickoffActive && miniData.gameState && miniData.gameState.kickoff) {
        const restrictedTeam = miniData.gameState.kickoff.restricted_team;
        ctx.strokeStyle = "rgba(255, 107, 107, 0.6)";
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        if (restrictedTeam === 1) {
            // Kırmızı kısıtlı → sol yarıda kırmızı çizgi
            ctx.moveTo(cfg.width / 2, 0);
            ctx.lineTo(cfg.width / 2, cfg.height);
        } else {
            // Mavi kısıtlı → sağ yarıda kırmızı çizgi  
            ctx.moveTo(cfg.width / 2, 0);
            ctx.lineTo(cfg.width / 2, cfg.height);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        
        // ✨ Kısıtlı tarafın yarısını hafif kırmızı overlay ile boya
        ctx.fillStyle = "rgba(255, 80, 80, 0.08)";
        if (restrictedTeam === 1) {
            // Kırmızı kısıtlı → sol yarıyı kırmızıya boya
            ctx.fillRect(0, 0, cfg.width / 2, cfg.height);
        } else {
            // Mavi kısıtlı → sağ yarıyı kırmızıya boya
            ctx.fillRect(cfg.width / 2, 0, cfg.width / 2, cfg.height);
        }
    }
    
    // ✨ KALELER - Haxball tarzı (2 küçük daire + kavisli çizgi)
    const goalY = (cfg.height - cfg.goal_width) / 2;
    const postRadius = 6;      // Direk daire yarıçapı
    const goalCurve = 60;      // ✨ Kavis derinliği (40 → 60, file arkaya daha uzun)
    
    // === SOL KALE (Kırmızı) ===
    const leftGoalX = 0;
    
    // Üst direk (küçük pembe daire)
    ctx.fillStyle = "#ffcccc";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(leftGoalX, goalY, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Alt direk
    ctx.beginPath();
    ctx.arc(leftGoalX, goalY + cfg.goal_width, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Kavisli file çizgisi (siyah, kalın)
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftGoalX, goalY);
    // Bezier curve - sola doğru kavis
    ctx.bezierCurveTo(
        leftGoalX - goalCurve, goalY + 15,
        leftGoalX - goalCurve, goalY + cfg.goal_width - 15,
        leftGoalX, goalY + cfg.goal_width
    );
    ctx.stroke();
    
    // === SAĞ KALE (Mavi) ===
    const rightGoalX = cfg.width;
    
    // Üst direk (küçük mavi/lila daire)
    ctx.fillStyle = "#ccddff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rightGoalX, goalY, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Alt direk
    ctx.beginPath();
    ctx.arc(rightGoalX, goalY + cfg.goal_width, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Kavisli file çizgisi
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
        // ✨ SNAPSHOT INTERPOLATION - Server jitter'ı yok eder
        // Render zamanı: şu an - 100ms (gecikmeli render, paketler arası yumuşak)
        const renderTime = performance.now() - miniData.interpDelay;
        const snaps = miniData.snapshots;
        
        if (snaps.length >= 2) {
            // renderTime'ı içeren iki snapshot bul (before ve after)
            let before = null;
            let after = null;
            for (let i = 0; i < snaps.length - 1; i++) {
                if (snaps[i].t <= renderTime && snaps[i + 1].t >= renderTime) {
                    before = snaps[i];
                    after = snaps[i + 1];
                    break;
                }
            }
            
            if (before && after) {
                // İki snapshot arasında lineer interpolation
                const span = after.t - before.t;
                const alpha = span > 0 ? (renderTime - before.t) / span : 0;
                
                // Oyuncular
                for (const pid in after.players) {
                    if (before.players[pid]) {
                        const bx = before.players[pid].x;
                        const by = before.players[pid].y;
                        const ax = after.players[pid].x;
                        const ay = after.players[pid].y;
                        miniData.currentPositions["p" + pid] = {
                            x: bx + (ax - bx) * alpha,
                            y: by + (ay - by) * alpha
                        };
                    } else {
                        // Yeni oyuncu - direkt son pozisyonu kullan
                        miniData.currentPositions["p" + pid] = {
                            x: after.players[pid].x,
                            y: after.players[pid].y
                        };
                    }
                }
                
                // Top
                if (before.ball && after.ball) {
                    miniData.currentPositions.ball = {
                        x: before.ball.x + (after.ball.x - before.ball.x) * alpha,
                        y: before.ball.y + (after.ball.y - before.ball.y) * alpha
                    };
                }
            } else if (snaps.length > 0) {
                // renderTime buffer aralığı dışında (çok yeni veya çok eski)
                // Son snapshot'ı kullan (extrapolation olmasın, dursun)
                const last = snaps[snaps.length - 1];
                for (const pid in last.players) {
                    miniData.currentPositions["p" + pid] = {
                        x: last.players[pid].x,
                        y: last.players[pid].y
                    };
                }
                if (last.ball) {
                    miniData.currentPositions.ball = { x: last.ball.x, y: last.ball.y };
                }
            }
        }
        
        // ✨ Şut efekti - hangi oyuncular şut çekti + hangi enerjiyle
        const kickedPlayers = {};  // {playerId: energyPercent}
        if (state.kick_effects && state.kick_effects.length > 0) {
            // ✨ HP fizik motoru performance.now() kullanıyor, biz de aynısını kullanmalıyız
            const now = performance.now() / 1000;
            state.kick_effects.forEach(k => {
                if (now - k.time < 0.3) {
                    kickedPlayers[k.player_id] = k.energy_at_kick || 1.0;
                }
            });
        }
        const kickedPlayerIds = new Set(Object.keys(kickedPlayers).map(k => parseInt(k)));

        // 🔊 ŞUT SESİ (her yeni şut için bir kez çal - SADECE TOPA DEĞDIYSE)
        if (kickedPlayerIds.size > 0) {
            if (!miniData._lastKickFrame) miniData._lastKickFrame = new Set();

            // hit_ball bilgisini kick_effects'ten al
            const hitMap = {};
            const sprintMap = {};
            if (state.kick_effects) {
                state.kick_effects.forEach(k => {
                    if (k.hit_ball) hitMap[k.player_id] = true;
                    // Sprint şut mu? (energy_at_kick > 0 ise sprint aktifti demek değil, 
                    // ama şut anında topun on_fire olması sprint göstergesi)
                    if (k.energy_at_kick !== undefined) sprintMap[k.player_id] = k.energy_at_kick;
                });
            }

            kickedPlayerIds.forEach(pid => {
                // Bu frame'de zaten ses çaldıysak tekrar çalma
                if (miniData._lastKickFrame.has(pid)) return;
                
                // ✨ Sadece topa DEĞDİYSE ses çal (boşa şutta ses yok)
                if (!hitMap[pid]) return;
                
                miniData._lastKickFrame.add(pid);

                // Alevli mi normal mi?
                const isFireKick = state.ball && state.ball.on_fire === true;
                if (isFireKick) {
                    MiniAudio.playRandom("fire_kick",
                        ["fire_kick_1.wav", "fire_kick_2.wav", "fire_kick_3.wav"], 0.7);
                } else {
                    MiniAudio.playRandom("kick",
                        ["kick_1.wav", "kick_2.wav"], 0.5);
                }
                
                // ✨ TİTREŞİM - sadece benim şutumsa
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
        // ✨ Eski kick_effects'lerin id'lerini _lastKickFrame'den de sil
        // (yoksa aynı şut için tekrar tekrar ses çalar)
        if (miniData._lastKickFrame) {
            const activeIds = new Set();
            if (state.kick_effects) {
                const now = performance.now() / 1000;
                state.kick_effects.forEach(k => {
                    if (now - k.time < 0.3) activeIds.add(k.player_id);
                });
            }
            // Aktif olmayan pid'leri sil
            for (const pid of miniData._lastKickFrame) {
                if (!activeIds.has(pid)) miniData._lastKickFrame.delete(pid);
            }
        }

        // 🔊 DUVAR + DİREK SESLERİ + TİTREŞİM
        if (state.hit_events && state.hit_events.length > 0) {
            if (!miniData._playedHits) miniData._playedHits = new Set();
            const nowHit = performance.now() / 1000;

            state.hit_events.forEach(h => {
                // Her event'e benzersiz key ver (time'ı hash gibi kullan)
                const key = `${h.type}_${h.time}`;
                if (miniData._playedHits.has(key)) return;
                if (nowHit - h.time > 0.3) return;  // Eski event'leri atla

                miniData._playedHits.add(key);

                if (h.type === "wall") {
                    MiniAudio.playRandom("wall",
                        ["wall_hit_1.wav", "wall_hit_2.wav"], 0.4);
                    // ✨ Titreşim - sadece benim son dokunduğum toptaysa
                    if (state.ball && state.ball.last_toucher === miniData.playerId) {
                        MiniVibration.wallHit();
                    }
                } else if (h.type === "post") {
                    MiniAudio.play("post_hit.wav", 0.6);
                    // ✨ Direk her zaman titretsin (kim çarpmış olursa olsun heyecanlı)
                    MiniVibration.postHit();
                }
            });

            // Set'i çok büyümesin diye ara sıra temizle (100 elemandan fazla olunca)
            if (miniData._playedHits.size > 100) {
                miniData._playedHits.clear();
            }
        }
        
        // ✨ PREDICTION - misafirse kendi karakterimi tahmin edip güncelle
        if (miniData.predictionActive) {
            updateMiniPrediction();
        }
        
        // Oyuncular
        for (const pid in state.players) {
            // ✨ Interpolated pozisyonu kullan (fallback)
            const pidInt = parseInt(pid, 10);
            let smoothPos = miniData.currentPositions["p" + pid] || state.players[pid];
            
            if (miniData.playerId === 1) {
                // ✨ HOST: herkesi local HP'den çiz
                if (typeof HP !== 'undefined' && HP.running &&
                    HP.room && HP.room.gameState && HP.room.gameState.players &&
                    HP.room.gameState.players[pid]) {
                    const hpPlayer = HP.room.gameState.players[pid];
                    smoothPos = { x: hpPlayer.x, y: hpPlayer.y };
                }
            } else if (pidInt === miniData.playerId) {
                // ✨ MİSAFİR: sadece KENDİ oyuncusunu prediction/local HP'den çiz
                if (miniData.predictedSelf) {
                    smoothPos = {
                        x: miniData.predictedSelf.x,
                        y: miniData.predictedSelf.y
                    };
                } else if (typeof HP !== 'undefined' && HP.running &&
                           HP.room && HP.room.gameState && HP.room.gameState.players &&
                           HP.room.gameState.players[pid]) {
                    const hpPlayer = HP.room.gameState.players[pid];
                    smoothPos = { x: hpPlayer.x, y: hpPlayer.y };
                }
            }
            
            const p = { x: smoothPos.x, y: smoothPos.y };
            
            const isMe = pidInt === miniData.playerId;
            
            // ✨ Takıma göre renk (ID'ye göre değil!)
            // Önce miniData.players'dan bak, yoksa aktif oyuncu ID'sine bak
            let playerTeam = null;
            const playerInfo = miniData.players.find(pl => pl.id === parseInt(pid));
            if (playerInfo) {
                playerTeam = playerInfo.team;
            } else {
                // Fallback: aktif oyuncu ID'sinden çıkar
                if (parseInt(pid) === (miniData.gameState?.red_pid)) playerTeam = "red";
                else if (parseInt(pid) === (miniData.gameState?.blue_pid)) playerTeam = "blue";
            }
            
            const color = playerTeam === "blue" ? "#4dabf7" : "#ff6b6b";
            const justKicked = kickedPlayerIds.has(parseInt(pid));
            
            // Gölge
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.beginPath();
            ctx.arc(p.x + 3, p.y + 3, cfg.player_radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Oyuncu
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, cfg.player_radius, 0, Math.PI * 2);
            ctx.fill();
            
            // (Ay-yıldız aşağıda şut parlamasından SONRA çizilecek)
            
            // ✨ Sprint enerji bilgisi
            // ✨ HOST + kendi karakterim ise HP'den direkt oku
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
            
            // ✨ İÇ KENAR = ENERJI HALKASI (sarı dolu, koyu boş)
            const lineW = isMe ? 3 : 2;
            
            // 1) BOŞ kısım (siyah/koyu)
            ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
            ctx.lineWidth = lineW;
            ctx.beginPath();
            ctx.arc(p.x, p.y, cfg.player_radius, 0, Math.PI * 2);
            ctx.stroke();
            
            // 2) DOLU kısım (sarı enerji - saat yönü tersine)
            // ✨ %1'den az ise hiç çizme (0'da tam boş kalsın)
            if (energyPercent > 0.01) {
                ctx.strokeStyle = "#ffd43b";
                ctx.lineWidth = lineW;
                ctx.lineCap = "round";
                
                // Sprint aktifse glow
                if (sprintActive) {
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = "#ffd43b";
                }
                
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle - (Math.PI * 2 * energyPercent);
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, cfg.player_radius, startAngle, endAngle, true);
                ctx.stroke();
                
                ctx.shadowBlur = 0;
                ctx.lineCap = "butt";
            }
            
            // 3) ✨ ŞUT PARLAMASI - Enerji kadar parlar
            if (justKicked) {
                const kickEnergyPercent = kickedPlayers[parseInt(pid)] || 1.0;
                // Parlama kalınlığı ve blur - enerji oranında
                const glowStrength = Math.max(0.15, kickEnergyPercent);
                
                // ✨ Takım rengi (kırmızı/mavi)
                const teamColor = playerTeam === "blue" ? "#4dabf7" : "#ff6b6b";
                const teamColorRGB = playerTeam === "blue" ? "77, 171, 247" : "255, 107, 107";
                
                // 🔥 İç parlama (ortadan dışa doğru takım renginde gradient)
                // ✨ Kırmızı/mavi parlama sadece %5 opacity (çok hafif)
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
                
                // ⚡ Dış sarı halka (mevcut - dokunulmadı)
                ctx.shadowBlur = 30 * glowStrength;
                ctx.shadowColor = "#ffd43b";
                ctx.strokeStyle = `rgba(255, 212, 59, ${glowStrength})`;
                ctx.lineWidth = 4 + (2 * glowStrength);
                ctx.beginPath();
                ctx.arc(p.x, p.y, cfg.player_radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
            
            // 🇹🇷 AY-YILDIZ (en son çizilir ki üstüne başka şey gelmesin)
            const pname_check = miniData.playerNames[pid] || "";
            if (pname_check === "Seljuk" || pname_check === "seljuk") {
                // Şut çekince ay-yıldız %100 parlasın (enerjiden bağımsız)
                const kickGlow = justKicked ? 1.0 : 0;
                drawTurkishStar(ctx, p.x, p.y, cfg.player_radius, kickGlow);
            }
            
            // İsim (üstte) - takım rengi
            let pname = miniData.playerNames[pid] || `P${pid}`;
            const nameColor = playerTeam === "blue" ? "#7abfff" : "#ff8a8a";
            // ✨ Font boyutu saha büyüklüğüne göre ölçekle (1v1=14px, 5v5=22px)
            let nameFontSize = 14;
            if (cfg.width >= 1800) nameFontSize = 22;       // 5v5
            else if (cfg.width >= 1600) nameFontSize = 20;  // 4v4
            else if (cfg.width >= 1400) nameFontSize = 18;  // 3v3
            else if (cfg.width >= 1200) nameFontSize = 16;  // 2v2
            
            // ✨ İsim genişliği oyuncu çapına sığmıyorsa font küçült
            const maxNameWidth = cfg.player_radius * 2.4;  // top çapından biraz büyük olabilir
            ctx.font = `bold ${nameFontSize}px Segoe UI`;
            let measuredW = ctx.measureText(pname).width;
            // Kademeli küçült (min 8px)
            while (measuredW > maxNameWidth && nameFontSize > 8) {
                nameFontSize -= 1;
                ctx.font = `bold ${nameFontSize}px Segoe UI`;
                measuredW = ctx.measureText(pname).width;
            }
            
            ctx.textAlign = "center";
            
            // Gölge (okunabilir olsun)
            ctx.shadowBlur = 5;
            ctx.shadowColor = "#000";
            ctx.fillStyle = nameColor;
            ctx.fillText(pname, p.x, p.y - cfg.player_radius - nameFontSize * 0.6);
            ctx.shadowBlur = 0;
        }
        
        // Top - HERKES için HP'den direkt (host + misafir aynı)
        // HP motoru her tarayıcıda 60 FPS fizik hesaplıyor, server sadece reconcile ediyor
        let bSmooth;
        if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running &&
            HP.room && HP.room.gameState && HP.room.gameState.ball) {
            // ✨ SADECE HOST: topu local HP'den çiz
            bSmooth = HP.room.gameState.ball;
        } else {
            // ✨ MİSAFİR: topu her zaman interpolation buffer'dan çiz
            bSmooth = miniData.currentPositions.ball || state.ball;
        }
        const b = {
            x: bSmooth.x,
            y: bSmooth.y,
            on_fire: state.ball.on_fire,
            warning: state.ball.warning
        };
        const onFire = b.on_fire === true;
        const warning = b.warning === true;
        
        // ✨ SANTRA UYARISI - Top hangi takıma gidecekse o renkte yanıp söner
        if (warning) {
            const blink = Math.floor(Date.now() / 200) % 2 === 0;
            if (blink) {
                const warningTeam = state.ball.warning_team;
                let warningColor, warningColorLight;
                if (warningTeam === 2) {
                    // Top maviye gidecek → mavi yanıp sönsün
                    warningColor = "#4dabf7";
                    warningColorLight = "rgba(77, 171, 247, 0.5)";
                } else {
                    // Top kırmızıya gidecek → kırmızı yanıp sönsün
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
        
        // ✨ ALEV EFEKTİ (şut çeken oyuncunun rengiyle)
        if (onFire) {
            const lastToucher = state.ball.last_toucher;
            // ✨ Takıma göre alev rengi (ID'ye göre değil!)
            let toucherTeam = null;
            if (lastToucher) {
                const toucherInfo = miniData.players.find(pl => pl.id === lastToucher);
                if (toucherInfo) toucherTeam = toucherInfo.team;
            }
            let flameR, flameG, flameB, glowColor;
            if (toucherTeam === "blue") {
                // Mavi alev
                flameR = 77; flameG = 171; flameB = 247;
                glowColor = "#4dabf7";
            } else {
                // Kırmızı alev (default)
                flameR = 255; flameG = 107; flameB = 0;
                glowColor = "#ff6b00";
            }
            
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
        
        // Gölge
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.beginPath();
        ctx.arc(b.x + 2, b.y + 2, cfg.ball_radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Top (alev varsa oyuncu rengiyle, uyarı varsa kırmızı, yoksa beyaz)
        if (onFire) {
            const lastToucher = state.ball.last_toucher;
            // ✨ Takıma göre
            let toucherTeam2 = null;
            if (lastToucher) {
                const toucherInfo2 = miniData.players.find(pl => pl.id === lastToucher);
                if (toucherInfo2) toucherTeam2 = toucherInfo2.team;
            }
            const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, cfg.ball_radius);
            if (toucherTeam2 === "blue") {
                // Mavi alev
                grad.addColorStop(0, "#fff");
                grad.addColorStop(0.6, "#a5d8ff");
                grad.addColorStop(1, "#1971c2");
            } else {
                // Kırmızı alev (default)
                grad.addColorStop(0, "#fff");
                grad.addColorStop(0.6, "#ffd43b");
                grad.addColorStop(1, "#ff6b00");
            }
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
        
        // Top deseni (siyah beşgen simülasyonu)
        if (!onFire) {
            ctx.fillStyle = "#333";
            ctx.beginPath();
            ctx.arc(b.x, b.y, cfg.ball_radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Top kenarı
        let ballBorderColor = "#000";
        if (onFire) {
            const lastToucher = state.ball.last_toucher;
            // ✨ Takıma göre
            let toucherTeam3 = null;
            if (lastToucher) {
                const toucherInfo3 = miniData.players.find(pl => pl.id === lastToucher);
                if (toucherInfo3) toucherTeam3 = toucherInfo3.team;
            }
            ballBorderColor = toucherTeam3 === "blue" ? "#1971c2" : "#ff3300";
        }
        ctx.strokeStyle = ballBorderColor;
        ctx.lineWidth = onFire ? 3 : 2;
        ctx.beginPath();
        ctx.arc(b.x, b.y, cfg.ball_radius, 0, Math.PI * 2);
        ctx.stroke();
    }
    
    // ✨ COUNTDOWN veya GOL KUTLAMASI overlay (server state'inden)
    if (state) {
        if (state.game_state === "countdown" && state.countdown !== null && state.countdown !== undefined) {
            drawCountdownOverlay(ctx, cfg, state.countdown);
        } else if (state.game_state === "goal_wait" && state.goal_celebration) {
            drawGoalCelebration(ctx, cfg, state.goal_celebration);
        } else {
            // Gol bitince imzayı sıfırla (bir sonraki golde tekrar ses çalsın)
            miniData._lastGoalSignature = null;
        }
        if (state.kickoff && state.kickoff.active) {
            drawKickoffInfo(ctx, cfg, state.kickoff);
        }
    }
    
    // ✨ Kaydırılmış koordinat sistemini geri yükle
    ctx.restore();
    
    // HUD güncelle
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
        MiniAudio.play("whistle.wav", 0.6);
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
    
    // ✨ DEBUG
    console.log("[GOL DEBUG]",
        "scorer_pid:", celebration.scorer_pid,
        "scorer_id:", celebration.scorer_id,
        "silent:", celebration.silent,
        "scores:", miniData.gameState?.scores,
        "last_sig:", miniData._lastGoalSignature
    );
	
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
            ["goal_1.wav", "goal_2.wav", "goal_3.wav"], 0.7);
        miniData._lastGoalSignature = goalSignature;
        
        // ✨ TİTREŞİM - Ben mi attım, yedim mi?
        // Benim takımım scorer takımıyla aynı mı?
        const myPlayer = miniData.players.find(p => p.id === miniData.playerId);
        const myTeam = myPlayer ? myPlayer.team : null;
        const scorerTeamId = celebration.scorer_id;  // 1 = kırmızı, 2 = mavi
        const scorerTeam = scorerTeamId === 1 ? "red" : "blue";
        const isOwnGoal = celebration.own_goal === true;
        
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

    // Hafif arkaplan
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(0, 0, cfg.width, cfg.height);
    
    // ✨ Önce gerçek oyuncu ID'sine bak, yoksa takım ID'sine
    const scorerPid = celebration.scorer_pid || celebration.scorer_id;
    const scorerTeamId = celebration.scorer_id;  // 1 veya 2 (renk için)
    
    // İsmi gerçek oyuncudan al (miniData.players'dan)
    let scorerName = "Oyuncu";
    const scorerPlayer = miniData.players.find(p => p.id === scorerPid);
    if (scorerPlayer) {
        scorerName = scorerPlayer.name;
    } else if (miniData.playerNames[scorerPid]) {
        scorerName = miniData.playerNames[scorerPid];
    }
    
    const isOwnGoal = celebration.own_goal === true;
    const assistId = celebration.assist_id;
    // Asist ismini de gerçek oyuncudan al
    let assistName = null;
    if (assistId) {
        const assistPlayer = miniData.players.find(p => p.id === assistId);
        assistName = assistPlayer ? assistPlayer.name : miniData.playerNames[assistId];
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
    
    if (isOwnGoal) {
        // Kendi kalesine → hepsi KIRMIZI (uyarı rengi)
        ctx.shadowColor = "#ff3333";
        ctx.fillStyle = "#ff6b6b";
    } else {
        // ✨ Gol atan takımın rengine göre
        if (scorerTeamId === 1) {
            // Kırmızı takım gol attı
            ctx.shadowColor = "#ff6b6b";
            ctx.fillStyle = "#ff6b6b";
        } else if (scorerTeamId === 2) {
            // Mavi takım gol attı
            ctx.shadowColor = "#4dabf7";
            ctx.fillStyle = "#4dabf7";
        } else {
            // Fallback → sarı
            ctx.shadowColor = "#ffd43b";
            ctx.fillStyle = "#ffd43b";
        }
    }
    ctx.fillText("⚽ GOOOL!", 0, goolY);
    
    // Kenarlık
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.strokeText("⚽ GOOOL!", 0, goolY);
    
    // ============ ALT BİLGİ ============
    if (isOwnGoal) {
        // "SELÇUK Kendi Kalesine Attı" (hepsi kırmızı)
        ctx.font = `bold ${Math.round(28 * fontScale)}px Segoe UI`;
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#ff3333";
        ctx.fillStyle = "#ff6b6b";
        ctx.fillText(`${scorerName} Kendi Kalesine Attı`, 0, 20);
    } else {
        // "Golü Atan: SELÇUK" (isim kırmızı/mavi)
        // "Asist: MEHMET" (sarı, varsa)
        
        const scorerTeamColor = scorerTeamId === 1 ? "#ff6b6b" : "#4dabf7";
        
        // Golü Atan satırı
        ctx.font = `bold ${Math.round(26 * fontScale)}px Segoe UI`;
        ctx.shadowBlur = 0;
        ctx.textAlign = "center";
        
        // "Golü Atan: " kısmı (beyaz)
        const label1 = "Golü Atan: ";
        const label1W = ctx.measureText(label1).width;
        const nameW = ctx.measureText(scorerName).width;
        const totalW = label1W + nameW;
        
        ctx.textAlign = "left";
        ctx.fillStyle = "#fff";
        ctx.fillText(label1, -totalW / 2, 15);
        
        // İsim (renkli, gölgeli)
        ctx.shadowBlur = 15;
        ctx.shadowColor = scorerTeamColor;
        ctx.fillStyle = scorerTeamColor;
        ctx.fillText(scorerName, -totalW / 2 + label1W, 15);
        
        // Asist satırı (varsa)
        if (assistName) {
            ctx.font = `bold ${Math.round(22 * fontScale)}px Segoe UI`;
            ctx.shadowBlur = 0;
            
            const label2 = "Asist: ";
            const label2W = ctx.measureText(label2).width;
            const assistW = ctx.measureText(assistName).width;
            const totalW2 = label2W + assistW;
            
            ctx.textAlign = "left";
            ctx.fillStyle = "#fff";
            ctx.fillText(label2, -totalW2 / 2, 55);
            
            // Asist ismi (sarı, gölgeli)
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#ffd43b";
            ctx.fillStyle = "#ffd43b";
            ctx.fillText(assistName, -totalW2 / 2 + label2W, 55);
        }
    }
    
    ctx.restore();
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
    
    const s1 = state.scores["1"] || 0;
    const s2 = state.scores["2"] || 0;
    
    // ✨ Takıma göre isim al (ID'ye göre değil)
    const redPlayer = miniData.players.find(p => p.team === "red");
    const bluePlayer = miniData.players.find(p => p.team === "blue");
    const n1 = redPlayer ? redPlayer.name : (miniData.redTeamName || "Kırmızı");
    const n2 = bluePlayer ? bluePlayer.name : (miniData.blueTeamName || "Mavi");
    
    if (scoreEl) {
        scoreEl.innerHTML = `
            <span style="color:#ff6b6b;">${n1}</span>
            <span style="margin: 0 15px; font-size:32px; color:#ffd43b;">${s1} - ${s2}</span>
            <span style="color:#4dabf7;">${n2}</span>
        `;
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
    const scoreLine = document.getElementById("miniGameOverScoreLine");
    if (scoreLine) {
        scoreLine.innerHTML = `
            <span style="color:#ff6b6b;">${miniData.redTeamName || "Kırmızı"}</span>
            <span style="margin:0 18px; color:#ffd43b;">${s1} - ${s2}</span>
            <span style="color:#4dabf7;">${miniData.blueTeamName || "Mavi"}</span>
        `;
    }
    
    // === SCOREBOARD ===
    // Takım başlıkları
    const redTitle = document.getElementById("miniGameOverRedTitle");
    const blueTitle = document.getElementById("miniGameOverBlueTitle");
    if (redTitle) redTitle.textContent = `🔴 ${miniData.redTeamName || "Kırmızı Takım"}`;
    if (blueTitle) blueTitle.textContent = `🔵 ${miniData.blueTeamName || "Mavi Takım"}`;
    
    // Oyuncuları takımlara ayır
    const redTeam = miniData.players.filter(p => p.team === "red");
    const blueTeam = miniData.players.filter(p => p.team === "blue");
    const spectators = miniData.players.filter(p => p.team !== "red" && p.team !== "blue");
    
    // Stats al (son state'ten)
    const stats = (miniData.gameState && miniData.gameState.stats) || {};
    
    // Takım listesi render
    function renderTeamList(containerId, players, nameColor) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = "";
        
        if (players.length === 0) {
            container.innerHTML = `<div class="miniGameOverSpecEmpty">Boş</div>`;
            return;
        }
        
        // Header (uzun isimler)
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
            row.className = "miniGameOverRow";
            row.style.animationDelay = (0.7 + i * 0.1) + "s";
            row.innerHTML = `
                <span class="miniGameOverName" style="color:${nameColor};${isMe?'font-weight:800;':''}">${p.name}${crown}${meMark}</span>
                <span class="miniGameOverStat">${st.goals}</span>
                <span class="miniGameOverStat">${st.assists}</span>
                <span class="miniGameOverStat">${st.passes}</span>
                <span class="miniGameOverStat">${st.saves || 0}</span>
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
    
    renderTeamList("miniGameOverRedList", redTeam, "#ff8a8a");
    renderTeamList("miniGameOverBlueList", blueTeam, "#7abfff");
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
// OYUN SONU OTOMATİK GERİ SAYIM (30 sn)
// ========================================
let miniGameOverCountdownInterval = null;

function startMiniGameOverCountdown() {
    // Eski interval varsa temizle
    stopMiniGameOverCountdown();
    
    let seconds = 30;
    
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
                const pcEl = document.getElementById("miniPlayerCountSelect");
                
                const savedGoal = localStorage.getItem("miniCreateGoal");
                const savedDur = localStorage.getItem("miniCreateDuration");
                const savedSpeed = localStorage.getItem("miniCreateSpeed");
                const savedSplit = localStorage.getItem("miniCreateSplit");
                const savedPlase = localStorage.getItem("miniAllowPlase");
                const savedStick = localStorage.getItem("miniBallStick");
                const savedSprintEn = localStorage.getItem("miniSprintEnabled");
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
            const name = document.getElementById("createMiniNameInput").value.trim();
            if (!name) {
                const msg = document.getElementById("createMiniMsg");
                msg.textContent = "İsim gir.";
                msg.style.color = "#ff6b6b";
                return;
            }
            
            // 🔒 SELJUK KORUMASI
            if (isSeljukName(name) && !isSeljukVerified()) {
                const ok = await showSeljukPasswordPopup();
                if (!ok) {
                    // İptal veya kilit → ismi temizle
                    document.getElementById("createMiniNameInput").value = "";
                    return;
                }
            }
            
            localStorage.setItem("playerName", name);
            
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
                localStorage.setItem("miniSprintEnabled", sprintEnabled ? "on" : "off");
                if (!advancedEnabled) {
                    // Sadece preset seçildiyse kaydet (özgür değerler kaydetme)
                    localStorage.setItem("miniCreateGoal", String(goalTarget));
                    localStorage.setItem("miniCreateDuration", String(matchDuration));
                }
                localStorage.setItem("miniCreateSpeed", gameSpeed);
                localStorage.setItem("miniCreateSplit", splitScreen ? "on" : "off");
            } catch(e) {}
            
            // ✨ Takım isimleri localStorage'dan (varsa)
            let savedRedName = "Kırmızı Takım";
            let savedBlueName = "Mavi Takım";
            try {
                const r = localStorage.getItem("miniRedTeamName");
                const b = localStorage.getItem("miniBlueTeamName");
                if (r) savedRedName = r;
                if (b) savedBlueName = b;
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
                player_count: playerCount,
                spectator_count: spectatorCount,
                kickoff_timeout: savedKickoffTimeout,  // ✨ Santra süresi
                red_team_name: savedRedName,
                blue_team_name: savedBlueName,
                advanced_enabled: advancedEnabled
            };
            if (advancedValues) payload.advanced = advancedValues;
            
            // ✨ localStorage'a player_count + spectator_count
            try { 
                localStorage.setItem("miniPlayerCount", String(playerCount));
                localStorage.setItem("miniSpectatorCount", String(spectatorCount));
            } catch(e) {}
            
            send(payload);
        };
    }
    
    const backBtn = document.getElementById("createMiniBackBtn");
    if (backBtn) backBtn.onclick = () => showScreen("modselect");
    
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
    
    // Takım isimleri
    const redName = document.getElementById("miniPauseRedName");
    const blueName = document.getElementById("miniPauseBlueName");
    if (redName) redName.textContent = miniData.redTeamName;
    if (blueName) blueName.textContent = miniData.blueTeamName;
    
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
                "miniTeamNameEditor", "miniNameEditor", "miniGuestLobbyConfirm",
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

function showMiniGuestEscMenu() {
    const box = document.getElementById("miniGuestEscBox");
    if (box) box.classList.remove("hidden");
    miniReleaseAllKeys();
    
    // ✨ Eğer misafirsen ve ESC menüsünü açtıysan, Host'a oyunu durdurması için 
    // bir sinyal gönderilebilir veya misafir ekranında "DURAKLATILDI" yazabilir.
    // Şimdilik sadece sürenin akmaması için Host'un pause etmesi en temizi.
}

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
        z-index: 9999;
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
    
    // Takım isimleri
    const redTitleEl = document.getElementById("scoreRedTitle");
    const blueTitleEl = document.getElementById("scoreBlueTitle");
    if (redTitleEl) redTitleEl.innerHTML = `🔴 ${miniData.redTeamName || "Kırmızı Takım"}`;
    if (blueTitleEl) blueTitleEl.innerHTML = `🔵 ${miniData.blueTeamName || "Mavi Takım"}`;
    
    // Takım kartı HTML üretici
    function makeTeamRows(players, teamColor) {
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
            // ✨ İsim rengi takım rengine göre
            const nameColor = teamColor || "#d0d0d0";
            
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
    
    document.getElementById("scoreRedList").innerHTML = makeTeamRows(redTeam, "#ff8a8a");
    document.getElementById("scoreBlueList").innerHTML = makeTeamRows(blueTeam, "#7abfff");
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
        if (saved !== null) tabOpacity = parseInt(saved);
        if (isNaN(tabOpacity)) tabOpacity = 5;
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
    { id: "plaseSpin",         label: "🎯 Plase Kavis Şiddeti", current: 35,  min: 10,  max: 80,   step: 5 },
    { id: "afterTouchTime",    label: "⏱️ After-Touch Süresi", current: 200, min: 0,   max: 1000, step: 50, unit: "ms" },
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
        const disableList = ["miniSpeedSelect", "miniAllowPlaseSelect", "miniGoalTargetSelect", "miniDurationSelect", "miniBallStickSelect"];
        
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
    if (exportBtn) exportBtn.onclick = () => alert("Dışa Aktar - Adım 4'te eklenecek");
    if (importBtn) importBtn.onclick = () => alert("Yükle - Adım 4'te eklenecek");
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
    const teamColor = isRed ? "#ff6b6b" : "#4dabf7";
    const teamGlow = isRed ? "rgba(255,107,107,0.4)" : "rgba(77,171,247,0.4)";
    const teamEmoji = isRed ? "🔴" : "🔵";
    
    const overlay = document.createElement("div");
    overlay.id = "miniTeamFullBox";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:450px; border:2px solid ${teamColor}; 
                                         box-shadow: 0 0 40px ${teamGlow};">
            <div style="font-size:70px; margin:10px 0;">${teamEmoji}</div>
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
    // Her 3 saniyede bir ping at
    miniData.pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            send({ type: "mini_ping", ts: Date.now() });
        }
    }, 3000);
    // İlk ping'i hemen at
    setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
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
    _cache: {},       // Yüklenen ses dosyaları
    _lastPlayed: {},  // Son çalınan ses (aynı grupta tekrar çalmayı önler)

    // Ses dosyasını önceden yükle (cache'e al)
    preload(name) {
        if (this._cache[name]) return;
        const audio = new Audio(`/oyun_modlari/mini_futbol/sounds/${name}`);
        audio.preload = "auto";
        this._cache[name] = audio;
    },

    // Kullanıcı ilk tıkladığında/dokunduğunda unlock et (Chrome autoplay fix)
    unlock() {
        if (this._unlocked) return;
        // ✨ Gerçek bir ses dosyasını sessiz oynat → unlock olur
        try {
            const a = new Audio("/oyun_modlari/mini_futbol/sounds/kick_1.wav");
            a.volume = 0.01;
            a.play().then(() => {
                this._unlocked = true;
                console.log("[SES] Audio unlocked ✓");
            }).catch((err) => {
                // Yine de unlock kabul et (kullanıcı etkileşimi zaten oldu)
                this._unlocked = true;
                console.log("[SES] Audio unlocked (fallback) ✓");
            });
        } catch(e) {
            this._unlocked = true;
        }
    },

    // Tek ses çal
    play(name, volume) {
        if (!this._unlocked) return;
        try {
            let audio = this._cache[name];
            if (!audio) {
                audio = new Audio(`/oyun_modlari/mini_futbol/sounds/${name}`);
                this._cache[name] = audio;
            }
            // Sesi başa sar (üst üste çalabilsin)
            const clone = audio.cloneNode();
            clone.volume = (volume !== undefined) ? volume : 0.6;
            clone.play().catch(() => {});
        } catch(e) {}
    },

    // Gruptan rastgele çal (arka arkaya aynısı çalmaz)
    playRandom(group, files, volume) {
        if (!this._unlocked) return;
        if (!files || files.length === 0) return;

        let available = files;

        // Son çalınan aynıysa listeden çıkar
        const last = this._lastPlayed[group];
        if (files.length > 1 && last) {
            available = files.filter(f => f !== last);
        }

        // Rastgele seç
        const chosen = available[Math.floor(Math.random() * available.length)];
        this._lastPlayed[group] = chosen;
        this.play(chosen, volume);
    },

    // Tüm sesleri önceden yükle
    preloadAll() {
        const files = [
            "post_hit.wav",
            "wall_hit_1.wav", "wall_hit_2.wav",
            "goal_1.wav", "goal_2.wav", "goal_3.wav",
            "whistle.wav",
            "fire_kick_1.wav", "fire_kick_2.wav", "fire_kick_3.wav",
            "kick_1.wav", "kick_2.wav"
        ];
        files.forEach(f => this.preload(f));
        console.log("[SES] Sesler preload edildi ✓");
    }
};

// Sayfa yüklenince sesleri cache'e al
setTimeout(() => MiniAudio.preloadAll(), 500);

// Kullanıcı herhangi bir yere tıklayınca veya tuşa basınca unlock et
document.addEventListener("click", () => MiniAudio.unlock(), { once: false });
document.addEventListener("keydown", () => MiniAudio.unlock(), { once: false });

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
    const keys = miniData.predictedKeys;
    
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

    // 2) Oyuncuları senkronize et
    if (serverGS.players) {
        for (const pid in serverGS.players) {
            const sP = serverGS.players[pid];
            const lP = localGS.players[pid];
            if (!lP) continue;

            const dx = sP.x - lP.x;
            const dy = sP.y - lP.y;
            const dist = Math.sqrt(dx*dx + dy*dy);

            if (dist > 50) {
                lP.x = sP.x;
                lP.y = sP.y;
            } else if (dist > 0.5) {
                lP.x += dx * 0.35;
                lP.y += dy * 0.35;
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
    // radius = oyuncu yarıçapı (20)
    // "bayrak yüksekliği" = radius * 2 (oyuncu çapı)
    const flagH = radius * 2;
    
    ctx.save();
    ctx.translate(cx, cy);
    
    // Parlama efekti (şut çekince - sadece ay-yıldız glow)
    if (glowIntensity > 0.01) {
        ctx.shadowBlur = 30 * glowIntensity;
        ctx.shadowColor = "#ffffff";
    }
    
    ctx.fillStyle = "#ffffff";
    
    // === HİLAL (AY) ===
    // Dış daire yarıçapı = flagH/2 * 0.5 = radius * 0.5
    const moonOuterR = flagH * 0.25;  // = radius * 0.5
    // İç daire yarıçapı (kesim) = 4/5 * dış daire
    const moonInnerR = moonOuterR * 0.8;
    // Hilal merkezi sola kaydırılmış
    const moonCenterX = -radius * 0.15;
    // İç kesim biraz sağa (hilal boşluğu oluştursun)
    const moonCutOffset = moonOuterR * 0.25;
    
    ctx.beginPath();
    ctx.arc(moonCenterX, 0, moonOuterR, 0, Math.PI * 2);
    ctx.arc(moonCenterX + moonCutOffset, 0, moonInnerR, 0, Math.PI * 2, true);
    ctx.fill();
    
    // === YILDIZ (5 köşeli) ===
    // Dış yarıçap = flagH/4 / 2 = radius * 0.25
    const starOuterR = flagH * 0.15;   // = radius * 0.3
    const starInnerR = starOuterR * 0.38;  // 5-köşe yıldız için altın oran
    // Yıldız hilal boşluğunun içinde (biraz daha sağa)
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

// ========================================
// 🔒 SELJUK ÖZEL İSİM KORUMASI
// ========================================
const SELJUK_LOCK_KEY = "seljukLockUntil";
const SELJUK_ATTEMPTS_KEY = "seljukAttempts";
const SELJUK_VERIFIED_KEY = "seljukVerified";

function isSeljukName(name) {
    const n = (name || "").trim();
    return n === "Seljuk" || n === "seljuk";
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

console.log("Mini Futbol JS yüklendi ✓");
