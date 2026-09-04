// ==========================================================================
// 🖥️ MİNİ FUTBOL - UI YÖNETİMİ (Lobby, Scoreboard, HUD, Popups, Settings)
// ==========================================================================

// ✨ Drag & Drop state
let miniDragPlayerId = null;
let miniDragFromTeam = null;

// ========================================
// ⏸️ PAUSE LOBBY VE QUICK PAUSE SİSTEMLERİ (Eksik Tanımlar Eklendi ✅)
// ========================================
function showMiniPauseLobby() {
    const isHost = miniData.playerId === 1;
    if (isHost) {
        const box = document.getElementById("miniPauseLobbyBox");
        if (box) {
            box.classList.remove("hidden");
            
            // ✨ Pause butonlarını görünür yap
            const resBtn = document.getElementById("miniPauseResumeBtn");
            const restBtn = document.getElementById("miniPauseRestartBtn");
            if (resBtn) {
                resBtn.classList.remove("hidden");
                resBtn.style.display = "inline-block";
            }
            if (restBtn) {
                restBtn.classList.remove("hidden");
                restBtn.style.display = "inline-block";
            }

            updateMiniPauseLobby();
        }
    } else {
        const guestBox = document.getElementById("miniGuestPausedBox");
        if (guestBox) {
            guestBox.classList.remove("hidden");
        }
    }
}

function hideMiniPauseLobby() {
    const box = document.getElementById("miniPauseLobbyBox");
    if (box) {
        box.classList.add("hidden");
        // Butonları temizle
        const resBtn = document.getElementById("miniPauseResumeBtn");
        if (resBtn) resBtn.style.display = "none";
    }
    
    const guestBox = document.getElementById("miniGuestPausedBox");
    if (guestBox) guestBox.classList.add("hidden");
}

function updateMiniPauseLobby() {
    const redPlayers = miniData.players.filter(p => p.team === "red");
    const bluePlayers = miniData.players.filter(p => p.team === "blue");
    const spectators = miniData.players.filter(p => p.team === "spectator" || !p.team);
    
    renderTeamColumn("miniPauseRedCol", redPlayers, "red");
    renderTeamColumn("miniPauseSpecCol", spectators, "spectator");
    renderTeamColumn("miniPauseBlueCol", bluePlayers, "blue");
    
    const totalMax = miniData.playerCount || 2;
    const halfMax = Math.floor(totalMax / 2);
    
    const redCount = document.getElementById("miniPauseRedCount");
    const blueCount = document.getElementById("miniPauseBlueCount");
    const specCount = document.getElementById("miniPauseSpecCount");
    
    if (redCount) redCount.textContent = `(${redPlayers.length}/${halfMax})`;
    if (blueCount) blueCount.textContent = `(${bluePlayers.length}/${halfMax})`;
    if (specCount) specCount.textContent = `(${spectators.length})`;
    
    const pRedNameEl = document.getElementById("miniPauseRedTeamName");
    const pBlueNameEl = document.getElementById("miniPauseBlueTeamName");
    const dynRedL = miniData.redTeamColor || "#ff6b6b";
    const dynBlueL = miniData.blueTeamColor || "#4dabf7";
    
    if (pRedNameEl) {
        pRedNameEl.textContent = miniData.redTeamName;
        pRedNameEl.style.color = dynRedL;
    }
    if (pBlueNameEl) {
        pBlueNameEl.textContent = miniData.blueTeamName;
        pBlueNameEl.style.color = dynBlueL;
    }
}

function showMiniQuickPauseOverlay() {
    const overlay = document.getElementById("miniQuickPauseOverlay");
    if (overlay) {
        overlay.style.display = "flex";
    }
}

function hideMiniQuickPauseOverlay() {
    const overlay = document.getElementById("miniQuickPauseOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }
}

// ========================================
// 🛡️ ONAY VE GÜVENLİK POPUP MODALLERİ (Dinamik)
// ========================================
function showMiniRestartConfirm() {
    const existing = document.getElementById("miniRestartConfirm");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "miniRestartConfirm";
    overlay.className = "overlay";
    overlay.style.zIndex = "999999";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:400px; border:2px solid #ffd43b; box-shadow: 0 0 40px rgba(255,212,59,0.35);">
            <div style="font-size:50px; margin:10px 0;">🔄</div>
            <h2 style="color:#ffd43b; margin:10px 0 15px 0;">Maçı Yeniden Başlat</h2>
            <p style="color:#adb5bd; font-size:14px; margin:0 0 20px 0; line-height:1.5;">
                Mevcut skor ve istatistikler sıfırlanacak. Devam etmek istiyor musun?
            </p>
            <div class="confirmButtons">
                <button id="miniRestartYesBtn" class="bigBtn greenBtn">✅ EVET, YENİDEN BAŞLAT</button>
                <button id="miniRestartNoBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("miniRestartYesBtn").onclick = () => {
        send({ type: "mini_restart" });
        overlay.remove();
    };
    document.getElementById("miniRestartNoBtn").onclick = () => {
        overlay.remove();
    };
}

function showMiniLobbyReturnConfirm() {
    const existing = document.getElementById("miniLobbyReturnConfirm");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "miniLobbyReturnConfirm";
    overlay.className = "overlay";
    overlay.style.zIndex = "999999";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:400px; border:2px solid #e67e22; box-shadow: 0 0 40px rgba(230,126,34,0.35);">
            <div style="font-size:50px; margin:10px 0;">🚪</div>
            <h2 style="color:#e67e22; margin:10px 0 15px 0;">Lobiye Dön</h2>
            <p style="color:#adb5bd; font-size:14px; margin:0 0 20px 0; line-height:1.5;">
                Maçı yarıda kesip lobiye dönmek istediğine emin misin?
            </p>
            <div class="confirmButtons">
                <button id="miniLobbyReturnYesBtn" class="bigBtn greenBtn">🚪 EVET, LOBİYE DÖN</button>
                <button id="miniLobbyReturnNoBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("miniLobbyReturnYesBtn").onclick = () => {
        send({ type: "mini_return_to_lobby" });
        overlay.remove();
    };
    document.getElementById("miniLobbyReturnNoBtn").onclick = () => {
        overlay.remove();
    };
}

function showMiniGuestLobbyConfirm() {
    const existing = document.getElementById("miniGuestLobbyConfirm");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "miniGuestLobbyConfirm";
    overlay.className = "overlay";
    overlay.style.zIndex = "999999";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:400px; border:2px solid #4dabf7; box-shadow: 0 0 40px rgba(77,171,247,0.35);">
            <div style="font-size:50px; margin:10px 0;">🚪</div>
            <h2 style="color:#4dabf7; margin:10px 0 15px 0;">Lobiye Dön</h2>
            <p style="color:#adb5bd; font-size:14px; margin:0 0 20px 0; line-height:1.5;">
                Lobiye dönmek istediğine emin misin?
            </p>
            <div class="confirmButtons">
                <button id="miniGuestLobbyYesBtn" class="bigBtn greenBtn">🚪 EVET</button>
                <button id="miniGuestLobbyNoBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("miniGuestLobbyYesBtn").onclick = () => {
        send({ type: "mini_guest_return_to_lobby" });
        overlay.remove();
    };
    document.getElementById("miniGuestLobbyNoBtn").onclick = () => {
        overlay.remove();
    };
}

function openMiniKickConfirm(playerId, name) {
    const existing = document.getElementById("miniKickConfirm");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "miniKickConfirm";
    overlay.className = "overlay";
    overlay.style.zIndex = "999999";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:400px; border:2px solid #ff6b6b; box-shadow: 0 0 40px rgba(255,107,107,0.35);">
            <div style="font-size:50px; margin:10px 0;">🚫</div>
            <h2 style="color:#ff6b6b; margin:10px 0 15px 0;">Oyuncuyu At</h2>
            <p style="color:#adb5bd; font-size:14px; margin:0 0 20px 0; line-height:1.5;">
                <b style="color:#fff;">${name}</b> isimli oyuncuyu odadan atmak istediğine emin misin?
            </p>
            <div class="confirmButtons">
                <button id="miniKickYesBtn" class="bigBtn redBtn">🚫 EVET, AT</button>
                <button id="miniKickNoBtn" class="bigBtn greenBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("miniKickYesBtn").onclick = () => {
        send({ type: "mini_kick_player", target_id: playerId });
        overlay.remove();
    };
    document.getElementById("miniKickNoBtn").onclick = () => {
        overlay.remove();
    };
}

function showEscPopup() {
    if (typeof window._showLeaveConfirmPopup === "function") {
        window._showLeaveConfirmPopup();
    } else {
        const ok = confirm("Odadan ayrılmak istediğine emin misin?");
        if (ok) {
            send({ type: "mini_leave_room" });
            stopMiniGame();
            showScreen("modselect");
        }
    }
}

// ========================================
// 🎨 GLOBAL SES ÇALMA (mlVolumeRange uyumlu)
// ========================================
function playGlobalSound(name, volMultiplier = 1) {
    let vol = 0.5;
    const volRange = document.getElementById("mlVolumeRange");
    if (volRange) {
        vol = parseFloat(volRange.value);
        if (isNaN(vol)) vol = 0.5;
    }
    const audio = new Audio(`/static/sounds/${name}`);
    audio.volume = Math.max(0, Math.min(1, vol * volMultiplier));
    audio.play().catch(e => console.warn("[MINI SOUND] Ses çalınamadı:", e));
}

// ========================================
// 🎮 KONTROL BİLGİSİ GÜNCELLEME
// ========================================
function updateGamepadUI() {
    const section = document.getElementById("miniGamepadSection");
    if (section) {
        section.classList.add("hidden");
    }
    updateKeyBindingsUI();
}

function updateKeyBindingsUI() {
    const p1TextEl = document.getElementById("miniKeyP1Text");
    const p2Div = document.getElementById("miniKeyP2");
    
    if (!p1TextEl) return;
    
    if (miniGamepad.connected) {
        p1TextEl.innerHTML = `⌨️ <b>Klavye</b>: WASD | Space | Shift &nbsp;+&nbsp; 🎮 <b>Kontrolcü</b>: Stick | X/Kare | R2`;
    } else {
        p1TextEl.innerHTML = `⌨️ <b>Klavye</b>: WASD hareket | Space şut | Sol Shift sprint`;
    }
    
    if (p2Div) p2Div.classList.add("hidden");
}

function updateMiniControlsInfo() {
    const controlsEl = document.getElementById("miniControlsInfo");
    if (!controlsEl) return;
    
    const p1Keys = getSavedKeys("p1");
    
    const kMove = `${keyLabel(p1Keys.up)} ${keyLabel(p1Keys.left)} ${keyLabel(p1Keys.down)} ${keyLabel(p1Keys.right)}`;
    const kKick = keyLabel(p1Keys.kick);
    const kSprint = keyLabel(p1Keys.sprint);
    
    const gpP1 = miniGamepad.connected && miniGamepad.slot === "p1";
    const gpP2 = miniGamepad.connected && miniGamepad.slot === "p2";
    
    const isSplitOwner = miniData.splitScreen && miniData.splitOwner === miniData.playerId;
    
    if (!isSplitOwner) {
        if (gpP1) {
            controlsEl.innerHTML = `
                <div style="color:#c084fc;">
                    🎮 <b>Kontrolcü:</b> Sol Stick / D-Pad hareket &nbsp;|&nbsp; X / Kare şut &nbsp;|&nbsp; R2 sprint &nbsp;|&nbsp; <b>START</b> Atla ⏭️
                </div>
                <div style="color:#adb5bd; margin-top:4px; font-size:12px;">
                    ⌨️ (Klavye: ${kMove} | ${kKick} | ${kSprint} &nbsp;|&nbsp; <b>ENTER</b> Replay Atla)
                </div>
            `;
        } else {
            controlsEl.innerHTML = `<b>Hareket:</b> ${kMove} / Ok Tuşları &nbsp;|&nbsp; <b>Şut:</b> ${kKick} / Num 0 &nbsp;|&nbsp; <b>Sprint:</b> ${kSprint} ⚡ &nbsp;|&nbsp; <b>Replay Atla:</b> ENTER ⏭️`;
        }
        return;
    }
    
    let p1Line = gpP1 
        ? `🎮 <b>P1:</b> Stick | X / Kare şut | R2 sprint | <b>START</b> Atla ⏭️`
        : `⌨️ <b>P1:</b> ${kMove} | ${kKick} | ${kSprint} | <b>ENTER</b> Atla ⏭️`;
    
    let p2Line = gpP2 
        ? `🎮 <b>P2:</b> Stick | X / Kare şut | R2 sprint | <b>START</b> Atla ⏭️`
        : `⌨️ <b>P2:</b> Oklar | Num 0 şut | Num 1 sprint | <b>ENTER</b> Atla ⏭️`;
    
    controlsEl.innerHTML = `
        <div style="color:#ff6b6b;">${p1Line}</div>
        <div style="color:#4dabf7; margin-top:4px;">${p2Line}</div>
    `;
}

// ========================================
// 🎨 DRAG & DROP LOBBY
// ========================================
function clearMiniDropHighlights() {
    const ids = [
        "miniRedColumn", "miniSpecColumn", "miniBlueColumn",
        "miniPauseRedCol", "miniPauseSpecCol", "miniPauseBlueCol"
    ];
    
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.outline = "";
        el.style.outlineOffset = "";
        el.style.backgroundColor = "";
    });
}

function setupMiniDropZone(container, teamKey) {
    if (!container) return;
    
    container.style.minHeight = "72px";
    container.title = miniData.playerId === 1 ? "Oyuncuyu buraya sürükleyip bırak" : "";
    
    container.ondragover = (e) => {
        if (miniData.playerId !== 1 || !miniDragPlayerId) return;
        
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        
        clearMiniDropHighlights();
        container.style.outline = "2px dashed #ffd43b";
        container.style.outlineOffset = "4px";
        container.style.backgroundColor = "rgba(255, 212, 59, 0.08)";
    };
    
    container.ondrop = (e) => {
        if (miniData.playerId !== 1 || !miniDragPlayerId) return;
        
        e.preventDefault();
        
        const targetId = miniDragPlayerId;
        const fromTeam = miniDragFromTeam;
        
        miniDragPlayerId = null;
        miniDragFromTeam = null;
        clearMiniDropHighlights();
        
        if (!targetId || fromTeam === teamKey) return;
        
        console.log(`[MINI DND] Oyuncu ${targetId}: ${fromTeam} → ${teamKey}`);
        movePlayer(targetId, teamKey);
    };
    
    container.ondragleave = (e) => {
        const nextEl = e.relatedTarget;
        if (nextEl && container.contains(nextEl)) return;
        
        container.style.outline = "";
        container.style.outlineOffset = "";
        container.style.backgroundColor = "";
    };
}

// ========================================
// 🖱️ SAĞ TIK BAĞLAM MENÜSÜ (Oyuncu Yönetimi)
// ========================================
function showPlayerContextMenu(e, playerObj) {
    const existing = document.getElementById("miniPlayerCtxMenu");
    if (existing) existing.remove();

    // Animasyon CSS (tek sefer ekle)
    if (!document.getElementById("miniCtxMenuStyle")) {
        const st = document.createElement("style");
        st.id = "miniCtxMenuStyle";
        st.textContent = `
            @keyframes ctxMenuFadeIn {
                from { opacity: 0; transform: scale(0.92) translateY(-4px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
            }
        `;
        document.head.appendChild(st);
    }

    const pTeamName = playerObj.team === "red" ? miniData.redTeamName : (playerObj.team === "blue" ? miniData.blueTeamName : "");
    const isClub = isClubTeam(pTeamName);
    const isTeamPlayer = playerObj.team === "red" || playerObj.team === "blue";
    const isMe = playerObj.id === miniData.playerId;
    const isHost = miniData.playerId === 1;

    const menu = document.createElement("div");
    menu.id = "miniPlayerCtxMenu";
    menu.style.cssText = `
        position: fixed;
        left: ${e.clientX}px;
        top: ${e.clientY}px;
        background: rgba(22, 27, 42, 0.97);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04);
        z-index: 99999999;
        min-width: 200px;
        padding: 5px 0;
        backdrop-filter: blur(14px);
        animation: ctxMenuFadeIn 0.15s ease-out;
        user-select: none;
    `;

    // Başlık (oyuncu ismi)
    const header = document.createElement("div");
    header.style.cssText = "padding: 8px 14px 6px; font-size: 11px; color: #6c757d; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid rgba(255,255,255,0.06); margin-bottom: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
    header.textContent = isMe ? `${playerObj.name} (Sen)` : playerObj.name;
    menu.appendChild(header);

    // Menü öğesi oluşturma yardımcısı
    function addMenuItem(emoji, label, color, hoverBg, onClick) {
        const item = document.createElement("div");
        item.style.cssText = `padding: 9px 14px; font-size: 13px; color: ${color}; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: background 0.12s; border-radius: 6px; margin: 2px 5px;`;
        item.innerHTML = `${emoji} ${label}`;
        item.onmouseenter = () => item.style.background = hoverBg;
        item.onmouseleave = () => item.style.background = "transparent";
        item.onclick = () => { menu.remove(); onClick(); };
        menu.appendChild(item);
    }

    // ✏️ İsim Değiştir (Sadece oyuncu kendi ismini değiştirebilir, Admin başkasının ismini değiştiremez)
    if (isMe) {
        addMenuItem("✏️", "İsmimi Değiştir", "#51cf66", "rgba(81, 207, 102, 0.12)", () => {
            showMiniNameEditor(playerObj);
        });
    }

    // 👕 Forma Numarası (Herkes kendi numarasını değiştirebilir + Admin herkesinkini değiştirebilir)
    if (isClub && isTeamPlayer && (isMe || isHost)) {
        const jerseyLabel = isMe ? "Forma Numaramı Değiştir" : "Forma Numarası Değiştir";
        addMenuItem("👕", jerseyLabel, "#c084fc", "rgba(192, 132, 252, 0.12)", () => {
            showJerseyNumberEditor(playerObj);
        });
    }

    // ❌ Oyuncuyu At (Sadece admin, kendisi hariç)
    if (isHost && !isMe) {
        // Ayırıcı çizgi
        const separator = document.createElement("div");
        separator.style.cssText = "height: 1px; background: rgba(255,255,255,0.06); margin: 4px 10px;";
        menu.appendChild(separator);

        addMenuItem("❌", "Oyuncuyu At", "#ff6b6b", "rgba(255, 107, 107, 0.12)", () => {
            openMiniKickConfirm(playerObj.id, playerObj.name);
        });
    }

    document.body.appendChild(menu);

    // Ekran dışına taşma kontrolü
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + "px";
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + "px";

    // Dışarı tıklayınca kapat
    const closeHandler = (ev) => {
        if (!menu.contains(ev.target)) {
            menu.remove();
            document.removeEventListener("mousedown", closeHandler, true);
        }
    };
    setTimeout(() => document.addEventListener("mousedown", closeHandler, true), 10);
}

// ========================================
// ✏️ İSİM DEĞİŞTİRME POPUP
// ========================================
function showMiniNameEditor(playerObj) {
    const existing = document.getElementById("miniNameEditorPopup");
    if (existing) existing.remove();

    const isMe = playerObj.id === miniData.playerId;
    const teamColor = playerObj.team === "red" ? (miniData.redTeamColor || "#ff6b6b") : (playerObj.team === "blue" ? (miniData.blueTeamColor || "#4dabf7") : "#adb5bd");
    const teamGlow = hexToRgba(teamColor, 0.4);

    const overlay = document.createElement("div");
    overlay.id = "miniNameEditorPopup";
    overlay.className = "overlay";
    overlay.style.zIndex = "999999";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:420px; border:2px solid ${teamColor}; box-shadow: 0 0 40px ${teamGlow};">
            <div style="font-size:50px; margin:10px 0;">✏️</div>
            <h2 style="color:${teamColor}; margin:10px 0 15px 0;">${isMe ? "İsmini Değiştir" : `${playerObj.name} - İsim Değiştir`}</h2>
            <p style="color:#adb5bd; font-size:13px; margin:0 0 18px 0; line-height:1.5;">
                ${isMe ? "Yeni ismini gir (max 16 karakter):" : `<b style="color:#fff;">${playerObj.name}</b> için yeni isim gir:`}
            </p>
            <input id="miniNameEditInput" type="text"
                   value="${(playerObj.name || "").replace(/"/g, '&quot;')}"
                   maxlength="16"
                   placeholder="Yeni isim..."
                   style="width:100%; padding:14px; font-size:18px; font-weight:bold;
                          border-radius:10px; border:2px solid ${teamColor};
                          background:#1a1e2e; color:#fff; text-align:center;
                          font-family:inherit; outline:none; box-sizing:border-box;">
            <div class="confirmButtons" style="margin-top:18px;">
                <button id="miniNameEditSaveBtn" class="bigBtn greenBtn">💾 KAYDET</button>
                <button id="miniNameEditCancelBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById("miniNameEditInput");
    setTimeout(() => { input.focus(); input.select(); }, 50);

    input.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
            e.preventDefault();
            document.getElementById("miniNameEditSaveBtn").click();
        } else if (e.key === "Escape") {
            e.preventDefault();
            document.getElementById("miniNameEditCancelBtn").click();
        }
    });

    document.getElementById("miniNameEditSaveBtn").onclick = async () => {
        const newName = input.value.trim();
        if (!newName) {
            input.style.borderColor = "#ff3333";
            input.focus();
            return;
        }
        if (newName.length > 16) {
            input.style.borderColor = "#ff3333";
            input.focus();
            return;
        }

        // Seljuk isim koruması
        if (isSeljukName(newName) && !isSeljukVerified()) {
            const ok = await showSeljukPasswordPopup();
            if (!ok) {
                input.value = "";
                input.focus();
                return;
            }
        }

        overlay.remove();

        // Sunucuya bildir
        send({
            type: "mini_change_name",
            target_id: playerObj.id,
            new_name: newName
        });

        // Yerel güncelleme
        if (isMe) {
            try { localStorage.setItem("playerName", newName); } catch(e) {}
        }

        if (typeof showToast === "function") {
            showToast("✏️ İsim Değişti", isMe ? `İsmin artık: ${newName}` : `${playerObj.name} → ${newName}`, null, "success");
        }
    };

    document.getElementById("miniNameEditCancelBtn").onclick = () => {
        overlay.remove();
    };
}

