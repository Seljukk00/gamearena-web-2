// ==========================================
// STADYUM TANIMA - MODÜL JS
// ==========================================

let stadData = {
    inGame: false,
    playerId: null,
    roomCode: "",
    players: [],
    turnSeconds: 20,
    maxPlayers: 2,
    totalRounds: 10,
    currentPlayer: null,
    roundNo: 0,
    stadium: null,
    options: [],
    eliminatedIndices: [],
    scores: {},
    jokersLeft: {},
    answered: false,
    timerInterval: null,
    timerSeconds: 20,
    clues: {
        takim: null,
        ulke: null
    }
};

const createStadScreen = document.getElementById("createStadScreen");
const stadLobbyScreen = document.getElementById("stadLobbyScreen");
const stadGameScreen = document.getElementById("stadGameScreen");

const _prevShowScreenStad = showScreen;
showScreen = function(screenName) {
    _prevShowScreenStad(screenName);
    if (createStadScreen) createStadScreen.classList.add("hidden");
    if (stadLobbyScreen) stadLobbyScreen.classList.add("hidden");
    if (stadGameScreen) stadGameScreen.classList.add("hidden");

    if (screenName === "createStad") createStadScreen.classList.remove("hidden");
    if (screenName === "stadLobby") stadLobbyScreen.classList.remove("hidden");
    if (screenName === "stadGame") stadGameScreen.classList.remove("hidden");
};

const stadCard = document.querySelector('[data-mod="stadyum_tanima"]');
if (stadCard) {
    stadCard.addEventListener("click", () => {
        showScreen("createStad");
        setTimeout(() => {
            const input = document.getElementById("createStadNameInput");
            if (input) input.focus();
        }, 100);
    });
}

const _savedNameStad = localStorage.getItem("playerName");
if (_savedNameStad) {
    const inp = document.getElementById("createStadNameInput");
    if (inp) inp.value = _savedNameStad;
}

document.getElementById("createStadBtn").onclick = () => {
    const name = document.getElementById("createStadNameInput").value.trim();
    if (!name) {
        document.getElementById("createStadMsg").textContent = "İsim gir.";
        document.getElementById("createStadMsg").style.color = "#ff6b6b";
        return;
    }

    localStorage.setItem("playerName", name);
    myName = name;

    const turnSec = parseInt(document.getElementById("stadTurnSecondsSelect").value) || 20;
    const maxPlayers = parseInt(document.getElementById("stadMaxPlayersSelect").value) || 2;
    const totalRounds = parseInt(document.getElementById("stadTotalRoundsSelect").value) || 10;
    send({
        type: "stad_create_room",
        name: name,
        turn_seconds: turnSec,
        max_players: maxPlayers,
        total_rounds: totalRounds
    });
};

document.getElementById("createStadBackBtn").onclick = () => {
    showScreen("modselect");
};

document.getElementById("stadStartBtn").onclick = () => {
    send({ type: "stad_start_game" });
};

document.getElementById("stadLobbyLeaveBtn").onclick = () => {
    window._showLeaveConfirmPopup();
};

document.getElementById("stadRoomSettingsBtn").onclick = () => {
    window.openRoomSettingsGeneric({
        title: "Stadyum Tanıma - Oda Ayarları",
        fields: [
            {
                id: "maxPlayers",
                label: "👥 Oyuncu Sayısı",
                current: stadData.maxPlayers || 2,
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
                current: stadData.totalRounds || 10,
                options: [
                    {value: 5, label: "5 Tur"},
                    {value: 10, label: "10 Tur"},
                    {value: 15, label: "15 Tur"},
                    {value: 20, label: "20 Tur"}
                ]
            },
            {
                id: "turnSec",
                label: "⏱️ Tur Süresi",
                current: stadData.turnSeconds || 20,
                options: [
                    {value: 15, label: "15 saniye"},
                    {value: 20, label: "20 saniye"},
                    {value: 30, label: "30 saniye"},
                    {value: 45, label: "45 saniye"},
                    {value: 60, label: "60 saniye"}
                ]
            }
        ],
        onSave: (values) => {
            send({
                type: "stad_update_settings",
                turn_seconds: parseInt(values.turnSec) || 20,
                max_players: parseInt(values.maxPlayers) || 2,
                total_rounds: parseInt(values.totalRounds) || 10
            });
        }
    });
};

const stadRoomHelper = window.setupRoomCodeAndLink({
    codeTextId: "stadRoomCodeText",
    codeEyeBtnId: "stadRoomCodeEyeBtn",
    copyHintId: "stadCopyHint",
    linkTextId: "stadInviteLinkText",
    linkEyeBtnId: "stadInviteLinkEyeBtn",
    linkHintId: "stadInviteLinkHint",
    getRoomCode: () => stadData.roomCode,
    getPlayerId: () => stadData.playerId
});

