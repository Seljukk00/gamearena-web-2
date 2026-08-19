// ==========================================
// TAKIM BİLMECE - MODÜL JS
// ==========================================

let takimData = {
    inGame: false,
    playerId: null,
    roomCode: "",
    difficulty: "klasik",
    players: [],
    maxPlayers: 2,
    totalQuestions: 12,
    turnSeconds: 60,
    currentTurn: null,
    questionNo: 0,
    teamData: null,
    scores: {},
    jokersLeft: {},
    revealedNames: {},
    yearRevealed: {},
    eliminatedOptions: {},
    answered: false,
    timerInterval: null,
    timerSeconds: 60
};

const takimLobbyScreen = document.getElementById("takimLobbyScreen");
const takimGameScreen = document.getElementById("takimGameScreen");

// ========================================
// 💬 TAKIM BİLMECE CHAT
// ========================================
let takimChat = {
    open: false,
    unread: 0,
    messages: [],
    maxMessages: 50
};

function showTakimChat() {
    const c = document.getElementById("takimChatContainer");
    if (c) c.style.display = "block";
}

function hideTakimChat() {
    const c = document.getElementById("takimChatContainer");
    if (c) c.style.display = "none";
    closeTakimChatPanel();
    takimChat.messages = [];
    takimChat.unread = 0;
    const box = document.getElementById("takimChatMessages");
    if (box) box.innerHTML = "";
    clearTakimChatPopups();
}

function toggleTakimChatPanel() {
    if (takimChat.open) closeTakimChatPanel();
    else openTakimChatPanel();
}

function openTakimChatPanel() {
    takimChat.open = true;
    takimChat.unread = 0;
    const panel = document.getElementById("takimChatPanel");
    const badge = document.getElementById("takimChatBadge");
    if (panel) panel.style.setProperty("display", "flex", "important");
    if (badge) badge.style.display = "none";
    clearTakimChatPopups();
    const box = document.getElementById("takimChatMessages");
    if (box) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
    const input = document.getElementById("takimChatInput");
    if (input) setTimeout(() => input.focus(), 100);
    setTimeout(() => {
        document.addEventListener("mousedown", takimChatOutsideClickHandler, true);
    }, 100);
}

function closeTakimChatPanel() {
    takimChat.open = false;
    const panel = document.getElementById("takimChatPanel");
    if (panel) panel.style.display = "none";
    document.removeEventListener("mousedown", takimChatOutsideClickHandler, true);
    const input = document.getElementById("takimChatInput");
    if (input && input.value) input.value = "";
}

function takimChatOutsideClickHandler(e) {
    const c = document.getElementById("takimChatContainer");
    if (!c) return;
    if (c.contains(e.target)) return;
    closeTakimChatPanel();
}

