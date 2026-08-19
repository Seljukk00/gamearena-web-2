// ==========================================
// HARITADAN BUL - MODÜL JS
// ==========================================

let haritaData = {
    inGame: false,
    playerId: null,
    roomCode: "",
    players: [],
    turnSeconds: 30,
    difficulty: "karisik",
    maxPlayers: 2,
    totalRounds: 10,
    currentTurn: null,
    roundNo: 0,
    footballer: null,
    countries: {},
    scores: {},
    answered: false,
    pendingCode: null,
    lastSelectedCode: null,
    lastCorrectCode: null,
    timerInterval: null,
    timerSeconds: 30,
    roundStarting: false,
    zoom: 1.0,
    minZoom: 1.0,
    maxZoom: 20.0,
    panX: 0,
    panY: 0,
    isPanning: false,
    panStartX: 0,
    panStartY: 0,
    panStartOffsetX: 0,
    panStartOffsetY: 0
};

// ========================================
// 💬 HARİTADAN BUL CHAT
// ========================================
let haritaChat = {
    open: false,
    unread: 0,
    messages: [],
    maxMessages: 50
};

// ✨ 2-5 kişi için farklı renk paleti
const HARITA_CHAT_COLORS = ["#ff8a8a", "#7abfff", "#51cf66", "#ffd43b", "#c084fc"];

function getHaritaChatColor(pid) {
    if (!pid) return "#adb5bd";
    const idx = (pid - 1) % HARITA_CHAT_COLORS.length;
    return HARITA_CHAT_COLORS[idx];
}

function showHaritaChat() {
    const c = document.getElementById("haritaChatContainer");
    if (c) c.style.display = "block";
}

function hideHaritaChat() {
    const c = document.getElementById("haritaChatContainer");
    if (c) c.style.display = "none";
    closeHaritaChatPanel();
    haritaChat.messages = [];
    haritaChat.unread = 0;
    const box = document.getElementById("haritaChatMessages");
    if (box) box.innerHTML = "";
    clearHaritaChatPopups();
}

function toggleHaritaChatPanel() {
    if (haritaChat.open) closeHaritaChatPanel();
    else openHaritaChatPanel();
}

function openHaritaChatPanel() {
    haritaChat.open = true;
    haritaChat.unread = 0;
    const panel = document.getElementById("haritaChatPanel");
    const badge = document.getElementById("haritaChatBadge");
    if (panel) panel.style.setProperty("display", "flex", "important");
    if (badge) badge.style.display = "none";
    clearHaritaChatPopups();
    const box = document.getElementById("haritaChatMessages");
    if (box) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
    const input = document.getElementById("haritaChatInput");
    if (input) setTimeout(() => input.focus(), 100);
    setTimeout(() => {
        document.addEventListener("mousedown", haritaChatOutsideClickHandler, true);
    }, 100);
}

function closeHaritaChatPanel() {
    haritaChat.open = false;
    const panel = document.getElementById("haritaChatPanel");
    if (panel) panel.style.display = "none";
    document.removeEventListener("mousedown", haritaChatOutsideClickHandler, true);
    const input = document.getElementById("haritaChatInput");
    if (input && input.value) input.value = "";
}

function haritaChatOutsideClickHandler(e) {
    const c = document.getElementById("haritaChatContainer");
    if (!c) return;
    if (c.contains(e.target)) return;
    closeHaritaChatPanel();
}

