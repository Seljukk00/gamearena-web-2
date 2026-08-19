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

        // ✨ CHAT SIFIRLA (mod değişimi sonrası temiz başla)
        const msgBox = document.getElementById("sarkiChatMessages");
        if (msgBox) msgBox.innerHTML = "";
        const badge = document.getElementById("sarkiChatBadge");
        if (badge) {
            badge.textContent = "0";
            badge.style.display = "none";
        }
        const stack = document.getElementById("sarkiChatPopupStack");
        if (stack) {
            stack.innerHTML = "";
            stack.style.display = "none";
        }
        const panel = document.getElementById("sarkiChatPanel");
        if (panel) panel.style.display = "none";
        _sarkiChatOpen = false;
        // Dış tık handler'ını da kaldır
        try {
            document.removeEventListener("mousedown", _sarkiChatOutsideClickHandler, true);
        } catch(e) {}

        console.log("[SARKI] State + Chat senkronize edildi: playerId=" + newPlayerId + ", isHost=" + sarkiIsHost);
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
    
    // ✨ MOD DEĞİŞTİRME - Şarkıdan Bul özel: host önce createSarki ekranını görsün
    window._sarkiPrepareModeChange = function() {
        // ✨ TÜM MODLAR için host tespiti (app.js'deki _isCurrentHost fonksiyonu)
        let isHost = false;
        if (typeof _isCurrentHost === "function") {
            isHost = _isCurrentHost();
        } else {
            // Fallback: global playerId (Bil Bakalım için)
            isHost = (typeof playerId !== "undefined" && playerId === 1);
        }
        
        if (!isHost) {
            console.log("[SARKI] Mod değişimi iptal: host değilsin");
            return false;
        }
        
        // ✨ Şu anki modu hatırla (geri basınca dönmek için)
        if (typeof getCurrentMode === "function") {
            window._originalModeBeforeSarki = getCurrentMode();
            console.log("[SARKI] Orijinal mod hatırlandı:", window._originalModeBeforeSarki);
        }
        
        // Host için: createSarki ekranını göster (henüz mod değiştirme yok)
        showSarkiScreen("createSarki");
        
        // ✨ MOD DEĞİŞİMİ: isim kutusunu gizle (host zaten odada)
        const nameInput = document.getElementById("createSarkiNameInput");
        if (nameInput) {
            const nameBox = nameInput.closest(".centerBox");
            if (nameBox) nameBox.style.display = "none";
        }
        
        // İsim inputunu yine de doldur (submit için)
        if (nameInput) {
            const savedName = localStorage.getItem("playerName") || "";
            if (savedName) nameInput.value = savedName;
        }
        
        // Kayıtlı ayarları yükle
        loadSarkiSavedSettings();
        
        // Tür dropdown'unu dil'e göre güncelle
        const dilSel = document.getElementById("sarkiDilSelect");
        if (dilSel) {
            dilSel.dispatchEvent(new Event("change"));
        }
        
        // ✨ Oyuncu sayısı kısıtlama (mod değişimi sırasında)
        setTimeout(() => {
            if (typeof window._getCurrentRoomPlayerCount === "function" && 
                typeof window._applyMinPlayerLimit === "function") {
                const currentCount = window._getCurrentRoomPlayerCount();
                if (currentCount > 2) {
                    window._applyMinPlayerLimit("sarkiMaxPlayersSelect", currentCount);
                }
            }
        }, 100);
        
        // ✨ Flag: "Bu sadece mod değişimi için, oda zaten var"
        window._sarkiModeChangePending = true;
        
        // ✨ createMiSarkiBtn'ın text'ini güncelle (host farkında olsun)
        const createBtn = document.getElementById("createSarkiBtn");
        if (createBtn) {
            createBtn.textContent = "✅ Modu Değiştir";
        }
        
        // ✨ Geri butonuna bas → mod değiştir popup açılsın
        const backBtn = document.getElementById("createSarkiBackBtn");
        if (backBtn) {
            backBtn.onclick = () => {
                window._sarkiModeChangePending = false;
                // Buton yazısını sıfırla
                if (createBtn) createBtn.textContent = "Oda Oluştur";
                
                // ✨ ÖNCE eski moddaki lobiye dön
                _sarkiReturnToOriginalLobby();
                
                // Sonra mod değiştir popup'ını aç
                setTimeout(() => {
                    if (window.openChangeModeModal) {
                        window.openChangeModeModal();
                    }
                }, 200);
            };
        }
        
        console.log("[SARKI] Mod değişimi hazırlığı: host createSarki ekranında, misafir eski lobide bekliyor");
        return true;
    };
    
    // Host geri basınca eski moda göre lobiye dönüş
    function _sarkiReturnToOriginalLobby() {
        // Şu anki mod ne ise ona göre lobiye dön
        // app.js'de getCurrentMode() var ama şu an sarkı ekranındayız
        // O yüzden mevcut oda modunu tespit et
        
        if (typeof showScreen !== "function") return;
        
        // Backend'e sormak yerine: mevcut oda modu neyse ona göre lobby
        // app.js global playerId var ve inRoom var, mod bilgisi lazım
        // En güvenlisi: rooms[room_code]["mode"] backend'de ama frontend'de
        // Alternatif: getCurrentMode() yerine tüm mod lobby'lerini dene
        
        // ✨ Frontend'de bilinen tüm mod lobby'lerini kontrol et
        // Hangi mod aktifse ona göre lobiye dön
        const modeLobbyMap = {
            "bil_bakalim": "lobby",
            "takim_bilmece": "takimLobby",
            "kim_milyoner": "mlLobby",
            "haritadan_bul": "haritaLobby",
            "gizemli_kariyer": "gizemLobby",
            "ilk_11_challenge": "ilk11Lobby",
            "stadyum_tanima": "stadLobby",
            
            "sarkidan_bul": "sarkiLobby",
            "mini_futbol": "miniLobby",
            "jokerli_satranc": "satrancLobby"
        };
        
        // Global window._originalModeBeforeSarki varsa onu kullan
        const origMode = window._originalModeBeforeSarki;
        if (origMode && modeLobbyMap[origMode]) {
            showScreen(modeLobbyMap[origMode]);
            return;
        }
        
        // Yoksa varsayılan: Bil Bakalım lobby (en yaygın)
        showScreen("lobby");
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
                // ✨ Normal giriş: mod değişim flag'ini KESİN sıfırla (bug fix)
                window._sarkiModeChangePending = false;
                
                // ✨ Buton yazısını normale döndür
                const createBtn = $("createSarkiBtn");
                if (createBtn) createBtn.textContent = "Oda Oluştur";
                
                // ✨ İsim kutusunu geri aç (mod değişiminden sonra)
                const nameInputR = $("createSarkiNameInput");
                if (nameInputR) {
                    const nameBox = nameInputR.closest(".centerBox");
                    if (nameBox) nameBox.style.display = "";
                }
                
                // ✨ Geri butonunu normal davranışa döndür (mod değişim handler'ını temizle)
                const backBtn = $("createSarkiBackBtn");
                if (backBtn) {
                    backBtn.onclick = () => {
                        if (typeof showScreen === "function") showScreen("modselect");
                    };
                }
                
                showSarkiScreen("createSarki");
                const nameInput = $("createSarkiNameInput");
                if (nameInput) {
                    const savedName = localStorage.getItem("playerName") || "";
                    if (savedName) nameInput.value = savedName;
                    setTimeout(() => nameInput.focus(), 100);
                }
                // ✨ Kaydedilmiş ayarları yükle
                loadSarkiSavedSettings();
                // ✨ Sonra tür dropdown'unu dil'e göre güncelle (geçersiz seçim varsa sıfırla)
                const dilSel = $("sarkiDilSelect");
                if (dilSel) {
                    dilSel.dispatchEvent(new Event("change"));
                }
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
            
            // ✨ Host hemen kendi lobisine geçsin (backend broadcast'i beklemeden)
            // Backend broadcast misafire gidince o da lobiye dönecek
            if (sarkiIsHost) {
                onBackToLobby();
            }
        });

        const backToMenuBtn = $("sarkiBackToMenuBtn");
        if (backToMenuBtn) backToMenuBtn.addEventListener('click', leaveSarkiRoom);

        setupSarkiChat();

        // ✨ Şarkı dili değişince tür dropdown'unu güncelle
        const dilSelect = $("sarkiDilSelect");
        const turSelect = $("sarkiTurSelect");
        if (dilSelect && turSelect) {
            const updateTurOptions = () => {
                const dil = dilSelect.value;
                const currentTur = turSelect.value;
                // Türkçe seçildiyse Electronic ve Klasikler'i gizle
                const hideForTurkish = ["electronic", "klasikler"];
                Array.from(turSelect.options).forEach(opt => {
                    if (dil === "tr" && hideForTurkish.includes(opt.value)) {
                        opt.style.display = "none";
                        opt.disabled = true;
                    } else {
                        opt.style.display = "";
                        opt.disabled = false;
                    }
                });
                // Eğer seçili tür artık geçersizse VEYA gizlendiyse "Tüm Türler"e çek
                const selectedOpt = turSelect.options[turSelect.selectedIndex];
                if (dil === "tr" && hideForTurkish.includes(currentTur)) {
                    turSelect.value = "";
                }
                // Ekstra güvenlik: eğer seçili option disabled ise sıfırla
                if (selectedOpt && selectedOpt.disabled) {
                    turSelect.value = "";
                }
            };
            dilSelect.addEventListener("change", updateTurOptions);
            // Sayfa açılışında da uygula
            updateTurOptions();
        }
    });

    // ==========================================
    // ODA OLUŞTUR
    // ==========================================
    function createSarkiRoom() {
        const name = $("createSarkiNameInput").value.trim();
        
        // ✨ MOD DEĞİŞİMİ ise isim zorunlu değil (host zaten odada)
        const isModeChange = window._sarkiModeChangePending === true;
        
        if (!isModeChange && !name) {
            $("createSarkiMsg").textContent = "❌ İsim gir!";
            return;
        }

        if (name) {
            sarkiMyName = name;
            localStorage.setItem("playerName", name);
        }

        const settings = {
            max_players: parseInt($("sarkiMaxPlayersSelect").value),
            dil: $("sarkiDilSelect").value,
            tur: $("sarkiTurSelect") ? $("sarkiTurSelect").value || null : null,
            total_songs: parseInt($("sarkiTotalSongsSelect").value),
            song_duration: parseInt($("sarkiSongDurationSelect").value),
            answer_duration: parseInt($("sarkiAnswerDurationSelect").value)
        };

        // ✨ Ayarları localStorage'a kaydet
        try {
            localStorage.setItem("sarkiCreateSettings", JSON.stringify(settings));
        } catch(e) {}
        
        // ✨ MOD DEĞİŞİMİ MODU: Zaten bir oda var, yeni oda kurmak yerine
        // mevcut odayı Şarkıdan Bul'a çevir
        if (window._sarkiModeChangePending) {
            console.log("[SARKI] Mod değişimi başlatılıyor, ayarlar:", settings);
            window._sarkiModeChangePending = false;
            
            // Buton yazısını sıfırla
            const createBtn = document.getElementById("createSarkiBtn");
            if (createBtn) createBtn.textContent = "Oda Oluştur";
            
            // ✨ İsim kutusunu geri aç (bir sonraki normal girişte açık olsun)
            const nameInputR = document.getElementById("createSarkiNameInput");
            if (nameInputR) {
                const nameBox = nameInputR.closest(".centerBox");
                if (nameBox) nameBox.style.display = "";
            }
            
            $("createSarkiMsg").textContent = "⏳ Mod değiştiriliyor...";
            
            // Backend'e mod değiştir + ayarları yolla
            send({
                type: "mod_change_room",
                new_mode: "sarkidan_bul",
                sarki_settings: settings  // ✨ Yeni: ayarları da gönder
            });
            return;
        }

        // NORMAL MOD: Yeni oda kur
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
			setSelect("sarkiTurSelect", s.tur || "");
            
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
                    minValue: (typeof window._getCurrentRoomPlayerCount === "function" && window._getCurrentRoomPlayerCount() > 2) ? window._getCurrentRoomPlayerCount() : null,
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
                        { value: 6, label: "6 Şarkı" },
                        { value: 10, label: "10 Şarkı" },
                        { value: 12, label: "12 Şarkı" },
                        { value: 15, label: "15 Şarkı" },
                        { value: 20, label: "20 Şarkı" },
                        { value: 25, label: "25 Şarkı" },
                        { value: 30, label: "30 Şarkı" }
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
                    id: "settingSarkiTur",
                    label: "🎸 Şarkı Türü",
                    current: sarkiSettings.tur || "",
                    options: [
                        { value: "", label: "🎭 Tüm Türler" },
                        { value: "pop", label: "🎤 Pop" },
                        { value: "rap", label: "🎧 Rap" },
                        { value: "rock", label: "🎸 Rock" },
                        { value: "arabesk", label: "🎻 Arabesk" },
                        { value: "electronic", label: "🎛️ Electronic" },
                        { value: "klasikler", label: "👑 Klasikler" }
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
				const newTur = values.settingSarkiTur || null;
                
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
                    tur: newTur,
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
    // ✨ Yumuşak yüzde animasyonu için
    let _sarkiDisplayPercent = 0;
    let _sarkiTargetPercent = 0;
    let _sarkiPercentAnimTimer = null;
    
    function _sarkiAnimatePercent() {
        // Hedef ile mevcut arasında yumuşak geçiş
        const diff = _sarkiTargetPercent - _sarkiDisplayPercent;
        
        if (Math.abs(diff) < 0.5) {
            _sarkiDisplayPercent = _sarkiTargetPercent;
            _sarkiPercentAnimTimer = null;
            // Son bir kere UI'yi güncelle
            _sarkiRenderPercent();
            return;
        }
        
        // Kalan mesafenin %15'ini kapat (yumuşak easing)
        _sarkiDisplayPercent += diff * 0.15;
        
        _sarkiRenderPercent();
        _sarkiPercentAnimTimer = requestAnimationFrame(_sarkiAnimatePercent);
    }
    
    function _sarkiRenderPercent() {
        const lobbyMsg = $("sarkiLobbyMsg");
        if (!lobbyMsg) return;
        
        const pct = Math.round(_sarkiDisplayPercent);
        const isBackgroundLoading = sarkiPoolReady && window._sarkiBackgroundLoading;
        
        if (!sarkiPoolReady) {
            // Henüz hazır değil
            lobbyMsg.innerHTML = `🎵 Şarkı havuzu hazırlanıyor... <span style="color:#fff; background:rgba(255,212,59,0.2); padding:2px 10px; border-radius:12px; font-family:monospace; font-weight:bold; margin-left:8px;">%${pct}</span>`;
        } else if (isBackgroundLoading) {
            // Hazır AMA arka planda daha çok yükleniyor
            // Bu durumda sadece küçük bir gösterge kalır, ana mesajı bozmayız
            // updateSarkiLobbyMessage bunu yönetir
        }
    }
    
    function updateSarkiLobbyMessage() {
        const lobbyMsg = $("sarkiLobbyMsg");
        const startBtn = $("sarkiStartBtn");
        const playerCount = document.querySelectorAll("#sarkiPlayersList li").length;
        
        // ✨ ARKA PLAN YÜKLEME KONTROLÜ
        const isBackgroundLoading = sarkiPoolReady && window._sarkiBackgroundLoading;
        
        // Havuz hazır değilse HERKESTE aynı mesaj (yüzde ile animasyonlu)
        if (!sarkiPoolReady) {
            if (lobbyMsg) {
                // Hedef yüzdeyi güncelle
                _sarkiTargetPercent = Math.max(0, Math.min(100, sarkiPoolPercent || 0));
                
                // Animasyon çalışmıyorsa başlat
                if (!_sarkiPercentAnimTimer) {
                    _sarkiPercentAnimTimer = requestAnimationFrame(_sarkiAnimatePercent);
                }
                
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
        
        // ✨ Havuz hazır ama arka planda YÜKLEME devam ediyor
        if (isBackgroundLoading) {
            _sarkiTargetPercent = Math.max(_sarkiDisplayPercent, sarkiPoolPercent || 30);
            if (!_sarkiPercentAnimTimer) {
                _sarkiPercentAnimTimer = requestAnimationFrame(_sarkiAnimatePercent);
            }
        } else {
            // ✨ Havuz TAMAMEN hazır → %100'e çık ve animasyonu durdur
            _sarkiTargetPercent = 100;
            _sarkiDisplayPercent = 100;
            if (_sarkiPercentAnimTimer) {
                cancelAnimationFrame(_sarkiPercentAnimTimer);
                _sarkiPercentAnimTimer = null;
            }
        }
        
        // Havuz HAZIR (arka plan yükleme mesajı kaldırıldı)
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
            // Misafir için
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
		sarkiSettings.tur = msg.tur || null;

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
            // Önceki skorları sıfırla (animasyon bug'ı için)
            window._sarkiPrevScores = {};
            msg.players_info.forEach(p => {
                window._sarkiPrevScores[p.id] = 0;
            });
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
        const turMap2 = {
            "pop": "🎤 Pop", "rap": "🎧 Rap", "rock": "🎸 Rock",
            "arabesk": "🎻 Arabesk", "electronic": "🎛️ Electronic",
            "klasikler": "👑 Klasikler"
        };
        const turText2 = sarkiSettings.tur ? ` &nbsp;•&nbsp; <span style="color:#c084fc;">${turMap2[sarkiSettings.tur] || sarkiSettings.tur}</span>` : "";
        $("sarkiRoundInfo").innerHTML = `🎵 Şarkı ${msg.round_no}/${msg.total_rounds}${turText2}`;
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

        const turMap = {
            "pop": "🎤 Pop", "rap": "🎧 Rap", "rock": "🎸 Rock",
            "arabesk": "🎻 Arabesk", "electronic": "🎛️ Electronic",
            "klasikler": "👑 Klasikler", "karisik": "🎭 Karışık"
        };
        // ✨ Öncelik: bu turun şarkısının türü, yoksa oda ayarındaki tür
        const activeTur = msg.song_tur || sarkiSettings.tur;
        const turText = activeTur ? ` &nbsp;•&nbsp; <span style="color:#c084fc;">${turMap[activeTur] || activeTur}</span>` : "";
        $("sarkiRoundInfo").innerHTML = `🎵 Şarkı ${msg.round_no}/${msg.total_rounds}${turText}`;
        
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
            void progressFill.offsetWidth;
            progressFill.style.transition = `width ${msg.song_duration}s linear`;
            progressFill.style.width = "0%";
        }

        const totalTime = msg.song_duration + msg.answer_duration;
        
        // ✨ ÖNCE TIMER'I BAŞLAT (ses yüklenmesi timer'ı geciktirmesin)
        // Ses'ten önce başlat çünkü audio.play() 100-500ms sürebilir
        if (msg.server_start_ts) {
            // Server timestamp'e göre gerçek kalan süreyi hesapla
            const now = Date.now() / 1000;
            const elapsed = now - msg.server_start_ts;
            const remainingTime = Math.max(1, totalTime - elapsed);
            
            if (elapsed > 0.3) {
                console.log(`[SARKI SYNC] Ağ gecikmesi: ${(elapsed * 1000).toFixed(0)}ms, kalan: ${remainingTime.toFixed(1)}s`);
            }
            
            // ✨ Precision için ondalık saniye kullan (Math.ceil yerine round)
            startSarkiTimer(Math.round(remainingTime));
        } else {
            startSarkiTimer(totalTime);
        }
        
        // ✨ Timer başladıktan SONRA sesi çal (asenkron - block etmez)
        playSarkiAudio(msg.preview_url, msg.song_duration);

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
        
        // ✨ URL kontrolü
        if (!previewUrl || typeof previewUrl !== "string" || previewUrl.trim() === "") {
            console.warn("[SARKI] Preview URL boş/null:", previewUrl);
            $("sarkiStatusMsg").textContent = "⚠️ Şarkı yüklenemedi (URL yok)";
            return;
        }
        
        console.log("[SARKI] Şarkı çalınıyor:", previewUrl.substring(0, 80) + "...");
        
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

            // ✨ Önce mevcut state'i tamamen temizle
            try {
                audioEl.pause();
                audioEl.removeAttribute("src");
                audioEl.load();  // Boş load, eski src cache'ini temizle
                audioEl.currentTime = 0;
            } catch(e) {}
            
            // ✨ Yeni src ata
            audioEl.src = previewUrl;
            audioEl.volume = getGlobalVolume();
            audioEl.loop = false;
            audioEl.crossOrigin = "anonymous";  // CORS için
            audioEl.load();

            sarkiAudio = audioEl;
            
            // ✨ Kısa gecikme ile play (load bitsin)
            setTimeout(() => {
                if (myPlayId !== window._sarkiPlayId) return;
                
                const playPromise = audioEl.play();
                if (playPromise) {
                    playPromise.catch(err => {
                        console.warn("[SARKI] Autoplay engellendi:", err.name, err.message);
                        // ✨ NotSupportedError ise src'yi tekrar dene
                        if (err.name === "NotSupportedError") {
                            console.log("[SARKI] Kaynak bulunamadı, 500ms sonra tekrar denenecek...");
                            setTimeout(() => {
                                if (myPlayId !== window._sarkiPlayId) return;
                                audioEl.src = previewUrl;
                                audioEl.load();
                                audioEl.play().catch(e2 => {
                                    console.error("[SARKI] Tekrar denemede de başarısız:", e2.message);
                                    $("sarkiStatusMsg").textContent = "⚠️ Şarkı yüklenemedi";
                                });
                            }, 500);
                        } else {
                            $("sarkiStatusMsg").textContent = "⚠️ Ses çalmıyor - Sayfayı tıklayın!";
                        }
                    });
                }
            }, 50);
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
                                    sarkiAudio.loop = true;
                                    sarkiAudio.currentTime = 0;
                                    const p = sarkiAudio.play();
                                    if (p) p.catch(() => {});
                                    console.log(`[SARKI] Cevap fazı: şarkı bitmişti, loop ile devam, ses %${(targetVol*100).toFixed(1)}`);
                                } else {
                                    sarkiAudio.loop = true;
                                    console.log(`[SARKI] Cevap fazı: şarkı devam ediyor, loop açıldı, ses %${(targetVol*100).toFixed(1)}`);
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
        // ✨ HTML'deki audio element'ini durdur (src'yi silme!)
        const audioEl = document.getElementById("sarkiAudio");
        if (audioEl) {
            try {
                audioEl.pause();
                audioEl.currentTime = 0;
                audioEl.loop = false;
                // ✨ src'yi silmiyoruz - sadece removeAttribute + load ile temizle
                audioEl.removeAttribute("src");
                audioEl.load();
            } catch(e) {}
        }
        if (sarkiAudio && sarkiAudio !== audioEl) {
            try {
                sarkiAudio.pause();
                sarkiAudio.currentTime = 0;
                sarkiAudio.loop = false;
                sarkiAudio.removeAttribute("src");
                sarkiAudio.load();
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
        t.classList.remove("warning", "caution");
        if (remaining <= 3) t.classList.add("warning");
        else if (remaining === 4) t.classList.add("caution");

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
                else if (ansLeft === 4) bigTimer.classList.add("caution");
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
        
        // Önceki skorları hatırla (animasyon için)
        if (!window._sarkiPrevScores) window._sarkiPrevScores = {};
        
        list.innerHTML = "";
        sortedResults.forEach((r, idx) => {
            const li = document.createElement("li");
            const isMe = (r.player_id === sarkiPlayerId);
            const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
            li.className = "sarkiScoreRow" + (isMe ? " me" : "");
            
            const prevScore = window._sarkiPrevScores[r.player_id];
            const diff = (typeof prevScore === "number") ? (r.total_score - prevScore) : 0;
            
            // Animasyon için: önce eski skoru göster
            let displayScore = (typeof prevScore === "number") ? prevScore : r.total_score;
            
            let scoreClass = "scoreTotal";
            if (displayScore < 0) scoreClass += " negative";
            else if (displayScore === 0) scoreClass += " zero";
            
            // Floating point (+10 / -3)
            let floatingHtml = "";
            if (diff !== 0) {
                const floatColor = diff > 0 ? "#51cf66" : "#ff6b6b";
                const floatText = (diff > 0 ? "+" : "") + diff;
                floatingHtml = `<span class="sarkiFloatPoint" style="color:${floatColor};">${floatText}</span>`;
            }
            
            li.innerHTML = `
                <span class="scoreMedal">${medal}</span>
                <span class="scoreName">${r.player_name}${isMe ? ' (Sen)' : ''}</span>
                <span class="sarkiScoreCell">
                    ${floatingHtml}
                    <span class="${scoreClass}" data-final="${r.total_score}">${displayScore}</span>
                </span>
            `;
            list.appendChild(li);
            
            // Animasyonlu skor artışı (500ms sonra başlar, 800ms sürer)
            if (diff !== 0) {
                setTimeout(() => {
                    const scoreEl = li.querySelector('.scoreTotal');
                    if (!scoreEl) return;
                    const startVal = prevScore;
                    const endVal = r.total_score;
                    const duration = 800;
                    const startTime = performance.now();
                    
                    function animate(now) {
                        const elapsed = now - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        const current = Math.round(startVal + (endVal - startVal) * progress);
                        scoreEl.textContent = current;
                        // Renk sınıfını dinamik güncelle
                        scoreEl.classList.remove("negative", "zero");
                        if (current < 0) scoreEl.classList.add("negative");
                        else if (current === 0) scoreEl.classList.add("zero");
                        
                        if (progress < 1) requestAnimationFrame(animate);
                    }
                    requestAnimationFrame(animate);
                }, 500);
            }
            
            // Kalıcı olarak güncel skoru kaydet
            window._sarkiPrevScores[r.player_id] = r.total_score;
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
            
            const correctCount = s.correct_count || 0;
            const wrongCount = s.wrong_count || 0;
            
            li.innerHTML = `
                <span class="scoreMedal">${medal}</span>
                <span class="scoreName">
                    ${s.player_name}${isMe ? ' (Sen)' : ''}
                    <div style="font-size:12px; color:#adb5bd; margin-top:3px; font-weight:normal;">
                        <span style="color:#51cf66;">✅ ${correctCount} doğru</span>
                        &nbsp;•&nbsp;
                        <span style="color:#ff6b6b;">❌ ${wrongCount} yanlış</span>
                    </div>
                </span>
                <span class="${scoreClass}">${s.score} puan</span>
            `;
            list.appendChild(li);
        });

        // ✨ Rematch butonu artık gösterilmiyor (istek üzerine kaldırıldı)
        $("sarkiRematchBtn").classList.add("hidden");
        
        // Lobiye Dön sadece host'a
        if (sarkiIsHost) {
            $("sarkiBackToLobbyBtn").classList.remove("hidden");
        } else {
            $("sarkiBackToLobbyBtn").classList.add("hidden");
        }

        $("sarkiGameOverBox").classList.remove("hidden");
    }

    function onBackToLobby() {
        console.log("[SARKI] onBackToLobby çağrıldı - müzik durduruluyor");
        
        // ✨ Müziği KESİN durdur (birden fazla yerden)
        stopSarkiAudio();
        stopSarkiTimer();
        
        // ✨ Play ID'yi resetle - devam eden play() call'ları iptal olsun
        window._sarkiPlayId = (window._sarkiPlayId || 0) + 1;
        
        // ✨ HTML audio element'ini agresif durdur
        const audioEl = document.getElementById("sarkiAudio");
        if (audioEl) {
            try {
                audioEl.pause();
                audioEl.currentTime = 0;
                audioEl.loop = false;
                audioEl.volume = 0;
                audioEl.muted = true;
                audioEl.removeAttribute("src");
                audioEl.load();
                // Muted flag'ini kaldır (bir sonraki tur için)
                setTimeout(() => {
                    if (audioEl) audioEl.muted = false;
                }, 100);
            } catch(e) {
                console.warn("[SARKI] Audio durdurma hatası:", e);
            }
        }
        
        // ✨ Aktif stop timer varsa iptal
        if (sarkiAudioStopTimer) {
            clearTimeout(sarkiAudioStopTimer);
            sarkiAudioStopTimer = null;
        }
        
        // ✨ sarkiAudio referansını da temizle
        if (sarkiAudio) {
            try {
                sarkiAudio.pause();
                sarkiAudio.currentTime = 0;
                sarkiAudio.loop = false;
                sarkiAudio.muted = true;
                sarkiAudio.removeAttribute("src");
                sarkiAudio.load();
            } catch(e) {}
            sarkiAudio = null;
        }
        
        // ✨ Phase'i sıfırla ki başka bir yerden ses başlamasın
        sarkiCurrentPhase = "waiting";
        sarkiHasAnswered = false;
        
        // Popupları kapat
        $("sarkiGameOverBox").classList.add("hidden");
        $("sarkiRoundResultBox").classList.add("hidden");
        
        // Overlay'i de kapat (turn intro açık kalabilir)
        const overlay = $("sarkiBigOverlay");
        if (overlay) overlay.classList.add("hidden");
        
        // Skor animasyonu için önceki skorları sıfırla
        window._sarkiPrevScores = {};
        
        // Lobiye geç
        showSarkiScreen("sarkiLobby");
        
        console.log("[SARKI] Müzik durduruldu, lobiye geçildi ✓");
    }

    // ==========================================
    // CHAT
    // ==========================================
    let _sarkiChatOpen = false;

    function _openSarkiChatPanel() {
        const panel = $("sarkiChatPanel");
        const input = $("sarkiChatInput");
        if (!panel) return;
        panel.style.display = "flex";
        _sarkiChatOpen = true;
        // Badge sıfırla
        const badge = $("sarkiChatBadge");
        if (badge) {
            badge.style.display = "none";
            badge.textContent = "0";
        }
        // Baloncukları temizle
        const stack = $("sarkiChatPopupStack");
        if (stack) {
            stack.innerHTML = "";
            stack.style.display = "none";
        }
        // ✨ Input'a otomatik focus
        if (input) setTimeout(() => input.focus(), 50);
        // Dışarı tıklayınca kapansın
        setTimeout(() => {
            document.addEventListener("mousedown", _sarkiChatOutsideClickHandler, true);
        }, 100);
    }

    function _closeSarkiChatPanel() {
        const panel = $("sarkiChatPanel");
        if (panel) panel.style.display = "none";
        _sarkiChatOpen = false;
        document.removeEventListener("mousedown", _sarkiChatOutsideClickHandler, true);
        const input = $("sarkiChatInput");
        if (input && input.value) input.value = "";
    }

    function _sarkiChatOutsideClickHandler(e) {
        const container = $("sarkiChatContainer");
        if (!container) return;
        if (container.contains(e.target)) return;
        _closeSarkiChatPanel();
    }

    function setupSarkiChat() {
        const toggleBtn = $("sarkiChatToggleBtn");
        const closeBtn = $("sarkiChatCloseBtn");
        const sendBtn = $("sarkiChatSendBtn");
        const input = $("sarkiChatInput");

        if (toggleBtn) toggleBtn.addEventListener('click', () => {
            if (_sarkiChatOpen) _closeSarkiChatPanel();
            else _openSarkiChatPanel();
        });

        if (closeBtn) closeBtn.addEventListener('click', () => _closeSarkiChatPanel());

        const sendMsg = () => {
            const text = input.value.trim();
            if (!text) return;
            send({ type: "sarki_chat_send", text: text });
            input.value = "";
        };

        if (sendBtn) sendBtn.addEventListener('click', sendMsg);
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    sendMsg();
                    _closeSarkiChatPanel();  // ✨ Mesaj atınca oto kapat
                    return;
                }
                if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    _closeSarkiChatPanel();
                    return;
                }
                // Diğer tuşlar T tuşu handler'ına gitmesin
                e.stopPropagation();
            });
        }

        // ✨ T tuşu → chat aç
        document.addEventListener("keydown", (e) => {
            const k = e.key.toLowerCase();
            if (k !== "t") return;

            // Sadece sarkı ekranlarında
            const gameEl = document.getElementById("sarkiGameScreen");
            const lobbyEl = document.getElementById("sarkiLobbyScreen");
            const inSarki = (gameEl && !gameEl.classList.contains("hidden")) ||
                            (lobbyEl && !lobbyEl.classList.contains("hidden"));
            if (!inSarki) return;

            // Input/textarea odaktaysa yoksay
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;

            // Chat container görünmüyorsa yoksay
            const container = $("sarkiChatContainer");
            if (!container || container.style.display === "none") return;

            // Zaten açıksa yoksay
            if (_sarkiChatOpen) return;

            // Overlay/popup açıksa yoksay
            const anyOverlay = document.querySelector(".overlay:not(.hidden)");
            if (anyOverlay) return;

            e.preventDefault();
            e.stopPropagation();
            _openSarkiChatPanel();
        }, true);
    }

    function addChatMessage(msg) {
        const messages = $("sarkiChatMessages");
        if (!messages) return;
        const div = document.createElement("div");
        div.className = "miniChatMsg" + (msg.sender_id === sarkiPlayerId ? " me" : "");
        div.innerHTML = `<b>${escapeHTML(msg.sender_name)}:</b> ${escapeHTML(msg.text)}`;
        messages.appendChild(div);
        messages.scrollTop = messages.scrollHeight;

        // ✨ Rakip mesajıysa bildirim sesi çal
        if (msg.sender_id !== sarkiPlayerId && typeof _playChatNotifySound === "function") {
            _playChatNotifySound();
        }

        const panel = $("sarkiChatPanel");
        const isOpen = panel && (panel.style.display === "flex");
        
        if (!isOpen) {
            // Rakip mesajıysa badge sayacını arttır
            if (msg.sender_id !== sarkiPlayerId) {
                const badge = $("sarkiChatBadge");
                if (badge) {
                    const cur = parseInt(badge.textContent) || 0;
                    badge.textContent = cur + 1;
                    badge.style.display = "inline-block";
                }
            }
            // ✨ Popup baloncuk her mesaj için göster (kendi + rakip)
            _showSarkiChatPopup(msg);
        }
    }

    // ✨ Chat kapalıyken gelen mesaj için baloncuk popup
    function _showSarkiChatPopup(msg) {
        const stack = $("sarkiChatPopupStack");
        if (!stack) return;
        stack.style.display = "flex";

        const popup = document.createElement("div");
        popup.className = "miniChatPopup";
        // Host mu misafir mi ona göre renk
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

        // Max 5 baloncuk
        while (stack.children.length > 5) stack.removeChild(stack.firstChild);

        // 3 saniye sonra kaybol
        setTimeout(() => {
            popup.classList.add("leaving");
            setTimeout(() => {
                if (popup.parentNode) popup.parentNode.removeChild(popup);
                if (stack.children.length === 0) stack.style.display = "none";
            }, 350);
        }, 3000);
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
        // ✨ Chat state'i tamamen sıfırla
        _sarkiChatOpen = false;
        const msgBox = document.getElementById("sarkiChatMessages");
        if (msgBox) msgBox.innerHTML = "";
        const badge = document.getElementById("sarkiChatBadge");
        if (badge) {
            badge.textContent = "0";
            badge.style.display = "none";
        }
        const stack = document.getElementById("sarkiChatPopupStack");
        if (stack) {
            stack.innerHTML = "";
            stack.style.display = "none";
        }
        try {
            document.removeEventListener("mousedown", _sarkiChatOutsideClickHandler, true);
        } catch(e) {}
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
                tur: msg.tur || null,
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
                tur: msg.tur || null,
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

        // ✨ Havuz status (arka planda hazırlanıyor - sessizce)
        if (msg.type === "sarki_pool_status") {
            sarkiPoolReady = !!msg.ready;
            if (typeof msg.percent === "number") {
                sarkiPoolPercent = msg.percent;
            } else if (msg.ready) {
                sarkiPoolPercent = 100;
            }
            // Arka plan yükleme flag'ini sakla (dahili kullanım için)
            window._sarkiBackgroundLoading = !!msg.background_loading;
            window._sarkiPoolCount = msg.count || 0;
            
            // Lobi mesajını güncelle
            updateSarkiLobbyMessage();
            
            // ✨ Toast KALDIRILDI - kullanıcıya bildirme, arka planda sessizce hallet
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