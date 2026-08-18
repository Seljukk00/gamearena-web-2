// ==========================================
// ♟️ JOKERLİ SATRANÇ - Frontend
// ==========================================

let satrancData = {
    playerId: null,
    roomCode: "",
    inGame: false,
    timeMode: "blitz",
    jokerCount: 3,
    pickMode: "karisik",
    pickSeconds: 60,
    lockMode: "off",         // ✨ Joker kilidi: off / pieces / time
    lockPieces: 3,           // ✨ Kaç taş yendikten sonra
    lockMinutes: 2,          // ✨ Kaç dakika sonra
    lockStatus: null,        // ✨ Oyun içi: {locked, remaining_pieces, remaining_seconds, ...}
    lockCountdownInterval: null,  // ✨ Süre modu için canlı countdown
    players: [],
    myColor: null,       // "w" veya "b"
    whiteId: null,
    blackId: null,
    whiteName: "",
    blackName: "",
    legalMoves: [],
    selectedSquare: null,
    board: null,         // chessboard.js instance
    game: null,          // chess.js instance
    clocks: {},
    clockInterval: null,
    increment: 0,
    moveHistory: [],
    // ✨ Joker seçim state
    jokerPool: [],           // Tüm 26 joker
    myJokers: [],            // Seçili/dağıtılmış jokerlerim
    oppJokerCount: 0,        // Rakibin joker sayısı
    jokerSelectMode: "karisik",
    jokerSelectDeadline: 0,
    jokerSelectInterval: null,
    usedJokers: [],       // Benim kullanılmış joker id'lerim
    oppUsedJokers: [],    // Rakibin kullanılmış joker id'leri (üstü çizik)
    invisibleDetails: {}, // {square: kalan_half_move} - kendi görünmez taşlarım
    lastInvisibleSquares: [],  // Bir önceki turdaki görünmez kareler (kaybolan → reappear tespiti)
    shieldedDetails: {}, // {square: kalan_tur} - kalkanlı taşlar
    frozenDetails: {}, // {square: kalan_tur} - dondurulmuş taşlar
    lockedDetails: {}, // {square: kalan_tur} - kilitli taşlar
    slowedDetails: {}, // {square: kalan_tur} - yavaşlatılmış taşlar
    ajanDisguised: {}, // {square: "w"|"b"} - sadece görsel sahte renk
    mySansurLeft: 0,  // Kendi sansür kalan tur sayım
    oppSansurLeft: 0, // Rakibin sansür kalan tur sayısı
    ignoredSquares: [], // 🚫 Yok Say hayalet kareleri (kendi ve rakip)
};

let _satrancRoomHelper = null;

// ==========================================
// SES SİSTEMİ
// ==========================================
const SATRANC_SOUNDS = {
    carkifelek: "/satranc_sounds/carkifelek.wav",
    tas_hareket: "/satranc_sounds/tas_hareket.wav",
    tas_yeme: "/satranc_sounds/tas_yeme.wav",
    bomba: "/satranc_sounds/bomba.wav",
    oyun_baslangic: "/satranc_sounds/oyun_baslangic.wav",
    oyun_bitti: "/satranc_sounds/oyun_bitti.wav",
    isinlanma: "/satranc_sounds/isinlanma.wav",
    sah: "/satranc_sounds/sah.wav",
    joker_secildi: "/satranc_sounds/joker_secildi.mp3",
    joker_iptal: "/satranc_sounds/joker_iptal.mp3",
    joker_onay: "/satranc_sounds/joker_onay.mp3",
    kalkan_1: "/satranc_sounds/kalkan_1.mp3",
    kalkan_2: "/satranc_sounds/kalkan_2.mp3",
    kilit: "/satranc_sounds/kilit.mp3",
    geri_al: "/satranc_sounds/geri_al.mp3",
    zar: "/satranc_sounds/zar.mp3",
    kasa_acilma: "/satranc_sounds/kasa_acilma.wav",
    rulet: "/satranc_sounds/rulet.mp3",
};

// Ses cache (aynı ses üst üste çalabilsin)
const _satrancSoundCache = {};
Object.keys(SATRANC_SOUNDS).forEach(key => {
    _satrancSoundCache[key] = new Audio(SATRANC_SOUNDS[key]);
    _satrancSoundCache[key].preload = "auto";
});

function playSatrancSound(soundName) {
    try {
        const original = _satrancSoundCache[soundName];
        if (!original) {
            console.warn(`[SATRANC SES] ${soundName} bulunamadı`);
            return;
        }

        // Global ses seviyesini al (sağ alttaki hoparlör slider'ı)
        const volume = (typeof window.getGlobalVolume === "function")
            ? window.getGlobalVolume()
            : 0.3;

        if (volume <= 0) return;  // Ses kapalıysa çalma

        // Clone kullan - aynı ses üst üste çalabilsin
        const sound = original.cloneNode();
        sound.volume = Math.min(1, Math.max(0, volume));
        sound.play().catch(err => {
            console.warn(`[SATRANC SES] ${soundName} oynatılamadı:`, err.message);
        });
    } catch (e) {
        console.warn("[SATRANC SES HATA]", e);
    }
}

// ==========================================
// YARDIMCI: Saniyeyi MM:SS'e çevir
// ==========================================
function formatClock(seconds) {
    if (seconds <= 0) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ==========================================
// JOKER SEÇİM EKRANI
// ==========================================

function renderJokerCard(joker, container, mode) {
    const card = document.createElement("div");
    card.className = "satrancJokerCard";
    card.dataset.jokerId = joker.id;
    card.dataset.category = joker.category;

    // ✨ Süresiz modda saat jokerleri devre dışı
    const isTimeMode = satrancData.jokerSelectTimeMode || satrancData.timeMode || "blitz";
    const isTimeless = isTimeMode === "suresiz";
    const isClockJoker = (joker.id === "zaman_cal" || joker.id === "zamani_durdur" || joker.id === "ekstra_sure");
    const isDisabled = isTimeless && isClockJoker;

    let disabledBadge = "";
    if (isDisabled) {
        card.classList.add("satrancJokerDisabled");
        disabledBadge = `<div class="satrancJcDisabledBadge">🔒 Süresiz modda kapalı</div>`;
    }

    card.innerHTML = `
        ${disabledBadge}
        <div class="satrancJcIcon">${joker.icon}</div>
        <div class="satrancJcName">${joker.name}</div>
        <div class="satrancJcCategory">${joker.category}</div>
        <div class="satrancJcDesc">${joker.desc}</div>
    `;
    if (mode === "pool") {
        card.onclick = () => {
            if (isDisabled) {
                satrancInfo({
                    icon: "🔒",
                    title: "Bu Joker Kapalı",
                    message: "Süresiz modda saat ile ilgili jokerler kullanılamaz.",
                    type: "warning",
                    okText: "Anladım"
                });
                return;
            }

            const alreadySelected = card.classList.contains("selected");
            if (alreadySelected) return;

            // ✨ Slot dolu mu kontrol
            const currentSelected = document.querySelectorAll("#satrancJsSlots .satrancJsSlotFilled").length;
            const totalNeeded = satrancData.jokerCount || 3;
            if (currentSelected >= totalNeeded) {
                satrancInfo({
                    icon: "🎴",
                    title: "Slotlar Dolu!",
                    message: `Zaten ${totalNeeded} joker seçtin.`,
                    detail: "Yeni bir tane eklemek için önce mevcut jokerlerinden birini X ile kaldır.",
                    type: "warning",
                    okText: "Anladım"
                });
                return;
            }

            // ✨ Seçildi sesi
            playSatrancSound("joker_secildi");
            send({ type: "satranc_select_joker", joker_id: joker.id });
        };
    }
    container.appendChild(card);
    return card;
}

function renderJokerSlots(selected, totalNeeded) {
    const slotsEl = document.getElementById("satrancJsSlots");
    if (!slotsEl) return;
    slotsEl.innerHTML = "";

    // Dolu slotlar
    selected.forEach(joker => {
        const slot = document.createElement("div");
        slot.className = "satrancJsSlotFilled";
        slot.innerHTML = `
            <span class="satrancJsSlotIcon">${joker.icon}</span>
            <span class="satrancJsSlotName">${joker.name}</span>
            <button class="satrancJsSlotRemove" title="Kaldır">✕</button>
        `;
        slot.querySelector(".satrancJsSlotRemove").onclick = () => {
            // ✨ İptal sesi
            playSatrancSound("joker_iptal");
            send({ type: "satranc_remove_joker", joker_id: joker.id });
        };
        slotsEl.appendChild(slot);
    });

    // Boş slotlar
    const empty = totalNeeded - selected.length;
    for (let i = 0; i < empty; i++) {
        const slot = document.createElement("div");
        slot.className = "satrancJsSlotEmpty";
        slot.textContent = `Boş Slot #${selected.length + i + 1}`;
        slotsEl.appendChild(slot);
    }

    // Havuzda seçili olanları işaretle
    const poolCards = document.querySelectorAll("#satrancJsPool .satrancJokerCard");
    const selectedIds = new Set(selected.map(j => j.id));
    poolCards.forEach(card => {
        if (selectedIds.has(card.dataset.jokerId)) {
            card.classList.add("selected");
        } else {
            card.classList.remove("selected");
        }
    });

    // Tamamla butonu aktifleştir
    const confirmBtn = document.getElementById("satrancJsConfirmBtn");
    if (confirmBtn) {
        // İster eksik ister tam, her zaman tıklanabilir (eksikleri otomatik doldurur)
        confirmBtn.disabled = false;
        if (selected.length >= totalNeeded) {
            confirmBtn.textContent = "✅ TAMAMLA VE BAŞLA";
        } else {
            confirmBtn.textContent = `⚡ ATLA (Eksikler Random) - ${selected.length}/${totalNeeded}`;
        }
    }
}

function startJokerSelectTimer(seconds) {
    stopJokerSelectTimer();
    const timerEl = document.getElementById("satrancJsTimer");
    if (!timerEl) return;

    // Sınırsız (0)
    if (seconds <= 0) {
        timerEl.textContent = "♾️";
        timerEl.classList.remove("warning", "danger");
        return;
    }

    let remaining = seconds;
    function updateDisplay() {
        timerEl.textContent = remaining;
        timerEl.classList.remove("warning", "danger");
        if (remaining <= 10) timerEl.classList.add("danger");
        else if (remaining <= 20) timerEl.classList.add("warning");
    }
    updateDisplay();

    satrancData.jokerSelectInterval = setInterval(() => {
        remaining--;
        updateDisplay();
        if (remaining <= 0) {
            stopJokerSelectTimer();
        }
    }, 1000);
}

function stopJokerSelectTimer() {
    if (satrancData.jokerSelectInterval) {
        clearInterval(satrancData.jokerSelectInterval);
        satrancData.jokerSelectInterval = null;
    }
}

function openJokerSelectScreen(msg) {
    satrancData.jokerPool = msg.all_jokers || [];
    satrancData.jokerSelectMode = msg.pick_mode;
    satrancData.jokerSelectDeadline = Date.now() + (msg.pick_seconds * 1000);
    satrancData.jokerSelectTimeMode = msg.time_mode || satrancData.timeMode || "blitz";

    showScreen("satrancJokerSelect");

    // Bilgi barı
    const modeEl = document.getElementById("satrancJsMode");
    const countEl = document.getElementById("satrancJsCount");
    if (modeEl) modeEl.textContent = msg.pick_mode === "karisik" ? "🎲 Karışık" : "📋 Manuel";
    if (countEl) countEl.textContent = msg.joker_count;

    // Sınırsız süre için timer'ı sakla
    const timerParent = document.getElementById("satrancJsTimer");
    if (timerParent && msg.pick_seconds <= 0) {
        timerParent.textContent = "♾️";
    }

    const randomBox = document.getElementById("satrancJsRandomBox");
    const manualBox = document.getElementById("satrancJsManualBox");

    if (msg.pick_mode === "karisik") {
        // Karışık: hazır jokerleri göster
        if (randomBox) randomBox.classList.remove("hidden");
        if (manualBox) manualBox.classList.add("hidden");

        const cardsEl = document.getElementById("satrancJsRandomCards");
        if (cardsEl) {
            cardsEl.innerHTML = "";
            (msg.my_jokers || []).forEach(j => renderJokerCard(j, cardsEl, "display"));
        }

        // 3-2-1 sayaç
        const cdEl = document.getElementById("satrancJsCountdown");
        let cd = 3;
        if (cdEl) cdEl.textContent = cd;
        const cdInt = setInterval(() => {
            cd--;
            if (cdEl) cdEl.textContent = cd;
            if (cd <= 0) clearInterval(cdInt);
        }, 1000);

        stopJokerSelectTimer(); // Karışıkta timer yok

    } else {
        // Manuel: havuzu göster
        if (randomBox) randomBox.classList.add("hidden");
        if (manualBox) manualBox.classList.remove("hidden");

        const poolEl = document.getElementById("satrancJsPool");
        if (poolEl) {
            poolEl.innerHTML = "";
            satrancData.jokerPool.forEach(j => renderJokerCard(j, poolEl, "pool"));
        }

        // Boş slotları başlangıçta göster
        renderJokerSlots([], msg.joker_count);

        // Rakip status
        const oppEl = document.getElementById("satrancJsOppProgress");
        if (oppEl) oppEl.textContent = `0/${msg.joker_count}`;

        // Timer başlat
        startJokerSelectTimer(msg.pick_seconds);
    }
}

// ==========================================
// OYUN İÇİ JOKER PANELLERİ
// ==========================================

function isMyTurn() {
    if (!satrancData.game || !satrancData.myColor) return false;
    return satrancData.game.turn() === satrancData.myColor;
}

// ✨ Joker kilidi countdown başlat (süre modu için)
function _startLockCountdown() {
    _stopLockCountdown();
    satrancData.lockCountdownInterval = setInterval(() => {
        if (satrancData.jokersUnlocked || satrancData.lockMode !== "time") {
            _stopLockCountdown();
            return;
        }
        const elapsed = (Date.now() - satrancData.gameStartTs) / 1000;
        const totalSec = satrancData.lockMinutes * 60;
        const remaining = Math.max(0, totalSec - elapsed);
        
        if (remaining <= 0) {
            satrancData.jokersUnlocked = true;
            _stopLockCountdown();
            showToast("🔓 Jokerler Açıldı!", "Artık jokerlerini kullanabilirsin!", null, "success");
        }
        
        // Panel başlıklarını güncelle
        renderMyJokers();
        renderOppJokers();
    }, 1000);
}

function _stopLockCountdown() {
    if (satrancData.lockCountdownInterval) {
        clearInterval(satrancData.lockCountdownInterval);
        satrancData.lockCountdownInterval = null;
    }
}

// ✨ Kilit durumu HTML'ini oluştur (panel başlığı için)
function _getLockBadgeHtml() {
    if (satrancData.jokersUnlocked || satrancData.lockMode === "off") {
        return "";
    }
    
    if (satrancData.lockMode === "pieces") {
        const status = satrancData.lockStatus;
        const remaining = status ? status.remaining_pieces : satrancData.lockPieces;
        return `<div style='color:#ffa94d; font-size:11px; font-weight:normal; margin-top:4px; padding:4px 8px; background:rgba(255,169,77,0.15); border-radius:6px; border:1px solid #ffa94d;'>🔒 Kalan Taş: <b>${remaining}</b></div>`;
    }
    
    if (satrancData.lockMode === "time") {
        const elapsed = (Date.now() - satrancData.gameStartTs) / 1000;
        const totalSec = satrancData.lockMinutes * 60;
        const remaining = Math.max(0, totalSec - elapsed);
        const timeStr = _formatLockTime(remaining);
        return `<div style='color:#ffa94d; font-size:11px; font-weight:normal; margin-top:4px; padding:4px 8px; background:rgba(255,169,77,0.15); border-radius:6px; border:1px solid #ffa94d;'>🔒 ${timeStr} sonra açılacak</div>`;
    }
    
    return "";
}

// ✨ Süreyi güzel formatla (49 saniye, 2 dakika 15 saniye, vb.)
function _formatLockTime(totalSeconds) {
    const total = Math.max(0, Math.ceil(totalSeconds));
    if (total < 60) {
        return `${total} saniye`;
    }
    const mm = Math.floor(total / 60);
    const ss = total % 60;
    if (ss === 0) {
        return `${mm} dakika`;
    }
    return `${mm} dk ${ss} sn`;
}

function renderMyJokers() {
    const container = document.getElementById("satrancMyJokers");
    if (!container) return;
    container.innerHTML = "";

    if (!satrancData.myJokers || satrancData.myJokers.length === 0) {
        container.innerHTML = '<p style="color:#6c757d; text-align:center; font-size:12px;">Joker yok</p>';
        return;
    }

    const usedIds = new Set(satrancData.usedJokers || []);
    const myTurn = isMyTurn();
    const sansurLeft = satrancData.mySansurLeft || 0;
    const iAmSansurlu = sansurLeft > 0;

    // Panel başlığına sıra + sansür bilgisi ekle
    const panelHeader = document.querySelector("#satrancMyJokerPanel h3");
    if (panelHeader) {
        let baseTitle = "🃏 Jokerlerim";
        if (iAmSansurlu) {
            baseTitle += ` <span style='color:#ff6b6b; font-size:12px;'>(SANSÜRLÜ)</span>`;
        } else if (myTurn) {
            baseTitle += ` <span style='color:#51cf66; font-size:12px;'>(AKTİF)</span>`;
        } else {
            baseTitle += ` <span style='color:#ff6b6b; font-size:12px;'>(SIRA RAKİPTE)</span>`;
        }
        // Sansür kalan tur bilgisi
        if (iAmSansurlu) {
            baseTitle += `<div style='color:#ffa94d; font-size:11px; font-weight:normal; margin-top:4px; padding:4px 8px; background:rgba(255,107,107,0.15); border-radius:6px; border:1px solid #ff6b6b;'>⛔ Sansür bitmesine: <b>${sansurLeft} tur</b></div>`;
        }
        // ✨ Joker kilidi badge
        baseTitle += _getLockBadgeHtml();
        panelHeader.innerHTML = baseTitle;
    }

    // ✨ Rakip panel başlığına rakip sansür bilgisi
    const oppPanelHeader = document.querySelector("#satrancOppJokerPanel h3");
    if (oppPanelHeader) {
        const oppSansur = satrancData.oppSansurLeft || 0;
        let oppBaseTitle = "🃏 Rakip Jokerleri";
        if (oppSansur > 0) {
            oppBaseTitle += `<div style='color:#51cf66; font-size:11px; font-weight:normal; margin-top:4px; padding:4px 8px; background:rgba(81,207,102,0.15); border-radius:6px; border:1px solid #51cf66;'>⛔ Rakip sansürlü: <b>${oppSansur} tur</b></div>`;
        }
        // ✨ Joker kilidi badge (rakip için de göster)
        oppBaseTitle += _getLockBadgeHtml();
        oppPanelHeader.innerHTML = oppBaseTitle;
    }

    satrancData.myJokers.forEach(joker => {
        const card = document.createElement("div");
        card.className = "satrancJokerCard satrancJokerGameCard";
        card.dataset.jokerId = joker.id;
        card.dataset.category = joker.category;

        const isUsed = usedIds.has(joker.id);
        if (isUsed) card.classList.add("used");

        // ✨ Sansürlü isek tüm kartlar kilitli
        if (!isUsed && iAmSansurlu) {
            card.classList.add("sansurluCard");
            card.title = `⛔ Sansürlüsün! ${sansurLeft} tur daha joker kullanamazsın.`;
        }
        // ✨ Sıra bende değilse joker soluk
        else if (!isUsed && !myTurn) {
            card.classList.add("not-my-turn");
            card.title = "⏳ Sıra rakipte, jokerlerini kullanamazsın";
        } else if (isUsed) {
            card.title = "✓ Bu jokeri zaten kullandın";
        } else {
            card.title = joker.desc;
        }

        // ✨ Görünmez aktif ise kart üzerinde göster
        let extraInfo = "";
        let cardTopBadge = "";
        let cardChargeBar = "";
        if (joker.id === "gorunmez" && isUsed) {
            const invDetails = satrancData.invisibleDetails || {};
            const activeSquares = Object.keys(invDetails);
            if (activeSquares.length > 0) {
                const turnsLeft = invDetails[activeSquares[0]] || 0;
                if (turnsLeft > 0) {
                    cardTopBadge = `<div class="satrancJcTopBadge">🧙 Kalan Tur: ${turnsLeft}</div>`;
                    card.classList.add("gorunmezActive");
                }
            }
        }

        if (joker.id === "kalkan" && isUsed) {
            const shDetails = satrancData.shieldedDetails || {};
            const activeSquares = Object.keys(shDetails);
            if (activeSquares.length > 0) {
                const turnsLeft = shDetails[activeSquares[0]] || 0;
                if (turnsLeft > 0) {
                    cardTopBadge = `<div class="satrancJcTopBadge kalkanBadge">🛡️ Kalan Tur: ${turnsLeft}</div>`;
                    card.classList.add("kalkanActive");
                }
            }
        }

        if (joker.id === "dondur" && isUsed) {
            const frDetails = satrancData.frozenDetails || {};
            const activeSquares = Object.keys(frDetails);
            if (activeSquares.length > 0) {
                const turnsLeft = frDetails[activeSquares[0]] || 0;
                if (turnsLeft > 0) {
                    cardTopBadge = `<div class="satrancJcTopBadge dondurBadge">❄️ Kalan Tur: ${turnsLeft}</div>`;
                    card.classList.add("dondurActive");
                }
            }
        }

        if (joker.id === "ajan" && isUsed) {
            const ajanDetails = satrancData.ajanDisguised || {};
            const activeSquares = Object.keys(ajanDetails);
            if (activeSquares.length > 0) {
                const data = ajanDetails[activeSquares[0]];
                const turnsLeft = (typeof data === "object") ? data.turns : 0;
                if (turnsLeft > 0) {
                    cardTopBadge = `<div class="satrancJcTopBadge ajanBadge">🕵️ Kalan Tur: ${turnsLeft}</div>`;
                    card.classList.add("ajanActive");
                }
            }
        }

        if (joker.id === "kilitle" && isUsed) {
            const lockedDetails = satrancData.lockedDetails || {};
            const activeSquares = Object.keys(lockedDetails);
            if (activeSquares.length > 0) {
                // En yüksek kalan turu göster (birden fazla kilitli taş olabilir)
                let maxTurns = 0;
                activeSquares.forEach(sq => {
                    const t = lockedDetails[sq] || 0;
                    if (t > maxTurns) maxTurns = t;
                });
                if (maxTurns > 0) {
                    cardTopBadge = `<div class="satrancJcTopBadge lockedBadge">⛓️ Kalan Tur: ${maxTurns}</div>`;
                    card.classList.add("lockedActive");
                }
            }
        }
        
        // ✨ YAVAŞLAT joker kartında kalan tur badge
        if (joker.id === "yavaslat" && isUsed) {
            const slowedDetails = satrancData.slowedDetails || {};
            const activeSquares = Object.keys(slowedDetails);
            if (activeSquares.length > 0) {
                let maxTurns = 0;
                activeSquares.forEach(sq => {
                    const t = slowedDetails[sq] || 0;
                    if (t > maxTurns) maxTurns = t;
                });
                if (maxTurns > 0) {
                    cardTopBadge = `<div class="satrancJcTopBadge slowedBadge">🐌 Kalan Tur: ${maxTurns}</div>`;
                    card.classList.add("slowedActive");
                }
            }
        }

        card.innerHTML = `
            ${cardTopBadge}
            ${cardChargeBar}
            <div class="satrancJcIcon">${joker.icon}</div>
            <div class="satrancJcName">${joker.name}</div>
        `;

        // ✨ Joker kilidi kontrolü
        const jokersLocked = !satrancData.jokersUnlocked && satrancData.lockMode !== "off";
        if (!isUsed && jokersLocked) {
            card.classList.add("sansurluCard");
            let lockMsg = "";
            if (satrancData.lockMode === "pieces") {
                const status = satrancData.lockStatus;
                const remaining = status ? status.remaining_pieces : satrancData.lockPieces;
                lockMsg = `🔒 Jokerler kilitli! ${remaining} taş daha yenmeli.`;
            } else if (satrancData.lockMode === "time") {
                const elapsed = (Date.now() - satrancData.gameStartTs) / 1000;
                const totalSec = satrancData.lockMinutes * 60;
                const remaining = Math.max(0, totalSec - elapsed);
                lockMsg = `🔒 Jokerler kilitli! ${_formatLockTime(remaining)} sonra açılacak.`;
            }
            card.title = lockMsg;
        }
        
        // ✨ Sadece kullanılmamış VE sıra bendeyken VE sansürsüzken VE kilit yokken tıklanabilir
        if (!isUsed && myTurn && !iAmSansurlu && !jokersLocked) {
            card.onclick = () => tryUseJoker(joker);
        } else if (!isUsed && jokersLocked) {
            card.onclick = () => {
                let lockMsg = "";
                if (satrancData.lockMode === "pieces") {
                    const status = satrancData.lockStatus;
                    const remaining = status ? status.remaining_pieces : satrancData.lockPieces;
                    lockMsg = `${remaining} taş daha yenmeli.`;
                } else if (satrancData.lockMode === "time") {
                    const elapsed = (Date.now() - satrancData.gameStartTs) / 1000;
                    const totalSec = satrancData.lockMinutes * 60;
                    const remaining = Math.max(0, totalSec - elapsed);
                    lockMsg = `${_formatLockTime(remaining)} sonra açılacak.`;
                }
                showToast("🔒 Jokerler Kilitli!", lockMsg, null, "warning");
            };
        } else if (!isUsed && iAmSansurlu) {
            card.onclick = () => {
                showToast("⛔ Sansürlüsün!", `${sansurLeft} tur daha joker kullanamazsın.`, null, "warning");
            };
        } else if (!isUsed && !myTurn) {
            card.onclick = () => {
                showToast("⏳ Sıra Sende Değil", "Rakip oynuyor, bekle.", null, "warning");
            };
        }
        container.appendChild(card);
    });
}

// ==========================================
// JOKER KULLANMA
// ==========================================

// Hedef gerektiren jokerler
const SINGLE_TARGET_JOKERS = ["vezire_yukselt", "kalkan", "dondur", "bomba", "gorunmez",
                              "kilitle", "ajan", "yoksay", "yavaslat"];
const DOUBLE_TARGET_JOKERS = ["isinlan", "klon", "rakip_tas_yerlestir", "yer_degistir", "rakibi_isinla"];
// Özel: Taş Dönüştür - kare seç + tür seç popup
const SPECIAL_TARGET_JOKERS = ["tas_donustur"];

// Aktif kare seçim modu
let satrancPendingJoker = null;   // { joker, phase: 1|2, target1: null }

function tryUseJoker(joker) {
    // Kullanılmış mı?
    const usedIds = new Set(satrancData.usedJokers || []);
    if (usedIds.has(joker.id)) {
        showToast("⚠️ Kullanıldı", "Bu jokeri zaten kullandın.", null, "warning");
        return;
    }

    // ✨ Yok Say jokeri şahtayken kullanılamaz
    if (joker.id === "yoksay" && satrancData.game && satrancData.game.in_check()) {
        showToast("🚫 Şahtasın!", "Şahtayken Taşı Yok Say jokerini kullanamazsın.", null, "warning");
        return;
    }

    // ✨ Joker seçildi sesi
    playSatrancSound("joker_secildi");

    // ✨ Joker açılırken önceki taş seçimini + highlight'ları temizle
    clearSquareSelection();

    // Özel: Taş Dönüştür
    if (SPECIAL_TARGET_JOKERS.includes(joker.id)) {
        startTasDonusturFlow(joker);
        return;
    }

    // Hedef gerektiriyor mu?
    if (SINGLE_TARGET_JOKERS.includes(joker.id) || DOUBLE_TARGET_JOKERS.includes(joker.id)) {
        startSquareSelectMode(joker);
        return;
    }

    // Hedefsiz - onay iste ve gönder
    satrancConfirm({
        icon: joker.icon,
        title: joker.name,
        subtitle: `Kategori: ${joker.category.toUpperCase()}`,
        message: joker.desc,
        type: "joker",
        yesText: "🃏 Kullan",
        noText: "İptal"
    }).then(ok => {
        if (ok) {
            playSatrancSound("joker_onay");
            send({ type: "satranc_use_joker", joker_id: joker.id });
        } else {
            playSatrancSound("joker_iptal");
        }
    });
}

// Taş Dönüştür özel akışı
function startTasDonusturFlow(joker) {
    satrancPendingJoker = {
        joker: joker,
        phase: 1,
        target1: null,
        _isTasDonustur: true
    };
    showJokerTargetBanner(`🃏 ${joker.name}`, "Dönüştürülecek taşı seç (kendi veya rakip, şah hariç)");

    // ✨ Hedeflenebilir kareleri highlight et (şah hariç herkes)
    highlightTargetableSquares("tas_donustur", 1);

    $("#satrancBoard .square-55d63").off("click.jokerTarget").on("click.jokerTarget", function() {
        const square = $(this).attr("data-square");
        if (!square) return;

        // ✨ Targetable değilse yoksay (şah tıklanamaz)
        if (!isSquareTargetable(square, "tas_donustur", 1, null)) return;

        // Kare seçildi, tür seçim popup göster
        satrancChoice({
            icon: "🃏",
            title: "Taş Dönüştür",
            message: `${square.toUpperCase()} karesindeki taşı neye dönüştürmek istiyorsun?`,
            choices: [
                { value: "q", icon: "♛", label: "Vezir" },
                { value: "r", icon: "♜", label: "Kale" },
                { value: "b", icon: "♝", label: "Fil" },
                { value: "n", icon: "♞", label: "At" },
                { value: "p", icon: "♟", label: "Piyon" }
            ]
        }).then(type => {
            if (!type) {
                cancelSquareSelectMode();
                return;
            }
            playSatrancSound("joker_onay");
            send({
                type: "satranc_use_joker_target",
                joker_id: joker.id,
                target1: square,
                piece_type: type
            });
            satrancPendingJoker = null;
            cancelSquareSelectMode();
        });
    });

    document.addEventListener("keydown", jokerCancelKeyHandler, true);
}

function startSquareSelectMode(joker) {
    satrancPendingJoker = {
        joker: joker,
        phase: 1,
        target1: null
    };

    const isDouble = DOUBLE_TARGET_JOKERS.includes(joker.id);
    const hint = _getJokerTargetHint(joker.id, 1);

    // Ekranın üstüne büyük banner
    showJokerTargetBanner(`${joker.icon} ${joker.name}`, hint);

    // ✨ Hedeflenebilir kareleri highlight et
    highlightTargetableSquares(joker.id, 1);

    // Tahtaya tıklama dinleyici ekle
    $("#satrancBoard .square-55d63").off("click.jokerTarget").on("click.jokerTarget", function(e) {
        const square = $(this).attr("data-square");
        if (!square) return;

        // ✨ Bu kare targetable değilse tıklamayı yoksay
        if (!isSquareTargetable(square, satrancPendingJoker.joker.id, satrancPendingJoker.phase, satrancPendingJoker.target1)) {
            return;
        }

        handleSquareSelectClick(square);
    });

    // ESC ile iptal (capture phase - app.js ESC popup'tan ÖNCE yakala)
    document.addEventListener("keydown", jokerCancelKeyHandler, true);
}

// ✨ Bir taşı kaldırırsak şahım tehdit altına girer mi?
// (Pinned piece kontrolü - Işınlanma / Yer Değiştir / Rakibi Işınla için)
function _wouldExposeMyKing(square) {
    if (!satrancData.game || !satrancData.myColor) return false;
    try {
        const tempFen = satrancData.game.fen();
        const tempGame = new Chess(tempFen);
        const piece = tempGame.get(square);
        if (!piece) return false;
        if (piece.type === "k") return false;  // Şahın kendisi
        // Taşı kaldır
        tempGame.remove(square);
        // Sıra bende olacak şekilde FEN'i ayarla (in_check aktif sıradakini kontrol eder)
        const parts = tempGame.fen().split(" ");
        parts[1] = satrancData.myColor;
        tempGame.load(parts.join(" "));
        return tempGame.in_check();
    } catch (e) {
        console.warn("[SATRANC] _wouldExposeMyKing hata:", e);
        return false;
    }
}

// ✨ Rakip taşı sanal yerleştirdiğimizde şahım tehdit altına girer mi?
// (Rakip Taş Yerleştir phase 2 için)
function _wouldPlacingEnemyExposeMyKing(fromSquare, toSquare) {
    if (!satrancData.game || !satrancData.myColor) return false;
    try {
        const tempFen = satrancData.game.fen();
        const tempGame = new Chess(tempFen);
        const enemyPiece = tempGame.get(fromSquare);
        if (!enemyPiece) return false;
        tempGame.remove(fromSquare);
        tempGame.put({type: enemyPiece.type, color: enemyPiece.color}, toSquare);
        const parts = tempGame.fen().split(" ");
        parts[1] = satrancData.myColor;
        tempGame.load(parts.join(" "));
        return tempGame.in_check();
    } catch (e) {
        console.warn("[SATRANC] _wouldPlacingEnemyExposeMyKing hata:", e);
        return false;
    }
}

// ✨ Rakip taşı sildiğimizde şahım tehdit altına girer mi?
// (Bomba için - rakip taş bombalanınca arkasındaki tehdit açığa çıkar mı?)
function _wouldRemovingEnemyExposeMyKing(square) {
    if (!satrancData.game || !satrancData.myColor) return false;
    try {
        const tempFen = satrancData.game.fen();
        const tempGame = new Chess(tempFen);
        const piece = tempGame.get(square);
        if (!piece) return false;
        if (piece.color === satrancData.myColor) return false;  // Sadece rakip taş için
        tempGame.remove(square);
        const parts = tempGame.fen().split(" ");
        parts[1] = satrancData.myColor;
        tempGame.load(parts.join(" "));
        return tempGame.in_check();
    } catch (e) {
        console.warn("[SATRANC] _wouldRemovingEnemyExposeMyKing hata:", e);
        return false;
    }
}

// ✨ Rakibi Işınla sonrası şahım tehdit altında kalır mı?
function _wouldRakibiIsinlaExposeMyKing(square1, square2) {
    if (!satrancData.game || !satrancData.myColor) return false;
    try {
        const tempFen = satrancData.game.fen();
        const tempGame = new Chess(tempFen);

        const piece1 = tempGame.get(square1);
        const piece2 = tempGame.get(square2);

        if (!piece1 || !piece2) return false;
        if (piece1.type === "k" || piece2.type === "k") return true;

        tempGame.remove(square1);
        tempGame.remove(square2);
        tempGame.put({ type: piece2.type, color: piece2.color }, square1);
        tempGame.put({ type: piece1.type, color: piece1.color }, square2);

        const parts = tempGame.fen().split(" ");
        parts[1] = satrancData.myColor;
        tempGame.load(parts.join(" "));

        return tempGame.in_check();
    } catch (e) {
        console.warn("[SATRANC] _wouldRakibiIsinlaExposeMyKing hata:", e);
        return false;
    }
}

// ✨ Belirli joker için tıklanabilir karelerin kontrolü
function isSquareTargetable(square, jokerId, phase, prevTarget) {
    if (!satrancData.game) return true;
    const piece = satrancData.game.get(square);
    const myColor = satrancData.myColor;

    // ✨ Efekt çakışma kontrolü — bir taşta zaten aktif efekt varsa yeni efekt eklenemez
    // TÜM efekt jokerleri + hareket jokerleri
    const efektJokerler = [
        "kalkan", "dondur", "kilitle", "gorunmez", "ajan", "klon", "yavaslat",
        "vezire_yukselt", "tas_donustur", "isinlan"
    ];
    // Bomba burada YOK - kalkanlı taşa bomba atılabilir (kalkan koruyor)
    if (efektJokerler.includes(jokerId) && phase === 1) {
        const sh = satrancData.shieldedDetails || {};
        const fr = satrancData.frozenDetails || {};
        const lk = satrancData.lockedDetails || {};
        const inv = satrancData.invisibleDetails || {};
        const aj = satrancData.ajanDisguised || {};
        const sl = satrancData.slowedDetails || {};
        if (sh[square] || fr[square] || lk[square] || inv[square] || aj[square] || sl[square]) {
            return false;
        }
    }
    
    // ✨ Yer Değiştir / Rakibi Işınla / Rakip Taş Yerleştir - iki taş de efektsiz olmalı
    const swapJokerler = ["yer_degistir", "rakibi_isinla", "rakip_tas_yerlestir"];
    if (swapJokerler.includes(jokerId)) {
        const sh = satrancData.shieldedDetails || {};
        const fr = satrancData.frozenDetails || {};
        const lk = satrancData.lockedDetails || {};
        const inv = satrancData.invisibleDetails || {};
        const aj = satrancData.ajanDisguised || {};
        const sl = satrancData.slowedDetails || {};
        // Phase 1 veya Phase 2'de seçilen kare kontrol edilir
        if (sh[square] || fr[square] || lk[square] || inv[square] || aj[square] || sl[square]) {
            return false;
        }
    }

    switch (jokerId) {
        case "bomba":
            // Sadece RAKİP taş (şah hariç, kendi taş hariç)
            if (!piece || piece.type === "k" || piece.color === myColor) return false;
            // ✨ Bu rakip taşı patlatırsak şahım tehdit altına girer mi?
            if (_wouldRemovingEnemyExposeMyKing(square)) return false;
            return true;
        case "vezire_yukselt":
            // Sadece kendi piyon
            return piece && piece.color === myColor && piece.type === "p";
        case "kalkan":
            // Kendi taş (şah dahil)
            return piece && piece.color === myColor;
        case "gorunmez":
            // Kendi taş - ama zaten ajansa engelle
            if (!piece || piece.color !== myColor) return false;
            if (satrancData.ajanDisguised && satrancData.ajanDisguised[square]) return false;
            return true;
        case "dondur":
        case "kilitle":
        case "yavaslat":
            // Rakip taş (şah hariç)
            return piece && piece.color !== myColor && piece.type !== "k";
        case "ajan":
            // Kendi taş (şah hariç) - ama zaten görünmezse engelle
            if (!piece || piece.color !== myColor || piece.type === "k") return false;
            if (satrancData.invisibleDetails && satrancData.invisibleDetails[square]) return false;
            return true;
		case "yoksay":
            // Kendi ya da rakip herhangi bir taş (kral hariç)
            if (!piece || piece.type === "k") return false;
            // Zaten hayaletse engelle
            if (satrancData.ignoredSquares && satrancData.ignoredSquares.includes(square)) return false;
            return true;	
        case "isinlan":
            if (phase === 1) {
                if (!piece || piece.color !== myColor) return false;
                if (piece.type !== "k" && _wouldExposeMyKing(square)) return false;
                return true;
            }
            // Phase 2: boş kare olmalı
            if (piece) return false;
            if (!prevTarget) return true;
            // Şah tehdit simülasyonu: prevTarget → square taşındığında
            // 1) kendi şahım tehdit altına girmemeli
            // 2) rakibin şahına şah çekmemeli (jokerle şah çekmek yasak)
            if (satrancData.game) {
                try {
                    const tempFen = satrancData.game.fen();
                    const tempGame = new Chess(tempFen);
                    const movingPiece = tempGame.get(prevTarget);
                    if (movingPiece) {
                        tempGame.remove(prevTarget);
                        tempGame.put({type: movingPiece.type, color: movingPiece.color}, square);
                        // Kendi şahım tehdit altında mı?
                        const parts1 = tempGame.fen().split(" ");
                        parts1[1] = myColor;
                        tempGame.load(parts1.join(" "));
                        if (tempGame.in_check()) return false;
                        // Rakibin şahı tehdit altında mı? (jokerle şah çekmek yasak)
                        const oppColor = myColor === "w" ? "b" : "w";
                        const parts2 = tempGame.fen().split(" ");
                        parts2[1] = oppColor;
                        tempGame.load(parts2.join(" "));
                        if (tempGame.in_check()) return false;
                    }
                } catch(e) {}
            }
            return true;
        case "klon":
            if (phase === 1) {
                if (!piece || piece.color !== myColor || piece.type === "k") return false;
                // Pinned taş klonlanamaz (asıl taş hareket etmese de bu güvenlik için iyi)
                if (_wouldExposeMyKing(square)) return false;
                return true;
            }
            // Phase 2: prevTarget'ın boş komşu karesi
            if (piece) return false;
            if (!prevTarget) return false;
            const files_kl = "abcdefgh";
            const pf_kl = files_kl.indexOf(prevTarget[0]);
            const pr_kl = parseInt(prevTarget[1]);
            const cf_kl = files_kl.indexOf(square[0]);
            const cr_kl = parseInt(square[1]);
            return Math.abs(pf_kl - cf_kl) <= 1 && Math.abs(pr_kl - cr_kl) <= 1 && !(pf_kl === cf_kl && pr_kl === cr_kl);
        case "rakip_tas_yerlestir":
            if (phase === 1) return piece && piece.color !== myColor && piece.type !== "k";
            // Phase 2: boş kare + şahı tehdit etmemeli
            if (piece) return false;
            if (!prevTarget) return true;
            if (_wouldPlacingEnemyExposeMyKing(prevTarget, square)) return false;
            return true;
		case "rakibi_isinla":
            // ⚡ İki dolu kare (şah hariç), en az biri rakip taş olmalı
            // ve swap sonrası kendi şahım tehdit altında kalmamalı.
            if (phase === 1) {
                if (!piece || piece.type === "k") return false;

                // Bu ilk taş için en az 1 geçerli ikinci taş var mı?
                const files_ri = "abcdefgh";
                for (let rank_ri = 1; rank_ri <= 8; rank_ri++) {
                    for (let fileIdx_ri = 0; fileIdx_ri < 8; fileIdx_ri++) {
                        const candidateSq = files_ri[fileIdx_ri] + rank_ri;
                        if (candidateSq === square) continue;

                        const candidatePiece = satrancData.game.get(candidateSq);
                        if (!candidatePiece || candidatePiece.type === "k") continue;

                        // 2 kendi taş yasak
                        if (piece.color === myColor && candidatePiece.color === myColor) continue;

                        // Swap sonrası şah açıkta kalıyorsa bu aday geçersiz
                        if (_wouldRakibiIsinlaExposeMyKing(square, candidateSq)) continue;

                        return true;
                    }
                }
                return false;
            }

            if (!piece || piece.type === "k") return false;
            if (square === prevTarget) return false;

            if (satrancData.game && prevTarget) {
                const prevPiece = satrancData.game.get(prevTarget);
                if (!prevPiece || prevPiece.type === "k") return false;

                // 2 kendi taş yasak
                if (prevPiece.color === myColor && piece.color === myColor) {
                    return false;
                }

                // Swap sonrası şah açıkta kalıyorsa seçilemesin
                if (_wouldRakibiIsinlaExposeMyKing(prevTarget, square)) {
                    return false;
                }
            }

            return true;	
        case "yer_degistir":
            // Kendi 2 taş (şah dahil), pinned taş seçilemez
            if (phase === 1) {
                if (!piece || piece.color !== myColor) return false;
                if (piece.type !== "k" && _wouldExposeMyKing(square)) return false;
                return true;
            }
            if (!piece || piece.color !== myColor || square === prevTarget) return false;
            if (piece.type !== "k" && _wouldExposeMyKing(square)) return false;
            return true;
        case "tas_donustur":
            // Kendi veya rakip taş (şah hariç)
            return piece && piece.type !== "k";
        default:
            return true;
    }
}

// ✨ Tahtada hedeflenebilir kareleri highlight et
function highlightTargetableSquares(jokerId, phase, prevTarget) {
    // Önce tüm eski targetable classları temizle
    $("#satrancBoard .square-55d63").removeClass("joker-targetable joker-not-targetable");

    if (!satrancData.game) return;
    const files = "abcdefgh";
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sq = files[c] + (r + 1);
            if (isSquareTargetable(sq, jokerId, phase, prevTarget)) {
                $(`#satrancBoard .square-${sq}`).addClass("joker-targetable");
            }
        }
    }
}