function sendHaritaChatMessage() {
    const input = document.getElementById("haritaChatInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text || text.length > 100) return;
    input.value = "";
    send({ type: "harita_chat_send", text: text });
}

function showHaritaChatPopup(msg) {
    if (haritaChat.open) return;
    const stack = document.getElementById("haritaChatPopupStack");
    if (!stack) return;
    stack.style.display = "flex";
    
    const color = getHaritaChatColor(msg.sender_id);
    
    const popup = document.createElement("div");
    popup.className = "miniChatPopup";
    popup.style.borderLeftColor = color;
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "miniChatPopupName";
    nameSpan.style.color = color;
    nameSpan.textContent = msg.sender_name;
    
    const textSpan = document.createElement("span");
    textSpan.className = "miniChatPopupText";
    textSpan.textContent = msg.text;
    
    popup.appendChild(nameSpan);
    popup.appendChild(textSpan);
    stack.appendChild(popup);
    
    while (stack.children.length > 5) stack.removeChild(stack.firstChild);
    
    setTimeout(() => {
        popup.classList.add("leaving");
        setTimeout(() => {
            if (popup.parentNode) popup.parentNode.removeChild(popup);
            if (stack.children.length === 0) stack.style.display = "none";
        }, 350);
    }, 3000);
}

function clearHaritaChatPopups() {
    const stack = document.getElementById("haritaChatPopupStack");
    if (!stack) return;
    stack.innerHTML = "";
    stack.style.display = "none";
}

function addHaritaChatMessage(msg) {
    haritaChat.messages.push(msg);
    if (haritaChat.messages.length > haritaChat.maxMessages) haritaChat.messages.shift();
    
    const box = document.getElementById("haritaChatMessages");
    if (!box) return;
    
    const div = document.createElement("div");
    div.className = "miniChatMsg";
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "chatName";
    nameSpan.style.color = getHaritaChatColor(msg.sender_id);
    nameSpan.textContent = msg.sender_name + ":";
    
    const textSpan = document.createElement("span");
    textSpan.className = "chatText";
    textSpan.textContent = " " + msg.text;
    
    div.appendChild(nameSpan);
    div.appendChild(textSpan);
    box.appendChild(div);
    
    while (box.children.length > haritaChat.maxMessages) box.removeChild(box.firstChild);
    
    if (haritaChat.open) {
        box.scrollTop = box.scrollHeight;
    } else {
        haritaChat.unread++;
        const badge = document.getElementById("haritaChatBadge");
        if (badge) {
            badge.textContent = haritaChat.unread;
            badge.style.display = "flex";
            badge.style.animation = "none";
            badge.offsetHeight;
            badge.style.animation = "chatBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        }
        showHaritaChatPopup(msg);
    }
}

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
    
    // 💬 Haritadan Bul chat: sadece haritaLobby/haritaGame'de görünür
    const haritaScreens = ["haritaLobby", "haritaGame"];
    if (!haritaScreens.includes(screenName)) {
        hideHaritaChat();
    }
};

// Mod kartına tıklama
document.querySelectorAll(".mod-card:not(.mod-disabled)").forEach(card => {
    const mod = card.dataset.mod;
    if (mod === "haritadan_bul") {
        card.addEventListener("click", () => {
            // ✨ Normal giriş: isim + buton normale döndür
            const nameInput = document.getElementById("createHaritaNameInput");
            if (nameInput) {
                const nameBox = nameInput.closest(".centerBox");
                if (nameBox) nameBox.style.display = "";
            }
            const createBtnEl = document.getElementById("createHaritaBtn");
            if (createBtnEl) createBtnEl.textContent = "Oda Oluştur";
            window._pendingModeChangeCtx = null;

            showScreen("createHarita");
            if (nameInput) nameInput.focus();
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
    const nameInput = document.getElementById("createHaritaNameInput");
    const enteredName = nameInput ? nameInput.value.trim() : "";
    const msgEl = document.getElementById("createHaritaMsg");

    const turnSec = parseInt(document.getElementById("haritaTurnSecondsSelect").value);
    const difficulty = document.getElementById("haritaDifficultySelect").value || "karisik";
    const maxPlayers = parseInt(document.getElementById("haritaMaxPlayersSelect").value) || 2;
    const totalRounds = parseInt(document.getElementById("haritaTotalRoundsSelect").value) || 10;

    // ✨ MOD DEĞİŞİMİ mi?
    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.newMode === "haritadan_bul" && pendingModeChange.createScreen === "createHarita") {
        console.log("[MODE CHANGE] Haritadan Bul için mod_change_room gönderiliyor");
        if (msgEl) {
            msgEl.textContent = "Mod değiştiriliyor...";
            msgEl.style.color = "#51cf66";
        }
        send({
            type: "mod_change_room",
            new_mode: "haritadan_bul",
            mode_settings: {
                turn_seconds: isNaN(turnSec) ? 30 : turnSec,
                difficulty: difficulty,
                max_players: maxPlayers,
                total_rounds: totalRounds
            }
        });
        return;
    }

    // Normal akış
    if (!enteredName) {
        if (msgEl) {
            msgEl.textContent = "İsim gir.";
            msgEl.style.color = "#ff6b6b";
        }
        return;
    }
    localStorage.setItem("playerName", enteredName);
    myName = enteredName;

    send({
        type: "harita_create_room",
        name: enteredName,
        turn_seconds: turnSec,
        difficulty: difficulty,
        max_players: maxPlayers,
        total_rounds: totalRounds
    });
};

document.getElementById("createHaritaBackBtn").onclick = () => {
    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.newMode === "haritadan_bul" && pendingModeChange.createScreen === "createHarita") {
        const returnScreen = pendingModeChange.returnScreen || "haritaLobby";
        window._pendingModeChangeCtx = null;
        const msgEl = document.getElementById("createHaritaMsg");
        if (msgEl) msgEl.textContent = "";

        showScreen(returnScreen);

        setTimeout(() => {
            if (typeof openChangeModeModal === "function") openChangeModeModal();
        }, 200);
        return;
    }
    showScreen("modselect");
};

// Lobby butonları
document.getElementById("haritaStartBtn").onclick = () => {
    send({ type: "harita_start_game" });
};

document.getElementById("haritaLobbyLeaveBtn").onclick = () => {
    window._showLeaveConfirmPopup();
};

// ✨ Mod Değiştir butonu
const _haritaChangeModeBtn = document.getElementById("haritaChangeModeBtn");
if (_haritaChangeModeBtn) {
    _haritaChangeModeBtn.onclick = () => {
        if (typeof openChangeModeModal === "function") {
            openChangeModeModal();
        }
    };
}

// Oda Ayarları butonu
document.getElementById("haritaRoomSettingsBtn").onclick = () => {
    window.openRoomSettingsGeneric({
        title: "Haritadan Bul - Oda Ayarları",
        fields: [
            {
                id: "maxPlayers",
                label: "👥 Oyuncu Sayısı",
                current: haritaData.maxPlayers || 2,
                minValue: (haritaData.players && haritaData.players.length > 2) ? haritaData.players.length : null,
                options: [
                    {value: 2, label: "2 Oyuncu"},
                    {value: 3, label: "3 Oyuncu"},
                    {value: 4, label: "4 Oyuncu"},
                    {value: 5, label: "5 Oyuncu"}
                ]
            },
            {
                id: "totalRounds",
                label: "🔢 Tur Sayısı",
                current: haritaData.totalRounds || 10,
                options: [
                    {value: 5, label: "5 Tur"},
                    {value: 10, label: "10 Tur"},
                    {value: 15, label: "15 Tur"},
                    {value: 20, label: "20 Tur"}
                ]
            },
            {
                id: "difficulty",
                label: "🎯 Zorluk",
                current: haritaData.difficulty || "karisik",
                options: [
                    {value: "kolay", label: "🟢 Kolay"},
                    {value: "orta", label: "🟡 Orta"},
                    {value: "zor", label: "🔴 Zor"},
                    {value: "karisik", label: "🎯 Karışık (Progresif)"}
                ]
            },
            {
                id: "turnSec",
                label: "⏱️ Tur Süresi",
                current: haritaData.turnSeconds,
                options: [
                    {value: 15, label: "15 saniye"},
                    {value: 20, label: "20 saniye"},
                    {value: 30, label: "30 saniye"},
                    {value: 45, label: "45 saniye"},
                    {value: 60, label: "60 saniye"},
                    {value: 90, label: "90 saniye"},
                    {value: 120, label: "120 saniye"},
                    {value: 0, label: "♾️ Sınırsız"}
                ]
            }
        ],
        onSave: (values) => {
            send({
                type: "harita_update_settings",
                turn_seconds: parseInt(values.turnSec),
                difficulty: values.difficulty,
                max_players: parseInt(values.maxPlayers) || 2,
                total_rounds: parseInt(values.totalRounds) || 10
            });
        }
    });
};

const haritaRoomHelper = window.setupRoomCodeAndLink({
    codeTextId: "haritaRoomCodeText",
    codeEyeBtnId: "haritaRoomCodeEyeBtn",
    copyHintId: "haritaCopyHint",
    linkTextId: "haritaInviteLinkText",
    linkEyeBtnId: "haritaInviteLinkEyeBtn",
    linkHintId: "haritaInviteLinkHint",
    getRoomCode: () => haritaData.roomCode,
    getPlayerId: () => haritaData.playerId
});

// Oyun butonları
document.getElementById("haritaBackBtn").onclick = () => {
    showEscPopup();
};

document.getElementById("haritaBackToMenuBtn").onclick = () => {
    location.reload();
};

document.getElementById("haritaRematchBtn").onclick = () => {
    document.getElementById("haritaGameOverBox").classList.add("hidden");
    send({ type: "harita_rematch" });
};

document.getElementById("haritaBackToLobbyBtn").onclick = () => {
    send({ type: "harita_back_to_lobby" });
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
    // SVG sisteminde marker scale gerekmez
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
    const delta = e.deltaY < 0 ? 1.0 : -1.0;
    zoomHaritaAt(e.clientX, e.clientY, delta);
    broadcastHaritaView();
}, { passive: false });

// Sağ tık pan
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
        hideHaritaTooltip();
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
    zoomHaritaAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.0);
    broadcastHaritaView();
};

