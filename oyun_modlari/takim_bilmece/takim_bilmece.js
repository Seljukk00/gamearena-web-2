// ==========================================
// TAKIM BİLMECE - MODÜL JS
// ==========================================

let takimData = {
    inGame: false,
    playerId: null,
    roomCode: "",
    difficulty: "klasik",
    players: [],
    totalQuestions: 12,
    turnSeconds: 60,
    currentTurn: null,
    questionNo: 0,
    teamData: null,
    scores: { 1: 0, 2: 0 },
    jokersLeft: { 1: {}, 2: {} },
    revealedNames: { 1: {}, 2: {} },
    yearRevealed: { 1: false, 2: false },
    eliminatedOptions: { 1: [], 2: [] },
    answered: false,
    timerInterval: null,
    timerSeconds: 60
};

const takimLobbyScreen = document.getElementById("takimLobbyScreen");
const takimGameScreen = document.getElementById("takimGameScreen");

// showScreen'i genişlet (DOĞRU YÖNTEM: önce eskiyi çağır)
const _originalShowScreenTakim = showScreen;
showScreen = function(screenName) {
    _originalShowScreenTakim(screenName);
    takimLobbyScreen.classList.add("hidden");
    takimGameScreen.classList.add("hidden");
    if (screenName === "takimLobby") takimLobbyScreen.classList.remove("hidden");
    if (screenName === "takimGame") takimGameScreen.classList.remove("hidden");
};

// Oda oluştur butonu
document.getElementById("createTakimBtn").onclick = () => {
    const name = document.getElementById("createTakimNameInput").value.trim();
    if (!name) {
        document.getElementById("createTakimMsg").textContent = "İsim gir.";
        document.getElementById("createTakimMsg").style.color = "#ff6b6b";
        return;
    }
    localStorage.setItem("playerName", name);
    myName = name;
    
    const difficulty = document.getElementById("takimDifficultySelect").value;
    const turnSeconds = parseInt(document.getElementById("takimTurnSecondsSelect").value) || 60;
    send({
        type: "takim_create_room",
        name: name,
        difficulty: difficulty,
        turn_seconds: turnSeconds
    });
};

document.getElementById("takimStartBtn").onclick = () => {
    send({ type: "takim_start_game" });
};

document.getElementById("takimLobbyLeaveBtn").onclick = () => {
    showEscPopup();
};

