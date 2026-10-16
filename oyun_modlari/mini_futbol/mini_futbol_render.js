// ==========================================================================
// 🎨 MİNİ FUTBOL - CANVAS RENDER VE GÖRSEL EFEKTLER MOTORU (60 FPS)
// ==========================================================================

// 🛠️ YARDIMCI RENK FONKSİYONLARI (Fallback Koruması)
function hexToRgbParts(hex) {
    if (!hex) return { r: 255, g: 255, b: 255 };
    let c = hex.replace("#", "");
    if (c.length === 3) c = c.split("").map(x => x + x).join("");
    const num = parseInt(c, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function hexToRgba(hex, alpha) {
    const rgb = hexToRgbParts(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function shadeHexColor(color, percent) {
    const rgb = hexToRgbParts(color);
    const t = percent < 0 ? 0 : 255;
    const p = percent < 0 ? percent * -1 : percent;
    const R = Math.round((t - rgb.r) * p) + rgb.r;
    const G = Math.round((t - rgb.g) * p) + rgb.g;
    const B = Math.round((t - rgb.b) * p) + rgb.b;
    return `#${(0x1000000 + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

// 🎆 BALON PATLAMA & YIRTILAN LASTİK PARTİKÜL SİSTEMİ
function triggerPlayerExplosion(x, y, teamColor) {
    if (!miniData.celebrationParticles) miniData.celebrationParticles = [];
    
    const colors = [teamColor, "#ffffff", shadeHexColor(teamColor, 0.3), shadeHexColor(teamColor, -0.3)];
    const particleCount = 55;
    
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 15;
        miniData.celebrationParticles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 5 + Math.random() * 10,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1.0,
            decay: 0.018 + Math.random() * 0.02,
            rot: Math.random() * Math.PI * 2,
            rotSpeed: (Math.random() - 0.5) * 0.4,
            type: "rubber_shard"
        });
    }
    
    miniData.celebrationParticles.push({
        x: x,
        y: y,
        radius: 10,
        maxRadius: 110,
        color: teamColor,
        alpha: 1.0,
        decay: 0.04,
        type: "ring"
    });
    
    MiniAudio.play("explosion.mp3", 0.9);
    MiniVibration.firekick();
}

function updateAndDrawCelebrationParticles(ctx) {
    if (!miniData.celebrationParticles || miniData.celebrationParticles.length === 0) return;
    
    ctx.save();
    for (let i = miniData.celebrationParticles.length - 1; i >= 0; i--) {
        const pt = miniData.celebrationParticles[i];
        
        if (pt.type === "ring") {
            pt.radius += 5;
            pt.alpha -= pt.decay;
            if (pt.alpha <= 0 || pt.radius >= pt.maxRadius) {
                miniData.celebrationParticles.splice(i, 1);
                continue;
            }
            ctx.strokeStyle = pt.color;
            ctx.globalAlpha = Math.max(0, pt.alpha);
            ctx.lineWidth = 4;
            ctx.shadowBlur = 15;
            ctx.shadowColor = pt.color;
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            pt.x += pt.vx;
            pt.y += pt.vy;
            pt.vx *= 0.94;
            pt.vy *= 0.94;
            pt.alpha -= pt.decay;
            pt.size *= 0.96;
            
            if (pt.alpha <= 0 || pt.size <= 0.5) {
                miniData.celebrationParticles.splice(i, 1);
                continue;
            }
            
            ctx.save();
            ctx.translate(pt.x, pt.y);
            if (pt.type === "rubber_shard") {
                pt.rot += pt.rotSpeed;
                ctx.rotate(pt.rot);
                ctx.fillStyle = pt.color;
                ctx.globalAlpha = Math.max(0, pt.alpha);
                ctx.shadowBlur = 8;
                ctx.shadowColor = pt.color;
                ctx.beginPath();
                ctx.ellipse(0, 0, pt.size, pt.size * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = pt.color;
                ctx.globalAlpha = Math.max(0, pt.alpha);
                ctx.shadowBlur = 10;
                ctx.shadowColor = pt.color;
                ctx.beginPath();
                ctx.arc(0, 0, pt.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }
    ctx.restore();
}

// ========================================
// 🇹🇷 HAZIR FORMA ÇİZİM GRUPLARI
// ========================================

function drawTurkishStar(ctx, cx, cy, radius, glowIntensity) {
    const flagH = radius * 2;
    ctx.save();
    ctx.translate(cx, cy);
    if (glowIntensity > 0.01) {
        ctx.shadowBlur = 25 * glowIntensity;
        ctx.shadowColor = "#e30a17";
    }
    ctx.fillStyle = "#ffffff";
    const moonOuterR = flagH * 0.25;
    const moonInnerR = moonOuterR * 0.8;
    const moonCenterX = -radius * 0.15;
    const moonCutOffset = moonOuterR * 0.25;
    
    ctx.beginPath();
    ctx.arc(moonCenterX, 0, moonOuterR, 0, Math.PI * 2);
    ctx.arc(moonCenterX + moonCutOffset, 0, moonInnerR, 0, Math.PI * 2, true);
    ctx.fill();
    
    const starOuterR = flagH * 0.15;
    const starInnerR = starOuterR * 0.38;
    const starX = moonCenterX + moonOuterR * 1.1;
    const starY = 0;
    
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const isOuter = (i % 2 === 0);
        const r = isOuter ? starOuterR : starInnerR;
        const angle = -Math.PI / 2 + (i * Math.PI / 5);
        const x = starX + Math.cos(angle) * r;
        const y = starY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawAzerbaijanFlag(ctx, cx, cy, radius, glowIntensity) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    
    const midH = radius * 0.36; 
    ctx.fillStyle = "#00b5e2"; 
    ctx.fillRect(-radius, -radius, radius * 2, radius - midH + 1);
    ctx.fillStyle = "#e32118";
    ctx.fillRect(-radius, -midH, radius * 2, midH * 2);
    ctx.fillStyle = "#38a047";
    ctx.fillRect(-radius, midH - 1, radius * 2, radius - midH + 1);
    
    if (glowIntensity > 0.01) {
        ctx.shadowBlur = 20 * glowIntensity;
        ctx.shadowColor = "#ffffff";
    }
    ctx.fillStyle = "#ffffff";
    const moonOuterR = radius * 0.26;
    const moonInnerR = moonOuterR * 0.8;
    const moonCenterX = -radius * 0.12;
    const moonCutOffset = moonOuterR * 0.25;
    
    ctx.beginPath();
    ctx.arc(moonCenterX, 0, moonOuterR, 0, Math.PI * 2);
    ctx.arc(moonCenterX + moonCutOffset, 0, moonInnerR, 0, Math.PI * 2, true);
    ctx.fill();
    
    const starOuterR = radius * 0.16;
    const starInnerR = starOuterR * 0.45;
    const starX = moonCenterX + moonOuterR * 1.15;
    const starY = 0;
    
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
        const isOuter = (i % 2 === 0);
        const r = isOuter ? starOuterR : starInnerR;
        const angle = (i * Math.PI / 8);
        const x = starX + Math.cos(angle) * r;
        const y = starY + Math.sin(angle) * r;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

function drawBesiktasKit(ctx, cx, cy, radius, glowIntensity) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    
    ctx.fillStyle = "#111111";
    const stripeW = (radius * 2) / 5;
    ctx.fillRect(-radius, -radius, stripeW, radius * 2);
    ctx.fillRect(-radius + stripeW * 2, -radius, stripeW, radius * 2);
    ctx.fillRect(-radius + stripeW * 4, -radius, stripeW, radius * 2);
    
    if (glowIntensity > 0.01) {
        ctx.shadowBlur = 15 * glowIntensity;
        ctx.shadowColor = "#e30a17";
    }
    ctx.fillStyle = "#e30a17";
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawGalatasarayKit(ctx, cx, cy, radius, glowIntensity) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#a90429";
    ctx.fillRect(-radius, -radius, radius, radius * 2);
    ctx.fillStyle = "#fdb913";
    ctx.fillRect(0, -radius, radius, radius * 2);
    ctx.restore();
}

function drawFenerbahceKit(ctx, cx, cy, radius, glowIntensity) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#ffed00";
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    
    ctx.fillStyle = "#00205b";
    const stripeW = (radius * 2) / 5;
    ctx.fillRect(-radius, -radius, stripeW, radius * 2);
    ctx.fillRect(-radius + stripeW * 2, -radius, stripeW, radius * 2);
    ctx.fillRect(-radius + stripeW * 4, -radius, stripeW, radius * 2);
    ctx.restore();
}

function drawTrabzonsporKit(ctx, cx, cy, radius, glowIntensity) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#4ab3e8";
    ctx.fillRect(-radius, -radius, radius * 2, radius * 2);
    
    ctx.fillStyle = "#700018";
    const stripeW = (radius * 2) / 5;
    ctx.fillRect(-radius, -radius, stripeW, radius * 2);
    ctx.fillRect(-radius + stripeW * 2, -radius, stripeW, radius * 2);
    ctx.fillRect(-radius + stripeW * 4, -radius, stripeW, radius * 2);
    ctx.restore();
}

// ========================================
// 🌌 KOZMİK KARADELİK GOL SEVİNCİ EFEKTİ
// ========================================
function drawBlackHoleEffect(ctx, cfg, celebration) {
    if (!celebration) return;
    const centerX = cfg.width / 2;
    const centerY = cfg.height / 2;
    const now = performance.now() / 1000;
    
    const elapsed = Math.max(0, 5.0 - celebration.wait_remaining);
    const scale = Math.min(1.0, elapsed * 0.8);

    ctx.save();
    ctx.translate(centerX, centerY);
    
    const rotSpeed = now * 5.0;
    ctx.rotate(-rotSpeed);
    
    const maxR = 220 * scale;

    for (let i = 0; i < 4; i++) {
        ctx.rotate(Math.PI / 2);
        const diskGrad = ctx.createRadialGradient(0, 0, maxR * 0.1, 0, 0, maxR);
        diskGrad.addColorStop(0, "rgba(0, 0, 0, 1)");
        diskGrad.addColorStop(0.15, "rgba(26, 0, 51, 0.95)");
        diskGrad.addColorStop(0.35, "rgba(106, 13, 173, 0.85)");
        diskGrad.addColorStop(0.65, "rgba(224, 64, 251, 0.45)");
        diskGrad.addColorStop(1, "rgba(224, 64, 251, 0)");
        
        ctx.fillStyle = diskGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, maxR, maxR * 0.45, 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.rotate(rotSpeed);
    const singRadius = 42 * scale;

    ctx.shadowBlur = 45 * scale;
    ctx.shadowColor = "#e040fb";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3 * scale;
    ctx.beginPath();
    ctx.arc(0, 0, singRadius + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    ctx.fillStyle = "#000000";
    ctx.beginPath();
    ctx.arc(0, 0, singRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
}

// ========================================
// 🛸 UZAY GEMİSİ (UFO ABDUCTION) GOL SEVİNCİ EFEKTİ
// ========================================
function drawUfoAbductionCelebration(ctx, cfg, p, syncElapsed, color, playerTeam, pname, radius) {
    const startX = cfg.width / 2;
    const startY = -120;
    const targetX = p.x;
    const targetY = p.y - 85;

    let ufoX = startX;
    let ufoY = startY;
    let beamAlpha = 0;
    let playerLiftY = 0;
    let playerScale = 1.0;
    let playerAlpha = 1.0;
    let skipNormalDraw = false;

    // ✨ Sunucunun (host) anlık UFO koordinatları ve fazları var mı kontrol et (Replay'de Fallback Timeline kullanılır)
    const state = miniData.gameState;
    const isReplay = !!miniData._currentReplayFrame;
    const useServerAuthoritative = !isReplay && state && state.ufoActive && typeof state.ufoX === "number" && typeof state.ufoY === "number";

    if (useServerAuthoritative) {
        ufoX = state.ufoX;
        ufoY = state.ufoY;
        
        if (state.ufoPhase === "arrive") {
            beamAlpha = 0;
            playerScale = 1.0;
            playerAlpha = 1.0;
            skipNormalDraw = false;
        } else if (state.ufoPhase === "beam") {
            beamAlpha = 1.0;
            playerScale = 1.0;
            playerAlpha = 1.0;
            skipNormalDraw = true; 
        } else if (state.ufoPhase === "lift") {
            beamAlpha = 1.0;
            skipNormalDraw = true;
            
            // Fazın içindeki akıcılık için yerel milisaniye pürüzsüzleştirmesi (Tethering)
            const phaseElapsed = (performance.now() / 1000) - (state.ufoPhaseStart || 0);
            const t = Math.min(1.0, Math.max(0.0, phaseElapsed / 1.5));
            playerLiftY = t * 74;
            playerScale = Math.max(0.0, 1.0 - t * 1.5);
            if (t > 0.6) {
                playerAlpha = 0;
                playerScale = 0;
            }
        } else if (state.ufoPhase === "leave") {
            beamAlpha = 0;
            playerAlpha = 0;
            playerScale = 0;
            skipNormalDraw = true;
        }
    } else {
        // ✨ Replay veya gecikme anında sunucuyla birebir eşit pürüzsüz yerel zaman akışı (Fallback Timeline)
        // Faz süreleri: arrive (0.8s) -> beam (0.6s) -> lift (1.5s) -> leave (1.5s)
        const tArrive = 0.8;
        const tBeam = tArrive + 0.6; // 1.4
        const tLift = tBeam + 1.5;   // 2.9
        const tLeave = tLift + 1.5;  // 4.4

        if (syncElapsed < tArrive) {
            // Phase 1: Uçarak Gelme (arrive)
            const t = syncElapsed / tArrive;
            const ease = 1 - Math.pow(1 - t, 3);
            ufoX = startX + (targetX - startX) * ease;
            ufoY = startY + (targetY - startY) * ease;
            beamAlpha = 0;
            playerScale = 1.0;
            playerAlpha = 1.0;
            skipNormalDraw = false;
        } else if (syncElapsed < tBeam) {
            // Phase 2: Işınlama (beam)
            ufoX = targetX;
            ufoY = targetY + Math.sin(syncElapsed * 4) * 3;
            beamAlpha = Math.min(1.0, (syncElapsed - tArrive) / 0.2);
            playerScale = 1.0;
            playerAlpha = 1.0;
            skipNormalDraw = true;
        } else if (syncElapsed < tLift) {
            // Phase 3: Yukarı Çekme (lift)
            ufoX = targetX;
            ufoY = targetY + Math.sin(syncElapsed * 4) * 3;
            beamAlpha = 1.0;
            skipNormalDraw = true;

            const t = (syncElapsed - tBeam) / 1.5; // 0.0 -> 1.0
            playerLiftY = t * 74;
            playerScale = Math.max(0.0, 1.0 - t * 1.5);
            if (t > 0.6) {
                playerAlpha = 0;
                playerScale = 0;
            }
        } else {
            // Phase 4: Kaçış (leave)
            const exitT = Math.min(1.0, (syncElapsed - tLift) / 1.5);
            const easeIn = exitT * exitT * exitT;
            ufoX = targetX + (easeIn * 750);
            ufoY = targetY - (easeIn * 950);
            beamAlpha = Math.max(0, 1.0 - exitT * 4);
            playerAlpha = 0;
            playerScale = 0;
            skipNormalDraw = true;
        }
    }

    // A) TRAKTÖR IŞINI (Tractor Beam)
    if (beamAlpha > 0) {
        ctx.save();
        
        const beamGrad = ctx.createLinearGradient(ufoX, ufoY + 12, ufoX, p.y + 12);
        beamGrad.addColorStop(0, `rgba(0, 240, 255, ${0.85 * beamAlpha})`);
        beamGrad.addColorStop(0.5, `rgba(0, 255, 170, ${0.45 * beamAlpha})`);
        beamGrad.addColorStop(1, `rgba(0, 240, 255, ${0.05 * beamAlpha})`);

        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(ufoX - 18, ufoY + 12);
        ctx.lineTo(ufoX + 18, ufoY + 12);
        ctx.lineTo(ufoX + 52, p.y + 12);
        ctx.lineTo(ufoX - 52, p.y + 12);
        ctx.closePath();
        ctx.fill();

        // Işın İçindeki Yükselen Parçacıklar
        const time = Date.now() * 0.006;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * beamAlpha})`;
        for (let i = 0; i < 14; i++) {
            const px = ufoX + Math.sin(time + i * 1.4) * (12 + i * 2.2);
            const py = (p.y + 8) - ((time * 45 + i * 22) % Math.max(20, (p.y - ufoY)));
            if (py > ufoY + 12 && py < p.y + 8) {
                ctx.beginPath();
                ctx.arc(px, py, 1.5 + (i % 3) * 0.8, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Zemin Halkası Aura
        ctx.strokeStyle = `rgba(0, 255, 200, ${0.75 * beamAlpha})`;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 12;
        ctx.shadowColor = "#00f0ff";
        ctx.beginPath();
        ctx.ellipse(ufoX, p.y + 8, 48, 13, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    // B) HAVAYA ÇEKİLEN OYUNCU
    if (playerAlpha > 0 && skipNormalDraw) {
        ctx.save();
        ctx.globalAlpha = playerAlpha;
        
        const floatY = p.y - playerLiftY;
        const spinRot = Math.sin(syncElapsed * 12) * 0.25;

        ctx.translate(p.x, floatY);
        ctx.rotate(spinRot);
        ctx.scale(playerScale, playerScale);

        // Çekim Aurası Halesi
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#00f0ff";
        ctx.strokeStyle = "#00f0ff";
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
        ctx.stroke();

        // Oyuncu Gövdesi
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.stroke();

        // İsim Etiketi
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = playerAlpha;
        ctx.font = `bold 14px Segoe UI`;
        ctx.textAlign = "center";
        ctx.shadowBlur = 6;
        ctx.shadowColor = "#000";
        ctx.fillStyle = "#00f0ff";
        ctx.fillText(pname, p.x, floatY - (radius * playerScale) - 10);
        ctx.restore();
    }

    // C) UFO UZAY GEMİSİ ÇİZİMİ
    ctx.save();
    ctx.translate(ufoX, ufoY);

    if (syncElapsed >= 0.8 && syncElapsed < 2.9) {
        ctx.rotate(Math.sin(Date.now() * 0.005) * 0.06);
    } else if (syncElapsed >= 2.9) {
        ctx.rotate(0.25); // Kaçış eğimi
    }

    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 22;

    // Dome (Cam Kubbe)
    const domeGrad = ctx.createRadialGradient(0, -6, 2, 0, -4, 22);
    domeGrad.addColorStop(0, "rgba(220, 255, 255, 0.95)");
    domeGrad.addColorStop(0.6, "rgba(0, 190, 230, 0.75)");
    domeGrad.addColorStop(1, "rgba(0, 50, 110, 0.4)");
    
    ctx.fillStyle = domeGrad;
    ctx.beginPath();
    ctx.arc(0, -4, 22, Math.PI, 0);
    ctx.fill();

    // Gövde (Metalik Disk Body)
    const bodyGrad = ctx.createLinearGradient(-46, 0, 46, 0);
    bodyGrad.addColorStop(0, "#3a4556");
    bodyGrad.addColorStop(0.3, "#cbd5e0");
    bodyGrad.addColorStop(0.5, "#ffffff");
    bodyGrad.addColorStop(0.7, "#cbd5e0");
    bodyGrad.addColorStop(1, "#3a4556");

    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, 4, 46, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#1a202c";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Alt Motor Yuvası
    ctx.fillStyle = "#111827";
    ctx.beginPath();
    ctx.ellipse(0, 9, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Dönen Neon Işıklar
    const lightCount = 6;
    const pulseTime = Date.now() * 0.008;
    for (let i = 0; i < lightCount; i++) {
        const angle = (i / lightCount) * Math.PI * 2 + pulseTime;
        const lx = Math.cos(angle) * 35;
        const ly = Math.sin(angle) * 7 + 4;
        
        ctx.fillStyle = (i % 2 === 0) ? "#00f0ff" : "#00ffaa";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(lx, ly, 3.2, 0, Math.PI * 2);
        ctx.fill();
    }

    ctx.restore();

    return { skipPlayerDraw: skipNormalDraw };
}

// ========================================
// ⏱️ COUNTDOWN & KICKOFF OVERLAYS
// ========================================

function drawCountdownOverlay(ctx, cfg, isCountdown, showGo) {
    const state = miniData.gameState;
    if (!state) return;
    const now = performance.now() / 1000;

    let text = "";
    let isGo = false;

    if (isCountdown) {
        if (!miniData._countdownSoundPlayed) {
            MiniAudio.stop("timer_countdown.mp3");
            MiniAudio.play("timer_countdown.mp3", 0.8);
            miniData._countdownSoundPlayed = true;
        }

        const cVal = Number(state.countdown);
        if (!isNaN(cVal) && state.countdown !== null && state.countdown !== undefined) {
            if (cVal > 2) text = "3";
            else if (cVal > 1) text = "2";
            else text = "1";
        } else if (state.countdown_end) {
            const rem = Math.max(0, state.countdown_end - now);
            if (rem > 2.0) text = "3";
            else if (rem > 1.0) text = "2";
            else text = "1";
        } else {
            text = "1";
        }
    } else if (showGo) {
        text = "BAŞLA!";
        isGo = true;
    }

    if (!text) return;

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    const centerX = cfg ? (cfg.width / 2) : (ctx.canvas.width / 2);
    const centerY = cfg ? (cfg.height / 2) : (ctx.canvas.height / 2);

    ctx.font = isGo ? "900 85px 'Montserrat', sans-serif" : "900 120px 'Montserrat', sans-serif";
    
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 10;
    ctx.strokeText(text, centerX, centerY);

    ctx.fillStyle = isGo ? "#2ecc71" : "#ffffff";
    ctx.fillText(text, centerX, centerY);
    
    ctx.restore();
}

function drawKickoffInfo(ctx, cfg, kickoff) {
    if (!kickoff || !kickoff.active) return;
    
    const remaining = kickoff.time_remaining;
    if (remaining <= 0) return;
    
    const fontScale = Math.max(1, cfg.width / 1000);
    const receivingTeam = kickoff.receiving_team;
    const restrictedTeam = kickoff.restricted_team;
    const myPlayer = miniData.players.find(p => p.id === miniData.playerId);
    const myTeamId = myPlayer ? (myPlayer.team === "red" ? 1 : (myPlayer.team === "blue" ? 2 : null)) : null;
    const isMyTeamReceiving = receivingTeam === myTeamId;
    const isMyTeamRestricted = restrictedTeam === myTeamId;
    
    ctx.save();
    const timerText = `⏱️ ${remaining.toFixed(1)} sn`;
    ctx.font = `bold ${Math.round(20 * fontScale)}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    
    const isWarning = remaining <= 3;
    const blink = Math.floor(Date.now() / 200) % 2 === 0;
    ctx.fillStyle = isWarning ? (blink ? "#ff3333" : "#ffd43b") : "#ffd43b";
    ctx.shadowBlur = 8;
    ctx.shadowColor = "#000";
    ctx.fillText(timerText, cfg.width / 2, 10);
    
    let infoText = "";
    let infoColor = "#fff";
    if (isMyTeamReceiving) {
        infoText = "⚽ TOP SENDE! Topa git!";
        infoColor = "#51cf66";
    } else if (isMyTeamRestricted) {
        infoText = "⛔ Santra! Karşıya geçemezsin";
        infoColor = "#ff6b6b";
    } else {
        const teamName = receivingTeam === 1 ? "Kırmızı" : "Mavi";
        infoText = `${teamName} takım santra atacak`;
        infoColor = "#adb5bd";
    }
    
    ctx.font = `bold ${Math.round(16 * fontScale)}px Segoe UI`;
    ctx.fillStyle = infoColor;
    ctx.fillText(infoText, cfg.width / 2, 38);
    ctx.restore();
}

// ========================================
// 🏆 GOL SEVİNCİ VE REPLAY RENDER
// ========================================

function drawGoalCelebration(ctx, cfg, celebration) {
    const fontScale = Math.max(1, cfg.width / 1000);
    const isOwnGoal = celebration.own_goal === true; 
    
    const scorerPid = celebration.scorer_pid || celebration.scorer_id;
    const scorerTeamId = celebration.scorer_id;  
    
    let scorerName = "Oyuncu";
    const scorerPlayer = miniData.players.find(p => Number(p.id) === Number(scorerPid));
    if (scorerPlayer) {
        scorerName = scorerPlayer.name;
    } else if (miniData.playerNames[String(scorerPid)]) {
        scorerName = miniData.playerNames[String(scorerPid)];
    }
    
    const assistId = celebration.assist_id;
    let assistName = null;
    if (assistId) {
        const assistPlayer = miniData.players.find(p => Number(p.id) === Number(assistId));
        assistName = assistPlayer ? assistPlayer.name : miniData.playerNames[String(assistId)];
    }
    
    const rDurationUI = celebration.replay_duration || 10.0;
    const isReplayMode = celebration.wait_remaining <= rDurationUI;
    if (isReplayMode) {
        ctx.save();
        ctx.fillStyle = "#ff3333";
        ctx.beginPath();
        ctx.arc(15 * fontScale, 20 * fontScale, 6 * fontScale, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = "#ff3333";
        ctx.font = `bold ${20 * fontScale}px 'Segoe UI', sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText("Replay", 30 * fontScale, 20 * fontScale);
        
        let textColor = "#ffd43b";
        const dynRedReplay = miniData.redTeamColor || "#ff6b6b";
        const dynBlueReplay = miniData.blueTeamColor || "#4dabf7";
        const scorerPlayerObj = miniData.players.find(p => p.id === scorerPid);
        if (scorerPlayerObj && (scorerPlayerObj.team === "red" || scorerPlayerObj.team === "blue")) {
            textColor = scorerPlayerObj.team === "red" ? dynRedReplay : dynBlueReplay;
        } else if (scorerTeamId === 1) {
            textColor = dynRedReplay;
        } else if (scorerTeamId === 2) {
            textColor = dynBlueReplay;
        }
        
        const centerX = cfg.width / 2;
        const line1Y = cfg.height - 28 * fontScale; 
        const line2Y = cfg.height - 10 * fontScale; 

        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4;
        
        let scorerTeamKey = "red";
        if (scorerPlayerObj && (scorerPlayerObj.team === "red" || scorerPlayerObj.team === "blue")) {
            scorerTeamKey = isOwnGoal ? (scorerPlayerObj.team === "red" ? "blue" : "red") : scorerPlayerObj.team;
        } else if (scorerTeamId === 2) {
            scorerTeamKey = "blue";
        }
        const scorerTeamName = (scorerTeamKey === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
        const normScorerTeam = scorerTeamName.trim().toLowerCase();

        const fontH = 16 * fontScale;
        ctx.font = `bold ${fontH}px 'Segoe UI'`;

        let golLabelColor = textColor;
        let playerNameColor = textColor;
        let isAzGrad = false;

        if (["türkiye", "turkiye"].includes(normScorerTeam)) {
            golLabelColor = "#ffffff";
            playerNameColor = "#e30a17";
        } else if (["azerbaycan", "azerbaijan"].includes(normScorerTeam)) {
            golLabelColor = "#00a8e8";
            isAzGrad = true;
        } else if (["beşiktaş", "besiktas", "bjk"].includes(normScorerTeam)) {
            golLabelColor = "#111111";
            playerNameColor = "#ffffff";
        } else if (["galatasaray", "gs"].includes(normScorerTeam)) {
            golLabelColor = "#a90429";
            playerNameColor = "#fdb913";
        } else if (["fenerbahçe", "fenerbahce", "fb"].includes(normScorerTeam)) {
            golLabelColor = "#00205b";
            playerNameColor = "#ffed00";
        } else if (["trabzonspor", "ts"].includes(normScorerTeam)) {
            golLabelColor = "#700018";
            playerNameColor = "#4ab3e8";
        }

        if (isAzGrad) {
            const azGrad = ctx.createLinearGradient(0, line1Y - fontH * 0.45, 0, line1Y + fontH * 0.45);
            azGrad.addColorStop(0, "#e32118");
            azGrad.addColorStop(0.48, "#e32118");
            azGrad.addColorStop(0.52, "#38a047");
            azGrad.addColorStop(1, "#38a047");
            playerNameColor = azGrad;
        }

        const labelGolText = isOwnGoal ? "🤦 Kendi Kalesine: " : "⚽ Gol: ";
        const nameScorerText = isOwnGoal ? `${scorerName} (k.k.)` : scorerName;
        const sepText = "   |   ";
        const labelAssistText = "🤝 Asist: ";
        const nameAssistText = (isOwnGoal || !assistName) ? "" : assistName;

        const wLabelGol = ctx.measureText(labelGolText).width;
        const wNameScorer = ctx.measureText(nameScorerText).width;
        const wSep = assistName ? ctx.measureText(sepText).width : 0;
        const wLabelAssist = assistName ? ctx.measureText(labelAssistText).width : 0;
        const wNameAssist = assistName ? ctx.measureText(nameAssistText).width : 0;

        const totalRow1W = wLabelGol + wNameScorer + wSep + wLabelAssist + wNameAssist;
        let startXRow1 = centerX - (totalRow1W / 2);

        ctx.textAlign = "left";

        ctx.fillStyle = golLabelColor;
        ctx.fillText(labelGolText, startXRow1, line1Y);
        startXRow1 += wLabelGol;

        ctx.fillStyle = playerNameColor;
        ctx.fillText(nameScorerText, startXRow1, line1Y);
        startXRow1 += wNameScorer;

        if (assistName) {
            ctx.fillStyle = "#adb5bd";
            ctx.fillText(sepText, startXRow1, line1Y);
            startXRow1 += wSep;

            ctx.fillStyle = golLabelColor;
            ctx.fillText(labelAssistText, startXRow1, line1Y);
            startXRow1 += wLabelAssist;

            ctx.fillStyle = playerNameColor;
            ctx.fillText(nameAssistText, startXRow1, line1Y);
        }
        
        ctx.font = `bold ${14 * fontScale}px 'Segoe UI'`;
        
        let speedColor = "#ffd43b";
        if (celebration.speed > 80) speedColor = "#ff4d4d";
        else if (celebration.speed >= 40) speedColor = "#51cf66";
        
        let distColor = "#ffd43b";
        if (celebration.dist > 20) distColor = "#ff4d4d";
        else if (celebration.dist >= 8) distColor = "#51cf66";
        
        const speedStr = `⚡ Şut Hızı: ${celebration.speed} km/s`;
        const sepStr = `   |   `;
        const distStr = `📏 Mesafe: ${celebration.dist}m`;
        
        const w1 = ctx.measureText(speedStr).width;
        const w2 = ctx.measureText(sepStr).width;
        const w3 = ctx.measureText(distStr).width;
        const totalW = w1 + w2 + w3;
        
        let startX = centerX - totalW / 2;
        ctx.textAlign = "left";
        
        ctx.fillStyle = speedColor;
        ctx.fillText(speedStr, startX, line2Y);
        startX += w1;
        
        ctx.fillStyle = "#adb5bd";
        ctx.fillText(sepStr, startX, line2Y);
        startX += w2;
        
        ctx.fillStyle = distColor;
        ctx.fillText(distStr, startX, line2Y);
        
        const skipVotes = (celebration.skip_votes || []).map(id => parseInt(id, 10));
        const activePlayers = miniData.players.filter(p => (p.team === "red" || p.team === "blue") && !p.is_bot);
        const waitingFor = activePlayers.filter(p => !skipVotes.includes(parseInt(p.id, 10)));
        const boxY = cfg.height + 27.5; 
        
        if (waitingFor.length === 0) {
            ctx.fillStyle = "#51cf66";
            ctx.shadowColor = "#51cf66";
            ctx.shadowBlur = 10;
            ctx.font = `bold ${18 * fontScale}px 'Segoe UI'`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("⏭️ Geçiliyor...", centerX, boxY);
        } else {
            ctx.font = `bold ${14 * fontScale}px 'Segoe UI'`;
            const padding = 12 * fontScale;
            const gap = 10 * fontScale;
            
            let pillsTotalW = 0;
            const pillWidths = [];
            
            waitingFor.forEach(p => {
                const w = ctx.measureText(p.name || "Oyuncu").width + (padding * 2);
                pillWidths.push(w);
                pillsTotalW += w;
            });
            
            const totalW = pillsTotalW + (waitingFor.length > 1 ? (waitingFor.length - 1) * gap : 0);
            let startX_skip = centerX - (totalW / 2);
            
            waitingFor.forEach((p, index) => {
                const isRed = p.team === "red";
                const tColor = isRed ? dynRedReplay : dynBlueReplay;
                const pTeamName = (isRed ? miniData.redTeamName : miniData.blueTeamName) || "";
                const normName = pTeamName.trim().toLowerCase();
                
                const rgb = hexToRgbParts(tColor);
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                const max = Math.max(rgb.r, rgb.g, rgb.b);
                const min = Math.min(rgb.r, rgb.g, rgb.b);
                const saturation = max === 0 ? 0 : (max - min) / max;
                const isDark = brightness < 55 && saturation < 0.22;

                let pColor = isDark ? "#ffffff" : tColor;
                if (["galatasaray", "gs"].includes(normName)) {
                    pColor = "#fdb913";
                } else if (["fenerbahçe", "fenerbahce", "fb"].includes(normName)) {
                    pColor = "#ffed00";
                } else if (["trabzonspor", "ts"].includes(normName)) {
                    pColor = "#4ab3e8";
                }

                const pName = p.name || "Oyuncu";
                const pillW = pillWidths[index];
                const pillH = 26 * fontScale;
                const pillY = boxY - (pillH/2);
                
                ctx.fillStyle = isDark ? "rgba(17, 17, 17, 0.88)" : hexToRgba(tColor, 0.25);
                ctx.strokeStyle = isDark ? "rgba(255, 255, 255, 0.75)" : hexToRgba(tColor, 0.7);
                ctx.lineWidth = 1.5;
                ctx.shadowBlur = 0;
                
                ctx.beginPath();
                ctx.roundRect(startX_skip, pillY, pillW, pillH, 13 * fontScale);
                ctx.fill();
                ctx.stroke();
                
                ctx.fillStyle = pColor;
                ctx.shadowColor = isDark ? "#ffffff" : pColor;
                ctx.shadowBlur = isDark ? 3 : 6;
                ctx.textAlign = "center";
                ctx.fillText(pName, startX_skip + (pillW/2), boxY);
                
                startX_skip += pillW + gap; 
            });
        }
        ctx.restore();
        return;
    }

    const _gs = miniData.gameState;
    const _scores = _gs ? `${_gs.scores["1"]}-${_gs.scores["2"]}` : "0-0";
    const _scorerPidForSig = celebration.scorer_pid || celebration.scorer_id;
    const goalSignature = `${_scorerPidForSig}_${_scores}`;
    
    if (celebration.silent === true) {
        miniData._lastGoalSignature = "silent_" + goalSignature;
    } else if (miniData._lastGoalSignature !== goalSignature) {
        MiniAudio.playRandom("goal", ["goal_1.mp3", "goal_2.mp3", "goal_3.mp3"], 0.7);
        miniData._lastGoalSignature = goalSignature;
        
        if (isOwnGoal && _scorerPidForSig) {
            const scorerPlayerObj = miniData.players.find(p => p.id === _scorerPidForSig);
            let ownGoalTeam = null;
            if (scorerPlayerObj && (scorerPlayerObj.team === "red" || scorerPlayerObj.team === "blue")) {
                ownGoalTeam = scorerPlayerObj.team;
            } else {
                const ownGoalTeamId = (scorerTeamId === 1) ? 2 : 1;
                ownGoalTeam = (ownGoalTeamId === 1) ? "red" : "blue";
            }
            
            if (ownGoalTeam) {
                if (!miniData._teamOwnGoalsCount) {
                    miniData._teamOwnGoalsCount = { red: 0, blue: 0 };
                }
                
                miniData._teamOwnGoalsCount[ownGoalTeam] = (miniData._teamOwnGoalsCount[ownGoalTeam] || 0) + 1;
                
                if (miniData._teamOwnGoalsCount[ownGoalTeam] === 2) {
                    let vol = 0.5;
                    if (typeof window.getGlobalVolume === "function") {
                        const gv = window.getGlobalVolume();
                        if (typeof gv === "number" && !isNaN(gv)) vol = gv;
                    }
                    setTimeout(() => {
                        MiniAudio.play("own_goal.mp3", Math.max(0, Math.min(1, vol * 1.2)));
                    }, 400);
                }
            }
        }
        
        const myPlayer = miniData.players.find(p => p.id === miniData.playerId);
        const myTeam = myPlayer ? myPlayer.team : null;
        const scorerTeam = scorerTeamId === 1 ? "red" : "blue";
        
        if (myTeam === "red" || myTeam === "blue") {
            let iScored = (myTeam === scorerTeam);
            if (isOwnGoal) iScored = !iScored;
            
            if (iScored) {
                MiniVibration.goalScored();
            } else {
                MiniVibration.goalConceded();
            }
        }
    }

    let skipDarken = false;
    if (miniData.gameState && miniData.gameState.players) {
        for (const _pid in miniData.gameState.players) {
            const _rp = miniData.gameState.players[_pid];
            if (_rp && _rp.celebrating) {
                const _ct = _rp.celebration_type || (_rp.celebration && _rp.celebration.type) || _rp.celebration || "";
                if (["snake", "eagle_wings", "rainbow_trail", "black_hole", "cosmic_blackhole", "ufo", "ufo_abduction", "ufo_abduct", "alien", "spaceship", "uzay_gemisi"].includes(_ct)) {
                    skipDarken = true;
                    break;
                }
            }
        }
    }
    const globalCType = celebration.celebration_type || celebration.type || celebration || "";
    if (["snake", "eagle_wings", "rainbow_trail", "black_hole", "cosmic_blackhole", "ufo", "ufo_abduction", "ufo_abduct", "alien", "spaceship", "uzay_gemisi"].includes(globalCType)) {
        skipDarken = true;
    }

    if (!skipDarken) {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fillRect(0, 0, cfg.width, cfg.height);
    }
    
    if (!isOwnGoal && miniData._lastGoalSignature === goalSignature && !celebration.silent) {
        if (!miniData._goalSongPlayed || miniData._goalSongPlayed !== goalSignature) {
            miniData._goalSongPlayed = goalSignature;
            
            let vol = 0.5;
            if (typeof window.getGlobalVolume === "function") {
                const gv = window.getGlobalVolume();
                if (typeof gv === "number" && !isNaN(gv)) vol = gv;
            }
            
            if (miniData._goalSongAudio) {
                try { 
                    miniData._goalSongAudio.pause();
                    miniData._goalSongAudio.currentTime = 0;
                } catch(e) {}
            }

            let selectedSong = celebration.selected_song;
            if (!selectedSong) {
                const defaultPool = ["goal_song_1.mp3", "goal_song_2.mp3", "goal_song_3.mp3"];
                selectedSong = defaultPool[Math.floor(Math.random() * defaultPool.length)];
            }

            const song = new Audio(`/oyun_modlari/mini_futbol/sounds/Goal_Songs/${selectedSong}`);
            song.loop = false;
            
            const rDur = celebration.replay_duration || 10.0;
            const totalWait = 5.0 + rDur;
            const elapsed = totalWait - celebration.wait_remaining;
            if (elapsed > 0 && elapsed < totalWait) {
                song.currentTime = elapsed;
            }

            song.onerror = () => {
                const fallbackSongs = ["goal_song_2.mp3", "goal_song_7.mp3", "goal_song_8.mp3", "goal_song_9.mp3"];
                const randFb = fallbackSongs[Math.floor(Math.random() * fallbackSongs.length)];
                const fb = new Audio(`/oyun_modlari/mini_futbol/sounds/Goal_Songs/${randFb}`);
                fb.currentTime = song.currentTime;
                fb.play().catch(() => {});
                miniData._goalSongAudio = fb;
            };

            song.play().catch(() => {});
            miniData._goalSongAudio = song;
        }
    }
    
    const pulse = Math.sin(Date.now() / 150) * 0.05 + 1;
    ctx.save();
    ctx.translate(cfg.width / 2, cfg.height / 2);
    
    const goolY = -60;
    ctx.font = `bold ${Math.round(75 * pulse * fontScale)}px Segoe UI`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowBlur = 35;
    
    const dynRed = miniData.redTeamColor || "#ff6b6b";
    const dynBlue = miniData.blueTeamColor || "#4dabf7";

    const getGoalTextTheme = (teamKey, fallbackColor) => {
        const tName = (teamKey === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
        const norm = tName.trim().toLowerCase();
        
        if (["fenerbahçe", "fenerbahce", "fb"].includes(norm)) 
            return { fill: "#ffed00", stroke: "#00205b" };
        if (["galatasaray", "gs"].includes(norm)) 
            return { fill: "#fdb913", stroke: "#a90429" };
        if (["trabzonspor", "ts"].includes(norm)) 
            return { fill: "#4ab3e8", stroke: "#700018" };
        if (["beşiktaş", "besiktas", "bjk"].includes(norm)) 
            return { fill: "#ffffff", stroke: "#111111" };
            
        return { fill: fallbackColor, stroke: "#ffffff" };
    };
    
    let theme = { fill: "#ffd43b", stroke: "#ffffff" };
    if (isOwnGoal) {
        let ownTeamKey = "red";
        const scorerPlayerObj = miniData.players.find(p => p.id === scorerPid);
        if (scorerPlayerObj && scorerPlayerObj.team === "blue") ownTeamKey = "blue";
        else if (scorerPlayerObj && scorerPlayerObj.team === "red") ownTeamKey = "red";
        else if (scorerTeamId === 2) ownTeamKey = "blue";
        
        const fallback = ownTeamKey === "blue" ? dynBlue : dynRed;
        theme = getGoalTextTheme(ownTeamKey, fallback);
    } else {
        const teamKey = scorerTeamId === 1 ? "red" : "blue";
        const fallback = scorerTeamId === 1 ? dynRed : dynBlue;
        theme = getGoalTextTheme(teamKey, fallback);
    }

    ctx.shadowBlur = 35;
    ctx.shadowColor = theme.fill;
    ctx.fillStyle = theme.fill;
    ctx.fillText("⚽ GOOOL!", 0, goolY);
    
    ctx.shadowBlur = 0;
    ctx.strokeStyle = theme.stroke;
    ctx.lineWidth = 3.5;
    ctx.strokeText("⚽ GOOOL!", 0, goolY);
    
    if (isOwnGoal) {
        let ownTeamKey = "red";
        const scorerPlayerObj = miniData.players.find(p => p.id === scorerPid);
        if (scorerPlayerObj && scorerPlayerObj.team === "blue") ownTeamKey = "blue";
        else if (scorerPlayerObj && scorerPlayerObj.team === "red") ownTeamKey = "red";
        else if (scorerTeamId === 2) ownTeamKey = "blue";
        
        const fallback = ownTeamKey === "blue" ? dynBlue : dynRed;
        const ownColor = getGoalTextTheme(ownTeamKey, fallback).fill;

        ctx.font = `bold ${Math.round(28 * fontScale)}px Segoe UI`;
        ctx.shadowBlur = 20;
        ctx.shadowColor = ownColor;
        ctx.fillStyle = ownColor;
        ctx.fillText(`${scorerName} Kendi Kalesine Attı`, 0, 20);
    } else {
        const scorerTeamKey = scorerTeamId === 1 ? "red" : "blue";
        const scorerTeamColor = getGoalTextTheme(scorerTeamKey, scorerTeamId === 1 ? dynRed : dynBlue).fill;
        
        ctx.font = `bold ${Math.round(26 * fontScale)}px Segoe UI`;
        ctx.shadowBlur = 0;
        ctx.textAlign = "center";
        
        const label1 = "Golü Atan: ";
        const label1W = ctx.measureText(label1).width;
        const nameW = ctx.measureText(scorerName).width;
        const totalW = label1W + nameW;
        
        ctx.textAlign = "left";
        ctx.shadowBlur = 15;
        ctx.shadowColor = scorerTeamColor;
        ctx.fillStyle = scorerTeamColor;
        ctx.fillText(label1, -totalW / 2, 15);
        ctx.fillText(scorerName, -totalW / 2 + label1W, 15);
        
        if (assistName) {
            ctx.font = `bold ${Math.round(22 * fontScale)}px Segoe UI`;
            const label2 = "Asist: ";
            const label2W = ctx.measureText(label2).width;
            const assistW = ctx.measureText(assistName).width;
            const totalW2 = label2W + assistW;
            
            ctx.textAlign = "left";
            ctx.shadowBlur = 15;
            ctx.shadowColor = scorerTeamColor;
            ctx.fillStyle = scorerTeamColor;
            ctx.fillText(label2, -totalW2 / 2, 55);
            ctx.fillText(assistName, -totalW2 / 2 + label2W, 55);
        }
    }
    ctx.restore();
}

// ========================================
// 🎮 CORE RENDER LOOP (60 FPS)
// ========================================

function miniRender() {
    const canvas = document.getElementById("miniCanvas");
    if (!canvas) {
        if (typeof miniAnimFrame !== 'undefined') miniAnimFrame = requestAnimationFrame(miniRender);
        return;
    }
    
    const ctx = canvas.getContext("2d");
    const cfg = miniData.fieldConfig;
    if (!cfg) {
        if (typeof miniAnimFrame !== 'undefined') miniAnimFrame = requestAnimationFrame(miniRender);
        return;
    }
    
    const OUT_MARGIN = 55;
    canvas.width = cfg.width + OUT_MARGIN * 2;
    canvas.height = cfg.height + OUT_MARGIN * 2;
    
    ctx.save();
    ctx.translate(OUT_MARGIN, OUT_MARGIN);
    
    ctx.fillStyle = "#1e5828";
    ctx.fillRect(-OUT_MARGIN, -OUT_MARGIN, cfg.width + OUT_MARGIN * 2, cfg.height + OUT_MARGIN * 2);
    
    ctx.fillStyle = "#2f7d3f";
    ctx.fillRect(0, 0, cfg.width, cfg.height);
    
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    for (let i = 0; i < cfg.width; i += 60) {
        if ((i / 60) % 2 === 0) {
            ctx.fillRect(i, 0, 60, cfg.height);
        }
    }
    
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cfg.width / 2, 0);
    ctx.lineTo(cfg.width / 2, cfg.height);
    ctx.stroke();
    
    const kickoffActive = miniData.gameState && miniData.gameState.kickoff && miniData.gameState.kickoff.active;
    if (kickoffActive) {
        ctx.strokeStyle = "rgba(255, 107, 107, 0.7)";
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
    }
    ctx.beginPath();
    ctx.arc(cfg.width / 2, cfg.height / 2, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    if (kickoffActive && miniData.gameState && miniData.gameState.kickoff) {
        const restrictedTeam = miniData.gameState.kickoff.restricted_team;
        ctx.strokeStyle = "rgba(255, 107, 107, 0.6)";
        ctx.lineWidth = 4;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(cfg.width / 2, 0);
        ctx.lineTo(cfg.width / 2, cfg.height);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = "rgba(255, 80, 80, 0.08)";
        if (restrictedTeam === 1) {
            ctx.fillRect(0, 0, cfg.width / 2, cfg.height);
        } else {
            ctx.fillRect(cfg.width / 2, 0, cfg.width / 2, cfg.height);
        }
    }
    
    const goalY = (cfg.height - cfg.goal_width) / 2;
    const postRadius = 6;
    const goalCurve = 60;
    
    // Sol Kale
    const leftGoalX = 0;
    ctx.fillStyle = "#ffcccc";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(leftGoalX, goalY, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(leftGoalX, goalY + cfg.goal_width, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(leftGoalX, goalY);
    ctx.bezierCurveTo(
        leftGoalX - goalCurve, goalY + 15,
        leftGoalX - goalCurve, goalY + cfg.goal_width - 15,
        leftGoalX, goalY + cfg.goal_width
    );
    ctx.stroke();
    
    // Sağ Kale
    const rightGoalX = cfg.width;
    ctx.fillStyle = "#ccddff";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(rightGoalX, goalY, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(rightGoalX, goalY + cfg.goal_width, postRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(rightGoalX, goalY);
    ctx.bezierCurveTo(
        rightGoalX + goalCurve, goalY + 15,
        rightGoalX + goalCurve, goalY + cfg.goal_width - 15,
        rightGoalX, goalY + cfg.goal_width
    );
    ctx.stroke();
    
    const state = miniData.gameState;
    if (state) {
        let isReplayMode = false;
        let replayFrameData = null;
        miniData._currentReplayFrame = null;
        
        const isGoalWait = (state.game_state === "goal_wait" && state.goal_celebration);
        const waitRemaining = isGoalWait ? state.goal_celebration.wait_remaining : 999;
        const rDuration = (state.goal_celebration && typeof state.goal_celebration.replay_duration === "number")
            ? state.goal_celebration.replay_duration
            : 10.0;
        const isReplayPhase = isGoalWait && (waitRemaining <= rDuration);
        
        if (!isReplayPhase) {
            miniReplay.replayStartTime = 0;
        }

        if (isReplayPhase) {
            const clip = miniReplay.lockedBuffer || miniReplay.buffer;
            if (clip && clip.length > 0) {
                if (!miniReplay.playedReplayEvents) miniReplay.playedReplayEvents = new Set();
                
                if (!miniReplay.replayStartTime) {
                    miniReplay.replayStartTime = performance.now();
                }
                
                const elapsedSec = Math.max(0, (performance.now() - miniReplay.replayStartTime) / 1000);
                let frameIndex = Math.floor(elapsedSec * 60);
                if (frameIndex >= clip.length) {
                    frameIndex = clip.length - 1;
                }
                
                const targetObj = clip[frameIndex];
                replayFrameData = (targetObj && targetObj.data) ? targetObj.data : targetObj;
                miniData._currentReplayFrame = replayFrameData;
                isReplayMode = true;

                // 🛸/🌌 Replay karesinde görsel efektleri (UFO & Karadelik DOM) güncelle
                // Sadece top ağlara girip "goal_wait" evresine geçildiğinde tetikle
                if (replayFrameData) {
                    const currentGS = replayFrameData.game_state || "playing";
                    const rVisualState = {
                        ...replayFrameData,
                        is_replay: true,
                        game_state: currentGS,
                        goal_celebration: replayFrameData.goal_celebration || state.goal_celebration
                    };
                    if (typeof manageVisualBlackHole === "function") manageVisualBlackHole(rVisualState);
                    if (typeof manageVisualUfo === "function") manageVisualUfo(rVisualState);
                }

                if (replayFrameData) {
                    if (replayFrameData.goal_event) {
                        const g = replayFrameData.goal_event;
                        const key = `g_${g.scorer}_${g.scores ? (g.scores['1'] + '_' + g.scores['2']) : g.time}`;
                        if (!miniReplay.playedReplayEvents.has(key)) {
                            miniReplay.playedReplayEvents.add(key);
                            MiniAudio.playRandom("goal", ["goal_1.mp3", "goal_2.mp3", "goal_3.mp3"], 0.7);
                        }
                    }

                    if (replayFrameData.kick_effects && replayFrameData.kick_effects.length > 0) {
                        replayFrameData.kick_effects.forEach(k => {
                            const key = `k_${k.player_id}_${k.time}`;
                            if (!miniReplay.playedReplayEvents.has(key)) {
                                miniReplay.playedReplayEvents.add(key);
                                if (k.hit_ball) {
                                    const isFire = replayFrameData.ball && replayFrameData.ball.on_fire;
                                    if (isFire) {
                                        MiniAudio.playRandom("fire_kick", ["fire_kick_1.mp3", "fire_kick_2.mp3", "fire_kick_3.mp3"], 0.7);
                                    } else {
                                        MiniAudio.playRandom("kick", ["kick_1.mp3", "kick_2.mp3"], 0.5);
                                    }
                                }
                            }
                        });
                    }

                    if (replayFrameData.hit_events && replayFrameData.hit_events.length > 0) {
                        replayFrameData.hit_events.forEach(h => {
                            const key = `h_${h.type}_${h.time}`;
                            if (!miniReplay.playedReplayEvents.has(key)) {
                                miniReplay.playedReplayEvents.add(key);
                                if (h.type === "wall") {
                                    MiniAudio.playRandom("wall", ["wall_hit_1.mp3", "wall_hit_2.mp3"], 0.4);
                                } else if (h.type === "post") {
                                    MiniAudio.play("post_hit.mp3", 0.6);
                                }
                            }
                        });
                    }
                }
            }
        }

        const renderTime = performance.now() - (miniData.interpDelay || 45);
        const snaps = miniData.snapshots;
        
        if (snaps.length >= 2) {
            let before = null;
            let after = null;
            for (let i = snaps.length - 2; i >= 0; i--) {
                if (snaps[i].t <= renderTime && snaps[i + 1].t >= renderTime) {
                    before = snaps[i];
                    after = snaps[i + 1];
                    break;
                }
            }
            
            if (before && after) {
                const span = after.t - before.t;
                const alpha = span > 0 ? Math.max(0, Math.min(1, (renderTime - before.t) / span)) : 0;
                
                for (const pid in after.players) {
                    if (before.players && before.players[pid]) {
                        const bx = before.players[pid].x;
                        const by = before.players[pid].y;
                        const ax = after.players[pid].x;
                        const ay = after.players[pid].y;
                        miniData.currentPositions["p" + pid] = {
                            x: bx + (ax - bx) * alpha,
                            y: by + (ay - by) * alpha
                        };
                    } else {
                        miniData.currentPositions["p" + pid] = {
                            x: after.players[pid].x,
                            y: after.players[pid].y
                        };
                    }
                }
                
                if (before.ball && after.ball) {
                    miniData.currentPositions.ball = {
                        x: before.ball.x + (after.ball.x - before.ball.x) * alpha,
                        y: before.ball.y + (after.ball.y - before.ball.y) * alpha
                    };
                }
            } else if (snaps.length > 0) {
                const last = snaps[snaps.length - 1];
                for (const pid in last.players) {
                    const cur = miniData.currentPositions["p" + pid];
                    if (cur) {
                        cur.x += (last.players[pid].x - cur.x) * 0.4;
                        cur.y += (last.players[pid].y - cur.y) * 0.4;
                    } else {
                        miniData.currentPositions["p" + pid] = { x: last.players[pid].x, y: last.players[pid].y };
                    }
                }
                if (last.ball) {
                    const curB = miniData.currentPositions.ball;
                    if (curB) {
                        curB.x += (last.ball.x - curB.x) * 0.4;
                        curB.y += (last.ball.y - curB.y) * 0.4;
                    } else {
                        miniData.currentPositions.ball = { x: last.ball.x, y: last.ball.y };
                    }
                }
            }
        }
        
        const kickedPlayers = {};  
        if (state.kick_effects && state.kick_effects.length > 0) {
            const now = performance.now() / 1000;
            state.kick_effects.forEach(k => {
                if (now - k.time < 0.3) {
                    kickedPlayers[k.player_id] = k.energy_at_kick || 1.0;
                }
            });
        }
        const kickedPlayerIds = new Set(Object.keys(kickedPlayers).map(k => parseInt(k)));

        if (kickedPlayerIds.size > 0) {
            if (!miniData._lastKickFrame) miniData._lastKickFrame = new Set();

            const hitMap = {};
            const sprintMap = {};
            if (state.kick_effects) {
                state.kick_effects.forEach(k => {
                    if (k.hit_ball) hitMap[k.player_id] = true;
                    if (k.energy_at_kick !== undefined) sprintMap[k.player_id] = k.energy_at_kick;
                });
            }

            kickedPlayerIds.forEach(pid => {
                if (miniData._lastKickFrame.has(pid)) return;
                if (!hitMap[pid]) return;
                
                miniData._lastKickFrame.add(pid);

                const isFireKick = state.ball && state.ball.on_fire === true;
                if (isFireKick) {
                    MiniAudio.playRandom("fire_kick", ["fire_kick_1.mp3", "fire_kick_2.mp3", "fire_kick_3.mp3"], 0.7);
                } else {
                    MiniAudio.playRandom("kick", ["kick_1.mp3", "kick_2.mp3"], 0.5);
                }
                
                if (pid === miniData.playerId) {
                    if (isFireKick) {
                        MiniVibration.firekick();
                    } else {
                        const sprintActive = (sprintMap[pid] || 0) > 0.5;
                        MiniVibration.kick(sprintActive);
                    }
                }
            });
        }
        
        if (miniData._lastKickFrame) {
            const activeIds = new Set();
            if (state.kick_effects) {
                const now = performance.now() / 1000;
                state.kick_effects.forEach(k => {
                    if (now - k.time < 0.3) activeIds.add(k.player_id);
                });
            }
            for (const pid of miniData._lastKickFrame) {
                if (!activeIds.has(pid)) miniData._lastKickFrame.delete(pid);
            }
        }

        if (state.hit_events && state.hit_events.length > 0) {
            if (!miniData._playedHits) miniData._playedHits = new Set();
            if (!miniData._teamPostHits) miniData._teamPostHits = { red: 0, blue: 0 };
            const nowHit = performance.now() / 1000;

            state.hit_events.forEach(h => {
                const key = `${h.type}_${h.time}`;
                if (miniData._playedHits.has(key)) return;
                if (nowHit - h.time > 0.3) return;

                miniData._playedHits.add(key);

                if (h.type === "wall") {
                    MiniAudio.playRandom("wall", ["wall_hit_1.mp3", "wall_hit_2.mp3"], 0.4);
                    if (state.ball && state.ball.last_toucher === miniData.playerId) {
                        MiniVibration.wallHit();
                    }
                } else if (h.type === "post") {
                    MiniAudio.play("post_hit.mp3", 0.6);
                    MiniVibration.postHit();

                    const lastToucherId = state.ball && state.ball.last_toucher;
                    if (lastToucherId) {
                        const shooter = miniData.players.find(p => p.id === lastToucherId);
                        if (shooter && (shooter.team === "red" || shooter.team === "blue")) {
                            miniData._teamPostHits[shooter.team] = (miniData._teamPostHits[shooter.team] || 0) + 1;
                        }
                    }
                }
            });

            if (miniData._playedHits.size > 100) {
                miniData._playedHits.clear();
            }
        }
        
        if (miniData.predictionActive && typeof updateMiniPrediction === "function") {
            updateMiniPrediction();
        }
        
        if (miniData.playerId !== 1 && typeof syncLocalHPWithServer === "function") {
            syncLocalHPWithServer();
        }
        
        const allowTrail = (state.game_state === "goal_wait");
        
        if (allowTrail) {
            const playersSource = (isReplayMode && replayFrameData && replayFrameData.players) ? replayFrameData.players : state.players;
            for (const pid in playersSource) {
                const pData = playersSource[pid];
                if (!pData) continue;
                const celType = pData.celebration_type || "grow_explode";
                if (celType === "rainbow_trail" && pData.celebrating && pData.trail && pData.trail.length > 0) {
                    const trail = pData.trail;
                    const timeShift = (Date.now() / 100) % 360;
                    
                    let trailTeam = null;
                    const trailPlayer = miniData.players.find(p => p.id === parseInt(pid));
                    if (trailPlayer) trailTeam = trailPlayer.team;
                    
                    const tName = (trailTeam === "red") ? miniData.redTeamName : (trailTeam === "blue" ? miniData.blueTeamName : "");
                    const normName = (tName || "").trim().toLowerCase();
                    
                    let customColors = null;
                    if (normName === "türkiye" || normName === "turkiye") {
                        customColors = ["#e30a17", "#ffffff"];
                    } else if (normName === "azerbaycan" || normName === "azerbaijan") {
                        customColors = ["#00b5e2", "#e32118", "#38a047"];
                    } else if (["beşiktaş", "besiktas", "bjk"].includes(normName)) {
                        customColors = ["#111111", "#ffffff"];
                    } else if (["galatasaray", "gs"].includes(normName)) {
                        customColors = ["#a90429", "#fdb913"];
                    } else if (["fenerbahçe", "fenerbahce", "fb"].includes(normName)) {
                        customColors = ["#00205b", "#ffed00"];
                    } else if (["trabzonspor", "ts"].includes(normName)) {
                        customColors = ["#700018", "#4ab3e8"];
                    }
                    
                    for (let i = 0; i < trail.length; i++) {
                        const pt = trail[i];
                        const age = (trail.length - i) / trail.length;
                        const alpha = 1 - age * 0.85;
                        const size = cfg.player_radius * (0.9 - age * 0.7);

                        if (customColors && customColors.length > 0) {
                            const tVal = (i * 0.25 + Date.now() / 180) % customColors.length;
                            const idx1 = Math.floor(tVal);
                            const idx2 = (idx1 + 1) % customColors.length;
                            const frac = tVal - idx1;
                            
                            const c1 = hexToRgbParts(customColors[idx1]);
                            const c2 = hexToRgbParts(customColors[idx2]);
                            
                            const r = Math.round(c1.r + (c2.r - c1.r) * frac);
                            const g = Math.round(c1.g + (c2.g - c1.g) * frac);
                            const b = Math.round(c1.b + (c2.b - c1.b) * frac);
                            
                            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.8})`;
                            ctx.shadowBlur = 12;
                            ctx.shadowColor = `rgb(${r}, ${g}, ${b})`;
                        } else {
                            const hue = (i * 25 + timeShift) % 360;
                            ctx.fillStyle = `hsla(${hue}, 100%, 55%, ${alpha * 0.7})`;
                            ctx.shadowBlur = 15;
                            ctx.shadowColor = `hsla(${hue}, 100%, 60%, ${alpha})`;
                        }

                        ctx.beginPath();
                        ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    ctx.shadowBlur = 0;
                }
            }
        }

        updateAndDrawCelebrationParticles(ctx);

        let frostbiteActive = false;
        if (!isReplayMode && state.game_state === "goal_wait") {
            for (const fpid in state.players) {
                const fp = state.players[fpid];
                if (fp && fp.celebrating && fp.celebration_type === "frostbite") {
                    frostbiteActive = true;
                    break;
                }
            }
        }

        if (frostbiteActive) {
            ctx.save();
            const M = 55;
            const totalW = cfg.width + M * 2;
            const totalH = cfg.height + M * 2;

            if (miniData.iceImage && miniData.iceImage.complete) {
                ctx.save();
                try { ctx.filter = "blur(6px)"; } catch(e) {}
                ctx.globalAlpha = 0.82;
                ctx.drawImage(miniData.iceImage, -M, -M, totalW, totalH);
                
                try { ctx.filter = "none"; } catch(e) {}
                ctx.beginPath();
                ctx.rect(0, 0, cfg.width, cfg.height);
                ctx.clip();
                ctx.globalAlpha = 0.88;
                ctx.drawImage(miniData.iceImage, -M, -M, totalW, totalH);
                ctx.restore();
            } else {
                ctx.fillStyle = "rgba(130, 172, 220, 0.90)";
                ctx.fillRect(-M, -M, totalW, totalH);
            }

            if (!miniData._snowflakes) {
                miniData._snowflakes = [];
                for (let s = 0; s < 70; s++) {
                    miniData._snowflakes.push({
                        x: -M + Math.random() * totalW,
                        y: -M + Math.random() * totalH,
                        r: 1.2 + Math.random() * 3.0,
                        spd: 0.5 + Math.random() * 1.3,
                        drift: (Math.random() - 0.5) * 0.6,
                        a: 0.4 + Math.random() * 0.5
                    });
                }
            }
            for (const sn of miniData._snowflakes) {
                sn.y += sn.spd;
                sn.x += sn.drift + Math.sin(Date.now() / 800 + sn.y * 0.02) * 0.2;
                if (sn.y > cfg.height + M) { sn.y = -M - 5; sn.x = -M + Math.random() * totalW; }
                if (sn.x < -M) sn.x = cfg.width + M;
                if (sn.x > cfg.width + M) sn.x = -M;

                ctx.fillStyle = `rgba(255, 255, 255, ${sn.a})`;
                ctx.beginPath();
                ctx.arc(sn.x, sn.y, sn.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        } else {
            miniData._snowflakes = null;
        }
        
        // 🌌 Karadelik sevinci aktif mi kontrolü (Replay Desteği Dahil - Doğru Zamanlama)
        const activeCel = (isReplayMode && replayFrameData && replayFrameData.goal_celebration)
            ? replayFrameData.goal_celebration
            : state.goal_celebration;
        const currentGameState = isReplayMode ? (replayFrameData.game_state || "playing") : state.game_state;
        const gType = activeCel ? (activeCel.celebration_type || activeCel.type || activeCel) : "";
        const isBlackHoleActive = (currentGameState === "goal_wait" && (gType === "black_hole" || gType === "cosmic_blackhole"));

        // (İptal) Eski mor merkez karadelik çizimi kaldırıldı (CSS/DOM kaledeki karadelik kullanılıyor).

        for (const pid in state.players) {
            const pidInt = parseInt(pid, 10);
            const rawP = (isReplayMode && replayFrameData && replayFrameData.players && replayFrameData.players[pid]) ? replayFrameData.players[pid] : state.players[pid];

            // 🧤 Sunucu tarafından explicitly gizlenen veya silinen oyuncuları anında çizimden kaldır (Gereksiz render koruması)
            if (rawP && (rawP.invisible === true || rawP._exploded === true)) {
                continue;
            }

            let smoothPos;
            if (isReplayMode && replayFrameData && replayFrameData.players[pid]) {
                smoothPos = {
                    x: replayFrameData.players[pid].x,
                    y: replayFrameData.players[pid].y
                };
            } else if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running &&
                       HP.room?.gameState?.players?.[pid]) {
                const hpPlayer = HP.room.gameState.players[pid];
                smoothPos = { x: hpPlayer.x, y: hpPlayer.y };
            } else {
                smoothPos = miniData.currentPositions["p" + pid] || state.players[pid];
            }
            
            const p = { x: smoothPos.x, y: smoothPos.y };
            const isMe = pidInt === miniData.playerId;

            // Sunucunun anlık ölçek değerine (`tp.scale`) göre gerçek yarıçapı hesapla
            let currentRadius = cfg.player_radius;
            if (rawP && typeof rawP.scale === "number") {
                currentRadius *= rawP.scale;
            }

            let skipPlayerDraw = false;

            // 🌌 Oyuncuları Karadeliğe Çeken Algoritma (Replay Dahil + Hedef Kale Koordinatı)
            if (isBlackHoleActive) {
                let bhX = cfg.width / 2;
                let bhY = cfg.height / 2;
                const srcState = (isReplayMode && replayFrameData) ? replayFrameData : state;
                if (typeof srcState.bhX === "number") {
                    bhX = srcState.bhX;
                    bhY = srcState.bhY;
                } else if (activeCel) {
                    const scorerTeamId = activeCel.scorer_id;
                    bhX = (scorerTeamId === 1) ? cfg.width : 0; 
                }

                const dx = bhX - p.x;
                const dy = bhY - p.y;
                const dist = Math.hypot(dx, dy);
                
                const elapsed = Math.max(0, 5.0 - activeCel.wait_remaining);
                const pullStrength = Math.min(1.0, elapsed / 3.8);

                if (pullStrength > 0.02) {
                    const orbitAngle = Math.atan2(dy, dx) + pullStrength * 7.5;
                    const newDist = dist * (1.0 - pullStrength * 0.98);
                    
                    p.x = bhX - Math.cos(orbitAngle) * newDist;
                    p.y = bhY - Math.sin(orbitAngle) * newDist;
                    
                    currentRadius = cfg.player_radius * Math.max(0.01, 1.0 - pullStrength * 0.96);
                    
                    if (newDist < 10) {
                        skipPlayerDraw = true;
                    }
                }
            }
            
            let playerTeam = null;
            const playerInfo = miniData.players.find(pl => pl.id === parseInt(pid));
            if (playerInfo) {
                playerTeam = playerInfo.team;
            } else {
                if (parseInt(pid) === (miniData.gameState?.red_pid)) playerTeam = "red";
                else if (parseInt(pid) === (miniData.gameState?.blue_pid)) playerTeam = "blue";
            }
            
            const color = playerTeam === "blue" ? (miniData.blueTeamColor || "#4dabf7") : (miniData.redTeamColor || "#ff6b6b");
            const justKicked = kickedPlayerIds.has(parseInt(pid));
            
            // Güvenli Sevinç Tipi Belirleme (Obje/String Korumalı)
            let celType = "grow_explode";
            if (rawP && rawP.celebrating) {
                celType = rawP.celebration_type || (rawP.celebration && rawP.celebration.type) || rawP.celebration || "grow_explode";
            }
            
            // 🛸 UZAY GEMİSİ (UFO ABDUCTION) KONTROLÜ VE ANİMASYONU (Replay Desteği Dahil)
            // 🔥 FİX: Sadece golü atan oyuncuya UFO gelsin. Ortada duran hayalet UFO'ları engeller!
            const _gCel = (isReplayMode && replayFrameData && replayFrameData.goal_celebration)
                ? replayFrameData.goal_celebration
                : state.goal_celebration;
            const _isScorer = _gCel && (parseInt(_gCel.scorer_pid || _gCel.scorer_id) === pidInt);
            const _ufoT = (isReplayMode && replayFrameData) ? replayFrameData.ufoTargetPid : state.ufoTargetPid;
            const _isUfoTarget = (_ufoT !== undefined && _ufoT !== null) ? (parseInt(_ufoT) === pidInt) : _isScorer;
            
            const isUfo = rawP && rawP.celebrating && _isUfoTarget && ["ufo", "ufo_abduction", "ufo_abduct", "alien", "spaceship", "uzay_gemisi"].includes(celType);
            
            if (isUfo) {
                const nowUfo = performance.now() / 1000;
                const celStartUfo = rawP.celebration_start || 0;
                const syncUfo = (rawP.celebration_elapsed !== undefined) ? rawP.celebration_elapsed : Math.max(0, nowUfo - celStartUfo);
                let pnameUfo = miniData.playerNames[pid] || `P${pid}`;

                const ufoRes = drawUfoAbductionCelebration(ctx, cfg, p, syncUfo, color, playerTeam, pnameUfo, cfg.player_radius);
                if (ufoRes && ufoRes.skipPlayerDraw) {
                    continue; // Oyuncu UFO içine çekildi veya kaçıyor, yerdeki dairesini çizme!
                }
            }

            if (rawP && rawP.celebrating) {
                const celStart = rawP.celebration_start || 0;

                const nowSec = performance.now() / 1000;
                const celElapsed = Math.max(0, nowSec - celStart);
                
                const syncElapsed = rawP.celebration_elapsed !== undefined ? rawP.celebration_elapsed : celElapsed;

                if (celType === "grow_explode") {
                    if (syncElapsed < 3.8) {
                        const growProgress = Math.min(1.0, syncElapsed / 3.8);
                        const jiggle = Math.sin(syncElapsed * 28) * (2 + growProgress * 4);
                        currentRadius = cfg.player_radius * (1.0 + growProgress * 2.6) + jiggle * 0.2;
                        
                        ctx.save();
                        const knotY = p.y + currentRadius + 2;
                        const knotSize = 5 + growProgress * 4;
                        ctx.fillStyle = shadeHexColor(color, -0.2);
                        ctx.beginPath();
                        ctx.moveTo(p.x - knotSize, knotY + knotSize);
                        ctx.lineTo(p.x + knotSize, knotY + knotSize);
                        ctx.lineTo(p.x, knotY - 2);
                        ctx.closePath();
                        ctx.fill();
                        
                        const balloonGrad = ctx.createRadialGradient(
                            p.x - currentRadius * 0.3, p.y - currentRadius * 0.3, currentRadius * 0.1, p.x, p.y, currentRadius
                        );
                        balloonGrad.addColorStop(0, "#ffffff");
                        balloonGrad.addColorStop(0.3, color);
                        balloonGrad.addColorStop(1, shadeHexColor(color, -0.35));
                        
                        ctx.shadowBlur = 20 * growProgress;
                        ctx.shadowColor = color;
                        ctx.fillStyle = balloonGrad;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
                        ctx.fill();
                        
                        ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
                        ctx.beginPath();
                        ctx.arc(p.x - currentRadius * 0.35, p.y - currentRadius * 0.35, currentRadius * 0.25, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.restore();
                    } else {
                        skipPlayerDraw = true;
                        const expKey = pid + "_" + celStart;
                        if (!miniData._explodedKeys) miniData._explodedKeys = new Set();
                        
                        if (!miniData._explodedKeys.has(expKey)) {
                            miniData._explodedKeys.add(expKey);
                            triggerPlayerExplosion(p.x, p.y, color);
                        }
                    }
                } else if (celType === "spotlight") {
                    if (!isReplayMode && syncElapsed < 5.0) {
                        ctx.save();
                        const spotRadius = 240; 
                        const darkGrad = ctx.createRadialGradient(p.x, p.y, 25, p.x, p.y, spotRadius);
                        darkGrad.addColorStop(0, "rgba(0, 0, 0, 0)");
                        darkGrad.addColorStop(0.35, "rgba(0, 0, 0, 0.25)");
                        darkGrad.addColorStop(0.7, "rgba(0, 0, 0, 0.72)");
                        darkGrad.addColorStop(1, "rgba(0, 0, 0, 0.82)");
                        
                        ctx.fillStyle = darkGrad;
                        ctx.fillRect(-cfg.player_radius * 10, -cfg.player_radius * 10, cfg.width * 3, cfg.height * 3);

                        const glowRadius = cfg.player_radius * 1.6;
                        const pulse = Math.sin(syncElapsed * 10) * 0.2 + 0.8;
                        
                        ctx.shadowBlur = 25 * pulse;
                        ctx.shadowColor = "#ffffff";
                        ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
                        ctx.lineWidth = 3.5;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2);
                        ctx.stroke();

                        const beamGrad = ctx.createLinearGradient(p.x, p.y - 250, p.x, p.y);
                        beamGrad.addColorStop(0, "rgba(255, 255, 255, 0)");
                        beamGrad.addColorStop(0.7, "rgba(255, 255, 255, 0.15)");
                        beamGrad.addColorStop(1, "rgba(255, 255, 255, 0.45)");

                        ctx.fillStyle = beamGrad;
                        ctx.beginPath();
                        ctx.moveTo(p.x - 30, p.y - 250);
                        ctx.lineTo(p.x + 30, p.y - 250);
                        ctx.lineTo(p.x + cfg.player_radius + 12, p.y + cfg.player_radius);
                        ctx.lineTo(p.x - cfg.player_radius - 12, p.y + cfg.player_radius);
                        ctx.closePath();
                        ctx.fill();
                        ctx.restore();
                    }
                } else if (celType === "lightning") {
                    if (syncElapsed < 4.0) {
                        ctx.save();
                        const auraRadius = cfg.player_radius + 6 + Math.sin(syncElapsed * 25) * 3;
                        ctx.shadowBlur = 20;
                        ctx.shadowColor = "#00f0ff";
                        ctx.strokeStyle = "#00f0ff";
                        ctx.lineWidth = 3;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, auraRadius, 0, Math.PI * 2);
                        ctx.stroke();

                        if (Math.random() < 0.45) {
                            ctx.strokeStyle = Math.random() < 0.5 ? "#ffffff" : "#00f0ff";
                            ctx.lineWidth = 2 + Math.random() * 3;
                            ctx.shadowBlur = 15;
                            ctx.shadowColor = "#00f0ff";
                            ctx.beginPath();
                            
                            let startX = p.x + (Math.random() - 0.5) * 50;
                            let startY = p.y - 280;
                            ctx.moveTo(startX, startY);
                            
                            const steps = 6;
                            for (let s = 1; s <= steps; s++) {
                                const targetY = startY + (280 / steps) * s;
                                const targetX = (s === steps) ? p.x : startX + (Math.random() - 0.5) * 35;
                                ctx.lineTo(targetX, targetY);
                                startX = targetX;
                                startY = targetY;
                            }
                            ctx.stroke();
                        }

                        for (let a = 0; a < 3; a++) {
                            const angle = Math.random() * Math.PI * 2;
                            const r1 = cfg.player_radius * 0.7;
                            const r2 = cfg.player_radius * (1.4 + Math.random() * 0.8);
                            const x1 = p.x + Math.cos(angle) * r1;
                            const y1 = p.y + Math.sin(angle) * r1;
                            const x2 = p.x + Math.cos(angle) * r2 + (Math.random() - 0.5) * 10;
                            const y2 = p.y + Math.sin(angle) * r2 + (Math.random() - 0.5) * 10;

                            ctx.strokeStyle = "#ffffff";
                            ctx.lineWidth = 2;
                            ctx.beginPath();
                            ctx.moveTo(x1, y1);
                            ctx.lineTo((x1 + x2) / 2 + (Math.random() - 0.5) * 8, (y1 + y2) / 2 + (Math.random() - 0.5) * 8);
                            ctx.lineTo(x2, y2);
                            ctx.stroke();
                        }
                        ctx.restore();
                    }
                }
            }
            
            if (skipPlayerDraw) continue;

            const isSmiley = rawP && rawP.celebrating && (rawP.celebration_type || "") === "smiley_face";
            if (isSmiley) {
                const R = currentRadius;
                const nowS = performance.now() / 1000;
                const celStartS = rawP.celebration_start || 0;
                const syncS = (rawP.celebration_elapsed !== undefined) ? rawP.celebration_elapsed : Math.max(0, nowS - celStartS);
                const bounce = Math.sin(syncS * 10) * 2.5;

                ctx.save();
                ctx.translate(0, bounce);

                ctx.fillStyle = "rgba(0,0,0,0.35)";
                ctx.beginPath();
                ctx.ellipse(p.x + 2, p.y + R * 0.85, R * 0.85, R * 0.28, 0, 0, Math.PI * 2);
                ctx.fill();

                const faceGrad = ctx.createRadialGradient(p.x - R * 0.25, p.y - R * 0.3, R * 0.1, p.x, p.y, R);
                faceGrad.addColorStop(0, "#ffe566");
                faceGrad.addColorStop(0.55, "#ffd43b");
                faceGrad.addColorStop(1, "#f59f00");
                ctx.fillStyle = faceGrad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = "rgba(0,0,0,0.35)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
                ctx.stroke();

                const eyeY = p.y - R * 0.18;
                const eyeDX = R * 0.28;
                const eyeR = Math.max(2.2, R * 0.11);
                ctx.fillStyle = "#1a1b1e";
                ctx.beginPath();
                ctx.arc(p.x - eyeDX, eyeY, eyeR, 0, Math.PI * 2);
                ctx.arc(p.x + eyeDX, eyeY, eyeR, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(p.x - eyeDX - eyeR * 0.25, eyeY - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
                ctx.arc(p.x + eyeDX - eyeR * 0.25, eyeY - eyeR * 0.3, eyeR * 0.35, 0, Math.PI * 2);
                ctx.fill();

                ctx.strokeStyle = "#1a1b1e";
                ctx.lineWidth = Math.max(2.5, R * 0.12);
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.arc(p.x, p.y + R * 0.08, R * 0.42, 0.15 * Math.PI, 0.85 * Math.PI);
                ctx.stroke();

                ctx.fillStyle = "rgba(255, 107, 107, 0.35)";
                ctx.beginPath();
                ctx.ellipse(p.x - R * 0.42, p.y + R * 0.12, R * 0.14, R * 0.1, 0, 0, Math.PI * 2);
                ctx.ellipse(p.x + R * 0.42, p.y + R * 0.12, R * 0.14, R * 0.1, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                let pname = miniData.playerNames[pid] || `P${pid}`;
                ctx.font = `bold 14px Segoe UI`;
                ctx.textAlign = "center";
                ctx.shadowBlur = 5;
                ctx.shadowColor = "#000";
                ctx.fillStyle = "#ffd43b";
                ctx.fillText(pname, p.x, p.y - R - 12);
                ctx.shadowBlur = 0;
                continue;
            }

            const isEagle = rawP && rawP.celebrating && (rawP.celebration_type || "") === "eagle_wings";
            let hoverY = 0;
            if (isEagle) {
                const R = currentRadius; 
                const nowE = performance.now() / 1000;
                const celStartE = rawP.celebration_start || 0;
                const syncE = (rawP.celebration_elapsed !== undefined) ? rawP.celebration_elapsed : Math.max(0, nowE - celStartE);

                const flapAngle = Math.sin(syncE * 14) * 0.55;
                hoverY = Math.sin(syncE * 5) * 8 - 18;

                if (!miniData._eagleFeathers) miniData._eagleFeathers = [];
                if (Math.random() < 0.40 && miniData._eagleFeathers.length < 40) {
                    miniData._eagleFeathers.push({
                        x: p.x + (Math.random() - 0.5) * R * 2.5,
                        y: p.y + hoverY + (Math.random() - 0.5) * R,
                        vx: (Math.random() - 0.5) * 1.2,
                        vy: 0.8 + Math.random() * 1.5,
                        rot: Math.random() * Math.PI * 2,
                        rotSpd: (Math.random() - 0.5) * 0.15,
                        size: 2.5 + Math.random() * 5.5,
                        alpha: 1.0,
                        color: Math.random() < 0.45 ? "#ffffff" : "#141414"
                    });
                }

                ctx.save();
                for (let f = miniData._eagleFeathers.length - 1; f >= 0; f--) {
                    const ftr = miniData._eagleFeathers[f];
                    ftr.x += ftr.vx + Math.sin(Date.now() / 400 + ftr.y) * 0.3;
                    ftr.y += ftr.vy;
                    ftr.rot += ftr.rotSpd;
                    ftr.alpha -= 0.015;

                    if (ftr.alpha <= 0) {
                        miniData._eagleFeathers.splice(f, 1);
                        continue;
                    }

                    ctx.save();
                    ctx.translate(ftr.x, ftr.y);
                    ctx.rotate(ftr.rot);
                    ctx.fillStyle = ftr.color;
                    ctx.globalAlpha = Math.max(0, ftr.alpha);
                    ctx.shadowBlur = ftr.color === "#ffffff" ? 4 : 0;
                    ctx.shadowColor = "#ffffff";
                    ctx.beginPath();
                    ctx.ellipse(0, 0, ftr.size, ftr.size * 0.35, 0, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }
                ctx.restore();

                ctx.save();
                const shadowScale = Math.max(0.5, 1.0 - Math.abs(hoverY) * 0.022);
                ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
                ctx.beginPath();
                ctx.ellipse(p.x, p.y + 10, R * 1.2 * shadowScale, R * 0.4 * shadowScale, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                const drawMajesticWing = (side) => {
                    ctx.save();
                    ctx.translate(p.x, p.y + hoverY);
                    ctx.scale(side, 1);
                    ctx.rotate(flapAngle);

                    for (let layer = 0; layer < 4; layer++) {
                        const ptVal = [1.2, 1.6, 2.1, 2.5][layer];
                        const featherLen = R * ptVal;
                        const featherAngle = -0.15 + (layer * 0.18);

                        ctx.save();
                        ctx.rotate(featherAngle);

                        const wingGrad = ctx.createLinearGradient(R * 0.5, 0, featherLen, 0);
                        wingGrad.addColorStop(0, "#0e0e10");
                        wingGrad.addColorStop(0.5, "#22252a");
                        wingGrad.addColorStop(0.85, "#495057");
                        wingGrad.addColorStop(1, "#f8f9fa");

                        ctx.fillStyle = wingGrad;
                        ctx.strokeStyle = "rgba(255,255,255,0.22)";
                        ctx.lineWidth = 1;
                        
                        ctx.beginPath();
                        ctx.moveTo(R * 0.4, 0);
                        ctx.quadraticCurveTo(featherLen * 0.7, -R * 0.22, featherLen, 0);
                        ctx.quadraticCurveTo(featherLen * 0.7, R * 0.22, R * 0.4, R * 0.12);
                        ctx.closePath();
                        ctx.fill();
                        ctx.stroke();
                        ctx.restore();
                    }
                    ctx.restore();
                };

                drawMajesticWing(-1);
                drawMajesticWing(1);
                p.y += hoverY;
            }

            const isSnake = rawP && rawP.celebrating && (rawP.celebration_type || "") === "snake";
            if (isSnake) {
                const R = currentRadius;
                const nowSn = performance.now() / 1000;
                const celStartSn = rawP.celebration_start || 0;
                const syncSn = (rawP.celebration_elapsed !== undefined) ? rawP.celebration_elapsed : Math.max(0, nowSn - celStartSn);

                let primaryColor = color;
                let secondaryColor = playerTeam === "blue" ? (miniData.blueSprintColor || "#ffd43b") : (miniData.redSprintColor || "#ffd43b");
                
                const tName = (playerTeam === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
                const normName = tName.trim().toLowerCase();

                let colorList = [primaryColor, secondaryColor];

                if (["beşiktaş", "besiktas", "bjk"].includes(normName)) {
                    colorList = ["#111111", "#ffffff"];
                } else if (["galatasaray", "gs"].includes(normName)) {
                    colorList = ["#a90429", "#fdb913"];
                } else if (["fenerbahçe", "fenerbahce", "fb"].includes(normName)) {
                    colorList = ["#00205b", "#ffed00"];
                } else if (["trabzonspor", "ts"].includes(normName)) {
                    colorList = ["#700018", "#4ab3e8"];
                } else if (["türkiye", "turkiye"].includes(normName)) {
                    colorList = ["#e30a17", "#ffffff"];
                } else if (["azerbaycan", "azerbaijan"].includes(normName)) {
                    colorList = ["#00b5e2", "#e32118", "#38a047"];
                }

                const snakeBaseColor = colorList[0];
                const snakeDarkColor = shadeHexColor(snakeBaseColor, -0.35);

                const snakeKey = "snake_" + pid;
                if (!miniData._snakeTrails) miniData._snakeTrails = {};
                if (!miniData._snakeTrails[snakeKey]) miniData._snakeTrails[snakeKey] = [];
                
                const trail = miniData._snakeTrails[snakeKey];
                trail.unshift({ x: p.x, y: p.y });
                if (trail.length > 22) trail.length = 22;
                
                for (let si = trail.length - 1; si >= 1; si--) {
                    const seg = trail[si];
                    const age = si / trail.length;
                    const segRadius = R * (0.85 - age * 0.55);
                    
                    if (segRadius < 2) continue;
                    
                    const pulseWave = Math.sin(syncSn * 8 + si * 0.5) * 0.08;
                    ctx.save();
                    
                    ctx.fillStyle = "rgba(0,0,0,0.3)";
                    ctx.beginPath();
                    ctx.arc(seg.x + 2, seg.y + 2, segRadius, 0, Math.PI * 2);
                    ctx.fill();
                    
                    const segColor = colorList[si % colorList.length];
                    const segLightColor = shadeHexColor(segColor, 0.3);
                    const segDarkColor = shadeHexColor(segColor, -0.35);

                    const segGrad = ctx.createRadialGradient(
                        seg.x - segRadius * 0.3, seg.y - segRadius * 0.3, segRadius * 0.1, seg.x, seg.y, segRadius
                    );
                    segGrad.addColorStop(0, segLightColor);
                    segGrad.addColorStop(0.5, segColor);
                    segGrad.addColorStop(1, segDarkColor);
                    
                    ctx.fillStyle = segGrad;
                    ctx.globalAlpha = 1.0 - age * 0.15;
                    ctx.beginPath();
                    ctx.arc(seg.x, seg.y, segRadius, 0, Math.PI * 2);
                    ctx.fill();
                    
                    if (si % 3 === 0) {
                        ctx.fillStyle = `rgba(255, 255, 255, ${0.15 + pulseWave})`;
                        ctx.beginPath();
                        const ds = segRadius * 0.45;
                        ctx.moveTo(seg.x, seg.y - ds);
                        ctx.lineTo(seg.x + ds * 0.6, seg.y);
                        ctx.lineTo(seg.x, seg.y + ds);
                        ctx.lineTo(seg.x - ds * 0.6, seg.y);
                        ctx.closePath();
                        ctx.fill();
                    }
                    
                    ctx.strokeStyle = `rgba(0, 0, 0, ${0.25 - age * 0.15})`;
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    ctx.arc(seg.x, seg.y, segRadius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }
                
                ctx.save();
                ctx.translate(p.x, p.y);
                
                let headAngle = 0;
                if (trail.length >= 2) {
                    const dx = trail[0].x - trail[1].x;
                    const dy = trail[0].y - trail[1].y;
                    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
                        headAngle = Math.atan2(dy, dx);
                    }
                }
                ctx.rotate(headAngle);
                
                ctx.fillStyle = "rgba(0,0,0,0.35)";
                ctx.beginPath();
                ctx.ellipse(2, 2, R * 1.1, R * 0.85, 0, 0, Math.PI * 2);
                ctx.fill();
                
                const headColor = colorList[0];
                const headLight = shadeHexColor(headColor, 0.3);
                const headDark = shadeHexColor(headColor, -0.35);

                const headGrad = ctx.createRadialGradient(-R * 0.2, -R * 0.15, R * 0.1, 0, 0, R * 1.05);
                headGrad.addColorStop(0, headLight);
                headGrad.addColorStop(0.5, headColor);
                headGrad.addColorStop(1, headDark);
                
                ctx.fillStyle = headGrad;
                ctx.beginPath();
                ctx.ellipse(0, 0, R * 1.1, R * 0.85, 0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.strokeStyle = "rgba(0,0,0,0.4)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(0, 0, R * 1.1, R * 0.85, 0, 0, Math.PI * 2);
                ctx.stroke();
                
                ctx.fillStyle = snakeDarkColor;
                ctx.beginPath();
                ctx.moveTo(R * 0.85, 0);
                ctx.lineTo(R * 0.4, -R * 0.35);
                ctx.lineTo(R * 0.5, 0);
                ctx.lineTo(R * 0.4, R * 0.35);
                ctx.closePath();
                ctx.fill();
                
                const eyeOffsetX = R * 0.2;
                const eyeOffsetY = R * 0.35;
                const eyeR = R * 0.18;
                
                ctx.fillStyle = "#ffd43b";
                ctx.shadowBlur = 6;
                ctx.shadowColor = "#ffd43b";
                ctx.beginPath();
                ctx.arc(-eyeOffsetX, -eyeOffsetY, eyeR, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                
                ctx.fillStyle = "#111111";
                ctx.beginPath();
                ctx.ellipse(-eyeOffsetX, -eyeOffsetY, eyeR * 0.3, eyeR * 0.9, 0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(-eyeOffsetX - eyeR * 0.25, -eyeOffsetY - eyeR * 0.3, eyeR * 0.2, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = "#ffd43b";
                ctx.shadowBlur = 6;
                ctx.shadowColor = "#ffd43b";
                ctx.beginPath();
                ctx.arc(-eyeOffsetX, eyeOffsetY, eyeR, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
                
                ctx.fillStyle = "#111111";
                ctx.beginPath();
                ctx.ellipse(-eyeOffsetX, eyeOffsetY, eyeR * 0.3, eyeR * 0.9, 0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = "#ffffff";
                ctx.beginPath();
                ctx.arc(-eyeOffsetX - eyeR * 0.25, eyeOffsetY - eyeR * 0.3, eyeR * 0.2, 0, Math.PI * 2);
                ctx.fill();
                
                const tongueFlicker = Math.sin(syncSn * 18) * R * 0.15;
                const tongueLen = R * 0.7 + tongueFlicker;
                
                ctx.strokeStyle = "#e03131";
                ctx.lineWidth = 2.5;
                ctx.lineCap = "round";
                
                ctx.beginPath();
                ctx.moveTo(R * 0.9, 0);
                ctx.lineTo(R * 0.9 + tongueLen * 0.7, 0);
                ctx.stroke();
                
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(R * 0.9 + tongueLen * 0.7, 0);
                ctx.lineTo(R * 0.9 + tongueLen, -R * 0.15);
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(R * 0.9 + tongueLen * 0.7, 0);
                ctx.lineTo(R * 0.9 + tongueLen, R * 0.15);
                ctx.stroke();
                ctx.lineCap = "butt";
                ctx.restore();
                
                let pnameSn = miniData.playerNames[pid] || `P${pid}`;
                ctx.font = "bold 14px Segoe UI";
                ctx.textAlign = "center";
                ctx.shadowBlur = 5;
                ctx.shadowColor = "#000";
                ctx.fillStyle = colorList[0];
                ctx.fillText(pnameSn, p.x, p.y - R - 12);
                ctx.shadowBlur = 0;
                continue;
            }

            let spinRushAngle = 0;
            let isSpinRush = false;
            if (rawP && rawP.celebrating && (rawP.celebration_type || "") === "spin_rush") {
                isSpinRush = true;
                const nowSecSR = performance.now() / 1000;
                const celStartSR = rawP.celebration_start || 0;
                const syncSR = (rawP.celebration_elapsed !== undefined) ? rawP.celebration_elapsed : Math.max(0, nowSecSR - celStartSR);
                spinRushAngle = syncSR * Math.PI * 5;
            }

            if (isSpinRush) {
                ctx.save();
                const pulseR = currentRadius + 7 + Math.sin(performance.now() / 70) * 2.5;
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.45;
                ctx.lineWidth = 3;
                ctx.shadowBlur = 14;
                ctx.shadowColor = color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, pulseR, 0, Math.PI * 2);
                ctx.stroke();

                ctx.globalAlpha = 0.9;
                ctx.lineWidth = 3;
                ctx.lineCap = "round";
                ctx.beginPath();
                ctx.arc(p.x, p.y, currentRadius + 11, spinRushAngle, spinRushAngle + Math.PI * 0.65);
                ctx.stroke();
                ctx.beginPath();
                ctx.arc(p.x, p.y, currentRadius + 11, spinRushAngle + Math.PI, spinRushAngle + Math.PI + Math.PI * 0.65);
                ctx.stroke();

                ctx.globalAlpha = 1;
                ctx.shadowBlur = 8;
                for (let s = 0; s < 3; s++) {
                    const a = spinRushAngle + (s * Math.PI * 2) / 3;
                    const ox = p.x + Math.cos(a) * (currentRadius + 14);
                    const oy = p.y + Math.sin(a) * (currentRadius + 14);
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(ox, oy, 3.2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.fillStyle = "#ffffff";
                    ctx.beginPath();
                    ctx.arc(ox, oy, 1.4, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.lineCap = "butt";
                ctx.restore();
            }

            if (!isEagle) {
                ctx.fillStyle = "rgba(0,0,0,0.4)";
                ctx.beginPath();
                ctx.arc(p.x + 3, p.y + 3, currentRadius, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
            ctx.fill();
            
            let energyPercent = 1.0;
            let sprintActive = false;
            if (isReplayMode && replayFrameData && replayFrameData.players && replayFrameData.players[pid]) {
                const rPlayer = replayFrameData.players[pid];
                if (rPlayer.sprint) {
                    energyPercent = rPlayer.sprint.energy / rPlayer.sprint.max_energy;
                    sprintActive = rPlayer.sprint.active && rPlayer.sprint.energy > 1;
                }
            } else if (parseInt(pid) === miniData.playerId && miniData.playerId === 1 && 
                typeof HP !== 'undefined' && HP.running && HP.room?.gameState?.players?.[pid]) {
                const hpp = HP.room.gameState.players[pid];
                energyPercent = (hpp.sprint_energy || 0) / 100;
                sprintActive = hpp.keys.sprint && hpp.sprint_energy > 1;
            } else if (state.sprint && state.sprint[pid]) {
                const sprintData = state.sprint[pid];
                energyPercent = sprintData.energy / sprintData.max_energy;
                sprintActive = sprintData.active && sprintData.energy > 1;
            }
            
            const lineW = isMe ? 3 : 2;
            
            ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
            ctx.lineWidth = lineW;
            ctx.beginPath();
            ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
            ctx.stroke();
            
            let energyColor = playerTeam === "blue" ? (miniData.blueSprintColor || "#ffd43b") : (miniData.redSprintColor || "#ffd43b");
            let energyShadow = energyColor;

            const _azTeamName = (playerTeam === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
            const _azNorm = _azTeamName.trim().toLowerCase();
            if (["azerbaycan", "azerbaijan"].includes(_azNorm)) {
                const azGrad = ctx.createLinearGradient(p.x, p.y - currentRadius, p.x, p.y + currentRadius);
                azGrad.addColorStop(0, "#00b5e2");
                azGrad.addColorStop(0.32, "#00b5e2");
                azGrad.addColorStop(0.34, "#e32118");
                azGrad.addColorStop(0.66, "#e32118");
                azGrad.addColorStop(0.68, "#38a047");
                azGrad.addColorStop(1, "#38a047");
                energyColor = azGrad;
                energyShadow = "#ffffff";
            }
            
            if (energyPercent > 0.01 && (!rawP || !rawP.celebrating)) {
                ctx.strokeStyle = energyColor;
                ctx.lineWidth = lineW;
                ctx.lineCap = "round";
                
                if (sprintActive) {
                    ctx.shadowBlur = 12;
                    ctx.shadowColor = energyShadow;
                }
                
                const startAngle = -Math.PI / 2;
                const endAngle = startAngle - (Math.PI * 2 * energyPercent);
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, cfg.player_radius, startAngle, endAngle, true);
                ctx.stroke();
                ctx.shadowBlur = 0;
                ctx.lineCap = "butt";
            }
            
            if (justKicked) {
                const kickEnergyPercent = kickedPlayers[parseInt(pid)] || 1.0;
                const glowStrength = Math.max(0.15, kickEnergyPercent);
                
                const kickFireHex = playerTeam === "blue" ? (miniData.blueTeamColor || "#4dabf7") : (miniData.redTeamColor || "#ff6b6b");
                const kickFireRgb = hexToRgbParts(kickFireHex);
                const teamColorRGB = `${kickFireRgb.r}, ${kickFireRgb.g}, ${kickFireRgb.b}`;
                
                const innerGlow = glowStrength * 0.05;
                const innerGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, cfg.player_radius);
                innerGrad.addColorStop(0, `rgba(${teamColorRGB}, ${innerGlow})`);
                innerGrad.addColorStop(0.4, `rgba(${teamColorRGB}, ${innerGlow * 0.7})`);
                innerGrad.addColorStop(1, `rgba(${teamColorRGB}, 0)`);
                ctx.fillStyle = innerGrad;
                ctx.beginPath();
                ctx.arc(p.x, p.y, cfg.player_radius, 0, Math.PI * 2);
                ctx.fill();
                
                let sprintHex = playerTeam === "blue" ? (miniData.blueSprintColor || "#ffd43b") : (miniData.redSprintColor || "#ffd43b");
                let kickGlowColor = sprintHex;
                let kickGlowRGB = (() => {
                    const h = sprintHex.replace("#", "");
                    const n = parseInt(h.length === 3 ? h.split("").map(c=>c+c).join("") : h, 16);
                    return `${(n>>16)&255}, ${(n>>8)&255}, ${n&255}`;
                })();
                let kickStrokeStyle = `rgba(${kickGlowRGB}, ${glowStrength})`;

                const _azKickName = (playerTeam === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
                if (["azerbaycan", "azerbaijan"].includes(_azKickName.trim().toLowerCase())) {
                    const azGradKick = ctx.createLinearGradient(p.x, p.y - cfg.player_radius, p.x, p.y + cfg.player_radius);
                    azGradKick.addColorStop(0, `rgba(0, 181, 226, ${glowStrength})`);
                    azGradKick.addColorStop(0.32, `rgba(0, 181, 226, ${glowStrength})`);
                    azGradKick.addColorStop(0.34, `rgba(227, 33, 24, ${glowStrength})`);
                    azGradKick.addColorStop(0.66, `rgba(227, 33, 24, ${glowStrength})`);
                    azGradKick.addColorStop(0.68, `rgba(56, 160, 71, ${glowStrength})`);
                    azGradKick.addColorStop(1, `rgba(56, 160, 71, ${glowStrength})`);
                    kickStrokeStyle = azGradKick;
                    kickGlowColor = "#ffffff";
                }
                
                ctx.shadowBlur = 30 * glowStrength;
                ctx.shadowColor = kickGlowColor;
                ctx.strokeStyle = kickStrokeStyle;
                ctx.lineWidth = 4 + (2 * glowStrength);
                ctx.beginPath();
                ctx.arc(p.x, p.y, cfg.player_radius, 0, Math.PI * 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
            
            let isTurkeyTeam = false;
            let isAzerbaijanTeam = false;
            let isBesiktasTeam = false;
            let isGalatasarayTeam = false;
            let isFenerbahceTeam = false;
            let isTrabzonsporTeam = false;

            const matchTeam = (teamName, keywords) => {
                if (!teamName) return false;
                const n = teamName.trim().toLowerCase();
                return keywords.some(k => n === k);
            };

            const tName = (playerTeam === "red") ? miniData.redTeamName : miniData.blueTeamName;

            if (matchTeam(tName, ["türkiye", "turkiye"])) isTurkeyTeam = true;
            else if (matchTeam(tName, ["azerbaycan", "azerbaijan"])) isAzerbaijanTeam = true;
            else if (matchTeam(tName, ["beşiktaş", "besiktas", "bjk"])) isBesiktasTeam = true;
            else if (matchTeam(tName, ["galatasaray", "gs"])) isGalatasarayTeam = true;
            else if (matchTeam(tName, ["fenerbahçe", "fenerbahce", "fb"])) isFenerbahceTeam = true;
            else if (matchTeam(tName, ["trabzonspor", "ts"])) isTrabzonsporTeam = true;
            
            const kickGlow = justKicked ? 1.0 : 0;
            let kitNumber = null;

            const jerseyNumbersPool = [10, 7, 9, 11, 8, 1, 5, 4, 6, 2];
            const sameTeamPlayers = miniData.players.filter(pl => pl.team === playerTeam);
            const playerTeamIdx = sameTeamPlayers.findIndex(pl => pl.id === parseInt(pid));
            const defaultNum = jerseyNumbersPool[playerTeamIdx >= 0 ? playerTeamIdx % jerseyNumbersPool.length : 0];
            
            let jerseyNum = defaultNum;
            const pidStr = String(pid);
            if (miniData.persistentJerseys && miniData.persistentJerseys[pidStr] !== undefined) {
                jerseyNum = miniData.persistentJerseys[pidStr];
            } else {
                const stateP = state.players[pid];
                if (stateP && stateP.jersey_number !== undefined && stateP.jersey_number !== null) {
                    jerseyNum = stateP.jersey_number;
                } else if (isReplayMode && replayFrameData?.players?.[pid]?.jersey_number !== undefined) {
                    jerseyNum = replayFrameData.players[pid].jersey_number;
                } else {
                    const lobbyP = miniData.players.find(pl => pl.id === parseInt(pid));
                    if (lobbyP && lobbyP.jersey_number !== undefined) {
                        jerseyNum = lobbyP.jersey_number;
                    }
                }
            }

            if (isTurkeyTeam) {
                drawTurkishStar(ctx, p.x, p.y, currentRadius, kickGlow);
            } else if (isAzerbaijanTeam) {
                drawAzerbaijanFlag(ctx, p.x, p.y, currentRadius, kickGlow);
            } else if (isBesiktasTeam) {
                drawBesiktasKit(ctx, p.x, p.y, currentRadius, kickGlow);
                kitNumber = jerseyNum;
            } else if (isGalatasarayTeam) {
                drawGalatasarayKit(ctx, p.x, p.y, currentRadius, kickGlow);
                kitNumber = jerseyNum;
            } else if (isFenerbahceTeam) {
                drawFenerbahceKit(ctx, p.x, p.y, currentRadius, kickGlow);
                kitNumber = jerseyNum;
            } else if (isTrabzonsporTeam) {
                drawTrabzonsporKit(ctx, p.x, p.y, currentRadius, kickGlow);
                kitNumber = jerseyNum;
            }

            if (kitNumber !== null) {
                ctx.save();
                const dynamicFontSize = Math.round(currentRadius * 0.9);
                ctx.font = `bold ${dynamicFontSize}px 'Segoe UI', sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.shadowBlur = 4;
                ctx.shadowColor = "#000000";
                ctx.strokeStyle = "#000000";
                ctx.lineWidth = 3;
                ctx.fillStyle = "#ffffff";
                ctx.strokeText(String(kitNumber), p.x, p.y);
                ctx.fillText(String(kitNumber), p.x, p.y);
                ctx.restore();
            }

            let pname = miniData.playerNames[pid] || `P${pid}`;
            const _fieldTeamName = (playerTeam === "red" ? miniData.redTeamName : miniData.blueTeamName) || "";
            const _fieldNorm = _fieldTeamName.trim().toLowerCase();
            let nameColor;
            if (["fenerbahçe", "fenerbahce", "fb"].includes(_fieldNorm)) {
                nameColor = "#ffed00";
            } else if (["galatasaray", "gs"].includes(_fieldNorm)) {
                nameColor = "#fdb913";
            } else {
                nameColor = playerTeam === "blue" ? (miniData.blueTeamColor || "#7abfff") : (miniData.redTeamColor || "#ff8a8a");
            }
            let nameFontSize = 14;
            if (cfg.width >= 1800) nameFontSize = 22;
            else if (cfg.width >= 1600) nameFontSize = 20;
            else if (cfg.width >= 1400) nameFontSize = 18;
            else if (cfg.width >= 1200) nameFontSize = 16;
            
            const maxNameWidth = cfg.player_radius * 2.4;
            ctx.font = `bold ${nameFontSize}px Segoe UI`;
            let measuredW = ctx.measureText(pname).width;
            while (measuredW > maxNameWidth && nameFontSize > 8) {
                nameFontSize -= 1;
                ctx.font = `bold ${nameFontSize}px Segoe UI`;
                measuredW = ctx.measureText(pname).width;
            }
            
            ctx.textAlign = "center";
            ctx.shadowBlur = 5;
            ctx.shadowColor = "#000";
            ctx.fillStyle = nameColor;
            ctx.fillText(pname, p.x, p.y - cfg.player_radius - nameFontSize * 0.6);
            ctx.shadowBlur = 0;
        }
        
        let bSmooth;
        if (isReplayMode && replayFrameData && replayFrameData.ball) {
            bSmooth = replayFrameData.ball;
        } else if (miniData.playerId === 1 && typeof HP !== 'undefined' && HP.running &&
                   HP.room?.gameState?.ball) {
            const hpBall = HP.room.gameState.ball;
            bSmooth = { x: hpBall.x, y: hpBall.y };
        } else {
            bSmooth = miniData.currentPositions.ball || state.ball;
        }
        const b = {
            x: bSmooth.x,
            y: bSmooth.y,
            on_fire: isReplayMode ? (replayFrameData?.ball?.on_fire) : state.ball.on_fire,
            warning: isReplayMode ? (replayFrameData?.ball?.warning) : state.ball.warning
        };
        const onFire = b.on_fire === true;
        const warning = b.warning === true;

        let ballRadius = cfg.ball_radius;
        let skipBallDraw = false;

        // 🌌 Topu Karadeliğe Çeken Girdap Algoritması (Replay Dahil + Hedef Kale Koordinatı)
        if (isBlackHoleActive) {
            let bhX = cfg.width / 2;
            let bhY = cfg.height / 2;
            const srcState = (isReplayMode && replayFrameData) ? replayFrameData : state;
            if (typeof srcState.bhX === "number") {
                bhX = srcState.bhX;
                bhY = srcState.bhY;
            } else if (activeCel) {
                const scorerTeamId = activeCel.scorer_id;
                bhX = (scorerTeamId === 1) ? cfg.width : 0; 
            }

            const dx = bhX - b.x;
            const dy = bhY - b.y;
            const dist = Math.hypot(dx, dy);
            
            const elapsed = Math.max(0, 5.0 - activeCel.wait_remaining);
            const pullStrength = Math.min(1.0, elapsed / 3.8);

            if (pullStrength > 0.02) {
                const orbitAngle = Math.atan2(dy, dx) + pullStrength * 9.0;
                const newDist = dist * (1.0 - pullStrength * 0.98);
                b.x = bhX - Math.cos(orbitAngle) * newDist;
                b.y = bhY - Math.sin(orbitAngle) * newDist;
                ballRadius = cfg.ball_radius * Math.max(0.01, 1.0 - pullStrength * 0.96);
                
                if (newDist < 8) {
                    skipBallDraw = true;
                }
            }
        }
        
        if (warning && !skipBallDraw) {
            const blink = Math.floor(Date.now() / 200) % 2 === 0;
            if (blink) {
                const warningTeam = state.ball.warning_team;
                let warningColor, warningColorLight;
                if (warningTeam === 2) {
                    warningColor = "#4dabf7";
                    warningColorLight = "rgba(77, 171, 247, 0.5)";
                } else {
                    warningColor = "#ff3333";
                    warningColorLight = "rgba(255, 51, 51, 0.5)";
                }
                
                ctx.shadowBlur = 30;
                ctx.shadowColor = warningColor;
                ctx.fillStyle = warningColorLight;
                ctx.beginPath();
                ctx.arc(b.x, b.y, ballRadius + 10, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
        
        if (onFire) {
            const lastToucher = state.ball.last_toucher;
            let toucherTeam = null;
            if (lastToucher) {
                const toucherInfo = miniData.players.find(pl => pl.id === lastToucher);
                if (toucherInfo) toucherTeam = toucherInfo.team;
            }
            const fireHex = toucherTeam === "blue" ? (miniData.blueTeamColor || "#4dabf7") : (miniData.redTeamColor || "#ff6b00");
            const fireRgb = hexToRgbParts(fireHex);
            let flameR = fireRgb.r, flameG = fireRgb.g, flameB = fireRgb.b;
            let glowColor = fireHex;
            
            const time = Date.now() / 100;
            for (let i = 3; i > 0; i--) {
                ctx.fillStyle = `rgba(${flameR}, ${flameG + i * 30}, ${flameB}, ${0.3 - i * 0.05})`;
                ctx.shadowBlur = 30;
                ctx.shadowColor = glowColor;
                ctx.beginPath();
                const wave = Math.sin(time + i) * 2;
                ctx.arc(b.x, b.y, cfg.ball_radius + 6 + i * 3 + wave, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }
        
        if (!skipBallDraw) {
            ctx.fillStyle = "rgba(0,0,0,0.4)";
            ctx.beginPath();
            ctx.arc(b.x + 2, b.y + 2, ballRadius, 0, Math.PI * 2);
            ctx.fill();
            
            if (onFire) {
                const lastToucher = state.ball.last_toucher;
                let toucherTeam2 = null;
                if (lastToucher) {
                    const toucherInfo2 = miniData.players.find(pl => pl.id === lastToucher);
                    if (toucherInfo2) toucherTeam2 = toucherInfo2.team;
                }
                const fireHex2 = toucherTeam2 === "blue" ? (miniData.blueTeamColor || "#4dabf7") : (miniData.redTeamColor || "#ff6b00");
                const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, ballRadius);
                grad.addColorStop(0, "#fff");
                grad.addColorStop(0.6, shadeHexColor(fireHex2, 0.35));
                grad.addColorStop(1, shadeHexColor(fireHex2, -0.15));
                ctx.fillStyle = grad;
            } else if (warning) {
                const blink = Math.floor(Date.now() / 200) % 2 === 0;
                const warningTeam = state.ball.warning_team;
                const warningColor = warningTeam === 2 ? "#4dabf7" : "#ff3333";
                ctx.fillStyle = blink ? warningColor : "#fff";
            } else {
                ctx.fillStyle = "#fff";
            }
            ctx.beginPath();
            ctx.arc(b.x, b.y, ballRadius, 0, Math.PI * 2);
            ctx.fill();
            
            if (!onFire) {
                ctx.fillStyle = "#333";
                ctx.beginPath();
                ctx.arc(b.x, b.y, ballRadius * 0.4, 0, Math.PI * 2);
                ctx.fill();
            }
            
            let ballBorderColor = "#000";
            if (onFire) {
                const lastToucher = state.ball.last_toucher;
                let toucherTeam3 = null;
                if (lastToucher) {
                    const toucherInfo3 = miniData.players.find(pl => pl.id === lastToucher);
                    if (toucherInfo3) toucherTeam3 = toucherInfo3.team;
                }
                const fireHex3 = toucherTeam3 === "blue" ? (miniData.blueTeamColor || "#4dabf7") : (miniData.redTeamColor || "#ff6b00");
                ballBorderColor = shadeHexColor(fireHex3, -0.35);
            }
            ctx.strokeStyle = ballBorderColor;
            ctx.lineWidth = onFire ? 3 : 2;
            ctx.beginPath();
            ctx.arc(b.x, b.y, ballRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
    }
    
    if (state) {
        const rDurationR = (state.goal_celebration && state.goal_celebration.replay_duration) || 10.0;
        const isReplayRunning = state.game_state === "goal_wait" &&
            state.goal_celebration &&
            typeof state.goal_celebration.wait_remaining === "number" &&
            state.goal_celebration.wait_remaining <= rDurationR;

        if (isReplayRunning) {
            if (!miniData._keysReleasedInReplay) {
                miniReleaseAllKeys();
                miniData._keysReleasedInReplay = true;
            }
        } else {
            miniData._keysReleasedInReplay = false;
            if (state.game_state === "goal_wait" &&
                state.goal_celebration &&
                state.goal_celebration.wait_remaining > rDurationR) {
                miniData._hasSkippedReplay = false;
            }
        }

        const nowTime = performance.now() / 1000;
        const isCountdown = (state.game_state === "countdown");

        if (isCountdown) {
            miniData._lastCountdownTime = nowTime;
        }

        const showGo = (!isCountdown && miniData._lastCountdownTime && (nowTime - miniData._lastCountdownTime < 1.0));

        if (isCountdown || showGo) {
            drawCountdownOverlay(ctx, cfg, isCountdown, showGo);
        }

        if (state.game_state === "goal_wait" && state.goal_celebration) {
            miniData._countdownSoundPlayed = false;
            miniData._lastCountdownTime = null;
            MiniAudio.stop("timer_countdown.mp3");
            drawGoalCelebration(ctx, cfg, state.goal_celebration);
        } else if (!isCountdown && !showGo) {
            miniData._countdownSoundPlayed = false;
            miniData._lastGoalSignature = null;
            miniData._goalSongPlayed = null;
            miniReplay.replayStartTime = 0;
        }
        if (state.kickoff && state.kickoff.active) {
            drawKickoffInfo(ctx, cfg, state.kickoff);
        }
    }
    
    ctx.restore();
    
    if (miniData._goalSongAudio) {
        let vol = 0.5;
        if (typeof window.getGlobalVolume === "function") {
            const gv = window.getGlobalVolume();
            if (typeof gv === "number" && !isNaN(gv)) vol = gv;
        }
        try {
            const audio = miniData._goalSongAudio;
            audio.volume = Math.max(0, Math.min(1, vol));

            if (vol > 0 && audio.paused && !audio.ended) {
                audio.play().catch(() => {});
            }

            if (audio.ended) {
                miniData._goalSongAudio = null;
            }
        } catch(e) {}
    }
    
    if (typeof updateMiniHUD === "function") updateMiniHUD();
    miniAnimFrame = requestAnimationFrame(miniRender);
}

// 🛡️ Global Scope Garantisi
window.miniRender = miniRender;
window.drawCountdownOverlay = drawCountdownOverlay;
window.drawBlackHoleEffect = drawBlackHoleEffect;
window.drawUfoAbductionCelebration = drawUfoAbductionCelebration;