document.getElementById("haritaZoomOut").onclick = () => {
    if (haritaData.currentTurn !== haritaData.playerId) return;
    const rect = haritaMapWrapper.getBoundingClientRect();
    zoomHaritaAt(rect.left + rect.width / 2, rect.top + rect.height / 2, -1.0);
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
    
    const tooltip = document.getElementById("haritaTooltip");
    const fakeCursor = document.getElementById("haritaFakeCursor");
    const fakeTooltip = document.getElementById("haritaFakeTooltip");
    const _tOld = tooltip.style.pointerEvents;
    const _fcOld = fakeCursor ? fakeCursor.style.pointerEvents : null;
    const _ftOld = fakeTooltip ? fakeTooltip.style.pointerEvents : null;
    tooltip.style.pointerEvents = "none";
    if (fakeCursor) fakeCursor.style.pointerEvents = "none";
    if (fakeTooltip) fakeTooltip.style.pointerEvents = "none";
    
    const hovered = document.elementFromPoint(e.clientX, e.clientY);
    
    tooltip.style.pointerEvents = _tOld;
    if (fakeCursor) fakeCursor.style.pointerEvents = _fcOld;
    if (fakeTooltip) fakeTooltip.style.pointerEvents = _ftOld;
    
    let countryCode = null;
    let countryTr = null;
    if (hovered && hovered.tagName === "path") {
        const pathId = hovered.id;
        const pathClass = hovered.className && hovered.className.baseVal;
        for (const [code, cdata] of Object.entries(haritaData.countries)) {
            if (cdata.iso === pathId || cdata.iso === pathClass) {
                countryCode = code;
                countryTr = cdata.tr;
                break;
            }
        }
    }
    
    tooltip.classList.add("hidden");
    
    broadcastHaritaMouseThrottled(mapX, mapY, countryCode);
});