function _getJokerTargetHint(jokerId, phase) {
    const hints = {
        "vezire_yukselt": ["Yükseltmek istediğin piyonu seç"],
        "kalkan": ["Kalkan vereceğin kendi taşını seç"],
        "dondur": ["Donduracağın rakip taşını seç"],
        "bomba": ["Bombanın merkezini seç (şah hariç)"],
        "gorunmez": ["Görünmez yapacağın kendi taşını seç"],
        "kilitle": ["Kilitleyeceğin rakip taşını seç"],
        "yavaslat": ["🐌 Yavaşlatacağın rakip taşını seç"],
        "ajan": ["Ajan yapacağın kendi taşını seç"],
        "yoksay": ["🚫 Hayalet yapılacak taşı seç (kendi/rakip, kral hariç)"],
        "isinlan": ["Işınlayacağın kendi taşını seç", "Hedef boş kareyi seç"],
        "klon": ["Klonlanacak kendi taşını seç", "Klon için komşu boş kareyi seç"],
        "rakip_tas_yerlestir": ["Taşınacak rakip taşı seç", "Hedef boş kareyi seç"],
        "yer_degistir": ["1. kendi taşını seç", "2. kendi taşını seç"],
        "rakibi_isinla": ["⚡ 1. taşı seç (kim olursa, şah hariç)", "⚡ 2. taşı seç → yer değişecek"],
    };
    const list = hints[jokerId] || ["Kare seç"];
    return list[phase - 1] || list[0];
}

function handleSquareSelectClick(square) {
    if (!satrancPendingJoker) return;
    const jokerId = satrancPendingJoker.joker.id;

    // ✨ Çift efekt engeli (görünmez ↔ ajan)
    if (jokerId === "ajan" && satrancData.invisibleDetails && satrancData.invisibleDetails[square]) {
        showToast("⚠️ Çift Efekt Yasak", "Bu taş zaten Görünmez. Önce görünmez süresi bitsin.", null, "warning");
        return;
    }
    if (jokerId === "gorunmez" && satrancData.ajanDisguised && satrancData.ajanDisguised[square]) {
        showToast("⚠️ Çift Efekt Yasak", "Bu taş zaten Ajan. Önce ajan süresi bitsin.", null, "warning");
        return;
    }

    // Tek hedefli
    if (SINGLE_TARGET_JOKERS.includes(jokerId)) {
        // ✨ Hedef karedeki taşın adını al
        let subtitle = `Hedef Kare: ${square.toUpperCase()}`;
        if (satrancData.game) {
            const p = satrancData.game.get(square);
            if (p) {
                const pieceNames = {
                    "p": "Piyon", "r": "Kale", "n": "At",
                    "b": "Fil", "q": "Vezir", "k": "Şah"
                };
                const colorName = p.color === "w" ? "Beyaz" : "Siyah";
                const pName = pieceNames[p.type] || "Taş";
                subtitle = `Hedef: ${colorName} ${pName} (${square.toUpperCase()})`;
            } else {
                subtitle = `Hedef Kare: ${square.toUpperCase()} (boş)`;
            }
        }
        satrancConfirm({
            icon: satrancPendingJoker.joker.icon,
            title: satrancPendingJoker.joker.name,
            subtitle: subtitle,
            message: satrancPendingJoker.joker.desc,
            type: "joker",
            yesText: "🎯 Uygula",
            noText: "İptal"
        }).then(ok => {
            if (ok) {
                playSatrancSound("joker_onay");
                send({
                    type: "satranc_use_joker_target",
                    joker_id: jokerId,
                    target1: square
                });
                // İptal sesi çalmasın diye pending'i temizleyip cancel çağır
                satrancPendingJoker = null;
                cancelSquareSelectMode();
            }
        });
        return;
    }

    // Çift hedefli
    if (DOUBLE_TARGET_JOKERS.includes(jokerId)) {
        if (satrancPendingJoker.phase === 1) {
            satrancPendingJoker.target1 = square;
            satrancPendingJoker.phase = 2;
            const hint = _getJokerTargetHint(jokerId, 2);
            showJokerTargetBanner(`${satrancPendingJoker.joker.icon} ${satrancPendingJoker.joker.name}`, `1. Seçilen: ${square} | ${hint}`);
            // 1. hedefi vurgula + phase 2 için hedeflenebilir kareler
            highlightTargetableSquares(jokerId, 2, square);
            $(`#satrancBoard .square-${square}`).addClass("highlight-from");
            return;
        }
        if (satrancPendingJoker.phase === 2) {
            const target1 = satrancPendingJoker.target1;
            if (square === target1) {
                showToast("⚠️", "Farklı bir kare seç!", null, "warning");
                return;
            }
            satrancConfirm({
                icon: satrancPendingJoker.joker.icon,
                title: satrancPendingJoker.joker.name,
                subtitle: `${target1.toUpperCase()} → ${square.toUpperCase()}`,
                message: satrancPendingJoker.joker.desc,
                type: "joker",
                yesText: "🎯 Uygula",
                noText: "İptal"
            }).then(ok => {
                if (ok) {
                    playSatrancSound("joker_onay");
                    send({
                        type: "satranc_use_joker_target",
                        joker_id: jokerId,
                        target1: target1,
                        target2: square
                    });
                    satrancPendingJoker = null;
                    cancelSquareSelectMode();
                }
            });
            return;
        }
    }
}

function jokerCancelKeyHandler(e) {
    if (e.key === "Escape") {
        // ESC event'in başka handler'lara gitmesini engelle (app.js ESC popup)
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        cancelSquareSelectMode();
    }
}

function cancelSquareSelectMode() {
    // ✨ Aktif bir joker seçimindeyse iptal sesi çal
    if (satrancPendingJoker) {
        try { playSatrancSound("joker_iptal"); } catch(e) {}
    }
    satrancPendingJoker = null;
    hideJokerTargetBanner();
    hideJokerCancelButton();
    $("#satrancBoard .square-55d63").off("click.jokerTarget");
    $("#satrancBoard .square-55d63").removeClass("highlight-from highlight-to joker-targetable joker-not-targetable");
    document.removeEventListener("keydown", jokerCancelKeyHandler, true);
}

function showJokerTargetBanner(title, hint) {
    let banner = document.getElementById("satrancJokerBanner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "satrancJokerBanner";
        banner.className = "satrancJokerBanner";
        document.body.appendChild(banner);
    }
    banner.innerHTML = `
        <div class="satrancJbTitle">${title}</div>
        <div class="satrancJbHint">${hint}</div>
        <div class="satrancJbCancel">ESC ile iptal</div>
    `;
    banner.classList.remove("hidden");

    // ✨ Sol alt "İptal Et" butonunu göster
    showJokerCancelButton();
}

function hideJokerTargetBanner() {
    const banner = document.getElementById("satrancJokerBanner");
    if (banner) banner.classList.add("hidden");
}

// ✨ Joker aktifken Jokerlerim kutusunun ALTINA "İPTAL ET" butonu
function showJokerCancelButton() {
    let btn = document.getElementById("satrancJokerCancelBtn");
    if (!btn) {
        btn = document.createElement("button");
        btn.id = "satrancJokerCancelBtn";
        btn.className = "satrancJokerCancelBtn";
        btn.innerHTML = "❌ Jokeri İptal Et";
        btn.onclick = () => cancelSquareSelectMode();
    }
    // Her seferinde doğru yere yerleştir (panel her renderMyJokers'ta yenilenir)
    const panel = document.getElementById("satrancMyJokerPanel");
    if (panel && btn.parentNode !== panel) {
        panel.appendChild(btn);
    }
    btn.style.display = "block";
}

function hideJokerCancelButton() {
    const btn = document.getElementById("satrancJokerCancelBtn");
    if (btn) btn.style.display = "none";
}

// Rakibin kullandığı jokerleri açığa çıkar (kart olarak sakla)
if (!window._satrancRevealedOppJokers) window._satrancRevealedOppJokers = [];

function revealOppJokerAsUsed(jokerId, jokerName, jokerIcon) {
    // Zaten reveal edilmiş mi?
    if (window._satrancRevealedOppJokers.some(j => j.id === jokerId)) return;
    // Havuzdan tam bilgiyi bulmaya çalış
    let jokerInfo = null;
    if (satrancData.jokerPool) {
        jokerInfo = satrancData.jokerPool.find(j => j.id === jokerId);
    }
    if (!jokerInfo) {
        jokerInfo = { id: jokerId, name: jokerName || "?", icon: jokerIcon || "🃏", category: "used" };
    }
    window._satrancRevealedOppJokers.push(jokerInfo);
}

function renderOppJokers() {
    const container = document.getElementById("satrancOppJokers");
    if (!container) return;
    container.innerHTML = "";

    const totalCount = satrancData.oppJokerCount || 0;
    const revealed = window._satrancRevealedOppJokers || [];
    const usedIds = new Set(satrancData.oppUsedJokers || []);
    const hiddenCount = Math.max(0, totalCount - revealed.length);
    
    // ✨ Joker kilidi kontrolü (rakip için)
    const jokersLocked = !satrancData.jokersUnlocked && satrancData.lockMode !== "off";

    if (totalCount === 0) {
        container.innerHTML = '<p style="color:#6c757d; text-align:center; font-size:12px;">Joker yok</p>';
        return;
    }

    // Açığa çıkanları göster
    revealed.forEach(joker => {
        const card = document.createElement("div");
        const isUsed = usedIds.has(joker.id) || joker.used;

        // ✨ Aktif efekti olan jokerler silik görünmesin
        let isStillActive = false;
        let activeTurns = 0;
        if (isUsed) {
            if (joker.id === "kilitle") {
                const ld = satrancData.lockedDetails || {};
                const maxT = Math.max(0, ...Object.values(ld).map(Number));
                if (maxT > 0) { isStillActive = true; activeTurns = maxT; }
            } else if (joker.id === "dondur") {
                const fd = satrancData.frozenDetails || {};
                const maxT = Math.max(0, ...Object.values(fd).map(Number));
                if (maxT > 0) { isStillActive = true; activeTurns = maxT; }
            } else if (joker.id === "kalkan") {
                const sd = satrancData.shieldedDetails || {};
                const maxT = Math.max(0, ...Object.values(sd).map(Number));
                if (maxT > 0) { isStillActive = true; activeTurns = maxT; }
            } else if (joker.id === "gorunmez") {
                const id = satrancData.invisibleDetails || {};
                const maxT = Math.max(0, ...Object.values(id).map(Number));
                if (maxT > 0) { isStillActive = true; activeTurns = maxT; }
            } else if (joker.id === "ajan") {
                const ad = satrancData.ajanDisguised || {};
                Object.values(ad).forEach(v => {
                    const t = (typeof v === "object") ? (v.turns || 0) : 0;
                    if (t > 0) { isStillActive = true; activeTurns = Math.max(activeTurns, t); }
                });
            } else if (joker.id === "yavaslat") {
                const sd = satrancData.slowedDetails || {};
                const maxT = Math.max(0, ...Object.values(sd).map(Number));
                if (maxT > 0) { isStillActive = true; activeTurns = maxT; }
            }
        }

        const showAsUsed = isUsed && !isStillActive;
        card.className = "satrancJokerCard satrancJokerGameCard" + (showAsUsed ? " used" : "");
        card.dataset.category = joker.category || "revealed";

        if (joker._revealed && !isUsed) {
            card.title = `👁️ Görüldü: ${joker.name} - ${joker.desc || ""}`;
            card.classList.add("revealed-visible");
        } else if (isStillActive) {
            card.title = `Aktif: ${joker.name} (${activeTurns} tur kaldı)`;
            card.classList.add("opp-joker-active");
        } else if (isUsed) {
            card.title = `Kullanıldı: ${joker.name}`;
        }

        let badgeHtml = "";
        if (isStillActive) {
            const badgeIcons = {
                kilitle: "⛓️", dondur: "❄️", kalkan: "🛡️",
                gorunmez: "🧙", ajan: "🕵️", yavaslat: "🐌"
            };
            const badgeIcon = badgeIcons[joker.id] || "⏳";
            badgeHtml = `<div class="satrancJcTopBadge lockedBadge">${badgeIcon} Kalan Tur: ${activeTurns}</div>`;
        }

        card.innerHTML = `
            ${badgeHtml}
            <div class="satrancJcIcon">${joker.icon}</div>
            <div class="satrancJcName">${joker.name}</div>
        `;
        container.appendChild(card);
    });

    // Gizli olanlar
    for (let i = 0; i < hiddenCount; i++) {
        const card = document.createElement("div");
        card.className = "satrancJokerCard satrancJokerHiddenCard";
        // ✨ Kilit varsa soluk göster
        if (jokersLocked) {
            card.classList.add("sansurluCard");
            let lockMsg = "";
            if (satrancData.lockMode === "pieces") {
                const status = satrancData.lockStatus;
                const remaining = status ? status.remaining_pieces : satrancData.lockPieces;
                lockMsg = `🔒 Rakibin jokerleri kilitli - ${remaining} taş daha yenmeli`;
            } else if (satrancData.lockMode === "time") {
                const elapsed = (Date.now() - satrancData.gameStartTs) / 1000;
                const totalSec = satrancData.lockMinutes * 60;
                const remaining = Math.max(0, totalSec - elapsed);
                lockMsg = `🔒 Rakibin jokerleri kilitli - ${_formatLockTime(remaining)} sonra açılacak`;
            }
            card.title = lockMsg;
        }
        card.innerHTML = `
            <div class="satrancJcIcon">🎴</div>
            <div class="satrancJcName">???</div>
        `;
        container.appendChild(card);
    }
    
    // ✨ Rakibin açığa çıkmış jokerleri de kilitli olmalı
    if (jokersLocked) {
        const oppCards = container.querySelectorAll(".satrancJokerCard:not(.used)");
        oppCards.forEach(c => {
            if (!c.classList.contains("used")) {
                c.classList.add("sansurluCard");
            }
        });
    }
}

// ==========================================
// MODERN POPUP SİSTEMİ
// ==========================================