document.getElementById("stadBackBtn").onclick = () => {
    showEscPopup();
};

document.getElementById("stadBackToMenuBtn").onclick = () => {
    location.reload();
};

document.getElementById("stadRematchBtn").onclick = () => {
    document.getElementById("stadGameOverBox").classList.add("hidden");
    send({ type: "stad_rematch" });
};

document.getElementById("stadBackToLobbyBtn").onclick = () => {
    if (stadData.playerId === 1) {
        send({ type: "stad_back_to_lobby" });
    } else {
        document.getElementById("stadGameOverBox").classList.add("hidden");
        showScreen("stadLobby");
        updateStadLobby();
    }
};

document.querySelectorAll(".stadOptBtn").forEach(btn => {
    btn.onclick = () => {
        if (stadData.currentPlayer !== stadData.playerId) return;
        if (stadData.answered) return;

        const idx = parseInt(btn.dataset.index);
        if (stadData.eliminatedIndices.includes(idx)) return;

        send({
            type: "stad_submit_answer",
            index: idx
        });
    };
});

document.getElementById("stadJokerTakimBtn").onclick = () => {
    if (stadData.currentPlayer !== stadData.playerId || stadData.answered) return;
    send({ type: "stad_use_joker", joker: "takim" });
};

document.getElementById("stadJokerUlkeBtn").onclick = () => {
    if (stadData.currentPlayer !== stadData.playerId || stadData.answered) return;
    send({ type: "stad_use_joker", joker: "ulke" });
};

document.getElementById("stadJoker5050Btn").onclick = () => {
    if (stadData.currentPlayer !== stadData.playerId || stadData.answered) return;
    send({ type: "stad_use_joker", joker: "5050" });
};

function startStadTimer(seconds) {
    stopStadTimer();
    stadData.timerSeconds = seconds;
    updateStadTimerDisplay();
    stadData.timerInterval = setInterval(() => {
        stadData.timerSeconds--;
        updateStadTimerDisplay();
        if (stadData.timerSeconds <= 0) stopStadTimer();
    }, 1000);
}

function stopStadTimer() {
    if (stadData.timerInterval) {
        clearInterval(stadData.timerInterval);
        stadData.timerInterval = null;
    }
}

function updateStadTimerDisplay() {
    const el = document.getElementById("stadTimer");
    el.textContent = stadData.timerSeconds + "s";
    el.classList.remove("warning", "danger");
    if (stadData.timerSeconds <= 5) el.classList.add("danger");
    else if (stadData.timerSeconds <= 10) el.classList.add("warning");
}

function getStadPlayerName(id) {
    const p = stadData.players.find(x => x.id === id);
    return p ? p.name : `Oyuncu ${id}`;
}

function isStadMultiPlayer() {
    return (stadData.maxPlayers || 2) >= 3;
}

function updateStadLobby() {
    if (stadRoomHelper) { stadRoomHelper.renderCode(); stadRoomHelper.renderLink(); }
    document.getElementById("stadLobbyTurnSeconds").textContent = stadData.turnSeconds || 20;
    
    const _maxEl = document.getElementById("stadLobbyMaxPlayers");
    if (_maxEl) _maxEl.textContent = stadData.maxPlayers || 2;
    const _totEl = document.getElementById("stadLobbyTotalRounds");
    if (_totEl) _totEl.textContent = stadData.totalRounds || 10;

    const list = document.getElementById("stadPlayersList");
    list.innerHTML = "";
    stadData.players.forEach(p => {
        const li = document.createElement("li");
        
        const nameCell = document.createElement("span");
        nameCell.style.flex = "1";
        nameCell.style.textAlign = "left";
        nameCell.style.paddingLeft = "10px";
        const crown = p.id === 1 ? " 👑" : "";
        nameCell.textContent = p.id === stadData.playerId ? `${p.id}. ${p.name} (Sen)${crown}` : `${p.id}. ${p.name}${crown}`;
        li.appendChild(nameCell);
        
        if (p.id !== stadData.playerId && stadData.playerId === 1) {
            const kickBtn = document.createElement("button");
            kickBtn.className = "kickBtnNew";
            kickBtn.textContent = "Oyuncuyu At";
            kickBtn.onclick = () => openKickConfirm(p.id, p.name);
            li.appendChild(kickBtn);
        }
        
        if (p.id === stadData.playerId) {
            li.classList.add("playerMine");
        } else {
            li.classList.add("playerOpp");
        }
        list.appendChild(li);
    });

    const startBtn = document.getElementById("stadStartBtn");
    const msg = document.getElementById("stadLobbyMsg");
    const maxP = stadData.maxPlayers || 2;
    const curP = stadData.players.length;

    if (stadData.playerId === 1 && curP === maxP) {
        startBtn.classList.remove("hidden");
        msg.textContent = `${maxP} oyuncu hazır. Başlatabilirsin!`;
        msg.style.color = "#51cf66";
    } else if (stadData.playerId === 1) {
        startBtn.classList.add("hidden");
        msg.textContent = `Oyuncu bekleniyor... (${curP}/${maxP})`;
        msg.style.color = "#ff6b6b";
    } else {
        startBtn.classList.add("hidden");
        msg.textContent = `Host bekleniyor... (${curP}/${maxP})`;
        msg.style.color = "#51cf66";
    }
    
    const settingsBtn = document.getElementById("stadRoomSettingsBtn");
    if (settingsBtn) {
        if (stadData.playerId === 1) settingsBtn.classList.remove("hidden");
        else settingsBtn.classList.add("hidden");
    }
}