function sendTakimChatMessage() {
    const input = document.getElementById("takimChatInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text || text.length > 100) return;
    input.value = "";
    send({ type: "takim_chat_send", text: text });
}

function showTakimChatPopup(msg) {
    if (takimChat.open) return;
    const stack = document.getElementById("takimChatPopupStack");
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

function clearTakimChatPopups() {
    const stack = document.getElementById("takimChatPopupStack");
    if (!stack) return;
    stack.innerHTML = "";
    stack.style.display = "none";
}

function addTakimChatMessage(msg) {
    takimChat.messages.push(msg);
    if (takimChat.messages.length > takimChat.maxMessages) takimChat.messages.shift();
    
    const box = document.getElementById("takimChatMessages");
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
    
    while (box.children.length > takimChat.maxMessages) box.removeChild(box.firstChild);
    
    if (takimChat.open) {
        box.scrollTop = box.scrollHeight;
    } else {
        takimChat.unread++;
        const badge = document.getElementById("takimChatBadge");
        if (badge) {
            badge.textContent = takimChat.unread;
            badge.style.display = "flex";
            badge.style.animation = "none";
            badge.offsetHeight;
            badge.style.animation = "chatBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        }
        showTakimChatPopup(msg);
    }
}

// showScreen'i genişlet (DOĞRU YÖNTEM: önce eskiyi çağır)
const _originalShowScreenTakim = showScreen;
showScreen = function(screenName) {
    _originalShowScreenTakim(screenName);
    takimLobbyScreen.classList.add("hidden");
    takimGameScreen.classList.add("hidden");
    if (screenName === "takimLobby") takimLobbyScreen.classList.remove("hidden");
    if (screenName === "takimGame") takimGameScreen.classList.remove("hidden");
    
    // 💬 Takım Bilmece chat: sadece takimLobby/takimGame'de görünür
    const takimScreens = ["takimLobby", "takimGame"];
    if (!takimScreens.includes(screenName)) {
        hideTakimChat();
    }
};

// Oda oluştur butonu
document.getElementById("createTakimBtn").onclick = () => {
    const nameInput = document.getElementById("createTakimNameInput");
    const enteredName = nameInput ? nameInput.value.trim() : "";

    const difficulty = document.getElementById("takimDifficultySelect").value;
    const _turnSecRaw = parseInt(document.getElementById("takimTurnSecondsSelect").value);
    const turnSeconds = isNaN(_turnSecRaw) ? 60 : _turnSecRaw;
    const maxPlayers = parseInt(document.getElementById("takimMaxPlayersSelect").value) || 2;
    const totalQuestions = parseInt(document.getElementById("takimTotalQuestionsSelect").value) || 12;

    // ✨ MOD DEĞİŞİMİ mi?
    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.newMode === "takim_bilmece" && pendingModeChange.createScreen === "createTakim") {
        console.log("[MODE CHANGE] Takım Bilmece için mod_change_room gönderiliyor");
        document.getElementById("createTakimMsg").textContent = "Mod değiştiriliyor...";
        document.getElementById("createTakimMsg").style.color = "#51cf66";
        send({
            type: "mod_change_room",
            new_mode: "takim_bilmece",
            mode_settings: {
                difficulty: difficulty,
                turn_seconds: turnSeconds,
                max_players: maxPlayers,
                total_questions: totalQuestions
            }
        });
        return;
    }

    // Normal akış
    if (!enteredName) {
        document.getElementById("createTakimMsg").textContent = "İsim gir.";
        document.getElementById("createTakimMsg").style.color = "#ff6b6b";
        return;
    }
    localStorage.setItem("playerName", enteredName);
    myName = enteredName;
    send({
        type: "takim_create_room",
        name: enteredName,
        difficulty: difficulty,
        turn_seconds: turnSeconds,
        max_players: maxPlayers,
        total_questions: totalQuestions
    });
};

document.getElementById("takimStartBtn").onclick = () => {
    send({ type: "takim_start_game" });
};

document.getElementById("takimLobbyLeaveBtn").onclick = () => {
    window._showLeaveConfirmPopup();
};

// ✨ Mod Değiştir butonu
const _takimChangeModeBtn = document.getElementById("takimChangeModeBtn");
if (_takimChangeModeBtn) {
    _takimChangeModeBtn.onclick = () => {
        if (typeof openChangeModeModal === "function") {
            openChangeModeModal();
        }
    };
}

// Oda Ayarları butonu
document.getElementById("takimRoomSettingsBtn").onclick = () => {
    window.openRoomSettingsGeneric({
        title: "Takım Bilmece - Oda Ayarları",
        fields: [
            {
                id: "maxPlayers",
                label: "👥 Oyuncu Sayısı",
                current: takimData.maxPlayers || 2,
                minValue: (takimData.players && takimData.players.length > 2) ? takimData.players.length : null,
                options: [
                    {value: 2, label: "2 Oyuncu"},
                    {value: 3, label: "3 Oyuncu"},
                    {value: 4, label: "4 Oyuncu"},
                    {value: 5, label: "5 Oyuncu"}
                ]
            },
            {
                id: "totalQ",
                label: "❓ Soru Sayısı",
                current: takimData.totalQuestions || 12,
                options: [
                    {value: 6, label: "6 Soru"},
                    {value: 9, label: "9 Soru"},
                    {value: 12, label: "12 Soru"},
                    {value: 15, label: "15 Soru"},
                    {value: 20, label: "20 Soru"},
                    {value: 25, label: "25 Soru"}
                ]
            },
            {
                id: "difficulty",
                label: "🎯 Zorluk",
                current: takimData.difficulty || "klasik",
                options: [
                    {value: "kolay", label: "🟢 Kolay"},
                    {value: "orta", label: "🟡 Orta"},
                    {value: "zor", label: "🔴 Zor"},
                    {value: "klasik", label: "🎯 Klasik (Karışık)"}
                ]
            },
            {
                id: "turnSec",
                label: "⏱️ Tur Süresi",
                current: takimData.turnSeconds || 60,
                options: [
                    {value: 15, label: "15 saniye"},
                    {value: 30, label: "30 saniye"},
                    {value: 45, label: "45 saniye"},
                    {value: 60, label: "60 saniye"},
                    {value: 120, label: "120 saniye"},
                    {value: 0, label: "♾️ Sınırsız"}
                ]
            }
        ],
        onSave: (values) => {
            const _ts = parseInt(values.turnSec);
            send({
                type: "takim_update_settings",
                difficulty: values.difficulty,
                turn_seconds: isNaN(_ts) ? 60 : _ts,
                max_players: parseInt(values.maxPlayers) || 2,
                total_questions: parseInt(values.totalQ) || 12
            });
        }
    });
};

const takimRoomHelper = window.setupRoomCodeAndLink({
    codeTextId: "takimRoomCodeText",
    codeEyeBtnId: "takimRoomCodeEyeBtn",
    copyHintId: "takimCopyHint",
    linkTextId: "takimInviteLinkText",
    linkEyeBtnId: "takimInviteLinkEyeBtn",
    linkHintId: "takimInviteLinkHint",
    getRoomCode: () => takimData.roomCode,
    getPlayerId: () => takimData.playerId
});

document.getElementById("takimBackBtn").onclick = () => {
    showEscPopup();
};

document.getElementById("takimBackToMenuBtn").onclick = () => {
    // Popup'ları kapat
    document.getElementById("takimGameOverBox").classList.add("hidden");
    document.getElementById("takimPassConfirmBox").classList.add("hidden");
    // WebSocket bağlantısını kapat (host ise oda dağılır)
    if (typeof ws !== "undefined" && ws) {
        try { ws.close(); } catch(e) {}
    }
    // State sıfırla
    inRoom = false;
    takimData.roomCode = "";
    takimData.playerId = null;
    takimData.players = [];
    playerId = null;
    roomCode = "";
    // WS yeniden bağla + ana menüye git
    setTimeout(() => {
        if (typeof connectWS === "function") connectWS();
        showScreen("home");
    }, 200);
};

document.getElementById("takimRematchBtn").onclick = () => {
    document.getElementById("takimGameOverBox").classList.add("hidden");
    send({ type: "takim_rematch" });
};

document.getElementById("takimBackToLobbyBtn").onclick = () => {
    if (takimData.playerId === 1) {
        // HOST: backend'e broadcast et (herkesi lobiye atacak)
        send({ type: "takim_back_to_lobby" });
    } else {
        // MİSAFİR: sadece kendi ekranını lobiye çevir
        document.getElementById("takimGameOverBox").classList.add("hidden");
        showScreen("takimLobby");
        updateTakimLobby();
    }
};

let takimPickPlayerMode = false;

document.getElementById("takimJokerNameBtn").onclick = () => {
    if (takimData.currentTurn !== takimData.playerId || takimData.answered) return;
    if (takimPickPlayerMode) { cancelNameJoker(); return; }
    send({ type: "takim_joker_name_start" });
    takimPickPlayerMode = true;
    updateTakimStatus("Bir oyuncuya tıkla ismi görün");
    document.getElementById("takimJokerCancelBtn").classList.remove("hidden");
    renderTakimField();
    renderTakimOptions();
};

function cancelNameJoker() {
    send({ type: "takim_joker_name_cancel" });
    takimPickPlayerMode = false;
    updateTakimStatus("");
    document.getElementById("takimJokerCancelBtn").classList.add("hidden");
    renderTakimField();
    renderTakimOptions();
}

document.getElementById("takimJokerCancelBtn").onclick = () => { cancelNameJoker(); };

document.getElementById("takimJokerYearBtn").onclick = () => {
    if (takimData.currentTurn !== takimData.playerId || takimData.answered) return;
    send({ type: "takim_joker_year" });
};

document.getElementById("takimJokerElimBtn").onclick = () => {
    if (takimData.currentTurn !== takimData.playerId || takimData.answered) return;
    send({ type: "takim_joker_elim" });
};

document.getElementById("takimJokerPassBtn").onclick = () => {
    if (takimData.currentTurn !== takimData.playerId || takimData.answered) return;
    document.getElementById("takimPassConfirmBox").classList.remove("hidden");
};

document.getElementById("takimPassYesBtn").onclick = () => {
    document.getElementById("takimPassConfirmBox").classList.add("hidden");
    send({ type: "takim_joker_pass" });
};

document.getElementById("takimPassNoBtn").onclick = () => {
    document.getElementById("takimPassConfirmBox").classList.add("hidden");
};

document.querySelectorAll(".takimOptBtn").forEach(btn => {
    btn.onclick = () => {
        if (takimData.currentTurn !== takimData.playerId || takimData.answered) return;
        const choice = parseInt(btn.dataset.choice);
        if (takimData.eliminatedOptions[takimData.playerId].includes(choice)) return;
        send({ type: "takim_answer", choice: choice });
    };
});

function updateTakimStatus(text, color) {
    const el = document.getElementById("takimStatusMsg");
    el.textContent = text || "";
    el.style.color = color || "#ffa94d";
}

function updateTakimLobby() {
    if (takimRoomHelper) { takimRoomHelper.renderCode(); takimRoomHelper.renderLink(); }
    const diffNames = { 
        kolay: "🟢 Kolay", 
        orta: "🟡 Orta", 
        zor: "🔴 Zor",
        klasik: "🎯 Klasik (Karışık)"
    };
    document.getElementById("takimLobbyDifficulty").textContent = diffNames[takimData.difficulty] || takimData.difficulty;
    const _ts = takimData.turnSeconds;
    document.getElementById("takimLobbyTurnSeconds").textContent = (_ts === 0) ? "♾️" : _ts;
    const _maxEl = document.getElementById("takimLobbyMaxPlayers");
    if (_maxEl) _maxEl.textContent = takimData.maxPlayers || 2;
    const _totEl = document.getElementById("takimLobbyTotalQuestions");
    if (_totEl) _totEl.textContent = takimData.totalQuestions || 12;
    
    const list = document.getElementById("takimPlayersList");
    list.innerHTML = "";
    takimData.players.forEach(p => {
        const li = document.createElement("li");
        
        const nameCell = document.createElement("span");
        nameCell.style.flex = "1";
        nameCell.style.textAlign = "left";
        nameCell.style.paddingLeft = "10px";
        const crown = p.id === 1 ? " 👑" : "";
        nameCell.textContent = p.id === takimData.playerId ? `${p.id}. ${p.name} (Sen)${crown}` : `${p.id}. ${p.name}${crown}`;
        li.appendChild(nameCell);
        
        if (p.id !== takimData.playerId && takimData.playerId === 1) {
            const kickBtn = document.createElement("button");
            kickBtn.className = "kickBtnNew";
            kickBtn.textContent = "Oyuncuyu At";
            kickBtn.onclick = () => openKickConfirm(p.id, p.name);
            li.appendChild(kickBtn);
        }
        
        if (p.id === takimData.playerId) {
            li.classList.add("playerMine");
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });
    
    const startBtn = document.getElementById("takimStartBtn");
    const msg = document.getElementById("takimLobbyMsg");
    const maxP = takimData.maxPlayers || 2;
    const curP = takimData.players.length;
    
    if (takimData.playerId === 1 && curP === maxP) {
        startBtn.classList.remove("hidden");
        msg.textContent = `${maxP} oyuncu hazır. Başlatabilirsin!`;
        msg.style.color = "#51cf66";
    } else if (takimData.playerId === 1) {
        startBtn.classList.add("hidden");
        msg.textContent = `Oyuncu bekleniyor... (${curP}/${maxP})`;
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        msg.textContent = `Host bekleniyor... (${curP}/${maxP})`;
        msg.style.color = "#51cf66";
    }
    
    const settingsBtn = document.getElementById("takimRoomSettingsBtn");
    if (settingsBtn) {
        if (takimData.playerId === 1) settingsBtn.classList.remove("hidden");
        else settingsBtn.classList.add("hidden");
    }
    
    // ✨ Mod Değiştir butonu - sadece host görsün
    const changeModeBtn = document.getElementById("takimChangeModeBtn");
    if (changeModeBtn) {
        if (takimData.playerId === 1) changeModeBtn.classList.remove("hidden");
        else changeModeBtn.classList.add("hidden");
    }
}

function getTakimOtherPlayerId() {
    // Geriye uyumluluk: sadece 2 kişilikte anlamlı
    return takimData.playerId === 1 ? 2 : 1;
}

function getTakimPlayerName(id) {
    const p = takimData.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function getTakimActivePlayerIds() {
    return takimData.players.map(p => p.id).sort((a, b) => a - b);
}

function isTakimMultiPlayer() {
    return (takimData.maxPlayers || 2) >= 3;
}

function renderTakimField() {
    const field = document.getElementById("takimField");
    field.innerHTML = "";
    
    if (!takimData.teamData) return;
    const players = takimData.teamData.players;
    
    const gk = [], defs = [], mids = [], fwds = [];
    players.forEach((p, idx) => {
        const pos = p.pos.toUpperCase();
        if (pos === "GK") gk.push({ idx, p });
        else if (["RB", "CB", "LB"].includes(pos)) defs.push({ idx, p });
        else if (["CM", "AM", "DM", "CDM"].includes(pos)) mids.push({ idx, p });
        else fwds.push({ idx, p });
    });
    
    defs.sort((a, b) => {
        const order = { LB: 0, CB: 1, RB: 2 };
        return (order[a.p.pos.toUpperCase()] ?? 1) - (order[b.p.pos.toUpperCase()] ?? 1);
    });
    fwds.sort((a, b) => {
        const order = { LW: 0, ST: 1, CF: 1, RW: 2 };
        return (order[a.p.pos.toUpperCase()] ?? 1) - (order[b.p.pos.toUpperCase()] ?? 1);
    });
    
    const positioned = [];
    gk.forEach(({ idx, p }) => { positioned.push({ idx, p, x: 50, y: 88 }); });
    
    if (defs.length > 0) {
        const y = 70;
        defs.forEach((item, i) => {
            const x = defs.length === 1 ? 50 : 15 + (70 * i / (defs.length - 1));
            positioned.push({ idx: item.idx, p: item.p, x, y });
        });
    }
    if (mids.length > 0) {
        const y = 45;
        mids.forEach((item, i) => {
            const x = mids.length === 1 ? 50 : 15 + (70 * i / (mids.length - 1));
            positioned.push({ idx: item.idx, p: item.p, x, y });
        });
    }
    if (fwds.length > 0) {
        const y = 15;
        fwds.forEach((item, i) => {
            const x = fwds.length === 1 ? 50 : 15 + (70 * i / (fwds.length - 1));
            positioned.push({ idx: item.idx, p: item.p, x, y });
        });
    }
    
    positioned.forEach(({ idx, p, x, y }) => {
        const slot = document.createElement("div");
        slot.className = "takimPlayerSlot";
        slot.style.left = x + "%";
        slot.style.top = y + "%";
        
        const flagBox = document.createElement("div");
        flagBox.className = "takimFlagBox";
        
        if (takimPickPlayerMode && !takimData.revealedNames[takimData.playerId][idx]) {
            flagBox.classList.add("clickable");
            flagBox.onclick = () => {
                send({ type: "takim_joker_name", player_index: idx });
                takimPickPlayerMode = false;
                updateTakimStatus("");
            };
        }
        
        const img = document.createElement("img");
        img.src = `/flags/${p.flag}.png`;
        img.onerror = () => {
            img.style.display = "none";
            flagBox.textContent = p.flag.substr(0, 3).toUpperCase();
            flagBox.style.color = "#000";
            flagBox.style.fontSize = "11px";
            flagBox.style.fontWeight = "bold";
            flagBox.style.padding = "8px 6px";
        };
        flagBox.appendChild(img);
        
        const pos = document.createElement("div");
        pos.className = "takimPlayerPos";
        pos.textContent = p.pos;
        
        slot.appendChild(flagBox);
        slot.appendChild(pos);
        
        const myRevealed = takimData.revealedNames[takimData.playerId] || {};
        const myNameShown = myRevealed[idx];
        // Aktif sıradaki oyuncunun açtığı isimleri de göster
        let oppName = null;
        if (takimData.currentTurn !== takimData.playerId) {
            const turnRevealed = takimData.revealedNames[takimData.currentTurn] || {};
            oppName = turnRevealed[idx];
        }
        if (myNameShown) {
            const nameDiv = document.createElement("div");
            nameDiv.className = "takimPlayerName";
            nameDiv.textContent = myNameShown;
            slot.appendChild(nameDiv);
        } else if (oppName) {
            const nameDiv = document.createElement("div");
            nameDiv.className = "takimPlayerName";
            nameDiv.style.color = "#ffa94d";
            nameDiv.textContent = oppName;
            slot.appendChild(nameDiv);
        }
        
        field.appendChild(slot);
    });
}

function renderTakimOptions() {
    if (!takimData.teamData) return;
    const opts = takimData.teamData.options;
    const buttons = document.querySelectorAll(".takimOptBtn");
    
    buttons.forEach((btn, i) => {
        btn.classList.remove("eliminated", "correct", "wrong");
        btn.disabled = false;
        btn.querySelector(".optText").textContent = opts[i] || "---";
        
        const isMyTurn = takimData.currentTurn === takimData.playerId;
        if (!isMyTurn || takimData.answered) btn.disabled = true;
        if (takimPickPlayerMode) btn.disabled = true;
        
        const activePlayer = takimData.currentTurn;
        const elimList = takimData.eliminatedOptions[activePlayer] || [];
        if (elimList.includes(i)) {
            btn.classList.add("eliminated");
            btn.disabled = true;
        }
    });
}

document.querySelectorAll(".takimOptBtn").forEach(btn => {
    // eski onclick zaten var, tekrar bind yok
});

function renderTakimJokers() {
    const isMyTurn = takimData.currentTurn === takimData.playerId;
    const my = takimData.jokersLeft[takimData.playerId] || {};
    // Rakip yerine: aktif sıradaki oyuncunun jokerleri
    const activeId = takimData.currentTurn;
    const opp = takimData.jokersLeft[activeId] || {};
    const panel = document.getElementById("takimJokerPanel");
    
    // Alttaki zorluk etiketini gizle (üstte zaten gösteriliyor)
    const diffLabel = document.getElementById("takimDifficultyLabel");
    if (diffLabel) diffLabel.style.display = "none";
    
    if (isMyTurn) {
        panel.classList.remove("opponent-view");
        document.getElementById("takimJokerTitle").textContent = "JOKERLER";
        document.getElementById("takimJokerTitle").style.color = "gold";
        
        // Kendi görünümüm: HER ZAMAN parantez göster (0 olsa bile)
        function setMyBtnLabel(btnId, label, count) {
            const btn = document.getElementById(btnId);
            btn.innerHTML = `${label} (<span>${count}</span>)`;
        }
        setMyBtnLabel("takimJokerNameBtn", "İSİM GÖSTER", my.name ?? 0);
        setMyBtnLabel("takimJokerYearBtn", "YIL GÖSTER", my.year ?? 0);
        setMyBtnLabel("takimJokerElimBtn", "ŞIK ELE", my.elim ?? 0);
        setMyBtnLabel("takimJokerPassBtn", "PAS GEÇ", my.pass ?? 0);
        const canUse = !takimData.answered;
        document.getElementById("takimJokerNameBtn").disabled = !canUse || (my.name ?? 0) <= 0;
        document.getElementById("takimJokerYearBtn").disabled = !canUse || (my.year ?? 0) <= 0 || takimData.yearRevealed[takimData.playerId];
        document.getElementById("takimJokerElimBtn").disabled = !canUse || (my.elim ?? 0) <= 0;
        document.getElementById("takimJokerPassBtn").disabled = !canUse || (my.pass ?? 0) <= 0;
        // ✨ Opacity + filter + visibility + text-decoration'ı geri normal yap
        ["takimJokerNameBtn", "takimJokerYearBtn", "takimJokerElimBtn", "takimJokerPassBtn"].forEach(id => {
            const btn = document.getElementById(id);
            btn.style.opacity = "";
            btn.style.filter = "";
            btn.style.pointerEvents = "";
            btn.style.visibility = "";
            btn.style.textDecoration = "";
            btn.style.textDecorationThickness = "";
        });
    } else {
        panel.classList.add("opponent-view");
        document.getElementById("takimJokerTitle").textContent = "RAKİP JOKERLER";
        document.getElementById("takimJokerTitle").style.color = "#ffa94d";
        
        // Rakip görünümü: 0 ise butonun tüm metnini yeniden yaz (parantez tamamen silinir)
        function setOppBtnLabel(btnId, label, count) {
            const btn = document.getElementById(btnId);
            if (count > 0) {
                btn.innerHTML = `${label} (<span>${count}</span>)`;
            } else {
                btn.innerHTML = label;
            }
        }
        setOppBtnLabel("takimJokerNameBtn", "İSİM GÖSTER", opp.name ?? 0);
        setOppBtnLabel("takimJokerYearBtn", "YIL GÖSTER", opp.year ?? 0);
        setOppBtnLabel("takimJokerElimBtn", "ŞIK ELE", opp.elim ?? 0);
        setOppBtnLabel("takimJokerPassBtn", "PAS GEÇ", opp.pass ?? 0);
        document.getElementById("takimJokerNameBtn").disabled = true;
        document.getElementById("takimJokerYearBtn").disabled = true;
        document.getElementById("takimJokerElimBtn").disabled = true;
        document.getElementById("takimJokerPassBtn").disabled = true;
        
        const nameBtn = document.getElementById("takimJokerNameBtn");
        const yearBtn = document.getElementById("takimJokerYearBtn");
        const elimBtn = document.getElementById("takimJokerElimBtn");
        const passBtn = document.getElementById("takimJokerPassBtn");
        
        const oppId = activeId;
        const oppYearUsed = takimData.yearRevealed[oppId];
        const oppElimUsed = (takimData.eliminatedOptions[oppId] || []).length > 0;
        
        // Küçük helper: butonu "kullanılmış/soluk gri" göster
        function setUsed(btn, isUsed) {
            if (isUsed) {
                // Kullanıldı → üstü çizik yazı
                btn.style.textDecoration = "line-through";
                btn.style.textDecorationThickness = "2px";
                btn.style.pointerEvents = "none";
                btn.style.opacity = "0.7";
            } else {
                btn.style.textDecoration = "";
                btn.style.textDecorationThickness = "";
                btn.style.opacity = "1";
                btn.style.pointerEvents = "";
            }
        }
        
        // Sadece 0 olan jokerlerin üstünü çiz (kullanım sayısına bakma)
        setUsed(nameBtn, (opp.name ?? 0) <= 0);
        setUsed(yearBtn, (opp.year ?? 0) <= 0);
        setUsed(elimBtn, (opp.elim ?? 0) <= 0);
        setUsed(passBtn, (opp.pass ?? 0) <= 0);
    }
}

function renderTakimScoreboard() {
    const isMulti = isTakimMultiPlayer();
    const scoreboard2P = document.getElementById("takimScoreboard2P");
    const playerScoresBox = document.getElementById("takimPlayerScores");
    const scoreboardPanel = document.getElementById("takimScoreboardPanel");
    
    if (isMulti) {
        // 3+ kişi: üst skorbord ve sağ mini skoru gizle, sağ paneldeki sıralamayı göster
        if (scoreboard2P) scoreboard2P.style.visibility = "hidden";
        if (playerScoresBox) playerScoresBox.style.display = "none";
        if (scoreboardPanel) scoreboardPanel.style.display = "";
    } else {
        // 2 kişi: eski davranış
        if (scoreboard2P) scoreboard2P.style.visibility = "";
        if (playerScoresBox) playerScoresBox.style.display = "";
        if (scoreboardPanel) scoreboardPanel.style.display = "none";
        
        const p1 = getTakimPlayerName(1);
        const p2 = getTakimPlayerName(2);
        document.getElementById("takimP1Name").textContent = p1;
        document.getElementById("takimP2Name").textContent = p2;
        document.getElementById("takimP1ScoreName").textContent = p1;
        document.getElementById("takimP2ScoreName").textContent = p2;
        document.getElementById("takimP1Score").textContent = takimData.scores[1] ?? 0;
        document.getElementById("takimP2Score").textContent = takimData.scores[2] ?? 0;
        document.getElementById("takimScore").textContent = `${takimData.scores[1] ?? 0} - ${takimData.scores[2] ?? 0}`;
    }
    
    // Soru numarası + zorluk
    const questionText = `Soru ${takimData.questionNo + 1}/${takimData.totalQuestions}`;
    const questionDiff = takimData.teamData?.difficulty || takimData.difficulty || "";
    const diffEmoji = { kolay: "🟢", orta: "🟡", zor: "🔴" };
    
    document.getElementById("takimQuestionNo").innerHTML = questionDiff
        ? `${questionText} ${diffEmoji[questionDiff] || ""} <span style="opacity:0.7">${questionDiff.toUpperCase()}</span>`
        : questionText;
    
    const turnName = getTakimPlayerName(takimData.currentTurn);
    const turnColor = takimData.currentTurn === takimData.playerId ? "#51cf66" : "#ffa94d";
    document.getElementById("takimTurnInfo").innerHTML = `Sıra: <span style="color:${turnColor}">${turnName}</span>`;
    
    const yearEl = document.getElementById("takimYearDisplay");
    const activePlayerForYear = takimData.currentTurn;
    if (takimData.yearRevealed[activePlayerForYear]) {
        yearEl.textContent = `Yıl: ${takimData.teamData.year}`;
        yearEl.classList.add("revealed");
    } else {
        yearEl.textContent = "Yıl: ???";
        yearEl.classList.remove("revealed");
    }
    
    // Çoklu modda sağ paneldeki sıralamayı çiz
    if (isMulti) renderTakimScoreboardList();
}

function renderTakimScoreboardList() {
    const listEl = document.getElementById("takimScoreboardList");
    if (!listEl) return;
    
    // Aktif oyuncuların skorlarını topla
    const rows = takimData.players.map(p => ({
        id: p.id,
        name: p.name,
        score: takimData.scores[p.id] ?? 0
    }));
    // Skora göre azalan sırala
    rows.sort((a, b) => b.score - a.score);
    
    // Mevcut DOM içeriğini yenile (FLIP animasyonu için önce eski pozisyonları al)
    const oldPositions = {};
    Array.from(listEl.children).forEach(li => {
        const pid = parseInt(li.dataset.pid);
        oldPositions[pid] = li.getBoundingClientRect().top;
    });
    
    listEl.innerHTML = "";
    rows.forEach((row, idx) => {
        const li = document.createElement("li");
        li.dataset.pid = row.id;
        li.className = "takimScoreRow";
        if (row.id === takimData.currentTurn) li.classList.add("activeTurn");
        if (row.id === takimData.playerId) li.classList.add("meRow");
        
        const rankBadge = document.createElement("span");
        rankBadge.className = "takimRankBadge";
        const medals = ["🥇", "🥈", "🥉"];
        rankBadge.textContent = medals[idx] || `${idx + 1}.`;
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "takimScoreName";
        nameSpan.textContent = row.name + (row.id === takimData.playerId ? " (Sen)" : "");
        
        const scoreSpan = document.createElement("span");
        scoreSpan.className = "takimScoreVal";
        scoreSpan.textContent = row.score;
        
        li.appendChild(rankBadge);
        li.appendChild(nameSpan);
        li.appendChild(scoreSpan);
        listEl.appendChild(li);
    });
    
    // FLIP animasyonu (yeni pozisyondan eskiye kaydırıp animate et)
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

function renderTakimAll() {
    renderTakimScoreboard();
    renderTakimField();
    renderTakimOptions();
    renderTakimJokers();
}

function startTakimTimer(seconds) {
    stopTakimTimer();
    takimData.timerSeconds = seconds;
    takimData.timerUnlimited = (seconds === 0);  // ✨ Sınırsız mı?
    updateTakimTimerDisplay();
    if (takimData.timerUnlimited) return;  // Sınırsızda geri sayım yok
    takimData.timerInterval = setInterval(() => {
        takimData.timerSeconds--;
        updateTakimTimerDisplay();
        if (takimData.timerSeconds <= 0) stopTakimTimer();
    }, 1000);
}

function stopTakimTimer() {
    if (takimData.timerInterval) {
        clearInterval(takimData.timerInterval);
        takimData.timerInterval = null;
    }
}

function updateTakimTimerDisplay() {
    const el = document.getElementById("takimTimer");
    if (takimData.timerUnlimited) {
        el.textContent = "♾️";
        el.classList.remove("warning", "danger");
        return;
    }
    el.textContent = takimData.timerSeconds + "s";
    el.classList.remove("warning", "danger");
    if (takimData.timerSeconds <= 10) el.classList.add("danger");
    else if (takimData.timerSeconds <= 20) el.classList.add("warning");
}

const _originalHandleMessageTakim = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "takim_room_created" || msg.type === "takim_room_joined") {
        takimData.playerId = msg.player_id;
        takimData.roomCode = msg.room_code;
        takimData.difficulty = msg.difficulty || "klasik";
        if (msg.max_players !== undefined) takimData.maxPlayers = msg.max_players;
        if (msg.total_questions !== undefined) takimData.totalQuestions = msg.total_questions;
        if (msg.turn_seconds !== undefined) takimData.turnSeconds = msg.turn_seconds;
        takimData.inGame = true;
        inRoom = true;
        showTakimChat();
        showScreen("takimLobby");
        updateTakimLobby();
        return;
    }
    
    if (msg.type === "takim_lobby_update") {
        showTakimChat();
        takimData.roomCode = msg.room_code;
        takimData.players = msg.players;
        takimData.difficulty = msg.difficulty || "klasik";
        takimData.turnSeconds = (msg.turn_seconds !== undefined && msg.turn_seconds !== null) ? msg.turn_seconds : 60;
        if (msg.max_players !== undefined) takimData.maxPlayers = msg.max_players;
        if (msg.total_questions !== undefined) takimData.totalQuestions = msg.total_questions;
        updateTakimLobby();
        return;
    }
    
    // 💬 CHAT mesajları
    if (msg.type === "takim_chat_msg") {
        addTakimChatMessage({
            sender_id: msg.sender_id,
            sender_name: msg.sender_name,
            text: msg.text,
            ts: msg.ts
        });
        return;
    }
    
    if (msg.type === "takim_chat_history") {
        if (msg.messages && Array.isArray(msg.messages)) {
            const wasOpen = takimChat.open;
            takimChat.open = true;
            msg.messages.forEach(m => addTakimChatMessage(m));
            takimChat.open = wasOpen;
            takimChat.unread = 0;
            const badge = document.getElementById("takimChatBadge");
            if (badge) badge.style.display = "none";
        }
        return;
    }
    
    if (msg.type === "takim_game_started") {
        takimData.playerId = msg.player_id;
        takimData.players = msg.players;
        takimData.difficulty = msg.difficulty;
        takimData.totalQuestions = msg.total_questions;
        takimData.turnSeconds = msg.turn_seconds;
        takimData.currentTurn = msg.current_turn;
        takimData.questionNo = msg.question_no;
        takimData.teamData = msg.team_data;
        takimData.scores = msg.scores;
        takimData.jokersLeft = msg.jokers_left;
        if (msg.max_players !== undefined) takimData.maxPlayers = msg.max_players;
        // Aktif oyuncu ID'lerine göre state sıfırla
        const pids = takimData.players.map(p => p.id);
        takimData.revealedNames = {};
        takimData.yearRevealed = {};
        takimData.eliminatedOptions = {};
        pids.forEach(id => {
            takimData.revealedNames[id] = {};
            takimData.yearRevealed[id] = false;
            takimData.eliminatedOptions[id] = [];
        });
        takimData.answered = false;
        takimPickPlayerMode = false;
        // Game Over popup açık kalmışsa (rematch bug'ı) kapat
        document.getElementById("takimGameOverBox").classList.add("hidden");
        showScreen("takimGame");
        renderTakimAll();
        startTakimTimer(takimData.turnSeconds);
        if (takimData.currentTurn === takimData.playerId) updateTakimStatus("Senin sıran!", "#51cf66");
        else updateTakimStatus(getTakimPlayerName(takimData.currentTurn) + " oynuyor...", "#ffa94d");
        return;
    }
    
    if (msg.type === "takim_new_question") {
        takimData.questionNo = msg.question_no;
        takimData.currentTurn = msg.current_turn;
        takimData.teamData = msg.team_data;
        takimData.scores = msg.scores;
        takimData.jokersLeft = msg.jokers_left;
        const pids = takimData.players.map(p => p.id);
        takimData.revealedNames = {};
        takimData.yearRevealed = {};
        takimData.eliminatedOptions = {};
        pids.forEach(id => {
            takimData.revealedNames[id] = {};
            takimData.yearRevealed[id] = false;
            takimData.eliminatedOptions[id] = [];
        });
        takimData.answered = false;
        takimPickPlayerMode = false;
        document.getElementById("takimJokerCancelBtn").classList.add("hidden");
        renderTakimAll();
        startTakimTimer(takimData.turnSeconds);
        if (takimData.currentTurn === takimData.playerId) updateTakimStatus("Senin sıran!", "#51cf66");
        else updateTakimStatus(getTakimPlayerName(takimData.currentTurn) + " oynuyor...", "#ffa94d");
        return;
    }
    
    if (msg.type === "takim_joker_used") {
        if (msg.jokers_left) takimData.jokersLeft = msg.jokers_left;
        if (msg.joker_type === "name") {
            if (!takimData.revealedNames[msg.player_id]) takimData.revealedNames[msg.player_id] = {};
            takimData.revealedNames[msg.player_id][msg.player_index] = msg.player_name;
            if (msg.player_id === takimData.playerId) {
                takimPickPlayerMode = false;
                updateTakimStatus("");
                document.getElementById("takimJokerCancelBtn").classList.add("hidden");
            }
        } else if (msg.joker_type === "year") {
            takimData.yearRevealed[msg.player_id] = true;
        } else if (msg.joker_type === "elim") {
            takimData.eliminatedOptions[msg.player_id] = msg.eliminated;
        }
        renderTakimAll();
        return;
    }
    
    if (msg.type === "takim_joker_preview") {
        if (msg.jokers_left) takimData.jokersLeft = msg.jokers_left;
        renderTakimJokers();
        return;
    }
    
    if (msg.type === "takim_joker_cancel") {
        if (msg.jokers_left) takimData.jokersLeft = msg.jokers_left;
        renderTakimJokers();
        return;
    }
    
    if (msg.type === "takim_answer_result") {
        takimData.answered = true;
        takimData.scores = msg.scores;
        stopTakimTimer();
        const buttons = document.querySelectorAll(".takimOptBtn");
        buttons.forEach((btn, i) => {
            btn.disabled = true;
            if (i === msg.correct_answer) btn.classList.add("correct");
            else if (i === msg.choice && !msg.correct) btn.classList.add("wrong");
        });
        let statusText = "";
        if (msg.passed) statusText = `${getTakimPlayerName(msg.player_id)} PAS GEÇTİ`;
        else if (msg.timeout) statusText = `${getTakimPlayerName(msg.player_id)} SÜRESİ DOLDU! -1`;
        else if (msg.correct) statusText = `${getTakimPlayerName(msg.player_id)} DOĞRU! +3`;
        else statusText = `${getTakimPlayerName(msg.player_id)} YANLIŞ! -1`;
        updateTakimStatus(statusText, msg.correct ? "#51cf66" : "#ff6b6b");
        renderTakimScoreboard();
        return;
    }
    
    if (msg.type === "takim_game_over") {
        takimData.scores = msg.scores;
        stopTakimTimer();
        renderTakimScoreboard();
        const title = document.getElementById("takimGameOverTitle");
        const text = document.getElementById("takimGameOverText");
        if (msg.winner_id === 0) { title.textContent = "BERABERE!"; title.style.color = "#74c0fc"; }
        else if (msg.winner_id === takimData.playerId) { title.textContent = "KAZANDIN! 🏆"; title.style.color = "#51cf66"; startConfetti(); }
        else { title.textContent = "KAYBETTİN 😢"; title.style.color = "#ff6b6b"; }
        
        // Sıralama listesi (backend'ten ranking geldiyse onu, yoksa scores'tan üret)
        let ranking = msg.ranking;
        if (!ranking || !Array.isArray(ranking)) {
            ranking = [];
            for (const [pidStr, sc] of Object.entries(takimData.scores)) {
                const pid = parseInt(pidStr);
                ranking.push({ player_id: pid, name: getTakimPlayerName(pid), score: sc });
            }
            ranking.sort((a, b) => b.score - a.score);
        }
        
        const listEl = document.getElementById("takimGameOverList");
        if (listEl) {
            listEl.innerHTML = "";
            const medals = ["🥇", "🥈", "🥉"];
            ranking.forEach((row, idx) => {
                const li = document.createElement("li");
                li.className = "takimGameOverItem";
                if (idx === 0) li.classList.add("goldRank");
                if (row.player_id === takimData.playerId) li.classList.add("meRow");
                const medal = medals[idx] || `${idx + 1}.`;
                li.innerHTML = `<span class="rankIcon">${medal}</span> <span class="rankName">${row.name}</span> <span class="rankScore">${row.score}</span>`;
                listEl.appendChild(li);
            });
        }
        
        // Kısa özet metni
        if (ranking.length === 2) {
            text.innerHTML = `Skor: <b>${ranking[0].score} - ${ranking[1].score}</b>`;
        } else {
            text.innerHTML = `<b>${ranking.length}</b> oyuncu yarıştı`;
        }
        
        const rematchBtn = document.getElementById("takimRematchBtn");
        const lobbyBtn = document.getElementById("takimBackToLobbyBtn");
        if (takimData.playerId === 1) {
            rematchBtn.classList.remove("hidden");
            lobbyBtn.classList.remove("hidden");
        } else {
            rematchBtn.classList.add("hidden");
            // ✨ Misafir de kendi lobisine dönebilsin (izleyici olur)
            lobbyBtn.classList.remove("hidden");
        }
        document.getElementById("takimGameOverBox").classList.remove("hidden");
        return;
    }
    
    if (msg.type === "takim_player_left") {
        // Bir oyuncu ayrıldı - listeden sil ve UI'ı güncelle
        if (msg.players) {
            takimData.players = msg.players;
        }
        if (msg.scores) {
            takimData.scores = msg.scores;
        }
        // Ayrılan oyuncunun local state'ini de temizle
        if (msg.player_id !== undefined) {
            delete takimData.jokersLeft[msg.player_id];
            delete takimData.revealedNames[msg.player_id];
            delete takimData.yearRevealed[msg.player_id];
            delete takimData.eliminatedOptions[msg.player_id];
        }
        // Sağ paneli ve tüm ekranı tazele
        renderTakimAll();
        // Toast bildirimi
        if (typeof showToast === "function") {
            showToast(`${msg.name || "Bir oyuncu"} oyundan ayrıldı`, "warn");
        } else {
            console.log("Oyuncu ayrıldı:", msg.name);
        }
        return;
    }
    
    if (msg.type === "takim_back_to_lobby") {
        // Popup'ları kapat, lobiye dön
        document.getElementById("takimGameOverBox").classList.add("hidden");
        document.getElementById("takimPassConfirmBox").classList.add("hidden");
        showScreen("takimLobby");
        updateTakimLobby();
        return;
    }
    
    _originalHandleMessageTakim(msg);
};

document.getElementById("takimGameOverBox").classList.add("hidden");
document.getElementById("takimPassConfirmBox").classList.add("hidden");
document.getElementById("takimJokerCancelBtn").classList.add("hidden");

// ========================================
// 💬 TAKIM BİLMECE CHAT - Event'ler
// ========================================
setTimeout(() => {
    const toggleBtn = document.getElementById("takimChatToggleBtn");
    if (toggleBtn) toggleBtn.addEventListener("click", toggleTakimChatPanel);
    
    const closeBtn = document.getElementById("takimChatCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeTakimChatPanel);
    
    const sendBtn = document.getElementById("takimChatSendBtn");
    if (sendBtn) sendBtn.addEventListener("click", sendTakimChatMessage);
    
    const input = document.getElementById("takimChatInput");
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                sendTakimChatMessage();
                closeTakimChatPanel();  // ✨ Mesaj gönderdikten sonra chat kapansın
                return;
            }
            e.stopPropagation();
        });
    }
    
    // T tuşu → chat aç + focus
    document.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (k !== "t") return;
        
        // Sadece Takım Bilmece ekranlarında (takimLobby/takimGame)
        const current = getCurrentScreen();
        if (!["takimLobby", "takimGame"].includes(current)) return;
        
        // Input/textarea odaktaysa yoksay
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
        
        // Chat görünmüyorsa yoksay
        const container = document.getElementById("takimChatContainer");
        if (!container || container.style.display === "none") return;
        
        // Zaten açıksa yoksay
        if (takimChat.open) return;
        
        // Popup açıksa yoksay
        const anyPopup = document.querySelector(".overlay:not(.hidden)");
        if (anyPopup) return;
        
        e.preventDefault();
        e.stopPropagation();
        openTakimChatPanel();
    }, true);
    
    // ESC ile chat kapat (öncelik)
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (takimChat.open) {
            e.preventDefault();
            e.stopPropagation();
            closeTakimChatPanel();
        }
    }, true);
}, 200);