function setupMiniDraggableRow(row, playerObj, teamKey) {
    if (!row || !playerObj) return;
    
    if (miniData.playerId !== 1) {
        row.draggable = false;
        row.style.cursor = "";
        row.title = "";
        return;
    }
    
    if (playerObj.in_lobby) {
        row.draggable = false;
        row.style.cursor = "not-allowed";
        row.style.opacity = "0.6";
        row.title = "Bu oyuncu lobide bekliyor, oyuna dönmesini bekleyin";
        return;
    }
    
    row.draggable = true;
    row.style.cursor = "grab";
    row.title = `${playerObj.name} oyuncusunu sürükle`;
    
    row.ondragstart = (e) => {
        miniDragPlayerId = playerObj.id;
        miniDragFromTeam = teamKey;
        
        row.style.opacity = "0.6";
        row.style.transform = "scale(0.98)";
        
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(playerObj.id));
        }
    };
    
    row.ondragend = () => {
        row.style.opacity = "";
        row.style.transform = "";
        miniDragPlayerId = null;
        miniDragFromTeam = null;
        clearMiniDropHighlights();
    };
}

// ========================================
// 🎨 LOBBY GÜNCELLEME
// ========================================
function updateMiniLobby() {
    const lobbyMode = document.getElementById("miniLobbyMode");
    if (lobbyMode) {
        const modeLabels = {2:"1v1", 4:"2v2", 6:"3v3", 8:"4v4", 10:"5v5"};
        lobbyMode.textContent = modeLabels[miniData.playerCount] || `${(miniData.playerCount||2)/2}v${(miniData.playerCount||2)/2}`;
    }
    const lobbyGoal = document.getElementById("miniLobbyGoalTarget");
    const lobbyDur = document.getElementById("miniLobbyDuration");
    const lobbySpeed = document.getElementById("miniLobbySpeed");
    if (lobbyGoal) {
        if (miniData.goalTarget >= 999) {
            lobbyGoal.textContent = "♾️";
        } else {
            lobbyGoal.textContent = miniData.goalTarget;
        }
    }
    if (lobbyDur) {
        const dur = miniData.matchDuration;
        if (dur >= 99999) {
            lobbyDur.textContent = "♾️ Sınırsız";
        } else {
            lobbyDur.textContent = dur >= 60 ? `${dur / 60} dk` : `${dur} sn`;
        }
    }
    if (lobbySpeed) {
        const speedLabels = {
            "yavas": "🐢 Yavaş",
            "normal": "🚶 Normal",
            "hizli": "🏃 Hızlı"
        };
        lobbySpeed.textContent = speedLabels[miniData.gameSpeed] || "🚶 Normal";
    }
    
    const dynRedL = miniData.redTeamColor || "#ff6b6b";
    const dynBlueL = miniData.blueTeamColor || "#4dabf7";

    const redNameEl = document.getElementById("miniRedTeamName");
    const blueNameEl = document.getElementById("miniBlueTeamName");
    const isColorDark = (hex) => {
        const rgb = hexToRgbParts(hex);
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        const max = Math.max(rgb.r, rgb.g, rgb.b);
        const min = Math.min(rgb.r, rgb.g, rgb.b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        return brightness < 55 && saturation < 0.22;
    };

    if (redNameEl) {
        redNameEl.textContent = miniData.redTeamName;
        const isDark = isColorDark(dynRedL);
        redNameEl.style.color = isDark ? "#ffffff" : dynRedL;
        const redBox = redNameEl.closest(".miniTeamColumn") || redNameEl.closest(".miniTeamBox") || redNameEl.closest(".miniLobbyColumn") || redNameEl.parentElement;
        if (redBox) {
            redBox.style.borderColor = isDark ? "#ffffff" : dynRedL;
            redBox.style.borderWidth = isDark ? "2px" : "1px";
            redBox.style.background = isDark ? "rgba(255, 255, 255, 0.05)" : `linear-gradient(180deg, ${hexToRgba(dynRedL, 0.15)}, ${hexToRgba(dynRedL, 0.05)})`;
        }
    }
    if (blueNameEl) {
        blueNameEl.textContent = miniData.blueTeamName;
        const isDark = isColorDark(dynBlueL);
        blueNameEl.style.color = isDark ? "#ffffff" : dynBlueL;
        const blueBox = blueNameEl.closest(".miniTeamColumn") || blueNameEl.closest(".miniTeamBox") || blueNameEl.closest(".miniLobbyColumn") || blueNameEl.parentElement;
        if (blueBox) {
            blueBox.style.borderColor = isDark ? "#ffffff" : dynBlueL;
            blueBox.style.borderWidth = isDark ? "2px" : "1px";
            blueBox.style.background = isDark ? "rgba(255, 255, 255, 0.05)" : `linear-gradient(180deg, ${hexToRgba(dynBlueL, 0.15)}, ${hexToRgba(dynBlueL, 0.05)})`;
        }
    }
    
    const redPlayers = miniData.players.filter(p => p.team === "red");
    const bluePlayers = miniData.players.filter(p => p.team === "blue");
    const spectators = miniData.players.filter(p => p.team === "spectator" || !p.team);
    
    renderTeamColumn("miniRedColumn", redPlayers, "red");
    renderTeamColumn("miniSpecColumn", spectators, "spectator");
    renderTeamColumn("miniBlueColumn", bluePlayers, "blue");
    
    const totalMax = miniData.playerCount || 2;
    const halfMax = Math.floor(totalMax / 2);
    const totalTeamPlayers = redPlayers.length + bluePlayers.length;
    const redCount = document.getElementById("miniRedCount");
    const blueCount = document.getElementById("miniBlueCount");
    const specCount = document.getElementById("miniSpecCount");
    if (redCount) redCount.textContent = `(${redPlayers.length}/${halfMax})`;
    if (blueCount) blueCount.textContent = `(${bluePlayers.length}/${halfMax})`;
    if (specCount) specCount.textContent = `(${spectators.length})`;
    
    const modeLabels = {2:"1v1", 4:"2v2", 6:"3v3", 8:"4v4", 10:"5v5"};
    const modeLabel = modeLabels[totalMax] || `${totalMax/2}v${totalMax/2}`;
    
    const startBtn = document.getElementById("miniStartBtn");
    if (startBtn) {
        if (miniData.playerId === 1) {
            startBtn.classList.remove("hidden");
        } else {
            startBtn.classList.add("hidden");
        }
    }
    
    const rejoinBtn = document.getElementById("miniRejoinGameBtn");
    if (rejoinBtn) {
        const myPlayer = miniData.players.find(p => p.id === miniData.playerId);
        const isInLobby = myPlayer && myPlayer.in_lobby;
        if (isInLobby && miniData.playerId !== 1) {
            rejoinBtn.classList.remove("hidden");
        } else {
            rejoinBtn.classList.add("hidden");
        }
    }
    
    const settingsBtn = document.getElementById("miniRoomSettingsBtn");
    if (settingsBtn) {
        settingsBtn.classList.remove("hidden");
        settingsBtn.style.setProperty("display", "inline-block", "important");
        settingsBtn.style.background = "#6741d9";
        settingsBtn.textContent = "⚙️ Oda Ayarları";
    }
    
    const changeModeBtn = document.getElementById("miniChangeModeBtn");
    if (changeModeBtn) {
        if (miniData.playerId === 1) {
            changeModeBtn.classList.remove("hidden");
            changeModeBtn.style.setProperty("display", "inline-block", "important");
        } else {
            changeModeBtn.classList.add("hidden");
            changeModeBtn.style.display = "none";
        }
    }
    
    const editRedBtn = document.getElementById("miniEditRedBtn");
    const editBlueBtn = document.getElementById("miniEditBlueBtn");
    const resetNamesBtn = document.getElementById("miniResetNamesBtn");
    if (resetNamesBtn) resetNamesBtn.style.display = "none";
    if (editRedBtn && editBlueBtn) {
        if (miniData.playerId === 1) {
            editRedBtn.style.display = "inline-block";
            editBlueBtn.style.display = "inline-block";
        } else {
            editRedBtn.style.display = "none";
            editBlueBtn.style.display = "none";
        }
    }
    
    const lobbyMsg = document.getElementById("miniLobbyMsg");
    if (lobbyMsg) {
        const totalTeamPlayers = redPlayers.length + bluePlayers.length;
        if (totalTeamPlayers < 1) {
            lobbyMsg.textContent = "ℹ️ Takımlar boş. İzleyici modunda başlatabilirsin.";
            lobbyMsg.style.color = "#adb5bd";
        } else {
            let msg = "✅ Takımlar hazır! Host oyunu başlatabilir.";
            if (miniData.splitScreen) {
                msg += " 🎮 Split-Screen AÇIK";
            }
            lobbyMsg.textContent = msg;
            lobbyMsg.style.color = "#51cf66";
        }
    }
    
    if (window.setupRoomCodeAndLink) {
        const helper = window.setupRoomCodeAndLink({
            codeTextId: "miniRoomCodeText",
            codeEyeBtnId: "miniRoomCodeEyeBtn",
            copyHintId: "miniCopyHint",
            linkTextId: "miniInviteLinkText",
            linkEyeBtnId: "miniInviteLinkEyeBtn",
            linkHintId: "miniInviteLinkHint",
            getRoomCode: () => miniData.roomCode,
            getPlayerId: () => miniData.playerId
        });
        if (helper) {
            helper.renderCode();
            helper.renderLink();
        }
    }
}

function renderTeamColumn(containerId, players, teamKey) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    
    setupMiniDropZone(container, teamKey);
    
    if (players.length === 0) {
        const empty = document.createElement("div");
        empty.className = "miniTeamEmpty";
        empty.textContent = teamKey === "spectator" ? "İzleyici yok" : "Boş";
        container.appendChild(empty);
        return;
    }
    
    players.forEach(p => {
        const row = document.createElement("div");
        row.className = "miniPlayerRow";
        if (teamKey === "red") {
            row.classList.add("teamRed");
            row.style.borderLeft = `3px solid ${miniData.redTeamColor || "#ff6b6b"}`;
        } else if (teamKey === "blue") {
            row.classList.add("teamBlue");
            row.style.borderLeft = `3px solid ${miniData.blueTeamColor || "#4dabf7"}`;
        } else {
            row.classList.add("teamSpec");
        }
        
        setupMiniDraggableRow(row, p, teamKey);
        
        const nameSpan = document.createElement("span");
        nameSpan.className = "miniPlayerName";
        nameSpan.style.flex = "1";
        nameSpan.style.textAlign = "left";
        let tCol, tNameNorm = "";
        if (teamKey === "red") {
            tCol = miniData.redTeamColor || "#ff6b6b";
            tNameNorm = (miniData.redTeamName || "").trim().toLowerCase();
        } else if (teamKey === "blue") {
            tCol = miniData.blueTeamColor || "#4dabf7";
            tNameNorm = (miniData.blueTeamName || "").trim().toLowerCase();
        } else {
            tCol = "#adb5bd";
        }
        
        if (teamKey === "spectator") {
            nameSpan.style.color = tCol;
        } else if (["fenerbahçe", "fenerbahce", "fb"].includes(tNameNorm)) {
            nameSpan.style.color = "#ffed00";
        } else if (["galatasaray", "gs"].includes(tNameNorm)) {
            nameSpan.style.color = "#fdb913";
        } else if (["trabzonspor", "ts"].includes(tNameNorm)) {
            nameSpan.style.color = "#4ab3e8";
        } else {
            const _trgb = hexToRgbParts(tCol);
            const _tBright = (_trgb.r * 299 + _trgb.g * 587 + _trgb.b * 114) / 1000;
            const _tMax = Math.max(_trgb.r, _trgb.g, _trgb.b);
            const _tMin = Math.min(_trgb.r, _trgb.g, _trgb.b);
            const _tSat = _tMax === 0 ? 0 : (_tMax - _tMin) / _tMax;
            const isTColDark = _tBright < 55 && _tSat < 0.22;
            nameSpan.style.color = isTColDark ? "#ffffff" : tCol;
        }
        let displayName = p.id === miniData.playerId ? `${p.name} (Sen)` : p.name;
        if (p.id === 1) displayName += " 👑";
        if (p.in_lobby) displayName += " (lobide)";
        nameSpan.textContent = displayName;
        row.appendChild(nameSpan);
        
        // Sağ tık menüsü: Admin herkese, oyuncular kendilerine
        const canRightClick = miniData.playerId === 1 || p.id === miniData.playerId;
        if (canRightClick) {
            row.style.cursor = "context-menu";
            row.title = "Sağ tık → Menü";
            row.oncontextmenu = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showPlayerContextMenu(e, p);
            };
        }
        
        const pingSpan = document.createElement("span");
        pingSpan.className = "miniPlayerPing";
        pingSpan.dataset.playerId = p.id;
        const pingVal = (miniData.pings && miniData.pings[p.id] !== undefined) ? miniData.pings[p.id] : null;
        if (pingVal !== null) {
            pingSpan.textContent = `${pingVal}ms`;
            if (pingVal < 80) pingSpan.style.color = "#51cf66";
            else if (pingVal < 200) pingSpan.style.color = "#ffd43b";
            else pingSpan.style.color = "#ff6b6b";
        } else {
            pingSpan.textContent = "...";
            pingSpan.style.color = "#adb5bd";
        }
        row.appendChild(pingSpan);
        
        
        
        container.appendChild(row);
    });
}

function movePlayer(targetId, team) {
    send({ type: "mini_move_player", target_id: targetId, team: team });
}

function isClubTeam(teamName) {
    if (!teamName) return false;
    const n = teamName.trim().toLowerCase();
    return ["beşiktaş", "besiktas", "bjk", "galatasaray", "gs", "fenerbahçe", "fenerbahce", "fb", "trabzonspor", "ts"].includes(n);
}

function getTeamColors(team) {
    if (team === "blue") {
        return {
            team: miniData.blueTeamColor || "#4dabf7",
            sprint: miniData.blueSprintColor || "#ffd43b",
            defaultTeam: "#4dabf7",
            defaultSprint: "#ffd43b"
        };
    }
    return {
        team: miniData.redTeamColor || "#ff6b6b",
        sprint: miniData.redSprintColor || "#ffd43b",
        defaultTeam: "#ff6b6b",
        defaultSprint: "#ffd43b"
    };
}

function editTeamName(team) {
    const currentName = team === "red" ? miniData.redTeamName : miniData.blueTeamName;
    showMiniTeamNameEditor(team, currentName);
}

// ========================================
// 👕 FORMA NUMARASI DÜZENLE
// ========================================
function showJerseyNumberEditor(playerObj) {
    const existing = document.getElementById("miniJerseyEditor");
    if (existing) existing.remove();
    
    if (!miniData.persistentJerseys) {
        miniData.persistentJerseys = {};
        try {
            const saved = localStorage.getItem("miniPersistentJerseys");
            if (saved) miniData.persistentJerseys = JSON.parse(saved);
        } catch(e) {}
    }
    
    let currentNum = 10;
    const pIdStr = String(playerObj.id);
    const pIdInt = parseInt(playerObj.id, 10);
    
    if (miniData.persistentJerseys && miniData.persistentJerseys[pIdStr] !== undefined) {
        currentNum = miniData.persistentJerseys[pIdStr];
    } else if (miniData.persistentJerseys && miniData.persistentJerseys[String(pIdInt)] !== undefined) {
        currentNum = miniData.persistentJerseys[String(pIdInt)];
    } else if (typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players) {
        const hpPlayer = HP.room.gameState.players[pIdInt] || HP.room.gameState.players[pIdStr];
        if (hpPlayer && hpPlayer.jersey_number !== undefined) {
            currentNum = hpPlayer.jersey_number;
        }
    } else {
        const p = miniData.players.find(pl => parseInt(pl.id, 10) === pIdInt);
        if (p && p.jersey_number !== undefined && p.jersey_number !== null) {
            currentNum = p.jersey_number;
        } else {
            const sameTeamPlayers = miniData.players.filter(pl => pl.team === playerObj.team);
            const playerTeamIdx = sameTeamPlayers.findIndex(pl => parseInt(pl.id, 10) === pIdInt);
            const jerseyNumbersPool = [10, 7, 9, 11, 8, 1, 5, 4, 6, 2];
            currentNum = jerseyNumbersPool[playerTeamIdx >= 0 ? playerTeamIdx % jerseyNumbersPool.length : 0];
        }
    }
    
    const teamColor = playerObj.team === "red" ? (miniData.redTeamColor || "#ff6b6b") : (miniData.blueTeamColor || "#4dabf7");
    const teamGlow = hexToRgba(teamColor, 0.4);
    
    const overlay = document.createElement("div");
    overlay.id = "miniJerseyEditor";
    overlay.className = "overlay";
    overlay.style.zIndex = "999999";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:400px; border:2px solid ${teamColor}; box-shadow: 0 0 40px ${teamGlow};">
            <div style="font-size:60px; margin:10px 0;">👕</div>
            <h2 style="color:${teamColor}; margin:10px 0 15px 0;">Forma Numarası Değiştir</h2>
            <p style="color:#adb5bd; font-size:14px; margin:0 0 20px 0; line-height:1.5;">
                <b style="color:#fff;">${playerObj.name}</b> için yeni forma numarası seç (0 - 99):
            </p>
            <input id="miniJerseyInput" type="number" 
                   min="0" max="99"
                   value="${currentNum}"
                   style="width:120px; padding:12px; font-size:26px; font-weight:bold;
                          border-radius:10px; border:2px solid ${teamColor}; 
                          background:#1a1e2e; color:#fff; text-align:center;
                          font-family:inherit; outline:none; margin-bottom: 20px;">
            <div class="confirmButtons">
                <button id="miniJerseySaveBtn" class="bigBtn greenBtn">💾 KAYDET</button>
                <button id="miniJerseyCancelBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const input = document.getElementById("miniJerseyInput");
    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
    
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            document.getElementById("miniJerseySaveBtn").click();
        } else if (e.key === "Escape") {
            e.preventDefault();
            document.getElementById("miniJerseyCancelBtn").click();
        }
    });
    
    document.getElementById("miniJerseySaveBtn").onclick = () => {
        let num = parseInt(input.value, 10);
        if (isNaN(num) || num < 0 || num > 99) {
            input.style.borderColor = "#ff3333";
            input.focus();
            return;
        }
        
        overlay.remove();
        
        // 1. ANINDA LOKALDE SAKLA
        if (!miniData.persistentJerseys) miniData.persistentJerseys = {};
        miniData.persistentJerseys[pIdStr] = num;
        miniData.persistentJerseys[String(pIdInt)] = num;
        
        try {
            localStorage.setItem("miniPersistentJerseys", JSON.stringify(miniData.persistentJerseys));
        } catch(e) {}
        
        if (playerObj) {
            playerObj.jersey_number = num;
        }
        
        const targetPlayer = miniData.players.find(pl => parseInt(pl.id, 10) === pIdInt);
        if (targetPlayer) {
            targetPlayer.jersey_number = num;
        }
        
        if (typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players) {
            const hpPlayer = HP.room.gameState.players[pIdInt] || HP.room.gameState.players[pIdStr];
            if (hpPlayer) {
                hpPlayer.jersey_number = num;
            }
        }
        
        updateMiniLobby();
        
        // 2. Sunucuya gönder (Diğer oyunculara senkronizasyon için)
        send({
            type: "mini_change_jersey",
            target_id: pIdInt,
            jersey_number: num
        });
        
        if (typeof showToast === "function") {
            showToast("👕 Forma Numarası", `Forma numaran ${num} yapıldı!`, null, "success");
        }
    };
    
    document.getElementById("miniJerseyCancelBtn").onclick = () => {
        overlay.remove();
    };
}