function setStadStatus(text, color) {
    const el = document.getElementById("stadStatusMsg");
    el.textContent = text || "";
    el.style.color = color || "#ffd43b";
}

function renderStadTopBar() {
    document.getElementById("stadRoundInfo").textContent =
        `Tur ${stadData.roundNo + 1}/${stadData.totalRounds}`;

    const turnName = getStadPlayerName(stadData.currentPlayer);
    const turnColor = stadData.currentPlayer === stadData.playerId ? "#51cf66" : "#ffa94d";
    document.getElementById("stadTurnInfo").innerHTML =
        `Sıra: <span style="color:${turnColor}">${turnName}</span>`;

    const isMulti = isStadMultiPlayer();
    const scoreboard2P = document.getElementById("stadScoreboard2P");
    const scoreboardPanel = document.getElementById("stadScoreboardPanel");
    
    if (isMulti) {
        if (scoreboard2P) scoreboard2P.style.visibility = "hidden";
        if (scoreboardPanel) scoreboardPanel.style.display = "";
    } else {
        if (scoreboard2P) scoreboard2P.style.visibility = "";
        if (scoreboardPanel) scoreboardPanel.style.display = "none";
        
        document.getElementById("stadP1Name").textContent = getStadPlayerName(1);
        document.getElementById("stadP2Name").textContent = getStadPlayerName(2);
        document.getElementById("stadScore").textContent =
            `${stadData.scores[1] || 0} - ${stadData.scores[2] || 0}`;
    }
    
    if (isMulti) renderStadScoreboardList();
}

