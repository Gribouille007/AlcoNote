// Modern BAC Chart — Canvas custom renderer with Revolut-style interaction
// Replaces Chart.js-based stats-bac-projection.js
//
// Features:
//   - High-DPI aware canvas rendering
//   - Smooth cubic-bezier curve with gradient area fill
//   - Dashed future portion (past the "now" line)
//   - Session-bounded initial view (first drink − 30min → sobriety)
//   - 1-minute resolution (no jumps)
//   - Pointer/touch drag → floating ball + contextual tooltip + haptic feedback
//   - Fully CSS-variable themed (light/dark auto)

const BACChart = (() => {
    'use strict';

    const ELIMINATION_RATE = 0.15;          // g/L per hour (Widmark)
    const PADDING = { top: 32, right: 20, bottom: 28, left: 44 };
    const TOOLTIP_OFFSET = 14;              // distance ball → tooltip base
    const STEP_MINUTES_DEFAULT = 1;         // fine resolution

    // ── Color helpers tied to CSS variables ───────────────────────────
    function cssVar(name, fallback) {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
    }
    function bacColor(bac) {
        if (bac > 500) return cssVar('--error-color', '#FF3B30');
        if (bac > 200) return cssVar('--warning-color', '#FF9500');
        return cssVar('--success-color', '#34C759');
    }
    function bacStatus(bac) {
        if (bac > 500) return { cls: 'danger',  text: 'Limite dépassée' };
        if (bac > 200) return { cls: 'warning', text: 'Légèrement alcoolisé' };
        return { cls: 'safe', text: 'Sobre' };
    }

    // ── Parse drinks → [{time, alcoholGrams}] ──────────────────────────
    function parseDrinks(drinks) {
        if (!drinks || !drinks.length) return [];
        return drinks.map(d => {
            try {
                const [y, m, day] = d.date.split('-').map(Number);
                const [h, mi] = d.time.split(':').map(Number);
                const time = new Date(y, m - 1, day, h, mi);
                const cL = Utils.convertToStandardUnit(d.quantity, d.unit).quantity;
                const grams = (cL * (d.alcoholContent || 0) * 0.8) / 100;
                return grams > 0 ? { time, alcoholGrams: grams } : null;
            } catch { return null; }
        }).filter(Boolean).sort((a, b) => a.time - b.time);
    }

    // ── Generate curve: BAC at each minute from fromT to toT ────────────
    function generateCurve(parsed, weightKg, gender, fromT, toT, stepMinutes = STEP_MINUTES_DEFAULT) {
        if (!parsed.length || !weightKg || !gender) return [];
        const r = gender === 'male' ? 0.68 : 0.55;
        const stepMs = stepMinutes * 60000;
        const out = [];
        for (let t = fromT.getTime(); t <= toT.getTime(); t += stepMs) {
            let bac = 0;
            for (const d of parsed) {
                const hrs = (t - d.time.getTime()) / 3600000;
                if (hrs < 0) continue;
                const peak = d.alcoholGrams / (weightKg * r);
                const cur = peak - ELIMINATION_RATE * hrs;
                if (cur > 0) bac += cur;
            }
            out.push({ t: t, bac: Math.max(0, bac * 1000) });
        }
        return out;
    }

    // ── Session time range: [first drink − 30min, sobriety + 30min] ────
    function computeRange(parsed, weightKg, gender) {
        if (!parsed.length) {
            const now = Date.now();
            return { fromT: new Date(now - 3600000), toT: new Date(now + 3600000) };
        }
        const r = gender === 'male' ? 0.68 : 0.55;
        const firstT = parsed[0].time.getTime();
        const lastT  = parsed[parsed.length - 1].time.getTime();
        const totalG = parsed.reduce((s, d) => s + d.alcoholGrams, 0);
        const peakBAC_mgL = (totalG / (weightKg * r)) * 1000;
        const hoursToSobriety = Math.max(peakBAC_mgL / 150, 0.5);
        return {
            fromT: new Date(firstT - 30 * 60000),
            toT:   new Date(lastT  + (hoursToSobriety + 0.5) * 3600000)
        };
    }

    // ── Catmull-Rom → Bezier curve smoothing ───────────────────────────
    function drawSmoothPath(ctx, points, tension = 0.5) {
        if (points.length < 2) return;
        ctx.moveTo(points[0].x, points[0].y);
        if (points.length === 2) { ctx.lineTo(points[1].x, points[1].y); return; }
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            const cp1x = p1.x + (p2.x - p0.x) * tension / 6;
            const cp1y = p1.y + (p2.y - p0.y) * tension / 6;
            const cp2x = p2.x - (p3.x - p1.x) * tension / 6;
            const cp2y = p2.y - (p3.y - p1.y) * tension / 6;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
        }
    }

    // ── Haptic feedback (mobile) ────────────────────────────────────────
    function haptic(ms = 5) {
        try { if (navigator.vibrate) navigator.vibrate(ms); } catch {}
    }

    // ── Main chart instance ─────────────────────────────────────────────
    function create(canvasId, options) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return null;

        const {
            drinks = [],
            weightKg,
            gender,
            referenceTime = new Date(),
            tooltipEl = null,
            ballEl = null
        } = options;

        // Clean up any previous instance on this canvas
        if (canvas._bacChartInstance) canvas._bacChartInstance.destroy();

        const parsed = parseDrinks(drinks);
        const { fromT, toT } = computeRange(parsed, weightKg, gender);
        const curve = generateCurve(parsed, weightKg, gender, fromT, toT, STEP_MINUTES_DEFAULT);

        if (!curve.length) return null;

        // Index closest to referenceTime ("now")
        const refMs = referenceTime.getTime();
        let nowIdx = 0, best = Infinity;
        curve.forEach((p, i) => {
            const d = Math.abs(p.t - refMs);
            if (d < best) { best = d; nowIdx = i; }
        });
        const peakBAC = curve.reduce((m, p) => Math.max(m, p.bac), 0);
        const yMax = Math.max(peakBAC * 1.15, 600);

        // Rendering state
        let hoverIdx = nowIdx;
        let isDragging = false;
        let plotW = 0, plotH = 0;

        // Point → screen coords
        function toPx(idx, W, H) {
            const x = PADDING.left + (idx / (curve.length - 1)) * (W - PADDING.left - PADDING.right);
            const y = PADDING.top + (1 - curve[idx].bac / yMax) * (H - PADDING.top - PADDING.bottom);
            return { x, y };
        }

        function render() {
            const dpr = window.devicePixelRatio || 1;
            const rect = canvas.getBoundingClientRect();
            const W = rect.width, H = rect.height;
            if (W === 0 || H === 0) return;
            plotW = W; plotH = H;

            if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
                canvas.width = W * dpr; canvas.height = H * dpr;
            }
            const ctx = canvas.getContext('2d');
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            ctx.clearRect(0, 0, W, H);

            const textSecondary = cssVar('--text-secondary', '#666');
            const textQuaternary = cssVar('--text-quaternary', '#66666666');
            const separator = cssVar('--separator', '#e5e5ea');

            // Horizontal guides: 0, 200, 500, peak
            ctx.save();
            ctx.strokeStyle = separator;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 4]);
            ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = textSecondary;
            const yTicks = [0, 200, 500];
            for (const v of yTicks) {
                if (v > yMax) continue;
                const y = PADDING.top + (1 - v / yMax) * (H - PADDING.top - PADDING.bottom);
                ctx.beginPath();
                ctx.moveTo(PADDING.left, y);
                ctx.lineTo(W - PADDING.right, y);
                ctx.stroke();
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(v + ' mg/L', PADDING.left - 6, y);
            }
            ctx.restore();

            // Compute pixel points
            const pts = curve.map((_, i) => toPx(i, W, H));

            // Split past/future at nowIdx
            const baselineY = PADDING.top + (H - PADDING.top - PADDING.bottom);

            // ── Past area (solid gradient) ──────────────────────────────
            if (nowIdx > 0) {
                const grad = ctx.createLinearGradient(0, PADDING.top, 0, baselineY);
                grad.addColorStop(0, 'rgba(0,122,255,0.28)');
                grad.addColorStop(1, 'rgba(0,122,255,0.00)');

                ctx.save();
                ctx.beginPath();
                drawSmoothPath(ctx, pts.slice(0, nowIdx + 1));
                ctx.lineTo(pts[nowIdx].x, baselineY);
                ctx.lineTo(pts[0].x, baselineY);
                ctx.closePath();
                ctx.fillStyle = grad;
                ctx.fill();
                ctx.restore();

                // Past stroke (dynamic color by BAC)
                ctx.save();
                ctx.lineWidth = 2.5;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                for (let i = 0; i < nowIdx; i++) {
                    ctx.strokeStyle = bacColor(curve[i + 1].bac);
                    ctx.beginPath();
                    const p0 = pts[Math.max(0, i - 1)];
                    const p1 = pts[i];
                    const p2 = pts[i + 1];
                    const p3 = pts[Math.min(pts.length - 1, i + 2)];
                    const cp1x = p1.x + (p2.x - p0.x) * 0.5 / 6;
                    const cp1y = p1.y + (p2.y - p0.y) * 0.5 / 6;
                    const cp2x = p2.x - (p3.x - p1.x) * 0.5 / 6;
                    const cp2y = p2.y - (p3.y - p1.y) * 0.5 / 6;
                    ctx.moveTo(p1.x, p1.y);
                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // ── Future (dashed, lighter) ────────────────────────────────
            if (nowIdx < curve.length - 1) {
                ctx.save();
                ctx.setLineDash([5, 4]);
                ctx.lineWidth = 2;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                for (let i = nowIdx; i < curve.length - 1; i++) {
                    const c = bacColor(curve[i + 1].bac);
                    ctx.strokeStyle = c + 'B3'; // ~70% alpha
                    ctx.beginPath();
                    const p0 = pts[Math.max(0, i - 1)];
                    const p1 = pts[i];
                    const p2 = pts[i + 1];
                    const p3 = pts[Math.min(pts.length - 1, i + 2)];
                    const cp1x = p1.x + (p2.x - p0.x) * 0.5 / 6;
                    const cp1y = p1.y + (p2.y - p0.y) * 0.5 / 6;
                    const cp2x = p2.x - (p3.x - p1.x) * 0.5 / 6;
                    const cp2y = p2.y - (p3.y - p1.y) * 0.5 / 6;
                    ctx.moveTo(p1.x, p1.y);
                    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
                    ctx.stroke();
                }
                ctx.restore();
            }

            // ── Legal-limit line (500 mg/L) ──────────────────────────────
            if (500 <= yMax) {
                const y = PADDING.top + (1 - 500 / yMax) * (H - PADDING.top - PADDING.bottom);
                ctx.save();
                ctx.strokeStyle = 'rgba(255,59,48,0.45)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]);
                ctx.beginPath();
                ctx.moveTo(PADDING.left, y);
                ctx.lineTo(W - PADDING.right, y);
                ctx.stroke();
                ctx.restore();
            }

            // ── "Now" vertical line ─────────────────────────────────────
            const nowPx = toPx(nowIdx, W, H);
            ctx.save();
            ctx.strokeStyle = cssVar('--primary-color', '#007AFF');
            ctx.globalAlpha = 0.4;
            ctx.lineWidth = 1.5;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(nowPx.x, PADDING.top);
            ctx.lineTo(nowPx.x, baselineY);
            ctx.stroke();
            ctx.restore();

            // ── X-axis labels (start, now, end) ─────────────────────────
            ctx.save();
            ctx.fillStyle = textSecondary;
            ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            const fmtH = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            // Start
            ctx.fillText(fmtH(curve[0].t), pts[0].x, baselineY + 6);
            // End
            ctx.fillText(fmtH(curve[curve.length - 1].t), pts[pts.length - 1].x, baselineY + 6);
            // Now (if not near edges)
            if (nowIdx > 2 && nowIdx < curve.length - 3) {
                ctx.fillStyle = cssVar('--primary-color', '#007AFF');
                ctx.fillText(fmtH(curve[nowIdx].t), nowPx.x, baselineY + 6);
            }
            ctx.restore();

            // ── Hover ball + vertical hair line ─────────────────────────
            if (hoverIdx != null && hoverIdx >= 0 && hoverIdx < curve.length) {
                const hPx = toPx(hoverIdx, W, H);
                const color = bacColor(curve[hoverIdx].bac);

                // Hair line
                ctx.save();
                ctx.strokeStyle = color;
                ctx.globalAlpha = 0.25;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(hPx.x, hPx.y);
                ctx.lineTo(hPx.x, baselineY);
                ctx.stroke();
                ctx.restore();

                // Ball (halo + dot)
                ctx.save();
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.2;
                ctx.beginPath();
                ctx.arc(hPx.x, hPx.y, 14, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.fillStyle = cssVar('--bg-primary', '#fff');
                ctx.beginPath();
                ctx.arc(hPx.x, hPx.y, 7, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(hPx.x, hPx.y, 4.5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                // Update external tooltip element (if provided)
                if (tooltipEl) {
                    const pt = curve[hoverIdx];
                    const diffMs = pt.t - refMs;
                    const absMin = Math.round(Math.abs(diffMs) / 60000);
                    const h = Math.floor(absMin / 60);
                    const m = absMin % 60;
                    let when;
                    if (absMin < 3) when = 'Maintenant';
                    else if (diffMs < 0) when = h > 0 ? `Il y a ${h}h${m ? String(m).padStart(2,'0') : ''}` : `Il y a ${m}min`;
                    else when = h > 0 ? `Dans ${h}h${m ? String(m).padStart(2,'0') : ''}` : `Dans ${m}min`;

                    const clockT = new Date(pt.t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    const status = bacStatus(pt.bac);
                    tooltipEl.innerHTML = `
                        <div class="bac-tt-top">
                            <span class="bac-tt-when">${when}</span>
                            <span class="bac-tt-clock">${clockT}</span>
                        </div>
                        <div class="bac-tt-bottom">
                            <span class="bac-tt-value ${status.cls}">${pt.bac.toFixed(0)} mg/L</span>
                            <span class="bac-tt-status ${status.cls}">${status.text}</span>
                        </div>
                    `;
                    // Position above ball, clamped to container
                    const parentRect = canvas.parentElement.getBoundingClientRect();
                    const ttRect = tooltipEl.getBoundingClientRect();
                    let left = hPx.x - (ttRect.width || 120) / 2;
                    left = Math.max(8, Math.min(left, parentRect.width - (ttRect.width || 120) - 8));
                    let top = hPx.y - (ttRect.height || 56) - TOOLTIP_OFFSET;
                    if (top < 4) top = hPx.y + TOOLTIP_OFFSET; // flip below if no room
                    tooltipEl.style.left = left + 'px';
                    tooltipEl.style.top = top + 'px';
                    tooltipEl.classList.add('visible');
                }
            }
        }

        // ── Pointer → find nearest curve index ──────────────────────────
        function pxToIdx(clientX) {
            const rect = canvas.getBoundingClientRect();
            const x = clientX - rect.left;
            const usableW = rect.width - PADDING.left - PADDING.right;
            const relX = Math.max(0, Math.min(1, (x - PADDING.left) / usableW));
            return Math.round(relX * (curve.length - 1));
        }

        // ── Interaction handlers ────────────────────────────────────────
        let lastIdxSent = -1;
        function onPointer(clientX) {
            const idx = pxToIdx(clientX);
            if (idx !== hoverIdx) {
                hoverIdx = idx;
                render();
                if (Math.abs(idx - lastIdxSent) >= 3) {
                    haptic(3);
                    lastIdxSent = idx;
                }
            }
        }

        function onDown(e) {
            isDragging = true;
            canvas.setPointerCapture && e.pointerId != null && canvas.setPointerCapture(e.pointerId);
            onPointer(e.clientX);
            e.preventDefault();
        }
        function onMove(e) {
            if (!isDragging) return;
            onPointer(e.clientX);
            e.preventDefault();
        }
        function onUp(e) {
            if (!isDragging) return;
            isDragging = false;
            // Smoothly return to "now" after release
            const startIdx = hoverIdx;
            const endIdx = nowIdx;
            const duration = 300;
            const t0 = performance.now();
            function step(t) {
                const p = Math.min(1, (t - t0) / duration);
                const ease = 1 - Math.pow(1 - p, 3);
                hoverIdx = Math.round(startIdx + (endIdx - startIdx) * ease);
                render();
                if (p < 1) requestAnimationFrame(step);
                else if (tooltipEl) tooltipEl.classList.remove('visible');
            }
            requestAnimationFrame(step);
        }

        canvas.addEventListener('pointerdown', onDown);
        canvas.addEventListener('pointermove', onMove);
        canvas.addEventListener('pointerup', onUp);
        canvas.addEventListener('pointercancel', onUp);
        canvas.addEventListener('pointerleave', onUp);

        // ── ResizeObserver to re-render on container size change ────────
        const ro = new ResizeObserver(() => render());
        ro.observe(canvas);

        // Entry animation: draw from 0 → curve
        let animStart = performance.now();
        const ANIM_MS = 600;
        let animating = true;
        function animateIn(t) {
            const progress = Math.min(1, (t - animStart) / ANIM_MS);
            const ease = 1 - Math.pow(1 - progress, 3);
            const visibleEnd = Math.max(1, Math.floor(curve.length * ease));
            hoverIdx = Math.min(visibleEnd - 1, nowIdx);
            render();
            if (progress < 1) requestAnimationFrame(animateIn);
            else { animating = false; hoverIdx = nowIdx; render(); }
        }
        requestAnimationFrame(animateIn);

        const instance = {
            destroy() {
                canvas.removeEventListener('pointerdown', onDown);
                canvas.removeEventListener('pointermove', onMove);
                canvas.removeEventListener('pointerup', onUp);
                canvas.removeEventListener('pointercancel', onUp);
                canvas.removeEventListener('pointerleave', onUp);
                ro.disconnect();
                canvas._bacChartInstance = null;
            },
            rerender: render
        };
        canvas._bacChartInstance = instance;
        return instance;
    }

    return { create, generateCurve, computeRange, parseDrinks };
})();

window.BACChart = BACChart;