haritaMapWrapper.addEventListener("mouseleave", (e) => {
    if (haritaData.currentTurn !== haritaData.playerId) return;
    broadcastHaritaMouse(-999, -999, null);
});

// Timer
function startHaritaTimer(seconds) {
    stopHaritaTimer();
    haritaData.timerSeconds = seconds;
    haritaData.timerUnlimited = (seconds === 0);
    updateHaritaTimerDisplay();
    if (haritaData.timerUnlimited) return;
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
    if (haritaData.timerUnlimited) {
        el.textContent = "♾️";
        el.classList.remove("warning", "danger");
        return;
    }
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

function isHaritaMultiPlayer() {
    return (haritaData.maxPlayers || 2) >= 3;
}

function updateHaritaLobby() {
    if (haritaRoomHelper) { haritaRoomHelper.renderCode(); haritaRoomHelper.renderLink(); }
    const _ts = haritaData.turnSeconds;
    document.getElementById("haritaLobbyTurnSeconds").textContent = (_ts === 0) ? "♾️" : _ts;
    
    const _maxEl = document.getElementById("haritaLobbyMaxPlayers");
    if (_maxEl) _maxEl.textContent = haritaData.maxPlayers || 2;
    const _totEl = document.getElementById("haritaLobbyTotalRounds");
    if (_totEl) _totEl.textContent = haritaData.totalRounds || 10;
    
    const diffNames = {
        "kolay": "🟢 Kolay",
        "orta": "🟡 Orta",
        "zor": "🔴 Zor",
        "karisik": "🎯 Karışık"
    };
    const diffEl = document.getElementById("haritaLobbyDifficulty");
    if (diffEl) {
        diffEl.textContent = diffNames[haritaData.difficulty] || "🎯 Karışık";
    }
    
    const list = document.getElementById("haritaPlayersList");
    list.innerHTML = "";
    haritaData.players.forEach(p => {
        const li = document.createElement("li");
        
        const nameCell = document.createElement("span");
        nameCell.style.flex = "1";
        nameCell.style.textAlign = "left";
        nameCell.style.paddingLeft = "10px";
        const crown = p.id === 1 ? " 👑" : "";
        nameCell.textContent = p.id === haritaData.playerId ? `${p.id}. ${p.name} (Sen)${crown}` : `${p.id}. ${p.name}${crown}`;
        li.appendChild(nameCell);
        
        if (p.id !== haritaData.playerId && haritaData.playerId === 1) {
            const kickBtn = document.createElement("button");
            kickBtn.className = "kickBtnNew";
            kickBtn.textContent = "Oyuncuyu At";
            kickBtn.onclick = () => openKickConfirm(p.id, p.name);
            li.appendChild(kickBtn);
        }
        
        if (p.id === haritaData.playerId) {
            li.classList.add("playerMine");
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });
    
    const startBtn = document.getElementById("haritaStartBtn");
    const msg = document.getElementById("haritaLobbyMsg");
    const maxP = haritaData.maxPlayers || 2;
    const curP = haritaData.players.length;
    
    if (haritaData.playerId === 1 && curP === maxP) {
        startBtn.classList.remove("hidden");
        msg.textContent = `${maxP} oyuncu hazır. Başlatabilirsin!`;
        msg.style.color = "#51cf66";
    } else if (haritaData.playerId === 1) {
        startBtn.classList.add("hidden");
        msg.textContent = `Oyuncu bekleniyor... (${curP}/${maxP})`;
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        msg.textContent = `Host bekleniyor... (${curP}/${maxP})`;
        msg.style.color = "#51cf66";
    }
    
    const settingsBtn = document.getElementById("haritaRoomSettingsBtn");
    if (settingsBtn) {
        if (haritaData.playerId === 1) settingsBtn.classList.remove("hidden");
        else settingsBtn.classList.add("hidden");
    }
    
    // ✨ Mod Değiştir butonu - sadece host görsün
    const changeModeBtn = document.getElementById("haritaChangeModeBtn");
    if (changeModeBtn) {
        if (haritaData.playerId === 1) changeModeBtn.classList.remove("hidden");
        else changeModeBtn.classList.add("hidden");
    }
}

function updateHaritaTopBar() {
    document.getElementById("haritaRoundInfo").textContent = 
        `Tur ${haritaData.roundNo + 1}/${haritaData.totalRounds}`;
    
    const turnName = getHaritaPlayerName(haritaData.currentTurn);
    const turnColor = haritaData.currentTurn === haritaData.playerId ? "#51cf66" : "#ffa94d";
    document.getElementById("haritaTurnInfo").innerHTML = 
        `Sıra: <span style="color:${turnColor}">${turnName}</span>`;
    
    const isMulti = isHaritaMultiPlayer();
    const scoreboard2P = document.getElementById("haritaScoreboard2P");
    const scoreboardPanel = document.getElementById("haritaScoreboardPanel");
    
    if (isMulti) {
        // 3+ kişi: üst skorbord gizle, sağ paneli göster
        if (scoreboard2P) scoreboard2P.style.visibility = "hidden";
        if (scoreboardPanel) scoreboardPanel.style.display = "";
    } else {
        // 2 kişi: eski davranış
        if (scoreboard2P) scoreboard2P.style.visibility = "";
        if (scoreboardPanel) scoreboardPanel.style.display = "none";
        
        const p1 = getHaritaPlayerName(1);
        const p2 = getHaritaPlayerName(2);
        document.getElementById("haritaP1Name").textContent = p1;
        document.getElementById("haritaP2Name").textContent = p2;
        document.getElementById("haritaScore").textContent = 
            `${haritaData.scores[1] || 0} - ${haritaData.scores[2] || 0}`;
    }
    
    // Multi modda skorbord render
    if (isMulti) renderHaritaScoreboardList();
}

function renderHaritaScoreboardList() {
    const listEl = document.getElementById("haritaScoreboardList");
    if (!listEl) return;
    
    const rows = haritaData.players.map(p => ({
        id: p.id,
        name: p.name,
        score: haritaData.scores[p.id] ?? 0
    }));
    rows.sort((a, b) => b.score - a.score);
    
    // FLIP animasyonu için eski pozisyonları al
    const oldPositions = {};
    Array.from(listEl.children).forEach(li => {
        const pid = parseInt(li.dataset.pid);
        oldPositions[pid] = li.getBoundingClientRect().top;
    });
    
    listEl.innerHTML = "";
    rows.forEach((row, idx) => {
        const li = document.createElement("li");
        li.dataset.pid = row.id;
        li.className = "haritaScoreRow";
        if (row.id === haritaData.currentTurn) li.classList.add("activeTurn");
        if (row.id === haritaData.playerId) li.classList.add("meRow");
        
        const rankBadge = document.createElement("span");
        rankBadge.className = "haritaRankBadge";
        const medals = ["🥇", "🥈", "🥉"];
        rankBadge.textContent = medals[idx] || `${idx + 1}.`;
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "haritaScoreName";
        nameSpan.textContent = row.name + (row.id === haritaData.playerId ? " (Sen)" : "");
        
        const scoreSpan = document.createElement("span");
        scoreSpan.className = "haritaScoreVal";
        if (row.score < 0) scoreSpan.classList.add("negative");
        scoreSpan.textContent = row.score;
        
        li.appendChild(rankBadge);
        li.appendChild(nameSpan);
        li.appendChild(scoreSpan);
        listEl.appendChild(li);
    });
    
    // FLIP animasyonu
    Array.from(listEl.children).forEach(li => {
        const pid = parseInt(li.dataset.pid);
        const newTop = li.getBoundingClientRect().top;
        const oldTop = oldPositions[pid];
        if (oldTop !== undefined && oldTop !== newTop) {
            const diff = oldTop - newTop;
            li.style.transform = `translateY(${diff}px)`;
            li.style.transition = "none";
            requestAnimationFrame(() => {
                li.style.transform = "";
                li.style.transition = "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)";
            });
        }
    });
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
    
    const targetZoom = 5.0;
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

    const allPaths = document.querySelectorAll("#haritaWorldMap path");
    allPaths.forEach(p => {
        p.classList.remove("haritaCorrect", "haritaWrong", "haritaPending", "haritaClickable");
        p.onclick = null;
        p.onmouseenter = null;
        p.onmousemove = null;
        p.onmouseleave = null;
        p.style.cursor = "";
    });

    const boundPaths = new Set();

    Object.entries(haritaData.countries).forEach(([code, cdata]) => {
        let parts = [];
        const byId = document.getElementById(cdata.iso);
        if (byId) {
            parts = [byId];
        } else {
            parts = Array.from(document.querySelectorAll("#haritaWorldMap ." + CSS.escape(cdata.iso)));
        }

        if (parts.length === 0) return;
        
        const pathKey = cdata.iso;
        if (boundPaths.has(pathKey)) {
            return;
        }
        boundPaths.add(pathKey);

        parts.forEach(part => {
            if (code === haritaData.lastCorrectCode) {
                part.classList.add("haritaCorrect");
            } else if (code === haritaData.lastSelectedCode && code !== haritaData.lastCorrectCode) {
                part.classList.add("haritaWrong");
            } else if (code === haritaData.pendingCode) {
                part.classList.add("haritaPending");
            }

            if (canClick) {
                part.classList.add("haritaClickable");
                part.style.cursor = "pointer";
                part.onclick = (e) => {
                    e.stopPropagation();
                    haritaData.pendingCode = code;
                    renderHaritaMarkers();
                    document.getElementById("haritaConfirmCountry").textContent = cdata.tr;
                    document.getElementById("haritaConfirmBox").classList.remove("hidden");
                };
            }
        });
    });
}

function showHaritaTooltip(text, e) {
    const tooltip = document.getElementById("haritaTooltip");
    tooltip.textContent = text;
    tooltip.style.left = (e.clientX + 15) + "px";
    tooltip.style.top = (e.clientY - 30) + "px";
    tooltip.classList.remove("hidden");
}

function moveHaritaTooltip(e) {
    const tooltip = document.getElementById("haritaTooltip");
    tooltip.style.left = (e.clientX + 15) + "px";
    tooltip.style.top = (e.clientY - 30) + "px";
}

function hideHaritaTooltip() {
    const tt = document.getElementById("haritaTooltip");
    tt.classList.add("hidden");
    tt.style.display = "";
}

function renderHaritaAll() {
    updateHaritaTopBar();
    updateHaritaPlayerCard();
    renderHaritaMarkers();
    if (haritaData.currentTurn === haritaData.playerId) {
        const fc = document.getElementById("haritaFakeCursor");
        const ft = document.getElementById("haritaFakeTooltip");
        if (fc) { fc.classList.add("hidden"); fc.style.display = "none"; }
        if (ft) { ft.classList.add("hidden"); ft.style.display = "none"; }
    } else {
        const fc = document.getElementById("haritaFakeCursor");
        const ft = document.getElementById("haritaFakeTooltip");
        if (fc) fc.style.display = "";
        if (ft) ft.style.display = "";
    }
}

// Mesaj handler wrap
const _prevHandleMessageHarita = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "harita_room_created" || msg.type === "harita_room_joined") {
        haritaData.playerId = msg.player_id;
        haritaData.roomCode = msg.room_code;
        haritaData.turnSeconds = (msg.turn_seconds !== undefined && msg.turn_seconds !== null) ? msg.turn_seconds : 30;
        haritaData.difficulty = msg.difficulty || "karisik";
        if (msg.max_players !== undefined) haritaData.maxPlayers = msg.max_players;
        if (msg.total_rounds !== undefined) haritaData.totalRounds = msg.total_rounds;
        haritaData.inGame = true;
        inRoom = true;
        showHaritaChat();
        showScreen("haritaLobby");
        updateHaritaLobby();
        return;
    }
    
    if (msg.type === "harita_lobby_update") {
        showHaritaChat();
        haritaData.roomCode = msg.room_code;
        haritaData.players = msg.players;
        haritaData.turnSeconds = (msg.turn_seconds !== undefined && msg.turn_seconds !== null) ? msg.turn_seconds : 30;
        haritaData.difficulty = msg.difficulty || haritaData.difficulty || "karisik";
        if (msg.max_players !== undefined) haritaData.maxPlayers = msg.max_players;
        if (msg.total_rounds !== undefined) haritaData.totalRounds = msg.total_rounds;
        updateHaritaLobby();
        return;
    }
    
    // 💬 CHAT mesajları
    if (msg.type === "harita_chat_msg") {
        addHaritaChatMessage({
            sender_id: msg.sender_id,
            sender_name: msg.sender_name,
            text: msg.text,
            ts: msg.ts
        });
        return;
    }
    
    if (msg.type === "harita_chat_history") {
        if (msg.messages && Array.isArray(msg.messages)) {
            const wasOpen = haritaChat.open;
            haritaChat.open = true;
            msg.messages.forEach(m => addHaritaChatMessage(m));
            haritaChat.open = wasOpen;
            haritaChat.unread = 0;
            const badge = document.getElementById("haritaChatBadge");
            if (badge) badge.style.display = "none";
        }
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
        if (msg.max_players !== undefined) haritaData.maxPlayers = msg.max_players;
        haritaData.answered = false;
        haritaData.pendingCode = null;
        haritaData.lastSelectedCode = null;
        haritaData.lastCorrectCode = null;
        
        document.getElementById("haritaFakeCursor").classList.add("hidden");
        document.getElementById("haritaFakeTooltip").classList.add("hidden");
        
        document.getElementById("haritaGameOverBox").classList.add("hidden");
        document.getElementById("haritaConfirmBox").classList.add("hidden");
        document.getElementById("haritaCorrectAnswer").classList.add("hidden");
        hideHaritaBigOverlay();
        const allPaths = document.querySelectorAll("#haritaWorldMap path");
        allPaths.forEach(p => {
            p.classList.remove("haritaCorrect", "haritaWrong", "haritaPending", "haritaClickable", "haritaHoverSync");
        });
        
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
    
    if (msg.type === "harita_confirm_sync") {
        return;
    }
	
	if (msg.type === "harita_mouse_sync") {
        const cursor = document.getElementById("haritaFakeCursor");
        const tooltip = document.getElementById("haritaFakeTooltip");
        const rect = haritaMapWrapper.getBoundingClientRect();
        
        if (haritaData.currentTurn === haritaData.playerId) {
            cursor.classList.add("hidden");
            tooltip.classList.add("hidden");
            cursor.style.display = "none";
            tooltip.style.display = "none";
            document.querySelectorAll("#haritaWorldMap path.haritaHoverSync").forEach(p => {
                p.classList.remove("haritaHoverSync");
            });
            return;
        }
        
        if (msg.player_id === haritaData.playerId) return;
        
        document.querySelectorAll("#haritaWorldMap path.haritaHoverSync").forEach(p => {
            p.classList.remove("haritaHoverSync");
        });
        if (msg.country && haritaData.countries[msg.country]) {
            const cdata = haritaData.countries[msg.country];
            const byId = document.getElementById(cdata.iso);
            if (byId) {
                byId.classList.add("haritaHoverSync");
            } else {
                const parts = document.querySelectorAll("#haritaWorldMap ." + CSS.escape(cdata.iso));
                parts.forEach(p => p.classList.add("haritaHoverSync"));
            }
        }
        
        cursor.style.display = "";
        tooltip.style.display = "";
        
        if (msg.x === -999 && msg.y === -999) {
            cursor.classList.add("hidden");
            tooltip.classList.add("hidden");
            return;
        }
        
        const localX = msg.x * rect.width * haritaData.zoom + haritaData.panX;
        const localY = msg.y * rect.height * haritaData.zoom + haritaData.panY;
        
        cursor.style.left = localX + "px";
        cursor.style.top = localY + "px";
        cursor.classList.remove("hidden");
        
        tooltip.classList.add("hidden");
        return;
    }
    
    if (msg.type === "harita_answer_result") {
        haritaData.answered = true;
        haritaData.scores = msg.scores;
        haritaData.lastSelectedCode = msg.selected_code;
        haritaData.lastCorrectCode = msg.correct_code;
        stopHaritaTimer();
        document.getElementById("haritaFakeCursor").classList.add("hidden");
        document.getElementById("haritaFakeTooltip").classList.add("hidden");
        
        const playerName = getHaritaPlayerName(msg.player_id);
        let statusText = "";
        let statusType = "info";
        const scoreDelta = msg.score_delta ?? 0;
        const deltaTxt = scoreDelta > 0 ? `+${scoreDelta}` : `${scoreDelta}`;
        
        if (msg.timeout) {
            statusText = `⏰ ${playerName} süresi doldu! (${deltaTxt})`;
            statusType = "wrong";
        } else if (msg.correct) {
            const timeInfo = msg.answer_time ? ` [${msg.answer_time}sn]` : "";
            statusText = `✓ ${playerName} doğru bildi!${timeInfo} (${deltaTxt})`;
            statusType = "correct";
        } else {
            statusText = `✗ ${playerName} yanlış tahmin: ${msg.selected_tr} (${deltaTxt})`;
            statusType = "wrong";
        }
        
        setHaritaStatus(statusText, statusType);
        renderHaritaMarkers();
        updateHaritaTopBar();
        
        if (msg.correct) {
            const bonus = scoreDelta === 2 ? "✓ HIZLI DOĞRU!" : "✓ DOĞRU";
            showHaritaBigOverlay(bonus, "correct", 2500);
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
    
    if (msg.type === "harita_player_left") {
        // Bir oyuncu ayrıldı
        if (msg.players) haritaData.players = msg.players;
        if (msg.scores) haritaData.scores = msg.scores;
        renderHaritaAll();
        if (typeof showToast === "function") {
            showToast(`${msg.name || "Bir oyuncu"} oyundan ayrıldı`, "warn");
        }
        return;
    }
    
    if (msg.type === "harita_back_to_lobby") {
        document.getElementById("haritaGameOverBox").classList.add("hidden");
        document.getElementById("haritaConfirmBox").classList.add("hidden");
        stopHaritaTimer();
        showScreen("haritaLobby");
        updateHaritaLobby();
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
            if (typeof startConfetti === "function") startConfetti();
        } else {
            title.textContent = "KAYBETTİN 😢";
            title.style.color = "#ff6b6b";
        }
        
        // Sıralama listesi
        let ranking = msg.ranking;
        if (!ranking || !Array.isArray(ranking)) {
            ranking = [];
            for (const [pidStr, sc] of Object.entries(haritaData.scores || {})) {
                const pid = parseInt(pidStr);
                ranking.push({ player_id: pid, name: getHaritaPlayerName(pid), score: sc });
            }
            ranking.sort((a, b) => b.score - a.score);
        }
        
        const listEl = document.getElementById("haritaGameOverList");
        if (listEl) {
            listEl.innerHTML = "";
            const medals = ["🥇", "🥈", "🥉"];
            ranking.forEach((row, idx) => {
                const li = document.createElement("li");
                li.className = "haritaGameOverItem";
                if (idx === 0) li.classList.add("goldRank");
                if (row.player_id === haritaData.playerId) li.classList.add("meRow");
                const medal = medals[idx] || `${idx + 1}.`;
                const scoreCls = row.score < 0 ? "rankScore negative" : "rankScore";
                li.innerHTML = `<span class="rankIcon">${medal}</span> <span class="rankName">${row.name}</span> <span class="${scoreCls}">${row.score}</span>`;
                listEl.appendChild(li);
            });
        }
        
        // Kısa özet
        if (ranking.length === 2) {
            text.innerHTML = `Skor: <b>${ranking[0].score} - ${ranking[1].score}</b>`;
        } else {
            text.innerHTML = `<b>${ranking.length}</b> oyuncu yarıştı`;
        }
        
        const rematchBtn = document.getElementById("haritaRematchBtn");
        const lobbyBtn = document.getElementById("haritaBackToLobbyBtn");
        if (haritaData.playerId === 1) {
            rematchBtn.classList.remove("hidden");
            lobbyBtn.classList.remove("hidden");
        } else {
            rematchBtn.classList.add("hidden");
            lobbyBtn.classList.add("hidden");
        }
        
        document.getElementById("haritaGameOverBox").classList.remove("hidden");
        return;
    }
    
    _prevHandleMessageHarita(msg);
};

// Başlangıçta popup'ları kapat
document.getElementById("haritaGameOverBox").classList.add("hidden");
document.getElementById("haritaConfirmBox").classList.add("hidden");

// ========================================
// 💬 HARİTADAN BUL CHAT - Event'ler
// ========================================
setTimeout(() => {
    const toggleBtn = document.getElementById("haritaChatToggleBtn");
    if (toggleBtn) toggleBtn.addEventListener("click", toggleHaritaChatPanel);
    
    const closeBtn = document.getElementById("haritaChatCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeHaritaChatPanel);
    
    const sendBtn = document.getElementById("haritaChatSendBtn");
    if (sendBtn) sendBtn.addEventListener("click", sendHaritaChatMessage);
    
    const input = document.getElementById("haritaChatInput");
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                sendHaritaChatMessage();
                closeHaritaChatPanel();
                return;
            }
            e.stopPropagation();
        });
    }
    
    // T tuşu → chat aç + focus
    document.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (k !== "t") return;
        
        const current = getCurrentScreen();
        if (!["haritaLobby", "haritaGame"].includes(current)) return;
        
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
        
        const container = document.getElementById("haritaChatContainer");
        if (!container || container.style.display === "none") return;
        
        if (haritaChat.open) return;
        
        const anyPopup = document.querySelector(".overlay:not(.hidden)");
        if (anyPopup) return;
        
        e.preventDefault();
        e.stopPropagation();
        openHaritaChatPanel();
    }, true);
    
    // ESC ile chat kapat (öncelik)
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (haritaChat.open) {
            e.preventDefault();
            e.stopPropagation();
            closeHaritaChatPanel();
        }
    }, true);
}, 200);