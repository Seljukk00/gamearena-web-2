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
    interpDelay: 45,         // 45ms gecikmeli render → paketler arası yumuşak
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
    pollInterval: null     // Polling loop handle
};

function initGamepadListeners() {
    // Kontrolcü takıldığında
    window.addEventListener("gamepadconnected", (e) => {
        console.log(`[GAMEPAD] Bağlandı: ${e.gamepad.id} (index: ${e.gamepad.index})`);
        miniGamepad.connected = true;
        miniGamepad.index = e.gamepad.index;
        miniGamepad.name = e.gamepad.id;
        // ✨ Yeni konsol takıldığında her zaman "Devre Dışı" ile başla
        miniGamepad.slot = "off";
        try { localStorage.setItem("miniGamepadSlot", "off"); } catch(e) {}
        stopGamepadPolling();  // Önceki polling varsa durdur
        updateGamepadUI();
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
            // Yeni bir kontrolcü mü, yoksa aynı mı?
            const isNew = miniGamepad.index !== pads[i].index;
            
            miniGamepad.connected = true;
            miniGamepad.index = pads[i].index;
            miniGamepad.name = pads[i].id;
            
            // ✨ Yeni kontrolcü ise slot'u sıfırla
            if (isNew) {
                miniGamepad.slot = "off";
                try { localStorage.setItem("miniGamepadSlot", "off"); } catch(e) {}
                stopGamepadPolling();
                console.log(`[GAMEPAD] Yeni kontrolcü: ${pads[i].id} (slot=off)`);
            } else {
                console.log(`[GAMEPAD] Mevcut kontrolcü: ${pads[i].id}`);
            }
            
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
    const nameEl = document.getElementById("miniGamepadName");
    if (!section) return;
    
    if (!miniGamepad.connected) {
        section.classList.add("hidden");
        return;
    }
    
    // Kontrolcü bağlı → seçim bölümünü göster
    section.classList.remove("hidden");
    
    // İsim (uzunsa kısalt)
    if (nameEl) {
        let name = miniGamepad.name || "Bilinmeyen Kontrolcü";
        name = name.split("(")[0].trim();
        if (name.length > 40) name = name.substring(0, 40) + "...";
        nameEl.textContent = name;
    }
    
    // ✨ Aktif slot butonunu vurgula
    document.querySelectorAll(".miniGpBtn").forEach(btn => {
        const slot = btn.dataset.slot;
        if (slot === miniGamepad.slot) {
            btn.style.boxShadow = "0 0 15px currentColor";
            btn.style.transform = "scale(1.05)";
        } else {
            btn.style.boxShadow = "";
            btn.style.transform = "";
        }
    });
    
    // ✨ P2 durumu değerlendirmesi
    const p2Btn = document.querySelector('.miniGpBtn[data-slot="p2"]');
    if (p2Btn) {
        const isHost = miniData.playerId === 1;
        
        // Fake P2 olmayan başka gerçek oyuncu var mı?
        const otherRealPlayers = miniData.players.filter(p => 
            p.id !== miniData.playerId && !p.is_split_slave
        );
        
        let canUseP2 = false;
        let disabledReason = "";
        
        if (!isHost) {
            disabledReason = "Sadece host split-screen açabilir";
        } else if (otherRealPlayers.length > 0) {
            disabledReason = "Odada zaten 2. oyuncu var, split-screen açılamaz";
        } else {
            canUseP2 = true;
        }
        
        if (canUseP2) {
            p2Btn.style.opacity = "1";
            p2Btn.style.cursor = "pointer";
            p2Btn.disabled = false;
            p2Btn.title = "";
        } else {
            p2Btn.style.opacity = "0.4";
            p2Btn.style.cursor = "not-allowed";
            p2Btn.disabled = true;
            p2Btn.title = disabledReason;
        }
    }
    
    // Kısayol tuşları güncel
    updateKeyBindingsUI();
}

function updateKeyBindingsUI() {
    const p1TextEl = document.getElementById("miniKeyP1Text");
    const p2Div = document.getElementById("miniKeyP2");
    const p2TextEl = document.getElementById("miniKeyP2Text");
    
    if (!p1TextEl) return;
    
    // P1 kısayolları
    if (miniGamepad.connected && miniGamepad.slot === "p1") {
        p1TextEl.innerHTML = `🎮 <b>Kontrolcü</b>: Sol Stick / D-Pad hareket | X / Kare şut | R2 sprint`;
    } else {
        p1TextEl.innerHTML = `⌨️ <b>Klavye</b>: WASD hareket | Space şut | Sol Shift sprint`;
    }
    
    // P2 (split-screen aktifse görünür)
    const splitActive = miniData.splitScreen || miniGamepad.slot === "p2";
    if (splitActive && p2Div && p2TextEl) {
        p2Div.classList.remove("hidden");
        if (miniGamepad.connected && miniGamepad.slot === "p2") {
            p2TextEl.innerHTML = `🎮 <b>Kontrolcü</b>: Sol Stick / D-Pad hareket | X / Kare şut | R2 sprint`;
        } else {
            p2TextEl.innerHTML = `⌨️ <b>Klavye</b>: Ok Tuşları hareket | Num 0 / Sağ Ctrl şut | Sağ Shift / Num 1 sprint`;
        }
    } else if (p2Div) {
        p2Div.classList.add("hidden");
    }
}

// ========================================
// 🎮 GAMEPAD INPUT OKUMA (polling)
// ========================================

// Önceki tuş state (basıldı/bırakıldı algılamak için)
let gpPrevState = {
    up: false, down: false, left: false, right: false,
    kick: false, sprint: false
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
}

function pollGamepad() {
    if (!miniGamepad.connected || miniGamepad.slot === "off") return;
    
    // Oyun ekranında değilsek gönderme
    const gameScreen = document.getElementById("miniGameScreen");
    if (!gameScreen || gameScreen.classList.contains("hidden")) return;
    
    // Pause popup açıksa gönderme
    const pauseBox = document.getElementById("miniPauseLobbyBox");
    if (pauseBox && !pauseBox.classList.contains("hidden")) return;
    
    // Kontrolcüyü oku
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads[miniGamepad.index];
    if (!pad) return;
    
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
    // Slot'a göre hangi oyuncuya gidecek
    const msg = { type: "mini_key", key: key, pressed: pressed };
    let targetPid = miniData.playerId;
    
    if (miniGamepad.slot === "p2") {
        // P2 = split-screen slave
        if (miniData.splitSlaveId) {
            msg.for_player_id = miniData.splitSlaveId;
            targetPid = miniData.splitSlaveId;
        }
    }
    // P1 ise doğrudan gider (kendi player_id)
    
    // ✨ Local HP'ye bildir (host + misafir)
    if (typeof HP !== 'undefined' && HP.running) {
        HP.setKey(targetPid, key, pressed);
    }
    
    send(msg);
}

function selectGamepadSlot(slot) {
    if (!miniGamepad.connected) return;
    
    if (slot === "p2") {
        // ✨ Split-Screen izni var mı?
        if (!miniData.splitScreen) {
            showToast("⚠️ İzin Yok", "Host Split-Screen'e izin vermeli. Oda ayarlarından açtırın.", null);
            return;
        }
        
        // Zaten split açıksa (kendisinin) tekrar açma
        const myP2 = miniData.players.find(p => 
            p.is_split_slave && miniData.splitSlaveId === p.id
        );
        
        if (!myP2) {
            // Fake P2 ekle
            send({ type: "mini_add_split_player" });
        }
        
        miniGamepad.slot = "p2";
        console.log("[GAMEPAD] Slot: P2 (fake player ekleniyor)");
    } else if (slot === "p1") {
        miniGamepad.slot = "p1";
        console.log("[GAMEPAD] Slot: P1 (klavye yerine)");
        
        // ✨ Bu kişinin fake P2'si varsa kaldır
        if (miniData.splitOwner === miniData.playerId && miniData.splitSlaveId) {
            send({ type: "mini_remove_split_player" });
        }
    } else {
        miniGamepad.slot = "off";
        console.log("[GAMEPAD] Slot: OFF");
        
        // ✨ Bu kişinin fake P2'si varsa kaldır
        if (miniData.splitOwner === miniData.playerId && miniData.splitSlaveId) {
            send({ type: "mini_remove_split_player" });
        }
    }
    
    // localStorage'a kaydet (hatırlansın)
    try {
        localStorage.setItem("miniGamepadSlot", miniGamepad.slot);
    } catch(e) {}
    
    updateGamepadUI();
    updateMiniControlsInfo();  // ✨ Oyun ekranındaki kontrol bilgisini de güncelle
    
    // ✨ Polling'i başlat veya durdur
    if (miniGamepad.slot === "off") {
        stopGamepadPolling();
    } else {
        // Oyun ekranındaysak hemen başlat
        const gameScreen = document.getElementById("miniGameScreen");
        if (gameScreen && !gameScreen.classList.contains("hidden")) {
            startGamepadPolling();
        }
    }
    
    // Mesaj göster
    const msgEl = document.getElementById("miniGamepadMsg");
    if (msgEl) {
        if (slot === "p1") msgEl.textContent = "✅ Klavye yerine kontrolcü kullanılacak";
        else if (slot === "p2") msgEl.textContent = "✅ Split-screen açıldı, kontrolcü P2 için";
        else msgEl.textContent = "❌ Kontrolcü devre dışı";
        setTimeout(() => { if (msgEl) msgEl.textContent = ""; }, 3000);
    }
}

// Sayfa yüklendiğinde gamepad listener'larını başlat
setTimeout(() => {
    // ✨ Yeni konsol algılandığında her zaman "off" ile başla
    // (Kayıtlı slot kullanmıyoruz artık - kullanıcı her seferinde manuel seçsin)
    miniGamepad.slot = "off";
    
    initGamepadListeners();
    
    // Buton olayları
    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".miniGpBtn");
        if (!btn || btn.disabled) return;
        const slot = btn.dataset.slot;
        if (slot) selectGamepadSlot(slot);
    });
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
        
        // Oyun sonu popup'ı varsa kapat
        const overBox = document.getElementById("miniGameOverBox");
        if (overBox) overBox.classList.add("hidden");
        
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
                    if (newRedPid) {
                        if (!gs.players[newRedPid]) {
                            // Yeni oyuncu ekle
                            gs.players[newRedPid] = {
                                x: 200, y: HP.FIELD_HEIGHT / 2,
                                vx: 0, vy: 0,
                                keys: { up: false, down: false, left: false, right: false, kick: false, sprint: false },
                                last_kick_time: 0,
                                sprint_energy: HP.SPRINT_MAX_ENERGY,
                                last_frame_time: 0,
                                team: "red"
                            };
                        } else {
                            // ✨ Zaten var olan oyuncuyu kırmızı takım pozisyonuna ışınla
                            gs.players[newRedPid].x = 200;
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
                    if (newBluePid) {
                        if (!gs.players[newBluePid]) {
                            gs.players[newBluePid] = {
                                x: HP.FIELD_WIDTH - 200, y: HP.FIELD_HEIGHT / 2,
                                vx: 0, vy: 0,
                                keys: { up: false, down: false, left: false, right: false, kick: false, sprint: false },
                                last_kick_time: 0,
                                sprint_energy: HP.SPRINT_MAX_ENERGY,
                                last_frame_time: 0,
                                team: "blue"
                            };
                        } else {
                            // ✨ Zaten var olan oyuncuyu mavi takım pozisyonuna ışınla
                            gs.players[newBluePid].x = HP.FIELD_WIDTH - 200;
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
        // ✨ Santra süresi
        miniData.kickoffTimeout = msg.kickoff_timeout || 10;
        if (msg.split_owner !== undefined) miniData.splitOwner = msg.split_owner;
        if (msg.split_slave_id !== undefined) miniData.splitSlaveId = msg.split_slave_id;
        console.log("[MINI DEBUG] lobby_update: playerCount =", miniData.playerCount, "msg:", msg.player_count);
        
        // ✨ SENKRON: Backend'den gelen ayarları localStorage'a otomatik kaydet
        // (Oda kurma ekranı bir sonraki açılışta bu değerleri alır)
        // Sadece host için (kullanıcının ayarları etkilenmesin)
        if (miniData.playerId === 1) {
            try {
                localStorage.setItem("miniPlayerCount", String(miniData.playerCount));
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
            HP.settings.kickoffTimeout = msg.kickoff_timeout || 10;  // ✨ Santra süresi
            
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
    
    // Yeni oyuncu katıldı (oyun içi)
    if (msg.type === "mini_player_joined") {
        showToast("👋 Yeni Oyuncu", `${msg.player_name} katıldı!`, null, "success");
        return;
    }
    
    // ✨ Oyuncu oyundan çıkıp izleyici oldu
    if (msg.type === "mini_player_left_game") {
        showToast("👋 Oyundan Ayrıldı", `${msg.player_name} izleyici oldu`, null, "info");
        return;
    }
    
    // ✨ Oyuncu odadan atıldı
    if (msg.type === "mini_player_kicked") {
        showToast("🚫 Oyuncu Atıldı", `${msg.player_name} odadan atıldı`, null, "warning");
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
        
        const overBox = document.getElementById("miniGameOverBox");
        if (overBox) overBox.classList.add("hidden");
        
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
}

// ========================================
// LOBBY GÜNCELLEME
// ========================================
function updateMiniLobby() {
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
    
    document.getElementById("miniNameSaveBtn").onclick = () => {
        const newName = input.value.trim();
        if (!newName) {
            input.style.borderColor = "#ff3333";
            input.focus();
            return;
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
                id: "splitScreen",
                label: "🎮 Split-Screen'e İzin Ver (Aynı PC'den 2+ Kişi)",
                current: miniData.splitScreen ? "on" : "off",
                options: [
                    {value: "off", label: "❌ Reddet (Sadece Klavye)"},
                    {value: "on", label: "✅ İzin Ver (Kontrol Ayarları'ndan Gamepad Ata)"}
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
            const splitScreen = values.splitScreen === "on";
            
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
    const settings = {
        goalTarget: miniData.goalTarget,
        matchDuration: miniData.matchDuration,
        gameSpeed: miniData.gameSpeed,
        allowPlase: miniData.allowPlase !== false,
        ballStick: miniData.ballStick !== false,
        sprintEnabled: miniData.sprintEnabled !== false,
        kickoffTimeout: miniData.kickoffTimeout || 10,
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
        HP.onStateUpdate = (stateMsg) => {
            stateMsg._local = true;
            handleMiniMessage(stateMsg);

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
    
    // ✨ Gamepad polling başlat (slot aktifse)
    if (miniGamepad.connected && miniGamepad.slot !== "off") {
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
    
    // ✨ Prediction'ı sıfırla
    miniData.predictionActive = false;
    miniData.predictedSelf = null;
    miniData.predictedKeys = {up:false, down:false, left:false, right:false, sprint:false};
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
    
    // Orta çizgi (santra aktifse belirgin)
    if (kickoffActive) {
        ctx.strokeStyle = "rgba(255, 107, 107, 0.5)";
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(cfg.width / 2, 0);
        ctx.lineTo(cfg.width / 2, cfg.height);
        ctx.stroke();
        ctx.setLineDash([]);
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
            if (state.kick_effects) {
                state.kick_effects.forEach(k => {
                    if (k.hit_ball) hitMap[k.player_id] = true;
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

        // 🔊 DUVAR + DİREK SESLERİ
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
                } else if (h.type === "post") {
                    MiniAudio.play("post_hit.wav", 0.6);
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
            // ✨ Interpolated pozisyonu kullan
            let smoothPos = miniData.currentPositions["p" + pid] || state.players[pid];
            
            // ✨ Kendi karakterim + prediction aktifse → predicted pozisyonu kullan
            if (miniData.predictionActive && parseInt(pid) === miniData.playerId && miniData.predictedSelf) {
                smoothPos = { x: miniData.predictedSelf.x, y: miniData.predictedSelf.y };
            }
            
            const p = { x: smoothPos.x, y: smoothPos.y };
            
            const isMe = parseInt(pid) === miniData.playerId;
            
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
                const innerGrad = ctx.createRadialGradient(
                    p.x, p.y, 0,
                    p.x, p.y, cfg.player_radius
                );
                // ✨ Ortadaki parlama takım renginde (beyaz yerine)
                innerGrad.addColorStop(0, `rgba(${teamColorRGB}, ${glowStrength * 1.0})`);
                innerGrad.addColorStop(0.4, `rgba(${teamColorRGB}, ${glowStrength * 0.7})`);
                innerGrad.addColorStop(1, `rgba(${teamColorRGB}, 0)`);
                ctx.fillStyle = innerGrad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, cfg.player_radius, 0, Math.PI * 2);
                ctx.fill();
                
                // ⚡ Dış sarı halka (mevcut)
                ctx.shadowBlur = 30 * glowStrength;
                ctx.shadowColor = "#ffd43b";
                ctx.strokeStyle = `rgba(255, 212, 59, ${glowStrength})`;
                ctx.lineWidth = 4 + (2 * glowStrength);
                ctx.beginPath();
                ctx.arc(p.x, p.y, cfg.player_radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
            
            // İsim (üstte) - takım rengi
            let pname = miniData.playerNames[pid] || `P${pid}`;
            const nameColor = playerTeam === "blue" ? "#7abfff" : "#ff8a8a";
            ctx.font = "bold 12px Segoe UI";
            ctx.textAlign = "center";
            
            // Gölge (okunabilir olsun)
            ctx.shadowBlur = 4;
            ctx.shadowColor = "#000";
            ctx.fillStyle = nameColor;
            ctx.fillText(pname, p.x, p.y - cfg.player_radius - 8);
            ctx.shadowBlur = 0;
        }
        
        // Top
        const bSmooth = miniData.currentPositions.ball || state.ball;
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
    // 🔊 DÜDÜK (BAŞLA! anında çal, sadece 1 kez)
    // ✨ Sadece maç başı VEYA gol sonrası santrada çalsın (pause resume'da çalmasın)
    const state = miniData.gameState;
    const silentWhistle = state && state.silent_whistle === true;
    
    if (countdown === 0 && !miniData._whistlePlayed && !silentWhistle) {
        MiniAudio.play("whistle.wav", 0.6);
        miniData._whistlePlayed = true;
    } else if (countdown > 0) {
        // Countdown başladığında flag'i sıfırla (yeni maç için tekrar çalsın)
        miniData._whistlePlayed = false;
    }

    // Yarı saydam arkaplan
    ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
    ctx.fillRect(0, 0, cfg.width, cfg.height);
    
    // Sayı veya BAŞLA yazısı
    let text = "";
    let color = "#ffd43b";
    let fontSize = 120;
    
    if (countdown === 0) {
        text = "BAŞLA!";
        color = "#51cf66";
        fontSize = 80;
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
    
    const receivingTeam = kickoff.receiving_team;
    const restrictedTeam = kickoff.restricted_team;
    const isMyTeamReceiving = receivingTeam === miniData.playerId;
    const isMyTeamRestricted = restrictedTeam === miniData.playerId;
    
    // Alt kısımda bilgi göster
    ctx.save();
    
    // Süre gösterimi (üstte küçük)
    const timerText = `⏱️ ${remaining.toFixed(1)} sn`;
    ctx.font = "bold 20px Segoe UI";
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
    
    ctx.font = "bold 16px Segoe UI";
    ctx.fillStyle = infoColor;
    ctx.fillText(infoText, cfg.width / 2, 38);
    
    ctx.restore();
}


// ========================================
// GOL KUTLAMASI OVERLAY
// ========================================
function drawGoalCelebration(ctx, cfg, celebration) {
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
    ctx.font = `bold ${75 * pulse}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 35;
    
    if (isOwnGoal) {
        // Kendi kalesine → hepsi KIRMIZI
        ctx.shadowColor = "#ff3333";
        ctx.fillStyle = "#ff6b6b";
    } else {
        // Normal → sarı (klasik gol)
        ctx.shadowColor = "#ffd43b";
        ctx.fillStyle = "#ffd43b";
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
        ctx.font = `bold 28px Segoe UI`;
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#ff3333";
        ctx.fillStyle = "#ff6b6b";
        ctx.fillText(`${scorerName} Kendi Kalesine Attı 🤦`, 0, 20);
    } else {
        // "Golü Atan: SELÇUK" (isim kırmızı/mavi)
        // "Asist: MEHMET" (sarı, varsa)
        
        const scorerTeamColor = scorerTeamId === 1 ? "#ff6b6b" : "#4dabf7";
        
        // Golü Atan satırı
        ctx.font = "bold 26px Segoe UI";
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
            ctx.font = "bold 22px Segoe UI";
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
        `;
        container.appendChild(header);
        
        // Satırlar (animasyon delay ile)
        players.forEach((p, i) => {
            const st = stats[String(p.id)] || { goals: 0, assists: 0, passes: 0 };
            const isMe = p.id === miniData.playerId;
            const crown = p.id === 1 ? " 👑" : "";
            const meMark = isMe ? ' <span style="color:#909090;font-size:10px;">(sen)</span>' : '';
            
            const row = document.createElement("div");
            row.className = "miniGameOverRow";
            row.style.animationDelay = (0.7 + i * 0.1) + "s";
            row.innerHTML = `
                <span class="miniGameOverName" style="color:${nameColor};${isMe?'font-weight:800;':''}">${p.name}${crown}${meMark}</span>
                <span class="miniGameOverStat">${st.goals}</span>
                <span class="miniGameOverStat">${st.assists}</span>
                <span class="miniGameOverStat">${st.passes}</span>
                <span class="miniGameOverStat">${st.saves || 0}</span>
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
            
            const row = document.createElement("div");
            row.className = "miniGameOverSpecRow";
            row.style.animationDelay = (0.7 + i * 0.1) + "s";
            row.innerHTML = `👁️ <span style="color:${isMe ? '#fff' : '#c0c0c0'};${isMe?'font-weight:700;':''}">${p.name}${crown}${meMark}</span>`;
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
                const splitEl = document.getElementById("miniSplitScreenSelect");
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
                if (savedSplit && splitEl) {
                    splitEl.value = savedSplit;
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
        
        createBtn.onclick = () => {
            const name = document.getElementById("createMiniNameInput").value.trim();
            if (!name) {
                const msg = document.getElementById("createMiniMsg");
                msg.textContent = "İsim gir.";
                msg.style.color = "#ff6b6b";
                return;
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
            const splitScreenEl = document.getElementById("miniSplitScreenSelect");
            const splitScreen = splitScreenEl ? splitScreenEl.value === "on" : false;
            const allowPlaseValEl = document.getElementById("miniAllowPlaseSelect");
            const allowPlase = allowPlaseValEl ? allowPlaseValEl.value !== "off" : true;
            
            const ballStickValEl = document.getElementById("miniBallStickSelect");
            const ballStick = ballStickValEl ? ballStickValEl.value !== "off" : true;
            
            const sprintEnabledEl = document.getElementById("miniSprintEnabledSelect");
            const sprintEnabled = sprintEnabledEl ? sprintEnabledEl.value !== "off" : true;
            
            // ✨ Oyuncu sayısı (1v1=2, 2v2=4, ..., 5v5=10)
            const playerCountEl = document.getElementById("miniPlayerCountSelect");
            const playerCount = playerCountEl ? parseInt(playerCountEl.value) : 2;
            
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
                kickoff_timeout: savedKickoffTimeout,  // ✨ Santra süresi
                red_team_name: savedRedName,
                blue_team_name: savedBlueName,
                advanced_enabled: advancedEnabled
            };
            if (advancedValues) payload.advanced = advancedValues;
            
            // ✨ localStorage'a player_count
            try { localStorage.setItem("miniPlayerCount", String(playerCount)); } catch(e) {}
            
            send(payload);
        };
    }
    
    const backBtn = document.getElementById("createMiniBackBtn");
    if (backBtn) backBtn.onclick = () => showScreen("modselect");
    
    const leaveBtn = document.getElementById("miniLobbyLeaveBtn");
    if (leaveBtn) leaveBtn.onclick = () => showEscPopup();
    
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
            document.getElementById("miniGameOverBox").classList.add("hidden");
            send({ type: "mini_start_game" });
        };
    }
    
    const menuBtn = document.getElementById("miniGameOverMenuBtn");
    if (menuBtn) {
        menuBtn.onclick = () => {
            document.getElementById("miniGameOverBox").classList.add("hidden");
            // ✨ Ana menüye değil, lobby'ye dön (oda açık kalsın)
            send({ type: "mini_return_to_lobby" });
            showScreen("miniLobby");
            updateMiniLobby();
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
    
    const splitAllowed = miniData.splitScreen === true;
    
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
            const currentSlot = isActive ? miniGamepad.slot : "off";
            
            gamepadHtml += `
                <div style="padding:10px 12px; background:rgba(103,65,217,0.1); 
                            border:1px solid #6741d9; border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="color:#c084fc; font-weight:bold; font-size:13px;">
                            🎮 ${pad.name || "Kontrolcü"}
                        </span>
                        <span style="color:${isActive ? '#51cf66' : '#adb5bd'}; font-size:11px;">
                            ${isActive ? '✅ Aktif' : '⏸️ Beklemede'}
                        </span>
                    </div>
                    <select class="miniCtrlPadSlot" data-pad-index="${pad.index}"
                            style="width:100%; padding:8px; background:#1a1e2e; color:#fff; 
                                   border:1px solid #3b4c63; border-radius:6px; font-size:13px;">
                        <option value="off" ${currentSlot==='off'?'selected':''}>❌ Devre Dışı</option>
                        <option value="p1" ${currentSlot==='p1'?'selected':''}>🎮 1. Oyuncu (Klavye Yerine)</option>
                        ${splitAllowed ? `<option value="p2" ${currentSlot==='p2'?'selected':''}>🎮 2. Oyuncu (Split)</option>` : ''}
                    </select>
                </div>
            `;
        });
        gamepadHtml += `</div>`;
        
        if (!splitAllowed) {
            gamepadHtml += `<p style="color:#ffa94d; font-size:11px; text-align:center; margin-top:10px; font-style:italic;">
                ⚠️ Split-screen kapalı, sadece 1. Oyuncu seçilebilir. Host oda ayarlarından açabilir.
            </p>`;
        }
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
        <div class="overlayCard" style="max-width:600px; max-height:88vh; overflow-y:auto;
                                        border:2px solid #0ca678; box-shadow: 0 0 40px rgba(12,166,120,0.3);">
            <div style="font-size:50px; margin:10px 0;">⚙️</div>
            <h2 style="color:#0ca678; margin:5px 0 20px 0;">Ayarlar</h2>
            
            <!-- KONTROLCÜ SLOT SEÇİMİ -->
            <div style="text-align:left; margin-bottom:20px;">
                <h3 style="color:#c084fc; font-size:15px; margin:0 0 10px 0; text-align:center;">
                    🎮 Bağlı Kontrolcüler
                </h3>
                ${gamepadHtml}
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
    
    // Gamepad slot değişimi
    overlay.querySelectorAll(".miniCtrlPadSlot").forEach(sel => {
        sel.onchange = () => {
            const padIndex = parseInt(sel.dataset.padIndex);
            const newSlot = sel.value;
            // Aktif kontrolcü seçilen mi?
            if (miniGamepad.index === padIndex) {
                selectGamepadSlot(newSlot);
            } else {
                // Farklı bir gamepad seçildi
                miniGamepad.index = padIndex;
                const pads = navigator.getGamepads();
                if (pads[padIndex]) miniGamepad.name = pads[padIndex].id;
                miniGamepad.connected = true;
                selectGamepadSlot(newSlot);
            }
            showToast("🎮 Kontrolcü", `Slot değişti: ${newSlot.toUpperCase()}`, null, "success");
        };
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
    
    // Kapat
    overlay.querySelector("#miniCtrlCloseBtn").onclick = () => {
        window.removeEventListener("keydown", keyListener, true);
        overlay.remove();
    };
    
    // Sıfırla
    overlay.querySelector("#miniCtrlResetBtn").onclick = () => {
        if (!confirm("Ayarları varsayılana sıfırla? (Klavye tuşları + TAB görünürlüğü)")) return;
        try { 
            localStorage.removeItem("miniKeys_p1");
            localStorage.setItem("miniTabOpacity", "5");  // ✨ Default %5
        } catch(e) {}
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
const PRED_FIELD_WIDTH = 1000;
const PRED_FIELD_HEIGHT = 500;
const PRED_PLAYER_RADIUS = 20;
const PRED_PLAYER_OUT_MARGIN = 55;
const PRED_LERP_SPEED = 0.25;  // Server düzeltmesi ne kadar hızlı uygulansın

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
    
    // Duvar sınırı (basit)
    const R = PRED_PLAYER_RADIUS;
    const M = PRED_PLAYER_OUT_MARGIN;
    if (p.x - R < -M) { p.x = -M + R; p.vx = 0; }
    if (p.x + R > PRED_FIELD_WIDTH + M) { p.x = PRED_FIELD_WIDTH + M - R; p.vx = 0; }
    if (p.y - R < -M) { p.y = -M + R; p.vy = 0; }
    if (p.y + R > PRED_FIELD_HEIGHT + M) { p.y = PRED_FIELD_HEIGHT + M - R; p.vy = 0; }
    
    // ✨ SERVER RECONCILIATION - server pozisyonuna yumuşakça yaklaş
    // Tahminim serverdan çok uzaksa → snap et
    const dx = serverPos.x - p.x;
    const dy = serverPos.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 60) {
        // Çok uzak → snap (ışınlan)
        p.x = serverPos.x;
        p.y = serverPos.y;
        p.vx = 0;
        p.vy = 0;
    } else if (dist > 3) {
        // Ufak fark → yumuşakça yaklaş (lerp)
        p.x += dx * PRED_LERP_SPEED;
        p.y += dy * PRED_LERP_SPEED;
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

        if (dist > 150) { // Çok büyük fark varsa ışınla
            localGS.ball.x = serverGS.ball.x;
            localGS.ball.y = serverGS.ball.y;
            localGS.ball.vx = serverGS.ball.vx || 0;
            localGS.ball.vy = serverGS.ball.vy || 0;
        } else if (dist > 1) { // Küçük farkları yavaşça düzelt (%15 her frame)
            localGS.ball.x += dx * 0.15;
            localGS.ball.y += dy * 0.15;
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

            if (dist > 80) { // Işınla
                lP.x = sP.x;
                lP.y = sP.y;
            } else if (dist > 0.5) { // %20 hızla yaklaş
                lP.x += dx * 0.2;
                lP.y += dy * 0.2;
            }
        }
    }
}

console.log("Mini Futbol JS yüklendi ✓");