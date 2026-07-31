// ==========================================
// HARITADAN BUL - MODÜL JS
// ==========================================

let haritaData = {
    inGame: false,
    playerId: null,
    roomCode: "",
    players: [],
    turnSeconds: 30,
    totalRounds: 10,
    currentTurn: null,
    roundNo: 0,
    footballer: null,
    countries: {},
    scores: { 1: 0, 2: 0 },
    answered: false,
    pendingCode: null,
    lastSelectedCode: null,
    lastCorrectCode: null,
    timerInterval: null,
    timerSeconds: 30,
    roundStarting: false,
    zoom: 1.0,
    minZoom: 1.0,
    maxZoom: 5.0,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartOffsetX: 0,
    panStartOffsetY: 0
};

// ==========================================
// SVG HARITA YÜKLEYİCİ
// ==========================================
async function loadHaritaSvg() {
    try {
        const response = await fetch('/oyun_modlari/haritadan_bul/world.svg');
        const svgText = await response.text();
        const container = document.getElementById("haritaSvgContainer");
        if (!container) return;
        container.innerHTML = svgText;

        const svgEl = container.querySelector("svg");
        if (svgEl) {
            svgEl.id = "haritaWorldMap";
            svgEl.style.width = "100%";
            svgEl.style.height = "100%";
            svgEl.style.display = "block";
        }
    } catch (e) {
        console.error("SVG yüklenemedi:", e);
    }
}
loadHaritaSvg();

const createHaritaScreen = document.getElementById("createHaritaScreen");
const haritaLobbyScreen = document.getElementById("haritaLobbyScreen");
const haritaGameScreen = document.getElementById("haritaGameScreen");

// showScreen genişlet
const _prevShowScreenHarita = showScreen;
showScreen = function(screenName) {
    _prevShowScreenHarita(screenName);
    createHaritaScreen.classList.add("hidden");
    haritaLobbyScreen.classList.add("hidden");
    haritaGameScreen.classList.add("hidden");
    if (screenName === "createHarita") createHaritaScreen.classList.remove("hidden");
    if (screenName === "haritaLobby") haritaLobbyScreen.classList.remove("hidden");
    if (screenName === "haritaGame") haritaGameScreen.classList.remove("hidden");
};

// Mod kartına tıklama
document.querySelectorAll(".mod-card:not(.mod-disabled)").forEach(card => {
    const mod = card.dataset.mod;
    if (mod === "haritadan_bul") {
        card.addEventListener("click", () => {
            showScreen("createHarita");
            document.getElementById("createHaritaNameInput").focus();
        });
    }
});

// Kaydedilmiş isim
const _savedNameHarita = localStorage.getItem("playerName");
if (_savedNameHarita) {
    document.getElementById("createHaritaNameInput").value = _savedNameHarita;
}

// Oda oluştur butonu
document.getElementById("createHaritaBtn").onclick = () => {
    const name = document.getElementById("createHaritaNameInput").value.trim();
    if (!name) {
        document.getElementById("createHaritaMsg").textContent = "İsim gir.";
        document.getElementById("createHaritaMsg").style.color = "#ff6b6b";
        return;
    }
    localStorage.setItem("playerName", name);
    myName = name;
    
    const turnSec = parseInt(document.getElementById("haritaTurnSecondsSelect").value) || 30;
    send({
        type: "harita_create_room",
        name: name,
        turn_seconds: turnSec
    });
};

document.getElementById("createHaritaBackBtn").onclick = () => {
    showScreen("modselect");
};

// Lobby butonları
document.getElementById("haritaStartBtn").onclick = () => {
    send({ type: "harita_start_game" });
};

document.getElementById("haritaLobbyLeaveBtn").onclick = () => {
    if (confirm("Odadan ayrılmak istediğine emin misin?")) {
        if (ws) ws.close();
        location.reload();
    }
};

const haritaRoomHelper = window.setupRoomCodeAndLink({
    codeTextId: "haritaRoomCodeText",
    codeEyeBtnId: "haritaRoomCodeEyeBtn",
    copyHintId: "haritaCopyHint",
    linkTextId: "haritaInviteLinkText",
    linkEyeBtnId: "haritaInviteLinkEyeBtn",
    linkHintId: "haritaInviteLinkHint",
    getRoomCode: () => haritaData.roomCode
});