// Confirm popup (Evet/Hayır sorusu)
function satrancConfirm(options) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "satrancModalOverlay";
        overlay.innerHTML = `
            <div class="satrancModalCard ${options.type || 'info'}">
                <div class="satrancModalIcon">${options.icon || '❓'}</div>
                <h2 class="satrancModalTitle">${options.title || 'Onay'}</h2>
                ${options.subtitle ? `<div class="satrancModalSubtitle">${options.subtitle}</div>` : ''}
                ${options.message ? `<p class="satrancModalMsg">${options.message}</p>` : ''}
                ${options.detail ? `<div class="satrancModalDetail">${options.detail}</div>` : ''}
                <div class="satrancModalButtons">
                    <button class="satrancModalBtn satrancModalYes">
                        ${options.yesText || '✅ Onayla'}
                    </button>
                    <button class="satrancModalBtn satrancModalNo">
                        ${options.noText || '❌ İptal'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Animasyonlu giriş
        setTimeout(() => overlay.classList.add("show"), 10);

        const close = (result) => {
            overlay.classList.remove("show");
            setTimeout(() => {
                if (overlay.parentNode) overlay.remove();
            }, 250);
            resolve(result);
        };

        overlay.querySelector(".satrancModalYes").onclick = () => close(true);
        overlay.querySelector(".satrancModalNo").onclick = () => close(false);
        overlay.onclick = (e) => { if (e.target === overlay) close(false); };

        // ESC tuşu
        const escHandler = (e) => {
            if (e.key === "Escape") {
                close(false);
                document.removeEventListener("keydown", escHandler);
            }
        };
        document.addEventListener("keydown", escHandler);
    });
}

// Info popup (sadece bilgi göster, tek buton)
function satrancInfo(options) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "satrancModalOverlay";
        overlay.innerHTML = `
            <div class="satrancModalCard ${options.type || 'info'}">
                <div class="satrancModalIcon">${options.icon || 'ℹ️'}</div>
                <h2 class="satrancModalTitle">${options.title || 'Bilgi'}</h2>
                ${options.message ? `<p class="satrancModalMsg">${options.message}</p>` : ''}
                ${options.detail ? `<div class="satrancModalDetail">${options.detail}</div>` : ''}
                <div class="satrancModalButtons">
                    <button class="satrancModalBtn satrancModalYes single">
                        ${options.okText || 'Tamam'}
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add("show"), 10);

        const close = () => {
            overlay.classList.remove("show");
            setTimeout(() => {
                if (overlay.parentNode) overlay.remove();
            }, 250);
            resolve();
        };

        overlay.querySelector(".satrancModalYes").onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay) close(); };
    });
}

// Choice popup (seçenek listesi - Taş Dönüştür için)
function satrancChoice(options) {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.className = "satrancModalOverlay";
        let choicesHtml = "";
        (options.choices || []).forEach(c => {
            choicesHtml += `
                <button class="satrancChoiceBtn" data-value="${c.value}">
                    <span class="satrancChoiceIcon">${c.icon || ''}</span>
                    <span class="satrancChoiceLabel">${c.label}</span>
                </button>
            `;
        });
        overlay.innerHTML = `
            <div class="satrancModalCard choice">
                <div class="satrancModalIcon">${options.icon || '🎴'}</div>
                <h2 class="satrancModalTitle">${options.title || 'Seç'}</h2>
                ${options.message ? `<p class="satrancModalMsg">${options.message}</p>` : ''}
                <div class="satrancChoiceGrid">${choicesHtml}</div>
                <div class="satrancModalButtons">
                    <button class="satrancModalBtn satrancModalNo single">
                        ❌ İptal
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        setTimeout(() => overlay.classList.add("show"), 10);

        const close = (val) => {
            overlay.classList.remove("show");
            setTimeout(() => {
                if (overlay.parentNode) overlay.remove();
            }, 250);
            resolve(val);
        };

        overlay.querySelectorAll(".satrancChoiceBtn").forEach(btn => {
            btn.onclick = () => close(btn.dataset.value);
        });
        overlay.querySelector(".satrancModalNo").onclick = () => close(null);
        overlay.onclick = (e) => { if (e.target === overlay) close(null); };

        const escHandler = (e) => {
            if (e.key === "Escape") {
                close(null);
                document.removeEventListener("keydown", escHandler);
            }
        };
        document.addEventListener("keydown", escHandler);
    });
}

// ==========================================
// YANSIMA HASAR POPUP
// ==========================================
function showYansimaDamagePopup(jokerName, jokerIcon, message) {
    let overlay = document.createElement("div");
    overlay.className = "satrancModalOverlay";

    overlay.innerHTML = `
        <div class="satrancModalCard danger" style="max-width:500px;">
            <div class="satrancModalIcon" style="font-size:80px; animation: yansimaDamageIconShake 0.6s ease-in-out;">🌀</div>
            <h2 class="satrancModalTitle" style="color:#ff6b6b;">YANSIMA!</h2>
            <div class="satrancModalSubtitle" style="color:#ffa94d; background:rgba(255,107,107,0.15); border:1px solid #ff6b6b;">
                ${jokerIcon} ${jokerName}
            </div>
            <p class="satrancModalMsg" style="font-size:17px; line-height:1.5;">
                ${message}
            </p>
            <div class="satrancModalButtons">
                <button class="satrancModalBtn satrancModalYes single">✅ Tamam</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);

    const close = () => {
        overlay.classList.remove("show");
        setTimeout(() => overlay.remove(), 250);
    };

    overlay.querySelector(".satrancModalYes").onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    // ESC ile kapat
    const escHandler = (e) => {
        if (e.key === "Escape") {
            close();
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);

    // Ses
    try { playSatrancSound("isinlanma"); } catch (e) {}
}

// ==========================================
// HEDİYE KUTUSU ANİMASYONU
// ==========================================
function showGiftBoxAnimation(joker) {
    let overlay = document.getElementById("satrancGiftOverlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "satrancGiftOverlay";
    overlay.className = "satrancGiftOverlay";
    document.body.appendChild(overlay);

    const category = (joker && joker.category) || "ekstra";

    overlay.innerHTML = `
        <div class="satrancGiftBox">
            <div class="satrancGiftTitle">🎁 KARŞILIKLI EKSTRA JOKER</div>
            <div class="satrancGiftBoxWrapper">
                <div class="satrancGiftBoxLid">
                    <div class="satrancGiftBowLeft"></div>
                    <div class="satrancGiftBowRight"></div>
                    <div class="satrancGiftBowKnot"></div>
                </div>
                <div class="satrancGiftBoxBottom">
                    <div class="satrancGiftRibbonV"></div>
                    <div class="satrancGiftRibbonH"></div>
                </div>
                <div class="satrancGiftSparkles"></div>
                <div class="satrancGiftCard" data-category="${category}">
                    <div class="satrancJcIcon">${joker.icon || "🃏"}</div>
                    <div class="satrancJcName">${joker.name || "Yeni Joker"}</div>
                    <div class="satrancJcCategory">${joker.category || ""}</div>
                    <div class="satrancJcDesc">${joker.desc || ""}</div>
                </div>
            </div>
            <div class="satrancGiftHint">Kart havaya yükselirken izle...</div>
        </div>
    `;

    // Animasyon başlat
    setTimeout(() => overlay.classList.add("show"), 50);
    setTimeout(() => overlay.classList.add("opening"), 900);   // Kutu açılıyor
    setTimeout(() => overlay.classList.add("revealing"), 1600); // Kart çıkıyor
    setTimeout(() => overlay.classList.add("floating"), 2600);  // Kart yukarı süzülüyor

    // Kapat
    setTimeout(() => {
        overlay.classList.remove("show");
        setTimeout(() => overlay.remove(), 400);
    }, 4500);
}

// ==========================================
// TAŞIMI GERİ VER MENÜSÜ
// ==========================================
function showTasimiGeriMenu(lostPieces) {
    const overlay = document.createElement("div");
    overlay.className = "satrancModalOverlay";

    // Grupla
    const grouped = {};
    lostPieces.forEach(p => {
        if (p.type === "k") return;
        grouped[p.type] = (grouped[p.type] || 0) + 1;
    });

    const myColor = satrancData.myColor || "w";
    const typeMap = { q: "Q", r: "R", b: "B", n: "N", p: "P" };
    const pieceNames = { q: "Vezir", r: "Kale", b: "Fil", n: "At", p: "Piyon" };

    let piecesHtml = "";
    Object.keys(grouped).forEach(type => {
        const pieceCode = myColor + typeMap[type];
        const count = grouped[type];
        piecesHtml += `
            <div class="satrancTasimiPiece" data-piece="${type}">
                <img src="/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png" alt="${type}">
                <div class="satrancTasimiName">${pieceNames[type]}</div>
                <div class="satrancTasimiCount">×${count}</div>
            </div>
        `;
    });

    overlay.innerHTML = `
        <div class="satrancModalCard joker">
            <div class="satrancModalIcon">♻️</div>
            <h2 class="satrancModalTitle">Taşımı Geri Ver</h2>
            <p class="satrancModalMsg">
                Rakibin senden yediği taşlar. Birini seç, piyon satırına geri gelecek.
            </p>
            <div class="satrancTasimiPieces">${piecesHtml}</div>
            <div class="satrancModalButtons">
                <button class="satrancModalBtn satrancModalNo single">❌ İptal</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);

    const close = () => {
        overlay.classList.remove("show");
        setTimeout(() => overlay.remove(), 250);
    };

    overlay.querySelectorAll(".satrancTasimiPiece").forEach(el => {
        el.onclick = () => {
            const chosen = el.dataset.piece;
            close();
            send({
                type: "satranc_use_joker",
                joker_id: "tasimi_geri_ver",
                piece_type: chosen,
            });
        };
    });

    overlay.querySelector(".satrancModalNo").onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const escHandler = (e) => {
        if (e.key === "Escape") {
            close();
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);
}

// ==========================================
// İYİLEŞTİR MENÜSÜ
// ==========================================
function showIyilestirMenu(activeList) {
    let overlay = document.createElement("div");
    overlay.className = "satrancModalOverlay";

    let itemsHtml = "";
    activeList.forEach(item => {
        itemsHtml += `
            <button class="satrancIyilestirItem" data-effect-id="${item.id}">
                <div class="satrancIyilestirIcon">${item.icon}</div>
                <div class="satrancIyilestirInfo">
                    <div class="satrancIyilestirLabel">${item.label}</div>
                    <div class="satrancIyilestirTurns">
                        <span class="curTurns">${item.current} tur</span>
                        <span class="arrow">→</span>
                        <span class="boostedTurns">${item.boosted} tur</span>
                    </div>
                </div>
                <div class="satrancIyilestirPlus">+3</div>
            </button>
        `;
    });

    overlay.innerHTML = `
        <div class="satrancModalCard joker">
            <div class="satrancModalIcon">🔧</div>
            <h2 class="satrancModalTitle">İyileştir</h2>
            <div class="satrancModalSubtitle">+3 Tur Ekleme</div>
            <p class="satrancModalMsg">Hangi aktif jokerine 3 tur eklemek istiyorsun?</p>
            <div class="satrancIyilestirList">${itemsHtml}</div>
            <div class="satrancModalButtons">
                <button class="satrancModalBtn satrancModalNo single">❌ İptal</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);

    const close = () => {
        overlay.classList.remove("show");
        setTimeout(() => overlay.remove(), 250);
    };

    overlay.querySelectorAll(".satrancIyilestirItem").forEach(btn => {
        btn.onclick = () => {
            const effectId = btn.dataset.effectId;
            close();
            send({
                type: "satranc_use_joker",
                joker_id: "iyilestir",
                target_effect: effectId,
            });
        };
    });

    overlay.querySelector(".satrancModalNo").onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay) close(); };

    const escHandler = (e) => {
        if (e.key === "Escape") {
            close();
            document.removeEventListener("keydown", escHandler);
        }
    };
    document.addEventListener("keydown", escHandler);
}

