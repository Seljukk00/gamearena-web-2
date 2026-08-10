// ========================================
// MEME ARENA - FRONTEND
// ========================================

let memeData = {
    roomCode: "",
    playerId: null,
    players: [],
    turnSeconds: 45,
    voteSeconds: 15,
    totalRounds: 5,
    maxPlayers: 2,
    currentRound: 0,
    durum: "",
    myCards: [],
    mySelection: null,
    jokersLeft: 3,
    totalPlayers: 2,
    selectedCount: 0
};

// ========================================
// 💬 MEME ARENA CHAT
// ========================================
let memeChat = {
    open: false,
    unread: 0,
    messages: [],
    maxMessages: 50
};

// ✨ 2-5 kişi için farklı renk paleti
const MEME_CHAT_COLORS = ["#ff8a8a", "#7abfff", "#51cf66", "#ffd43b", "#c084fc"];

function getMemeChatColor(pid) {
    if (!pid) return "#adb5bd";
    const idx = (pid - 1) % MEME_CHAT_COLORS.length;
    return MEME_CHAT_COLORS[idx];
}

function showMemeChat() {
    const c = document.getElementById("memeChatContainer");
    if (c) c.style.display = "block";
}

function hideMemeChat() {
    const c = document.getElementById("memeChatContainer");
    if (c) c.style.display = "none";
    closeMemeChatPanel();
    memeChat.messages = [];
    memeChat.unread = 0;
    const box = document.getElementById("memeChatMessages");
    if (box) box.innerHTML = "";
    clearMemeChatPopups();
}

function toggleMemeChatPanel() {
    if (memeChat.open) closeMemeChatPanel();
    else openMemeChatPanel();
}

function openMemeChatPanel() {
    memeChat.open = true;
    memeChat.unread = 0;
    const panel = document.getElementById("memeChatPanel");
    const badge = document.getElementById("memeChatBadge");
    if (panel) panel.style.setProperty("display", "flex", "important");
    if (badge) badge.style.display = "none";
    clearMemeChatPopups();
    const box = document.getElementById("memeChatMessages");
    if (box) setTimeout(() => { box.scrollTop = box.scrollHeight; }, 50);
    const input = document.getElementById("memeChatInput");
    if (input) setTimeout(() => input.focus(), 100);
    setTimeout(() => {
        document.addEventListener("mousedown", memeChatOutsideClickHandler, true);
    }, 100);
}

function closeMemeChatPanel() {
    memeChat.open = false;
    const panel = document.getElementById("memeChatPanel");
    if (panel) panel.style.display = "none";
    document.removeEventListener("mousedown", memeChatOutsideClickHandler, true);
    const input = document.getElementById("memeChatInput");
    if (input && input.value) input.value = "";
}

function memeChatOutsideClickHandler(e) {
    const c = document.getElementById("memeChatContainer");
    if (!c) return;
    if (c.contains(e.target)) return;
    closeMemeChatPanel();
}

