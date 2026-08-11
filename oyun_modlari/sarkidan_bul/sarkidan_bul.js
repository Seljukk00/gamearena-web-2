// ==========================================
// ŞARKIDAN BUL - FRONTEND
// ==========================================

(function() {
    'use strict';

    // ==========================================
    // STATE
    // ==========================================
    let sarkiRoomCode = null;
    let sarkiPlayerId = null;
    let sarkiIsHost = false;
    let sarkiMyName = "";
    let sarkiSettings = {
        max_players: 2,
        dil: "karisik",
        total_songs: 10,
        song_duration: 10,
        answer_duration: 10
    };
    let sarkiCurrentRound = 0;
    let sarkiTotalRounds = 10;
    let sarkiTimerInterval = null;
    let sarkiTimerRemaining = 0;
    let sarkiAudio = null;
    let sarkiHasAnswered = false;
    let sarkiCurrentPhase = "waiting";
    let sarkiCurrentTurn = null;       // ✨ Sıradaki oyuncu ID
    let sarkiIsMyTurn = false;         // ✨ Sıra bende mi?
    let sarkiPoolReady = false;        // ✨ Havuz hazır mı?
    let sarkiPoolPercent = 0;          // ✨ Havuz hazırlanma yüzdesi

    const $ = (id) => document.getElementById(id);
    
    // ✨ ESC popup için global helper (app.js _isCurrentHost bunu kullanır)
    window._sarkiIsHostRef = () => sarkiIsHost;
    
    // ✨ Mod değişimi için global state sync (app.js mod_changed handler kullanır)
    window._sarkiSyncState = function(newPlayerId, newRoomCode) {
        sarkiPlayerId = newPlayerId;
        sarkiIsHost = (newPlayerId === 1);
        sarkiRoomCode = newRoomCode;
        // Havuz durumunu sıfırla - backend prefetch başlayacak
        sarkiPoolReady = false;
        sarkiPoolPercent = 0;
        console.log("[SARKI] State senkronize edildi: playerId=" + newPlayerId + ", isHost=" + sarkiIsHost);
    };

    // ==========================================
    // ŞARKI EKRANLARINI GÖSTER (kendi mini showScreen)
    // ==========================================
    const SARKI_SCREEN_IDS = {
        "createSarki": "createSarkiScreen",
        "sarkiLobby": "sarkiLobbyScreen",
        "sarkiGame": "sarkiGameScreen"
    };

    function showSarkiScreen(key) {
        // Tüm section'ları ve panel'leri gizle
        document.querySelectorAll("section, #modSelectScreen, #homeScreen, #joinScreen").forEach(el => {
            el.classList.add("hidden");
        });
        // Ana section'lar app.js'te tanımlı olabilir - onları da direkt gizle
        const commonScreens = ["homeScreen", "modSelectScreen", "joinScreen", "createScreen", "lobbyScreen", "gameScreen", "selectScreen"];
        commonScreens.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add("hidden");
        });
        // İstenen sarkı ekranını göster
        const targetId = SARKI_SCREEN_IDS[key];
        const el = document.getElementById(targetId);
        if (el) el.classList.remove("hidden");
    }

    // ==========================================
    // EVENT LISTENERS
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        // ✨ Albüm kapağına sağ tık engelle (hile önlemi)
        setTimeout(() => {
            const coverImg = $("sarkiCoverImg");
            const coverWrap = document.querySelector(".sarkiCoverWrap");
            const disableRightClick = (e) => { e.preventDefault(); return false; };
            const disableDrag = (e) => { e.preventDefault(); return false; };
            if (coverImg) {
                coverImg.addEventListener("contextmenu", disableRightClick);
                coverImg.addEventListener("dragstart", disableDrag);
            }
            if (coverWrap) {
                coverWrap.addEventListener("contextmenu", disableRightClick);
            }
        }, 200);
        
        // Mod kartı tıklama
        document.querySelectorAll('.mod-card').forEach(card => {
            if (card.dataset.mod !== "sarkidan_bul") return;
            card.addEventListener('click', () => {
                showSarkiScreen("createSarki");
                const nameInput = $("createSarkiNameInput");
                if (nameInput) {
                    const savedName = localStorage.getItem("playerName") || "";
                    if (savedName) nameInput.value = savedName;
                    setTimeout(() => nameInput.focus(), 100);
                }
                // ✨ Kaydedilmiş ayarları yükle
                loadSarkiSavedSettings();
            });
        });

        // Oda Oluştur butonu
        const createBtn = $("createSarkiBtn");
        if (createBtn) createBtn.addEventListener('click', createSarkiRoom);

        // Geri butonu → modselect
        const backBtn = $("createSarkiBackBtn");
        if (backBtn) backBtn.addEventListener('click', () => {
            if (typeof showScreen === "function") showScreen("modselect");
        });

        // Lobby butonları
        const startBtn = $("sarkiStartBtn");
        if (startBtn) startBtn.addEventListener('click', startSarkiGame);

        const leaveBtn = $("sarkiLobbyLeaveBtn");
        if (leaveBtn) leaveBtn.addEventListener('click', leaveSarkiRoom);

        const roomSettingsBtn = $("sarkiRoomSettingsBtn");
        if (roomSettingsBtn) roomSettingsBtn.addEventListener('click', openSarkiRoomSettings);

        const changeModeBtn = $("sarkiChangeModeBtn");
        if (changeModeBtn) changeModeBtn.addEventListener('click', () => {
            if (window.openChangeModeModal) window.openChangeModeModal();
        });

        // Oyun ekranı geri → ESC menü popup aç (diğer modlar gibi)
        const gameBackBtn = $("sarkiBackBtn");
        if (gameBackBtn) gameBackBtn.addEventListener('click', () => {
            if (typeof showEscPopup === "function") {
                showEscPopup();
            } else {
                if (confirm("Odadan çıkmak istediğine emin misin?")) leaveSarkiRoom();
            }
        });

        // Şık butonları
        document.querySelectorAll('.sarkiOptBtn').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.index);
                if (!isNaN(idx)) sendAnswer(idx);
            });
        });

        // Oyun sonu butonları
        const rematchBtn = $("sarkiRematchBtn");
        if (rematchBtn) rematchBtn.addEventListener('click', () => {
            $("sarkiGameOverBox").classList.add("hidden");
            startSarkiGame();
        });

        const backToLobbyBtn = $("sarkiBackToLobbyBtn");
        if (backToLobbyBtn) backToLobbyBtn.addEventListener('click', () => {
            $("sarkiGameOverBox").classList.add("hidden");
            send({ type: "sarki_back_to_lobby" });
        });

        const backToMenuBtn = $("sarkiBackToMenuBtn");
        if (backToMenuBtn) backToMenuBtn.addEventListener('click', leaveSarkiRoom);

        setupSarkiChat();
    });

    // ==========================================
    // ODA OLUŞTUR
    // ==========================================
    function createSarkiRoom() {
        const name = $("createSarkiNameInput").value.trim();
        if (!name) {
            $("createSarkiMsg").textContent = "❌ İsim gir!";
            return;
        }

        sarkiMyName = name;
        localStorage.setItem("playerName", name);

        const settings = {
            max_players: parseInt($("sarkiMaxPlayersSelect").value),
            dil: $("sarkiDilSelect").value,
            total_songs: parseInt($("sarkiTotalSongsSelect").value),
            song_duration: parseInt($("sarkiSongDurationSelect").value),
            answer_duration: parseInt($("sarkiAnswerDurationSelect").value)
        };

        // ✨ Ayarları localStorage'a kaydet (bir dahaki sefere hatırlansın)
        try {
            localStorage.setItem("sarkiCreateSettings", JSON.stringify(settings));
        } catch(e) {}

        const msg = {
            type: "sarki_create_room",
            name: name,
            ...settings
        };

        $("createSarkiMsg").textContent = "⏳ Oda oluşturuluyor...";
        send(msg);
    }
    
    // ✨ Kaydedilmiş ayarları select'lere yükle
    function loadSarkiSavedSettings() {
        try {
            const raw = localStorage.getItem("sarkiCreateSettings");
            if (!raw) return;
            const s = JSON.parse(raw);
            if (!s) return;
            
            const setSelect = (id, val) => {
                const el = $(id);
                if (el && val !== undefined && val !== null) {
                    // Option gerçekten var mı kontrol et
                    const optionExists = Array.from(el.options).some(o => o.value == String(val));
                    if (optionExists) el.value = String(val);
                }
            };
            
            setSelect("sarkiMaxPlayersSelect", s.max_players);
            setSelect("sarkiDilSelect", s.dil);
            setSelect("sarkiTotalSongsSelect", s.total_songs);
            setSelect("sarkiSongDurationSelect", s.song_duration);
            setSelect("sarkiAnswerDurationSelect", s.answer_duration);
            
            console.log("[SARKI] Kayıtlı ayarlar yüklendi:", s);
        } catch(e) {
            console.warn("[SARKI] Ayar yükleme hatası:", e);
        }
    }

    function startSarkiGame() {
        send({ type: "sarki_start_game" });
    }

    function leaveSarkiRoom() {
        stopSarkiAudio();
        stopSarkiTimer();
        sarkiRoomCode = null;
        sarkiPlayerId = null;
        sarkiIsHost = false;
        hideSarkiChat();
        
        // Overlay'i de gizle (açık kalmasın)
        const overlay = $("sarkiBigOverlay");
        if (overlay) overlay.classList.add("hidden");
        // Önce sarkı ekranlarını gizle
        Object.values(SARKI_SCREEN_IDS).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add("hidden");
        });
        if (ws) { try { ws.close(); } catch(e) {} }
        setTimeout(() => {
            if (typeof connectWS === "function") connectWS();
            if (typeof showScreen === "function") showScreen("home");
        }, 300);
    }

    // ==========================================
    // ODA AYARLARI POPUP
    // ==========================================
    function openSarkiRoomSettings() {
        if (!window.openRoomSettingsGeneric) return;

        window.openRoomSettingsGeneric({
            title: "🎵 Şarkıdan Bul - Oda Ayarları",
            fields: [
                {
                    id: "settingSarkiMax",
                    label: "👥 Oyuncu Sayısı",
                    current: sarkiSettings.max_players,
                    options: [
                        { value: 2, label: "2 Oyuncu" },
                        { value: 3, label: "3 Oyuncu" },
                        { value: 4, label: "4 Oyuncu" },
                        { value: 5, label: "5 Oyuncu" }
                    ]
                },
                {
                    id: "settingSarkiDil",
                    label: "🌐 Şarkı Dili",
                    current: sarkiSettings.dil,
                    options: [
                        { value: "tr", label: "🇹🇷 Türkçe" },
                        { value: "yabanci", label: "🌍 Yabancı" },
                        { value: "karisik", label: "🎭 Karışık" }
                    ]
                },
                {
                    id: "settingSarkiTotal",
                    label: "🔢 Şarkı Sayısı",
                    current: sarkiSettings.total_songs,
                    options: [
                        { value: 5, label: "5 Şarkı" },
                        { value: 10, label: "10 Şarkı" },
                        { value: 15, label: "15 Şarkı" },
                        { value: 20, label: "20 Şarkı" }
                    ]
                },
                {
                    id: "settingSarkiSongDur",
                    label: "🎧 Şarkı Süresi (saniye)",
                    current: sarkiSettings.song_duration,
                    options: [
                        { value: 5, label: "5 saniye (Zor)" },
                        { value: 10, label: "10 saniye" },
                        { value: 15, label: "15 saniye" },
                        { value: 20, label: "20 saniye" },
                        { value: 30, label: "30 saniye (Çok Kolay)" }
                    ]
                },
                {
                    id: "settingSarkiAnsDur",
                    label: "⏱️ Cevap Süresi (saniye)",
                    current: sarkiSettings.answer_duration,
                    options: [
                        { value: 5, label: "5 saniye (Hızlı)" },
                        { value: 10, label: "10 saniye" },
                        { value: 15, label: "15 saniye" },
                        { value: 20, label: "20 saniye" },
                        { value: 30, label: "30 saniye (Rahat)" }
                    ]
                }
            ],
            readonly: !sarkiIsHost,
            onSave: (values) => {
                const newDil = values.settingSarkiDil;
                const newTotal = parseInt(values.settingSarkiTotal);
                const newMax = parseInt(values.settingSarkiMax);
                const newSongDur = parseInt(values.settingSarkiSongDur);
                const newAnsDur = parseInt(values.settingSarkiAnsDur);
                
                // Dil veya şarkı sayısı değiştiyse havuz hazır flag'ini SIFIRLA
                if (newDil !== sarkiSettings.dil || newTotal !== sarkiSettings.total_songs) {
                    sarkiPoolReady = false;
                    sarkiPoolPercent = 0;
                    updateSarkiLobbyMessage();
                }
                
                // ✨ Ayarları localStorage'a da kaydet (bir dahakine hatırlansın)
                try {
                    localStorage.setItem("sarkiCreateSettings", JSON.stringify({
                        max_players: newMax,
                        dil: newDil,
                        total_songs: newTotal,
                        song_duration: newSongDur,
                        answer_duration: newAnsDur
                    }));
                } catch(e) {}
                
                send({
                    type: "sarki_update_settings",
                    max_players: newMax,
                    dil: newDil,
                    total_songs: newTotal,
                    song_duration: newSongDur,
                    answer_duration: newAnsDur
                });
            }
        });
    }
	
	// ==========================================
    // LOBBY MESAJI + BAŞLAT BUTONU DURUMU
    // ==========================================
    function updateSarkiLobbyMessage() {
        const lobbyMsg = $("sarkiLobbyMsg");
        const startBtn = $("sarkiStartBtn");
        const playerCount = document.querySelectorAll("#sarkiPlayersList li").length;
        
        // Havuz hazır değilse HERKESTE aynı mesaj (yüzde ile)
        if (!sarkiPoolReady) {
            if (lobbyMsg) {
                const pct = Math.max(0, Math.min(100, sarkiPoolPercent || 0));
                lobbyMsg.innerHTML = `🎵 Şarkı havuzu hazırlanıyor... <span style="color:#fff; background:rgba(255,212,59,0.2); padding:2px 10px; border-radius:12px; font-family:monospace; font-weight:bold; margin-left:8px;">%${pct}</span>`;
                lobbyMsg.style.color = "#ffd43b";
                lobbyMsg.classList.add("sarkiPulseMsg");
                lobbyMsg.classList.remove("sarkiWaitHostMsg");
            }
            // Host'un başlat butonu SOLUK ve tıklanamaz
            if (startBtn && sarkiIsHost) {
                startBtn.disabled = true;
                startBtn.style.opacity = "0.4";
                startBtn.style.cursor = "not-allowed";
            }
            return;
        }
        
        // Havuz HAZIR
        if (sarkiIsHost) {
            // Host için
            if (playerCount < 2) {
                if (lobbyMsg) {
                    lobbyMsg.textContent = "En az 2 oyuncu gerekli...";
                    lobbyMsg.style.color = "#ff6b6b";
                    lobbyMsg.classList.remove("sarkiPulseMsg", "sarkiWaitHostMsg");
                }
                if (startBtn) {
                    startBtn.disabled = true;
                    startBtn.style.opacity = "0.4";
                    startBtn.style.cursor = "not-allowed";
                }
            } else {
                if (lobbyMsg) {
                    lobbyMsg.textContent = "✅ Hazır! Oyunu başlatabilirsin.";
                    lobbyMsg.style.color = "#51cf66";
                    lobbyMsg.classList.remove("sarkiPulseMsg", "sarkiWaitHostMsg");
                }
                if (startBtn) {
                    startBtn.disabled = false;
                    startBtn.style.opacity = "1";
                    startBtn.style.cursor = "pointer";
                }
            }
        } else {
            // Misafir için: kırmızı animasyonlu "Host'un oyunu başlatması bekleniyor..."
            if (lobbyMsg) {
                lobbyMsg.textContent = "Host'un oyunu başlatması bekleniyor...";
                lobbyMsg.style.color = "#ff6b6b";
                lobbyMsg.classList.add("sarkiWaitHostMsg");
                lobbyMsg.classList.remove("sarkiPulseMsg");
            }
        }
    }

    // ==========================================
    // LOBBY GÜNCELLE
    // ==========================================
    function updateSarkiLobby(msg) {
        sarkiSettings.max_players = msg.max_players || 2;
        sarkiSettings.dil = msg.dil || "karisik";
        sarkiSettings.total_songs = msg.total_songs || 10;
        sarkiSettings.song_duration = msg.song_duration || 10;
        sarkiSettings.answer_duration = msg.answer_duration || 10;

        sarkiRoomCode = msg.room_code;
        
        // ✨ Mod değişimi durumunda global playerId'yi al (mod_changed handler'ı zaten set etti)
        // Sarkı için kendi state'imizi de senkronize et
        if (typeof playerId !== "undefined" && playerId !== null) {
            if (sarkiPlayerId === null || sarkiPlayerId !== playerId) {
                sarkiPlayerId = playerId;
                sarkiIsHost = (playerId === 1);
                console.log("[SARKI] PlayerId senkronize edildi:", sarkiPlayerId, "isHost:", sarkiIsHost);
            }
        }

        // Oda kodu + davet linki (helper'ı bir kez oluştur, sonra render'ları çağır)
        if (window.setupRoomCodeAndLink) {
            if (!window._sarkiRoomHelper) {
                window._sarkiRoomHelper = window.setupRoomCodeAndLink({
                    codeTextId: "sarkiRoomCodeText",
                    codeEyeBtnId: "sarkiRoomCodeEyeBtn",
                    copyHintId: "sarkiCopyHint",
                    linkTextId: "sarkiInviteLinkText",
                    linkEyeBtnId: "sarkiInviteLinkEyeBtn",
                    linkHintId: "sarkiInviteLinkHint",
                    getRoomCode: () => sarkiRoomCode,
                    getPlayerId: () => sarkiPlayerId
                });
            }
            if (window._sarkiRoomHelper) {
                window._sarkiRoomHelper.renderCode();
                window._sarkiRoomHelper.renderLink();
            }
        }

        // Oyuncular
        const list = $("sarkiPlayersList");
        if (list) {
            list.innerHTML = "";
            msg.players.forEach((p, idx) => {
                const li = document.createElement("li");
                li.className = (p.id === sarkiPlayerId) ? "playerMine" : "playerOpp";
                const isHostP = (p.id === 1);
                const isMe = (p.id === sarkiPlayerId);
                
                // İsim (sola yaslı - Bil Bakalım tarzı)
                const nameCell = document.createElement("span");
                nameCell.style.flex = "1";
                nameCell.style.textAlign = "left";
                nameCell.style.paddingLeft = "10px";
                const crown = isHostP ? " 👑" : "";
                nameCell.textContent = isMe 
                    ? `${idx + 1}. ${p.name} (Sen)${crown}` 
                    : `${idx + 1}. ${p.name}${crown}`;
                li.appendChild(nameCell);

                // Kick butonu (sağa yaslı - sadece host + rakip için)
                if (sarkiIsHost && !isHostP) {
                    const kickBtn = document.createElement("button");
                    kickBtn.className = "kickBtnNew";
                    kickBtn.textContent = "Oyuncuyu At";
                    kickBtn.addEventListener('click', () => {
                        if (confirm(`${p.name} adlı oyuncuyu atmak istediğine emin misin?`)) {
                            send({ type: "kick_player", target_id: p.id });
                        }
                    });
                    li.appendChild(kickBtn);
                }
                list.appendChild(li);
            });
        }

        // Lobby info
        $("sarkiLobbyMaxPlayers").textContent = sarkiSettings.max_players;
        const dilMap = { "tr": "🇹🇷 Türkçe", "yabanci": "🌍 Yabancı", "karisik": "🎭 Karışık" };
        $("sarkiLobbyDil").textContent = dilMap[sarkiSettings.dil] || "Karışık";
        $("sarkiLobbyTotalSongs").textContent = sarkiSettings.total_songs;
        $("sarkiLobbySongDuration").textContent = sarkiSettings.song_duration;
        $("sarkiLobbyAnswerDuration").textContent = sarkiSettings.answer_duration;

        // Host butonları görünürlüğü
        const startBtn = $("sarkiStartBtn");
        const settingsBtn = $("sarkiRoomSettingsBtn");
        const modeBtn = $("sarkiChangeModeBtn");
        if (sarkiIsHost) {
            startBtn.classList.remove("hidden");
            settingsBtn.classList.remove("hidden");
            modeBtn.classList.remove("hidden");
        } else {
            startBtn.classList.add("hidden");
            settingsBtn.classList.add("hidden");
            modeBtn.classList.add("hidden");
        }
        
        // ✨ Mesaj + buton durumunu ortak fonksiyona bırak (havuz durumuna göre)
        updateSarkiLobbyMessage();
    }
	
	// ==========================================
    // TUR INTROSU (2 saniye "Sıra: X" ekranı)
    // ==========================================
    function onTurnIntro(msg) {
        // Oyun ekranını göster (arka planda hazırlansın)
        showSarkiScreen("sarkiGame");
        
        // Önceki turdan kalanları temizle
        $("sarkiGameOverBox").classList.add("hidden");
        $("sarkiRoundResultBox").classList.add("hidden");
        
        // ✨ İlk tur ise skor tablosunu 0 puanla başlat
        if (msg.round_no === 1 && msg.players_info) {
            const initialScores = msg.players_info.map(p => ({
                player_id: p.id,
                player_name: p.name,
                total_score: 0
            }));
            updateScoreboard(initialScores);
        }
        
        // ✨ Yeni tur - ses tamamen dursun, cevap flag'i sıfırlansın
        stopSarkiAudio();
        stopSarkiTimer();
        sarkiHasAnswered = false;  // Sesi kısma flag'ini sıfırla
        
        // Kapak varsa gizle (yeni şarkı geliyor)
        const cover = $("sarkiCoverImg");
        if (cover) {
            cover.classList.remove("reveal");
            cover.style.display = "none";
        }
        
        // Bilgi çubuğunu güncelle
        $("sarkiRoundInfo").textContent = `🎵 Şarkı ${msg.round_no}/${msg.total_rounds}`;
        $("sarkiPhaseInfo").innerHTML = `<span style="color:#adb5bd;">⏳ Başlıyor...</span>`;
        $("sarkiSongStatus").textContent = "";
        $("sarkiStatusMsg").textContent = "";
        
        // Timer'ı sıfırla (görsel olarak)
        const bigTimer = $("sarkiBigTimer");
        if (bigTimer) {
            bigTimer.textContent = "--";
            bigTimer.className = "sarkiBigTimer";
        }
        
        // Progress bar sıfırla
        const progressFill = $("sarkiProgressFill");
        if (progressFill) {
            progressFill.style.transition = "none";
            progressFill.style.width = "100%";
        }
        
        // Şıkları temizle + kilitle (kimse tıklayamaz)
        document.querySelectorAll('.sarkiOptBtn').forEach(btn => {
            btn.classList.remove("correct", "wrong", "selected");
            btn.disabled = true;
            const titleEl = btn.querySelector('.optTitle');
            const artistEl = btn.querySelector('.optArtist');
            if (titleEl) titleEl.textContent = "---";
            if (artistEl) artistEl.textContent = "---";
        });
        
        const optsBox = $("sarkiOptionsBox");
        if (optsBox) optsBox.classList.add("locked");
        
        // ✨ HARİTADAN BUL TARZI BÜYÜK OVERLAY
        const overlay = $("sarkiBigOverlay");
        const textEl = $("sarkiBigOverlayText");
        
        if (!overlay || !textEl) return;
        
        const isMyTurn = (msg.current_turn === sarkiPlayerId);
        overlay.classList.remove("mine", "other", "hidden");
        
        if (isMyTurn) {
            overlay.classList.add("mine");
            textEl.textContent = "SIRA SENDE!";
        } else {
            overlay.classList.add("other");
            const upperName = (msg.current_turn_name || "").toUpperCase();
            textEl.textContent = `${upperName} OYNUYOR`;
        }
        
        // ✨ 1.8 saniye sonra gizle (backend 2sn sonra round_start gönderecek)
        setTimeout(() => {
            overlay.classList.add("hidden");
        }, 1800);
    }

    // ==========================================
    // OYUN EKRANI
    // ==========================================
    function onRoundStart(msg) {
        showSarkiScreen("sarkiGame");
        $("sarkiGameOverBox").classList.add("hidden");
        $("sarkiRoundResultBox").classList.add("hidden");

        // ✨ Kapak tekrar bulanıklaşsın (yeni şarkı - hile önlemi)
        const coverBlur = $("sarkiCoverImg");
        if (coverBlur) coverBlur.classList.remove("reveal");

        sarkiCurrentRound = msg.round_no;
        sarkiTotalRounds = msg.total_rounds;
        sarkiHasAnswered = false;
        sarkiCurrentPhase = "listening";
        window._sarkiSongDuration = msg.song_duration;
        window._sarkiAnswerDuration = msg.answer_duration;

        // ✨ Sıradaki oyuncu
        sarkiCurrentTurn = msg.current_turn;
        sarkiIsMyTurn = (msg.current_turn === sarkiPlayerId);
        const turnName = msg.current_turn_name || "?";

        $("sarkiRoundInfo").textContent = `🎵 Şarkı ${msg.round_no}/${msg.total_rounds}`;
        
        if (sarkiIsMyTurn) {
            $("sarkiPhaseInfo").innerHTML = `<span style="color:#51cf66;">🎯 SIRA SENDE!</span>`;
            $("sarkiSongStatus").textContent = "🎧 Dinle ve doğru şıkkı seç!";
        } else {
            $("sarkiPhaseInfo").innerHTML = `<span style="color:#4dabf7;">👁️ Sıra: ${turnName}</span>`;
            $("sarkiSongStatus").textContent = `👁️ ${turnName} cevaplayacak, sen dinleyip izle`;
        }

        const cover = $("sarkiCoverImg");
        if (msg.cover) {
            cover.src = msg.cover;
            cover.style.display = "block";
        } else {
            cover.style.display = "none";
        }

        // ✨ Şıkları hazırla
        const optBtns = document.querySelectorAll('.sarkiOptBtn');
        msg.options.forEach((opt, idx) => {
            if (optBtns[idx]) {
                const titleEl = optBtns[idx].querySelector('.optTitle');
                const artistEl = optBtns[idx].querySelector('.optArtist');
                if (titleEl) titleEl.textContent = opt.title;
                if (artistEl) artistEl.textContent = opt.artist;
                optBtns[idx].classList.remove("correct", "wrong", "selected");
                // ✨ Sadece sıradaki oyuncu şıklara tıklayabilir
                optBtns[idx].disabled = !sarkiIsMyTurn;
            }
        });
        
        // ✨ İzleyiciler için şıkları kilitli göster
        const optsBox = $("sarkiOptionsBox");
        if (optsBox) {
            if (sarkiIsMyTurn) {
                optsBox.classList.remove("locked");
            } else {
                optsBox.classList.add("locked");
            }
        }

        // Progress bar sıfırla
        const progressFill = $("sarkiProgressFill");
        if (progressFill) {
            progressFill.style.transition = "none";
            progressFill.style.width = "100%";
            // Reflow için
            void progressFill.offsetWidth;
            progressFill.style.transition = `width ${msg.song_duration}s linear`;
            progressFill.style.width = "0%";
        }

        playSarkiAudio(msg.preview_url, msg.song_duration);

        const totalTime = msg.song_duration + msg.answer_duration;
        startSarkiTimer(totalTime);

        $("sarkiStatusMsg").textContent = "";
    }

    function getGlobalVolume() {
        // 1) Global ses input'undan değer al
        const range = document.getElementById("mlVolumeRange");
        if (range) {
            const val = parseInt(range.value);
            if (!isNaN(val)) return val / 100;
        }
        // 2) LocalStorage fallback (Mini Futbol vs. kaydediyor)
        const keys = ["mlVolume", "globalVolume", "sarkiVolume"];
        for (const k of keys) {
            const saved = parseInt(localStorage.getItem(k));
            if (!isNaN(saved)) return saved / 100;
        }
        return 0.5;
    }

    // ✨ Ses widget'ını dinle - global widget'a bağlan
    function setupGlobalVolumeListener() {
        if (window._sarkiVolumeListenerAdded) return;
        window._sarkiVolumeListenerAdded = true;
        
        const applyVolume = () => {
            if (!sarkiAudio) return;
            let vol = getGlobalVolume();
            
            // ✨ Sadece widget TAM 0 ise sessiz (yoksa mırıldanma sesi ver)
            if (vol <= 0.001) {
                sarkiAudio.volume = 0;
                return;
            }
            
            // ✨ Cevap fazı veya cevap verildi → widget sesinin YARISI (mırıldanma)
            if (sarkiCurrentPhase === "answering" || sarkiHasAnswered) {
                sarkiAudio.volume = vol * 0.5;
                return;
            }
            
            // Normal dinleme fazı → tam ses (widget değeri)
            sarkiAudio.volume = vol;
        };
        
        const range = document.getElementById("mlVolumeRange");
        if (range) {
            range.addEventListener("input", applyVolume);
            range.addEventListener("change", applyVolume);
        }
        
        const widget = document.getElementById("globalVolumeControl");
        if (widget) {
            widget.addEventListener("click", () => {
                setTimeout(applyVolume, 50);
            });
        }
    }

    // ✨ Aktif audio stop timer (yeni tur başlarsa eskisini iptal et)
    let sarkiAudioStopTimer = null;

    function playSarkiAudio(previewUrl, songDuration) {
        // Önce eskisini KESİN durdur (çift ses fix)
        stopSarkiAudio();
        
        // Play ID (aynı anda birden fazla çağrı gelirse en yeni kazansın)
        window._sarkiPlayId = (window._sarkiPlayId || 0) + 1;
        const myPlayId = window._sarkiPlayId;
        
        // Volume listener setup (tek seferlik)
        setupGlobalVolumeListener();
        
        const AUDIO_START_DELAY = 100;  // ms
        
        // Şarkıyı başlat (100ms sonra)
        setTimeout(() => {
            if (myPlayId !== window._sarkiPlayId) {
                console.log("[SARKI] Eski play iptal edildi");
                return;
            }
            
            const audioEl = document.getElementById("sarkiAudio");
            if (!audioEl) return;

            try {
                audioEl.pause();
                audioEl.currentTime = 0;
            } catch(e) {}
            
            audioEl.src = previewUrl;
            audioEl.volume = getGlobalVolume();
            audioEl.load();

            sarkiAudio = audioEl;
            
            const playPromise = audioEl.play();
            if (playPromise) {
                playPromise.catch(err => {
                    console.warn("[SARKI] Autoplay engellendi:", err);
                    $("sarkiStatusMsg").textContent = "⚠️ Ses çalmıyor - Sayfayı tıklayın!";
                });
            }
        }, AUDIO_START_DELAY);

        // ✨ CEVAP FAZINA GEÇİŞ timer'ı (şarkı devam eder, sadece sesi kısılır)
        setTimeout(() => {
            if (myPlayId !== window._sarkiPlayId) return;
            
            if (sarkiAudioStopTimer) {
                clearTimeout(sarkiAudioStopTimer);
                sarkiAudioStopTimer = null;
            }
            
            sarkiAudioStopTimer = setTimeout(() => {
                sarkiAudioStopTimer = null;
                
                if (myPlayId !== window._sarkiPlayId) return;
                
                if (sarkiCurrentPhase === "listening") {
                    sarkiCurrentPhase = "answering";
                    $("sarkiPhaseInfo").textContent = "⏱️ Cevabını gir!";
                    $("sarkiSongStatus").textContent = "🎯 Cevabını gir!";
                    
                    // ✨ Şarkıyı DURDURMA, KALDIĞI YERDEN devam etsin (çok kısık - %0.5)
                    if (sarkiAudio) {
                        try {
                            const baseVol = getGlobalVolume();
                            
                            if (baseVol <= 0.001) {
                                sarkiAudio.volume = 0;
                                console.log("[SARKI] Ses widget 0, cevap fazında da sessiz");
                            } else {
                                // ✨ Widget sesinin YARISI (mırıldanma seviyesi)
                                const targetVol = baseVol * 0.5;
                                
                                sarkiAudio.volume = targetVol;
                                
                                // Paused ise (şarkı bitti veya kesildi) baştan başlat
                                if (sarkiAudio.paused || sarkiAudio.ended) {
                                    sarkiAudio.currentTime = 0;
                                    const p = sarkiAudio.play();
                                    if (p) p.catch(() => {});
                                    console.log(`[SARKI] Cevap fazı: şarkı bitmişti, baştan başlıyor, ses %${(targetVol*100).toFixed(1)}`);
                                } else {
                                    console.log(`[SARKI] Cevap fazı: şarkı devam ediyor (${sarkiAudio.currentTime.toFixed(1)}sn), ses %${(targetVol*100).toFixed(1)}`);
                                }
                            }
                        } catch(e) {}
                    }
                }
            }, songDuration * 1000);
        }, AUDIO_START_DELAY);
    }

    function stopSarkiAudio() {
        // ✨ Stop timer varsa iptal et
        if (sarkiAudioStopTimer) {
            clearTimeout(sarkiAudioStopTimer);
            sarkiAudioStopTimer = null;
        }
        // ✨ HTML'deki audio element'ini de garantile
        const audioEl = document.getElementById("sarkiAudio");
        if (audioEl) {
            try {
                audioEl.pause();
                audioEl.currentTime = 0;
                audioEl.src = "";  // Kaynağı da sil - iki kere çalmasını önler
            } catch(e) {}
        }
        if (sarkiAudio && sarkiAudio !== audioEl) {
            try {
                sarkiAudio.pause();
                sarkiAudio.currentTime = 0;
                sarkiAudio.src = "";
            } catch(e) {}
        }
        sarkiAudio = null;
    }

    function startSarkiTimer(totalSeconds) {
        stopSarkiTimer();
        sarkiTimerRemaining = totalSeconds;
        updateSarkiTimerDisplay(sarkiTimerRemaining);

        sarkiTimerInterval = setInterval(() => {
            sarkiTimerRemaining--;
            updateSarkiTimerDisplay(sarkiTimerRemaining);
            if (sarkiTimerRemaining <= 0) {
                stopSarkiTimer();
            }
        }, 1000);
    }

    function updateSarkiTimerDisplay(remaining) {
        const t = $("sarkiTimer");
        if (!t) return;
        t.textContent = Math.max(0, remaining);
        if (remaining <= 3) t.classList.add("warning");
        else t.classList.remove("warning");

        // ✨ Kapak altındaki süre göstergesi
        const songDur = window._sarkiSongDuration || 10;
        const ansDur = window._sarkiAnswerDuration || 10;
        const total = songDur + ansDur;
        const elapsed = total - remaining;
        
        const bigTimer = $("sarkiBigTimer");
        if (bigTimer) {
            if (elapsed < songDur) {
                // Şarkı çalıyor: kalan şarkı süresi
                const songLeft = songDur - elapsed;
                bigTimer.textContent = songLeft;
                bigTimer.className = "sarkiBigTimer listening";
            } else {
                // Cevap fazı: kalan cevap süresi
                const ansLeft = Math.max(0, remaining);
                bigTimer.textContent = ansLeft;
                bigTimer.className = "sarkiBigTimer answering";
                if (ansLeft <= 3) bigTimer.classList.add("warning");
            }
        }

        const phaseText = $("sarkiSongStatus");
        if (phaseText) {
            if (elapsed < songDur) {
                phaseText.textContent = "🎧 Şarkıyı dinle...";
            } else if (!sarkiHasAnswered) {
                phaseText.textContent = "⏱️ Cevap ver!";
            }
        }
    }

    function stopSarkiTimer() {
        if (sarkiTimerInterval) {
            clearInterval(sarkiTimerInterval);
            sarkiTimerInterval = null;
        }
    }

    function sendAnswer(idx) {
        if (sarkiHasAnswered) return;
        if (sarkiCurrentPhase === "result") return;
        if (!sarkiIsMyTurn) return;

        sarkiHasAnswered = true;
        window._sarkiMyAnswerIndex = idx;

        document.querySelectorAll('.sarkiOptBtn').forEach((btn, i) => {
            btn.disabled = true;
            if (i === idx) btn.classList.add("selected");
        });

        $("sarkiStatusMsg").textContent = "✅ Cevabın gönderildi, sonuç bekleniyor...";

        // ✨ Şarkıyı DURDURMA! Sesi %0.5 seviyesine indir (widget 0 ise 0 kalır)
        if (sarkiAudio && !sarkiAudio.paused) {
            try {
                const baseVol = getGlobalVolume();
                if (baseVol <= 0.001) {
                    sarkiAudio.volume = 0;
                } else {
                    sarkiAudio.volume = baseVol * 0.5;
                    console.log(`[SARKI] Cevap verildi, ses %${(baseVol*50).toFixed(1)} (devam ediyor)`);
                }
            } catch(e) {}
        }

        send({
            type: "sarki_answer",
            answer_index: idx
        });
    }

    function onPlayerAnswered(msg) {
        $("sarkiStatusMsg").textContent = `✅ ${msg.player_name} cevabını verdi, sonuç açıklanıyor...`;
    }

    function onRoundResult(msg) {
        sarkiCurrentPhase = "result";
        stopSarkiTimer();
        
        // ✨ Şarkıyı DURDURMA! Kısık sesle çalmaya devam etsin (turn intro'ya kadar)
        // Sadece cevap süresi bittiği için sesi mırıldanma seviyesinde tut
        if (sarkiAudio && !sarkiAudio.paused) {
            try {
                const baseVol = getGlobalVolume();
                if (baseVol <= 0.001) {
                    sarkiAudio.volume = 0;
                } else {
                    sarkiAudio.volume = baseVol * 0.5;
                }
            } catch(e) {}
        }

        // ✨ Kapak netleşsin (bulanıklık kalksın - şarkı ne olduğu anlaşılsın)
        const cover = $("sarkiCoverImg");
        if (cover) cover.classList.add("reveal");

        // ✨ Şıkları renklendir - DOĞRU yeşil, YANLIŞ kırmızı
        const optBtns = document.querySelectorAll('.sarkiOptBtn');
        
        // Turn player'ın cevabını bul (herkes görsün doğruyu)
        const turnResult = msg.results.find(r => r.is_turn);
        const turnAnswerIdx = turnResult ? turnResult.answer_index : -1;
        
        optBtns.forEach((btn, i) => {
            btn.disabled = true;
            btn.classList.remove("selected");
            
            if (i === msg.correct_index) {
                btn.classList.add("correct");
            }
            
            if (turnAnswerIdx >= 0 && turnAnswerIdx !== msg.correct_index && i === turnAnswerIdx) {
                btn.classList.add("wrong");
            }
        });

        const optsBox = $("sarkiOptionsBox");
        if (optsBox) optsBox.classList.remove("locked");

        // Faz bilgisinde doğru cevabı göster (üstte)
        $("sarkiPhaseInfo").innerHTML = `<span style="color:#51cf66;">✅ Doğru cevap:</span> ${msg.correct_song.artist} - ${msg.correct_song.title}`;
        
        // Kapak altında turn player'ın sonucu (küçük)
        const turnStatusEl = $("sarkiSongStatus");
        if (turnStatusEl && turnResult) {
            const isMe = (turnResult.player_id === sarkiPlayerId);
            const nameText = turnResult.player_name + (isMe ? " (Sen)" : "");
            let statusText = "";
            let statusColor = "#adb5bd";
            
            if (turnResult.status === "correct_fast") { statusText = `🔥 ${nameText}: +${turnResult.points}`; statusColor = "#ffd43b"; }
            else if (turnResult.status === "correct") { statusText = `✅ ${nameText}: +${turnResult.points}`; statusColor = "#51cf66"; }
            else if (turnResult.status === "wrong") { statusText = `❌ ${nameText}: ${turnResult.points}`; statusColor = "#ff6b6b"; }
            else if (turnResult.status === "timeout") { statusText = `⏰ ${nameText}: ${turnResult.points}`; statusColor = "#ff6b6b"; }
            
            turnStatusEl.textContent = statusText;
            turnStatusEl.style.color = statusColor;
            turnStatusEl.style.fontWeight = "bold";
            turnStatusEl.style.fontSize = "18px";
        }

        updateScoreboard(msg.results);
        window._sarkiMyAnswerIndex = undefined;

        // ✨ Popup GÖSTERİLMİYOR - sadece skor tablosu güncelleniyor (sağ panel)
        // Kullanıcı 3-4 saniye şıkları görecek, sonra otomatik yeni tur
    }

    function showRoundResultPopup(msg) {
        $("sarkiCorrectCover").src = msg.correct_song.cover || "";
        $("sarkiCorrectTitle").textContent = msg.correct_song.title;
        $("sarkiCorrectArtist").textContent = msg.correct_song.artist;

        // ✨ Sıradaki oyuncunun sonucunu üstte göster (büyük)
        let turnResult = msg.results.find(r => r.is_turn);
        const turnResultBox = $("sarkiTurnResultBox");
        if (turnResultBox && turnResult) {
            const isMe = (turnResult.player_id === sarkiPlayerId);
            let statusIcon = "";
            let statusColor = "#adb5bd";
            let statusText = "";
            
            if (turnResult.status === "correct_fast") { 
                statusIcon = "🔥"; statusColor = "#ffd43b"; 
                statusText = `Çok hızlı! +${turnResult.points} puan`;
            }
            else if (turnResult.status === "correct") { 
                statusIcon = "✅"; statusColor = "#51cf66"; 
                statusText = `Doğru cevap! +${turnResult.points} puan`;
            }
            else if (turnResult.status === "wrong") { 
                statusIcon = "❌"; statusColor = "#ff6b6b"; 
                statusText = `Yanlış cevap! ${turnResult.points} puan`;
            }
            else if (turnResult.status === "timeout") { 
                statusIcon = "⏰"; statusColor = "#ff6b6b"; 
                statusText = `Süre doldu! ${turnResult.points} puan`;
            }
            
            turnResultBox.style.color = statusColor;
            turnResultBox.style.borderColor = statusColor;
            turnResultBox.innerHTML = `
                <div style="font-size:36px; margin-bottom:5px;">${statusIcon}</div>
                <div style="font-size:20px; font-weight:bold;">${turnResult.player_name}${isMe ? ' (Sen)' : ''}</div>
                <div style="font-size:16px; margin-top:5px;">${statusText}</div>
            `;
            turnResultBox.style.display = "block";
        } else if (turnResultBox) {
            turnResultBox.style.display = "none";
        }

        // Genel skor tablosu
        const list = $("sarkiRoundResultList");
        list.innerHTML = "";
        msg.results.forEach((r, idx) => {
            const li = document.createElement("li");
            li.className = "sarkiResultRow";
            const isMe = (r.player_id === sarkiPlayerId);
            const isTurn = r.is_turn;
            let medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
            let statusIcon = "";
            let pointsColor = "#adb5bd";
            if (r.status === "correct_fast") { statusIcon = "🔥"; pointsColor = "#ffd43b"; }
            else if (r.status === "correct") { statusIcon = "✅"; pointsColor = "#51cf66"; }
            else if (r.status === "wrong") { statusIcon = "❌"; pointsColor = "#ff6b6b"; }
            else if (r.status === "timeout") { statusIcon = "⏰"; pointsColor = "#ff6b6b"; }
            else if (r.status === "spectator") { statusIcon = "👁️"; pointsColor = "#868e96"; }
            
            const pointsText = r.points !== 0 ? ((r.points > 0 ? "+" : "") + r.points) : "-";
            const timeText = (isTurn && r.status !== "timeout" && r.status !== "spectator") ? ` (${r.answer_time}s)` : "";
            li.innerHTML = `
                <span class="resMedal">${medal}</span>
                <span class="resName ${isMe ? 'me' : ''}">${r.player_name}${isMe ? ' (Sen)' : ''}${isTurn ? ' 🎯' : ''}</span>
                <span class="resStatus">${statusIcon}${timeText}</span>
                <span class="resPoints" style="color:${pointsColor};">${pointsText}</span>
                <span class="resTotal">= ${r.total_score}</span>
            `;
            list.appendChild(li);
        });

        $("sarkiRoundResultBox").classList.remove("hidden");

        // Backend zaten 5 saniye bekleyip yeni tura geçecek
        // Popup 2 saniye görünsün (3 sn önceki inline sonuç + 2 sn popup = 5 sn)
        setTimeout(() => {
            $("sarkiRoundResultBox").classList.add("hidden");
        }, 2000);
    }

    function updateScoreboard(results) {
        const sortedResults = [...results].sort((a, b) => b.total_score - a.total_score);
        const list = $("sarkiScoreboardList");
        if (!list) return;
        list.innerHTML = "";
        sortedResults.forEach((r, idx) => {
            const li = document.createElement("li");
            const isMe = (r.player_id === sarkiPlayerId);
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
            li.className = "sarkiScoreRow" + (isMe ? " me" : "");
            
            // ✨ Negatif puan → kırmızı, pozitif → sarı, 0 → gri
            let scoreClass = "scoreTotal";
            if (r.total_score < 0) scoreClass += " negative";
            else if (r.total_score === 0) scoreClass += " zero";
            
            li.innerHTML = `
                <span class="scoreMedal">${medal}</span>
                <span class="scoreName">${r.player_name}${isMe ? ' (Sen)' : ''}</span>
                <span class="${scoreClass}">${r.total_score}</span>
            `;
            list.appendChild(li);
        });
    }

    function onGameOver(msg) {
        stopSarkiAudio();
        stopSarkiTimer();
        $("sarkiRoundResultBox").classList.add("hidden");

        const iWon = (msg.winner_id === sarkiPlayerId);
        const title = $("sarkiGameOverTitle");
        title.textContent = iWon ? "🏆 KAZANDIN!" : "😢 KAYBETTİN";
        title.className = iWon ? "win" : "lose";

        $("sarkiGameOverText").textContent = `Kazanan: ${msg.winner_name}`;

        const list = $("sarkiGameOverList");
        list.innerHTML = "";
        msg.scores.forEach((s, idx) => {
            const li = document.createElement("li");
            const isMe = (s.player_id === sarkiPlayerId);
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
            li.className = "sarkiFinalRow" + (isMe ? " me" : "");
            
            let scoreClass = "scoreTotal";
            if (s.score < 0) scoreClass += " negative";
            else if (s.score === 0) scoreClass += " zero";
            
            li.innerHTML = `
                <span class="scoreMedal">${medal}</span>
                <span class="scoreName">${s.player_name}${isMe ? ' (Sen)' : ''}</span>
                <span class="${scoreClass}">${s.score} puan</span>
            `;
            list.appendChild(li);
        });

        if (sarkiIsHost) {
            $("sarkiRematchBtn").classList.remove("hidden");
            $("sarkiBackToLobbyBtn").classList.remove("hidden");
        } else {
            $("sarkiRematchBtn").classList.add("hidden");
            $("sarkiBackToLobbyBtn").classList.add("hidden");
        }

        $("sarkiGameOverBox").classList.remove("hidden");
    }

    function onBackToLobby() {
        stopSarkiAudio();
        stopSarkiTimer();
        $("sarkiGameOverBox").classList.add("hidden");
        $("sarkiRoundResultBox").classList.add("hidden");
        showSarkiScreen("sarkiLobby");
    }

    // ==========================================
    // CHAT
    // ==========================================
    function setupSarkiChat() {
        const toggleBtn = $("sarkiChatToggleBtn");
        const closeBtn = $("sarkiChatCloseBtn");
        const sendBtn = $("sarkiChatSendBtn");
        const input = $("sarkiChatInput");
        const panel = $("sarkiChatPanel");

        if (toggleBtn) toggleBtn.addEventListener('click', () => {
            panel.style.display = panel.style.display === "flex" ? "none" : "flex";
            if (panel.style.display === "flex") {
                $("sarkiChatBadge").style.display = "none";
                $("sarkiChatBadge").textContent = "0";
            }
        });

        if (closeBtn) closeBtn.addEventListener('click', () => panel.style.display = "none");

        const sendMsg = () => {
            const text = input.value.trim();
            if (!text) return;
            send({ type: "sarki_chat_send", text: text });
            input.value = "";
        };

        if (sendBtn) sendBtn.addEventListener('click', sendMsg);
        if (input) input.addEventListener('keydown', (e) => {
            if (e.key === "Enter") sendMsg();
        });
    }

    function addChatMessage(msg) {
        const messages = $("sarkiChatMessages");
        if (!messages) return;
        const div = document.createElement("div");
        div.className = "miniChatMsg" + (msg.sender_id === sarkiPlayerId ? " me" : "");
        div.innerHTML = `<b>${escapeHTML(msg.sender_name)}:</b> ${escapeHTML(msg.text)}`;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;

        const panel = $("sarkiChatPanel");
        if (panel.style.display !== "flex" && msg.sender_id !== sarkiPlayerId) {
            const badge = $("sarkiChatBadge");
            const cur = parseInt(badge.textContent) || 0;
            badge.textContent = cur + 1;
            badge.style.display = "inline-block";
        }
    }

    function escapeHTML(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function showSarkiChat() {
        const c = $("sarkiChatContainer");
        if (c) c.style.display = "block";
    }

    function hideSarkiChat() {
        const c = $("sarkiChatContainer");
        if (c) c.style.display = "none";
        const p = $("sarkiChatPanel");
        if (p) p.style.display = "none";
    }

    // ==========================================
    // WEBSOCKET MESAJ İŞLEYİCİ WRAP
    // ==========================================
    // ✨ Host/rakip ayrıldı mesajlarında sarkı ekranlarını temizle
    function _cleanupSarkiScreens() {
        stopSarkiAudio();
        stopSarkiTimer();
        hideSarkiChat();
        Object.values(SARKI_SCREEN_IDS).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add("hidden");
        });
        const overlay = $("sarkiBigOverlay");
        if (overlay) overlay.classList.add("hidden");
        const gameOverBox = $("sarkiGameOverBox");
        if (gameOverBox) gameOverBox.classList.add("hidden");
        const roundResultBox = $("sarkiRoundResultBox");
        if (roundResultBox) roundResultBox.classList.add("hidden");
        sarkiRoomCode = null;
        sarkiPlayerId = null;
        sarkiIsHost = false;
    }
    
    const originalHandleMessage = window.handleMessage;
    window.handleMessage = function(msg) {
        // ✨ Host ayrıldı / oda kapandı → sarkı ekranlarını temizle (ana handler devralsın)
        if (msg.type === "host_left_room" || 
            msg.type === "opponent_left" || 
            msg.type === "you_were_kicked") {
            // Sadece sarkı modundaysak temizle
            const sarkiLobbyEl = document.getElementById("sarkiLobbyScreen");
            const sarkiGameEl = document.getElementById("sarkiGameScreen");
            const inSarki = (sarkiLobbyEl && !sarkiLobbyEl.classList.contains("hidden")) ||
                            (sarkiGameEl && !sarkiGameEl.classList.contains("hidden"));
            if (inSarki) {
                _cleanupSarkiScreens();
            }
        }
        
        if (msg.type === "sarki_room_created") {
            sarkiRoomCode = msg.room_code;
            sarkiPlayerId = msg.player_id;
            sarkiIsHost = (msg.player_id === 1);
            sarkiPoolReady = false;  // ✨ Yeni oda, havuz henüz hazır değil
            sarkiSettings = {
                max_players: msg.max_players,
                dil: msg.dil,
                total_songs: msg.total_songs,
                song_duration: msg.song_duration,
                answer_duration: msg.answer_duration
            };
            showSarkiScreen("sarkiLobby");
            showSarkiChat();
            return;
        }

        if (msg.type === "sarki_room_joined") {
            sarkiRoomCode = msg.room_code;
            sarkiPlayerId = msg.player_id;
            sarkiIsHost = (msg.player_id === 1);
            sarkiPoolReady = false;  // ✨ Havuz durumunu backend'den bekle
            sarkiSettings = {
                max_players: msg.max_players,
                dil: msg.dil,
                total_songs: msg.total_songs,
                song_duration: msg.song_duration,
                answer_duration: msg.answer_duration
            };
            showSarkiScreen("sarkiLobby");
            showSarkiChat();
            return;
        }

        if (msg.type === "sarki_lobby_update") {
            updateSarkiLobby(msg);
            return;
        }

        if (msg.type === "sarki_preparing") {
            $("sarkiLobbyMsg").textContent = msg.message || "🎵 Şarkılar hazırlanıyor...";
            $("sarkiLobbyMsg").style.color = "#ffd43b";
            return;
        }

        // ✨ Havuz status (arka planda hazırlanıyor)
        if (msg.type === "sarki_pool_status") {
            sarkiPoolReady = !!msg.ready;
            if (typeof msg.percent === "number") {
                sarkiPoolPercent = msg.percent;
            } else if (msg.ready) {
                sarkiPoolPercent = 100;
            }
            updateSarkiLobbyMessage();
            return;
        }

        if (msg.type === "sarki_turn_intro") { onTurnIntro(msg); return; }
        if (msg.type === "sarki_round_start") { onRoundStart(msg); return; }
        if (msg.type === "sarki_player_answered") { onPlayerAnswered(msg); return; }
        if (msg.type === "sarki_round_result") { onRoundResult(msg); return; }
        if (msg.type === "sarki_game_over") { onGameOver(msg); return; }
        if (msg.type === "sarki_back_to_lobby") { onBackToLobby(); return; }
        if (msg.type === "sarki_chat_msg") { addChatMessage(msg); return; }
        if (msg.type === "sarki_chat_history") {
            (msg.messages || []).forEach(m => addChatMessage(m));
            return;
        }
        
        // ✨ 3+ kişilik oyunda bir oyuncu ayrıldı → sıralamadan animasyonla sil
        if (msg.type === "sarki_player_left") {
            const list = $("sarkiScoreboardList");
            if (list) {
                const li = list.querySelector(`li[data-pid="${msg.player_id}"]`);
                if (li) {
                    li.style.transition = "all 0.5s ease-out";
                    li.style.transform = "translateX(200px)";
                    li.style.opacity = "0";
                    setTimeout(() => {
                        if (li.parentNode) li.parentNode.removeChild(li);
                    }, 500);
                }
            }
            // Toast bildirimi
            if (typeof showToast === "function") {
                showToast("👋 Oyuncu Ayrıldı", `${msg.name} oyundan ayrıldı`, null);
            }
            return;
        }
        
        // ✨ 2 kişilik oyunda rakip ayrıldı → SARKIDAN BUL LOBİSİNE dön
        if (msg.type === "opponent_left_to_lobby") {
            const sarkiGameEl = document.getElementById("sarkiGameScreen");
            const inSarki = sarkiGameEl && !sarkiGameEl.classList.contains("hidden");
            
            if (inSarki) {
                // Ses ve timer'ı durdur
                stopSarkiAudio();
                stopSarkiTimer();
                
                // Overlay'i gizle
                const overlay = $("sarkiBigOverlay");
                if (overlay) overlay.classList.add("hidden");
                
                // Sarkıdan Bul lobisine dön (Bil Bakalım'a değil!)
                showSarkiScreen("sarkiLobby");
                
                if (typeof showToast === "function") {
                    showToast("👋 Rakip Ayrıldı", msg.message || "Rakip oyundan ayrıldı, lobiye dönüldü.", null);
                }
                return;  // Ana handler devralmasın
            }
        }

        if (originalHandleMessage) {
            originalHandleMessage(msg);
        }
    };

    // ==========================================
    // showScreen WRAP - Sarkı ekranına geçince göster, çıkınca temizle
    // ==========================================
    const originalShowScreen = window.showScreen;
    window.showScreen = function(screenId) {
        const isSarkiScreen = (screenId === "sarkiLobby" || screenId === "sarkiGame" || screenId === "createSarki");
        
        if (isSarkiScreen) {
            // ✨ Sarkı ekranına geçiliyor → kendi mini showScreen'imizi kullan
            showSarkiScreen(screenId);
            // Chat'i lobide/oyunda göster
            if (screenId === "sarkiLobby" || screenId === "sarkiGame") {
                showSarkiChat();
            } else {
                hideSarkiChat();
            }
            return;  // originalShowScreen'e gitme
        }
        
        // ✨ Sarkı ekranından başka ekrana geçildi → sarkı ekranlarını GIZLE
        hideSarkiChat();
        stopSarkiAudio();
        stopSarkiTimer();
        
        Object.values(SARKI_SCREEN_IDS).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.add("hidden");
        });
        
        const overlay = $("sarkiBigOverlay");
        if (overlay) overlay.classList.add("hidden");
        
        const gameOverBox = $("sarkiGameOverBox");
        if (gameOverBox) gameOverBox.classList.add("hidden");
        const roundResultBox = $("sarkiRoundResultBox");
        if (roundResultBox) roundResultBox.classList.add("hidden");
        
        if (originalShowScreen) originalShowScreen(screenId);
    };

    console.log("[SARKI] Şarkıdan Bul modülü yüklendi ✅");
})();