// ==========================================
// ZAR ATMA ANİMASYONU (İki taraf da Önce Başla)
// ==========================================
function showDiceIntro(msg) {
    let overlay = document.getElementById("satrancDiceOverlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "satrancDiceOverlay";
    overlay.className = "satrancDiceOverlay";
    document.body.appendChild(overlay);

    overlay.innerHTML = `
        <div class="satrancDiceBox">
            <div class="satrancDiceTitle">🎲 ZAR ATILIYOR</div>
            <div class="satrancDiceIntroMsg">${msg.message}</div>
            <div class="satrancDiceCountdown" id="satrancDiceCd">3</div>
            <div class="satrancDicePlayers">
                <div class="satrancDicePlayerCard">
                    <div class="satrancDicePlayerName" style="color:#ff8a8a;">${msg.p1_name}</div>
                    <div class="satrancDiceValue">?</div>
                </div>
                <div class="satrancDiceVs">VS</div>
                <div class="satrancDicePlayerCard">
                    <div class="satrancDicePlayerName" style="color:#7abfff;">${msg.p2_name}</div>
                    <div class="satrancDiceValue">?</div>
                </div>
            </div>
        </div>
    `;

    // 3-2-1 sayaç
    let cd = 3;
    const cdEl = document.getElementById("satrancDiceCd");
    const cdInt = setInterval(() => {
        cd--;
        if (cdEl) cdEl.textContent = cd;
        if (cd <= 0) {
            clearInterval(cdInt);
            if (cdEl) cdEl.textContent = "🎲";
        }
    }, 1000);
}

function showDiceRoll(msg) {
    const overlay = document.getElementById("satrancDiceOverlay");
    if (!overlay) return;

    const cards = overlay.querySelectorAll(".satrancDicePlayerCard");
    if (cards.length < 2) return;

    const p1Val = cards[0].querySelector(".satrancDiceValue");
    const p2Val = cards[1].querySelector(".satrancDiceValue");

    const cdEl = document.getElementById("satrancDiceCd");
    if (cdEl) cdEl.textContent = "🎲 Zarlar dönüyor...";

    const DICE_EMOJIS = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

    // Zar dönme animasyonu - 1.5 saniye boyunca hızlıca değişir
    let spinCount = 0;
    const maxSpins = 15;
    const spinInterval = setInterval(() => {
        if (spinCount >= maxSpins) {
            clearInterval(spinInterval);
            // Gerçek zarları göster
            if (p1Val) {
                p1Val.textContent = DICE_EMOJIS[msg.p1_dice - 1] + " " + msg.p1_dice;
                p1Val.classList.add("diceResult");
            }
            if (p2Val) {
                p2Val.textContent = DICE_EMOJIS[msg.p2_dice - 1] + " " + msg.p2_dice;
                p2Val.classList.add("diceResult");
            }

            // Kazananı vurgula
            if (msg.p1_dice > msg.p2_dice) {
                cards[0].classList.add("diceWinner");
                cards[1].classList.add("diceLoser");
            } else if (msg.p2_dice > msg.p1_dice) {
                cards[1].classList.add("diceWinner");
                cards[0].classList.add("diceLoser");
            }

            if (cdEl) {
                if (msg.p1_dice === msg.p2_dice) {
                    cdEl.textContent = `Eşitlik! ${msg.p1_dice} - ${msg.p2_dice}`;
                    cdEl.style.color = "#ffd43b";
                } else {
                    cdEl.textContent = "Sonuç geliyor...";
                }
            }
            return;
        }
        const r1 = Math.floor(Math.random() * 6);
        const r2 = Math.floor(Math.random() * 6);
        if (p1Val) p1Val.textContent = DICE_EMOJIS[r1];
        if (p2Val) p2Val.textContent = DICE_EMOJIS[r2];
        spinCount++;
    }, 100);
}

function showDiceTie(msg) {
    const cards = document.querySelectorAll("#satrancDiceOverlay .satrancDicePlayerCard");
    cards.forEach(c => {
        c.classList.remove("diceWinner", "diceLoser");
        const v = c.querySelector(".satrancDiceValue");
        if (v) {
            v.classList.remove("diceResult");
            v.textContent = "?";
        }
    });
    const cdEl = document.getElementById("satrancDiceCd");
    if (cdEl) {
        cdEl.textContent = "🎲 Tekrar!";
        cdEl.style.color = "#ffd43b";
    }
}

function showDiceResult(msg) {
    const overlay = document.getElementById("satrancDiceOverlay");
    if (!overlay) return;

    // ✨ Kazandın mı kaybettin mi?
    const iWon = (msg.winner_id === satrancData.playerId);
    const resultText = iWon ? "🏆 KAZANDIN!" : "😢 KAYBETTİN!";
    const resultColor = iWon ? "#51cf66" : "#ff6b6b";

    // Başlığı değiştir
    const titleEl = overlay.querySelector(".satrancDiceTitle");
    if (titleEl) {
        titleEl.textContent = resultText;
        titleEl.style.color = resultColor;
        titleEl.style.textShadow = `0 0 25px ${resultColor}`;
    }

    const cdEl = document.getElementById("satrancDiceCd");
    if (cdEl) {
        cdEl.textContent = "🏆 " + msg.winner_name + " beyaz oldu!";
        cdEl.style.color = resultColor;
        cdEl.style.fontSize = "28px";
    }

    // 2.5 saniye sonra popup kapan
    setTimeout(() => {
        if (overlay && overlay.parentNode) {
            overlay.style.transition = "opacity 0.4s";
            overlay.style.opacity = "0";
            setTimeout(() => overlay.remove(), 450);
        }
    }, 2200);
}

// ==========================================
// 📦 KASA AÇILIMI - CS:GO Tarzı Yatay Kayan Animasyon
// ==========================================
function showKasaAnimation(msg) {
    let overlay = document.getElementById("satrancKasaOverlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "satrancKasaOverlay";
    overlay.className = "satrancKasaOverlay";
    document.body.appendChild(overlay);

    const reel = msg.reel || [];
    const winnerIdx = msg.winner_index || 20;
    const winnerJoker = msg.winner_joker || {};
    const isMyKasa = (msg.user_id === satrancData.playerId);
    const openerName = msg.user_name || "Rakip";

    // Her kart 180px genişlik + 10px gap = 190px
    const cardWidth = 180;
    const gap = 10;
    const totalCardWidth = cardWidth + gap;

    // Container ortası
    const containerWidth = 900;
    const centerOffset = containerWidth / 2 - cardWidth / 2;

    // Kazanan kartı ortaya getirmek için kaydırılacak mesafe
    // + Rastgele küçük offset (heyecan için, tam ortalamadan biraz kayık dursun)
    const randomJitter = (Math.random() - 0.5) * 60; // -30 ile +30 arası
    const targetTranslate = -(winnerIdx * totalCardWidth) + centerOffset + randomJitter;

    // Kart HTML'i oluştur
    let cardsHtml = "";
    reel.forEach((joker, i) => {
        const category = joker.category || "ekstra";
        cardsHtml += `
            <div class="satrancKasaCard" data-category="${category}" data-index="${i}">
                <div class="satrancKasaCardIcon">${joker.icon || "🃏"}</div>
                <div class="satrancKasaCardName">${joker.name || "?"}</div>
                <div class="satrancKasaCardCat">${category}</div>
            </div>
        `;
    });

    const titleText = isMyKasa ? "📦 KASA AÇILIYOR" : `📦 ${openerName} KASA AÇIYOR`;
    const subtitleText = isMyKasa 
        ? "Kazanacağın jokeri belirliyoruz..." 
        : "Rakibin kasayı izliyorsun...";

    overlay.innerHTML = `
        <div class="satrancKasaBox">
            <h1 class="satrancKasaTitle">${titleText}</h1>
            <p class="satrancKasaSubtitle">${subtitleText}</p>

            <div class="satrancKasaReelWrap">
                <div class="satrancKasaPointerTop">▼</div>
                <div class="satrancKasaPointerBottom">▲</div>
                <div class="satrancKasaCenterLine"></div>
                <div class="satrancKasaReel" id="satrancKasaReel">
                    ${cardsHtml}
                </div>
            </div>

            <div id="satrancKasaResult" class="satrancKasaResult">
                <div class="satrancKasaResultLabel">${isMyKasa ? "🎉 KAZANDIN!" : `🎁 ${openerName} KAZANDI!`}</div>
                <div class="satrancKasaResultCard" data-category="${winnerJoker.category || 'ekstra'}">
                    <div class="satrancKasaResultIcon">${winnerJoker.icon || "🃏"}</div>
                    <div class="satrancKasaResultName">${winnerJoker.name || "?"}</div>
                    <div class="satrancKasaResultDesc">${winnerJoker.desc || ""}</div>
                </div>
            </div>

            <button class="bigBtn greenBtn satrancKasaCloseBtn hidden" id="satrancKasaCloseBtn">
                ${isMyKasa ? "✅ Al ve Devam Et" : "👁️ Tamam"} <span id="satrancKasaCountdown"></span>
            </button>
        </div>
    `;

    // Kasa açma sesi
    try { playSatrancSound("kasa_acilma"); } catch(e) {}

    // Reel'i başlangıç konumuna ZORLA (transition sıfır)
    requestAnimationFrame(() => {
        const reelEl = document.getElementById("satrancKasaReel");
        if (reelEl) {
            reelEl.style.transition = "none";
            reelEl.style.transform = "translateX(0px)";
        }

        // İkinci frame'de animasyon başlasın (5 saniye dönme)
        requestAnimationFrame(() => {
            setTimeout(() => {
                const reelEl2 = document.getElementById("satrancKasaReel");
                if (reelEl2) {
                    reelEl2.style.transition = "transform 5s cubic-bezier(0.15, 0.7, 0.1, 1)";
                    reelEl2.style.transform = `translateX(${targetTranslate}px)`;
                    console.log("[KASA] Animasyon başladı - hedef:", targetTranslate);
                } else {
                    console.warn("[KASA] Reel elementi bulunamadı!");
                }
            }, 500);
        });
    });

    // Kazanan kartı vurgula (5.5 saniye sonra - dönme bitti)
    setTimeout(() => {
        const winnerCard = document.querySelector(`.satrancKasaCard[data-index="${winnerIdx}"]`);
        if (winnerCard) {
            winnerCard.classList.add("satrancKasaWinnerCard");
        }
    }, 5700);

    // Sonuç kutusu göster (6. saniye)
    setTimeout(() => {
        const result = document.getElementById("satrancKasaResult");
        if (result) result.classList.add("show");

        // Kapanış fonksiyonu
        const doClose = () => {
            if (overlay && overlay.parentNode) {
                overlay.style.transition = "opacity 0.4s";
                overlay.style.opacity = "0";
                setTimeout(() => {
                    if (overlay.parentNode) overlay.remove();
                }, 450);
            }
            // Sadece açan kişide jokeri ekle + kasa'yı used olarak işaretle
            if (isMyKasa && winnerJoker && winnerJoker.id) {
                if (!satrancData.myJokers) satrancData.myJokers = [];
                // Zaten backend eklemiş olabilir - duplicate önlemek için kontrol
                const alreadyHas = satrancData.myJokers.some(j => j.id === winnerJoker.id);
                if (!alreadyHas) {
                    satrancData.myJokers.push(winnerJoker);
                }
                // ✨ Kasa jokerini used listesine ekle (silik göstermek için)
                if (!satrancData.usedJokers) satrancData.usedJokers = [];
                if (!satrancData.usedJokers.includes("kasa")) {
                    satrancData.usedJokers.push("kasa");
                }
                renderMyJokers();
            }
        };

        const closeBtn = document.getElementById("satrancKasaCloseBtn");
        if (closeBtn) {
            closeBtn.classList.remove("hidden");
            closeBtn.onclick = doClose;
        }

        // ✨ 3 saniye geri sayım + otomatik kapanış
        let cd = 3;
        const cdEl = document.getElementById("satrancKasaCountdown");
        if (cdEl) cdEl.textContent = ` (${cd})`;

        const cdInterval = setInterval(() => {
            cd--;
            if (cdEl) cdEl.textContent = cd > 0 ? ` (${cd})` : "";
            if (cd <= 0) {
                clearInterval(cdInterval);
                doClose();
            }
        }, 1000);

        // Butona basılırsa geri sayımı durdur
        if (closeBtn) {
            const origClick = closeBtn.onclick;
            closeBtn.onclick = () => {
                clearInterval(cdInterval);
                doClose();
            };
        }
    }, 6000);
}

// ==========================================
// RULET ANİMASYONU - Kumarhane Tarzı (Kırmızı-Siyah Çark + Zıplayan Top)
// ==========================================
function showRuletAnimation(msg) {
    let overlay = document.getElementById("satrancRuletOverlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "satrancRuletOverlay";
    overlay.className = "satrancRuletOverlay";
    document.body.appendChild(overlay);

    // 4 farklı sonuç
    const outcomes = [
        { type: "opp_lose_piece", icon: "🎯", label: "Rakip taş kaybeder", color: "#51cf66" },
        { type: "self_lose_piece", icon: "💀", label: "Sen taş kaybedersin", color: "#ff6b6b" },
        { type: "extra_turn", icon: "🔁", label: "Ekstra hamle", color: "#4dabf7" },
        { type: "skip_opp", icon: "⏭️", label: "Rakip atlanır", color: "#ffd43b" }
    ];

    const winnerIdx = outcomes.findIndex(o => o.type === msg.rulet_outcome);
    
    // ✨ Kumarhane rulet: 16 hücre (4 sonuç x 4 kez tekrar)
    const cellCount = 16;
    const cellsPerOutcome = cellCount / outcomes.length; // 4
    const anglePerCell = 360 / cellCount; // 22.5 derece
    
    // Renk paterni: kırmızı-siyah-kırmızı-siyah
    const cellColors = ["#c92a2a", "#1a1a1a"]; // Kırmızı, Siyah
    
    // 16 hücrenin outcome atamaları (dağıtılmış)
    // outcome 0: 0, 4, 8, 12
    // outcome 1: 1, 5, 9, 13
    // outcome 2: 2, 6, 10, 14
    // outcome 3: 3, 7, 11, 15
    const cellOutcomes = [];
    for (let i = 0; i < cellCount; i++) {
        cellOutcomes.push(i % outcomes.length);
    }
    
    // Kazanan hücre bul (winnerIdx * 4. sırada olan hücre - randomize et)
    const winnerCells = [];
    for (let i = 0; i < cellCount; i++) {
        if (cellOutcomes[i] === winnerIdx) winnerCells.push(i);
    }
    const winnerCellIdx = winnerCells[Math.floor(Math.random() * winnerCells.length)];
    
    // Rulet çarkı SVG oluştur
    let cellsHtml = "";
    let numbersHtml = "";
    for (let i = 0; i < cellCount; i++) {
        const startAngle = i * anglePerCell;
        const endAngle = (i + 1) * anglePerCell;
        const outcome = outcomes[cellOutcomes[i]];
        const color = cellColors[i % 2]; // Kırmızı-siyah paterni
        
        // Dış hücre (renk + icon)
        const x1Out = 175 + 155 * Math.cos((startAngle - 90) * Math.PI / 180);
        const y1Out = 175 + 155 * Math.sin((startAngle - 90) * Math.PI / 180);
        const x2Out = 175 + 155 * Math.cos((endAngle - 90) * Math.PI / 180);
        const y2Out = 175 + 155 * Math.sin((endAngle - 90) * Math.PI / 180);
        const x1In = 175 + 95 * Math.cos((startAngle - 90) * Math.PI / 180);
        const y1In = 175 + 95 * Math.sin((startAngle - 90) * Math.PI / 180);
        const x2In = 175 + 95 * Math.cos((endAngle - 90) * Math.PI / 180);
        const y2In = 175 + 95 * Math.sin((endAngle - 90) * Math.PI / 180);
        
        cellsHtml += `
            <path d="M ${x1Out} ${y1Out} A 155 155 0 0 1 ${x2Out} ${y2Out} L ${x2In} ${y2In} A 95 95 0 0 0 ${x1In} ${y1In} Z"
                  fill="${color}" stroke="#ffd700" stroke-width="1.5"/>
        `;
        
        // Icon
        const midAngle = (startAngle + endAngle) / 2 - 90;
        const iconX = 175 + 125 * Math.cos(midAngle * Math.PI / 180);
        const iconY = 175 + 125 * Math.sin(midAngle * Math.PI / 180);
        
        numbersHtml += `
            <text x="${iconX}" y="${iconY}" fill="white" font-size="20" text-anchor="middle"
                  dominant-baseline="middle" font-weight="bold"
                  transform="rotate(${startAngle + anglePerCell/2}, ${iconX}, ${iconY})"
                  style="text-shadow: 0 0 3px rgba(0,0,0,0.9);">
                ${outcome.icon}
            </text>
        `;
    }
    
    // Kazanan hücre için çark açısı (çark sağa dönecek, kazanan yukarıda durmalı)
    // Çark: -CCW (saat yönü tersi = negatif)
    // Kazanan hücre indeksi × angle = o hücrenin başlangıç açısı
    // Ok yukarıda (0 derece), ortalamak için angleForCenter = i × anglePerCell + anglePerCell/2
    const winnerCenterAngle = winnerCellIdx * anglePerCell + anglePerCell / 2;
    const wheelSpins = 8; // 8 tam tur döner
    const finalWheelAngle = wheelSpins * 360 + (360 - winnerCenterAngle); // Ok yukarıda kalsın diye tersine
    
    // Top ise çarkın TERS yönüne döner
    const ballSpins = 10;
    const finalBallAngle = -(ballSpins * 360) + winnerCenterAngle; // Aynı hücreye gitsin
    
    overlay.innerHTML = `
        <div class="satrancRuletCasinoBox">
            <div class="satrancRuletHeader">
                <h1 class="satrancRuletCasinoTitle">🎰 RULET</h1>
                <p class="satrancRuletCasinoUser">${msg.user_name} çeviriyor...</p>
            </div>
            
            <div class="satrancRuletCasinoWrap">
                <!-- Ana çark -->
                <div class="satrancRuletWheelContainer">
                    <svg id="satrancRuletWheelSvg" width="350" height="350" viewBox="0 0 350 350"
                         style="transform: rotate(0deg); transition: transform 5s cubic-bezier(0.15, 0.7, 0.1, 1);">
                        <!-- Dış altın halka -->
                        <circle cx="175" cy="175" r="170" fill="none" stroke="#ffd700" stroke-width="4"/>
                        <circle cx="175" cy="175" r="160" fill="none" stroke="#8b6914" stroke-width="2"/>
                        
                        <!-- Hücreler -->
                        ${cellsHtml}
                        
                        <!-- İç iç halkalar -->
                        <circle cx="175" cy="175" r="95" fill="none" stroke="#ffd700" stroke-width="2"/>
                        <circle cx="175" cy="175" r="85" fill="#2d1810" stroke="#8b6914" stroke-width="1"/>
                        
                        <!-- Merkez göbek -->
                        <circle cx="175" cy="175" r="40" fill="#1a0f08" stroke="#ffd700" stroke-width="3"/>
                        <circle cx="175" cy="175" r="30" fill="#3d2817" stroke="#8b6914" stroke-width="1"/>
                        <text x="175" y="175" fill="#ffd700" font-size="24" text-anchor="middle" 
                              dominant-baseline="middle" font-weight="bold">🎰</text>
                        
                        <!-- İkonlar (dönerken görsünler diye ayrı grup) -->
                        ${numbersHtml}
                    </svg>
                    
                    <!-- Top (ayrı animasyon) -->
                    <div class="satrancRuletBallTrack" id="satrancRuletBallTrack">
                        <div class="satrancRuletBall" id="satrancRuletBall"></div>
                    </div>
                </div>
                
                <!-- Kazananın bilgi kutusu -->
                <div id="satrancRuletCasinoResult" class="satrancRuletCasinoResult">
                    <div class="satrancRuletCasinoWinIcon">${outcomes[winnerIdx].icon}</div>
                    <div class="satrancRuletCasinoWinLabel" style="color:${outcomes[winnerIdx].color};">
                        ${msg.rulet_label}
                    </div>
                    <div class="satrancRuletCasinoWinDetail">
                        ${msg.rulet_result || ""}
                    </div>
                </div>
            </div>
            
            <button class="bigBtn greenBtn satrancRuletCloseBtn" id="satrancRuletCloseBtn">Tamam</button>
        </div>
    `;
    
    // Kapat butonu event
    setTimeout(() => {
        const closeBtn = document.getElementById("satrancRuletCloseBtn");
        if (closeBtn) {
            closeBtn.onclick = () => {
                overlay.style.transition = "opacity 0.4s";
                overlay.style.opacity = "0";
                setTimeout(() => overlay.remove(), 450);
            };
        }
    }, 100);
    
    // ✨ Rulet sesi çal
    playSatrancSound("rulet");
    
    // Çark ve top animasyonu başlat
    setTimeout(() => {
        const wheelSvg = document.getElementById("satrancRuletWheelSvg");
        const ballTrack = document.getElementById("satrancRuletBallTrack");
        
        if (wheelSvg) {
            wheelSvg.style.transform = `rotate(${finalWheelAngle}deg)`;
        }
        
        // Top ilk 3 saniye hızlı, sonra yavaşlar
        if (ballTrack) {
            ballTrack.style.transition = "transform 5s cubic-bezier(0.15, 0.7, 0.1, 1)";
            ballTrack.style.transform = `rotate(${finalBallAngle}deg)`;
        }
        
        console.log("[RULET] Çark döndü:", finalWheelAngle, "Top döndü:", finalBallAngle);
    }, 200);
    
    // Sonuç kutusunu 5.5 saniyede göster (çark durunca)
    setTimeout(() => {
        const resultBox = document.getElementById("satrancRuletCasinoResult");
        if (resultBox) resultBox.classList.add("show");
        
        // Kazanan hücreyi vurgula
        const wheelSvg = document.getElementById("satrancRuletWheelSvg");
        if (wheelSvg) {
            wheelSvg.style.filter = "drop-shadow(0 0 25px " + outcomes[winnerIdx].color + ")";
        }
        
        // ✨ Topun altındaki hücreyi parlat (efekt)
        const ball = document.getElementById("satrancRuletBall");
        if (ball) {
            ball.style.boxShadow = "0 0 30px " + outcomes[winnerIdx].color + ", 0 0 60px " + outcomes[winnerIdx].color;
            ball.style.animation = "ballWinPulse 0.6s ease-in-out infinite alternate";
        }
    }, 5500);
    
    // 10 saniye sonra otomatik kapat
    setTimeout(() => {
        if (overlay && overlay.parentNode) {
            overlay.style.transition = "opacity 0.4s";
            overlay.style.opacity = "0";
            setTimeout(() => overlay.remove(), 450);
        }
    }, 10000);
}

// ==========================================
// BOMBA PATLAMA ANİMASYONU
// ==========================================
function playExplosionAnimation(square) {
    const boardEl = document.getElementById("satrancBoard");
    if (!boardEl) return;

    const squareEl = boardEl.querySelector(`.square-${square}`);
    if (!squareEl) return;

    const rect = squareEl.getBoundingClientRect();

    // ✨ Sadece küçük patlama emojisi + kare flash
    const explosion = document.createElement("div");
    explosion.className = "satrancBombaExplosion";
    explosion.textContent = "💥";
    explosion.style.left = (rect.left + rect.width / 2) + "px";
    explosion.style.top = (rect.top + rect.height / 2) + "px";
    document.body.appendChild(explosion);

    // Kareyi flash yap
    squareEl.classList.add("bombaFlash");
    setTimeout(() => squareEl.classList.remove("bombaFlash"), 600);
    setTimeout(() => explosion.remove(), 700);
}

// ==========================================
// GÖRÜNMEZ TAŞ - Sadece küçük 🧙 puf efekti
// (Kendi taşımız normal görünmeye devam eder, badge kartta zaten var)
// ==========================================
function playInvisibleFadeAnimation(square) {
    const boardEl = document.getElementById("satrancBoard");
    if (!boardEl) return;
    const squareEl = boardEl.querySelector(`.square-${square}`);
    if (!squareEl) return;

    const puf = document.createElement("div");
    puf.className = "satrancInvisiblePuf";
    puf.textContent = "🧙";
    const rect = squareEl.getBoundingClientRect();
    puf.style.left = (rect.left + rect.width / 2) + "px";
    puf.style.top = (rect.top + rect.height / 2) + "px";
    document.body.appendChild(puf);
    setTimeout(() => puf.remove(), 1000);
}

function playPieceTransformAnimation(square, label, icon) {
    const boardEl = document.getElementById("satrancBoard");
    if (!boardEl) return;

    const squareEl = boardEl.querySelector(`.square-${square}`);
    if (!squareEl) return;

    const rect = squareEl.getBoundingClientRect();
    const pieceImg = squareEl.querySelector("img");

    if (pieceImg) {
        pieceImg.style.transition = "transform 0.45s ease, filter 0.45s ease, opacity 0.45s ease";
        pieceImg.style.transform = "scale(1.22)";
        pieceImg.style.filter = "drop-shadow(0 0 12px rgba(255, 212, 59, 0.95))";
        setTimeout(() => {
            pieceImg.style.transform = "";
            pieceImg.style.filter = "";
        }, 480);
    }

    squareEl.style.transition = "box-shadow 0.45s ease";
    squareEl.style.boxShadow = "inset 0 0 0 3px rgba(255,212,59,0.95), 0 0 22px rgba(255,212,59,0.55)";
    setTimeout(() => {
        squareEl.style.boxShadow = "";
    }, 520);

    const fx = document.createElement("div");
    fx.textContent = icon || "♛";
    fx.style.position = "fixed";
    fx.style.left = (rect.left + rect.width / 2) + "px";
    fx.style.top = (rect.top + rect.height / 2) + "px";
    fx.style.transform = "translate(-50%, -50%) scale(0.5)";
    fx.style.fontSize = "38px";
    fx.style.fontWeight = "bold";
    fx.style.pointerEvents = "none";
    fx.style.zIndex = "999999";
    fx.style.textShadow = "0 0 18px rgba(255,212,59,0.95)";
    fx.style.transition = "transform 0.5s ease, opacity 0.5s ease";
    fx.style.opacity = "0";
    document.body.appendChild(fx);

    const text = document.createElement("div");
    text.textContent = label || "Dönüştü!";
    text.style.position = "fixed";
    text.style.left = (rect.left + rect.width / 2) + "px";
    text.style.top = (rect.top + rect.height / 2 + 34) + "px";
    text.style.transform = "translate(-50%, -50%) scale(0.85)";
    text.style.fontSize = "14px";
    text.style.fontWeight = "700";
    text.style.color = "#ffd43b";
    text.style.pointerEvents = "none";
    text.style.zIndex = "999999";
    text.style.textShadow = "0 0 12px rgba(0,0,0,0.9)";
    text.style.transition = "transform 0.5s ease, opacity 0.5s ease";
    text.style.opacity = "0";
    document.body.appendChild(text);

    requestAnimationFrame(() => {
        fx.style.opacity = "1";
        fx.style.transform = "translate(-50%, -50%) scale(1.25) rotate(10deg)";
        text.style.opacity = "1";
        text.style.transform = "translate(-50%, -50%) scale(1)";
    });

    setTimeout(() => {
        fx.style.opacity = "0";
        fx.style.transform = "translate(-50%, -50%) scale(1.8) rotate(-8deg)";
        text.style.opacity = "0";
        text.style.transform = "translate(-50%, -50%) scale(1.06)";
    }, 320);

    setTimeout(() => {
        if (fx.parentNode) fx.remove();
        if (text.parentNode) text.remove();
    }, 900);
}

// ✨ Görünmez taş YENİLDİ - 3 kez yanıp sön, sonra kaybol
function playInvisibleRevealKillAnimation(square, onDone, pieceType, pieceColor) {
    const boardEl = document.getElementById("satrancBoard");
    if (!boardEl) { if (onDone) onDone(); return; }
    const squareEl = boardEl.querySelector(`.square-${square}`);
    if (!squareEl) { if (onDone) onDone(); return; }

    // 🧙 Puf: "Yakalandın!"
    const puf = document.createElement("div");
    puf.className = "satrancInvisiblePuf";
    puf.textContent = "🧙";
    const rect = squareEl.getBoundingClientRect();
    puf.style.left = (rect.left + rect.width / 2) + "px";
    puf.style.top = (rect.top + rect.height / 2) + "px";
    document.body.appendChild(puf);

    // ✨ Yiyen taraf için: taş orada olmayabilir (backend gizlemişti) → geçici olarak yerleştir
    let pieceImg = squareEl.querySelector("img");
    let createdTempImg = false;
    if (!pieceImg && pieceType && pieceColor) {
        const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
        const pieceCode = `${pieceColor}${typeMap[pieceType] || "P"}`;
        pieceImg = document.createElement("img");
        pieceImg.className = "piece-417db";
        pieceImg.src = `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`;
        pieceImg.style.position = "absolute";
        pieceImg.style.top = "0";
        pieceImg.style.left = "0";
        pieceImg.style.width = "100%";
        pieceImg.style.height = "100%";
        pieceImg.style.zIndex = "99";
        squareEl.appendChild(pieceImg);
        createdTempImg = true;
    }

    if (!pieceImg) { if (puf.parentNode) puf.remove(); if (onDone) onDone(); return; }

    // Taş şu an %30 opacity gösteriliyor (sahibi için) veya hiç görünmüyordu (rakibe göre)
    pieceImg.style.transition = "opacity 0.2s ease";
    pieceImg.style.opacity = "1";

    // 3 kez yanıp sön: 0.2s -> 1.0, 0.2s -> 0.2, 0.2s -> 1.0, ...
    let blinkCount = 0;
    const maxBlinks = 6;  // 3 tam yanıp-sönme
    const blinkInterval = setInterval(() => {
        if (blinkCount >= maxBlinks) {
            clearInterval(blinkInterval);
            // Son olarak yok ol
            pieceImg.style.transition = "opacity 0.3s ease, transform 0.3s ease";
            pieceImg.style.opacity = "0";
            pieceImg.style.transform = "scale(0.5)";
            setTimeout(() => {
                if (puf.parentNode) puf.remove();
                // Geçici oluşturulan img'i sil (board update onu ezmesin)
                if (createdTempImg && pieceImg.parentNode) pieceImg.remove();
                if (onDone) onDone();
            }, 400);
            return;
        }
        pieceImg.style.opacity = (blinkCount % 2 === 0) ? "0.2" : "1";
        blinkCount++;
    }, 200);
}

// ✨ Rulet için özel taş silme animasyonu
function _animateRuletPieceRemoval(oldFen, newFen, onDone) {
    try {
        const oldGame = new Chess(oldFen);
        const newGame = new Chess(newFen);
        
        // Hangi kare değişti bul (eskiden taş vardı, yenide yok)
        let removedSquare = null;
        let removedPiece = null;
        
        const files = "abcdefgh";
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const sq = files[c] + (r + 1);
                const oldP = oldGame.get(sq);
                const newP = newGame.get(sq);
                
                if (oldP && !newP) {
                    removedSquare = sq;
                    removedPiece = oldP;
                    break;
                }
            }
            if (removedSquare) break;
        }
        
        if (!removedSquare) {
            console.log("[RULET ANIM] Silinen taş bulunamadı");
            if (onDone) onDone();
            return;
        }
        
        console.log(`[RULET ANIM] Silinecek taş: ${removedSquare} (${removedPiece.color}${removedPiece.type})`);
        
        const $sq = $(`#satrancBoard .square-${removedSquare}`);
        const $img = $sq.find("img");
        
        if (!$img.length) {
            console.log("[RULET ANIM] Taş img bulunamadı");
            if (onDone) onDone();
            return;
        }
        
        // ✨ Kırmızı arka plan flash + parlama
        $sq.css({
            "transition": "background-color 0.3s ease, box-shadow 0.3s ease",
            "background-color": "rgba(255, 107, 107, 0.4)",
            "box-shadow": "inset 0 0 20px rgba(255, 50, 50, 0.8)"
        });
        
        // ✨ Taşı büyüt + parlat (0.4 sn)
        $img.css({
            "transition": "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.4s ease",
            "transform": "scale(1.3)",
            "filter": "drop-shadow(0 0 15px rgba(255, 100, 100, 0.9)) brightness(1.3)",
            "z-index": "999",
            "position": "relative"
        });
        
        // ✨ Kırmızı X emoji üstte
        const rect = $sq[0].getBoundingClientRect();
        const cross = document.createElement("div");
        cross.textContent = "✖";
        cross.style.cssText = `
            position: fixed;
            left: ${rect.left + rect.width / 2}px;
            top: ${rect.top + rect.height / 2}px;
            transform: translate(-50%, -50%) scale(0);
            font-size: 40px;
            color: #ff3838;
            font-weight: bold;
            text-shadow: 0 0 15px rgba(255, 0, 0, 0.9), 0 0 30px rgba(255, 0, 0, 0.6);
            z-index: 9999;
            pointer-events: none;
            transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease;
        `;
        document.body.appendChild(cross);
        
        // 0.1 sn sonra X büyüsün
        setTimeout(() => {
            cross.style.transform = "translate(-50%, -50%) scale(1.5) rotate(20deg)";
        }, 100);
        
        // 0.5 sn sonra taş küçülüp kaybolmaya başlasın
        setTimeout(() => {
            $img.css({
                "transition": "transform 0.5s cubic-bezier(0.55, -0.15, 0.35, 1.15), opacity 0.5s ease, filter 0.5s ease",
                "transform": "scale(0)",
                "opacity": "0",
                "filter": "blur(3px)"
            });
            
            // X emoji da kaybolsun
            cross.style.transform = "translate(-50%, -50%) scale(2) rotate(45deg)";
            cross.style.opacity = "0";
        }, 500);
        
        // 1.1 sn sonra kare arka planı normal
        setTimeout(() => {
            $sq.css({
                "background-color": "",
                "box-shadow": ""
            });
        }, 1100);
        
        // 1.2 sn sonra X emoji sil
        setTimeout(() => {
            if (cross.parentNode) cross.remove();
        }, 1200);
        
        // 1.3 sn sonra callback (board update)
        setTimeout(() => {
            if (onDone) onDone();
        }, 1300);
        
    } catch (e) {
        console.warn("[RULET ANIM HATA]", e);
        if (onDone) onDone();
    }
}

// Görünmez taş süresi bittiğinde - kısa ✨ efekti
function playInvisibleReappearAnimation(square) {
    const boardEl = document.getElementById("satrancBoard");
    if (!boardEl) return;
    const squareEl = boardEl.querySelector(`.square-${square}`);
    if (!squareEl) return;

    const sparkle = document.createElement("div");
    sparkle.className = "satrancInvisiblePuf";
    sparkle.textContent = "✨";
    const rect = squareEl.getBoundingClientRect();
    sparkle.style.left = (rect.left + rect.width / 2) + "px";
    sparkle.style.top = (rect.top + rect.height / 2) + "px";
    document.body.appendChild(sparkle);
    setTimeout(() => sparkle.remove(), 900);
}

function applyAjanDisguiseVisuals(effects) {
    const disguised = (effects && effects.ajan_disguised) ? effects.ajan_disguised : {};
    satrancData.ajanDisguised = disguised;

    // Eski ajan görsellerini temizle (SADECE ajan'a ait olanları)
    $("#satrancBoard .squareAjanCharge").remove();
    $("#satrancBoard .ajanSquareEmoji").remove();

    // ✨ Ajan yoksa (sahibi değilim) çık — rakibe zaten sahte FEN gönderiliyor
    if (Object.keys(disguised).length === 0) {
        return;
    }

    Object.keys(disguised).forEach(square => {
        const data = disguised[square];
        const fakeColor = (typeof data === "object") ? data.color : data;
        const turnsLeft = (typeof data === "object") ? data.turns : 6;

        const piece = satrancData.game ? satrancData.game.get(square) : null;
        if (!piece) return;

        const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
        const pieceCode = `${fakeColor}${typeMap[piece.type] || "P"}`;
        const $sq = $(`#satrancBoard .square-${square}`);
        const $img = $sq.find("img");

        if ($img.length) {
            $img.attr("src", `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`);
        }

        // Sol üstte 🕵️ emoji
        $sq.append(`<div class="ajanSquareEmoji" title="Ajan taş">🕵️</div>`);

        // Sağ üstte şarj çubukları (max 6 diş)
        const maxTurns = 6;
        const colorClass = `ajanCharge-${Math.min(turnsLeft, 6)}`;
        let bars = "";
        for (let i = 0; i < maxTurns; i++) {
            const filled = i < turnsLeft ? "filled" : "empty";
            bars += `<div class="squareChargeBar ${filled}"></div>`;
        }
        $sq.append(`<div class="squareAjanCharge ${colorClass}" title="Ajan kalan: ${turnsLeft}">${bars}</div>`);
    });
}

// ==========================================
// MİNİ ÇARKIFELEK (Taş silme için)
// ==========================================
function showMiniCarkifelek(msg) {
    let overlay = document.getElementById("satrancMiniCarkOverlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "satrancMiniCarkOverlay";
    overlay.className = "satrancCarkOverlay";
    document.body.appendChild(overlay);

    const pieces = msg.pieces || [];
    if (pieces.length === 0) {
        overlay.remove();
        return;
    }

    // Kurban indeksi
    const winnerIdx = pieces.findIndex(p =>
        p.square === msg.victim_square && p.type === msg.victim_type
    );

    const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
    const pieceColors = {
        p: "#8e8e8e", r: "#4dabf7", n: "#ffa94d",
        b: "#c084fc", q: "#ffd43b", n: "#ffa94d"
    };

    // Renk paleti (dilim başına)
    const palette = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
                     "#1abc9c", "#e67e22", "#34495e", "#16a085", "#c0392b",
                     "#8e44ad", "#27ae60", "#d35400", "#7f8c8d", "#2980b9"];

    const anglePerSlice = 360 / pieces.length;
    let sliceHtml = "";
    pieces.forEach((p, i) => {
        const color = palette[i % palette.length];
        const startAngle = i * anglePerSlice;
        const endAngle = (i + 1) * anglePerSlice;
        const largeArc = anglePerSlice > 180 ? 1 : 0;
        const x1 = 175 + 165 * Math.cos((startAngle - 90) * Math.PI / 180);
        const y1 = 175 + 165 * Math.sin((startAngle - 90) * Math.PI / 180);
        const x2 = 175 + 165 * Math.cos((endAngle - 90) * Math.PI / 180);
        const y2 = 175 + 165 * Math.sin((endAngle - 90) * Math.PI / 180);
        const midAngle = (startAngle + endAngle) / 2 - 90;
        const textX = 175 + 105 * Math.cos(midAngle * Math.PI / 180);
        const textY = 175 + 105 * Math.sin(midAngle * Math.PI / 180);

        const pieceCode = `${p.color}${typeMap[p.type] || "P"}`;
        const imgSize = pieces.length <= 8 ? 42 : pieces.length <= 16 ? 32 : 24;

        sliceHtml += `
            <path d="M 175 175 L ${x1} ${y1} A 165 165 0 ${largeArc} 1 ${x2} ${y2} Z"
                  fill="${color}" stroke="#1a1e2e" stroke-width="1.5"/>
            <image href="/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png"
                   x="${textX - imgSize/2}" y="${textY - imgSize/2}"
                   width="${imgSize}" height="${imgSize}"
                   transform="rotate(${startAngle + anglePerSlice/2}, ${textX}, ${textY})" />
            <text x="${textX}" y="${textY + imgSize/2 + 12}"
                  fill="white" font-size="10" text-anchor="middle" font-weight="bold"
                  transform="rotate(${startAngle + anglePerSlice/2}, ${textX}, ${textY + imgSize/2 + 12})">
                ${p.square}
            </text>
        `;
    });

    const targetAngle = -(winnerIdx * anglePerSlice + anglePerSlice / 2);
    const spinAmount = 360 * 6 + targetAngle;

    overlay.innerHTML = `
        <div class="satrancCarkBox">
            <h1 style="color:#ff6b6b; margin:0 0 10px 0;">💀 TAŞ KATLİAMI</h1>
            <p style="color:#adb5bd; margin:0 0 15px 0;">
                ${msg.user_name} - Çark taşlarından birini seçiyor...
            </p>

            <div class="satrancCarkWrap">
                <div class="satrancCarkPointer">▼</div>
                <svg id="satrancMiniCarkSvg" width="350" height="350" viewBox="0 0 350 350"
                     style="transform: rotate(0deg); transition: transform 4s cubic-bezier(0.17, 0.67, 0.16, 0.99);">
                    ${sliceHtml}
                    <circle cx="175" cy="175" r="22" fill="#ff6b6b" stroke="#1a1e2e" stroke-width="3"/>
                </svg>
            </div>

            <div id="satrancMiniCarkResult" style="margin-top:20px; opacity:0; transition: opacity 0.5s;">
                <div style="font-size:22px; color:#ff6b6b; font-weight:bold;">
                    💥 ${msg.victim_name} (${msg.victim_square.toUpperCase()}) silindi!
                </div>
            </div>
        </div>
    `;

    // Animasyonu başlat
    setTimeout(() => {
        const svg = document.getElementById("satrancMiniCarkSvg");
        if (svg) svg.style.transform = `rotate(${spinAmount}deg)`;
    }, 100);

    // Sonucu göster
    setTimeout(() => {
        const result = document.getElementById("satrancMiniCarkResult");
        if (result) result.style.opacity = "1";
    }, 4200);

    // 5 saniye sonra kapat
    setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.remove();
    }, 5500);
}

// ==========================================
// YER DEĞİŞTİR ANİMASYONU (2 taş yer değişiyor)
// ==========================================
function _animateYerDegistir(sq1, sq2) {
    const boardEl = document.getElementById("satrancBoard");
    if (!boardEl) return;
    const $sq1 = $(`#satrancBoard .square-${sq1}`);
    const $sq2 = $(`#satrancBoard .square-${sq2}`);
    if (!$sq1.length || !$sq2.length) return;

    const $img1 = $sq1.find("img").first();
    const $img2 = $sq2.find("img").first();
    if (!$img1.length || !$img2.length) return;

    const rect1 = $sq1[0].getBoundingClientRect();
    const rect2 = $sq2[0].getBoundingClientRect();

    // Delta: hedefe gitmek için ne kadar hareket
    const dx = rect2.left - rect1.left;
    const dy = rect2.top - rect1.top;

    // İki taşa geçici transform + transition ver
    $img1.css({
        "transition": "transform 0.7s cubic-bezier(0.68, -0.55, 0.27, 1.55), filter 0.3s",
        "transform": `translate(${dx}px, ${dy}px) scale(1.15)`,
        "filter": "drop-shadow(0 0 12px rgba(192,132,252,0.9))",
        "z-index": "9999",
        "position": "relative"
    });
    $img2.css({
        "transition": "transform 0.7s cubic-bezier(0.68, -0.55, 0.27, 1.55), filter 0.3s",
        "transform": `translate(${-dx}px, ${-dy}px) scale(1.15)`,
        "filter": "drop-shadow(0 0 12px rgba(255,212,59,0.9))",
        "z-index": "9998",
        "position": "relative"
    });

    // Puf efekti (ortada)
    const midX = (rect1.left + rect2.left) / 2 + rect1.width / 2;
    const midY = (rect1.top + rect2.top) / 2 + rect1.height / 2;
    const puf = document.createElement("div");
    puf.className = "satrancInvisiblePuf";
    puf.textContent = "🌀";
    puf.style.left = midX + "px";
    puf.style.top = midY + "px";
    document.body.appendChild(puf);
    setTimeout(() => puf.remove(), 900);

    // Işınlanma sesi
    try { playSatrancSound("isinlanma"); } catch(e) {}
}