function renderStadScoreboardList() {
    const listEl = document.getElementById("stadScoreboardList");
    if (!listEl) return;
    
    const rows = stadData.players.map(p => ({
        id: p.id,
        name: p.name,
        score: stadData.scores[p.id] ?? 0
    }));
    rows.sort((a, b) => b.score - a.score);
    
    const oldPositions = {};
    Array.from(listEl.children).forEach(li => {
        const pid = parseInt(li.dataset.pid);
        oldPositions[pid] = li.getBoundingClientRect().top;
    });
    
    listEl.innerHTML = "";
    rows.forEach((row, idx) => {
        const li = document.createElement("li");
        li.dataset.pid = row.id;
        li.className = "stadScoreRow";
        if (row.id === stadData.currentPlayer) li.classList.add("activeTurn");
        if (row.id === stadData.playerId) li.classList.add("meRow");
        
        const rankBadge = document.createElement("span");
        rankBadge.className = "stadRankBadge";
        const medals = ["🥇", "🥈", "🥉"];
        rankBadge.textContent = medals[idx] || `${idx + 1}.`;
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "stadScoreName";
        nameSpan.textContent = row.name + (row.id === stadData.playerId ? " (Sen)" : "");
        
        const scoreSpan = document.createElement("span");
        scoreSpan.className = "stadScoreVal";
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

function resetStadClues() {
    stadData.clues = {
        takim: null,
        ulke: null
    };
    stadData.eliminatedIndices = [];
}

function renderStadClues() {
    const takimEl = document.getElementById("stadHintTakim");
    const ulkeEl = document.getElementById("stadHintUlke");

    takimEl.classList.add("hidden");
    ulkeEl.classList.add("hidden");

    if (stadData.clues.takim) {
        takimEl.textContent = `🏆 Takım: ${stadData.clues.takim}`;
        takimEl.classList.remove("hidden");
    }
    if (stadData.clues.ulke) {
        ulkeEl.textContent = `🌍 Ülke: ${stadData.clues.ulke}`;
        ulkeEl.classList.remove("hidden");
    }
}

function renderStadJokers() {
    const myJokerCount = (stadData.jokersLeft[stadData.playerId] ?? 0);
    document.getElementById("stadJokerCount").textContent = myJokerCount;

    const myTurn = stadData.currentPlayer === stadData.playerId;
    const canUse = myTurn && !stadData.answered && myJokerCount > 0;

    document.getElementById("stadJokerTakimBtn").disabled = !canUse;
    document.getElementById("stadJokerUlkeBtn").disabled = !canUse;
    document.getElementById("stadJoker5050Btn").disabled = !canUse;
}

function renderStadGame() {
    renderStadTopBar();
    renderStadJokers();
    renderStadClues();
    renderStadOptions();

    const img = document.getElementById("stadImage");
    const reveal = document.getElementById("stadAnswerReveal");

    reveal.classList.add("hidden");
    reveal.textContent = "";

    if (stadData.stadium) {
        img.src = `/stadyum_images/${stadData.stadium.img_file}`;
    }

    const myTurn = stadData.currentPlayer === stadData.playerId;

    if (myTurn) {
        setStadStatus("Senin sıran! Doğru şıkkı seç.", "#51cf66");
    } else {
        setStadStatus(`${getStadPlayerName(stadData.currentPlayer)} cevaplıyor...`, "#ffa94d");
    }
}

function renderStadOptions() {
    const buttons = document.querySelectorAll(".stadOptBtn");
    const myTurn = stadData.currentPlayer === stadData.playerId;

    buttons.forEach((btn, i) => {
        btn.classList.remove("correct", "wrong", "eliminated");
        const opt = stadData.options[i] || "---";
        btn.querySelector(".optText").textContent = opt;

        btn.disabled = !myTurn || stadData.answered;

        if (stadData.eliminatedIndices.includes(i)) {
            btn.classList.add("eliminated");
            btn.disabled = true;
        }
    });
}

function showStadResultMessage(msg) {
    const reveal = document.getElementById("stadAnswerReveal");
    reveal.classList.remove("hidden");

    if (msg.timeout) {
        reveal.textContent = `⏰ Süre doldu! Doğru cevap: ${msg.correct_answer}`;
        reveal.style.color = "#ff6b6b";
    } else if (msg.correct) {
        reveal.textContent = `✅ Doğru! ${msg.correct_answer} | +${msg.earned}`;
        reveal.style.color = "#51cf66";
    } else {
        reveal.textContent = `❌ Yanlış! Doğru: ${msg.correct_answer} | ${msg.earned}`;
        reveal.style.color = "#ff6b6b";
    }

    const buttons = document.querySelectorAll(".stadOptBtn");
    buttons.forEach((btn, i) => {
        btn.disabled = true;
        if (i === msg.correct_index) {
            btn.classList.add("correct");
        } else if (i === msg.selected_index && !msg.correct) {
            btn.classList.add("wrong");
        }
    });
}

const _prevHandleMessageStad = handleMessage;
handleMessage = function(msg) {
    if (msg.type === "stad_room_created" || msg.type === "stad_room_joined") {
        stadData.playerId = msg.player_id;
        stadData.roomCode = msg.room_code;
        stadData.turnSeconds = msg.turn_seconds || 20;
        if (msg.max_players !== undefined) stadData.maxPlayers = msg.max_players;
        if (msg.total_rounds !== undefined) stadData.totalRounds = msg.total_rounds;
        stadData.inGame = true;
        inRoom = true;
        showScreen("stadLobby");
        updateStadLobby();
        return;
    }

    if (msg.type === "stad_lobby_update") {
        stadData.roomCode = msg.room_code;
        stadData.players = msg.players;
        stadData.turnSeconds = msg.turn_seconds || 20;
        stadData.totalRounds = msg.total_rounds || 10;
        if (msg.max_players !== undefined) stadData.maxPlayers = msg.max_players;
        updateStadLobby();
        return;
    }

    if (msg.type === "stad_game_started") {
        stadData.playerId = msg.player_id;
        stadData.players = msg.players;
        stadData.turnSeconds = msg.turn_seconds || 20;
        stadData.totalRounds = msg.total_rounds || 10;
        stadData.currentPlayer = msg.current_player;
        stadData.roundNo = msg.round_no;
        stadData.stadium = msg.stadium;
        stadData.options = msg.options || [];
        stadData.scores = msg.scores;
        stadData.jokersLeft = msg.jokers_left || {};
        if (msg.max_players !== undefined) stadData.maxPlayers = msg.max_players;
        stadData.answered = false;
        resetStadClues();
        
        const overBox = document.getElementById("stadGameOverBox");
        if (overBox) overBox.classList.add("hidden");

        showScreen("stadGame");
        renderStadGame();
        startStadTimer(stadData.turnSeconds);
        return;
    }

    if (msg.type === "stad_new_round") {
        stadData.roundNo = msg.round_no;
        stadData.totalRounds = msg.total_rounds || 10;
        stadData.currentPlayer = msg.current_player;
        stadData.stadium = msg.stadium;
        stadData.options = msg.options || [];
        stadData.scores = msg.scores;
        stadData.jokersLeft = msg.jokers_left || stadData.jokersLeft;
        stadData.answered = false;
        resetStadClues();

        renderStadGame();
        startStadTimer(stadData.turnSeconds);
        return;
    }

    if (msg.type === "stad_joker_result") {
        stadData.jokersLeft = msg.jokers_left || stadData.jokersLeft;

        if (msg.joker_type === "takim") {
            stadData.clues.takim = msg.value;
        } else if (msg.joker_type === "ulke") {
            stadData.clues.ulke = msg.value;
        } else if (msg.joker_type === "5050") {
            stadData.eliminatedIndices = msg.eliminated_indices || [];
        }

        setStadStatus(`${getStadPlayerName(msg.player_id)} joker kullandı: ${msg.joker_type.toUpperCase()}`, "#ffd43b");

        renderStadJokers();
        renderStadClues();
        renderStadOptions();
        return;
    }

    if (msg.type === "stad_answer_result") {
        stadData.answered = true;
        stadData.scores = msg.scores;
        stopStadTimer();
        renderStadTopBar();
        showStadResultMessage(msg);

        if (msg.correct) {
            setStadStatus(`${getStadPlayerName(msg.player_id)} doğru bildi!`, "#51cf66");
        } else if (msg.timeout) {
            setStadStatus(`${getStadPlayerName(msg.player_id)} süresini kaçırdı.`, "#ff6b6b");
        } else {
            setStadStatus(`${getStadPlayerName(msg.player_id)} yanlış bildi.`, "#ff6b6b");
        }
        return;
    }
    
    if (msg.type === "stad_back_to_lobby") {
        document.getElementById("stadGameOverBox").classList.add("hidden");
        stopStadTimer();
        showScreen("stadLobby");
        updateStadLobby();
        return;
    }
    
    if (msg.type === "stad_player_left") {
        if (msg.players) stadData.players = msg.players;
        if (msg.scores) stadData.scores = msg.scores;
        if (msg.jokers_left) stadData.jokersLeft = msg.jokers_left;
        renderStadGame();
        if (typeof showToast === "function") {
            showToast(`${msg.name || "Bir oyuncu"} oyundan ayrıldı`, "warn");
        }
        return;
    }

    if (msg.type === "stad_game_over") {
        stadData.scores = msg.scores;
        stopStadTimer();
        renderStadTopBar();

        const title = document.getElementById("stadGameOverTitle");
        const text = document.getElementById("stadGameOverText");

        if (msg.winner_id === 0) {
            title.textContent = "BERABERE!";
            title.style.color = "#74c0fc";
        } else if (msg.winner_id === stadData.playerId) {
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
            for (const [pidStr, sc] of Object.entries(stadData.scores || {})) {
                const pid = parseInt(pidStr);
                ranking.push({ player_id: pid, name: getStadPlayerName(pid), score: sc });
            }
            ranking.sort((a, b) => b.score - a.score);
        }
        
        const listEl = document.getElementById("stadGameOverList");
        if (listEl) {
            listEl.innerHTML = "";
            const medals = ["🥇", "🥈", "🥉"];
            ranking.forEach((row, idx) => {
                const li = document.createElement("li");
                li.className = "stadGameOverItem";
                if (idx === 0) li.classList.add("goldRank");
                if (row.player_id === stadData.playerId) li.classList.add("meRow");
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

        const rematchBtn = document.getElementById("stadRematchBtn");
        const lobbyBtn = document.getElementById("stadBackToLobbyBtn");
        if (stadData.playerId === 1) {
            rematchBtn.classList.remove("hidden");
            lobbyBtn.classList.remove("hidden");
        } else {
            rematchBtn.classList.add("hidden");
            lobbyBtn.classList.add("hidden");
        }

        document.getElementById("stadGameOverBox").classList.remove("hidden");
        return;
    }

    _prevHandleMessageStad(msg);
};

document.getElementById("stadGameOverBox").classList.add("hidden");