function sendMemeChatMessage() {
    const input = document.getElementById("memeChatInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text || text.length > 100) return;
    input.value = "";
    send({ type: "meme_chat_send", text: text });
}

function showMemeChatPopup(msg) {
    if (memeChat.open) return;
    const stack = document.getElementById("memeChatPopupStack");
    if (!stack) return;
    stack.style.display = "flex";
    
    const color = getMemeChatColor(msg.sender_id);
    
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

function clearMemeChatPopups() {
    const stack = document.getElementById("memeChatPopupStack");
    if (!stack) return;
    stack.innerHTML = "";
    stack.style.display = "none";
}

function addMemeChatMessage(msg) {
    memeChat.messages.push(msg);
    if (memeChat.messages.length > memeChat.maxMessages) memeChat.messages.shift();
    
    const box = document.getElementById("memeChatMessages");
    if (!box) return;
    
    const div = document.createElement("div");
    div.className = "miniChatMsg";
    
    const nameSpan = document.createElement("span");
    nameSpan.className = "chatName";
    nameSpan.style.color = getMemeChatColor(msg.sender_id);
    nameSpan.textContent = msg.sender_name + ":";
    
    const textSpan = document.createElement("span");
    textSpan.className = "chatText";
    textSpan.textContent = " " + msg.text;
    
    div.appendChild(nameSpan);
    div.appendChild(textSpan);
    box.appendChild(div);
    
    while (box.children.length > memeChat.maxMessages) box.removeChild(box.firstChild);
    
    if (memeChat.open) {
        box.scrollTop = box.scrollHeight;
    } else {
        memeChat.unread++;
        const badge = document.getElementById("memeChatBadge");
        if (badge) {
            badge.textContent = memeChat.unread;
            badge.style.display = "flex";
            badge.style.animation = "none";
            badge.offsetHeight;
            badge.style.animation = "chatBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        }
        showMemeChatPopup(msg);
    }
}

// ========================================
// EKRAN YÖNETİMİ (wrap)
// ========================================
const _prevShowScreenMeme = showScreen;
showScreen = function(screenName) {
    _prevShowScreenMeme(screenName);
    
    const screens = ["createMemeScreen", "memeLobbyScreen", "memeGameScreen"];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });
    
    if (screenName === "createMeme") {
        const el = document.getElementById("createMemeScreen");
        if (el) el.classList.remove("hidden");
    }
    if (screenName === "memeLobby") {
        const el = document.getElementById("memeLobbyScreen");
        if (el) el.classList.remove("hidden");
    }
    if (screenName === "memeGame") {
        const el = document.getElementById("memeGameScreen");
        if (el) el.classList.remove("hidden");
    }
    
    // 💬 Meme Arena chat: sadece memeLobby/memeGame'de görünür
    const memeScreens = ["memeLobby", "memeGame"];
    if (!memeScreens.includes(screenName)) {
        hideMemeChat();
    }
};

// ========================================
// MESAJ İŞLEME (wrap)
// ========================================
const _prevHandleMessageMeme = handleMessage;
handleMessage = function(msg) {
    if (msg.type && msg.type.startsWith("meme_")) {
        handleMemeMessage(msg);
        return;
    }
    _prevHandleMessageMeme(msg);
};

function handleMemeMessage(msg) {
    if (msg.type === "meme_room_created" || msg.type === "meme_room_joined") {
        memeData.roomCode = msg.room_code;
        memeData.playerId = msg.player_id;
        memeData.turnSeconds = msg.turn_seconds;
        memeData.voteSeconds = msg.vote_seconds;
        memeData.totalRounds = msg.total_rounds;
        memeData.maxPlayers = msg.max_players;
        inRoom = true;
        playerId = msg.player_id;
        showMemeChat();
        showScreen("memeLobby");
        return;
    }
    
    if (msg.type === "meme_lobby_update") {
        showMemeChat();
        memeData.roomCode = msg.room_code;
        memeData.players = msg.players;
        memeData.turnSeconds = msg.turn_seconds;
        memeData.voteSeconds = msg.vote_seconds;
        memeData.totalRounds = msg.total_rounds;
        memeData.maxPlayers = msg.max_players;
        updateMemeLobby();
        return;
    }
    
    // 💬 CHAT mesajları
    if (msg.type === "meme_chat_msg") {
        addMemeChatMessage({
            sender_id: msg.sender_id,
            sender_name: msg.sender_name,
            text: msg.text,
            ts: msg.ts
        });
        return;
    }
    
    if (msg.type === "meme_chat_history") {
        if (msg.messages && Array.isArray(msg.messages)) {
            const wasOpen = memeChat.open;
            memeChat.open = true;
            msg.messages.forEach(m => addMemeChatMessage(m));
            memeChat.open = wasOpen;
            memeChat.unread = 0;
            const badge = document.getElementById("memeChatBadge");
            if (badge) badge.style.display = "none";
        }
        return;
    }
    
    if (msg.type === "meme_round_start") {
        memeData.currentRound = msg.round_no;
        memeData.totalRounds = msg.total_rounds;
        memeData.durum = msg.durum;
        memeData.myCards = msg.my_cards;
        memeData.mySelection = null;
        memeData.jokersLeft = msg.jokers_left;
        memeData.totalPlayers = msg.total_players;
        memeData.selectedCount = 0;
        
        showScreen("memeGame");
        // Voting/scoreboard/gameover kutularını gizle
        document.getElementById("memeVotingBox").classList.add("hidden");
        document.getElementById("memeScoreboardBox").classList.add("hidden");
        document.getElementById("memeGameOverBox").classList.add("hidden");
        document.getElementById("memeCardsBox").classList.remove("hidden");
        document.getElementById("memeShuffleBtn").classList.remove("hidden");
        document.getElementById("memeStatusMsg").classList.remove("hidden");
        
        // ✨ Durum kutusunu geri göster (animasyonlu)
        const durumBox = document.querySelector(".memeDurumBox");
        if (durumBox) {
            durumBox.style.display = "";
            durumBox.classList.remove("hidingUp");
            durumBox.classList.add("showingDown");
            setTimeout(() => durumBox.classList.remove("showingDown"), 500);
        }
        
        // ✨ Kalem/yenile butonlarını geri göster (yeni turda değiştirilebilir)
        const editBtn = document.getElementById("memeDurumEditBtn");
        const shuffleBtnDurum = document.getElementById("memeDurumShuffleBtn");
        if (editBtn) editBtn.style.visibility = "visible";
        if (shuffleBtnDurum) shuffleBtnDurum.style.visibility = "visible";
        
        renderMemeGame();
        startMemeTimer(msg.turn_seconds);
        return;
    }
    
    if (msg.type === "meme_player_selected") {
        memeData.selectedCount = msg.selected_count;
        updateMemeStatus();
        return;
    }
    
    if (msg.type === "meme_player_unselected") {
        memeData.selectedCount = msg.selected_count;
        updateMemeStatus();
        return;
    }
    
    // Sadece kendi durumun değişti
    if (msg.type === "meme_my_durum_changed") {
        memeData.durum = msg.new_durum;
        renderMemeGame();
        
        const durumBox = document.querySelector(".memeDurumBox");
        if (durumBox) {
            durumBox.classList.add("durumChanged");
            setTimeout(() => durumBox.classList.remove("durumChanged"), 600);
        }
        return;
    }
    
    if (msg.type === "meme_new_cards") {
        // ✨ Animasyonlu kart değişimi
        const cardsBox = document.getElementById("memeCardsBox");
        if (cardsBox) {
            // Eski kartları çıkış animasyonuyla kaldır
            const oldCards = cardsBox.querySelectorAll(".memeCard");
            oldCards.forEach((card, i) => {
                setTimeout(() => {
                    card.classList.add("cardShuffleOut");
                }, i * 60);
            });
            
            // 500ms sonra yeni kartları göster
            setTimeout(() => {
                memeData.myCards = msg.cards;
                memeData.mySelection = null;
                memeData.jokersLeft = msg.jokers_left;
                renderMemeGame();
                
                // Yeni kartlara giriş animasyonu ekle
                const newCards = cardsBox.querySelectorAll(".memeCard");
                newCards.forEach((card, i) => {
                    card.classList.add("cardShuffleIn");
                    setTimeout(() => {
                        card.classList.remove("cardShuffleIn");
                    }, 600 + (i * 100));
                });
            }, 500);
        } else {
            // Fallback (element yoksa direkt render)
            memeData.myCards = msg.cards;
            memeData.mySelection = null;
            memeData.jokersLeft = msg.jokers_left;
            renderMemeGame();
        }
        
        showToast("🎲 Kartlar Yenilendi", `Kalan joker: ${msg.jokers_left}`, null, "success");
        return;
    }
    
    if (msg.type === "meme_voting_card") {
        showVotingCard(msg);
        return;
    }
    
    // Herkes AFK
    if (msg.type === "meme_all_afk") {
        showToast("😴 Kimse Seçmedi!", msg.message, null);
        document.getElementById("memeCardsBox").innerHTML = "";
        document.getElementById("memeShuffleBtn").classList.add("hidden");
        document.getElementById("memeCancelBtn").classList.add("hidden");
        const statusMsg = document.getElementById("memeStatusMsg");
        if (statusMsg) {
            statusMsg.textContent = "😴 " + msg.message;
            statusMsg.style.color = "#ffa94d";
            statusMsg.classList.remove("hidden");
        }
        // Kalem/yenile butonlarını da gizle
        const editBtn = document.getElementById("memeDurumEditBtn");
        const shuffleBtnDurum = document.getElementById("memeDurumShuffleBtn");
        if (editBtn) editBtn.style.visibility = "hidden";
        if (shuffleBtnDurum) shuffleBtnDurum.style.visibility = "hidden";
        return;
    }
    
    // AFK ceza bildirimi
    if (msg.type === "meme_afk_penalty") {
        const names = msg.afk_names.join(", ");
        showToast("⚠️ CEZA!", `Kart seçmeyen: ${names} → ${msg.penalty} puan`, null);
        return;
    }
    
    if (msg.type === "meme_vote_progress") {
        const status = document.getElementById("memeVotingStatus");
        if (status) {
            status.textContent = `${msg.voted_count}/${msg.total_voters} oy verdi (Son: ${msg.voter_name})`;
        }
        return;
    }
    
    if (msg.type === "meme_scoreboard") {
        showScoreboard(msg);
        return;
    }
    
    if (msg.type === "meme_game_over") {
        showMemeGameOver(msg);
        return;
    }
    
    // ✨ Host lobiye döndü → herkesi lobiye at
    if (msg.type === "meme_back_to_lobby") {
        if (memeGameOverCountdownInterval) {
            clearInterval(memeGameOverCountdownInterval);
            memeGameOverCountdownInterval = null;
        }
        document.getElementById("memeGameOverBox").classList.add("hidden");
        document.getElementById("memeScoreboardBox").classList.add("hidden");
        document.getElementById("memeVotingBox").classList.add("hidden");
        stopMemeTimer();
        showScreen("memeLobby");
        updateMemeLobby();
        return;
    }
}

// ========================================
// LOBBY GÜNCELLEME
// ========================================
function updateMemeLobby() {
    const lobbyTurn = document.getElementById("memeLobbyTurnSeconds");
    const lobbyVote = document.getElementById("memeLobbyVoteSeconds");
    const lobbyRounds = document.getElementById("memeLobbyRounds");
    const lobbyMax = document.getElementById("memeLobbyMaxPlayers");
    
    if (lobbyTurn) lobbyTurn.textContent = memeData.turnSeconds;
    if (lobbyVote) lobbyVote.textContent = memeData.voteSeconds;
    if (lobbyRounds) lobbyRounds.textContent = memeData.totalRounds;
    if (lobbyMax) lobbyMax.textContent = memeData.maxPlayers;
    
    const list = document.getElementById("memePlayersList");
    if (list) {
        list.innerHTML = "";
        list.style.listStyle = "none";
        list.style.padding = "0";
        list.style.margin = "20px 0";
        
        memeData.players.forEach(p => {
            const li = document.createElement("li");
            li.classList.add("playerRow");
            
            // INLINE STYLE (CSS override) - kesin görünsün
            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.justifyContent = "space-between";
            li.style.padding = "12px 18px";
            li.style.margin = "8px 0";
            li.style.borderRadius = "10px";
            li.style.fontSize = "16px";
            li.style.fontWeight = "600";
            
            // Renk (host: yeşil, misafir: kırmızı)
            if (p.id === memeData.playerId) {
                li.classList.add("playerMine");
                li.style.background = "rgba(81, 207, 102, 0.15)";
                li.style.border = "2px solid #51cf66";
                li.style.color = "#51cf66";
            } else {
                li.classList.add("playerOpp");
                li.style.background = "rgba(255, 107, 107, 0.15)";
                li.style.border = "2px solid #ff6b6b";
                li.style.color = "#ff6b6b";
            }
            
            const nameCell = document.createElement("span");
            nameCell.className = "nameCell";
            nameCell.style.flex = "1";
            nameCell.style.textAlign = "left";
            nameCell.style.paddingLeft = "10px";
            const crown = p.id === 1 ? " 👑" : "";
            nameCell.textContent = p.id === memeData.playerId ? `${p.id}. ${p.name} (Sen)${crown}` : `${p.id}. ${p.name}${crown}`;
            li.appendChild(nameCell);
            
            // Kick butonu
            if (p.id !== memeData.playerId && memeData.playerId === 1) {
                const kickBtn = document.createElement("button");
                kickBtn.className = "kickBtnNew";
                kickBtn.textContent = "Oyuncuyu At";
                kickBtn.style.background = "#ff6b6b";
                kickBtn.style.color = "#fff";
                kickBtn.style.border = "none";
                kickBtn.style.padding = "6px 14px";
                kickBtn.style.borderRadius = "8px";
                kickBtn.style.cursor = "pointer";
                kickBtn.style.fontWeight = "bold";
                kickBtn.onclick = () => openKickConfirm(p.id, p.name);
                li.appendChild(kickBtn);
            }
            
            list.appendChild(li);
        });
    }
    
    const startBtn = document.getElementById("memeStartBtn");
    if (startBtn) {
        if (memeData.playerId === 1 && memeData.players.length >= 2) {
            startBtn.classList.remove("hidden");
        } else {
            startBtn.classList.add("hidden");
        }
    }
    
    // ⚙️ Oda Ayarları butonu - HOST HER ZAMAN GÖRÜR
    const roomSettingsBtn = document.getElementById("memeRoomSettingsBtn");
    if (roomSettingsBtn) {
        if (memeData.playerId === 1) {
            roomSettingsBtn.classList.remove("hidden");
            roomSettingsBtn.style.setProperty("display", "inline-block", "important");
        } else {
            roomSettingsBtn.classList.add("hidden");
            roomSettingsBtn.style.display = "none";
        }
    }
    
    // ✨ Mod Değiştir butonu - sadece host görsün
    const changeModeBtn = document.getElementById("memeChangeModeBtn");
    if (changeModeBtn) {
        if (memeData.playerId === 1) {
            changeModeBtn.classList.remove("hidden");
            changeModeBtn.style.setProperty("display", "inline-block", "important");
        } else {
            changeModeBtn.classList.add("hidden");
            changeModeBtn.style.display = "none";
        }
    }
    
    const lobbyMsg = document.getElementById("memeLobbyMsg");
    if (lobbyMsg) {
        if (memeData.players.length < 2) {
            lobbyMsg.textContent = `Rakip bekleniyor... (${memeData.players.length}/${memeData.maxPlayers})`;
            lobbyMsg.style.color = "#ff6b6b";
        } else if (memeData.players.length < memeData.maxPlayers) {
            lobbyMsg.textContent = `${memeData.players.length}/${memeData.maxPlayers} - Daha fazla katılabilir veya başlatabilirsin`;
            lobbyMsg.style.color = "#ffd43b";
        } else {
            lobbyMsg.textContent = `${memeData.players.length}/${memeData.maxPlayers} - Oda dolu, başlatabilirsin!`;
            lobbyMsg.style.color = "#51cf66";
        }
    }
    
    if (window.setupRoomCodeAndLink) {
        const helper = window.setupRoomCodeAndLink({
            codeTextId: "memeRoomCodeText",
            codeEyeBtnId: "memeRoomCodeEyeBtn",
            copyHintId: "memeCopyHint",
            linkTextId: "memeInviteLinkText",
            linkEyeBtnId: "memeInviteLinkEyeBtn",
            linkHintId: "memeInviteLinkHint",
            getRoomCode: () => memeData.roomCode,
            getPlayerId: () => memeData.playerId
        });
        if (helper) {
            helper.renderCode();
            helper.renderLink();
        }
    }
}

// ========================================
// OYUN EKRANI RENDER
// ========================================
function renderMemeGame() {
    const durumEl = document.getElementById("memeDurumText");
    if (durumEl) durumEl.textContent = memeData.durum;
    
    const roundInfo = document.getElementById("memeRoundInfo");
    if (roundInfo) roundInfo.textContent = `Tur ${memeData.currentRound}/${memeData.totalRounds}`;
    
    // Durum butonları (kalem + yenile) - kart seçildiyse devre dışı
    const editBtn = document.getElementById("memeDurumEditBtn");
    const durumShuffleBtnEl = document.getElementById("memeDurumShuffleBtn");
    const isLocked = (memeData.mySelection !== null);
    
    [editBtn, durumShuffleBtnEl].forEach(btn => {
        if (!btn) return;
        btn.disabled = isLocked;
    });
    
    if (editBtn) editBtn.title = isLocked ? "Kart seçtin, değiştiremezsin" : "Kendi durumunu yaz";
    if (durumShuffleBtnEl) durumShuffleBtnEl.title = isLocked ? "Kart seçtin, değiştiremezsin" : "Başka bir durum çek";
    
    const cardsBox = document.getElementById("memeCardsBox");
    if (!cardsBox) return;
    cardsBox.innerHTML = "";
    
    memeData.myCards.forEach((cardFile, index) => {
        const card = document.createElement("div");
        card.className = "memeCard";
        if (memeData.mySelection === index) {
            card.classList.add("selected");
        }
        
        const img = document.createElement("img");
        img.src = `/oyun_modlari/meme_arena/meme_kartlari/${cardFile}`;
        img.alt = "Meme";
        img.onerror = () => { img.style.display = "none"; };
        card.appendChild(img);
        
        card.onclick = () => {
            if (memeData.mySelection !== null) {
                showToast("⚠️", "Önce seçimini iptal et!", null);
                return;
            }
            openMemeConfirm(index, cardFile);
        };
        
        // Sağ tık ile de büyüt (fallback)
        card.oncontextmenu = (e) => {
            e.preventDefault();
            openMemeZoom(cardFile);
        };
        
        // 🔍 Büyüteç butonu (sağ alt)
        const zoomBtn = document.createElement("button");
        zoomBtn.className = "memeZoomBtn";
        zoomBtn.innerHTML = "🔍";
        zoomBtn.title = "Büyüt";
        zoomBtn.onclick = (e) => {
            e.stopPropagation();
            openMemeZoom(cardFile);
        };
        card.appendChild(zoomBtn);
        
        cardsBox.appendChild(card);
    });
    
    const shuffleBtn = document.getElementById("memeShuffleBtn");
    if (shuffleBtn) {
        shuffleBtn.textContent = `🎲 Kart Değiştir (${memeData.jokersLeft})`;
        shuffleBtn.disabled = (memeData.jokersLeft <= 0 || memeData.mySelection !== null);
    }
    
    const cancelBtn = document.getElementById("memeCancelBtn");
    if (cancelBtn) {
        if (memeData.mySelection !== null) {
            cancelBtn.classList.remove("hidden");
        } else {
            cancelBtn.classList.add("hidden");
        }
    }
    
    updateMemeStatus();
}

function updateMemeStatus() {
    const statusEl = document.getElementById("memeStatusMsg");
    if (!statusEl) return;
    
    if (memeData.mySelection !== null) {
        statusEl.textContent = `✅ Seçimini yaptın! Diğerleri bekleniyor... (${memeData.selectedCount}/${memeData.totalPlayers})`;
        statusEl.style.color = "#51cf66";
    } else {
        statusEl.textContent = `⏳ Kart seç! (${memeData.selectedCount}/${memeData.totalPlayers} seçti)`;
        statusEl.style.color = "#ffd43b";
    }
}

// ========================================
// ONAY POPUP
// ========================================
function openMemeConfirm(index, cardFile) {
    const box = document.getElementById("memeConfirmBox");
    const img = document.getElementById("memeConfirmImg");
    if (img) img.src = `/oyun_modlari/meme_arena/meme_kartlari/${cardFile}`;
    box.classList.remove("hidden");
    
    document.getElementById("memeConfirmYesBtn").onclick = () => {
        memeData.mySelection = index;
        box.classList.add("hidden");
        send({ type: "meme_select_card", card_index: index });
        renderMemeGame();
    };
    document.getElementById("memeConfirmNoBtn").onclick = () => {
        box.classList.add("hidden");
    };
}

// ========================================
// OY VERME
// ========================================
function showVotingCard(msg) {
    document.getElementById("memeCardsBox").classList.add("hidden");
    document.getElementById("memeShuffleBtn").classList.add("hidden");
    const cancelBtn = document.getElementById("memeCancelBtn");
    if (cancelBtn) cancelBtn.classList.add("hidden");
    document.getElementById("memeStatusMsg").classList.add("hidden");
    
    // ✨ ÜSTTEKI DURUM KARTINI GÜNCELLE! (kart sahibinin durumu)
    const durumEl = document.getElementById("memeDurumText");
    if (durumEl) durumEl.textContent = msg.durum;
    
    // Kalem/yenile butonlarını gizle (voting sırasında değiştirilemez)
    const editBtn = document.getElementById("memeDurumEditBtn");
    const shuffleBtnDurum = document.getElementById("memeDurumShuffleBtn");
    if (editBtn) editBtn.style.visibility = "hidden";
    if (shuffleBtnDurum) shuffleBtnDurum.style.visibility = "hidden";
    
    const votingBox = document.getElementById("memeVotingBox");
    if (!votingBox) return;
    votingBox.classList.remove("hidden");
    
    document.getElementById("memeVotingOwnerName").textContent = msg.card_owner_name;
    document.getElementById("memeVotingIndex").textContent = `${msg.current_index}/${msg.total_players}`;
    
    const img = document.getElementById("memeVotingImg");
    img.src = `/oyun_modlari/meme_arena/meme_kartlari/${msg.card_file}`;
    
    const btnBar = document.getElementById("memeVoteButtons");
    const ownerNote = document.getElementById("memeVoteOwnerNote");
    
    if (msg.is_my_card) {
        btnBar.classList.add("hidden");
        ownerNote.classList.remove("hidden");
        ownerNote.textContent = "🎭 Bu senin kartın! Diğerleri oy veriyor...";
    } else {
        btnBar.classList.remove("hidden");
        ownerNote.classList.add("hidden");
        
        document.querySelectorAll(".memeVoteBtn").forEach(b => {
            b.disabled = false;
            b.classList.remove("voted");
        });
    }
    
    startMemeTimer(msg.vote_seconds);
    
    const status = document.getElementById("memeVotingStatus");
    if (status) status.textContent = "";
}

// ========================================
// SKOR TABLOSU
// ========================================
let memeScoreboardCountdown = null;

function showScoreboard(msg) {
    // ✨ TÜM eski ekranları temizle
    document.getElementById("memeVotingBox").classList.add("hidden");
    document.getElementById("memeCardsBox").classList.add("hidden");
    document.getElementById("memeShuffleBtn").classList.add("hidden");
    document.getElementById("memeCancelBtn").classList.add("hidden");
    document.getElementById("memeStatusMsg").classList.add("hidden");
    
    // Timer'ı durdur
    stopMemeTimer();
    
    // Durum kartını gizle
    const durumBox = document.querySelector(".memeDurumBox");
    if (durumBox) {
        durumBox.classList.add("hidingUp");
        setTimeout(() => {
            durumBox.style.display = "none";
            durumBox.classList.remove("hidingUp");
        }, 500);
    }
    
    // Kalem/yenile butonlarını gizle
    const editBtn = document.getElementById("memeDurumEditBtn");
    const shuffleBtnDurum = document.getElementById("memeDurumShuffleBtn");
    if (editBtn) editBtn.style.visibility = "hidden";
    if (shuffleBtnDurum) shuffleBtnDurum.style.visibility = "hidden";
    
    const sbBox = document.getElementById("memeScoreboardBox");
    if (!sbBox) return;
    sbBox.classList.remove("hidden");
    
    document.getElementById("memeScoreboardTitle").textContent = 
        `Tur ${msg.round_no}/${msg.total_rounds} Bitti!`;
    
    const list = document.getElementById("memeScoreboardList");
    list.innerHTML = "";
    
    msg.scores.forEach((s, i) => {
        const li = document.createElement("li");
        li.className = "memeScoreRow";
        if (i === 0) li.classList.add("first");
        
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`;
        const roundText = s.round_score >= 0 ? `+${s.round_score}` : `${s.round_score}`;
        const roundColor = s.round_score > 0 ? "#51cf66" : s.round_score < 0 ? "#ff6b6b" : "#adb5bd";
        
        li.innerHTML = `
            <span class="memeScoreMedal">${medal}</span>
            <span class="memeScoreName">${s.player_name}${s.player_id === memeData.playerId ? " (Sen)" : ""}</span>
            <span class="memeScoreRound" style="color:${roundColor}; font-weight:bold;">${roundText}</span>
            <span class="memeScoreTotal">${s.score}</span>
        `;
        list.appendChild(li);
    });
    
    // ✨ GERİ SAYIM (5, 4, 3, 2, 1)
    if (memeScoreboardCountdown) {
        clearInterval(memeScoreboardCountdown);
    }
    
    const countdownEl = document.getElementById("memeScoreboardCountdown");
    if (countdownEl) {
        let remaining = 5;
        countdownEl.textContent = remaining;
        
        memeScoreboardCountdown = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(memeScoreboardCountdown);
                memeScoreboardCountdown = null;
                countdownEl.textContent = "1";
            } else {
                countdownEl.textContent = remaining;
                // Puls animasyonu
                countdownEl.classList.remove("pulse");
                void countdownEl.offsetWidth;  // reflow tetikle
                countdownEl.classList.add("pulse");
            }
        }, 1000);
    }
}

// ========================================
// OYUN SONU
// ========================================
let memeGameOverCountdownInterval = null;

function showMemeGameOver(msg) {
    document.getElementById("memeScoreboardBox").classList.add("hidden");
    document.getElementById("memeVotingBox").classList.add("hidden");
    
    const overBox = document.getElementById("memeGameOverBox");
    if (!overBox) return;
    overBox.classList.remove("hidden");
    
    // ✨ 30 saniye geri sayım → otomatik lobiye dön
    if (memeGameOverCountdownInterval) {
        clearInterval(memeGameOverCountdownInterval);
    }
    let remaining = 30;
    const countdownEl = document.getElementById("memeGameOverCountdown");
    if (countdownEl) countdownEl.textContent = remaining;
    
    memeGameOverCountdownInterval = setInterval(() => {
        remaining--;
        if (countdownEl) {
            countdownEl.textContent = remaining;
            if (remaining <= 10) countdownEl.style.color = "#ff6b6b";
            else countdownEl.style.color = "#ffd43b";
        }
        if (remaining <= 0) {
            clearInterval(memeGameOverCountdownInterval);
            memeGameOverCountdownInterval = null;
            // Otomatik lobiye dön
            overBox.classList.add("hidden");
            showScreen("memeLobby");
        }
    }, 1000);
    
    const title = document.getElementById("memeGameOverTitle");
    if (msg.winner_id === memeData.playerId) {
        title.textContent = "🏆 KAZANDIN!";
        title.style.color = "#51cf66";
        if (typeof startConfetti === "function") startConfetti();
    } else {
        title.textContent = `🎭 Kazanan: ${msg.winner_name}`;
        title.style.color = "#ffd43b";
    }
    
    const list = document.getElementById("memeGameOverList");
    list.innerHTML = "";
    
    msg.scores.forEach((s, i) => {
        const li = document.createElement("li");
        li.className = "memeScoreRow";
        if (i === 0) li.classList.add("first");
        
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}.`;
        li.innerHTML = `
            <span class="memeScoreMedal">${medal}</span>
            <span class="memeScoreName">${s.player_name}</span>
            <span class="memeScoreTotal">${s.score} puan</span>
        `;
        list.appendChild(li);
    });
    
    // Sadece host'a rematch butonu
    const rematchBtn = document.getElementById("memeGameOverRematchBtn");
    if (rematchBtn) {
        if (memeData.playerId === 1) {
            rematchBtn.classList.remove("hidden");
        } else {
            rematchBtn.classList.add("hidden");
        }
    }
}

// ========================================
// TIMER
// ========================================
let memeTimerInterval = null;
function startMemeTimer(seconds) {
    stopMemeTimer();
    let remaining = seconds;
    const timerEl = document.getElementById("memeTimer");
    if (timerEl) {
        timerEl.textContent = remaining + "s";
        timerEl.classList.remove("warning");
    }
    
    memeTimerInterval = setInterval(() => {
        remaining--;
        if (timerEl) {
            timerEl.textContent = remaining + "s";
            if (remaining <= 10) timerEl.classList.add("warning");
        }
        if (remaining <= 0) stopMemeTimer();
    }, 1000);
}

function stopMemeTimer() {
    if (memeTimerInterval) {
        clearInterval(memeTimerInterval);
        memeTimerInterval = null;
    }
}

// ========================================
// BUTON OLAYLARI
// ========================================
setTimeout(() => {
    // Mod kartına tıklama
    const memeCard = document.querySelector('.mod-card[data-mod="meme_arena"]');
    if (memeCard) {
        memeCard.addEventListener("click", () => {
            showScreen("createMeme");
            const nameInput = document.getElementById("createMemeNameInput");
            if (nameInput) {
                const savedName = localStorage.getItem("playerName");
                if (savedName) nameInput.value = savedName;
                nameInput.focus();
            }
        });
    }
    
    // Oda oluştur
    const createBtn = document.getElementById("createMemeBtn");
    if (createBtn) {
        createBtn.onclick = () => {
            const name = document.getElementById("createMemeNameInput").value.trim();
            if (!name) {
                const msg = document.getElementById("createMemeMsg");
                msg.textContent = "İsim gir.";
                msg.style.color = "#ff6b6b";
                return;
            }
            localStorage.setItem("playerName", name);
            
            const turnSec = parseInt(document.getElementById("memeTurnSecondsSelect").value);
            const voteSec = parseInt(document.getElementById("memeVoteSecondsSelect").value);
            const rounds = parseInt(document.getElementById("memeRoundsSelect").value);
            const maxPlayers = parseInt(document.getElementById("memeMaxPlayersSelect").value);
            
            send({
                type: "meme_create_room",
                name: name,
                turn_seconds: turnSec,
                vote_seconds: voteSec,
                total_rounds: rounds,
                max_players: maxPlayers
            });
        };
    }
    
    const backBtn = document.getElementById("createMemeBackBtn");
    if (backBtn) backBtn.onclick = () => showScreen("modselect");
    
    const leaveBtn = document.getElementById("memeLobbyLeaveBtn");
    if (leaveBtn) leaveBtn.onclick = () => window._showLeaveConfirmPopup();
    
    // 🎮 Oyunu Başlat butonu
    const memeStartBtn = document.getElementById("memeStartBtn");
    if (memeStartBtn) {
        memeStartBtn.addEventListener("click", () => {
            console.log("[MEME] Oyunu Başlat tıklandı!");
            send({ type: "meme_start_game" });
        });
    }
    
    const shuffleBtn = document.getElementById("memeShuffleBtn");
    if (shuffleBtn) {
        shuffleBtn.onclick = () => {
            if (memeData.jokersLeft <= 0) return;
            if (memeData.mySelection !== null) return;
            send({ type: "meme_shuffle_cards" });
        };
    }
    
    const cancelBtn = document.getElementById("memeCancelBtn");
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            memeData.mySelection = null;
            send({ type: "meme_cancel_selection" });
            renderMemeGame();
        };
    }
    
    const gameBackBtn = document.getElementById("memeBackBtn");
    if (gameBackBtn) gameBackBtn.onclick = () => showEscPopup();
    
    // ✏️ Kalem: Kendi durumunu yaz
    const durumEditBtn = document.getElementById("memeDurumEditBtn");
    if (durumEditBtn) {
        durumEditBtn.onclick = () => {
            if (durumEditBtn.disabled) {
                showToast("⚠️", "Kart seçtiğin için durumu değiştiremezsin!", null);
                return;
            }
            openCustomDurumBox();
        };
    }
    
    // 🔄 Yenile: Rastgele başka durum çek
    const durumShuffleBtn = document.getElementById("memeDurumShuffleBtn");
    if (durumShuffleBtn) {
        durumShuffleBtn.onclick = () => {
            if (durumShuffleBtn.disabled) {
                showToast("⚠️", "Kart seçtiğin için durumu değiştiremezsin!", null);
                return;
            }
            send({ type: "meme_shuffle_durum" });
        };
    }
    
    // Custom durum popup - karakter sayacı
    const customInput = document.getElementById("memeCustomDurumInput");
    const customCount = document.getElementById("memeCustomDurumCount");
    if (customInput && customCount) {
        customInput.addEventListener("input", () => {
            customCount.textContent = customInput.value.length;
        });
    }
    
    // Custom durum - kaydet
    const customSaveBtn = document.getElementById("memeCustomDurumSaveBtn");
    if (customSaveBtn) {
        customSaveBtn.onclick = () => {
            const text = customInput.value.trim();
            if (text.length < 3) {
                showToast("⚠️", "En az 3 karakter yaz!", null);
                return;
            }
            send({ type: "meme_write_durum", durum: text });
            closeCustomDurumBox();
        };
    }
    
    // Custom durum - iptal
    const customCancelBtn = document.getElementById("memeCustomDurumCancelBtn");
    if (customCancelBtn) {
        customCancelBtn.onclick = () => closeCustomDurumBox();
    }
    
    // Oy verme butonları
    document.querySelectorAll(".memeVoteBtn").forEach(btn => {
        btn.onclick = () => {
            if (btn.disabled) return;
            const vote = parseInt(btn.dataset.vote);
            send({ type: "meme_vote", vote: vote });
            document.querySelectorAll(".memeVoteBtn").forEach(b => b.disabled = true);
            btn.classList.add("voted");
        };
    });
    
    // Oyun sonu - ana menü (tarayıcı yenilemesin)
    const gameOverMenuBtn = document.getElementById("memeGameOverMenuBtn");
    if (gameOverMenuBtn) {
        gameOverMenuBtn.onclick = () => {
            if (memeGameOverCountdownInterval) {
                clearInterval(memeGameOverCountdownInterval);
                memeGameOverCountdownInterval = null;
            }
            document.getElementById("memeGameOverBox").classList.add("hidden");
            stopMemeTimer();
            inRoom = false;
            memeData.roomCode = "";
            memeData.playerId = null;
            memeData.players = [];
            playerId = null;
            roomCode = "";
            if (ws) { try { ws.close(); } catch(e) {} }
            setTimeout(() => {
                if (typeof connectWS === "function") connectWS();
                showScreen("home");
            }, 200);
        };
    }
    
    // ✨ Oyun sonu - Lobiye dön
    const gameOverLobbyBtn = document.getElementById("memeGameOverLobbyBtn");
    if (gameOverLobbyBtn) {
        gameOverLobbyBtn.onclick = () => {
            if (memeGameOverCountdownInterval) {
                clearInterval(memeGameOverCountdownInterval);
                memeGameOverCountdownInterval = null;
            }
            if (memeData.playerId === 1) {
                // HOST: backend'e broadcast et (herkesi lobiye atar)
                send({ type: "meme_back_to_lobby" });
            } else {
                // MİSAFİR: sadece kendi ekranını lobiye çevir
                document.getElementById("memeGameOverBox").classList.add("hidden");
                stopMemeTimer();
                showScreen("memeLobby");
                updateMemeLobby();
            }
        };
    }
    
    // Oyun sonu - yeni oyun (host)
    const gameOverRematchBtn = document.getElementById("memeGameOverRematchBtn");
    if (gameOverRematchBtn) {
        gameOverRematchBtn.onclick = () => {
            if (memeGameOverCountdownInterval) {
                clearInterval(memeGameOverCountdownInterval);
                memeGameOverCountdownInterval = null;
            }
            // Skorları sıfırla (backend'de de sıfırlanmalı - şimdilik sadece yeniden başlat)
            document.getElementById("memeGameOverBox").classList.add("hidden");
            send({ type: "meme_start_game" });
        };
    }
    
    // Enter tuşu
    const nameInput = document.getElementById("createMemeNameInput");
    if (nameInput) {
        nameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") document.getElementById("createMemeBtn").click();
        });
    }
}, 100);