// ========================================
// 🎨 TAKIM İSMİ EDİTÖR (dev pop-up)
// ========================================
function showMiniTeamNameEditor(team, currentName) {
    const existing = document.getElementById("miniTeamNameEditor");
    if (existing) existing.remove();
    
    const isRed = team === "red";
    const colors = getTeamColors(team);
    const teamColor = colors.team;
    const sprintColor = colors.sprint;
    const teamGlow = hexToRgba(teamColor, 0.4);
    const teamLabel = isRed ? "Kırmızı Takım" : "Mavi Takım";
    const displayTitle = (currentName && currentName.trim()) ? currentName.trim() : teamLabel;
    
    const normName = (currentName || "").trim().toLowerCase();
    
    const overlay = document.createElement("div");
    overlay.id = "miniTeamNameEditor";
    overlay.className = "overlay";
    overlay.style.zIndex = "999999";
    overlay.style.pointerEvents = "auto";
    overlay.innerHTML = `
        <div id="miniTeamEditorCard" class="overlayCard" style="max-width:480px; border:2px solid ${teamColor}; box-shadow: 0 0 40px ${teamGlow}; transition: border-color 0.15s, box-shadow 0.15s;">
            <div id="miniTeamPreviewCircle" style="width:60px; height:60px; margin:10px auto; border-radius:50%; background:${teamColor}; box-shadow: 0 0 22px ${teamGlow}, inset 0 -8px 14px rgba(0,0,0,0.28); transition: background 0.15s, box-shadow 0.15s;"></div>
            <h2 id="miniTeamEditorTitle" style="color:${teamColor}; margin:10px 0 15px 0; transition: color 0.15s;">${displayTitle} Ayarları</h2>
            
            <p style="color:#adb5bd; font-size:13px; margin:0 0 8px 0; text-align:left;">Takım İsmi (max 20)</p>
            <input id="miniTeamNameInput" type="text" 
                   value="${(currentName || "").replace(/"/g, '&quot;')}" 
                   maxlength="20"
                   style="width:100%; padding:12px; font-size:16px; font-weight:bold;
                          border-radius:10px; border:2px solid ${teamColor}; 
                          background:#1a1e2e; color:#fff; text-align:center;
                          font-family:inherit; outline:none; margin-bottom:16px;
                          box-sizing:border-box; transition: border-color 0.15s;">
            
            <div style="display:flex; gap:12px; margin-bottom:14px;">
                <div style="flex:1; background:rgba(0,0,0,0.25); border-radius:12px; padding:14px; border:1px solid rgba(255,255,255,0.08);">
                    <div style="color:#fff; font-weight:700; font-size:13px; margin-bottom:10px;">🎨 Takım Rengi</div>
                    <div id="miniTeamColorSwatch" style="position:relative; width:100%; height:52px; border-radius:10px; overflow:hidden; border:2px solid rgba(255,255,255,0.18); cursor:pointer;">
                        <div id="miniTeamColorFill" style="position:absolute; inset:0; background:${teamColor}; transition:background 0.15s;"></div>
                        <input id="miniTeamColorInput" type="color" value="${teamColor}"
                               style="position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; border:none; padding:0; margin:0;">
                    </div>
                    <div style="text-align:center; margin-top:8px;">
                        <span id="miniTeamColorHex" style="color:#adb5bd; font-family:monospace; font-size:12px; letter-spacing:0.5px;">${teamColor}</span>
                    </div>
                    <p style="color:#6c757d; font-size:11px; margin:8px 0 0 0;">Oyuncu, isim, skor, lobi rengi</p>
                </div>
                <div style="flex:1; background:rgba(0,0,0,0.25); border-radius:12px; padding:14px; border:1px solid rgba(255,255,255,0.08);">
                    <div style="color:#fff; font-weight:700; font-size:13px; margin-bottom:10px;">⚡ Sprint Rengi</div>
                    <div id="miniSprintColorSwatch" style="position:relative; width:100%; height:52px; border-radius:10px; overflow:hidden; border:2px solid rgba(255,255,255,0.18); cursor:pointer;">
                        <div id="miniSprintColorFill" style="position:absolute; inset:0; background:${sprintColor}; transition:background 0.15s;"></div>
                        <input id="miniSprintColorInput" type="color" value="${sprintColor}"
                               style="position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; border:none; padding:0; margin:0;">
                    </div>
                    <div style="text-align:center; margin-top:8px;">
                        <span id="miniSprintColorHex" style="color:#adb5bd; font-family:monospace; font-size:12px; letter-spacing:0.5px;">${sprintColor}</span>
                    </div>
                    <p style="color:#6c757d; font-size:11px; margin:8px 0 0 0;">Enerji halkası + şut parlaması</p>
                </div>
            </div>
            
            <div style="background:rgba(0,0,0,0.25); border-radius:12px; padding:12px; border:1px solid rgba(255,255,255,0.08); margin-bottom:12px;">
                <div style="color:#fff; font-weight:700; font-size:13px; margin-bottom:8px;">🏆 Hazır Takımlar</div>
                <select id="miniPresetTeamSelect" style="width:100%; padding:10px; font-size:14px; border-radius:8px; background:#1a1e2e; color:#fff; border:1px solid rgba(255,255,255,0.2); outline:none; cursor:pointer;">
                    <option value="">-- Bir takım seç --</option>
                    <option value="turkiye">🇹🇷 Türkiye</option>
                    <option value="azerbaycan">🇦🇿 Azerbaycan</option>
                    <option value="besiktas">🦅 Beşiktaş</option>
                    <option value="galatasaray">🦁 Galatasaray</option>
                    <option value="fenerbahce">🐣 Fenerbahçe</option>
                    <option value="trabzonspor">🐟 Trabzonspor</option>
                </select>
            </div>
            
            <button id="miniTeamColorResetBtn" class="bigBtn" style="width:100%; background:#495057; margin-bottom:16px;">
                🔄 Takım İsim ve Rengini Sıfırla
            </button>
            
            <div class="confirmButtons">
                <button id="miniTeamNameSaveBtn" class="bigBtn greenBtn">💾 KAYDET</button>
                <button id="miniTeamNameCancelBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const input = document.getElementById("miniTeamNameInput");
    const teamColorInput = document.getElementById("miniTeamColorInput");
    const sprintColorInput = document.getElementById("miniSprintColorInput");
    const teamHex = document.getElementById("miniTeamColorHex");
    const sprintHex = document.getElementById("miniSprintColorHex");
    
    function applyLocalColors(tColor, sColor, tName) {
        if (team === "red") {
            miniData.redTeamColor = tColor;
            miniData.redSprintColor = sColor;
            if (tName !== undefined && tName !== null && String(tName).trim() !== "") {
                miniData.redTeamName = String(tName).trim();
            }
        } else {
            miniData.blueTeamColor = tColor;
            miniData.blueSprintColor = sColor;
            if (tName !== undefined && tName !== null && String(tName).trim() !== "") {
                miniData.blueTeamName = String(tName).trim();
            }
        }
        try { updateMiniLobby(); } catch(e) {}
        try { updateMiniPauseLobby(); } catch(e) {}
        try { updateMiniHUD(); } catch(e) {}
    }
    
    function pushColors(payload) {
        send(Object.assign({
            type: "mini_change_team_name",
            team: team
        }, payload));
    }
    
    const previewCircle = document.getElementById("miniTeamPreviewCircle");
    const editorCard = document.getElementById("miniTeamEditorCard");
    const editorTitle = document.getElementById("miniTeamEditorTitle");
    const teamColorFill = document.getElementById("miniTeamColorFill");
    const sprintColorFill = document.getElementById("miniSprintColorFill");
    
    function refreshTeamColorPreview(c) {
        teamHex.textContent = c;
        if (teamColorFill) teamColorFill.style.background = c;
        if (previewCircle) {
            previewCircle.style.background = c;
            previewCircle.style.boxShadow = `0 0 22px ${hexToRgba(c, 0.4)}, inset 0 -8px 14px rgba(0,0,0,0.28)`;
        }
        if (editorCard) {
            editorCard.style.borderColor = c;
            editorCard.style.boxShadow = `0 0 40px ${hexToRgba(c, 0.4)}`;
        }
        if (editorTitle) editorTitle.style.color = c;
        if (input) input.style.borderColor = c;
    }
    
    input.addEventListener("input", () => {
        const newTitle = input.value.trim() || teamLabel;
        if (editorTitle) editorTitle.textContent = `${newTitle} Ayarları`;
        
        const val = input.value.trim().toLowerCase();
        if (presetSelect) {
            if (val === "türkiye" || val === "turkiye") presetSelect.value = "turkiye";
            else if (val === "azerbaycan" || val === "azerbaijan") presetSelect.value = "azerbaycan";
            else presetSelect.value = "";
        }
    });

    function saveStorageTeam(tName, tCol, sCol) {
        try {
            if (team === "red") {
                if (tName) localStorage.setItem("miniRedTeamName", tName);
                if (tCol) localStorage.setItem("miniRedTeamColor", tCol);
                if (sCol) localStorage.setItem("miniRedSprintColor", sCol);
            } else {
                if (tName) localStorage.setItem("miniBlueTeamName", tName);
                if (tCol) localStorage.setItem("miniBlueTeamColor", tCol);
                if (sCol) localStorage.setItem("miniBlueSprintColor", sCol);
            }
        } catch(e) {}
    }

    teamColorInput.addEventListener("input", () => {
        const c = teamColorInput.value;
        const nameVal = input.value.trim() || currentName;
        refreshTeamColorPreview(c);
        applyLocalColors(c, sprintColorInput.value, nameVal);
        saveStorageTeam(nameVal, c, sprintColorInput.value);
        const ps = document.getElementById("miniPresetTeamSelect");
        if (ps) ps.value = "";
        pushColors({
            name: nameVal,
            team_color: c,
            sprint_color: sprintColorInput.value
        });
    });
    
    sprintColorInput.addEventListener("input", () => {
        const c = sprintColorInput.value;
        const nameVal = input.value.trim() || currentName;
        sprintHex.textContent = c;
        if (sprintColorFill) sprintColorFill.style.background = c;
        applyLocalColors(teamColorInput.value, c, nameVal);
        saveStorageTeam(nameVal, teamColorInput.value, c);
        const ps = document.getElementById("miniPresetTeamSelect");
        if (ps) ps.value = "";
        pushColors({
            name: nameVal,
            team_color: teamColorInput.value,
            sprint_color: c
        });
    });
    
    const presetSelect = document.getElementById("miniPresetTeamSelect");
    if (presetSelect) {
        const initNorm = (currentName || "").trim().toLowerCase();
        if (["türkiye", "turkiye"].includes(initNorm)) presetSelect.value = "turkiye";
        else if (["azerbaycan", "azerbaijan"].includes(initNorm)) presetSelect.value = "azerbaycan";
        else if (["beşiktaş", "besiktas", "bjk"].includes(initNorm)) presetSelect.value = "besiktas";
        else if (["galatasaray", "gs"].includes(initNorm)) presetSelect.value = "galatasaray";
        else if (["fenerbahçe", "fenerbahce", "fb"].includes(initNorm)) presetSelect.value = "fenerbahce";
        else if (["trabzonspor", "ts"].includes(initNorm)) presetSelect.value = "trabzonspor";

        presetSelect.addEventListener("change", () => {
            const val = presetSelect.value;
            if (!val) return;

            try {
                if (team === "red") {
                    localStorage.removeItem("miniRedTeamName");
                    localStorage.removeItem("miniRedTeamColor");
                    localStorage.removeItem("miniRedSprintColor");
                } else {
                    localStorage.removeItem("miniBlueTeamName");
                    localStorage.removeItem("miniBlueTeamColor");
                    localStorage.removeItem("miniBlueSprintColor");
                }
            } catch(e) {}

            let tName = "", tColor = "", tSprint = "";

            if (val === "turkiye") {
                tName = "Türkiye";
                tColor = "#e30a17";
                tSprint = "#e30a17";
            } else if (val === "azerbaycan") {
                tName = "Azerbaycan";
                tColor = "#00a8e8";
                tSprint = "#ffffff";
            } else if (val === "besiktas") {
                tName = "Beşiktaş";
                tColor = "#111111";
                tSprint = "#ffffff";
            } else if (val === "galatasaray") {
                tName = "Galatasaray";
                tColor = "#a90429";
                tSprint = "#fdb913";
            } else if (val === "fenerbahce") {
                tName = "Fenerbahçe";
                tColor = "#00205b";
                tSprint = "#ffed00";
            } else if (val === "trabzonspor") {
                tName = "Trabzonspor";
                tColor = "#700018";
                tSprint = "#4ab3e8";
            }

            if (tName) {
                input.value = tName;
                if (editorTitle) editorTitle.textContent = `${tName} Ayarları`;
                teamColorInput.value = tColor;
                sprintColorInput.value = tSprint;
                
                refreshTeamColorPreview(tColor);
                sprintHex.textContent = tSprint;
                if (sprintColorFill) sprintColorFill.style.background = tSprint;
                
                saveStorageTeam(tName, tColor, tSprint);
                applyLocalColors(tColor, tSprint, tName);
                pushColors({ name: tName, team_color: tColor, sprint_color: tSprint });
            }
        });
        
        input.addEventListener("input", () => {
            const val = input.value.trim().toLowerCase();
            if (["türkiye", "turkiye"].includes(val)) presetSelect.value = "turkiye";
            else if (["azerbaycan", "azerbaijan"].includes(val)) presetSelect.value = "azerbaycan";
            else if (["beşiktaş", "besiktas", "bjk"].includes(val)) presetSelect.value = "besiktas";
            else if (["galatasaray", "gs"].includes(val)) presetSelect.value = "galatasaray";
            else if (["fenerbahçe", "fenerbahce", "fb"].includes(val)) presetSelect.value = "fenerbahce";
            else if (["trabzonspor", "ts"].includes(val)) presetSelect.value = "trabzonspor";
            else presetSelect.value = "";
        });
    }
    
    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
    
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            document.getElementById("miniTeamNameSaveBtn").click();
        } else if (e.key === "Escape") {
            e.preventDefault();
            document.getElementById("miniTeamNameCancelBtn").click();
        }
    });
    
    document.getElementById("miniTeamColorResetBtn").onclick = () => {
        const existingConfirm = document.getElementById("miniTeamColorResetConfirm");
        if (existingConfirm) existingConfirm.remove();
        
        const confirmOverlay = document.createElement("div");
        confirmOverlay.id = "miniTeamColorResetConfirm";
        confirmOverlay.className = "overlay";
        confirmOverlay.style.zIndex = "1000000";
        confirmOverlay.style.pointerEvents = "auto";
        confirmOverlay.innerHTML = `
            <div class="overlayCard" style="max-width:400px; border:2px solid #adb5bd; box-shadow: 0 0 40px rgba(173,181,189,0.3);">
                <div style="width:56px; height:56px; margin:10px auto; border-radius:50%; background:rgba(173,181,189,0.15); display:flex; align-items:center; justify-content:center; font-size:30px;">🔄</div>
                <h2 style="color:#fff; margin:12px 0 12px 0; font-size:19px;">İsim ve Rengi Sıfırla</h2>
                <p style="color:#adb5bd; font-size:14px; margin:0 0 24px 0; line-height:1.5;">
                    <b style="color:${teamColor};">${teamLabel}</b> ismi, rengi ve sprint rengi varsayılana dönecek.<br>
                    <span style="font-size:13px;">Sıfırlamak istediğinize emin misiniz?</span>
                </p>
                <div class="confirmButtons">
                    <button id="miniTeamColorResetYesBtn" class="bigBtn greenBtn">✅ EVET, SIFIRLA</button>
                    <button id="miniTeamColorResetNoBtn" class="bigBtn redBtn">İPTAL</button>
                </div>
            </div>
        `;
        document.body.appendChild(confirmOverlay);
        
        document.getElementById("miniTeamColorResetYesBtn").onclick = () => {
            confirmOverlay.remove();
            const defName = team === "red" ? "Kırmızı Takım" : "Mavi Takım";
            const defT = colors.defaultTeam;
            const defS = colors.defaultSprint;
            
            input.value = defName;
            if (editorTitle) editorTitle.textContent = `${defName} Ayarları`;
            if (presetSelect) presetSelect.value = "";
            
            teamColorInput.value = defT;
            sprintColorInput.value = defS;
            refreshTeamColorPreview(defT);
            sprintHex.textContent = defS;
            if (sprintColorFill) sprintColorFill.style.background = defS;
            
            try {
                if (team === "red") {
                    localStorage.removeItem("miniRedTeamName");
                    localStorage.removeItem("miniRedTeamColor");
                    localStorage.removeItem("miniRedSprintColor");
                } else {
                    localStorage.removeItem("miniBlueTeamName");
                    localStorage.removeItem("miniBlueTeamColor");
                    localStorage.removeItem("miniBlueSprintColor");
                }
            } catch(e) {}
            
            applyLocalColors(defT, defS, defName);
            pushColors({ reset_colors: true, name: defName, team_color: defT, sprint_color: defS });
            if (typeof showToast === "function") {
                showToast("🔄 Sıfırlandı", "Takım ismi ve rengi varsayılana döndü", null, "info");
            }
        };
        document.getElementById("miniTeamColorResetNoBtn").onclick = () => {
            confirmOverlay.remove();
        };
    };
    
    document.getElementById("miniTeamNameSaveBtn").onclick = () => {
        const newName = input.value.trim();
        if (!newName) {
            input.style.borderColor = "#ff3333";
            input.focus();
            return;
        }
        overlay.remove();
        try {
            if (team === "red") {
                localStorage.setItem("miniRedTeamName", newName);
                localStorage.setItem("miniRedTeamColor", teamColorInput.value);
                localStorage.setItem("miniRedSprintColor", sprintColorInput.value);
            } else {
                localStorage.setItem("miniBlueTeamName", newName);
                localStorage.setItem("miniBlueTeamColor", teamColorInput.value);
                localStorage.setItem("miniBlueSprintColor", sprintColorInput.value);
            }
        } catch(e) {}
        applyLocalColors(teamColorInput.value, sprintColorInput.value, newName);
        pushColors({
            name: newName,
            team_color: teamColorInput.value,
            sprint_color: sprintColorInput.value
        });
    };
    
    document.getElementById("miniTeamNameCancelBtn").onclick = () => {
        overlay.remove();
    };
}

function resetTeamNames() {
    const existing = document.getElementById("miniResetNamesConfirm");
    if (existing) existing.remove();
    
    const overlay = document.createElement("div");
    overlay.id = "miniResetNamesConfirm";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:450px; border:2px solid #adb5bd; box-shadow: 0 0 40px rgba(173,181,189,0.3);">
            <div style="width:56px; height:56px; margin:10px auto; border-radius:50%; background:rgba(173,181,189,0.15); display:flex; align-items:center; justify-content:center; font-size:30px;">🔄</div>
            <h2 style="color:#fff; margin:12px 0 12px 0; font-size:19px;">Takım İsimlerini Sıfırla</h2>
            <p style="color:#adb5bd; font-size:14px; margin:0 0 24px 0; line-height:1.5;">
                Takım isimleri <b style="color:#ff6b6b;">Kırmızı Takım</b> ve <b style="color:#4dabf7;">Mavi Takım</b> olarak sıfırlanacak.<br>
                <span style="font-size:13px;">Sıfırlamak istediğinize emin misiniz?</span>
            </p>
            <div class="confirmButtons">
                <button id="miniResetNamesYesBtn" class="bigBtn greenBtn">🔄 EVET, SIFIRLA</button>
                <button id="miniResetNamesNoBtn" class="bigBtn redBtn">İPTAL</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById("miniResetNamesYesBtn").onclick = () => {
        overlay.remove();
        try {
            localStorage.removeItem("miniRedTeamName");
            localStorage.removeItem("miniBlueTeamName");
            localStorage.removeItem("miniRedTeamColor");
            localStorage.removeItem("miniBlueTeamColor");
            localStorage.removeItem("miniRedSprintColor");
            localStorage.removeItem("miniBlueSprintColor");
        } catch(e) {}
        send({ type: "mini_reset_team_names" });
    };
    document.getElementById("miniResetNamesNoBtn").onclick = () => {
        overlay.remove();
    };
}

// ========================================
// ⚙️ ODA AYARLARI POPUP
// ========================================
function openMiniRoomSettings() {
    if (!window.openRoomSettingsGeneric) return;
    
    const readonly = miniData.playerId !== 1;
    
    window.openRoomSettingsGeneric({
        title: "Mini Futbol - Oda Ayarları",
        readonly: readonly,
        showAdvancedGoalDuration: true,
        currentGoalTarget: miniData.goalTarget || 3,
        currentMatchDuration: miniData.matchDuration || 180,
        fields: [
            {
                id: "playerCount",
                label: "👥 Oyuncu Sayısı",
                current: miniData.playerCount || 2,
                minValue: (function() {
                    if (!miniData.players || miniData.players.length === 0) return null;
                    const activePlayers = miniData.players.filter(p => p.team === "red" || p.team === "blue");
                    return activePlayers.length > 2 ? activePlayers.length : null;
                })(),
                valueMapping: function(v) { return v; },
                options: [
                    {value: 2, label: "1v1"},
                    {value: 4, label: "2v2"},
                    {value: 6, label: "3v3"},
                    {value: 8, label: "4v4"},
                    {value: 10, label: "5v5"}
                ]
            },
            {
                id: "spectatorCount",
                label: "👁️ İzleyici Sayısı",
                current: miniData.spectatorCount || 0,
                options: [
                    {value: 0, label: "İzleyici yok"},
                    {value: 1, label: "1 İzleyici"},
                    {value: 2, label: "2 İzleyici"},
                    {value: 3, label: "3 İzleyici"},
                    {value: 4, label: "4 İzleyici"},
                    {value: 5, label: "5 İzleyici"}
                ]
            },
            {
                id: "goalTarget",
                label: "⚽ Kazanma Skoru",
                current: miniData.goalTarget || 3,
                disableOnAdvanced: true,
                options: [
                    {value: 1, label: "1 Gol (Hızlı)"},
                    {value: 3, label: "3 Gol (Klasik)"},
                    {value: 5, label: "5 Gol"},
                    {value: 7, label: "7 Gol"},
                    {value: 10, label: "10 Gol (Uzun)"},
                    {value: 15, label: "15 Gol"},
                    {value: 20, label: "20 Gol"},
                    {value: 30, label: "30 Gol (Maraton)"},
                    {value: 999, label: "♾️ Sınırsız (Sadece Süreye Bağlı)"}
                ]
            },
            {
                id: "matchDuration",
                label: "⏱️ Maç Süresi",
                current: miniData.matchDuration || 180,
                disableOnAdvanced: true,
                options: [
                    {value: 60, label: "1 Dakika"},
                    {value: 120, label: "2 Dakika"},
                    {value: 180, label: "3 Dakika (Klasik)"},
                    {value: 300, label: "5 Dakika"},
                    {value: 600, label: "10 Dakika"},
                    {value: 900, label: "15 Dakika"},
                    {value: 1200, label: "20 Dakika"},
                    {value: 1500, label: "25 Dakika"},
                    {value: 1800, label: "30 Dakika"},
                    {value: 2700, label: "45 Dakika"},
                    {value: 4200, label: "70 Dakika"},
                    {value: 5400, label: "90 Dakika"},
                    {value: 7200, label: "120 Dakika"},
                    {value: 99999, label: "♾️ Sınırsız (Sadece Gol Sayısı)"}
                ]
            },
            {
                id: "gameSpeed",
                label: "⚡ Oyun Hızı",
                current: miniData.gameSpeed || "normal",
                disableOnAdvanced: true,
                options: [
                    {value: "yavas", label: "🐢 Yavaş"},
                    {value: "normal", label: "🚶 Normal (Varsayılan)"},
                    {value: "hizli", label: "🏃 Hızlı"}
                ]
            },
			{
                id: "kickoffTimeout",
                label: "⏱️ Santra Süresi (Gol Yiyen Topa Dokunma Süresi)",
                current: miniData.kickoffTimeout || 10,
                options: [
                    {value: 5, label: "5 Saniye (Hızlı)"},
                    {value: 10, label: "10 Saniye (Klasik)"},
                    {value: 15, label: "15 Saniye"},
                    {value: 20, label: "20 Saniye"},
                    {value: 30, label: "30 Saniye"},
                    {value: 60, label: "60 Saniye"},
                    {value: 999, label: "♾️ Sınırsız (Kural Devre Dışı)"}
                ]
            },
            {
                id: "allowPlase",
                label: "🌀 Falso'ya İzin Ver (Plase Şutu)",
                current: (function(){
                    if (miniData.allowPlase !== undefined) return miniData.allowPlase ? "on" : "off";
                    try {
                        const saved = localStorage.getItem("miniAllowPlase");
                        if (saved === "off") return "off";
                    } catch(e) {}
                    return "on";
                })(),
                disableOnAdvanced: true,
                options: [
                    {value: "on", label: "✅ Açık (Plase Kavis Atar)"},
                    {value: "off", label: "❌ Kapalı (Sadece Düz Şut)"}
                ]
            },
            {
                id: "passAssistance",
                label: "🤝 Pas Yardımı (Oto-Hedef)",
                current: (function(){
                    if (miniData.passAssistance !== undefined) return miniData.passAssistance ? "on" : "off";
                    try {
                        const saved = localStorage.getItem("miniPassAssistance");
                        if (saved === "off") return "off";
                    } catch(e) {}
                    return "on";
                })(),
                disableOnAdvanced: true,
                options: [
                    {value: "on", label: "✅ Açık (Takım Arkadaşına Yönelir)"},
                    {value: "off", label: "❌ Kapalı (Tamamen Manuel)"}
                ]
            },
            {
                id: "ballStick",
                label: "🧲 Top Kontrolü (Sürüş)",
                current: (function(){
                    if (miniData.ballStick !== undefined) return miniData.ballStick ? "on" : "off";
                    try {
                        const saved = localStorage.getItem("miniBallStick");
                        if (saved === "off") return "off";
                    } catch(e) {}
                    return "on";
                })(),
                disableOnAdvanced: true,
                options: [
                    {value: "on", label: "✅ Açık (Top Yapışır - Klasik)"},
                    {value: "off", label: "❌ Kapalı (Bilardo Tarzı)"}
                ]
            },
            {
                id: "goalMusicMode",
                label: "🎵 Gol Müziği",
                current: miniData.goalMusicMode || "team",
                options: [
                    {value: "team", label: "🏟️ Takıma Göre (BJK→BJK, GS→GS)"},
                    {value: "mixed", label: "🎲 Karışık (Tüm Şarkılardan Rastgele)"}
                ]
            },
            {
                id: "sprintEnabled",
                label: "⚡ Sprint Etkinleştir",
                current: (function(){
                    if (miniData.sprintEnabled !== undefined) return miniData.sprintEnabled ? "on" : "off";
                    try {
                        const saved = localStorage.getItem("miniSprintEnabled");
                        if (saved === "off") return "off";
                    } catch(e) {}
                    return "on";
                })(),
                options: [
                    {value: "on", label: "✅ Açık (Shift ile Hızlan)"},
                    {value: "off", label: "❌ Kapalı (Sprint Yok)"}
                ]
            }
        ],
        advancedFields: [
            { id: "kickPower", label: "⚽ Şut Gücü", current: 14, min: 8, max: 25, step: 1, desc: "Normal şut hızı (varsayılan: 14)" },
            { id: "sprintKickBonus", label: "🔥 Sprint Şut Bonusu", current: 30, min: 0, max: 100, step: 5, unit: "%", desc: "Sprint sırasında şut gücü artışı (varsayılan: %30)" },
            { id: "plasePower", label: "🌀 Plase Gücü Oranı", current: 75, min: 40, max: 100, step: 5, unit: "%", desc: "Plase şutun normal şuta oranı (varsayılan: %75)" },
            { id: "plaseSpin", label: "🎯 Plase Kavis Şiddeti", current: 35, min: 10, max: 100, step: 5, unit: "/100", desc: "Falso miktarı (yüksek = daha çok kavis)" },
            { id: "afterTouchTime", label: "⏱️ After-Touch Süresi", current: 200, min: 0, max: 1000, step: 50, unit: "ms", desc: "Şut sonrası kavis verme süresi (varsayılan: 200ms)" },
            { id: "passAssistPower", label: "🎯 Pas Yardım Gücü", current: 50, min: 0, max: 100, step: 5, unit: "%", desc: "Pas atarken takım arkadaşına kilitlenme oranı (varsayılan: %50)" },
            { id: "ballMaxSpeed", label: "💨 Top Max Hızı", current: 18, min: 10, max: 35, step: 1, desc: "Topun ulaşabileceği en yüksek hız (varsayılan: 18)" },
            { id: "sprintMultiplier", label: "🏃 Sprint Hız Çarpanı", current: 150, min: 100, max: 250, step: 10, unit: "%", desc: "Normal hızın kaç katı (varsayılan: %150)" },
            { id: "sprintDuration", label: "⚡ Sprint Süresi", current: 3, min: 1, max: 10, step: 1, unit: "sn", desc: "Enerji tam doluyken kaç saniye sprint yapılabilir" },
            { id: "ballStick", label: "🧲 Top Kontrolü", current: 85, min: 0, max: 100, step: 5, unit: "", desc: "0 = Bilardo tarzı (yapışmaz), 100 = Tam yapışık" }
        ],
        onSave: (values, advancedValues) => {
            const advToggle = document.getElementById("advancedToggle");
            const advancedEnabled = advToggle ? advToggle.checked : false;
            
            const allowPlase = values.allowPlase !== "off";
            const ballStick = values.ballStick !== "off";
            const sprintEnabled = values.sprintEnabled !== "off";
            const passAssistance = values.passAssistance !== "off";
            
            const goalMusicMode = values.goalMusicMode || "team";
            miniData.goalMusicMode = goalMusicMode;
            try { localStorage.setItem("miniGoalMusicMode", goalMusicMode); } catch(e) {}
            const goalTarget = parseInt(values.goalTarget) || 3;
            const matchDuration = parseInt(values.matchDuration) || 180;
            const gameSpeed = values.gameSpeed || "normal";
           const splitScreen = miniData.splitScreen === true;
            
            try {
                localStorage.setItem("miniAllowPlase", allowPlase ? "on" : "off");
                localStorage.setItem("miniBallStick", ballStick ? "on" : "off");
                localStorage.setItem("miniPassAssistance", passAssistance ? "on" : "off");
                localStorage.setItem("miniSprintEnabled", sprintEnabled ? "on" : "off");
                if (!advancedEnabled) {
                    localStorage.setItem("miniCreateGoal", String(goalTarget));
                    localStorage.setItem("miniCreateDuration", String(matchDuration));
                }
                localStorage.setItem("miniCreateSpeed", gameSpeed);
                localStorage.setItem("miniCreateSplit", splitScreen ? "on" : "off");
            } catch(e) {}
            
            const kickoffTimeout = parseInt(values.kickoffTimeout) || 10;
            
            try {
                localStorage.setItem("miniKickoffTimeout", String(kickoffTimeout));
            } catch(e) {}
            
            const payload = {
                type: "mini_update_settings",
                goal_target: goalTarget,
                match_duration: matchDuration,
                game_speed: gameSpeed,
                split_screen: splitScreen,
                allow_plase: allowPlase,
                ball_stick: ballStick,
                sprint_enabled: sprintEnabled,
                pass_assistance: passAssistance,
                goal_music_mode: goalMusicMode,
                player_count: values.playerCount ? parseInt(values.playerCount) : miniData.playerCount,
                spectator_count: values.spectatorCount ? parseInt(values.spectatorCount) : miniData.spectatorCount,
                kickoff_timeout: kickoffTimeout,
                advanced_enabled: advancedEnabled
            };
            
            if (advancedEnabled && advancedValues) {
                payload.advanced = advancedValues;
                try {
                    localStorage.setItem("miniAdvancedSettings", JSON.stringify(advancedValues));
                    localStorage.setItem("miniAdvancedEnabled", "true");
                } catch(e) {}
            } else {
                localStorage.setItem("miniAdvancedEnabled", "false");
            }
            
            send(payload);
        }
    });
}

// ========================================
// 💬 CHAT FONKSİYONLARI
// ========================================
function showMiniChat() {
    const container = document.getElementById("miniChatContainer");
    if (container) container.style.display = "block";
}

function hideMiniChat() {
    const container = document.getElementById("miniChatContainer");
    if (container) container.style.display = "none";
    closeMiniChatPanel();
    miniChat.messages = [];
    miniChat.unread = 0;
    miniChat.typingPlayers = {};
    const msgBox = document.getElementById("miniChatMessages");
    if (msgBox) msgBox.innerHTML = "";
    clearMiniChatPopups();
}

function toggleMiniChatPanel() {
    if (miniChat.open) {
        closeMiniChatPanel();
    } else {
        openMiniChatPanel();
    }
}

function openMiniChatPanel() {
    miniChat.open = true;
    miniChat.unread = 0;
    const panel = document.getElementById("miniChatPanel");
    const badge = document.getElementById("miniChatBadge");
    if (panel) {
        panel.style.setProperty("display", "flex", "important");
    }
    if (badge) badge.style.display = "none";
    clearMiniChatPopups();
    
    setTimeout(() => {
        document.addEventListener("mousedown", miniChatOutsideClickHandler, true);
    }, 100);
    const msgBox = document.getElementById("miniChatMessages");
    if (msgBox) setTimeout(() => { msgBox.scrollTop = msgBox.scrollHeight; }, 50);
    const input = document.getElementById("miniChatInput");
    if (input) setTimeout(() => input.focus(), 100);
}

function closeMiniChatPanel() {
    miniChat.open = false;
    const panel = document.getElementById("miniChatPanel");
    if (panel) panel.style.display = "none";
    document.removeEventListener("mousedown", miniChatOutsideClickHandler, true);
    const input = document.getElementById("miniChatInput");
    if (input && input.value) input.value = "";
}

function miniChatOutsideClickHandler(e) {
    const container = document.getElementById("miniChatContainer");
    if (!container) return;
    if (container.contains(e.target)) return;
    closeMiniChatPanel();
}

function sendMiniChatMessage() {
    const input = document.getElementById("miniChatInput");
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    if (text.length > 100) return;
    input.value = "";
    send({ type: "mini_chat_send", text: text });
}

function showMiniChatPopup(msg) {
    if (miniChat.open) return;
    if (msg.system) return;

    const stack = document.getElementById("miniChatPopupStack");
    if (!stack) return;
    stack.style.display = "flex";

    const popup = document.createElement("div");
    popup.className = "miniChatPopup";
    if (msg.team === "red") popup.classList.add("teamRed");
    else if (msg.team === "blue") popup.classList.add("teamBlue");
    else popup.classList.add("teamSpec");

    let nameColor = "#adb5bd";
    if (msg.team === "red") nameColor = "#ff8a8a";
    else if (msg.team === "blue") nameColor = "#7abfff";

    const nameSpan = document.createElement("span");
    nameSpan.className = "miniChatPopupName";
    nameSpan.style.color = nameColor;
    nameSpan.textContent = msg.sender_name;

    const textSpan = document.createElement("span");
    textSpan.className = "miniChatPopupText";
    textSpan.textContent = msg.text;

    popup.appendChild(nameSpan);
    popup.appendChild(textSpan);
    stack.appendChild(popup);

    while (stack.children.length > 5) {
        stack.removeChild(stack.firstChild);
    }

    setTimeout(() => {
        popup.classList.add("leaving");
        setTimeout(() => {
            if (popup.parentNode) popup.parentNode.removeChild(popup);
            if (stack.children.length === 0) stack.style.display = "none";
        }, 350);
    }, 3000);
}

function clearMiniChatPopups() {
    const stack = document.getElementById("miniChatPopupStack");
    if (!stack) return;
    stack.innerHTML = "";
    stack.style.display = "none";
}

function addMiniChatMessage(msg) {
    miniChat.messages.push(msg);
    if (miniChat.messages.length > miniChat.maxMessages) {
        miniChat.messages.shift();
    }

    const msgBox = document.getElementById("miniChatMessages");
    if (!msgBox) return;

    const div = document.createElement("div");
    div.className = "miniChatMsg";

    if (msg.system) {
        div.classList.add("systemMsg");
        div.textContent = msg.text;
    } else {
        const nameSpan = document.createElement("span");
        nameSpan.className = "chatName";
        if (msg.team === "red") nameSpan.style.color = "#ff8a8a";
        else if (msg.team === "blue") nameSpan.style.color = "#7abfff";
        else nameSpan.style.color = "#adb5bd";
        nameSpan.textContent = msg.sender_name + ":";

        const textSpan = document.createElement("span");
        textSpan.className = "chatText";
        textSpan.textContent = " " + msg.text;

        div.appendChild(nameSpan);
        div.appendChild(textSpan);
    }

    msgBox.appendChild(div);

    while (msgBox.children.length > miniChat.maxMessages) {
        msgBox.removeChild(msgBox.firstChild);
    }

    if (miniChat.open) {
        msgBox.scrollTop = msgBox.scrollHeight;
    }

    if (!miniChat.open && !msg.system) {
        miniChat.unread++;
        const badge = document.getElementById("miniChatBadge");
        if (badge) {
            badge.textContent = miniChat.unread;
            badge.style.display = "flex";
            badge.style.animation = "none";
            badge.offsetHeight;
            badge.style.animation = "chatBadgePop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)";
        }
        showMiniChatPopup(msg);
    }
}

// ========================================
// 📊 HUD (Skor + Süre + Sprint)
// ========================================
function updateMiniHUD() {
    const state = miniData.gameState;
    if (!state) return;
    
    const scoreEl = document.getElementById("miniScoreDisplay");
    const timeEl = document.getElementById("miniTimeDisplay");
    const sprintEl = document.getElementById("miniSprintDisplay");
    
    if (typeof updateMiniConnectionBadge === "function") updateMiniConnectionBadge();
    
    const s1 = state.scores["1"] || 0;
    const s2 = state.scores["2"] || 0;
    
    const redPlayer = miniData.players.find(p => p.team === "red");
    const bluePlayer = miniData.players.find(p => p.team === "blue");
    const n1 = redPlayer ? redPlayer.name : (miniData.redTeamName || "Kırmızı");
    const n2 = bluePlayer ? bluePlayer.name : (miniData.blueTeamName || "Mavi");
    
    if (scoreEl) {
        const rc = miniData.redTeamColor || "#ff6b6b";
        const bc = miniData.blueTeamColor || "#4dabf7";

        if (!document.getElementById("teamHudAnimationStyles")) {
            const style = document.createElement("style");
            style.id = "teamHudAnimationStyles";
            style.textContent = `
                @keyframes teamColorShift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                .bjk-animated-hud-text { background: linear-gradient(90deg, #111111 0%, #777777 25%, #ffffff 50%, #777777 75%, #111111 100%); background-size: 400% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: teamColorShift 22s cubic-bezier(0.4, 0, 0.2, 1) infinite; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9)); font-weight: 800; display: inline-block; }
                .gs-animated-hud-text { background: linear-gradient(90deg, #a90429 0%, #d4671e 25%, #fdb913 50%, #d4671e 75%, #a90429 100%); background-size: 400% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: teamColorShift 22s cubic-bezier(0.4, 0, 0.2, 1) infinite; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9)); font-weight: 800; display: inline-block; }
                .fb-animated-hud-text { background: linear-gradient(90deg, #00205b 0%, #006097 25%, #ffed00 50%, #006097 75%, #00205b 100%); background-size: 400% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: teamColorShift 22s cubic-bezier(0.4, 0, 0.2, 1) infinite; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9)); font-weight: 800; display: inline-block; }
                .ts-animated-hud-text { background: linear-gradient(90deg, #700018 0%, #5d59a8 25%, #4ab3e8 50%, #5d59a8 75%, #700018 100%); background-size: 400% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: teamColorShift 22s cubic-bezier(0.4, 0, 0.2, 1) infinite; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9)); font-weight: 800; display: inline-block; }
                .tr-animated-hud-text { background: linear-gradient(90deg, #e30a17 0%, #f1858c 25%, #ffffff 50%, #f1858c 75%, #e30a17 100%); background-size: 400% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: teamColorShift 22s cubic-bezier(0.4, 0, 0.2, 1) infinite; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9)); font-weight: 800; display: inline-block; }
                .az-animated-hud-text { background: linear-gradient(90deg, #00a8e8 0%, #7165cf 25%, #e32118 50%, #8ca630 75%, #38a047 100%); background-size: 400% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: teamColorShift 22s cubic-bezier(0.4, 0, 0.2, 1) infinite; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.9)); font-weight: 800; display: inline-block; }
            `;
            document.head.appendChild(style);
        }

        const getHUDNameStyle = (teamName, teamColor) => {
            const norm = (teamName || "").trim().toLowerCase();
            if (["beşiktaş", "besiktas", "bjk"].includes(norm)) return `class="bjk-animated-hud-text"`;
            if (["galatasaray", "gs"].includes(norm)) return `class="gs-animated-hud-text"`;
            if (["fenerbahçe", "fenerbahce", "fb"].includes(norm)) return `class="fb-animated-hud-text"`;
            if (["trabzonspor", "ts"].includes(norm)) return `class="ts-animated-hud-text"`;
            if (["türkiye", "turkiye"].includes(norm)) return `class="tr-animated-hud-text"`;
            if (["azerbaycan", "azerbaijan"].includes(norm)) return `class="az-animated-hud-text"`;
            let color = teamColor;
            const rgb = hexToRgbParts(teamColor);
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            if (brightness < 50) color = "#ffffff";
            return `style="color:${color}; text-shadow:0 0 5px rgba(0,0,0,0.5);"`;
        };

        const redStyle = getHUDNameStyle(miniData.redTeamName, rc);
        const blueStyle = getHUDNameStyle(miniData.blueTeamName, bc);

        const targetHtml = `<span ${redStyle}>${n1}</span><span style="margin: 0 15px; font-size:32px; color:#ffd43b; text-shadow: 0 0 15px rgba(255,212,59,0.3);">${s1} - ${s2}</span><span ${blueStyle}>${n2}</span>`;

        if (miniData._cachedScoreHtml !== targetHtml) {
            miniData._cachedScoreHtml = targetHtml;
            scoreEl.innerHTML = targetHtml;
        }
    }
    
    if (timeEl) {
        if (miniData.matchDuration >= 99999) {
            timeEl.textContent = "♾️";
            timeEl.style.color = "#ffd43b";
        } else {
            const t = Math.max(0, Math.ceil(state.time_left || 0));
            const min = Math.floor(t / 60);
            const sec = t % 60;
            timeEl.textContent = `${min}:${sec.toString().padStart(2, "0")}`;
            timeEl.style.color = t <= 10 ? "#ff6b6b" : "#ffd43b";
        }
    }
    
    let mySprint = null;
    if (miniData._currentReplayFrame && miniData._currentReplayFrame.players && miniData._currentReplayFrame.players[miniData.playerId]) {
        const rp = miniData._currentReplayFrame.players[miniData.playerId];
        mySprint = rp.sprint || null;
    } else if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players?.[1]) {
        const p = HP.room.gameState.players[1];
        mySprint = { energy: p.sprint_energy || 0, max_energy: 100, active: p.keys.sprint && p.sprint_energy > 0 };
    } else if (state.sprint) {
        mySprint = state.sprint[String(miniData.playerId)];
    }
    
    if (sprintEl && mySprint) {
        const energyPercent = (mySprint.energy / mySprint.max_energy) * 100;
        const energyRounded = Math.round(energyPercent);
        const isActive = mySprint.active;
        let color, bg;
        if (isActive) { color = "#ffd43b"; bg = "rgba(255,212,59,0.25)"; }
        else if (energyPercent >= 50) { color = "#51cf66"; bg = "rgba(81,207,102,0.15)"; }
        else if (energyPercent > 0) { color = "#ffa94d"; bg = "rgba(255,169,77,0.15)"; }
        else { color = "#ff6b6b"; bg = "rgba(255,107,107,0.15)"; }
        sprintEl.innerHTML = `⚡ Sprint: ${energyRounded}%`;
        sprintEl.style.color = color;
        sprintEl.style.background = bg;
    }
}

// ========================================
// 🌐 P2P BAĞLANTI GÖSTERGESİ
// ========================================
function updateMiniConnectionBadge() {
    let badge = document.getElementById("miniConnBadge");
    if (!badge) {
        badge = document.createElement("div");
        badge.id = "miniConnBadge";
        badge.style.cssText = "position:fixed;top:12px;right:12px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:bold;font-family:'Segoe UI',sans-serif;z-index:9998;transition:all 0.3s;box-shadow:0 2px 8px rgba(0,0,0,0.4);pointer-events:none;";
        document.body.appendChild(badge);
    }
    const gameScreen = document.getElementById("miniGameScreen");
    const lobbyScreen = document.getElementById("miniLobbyScreen");
    const inGame = gameScreen && !gameScreen.classList.contains("hidden");
    const inLobby = lobbyScreen && !lobbyScreen.classList.contains("hidden");
    if (!inGame && !inLobby) { badge.style.display = "none"; return; }
    badge.style.display = "block";
    const isHost = miniData.playerId === 1;
    const otherCount = miniData.players ? miniData.players.filter(p => p.id !== miniData.playerId).length : 0;
    if (isHost && otherCount === 0) {
        badge.innerHTML = "🏠 Yalnız (Local)";
        badge.style.background = "rgba(148,168,255,0.9)";
        badge.style.color = "#fff";
        return;
    }
    let connectedCount = 0;
    for (const pid in MiniRTC.peers) {
        if (MiniRTC.peers[pid].connected) connectedCount++;
    }
    if (MiniRTC.connected || connectedCount > 0) {
        badge.innerHTML = isHost ? `🚀 P2P (${connectedCount}/${otherCount} Oyuncu)` : "🚀 P2P Direkt";
        badge.style.background = "rgba(81,207,102,0.9)";
        badge.style.color = "#fff";
    } else {
        badge.innerHTML = "☁️ Sunucu";
        badge.style.background = "rgba(255,169,77,0.9)";
        badge.style.color = "#fff";
    }
}

function updateMiniHostVisibilityBadge(isHidden) {
    let badge = document.getElementById("miniHostVisibilityBadge");
    if (!badge) {
        badge = document.createElement("div");
        badge.id = "miniHostVisibilityBadge";
        badge.style.cssText = "position:fixed;top:12px;left:12px;padding:6px 12px;border-radius:20px;font-size:12px;font-weight:bold;font-family:'Segoe UI',sans-serif;z-index:9998;transition:all 0.3s;box-shadow:0 2px 8px rgba(0,0,0,0.4);pointer-events:none;background:rgba(255,107,107,0.95);color:#fff;display:none;";
        badge.innerHTML = "⚠️ Host Başka Sekmede (Gecikme Olabilir)";
        document.body.appendChild(badge);
    }
    const gameScreen = document.getElementById("miniGameScreen");
    if (!gameScreen || gameScreen.classList.contains("hidden")) { badge.style.display = "none"; return; }
    badge.style.display = isHidden ? "block" : "none";
}

// ========================================
// ✨ PING SİSTEMİ
// ========================================
function startMiniPing() {
    if (miniData.pingInterval) return;
    function _shouldPing() {
        const isHost = miniData.playerId === 1;
        const otherCount = miniData.players ? miniData.players.filter(p => p.id !== miniData.playerId).length : 0;
        if (isHost && otherCount === 0) {
            if (!miniData.pings) miniData.pings = {};
            miniData.pings[miniData.playerId] = 0;
            updateMiniPingDisplay();
            return false;
        }
        return true;
    }
    miniData.pingInterval = setInterval(() => {
        if (!_shouldPing()) return;
        if (MiniRTC.connected) {
            MiniRTC.sendMessage({ type: "mini_ping_p2p", ts: Date.now() });
        } else if (ws && ws.readyState === WebSocket.OPEN) {
            send({ type: "mini_ping", ts: Date.now() });
        }
    }, 3000);
    setTimeout(() => {
        if (!_shouldPing()) return;
        if (MiniRTC.connected) MiniRTC.sendMessage({ type: "mini_ping_p2p", ts: Date.now() });
        else if (ws && ws.readyState === WebSocket.OPEN) send({ type: "mini_ping", ts: Date.now() });
    }, 500);
}

function stopMiniPing() {
    if (miniData.pingInterval) { clearInterval(miniData.pingInterval); miniData.pingInterval = null; }
}

function updateMiniPingDisplay() {
    const pingSpans = document.querySelectorAll(".miniPlayerPing");
    pingSpans.forEach(span => {
        const pid = parseInt(span.dataset.playerId);
        const pingVal = miniData.pings ? miniData.pings[pid] : null;
        if (pingVal !== undefined && pingVal !== null) {
            span.textContent = `${pingVal}ms`;
            if (pingVal < 80) span.style.color = "#51cf66";
            else if (pingVal < 200) span.style.color = "#ffd43b";
            else span.style.color = "#ff6b6b";
        }
    });
}

// ========================================
// 🎮 KONTROL AYARLARI POPUP
// ========================================
const DEFAULT_KEYS_P1 = { up: "w", down: "s", left: "a", right: "d", kick: "Space", sprint: "ShiftLeft" };

function getSavedKeys(slot) {
    try {
        const raw = localStorage.getItem("miniKeys_" + slot);
        if (raw) return JSON.parse(raw);
    } catch(e) {}
    return slot === "p1" ? { ...DEFAULT_KEYS_P1 } : { ...DEFAULT_KEYS_P1 };
}

function saveKeys(slot, keys) {
    try { localStorage.setItem("miniKeys_" + slot, JSON.stringify(keys)); } catch(e) {}
}

function keyLabel(code) {
    const map = { "Space": "SPACE", "ShiftLeft": "Sol SHIFT", "ShiftRight": "Sağ SHIFT", "ControlLeft": "Sol CTRL", "ControlRight": "Sağ CTRL", "ArrowUp": "↑", "ArrowDown": "↓", "ArrowLeft": "←", "ArrowRight": "→", "Numpad0": "Num 0", "Numpad1": "Num 1" };
    if (map[code]) return map[code];
    if (code.length === 1) return code.toUpperCase();
    return code;
}

function showMiniControlSettings() {
    const existing = document.getElementById("miniControlSettings");
    if (existing) existing.remove();
    const p1Keys = getSavedKeys("p1");
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let connectedPads = [];
    for (let i = 0; i < pads.length; i++) {
        if (pads[i] && pads[i].connected) connectedPads.push({ index: pads[i].index, name: pads[i].id.split("(")[0].trim() });
    }
    let gamepadHtml = connectedPads.length === 0
        ? `<p style="color:#adb5bd;font-size:13px;text-align:center;padding:15px;background:rgba(0,0,0,0.2);border-radius:8px;">🎮 Kontrolcü bağlı değil.</p>`
        : `<div style="display:flex;flex-direction:column;gap:10px;">` + connectedPads.map(pad => {
            const isEnabled = miniGamepad.enabled && miniGamepad.index === pad.index;
            return `<div style="padding:12px 14px;background:${isEnabled ? 'rgba(81,207,102,0.1)' : 'rgba(73,80,87,0.1)'};border:1px solid ${isEnabled ? '#51cf66' : '#495057'};border-radius:8px;">
                <span style="color:${isEnabled ? '#51cf66' : '#adb5bd'};font-weight:bold;font-size:13px;">🎮 ${pad.name || 'Kontrolcü'}</span>
                <label style="display:flex;align-items:center;cursor:pointer;padding:8px 10px;background:rgba(0,0,0,0.25);border-radius:6px;margin-top:4px;">
                    <input type="checkbox" id="miniGamepadEnableToggle" ${isEnabled ? 'checked' : ''} style="margin-right:10px;width:16px;height:16px;cursor:pointer;accent-color:#51cf66;">
                    <span style="color:#51cf66;font-weight:bold;font-size:13px;">🎮 Kontrolcüyü Etkinleştir</span>
                </label>
            </div>`;
        }).join("") + `</div>`;

    const vibrationEnabled = MiniVibration.isEnabled();
    let vibrationHtml = "";
    if (connectedPads.length > 0) {
        const vTypes = [{id:"kick",label:"⚽ Şut",def:25},{id:"firekick",label:"🔥 Alevli Şut",def:50},{id:"wall",label:"🧱 Duvar",def:15},{id:"post",label:"🥅 Direk",def:90},{id:"goal",label:"🎯 Gol",def:50},{id:"whistle",label:"📢 Düdük",def:10}];
        vibrationHtml = `<label style="display:flex;align-items:center;cursor:pointer;padding:10px 14px;background:rgba(255,169,77,0.1);border:1px solid #ffa94d;border-radius:8px;margin-bottom:10px;">
            <input type="checkbox" id="miniVibrationMasterToggle" ${vibrationEnabled ? 'checked' : ''} style="margin-right:12px;width:18px;height:18px;cursor:pointer;accent-color:#ffa94d;">
            <span style="color:#ffa94d;font-weight:bold;font-size:14px;">📳 Titreşimi Etkinleştir</span>
        </label>
        <div id="miniVibrationContent" style="max-height:${vibrationEnabled ? '2000px' : '0'};overflow:hidden;transition:max-height 0.4s ease-out;">
            <div style="padding:12px;background:rgba(255,169,77,0.05);border-radius:8px;border-left:3px solid #ffa94d;">` +
            vTypes.map(vt => {
                const cv = MiniVibration.getPower(vt.id);
                return `<div style="margin-bottom:12px;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:6px;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                        <span style="color:#ffd43b;font-weight:bold;font-size:12px;">${vt.label}</span>
                        <span id="miniVibVal_${vt.id}" style="color:#ffa94d;font-family:monospace;background:rgba(0,0,0,0.4);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:bold;">%${cv}</span>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <input type="range" id="miniVibRange_${vt.id}" data-vib-type="${vt.id}" min="0" max="100" step="1" value="${cv}" style="flex:1;height:5px;cursor:pointer;accent-color:#ffa94d;">
                        <button class="miniVibTestBtn" data-vib-type="${vt.id}" style="background:#0ca678;color:#fff;border:none;padding:5px 10px;border-radius:5px;font-size:11px;font-weight:bold;cursor:pointer;min-width:110px;">🔊 Test Et</button>
                    </div>
                </div>`;
            }).join("") + `</div></div>`;
    }

    let savedTabOpacity = 5;
    try { const s = localStorage.getItem("miniTabOpacity"); if (s !== null) savedTabOpacity = parseInt(s); if (isNaN(savedTabOpacity)) savedTabOpacity = 5; } catch(e) {}

    const keyDefs = [{id:"up",label:"⬆️ Yukarı"},{id:"down",label:"⬇️ Aşağı"},{id:"left",label:"⬅️ Sol"},{id:"right",label:"➡️ Sağ"},{id:"kick",label:"⚽ Şut"},{id:"sprint",label:"🏃 Sprint"}];
    let keyBindHtml = `<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;">` + keyDefs.map(k =>
        `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:rgba(0,0,0,0.2);border-radius:6px;">
            <span style="color:#adb5bd;font-size:12px;flex:1;">${k.label}:</span>
            <button class="miniKeyBindBtn" data-key-id="${k.id}" style="background:#ffd43b;color:#000;border:none;padding:4px 12px;border-radius:4px;font-family:monospace;font-weight:bold;cursor:pointer;font-size:12px;min-width:70px;">${keyLabel(p1Keys[k.id])}</button>
        </div>`
    ).join("") + `</div>`;

    const overlay = document.createElement("div");
    overlay.id = "miniControlSettings";
    overlay.className = "overlay";
    overlay.innerHTML = `
        <div class="overlayCard" style="max-width:640px; max-height:88vh; overflow-y:auto; border:2px solid #0ca678; box-shadow: 0 0 40px rgba(12,166,120,0.3);">
            <div style="font-size:50px; margin:10px 0;">⚙️</div>
            <h2 style="color:#0ca678; margin:5px 0 20px 0;">Ayarlar</h2>
            
            <div style="text-align:left; margin-bottom:20px;">
                <h3 style="color:#c084fc; font-size:15px; margin:0 0 10px 0; text-align:center;">
                    🎮 Bağlı Kontrolcüler
                </h3>
                ${gamepadHtml}
            </div>
            
            <div id="miniVibrationSection" style="text-align:left; margin:20px 0 15px 0; padding-top:20px; border-top:1px dashed #3b4c63; display:${(connectedPads.length > 0 && miniGamepad.enabled) ? 'block' : 'none'};">
                <h3 style="color:#ffa94d; font-size:15px; margin:0 0 10px 0; text-align:center;">
                    📳 Titreşim Ayarları
                </h3>
                ${vibrationHtml}
            </div>
            
            <div style="text-align:left; margin:20px 0 15px 0; padding-top:20px; border-top:1px dashed #3b4c63;">
                <h3 style="color:#4dabf7; font-size:15px; margin:0 0 10px 0; text-align:center;">
                    📊 TAB Skorboard Görünürlüğü
                </h3>
                <p style="color:#adb5bd; font-size:11px; text-align:center; margin:0 0 12px 0;">
                    TAB'a bastığında arka planın koyuluğu
                </p>
                <div style="padding:12px 15px; background:rgba(77,171,247,0.08); border:1px solid rgba(77,171,247,0.3); border-radius:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="color:#4dabf7; font-weight:bold; font-size:13px;">Koyuluk</span>
                        <span id="miniTabOpacityVal" style="color:#ffd43b; font-family:monospace; background:rgba(0,0,0,0.3); padding:3px 10px; border-radius:5px; font-size:12px;">
                            %${savedTabOpacity}
                        </span>
                    </div>
                    <input type="range" id="miniTabOpacityRange" min="0" max="100" step="1" value="${savedTabOpacity}" style="width:100%; height:5px; cursor:pointer; accent-color:#4dabf7;">
                    <div style="display:flex; justify-content:space-between; color:#6c757d; font-size:10px; margin-top:2px;">
                        <span>Görünmez (%0)</span>
                        <span>Koyu (%100)</span>
                    </div>
                </div>
            </div>
            
            <div style="text-align:left; margin:25px 0 15px 0; padding-top:20px; border-top:1px dashed #3b4c63;">
                <h3 style="color:#ffd43b; font-size:15px; margin:0 0 10px 0; text-align:center;">
                    ⌨️ Klavye Kısayolları
                </h3>
                <p style="color:#adb5bd; font-size:11px; text-align:center; margin:0 0 12px 0;">
                    Değiştirmek için üstüne tıkla, sonra yeni tuşa bas
                </p>
                ${keyBindHtml}
            </div>
            
            <div class="confirmButtons" style="margin-top:20px;">
                <button id="miniCtrlResetBtn" class="bigBtn" style="background:#e67e22;">
                    🔄 Varsayılana Sıfırla
                </button>
                <button id="miniCtrlCloseBtn" class="bigBtn greenBtn">
                    ✅ Kapat
                </button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    
    const opacitySlider = document.getElementById("miniTabOpacityRange");
    const opacityVal = document.getElementById("miniTabOpacityVal");
    if (opacitySlider && opacityVal) {
        opacitySlider.addEventListener("input", () => {
            const val = parseInt(opacitySlider.value);
            opacityVal.textContent = `%${val}`;
            try { localStorage.setItem("miniTabOpacity", String(val)); } catch(e) {}
            const sb = document.getElementById("miniScoreboard");
            if (sb) sb.style.background = `rgba(15, 20, 30, ${val / 100})`;
        });
    }
    
    const gpEnableToggle = document.getElementById("miniGamepadEnableToggle");
    if (gpEnableToggle) {
        gpEnableToggle.addEventListener("change", () => {
            miniGamepad.enabled = gpEnableToggle.checked;
            saveGamepadEnabled();
            if (miniGamepad.enabled) {
                const gameScreen = document.getElementById("miniGameScreen");
                if (gameScreen && !gameScreen.classList.contains("hidden")) {
                    startGamepadPolling();
                }
                showToast("🎮 Kontrolcü", "Kontrolcü etkinleştirildi!", null, "success");
            } else {
                stopGamepadPolling();
                MiniVibration.stop();
                showToast("⏸️ Kontrolcü", "Kontrolcü devre dışı bırakıldı", null, "info");
            }
            overlay.remove();
            showMiniControlSettings();
        });
    }
    
    overlay.querySelectorAll('input[id^="miniVibRange_"]').forEach(slider => {
        const type = slider.dataset.vibType;
        const valSpan = document.getElementById("miniVibVal_" + type);
        slider.addEventListener("input", () => {
            const val = parseInt(slider.value);
            if (valSpan) valSpan.textContent = `%${val}`;
            try { localStorage.setItem("miniVibrationPower_" + type, String(val)); } catch(e) {}
        });
    });
    
    overlay.querySelectorAll(".miniVibTestBtn").forEach(btn => {
        btn.addEventListener("click", () => {
            const type = btn.dataset.vibType;
            if (btn.dataset.testing === "true") {
                MiniVibration.stop();
                if (btn._testTimeout) clearTimeout(btn._testTimeout);
                btn.dataset.testing = "false";
                btn.textContent = "🔊 Test Et";
                btn.style.background = "#0ca678";
                return;
            }
            if (!miniGamepad.connected || !MiniVibration.isEnabled() || !miniGamepad.enabled) return;
            btn.dataset.testing = "true";
            btn.textContent = "⏹ Durdur";
            btn.style.background = "#e03131";
            MiniVibration.testVibrate(type, 3000);
            btn._testTimeout = setTimeout(() => {
                MiniVibration.stop();
                btn.dataset.testing = "false";
                btn.textContent = "🔊 Test Et";
                btn.style.background = "#0ca678";
            }, 3000);
        });
    });
    
    let waitingForKey = null;
    overlay.querySelectorAll(".miniKeyBindBtn").forEach(btn => {
        btn.onclick = () => {
            if (waitingForKey) return;
            waitingForKey = btn.dataset.keyId;
            btn.textContent = "... tuşa bas";
            btn.style.background = "#ff6b6b";
            btn.style.color = "#fff";
        };
    });
    const keyListener = (e) => {
        if (!waitingForKey) return;
        e.preventDefault();
        e.stopPropagation();
        const btn = overlay.querySelector(`.miniKeyBindBtn[data-key-id="${waitingForKey}"]`);
        if (!btn) return;
        p1Keys[waitingForKey] = e.code;
        saveKeys("p1", p1Keys);
        btn.textContent = keyLabel(e.code);
        btn.style.background = "#ffd43b";
        btn.style.color = "#000";
        waitingForKey = null;
        updateMiniControlsInfo();
    };
    window.addEventListener("keydown", keyListener, true);
    
    overlay.querySelector("#miniCtrlCloseBtn").onclick = () => {
        window.removeEventListener("keydown", keyListener, true);
        MiniVibration.stop();
        overlay.querySelectorAll(".miniVibTestBtn").forEach(b => { if (b._testTimeout) clearTimeout(b._testTimeout); });
        overlay.remove();
    };
    
    overlay.querySelector("#miniCtrlResetBtn").onclick = () => {
        if (!confirm("Ayarları varsayılana sıfırla?")) return;
        try {
            localStorage.removeItem("miniKeys_p1");
            localStorage.setItem("miniTabOpacity", "5");
            localStorage.removeItem("miniVibrationEnabled");
        } catch(e) {}
        MiniVibration.stop();
        window.removeEventListener("keydown", keyListener, true);
        overlay.remove();
        showMiniControlSettings();
    };
}

// ========================================
// 📊 SCOREBOARD (TAB)
// ========================================
function createMiniScoreboard() {
    if (document.getElementById("miniScoreboard")) return;
    
    let tabOpacity = 5;
    try {
        const saved = localStorage.getItem("miniTabOpacity");
        if (saved !== null) {
            const parsed = parseInt(saved);
            tabOpacity = isNaN(parsed) ? 5 : parsed;
        }
    } catch(e) {}

    const overlay = document.createElement("div");
    overlay.id = "miniScoreboard";
    overlay.style.cssText = `position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,20,30,${tabOpacity/100});display:none;justify-content:center;align-items:center;z-index:9999999;font-family:'Segoe UI',sans-serif;`;
    overlay.innerHTML = `<div style="background:rgba(30,35,50,0.70);border-radius:12px;border:1px solid rgba(255,255,255,0.08);padding:24px;min-width:700px;max-width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.4);">
        <div style="text-align:center;margin-bottom:20px;color:#e0e0e0;font-size:18px;font-weight:500;letter-spacing:1px;">📊 SKOR TABLOSU</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
            <div id="scoreRedCol" style="background:rgba(255,107,107,0.08);border:1px solid rgba(255,107,107,0.25);border-radius:8px;padding:14px;">
                <div id="scoreRedTitle" style="color:#ff8a8a;font-size:14px;font-weight:600;text-align:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(255,107,107,0.2);">🔴 Kırmızı Takım</div>
                <div id="scoreRedList"></div></div>
            <div style="background:rgba(150,150,150,0.06);border:1px solid rgba(150,150,150,0.2);border-radius:8px;padding:14px;">
                <div style="color:#b0b0b0;font-size:14px;font-weight:600;text-align:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(150,150,150,0.15);">İzleyiciler</div>
                <div id="scoreSpecList"></div></div>
            <div id="scoreBlueCol" style="background:rgba(77,171,247,0.08);border:1px solid rgba(77,171,247,0.25);border-radius:8px;padding:14px;">
                <div id="scoreBlueTitle" style="color:#7abfff;font-size:14px;font-weight:600;text-align:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid rgba(77,171,247,0.2);">🔵 Mavi Takım</div>
                <div id="scoreBlueList"></div></div>
        </div>
        <div id="scoreFinalScore" style="text-align:center;margin-top:20px;padding:14px 0 6px 0;color:#e0e0e0;font-size:42px;font-weight:700;letter-spacing:6px;border-top:1px solid rgba(255,255,255,0.08);display:none;">0 - 0</div>
    </div>`;
    document.body.appendChild(overlay);
}

function renderMiniScoreboard() {
    createMiniScoreboard();
    
    const state = miniData.gameState;
    if (!state) return;
    
    const stats = state.stats || {};
    const pings = miniData.pings || {};
    
    const redTeam = [];
    const blueTeam = [];
    const spectators = [];
    
    miniData.players.forEach(p => {
        if (p.team === "red") redTeam.push(p);
        else if (p.team === "blue") blueTeam.push(p);
        else spectators.push(p);
    });
    
    const dynRed = miniData.redTeamColor || "#ff6b6b";
    const dynBlue = miniData.blueTeamColor || "#4dabf7";

    const redColEl = document.getElementById("scoreRedCol");
    const blueColEl = document.getElementById("scoreBlueCol");
    if (redColEl) {
        redColEl.style.background = hexToRgba(dynRed, 0.08);
        redColEl.style.borderColor = hexToRgba(dynRed, 0.25);
    }
    if (blueColEl) {
        blueColEl.style.background = hexToRgba(dynBlue, 0.08);
        blueColEl.style.borderColor = hexToRgba(dynBlue, 0.25);
    }

    const redTitleEl = document.getElementById("scoreRedTitle");
    const blueTitleEl = document.getElementById("scoreBlueTitle");
    if (redTitleEl) {
        redTitleEl.innerHTML = `<span style="color:${dynRed}; font-size:18px;">●</span> ${miniData.redTeamName || "Kırmızı Takım"}`;
        redTitleEl.style.color = dynRed;
        redTitleEl.style.borderBottomColor = hexToRgba(dynRed, 0.2);
    }
    if (blueTitleEl) {
        blueTitleEl.innerHTML = `<span style="color:${dynBlue}; font-size:18px;">●</span> ${miniData.blueTeamName || "Mavi Takım"}`;
        blueTitleEl.style.color = dynBlue;
        blueTitleEl.style.borderBottomColor = hexToRgba(dynBlue, 0.2);
    }
    
    function makeTeamRows(players, teamColor, teamSide) {
        if (players.length === 0) {
            return `<div style="text-align:center; color:#6c757d; font-size:12px; padding:12px; font-style:italic;">Boş</div>`;
        }
        
        let html = `<div style="display:grid; grid-template-columns:1fr 28px 28px 28px 28px 45px; gap:6px; color:#909090; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px; padding:0 4px;">
            <div>İsim</div>
            <div style="text-align:center;" title="Gol">G</div>
            <div style="text-align:center;" title="Asist">A</div>
            <div style="text-align:center;" title="Pas">P</div>
            <div style="text-align:center;" title="Kurtarış">K</div>
            <div style="text-align:right;">Ping</div>
        </div>`;
        
        const sideName = (teamSide === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
        const sideNorm = sideName.trim().toLowerCase();
        let resolvedNameColor = teamColor || "#d0d0d0";
        if (["fenerbahçe", "fenerbahce", "fb"].includes(sideNorm)) {
            resolvedNameColor = "#ffed00";
        } else if (["galatasaray", "gs"].includes(sideNorm)) {
            resolvedNameColor = "#fdb913";
        } else if (["trabzonspor", "ts"].includes(sideNorm)) {
            resolvedNameColor = "#4ab3e8";
        } else if (["beşiktaş", "besiktas", "bjk"].includes(sideNorm)) {
            resolvedNameColor = "#ffffff";
        } else {
            try {
                const rgb = hexToRgbParts(resolvedNameColor);
                const bright = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                const mx = Math.max(rgb.r, rgb.g, rgb.b);
                const mn = Math.min(rgb.r, rgb.g, rgb.b);
                const sat = mx === 0 ? 0 : (mx - mn) / mx;
                if (bright < 55 && sat < 0.22) resolvedNameColor = "#ffffff";
            } catch (e) {}
        }
        
        players.forEach(p => {
            const st = stats[String(p.id)] || { goals: 0, assists: 0, passes: 0 };
            const ping = pings[p.id];
            let pingText = "-";
            let pingColor = "#909090";
            if (ping !== undefined && ping !== null) {
                pingText = `${ping}ms`;
                if (ping < 80) pingColor = "#7dcc8b";
                else if (ping < 200) pingColor = "#ddb84b";
                else pingColor = "#e08585";
            }
            const isMe = p.id === miniData.playerId;
            const nameColor = resolvedNameColor;
            
            html += `<div style="display:grid; grid-template-columns:1fr 28px 28px 28px 28px 45px; gap:6px; padding:6px 4px; font-size:13px; font-weight:${isMe ? '700' : '500'}; border-bottom:1px solid rgba(255,255,255,0.04);">
                <div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:${nameColor};">
                    ${p.name}${p.id === 1 ? ' 👑' : ''}${isMe ? ' <span style="color:#909090;font-size:10px;">(sen)</span>' : ''}
                </div>
                <div style="text-align:center; color:#d0d0d0;">${st.goals}</div>
                <div style="text-align:center; color:#d0d0d0;">${st.assists}</div>
                <div style="text-align:center; color:#d0d0d0;">${st.passes}</div>
                <div style="text-align:center; color:#d0d0d0;">${st.saves || 0}</div>
                <div style="text-align:right; color:${pingColor}; font-family:monospace; font-size:11px;">${pingText}</div>
            </div>`;
        });
        
        return html;
    }
    
    function makeSpecRows(players) {
        if (players.length === 0) {
            return `<div style="text-align:center; color:#6c757d; font-size:12px; padding:12px; font-style:italic;">İzleyici yok</div>`;
        }
        let html = "";
        players.forEach(p => {
            const ping = pings[p.id];
            let pingText = "-";
            let pingColor = "#909090";
            if (ping !== undefined && ping !== null) {
                pingText = `${ping}ms`;
                if (ping < 80) pingColor = "#7dcc8b";
                else if (ping < 200) pingColor = "#ddb84b";
                else pingColor = "#e08585";
            }
            const isMe = p.id === miniData.playerId;
            html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:6px 4px; font-size:13px; color:${isMe ? '#ffffff' : '#c0c0c0'}; font-weight:${isMe ? '600' : '400'}; border-bottom:1px solid rgba(255,255,255,0.04);">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    👁️ ${p.name}${p.id === 1 ? ' 👑' : ''}${isMe ? ' <span style="color:#909090;font-size:10px;">(sen)</span>' : ''}
                </span>
                <span style="color:${pingColor}; font-family:monospace; font-size:11px;">${pingText}</span>
            </div>`;
        });
        return html;
    }
    
    document.getElementById("scoreRedList").innerHTML = makeTeamRows(redTeam, dynRed, "red");
    document.getElementById("scoreBlueList").innerHTML = makeTeamRows(blueTeam, dynBlue, "blue");
    document.getElementById("scoreSpecList").innerHTML = makeSpecRows(spectators);
}

function showMiniScoreboard() {
    let tabOpacity = 5;
    try {
        const saved = localStorage.getItem("miniTabOpacity");
        if (saved !== null) {
            const parsed = parseInt(saved);
            tabOpacity = isNaN(parsed) ? 5 : parsed;
        }
    } catch(e) {}
    
    if (tabOpacity <= 0) return;
    
    createMiniScoreboard();
    renderMiniScoreboard();
    const overlay = document.getElementById("miniScoreboard");
    if (overlay) {
        overlay.style.background = `rgba(15, 20, 30, ${tabOpacity / 100})`;
        overlay.style.display = "flex";
    }
}

function hideMiniScoreboard() {
    const overlay = document.getElementById("miniScoreboard");
    if (overlay) overlay.style.display = "none";
}

// TAB tuşu takip
let miniTabHeld = false;
let miniScoreboardInterval = null;

document.addEventListener("keydown", (e) => {
    if (e.key !== "Tab") return;
    
    const gameScreen = document.getElementById("miniGameScreen");
    if (!gameScreen || gameScreen.classList.contains("hidden")) return;
    
    const pauseBox = document.getElementById("miniPauseLobbyBox");
    const guestBox = document.getElementById("miniGuestEscBox");
    const guestPaused = document.getElementById("miniGuestPausedBox");
    const teamNameBox = document.getElementById("miniTeamNameEditor");
    const nameBox = document.getElementById("miniNameEditor");
    const settingsBox = document.getElementById("roomSettingsBox");
    const ctrlBox = document.getElementById("miniControlSettings");
    const returnBox = document.getElementById("miniLobbyReturnConfirm");
    const resetBox = document.getElementById("miniResetNamesConfirm");
    const escBox = document.getElementById("escConfirmBox");
    const quickPause = document.getElementById("miniQuickPauseOverlay");
    
    const anyPopupOpen = [
        pauseBox, guestBox, guestPaused, teamNameBox, nameBox, 
        settingsBox, ctrlBox, returnBox, resetBox, escBox
    ].some(el => el && !el.classList.contains("hidden"));
    
    const quickPauseOpen = quickPause && quickPause.style.display === "flex";
    
    if (anyPopupOpen || quickPauseOpen) {
        e.preventDefault();
        return;
    }
    
    e.preventDefault();
    if (e.repeat) return;
    
    if (!miniTabHeld) {
        miniTabHeld = true;
        showMiniScoreboard();
        if (miniScoreboardInterval) clearInterval(miniScoreboardInterval);
        miniScoreboardInterval = setInterval(() => {
            if (miniTabHeld) renderMiniScoreboard();
        }, 300);
    }
}, true);

document.addEventListener("keyup", (e) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    miniTabHeld = false;
    hideMiniScoreboard();
    if (miniScoreboardInterval) {
        clearInterval(miniScoreboardInterval);
        miniScoreboardInterval = null;
    }
}, true);

// T ve P kısayolları
document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k !== "t") return;
    
    const gameScreen = document.getElementById("miniGameScreen");
    const lobbyScreen = document.getElementById("miniLobbyScreen");
    const inMini = (gameScreen && !gameScreen.classList.contains("hidden")) ||
                   (lobbyScreen && !lobbyScreen.classList.contains("hidden"));
    if (!inMini) return;
    
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
    
    const container = document.getElementById("miniChatContainer");
    if (!container || container.style.display === "none") return;
    if (miniChat.open) return;
    
    const openPopups = [
        "miniPauseLobbyBox", "miniGuestEscBox", "miniGuestPausedBox",
        "roomSettingsBox", "miniControlSettings", "miniTeamNameEditor",
        "miniNameEditor", "escConfirmBox", "miniLobbyReturnConfirm",
        "miniRestartConfirm", "miniResetNamesConfirm", "miniKickConfirm",
        "miniGuestLobbyConfirm", "miniGameOverBox"
    ];
    for (const id of openPopups) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains("hidden") && el.style.display !== "none") {
            return;
        }
    }
    
    e.preventDefault();
    e.stopPropagation();
    miniReleaseAllKeys();
    openMiniChatPanel();
}, true);

document.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k !== "p") return;
    
    const gameScreen = document.getElementById("miniGameScreen");
    if (!gameScreen || gameScreen.classList.contains("hidden")) return;
    if (miniData.playerId !== 1) return;
    
    const escBox = document.getElementById("miniPauseLobbyBox");
    if (escBox && !escBox.classList.contains("hidden")) return;
    
    e.preventDefault();
    e.stopPropagation();
    send({ type: "mini_quick_pause" });
}, true);