// Oyun butonları
document.getElementById("haritaBackBtn").onclick = () => {
    if (confirm("Ana menüye dönmek istediğine emin misin?")) {
        if (ws) ws.close();
        location.reload();
    }
};

document.getElementById("haritaBackToMenuBtn").onclick = () => {
    location.reload();
};

document.getElementById("haritaRematchBtn").onclick = () => {
    document.getElementById("haritaGameOverBox").classList.add("hidden");
    send({ type: "harita_rematch" });
};

// Onay popup
document.getElementById("haritaConfirmYesBtn").onclick = () => {
    if (!haritaData.pendingCode) return;
    send({
        type: "harita_answer",
        country_code: haritaData.pendingCode
    });
    document.getElementById("haritaConfirmBox").classList.add("hidden");
};

document.getElementById("haritaConfirmNoBtn").onclick = () => {
    haritaData.pendingCode = null;
    renderHaritaMarkers();
    document.getElementById("haritaConfirmBox").classList.add("hidden");
};

// ==== ZOOM & PAN ====
const haritaMapWrapper = document.getElementById("haritaMapWrapper");
const haritaWorldMap = document.getElementById("haritaWorldMap");
const haritaMarkersEl = document.getElementById("haritaMarkers");

function applyHaritaTransform() {
    const transform = `translate(${haritaData.panX}px, ${haritaData.panY}px) scale(${haritaData.zoom})`;
    const svgEl = document.getElementById("haritaWorldMap");
    if (svgEl) svgEl.style.transform = transform;
    document.getElementById("haritaZoomLevel").textContent = Math.round(haritaData.zoom * 100) + "%";
}

function updateHaritaMarkerScale() {
    // SVG sisteminde marker scale gerekmez, boş bırakıldı
}

function clampHaritaPan() {
    const rect = haritaMapWrapper.getBoundingClientRect();
    const scaledW = rect.width * haritaData.zoom;
    const scaledH = rect.height * haritaData.zoom;
    const minX = rect.width - scaledW;
    const minY = rect.height - scaledH;
    haritaData.panX = Math.max(minX, Math.min(0, haritaData.panX));
    haritaData.panY = Math.max(minY, Math.min(0, haritaData.panY));
}

function zoomHaritaAt(clientX, clientY, delta) {
    const rect = haritaMapWrapper.getBoundingClientRect();
    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;
    
    const oldZoom = haritaData.zoom;
    let newZoom = Math.max(haritaData.minZoom, Math.min(haritaData.maxZoom, oldZoom + delta));
    if (Math.abs(newZoom - oldZoom) < 0.01) return;
    
    const relX = (mouseX - haritaData.panX) / oldZoom;
    const relY = (mouseY - haritaData.panY) / oldZoom;
    
    haritaData.zoom = newZoom;
    haritaData.panX = mouseX - relX * newZoom;
    haritaData.panY = mouseY - relY * newZoom;
    
    clampHaritaPan();
    applyHaritaTransform();
}

function resetHaritaView() {
    haritaData.zoom = 1.0;
    haritaData.panX = 0;
    haritaData.panY = 0;
    applyHaritaTransform();
}

// Wheel zoom
haritaMapWrapper.addEventListener("wheel", (e) => {
    if (haritaData.currentTurn !== haritaData.playerId) {
        e.preventDefault();
        return;
    }
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.3 : -0.3;
    zoomHaritaAt(e.clientX, e.clientY, delta);
    broadcastHaritaView();
}, { passive: false });

// Sağ tık ile pan
haritaMapWrapper.addEventListener("contextmenu", (e) => {
    e.preventDefault();
});

haritaMapWrapper.addEventListener("mousedown", (e) => {
    if (haritaData.currentTurn !== haritaData.playerId) return;
    if (e.button === 2) {
        haritaData.isPanning = true;
        haritaData.panStartX = e.clientX;
        haritaData.panStartY = e.clientY;
        haritaData.panStartOffsetX = haritaData.panX;
        haritaData.panStartOffsetY = haritaData.panY;
        haritaMapWrapper.style.cursor = "grabbing";
    } else if (e.button === 1) {
        e.preventDefault();
        resetHaritaView();
        broadcastHaritaView();
    }
});