// ==========================================
// ÇARKIFELEK ANİMASYONU
// ==========================================
function showCarkifelekAnimation(msg) {
    // Overlay oluştur
    let overlay = document.getElementById("satrancCarkOverlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "satrancCarkOverlay";
    overlay.className = "satrancCarkOverlay";
    document.body.appendChild(overlay);

    const dilimler = msg.all_dilimler || [];
    const winnerIdx = dilimler.findIndex(d => d.id === msg.dilim_id);

    // 13 dilim SVG oluştur
    const anglePerSlice = 360 / dilimler.length;
    let sliceHtml = "";
    dilimler.forEach((d, i) => {
        const startAngle = i * anglePerSlice;
        const endAngle = (i + 1) * anglePerSlice;
        const largeArc = anglePerSlice > 180 ? 1 : 0;
        const x1 = 150 + 145 * Math.cos((startAngle - 90) * Math.PI / 180);
        const y1 = 150 + 145 * Math.sin((startAngle - 90) * Math.PI / 180);
        const x2 = 150 + 145 * Math.cos((endAngle - 90) * Math.PI / 180);
        const y2 = 150 + 145 * Math.sin((endAngle - 90) * Math.PI / 180);
        const midAngle = (startAngle + endAngle) / 2 - 90;
        const textX = 150 + 90 * Math.cos(midAngle * Math.PI / 180);
        const textY = 150 + 90 * Math.sin(midAngle * Math.PI / 180);

        sliceHtml += `
            <path d="M 150 150 L ${x1} ${y1} A 145 145 0 ${largeArc} 1 ${x2} ${y2} Z"
                  fill="${d.color}" stroke="#1a1e2e" stroke-width="2"/>
            <text x="${textX}" y="${textY}" fill="white" font-size="20" text-anchor="middle"
                  transform="rotate(${startAngle + anglePerSlice/2}, ${textX}, ${textY})">
                ${d.icon}
            </text>
        `;
    });

    // Çarkın winner dilimine dönmesi için hesap
    // Ok yukarıda (0°), kazanan dilimin ortasına dönmeli
    const targetAngle = -(winnerIdx * anglePerSlice + anglePerSlice / 2);
    const spinAmount = 360 * 5 + targetAngle; // 5 tam tur + hedef

    overlay.innerHTML = `
        <div class="satrancCarkBox">
            <h1 style="color:#ffd43b; margin:0 0 10px 0;">🎡 ÇARKIFELEK</h1>
            <p style="color:#adb5bd; margin:0 0 15px 0;">
                ${msg.user_name} çarkı çevirdi...
            </p>

            <div class="satrancCarkWrap">
                <div class="satrancCarkPointer">▼</div>
                <svg id="satrancCarkSvg" width="300" height="300" viewBox="0 0 300 300"
                     style="transform: rotate(0deg); transition: transform 3.2s cubic-bezier(0.17, 0.67, 0.16, 0.99);">
                    ${sliceHtml}
                    <circle cx="150" cy="150" r="20" fill="#ffd43b" stroke="#1a1e2e" stroke-width="3"/>
                </svg>
            </div>

            <div id="satrancCarkResult" style="margin-top:20px; opacity:0; transition: opacity 0.5s;">
                <div style="font-size:32px; margin-bottom:5px;">${msg.dilim_icon}</div>
                <div style="font-size:22px; color:${msg.dilim_color}; font-weight:bold;">
                    ${msg.dilim_label}
                </div>
            </div>
        </div>
    `;

    // Animasyonu başlat
    setTimeout(() => {
        const svg = document.getElementById("satrancCarkSvg");
        if (svg) svg.style.transform = `rotate(${spinAmount}deg)`;
    }, 100);

    // Sonucu göster
    setTimeout(() => {
        const result = document.getElementById("satrancCarkResult");
        if (result) result.style.opacity = "1";
    }, 3400);

    // 6 saniye sonra kapat
    setTimeout(() => {
        if (overlay && overlay.parentNode) overlay.remove();
    }, 6500);
}

// ==========================================
// LOBBY
// ==========================================
function updateSatrancLobby() {
    if (window.setupRoomCodeAndLink && !_satrancRoomHelper) {
        _satrancRoomHelper = window.setupRoomCodeAndLink({
            codeTextId: "satrancRoomCodeText",
            codeEyeBtnId: "satrancRoomCodeEyeBtn",
            copyHintId: "satrancCopyHint",
            linkTextId: "satrancInviteLinkText",
            linkEyeBtnId: "satrancInviteLinkEyeBtn",
            linkHintId: "satrancInviteLinkHint",
            getRoomCode: () => satrancData.roomCode,
            getPlayerId: () => satrancData.playerId
        });
    }
    if (_satrancRoomHelper) {
        _satrancRoomHelper.renderCode();
        _satrancRoomHelper.renderLink();
    }

    const timeModeNames = {
        "bullet": "⚡ 1 Dakika", "blitz": "🔥 3 Dakika",
        "rapid": "🏃 10 Dakika", "klasik": "🎩 30 Dakika", "suresiz": "♾️ Süresiz"
    };
    const pickModeNames = { "karisik": "🎲 Karışık", "manuel": "📋 Manuel" };

    const tmEl = document.getElementById("satrancLobbyTimeMode");
    const jcEl = document.getElementById("satrancLobbyJokerCount");
    const pmEl = document.getElementById("satrancLobbyPickMode");
    const psEl = document.getElementById("satrancLobbyPickSeconds");
    if (tmEl) tmEl.textContent = timeModeNames[satrancData.timeMode] || satrancData.timeMode;
    if (jcEl) jcEl.textContent = satrancData.jokerCount;
    if (pmEl) pmEl.textContent = pickModeNames[satrancData.pickMode] || satrancData.pickMode;
    if (psEl) psEl.textContent = satrancData.pickSeconds === 0 ? "♾️ Sınırsız" : satrancData.pickSeconds;

    const list = document.getElementById("satrancPlayersList");
    if (list) {
        list.innerHTML = "";
        satrancData.players.forEach(p => {
            const li = document.createElement("li");
            li.classList.add("playerRow");
            const nameCell = document.createElement("span");
            nameCell.className = "nameCell";
            nameCell.style.cssText = "flex:1; text-align:left; padding-left:10px;";
            const crown = p.id === 1 ? " 👑" : "";
            nameCell.textContent = p.id === satrancData.playerId
                ? `${p.id}. ${p.name} (Sen)${crown}`
                : `${p.id}. ${p.name}${crown}`;
            li.appendChild(nameCell);

            if (p.id !== satrancData.playerId && satrancData.playerId === 1) {
                const kickBtn = document.createElement("button");
                kickBtn.className = "kickBtnNew";
                kickBtn.textContent = "Oyuncuyu At";
                kickBtn.onclick = () => {
                    if (typeof openKickConfirm === "function") openKickConfirm(p.id, p.name);
                };
                li.appendChild(kickBtn);
            }
            li.classList.add(p.id === satrancData.playerId ? "playerMine" : "playerOpp");
            list.appendChild(li);
        });
    }

    const isHost = satrancData.playerId === 1;
    const startBtn = document.getElementById("satrancStartBtn");
    const settingsBtn = document.getElementById("satrancRoomSettingsBtn");
    const lobbyMsg = document.getElementById("satrancLobbyMsg");

    if (startBtn) startBtn.classList.toggle("hidden", !(isHost && satrancData.players.length === 2));
    if (settingsBtn) settingsBtn.classList.toggle("hidden", !isHost);
    if (window.updateChangeModeBtnVisibility) {
        window.updateChangeModeBtnVisibility("satrancChangeModeBtn", isHost);
    }

    if (lobbyMsg) {
        if (isHost && satrancData.players.length === 2) {
            lobbyMsg.textContent = "İki oyuncu hazır. Başlatabilirsin!";
            lobbyMsg.style.color = "#51cf66";
        } else if (isHost) {
            lobbyMsg.textContent = "Rakip bekleniyor...";
            lobbyMsg.style.color = "#ff6b6b";
        } else {
            lobbyMsg.textContent = "Host'un oyunu başlatması bekleniyor...";
            lobbyMsg.style.color = "#51cf66";
        }
    }
}

// ==========================================
// TAHTA KURULUM
// ==========================================
function initSatrancBoard(fen, myColor, legalMoves) {
    satrancData.legalMoves = legalMoves || [];
    satrancData.selectedSquare = null;

    // chess.js instance
    satrancData.game = new Chess(fen);

    // Highlight kareler
    function removeHighlights() {
        $("#satrancBoard .square-55d63").removeClass("highlight-from highlight-to highlight-legal");
    }

    function highlightLegal(square) {
        removeHighlights();
        $(`#satrancBoard .square-${square}`).addClass("highlight-from");
        satrancData.legalMoves.forEach(move => {
            if (move.startsWith(square)) {
                const to = move.slice(2, 4);
                $(`#satrancBoard .square-${to}`).addClass("highlight-legal");
            }
        });
    }

    // chessboard.js config
    const config = {
        draggable: false,  // ✨ Sürükle-bırak kapalı, sadece tıklama
        position: fen,
        orientation: myColor === "b" ? "black" : "white",
        pieceTheme: "/satranc_vendor/img/chesspieces/wikipedia/{piece}.png",
        moveSpeed: 500,        // Taş kaydırma hızı (ms) - yavaş ve akıcı
        snapSpeed: 100,
        snapbackSpeed: 200,
        appearSpeed: 200,
        trashSpeed: 150,

        // onDragStart ve onDrop kapalı - sadece tıklama modu

        // Hover ile hamle noktaları KAPALI - sadece tıklayınca gösterilecek
        // onMouseoverSquare ve onMouseoutSquare kaldırıldı

        };

    // Eğer önceki board varsa temizle
    if (satrancData.board) {
        satrancData.board.destroy();
        satrancData.board = null;
    }

    satrancData.board = Chessboard("satrancBoard", config);

    // ✨ Board boyutunu container'a fit et
    setTimeout(() => {
        if (satrancData.board) satrancData.board.resize();
    }, 50);

    // ✨ TIKLAMA İLE TAŞ SEÇ / HAMLE YAP (event delegation - img de dahil)
    setTimeout(() => {
        const boardEl = document.getElementById("satrancBoard");
        if (!boardEl) return;

        // Delegated click: img tıklansa bile parent square yakalanır
        $(boardEl).off("click.satrancMove").on("click.satrancMove", ".square-55d63", function(e) {
            e.preventDefault();
            e.stopPropagation();

            // Joker seçim modundaysa satrancMove tıklaması çalışmasın
            if (satrancPendingJoker) return;

            const square = $(this).attr("data-square");
            if (!square) {
                console.warn("[SATRANC] data-square yok:", this);
                return;
            }
            if (!satrancData.myColor) return;
            if (!satrancData.game) return;
            if (satrancData.game.game_over()) return;

            const myTurn = satrancData.game.turn() === satrancData.myColor;
            if (!myTurn) return;

            const piece = satrancData.game.get(square);

            // ✨ Aynı kareye 2. tıklama → seçimi iptal (efekt kontrollerinden ÖNCE)
            if (satrancData.selectedSquare === square) {
                clearSquareSelection();
                return;
            }

            // ✨ Donmuş taşa tıklanamaz - hiç hamle gösterilmesin
            const frozenSquares = Object.keys(satrancData.frozenDetails || {});
            if (frozenSquares.includes(square) && piece && piece.color === satrancData.myColor) {
                showToast("❄️ Donmuş!", "Bu taş donmuş, oynayamazsın.", null, "warning");
                clearSquareSelection();
                return;
            }

            // ✨ Kilitli taşa tıklanamaz - hiç hamle gösterilmesin
            const lockedSquaresCheck = Object.keys(satrancData.lockedDetails || {});
            if (lockedSquaresCheck.includes(square) && piece && piece.color === satrancData.myColor) {
                const turnsLeft = satrancData.lockedDetails[square] || 0;
                showToast("⛓️ Kilitli!", `Bu taş kilitli, hareket edemez (${turnsLeft} tur kaldı).`, null, "warning");
                clearSquareSelection();
                return;
            }

            // ✨ Hayalet kareye tıklanamaz (Yok Say jokeri aktif)
            const ignoredList = satrancData.ignoredSquares || [];
            if (ignoredList.includes(square)) {
                showToast("🚫 Hayalet!", "Bu kare hayalet - üzerinden geçilir ama tıklanamaz.", null, "warning");
                clearSquareSelection();
                return;
            }

            // Zaten bir taş seçiliyse ve tıklanan kare hedef mi?
            if (satrancData.selectedSquare) {
                // ✨ Kalkanlı kareye tıklama → hiçbir şey yapma (hamle gönderme)
                const shieldedNow = Object.keys(satrancData.shieldedDetails || {});
                if (shieldedNow.includes(square)) {
                    // Kalkanlı kareye tıklandı → seçimi iptal etme, sadece yoksay
                    return;
                }
				
				// ✨ HIZLI KAÇIŞ: şah vezir gibi gidiyorsa direkt gönder
                const _hkActive = satrancData._hizliKacisActive || false;
                const _selPiece = satrancData.game ? satrancData.game.get(satrancData.selectedSquare) : null;
                const _isMyKing = _selPiece && _selPiece.type === "k" && _selPiece.color === satrancData.myColor;
                const _hkUci = satrancData.selectedSquare + square;

                if (_hkActive && _isMyKing && satrancData.legalMoves.includes(_hkUci)) {
                    console.log("[HIZLI KACIS] Vezir gibi hamle gönderiliyor:", _hkUci);
                    sendMove(_hkUci);
                    clearSquareSelection();
                    return;
                }

                const uci = satrancData.selectedSquare + square;

                // ✨ Kilitli taş HİÇ hareket edemez - hedef kare seçimini iptal
                const lockedSquaresNow = Object.keys(satrancData.lockedDetails || {});
                if (lockedSquaresNow.includes(satrancData.selectedSquare)) {
                    // Zaten selectSquare içinde tıklama engellenmişti ama yine de güvenlik
                    return;
                }
                
                // ✨ Yavaşlatılmış taş SADECE 1 kare gidebilir
                const slowedSquaresNow = Object.keys(satrancData.slowedDetails || {});
                if (slowedSquaresNow.includes(satrancData.selectedSquare)) {
                    const filesSl = "abcdefgh";
                    const f1s = filesSl.indexOf(satrancData.selectedSquare[0]);
                    const r1s = parseInt(satrancData.selectedSquare[1], 10);
                    const f2s = filesSl.indexOf(square[0]);
                    const r2s = parseInt(square[1], 10);
                    const distSl = Math.max(Math.abs(f1s - f2s), Math.abs(r1s - r2s));
                    if (distSl > 1) {
                        showToast("🐌 Yavaşlatılmış!", "Bu taş sadece 1 kare gidebilir.", null, "warning");
                        return;
                    }
                }

                // Direkt eşleşme
                if (satrancData.legalMoves.includes(uci)) {
                    sendMove(uci);
                    clearSquareSelection();
                    return;
                }
                // Promosyon hamlesi (c7b8q gibi 5 karakter)
                const promoMove = satrancData.legalMoves.find(m => m.length === 5 && m.startsWith(uci));
                if (promoMove) {
                    // Backend'e sadece from+to gönder; backend promotion_needed dönecek
                    sendMove(uci);
                    clearSquareSelection();
                    return;
                }
                // Aynı kareye tekrar tıklandı → seçimi iptal
                if (satrancData.selectedSquare === square) {
                    clearSquareSelection();
                    return;
                }
                // Kendi başka taşına tıklandı → seçimi değiştir
                if (piece && piece.color === satrancData.myColor) {
                    clearSquareSelection();
                    selectSquare(square);
                    return;
                }
                // Geçersiz tıklama → seçimi iptal
                clearSquareSelection();
                return;
            }

            // Hiç seçili yok, kendi taşımı seçiyorum
            if (piece && piece.color === satrancData.myColor) {
                selectSquare(square);
            }
        });

        // Taş img'lerinin drag'ini kapat (chess.js hover'ı ile karışıklık önlensin)
        $(boardEl).find("img.piece-417db").css({
            "pointer-events": "none",
            "-webkit-user-drag": "none"
        });

        if (satrancData.board) satrancData.board.resize();
    }, 100);
}

// Kareyi seç ve highlight göster
function selectSquare(square) {
    satrancData.selectedSquare = square;
    // Highlight
    $("#satrancBoard .square-55d63").removeClass("highlight-from highlight-legal square-selected invisible-capture");
    $(`#satrancBoard .square-${square}`).addClass("square-selected");

    // ✨ Kalkanlı hedef kareleri hesapla (rakibin kalkanlı taşları)
    const shieldedSquares = Object.keys(satrancData.shieldedDetails || {});
    // Kendi seçtiğim taş kalkanlı mı? (kimseyi yiyemez)
    // AMA: Şah kalkanlıysa normalde yiyemeyeceği taşları YİYEBİLİR
    const selectedPiece = satrancData.game ? satrancData.game.get(square) : null;
    const isKingShielded = selectedPiece && selectedPiece.type === "k" && shieldedSquares.includes(square);
    const iAmShielded = shieldedSquares.includes(square) &&
        selectedPiece && selectedPiece.color === satrancData.myColor && !isKingShielded;

    // ✨ KALKANLI ŞAH: 1 kare herhangi bir yön (normal legal olmasa bile, kalkanlı hedefler DAHİL)
    const piece = satrancData.game ? satrancData.game.get(square) : null;
    const isMyKing = piece && piece.type === "k" && piece.color === satrancData.myColor;
    if (isMyKing && shieldedSquares.includes(square)) {
        const files = "abcdefgh";
        const fIdx = files.indexOf(square[0]);
        const rIdx = parseInt(square[1]);
        // ✨ Kalkan son 1 diş mi? (bu hamle sonrası kalkan düşecek)
        const myShieldTurns = satrancData.shieldedDetails[square] || 0;
        const shieldWillExpire = (myShieldTurns <= 1);

        for (let df = -1; df <= 1; df++) {
            for (let dr = -1; dr <= 1; dr++) {
                if (df === 0 && dr === 0) continue;
                const nf = fIdx + df;
                const nr = rIdx + dr;
                if (nf < 0 || nf > 7 || nr < 1 || nr > 8) continue;
                const targetSq = files[nf] + nr;
                const targetPiece = satrancData.game.get(targetSq);
                if (targetPiece && targetPiece.color === satrancData.myColor) continue;
                if (targetPiece && targetPiece.type === "k") continue;

                // ✨ Kalkan son 1 dişse: hamle sonrası kalkan düşecek → şah kontrolü yap
                if (shieldWillExpire) {
                    try {
                        const tempFen = satrancData.game.fen();
                        const tempGame = new Chess(tempFen);
                        // Şahı taşı
                        const fromPiece = tempGame.get(square);
                        tempGame.remove(square);
                        if (targetPiece) tempGame.remove(targetSq);
                        tempGame.put({type: fromPiece.type, color: fromPiece.color}, targetSq);
                        // Sıra rakibe geçmiş gibi kontrol et
                        const oppColor = satrancData.myColor === "w" ? "b" : "w";
                        const parts = tempGame.fen().split(" ");
                        parts[1] = satrancData.myColor;
                        tempGame.load(parts.join(" "));
                        if (tempGame.in_check()) continue; // ✨ Tehlikeli kare → atla
                    } catch(e) {}
                }

                const uci = square + targetSq;
                if (!satrancData.legalMoves.includes(uci)) {
                    satrancData.legalMoves.push(uci);
                }
            }
        }
    }

    // ✨ HIZLI KAÇIŞ: kendi şahım seçiliyse vezir gibi tüm boş yönlere gidebilsin
    const hizliKacisActive = satrancData._hizliKacisActive || false;
    if (isMyKing && hizliKacisActive) {
        console.log("[HIZLI KACIS] Aktif! Şah:", square, "vezir hamleleri hesaplanıyor...");
        const files2 = "abcdefgh";
        const fIdx2 = files2.indexOf(square[0]);
        const rIdx2 = parseInt(square[1]);
        // 8 yön: yatay, dikey, çapraz
        const dirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
        dirs.forEach(([df, dr]) => {
            for (let step = 1; step <= 8; step++) {
                const nf = fIdx2 + df * step;
                const nr = rIdx2 + dr * step;
                if (nf < 0 || nf > 7 || nr < 1 || nr > 8) break;
                const targetSq = files2[nf] + nr;
                const targetPiece = satrancData.game.get(targetSq);
                // Kendi taşım varsa dur (yiyemem)
                if (targetPiece && targetPiece.color === satrancData.myColor) break;
                // Rakip şah yenemem, dur
                if (targetPiece && targetPiece.type === "k") break;
                // Kalkanlı taşları da dur (yiyemem)
                const shieldedNow = Object.keys(satrancData.shieldedDetails || {});
                if (shieldedNow.includes(targetSq)) break;

                const uci = square + targetSq;
                if (!satrancData.legalMoves.includes(uci)) {
                    satrancData.legalMoves.push(uci);
                    console.log("[HIZLI KACIS] Legal eklendi:", uci);
                }
                if (targetPiece) break;  // Rakip taş yendiyse dur (o taşı yer)
            }
        });
        console.log("[HIZLI KACIS] Toplam legal moves:", satrancData.legalMoves.filter(m => m.startsWith(square)).length);
    }

    // Legal hamleleri göster
    const invCapSquares = satrancData.invisibleCaptureSquares || [];
    const lockedSquares = Object.keys(satrancData.lockedDetails || {});
    const isLockedPiece = lockedSquares.includes(square);

    // ✨ Kilitli taş HİÇ hareket edemez - hiçbir hedef gösterme
    if (isLockedPiece) {
        return;  // Legal moves gösterilmeyecek
    }

    // ✨ Yavaşlatılmış taş sadece 1 kare gidebilir
    const slowedSquares = Object.keys(satrancData.slowedDetails || {});
    const isSlowedPiece = slowedSquares.includes(square);

    const shownTargets = new Set();
    satrancData.legalMoves.forEach(move => {
        if (move.startsWith(square)) {
            const to = move.slice(2, 4);
            
            // ✨ Yavaşlatılmış taş → sadece 1 kare gösterebilir
            if (isSlowedPiece) {
                const filesSl = "abcdefgh";
                const f1s = filesSl.indexOf(square[0]);
                const r1s = parseInt(square[1], 10);
                const f2s = filesSl.indexOf(to[0]);
                const r2s = parseInt(to[1], 10);
                const distSl = Math.max(Math.abs(f1s - f2s), Math.abs(r1s - r2s));
                if (distSl > 1) return;
            }

            if (shownTargets.has(to)) return;  // aynı hedefi 4 kez gösterme (promo varyantları için)
            shownTargets.add(to);
            const $sq = $(`#satrancBoard .square-${to}`);

            // Hedef karede taş var mı?
            const targetPiece = satrancData.game ? satrancData.game.get(to) : null;
            const isCapture = targetPiece && targetPiece.color !== satrancData.myColor;

            // 🛡️ Hedef kare kalkanlıysa, bu hamle YOKMUŞ gibi davran (hiç yeşil nokta gösterme)
            // Kalkanlı şah bile kalkanlı taşı yiyemez (kalkan = tam koruma)
            if (shieldedSquares.includes(to)) {
                return;
            }

            // ✨ Kendi taşım kalkanlıysa kimseyi yiyemez (şah hariç, o zaten yiyebilir)
            if (iAmShielded && (isCapture || invCapSquares.includes(to))) {
                return;
            }

            $sq.addClass("highlight-legal");
            // ✨ Rakibin görünmez taşı barındırıyorsa yeme halkası göster
            if (invCapSquares.includes(to)) {
                $sq.addClass("invisible-capture");
            }
        }
    });
}

// Seçimi temizle
function clearSquareSelection() {
    satrancData.selectedSquare = null;
    $("#satrancBoard .square-55d63").removeClass("highlight-legal square-selected invisible-capture");
}

// ==========================================
// HAMLEYİ GÖNDER
// ==========================================
function sendMove(uci, promotion) {
    console.log("[MOVE SEND]", uci, "promo:", promotion);
    send({
        type: "satranc_make_move",
        move: uci,
        promotion: promotion || "q"
    });
    // Optimistik güncelleme (backend onaylayınca gerçek güncelleme gelir)
    satrancData.legalMoves = [];
}

// ==========================================
// BOARD GÜNCELLE
// ==========================================
function updateSatrancBoard(boardState, lastMove, effects) {
    if (!satrancData.board || !satrancData.game) return;

    // ✨ Animasyon başlamadan ÖNCE: ajan taşını sahte renkle hazırla
    if (lastMove && lastMove.length >= 4 && effects && effects.ajan_disguised) {
        const from = lastMove.slice(0, 2);
        if (effects.ajan_disguised[from]) {
            // Ajan taşın hareket edeceği img'yi sahte renkte yap
            // Böylece animasyon sırasında da sahte renk göstersin
        }
    }

    // ✨ Animasyon başlamadan ÖNCE: eğer hareket eden taş görünmezse, ona flag ekle
    // Bu sayede body'ye taşındığında opacity 0.3 kalır
    if (lastMove && lastMove.length >= 4 && effects && effects.invisible) {
        const from = lastMove.slice(0, 2);
        const to = lastMove.slice(2, 4);
        // Görünmez kareler yeni pozisyonda mı?
        if (effects.invisible.includes(to)) {
            const $movingImg = $(`#satrancBoard .square-${from} img`);
            $movingImg.addClass("animatingInvisible");
        }
    }

    // ✨ Ajan taşı hareket edecekse animasyondan ÖNCE src'yi sahte renge çevir
    // Böylece chessboard.js body'ye taşırken sahte src ile taşır
    if (lastMove && lastMove.length >= 4) {
        const from = lastMove.slice(0, 2);
        const ajanState = satrancData.ajanDisguised || {};
        const effectsAjan = (effects && effects.ajan_disguised) ? effects.ajan_disguised : {};
        const ajanData = ajanState[from] || effectsAjan[from];

        if (ajanData) {
            const fakeColor = (typeof ajanData === "object") ? ajanData.color : ajanData;
            const piece = satrancData.game.get(from);
            if (piece) {
                const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
                const pieceCode = `${fakeColor}${typeMap[piece.type] || "P"}`;
                const $img = $(`#satrancBoard .square-${from} img`);
                if ($img.length) {
                    $img.attr("src", `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`);
                    console.log(`[AJAN] Animasyon öncesi src fake yapıldı: ${from} -> ${pieceCode}`);
                }
            }
        }
    }

    // ✨ Ajan taşı hareket edecekse animasyondan ÖNCE src'yi sahte renge çevir
    let ajanMoveInfo = null;
    if (lastMove && lastMove.length >= 4) {
        const from = lastMove.slice(0, 2);
        const ajanState = satrancData.ajanDisguised || {};
        const effectsAjan = (effects && effects.ajan_disguised) ? effects.ajan_disguised : {};
        const ajanData = ajanState[from] || effectsAjan[from];

        if (ajanData) {
            const fakeColor = (typeof ajanData === "object") ? ajanData.color : ajanData;
            const piece = satrancData.game.get(from);
            if (piece) {
                const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
                const pieceCode = `${fakeColor}${typeMap[piece.type] || "P"}`;
                const fakeSrc = `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`;
                ajanMoveInfo = { from: from, to: lastMove.slice(2, 4), fakeSrc: fakeSrc };

                const $img = $(`#satrancBoard .square-${from} img`);
                if ($img.length) {
                    $img.attr("src", fakeSrc);
                }
            }
        }
    }

    satrancData.game.load(boardState.fen);
    // ✨ true = animate, false = instant
    satrancData.board.position(boardState.fen, true);

    // ✨ Chessboard.js body'ye img taşırken kendi src'sini yazıyor - override edelim
    // Her board update sonrası TÜM ajan karelerini süreki override et
    const ajanOverrideMap = {};  // {square: fakeSrc}
    const allAjan = Object.assign({}, satrancData.ajanDisguised || {}, (effects && effects.ajan_disguised) || {});
    const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };

    Object.keys(allAjan).forEach(sq => {
        const data = allAjan[sq];
        const fakeColor = (typeof data === "object") ? data.color : data;
        const piece = satrancData.game.get(sq);
        if (piece) {
            const pieceCode = `${fakeColor}${typeMap[piece.type] || "P"}`;
            ajanOverrideMap[sq] = `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`;
        }
    });

    if (Object.keys(ajanOverrideMap).length > 0) {
        const overrideInterval = setInterval(() => {
            // Body'deki taşınan img'ler (hareket sırasında)
            if (ajanMoveInfo) {
                $("body > img.piece-417db").each(function() {
                    const $this = $(this);
                    const currentSrc = $this.attr("src");
                    if (currentSrc && currentSrc !== ajanMoveInfo.fakeSrc) {
                        $this.attr("src", ajanMoveInfo.fakeSrc);
                    }
                });
            }
            // Tahtadaki tüm ajan karelerini sahte src ile zorla
            Object.keys(ajanOverrideMap).forEach(sq => {
                const $img = $(`#satrancBoard .square-${sq} img`);
                if ($img.length) {
                    const currentSrc = $img.attr("src");
                    if (currentSrc !== ajanOverrideMap[sq]) {
                        $img.attr("src", ajanOverrideMap[sq]);
                    }
                }
            });
        }, 20);

        setTimeout(() => {
            clearInterval(overrideInterval);
            // Son bir kez kesin uygula
            Object.keys(ajanOverrideMap).forEach(sq => {
                const $img = $(`#satrancBoard .square-${sq} img`);
                if ($img.length) {
                    $img.attr("src", ajanOverrideMap[sq]);
                }
            });
        }, 900);
    }

    // Tüm efekt sınıflarını temizle
    $("#satrancBoard .square-55d63").removeClass(
        "highlight-from highlight-to highlight-check effect-shielded effect-frozen effect-invisible effect-locked"
    );
    // Eski badge'leri sil
    $("#satrancBoard .invisibleTurnBadge").remove();
    // ✨ Eski şarj çubuklarını sil (yeni karelere yeniden eklenecek)
    $("#satrancBoard .squareInvisibleCharge").remove();
    $("#satrancBoard .squareShieldCharge").remove();
    $("#satrancBoard .squareFrozenCharge").remove();
    $("#satrancBoard .squareAjanCharge").remove();
    $("#satrancBoard .squareLockedCharge").remove();
    $("#satrancBoard .squareSlowedCharge").remove();
    $("#satrancBoard .ajanSquareEmoji").remove();
    $("#satrancBoard .invisibleSquareEmoji").remove();
    $("#satrancBoard .lockedSquareEmoji").remove();
    $("#satrancBoard .slowedSquareEmoji").remove();
    // ✨ EFFECT CLASS'LARINI TÜM KARELERDEN TEMİZLE (yavaşlat dahil)
    $("#satrancBoard .square-55d63").removeClass("effect-slowed");

    // ✨ Efektleri animasyondan SONRA uygula (board.position animasyonu ~500ms)
    // Bu sırada img'ler yeniden yaratıldığı için efektin yeni img'e binmesi lazım
    const applyEffectsDelayed = () => {
        // İnline style temizle - opacity hariç (görünmez taş için lazım)
        $("#satrancBoard .square-55d63 img").css({
            "filter": "",
            "transform": "",
            "transition": ""
        });
        // Opacity sıfırla ama sonra effects.invisible varsa geri koyacağız
        $("#satrancBoard .square-55d63 img").css("opacity", "");

        // Son hamleyi vurgula (sadece geçerliyse)
        if (lastMove && lastMove.length >= 4) {
            const from = lastMove.slice(0, 2);
            const to = lastMove.slice(2, 4);
            $(`#satrancBoard .square-${from}`).addClass("highlight-from");
            $(`#satrancBoard .square-${to}`).addClass("highlight-to");
        }

        // Şah — SADECE backend "is_check: true" dediyse göster
        // (Ajan sahte renkli FEN yüzünden chess.js yanlış hesaplayabilir, backend'e güven)
        if (boardState.is_check === true) {
            const turn = boardState.turn;
            const board = satrancData.game.board();
            const shieldedNow = (effects && effects.shielded) ? effects.shielded : [];
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const piece = board[r][c];
                    if (piece && piece.type === "k" &&
                        ((turn === "w" && piece.color === "w") ||
                         (turn === "b" && piece.color === "b"))) {
                        const files = "abcdefgh";
                        const sq = files[c] + (8 - r);
                        // ✨ Şah kalkanlıysa kırmızı uyarı GÖSTERME
                        if (!shieldedNow.includes(sq)) {
                            $(`#satrancBoard .square-${sq}`).addClass("highlight-check");
                        }
                    }
                }
            }
        }

        // Efektleri uygula
        if (effects) {
            (effects.shielded || []).forEach(sq => {
                const $sq = $(`#satrancBoard .square-${sq}`);
                $sq.addClass("effect-shielded");
                // ✨ Sağ üste şarj çubukları (max 4 diş)
                const turnsLeft = (effects.shielded_details || {})[sq] || 0;
                const maxTurns = 4;
                const colorClass = `shieldCharge-${Math.min(turnsLeft, 4)}`;
                let bars = "";
                for (let i = 0; i < maxTurns; i++) {
                    const filled = i < turnsLeft ? "filled" : "empty";
                    bars += `<div class="squareChargeBar ${filled}"></div>`;
                }
                $sq.find(".squareShieldCharge").remove();
                $sq.append(`<div class="squareShieldCharge ${colorClass}" title="Kalkan kalan: ${turnsLeft}">${bars}</div>`);
            });
            (effects.frozen || []).forEach(sq => {
                const $sq = $(`#satrancBoard .square-${sq}`);
                $sq.addClass("effect-frozen");
                // Şarj çubukları (max 2 diş)
                const turnsLeft = (effects.frozen_details || {})[sq] || 0;
                const maxTurns = 3;
                const colorClass = `frozenCharge-${turnsLeft}`;
                let bars = "";
                for (let i = 0; i < maxTurns; i++) {
                    const filled = i < turnsLeft ? "filled" : "empty";
                    bars += `<div class="squareChargeBar ${filled}"></div>`;
                }
                $sq.find(".squareFrozenCharge").remove();
                $sq.append(`<div class="squareFrozenCharge ${colorClass}" title="Donmuş: ${turnsLeft} tur">${bars}</div>`);
            });
            (effects.invisible || []).forEach(sq => {
                console.log("[SATRANC INVISIBLE] class ekleniyor:", sq);
                const $sq = $(`#satrancBoard .square-${sq}`);
                $sq.addClass("effect-invisible");
                // ✨ Görünmez karede highlight (sarı) OLMASIN - ipucu vermesin
                $sq.removeClass("highlight-from highlight-to");
                // ✨ Taşa direkt inline opacity ver (class binmezse bile çalışsın)
                $sq.find("img").css("opacity", "0.3");
                // ✨ Sağ üste şarj çubukları (max 8 diş, kalan tur kadar dolu)
                const turnsLeft = (effects.invisible_details || {})[sq] || 0;
                const maxTurns = 8;
                const colorClass = `charge-${Math.min(turnsLeft, 8)}`;
                let bars = "";
                for (let i = 0; i < maxTurns; i++) {
                    const filled = i < turnsLeft ? "filled" : "empty";
                    bars += `<div class="squareChargeBar ${filled}"></div>`;
                }
                $sq.find(".squareInvisibleCharge").remove();
                $sq.find(".invisibleSquareEmoji").remove();
                $sq.append(`<div class="invisibleSquareEmoji" title="Görünmez taş">🧙</div>`);
                $sq.append(`<div class="squareInvisibleCharge ${colorClass}" title="Kalan tur: ${turnsLeft}">${bars}</div>`);
            });
            (effects.locked || []).forEach(sq => {
                const $sq = $(`#satrancBoard .square-${sq}`);
                $sq.addClass("effect-locked");
                // ✨ Sol üstte 🔒 emoji
                $sq.find(".lockedSquareEmoji").remove();
                $sq.append(`<div class="lockedSquareEmoji" title="Kilitli taş - hareket edemez">🔒</div>`);
                // ✨ Sağ üstte şarj çubukları (max 3 diş)
                const turnsLeft = (effects.locked_details || {})[sq] || 0;
                const maxTurns = 3;
                const colorClass = `lockedCharge-${Math.min(turnsLeft, 3)}`;
                let bars = "";
                for (let i = 0; i < maxTurns; i++) {
                    const filled = i < turnsLeft ? "filled" : "empty";
                    bars += `<div class="squareChargeBar ${filled}"></div>`;
                }
                $sq.find(".squareLockedCharge").remove();
                $sq.append(`<div class="squareLockedCharge ${colorClass}" title="Kilit kalan: ${turnsLeft}">${bars}</div>`);
            });
            
            // ✨ YAVAŞLAT efekti - sol üstte 🐌 emoji + sağ üstte şarj (3 diş)
            (effects.slowed || []).forEach(sq => {
                const $sq = $(`#satrancBoard .square-${sq}`);
                $sq.addClass("effect-slowed");
                // Sol üstte 🐌 emoji
                $sq.find(".slowedSquareEmoji").remove();
                $sq.append(`<div class="slowedSquareEmoji" title="Yavaşlatılmış - max 1 kare">🐌</div>`);
                // Sağ üstte şarj çubukları (max 3 diş)
                const turnsLeft = (effects.slowed_details || {})[sq] || 0;
                const maxTurns = 3;
                const colorClass = `slowedCharge-${Math.min(turnsLeft, 3)}`;
                let bars = "";
                for (let i = 0; i < maxTurns; i++) {
                    const filled = i < turnsLeft ? "filled" : "empty";
                    bars += `<div class="squareChargeBar ${filled}"></div>`;
                }
                $sq.find(".squareSlowedCharge").remove();
                $sq.append(`<div class="squareSlowedCharge ${colorClass}" title="Yavaşlat kalan: ${turnsLeft}">${bars}</div>`);
            });

            // ✨ Yok Say hayalet kareleri - fake taş göster + %30 opacity + 🚫 emoji
            $("#satrancBoard .square-55d63").removeClass("effect-ignored");
            $("#satrancBoard .ignoredSquareEmoji").remove();
            $("#satrancBoard .ignoredGhostPiece").remove();
            const ignoredList = effects.ignored || [];
            const ignoredDetails = effects.ignored_details || {};
            satrancData.ignoredSquares = ignoredList;
            const ignoredTypeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
            ignoredList.forEach(sq => {
                const $sq = $(`#satrancBoard .square-${sq}`);
                $sq.addClass("effect-ignored");

                // ✨ Fake taş görselini ekle (backend'de taş silindi ama biz gösteriyoruz)
                const detail = ignoredDetails[sq];
                if (detail && detail.piece_type && detail.piece_color) {
                    const pieceCode = `${detail.piece_color}${ignoredTypeMap[detail.piece_type] || "P"}`;
                    const ghostImg = document.createElement("img");
                    ghostImg.className = "ignoredGhostPiece";
                    ghostImg.src = `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`;
                    ghostImg.style.position = "absolute";
                    ghostImg.style.top = "0";
                    ghostImg.style.left = "0";
                    ghostImg.style.width = "100%";
                    ghostImg.style.height = "100%";
                    ghostImg.style.opacity = "0.3";
                    ghostImg.style.filter = "grayscale(50%) brightness(1.1)";
                    ghostImg.style.pointerEvents = "none";
                    ghostImg.style.zIndex = "3";
                    $sq.append(ghostImg);
                }

                // Sol üstte 🚫 emoji
                $sq.append(`<div class="ignoredSquareEmoji" title="Hayalet - Yok sayılıyor">🚫</div>`);
            });

            // ✨ Reappear tespiti - SADECE aktif hiç görünmez kalmadıysa oynasın
            // (hamle sonrası kare değişince değil, süre bitince)
            const prevInv = satrancData.lastInvisibleSquares || [];
            const currInv = effects.invisible || [];
            if (prevInv.length > 0 && currInv.length === 0) {
                // Tüm görünmezler bitmiş → son karede sparkle
                prevInv.forEach(sq => {
                    setTimeout(() => playInvisibleReappearAnimation(sq), 100);
                });
            }
            satrancData.lastInvisibleSquares = currInv.slice();
            satrancData.invisibleDetails = effects.invisible_details || {};
            satrancData.shieldedDetails = effects.shielded_details || {};
            satrancData.frozenDetails = effects.frozen_details || {};
            satrancData.lockedDetails = effects.locked_details || {};
            satrancData.slowedDetails = effects.slowed_details || {};

            applyAjanDisguiseVisuals(effects);

            // ✨ Efekt sayaçları değiştiyse hem kendi hem rakip joker paneli yenilensin
            renderMyJokers();
            renderOppJokers();
        }
    };

    // chessboard.js animasyonu bitmeden efekt uygularsak class yeni img'e binmez
    // Birkaç kere uygula: hızlı, animasyon ortası, animasyon sonu ve sonrası
    setTimeout(applyEffectsDelayed, 50);
    setTimeout(applyEffectsDelayed, 300);
    setTimeout(applyEffectsDelayed, 600);
    setTimeout(applyEffectsDelayed, 900);
    // ✨ Ajan görselini ekstra kere daha uygula (animasyon sonrası src reset olmasın)
    setTimeout(() => applyAjanDisguiseVisuals(effects), 700);
    setTimeout(() => applyAjanDisguiseVisuals(effects), 1000);
    setTimeout(() => applyAjanDisguiseVisuals(effects), 1400);
}

