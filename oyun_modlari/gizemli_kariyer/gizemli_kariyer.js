// ==========================================
// GİZEMLİ KARİYER - MODÜL JS
// ==========================================

let gizemData = {
    inGame: false,
    playerId: null,
    roomCode: "",
    players: [],
    turnSeconds: 60,
    difficulty: "karisik",
    roundDifficulty: "karisik",
    maxPlayers: 2,
    totalRounds: 10,
    currentTurn: null,
    roundNo: 0,
    career: [],
    options: [],
    scores: {},
    jokersLeft: {},
    hiddenIndices: [],
    answered: false,
    timerInterval: null,
    timerSeconds: 60
};

const createGizemScreen = document.getElementById("createGizemScreen");
const gizemLobbyScreen = document.getElementById("gizemLobbyScreen");
const gizemGameScreen = document.getElementById("gizemGameScreen");

// ========================================
// 💬 GİZEMLİ KARİYER CHAT
// ========================================
let gizemChat = {
    open: false,
    unread: 0,
    messages: [],
    maxMessages: 50
};

// ✨ 2-5 kişi için oyuncu ID'sine göre farklı renk paleti
const GIZEM_CHAT_COLORS = ["#ff8a8a", "#7abfff", "#51cf66", "#ffd43b", "#c084fc"];

function getGizemChatColor(pid) {
    if (!pid) return "#adb5bd";
    const idx = (pid - 1) % GIZEM_CHAT_COLORS.length;
    return GIZEM_CHAT_COLORS[idx];
}

function showGizemChat() {
    const c = document.getElementById("gizemChatContainer");
    if (c) c.style.display = "block";
}

function hideGizemChat() {
    const c = document.getElementById("gizemChatContainer");
    if (c) c.style.display = "none";
    closeGizemChatPanel();
    gizemChat.messages = [];
    gizemChat.unread = 0;
    const box = document.getElementById("gizemChatMessages");
    if (box) box.innerHTML = "";
    clearGizemChatPopups();
}

function toggleGizemChatPanel() {
    if (gizemChat.open) closeGizemChatPanel();
    else openGizemChatPanel();
}

function openGizemChatPanel() {
    gizemChat.open = true;
    gizemChat.unread = 0;
    const panel = document.getElementById("gizemChatPanel");
    const badge = document.getElementById("gizemChatBadge");
    if (panel) panel.style.setProperty("display", "flex", "important");
    if (badge) badge.style.display = "none";
    clearGizemChatPopups();
    const box = document.getElementById("gizemChatMessages");
    if (box) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
    const input = document.getElementById("gizemChatInput");
    if (input) setTimeout(() => input.focus(), 100);
    setTimeout(() => {
        document.addEventListener("mousedown", gizemChatOutsideClickHandler, true);
    }, 100);
}

function closeGizemChatPanel() {
    gizemChat.open = false;
    const panel = document.getElementById("gizemChatPanel");
    if (panel) panel.style.display = "none";
    document.removeEventListener("mousedown", gizemChatOutsideClickHandler, true);
    const input = document.getElementById("gizemChatInput");
    if (input && input.value) input.value = "";
}

function gizemChatOutsideClickHandler(e) {
    const c = document.getElementById("gizemChatContainer");
    if (!c) return;
    if (c.contains(e.target)) return;
    closeGizemChatPanel();
}

