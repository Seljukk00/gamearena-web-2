// ==========================================
// İLK 11 CHALLENGE - MODÜL JS
// ==========================================

let ilk11Data = {
    inGame: false,
    playerId: null,
    roomCode: "",
    players: [],
    turnSeconds: 120,
    positions: {},
    rerollsLeft: 3,
    rerollPending: false,
    rerollDelayTimer: null,
    optionsLoading: false,
    myTeam: {},
    myCount: 0,
    oppCount: 0,
    oppFinished: false,
    timerInterval: null,
    timerSeconds: 120,
    logItems: []	
};

const createIlk11Screen = document.getElementById("createIlk11Screen");
const ilk11LobbyScreen = document.getElementById("ilk11LobbyScreen");
const ilk11GameScreen = document.getElementById("ilk11GameScreen");
const ilk11PopupBox = document.getElementById("ilk11PopupBox");
const ilk11RerollBtn = document.getElementById("ilk11RerollBtn");
const ilk11ResultBox = document.getElementById("ilk11ResultBox");

// ========================================
// 💬 İLK 11 CHAT
// ========================================
let ilk11Chat = {
    open: false,
    unread: 0,
    messages: [],
    maxMessages: 50
};

function showIlk11Chat() {
    const c = document.getElementById("ilk11ChatContainer");
    if (c) c.style.display = "block";
}

function hideIlk11Chat() {
    const c = document.getElementById("ilk11ChatContainer");
    if (c) c.style.display = "none";
    closeIlk11ChatPanel();
    ilk11Chat.messages = [];
    ilk11Chat.unread = 0;
    const box = document.getElementById("ilk11ChatMessages");
    if (box) box.innerHTML = "";
    clearIlk11ChatPopups();
}

function toggleIlk11ChatPanel() {
    if (ilk11Chat.open) closeIlk11ChatPanel();
    else openIlk11ChatPanel();
}

function openIlk11ChatPanel() {
    ilk11Chat.open = true;
    ilk11Chat.unread = 0;
    const panel = document.getElementById("ilk11ChatPanel");
    const badge = document.getElementById("ilk11ChatBadge");
    if (panel) panel.style.setProperty("display", "flex", "important");
    if (badge) badge.style.display = "none";
    clearIlk11ChatPopups();
    const box = document.getElementById("ilk11ChatMessages");
    if (box) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
    const input = document.getElementById("ilk11ChatInput");
    if (input) setTimeout(() => input.focus(), 100);
    setTimeout(() => {
        document.addEventListener("mousedown", ilk11ChatOutsideClickHandler, true);
    }, 100);
}

function closeIlk11ChatPanel() {
    ilk11Chat.open = false;
    const panel = document.getElementById("ilk11ChatPanel");
    if (panel) panel.style.display = "none";
    document.removeEventListener("mousedown", ilk11ChatOutsideClickHandler, true);
    const input = document.getElementById("ilk11ChatInput");
    if (input && input.value) input.value = "";
}

function ilk11ChatOutsideClickHandler(e) {
    const c = document.getElementById("ilk11ChatContainer");
    if (!c) return;
    if (c.contains(e.target)) return;
    closeIlk11ChatPanel();
}