// ========================================
// CUSTOM DURUM POPUP
// ========================================
function openCustomDurumBox() {
    const box = document.getElementById("memeCustomDurumBox");
    const input = document.getElementById("memeCustomDurumInput");
    const count = document.getElementById("memeCustomDurumCount");
    if (!box) return;
    
    // Boş aç (sıfırdan yaz)
    if (input) {
        input.value = "";
        if (count) count.textContent = "0";
    }
    
    box.classList.remove("hidden");
    setTimeout(() => { if (input) input.focus(); }, 100);
}

function closeCustomDurumBox() {
    const box = document.getElementById("memeCustomDurumBox");
    if (box) box.classList.add("hidden");
}

// ========================================
// KART BÜYÜK GÖSTERİM
// ========================================
function openMemeZoom(cardFile) {
    // Eski varsa kaldır
    const old = document.getElementById("memeZoomOverlay");
    if (old) old.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "memeZoomOverlay";
    overlay.className = "memeZoomOverlay";
    
    const img = document.createElement("img");
    img.className = "memeZoomImg";
    img.src = `/oyun_modlari/meme_arena/meme_kartlari/${cardFile}`;
    
    const closeBtn = document.createElement("button");
    closeBtn.className = "memeZoomClose";
    closeBtn.textContent = "✕";
    
    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    document.body.appendChild(overlay);
    
    const close = () => {
        overlay.remove();
        document.removeEventListener("keydown", escHandler, true);
    };
    overlay.onclick = close;
    closeBtn.onclick = (e) => { e.stopPropagation(); close(); };
    
    // ESC ile kapat - capture phase'de yakala, app.js'e gitmesin
    const escHandler = (e) => {
        if (e.key === "Escape") {
            e.stopPropagation();
            e.preventDefault();
            close();
        }
    };
    // 3. parametre TRUE = capture mode (app.js'ten önce yakalar)
    document.addEventListener("keydown", escHandler, true);
}