// ==========================================
// YENİLEN TAŞLAR
// ==========================================
function renderCapturedPieces(capturedByMe, capturedByOpp) {
    const myEl = document.getElementById("satrancMyCaptured");
    const oppEl = document.getElementById("satrancOppCaptured");
    if (!myEl || !oppEl) return;

    const pieceOrder = { q: 1, r: 2, b: 3, n: 4, p: 5 };
    const pieceValues = { q: 9, r: 5, b: 3, n: 3, p: 1 };
    const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
    const pieceNames = { p: "Piyon", r: "Kale", n: "At", b: "Fil", q: "Vezir", k: "Şah" };

    function renderOne(container, pieces) {
        container.innerHTML = "";

        const sorted = [...(pieces || [])].sort((a, b) => {
            return (pieceOrder[a.type] || 99) - (pieceOrder[b.type] || 99);
        });

        sorted.forEach(p => {
            const pieceCode = `${p.color || "b"}${typeMap[p.type] || "P"}`;
            const img = document.createElement("img");
            img.src = `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`;
            img.alt = p.type || "piece";
            img.title = `${p.color === "w" ? "Beyaz" : "Siyah"} ${pieceNames[p.type] || "Taş"}`;
            container.appendChild(img);
        });

        }

    const myList = capturedByMe || [];
    const oppList = capturedByOpp || [];

    renderOne(myEl, myList);
    renderOne(oppEl, oppList);

    // Toplam sayacı güncelle
    const myTotalEl = document.getElementById("satrancMyCapturedTotal");
    const oppTotalEl = document.getElementById("satrancOppCapturedTotal");
    if (myTotalEl) myTotalEl.textContent = String(myList.length);
    if (oppTotalEl) oppTotalEl.textContent = String(oppList.length);

    console.log("[SATRANC CAPTURED] Yediklerim:", myList.length, "Kaybettiklerim:", oppList.length);
}

// ==========================================
// SAAT
// ==========================================
function startSatrancClock() {
    stopSatrancClock();
    satrancData.clockInterval = setInterval(() => {
        updateClockDisplay();
    }, 1000);
}

function stopSatrancClock() {
    if (satrancData.clockInterval) {
        clearInterval(satrancData.clockInterval);
        satrancData.clockInterval = null;
    }
}

function updateClockDisplay() {
    const myEl = document.getElementById("satrancP1Clock");
    const oppEl = document.getElementById("satrancP2Clock");
    if (!myEl || !oppEl) return;

    const myPid = satrancData.playerId;
    const oppPid = satrancData.players.find(p => p.id !== myPid)?.id;

    if (myEl) myEl.textContent = formatClock(satrancData.clocks[myPid] || 0);
    if (oppEl) oppEl.textContent = formatClock(satrancData.clocks[oppPid] || 0);

    // ✨ Aktif oyuncunun saati parlasın
    const activeTurn = satrancData.game?.turn();
    if (activeTurn) {
        const activePid = activeTurn === "w" ? satrancData.whiteId : satrancData.blackId;
        if (activePid === myPid) {
            myEl.style.color = "#51cf66";
            myEl.style.boxShadow = "0 0 15px rgba(81,207,102,0.5)";
            oppEl.style.color = "#adb5bd";
            oppEl.style.boxShadow = "none";
        } else {
            oppEl.style.color = "#ff8a8a";
            oppEl.style.boxShadow = "0 0 15px rgba(255,107,107,0.5)";
            myEl.style.color = "#adb5bd";
            myEl.style.boxShadow = "none";
        }
    }
}

function renderClocks(clocks) {
    Object.keys(clocks).forEach(pid => {
        satrancData.clocks[parseInt(pid)] = clocks[pid];
    });
    updateClockDisplay();
}

// ==========================================
// SIRA BİLGİSİ
// ==========================================
function updateTurnInfo(boardState) {
    const turnEl = document.getElementById("satrancTurnInfo");
    if (!turnEl) return;

    const myTurn = boardState.turn === satrancData.myColor;
    if (myTurn) {
        turnEl.textContent = "🟢 SENİN SIRAN!";
        turnEl.style.color = "#51cf66";
    } else {
        const oppName = satrancData.myColor === "w" ? satrancData.blackName : satrancData.whiteName;
        turnEl.textContent = `⏳ ${oppName} oynuyor...`;
        turnEl.style.color = "#ff6b6b";
    }
}

// ==========================================
// HAMLE GEÇMİŞİ
// ==========================================
function addMoveToHistory(sanMove) {
    satrancData.moveHistory.push(sanMove);
    const histEl = document.getElementById("satrancMoveHistory");
    if (!histEl) return;
    histEl.innerHTML = "";
    satrancData.moveHistory.forEach((m, i) => {
        const span = document.createElement("span");
        span.className = "satrancMoveChip";
        if (i % 2 === 0) {
            const num = document.createElement("span");
            num.className = "satrancMoveNum";
            num.textContent = `${Math.floor(i / 2) + 1}.`;
            histEl.appendChild(num);
        }
        span.textContent = m;
        histEl.appendChild(span);
    });
    histEl.scrollLeft = histEl.scrollWidth;
}

// ==========================================
// TERFİ POPUP - Her zaman 4 tür göster (Vezir/Kale/Fil/At)
// ==========================================
function showCapturedPromotionPopup(from, to, capturedPieces) {
    // Yenilen taş sayılarını grupla (sadece bilgi amaçlı - "×N" rozetleri için)
    const grouped = {};
    (capturedPieces || []).forEach(p => {
        const key = p.type;
        if (key === "k" || key === "p") return;
        grouped[key] = (grouped[key] || 0) + 1;
    });

    // Kendi rengim
    const myColor = satrancData.myColor || "w";
    const typeMap = { q: "Q", r: "R", b: "B", n: "N" };
    const pieceNames = { q: "Vezir", r: "Kale", b: "Fil", n: "At" };
    const allTypes = ["q", "r", "b", "n"];  // Her zaman 4 seçenek

    // Overlay oluştur
    let overlay = document.getElementById("satrancPromoOverlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "satrancPromoOverlay";
    overlay.className = "satrancPromoOverlay";

    let piecesHtml = "";
    allTypes.forEach(type => {
        const pieceCode = myColor + typeMap[type];
        const count = grouped[type] || 0;
        const countHtml = count > 0
            ? `<div class="satrancPromoCount">×${count}</div>`
            : "";
        piecesHtml += `
            <div class="satrancPromoPiece" data-piece="${type}">
                <img src="/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png" alt="${type}">
                <div class="satrancPromoName">${pieceNames[type]}</div>
                ${countHtml}
            </div>
        `;
    });

    overlay.innerHTML = `
        <div class="satrancPromoBox">
            <div class="satrancPromoIcon">👑</div>
            <h2 class="satrancPromoTitle">Piyon Sona Ulaştı!</h2>
            <p class="satrancPromoDesc">
                Piyonunu neye dönüştürmek istiyorsun?<br>
                <span style="color:#ffd43b; font-weight:bold;">${from.toUpperCase()} → ${to.toUpperCase()}</span>
            </p>
            <div class="satrancPromoPieces">${piecesHtml}</div>
            <div class="satrancPromoHint">💡 Tıklayarak seç</div>
        </div>
    `;

    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add("show"), 10);

    // Taş tıklama
    overlay.querySelectorAll(".satrancPromoPiece").forEach(el => {
        el.onclick = () => {
            const chosen = el.dataset.piece;
            overlay.classList.remove("show");
            setTimeout(() => overlay.remove(), 300);
            sendMoveWithPromotion(from, to, chosen);
        };
    });
}

function sendMoveWithPromotion(from, to, pieceType) {
    // Animasyon için beklet
    satrancData.pendingPromotion = { from: from, to: to, pieceType: pieceType };

    send({
        type: "satranc_make_move",
        move: from + to,
        promotion: pieceType,
        promotion_confirmed: true
    });
    satrancData.legalMoves = [];
}

// Eski showPromotionBox (kullanılmıyor artık ama uyumluluk için)
function showPromotionBox(from, to) {
    // Kullanıcı boş listeyle çağırdığında yedeklik
    showCapturedPromotionPopup(from, to, []);
}

// ==========================================
// OYUN SONU
// ==========================================
function showSatrancGameOver(msg) {
    stopSatrancClock();

    const box = document.getElementById("satrancGameOverBox");
    const title = document.getElementById("satrancGameOverTitle");
    const text = document.getElementById("satrancGameOverText");
    const rematchBtn = document.getElementById("satrancRematchBtn");
    const lobbyBtn = document.getElementById("satrancBackToLobbyBtn");

    if (!box) return;

    const isWinner = msg.winner_id === satrancData.playerId;
    const isDraw = !msg.winner_id;

    if (title) {
        if (isDraw) {
            title.textContent = "🤝 Berabere!";
            title.style.color = "#ffd43b";
        } else if (isWinner) {
            title.textContent = "🏆 KAZANDIN!";
            title.style.color = "#51cf66";
            if (typeof startConfetti === "function") startConfetti();
        } else {
            title.textContent = "😢 KAYBETTİN!";
            title.style.color = "#ff6b6b";
        }
    }

    if (text) text.textContent = msg.message || "";
    if (rematchBtn) rematchBtn.classList.toggle("hidden", satrancData.playerId !== 1);
    if (lobbyBtn) lobbyBtn.classList.remove("hidden");

    box.classList.remove("hidden");
}

// ==========================================
// ODA AYARLARI
// ==========================================
function openSatrancRoomSettings() {
    window.openRoomSettingsGeneric({
        title: "Jokerli Satranç - Oda Ayarları",
        readonly: satrancData.playerId !== 1,
        fields: [
            {
                id: "timeMode", label: "⏱️ Süre Modu",
                current: satrancData.timeMode,
                options: [
                    {value: "bullet", label: "⚡ 1 Dakika"},
                    {value: "blitz", label: "🔥 3 Dakika"},
                    {value: "rapid", label: "🏃 10 Dakika"},
                    {value: "klasik", label: "🎩 30 Dakika"},
                    {value: "suresiz", label: "♾️ Süresiz"}
                ]
            },
            {
                id: "jokerCount", label: "🃏 Joker Sayısı",
                current: satrancData.jokerCount,
                options: [
                    {value: 0, label: "Jokersiz ♟️"},
                    {value: 1, label: "1"},
                    {value: 2, label: "2"},
                    {value: 3, label: "3"},
                    {value: 4, label: "4"},
                    {value: 5, label: "5"},
                    {value: 6, label: "6"}
                ]
            },
            {
                id: "pickMode", label: "🎴 Joker Seçim Modu",
                current: satrancData.pickMode,
                options: [
                    {value: "karisik", label: "🎲 Karışık"},
                    {value: "manuel", label: "📋 Manuel"}
                ]
            },
            {
                id: "pickSeconds", label: "⏳ Joker Seçim Süresi",
                current: satrancData.pickSeconds,
                options: [
                    {value: 30, label: "30 sn"}, {value: 60, label: "60 sn"},
                    {value: 90, label: "90 sn"}, {value: 120, label: "120 sn"},
                    {value: 180, label: "3 dakika"}, {value: 300, label: "5 dakika"},
                    {value: 0, label: "♾️ Sınırsız"}
                ]
            },
            {
                id: "lockMode", label: "🔒 Joker Kilidi",
                current: satrancData.lockMode,
                options: [
                    {value: "off", label: "❌ Devre Dışı"},
                    {value: "pieces", label: "⚔️ Taş Yendikten Sonra"},
                    {value: "time", label: "⏰ Süre Bittikten Sonra"}
                ]
            },
            {
                id: "lockPieces", label: "⚔️ Kaç Taş Yenince",
                current: satrancData.lockPieces,
                options: [
                    {value: 1, label: "1 taş"}, {value: 2, label: "2 taş"},
                    {value: 3, label: "3 taş"}, {value: 4, label: "4 taş"},
                    {value: 5, label: "5 taş"}, {value: 6, label: "6 taş"},
                    {value: 7, label: "7 taş"}, {value: 8, label: "8 taş"},
                    {value: 9, label: "9 taş"}, {value: 10, label: "10 taş"}
                ]
            },
            {
                id: "lockMinutes", label: "⏰ Kaç Dakika Sonra",
                current: satrancData.lockMinutes,
                options: [
                    {value: 1, label: "1 dakika"}, {value: 2, label: "2 dakika"},
                    {value: 3, label: "3 dakika"}, {value: 4, label: "4 dakika"},
                    {value: 5, label: "5 dakika"}, {value: 6, label: "6 dakika"},
                    {value: 7, label: "7 dakika"}, {value: 8, label: "8 dakika"},
                    {value: 9, label: "9 dakika"}, {value: 10, label: "10 dakika"}
                ]
            }
        ],
        onSave: (values) => {
            // ✨ Kilit modu değiştiyse popup'ı yenile (alt kutular güncellensin)
            const newLockMode = values.lockMode;
            const oldLockMode = satrancData.lockMode;
            if (newLockMode !== oldLockMode) {
                satrancData.lockMode = newLockMode;
                // Yeni değerleri güvenli varsayılanlarla ayarla
                if (newLockMode === "pieces" && !values.lockPieces) {
                    values.lockPieces = satrancData.lockPieces || 3;
                }
                if (newLockMode === "time" && !values.lockMinutes) {
                    values.lockMinutes = satrancData.lockMinutes || 2;
                }
            }
            
            // ✨ localStorage'a kaydet (site kapatılıp açılınca hatırlasın)
            try {
                localStorage.setItem("satrancTimeMode", values.timeMode);
                localStorage.setItem("satrancJokerCount", values.jokerCount);
                localStorage.setItem("satrancPickMode", values.pickMode);
                localStorage.setItem("satrancPickSeconds", values.pickSeconds);
                localStorage.setItem("satrancLockMode", values.lockMode);
                if (values.lockPieces !== undefined) localStorage.setItem("satrancLockPieces", values.lockPieces);
                if (values.lockMinutes !== undefined) localStorage.setItem("satrancLockMinutes", values.lockMinutes);
            } catch(e) {}

            send({
                type: "satranc_update_settings",
                time_mode: values.timeMode,
                joker_count: parseInt(values.jokerCount),
                pick_mode: values.pickMode,
                pick_seconds: parseInt(values.pickSeconds),
                lock_mode: values.lockMode,
                lock_pieces: parseInt(values.lockPieces || satrancData.lockPieces || 3),
                lock_minutes: parseInt(values.lockMinutes || satrancData.lockMinutes || 2)
            });
        }
    });
    
    // ✨ Popup açıldıktan sonra Joker Kilidi alanına göre alt kutuları direkt göster/gizle
    setTimeout(() => {
        const lockModeSelect = document.getElementById("settingsField_lockMode");
        const lockPiecesGroup = document.getElementById("settingsGroup_lockPieces");
        const lockMinutesGroup = document.getElementById("settingsGroup_lockMinutes");

        if (!lockModeSelect) {
            console.warn("[SATRANC] settingsField_lockMode bulunamadı");
            return;
        }

        function applyLockModeVisibility(shouldScroll) {
            const mode = String(lockModeSelect.value || "off");

            if (lockPiecesGroup) {
                lockPiecesGroup.style.display = (mode === "pieces") ? "" : "none";
            }

            if (lockMinutesGroup) {
                lockMinutesGroup.style.display = (mode === "time") ? "" : "none";
            }

            if (!shouldScroll) return;

            let targetGroup = null;
            if (mode === "pieces") targetGroup = lockPiecesGroup;
            if (mode === "time") targetGroup = lockMinutesGroup;

            if (targetGroup) {
                setTimeout(() => {
                    targetGroup.scrollIntoView({
                        behavior: "smooth",
                        block: "nearest",
                        inline: "nearest"
                    });
                }, 60);
            }
        }

        applyLockModeVisibility(false);
        lockModeSelect.addEventListener("change", () => applyLockModeVisibility(true));

        console.log("[SATRANC] Kilit alanları canlı göster/gizle aktif ✓");
    }, 50);
}

// ==========================================
// CHAT
// ==========================================
let satrancChat = { open: false, unread: 0, messages: [], maxMessages: 50 };

function showSatrancChat() {
    const c = document.getElementById("satrancChatContainer");
    if (c) c.style.display = "block";
    // ✨ Chat butonlarına event bağla (bir kere)
    _setupSatrancChatEvents();
}

function _addSatrancChatMessage(msg) {
    const messagesEl = document.getElementById("satrancChatMessages");
    if (!messagesEl) return;

    const senderName = msg.sender_name || "?";
    // Bil Bakalım backend'i "text" alanı kullanıyor
    const text = msg.text || msg.message || "";
    const isMe = msg.sender_id === satrancData.playerId;

    // ✨ Rakip yazdıysa bildirim sesi (app.js'deki genel fonksiyon)
    if (!isMe && typeof _playChatNotifySound === "function") {
        _playChatNotifySound();
    }

    const div = document.createElement("div");
    div.className = "miniChatMsg";

    const nameSpan = document.createElement("span");
    nameSpan.className = "chatName";
    nameSpan.style.color = msg.sender_id === 1 ? "#ff8a8a" : "#7abfff";
    nameSpan.textContent = senderName + ":";

    const textSpan = document.createElement("span");
    textSpan.className = "chatText";
    textSpan.textContent = " " + text;

    div.appendChild(nameSpan);
    div.appendChild(textSpan);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    satrancChat.messages.push({name: senderName, text: text, isMe: isMe});
    if (satrancChat.messages.length > satrancChat.maxMessages) {
        satrancChat.messages.shift();
    }

    // Kapalıysa unread sayacı arttır + popup göster
    if (!satrancChat.open && !isMe) {
        satrancChat.unread++;
        const badge = document.getElementById("satrancChatBadge");
        if (badge) {
            badge.textContent = satrancChat.unread;
            badge.style.display = "flex";
        }
        // ✨ Popup baloncuğu göster
        _showSatrancChatPopup({
            sender_id: msg.sender_id,
            sender_name: senderName,
            text: text
        });
    }
}