function sendIlk11ChatMessage() {
    const input = document.getElementById("ilk11ChatInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text || text.length > 100) return;
    input.value = "";
    send({ type: "ilk11_chat_send", text: text });
}

function showIlk11ChatPopup(msg) {
    if (ilk11Chat.open) return;
    const stack = document.getElementById("ilk11ChatPopupStack");
    if (!stack) return;
    stack.style.display = "flex";
    
    const popup = document.createElement("div");
    popup.className = "miniChatPopup";
    if (msg.sender_id === 1) popup.classList.add("teamRed");
    else popup.classList.add("teamBlue");
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "miniChatPopupName";
    nameSpan.style.color = msg.sender_id === 1 ? "#ff8a8a" : "#7abfff";
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

function clearIlk11ChatPopups() {
    const stack = document.getElementById("ilk11ChatPopupStack");
    if (!stack) return;
    stack.innerHTML = "";
    stack.style.display = "none";
}

function addIlk11ChatMessage(msg) {
    // ✨ Chat bildirim sesi (yazan dahil herkese tam ses)
    try {
        const sound = new Audio("/static/sounds/chat_notify.mp3");
        sound.volume = 1.0;
        sound.play().catch(() => {});
    } catch(e) {}

    ilk11Chat.messages.push(msg);
    if (ilk11Chat.messages.length > ilk11Chat.maxMessages) ilk11Chat.messages.shift();
    
    const box = document.getElementById("ilk11ChatMessages");
    if (!box) return;
    
    const div = document.createElement("div");
    div.className = "miniChatMsg";
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "chatName";
    nameSpan.style.color = msg.sender_id === 1 ? "#ff8a8a" : "#7abfff";
    nameSpan.textContent = msg.sender_name + ":";
    
    const textSpan = document.createElement("span");
    textSpan.className = "chatText";
    textSpan.textContent = " " + msg.text;
    
    div.appendChild(nameSpan);
    div.appendChild(textSpan);
    box.appendChild(div);
    
    while (box.children.length > ilk11Chat.maxMessages) box.removeChild(box.firstChild);
    
    if (ilk11Chat.open) {
        box.scrollTop = box.scrollHeight;
    } else {
        ilk11Chat.unread++;
        const badge = document.getElementById("ilk11ChatBadge");
        if (badge) {
            badge.textContent = ilk11Chat.unread;
            badge.style.display = "flex";
            badge.style.animation = "none";
            badge.offsetHeight;
            badge.style.animation = "chatBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        }
        showIlk11ChatPopup(msg);
    }
}

// showScreen genişlet
const _prevShowScreenIlk11 = showScreen;
showScreen = function(screenName) {
    _prevShowScreenIlk11(screenName);
    createIlk11Screen.classList.add("hidden");
    ilk11LobbyScreen.classList.add("hidden");
    ilk11GameScreen.classList.add("hidden");
    if (screenName === "createIlk11") createIlk11Screen.classList.remove("hidden");
    if (screenName === "ilk11Lobby") ilk11LobbyScreen.classList.remove("hidden");
    if (screenName === "ilk11Game") ilk11GameScreen.classList.remove("hidden");
    
    // 💬 İlk 11 chat: sadece ilk11Lobby/ilk11Game'de görünür
    const ilk11Screens = ["ilk11Lobby", "ilk11Game"];
    if (!ilk11Screens.includes(screenName)) {
        hideIlk11Chat();
    }
    
    // 🛑 Oyun ekranından çıkıldı → sayaç + uyarı sesi + popup + simülasyon kesin kapanır
    if (screenName !== "ilk11Game") {
        ilk11CleanupGameplay();
    }
};

// Mod kartına tıklama
const ilk11Card = document.querySelector('[data-mod="ilk_11_challenge"]');
if (ilk11Card) {
    ilk11Card.addEventListener("click", () => {
        // ✨ Normal giriş: isim + buton normale döndür
        const nameInput = document.getElementById("createIlk11NameInput");
        if (nameInput) {
            const nameBox = nameInput.closest(".centerBox");
            if (nameBox) nameBox.style.display = "";
        }
        const createBtnEl = document.getElementById("createIlk11Btn");
        if (createBtnEl) createBtnEl.textContent = "Oda Oluştur";
        window._pendingModeChangeCtx = null;

        showScreen("createIlk11");
        setTimeout(() => {
            if (nameInput) nameInput.focus();
        }, 100);
    });
}

// Kaydedilmiş isim
const _savedNameIlk11 = localStorage.getItem("playerName");
if (_savedNameIlk11) {
    const inp = document.getElementById("createIlk11NameInput");
    if (inp) inp.value = _savedNameIlk11;
}

// Oda oluştur
document.getElementById("createIlk11Btn").onclick = () => {
    const nameInput = document.getElementById("createIlk11NameInput");
    const enteredName = nameInput ? nameInput.value.trim() : "";
    const msgEl = document.getElementById("createIlk11Msg");

    const turnSec = parseInt(document.getElementById("ilk11TurnSecondsSelect").value) || 120;

    // ✨ MOD DEĞİŞİMİ mi?
    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.newMode === "ilk_11_challenge" && pendingModeChange.createScreen === "createIlk11") {
        console.log("[MODE CHANGE] İlk 11 için mod_change_room gönderiliyor");
        if (msgEl) {
            msgEl.textContent = "Mod değiştiriliyor...";
            msgEl.style.color = "#51cf66";
        }
        send({
            type: "mod_change_room",
            new_mode: "ilk_11_challenge",
            mode_settings: {
                turn_seconds: turnSec
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
    send({ type: "ilk11_create_room", name: enteredName, turn_seconds: turnSec });
};

document.getElementById("createIlk11BackBtn").onclick = () => {
    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.newMode === "ilk_11_challenge" && pendingModeChange.createScreen === "createIlk11") {
        const returnScreen = pendingModeChange.returnScreen || "ilk11Lobby";
        window._pendingModeChangeCtx = null;
        const msgEl = document.getElementById("createIlk11Msg");
        if (msgEl) msgEl.textContent = "";

        showScreen(returnScreen);

        setTimeout(() => {
            if (typeof openChangeModeModal === "function") openChangeModeModal();
        }, 200);
        return;
    }
    showScreen("modselect");
};

document.getElementById("ilk11StartBtn").onclick = () => {
    send({ type: "ilk11_start_game" });
};

document.getElementById("ilk11LobbyLeaveBtn").onclick = () => {
    window._showLeaveConfirmPopup();
};

// ✨ Mod Değiştir butonu
const _ilk11ChangeModeBtn = document.getElementById("ilk11ChangeModeBtn");
if (_ilk11ChangeModeBtn) {
    _ilk11ChangeModeBtn.onclick = () => {
        if (typeof openChangeModeModal === "function") {
            openChangeModeModal();
        }
    };
}

// Oda Ayarları butonu
document.getElementById("ilk11RoomSettingsBtn").onclick = () => {
    window.openRoomSettingsGeneric({
        title: "İlk 11 - Oda Ayarları",
        fields: [
            {
                id: "turnSec",
                label: "⏱️ Kadro Süresi",
                current: ilk11Data.turnSeconds || 120,
                options: [
                    {value: 60, label: "60 saniye"},
                    {value: 90, label: "90 saniye"},
                    {value: 120, label: "120 saniye"},
                    {value: 180, label: "180 saniye"},
                    {value: 240, label: "240 saniye"}
                ]
            }
        ],
        onSave: (values) => {
            send({
                type: "ilk11_update_settings",
                turn_seconds: parseInt(values.turnSec) || 120
            });
        }
    });
};

const ilk11RoomHelper = window.setupRoomCodeAndLink({
    codeTextId: "ilk11RoomCodeText",
    codeEyeBtnId: "ilk11RoomCodeEyeBtn",
    copyHintId: "ilk11CopyHint",
    linkTextId: "ilk11InviteLinkText",
    linkEyeBtnId: "ilk11InviteLinkEyeBtn",
    linkHintId: "ilk11InviteLinkHint",
    getRoomCode: () => ilk11Data.roomCode,
    getPlayerId: () => ilk11Data.playerId
});

document.getElementById("ilk11BackBtn").onclick = () => {
    showEscPopup();
};

document.getElementById("ilk11BackToMenuBtn").onclick = () => {
    // Popup'ları kapat
    ilk11CleanupGameplay();
    
    // WebSocket kapat
    if (typeof ws !== "undefined" && ws) {
        try { ws.close(); } catch(e) {}
    }
    // State sıfırla
    inRoom = false;
    ilk11Data.roomCode = "";
    ilk11Data.playerId = null;
    ilk11Data.players = [];
    playerId = null;
    roomCode = "";
    // WS yeniden bağla + ana menüye
    setTimeout(() => {
        if (typeof connectWS === "function") connectWS();
        showScreen("home");
    }, 200);
};

document.getElementById("ilk11RematchBtn").onclick = () => {
    ilk11ResultBox.classList.add("hidden");
    send({ type: "ilk11_rematch" });
};

// ✨ Lobiye Dön butonu
document.getElementById("ilk11BackToLobbyBtn").onclick = () => {
    if (ilk11Data.playerId === 1) {
        // HOST: backend'e broadcast et
        send({ type: "ilk11_back_to_lobby" });
    } else {
        // MİSAFİR: sadece kendi ekranını lobiye çevir
        ilk11ResultBox.classList.add("hidden");
        showScreen("ilk11Lobby");
        updateIlk11Lobby();
    }
};

document.getElementById("ilk11PopupCloseBtn").onclick = () => {
    if (ilk11Data.rerollDelayTimer !== null) {
        clearTimeout(ilk11Data.rerollDelayTimer);
        ilk11Data.rerollDelayTimer = null;
        ilk11Data.rerollPending = false;

        const grid = document.getElementById("ilk11PopupOptions");
        if (grid) {
            grid.classList.remove("rerolling");     
            grid.querySelectorAll(".ilk11PopupOptionExiting").forEach(card => {
                card.classList.remove("ilk11PopupOptionExiting");
            });
        }

        updateIlk11RerollButton();
    }

    ilk11PopupBox.classList.add("hidden");
};

function getIlk11PlayerName(id) {
    const p = ilk11Data.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function updateIlk11Lobby() {
    if (ilk11RoomHelper) { ilk11RoomHelper.renderCode(); ilk11RoomHelper.renderLink(); }
    document.getElementById("ilk11LobbyTurnSeconds").textContent = ilk11Data.turnSeconds || 120;

    const list = document.getElementById("ilk11PlayersList");
    list.innerHTML = "";
    ilk11Data.players.forEach(p => {
        const li = document.createElement("li");
        
        const nameCell = document.createElement("span");
        nameCell.style.flex = "1";
        nameCell.style.textAlign = "left";
        nameCell.style.paddingLeft = "10px";
        const crown = p.id === 1 ? " 👑" : "";
        nameCell.textContent = p.id === ilk11Data.playerId ? `${p.id}. ${p.name} (Sen)${crown}` : `${p.id}. ${p.name}${crown}`;
        li.appendChild(nameCell);
        
        if (p.id !== ilk11Data.playerId && ilk11Data.playerId === 1) {
            const kickBtn = document.createElement("button");
            kickBtn.className = "kickBtnNew";
            kickBtn.textContent = "Oyuncuyu At";
            kickBtn.onclick = () => openKickConfirm(p.id, p.name);
            li.appendChild(kickBtn);
        }
        
        if (p.id === ilk11Data.playerId) {
            li.classList.add("playerMine");
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });

    const startBtn = document.getElementById("ilk11StartBtn");
    const msg = document.getElementById("ilk11LobbyMsg");

    if (ilk11Data.playerId === 1 && ilk11Data.players.length === 2) {
        startBtn.classList.remove("hidden");
        msg.textContent = "İki oyuncu hazır. Başlatabilirsin!";
        msg.style.color = "#51cf66";
    } else if (ilk11Data.playerId === 1) {
        startBtn.classList.add("hidden");
        msg.textContent = "Rakip bekleniyor...";
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        msg.textContent = "Host bekleniyor...";
        msg.style.color = "#51cf66";
    }
    
    const settingsBtn = document.getElementById("ilk11RoomSettingsBtn");
    if (settingsBtn) {
        if (ilk11Data.playerId === 1) settingsBtn.classList.remove("hidden");
        else settingsBtn.classList.add("hidden");
    }
    
    // ✨ Mod Değiştir butonu - sadece host görsün
    const changeModeBtn = document.getElementById("ilk11ChangeModeBtn");
    if (changeModeBtn) {
        if (ilk11Data.playerId === 1) changeModeBtn.classList.remove("hidden");
        else changeModeBtn.classList.add("hidden");
    }
}

// 🔒 Oyun ekranı gerçekten görünür mü?
function isIlk11GameVisible() {
    const el = document.getElementById("ilk11GameScreen");
    if (!el) return false;
    return !el.classList.contains("hidden");
}

function startIlk11Timer(seconds) {
    stopIlk11Timer();
    // 🔒 Oyun ekranı görünmüyorsa sayaç hiç başlamaz
    if (!isIlk11GameVisible()) return;
    ilk11Data.timerSeconds = seconds;
    ilk11Data.timerWarningPlaying = false;
    updateIlk11TimerDisplay();
    ilk11Data.timerInterval = setInterval(() => {
        // 🔒 Güvenlik: ekrandan çıkıldıysa sayaç kendini imha eder
        if (!isIlk11GameVisible()) { stopIlk11Timer(); return; }
        ilk11Data.timerSeconds--;
        updateIlk11TimerDisplay();
        if (ilk11Data.timerSeconds <= 10 && !ilk11Data.timerWarningPlaying) {
            ilk11Data.timerWarningPlaying = true;
            try {
                const vol = (typeof getGlobalVolume === "function") ? getGlobalVolume() : 0.3;
                ilk11Data._timerWarningAudio = new Audio("/ml_assets/timer_warning.mp3");
                ilk11Data._timerWarningAudio.volume = vol;
                ilk11Data._timerWarningAudio.loop = true;
                ilk11Data._timerWarningAudio.play().catch(() => {});
            } catch(e) {}
        }
        if (ilk11Data.timerSeconds <= 0) stopIlk11Timer();
    }, 1000);
}

function stopIlk11Timer() {
    if (ilk11Data.timerInterval) {
        clearInterval(ilk11Data.timerInterval);
        ilk11Data.timerInterval = null;
    }
    if (ilk11Data._timerWarningAudio) {
        try {
            ilk11Data._timerWarningAudio.pause();
            ilk11Data._timerWarningAudio.loop = false;   // 🔑 kısır döngü burada kırılıyor
            ilk11Data._timerWarningAudio.currentTime = 0;
        } catch(e) {}
        ilk11Data._timerWarningAudio = null;
    }
    ilk11Data.timerWarningPlaying = false;
}

// 🧹 OYUNDAN ÇIKIŞ TEMİZLİĞİ — tek kapı
function ilk11CleanupGameplay() {
    // 1) Süre sayacı + uyarı sesi
    stopIlk11Timer();

    // 2) Bekleyen reroll gecikmesi
    if (ilk11Data.rerollDelayTimer !== null) {
        clearTimeout(ilk11Data.rerollDelayTimer);
        ilk11Data.rerollDelayTimer = null;
    }
    ilk11Data.rerollPending = false;
    ilk11Data.optionsLoading = false;

    // 3) Açık popup'lar
    if (ilk11PopupBox) ilk11PopupBox.classList.add("hidden");
    if (ilk11ResultBox) ilk11ResultBox.classList.add("hidden");

    // 4) Simülasyon motoru
    if (typeof stopIlk11Simulation === "function") stopIlk11Simulation();
}

function updateIlk11TimerDisplay() {
    const el = document.getElementById("ilk11Timer");
    el.textContent = ilk11Data.timerSeconds + "s";
    el.classList.remove("warning", "danger");
    if (ilk11Data.timerSeconds <= 20) el.classList.add("danger");
    else if (ilk11Data.timerSeconds <= 40) el.classList.add("warning");
}

function addIlk11Log(text) {
    ilk11Data.logItems.unshift(text);
    if (ilk11Data.logItems.length > 15) ilk11Data.logItems.pop();

    const list = document.getElementById("ilk11LogList");
    list.innerHTML = "";
    ilk11Data.logItems.forEach(item => {
        const div = document.createElement("div");
        div.className = "ilk11LogItem";
        div.textContent = item;
        list.appendChild(div);
    });
}

function updateIlk11Progress() {
    document.getElementById("ilk11MyProgress").textContent =
        `Kadrom: ${ilk11Data.myCount}/11`;
    document.getElementById("ilk11OppProgress").textContent =
        `Rakip: ${ilk11Data.oppCount}/11`;
    document.getElementById("ilk11MyCount").textContent =
        `${ilk11Data.myCount} / 11`;

    const oppStatus = document.getElementById("ilk11OppStatus");
    if (ilk11Data.oppFinished) {
        oppStatus.textContent = "✓ 11'i hazır!";
        oppStatus.style.color = "#ff6b6b";
    } else {
        oppStatus.textContent = `Seçiyor... (${ilk11Data.oppCount}/11)`;
        oppStatus.style.color = "#ffa94d";
    }
}

const ILK11_POSITIONS = {
    GK:  { name: "KALECİ",    x: 0.50, y: 0.88, type: "Kaleci"   },
    LB:  { name: "SOL BEK",   x: 0.14, y: 0.70, type: "Defans"   },
    CB1: { name: "STOPER",    x: 0.37, y: 0.72, type: "Defans"   },
    CB2: { name: "STOPER",    x: 0.63, y: 0.72, type: "Defans"   },
    RB:  { name: "SAĞ BEK",   x: 0.86, y: 0.70, type: "Defans"   },
    CM1: { name: "ORTA SAHA", x: 0.20, y: 0.47, type: "OrtaSaha" },
    CM2: { name: "ORTA SAHA", x: 0.50, y: 0.50, type: "OrtaSaha" },
    CM3: { name: "ORTA SAHA", x: 0.80, y: 0.47, type: "OrtaSaha" },
    LW:  { name: "SOL KANAT", x: 0.16, y: 0.22, type: "Forvet"   },
    ST:  { name: "FORVET",    x: 0.50, y: 0.13, type: "Forvet"   },
    RW:  { name: "SAĞ KANAT", x: 0.84, y: 0.22, type: "Forvet"   }
};

function renderIlk11Field() {
    const slotsContainer = document.getElementById("ilk11Slots");
    const field = document.getElementById("ilk11Field");
    if (!slotsContainer || !field) return;

    slotsContainer.innerHTML = "";

    const fieldW = field.offsetWidth || 520;
    const fieldH = field.offsetHeight || 580;
    const slotW = 85;
    const slotH = 100;

    Object.entries(ILK11_POSITIONS).forEach(([posId, posData]) => {
        const slot = document.createElement("div");
        slot.className = "ilk11Slot";

        const px = posData.x * fieldW - slotW / 2;
        const py = posData.y * fieldH - slotH / 2;
        slot.style.left = px + "px";
        slot.style.top = py + "px";

        const filled = ilk11Data.myTeam[posId];

        if (filled) {
            slot.classList.add("filled");

            const img = document.createElement("img");
            img.className = "ilk11SlotImg";
            img.src = `/static/images/${filled.img_file}`;
            img.onerror = () => { img.style.display = "none"; };

            const nameDiv = document.createElement("div");
            nameDiv.className = "ilk11SlotName";
            nameDiv.textContent = filled.name;
            nameDiv.title = filled.name;

            slot.appendChild(img);
            slot.appendChild(nameDiv);
        } else {
            slot.classList.add("empty");

            const posName = document.createElement("div");
            posName.className = "ilk11SlotPosName";
            posName.textContent = posData.name;

            const posIdDiv = document.createElement("div");
            posIdDiv.className = "ilk11SlotPosId";
            posIdDiv.textContent = posId;

            slot.appendChild(posName);
            slot.appendChild(posIdDiv);

            slot.addEventListener("click", () => {
                openIlk11Popup(posId, posData);
            });
        }

        slotsContainer.appendChild(slot);
    });
}

function updateIlk11RerollButton() {
    if (!ilk11RerollBtn) return;

    const rerollsLeft = Number.isInteger(ilk11Data.rerollsLeft)
        ? ilk11Data.rerollsLeft
        : 0;
    const grid = document.getElementById("ilk11PopupOptions");
    const hasOptions = !!(grid && grid.querySelector(".ilk11PopupOption"));

    ilk11RerollBtn.textContent = `🔄 Değiştir (${rerollsLeft})`;
    ilk11RerollBtn.disabled = rerollsLeft <= 0
        || !hasOptions
        || ilk11Data.optionsLoading
        || ilk11Data.rerollPending;
}

function openIlk11Popup(posId, posData) {
    if (ilk11Data.rerollPending) {
        showToast("⏳ Kartlar Değiştiriliyor", "Yeni kartlar yüklenene kadar bekle.", null, "warning");
        return;
    }

    document.getElementById("ilk11PopupTitle").textContent =
        `${posData.name} için futbolcu seç`;

    const grid = document.getElementById("ilk11PopupOptions");
    grid.innerHTML = "";
    grid.classList.remove("rerolling");

    const loading = document.createElement("div");
    loading.textContent = "Yükleniyor...";
    loading.style.color = "#ffd43b";
    loading.style.padding = "20px";
    grid.appendChild(loading);

    ilk11PopupBox.dataset.currentPosId = posId;
    ilk11Data.optionsLoading = true;

    ilk11PopupBox.classList.remove("hidden");
    updateIlk11RerollButton();

    send({ type: "ilk11_get_options", pos_id: posId });
}

function requestIlk11Reroll() {
    if (!ilk11RerollBtn || ilk11Data.optionsLoading || ilk11Data.rerollPending) return;
    if (!Number.isInteger(ilk11Data.rerollsLeft) || ilk11Data.rerollsLeft <= 0) return;
    if (ilk11PopupBox.classList.contains("hidden")) return;

    const posId = ilk11PopupBox.dataset.currentPosId;
    const grid = document.getElementById("ilk11PopupOptions");
    if (!posId || !grid) return;

    const cards = grid.querySelectorAll(".ilk11PopupOption");
    if (cards.length === 0) return;

    ilk11Data.rerollPending = true;
    grid.classList.add("rerolling");

    cards.forEach(card => {
        card.classList.remove("ilk11PopupOptionEntering");
        card.classList.add("ilk11PopupOptionExiting");
    });

    updateIlk11RerollButton();

    ilk11Data.rerollDelayTimer = setTimeout(() => {
        ilk11Data.rerollDelayTimer = null;

        if (!ilk11Data.rerollPending || ilk11PopupBox.classList.contains("hidden")) {
            ilk11Data.rerollPending = false;
            grid.classList.remove("rerolling");
            updateIlk11RerollButton();
            return;
        }

        send({ type: "ilk11_reroll_options", pos_id: posId });
    }, 240);
}

if (ilk11RerollBtn) {
    ilk11RerollBtn.onclick = requestIlk11Reroll;
}

function renderIlk11PopupOptions(options, response = {}) {
    const grid = document.getElementById("ilk11PopupOptions");
    if (!grid) return;

    grid.innerHTML = "";
    grid.classList.remove("rerolling");

    ilk11Data.optionsLoading = false;
    ilk11Data.rerollPending = false;

    if (ilk11Data.rerollDelayTimer !== null) {
        clearTimeout(ilk11Data.rerollDelayTimer);
        ilk11Data.rerollDelayTimer = null;
    }

    if (Number.isInteger(response.rerolls_left)) {
        ilk11Data.rerollsLeft = response.rerolls_left;
    }

    if (response.reroll_success === false && response.message) {
        showToast("⚠️ Kartlar Değiştirilemedi", response.message, null, "warning");
    }

    const posId = ilk11PopupBox.dataset.currentPosId;
    const optionList = Array.isArray(options) ? options : [];

    if (optionList.length === 0) {
        const empty = document.createElement("div");
        empty.className = "ilk11PopupEmpty";
        empty.textContent = response.message || "Bu mevkiye uygun futbolcu bulunamadı.";
        grid.appendChild(empty);
        updateIlk11RerollButton();
        return;
    }

    optionList.forEach((opt, optionIndex) => {
        const card = document.createElement("div");
        card.className = "ilk11PopupOption ilk11PopupOptionEntering";
        card.style.animationDelay = `${optionIndex * 55}ms`;

        const img = document.createElement("img");
        img.className = "ilk11PopupImg";
        img.src = `/static/images/${opt.img_file}`;
        img.onerror = () => { img.style.display = "none"; };

        const name = document.createElement("div");
        name.className = "ilk11PopupName";
        name.textContent = opt.name;

        const pos = document.createElement("div");
        pos.className = "ilk11PopupPos";
        pos.textContent = opt.position;

        const league = document.createElement("div");
        league.className = "ilk11PopupLeague";
        league.textContent = opt.league || "?";

        const nat = document.createElement("div");
        nat.className = "ilk11PopupNat";
        nat.textContent = opt.nationality || "?";

        card.appendChild(img);
        card.appendChild(name);
        card.appendChild(pos);
        card.appendChild(league);
        card.appendChild(nat);

        card.addEventListener("click", () => {
            if (ilk11Data.rerollPending) return;

            ilk11PopupBox.classList.add("hidden");
            send({
                type: "ilk11_select",
                pos_id: posId,
                index: opt.index
            });
        });

        grid.appendChild(card);
    });

    updateIlk11RerollButton();
}

function renderIlk11Result(data) {
    stopIlk11Timer();

    document.getElementById("ilk11ResultMyName").textContent = data.player1.name;
    document.getElementById("ilk11ResultOppName").textContent = data.player2.name;

    document.getElementById("ilk11ResultMyRating").textContent = data.player1.total_rating;
    document.getElementById("ilk11ResultMyChem").textContent = data.player1.chemistry;
    document.getElementById("ilk11ResultMyTotal").textContent = data.player1.total_score;

    document.getElementById("ilk11ResultOppRating").textContent = data.player2.total_rating;
    document.getElementById("ilk11ResultOppChem").textContent = data.player2.chemistry;
    document.getElementById("ilk11ResultOppTotal").textContent = data.player2.total_score;

    renderIlk11MiniField("ilk11ResultMyField", data.player1.team, "#51cf66");
    renderIlk11MiniField("ilk11ResultOppField", data.player2.team, "#ffa94d");

    const winnerEl = document.getElementById("ilk11ResultWinner");
    if (data.winner_id === 0) {
        winnerEl.textContent = "⚖️ BERABERE!";
        winnerEl.style.color = "#74c0fc";
    } else if (data.winner_id === ilk11Data.playerId) {
        winnerEl.textContent = "🏆 KAZANDIN!";
        winnerEl.style.color = "#51cf66";
        startConfetti();
    } else {
        winnerEl.textContent = "😢 KAYBETTİN";
        winnerEl.style.color = "#ff6b6b";
    }

    // Simülasyon Kutusunu Gizle, Standart Kadroları Aç (Yeni maç gelirse temizlensin)
    const teamsBox = document.querySelector(".ilk11ResultTeams");
    if(teamsBox) teamsBox.style.display = "flex";
    const simBox = document.getElementById("ilk11SimBox");
    if(simBox) simBox.style.display = "none";

    // Host için Simüle Et Butonu oluştur/göster
    const rematchBtn = document.getElementById("ilk11RematchBtn");
    const lobbyBtn = document.getElementById("ilk11BackToLobbyBtn");
    let simBtn = document.getElementById("ilk11SimBtn");
    
    if(!simBtn) {
        simBtn = document.createElement("button");
        simBtn.id = "ilk11SimBtn";
        simBtn.className = "btnNew";
        simBtn.style.backgroundColor = "#845ef7";
        simBtn.style.marginRight = "10px";
        simBtn.innerHTML = "📺 Maçı Simüle Et";
        simBtn.onclick = () => {
            send({type: "ilk11_start_simulation"});
            simBtn.style.display = "none";
        };
        rematchBtn.parentNode.insertBefore(simBtn, rematchBtn);
    }

    if (ilk11Data.playerId === 1) {
        rematchBtn.classList.remove("hidden");
        lobbyBtn.classList.remove("hidden");
        simBtn.style.display = "inline-block";
    } else {
        rematchBtn.classList.add("hidden");
        // ✨ Misafir de kendi lobisine dönebilsin
        lobbyBtn.classList.remove("hidden");
        if(simBtn) simBtn.style.display = "none";
    }

    ilk11ResultBox.classList.remove("hidden");
}

function renderIlk11MiniField(containerId, teamData, borderColor) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    const fw = container.offsetWidth || 400;
    const fh = container.offsetHeight || 600;
    const slotW = 82;
    const slotH = 110;

    teamData.forEach(player => {
        const posData = ILK11_POSITIONS[player.pos_id];
        if (!posData) return;

        const slot = document.createElement("div");
        slot.className = "ilk11MiniSlot";
        slot.style.borderColor = borderColor;

        const px = posData.x * fw - slotW / 2;
        const py = posData.y * fh - slotH / 2;
        slot.style.left = px + "px";
        slot.style.top = py + "px";

        if (player.index >= 0) {
            const ratingDiv = document.createElement("div");
            ratingDiv.className = "ilk11MiniRating";
            ratingDiv.textContent = player.rating || "?";
            slot.appendChild(ratingDiv);

            const img = document.createElement("img");
            img.className = "ilk11MiniImg";
            img.src = `/static/images/${player.img_file}`;
            img.onerror = () => { img.style.display = "none"; };
            slot.appendChild(img);

            const nameDiv = document.createElement("div");
            nameDiv.className = "ilk11MiniName";
            nameDiv.textContent = player.name || "";
            nameDiv.title = player.name || "";
            slot.appendChild(nameDiv);
        } else {
            slot.style.opacity = "0.35";
            const posName = document.createElement("div");
            posName.style.color = "white";
            posName.style.fontSize = "10px";
            posName.style.marginTop = "auto";
            posName.style.marginBottom = "auto";
            posName.style.padding = "8px 2px";
            posName.textContent = player.pos_name || player.pos_id;
            slot.appendChild(posName);
        }

        container.appendChild(slot);
    });
}

// Mesaj handler
const _prevHandleMessageIlk11 = handleMessage;
handleMessage = function(msg) {

    if (msg.type === "ilk11_room_created" || msg.type === "ilk11_room_joined") {
        try { new Audio("/static/sounds/player_join.mp3").play().catch(()=>{}); } catch(e){}
        ilk11Data.playerId = msg.player_id;
        ilk11Data.roomCode = msg.room_code;
        ilk11Data.turnSeconds = msg.turn_seconds || 120;
        ilk11Data.inGame = true;
        inRoom = true;
        showIlk11Chat();
        showScreen("ilk11Lobby");
        updateIlk11Lobby();
        return;
    }

    if (msg.type === "ilk11_lobby_update") {
        // ✨ Lobiye yeni biri geldiyse katılma sesi çal
        if (ilk11Data.players && msg.players && ilk11Data.players.length < msg.players.length && msg.players.length > 1) {
            try { new Audio("/static/sounds/player_join.mp3").play().catch(()=>{}); } catch(e){}
        }
        showIlk11Chat();
        ilk11Data.roomCode = msg.room_code;
        ilk11Data.players = msg.players;
        ilk11Data.turnSeconds = msg.turn_seconds || 120;
        updateIlk11Lobby();
        return;
    }
    
    // 💬 CHAT mesajları
    if (msg.type === "ilk11_chat_msg") {
        addIlk11ChatMessage({
            sender_id: msg.sender_id,
            sender_name: msg.sender_name,
            text: msg.text,
            ts: msg.ts
        });
        return;
    }
    
    if (msg.type === "ilk11_chat_history") {
        if (msg.messages && Array.isArray(msg.messages)) {
            const wasOpen = ilk11Chat.open;
            ilk11Chat.open = true;
            msg.messages.forEach(m => addIlk11ChatMessage(m));
            ilk11Chat.open = wasOpen;
            ilk11Chat.unread = 0;
            const badge = document.getElementById("ilk11ChatBadge");
            if (badge) badge.style.display = "none";
        }
        return;
    }

    if (msg.type === "ilk11_game_started") {
        stopIlk11Simulation();
        ilk11ResultBox.classList.add("hidden");
        ilk11PopupBox.classList.add("hidden");

        ilk11Data.playerId = msg.player_id;
        ilk11Data.players = msg.players;
        ilk11Data.turnSeconds = msg.turn_seconds;
        ilk11Data.positions = msg.positions;

        if (ilk11Data.rerollDelayTimer !== null) {
            clearTimeout(ilk11Data.rerollDelayTimer);
            ilk11Data.rerollDelayTimer = null;
        }

        ilk11Data.rerollsLeft = Number.isInteger(msg.rerolls_left) ? msg.rerolls_left : 3;
        ilk11Data.rerollPending = false;
        ilk11Data.optionsLoading = false;

        ilk11Data.myTeam = {};
        ilk11Data.myCount = 0;
        ilk11Data.oppCount = 0;
        ilk11Data.oppFinished = false;
        ilk11Data.logItems = [];

        const myNameStr = getIlk11PlayerName(ilk11Data.playerId);
        const oppId = ilk11Data.playerId === 1 ? 2 : 1;
        const oppName = getIlk11PlayerName(oppId);

        document.getElementById("ilk11MyName").textContent = myNameStr;
        document.getElementById("ilk11OppName").textContent = oppName;

        showScreen("ilk11Game");
        updateIlk11Progress();

        setTimeout(() => {
            renderIlk11Field();
        }, 100);

        document.getElementById("ilk11StatusMsg").textContent =
            "Mevkilere tıklayarak kadronı kur!";

        startIlk11Timer(ilk11Data.turnSeconds);
        return;
    }

    if (msg.type === "ilk11_options") {
        if (Number.isInteger(msg.rerolls_left)) {
            ilk11Data.rerollsLeft = msg.rerolls_left;
        }

        const isRerollResponse = typeof msg.reroll_success === "boolean";
        if (isRerollResponse) {
            ilk11Data.rerollPending = false;
        }

        if (msg.pos_id !== ilk11PopupBox.dataset.currentPosId) {
            if (isRerollResponse) {
                ilk11Data.optionsLoading = false;
                updateIlk11RerollButton();
            }
            return;
        }

        renderIlk11PopupOptions(msg.options, msg);
        return;
    }

    if (msg.type === "ilk11_selected") {
        ilk11Data.myTeam[msg.pos_id] = {
            index: msg.index,
            name: msg.name,
            img_file: msg.img_file
        };
        ilk11Data.myCount = msg.count;

        const posData = ILK11_POSITIONS[msg.pos_id];
        const posName = posData ? posData.name : msg.pos_id;
        addIlk11Log(`${posName}: ${msg.name}`);

        updateIlk11Progress();
        renderIlk11Field();

        if (msg.count >= 11) {
            document.getElementById("ilk11StatusMsg").textContent =
                "✅ Kadron hazır! Rakip bekleniyor...";
            document.getElementById("ilk11StatusMsg").style.color = "#51cf66";
        }
        return;
    }

    if (msg.type === "ilk11_opponent_progress") {
        ilk11Data.oppCount = msg.count;
        updateIlk11Progress();
        return;
    }

    if (msg.type === "ilk11_opponent_finished") {
        ilk11Data.oppFinished = true;
        ilk11Data.oppCount = 11;
        updateIlk11Progress();
        addIlk11Log(`${msg.name} kadrosunu tamamladı!`);
        showToast(
            "⚽ Rakip Hazır!",
            `${msg.name} 11'ini tamamladı!`,
            null,
            "success"
        );
        return;
    }

    if (msg.type === "ilk11_team_complete") {
        document.getElementById("ilk11StatusMsg").textContent = msg.message;
        document.getElementById("ilk11StatusMsg").style.color = "#ffd43b";
        return;
    }

    if (msg.type === "ilk11_auto_completed") {
        addIlk11Log("⏰ Süre doldu!");
        document.getElementById("ilk11StatusMsg").textContent =
            "⏰ Süre bitti!";
        document.getElementById("ilk11StatusMsg").style.color = "#ffa94d";
        return;
    }
    
    if (msg.type === "ilk11_time_up") {
        addIlk11Log(msg.message || "⏰ Süre doldu!");
        document.getElementById("ilk11StatusMsg").textContent = msg.message || "⏰ Süre bitti!";
        document.getElementById("ilk11StatusMsg").style.color = "#ff6b6b";
        return;
    }

    if (msg.type === "ilk11_result") {
        renderIlk11Result(msg);
        return;
    }
    
    // ✨ Host lobiye döndü → herkesi lobiye at
    if (msg.type === "ilk11_back_to_lobby") {
        stopIlk11Simulation();
        ilk11ResultBox.classList.add("hidden");
        ilk11PopupBox.classList.add("hidden");
        stopIlk11Timer();
        showScreen("ilk11Lobby");
        updateIlk11Lobby();
        return;
    }

    // ⚡ Simülasyon Hızı Senkronize Et
    if (msg.type === "ilk11_sim_speed_updated") {
        applyIlk11SimSpeed(msg.speed);
        return;
    }
    
    // ==========================================
    // 📺 CANLI HIZ AYARLI SİMÜLASYON MOTORU
    // ==========================================
    if (msg.type === "ilk11_sim_start") {
        try {
            const teamsBox = document.querySelector(".ilk11ResultTeams");
            if (teamsBox) teamsBox.style.display = "none";
            
            let simBox = document.getElementById("ilk11SimBox");
            if (!simBox) {
                simBox = document.createElement("div");
                simBox.id = "ilk11SimBox";
                simBox.className = "ilk11SimBox";
                
                if (teamsBox && teamsBox.parentNode) {
                    teamsBox.parentNode.insertBefore(simBox, teamsBox);
                } else {
                    const resCard = document.querySelector(".ilk11ResultCard") || document.getElementById("ilk11ResultBox");
                    if (resCard) resCard.appendChild(simBox);
                }
            }
            simBox.style.display = "flex";
            simBox.innerHTML = `
                <div class="simScoreboard">
                    <div class="simTeam">${msg.p1 || "1. Takım"}</div>
                    <div class="simScore" id="simScoreText">0 - 0</div>
                    <div class="simTeam">${msg.p2 || "2. Takım"}</div>
                </div>
                <div class="simLogContainer" id="simLogContainer"></div>
                <div class="simControlsBar">
                    <div class="simSpeedTitle">⚡ Simülasyon Hızı:</div>
                    <div class="simSpeedBtns">
                        <button class="simSpeedBtn active" onclick="setIlk11SimSpeed(1)">1x</button>
                        <button class="simSpeedBtn" onclick="setIlk11SimSpeed(2)">2x</button>
                        <button class="simSpeedBtn" onclick="setIlk11SimSpeed(5)">5x</button>
                        <button class="simSpeedBtn" onclick="setIlk11SimSpeed(20)">⚡ MAX</button>
                    </div>
                </div>
            `;

            const canChangeSimSpeed = ilk11Data.playerId === 1;
            simBox.querySelectorAll(".simSpeedBtn").forEach(button => {
                button.disabled = !canChangeSimSpeed;
                button.title = canChangeSimSpeed
                    ? "Simülasyon hızını değiştirebilirsin."
                    : "Simülasyon hızını sadece oda yöneticisi değiştirebilir.";
            });

            const winnerEl = document.getElementById("ilk11ResultWinner");

            if (winnerEl) {
                winnerEl.textContent = "MAÇ OYNANIYOR...";
                winnerEl.style.color = "#845ef7";
            }

            // Simülasyon Durumunu Başlat
            window.ilk11SimState = {
                events: msg.events || [],
                index: 0,
                speed: 1,
                timer: null,
                final1: msg.final_score1 || 0,
                final2: msg.final_score2 || 0
            };

            runNextIlk11SimEvent();
        } catch(e) {
            console.error("[ILK11 SIM START ERR]", e);
        }
        return;
    }

    _prevHandleMessageIlk11(msg);
};

// (Bu blok silindi - app.js zaten room_mode_result işliyor)

// ==========================================
// ⚡ SİMÜLASYON OYNATMA & HIZ YÖNETİCİSİ
// ==========================================
function stopIlk11Simulation() {
    if (window.ilk11SimState) {
        if (window.ilk11SimState.timer) {
            clearTimeout(window.ilk11SimState.timer);
        }
        window.ilk11SimState = null;
    }
    const simBox = document.getElementById("ilk11SimBox");
    if (simBox) simBox.style.display = "none";
    
    const teamsBox = document.querySelector(".ilk11ResultTeams");
    if (teamsBox) teamsBox.style.display = "flex";
}

function setIlk11SimSpeed(multiplier) {
    if (ilk11Data.playerId !== 1) return;
    send({ type: "ilk11_sim_speed", speed: multiplier });
}

function applyIlk11SimSpeed(multiplier) {
    if (!window.ilk11SimState) return;
    window.ilk11SimState.speed = multiplier;

    document.querySelectorAll(".simSpeedBtn").forEach(btn => {
        btn.classList.remove("active");
        if ((multiplier === 1 && btn.textContent.includes("1x")) ||
            (multiplier === 2 && btn.textContent.includes("2x")) ||
            (multiplier === 5 && btn.textContent.includes("5x")) ||
            (multiplier === 20 && btn.textContent.includes("MAX"))) {
            btn.classList.add("active");
        }
    });

    if (window.ilk11SimState.timer) {
        clearTimeout(window.ilk11SimState.timer);
        window.ilk11SimState.timer = null;
        runNextIlk11SimEvent();
    }
}

function runNextIlk11SimEvent() {
    const st = window.ilk11SimState;
    if (!st) return;

    if (st.index >= st.events.length) {
        // Maç Bitti!
        const simLog = document.getElementById("simLogContainer");
        if (simLog) {
            const ev = document.createElement("div");
            ev.className = "simEvent simMatchEnd";
            ev.innerHTML = `Hakem bitiş düdüğünü çalıyor! Maç Sonucu: ${st.final1} - ${st.final2}`;
            simLog.appendChild(ev);
            simLog.scrollTop = simLog.scrollHeight;
        }

        const winnerEl = document.getElementById("ilk11ResultWinner");
        if (winnerEl) {
            if (st.final1 > st.final2) {
                winnerEl.textContent = ilk11Data.playerId === 1 ? "🏆 KAZANDIN!" : "😢 KAYBETTİN";
                winnerEl.style.color = ilk11Data.playerId === 1 ? "#51cf66" : "#ff6b6b";
                if (ilk11Data.playerId === 1) startConfetti();
            } else if (st.final2 > st.final1) {
                winnerEl.textContent = ilk11Data.playerId === 2 ? "🏆 KAZANDIN!" : "😢 KAYBETTİN";
                winnerEl.style.color = ilk11Data.playerId === 2 ? "#51cf66" : "#ff6b6b";
                if (ilk11Data.playerId === 2) startConfetti();
            } else {
                winnerEl.textContent = "⚖️ BERABERE!";
                winnerEl.style.color = "#74c0fc";
            }
        }

        const simBtn = document.getElementById("ilk11SimBtn");
        if (simBtn) simBtn.style.display = "none";
        return;
    }

    const item = st.events[st.index];
    st.index++;

    const simScore = document.getElementById("simScoreText");
    const simLog = document.getElementById("simLogContainer");
    if (simScore) simScore.textContent = `${item.score1} - ${item.score2}`;

    if (simLog) {
        const ev = document.createElement("div");
        let cls = "simEvent";
        if (item.event_type === "goal") cls += " simGoal";
        else if (item.event_type === "post") cls += " simPost";
        else if (item.event_type === "save") cls += " simSave";
        else if (item.event_type === "card") cls += " simCard";

        ev.className = cls;
        ev.innerHTML = `<span class="simMin">${item.min}'</span> ${item.text}`;
        simLog.appendChild(ev);
        simLog.scrollTop = simLog.scrollHeight;
    }

    if (item.is_goal) {
        try { new Audio("/static/sounds/game_correct.mp3").play().catch(() => {}); } catch (e) {}
    }

    // Temel gecikme: 1400ms. Hıza bölerek dinamik süre alıyoruz.
    const delay = Math.max(50, Math.floor(1400 / st.speed));
    st.timer = setTimeout(runNextIlk11SimEvent, delay);
}

// Başlangıçta popup'ları kapat
ilk11PopupBox.classList.add("hidden");
ilk11ResultBox.classList.add("hidden");

// ========================================
// 💬 İLK 11 CHAT - Event'ler
// ========================================
setTimeout(() => {
    const toggleBtn = document.getElementById("ilk11ChatToggleBtn");
    if (toggleBtn) toggleBtn.addEventListener("click", toggleIlk11ChatPanel);
    
    const closeBtn = document.getElementById("ilk11ChatCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeIlk11ChatPanel);
    
    const sendBtn = document.getElementById("ilk11ChatSendBtn");
    if (sendBtn) sendBtn.addEventListener("click", sendIlk11ChatMessage);
    
    const input = document.getElementById("ilk11ChatInput");
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                sendIlk11ChatMessage();
                closeIlk11ChatPanel();
                return;
            }
            e.stopPropagation();
        });
    }
    
    // T tuşu → chat aç + focus
    document.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (k !== "t") return;
        
        // Sadece İlk 11 ekranlarında
        const current = getCurrentScreen();
        if (!["ilk11Lobby", "ilk11Game"].includes(current)) return;
        
        // Input/textarea odaktaysa yoksay
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
        
        // Chat görünmüyorsa yoksay
        const container = document.getElementById("ilk11ChatContainer");
        if (!container || container.style.display === "none") return;
        
        // Zaten açıksa yoksay
        if (ilk11Chat.open) return;
        
        // Popup açıksa yoksay
        const anyPopup = document.querySelector(".overlay:not(.hidden)");
        if (anyPopup) return;
        
        e.preventDefault();
        e.stopPropagation();
        openIlk11ChatPanel();
    }, true);
    
    // ESC ile chat kapat (öncelik)
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (ilk11Chat.open) {
            e.preventDefault();
            e.stopPropagation();
            closeIlk11ChatPanel();
        }
    }, true);
}, 200);