function sendGizemChatMessage() {
    const input = document.getElementById("gizemChatInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text || text.length > 100) return;
    input.value = "";
    send({ type: "gizem_chat_send", text: text });
}

function showGizemChatPopup(msg) {
    if (gizemChat.open) return;
    const stack = document.getElementById("gizemChatPopupStack");
    if (!stack) return;
    stack.style.display = "flex";
    
    const color = getGizemChatColor(msg.sender_id);
    
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

function clearGizemChatPopups() {
    const stack = document.getElementById("gizemChatPopupStack");
    if (!stack) return;
    stack.innerHTML = "";
    stack.style.display = "none";
}

function addGizemChatMessage(msg) {
    // ✨ Chat bildirim sesi (yazan dahil herkese tam ses)
    try {
        const sound = new Audio("/static/sounds/chat_notify.mp3");
        sound.volume = 1.0;
        sound.play().catch(() => {});
    } catch(e) {}

    gizemChat.messages.push(msg);
    if (gizemChat.messages.length > gizemChat.maxMessages) gizemChat.messages.shift();
    
    const box = document.getElementById("gizemChatMessages");
    if (!box) return;
    
    const div = document.createElement("div");
    div.className = "miniChatMsg";
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "chatName";
    nameSpan.style.color = getGizemChatColor(msg.sender_id);
    nameSpan.textContent = msg.sender_name + ":";
    
    const textSpan = document.createElement("span");
    textSpan.className = "chatText";
    textSpan.textContent = " " + msg.text;
    
    div.appendChild(nameSpan);
    div.appendChild(textSpan);
    box.appendChild(div);
    
    while (box.children.length > gizemChat.maxMessages) box.removeChild(box.firstChild);
    
    if (gizemChat.open) {
        box.scrollTop = box.scrollHeight;
    } else {
        gizemChat.unread++;
        const badge = document.getElementById("gizemChatBadge");
        if (badge) {
            badge.textContent = gizemChat.unread;
            badge.style.display = "flex";
            badge.style.animation = "none";
            badge.offsetHeight;
            badge.style.animation = "chatBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        }
        showGizemChatPopup(msg);
    }
}

const _prevShowScreenGizem = showScreen;
showScreen = function(screenName) {
    _prevShowScreenGizem(screenName);
    createGizemScreen.classList.add("hidden");
    gizemLobbyScreen.classList.add("hidden");
    gizemGameScreen.classList.add("hidden");
    if (screenName === "createGizem") createGizemScreen.classList.remove("hidden");
    if (screenName === "gizemLobby") gizemLobbyScreen.classList.remove("hidden");
    if (screenName === "gizemGame") gizemGameScreen.classList.remove("hidden");
    
    // 💬 Gizemli Kariyer chat: sadece gizemLobby/gizemGame'de görünür
    const gizemScreens = ["gizemLobby", "gizemGame"];
    if (!gizemScreens.includes(screenName)) {
        hideGizemChat();
    }
};

const gizemCard = document.querySelector('[data-mod="gizemli_kariyer"]');
if (gizemCard) {
    gizemCard.addEventListener("click", () => {
        // ✨ Normal giriş: isim + buton normale döndür
        const nameInput = document.getElementById("createGizemNameInput");
        if (nameInput) {
            const nameBox = nameInput.closest(".centerBox");
            if (nameBox) nameBox.style.display = "";
        }
        const createBtnEl = document.getElementById("createGizemBtn");
        if (createBtnEl) createBtnEl.textContent = "Oda Oluştur";
        window._pendingModeChangeCtx = null;

        showScreen("createGizem");
        setTimeout(() => {
            if (nameInput) nameInput.focus();
        }, 100);
    });
}

const _savedNameGizem = localStorage.getItem("playerName");
if (_savedNameGizem) {
    const gizInput = document.getElementById("createGizemNameInput");
    if (gizInput) gizInput.value = _savedNameGizem;
}

document.getElementById("createGizemBtn").onclick = () => {
    const name = document.getElementById("createGizemNameInput").value.trim();
    if (!name) {
        document.getElementById("createGizemMsg").textContent = "İsim gir.";
        document.getElementById("createGizemMsg").style.color = "#ff6b6b";
        return;
    }
    localStorage.setItem("playerName", name);
    myName = name;

    const turnSec = parseInt(document.getElementById("gizemTurnSecondsSelect").value) || 60;
    const difficulty = document.getElementById("gizemDifficultySelect").value || "karisik";
    const maxPlayers = parseInt(document.getElementById("gizemMaxPlayersSelect").value) || 2;
    const totalRounds = parseInt(document.getElementById("gizemTotalRoundsSelect").value) || 10;
    send({
        type: "gizem_create_room",
        name: name,
        turn_seconds: turnSec,
        difficulty: difficulty,
        max_players: maxPlayers,
        total_rounds: totalRounds
    });
};

document.getElementById("createGizemBackBtn").onclick = () => {
    const pendingModeChange = window._pendingModeChangeCtx;
    if (pendingModeChange && pendingModeChange.newMode === "gizemli_kariyer" && pendingModeChange.createScreen === "createGizem") {
        const returnScreen = pendingModeChange.returnScreen || "gizemLobby";
        window._pendingModeChangeCtx = null;
        const msgEl = document.getElementById("createGizemMsg");
        if (msgEl) msgEl.textContent = "";

        showScreen(returnScreen);

        setTimeout(() => {
            if (typeof openChangeModeModal === "function") openChangeModeModal();
        }, 200);
        return;
    }
    showScreen("modselect");
};

document.getElementById("gizemStartBtn").onclick = () => {
    send({ type: "gizem_start_game" });
};

document.getElementById("gizemLobbyLeaveBtn").onclick = () => {
    window._showLeaveConfirmPopup();
};

// ✨ Mod Değiştir butonu
const _gizemChangeModeBtn = document.getElementById("gizemChangeModeBtn");
if (_gizemChangeModeBtn) {
    _gizemChangeModeBtn.onclick = () => {
        if (typeof openChangeModeModal === "function") {
            openChangeModeModal();
        }
    };
}

document.getElementById("gizemRoomSettingsBtn").onclick = () => {
    window.openRoomSettingsGeneric({
        title: "Gizemli Kariyer - Oda Ayarları",
        fields: [
            {
                id: "maxPlayers",
                label: "👥 Oyuncu Sayısı",
                current: gizemData.maxPlayers || 2,
                minValue: (gizemData.players && gizemData.players.length > 2) ? gizemData.players.length : null,
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
                current: gizemData.totalRounds || 10,
                options: [
                    {value: 5, label: "5 Tur"},
                    {value: 10, label: "10 Tur"},
                    {value: 15, label: "15 Tur"},
                    {value: 20, label: "20 Tur"}
                ]
            },
            {
                id: "difficulty",
                label: "🎯 Zorluk Seviyesi",
                current: gizemData.difficulty || "karisik",
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
                current: gizemData.turnSeconds || 60,
                options: [
                    {value: 30, label: "30 saniye"},
                    {value: 45, label: "45 saniye"},
                    {value: 60, label: "60 saniye"},
                    {value: 90, label: "90 saniye"},
                    {value: 120, label: "120 saniye"}
                ]
            }
        ],
        onSave: (values) => {
            send({
                type: "gizem_update_settings",
                turn_seconds: parseInt(values.turnSec) || 60,
                difficulty: values.difficulty || "karisik",
                max_players: parseInt(values.maxPlayers) || 2,
                total_rounds: parseInt(values.totalRounds) || 10
            });
        }
    });
};

const gizemRoomHelper = window.setupRoomCodeAndLink({
    codeTextId: "gizemRoomCodeText",
    codeEyeBtnId: "gizemRoomCodeEyeBtn",
    copyHintId: "gizemCopyHint",
    linkTextId: "gizemInviteLinkText",
    linkEyeBtnId: "gizemInviteLinkEyeBtn",
    linkHintId: "gizemInviteLinkHint",
    getRoomCode: () => gizemData.roomCode,
    getPlayerId: () => gizemData.playerId
});

document.getElementById("gizemBackBtn").onclick = () => {
    showEscPopup();
};

document.getElementById("gizemBackToMenuBtn").onclick = () => {
    location.reload();
};

document.getElementById("gizemRematchBtn").onclick = () => {
    document.getElementById("gizemGameOverBox").classList.add("hidden");
    send({ type: "gizem_rematch" });
};

document.getElementById("gizemBackToLobbyBtn").onclick = () => {
    if (gizemData.playerId === 1) {
        send({ type: "gizem_back_to_lobby" });
    } else {
        document.getElementById("gizemGameOverBox").classList.add("hidden");
        showScreen("gizemLobby");
        updateGizemLobby();
    }
};

document.querySelectorAll(".gizemOptBtn").forEach(btn => {
    btn.onclick = () => {
        if (gizemData.currentTurn !== gizemData.playerId || gizemData.answered) return;
        const choice = parseInt(btn.dataset.choice);
        if (gizemData.hiddenIndices.includes(choice)) return;
        send({ type: "gizem_answer", index: choice });
    };
});

document.getElementById("gizemJokerHintBtn").onclick = () => {
    if (gizemData.currentTurn !== gizemData.playerId || gizemData.answered) return;
    send({ type: "gizem_joker_hint" });
};

document.getElementById("gizemJokerPassBtn").onclick = () => {
    if (gizemData.currentTurn !== gizemData.playerId || gizemData.answered) return;
    document.getElementById("gizemPassConfirmBox").classList.remove("hidden");
};

document.getElementById("gizemPassYesBtn").onclick = () => {
    document.getElementById("gizemPassConfirmBox").classList.add("hidden");
    send({ type: "gizem_joker_pass" });
};

document.getElementById("gizemPassNoBtn").onclick = () => {
    document.getElementById("gizemPassConfirmBox").classList.add("hidden");
};

function startGizemTimer(seconds) {
    stopGizemTimer();
    gizemData.timerSeconds = seconds;
    updateGizemTimerDisplay();
    gizemData.timerInterval = setInterval(() => {
        gizemData.timerSeconds--;
        updateGizemTimerDisplay();
        if (gizemData.timerSeconds <= 0) stopGizemTimer();
    }, 1000);
}

function stopGizemTimer() {
    if (gizemData.timerInterval) {
        clearInterval(gizemData.timerInterval);
        gizemData.timerInterval = null;
    }
}

function updateGizemTimerDisplay() {
    const el = document.getElementById("gizemTimer");
    el.textContent = gizemData.timerSeconds + "s";
    el.classList.remove("warning", "danger");
    if (gizemData.timerSeconds <= 10) el.classList.add("danger");
    else if (gizemData.timerSeconds <= 20) el.classList.add("warning");
}

function getGizemPlayerName(id) {
    const p = gizemData.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function isGizemMultiPlayer() {
    return (gizemData.maxPlayers || 2) >= 3;
}

function updateGizemLobby() {
    if (gizemRoomHelper) { gizemRoomHelper.renderCode(); gizemRoomHelper.renderLink(); }
    document.getElementById("gizemLobbyTurnSeconds").textContent = gizemData.turnSeconds || 60;
    
    const _maxEl = document.getElementById("gizemLobbyMaxPlayers");
    if (_maxEl) _maxEl.textContent = gizemData.maxPlayers || 2;
    const _totEl = document.getElementById("gizemLobbyTotalRounds");
    if (_totEl) _totEl.textContent = gizemData.totalRounds || 10;
    
    const diffNames = {
        "kolay": "🟢 Kolay",
        "orta": "🟡 Orta",
        "zor": "🔴 Zor",
        "karisik": "🎯 Karışık"
    };
    const diffEl = document.getElementById("gizemLobbyDifficulty");
    if (diffEl) {
        diffEl.textContent = diffNames[gizemData.difficulty] || "🎯 Karışık";
    }

    const list = document.getElementById("gizemPlayersList");
    list.innerHTML = "";
    gizemData.players.forEach(p => {
        const li = document.createElement("li");
        
        const nameCell = document.createElement("span");
        nameCell.style.flex = "1";
        nameCell.style.textAlign = "left";
        nameCell.style.paddingLeft = "10px";
        const crown = p.id === 1 ? " 👑" : "";
        nameCell.textContent = p.id === gizemData.playerId ? `${p.id}. ${p.name} (Sen)${crown}` : `${p.id}. ${p.name}${crown}`;
        li.appendChild(nameCell);
        
        if (p.id !== gizemData.playerId && gizemData.playerId === 1) {
            const kickBtn = document.createElement("button");
            kickBtn.className = "kickBtnNew";
            kickBtn.textContent = "Oyuncuyu At";
            kickBtn.onclick = () => openKickConfirm(p.id, p.name);
            li.appendChild(kickBtn);
        }
        
        if (p.id === gizemData.playerId) {
            li.classList.add("playerMine");
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });

    const startBtn = document.getElementById("gizemStartBtn");
    const msg = document.getElementById("gizemLobbyMsg");
    const maxP = gizemData.maxPlayers || 2;
    const curP = gizemData.players.length;

    if (gizemData.playerId === 1 && curP === maxP) {
        startBtn.classList.remove("hidden");
        msg.textContent = `${maxP} oyuncu hazır. Başlatabilirsin!`;
        msg.style.color = "#51cf66";
    } else if (gizemData.playerId === 1) {
        startBtn.classList.add("hidden");
        msg.textContent = `Oyuncu bekleniyor... (${curP}/${maxP})`;
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        msg.textContent = `Host bekleniyor... (${curP}/${maxP})`;
        msg.style.color = "#51cf66";
    }
    
    const settingsBtn = document.getElementById("gizemRoomSettingsBtn");
    if (settingsBtn) {
        if (gizemData.playerId === 1) settingsBtn.classList.remove("hidden");
        else settingsBtn.classList.add("hidden");
    }
    
    // ✨ Mod Değiştir butonu - sadece host görsün
    const changeModeBtn = document.getElementById("gizemChangeModeBtn");
    if (changeModeBtn) {
        if (gizemData.playerId === 1) changeModeBtn.classList.remove("hidden");
        else changeModeBtn.classList.add("hidden");
    }
}

function updateGizemTopBar() {
    const diffEmoji = { kolay: "🟢", orta: "🟡", zor: "🔴" };
    const rDiff = gizemData.roundDifficulty || "orta";
    const emoji = diffEmoji[rDiff] || "";
    const diffLabel = rDiff.toUpperCase();
    
    document.getElementById("gizemRoundInfo").innerHTML =
        `Tur ${gizemData.roundNo + 1}/${gizemData.totalRounds} ${emoji} <span style="opacity:0.7; font-size:14px;">${diffLabel}</span>`;

    const turnName = getGizemPlayerName(gizemData.currentTurn);
    const turnColor = gizemData.currentTurn === gizemData.playerId ? "#51cf66" : "#ffa94d";
    document.getElementById("gizemTurnInfo").innerHTML =
        `Sıra: <span style="color:${turnColor}">${turnName}</span>`;

    const isMulti = isGizemMultiPlayer();
    const scoreboard2P = document.getElementById("gizemScoreboard2P");
    const scoreboardPanel = document.getElementById("gizemScoreboardPanel");
    
    if (isMulti) {
        if (scoreboard2P) scoreboard2P.style.visibility = "hidden";
        if (scoreboardPanel) scoreboardPanel.style.display = "";
    } else {
        if (scoreboard2P) scoreboard2P.style.visibility = "";
        if (scoreboardPanel) scoreboardPanel.style.display = "none";
        
        const p1 = getGizemPlayerName(1);
        const p2 = getGizemPlayerName(2);
        document.getElementById("gizemP1Name").textContent = p1;
        document.getElementById("gizemP2Name").textContent = p2;
        document.getElementById("gizemScore").textContent =
            `${gizemData.scores[1] || 0} - ${gizemData.scores[2] || 0}`;
    }
    
    if (isMulti) renderGizemScoreboardList();
}

function renderGizemScoreboardList() {
    const listEl = document.getElementById("gizemScoreboardList");
    if (!listEl) return;
    
    const rows = gizemData.players.map(p => ({
        id: p.id,
        name: p.name,
        score: gizemData.scores[p.id] ?? 0
    }));
    rows.sort((a, b) => b.score - a.score);
    
    // FLIP animasyonu
    const oldPositions = {};
    Array.from(listEl.children).forEach(li => {
        const pid = parseInt(li.dataset.pid);
        oldPositions[pid] = li.getBoundingClientRect().top;
    });
    
    listEl.innerHTML = "";
    rows.forEach((row, idx) => {
        const li = document.createElement("li");
        li.dataset.pid = row.id;
        li.className = "gizemScoreRow";
        if (row.id === gizemData.currentTurn) li.classList.add("activeTurn");
        if (row.id === gizemData.playerId) li.classList.add("meRow");
        
        const rankBadge = document.createElement("span");
        rankBadge.className = "gizemRankBadge";
        const medals = ["🥇", "🥈", "🥉"];
        rankBadge.textContent = medals[idx] || `${idx + 1}.`;
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "gizemScoreName";
        nameSpan.textContent = row.name + (row.id === gizemData.playerId ? " (Sen)" : "");
        
        const scoreSpan = document.createElement("span");
        scoreSpan.className = "gizemScoreVal";
        if (row.score < 0) scoreSpan.classList.add("negative");
        scoreSpan.textContent = row.score;
        
        li.appendChild(rankBadge);
        li.appendChild(nameSpan);
        li.appendChild(scoreSpan);
        listEl.appendChild(li);
    });
    
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

function renderGizemCareer() {
    const box = document.getElementById("gizemCareerFlow");
    box.innerHTML = "";
    if (!gizemData.career || gizemData.career.length === 0) return;

    gizemData.career.forEach((team, i) => {
        const item = document.createElement("div");
        item.className = "gizemCareerItem";

        const logoBox = document.createElement("div");
        logoBox.className = "gizemTeamLogo";

        const showFallback = () => {
            logoBox.innerHTML = "";
            logoBox.classList.add("fallback");
            const [r, g, b] = team.color || [100, 100, 100];
            logoBox.style.background = `rgb(${r}, ${g}, ${b})`;
            const shortName = team.name.length > 10 ? team.name.substring(0, 10) : team.name;
            logoBox.textContent = shortName;
            const brightness = (r + g + b) / 3;
            logoBox.style.color = brightness < 128 ? "#fff" : "#000";
        };

        if (team.logo_url) {
            const img = document.createElement("img");
            img.src = team.logo_url;
            img.alt = team.name;
            img.referrerPolicy = "no-referrer";
            img.onerror = showFallback;
            logoBox.appendChild(img);
        } else {
            showFallback();
        }

        const nameDiv = document.createElement("div");
        nameDiv.className = "gizemTeamName";
        nameDiv.textContent = team.name;

        item.appendChild(logoBox);
        item.appendChild(nameDiv);
        box.appendChild(item);

        if (i < gizemData.career.length - 1) {
            const arrow = document.createElement("div");
            arrow.className = "gizemCareerArrow";
            arrow.textContent = "→";
            box.appendChild(arrow);
        }
    });
}

function renderGizemOptions() {
    const buttons = document.querySelectorAll(".gizemOptBtn");
    const isMyTurn = gizemData.currentTurn === gizemData.playerId;

    buttons.forEach((btn, i) => {
        btn.classList.remove("hidden-opt", "correct", "wrong");
        btn.disabled = false;
        const optText = gizemData.options[i] || "---";
        btn.querySelector(".optText").textContent = optText;

        if (gizemData.hiddenIndices.includes(i)) {
            btn.classList.add("hidden-opt");
            btn.disabled = true;
        }

        if (!isMyTurn || gizemData.answered) {
            btn.disabled = true;
        }
    });
}

function renderGizemJokers() {
    const isMyTurn = gizemData.currentTurn === gizemData.playerId;
    const my = gizemData.jokersLeft[gizemData.playerId] || {};
    const canUse = isMyTurn && !gizemData.answered;

    document.getElementById("gizemJokerHintBtn").disabled = !canUse || !my.hint || gizemData.hiddenIndices.length > 0;
    document.getElementById("gizemJokerPassBtn").disabled = !canUse || !my.pass;
}

function renderGizemAll() {
    updateGizemTopBar();
    renderGizemCareer();
    renderGizemOptions();
    renderGizemJokers();
}

function setGizemStatus(text, type) {
    const el = document.getElementById("gizemStatusMsg");
    el.textContent = text || "";
    el.classList.remove("correct", "wrong", "info");
    if (type) el.classList.add(type);
}

const _prevHandleMessageGizem = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "gizem_room_created" || msg.type === "gizem_room_joined") {
        try { new Audio("/static/sounds/player_join.mp3").play().catch(()=>{}); } catch(e){}
        gizemData.playerId = msg.player_id;
        gizemData.roomCode = msg.room_code;
        gizemData.turnSeconds = msg.turn_seconds || 60;
        gizemData.difficulty = msg.difficulty || "karisik";
        if (msg.max_players !== undefined) gizemData.maxPlayers = msg.max_players;
        if (msg.total_rounds !== undefined) gizemData.totalRounds = msg.total_rounds;
        gizemData.inGame = true;
        inRoom = true;
        showGizemChat();
        showScreen("gizemLobby");
        updateGizemLobby();
        return;
    }

    if (msg.type === "gizem_lobby_update") {
        // ✨ Lobiye yeni biri geldiyse katılma sesi çal + Toast göster
        if (gizemData.players && msg.players && gizemData.players.length < msg.players.length && msg.players.length > 1) {
            try { new Audio("/static/sounds/player_join.mp3").play().catch(()=>{}); } catch(e){}
            const oldPids = new Set(gizemData.players.map(p => p.id));
            const newPlayer = msg.players.find(p => !oldPids.has(p.id));
            if (newPlayer && newPlayer.id !== gizemData.playerId) {
                showToast("👋 Odaya Katıldı", `${newPlayer.name} odaya katıldı!`, null, "success");
            }
        }
        showGizemChat();
        gizemData.roomCode = msg.room_code;
        gizemData.players = msg.players;
        gizemData.turnSeconds = msg.turn_seconds || 60;
        gizemData.difficulty = msg.difficulty || gizemData.difficulty || "karisik";
        if (msg.max_players !== undefined) gizemData.maxPlayers = msg.max_players;
        if (msg.total_rounds !== undefined) gizemData.totalRounds = msg.total_rounds;
        updateGizemLobby();
        return;
    }
    
    // 💬 CHAT mesajları
    if (msg.type === "gizem_chat_msg") {
        addGizemChatMessage({
            sender_id: msg.sender_id,
            sender_name: msg.sender_name,
            text: msg.text,
            ts: msg.ts
        });
        return;
    }
    
    if (msg.type === "gizem_chat_history") {
        if (msg.messages && Array.isArray(msg.messages)) {
            const wasOpen = gizemChat.open;
            gizemChat.open = true;
            msg.messages.forEach(m => addGizemChatMessage(m));
            gizemChat.open = wasOpen;
            gizemChat.unread = 0;
            const badge = document.getElementById("gizemChatBadge");
            if (badge) badge.style.display = "none";
        }
        return;
    }

    if (msg.type === "gizem_game_started") {
        gizemData.playerId = msg.player_id;
        gizemData.players = msg.players;
        gizemData.turnSeconds = msg.turn_seconds;
        gizemData.totalRounds = msg.total_rounds;
        gizemData.currentTurn = msg.current_turn;
        gizemData.roundNo = msg.round_no;
        gizemData.career = msg.career;
        gizemData.options = msg.options;
        gizemData.scores = msg.scores;
        gizemData.jokersLeft = msg.jokers_left;
        gizemData.hiddenIndices = [];
        gizemData.answered = false;
        gizemData.difficulty = msg.difficulty || gizemData.difficulty || "karisik";
        gizemData.roundDifficulty = msg.round_difficulty || "orta";
        if (msg.max_players !== undefined) gizemData.maxPlayers = msg.max_players;
        
        const overBox = document.getElementById("gizemGameOverBox");
        if (overBox) overBox.classList.add("hidden");

        showScreen("gizemGame");
        renderGizemAll();
        setGizemStatus("");
        startGizemTimer(gizemData.turnSeconds);

        if (gizemData.currentTurn === gizemData.playerId) {
            setGizemStatus("Senin sıran! Doğru futbolcuyu bul.", "correct");
        } else {
            setGizemStatus(getGizemPlayerName(gizemData.currentTurn) + " oynuyor...", "info");
        }
        return;
    }

    if (msg.type === "gizem_new_round") {
        gizemData.roundNo = msg.round_no;
        gizemData.totalRounds = msg.total_rounds;
        gizemData.currentTurn = msg.current_turn;
        gizemData.career = msg.career;
        gizemData.options = msg.options;
        gizemData.scores = msg.scores;
        gizemData.jokersLeft = msg.jokers_left;
        gizemData.hiddenIndices = [];
        gizemData.answered = false;
        gizemData.roundDifficulty = msg.round_difficulty || "orta";

        renderGizemAll();
        setGizemStatus("");
        startGizemTimer(gizemData.turnSeconds);

        if (gizemData.currentTurn === gizemData.playerId) {
            setGizemStatus("Senin sıran! Doğru futbolcuyu bul.", "correct");
        } else {
            setGizemStatus(getGizemPlayerName(gizemData.currentTurn) + " oynuyor...", "info");
        }
        return;
    }

    if (msg.type === "gizem_joker_used") {
        if (msg.jokers_left) gizemData.jokersLeft = msg.jokers_left;
        if (msg.joker_type === "hint") {
            gizemData.hiddenIndices = msg.hidden_indices || [];
        }
        renderGizemOptions();
        renderGizemJokers();
        return;
    }

    if (msg.type === "gizem_answer_result") {
        gizemData.answered = true;
        gizemData.scores = msg.scores;
        if (msg.jokers_left) gizemData.jokersLeft = msg.jokers_left;
        stopGizemTimer();

        // 🔊 DOĞRU / YANLIŞ SESİ ÇAL
        try {
            let vol = 0.5;
            if (typeof getGlobalVolume === "function") vol = getGlobalVolume();
            const soundName = msg.correct ? "game_correct.mp3" : "game_wrong.mp3";
            const audio = new Audio(`/static/sounds/${soundName}`);
            audio.volume = vol;
            audio.play().catch(() => {});
        } catch(e) {}

        const buttons = document.querySelectorAll(".gizemOptBtn");
        buttons.forEach((btn, i) => {
            btn.disabled = true;
            if (i === msg.correct_index) {
                btn.classList.add("correct");
            } else if (i === msg.selected_index && !msg.correct) {
                btn.classList.add("wrong");
            }
        });

        const playerName = getGizemPlayerName(msg.player_id);
        let statusText = "";
        let statusType = "info";
        const earnedTxt = msg.earned > 0 ? `+${msg.earned}` : `${msg.earned}`;

        if (msg.passed) {
            statusText = `⏭️ ${playerName} PAS geçti. Doğru: ${msg.correct_name}`;
            statusType = "wrong";
        } else if (msg.timeout) {
            statusText = `⏰ ${playerName} süresi doldu! (${earnedTxt}) Doğru: ${msg.correct_name}`;
            statusType = "wrong";
        } else if (msg.correct) {
            statusText = `✓ ${playerName} DOĞRU! (${earnedTxt} puan)`;
            statusType = "correct";
        } else {
            statusText = `✗ ${playerName} YANLIŞ! (${earnedTxt}) Doğru: ${msg.correct_name}`;
            statusType = "wrong";
        }

        setGizemStatus(statusText, statusType);
        updateGizemTopBar();
        return;
    }
    
    if (msg.type === "gizem_back_to_lobby") {
        document.getElementById("gizemGameOverBox").classList.add("hidden");
        document.getElementById("gizemPassConfirmBox").classList.add("hidden");
        stopGizemTimer();
        showScreen("gizemLobby");
        updateGizemLobby();
        return;
    }
    
    if (msg.type === "gizem_player_left") {
        try { new Audio("/static/sounds/player_leave.mp3").play().catch(()=>{}); } catch(e){}
        if (msg.players) gizemData.players = msg.players;
        if (msg.scores) gizemData.scores = msg.scores;
        if (msg.jokers_left) gizemData.jokersLeft = msg.jokers_left;
        renderGizemAll();
        if (typeof showToast === "function") {
            showToast(`${msg.name || "Bir oyuncu"} oyundan ayrıldı`, "warn");
        }
        return;
    }

    if (msg.type === "gizem_game_over") {
        gizemData.scores = msg.scores;
        stopGizemTimer();
        updateGizemTopBar();

        const title = document.getElementById("gizemGameOverTitle");
        const text = document.getElementById("gizemGameOverText");

        if (msg.winner_id === 0) {
            title.textContent = "BERABERE!";
            title.style.color = "#74c0fc";
        } else if (msg.winner_id === gizemData.playerId) {
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
            for (const [pidStr, sc] of Object.entries(gizemData.scores || {})) {
                const pid = parseInt(pidStr);
                ranking.push({ player_id: pid, name: getGizemPlayerName(pid), score: sc });
            }
            ranking.sort((a, b) => b.score - a.score);
        }
        
        const listEl = document.getElementById("gizemGameOverList");
        if (listEl) {
            listEl.innerHTML = "";
            const medals = ["🥇", "🥈", "🥉"];
            ranking.forEach((row, idx) => {
                const li = document.createElement("li");
                li.className = "gizemGameOverItem";
                if (idx === 0) li.classList.add("goldRank");
                if (row.player_id === gizemData.playerId) li.classList.add("meRow");
                const medal = medals[idx] || `${idx + 1}.`;
                const scoreCls = row.score < 0 ? "rankScore negative" : "rankScore";
                li.innerHTML = `<span class="rankIcon">${medal}</span> <span class="rankName">${row.name}</span> <span class="${scoreCls}">${row.score}</span>`;
                listEl.appendChild(li);
            });
        }
        
        if (ranking.length === 2) {
            text.innerHTML = `Skor: <b>${ranking[0].score} - ${ranking[1].score}</b>`;
        } else {
            text.innerHTML = `<b>${ranking.length}</b> oyuncu yarıştı`;
        }

        const rematchBtn = document.getElementById("gizemRematchBtn");
        const lobbyBtn = document.getElementById("gizemBackToLobbyBtn");
        if (gizemData.playerId === 1) {
            rematchBtn.classList.remove("hidden");
            lobbyBtn.classList.remove("hidden");
        } else {
            rematchBtn.classList.add("hidden");
            lobbyBtn.classList.add("hidden");
        }

        document.getElementById("gizemGameOverBox").classList.remove("hidden");
        return;
    }

    _prevHandleMessageGizem(msg);
};

document.getElementById("gizemGameOverBox").classList.add("hidden");
document.getElementById("gizemPassConfirmBox").classList.add("hidden");

// ========================================
// 💬 GİZEMLİ KARİYER CHAT - Event'ler
// ========================================
setTimeout(() => {
    const toggleBtn = document.getElementById("gizemChatToggleBtn");
    if (toggleBtn) toggleBtn.addEventListener("click", toggleGizemChatPanel);
    
    const closeBtn = document.getElementById("gizemChatCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeGizemChatPanel);
    
    const sendBtn = document.getElementById("gizemChatSendBtn");
    if (sendBtn) sendBtn.addEventListener("click", sendGizemChatMessage);
    
    const input = document.getElementById("gizemChatInput");
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                sendGizemChatMessage();
                closeGizemChatPanel();
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
        if (!["gizemLobby", "gizemGame"].includes(current)) return;
        
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
        
        const container = document.getElementById("gizemChatContainer");
        if (!container || container.style.display === "none") return;
        
        if (gizemChat.open) return;
        
        const anyPopup = document.querySelector(".overlay:not(.hidden)");
        if (anyPopup) return;
        
        e.preventDefault();
        e.stopPropagation();
        openGizemChatPanel();
    }, true);
    
    // ESC ile chat kapat (öncelik)
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (gizemChat.open) {
            e.preventDefault();
            e.stopPropagation();
            closeGizemChatPanel();
        }
    }, true);
}, 200);