function _showSatrancChatPopup(msg) {
    if (satrancChat.open) return;
    const stack = document.getElementById("satrancChatPopupStack");
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

    // Max 5 baloncuk göster
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

function _openSatrancChatPanel() {
    const panel = document.getElementById("satrancChatPanel");
    const badge = document.getElementById("satrancChatBadge");
    const input = document.getElementById("satrancChatInput");
    if (!panel) return;
    panel.style.display = "flex";
    if (badge) {
        badge.style.display = "none";
        badge.textContent = "0";
        satrancChat.unread = 0;
    }
    satrancChat.open = true;
    // Popup baloncuklarını temizle
    const stack = document.getElementById("satrancChatPopupStack");
    if (stack) {
        stack.innerHTML = "";
        stack.style.display = "none";
    }
    setTimeout(() => {
        if (input) input.focus();
    }, 100);
    // Dışarı tıklayınca kapansın
    setTimeout(() => {
        document.addEventListener("mousedown", _satrancChatOutsideClickHandler, true);
    }, 100);
}

function _closeSatrancChatPanel() {
    const panel = document.getElementById("satrancChatPanel");
    if (panel) panel.style.display = "none";
    satrancChat.open = false;
    document.removeEventListener("mousedown", _satrancChatOutsideClickHandler, true);
    const input = document.getElementById("satrancChatInput");
    if (input && input.value) input.value = "";
}

function _toggleSatrancChatPanel() {
    if (satrancChat.open) _closeSatrancChatPanel();
    else _openSatrancChatPanel();
}

function _satrancChatOutsideClickHandler(e) {
    const c = document.getElementById("satrancChatContainer");
    if (!c) return;
    if (c.contains(e.target)) return;
    _closeSatrancChatPanel();
}

function _setupSatrancChatEvents() {
    if (window._satrancChatEventsBound) return;
    window._satrancChatEventsBound = true;

    const toggleBtn = document.getElementById("satrancChatToggleBtn");
    const closeBtn = document.getElementById("satrancChatCloseBtn");
    const input = document.getElementById("satrancChatInput");
    const sendBtn = document.getElementById("satrancChatSendBtn");

    // Butona tıklayınca aç/kapat
    if (toggleBtn) {
        toggleBtn.onclick = () => _toggleSatrancChatPanel();
    }

    // ✕ butonu kapat
    if (closeBtn) {
        closeBtn.onclick = () => _closeSatrancChatPanel();
    }

    const doSend = () => {
        if (!input) return;
        const text = input.value.trim();
        if (!text || text.length > 100) return;
        send({ type: "bil_chat_send", text: text });
        input.value = "";
    };

    if (sendBtn) sendBtn.onclick = doSend;

    if (input) {
        input.onkeydown = (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                doSend();
                _closeSatrancChatPanel();  // ✨ Mesaj gönder + kapat
                return;
            }
            // Diğer tuşlar propagate etmesin (T tuşu vs.)
            e.stopPropagation();
        };
    }

    // ✨ T tuşu → chat aç
    document.addEventListener("keydown", (e) => {
        const k = e.key.toLowerCase();
        if (k !== "t") return;

        // Satranç ekranında olmalı
        if (typeof getCurrentScreen === "function") {
            const cur = getCurrentScreen();
            if (cur !== "satrancGame" && cur !== "satrancLobby" && cur !== "satrancJokerSelect") return;
        }

        // Input/textarea odaktaysa yoksay
        const activeEl = document.activeElement;
        if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;

        // Chat container görünmüyorsa yoksay
        const container = document.getElementById("satrancChatContainer");
        if (!container || container.style.display === "none") return;

        // Zaten açıksa yoksay
        if (satrancChat.open) return;

        // Popup açıksa yoksay (ESC popup, joker popup vs.)
        const anyPopup = document.querySelector(".overlay:not(.hidden), .satrancModalOverlay.show");
        if (anyPopup) return;

        e.preventDefault();
        e.stopPropagation();
        _openSatrancChatPanel();
    }, true);

    // ✨ ESC ile chat kapat (öncelikli)
    document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if (satrancChat.open) {
            e.preventDefault();
            e.stopPropagation();
            _closeSatrancChatPanel();
        }
    }, true);
}

function hideSatrancChat() {
    const c = document.getElementById("satrancChatContainer");
    if (c) c.style.display = "none";
    satrancChat.messages = [];
    satrancChat.unread = 0;
}

// ==========================================
// WRAP: showScreen
// ==========================================
const _prevShowScreenSatranc = showScreen;
showScreen = function(name) {
    _prevShowScreenSatranc(name);

    const screens = ["createSatrancScreen", "satrancLobbyScreen",
                     "satrancJokerSelectScreen", "satrancGameScreen"];
    screens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hidden");
    });

    if (name === "createSatranc") {
        document.getElementById("createSatrancScreen").classList.remove("hidden");
    }
    if (name === "satrancLobby") {
        document.getElementById("satrancLobbyScreen").classList.remove("hidden");
    }
    if (name === "satrancJokerSelect") {
        document.getElementById("satrancJokerSelectScreen").classList.remove("hidden");
    }
    if (name === "satrancGame") {
        document.getElementById("satrancGameScreen").classList.remove("hidden");
        setTimeout(() => {
            if (satrancData.board) satrancData.board.resize();
        }, 200);
    }

    const satrancScreens = ["createSatranc", "satrancLobby",
                            "satrancJokerSelect", "satrancGame"];
    if (satrancScreens.includes(name)) showSatrancChat();
    else hideSatrancChat();
};

// ==========================================
// WRAP: handleMessage
// ==========================================
const _prevHandleSatranc = handleMessage;
handleMessage = function(msg) {

    // ✨ Satranç aktifken Bil Bakalım chat mesajını yakala (aynı backend sistemi)
    if (satrancData.inGame && msg.type === "bil_chat_msg") {
        _addSatrancChatMessage(msg);
        return;  // Bil Bakalım'a gitmesin, sadece satranç panelinde göster
    }
    if (satrancData.inGame && msg.type === "bil_chat_history") {
        if (msg.messages && Array.isArray(msg.messages)) {
            const wasOpen = satrancChat.open;
            satrancChat.open = true;
            msg.messages.forEach(m => _addSatrancChatMessage(m));
            satrancChat.open = wasOpen;
            satrancChat.unread = 0;
            const badge = document.getElementById("satrancChatBadge");
            if (badge) badge.style.display = "none";
        }
        return;
    }

    if (msg.type === "satranc_room_created") {
        satrancData.playerId = msg.player_id;
        satrancData.roomCode = msg.room_code;
        satrancData.timeMode = msg.time_mode;
        satrancData.jokerCount = msg.joker_count;
        satrancData.pickMode = msg.pick_mode;
        satrancData.pickSeconds = msg.pick_seconds;
        satrancData.lockMode = msg.lock_mode || "off";
        satrancData.lockPieces = msg.lock_pieces || 3;
        satrancData.lockMinutes = msg.lock_minutes || 2;
        satrancData.inGame = true;
        playerId = msg.player_id;
        roomCode = msg.room_code;
        inRoom = true;
        _satrancRoomHelper = null;
        showScreen("satrancLobby");
        updateSatrancLobby();
        return;
    }

    if (msg.type === "satranc_room_joined") {
        satrancData.playerId = msg.player_id;
        satrancData.roomCode = msg.room_code;
        satrancData.timeMode = msg.time_mode;
        satrancData.jokerCount = msg.joker_count;
        satrancData.pickMode = msg.pick_mode;
        satrancData.pickSeconds = msg.pick_seconds;
        satrancData.lockMode = msg.lock_mode || "off";
        satrancData.lockPieces = msg.lock_pieces || 3;
        satrancData.lockMinutes = msg.lock_minutes || 2;
        satrancData.inGame = true;
        playerId = msg.player_id;
        roomCode = msg.room_code;
        inRoom = true;
        _satrancRoomHelper = null;
        showScreen("satrancLobby");
        updateSatrancLobby();
        return;
    }

    if (msg.type === "satranc_lobby_update") {
        satrancData.roomCode = msg.room_code;
        satrancData.players = msg.players;
        satrancData.timeMode = msg.time_mode;
        satrancData.jokerCount = msg.joker_count;
        satrancData.pickMode = msg.pick_mode;
        satrancData.pickSeconds = msg.pick_seconds;
        satrancData.lockMode = msg.lock_mode || "off";
        satrancData.lockPieces = msg.lock_pieces || 3;
        satrancData.lockMinutes = msg.lock_minutes || 2;
        updateSatrancLobby();
        return;
    }

    // ✨ Joker seçim başladı
    if (msg.type === "satranc_joker_selection_start") {
        // ✨ Game over box açıksa kapat (rematch sonrası)
        const gameOverBox = document.getElementById("satrancGameOverBox");
        if (gameOverBox) gameOverBox.classList.add("hidden");
        // Board temizle
        if (satrancData.board) {
            try { satrancData.board.destroy(); } catch(e) {}
            satrancData.board = null;
        }
        stopSatrancClock();
        openJokerSelectScreen(msg);
        return;
    }

    // ✨ Slotlar güncellendi (kart ekle/sil sonrası)
    if (msg.type === "satranc_joker_slot_update") {
        const joker_count = satrancData.jokerCount;
        renderJokerSlots(msg.selected || [], joker_count);
        return;
    }

    // ✨ Rakip seçim yapıyor
    if (msg.type === "satranc_opponent_selecting") {
        const oppEl = document.getElementById("satrancJsOppProgress");
        if (oppEl) oppEl.textContent = `${msg.selected_count}/${msg.total_needed}`;
        return;
    }

    // ✨ Rakip hazır
    if (msg.type === "satranc_opponent_ready") {
        const oppEl = document.getElementById("satrancJsOppProgress");
        if (oppEl) {
            oppEl.textContent = `✅ HAZIR!`;
            oppEl.style.color = "#51cf66";
            oppEl.style.fontWeight = "bold";
        }
        return;
    }

    // ✨ Kendi jokerlerim hazır (manuel confirm veya timeout sonrası)
    if (msg.type === "satranc_your_jokers_ready") {
        satrancData.myJokers = msg.my_jokers || [];
        if (msg.time_up) {
            const cnt = satrancData.myJokers.length;
            if (cnt === 0) {
                showToast("⏰ Süre Bitti!", "Hiç joker seçmediğin için oyuna jokersiz başlıyorsun.", null, "warning");
            } else {
                showToast("⏰ Süre Bitti!", `Seçtiğin ${cnt} joker ile devam ediliyor.`, null, "warning");
            }
        }
        // Confirm butonunu disable et
        const confirmBtn = document.getElementById("satrancJsConfirmBtn");
        if (confirmBtn) {
            confirmBtn.disabled = true;
            confirmBtn.textContent = "✅ HAZIR - Rakip bekleniyor...";
            confirmBtn.style.opacity = "0.6";
        }
        return;
    }

    if (msg.type === "satranc_game_started") {
        stopJokerSelectTimer();
        satrancData.myJokers = msg.my_jokers || [];
        satrancData.oppJokerCount = msg.opp_joker_count || 0;
        satrancData.usedJokers = msg.my_used_jokers || [];  // ✨ Önce Başla için üstü çizik gelsin
        satrancData.oppUsedJokers = msg.opp_used_jokers || [];  // ✨ Rakibin Önce Başla için
        window._satrancRevealedOppJokers = [];  // ✨ reveal listesi sıfırla

        // ✨ Joker Kilidi bilgilerini kaydet
        satrancData.lockMode = msg.lock_mode || "off";
        satrancData.lockPieces = msg.lock_pieces || 3;
        satrancData.lockMinutes = msg.lock_minutes || 2;
        satrancData.jokersUnlocked = msg.jokers_unlocked !== false;
        satrancData.gameStartTs = Date.now();
        satrancData.lockStatus = null;
        
        // Countdown başlat (süre modu için)
        if (satrancData.lockMode === "time" && !satrancData.jokersUnlocked) {
            _startLockCountdown();
        }
        
        // ✨ Rakibin kullanılmış jokerlerini reveal listesine ekle (Önce Başla için kart açık göster)
        if (msg.opp_revealed_jokers && Array.isArray(msg.opp_revealed_jokers)) {
            msg.opp_revealed_jokers.forEach(j => {
                if (j && j.id) {
                    window._satrancRevealedOppJokers.push({...j, used: true});
                }
            });
        }

        // ✨ Joker panellerini render et
        setTimeout(() => {
            renderMyJokers();
            renderOppJokers();

            const myPidStr = String(satrancData.playerId);
            const oppPidStr = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
            const capturedMap = msg.captured_pieces || {};
            renderCapturedPieces(
                capturedMap[myPidStr] || [],
                capturedMap[oppPidStr] || []
            );
        }, 400);

        satrancData.myColor = msg.my_color;
        satrancData.whiteId = msg.white_id;
        satrancData.blackId = msg.black_id;
        satrancData.whiteName = msg.white_name;
        satrancData.blackName = msg.black_name;
        satrancData.legalMoves = msg.legal_moves || [];
        satrancData.increment = msg.increment || 0;
        satrancData.moveHistory = [];

        // Saatleri ayarla
        const clocks = msg.clocks || {};
        Object.keys(clocks).forEach(pid => {
            satrancData.clocks[parseInt(pid)] = clocks[pid];
        });

        // ✨ Sol panel = SEN, Sağ panel = RAKİP
        const myEl = document.getElementById("satrancP1Name");
        const oppEl = document.getElementById("satrancP2Name");
        const myPid = satrancData.playerId;
        const oppPid = satrancData.players.find(p => p.id !== myPid)?.id;

        const myName = satrancData.players.find(p => p.id === myPid)?.name || "Sen";
        const oppName = satrancData.players.find(p => p.id === oppPid)?.name || "Rakip";

        if (myEl) myEl.textContent = `👤 ${myName} (Sen)`;
        if (oppEl) oppEl.textContent = `👤 ${oppName}`;

        showScreen("satrancGame");

        // Tahta kur
        setTimeout(() => {
            initSatrancBoard(msg.board.fen, msg.my_color, msg.legal_moves);
            updateTurnInfo(msg.board);
            updateClockDisplay();
            if (msg.time_mode !== "suresiz") startSatrancClock();
        }, 300);

        showToast("♟️ Oyun Başladı!", 
            msg.my_color === "w" ? "Sen Beyazsın - İlk hamle sende!" : "Sen Siyahsın - Rakip başlıyor",
            null, "success");

        // ✨ Oyun başlangıç sesi
        playSatrancSound("oyun_baslangic");

        return;
    }

    if (msg.type === "satranc_board_update") {
        // ✨ Eğer ben oynadıysam Hızlı Kaçış flag'ini kaldır (backend zaten sildi)
        if (msg.mover_id === satrancData.playerId) {
            satrancData._hizliKacisActive = false;
        }
        
        // ✨ Joker kilidi durumunu güncelle
        if (msg.lock_status) {
            satrancData.lockStatus = msg.lock_status;
            if (!msg.lock_status.locked) {
                // Kilit açıldı!
                satrancData.jokersUnlocked = true;
                _stopLockCountdown();
                showToast("🔓 Jokerler Açıldı!", "Artık jokerlerini kullanabilirsin!", null, "success");
            }
        }
        // ✨ Görünmez taş yenildiyse ÖNCE flash animasyonu göster, sonra board güncelle
        if (msg.invisible_revealed_kill) {
            const killSquare = msg.invisible_revealed_kill.square;
            const isVictim = (msg.invisible_revealed_kill.owner_id === satrancData.playerId);
            const revealPieceType = msg.invisible_revealed_kill.piece_type;
            const revealPieceColor = msg.invisible_revealed_kill.piece_color;

            // ✨ Sahip için: taşı önce görünür yap ki animasyon yakalayabilsin
            if (isVictim) {
                const $sq = $(`#satrancBoard .square-${killSquare}`);
                $sq.find("img").css("opacity", "1");
                $sq.removeClass("effect-invisible");
                $sq.find(".squareInvisibleCharge").remove();
            }

            // Ses efekti
            try { playSatrancSound("tas_yeme"); } catch (e) {}

            playInvisibleRevealKillAnimation(
                killSquare,
                () => {
                    updateSatrancBoard(msg.board, msg.last_move, msg.effects);
                    if (msg.san_move) addMoveToHistory(msg.san_move);
                    renderClocks(msg.clocks || {});
                    updateTurnInfo(msg.board);
                    renderMyJokers();
                    renderOppJokers();
                    if (msg.captured_pieces) {
                        const myPid = String(satrancData.playerId);
                        const oppPid = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
                        renderCapturedPieces(msg.captured_pieces[myPid] || [], msg.captured_pieces[oppPid] || []);
                    }
                },
                revealPieceType,
                revealPieceColor
            );
            return;
        }
        // ✨ Sansür state güncelle (renderMyJokers'tan ÖNCE)
        if (msg.sansur_state) {
            const myPidS = String(satrancData.playerId);
            const oppPidS = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
            satrancData.mySansurLeft = msg.sansur_state[myPidS] || 0;
            satrancData.oppSansurLeft = msg.sansur_state[oppPidS] || 0;
        }

        updateSatrancBoard(msg.board, msg.last_move, msg.effects);
        if (msg.san_move) addMoveToHistory(msg.san_move);
        renderClocks(msg.clocks || {});
        updateTurnInfo(msg.board);
        renderMyJokers();  // ✨ Sıra değişti, jokerleri yenile
        renderOppJokers();
        renderOppJokers();

        // ✨ Ses efekti: san_move içinde 'x' varsa taş yeme, yoksa hareket
        if (msg.san_move) {
            if (msg.san_move.includes("x")) {
                playSatrancSound("tas_yeme");
            } else {
                playSatrancSound("tas_hareket");
            }
        }

        // ✨ Şah sesi (san_move'da + veya # varsa)
        // + = şah, # = şah mat (mat için ayrıca oyun_bitti çalacak)
        if (msg.san_move && (msg.san_move.includes("+") || msg.san_move.includes("#"))) {
            // Şah mat ise sadece oyun_bitti çalsın, şah sesini ekleme
            if (!msg.san_move.includes("#")) {
                setTimeout(() => playSatrancSound("sah"), 300);
            }
        }
        // Ekstra kontrol: board.is_check ama san yoksa (joker sonrası vs.)
        else if (msg.board && msg.board.is_check && !msg.board.is_checkmate) {
            setTimeout(() => playSatrancSound("sah"), 300);
        }

        if (msg.captured_pieces) {
            const myPid = String(satrancData.playerId);
            const oppPid = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
            renderCapturedPieces(msg.captured_pieces[myPid] || [], msg.captured_pieces[oppPid] || []);
        }

        // ✨ Promosyon animasyonu (sade fade + hafif büyüme)
        if (satrancData.pendingPromotion) {
            const pp = satrancData.pendingPromotion;
            satrancData.pendingPromotion = null;
            setTimeout(() => {
                const $sq = $(`#satrancBoard .square-${pp.to}`);
                $sq.addClass("satrancPromoFade");
                setTimeout(() => $sq.removeClass("satrancPromoFade"), 700);
            }, 550);
        }

        return;
    }
	
	// ✨ Zar atma - intro (3-2-1)
    if (msg.type === "satranc_dice_intro") {
        showDiceIntro(msg);
        return;
    }

    // ✨ Zar atma - zarlar dönüyor + sonuç
    if (msg.type === "satranc_dice_roll") {
        showDiceRoll(msg);
        try { playSatrancSound("zar"); } catch(e) {}
        return;
    }

    // ✨ Zar atma - eşitlik, tekrar (zar sesi tekrar çalsın)
    if (msg.type === "satranc_dice_tie") {
        showDiceTie(msg);
        try { playSatrancSound("zar"); } catch(e) {}
        return;
    }

    // ✨ Zar atma - kazanan belli
    if (msg.type === "satranc_dice_result") {
        showDiceResult(msg);
        return;
    }

    // ✨ Çarkıfelek çark döndü
    if (msg.type === "satranc_carkifelek_spin") {
        showCarkifelekAnimation(msg);
        playSatrancSound("carkifelek");
        return;
    }

    // ✨ Mini Çarkıfelek de çark sesi çalsın
    if (msg.type === "satranc_mini_carkifelek") {
        playSatrancSound("carkifelek");
        // (showMiniCarkifelek zaten aşağıda çağrılıyor)
    }

    // ✨ Mini Çarkıfelek (Taş katliamı için)
    if (msg.type === "satranc_mini_carkifelek") {
        showMiniCarkifelek(msg);
        return;
    }

    // ✨ Lobiye dön (herkese)
    if (msg.type === "satranc_back_to_lobby_broadcast") {
        // Board'u temizle
        if (satrancData.board) {
            try { satrancData.board.destroy(); } catch(e) {}
            satrancData.board = null;
        }
        satrancData.myJokers = [];
        satrancData.oppJokerCount = 0;
        satrancData.usedJokers = [];
        satrancData.moveHistory = [];
        stopSatrancClock();
        cancelSquareSelectMode();

        // ✨ Açık popupları kapat
        const gameOverBox = document.getElementById("satrancGameOverBox");
        if (gameOverBox) gameOverBox.classList.add("hidden");
        const promoOverlay = document.getElementById("satrancPromoOverlay");
        if (promoOverlay) promoOverlay.remove();

        showToast("🏠 Lobiye Döndü", msg.message || "Oyun sonlandırıldı.", null, "info");
        showScreen("satrancLobby");
        updateSatrancLobby();
        return;
    }

    // ✨ Error mesajlarını yakala - joker seçim hataları için özel popup
    if (msg.type === "error" && msg.message) {
        const m = msg.message.toLowerCase();
        // Slot dolu hatası
        if (m.includes("tüm slotlar dolu") || m.includes("slotlar dolu")) {
            satrancInfo({
                icon: "🎴",
                title: "Slotlar Dolu!",
                message: msg.message,
                type: "warning",
                okText: "Anladım"
            });
            return;  // orijinal handler'a gitme
        }
        // Zaten seçili
        if (m.includes("zaten seçtin")) {
            showToast("⚠️", msg.message, null, "warning");
            return;
        }
        // Sıra sende değil
        if (m.includes("sıra sende değil") || m.includes("sadece kendi sıranda")) {
            satrancInfo({
                icon: "⏳",
                title: "Sıra Sende Değil",
                message: msg.message,
                detail: "Jokerlerini sadece kendi sırandayken kullanabilirsin.",
                type: "warning",
                okText: "Anladım"
            });
            return;
        }
        // Taşınız yendi geri alınamaz
        if (m.includes("taşınız yendi")) {
            satrancInfo({
                icon: "❌",
                title: "Geri Al Kullanılamaz",
                message: msg.message,
                detail: "Rakip senin taşını yediyse Geri Al ile eski hâline dönemezsin.",
                type: "danger",
                okText: "Tamam"
            });
            return;
        }
        // Diğer hatalar için orijinal toast'a bırak (app.js'deki genel error handler)
    }

    // ✨ Zaman Durdur tetiklendi (rakip hamlesi iptal)
    if (msg.type === "satranc_zaman_durdur_triggered") {
        showToast("🛑 Zaman Durduruldu!", msg.message, null, "warning");
        return;
    }

    // ✨ Yansıma tetiklendi (kısa toast)
    if (msg.type === "satranc_yansima_triggered") {
        const title = msg.is_attacker ? "🌀 YANSIMA!" : "🌀 Yansıttın!";
        const toastType = msg.is_attacker ? "danger" : "success";
        showToast(title, msg.message, null, toastType);
        try { playSatrancSound("isinlanma"); } catch (e) {}
        return;
    }

    // ✨ Yansıma hasar popup (büyük - Tamam butonlu)
    if (msg.type === "satranc_yansima_damage_popup") {
        showYansimaDamagePopup(
            msg.joker_name || "?",
            msg.joker_icon || "🃏",
            msg.message || "Rakip Yansıma kullandığı için jokerin sana zarar verdi!"
        );
        return;
    }

    // ✨ Yeni joker kazandın (Karşılıklı Ekstra Joker / Joker Hırsızlığı)
    if (msg.type === "satranc_new_joker_gained") {
        if (msg.new_joker) {
            if (!satrancData.myJokers) satrancData.myJokers = [];
            satrancData.myJokers.push(msg.new_joker);
            renderMyJokers();

            // ✨ Karşılıklı Ekstra kaynağıysa hediye kutusu animasyonu
            if (msg.source === "karsilikli_ekstra") {
                showGiftBoxAnimation(msg.new_joker);
            }
        }
        showToast("🎁 Yeni Joker!", msg.message, null, "success");
        return;
    }

    // ✨ Joker çalındı (Joker Hırsızlığı - kurban tarafı)
    if (msg.type === "satranc_joker_stolen") {
        // Kendi joker listemden çalınan jokeri kaldır
        if (msg.stolen_joker && satrancData.myJokers) {
            const idx = satrancData.myJokers.findIndex(j => j.id === msg.stolen_joker.id);
            if (idx >= 0) satrancData.myJokers.splice(idx, 1);
            renderMyJokers();
        }
        showToast("💀 Joker Çalındı!", msg.message, null, "warning");
        return;
    }

    // ✨ Joker Gör → sağ panelde kalıcı açık göster
    if (msg.type === "satranc_reveal_opp_jokers_panel") {
        window._satrancRevealedOppJokers = (msg.jokers || []).map(j => ({
            ...j,
            _revealed: true
        }));
        satrancData.oppJokerCount = (msg.jokers || []).length;
        satrancData.oppUsedJokers = (msg.jokers || []).filter(j => j.used).map(j => j.id);
        renderOppJokers();
        showToast("👁️ Joker Gör", `${msg.opponent_name}'in tüm jokerleri artık görünür!`, null, "success");
        return;
    }
	
	// ✨ Kasa animasyonu
    if (msg.type === "satranc_kasa_animation") {
        showKasaAnimation(msg);
        return;
    }

    // ✨ Sessiz joker kullanımı (sadece sayaç güncelle)
    if (msg.type === "satranc_joker_used_silent") {
        if (msg.user_id === satrancData.playerId) {
            if (!satrancData.usedJokers) satrancData.usedJokers = [];
            if (!satrancData.usedJokers.includes(msg.joker_id)) {
                satrancData.usedJokers.push(msg.joker_id);
            }
            renderMyJokers();
        }
        return;
    }

    // ✨ Sadece toast göster (Joker Gör hedefi için)
    if (msg.type === "satranc_toast_only") {
        showToast(msg.title || "Bildirim", msg.message || "", null, msg.toast_type || "info");
        return;
    }

    // ✨ Rulet sonucu (özel animasyonlu popup + gecikmeli taş silme animasyonu)
    // HEM KULLANAN HEM İZLEYEN için aynı gecikmeli akış
    if (msg.type === "satranc_joker_used" && msg.joker_id === "rulet") {
        // Rulet animasyonu göster (her iki oyuncuda da çalışır)
        showRuletAnimation(msg);
        
        // ✨ Kullanılan jokeri HEMEN kaydet (silik görsün)
        // Ama board güncelleme 7 saniye sonra olacak
        if (msg.user_id === satrancData.playerId) {
            if (!satrancData.usedJokers) satrancData.usedJokers = [];
            if (!satrancData.usedJokers.includes("rulet")) {
                satrancData.usedJokers.push("rulet");
            }
            renderMyJokers();
        } else {
            if (!satrancData.oppUsedJokers) satrancData.oppUsedJokers = [];
            if (!satrancData.oppUsedJokers.includes("rulet")) {
                satrancData.oppUsedJokers.push("rulet");
            }
            revealOppJokerAsUsed("rulet", msg.joker_name, msg.joker_icon);
            renderOppJokers();
        }
        
        // ✨ Taş silme sonucu mu?
        const isPieceRemoval = (msg.rulet_outcome === "opp_lose_piece" || 
                                msg.rulet_outcome === "self_lose_piece");
        
        // Eski board'u sakla (silinecek taşı bulmak için)
        const oldFen = satrancData.game ? satrancData.game.fen() : null;
        const savedMsg = msg;  // closure için
        
        // Popup 7 saniye açık kalacak, board update'i sonrasına ertele
        // HEM KULLANAN HEM İZLEYEN için aynı süre (7 sn)
        setTimeout(() => {
            if (isPieceRemoval && oldFen && savedMsg.board && savedMsg.board.fen) {
                // ✨ Taş silme animasyonu (kırmızı flash + ✖ + kaybol)
                _animateRuletPieceRemoval(oldFen, savedMsg.board.fen, () => {
                    // Animasyon bitti, board update yap
                    updateSatrancBoard(savedMsg.board, null, savedMsg.effects);
                    updateTurnInfo(savedMsg.board);
                    renderMyJokers();
                    renderOppJokers();
                    if (savedMsg.captured_pieces) {
                        const myPid = String(satrancData.playerId);
                        const oppPid = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
                        renderCapturedPieces(savedMsg.captured_pieces[myPid] || [], savedMsg.captured_pieces[oppPid] || []);
                    }
                });
            } else if (savedMsg.board) {
                // ✨ Extra_turn veya skip_opp: sadece board güncelle (animasyon yok)
                updateSatrancBoard(savedMsg.board, null, savedMsg.effects);
                updateTurnInfo(savedMsg.board);
                renderMyJokers();
                renderOppJokers();
                if (savedMsg.captured_pieces) {
                    const myPid = String(satrancData.playerId);
                    const oppPid = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
                    renderCapturedPieces(savedMsg.captured_pieces[myPid] || [], savedMsg.captured_pieces[oppPid] || []);
                }
            }
            
            // Toast göster
            showToast(
                `${savedMsg.joker_icon} ${savedMsg.joker_name}`,
                savedMsg.message,
                null,
                savedMsg.user_id === satrancData.playerId ? "success" : "warning"
            );
        }, 7000);  // 7 saniye sonra (rulet popup kapandıktan sonra)
        
        return;  // ✨ ÖNEMLİ: Normal joker_used akışı ÇALIŞMASIN (çift işlem önlensin)
    }

    // ✨ Joker kullanıldı bildirimi
    if (msg.type === "satranc_joker_used") {
        // ✨ Işınlanma sesi (Işınlanma + Yer Değiştir + Rakip Taş Yerleştir + Rakibi Işınla)
        if (msg.joker_id === "isinlan" || msg.joker_id === "yer_degistir" || msg.joker_id === "rakip_tas_yerlestir" || msg.joker_id === "rakibi_isinla") {
            playSatrancSound("isinlanma");
        }

        // ✨ Kalkan sesi - 2 sesten rastgele biri (%50 şans)
        if (msg.joker_id === "kalkan") {
            const randomKalkan = Math.random() < 0.5 ? "kalkan_1" : "kalkan_2";
            playSatrancSound(randomKalkan);
        }

        // ✨ Kilit sesi
        if (msg.joker_id === "kilitle") {
            playSatrancSound("kilit");
        }

        // ✨ Geri Al sesi
        if (msg.joker_id === "geri_al") {
            playSatrancSound("geri_al");
        }

        // ✨ Kalkan sesi - 2 sesten rastgele biri (%50 şans)
        if (msg.joker_id === "kalkan") {
            const randomKalkan = Math.random() < 0.5 ? "kalkan_1" : "kalkan_2";
            playSatrancSound(randomKalkan);
        }

        // ✨ Kilit sesi
        if (msg.joker_id === "kilitle") {
            playSatrancSound("kilit");
        }

        // ✨ Geri Al sesi
        if (msg.joker_id === "geri_al") {
            playSatrancSound("geri_al");
        }

        // ✨ Sansür state güncelle
        if (msg.sansur_state) {
            const myPidS = String(satrancData.playerId);
            const oppPidS = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
            satrancData.mySansurLeft = msg.sansur_state[myPidS] || 0;
            satrancData.oppSansurLeft = msg.sansur_state[oppPidS] || 0;
        }
        // Kendi kullandıysam kullanılan listesine ekle
        if (msg.user_id === satrancData.playerId) {
            if (!satrancData.usedJokers) satrancData.usedJokers = [];
            if (!satrancData.usedJokers.includes(msg.joker_id)) {
                satrancData.usedJokers.push(msg.joker_id);
            }
            renderMyJokers();
        } else {
            // ✨ Rakip kullandı - kullanılan joker id'sini kaydet + rakibin jokerini aç
            if (!satrancData.oppUsedJokers) satrancData.oppUsedJokers = [];
            if (msg.joker_id && !satrancData.oppUsedJokers.includes(msg.joker_id)) {
                satrancData.oppUsedJokers.push(msg.joker_id);
            }
            // Rakibin jokerlerini görüyor muyuz? Görünen listeye ekleyelim (üstü çizik)
            if (msg.joker_id) {
                revealOppJokerAsUsed(msg.joker_id, msg.joker_name, msg.joker_icon);
            }
            renderOppJokers();
        }

        // Rakip joker sayısı güncelle
        if (msg.opp_joker_counts) {
            // Karşılıklı Ekstra Joker gibi durumlar
            const myId = satrancData.playerId;
            Object.keys(msg.opp_joker_counts).forEach(pid => {
                if (parseInt(pid) !== myId) {
                    satrancData.oppJokerCount = msg.opp_joker_counts[pid];
                }
            });
            renderOppJokers();
        }
        // ✨ Joker kullanınca artık sayacı azaltmıyoruz (üstü çizik gösterilecek)

        // Saat güncelle (Zaman Çal için)
        if (msg.clocks) {
            renderClocks(msg.clocks);
        }
		
		// ✨ Hızlı Kaçış → aktif flag (şah vezir gibi hareket edebilir)
        if (msg.joker_id === "hizli_kacis" && msg.user_id === satrancData.playerId) {
            satrancData._hizliKacisActive = true;
            console.log("[SATRANC] Hızlı Kaçış aktif - şah vezir gibi hareket edebilir");
        }

        // ✨ Bomba animasyonu (board güncellemesinden ÖNCE)
        if (msg.joker_id === "bomba" && msg.explosion_square) {
            playExplosionAnimation(msg.explosion_square);
            playSatrancSound("bomba");
        }

        // ✨ Görünmez animasyonu + anında effect class'ı ekle
        if (msg.joker_id === "gorunmez") {
            if (msg.invisible_hidden_from_you) {
                // Rakibin görünmez jokeri - taş rakip için silinmiş, animasyon yok
            } else if (msg.target) {
                // Kendi görünmez taşımız - fade animasyonu + hemen soluk yap
                playInvisibleFadeAnimation(msg.target);
                // ✨ Class ve opacity'yi HEMEN uygula (board update beklemeden)
                const $sq = $(`#satrancBoard .square-${msg.target}`);
                $sq.addClass("effect-invisible");
                $sq.find("img").css("opacity", "0.3");
                $sq.removeClass("highlight-from highlight-to");

                // Detayları da güncelle
                if (msg.effects && msg.effects.invisible_details) {
                    satrancData.invisibleDetails = msg.effects.invisible_details;
                }
                satrancData.lastInvisibleSquares = [msg.target];

                // ✨ Sağ üste şarj çubukları HEMEN göster (max 8 diş)
                const turnsLeft = (msg.effects && msg.effects.invisible_details) ? (msg.effects.invisible_details[msg.target] || 5) : 5;
                const maxTurns = 8;
                const colorClass = `charge-${Math.min(turnsLeft, 8)}`;
                let bars = "";
                for (let i = 0; i < maxTurns; i++) {
                    const filled = i < turnsLeft ? "filled" : "empty";
                    bars += `<div class="squareChargeBar ${filled}"></div>`;
                }
                $sq.find(".squareInvisibleCharge").remove();
                $sq.append(`<div class="squareInvisibleCharge ${colorClass}" title="Kalan tur: ${turnsLeft}">${bars}</div>`);

                // Kart üzerindeki badge'i de yenile
                renderMyJokers();
            }
        }

        // ✨ Ajan uygulandı - animasyonlu renk değişimi (SADECE sahibi görür)
        if (msg.joker_id === "ajan" && msg.target && msg.ajan_fake_color) {
            const fakeColor = msg.ajan_fake_color;
            const turnsLeft = msg.ajan_turns || 6;
            const square = msg.target;
            const piece = satrancData.game ? satrancData.game.get(square) : null;

            if (!satrancData.ajanDisguised) satrancData.ajanDisguised = {};
            satrancData.ajanDisguised[square] = {color: fakeColor, turns: turnsLeft};

            if (piece) {
                const typeMap = { p: "P", r: "R", n: "N", b: "B", q: "Q", k: "K" };
                const pieceCode = `${fakeColor}${typeMap[piece.type] || "P"}`;
                const $sq = $(`#satrancBoard .square-${square}`);
                const $img = $sq.find("img");

                // Animasyon: taş büyüsün + parla + renk değişsin
                if ($img.length) {
                    $img.css({
                        "transition": "transform 0.5s ease, filter 0.5s ease",
                        "transform": "scale(1.3)",
                        "filter": "drop-shadow(0 0 12px rgba(192,132,252,0.95))"
                    });
                    setTimeout(() => {
                        $img.attr("src", `/satranc_vendor/img/chesspieces/wikipedia/${pieceCode}.png`);
                        $img.css({"transform": "scale(1)", "filter": ""});
                    }, 500);
                }

                // Puf emoji
                const rect = $sq[0].getBoundingClientRect();
                const puf = document.createElement("div");
                puf.className = "satrancInvisiblePuf";
                puf.textContent = "🕵️";
                puf.style.left = (rect.left + rect.width / 2) + "px";
                puf.style.top = (rect.top + rect.height / 2) + "px";
                document.body.appendChild(puf);
                setTimeout(() => puf.remove(), 1000);

                // Sağ üst şarj + sol üst emoji HEMEN göster
                setTimeout(() => {
                    $sq.find(".squareAjanCharge").remove();
                    $sq.find(".ajanSquareEmoji").remove();

                    $sq.append(`<div class="ajanSquareEmoji" title="Ajan taş">🕵️</div>`);

                    const maxTurns = 6;
                    const colorClass = `ajanCharge-${Math.min(turnsLeft, 6)}`;
                    let bars = "";
                    for (let i = 0; i < maxTurns; i++) {
                        const filled = i < turnsLeft ? "filled" : "empty";
                        bars += `<div class="squareChargeBar ${filled}"></div>`;
                    }
                    $sq.append(`<div class="squareAjanCharge ${colorClass}" title="Ajan kalan: ${turnsLeft}">${bars}</div>`);
                }, 600);
            }
            renderMyJokers();
        }

        // ✨ Yer Değiştir / Rakibi Işınla animasyonu - iki taş yer değişirken
        if ((msg.joker_id === "yer_degistir" || msg.joker_id === "rakibi_isinla") && msg.board) {
            // message'dan target1/target2 tespit et
            const matchRes = (msg.message || "").match(/\(([a-h][1-8])\s*↔\s*([a-h][1-8])\)/);
            if (matchRes) {
                const sq1 = matchRes[1];
                const sq2 = matchRes[2];
                _animateYerDegistir(sq1, sq2);
                // Board güncellemesini animasyon sonrasına ertele
                satrancData.legalMoves = [];
                setTimeout(() => {
                    if (msg.board) {
                        updateSatrancBoard(msg.board, null, msg.effects);
                        updateTurnInfo(msg.board);
                        renderMyJokers();
                        renderOppJokers();
                        if (msg.captured_pieces) {
                            const myPid = String(satrancData.playerId);
                            const oppPid = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
                            renderCapturedPieces(msg.captured_pieces[myPid] || [], msg.captured_pieces[oppPid] || []);
                        }
                        // ✨ Ajan görselini agresif olarak birden fazla kez uygula
                        // (Animasyon sonrası src reset olabilir)
                        [100, 400, 800, 1200, 1600].forEach(delay => {
                            setTimeout(() => applyAjanDisguiseVisuals(msg.effects), delay);
                        });
                    }
                    showToast(
                        `${msg.joker_icon} ${msg.joker_name}`,
                        msg.message,
                        null,
                        msg.user_id === satrancData.playerId ? "success" : "warning"
                    );
                }, 800);
                return;  // Diğer akışa gitmesin
            }
        }

        // ✨ Dondur uygulandı - anında görsel (herkes için)
        if (msg.joker_id === "dondur" && msg.target) {
            const $sq = $(`#satrancBoard .square-${msg.target}`);
            $sq.addClass("effect-frozen");

            if (msg.effects && msg.effects.frozen_details) {
                satrancData.frozenDetails = msg.effects.frozen_details;
            }

            const turnsLeft = (msg.effects && msg.effects.frozen_details) ? (msg.effects.frozen_details[msg.target] || 3) : 3;
            const maxTurns = 3;
            const colorClass = `frozenCharge-${turnsLeft}`;
            let bars = "";
            for (let i = 0; i < maxTurns; i++) {
                const filled = i < turnsLeft ? "filled" : "empty";
                bars += `<div class="squareChargeBar ${filled}"></div>`;
            }
            $sq.find(".squareFrozenCharge").remove();
            $sq.append(`<div class="squareFrozenCharge ${colorClass}" title="Donmuş: ${turnsLeft} tur">${bars}</div>`);

            renderMyJokers();
        }
		
		// ✨ Kilitle uygulandı - anında görsel (herkes için)
        if (msg.joker_id === "kilitle" && msg.target) {
            const $sq = $(`#satrancBoard .square-${msg.target}`);
            $sq.addClass("effect-locked");

            if (msg.effects && msg.effects.locked_details) {
                satrancData.lockedDetails = msg.effects.locked_details;
            }

            const turnsLeft = (msg.effects && msg.effects.locked_details) ? (msg.effects.locked_details[msg.target] || 3) : 3;
            const maxTurns = 3;
            const colorClass = `lockedCharge-${Math.min(turnsLeft, 3)}`;
            let bars = "";
            for (let i = 0; i < maxTurns; i++) {
                const filled = i < turnsLeft ? "filled" : "empty";
                bars += `<div class="squareChargeBar ${filled}"></div>`;
            }
            $sq.find(".squareLockedCharge").remove();
            $sq.find(".lockedSquareEmoji").remove();
            $sq.append(`<div class="lockedSquareEmoji">🔒</div>`);
            $sq.append(`<div class="squareLockedCharge ${colorClass}" title="Kilit kalan: ${turnsLeft}">${bars}</div>`);

            renderMyJokers();
            renderOppJokers();
        }

        // ✨ Kalkan uygulandı - anında görsel (herkes için)
        if (msg.joker_id === "kalkan" && msg.target) {
            const $sq = $(`#satrancBoard .square-${msg.target}`);
            $sq.addClass("effect-shielded");

            // Detayları güncelle
            if (msg.effects && msg.effects.shielded_details) {
                satrancData.shieldedDetails = msg.effects.shielded_details;
            }

            // Sağ üste şarj çubukları HEMEN göster
            const turnsLeft = (msg.effects && msg.effects.shielded_details) ? (msg.effects.shielded_details[msg.target] || 4) : 4;
            const maxTurns = 4;
            const colorClass = `shieldCharge-${Math.min(turnsLeft, 4)}`;
            let bars = "";
            for (let i = 0; i < maxTurns; i++) {
                const filled = i < turnsLeft ? "filled" : "empty";
                bars += `<div class="squareChargeBar ${filled}"></div>`;
            }
            $sq.find(".squareShieldCharge").remove();
            $sq.append(`<div class="squareShieldCharge ${colorClass}" title="Kalkan kalan: ${turnsLeft}">${bars}</div>`);

            // Kart badge'ini yenile
            renderMyJokers();
        }

        const applyJokerBoardUpdate = () => {
            if (!msg.board) return;

            updateSatrancBoard(msg.board, null, msg.effects);
            updateTurnInfo(msg.board);
            renderMyJokers();
            renderOppJokers();
            renderOppJokers();

            if (msg.captured_pieces) {
                const myPidStr = String(satrancData.playerId);
                const oppPidStr = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
                renderCapturedPieces(
                    msg.captured_pieces[myPidStr] || [],
                    msg.captured_pieces[oppPidStr] || []
                );
            }
            if (msg.captured_pieces) {
                const myPid = String(satrancData.playerId);
                const oppPid = String(satrancData.players.find(p => p.id !== satrancData.playerId)?.id);
                renderCapturedPieces(msg.captured_pieces[myPid] || [], msg.captured_pieces[oppPid] || []);
            }

            const undoCount = msg.undo_count || (msg.undo_moves ? msg.undo_moves.length : 0);
            if (undoCount > 0 && satrancData.moveHistory.length > 0) {
                for (let i = 0; i < undoCount; i++) {
                    if (satrancData.moveHistory.length > 0) {
                        satrancData.moveHistory.pop();
                    }
                }
                const histEl = document.getElementById("satrancMoveHistory");
                if (histEl) {
                    histEl.innerHTML = "";
                    satrancData.moveHistory.forEach((m, i) => {
                        if (i % 2 === 0) {
                            const num = document.createElement("span");
                            num.className = "satrancMoveNum";
                            num.textContent = `${Math.floor(i / 2) + 1}.`;
                            histEl.appendChild(num);
                        }
                        const span = document.createElement("span");
                        span.className = "satrancMoveChip";
                        span.textContent = m;
                        histEl.appendChild(span);
                    });
                }
            }
        };

        if (msg.board && (msg.joker_id === "vezire_yukselt" || msg.joker_id === "tas_donustur") && msg.target) {
            satrancData.legalMoves = [];
            playPieceTransformAnimation(msg.target, msg.transform_label, msg.transform_icon);

            setTimeout(() => {
                applyJokerBoardUpdate();
                showToast(
                    `${msg.joker_icon} ${msg.joker_name}`,
                    msg.message,
                    null,
                    msg.user_id === satrancData.playerId ? "success" : "warning"
                );
            }, 520);
            return;
        }

        applyJokerBoardUpdate();

        showToast(
            `${msg.joker_icon} ${msg.joker_name}`,
            msg.message,
            null,
            msg.user_id === satrancData.playerId ? "success" : "warning"
        );
        return;
    }

    // ✨ İyileştir menüsü
    if (msg.type === "satranc_iyilestir_menu") {
        showIyilestirMenu(msg.active_effects || []);
        return;
    }

    // ✨ Taşımı Geri Ver menüsü
    if (msg.type === "satranc_tasimi_geri_menu") {
        showTasimiGeriMenu(msg.lost_pieces || []);
        return;
    }

    if (msg.type === "satranc_your_turn") {
        satrancData.legalMoves = msg.legal_moves || [];
        satrancData.invisibleCaptureSquares = msg.invisible_capture_squares || [];
        renderMyJokers();  // ✨ Sıra bende, jokerleri güncelle
        if (msg.is_check) {
            // ✨ Kalkanlı şah varsa uyarı gösterme (kalkan koruyor)
            const myKingSq = (() => {
                if (!satrancData.game) return null;
                const b = satrancData.game.board();
                for (let r = 0; r < 8; r++)
                    for (let c = 0; c < 8; c++) {
                        const p = b[r][c];
                        if (p && p.type === "k" && p.color === satrancData.myColor)
                            return "abcdefgh"[c] + (8 - r);
                    }
                return null;
            })();
            const shieldedNow = Object.keys(satrancData.shieldedDetails || {});
            if (!myKingSq || !shieldedNow.includes(myKingSq)) {
                showToast("⚠️ ŞAH!", "Şahtan çıkman lazım!", null, "warning");
            }
        }
        return;
    }

    // ✨ Promosyon gerekli - yenilen taşlardan seç
    if (msg.type === "satranc_promotion_needed") {
        showCapturedPromotionPopup(msg.from, msg.to, msg.captured_pieces || []);
        return;
    }

    if (msg.type === "satranc_clock_update") {
        renderClocks(msg.clocks || {});
        return;
    }

    if (msg.type === "satranc_game_over") {
        // ✨ Şah mat olduysa 5 saniye bekle (kırmızı şah animasyonu + toast görünsün)
        // Diğer durumlar (istifa, süre, berabere) hemen göster
        const isCheckmate = msg.reason === "checkmate";
        
        if (isCheckmate) {
            // ✨ ÖNCELİKLE BOARD'U GÜNCELLE (son taş yenmiş görünsün)
            if (msg.board) {
                updateSatrancBoard(msg.board, msg.last_move, msg.effects || {});
                if (msg.san_move) addMoveToHistory(msg.san_move);
            }
            
            // ✨ Taş yeme sesi (mat hamlesi zaten "x" içeriyor)
            if (msg.san_move && msg.san_move.includes("x")) {
                try { playSatrancSound("tas_yeme"); } catch(e) {}
            } else {
                try { playSatrancSound("tas_hareket"); } catch(e) {}
            }
            
            // ✨ Şah sesi çal (dramatik efekt)
            setTimeout(() => {
                try { playSatrancSound("sah"); } catch(e) {}
            }, 400);
            
            // ✨ Kırmızı şah karesini vurgula + toast göster
            setTimeout(() => {
                const $checkSq = $("#satrancBoard .highlight-check");
                if ($checkSq.length) {
                    $checkSq.css({
                        "animation": "matCheckPulse 0.6s ease-in-out infinite",
                    });
                }
                // ✨ KIRMIZI TOAST: Şah mat mesajı
                showToast(
                    "👑 ŞAH MAT!",
                    "Kaçacak yer kalmadı!",
                    null,
                    "danger"
                );
            }, 500);
            
            // 5 saniye sonra sonuç popup göster
            setTimeout(() => {
                showSatrancGameOver(msg);
                playSatrancSound("oyun_bitti");
            }, 5000);
        } else {
            // Diğer durumlar (istifa, süre, berabere) → hemen göster
            showSatrancGameOver(msg);
            playSatrancSound("oyun_bitti");
        }
        return;
    }

    _prevHandleSatranc(msg);
};