// ========================================
// 🏆 MAÇ SONU (GameOver) TABLOSU
// ========================================
function showMiniGameOver(msg) {
    if (typeof HP !== 'undefined' && HP.running) HP.stopGame();
    
    const box = document.getElementById("miniGameOverBox");
    if (!box) return;
    box.classList.remove("hidden");
    
    const s1 = msg.scores["1"] || 0;
    const s2 = msg.scores["2"] || 0;
    
    const title = document.getElementById("miniGameOverTitle");
    if (msg.winner_id === miniData.playerId) {
        title.textContent = "🏆 KAZANDIN!";
        title.style.color = "#51cf66";
        if (typeof startConfetti === "function") startConfetti();
    } else if (msg.winner_id === 0) {
        title.textContent = "🤝 BERABERE!";
        title.style.color = "#ffd43b";
    } else {
        title.textContent = "😢 KAYBETTİN";
        title.style.color = "#ff6b6b";
    }
    
    const dynRed = miniData.redTeamColor || "#ff6b6b";
    const dynBlue = miniData.blueTeamColor || "#4dabf7";

    const isGameOverColorDark = (hex) => {
        const rgb = hexToRgbParts(hex);
        const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
        const max = Math.max(rgb.r, rgb.g, rgb.b);
        const min = Math.min(rgb.r, rgb.g, rgb.b);
        const saturation = max === 0 ? 0 : (max - min) / max;
        return brightness < 55 && saturation < 0.22;
    };

    const redTextCol = isGameOverColorDark(dynRed) ? "#ffffff" : dynRed;
    const blueTextCol = isGameOverColorDark(dynBlue) ? "#ffffff" : dynBlue;

    const scoreLine = document.getElementById("miniGameOverScoreLine");
    if (scoreLine) {
        scoreLine.innerHTML = `
            <span style="color:${redTextCol}; text-shadow:${isGameOverColorDark(dynRed) ? '0 0 10px rgba(255,255,255,0.5)' : 'none'};">${miniData.redTeamName || "Kırmızı"}</span>
            <span style="margin:0 18px; color:#ffd43b;">${s1} - ${s2}</span>
            <span style="color:${blueTextCol}; text-shadow:${isGameOverColorDark(dynBlue) ? '0 0 10px rgba(255,255,255,0.5)' : 'none'};">${miniData.blueTeamName || "Mavi"}</span>
        `;
    }
    
    const stats = (miniData.gameState && miniData.gameState.stats) || {};

    let mvpCandidate = null;
    
    miniData.players.forEach(p => {
        if (p.team === "spectator") return;
        const st = stats[String(p.id)] || { goals: 0, assists: 0, passes: 0, saves: 0 };
        const g = st.goals || 0;
        const s = st.saves || 0;
        const a = st.assists || 0;
        const ps = st.passes || 0;
        
        // Hiçbir istatistiği olmayan (hepsi 0) MVP olamaz
        if (g === 0 && s === 0 && a === 0 && ps === 0) return;
        
        if (!mvpCandidate) {
            mvpCandidate = { id: p.id, g, s, a, ps };
            return;
        }
        
        // ✨ Kesin Hiyerarşik Karşılaştırma: Gol > Kurtarış > Asist > Pas
        if (g > mvpCandidate.g) {
            mvpCandidate = { id: p.id, g, s, a, ps };
        } else if (g === mvpCandidate.g) {
            if (s > mvpCandidate.s) {
                mvpCandidate = { id: p.id, g, s, a, ps };
            } else if (s === mvpCandidate.s) {
                if (a > mvpCandidate.a) {
                    mvpCandidate = { id: p.id, g, s, a, ps };
                } else if (a === mvpCandidate.a) {
                    if (ps > mvpCandidate.ps) {
                        mvpCandidate = { id: p.id, g, s, a, ps };
                    }
                }
            }
        }
    });
    
    const mvpId = mvpCandidate ? mvpCandidate.id : null;
    
    const oldMvp = document.getElementById("miniGameOverMvpBox");
    if (oldMvp) oldMvp.remove();
    
    const redTitle = document.getElementById("miniGameOverRedTitle");
    const blueTitle = document.getElementById("miniGameOverBlueTitle");
    if (redTitle) {
        redTitle.innerHTML = `<span style="color:${redTextCol}; font-size:18px;">●</span> ${miniData.redTeamName || "Kırmızı Takım"}`;
        redTitle.style.color = redTextCol;
    }
    if (blueTitle) {
        blueTitle.innerHTML = `<span style="color:${blueTextCol}; font-size:18px;">●</span> ${miniData.blueTeamName || "Mavi Takım"}`;
        blueTitle.style.color = blueTextCol;
    }
    
    const overCard = box.querySelector(".overlayCard");
    if (overCard) {
        overCard.style.maxHeight = "90vh";
        overCard.style.overflowY = "auto";
    }

    const redCol = document.getElementById("miniGameOverRedCol");
    const blueCol = document.getElementById("miniGameOverBlueCol");

    if (redCol) {
        const isRedDark = isGameOverColorDark(dynRed);
        if (isRedDark) {
            redCol.style.setProperty("border", "2px solid #ffffff", "important");
            redCol.style.setProperty("background", "linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04))", "important");
            redCol.style.setProperty("box-shadow", "0 0 20px rgba(255, 255, 255, 0.25)", "important");
        } else {
            redCol.style.setProperty("border", "1px solid " + hexToRgba(dynRed, 0.35), "important");
            redCol.style.setProperty("background", hexToRgba(dynRed, 0.08), "important");
            redCol.style.setProperty("box-shadow", "none", "important");
        }
        redCol.style.minHeight = "130px";
    }
    if (blueCol) {
        const isBlueDark = isGameOverColorDark(dynBlue);
        if (isBlueDark) {
            blueCol.style.setProperty("border", "2px solid #ffffff", "important");
            blueCol.style.setProperty("background", "linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04))", "important");
            blueCol.style.setProperty("box-shadow", "0 0 20px rgba(255, 255, 255, 0.25)", "important");
        } else {
            blueCol.style.setProperty("border", "1px solid " + hexToRgba(dynBlue, 0.35), "important");
            blueCol.style.setProperty("background", hexToRgba(dynBlue, 0.08), "important");
            blueCol.style.setProperty("box-shadow", "none", "important");
        }
        blueCol.style.minHeight = "130px";
    }
    
    const redTeam = miniData.players.filter(p => p.team === "red");
    const blueTeam = miniData.players.filter(p => p.team === "blue");
    const spectators = miniData.players.filter(p => p.team !== "red" && p.team !== "blue");

    // ========================================
    // 📊 MATCH STATS COMPARISON
    // ========================================
    const _rematchBtn = document.getElementById("miniRematchBtn");
    const _menuBtn = document.getElementById("miniGameOverMenuBtn");
    let statsContainer = document.getElementById("miniGameOverTeamStats");
    const btnBox = (_rematchBtn && _rematchBtn.parentElement) || (_menuBtn && _menuBtn.parentElement) || document.querySelector("#miniGameOverBox .confirmButtons");
    
    if (!statsContainer && btnBox) {
        statsContainer = document.createElement("div");
        statsContainer.id = "miniGameOverTeamStats";
        statsContainer.style.cssText = "margin: 12px 0; padding:10px 14px; background:rgba(0,0,0,0.35); border-radius:10px; border:1px solid rgba(255,255,255,0.08); display:flex; flex-direction:column; gap:6px; box-sizing:border-box; width:100%; flex-shrink:0;";
        btnBox.insertAdjacentElement("beforebegin", statsContainer);
    }

    if (statsContainer) {
        let rPasses = 0, bPasses = 0;
        let rSaves = 0, bSaves = 0;
        let rAssists = 0, bAssists = 0;

        redTeam.forEach(p => {
            const st = stats[String(p.id)] || {};
            rPasses += (st.passes || 0);
            rSaves += (st.saves || 0);
            rAssists += (st.assists || 0);
        });
        blueTeam.forEach(p => {
            const st = stats[String(p.id)] || {};
            bPasses += (st.passes || 0);
            bSaves += (st.saves || 0);
            bAssists += (st.assists || 0);
        });

        const rPostHits = (miniData._teamPostHits && miniData._teamPostHits.red) || 0;
        const bPostHits = (miniData._teamPostHits && miniData._teamPostHits.blue) || 0;
        const rShots = s1 + bSaves + rPostHits;
        const bShots = s2 + rSaves + bPostHits;
        const totShots = rShots + bShots;

        const rPossPts = (rPasses * 10) + (rAssists * 5) + (s1 * 5);
        const bPossPts = (bPasses * 10) + (bAssists * 5) + (s2 * 5);
        const totalPossPts = rPossPts + bPossPts;

        let rPoss = 50, bPoss = 50;
        if (totalPossPts > 0) {
            rPoss = Math.round((rPossPts / totalPossPts) * 100);
            bPoss = 100 - rPoss;
        }

        const statRows = [
            { title: "⚽ Topa Sahip Olma", rVal: `%${rPoss}`, bVal: `%${bPoss}`, rPct: rPoss, bPct: bPoss },
            { title: "🎯 Kaleyi Bulan Şut", rVal: rShots, bVal: bShots, rPct: (totShots > 0) ? Math.round((rShots / totShots) * 100) : 50, bPct: (totShots > 0) ? Math.round((bShots / totShots) * 100) : 50 },
            { title: "⚽ Goller", rVal: s1, bVal: s2, rPct: (s1 + s2 > 0) ? Math.round((s1 / (s1 + s2)) * 100) : 50, bPct: (s1 + s2 > 0) ? Math.round((s2 / (s1 + s2)) * 100) : 50 },
            { title: "🤝 Toplam Pas", rVal: rPasses, bVal: bPasses, rPct: (rPasses + bPasses > 0) ? Math.round((rPasses / (rPasses + bPasses)) * 100) : 50, bPct: (rPasses + bPasses > 0) ? Math.round((bPasses / (rPasses + bPasses)) * 100) : 50 },
            { title: "🧤 Kurtarışlar", rVal: rSaves, bVal: bSaves, rPct: (rSaves + bSaves > 0) ? Math.round((rSaves / (rSaves + bSaves)) * 100) : 50, bPct: (rSaves + bSaves > 0) ? Math.round((bSaves / (rSaves + bSaves)) * 100) : 50 }
        ];

        let statsHtml = `<div style="font-size:10px; font-weight:800; color:#adb5bd; letter-spacing:1px; text-transform:uppercase; text-align:center; margin-bottom:2px;">📊 Takım Maç İstatistikleri</div>`;

        const getStatBarColor = (teamName, teamColor) => {
            const norm = (teamName || "").trim().toLowerCase();
            if (["beşiktaş", "besiktas", "bjk"].includes(norm)) return "#ffffff";
            const rgb = hexToRgbParts(teamColor);
            const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
            return brightness < 55 ? "#ffffff" : teamColor;
        };

        const rStatCol = getStatBarColor(miniData.redTeamName, dynRed);
        const bStatCol = getStatBarColor(miniData.blueTeamName, dynBlue);

        statRows.forEach(sr => {
            statsHtml += `
                <div>
                    <div style="display:flex; justify-content:space-between; align-items:center; font-size:11px; font-weight:bold; margin-bottom:2px;">
                        <span style="color:${rStatCol}; font-family:monospace; font-size:12px;">${sr.rVal}</span>
                        <span style="color:#e0e0e0; font-size:10px;">${sr.title}</span>
                        <span style="color:${bStatCol}; font-family:monospace; font-size:12px;">${sr.bVal}</span>
                    </div>
                    <div style="display:flex; height:6px; background:rgba(255,255,255,0.08); border-radius:3px; overflow:hidden;">
                        <div style="width:${sr.rPct}%; background:${rStatCol}; transition:width 0.8s cubic-bezier(0.25, 1, 0.5, 1); border-top-left-radius:3px; border-bottom-left-radius:3px;"></div>
                        <div style="width:${sr.bPct}%; background:${bStatCol}; transition:width 0.8s cubic-bezier(0.25, 1, 0.5, 1); border-top-right-radius:3px; border-bottom-right-radius:3px;"></div>
                    </div>
                </div>
            `;
        });

        statsContainer.innerHTML = statsHtml;
    }
    
    function renderTeamList(containerId, players, nameColor, teamKey) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = "";
        
        if (players.length === 0) {
            container.innerHTML = `<div class="miniGameOverSpecEmpty">Boş</div>`;
            return;
        }

        const tName = (teamKey === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
        const normName = tName.trim().toLowerCase();
        let resolvedNameColor = nameColor;
        if (["fenerbahçe", "fenerbahce", "fb"].includes(normName)) resolvedNameColor = "#ffed00";
        else if (["galatasaray", "gs"].includes(normName)) resolvedNameColor = "#fdb913";
        else if (["trabzonspor", "ts"].includes(normName)) resolvedNameColor = "#4ab3e8";
        else if (["beşiktaş", "besiktas", "bjk"].includes(normName)) resolvedNameColor = "#ffffff";
        
        const header = document.createElement("div");
        header.className = "miniGameOverHeader";
        header.innerHTML = `
            <div style="text-align:left; padding-left:4px;">İsim</div>
            <div title="Gol">Gol</div>
            <div title="Asist">Asist</div>
            <div title="Pas">Pas</div>
            <div title="Kurtarış">Kurtarış</div>
            <div title="Ping">Ping</div>
        `;
        container.appendChild(header);
        
        players.forEach((p, i) => {
            const st = stats[String(p.id)] || { goals: 0, assists: 0, passes: 0 };
            const isMe = p.id === miniData.playerId;
            const isMvp = p.id === mvpId;
            const crown = p.id === 1 ? " 👑" : "";
            const meMark = isMe ? ' <span style="color:#909090;font-size:10px;">(sen)</span>' : '';
            
            const ping = (miniData.pings && miniData.pings[p.id] !== undefined) ? miniData.pings[p.id] : null;
            let pingText = "-";
            let pingColor = "#909090";
            if (ping !== null) {
                pingText = `${ping}ms`;
                if (ping < 80) pingColor = "#51cf66";
                else if (ping < 200) pingColor = "#ffd43b";
                else pingColor = "#ff6b6b";
            }
            
            const rawName = p.name || "";
            let nameFontSize = 13.5;
            if (rawName.length > 10) {
                nameFontSize = Math.max(9, 13.5 - (rawName.length - 10) * 0.3);
            }
            
            const row = document.createElement("div");
            row.className = "miniGameOverRow";
            row.style.animationDelay = (0.7 + i * 0.1) + "s";
            
            if (isMvp) {
                row.style.setProperty("border", "2px solid #ffd43b", "important");
                row.style.setProperty("background", "linear-gradient(90deg, rgba(255, 212, 59, 0.18), rgba(255, 212, 59, 0.05))", "important");
                row.style.setProperty("box-shadow", "0 0 15px rgba(255, 212, 59, 0.35)", "important");
                row.style.setProperty("border-radius", "8px", "important");
            }
            
            row.innerHTML = `
                <span class="miniGameOverName" style="color:${isMvp ? '#ffd43b' : nameColor}; font-size:${nameFontSize}px; white-space:nowrap; overflow:hidden; text-overflow:clip; display:inline-block; line-height:1.2; padding-left:4px; ${isMe ? 'font-weight:800;' : ''}">
                    ${rawName}${crown}${meMark}
                </span>
                <span class="miniGameOverStat" style="${isMvp ? 'color:#ffd43b; font-weight:bold;' : ''}">${st.goals}</span>
                <span class="miniGameOverStat" style="${isMvp ? 'color:#ffd43b; font-weight:bold;' : ''}">${st.assists}</span>
                <span class="miniGameOverStat" style="${isMvp ? 'color:#ffd43b; font-weight:bold;' : ''}">${st.passes}</span>
                <span class="miniGameOverStat" style="${isMvp ? 'color:#ffd43b; font-weight:bold;' : ''}">${st.saves || 0}</span>
                <span class="miniGameOverStat" style="color:${pingColor}; font-family:monospace; font-size:12px;">${pingText}</span>
            `;
            container.appendChild(row);
        });
    }
    
    function renderSpecList(players) {
        const container = document.getElementById("miniGameOverSpecList");
        if (!container) return;
        container.innerHTML = "";
        
        if (players.length === 0) {
            container.innerHTML = `<div class="miniGameOverSpecEmpty">İzleyici yok</div>`;
            return;
        }
        
        players.forEach((p, i) => {
            const isMe = p.id === miniData.playerId;
            const crown = p.id === 1 ? " 👑" : "";
            const meMark = isMe ? ' <span style="color:#909090;font-size:10px;">(sen)</span>' : '';
            
            const ping = (miniData.pings && miniData.pings[p.id] !== undefined) ? miniData.pings[p.id] : null;
            let pingText = "-";
            let pingColor = "#909090";
            if (ping !== null) {
                pingText = `${ping}ms`;
                if (ping < 80) pingColor = "#51cf66";
                else if (ping < 200) pingColor = "#ffd43b";
                else pingColor = "#ff6b6b";
            }
            
            const row = document.createElement("div");
            row.className = "miniGameOverSpecRow";
            row.style.animationDelay = (0.7 + i * 0.1) + "s";
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.alignItems = "center";
            row.innerHTML = `
                <span style="color:${isMe ? '#fff' : '#c0c0c0'}; ${isMe?'font-weight:700;':''}">
                    ${p.name}${crown}${meMark}
                </span>
                <span style="color:${pingColor}; font-family:monospace; font-size:12px; font-weight:bold;">${pingText}</span>
            `;
            container.appendChild(row);
        });
    }
    
    if (redTitle) redTitle.style.color = dynRed;
    if (blueTitle) blueTitle.style.color = dynBlue;

    renderTeamList("miniGameOverRedList", redTeam, dynRed, "red");
    renderTeamList("miniGameOverBlueList", blueTeam, dynBlue, "blue");
    renderSpecList(spectators);
    
    const rematchBtn = document.getElementById("miniRematchBtn");
    if (rematchBtn) {
        if (miniData.playerId === 1) {
            rematchBtn.classList.remove("hidden");
        } else {
            rematchBtn.classList.add("hidden");
        }
    }
    
    miniReleaseAllKeys();
    startMiniGameOverCountdown();
}