window.addEventListener("mousemove", (e) => {
    if (haritaData.isPanning) {
        const dx = e.clientX - haritaData.panStartX;
        const dy = e.clientY - haritaData.panStartY;
        haritaData.panX = haritaData.panStartOffsetX + dx;
        haritaData.panY = haritaData.panStartOffsetY + dy;
        clampHaritaPan();
        applyHaritaTransform();
        broadcastHaritaViewThrottled();
    }
});

window.addEventListener("mouseup", (e) => {
    if (haritaData.isPanning) {
        haritaData.isPanning = false;
        haritaMapWrapper.style.cursor = "crosshair";
    }
});

// Zoom butonları
document.getElementById("haritaZoomIn").onclick = () => {
    if (haritaData.currentTurn !== haritaData.playerId) return;
    const rect = haritaMapWrapper.getBoundingClientRect();
    zoomHaritaAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 0.3);
    broadcastHaritaView();
};

document.getElementById("haritaZoomOut").onclick = () => {
    if (haritaData.currentTurn !== haritaData.playerId) return;
    const rect = haritaMapWrapper.getBoundingClientRect();
    zoomHaritaAt(rect.left + rect.width / 2, rect.top + rect.height / 2, -0.3);
    broadcastHaritaView();
};

document.getElementById("haritaZoomReset").onclick = () => {
    if (haritaData.currentTurn !== haritaData.playerId) return;
    resetHaritaView();
    broadcastHaritaView();
};

// Harita senkronu
let _haritaBroadcastTimer = null;
function broadcastHaritaView() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    send({
        type: "harita_view_sync",
        zoom: haritaData.zoom,
        pan_x: haritaData.panX,
        pan_y: haritaData.panY
    });
}

function broadcastHaritaViewThrottled() {
    if (_haritaBroadcastTimer) return;
    _haritaBroadcastTimer = setTimeout(() => {
        broadcastHaritaView();
        _haritaBroadcastTimer = null;
    }, 60);
}

// Mouse senkronu
let _haritaMouseThrottleTimer = null;
let _lastMouseX = 0, _lastMouseY = 0;
let _lastHoverCountry = null;

function broadcastHaritaMouse(x, y, countryCode) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    send({
        type: "harita_mouse_sync",
        x: x,
        y: y,
        country: countryCode
    });
}

function broadcastHaritaMouseThrottled(x, y, countryCode) {
    _lastMouseX = x;
    _lastMouseY = y;
    _lastHoverCountry = countryCode;
    if (_haritaMouseThrottleTimer) return;
    _haritaMouseThrottleTimer = setTimeout(() => {
        broadcastHaritaMouse(_lastMouseX, _lastMouseY, _lastHoverCountry);
        _haritaMouseThrottleTimer = null;
    }, 50);
}

haritaMapWrapper.addEventListener("mousemove", (e) => {
    if (haritaData.currentTurn !== haritaData.playerId) return;
    const rect = haritaMapWrapper.getBoundingClientRect();
    
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    
    const mapX = (rawX - haritaData.panX) / (rect.width * haritaData.zoom);
    const mapY = (rawY - haritaData.panY) / (rect.height * haritaData.zoom);
    
    // SVG path'ten ülke kodu bul
    const hovered = document.elementFromPoint(e.clientX, e.clientY);
    let countryCode = null;
    if (hovered && hovered.tagName === "path") {
        // id veya class üzerinden eşleştir
        const pathId = hovered.id;
        const pathClass = hovered.className && hovered.className.baseVal;
        for (const [code, cdata] of Object.entries(haritaData.countries)) {
            if (cdata.iso === pathId || cdata.iso === pathClass) {
                countryCode = code;
                break;
            }
        }
    }
    broadcastHaritaMouseThrottled(mapX, mapY, countryCode);
});

// Timer
function startHaritaTimer(seconds) {
    stopHaritaTimer();
    haritaData.timerSeconds = seconds;
    updateHaritaTimerDisplay();
    haritaData.timerInterval = setInterval(() => {
        haritaData.timerSeconds--;
        updateHaritaTimerDisplay();
        if (haritaData.timerSeconds <= 0) stopHaritaTimer();
    }, 1000);
}