// Ipucu göster (ilk açılışta)
if (!localStorage.getItem("memeZoomHintShown")) {
    setTimeout(() => {
        showToast("💡 İpucu", "Karta SAĞ TIK ile büyütebilirsin!", null, "success");
        localStorage.setItem("memeZoomHintShown", "true");
    }, 3000);
}

// ==========================================
// MEME ARENA - ODA AYARLARI
// ==========================================
function openMemeRoomSettings() {
    if (!window.openRoomSettingsGeneric) return;
    
    window.openRoomSettingsGeneric({
        title: "Meme Arena - Oda Ayarları",
        fields: [
            {
                id: "maxPlayers",
                label: "👥 Oyuncu Sayısı",
                current: memeData.maxPlayers || 2,
                options: [
                    {value: 2, label: "2 Oyuncu"},
                    {value: 3, label: "3 Oyuncu"},
                    {value: 4, label: "4 Oyuncu"},
                    {value: 5, label: "5 Oyuncu"}
                ]
            },
            {
                id: "totalRounds",
                label: "🎯 Tur Sayısı",
                current: memeData.totalRounds || 5,
                options: [
                    {value: 3, label: "3 Tur"},
                    {value: 5, label: "5 Tur"},
                    {value: 7, label: "7 Tur"},
                    {value: 10, label: "10 Tur"}
                ]
            },
            {
                id: "turnSeconds",
                label: "⏱️ Kart Seçim Süresi",
                current: memeData.turnSeconds || 45,
                options: [
                    {value: 30, label: "30 saniye"},
                    {value: 45, label: "45 saniye"},
                    {value: 60, label: "60 saniye"},
                    {value: 90, label: "90 saniye"}
                ]
            },
            {
                id: "voteSeconds",
                label: "🗳️ Oy Verme Süresi",
                current: memeData.voteSeconds || 15,
                options: [
                    {value: 10, label: "10 saniye"},
                    {value: 15, label: "15 saniye"},
                    {value: 20, label: "20 saniye"},
                    {value: 30, label: "30 saniye"}
                ]
            }
        ],
        onSave: (values) => {
            send({
                type: "meme_update_settings",
                max_players: parseInt(values.maxPlayers) || 2,
                total_rounds: parseInt(values.totalRounds) || 5,
                turn_seconds: parseInt(values.turnSeconds) || 45,
                vote_seconds: parseInt(values.voteSeconds) || 15
            });
        }
    });
}