let miniGameOverCountdownInterval = null;

function startMiniGameOverCountdown() {
    stopMiniGameOverCountdown();
    let seconds = 60;
    
    let countdownEl = document.getElementById("miniGameOverCountdown");
    if (!countdownEl) {
        const box = document.getElementById("miniGameOverBox");
        const card = box ? box.querySelector(".overlayCard") : null;
        if (card) {
            countdownEl = document.createElement("p");
            countdownEl.id = "miniGameOverCountdown";
            countdownEl.style.cssText = "margin-top:15px; color:#adb5bd; font-size:14px; text-align:center;";
            card.appendChild(countdownEl);
        }
    }
    
    function updateText() {
        if (!countdownEl) return;
        countdownEl.innerHTML = `⏳ <span style="color:#ffd43b; font-weight:bold;">${seconds}</span> saniye sonra otomatik lobiye dönülecek`;
    }
    updateText();
    
    miniGameOverCountdownInterval = setInterval(() => {
        seconds--;
        updateText();
        
        if (seconds <= 0) {
            stopMiniGameOverCountdown();
            const overBox = document.getElementById("miniGameOverBox");
            if (overBox && !overBox.classList.contains("hidden")) {
                console.log("[MINI] 30 sn doldu, otomatik lobiye dönülüyor...");
                overBox.classList.add("hidden");
                
                const menuBtn = document.getElementById("miniGameOverMenuBtn");
                const rematchBtn = document.getElementById("miniRematchBtn");
                if (menuBtn) {
                    menuBtn.disabled = false;
                    menuBtn.textContent = "🚪 Lobiye Dön";
                }
                if (rematchBtn) rematchBtn.disabled = false;
                
                if (miniData.playerId === 1) {
                    send({ type: "mini_return_to_lobby", auto: true });
                } else {
                    if (typeof stopMiniGame === "function") stopMiniGame();
                    showScreen("miniLobby");
                    updateMiniLobby();
                }
            }
        }
    }, 1000);
}