// Oda Ayarları butonu
document.getElementById("takimRoomSettingsBtn").onclick = () => {
    window.openRoomSettingsGeneric({
        title: "Takım Bilmece - Oda Ayarları",
        fields: [
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
                    {value: 120, label: "120 saniye"}
                ]
            }
        ],
        onSave: (values) => {
            send({
                type: "takim_update_settings",
                difficulty: values.difficulty,
                turn_seconds: parseInt(values.turnSec) || 60
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
    location.reload();
};

document.getElementById("takimRematchBtn").onclick = () => {
    document.getElementById("takimGameOverBox").classList.add("hidden");
    send({ type: "takim_rematch" });
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
    document.getElementById("takimLobbyTurnSeconds").textContent = takimData.turnSeconds || 60;
    
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
    
    if (takimData.playerId === 1 && takimData.players.length === 2) {
        startBtn.classList.remove("hidden");
        msg.textContent = "İki oyuncu hazır. Başlatabilirsin!";
        msg.style.color = "#51cf66";
    } else if (takimData.playerId === 1) {
        startBtn.classList.add("hidden");
        msg.textContent = "Rakip bekleniyor...";
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        msg.textContent = "Host bekleniyor...";
        msg.style.color = "#51cf66";
    }
    
    const settingsBtn = document.getElementById("takimRoomSettingsBtn");
    if (settingsBtn) {
        if (takimData.playerId === 1) settingsBtn.classList.remove("hidden");
        else settingsBtn.classList.add("hidden");
    }
}

function getTakimOtherPlayerId() {
    return takimData.playerId === 1 ? 2 : 1;
}

function getTakimPlayerName(id) {
    const p = takimData.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
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
        
        const myNameShown = takimData.revealedNames[takimData.playerId][idx];
        const oppName = takimData.revealedNames[getTakimOtherPlayerId()][idx];
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
        
        // Aktif oyuncunun (sıradaki) eliminasyonlarını göster
        const activePlayer = takimData.currentTurn;
        if (takimData.eliminatedOptions[activePlayer] && 
            takimData.eliminatedOptions[activePlayer].includes(i)) {
            btn.classList.add("eliminated");
            btn.disabled = true;
        }
    });
}

function renderTakimJokers() {
    const isMyTurn = takimData.currentTurn === takimData.playerId;
    const my = takimData.jokersLeft[takimData.playerId] || {};
    const opp = takimData.jokersLeft[getTakimOtherPlayerId()] || {};
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
        
        // ✨ 0 olan VEYA zaten kullanılmış jokerleri soluk göster (rakip görünümünde)
        const nameBtn = document.getElementById("takimJokerNameBtn");
        const yearBtn = document.getElementById("takimJokerYearBtn");
        const elimBtn = document.getElementById("takimJokerElimBtn");
        const passBtn = document.getElementById("takimJokerPassBtn");
        
        const oppId = getTakimOtherPlayerId();
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
    const p1 = getTakimPlayerName(1);
    const p2 = getTakimPlayerName(2);
    document.getElementById("takimP1Name").textContent = p1;
    document.getElementById("takimP2Name").textContent = p2;
    document.getElementById("takimP1ScoreName").textContent = p1;
    document.getElementById("takimP2ScoreName").textContent = p2;
    document.getElementById("takimP1Score").textContent = takimData.scores[1];
    document.getElementById("takimP2Score").textContent = takimData.scores[2];
    document.getElementById("takimScore").textContent = `${takimData.scores[1]} - ${takimData.scores[2]}`;
    
    // Soru numarası + zorluk (her modda görünür)
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
    // Aktif oyuncunun (sıradaki) yıl jokerini göster
    const activePlayerForYear = takimData.currentTurn;
    if (takimData.yearRevealed[activePlayerForYear]) {
        yearEl.textContent = `Yıl: ${takimData.teamData.year}`;
        yearEl.classList.add("revealed");
    } else {
        yearEl.textContent = "Yıl: ???";
        yearEl.classList.remove("revealed");
    }
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
    updateTakimTimerDisplay();
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
        takimData.inGame = true;
        inRoom = true;
        showScreen("takimLobby");
        updateTakimLobby();
        return;
    }
    
    if (msg.type === "takim_lobby_update") {
        takimData.roomCode = msg.room_code;
        takimData.players = msg.players;
        takimData.difficulty = msg.difficulty || "klasik";
        takimData.turnSeconds = msg.turn_seconds || 60;
        updateTakimLobby();
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
        takimData.revealedNames = { 1: {}, 2: {} };
        takimData.yearRevealed = { 1: false, 2: false };
        takimData.eliminatedOptions = { 1: [], 2: [] };
        takimData.answered = false;
        takimPickPlayerMode = false;
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
        takimData.revealedNames = { 1: {}, 2: {} };
        takimData.yearRevealed = { 1: false, 2: false };
        takimData.eliminatedOptions = { 1: [], 2: [] };
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
        text.innerHTML = `Skor: <b>${takimData.scores[1]} - ${takimData.scores[2]}</b>`;
        const rematchBtn = document.getElementById("takimRematchBtn");
        if (takimData.playerId === 1) rematchBtn.classList.remove("hidden");
        else rematchBtn.classList.add("hidden");
        document.getElementById("takimGameOverBox").classList.remove("hidden");
        return;
    }
    
    _originalHandleMessageTakim(msg);
};

document.getElementById("takimGameOverBox").classList.add("hidden");
document.getElementById("takimPassConfirmBox").classList.add("hidden");
document.getElementById("takimJokerCancelBtn").classList.add("hidden");