// ==========================================
// BUTON EVENT'LERİ
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    // ✨ Pick mode'a göre süre alanını gizle/göster
    function _updateSatrancPickSecondsVisibility() {
        const pmSel = document.getElementById("satrancPickModeSelect");
        const psBox = document.getElementById("satrancPickSecondsBox");
        if (!pmSel || !psBox) return;
        if (pmSel.value === "karisik") {
            psBox.style.display = "none";
        } else {
            psBox.style.display = "";
        }
    }

    // Dropdown değişince göster/gizle
    const pmSelListener = document.getElementById("satrancPickModeSelect");
    if (pmSelListener) {
        pmSelListener.addEventListener("change", _updateSatrancPickSecondsVisibility);
    }

    // ✨ Joker Kilidi Modu değişince alt kutuları göster/gizle
    function _updateSatrancLockVisibility() {
        const lockSel = document.getElementById("satrancLockModeSelect");
        const piecesBox = document.getElementById("satrancLockPiecesBox");
        const minutesBox = document.getElementById("satrancLockMinutesBox");
        if (!lockSel) return;
        const val = lockSel.value;
        if (piecesBox) piecesBox.style.display = (val === "pieces") ? "" : "none";
        if (minutesBox) minutesBox.style.display = (val === "time") ? "" : "none";
    }
    
    const lockSelListener = document.getElementById("satrancLockModeSelect");
    if (lockSelListener) {
        lockSelListener.addEventListener("change", _updateSatrancLockVisibility);
    }

    // Mod kartı
    const modCard = document.querySelector('.mod-card[data-mod="jokerli_satranc"]');
    if (modCard) {
        modCard.addEventListener("click", () => {
            showScreen("createSatranc");
            const nameInput = document.getElementById("createSatrancNameInput");
            if (nameInput) {
                const saved = localStorage.getItem("playerName");
                if (saved) nameInput.value = saved;
                nameInput.focus();
            }

            // ✨ Eski ayarları yükle
            const savedTimeMode = localStorage.getItem("satrancTimeMode");
            const savedJokerCount = localStorage.getItem("satrancJokerCount");
            const savedPickMode = localStorage.getItem("satrancPickMode");
            const savedPickSeconds = localStorage.getItem("satrancPickSeconds");
            const savedLockMode = localStorage.getItem("satrancLockMode");
            const savedLockPieces = localStorage.getItem("satrancLockPieces");
            const savedLockMinutes = localStorage.getItem("satrancLockMinutes");

            const tmSel = document.getElementById("satrancTimeModeSelect");
            const jcSel = document.getElementById("satrancJokerCountSelect");
            const pmSel = document.getElementById("satrancPickModeSelect");
            const psSel = document.getElementById("satrancPickSecondsSelect");
            const lmSel = document.getElementById("satrancLockModeSelect");
            const lpSel = document.getElementById("satrancLockPiecesSelect");
            const lmnSel = document.getElementById("satrancLockMinutesSelect");

            if (tmSel && savedTimeMode) tmSel.value = savedTimeMode;
            if (jcSel && savedJokerCount) jcSel.value = savedJokerCount;
            if (pmSel && savedPickMode) pmSel.value = savedPickMode;
            if (psSel && savedPickSeconds) psSel.value = savedPickSeconds;
            if (lmSel && savedLockMode) lmSel.value = savedLockMode;
            if (lpSel && savedLockPieces) lpSel.value = savedLockPieces;
            if (lmnSel && savedLockMinutes) lmnSel.value = savedLockMinutes;

            // ✨ Sayfa açılışında da göster/gizle uygula
            _updateSatrancPickSecondsVisibility();
            _updateSatrancLockVisibility();
        });
    }

    // Oda oluştur
    const createBtn = document.getElementById("createSatrancBtn");
    if (createBtn) {
        createBtn.onclick = () => {
            const nameInput = document.getElementById("createSatrancNameInput");
            const name = nameInput ? nameInput.value.trim() : "";
            if (!name) {
                const msgEl = document.getElementById("createSatrancMsg");
                if (msgEl) { msgEl.textContent = "İsim gir."; msgEl.style.color = "#ff6b6b"; }
                return;
            }
            localStorage.setItem("playerName", name);

            const timeMode = document.getElementById("satrancTimeModeSelect").value;
            const jokerCount = parseInt(document.getElementById("satrancJokerCountSelect").value);
            const pickMode = document.getElementById("satrancPickModeSelect").value;
            const pickSeconds = parseInt(document.getElementById("satrancPickSecondsSelect").value);
            const lockMode = document.getElementById("satrancLockModeSelect")?.value || "off";
            const lockPieces = parseInt(document.getElementById("satrancLockPiecesSelect")?.value || "3");
            const lockMinutes = parseInt(document.getElementById("satrancLockMinutesSelect")?.value || "2");

            // ✨ Ayarları kaydet (sonraki oda kurulumunda hatırla)
            localStorage.setItem("satrancTimeMode", timeMode);
            localStorage.setItem("satrancJokerCount", String(jokerCount));
            localStorage.setItem("satrancPickMode", pickMode);
            localStorage.setItem("satrancPickSeconds", String(pickSeconds));
            localStorage.setItem("satrancLockMode", lockMode);
            localStorage.setItem("satrancLockPieces", String(lockPieces));
            localStorage.setItem("satrancLockMinutes", String(lockMinutes));

            send({
                type: "satranc_create_room",
                name: name,
                time_mode: timeMode,
                joker_count: jokerCount,
                pick_mode: pickMode,
                pick_seconds: pickSeconds,
                lock_mode: lockMode,
                lock_pieces: lockPieces,
                lock_minutes: lockMinutes
            });
        };
    }

    // Geri
    const backBtn = document.getElementById("createSatrancBackBtn");
    if (backBtn) backBtn.onclick = () => showScreen("modselect");

    // Başlat
    const startBtn = document.getElementById("satrancStartBtn");
    if (startBtn) startBtn.onclick = () => send({ type: "satranc_start_game" });

    // Ayrıl
    const leaveBtn = document.getElementById("satrancLobbyLeaveBtn");
    if (leaveBtn) leaveBtn.onclick = () => {
        if (typeof window._showLeaveConfirmPopup === "function") window._showLeaveConfirmPopup();
    };

    // Oda ayarları
    const settingsBtn = document.getElementById("satrancRoomSettingsBtn");
    if (settingsBtn) settingsBtn.onclick = () => openSatrancRoomSettings();

    // İstifa
    const resignBtn = document.getElementById("satrancResignBtn");
    if (resignBtn) {
        resignBtn.onclick = () => {
            satrancConfirm({
                icon: "🏳️",
                title: "Terk Et",
                message: "Oyundan çekilmek istediğine emin misin?",
                detail: "Oyunu Terk Edersen Rakinin Kazanacak.",
                type: "danger",
                yesText: "Evet, Terk Et",
                noText: "❌ Vazgeç"
            }).then(ok => {	
                if (ok) send({ type: "satranc_resign" });
            });
        };
    }

    // Oyun sonu - Tekrar Oyna
    const rematchBtn = document.getElementById("satrancRematchBtn");
    if (rematchBtn) rematchBtn.onclick = () => {
        // ✨ Game over box'ı kapat
        const gameOverBox = document.getElementById("satrancGameOverBox");
        if (gameOverBox) gameOverBox.classList.add("hidden");
        // Board'u da temizle
        if (satrancData.board) {
            try { satrancData.board.destroy(); } catch(e) {}
            satrancData.board = null;
        }
        send({ type: "satranc_rematch" });
    };

    // Oyun sonu - Lobiye Dön
    const lobbyBtn = document.getElementById("satrancBackToLobbyBtn");
    if (lobbyBtn) {
        lobbyBtn.onclick = () => {
            document.getElementById("satrancGameOverBox").classList.add("hidden");
            stopSatrancClock();
            if (satrancData.playerId === 1) {
                // ✨ Host → broadcast et, herkes lobiye dönsün
                send({ type: "satranc_back_to_lobby" });
            } else {
                showScreen("satrancLobby");
                updateSatrancLobby();
            }
        };
    }

    // Oyun sonu - Ana Menü
    const menuBtn = document.getElementById("satrancBackToMenuBtn");
    if (menuBtn) {
        menuBtn.onclick = () => {
            document.getElementById("satrancGameOverBox").classList.add("hidden");
            stopSatrancClock();
            inRoom = false;
            satrancData.inGame = false;
            if (ws) { try { ws.close(); } catch(e) {} }
            connectWS();
            showScreen("home");
        };
    }

    // Oyun içi geri
    const gameBackBtn = document.getElementById("satrancBackBtn");
    if (gameBackBtn) {
        gameBackBtn.onclick = () => {
            if (typeof window._showLeaveConfirmPopup === "function") {
                window._showLeaveConfirmPopup();
            }
        };
    }

    // ✨ Joker seçim confirm butonu
    const confirmBtn = document.getElementById("satrancJsConfirmBtn");
    if (confirmBtn) {
        confirmBtn.onclick = () => {
            playSatrancSound("joker_onay");
            send({ type: "satranc_confirm_jokers" });
        };
    }
});

// Pencere yeniden boyutlanınca tahtayı fit et
window.addEventListener("resize", () => {
    if (satrancData.board) {
        try { satrancData.board.resize(); } catch(e) {}
    }
});

// ✨ Joker seçim ekranında ESC → lobiye dön popup
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    
    const jsScreen = document.getElementById("satrancJokerSelectScreen");
    if (!jsScreen || jsScreen.classList.contains("hidden")) return;
    
    // Chat açıksa önce chat kapansın
    if (satrancChat.open) return;
    
    // Başka popup açıksa yoksay
    const anyPopup = document.querySelector(".overlay:not(.hidden), .satrancModalOverlay.show");
    if (anyPopup) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // ✨ Host ise lobiye dön, değilse sadece ayrıl
    if (satrancData.playerId === 1) {
        satrancConfirm({
            icon: "🏠",
            title: "Lobiye Dön",
            message: "Joker seçimini iptal edip lobiye dönmek istiyor musun?",
            type: "warning",
            yesText: "Evet, Lobiye Dön",
            noText: "Hayır"
        }).then(ok => {
            if (ok) {
                send({ type: "satranc_back_to_lobby" });
            }
        });
    } else {
        if (typeof window._showLeaveConfirmPopup === "function") {
            window._showLeaveConfirmPopup();
        }
    }
}, true);

console.log("♟️ Jokerli Satranç JS yüklendi ✓");