function stopMiniGameOverCountdown() {
    if (miniGameOverCountdownInterval) {
        clearInterval(miniGameOverCountdownInterval);
        miniGameOverCountdownInterval = null;
    }
    const countdownEl = document.getElementById("miniGameOverCountdown");
    if (countdownEl) countdownEl.remove();
}

// ✨ ESC Menü ve Popup Dönüş Yöneticileri
function showMiniGuestEscMenu() {
    const box = document.getElementById("miniGuestEscBox");
    if (box) box.classList.remove("hidden");
    if (typeof miniReleaseAllKeys === "function") miniReleaseAllKeys();
}

function hideMiniGuestEscMenu() {
    const box = document.getElementById("miniGuestEscBox");
    if (box) box.classList.add("hidden");
}

// ========================================
// ⌨️ ESC TUŞU DİNLEYİCİSİ (Oyun İçi Menü / Pause)
// ========================================
document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    
    // Chat açıksa önce chat'i kapat
    if (typeof miniChat !== "undefined" && miniChat.open) {
        e.preventDefault();
        e.stopPropagation();
        if (typeof closeMiniChatPanel === "function") closeMiniChatPanel();
        return;
    }
    
    // Sadece mini futbol oyun ekranında
    const gameScreen = document.getElementById("miniGameScreen");
    if (!gameScreen || gameScreen.classList.contains("hidden")) return;
    
    // Alt popup'lar öncelikli - açıklarsa sadece onlar kapansın
    const subPopups = [
        "roomSettingsBox",
        "miniControlSettings",
        "miniLobbyReturnConfirm",
        "miniRestartConfirm",
        "miniResetNamesConfirm",
        "miniTeamNameEditor",
        "miniNameEditor",
        "miniJerseyEditor",
        "kickConfirmBox",
        "escConfirmBox",
        "miniGuestLobbyConfirm"
    ];
    for (const id of subPopups) {
        const el = document.getElementById(id);
        if (el && !el.classList.contains("hidden")) {
            e.preventDefault();
            e.stopPropagation();
            el.classList.add("hidden");
            const dynamicPopups = [
                "miniLobbyReturnConfirm", "miniRestartConfirm", "miniResetNamesConfirm",
                "miniTeamNameEditor", "miniNameEditor", "miniJerseyEditor", "miniGuestLobbyConfirm",
                "miniKickConfirm", "miniControlSettings"
            ];
            if (dynamicPopups.includes(id)) {
                el.remove();
            }
            
            if (miniData.playerId !== 1) {
                setTimeout(() => showMiniGuestEscMenu(), 50);
            }
            return;
        }
    }
    
    // === HOST ===
    if (miniData.playerId === 1) {
        const box = document.getElementById("miniPauseLobbyBox");
        if (box && !box.classList.contains("hidden")) {
            e.preventDefault();
            e.stopPropagation();
            send({ type: "mini_resume" });
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        send({ type: "mini_pause" });
        return;
    }
    
    // === KULLANICI (Guest) ===
    e.preventDefault();
    e.stopPropagation();
    
    const guestBox = document.getElementById("miniGuestEscBox");
    if (guestBox && !guestBox.classList.contains("hidden")) {
        guestBox.classList.add("hidden");
        return;
    }
    
    const guestPausedBox = document.getElementById("miniGuestPausedBox");
    if (guestPausedBox && !guestPausedBox.classList.contains("hidden")) {
        guestPausedBox.classList.add("hidden");
        showMiniGuestEscMenu();
        return;
    }
    
    showMiniGuestEscMenu();
}, true);