// Oda ayarları butonuna click bağla
setTimeout(() => {
    const settingsBtn = document.getElementById("memeRoomSettingsBtn");
    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => openMemeRoomSettings());
    }
    
    // ✨ Mod Değiştir butonu
    const _memeChangeModeBtn = document.getElementById("memeChangeModeBtn");
    if (_memeChangeModeBtn) {
        _memeChangeModeBtn.addEventListener("click", () => {
            if (typeof openChangeModeModal === "function") {
                openChangeModeModal();
            }
        });
    }
}, 200);

// ========================================
// 💬 MEME ARENA CHAT - Event'ler
// ========================================
setTimeout(() => {
    const toggleBtn = document.getElementById("memeChatToggleBtn");
    if (toggleBtn) toggleBtn.addEventListener("click", toggleMemeChatPanel);
    
    const closeBtn = document.getElementById("memeChatCloseBtn");
    if (closeBtn) closeBtn.addEventListener("click", closeMemeChatPanel);
    
    const sendBtn = document.getElementById("memeChatSendBtn");
    if (sendBtn) sendBtn.addEventListener("click", sendMemeChatMessage);
    
    const input = document.getElementById("memeChatInput");
    if (input) {
        input.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                sendMemeChatMessage();
                closeMemeChatPanel();
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
        if (!["memeLobby", "memeGame"].includes(current)) return;
        
        // Input/textarea odaktaysa yoksay
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
        
        const container = document.getElementById("memeChatContainer");
        if (!container || container.style.display === "none") return;
        
        if (memeChat.open) return;
        
        // Popup açıksa yoksay (özellikle Meme Arena'da custom durum popup ve zoom popup var)
        const anyPopup = document.querySelector(".overlay:not(.hidden)");
        if (anyPopup) return;
        
        // Zoom overlay açıksa yoksay
        const zoomOverlay = document.getElementById("memeZoomOverlay");
        if (zoomOverlay) return;
        
        e.preventDefault();
        e.stopPropagation();
        openMemeChatPanel();
    }, true);
    
    // ESC ile chat kapat (öncelik)
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (memeChat.open) {
            e.preventDefault();
            e.stopPropagation();
            closeMemeChatPanel();
        }
    }, true);
}, 200);

console.log("Meme Arena JS yüklendi ✓");