function stopHaritaTimer() {
    if (haritaData.timerInterval) {
        clearInterval(haritaData.timerInterval);
        haritaData.timerInterval = null;
    }
}

function updateHaritaTimerDisplay() {
    const el = document.getElementById("haritaTimer");
    el.textContent = haritaData.timerSeconds + "s";
    el.classList.remove("warning", "danger");
    if (haritaData.timerSeconds <= 5) el.classList.add("danger");
    else if (haritaData.timerSeconds <= 10) el.classList.add("warning");
}

function getHaritaOtherId() {
    return haritaData.playerId === 1 ? 2 : 1;
}

function getHaritaPlayerName(id) {
    const p = haritaData.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function updateHaritaLobby() {
    if (haritaRoomHelper) { haritaRoomHelper.renderCode(); haritaRoomHelper.renderLink(); }
    document.getElementById("haritaLobbyTurnSeconds").textContent = haritaData.turnSeconds || 30;
    
    const list = document.getElementById("haritaPlayersList");
    list.innerHTML = "";
    haritaData.players.forEach(p => {
        const li = document.createElement("li");
        li.textContent = `${p.id}. ${p.name}`;
        if (p.id === haritaData.playerId) {
            li.classList.add("playerMine");
            li.textContent += " (Sen)";
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });
    
    const startBtn = document.getElementById("haritaStartBtn");
    const msg = document.getElementById("haritaLobbyMsg");
    
    if (haritaData.playerId === 1 && haritaData.players.length === 2) {
        startBtn.classList.remove("hidden");
        msg.textContent = "İki oyuncu hazır. Başlatabilirsin!";
        msg.style.color = "#51cf66";
    } else if (haritaData.playerId === 1) {
        startBtn.classList.add("hidden");
        msg.textContent = "Rakip bekleniyor...";
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        msg.textContent = "Host bekleniyor...";
        msg.style.color = "#51cf66";
    }
}

function updateHaritaTopBar() {
    document.getElementById("haritaRoundInfo").textContent = 
        `Tur ${haritaData.roundNo + 1}/${haritaData.totalRounds}`;
    
    const turnName = getHaritaPlayerName(haritaData.currentTurn);
    const turnColor = haritaData.currentTurn === haritaData.playerId ? "#51cf66" : "#ffa94d";
    document.getElementById("haritaTurnInfo").innerHTML = 
        `Sıra: <span style="color:${turnColor}">${turnName}</span>`;
    
    const p1 = getHaritaPlayerName(1);
    const p2 = getHaritaPlayerName(2);
    document.getElementById("haritaP1Name").textContent = p1;
    document.getElementById("haritaP2Name").textContent = p2;
    document.getElementById("haritaScore").textContent = 
        `${haritaData.scores[1]} - ${haritaData.scores[2]}`;
}

function updateHaritaPlayerCard() {
    if (!haritaData.footballer) return;
    const img = document.getElementById("haritaPlayerImg");
    img.src = `/static/images/${haritaData.footballer.img_file}`;
    img.onerror = () => { img.style.opacity = "0.3"; };
    img.onload = () => { img.style.opacity = "1"; };
    document.getElementById("haritaPlayerName").textContent = haritaData.footballer.name;
    
    const statusEl = document.getElementById("haritaPlayerStatus");
    const container = document.getElementById("haritaMapContainer");
    const overlay = document.getElementById("haritaSpectatorOverlay");
    
    if (haritaData.currentTurn === haritaData.playerId) {
        statusEl.textContent = "Ülkesini haritada bul!";
        statusEl.style.color = "#51cf66";
        container.classList.remove("spectator");
        overlay.classList.add("hidden");
    } else {
        const oppName = getHaritaPlayerName(haritaData.currentTurn);
        statusEl.textContent = `${oppName} oynuyor...`;
        statusEl.style.color = "#ff6b6b";
        container.classList.add("spectator");
        overlay.classList.remove("hidden");
    }
    
    document.getElementById("haritaCorrectAnswer").classList.add("hidden");
}

function showHaritaBigOverlay(text, type, duration) {
    const overlay = document.getElementById("haritaBigOverlay");
    const textEl = document.getElementById("haritaBigOverlayText");
    textEl.textContent = text;
    overlay.classList.remove("hidden", "correct", "wrong", "turn");
    if (type) overlay.classList.add(type);
    if (duration) {
        setTimeout(() => {
            overlay.classList.add("hidden");
        }, duration);
    }
}

function hideHaritaBigOverlay() {
    document.getElementById("haritaBigOverlay").classList.add("hidden");
}

function showHaritaCorrectAnswer(countryTr) {
    const el = document.getElementById("haritaCorrectAnswer");
    el.innerHTML = `<span class="cavLabel">DOĞRU CEVAP</span>🌍 ${countryTr}`;
    el.classList.remove("hidden");
}

function flyHaritaToCountry(code) {
    if (!code || !haritaData.countries[code]) return;
    const cdata = haritaData.countries[code];
    const rect = haritaMapWrapper.getBoundingClientRect();
    
    const targetZoom = 3.5;
    haritaData.zoom = targetZoom;
    
    haritaData.panX = rect.width / 2 - cdata.x * rect.width * targetZoom;
    haritaData.panY = rect.height / 2 - cdata.y * rect.height * targetZoom;
    
    clampHaritaPan();
    applyHaritaTransform();
}

function setHaritaStatus(text, type) {
    const el = document.getElementById("haritaStatusMsg");
    el.textContent = text || "";
    el.classList.remove("correct", "wrong", "info");
    if (type) el.classList.add(type);
}

function renderHaritaMarkers() {
    const isMyTurn = haritaData.currentTurn === haritaData.playerId;
    const canClick = isMyTurn && !haritaData.answered;

    // Önce tüm path'leri sıfırla
    const allPaths = document.querySelectorAll("#haritaWorldMap path");
    allPaths.forEach(p => {
        p.classList.remove("haritaCorrect", "haritaWrong", "haritaPending", "haritaClickable");
        p.onclick = null;
        p.onmouseenter = null;
        p.onmousemove = null;
        p.onmouseleave = null;
        p.style.cursor = "";
    });

    // Sadece oyundaki ülkeleri yönet
    Object.entries(haritaData.countries).forEach(([code, cdata]) => {
        // SVG'de bu ülkenin path'lerini bul (id veya class)
        let parts = [];
        const byId = document.getElementById(cdata.iso);
        if (byId) {
            parts = [byId];
        } else {
            parts = Array.from(document.querySelectorAll("#haritaWorldMap ." + CSS.escape(cdata.iso)));
        }

        if (parts.length === 0) return;

        parts.forEach(part => {
            // Durum sınıfları
            if (code === haritaData.lastCorrectCode) {
                part.classList.add("haritaCorrect");
            } else if (code === haritaData.lastSelectedCode && code !== haritaData.lastCorrectCode) {
                part.classList.add("haritaWrong");
            } else if (code === haritaData.pendingCode) {
                part.classList.add("haritaPending");
            }

            // Tıklanabilir mi
            if (canClick) {
                part.classList.add("haritaClickable");
                part.style.cursor = "pointer";
                part.onclick = (e) => {
                    e.stopPropagation();
                    haritaData.pendingCode = code;
                    renderHaritaMarkers(); // pending rengi göster
                    document.getElementById("haritaConfirmCountry").textContent = cdata.tr;
                    document.getElementById("haritaConfirmBox").classList.remove("hidden");
                };
            }

            // Tooltip
            part.onmouseenter = (e) => showHaritaTooltip(cdata.tr, e);
            part.onmousemove = (e) => moveHaritaTooltip(e);
            part.onmouseleave = () => hideHaritaTooltip();
        });
    });
}

function showHaritaTooltip(text, e) {
    const tooltip = document.getElementById("haritaTooltip");
    tooltip.textContent = text;
    tooltip.classList.remove("hidden");
    moveHaritaTooltip(e);
}

function moveHaritaTooltip(e) {
    const tooltip = document.getElementById("haritaTooltip");
    tooltip.style.left = (e.clientX + 15) + "px";
    tooltip.style.top = (e.clientY - 30) + "px";
}

function hideHaritaTooltip() {
    document.getElementById("haritaTooltip").classList.add("hidden");
}

function renderHaritaAll() {
    updateHaritaTopBar();
    updateHaritaPlayerCard();
    renderHaritaMarkers();
}

// Mesaj handler wrap
const _prevHandleMessageHarita = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "harita_room_created" || msg.type === "harita_room_joined") {
        haritaData.playerId = msg.player_id;
        haritaData.roomCode = msg.room_code;
        haritaData.turnSeconds = msg.turn_seconds || 30;
        haritaData.inGame = true;
        inRoom = true;
        showScreen("haritaLobby");
        updateHaritaLobby();
        return;
    }
    
    if (msg.type === "harita_lobby_update") {
        haritaData.roomCode = msg.room_code;
        haritaData.players = msg.players;
        haritaData.turnSeconds = msg.turn_seconds || 30;
        updateHaritaLobby();
        return;
    }
    
    if (msg.type === "harita_game_started") {
        haritaData.playerId = msg.player_id;
        haritaData.players = msg.players;
        haritaData.turnSeconds = msg.turn_seconds;
        haritaData.totalRounds = msg.total_rounds;
        haritaData.currentTurn = msg.current_turn;
        haritaData.roundNo = msg.round_no;
        haritaData.footballer = msg.footballer;
        haritaData.countries = msg.countries;
        haritaData.scores = msg.scores;
        haritaData.answered = false;
        haritaData.pendingCode = null;
        haritaData.lastSelectedCode = null;
        haritaData.lastCorrectCode = null;
        
        showScreen("haritaGame");
        resetHaritaView();
        applyHaritaTransform();
        renderHaritaAll();
        setHaritaStatus("");
        startHaritaTimer(haritaData.turnSeconds);
        return;
    }
    
    if (msg.type === "harita_new_round") {
        haritaData.roundNo = msg.round_no;
        haritaData.totalRounds = msg.total_rounds;
        haritaData.currentTurn = msg.current_turn;
        haritaData.footballer = msg.footballer;
        haritaData.scores = msg.scores;
        haritaData.answered = false;
        haritaData.pendingCode = null;
        haritaData.lastSelectedCode = null;
        haritaData.lastCorrectCode = null;
        
        document.getElementById("haritaFakeCursor").classList.add("hidden");
        document.getElementById("haritaFakeTooltip").classList.add("hidden");
        document.getElementById("haritaCorrectBanner").classList.add("hidden");
        document.getElementById("haritaCorrectAnswer").classList.add("hidden");
        hideHaritaBigOverlay();
        
        // SVG path'leri temizle
        const allPaths = document.querySelectorAll("#haritaWorldMap path");
        allPaths.forEach(p => {
            p.classList.remove("haritaCorrect", "haritaWrong", "haritaPending", "haritaClickable");
        });
        
        resetHaritaView();
        if (haritaData.currentTurn === haritaData.playerId) {
            broadcastHaritaView();
        }
        
        renderHaritaAll();
        setHaritaStatus("");
        
        if (haritaData.currentTurn === haritaData.playerId) {
            showHaritaBigOverlay("SIRA SENDE!", "turn", 1800);
        } else {
            const oppName = getHaritaPlayerName(haritaData.currentTurn);
            showHaritaBigOverlay(`${oppName.toUpperCase()} OYNUYOR`, "wrong", 1800);
        }
        
        setTimeout(() => {
            startHaritaTimer(haritaData.turnSeconds);
        }, 1800);
        
        return;
    }
	
	if (msg.type === "harita_view_sync") {
        if (msg.player_id === haritaData.playerId) return;
        haritaData.zoom = msg.zoom;
        haritaData.panX = msg.pan_x;
        haritaData.panY = msg.pan_y;
        applyHaritaTransform();
        return;
    }
	
	if (msg.type === "harita_mouse_sync") {
        if (msg.player_id === haritaData.playerId) return;
        const cursor = document.getElementById("haritaFakeCursor");
        const tooltip = document.getElementById("haritaFakeTooltip");
        const rect = haritaMapWrapper.getBoundingClientRect();
        
        const localX = msg.x * rect.width * haritaData.zoom + haritaData.panX;
        const localY = msg.y * rect.height * haritaData.zoom + haritaData.panY;
        
        cursor.style.left = localX + "px";
        cursor.style.top = localY + "px";
        cursor.classList.remove("hidden");
        
        if (msg.country && haritaData.countries[msg.country]) {
            tooltip.textContent = haritaData.countries[msg.country].tr;
            tooltip.classList.remove("hidden");
            tooltip.style.left = (rect.left + localX + 15) + "px";
            tooltip.style.top = (rect.top + localY - 30) + "px";
        } else {
            tooltip.classList.add("hidden");
        }
        return;
    }
    
    if (msg.type === "harita_answer_result") {
        haritaData.answered = true;
        haritaData.scores = msg.scores;
        haritaData.lastSelectedCode = msg.selected_code;
        haritaData.lastCorrectCode = msg.correct_code;
        stopHaritaTimer();
        
        const playerName = getHaritaPlayerName(msg.player_id);
        let statusText = "";
        let statusType = "info";
        
        if (msg.timeout) {
            statusText = `⏰ ${playerName} süresi doldu!`;
            statusType = "wrong";
        } else if (msg.correct) {
            statusText = `✓ ${playerName} doğru bildi!`;
            statusType = "correct";
        } else {
            statusText = `✗ ${playerName} yanlış tahmin: ${msg.selected_tr}`;
            statusType = "wrong";
        }
        
        setHaritaStatus(statusText, statusType);
        renderHaritaMarkers();
        updateHaritaTopBar();
        
        if (msg.correct) {
            showHaritaBigOverlay("✓ DOĞRU", "correct", 2500);
        } else {
            showHaritaBigOverlay("✗ YANLIŞ", "wrong", 2500);
        }
        
        if (!msg.correct && msg.correct_tr) {
            showHaritaCorrectAnswer(msg.correct_tr);
        }
        
        setTimeout(() => {
            flyHaritaToCountry(msg.correct_code);
            if (haritaData.currentTurn === haritaData.playerId) {
                broadcastHaritaView();
            }
        }, 500);
        
        return;
    }
    
    if (msg.type === "harita_game_over") {
        haritaData.scores = msg.scores;
        stopHaritaTimer();
        updateHaritaTopBar();
        
        const title = document.getElementById("haritaGameOverTitle");
        const text = document.getElementById("haritaGameOverText");
        
        if (msg.winner_id === 0) {
            title.textContent = "BERABERE!";
            title.style.color = "#74c0fc";
        } else if (msg.winner_id === haritaData.playerId) {
            title.textContent = "KAZANDIN! 🏆";
            title.style.color = "#51cf66";
            startConfetti();
        } else {
            title.textContent = "KAYBETTİN 😢";
            title.style.color = "#ff6b6b";
        }
        
        const p1 = getHaritaPlayerName(1);
        const p2 = getHaritaPlayerName(2);
        text.innerHTML = `
            <div style="font-size:20px; margin:15px 0;">
                <span style="color:#51cf66;">${p1}</span>: <b>${haritaData.scores[1]}</b><br>
                <span style="color:#ff6b6b;">${p2}</span>: <b>${haritaData.scores[2]}</b>
            </div>
        `;
        
        const rematchBtn = document.getElementById("haritaRematchBtn");
        if (haritaData.playerId === 1) {
            rematchBtn.classList.remove("hidden");
        } else {
            rematchBtn.classList.add("hidden");
        }
        
        document.getElementById("haritaGameOverBox").classList.remove("hidden");
        return;
    }
    
    _prevHandleMessageHarita(msg);
};

// room_mode_result için harita desteği
const _origHandleForModeHarita = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "room_mode_result") {
        if (!msg.found) {
            setMsg(joinMsg, "Oda bulunamadı.", "#ff6b6b");
            return;
        }
        const name = joinNameInput.value.trim();
        const code = msg.room_code;
        if (msg.mode === "takim_bilmece") {
            send({ type: "takim_join_room", name: name, room_code: code });
        } else if (msg.mode === "kim_milyoner") {
            send({ type: "ml_join_room", name: name, room_code: code });
        } else if (msg.mode === "haritadan_bul") {
            send({ type: "harita_join_room", name: name, room_code: code });
        } else {
            send({ type: "join_room", name: name, room_code: code });
        }
        return;
    }
    _origHandleForModeHarita(msg);
};

// Başlangıçta popup'ları kapat
document.getElementById("haritaGameOverBox").classList.add("hidden");
document.getElementById("haritaConfirmBox").classList.add("hidden");