function setupPopupReturnToPause(popupId) {
    if (miniData.playerId === 1) return;
    const el = document.getElementById(popupId);
    if (!el) return;
    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            if (m.attributeName === "class" && el.classList.contains("hidden")) {
                observer.disconnect();
                setTimeout(() => showMiniGuestEscMenu(), 50);
                return;
            }
        }
    });
    observer.observe(el, { attributes: true, attributeFilter: ["class"] });
    const removeObserver = new MutationObserver(() => {
        if (!document.body.contains(el)) {
            observer.disconnect();
            removeObserver.disconnect();
            setTimeout(() => showMiniGuestEscMenu(), 50);
        }
    });
    removeObserver.observe(document.body, { childList: true, subtree: false });
}

// ========================================
// 🔧 ROOM CREATION ADVANCED FIELDS
// ========================================
const MINI_ADVANCED_FIELDS = [
    { id: "kickPower",         label: "⚽ Şut Gücü",             current: 14,  min: 8,   max: 25,   step: 1 },
    { id: "sprintKickBonus",   label: "🔥 Sprint Şut Bonusu",   current: 30,  min: 0,   max: 100,  step: 5,  unit: "%" },
    { id: "plasePower",        label: "🌀 Plase Gücü Oranı",    current: 75,  min: 40,  max: 100,  step: 5,  unit: "%" },
    { id: "plaseSpin",         label: "🎯 Plase Kavis Şiddeti", current: 35,  min: 10,  max: 100,  step: 5 },
    { id: "afterTouchTime",    label: "⏱️ After-Touch Süresi", current: 200, min: 0,   max: 1000, step: 50, unit: "ms" },
    { id: "passAssistPower",   label: "🎯 Pas Yardım Gücü",     current: 50,  min: 0,   max: 100,  step: 5,  unit: "%" },
    { id: "ballMaxSpeed",      label: "💨 Top Max Hızı",         current: 18,  min: 10,  max: 35,   step: 1 },
    { id: "sprintMultiplier",  label: "🏃 Sprint Hız Çarpanı",  current: 150, min: 100, max: 250,  step: 10, unit: "%" },
    { id: "sprintDuration",    label: "⚡ Sprint Süresi",        current: 3,   min: 1,   max: 10,   step: 1,  unit: "sn" },
    { id: "ballStick",         label: "🧲 Top Kontrolü",         current: 85,  min: 0,   max: 100,  step: 5,  unit: "" }
];

function setupCreateMiniAdvancedFields() {
    const container = document.getElementById("createMiniAdvancedFields");
    if (!container) return;
    
    let savedAdv = {};
    try {
        const raw = localStorage.getItem("miniAdvancedSettings");
        if (raw) savedAdv = JSON.parse(raw);
    } catch(e) {}
    
    const gEl = document.getElementById("createAdvGoalTarget");
    const dEl = document.getElementById("createAdvMatchDuration");
    if (gEl && savedAdv._advGoalTarget !== undefined) {
        gEl.value = savedAdv._advGoalTarget;
    }
    if (dEl && savedAdv._advMatchDurationMin !== undefined) {
        dEl.value = savedAdv._advMatchDurationMin;
    }
    
    let html = "";
    MINI_ADVANCED_FIELDS.forEach(field => {
        const val = (savedAdv[field.id] !== undefined) ? savedAdv[field.id] : field.current;
        
        html += `<div style="margin-bottom:14px;">
            <label style="display:flex; justify-content:space-between; align-items:center; color:#c084fc; font-weight:bold; margin-bottom:6px; font-size:13px;">
                <span>${field.label}</span>
                <span id="createAdvVal_${field.id}" style="color:#ffd43b; font-family:monospace; background:rgba(0,0,0,0.3); padding:2px 8px; border-radius:5px; font-size:12px;">
                    ${val}${field.unit || ""}
                </span>
            </label>
            <input type="range" id="createAdvField_${field.id}" min="${field.min}" max="${field.max}" step="${field.step || 1}" value="${val}" style="width:100%; height:5px; cursor:pointer; accent-color:#c084fc;">
        </div>`;
    });
    container.innerHTML = html;
    
    MINI_ADVANCED_FIELDS.forEach(field => {
        const slider = document.getElementById("createAdvField_" + field.id);
        const valSpan = document.getElementById("createAdvVal_" + field.id);
        if (slider && valSpan) {
            slider.addEventListener("input", () => {
                valSpan.textContent = slider.value + (field.unit || "");
            });
        }
    });
    
    const toggle = document.getElementById("createMiniAdvancedToggle");
    const content = document.getElementById("createMiniAdvancedContent");
    const speedSelect = document.getElementById("miniSpeedSelect");
    
    if (toggle && content) {
        const disableList = ["miniSpeedSelect", "miniAllowPlaseSelect", "miniGoalTargetSelect", "miniDurationSelect", "miniBallStickSelect", "miniPassAssistanceSelect"];
        
        function setFieldsDisabled(disabled) {
            disableList.forEach(id => {
                const el = document.getElementById(id);
                if (!el) return;
                el.disabled = disabled;
                if (el.parentElement) {
                    el.parentElement.style.opacity = disabled ? "0.4" : "1";
                    el.parentElement.style.pointerEvents = disabled ? "none" : "auto";
                }
            });
        }
        
        toggle.addEventListener("change", () => {
            try {
                localStorage.setItem("miniAdvancedEnabled", toggle.checked ? "true" : "false");
            } catch(e) {}
            
            if (toggle.checked) {
                content.style.maxHeight = content.scrollHeight + "px";
                setTimeout(() => { if (toggle.checked) content.style.maxHeight = "3000px"; }, 400);
                setFieldsDisabled(true);
            } else {
                content.style.maxHeight = content.scrollHeight + "px";
                setTimeout(() => { content.style.maxHeight = "0"; }, 10);
                setFieldsDisabled(false);
            }
        });
        
        try {
            const savedEnabled = localStorage.getItem("miniAdvancedEnabled") === "true";
            if (savedEnabled) {
                toggle.checked = true;
                setTimeout(() => {
                    content.style.maxHeight = "5000px";
                    setFieldsDisabled(true);
                }, 100);
            } else {
                toggle.checked = false;
                content.style.maxHeight = "0";
                setFieldsDisabled(false);
            }
        } catch(e) {}
    }
    
    const resetBtn = document.getElementById("createMiniAdvResetBtn");
    if (resetBtn) {
        resetBtn.onclick = () => {
            MINI_ADVANCED_FIELDS.forEach(field => {
                const slider = document.getElementById("createAdvField_" + field.id);
                const valSpan = document.getElementById("createAdvVal_" + field.id);
                if (slider) slider.value = field.current;
                if (valSpan) valSpan.textContent = field.current + (field.unit || "");
            });
        };
    }
    
    const exportBtn = document.getElementById("createMiniAdvExportBtn");
    const importBtn = document.getElementById("createMiniAdvImportBtn");
    if (exportBtn) exportBtn.onclick = () => alert("Dışa Aktar - Yakında Güncellenecek");
    if (importBtn) importBtn.onclick = () => alert("Yükle - Yakında Güncellenecek");
}

// ========================================
// 🔘 UI BUTTON BINDINGS & LISTENERS
// ========================================
setTimeout(() => {
    const miniCard = document.querySelector('.mod-card[data-mod="mini_futbol"]');
    if (miniCard) {
        miniCard.addEventListener("click", () => {
            const nameInputR = document.getElementById("createMiniNameInput");
            if (nameInputR) {
                const nameBox = nameInputR.closest(".centerBox");
                if (nameBox) nameBox.style.display = "";
            }
            const createBtnEl = document.getElementById("createMiniBtn");
            if (createBtnEl) createBtnEl.textContent = "🎮 Oda Oluştur";
            window._pendingModeChangeCtx = null;

            showScreen("createMini");
            const nameInput = document.getElementById("createMiniNameInput");
            if (nameInput) {
                const savedName = localStorage.getItem("playerName");
                if (savedName) nameInput.value = savedName;
                nameInput.focus();
            }
            setupCreateMiniAdvancedFields();
        });
    }
    
    setupCreateMiniAdvancedFields();
    
    const createBtn = document.getElementById("createMiniBtn");
    if (createBtn) {
        function loadSavedCreateSettings() {
            try {
                const goalEl = document.getElementById("miniGoalTargetSelect");
                const durEl = document.getElementById("miniDurationSelect");
                const speedEl = document.getElementById("miniSpeedSelect");
                const plaseEl = document.getElementById("miniAllowPlaseSelect");
                const stickEl = document.getElementById("miniBallStickSelect");
                const sprintEnEl = document.getElementById("miniSprintEnabledSelect");
                const passAssistEl = document.getElementById("miniPassAssistanceSelect");
                const musicModeEl = document.getElementById("miniGoalMusicModeSelect");
                const pcEl = document.getElementById("miniPlayerCountSelect");
                
                const savedGoal = localStorage.getItem("miniCreateGoal");
                const savedDur = localStorage.getItem("miniCreateDuration");
                const savedSpeed = localStorage.getItem("miniCreateSpeed");
                const savedPlase = localStorage.getItem("miniAllowPlase");
                const savedStick = localStorage.getItem("miniBallStick");
                const savedSprintEn = localStorage.getItem("miniSprintEnabled");
                const savedPassAssist = localStorage.getItem("miniPassAssistance");
                const savedMusicMode = localStorage.getItem("miniGoalMusicMode");
                const savedPc = localStorage.getItem("miniPlayerCount");
                const savedSpec = localStorage.getItem("miniSpectatorCount");
                const savedKt = localStorage.getItem("miniKickoffTimeout");
                
                if (savedGoal && goalEl) {
                    const opt = [...goalEl.options].find(o => o.value === savedGoal);
                    if (opt) goalEl.value = savedGoal;
                }
                if (savedDur && durEl) {
                    const opt = [...durEl.options].find(o => o.value === savedDur);
                    if (opt) durEl.value = savedDur;
                }
                if (savedSpeed && speedEl) {
                    const opt = [...speedEl.options].find(o => o.value === savedSpeed);
                    if (opt) speedEl.value = savedSpeed;
                }
                if (savedPlase && plaseEl) plaseEl.value = savedPlase;
                if (savedStick && stickEl) stickEl.value = savedStick;
                if (savedSprintEn && sprintEnEl) sprintEnEl.value = savedSprintEn;
                if (savedPassAssist && passAssistEl) passAssistEl.value = savedPassAssist;
                if (savedMusicMode && musicModeEl) musicModeEl.value = savedMusicMode;
                
                if (savedPc && pcEl) {
                    const opt = [...pcEl.options].find(o => o.value === savedPc);
                    if (opt) pcEl.value = savedPc;
                }
                if (savedSpec) {
                    const specEl = document.getElementById("miniSpectatorCountSelect");
                    if (specEl) {
                        const opt = [...specEl.options].find(o => o.value === savedSpec);
                        if (opt) specEl.value = savedSpec;
                    }
                }
                if (savedKt) {
                    const ktEl = document.getElementById("miniKickoffTimeoutSelect");
                    if (ktEl) {
                        const opt = [...ktEl.options].find(o => o.value === savedKt);
                        if (opt) ktEl.value = savedKt;
                    }
                }
            } catch(e) {}
        }
        loadSavedCreateSettings();
        
        const miniCardBtn = document.querySelector('.mod-card[data-mod="mini_futbol"]');
        if (miniCardBtn) {
            miniCardBtn.addEventListener("click", () => {
                setTimeout(loadSavedCreateSettings, 50);
            });
        }
        
        createBtn.onclick = async () => {
            const nameInputEl = document.getElementById("createMiniNameInput");
            const name = nameInputEl ? nameInputEl.value.trim() : "";
            
            const _pendingModeChangeEarly = window._pendingModeChangeCtx;
            const _isModeChange = _pendingModeChangeEarly && 
                                  _pendingModeChangeEarly.newMode === "mini_futbol" && 
                                  _pendingModeChangeEarly.createScreen === "createMini";
            
            if (!_isModeChange) {
                if (!name) {
                    const msg = document.getElementById("createMiniMsg");
                    msg.textContent = "İsim gir.";
                    msg.style.color = "#ff6b6b";
                    return;
                }
                
                if (isSeljukName(name) && !isSeljukVerified()) {
                    const ok = await showSeljukPasswordPopup();
                    if (!ok) {
                        nameInputEl.value = "";
                        return;
                    }
                }
                localStorage.setItem("playerName", name);
            }
            
            const advToggle = document.getElementById("createMiniAdvancedToggle");
            const advancedEnabled = advToggle ? advToggle.checked : false;
            
            let goalTarget, matchDuration;
            if (advancedEnabled) {
                const gEl = document.getElementById("createAdvGoalTarget");
                const dEl = document.getElementById("createAdvMatchDuration");
                goalTarget = gEl ? parseInt(gEl.value) : 3;
                let matchDurationMin = dEl ? parseInt(dEl.value) : 3;
                if (!goalTarget || goalTarget <= 0) goalTarget = 999;
                if (!matchDurationMin || matchDurationMin <= 0) matchDurationMin = 9999;
                if (goalTarget > 9999) goalTarget = 9999;
                if (matchDurationMin > 9999) matchDurationMin = 9999;
                matchDuration = (matchDurationMin >= 9999) ? 99999 : matchDurationMin * 60;
            } else {
                goalTarget = parseInt(document.getElementById("miniGoalTargetSelect").value);
                matchDuration = parseInt(document.getElementById("miniDurationSelect").value);
            }
            
            const gameSpeed = document.getElementById("miniSpeedSelect").value;
            const splitScreen = false;
            const allowPlaseValEl = document.getElementById("miniAllowPlaseSelect");
            const allowPlase = allowPlaseValEl ? allowPlaseValEl.value !== "off" : true;
            
            const ballStickValEl = document.getElementById("miniBallStickSelect");
            const ballStick = ballStickValEl ? ballStickValEl.value !== "off" : true;
            
            const sprintEnabledEl = document.getElementById("miniSprintEnabledSelect");
            const sprintEnabled = sprintEnabledEl ? sprintEnabledEl.value !== "off" : true;
            
            const passAssistanceValEl = document.getElementById("miniPassAssistanceSelect");
            const passAssistance = passAssistanceValEl ? passAssistanceValEl.value !== "off" : true;
            
            const playerCountEl = document.getElementById("miniPlayerCountSelect");
            const playerCount = playerCountEl ? parseInt(playerCountEl.value) : 2;
            
            const specCountEl = document.getElementById("miniSpectatorCountSelect");
            const spectatorCount = specCountEl ? parseInt(specCountEl.value) : 0;
            
            let advancedValues = null;
            if (advancedEnabled) {
                advancedValues = {};
                MINI_ADVANCED_FIELDS.forEach(field => {
                    const slider = document.getElementById("createAdvField_" + field.id);
                    if (slider) advancedValues[field.id] = parseFloat(slider.value);
                });
                const gEl = document.getElementById("createAdvGoalTarget");
                const dEl = document.getElementById("createAdvMatchDuration");
                if (gEl) advancedValues._advGoalTarget = parseInt(gEl.value) || 3;
                if (dEl) advancedValues._advMatchDurationMin = parseInt(dEl.value) || 3;
                
                try {
                    localStorage.setItem("miniAdvancedSettings", JSON.stringify(advancedValues));
                    localStorage.setItem("miniAdvancedEnabled", "true");
                } catch(e) {}
            } else {
                localStorage.setItem("miniAdvancedEnabled", "false");
            }
            
            try {
                localStorage.setItem("miniAllowPlase", allowPlase ? "on" : "off");
                localStorage.setItem("miniBallStick", ballStick ? "on" : "off");
                localStorage.setItem("miniPassAssistance", passAssistance ? "on" : "off");
                localStorage.setItem("miniSprintEnabled", sprintEnabled ? "on" : "off");
                if (!advancedEnabled) {
                    localStorage.setItem("miniCreateGoal", String(goalTarget));
                    localStorage.setItem("miniCreateDuration", String(matchDuration));
                }
                localStorage.setItem("miniCreateSpeed", gameSpeed);
                localStorage.setItem("miniCreateSplit", splitScreen ? "on" : "off");
            } catch(e) {}
            
            let savedRedName = "Kırmızı Takım", savedBlueName = "Mavi Takım";
            let savedRedColor = "#ff6b6b", savedBlueColor = "#4dabf7";
            let savedRedSprint = "#ffd43b", savedBlueSprint = "#ffd43b";
            try {
                const r = localStorage.getItem("miniRedTeamName");
                const b = localStorage.getItem("miniBlueTeamName");
                const rc = localStorage.getItem("miniRedTeamColor");
                const bc = localStorage.getItem("miniBlueTeamColor");
                const rs = localStorage.getItem("miniRedSprintColor");
                const bs = localStorage.getItem("miniBlueSprintColor");
                if (r) savedRedName = r; if (b) savedBlueName = b;
                if (rc) savedRedColor = rc; if (bc) savedBlueColor = bc;
                if (rs) savedRedSprint = rs; if (bs) savedBlueSprint = bs;
            } catch(e) {}
            
            let savedKickoffTimeout = 10;
            const kickoffEl = document.getElementById("miniKickoffTimeoutSelect");
            if (kickoffEl) {
                const val = parseInt(kickoffEl.value);
                if ([5, 10, 15, 20, 30, 60, 999].includes(val)) savedKickoffTimeout = val;
            } else {
                try {
                    const kt = parseInt(localStorage.getItem("miniKickoffTimeout"));
                    if (!isNaN(kt) && [5, 10, 15, 20, 30, 60, 999].includes(kt)) savedKickoffTimeout = kt;
                } catch(e) {}
            }
            try { localStorage.setItem("miniKickoffTimeout", String(savedKickoffTimeout)); } catch(e) {}
            
            const goalMusicModeEl = document.getElementById("miniGoalMusicModeSelect");
            const goalMusicMode = goalMusicModeEl ? goalMusicModeEl.value : "team";
            try { localStorage.setItem("miniGoalMusicMode", goalMusicMode); } catch(e) {}
            
            const payload = {
                type: "mini_create_room",
                name: name,
                goal_target: goalTarget,
                match_duration: matchDuration,
                game_speed: gameSpeed,
                split_screen: splitScreen,
                allow_plase: allowPlase,
                ball_stick: ballStick,
                sprint_enabled: sprintEnabled,
                pass_assistance: passAssistance,
                goal_music_mode: goalMusicMode,
                player_count: playerCount,
                spectator_count: spectatorCount,
                kickoff_timeout: savedKickoffTimeout,
                red_team_name: savedRedName,
                blue_team_name: savedBlueName,
                red_team_color: savedRedColor,
                blue_team_color: savedBlueColor,
                red_sprint_color: savedRedSprint,
                blue_sprint_color: savedBlueSprint,
                advanced_enabled: advancedEnabled
            };
            if (advancedValues) payload.advanced = advancedValues;
            
            try { 
                localStorage.setItem("miniPlayerCount", String(playerCount));
                localStorage.setItem("miniSpectatorCount", String(spectatorCount));
            } catch(e) {}

            const pendingModeChange = window._pendingModeChangeCtx;
            if (pendingModeChange && pendingModeChange.newMode === "mini_futbol" && pendingModeChange.createScreen === "createMini") {
                console.log("[MODE CHANGE] Mini Futbol için mod_change_room gönderiliyor");
                const msgEl = document.getElementById("createMiniMsg");
                if (msgEl) {
                    msgEl.textContent = "Mod değiştiriliyor...";
                    msgEl.style.color = "#51cf66";
                }
                send({
                    type: "mod_change_room",
                    new_mode: "mini_futbol",
                    mode_settings: {
                        goal_target: goalTarget,
                        match_duration: matchDuration,
                        game_speed: gameSpeed,
                        split_screen: splitScreen,
                        allow_plase: allowPlase,
                        ball_stick: ballStick,
                        sprint_enabled: sprintEnabled,
                        player_count: playerCount,
                        spectator_count: spectatorCount,
                        kickoff_timeout: savedKickoffTimeout,
                        red_team_name: savedRedName,
                        blue_team_name: savedBlueName,
                        red_team_color: savedRedColor,
                        blue_team_color: savedBlueColor,
                        red_sprint_color: savedRedSprint,
                        blue_sprint_color: savedBlueSprint
                    }
                });
                return;
            }
            
            send(payload);
        };
    }
    
    const backBtn = document.getElementById("createMiniBackBtn");
    if (backBtn) backBtn.onclick = () => {
        const pendingModeChange = window._pendingModeChangeCtx;
        if (pendingModeChange && pendingModeChange.newMode === "mini_futbol" && pendingModeChange.createScreen === "createMini") {
            const returnScreen = pendingModeChange.returnScreen || "miniLobby";
            window._pendingModeChangeCtx = null;
            const msgEl = document.getElementById("createMiniMsg");
            if (msgEl) msgEl.textContent = "";

            showScreen(returnScreen);

            setTimeout(() => {
                if (typeof openChangeModeModal === "function") openChangeModeModal();
            }, 200);
            return;
        }
        showScreen("modselect");
    };
    
    const leaveBtn = document.getElementById("miniLobbyLeaveBtn");
    if (leaveBtn) leaveBtn.onclick = () => window._showLeaveConfirmPopup();
    
    const startBtn = document.getElementById("miniStartBtn");
    if (startBtn) {
        startBtn.addEventListener("click", () => {
            send({ type: "mini_start_game" });
        });
    }
    
    const rejoinBtn = document.getElementById("miniRejoinGameBtn");
    if (rejoinBtn) {
        rejoinBtn.addEventListener("click", () => {
            send({ type: "mini_guest_rejoin_game" });
            showScreen("miniGame");
            if (typeof startMiniGame === "function") startMiniGame();
        });
    }
    
    const settingsBtn = document.getElementById("miniRoomSettingsBtn");
    if (settingsBtn) {
        settingsBtn.addEventListener("click", () => openMiniRoomSettings());
    }
    
    const _miniChangeModeBtn = document.getElementById("miniChangeModeBtn");
    if (_miniChangeModeBtn) {
        _miniChangeModeBtn.addEventListener("click", () => {
            if (typeof openChangeModeModal === "function") openChangeModeModal();
        });
    }
    
    const ctrlBtn = document.getElementById("miniControlSettingsBtn");
    if (ctrlBtn) ctrlBtn.addEventListener("click", () => showMiniControlSettings());
    
    const pauseCtrlBtn = document.getElementById("miniPauseControlBtn");
    if (pauseCtrlBtn) {
        pauseCtrlBtn.addEventListener("click", () => showMiniControlSettings());
    }
    
    const chatToggle = document.getElementById("miniChatToggleBtn");
    if (chatToggle) chatToggle.addEventListener("click", toggleMiniChatPanel);

    const chatClose = document.getElementById("miniChatCloseBtn");
    if (chatClose) chatClose.addEventListener("click", closeMiniChatPanel);

    const chatSend = document.getElementById("miniChatSendBtn");
    if (chatSend) chatSend.addEventListener("click", sendMiniChatMessage);

    const chatInput = document.getElementById("miniChatInput");
    if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                sendMiniChatMessage();
                closeMiniChatPanel();
                return;
            }
            e.stopPropagation();
        });
    }

    const nameInput = document.getElementById("createMiniNameInput");
    if (nameInput) {
        nameInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") document.getElementById("createMiniBtn").click();
        });
    }
    
    const gameBackBtn = document.getElementById("miniBackBtn");
    if (gameBackBtn) gameBackBtn.onclick = () => showEscPopup();
    
    const editRedBtn = document.getElementById("miniEditRedBtn");
    if (editRedBtn) editRedBtn.onclick = () => editTeamName("red");
    
    const editBlueBtn = document.getElementById("miniEditBlueBtn");
    if (editBlueBtn) editBlueBtn.onclick = () => editTeamName("blue");
    
    const resetNamesBtn = document.getElementById("miniResetNamesBtn");
    if (resetNamesBtn) resetNamesBtn.onclick = () => resetTeamNames();
    
    const rematchBtn = document.getElementById("miniRematchBtn");
    if (rematchBtn) {
        rematchBtn.onclick = () => {
            stopMiniGameOverCountdown();
            document.getElementById("miniGameOverBox").classList.add("hidden");
            send({ type: "mini_start_game" });
        };
    }
    
    const menuBtn = document.getElementById("miniGameOverMenuBtn");
    if (menuBtn) {
        menuBtn.onclick = () => {
            stopMiniGameOverCountdown();
            if (miniData.playerId === 1) {
                send({ type: "mini_return_to_lobby" });
                menuBtn.disabled = true;
                menuBtn.textContent = "⌛ Dönülüyor...";
            } else {
                send({ type: "mini_return_to_lobby" });
                const overBox = document.getElementById("miniGameOverBox");
                if (overBox) overBox.classList.add("hidden");
                if (typeof stopMiniGame === "function") stopMiniGame();
                showScreen("miniLobby");
                updateMiniLobby();
                menuBtn.disabled = false;
                menuBtn.textContent = "🚪 Lobiye Dön";
            }
        };
    }
    
    const resumeBtn = document.getElementById("miniPauseResumeBtn");
    if (resumeBtn) {
        resumeBtn.onclick = () => {
            send({ type: "mini_resume" });
        };
    }
    
    const pauseSettingsBtn = document.getElementById("miniPauseSettingsBtn");
    if (pauseSettingsBtn) {
        pauseSettingsBtn.onclick = () => openMiniRoomSettings();
    }
    
    const pauseRestartBtn = document.getElementById("miniPauseRestartBtn");
    if (pauseRestartBtn) {
        pauseRestartBtn.onclick = () => {
            if (miniData.playerId !== 1) return;
            showMiniRestartConfirm();
        };
    }
    
    const pauseEditRedBtn = document.getElementById("miniPauseEditRedBtn");
    if (pauseEditRedBtn) pauseEditRedBtn.onclick = () => editTeamName("red");
    
    const pauseEditBlueBtn = document.getElementById("miniPauseEditBlueBtn");
    if (pauseEditBlueBtn) pauseEditBlueBtn.onclick = () => editTeamName("blue");
    
    const pauseLeaveBtn = document.getElementById("miniPauseLeaveBtn");
    if (pauseLeaveBtn) {
        pauseLeaveBtn.onclick = () => {
            if (miniData.playerId !== 1) return;
            showMiniLobbyReturnConfirm();
        };
    }
    
    const guestLeaveBtn = document.getElementById("miniPauseGuestLeaveBtn");
    if (guestLeaveBtn) {
        guestLeaveBtn.onclick = () => {
            hideMiniPauseLobby();
            showEscPopup();
        };
    }
    
    const guestLobby = document.getElementById("miniGuestEscLobbyBtn");
    if (guestLobby) {
        guestLobby.onclick = () => {
            hideMiniGuestEscMenu();
            showMiniGuestLobbyConfirm();
        };
    }
    
    const guestSettings = document.getElementById("miniGuestEscSettingsBtn");
    if (guestSettings) {
        guestSettings.onclick = () => {
            hideMiniGuestEscMenu();
            showMiniControlSettings();
            setupPopupReturnToPause("miniControlSettings");
        };
    }
    
    const guestRoomSet = document.getElementById("miniGuestEscRoomSettingsBtn");
    if (guestRoomSet) {
        guestRoomSet.onclick = () => {
            hideMiniGuestEscMenu();
            openMiniRoomSettings();
            setupPopupReturnToPause("roomSettingsBox");
        };
    }
    
    const guestHome = document.getElementById("miniGuestEscHomeBtn");
    if (guestHome) {
        guestHome.onclick = () => {
            hideMiniGuestEscMenu();
            showEscPopup();
            setupPopupReturnToPause("escConfirmBox");
        };
    }
    
    const guestResume = document.getElementById("miniGuestEscResumeBtn");
    if (guestResume) {
        guestResume.onclick = () => {
            hideMiniGuestEscMenu();
        };
    }
}, 100);

// ========================================
// 🔄 ANLIK SENKRONİZASYON MOTORU (İsim & Forma)
// ========================================
function handleMiniNameChanged(msg) {
    const pid = msg.player_id;
    const newName = msg.new_name;

    // Local veriyi güncelle
    if (miniData.playerNames) {
        miniData.playerNames[String(pid)] = newName;
    }
    const pObj = miniData.players.find(pl => pl.id === pid);
    if (pObj) {
        pObj.name = newName;
    }

    // Host Physics çalışıyorsa orada da güncelle
    if (typeof HP !== 'undefined' && HP.running && HP.room) {
        if (HP.room.players && HP.room.players[pid]) {
            HP.room.players[pid].name = newName;
        }
    }

    // Arayüzleri yenile
    updateMiniLobby();
    const pauseBox = document.getElementById("miniPauseLobbyBox");
    if (pauseBox && !pauseBox.classList.contains("hidden")) {
        updateMiniPauseLobby();
    }

    // Toast göster
    if (typeof showToast === "function") {
        showToast("✏️ İsim Değişti", msg.message, null, "info");
    }
}

function handleMiniJerseyChanged(msg) {
    const pid = parseInt(msg.player_id, 10);
    const num = parseInt(msg.jersey_number, 10);

    // Local veriyi güncelle
    const pObj = miniData.players.find(pl => parseInt(pl.id, 10) === pid);
    if (pObj) {
        pObj.jersey_number = num;
    }

    if (!miniData.persistentJerseys) miniData.persistentJerseys = {};
    miniData.persistentJerseys[String(pid)] = num;
    try {
        localStorage.setItem("miniPersistentJerseys", JSON.stringify(miniData.persistentJerseys));
    } catch(e) {}

    // Host Physics çalışıyorsa orada da güncelle
    if (typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players) {
        const hpPlayer = HP.room.gameState.players[pid] || HP.room.gameState.players[String(pid)];
        if (hpPlayer) {
            hpPlayer.jersey_number = num;
        }
        if (typeof HP.tick === "function") HP.tick();
    }

    // Arayüzleri yenile
    updateMiniLobby();
    const pauseBox = document.getElementById("miniPauseLobbyBox");
    if (pauseBox && !pauseBox.classList.contains("hidden")) {
        updateMiniPauseLobby();
    }

    // Toast göster
    if (typeof showToast === "function") {
        showToast("👕 Forma Numarası", msg.message, null, "success");
    }
}

// 🌐 Global WebSocket Mesaj Yakalayıcı (Bozulmaz Monkey Patching)
(function() {
    function processMiniMsgData(data) {
        try {
            const msg = typeof data === "string" ? JSON.parse(data) : data;
            if (msg && msg.type === "mini_name_changed") {
                handleMiniNameChanged(msg);
            } else if (msg && msg.type === "mini_jersey_changed") {
                handleMiniJerseyChanged(msg);
            }
        } catch (e) {}
    }

    const originalAddEventListener = window.WebSocket.prototype.addEventListener;
    window.WebSocket.prototype.addEventListener = function(type, listener, options) {
        if (type === "message") {
            const wrappedListener = function(event) {
                processMiniMsgData(event.data);
                return listener.apply(this, arguments);
            };
            return originalAddEventListener.call(this, type, wrappedListener, options);
        }
        return originalAddEventListener.apply(this, arguments);
    };

    const originalDescriptor = Object.getOwnPropertyDescriptor(window.WebSocket.prototype, "onmessage");
    if (originalDescriptor && originalDescriptor.set) {
        Object.defineProperty(window.WebSocket.prototype, "onmessage", {
            set: function(listener) {
                const wrappedListener = function(event) {
                    processMiniMsgData(event.data);
                    if (listener) return listener.apply(this, arguments);
                };
                originalDescriptor.set.call(this, wrappedListener);
            },
            get: originalDescriptor.get,
            configurable: true
        });
    }

    // 🚀 Periyodik olarak mevcut aktif ws nesnesini kontrol et ve zırhla
    setInterval(() => {
        const activeWs = window.ws || (typeof ws !== "undefined" ? ws : null);
        if (activeWs && !activeWs._miniMsgHooked) {
            activeWs._miniMsgHooked = true;
            activeWs.addEventListener("message", function(event) {
                processMiniMsgData(event.data);
            });
        }
    }, 500);
})();

console.log("Mini Futbol UI motoru yüklendi ✓ (Tamamlandı)");		
						