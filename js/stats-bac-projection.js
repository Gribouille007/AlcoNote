// BAC Projection Calculator for AlcoNote Statistics
// Generates time-series BAC curve data for chart visualization

const BACProjectionCalculator = (() => {

    /**
     * Generate BAC curve data points over a time range
     * @param {Array}  drinks     - Drink objects with date, time, quantity, unit, alcoholContent
     * @param {number} weightKg   - User weight in kg
     * @param {string} gender     - 'male' or 'female'
     * @param {Date}   fromTime   - Curve start
     * @param {Date}   toTime     - Curve end
     * @param {number} stepMinutes - Time step (default 5 min)
     * @returns {Array<{time:Date, bac:number}>}  bac in mg/L
     */
    function generateBACCurve(drinks, weightKg, gender, fromTime, toTime, stepMinutes = 5) {
        if (!drinks || !drinks.length || !weightKg || !gender) return [];

        const r = gender === 'male' ? 0.68 : 0.55;
        const eliminationRate = 0.15; // g/L per hour

        const parsedDrinks = drinks.map(drink => {
            try {
                const [year, month, day] = drink.date.split('-').map(Number);
                const [hours, minutes] = drink.time.split(':').map(Number);
                const drinkTime = new Date(year, month - 1, day, hours, minutes);
                const converted = Utils.convertToStandardUnit(drink.quantity, drink.unit);
                const volumeCL = converted.quantity;
                const alcoholGrams = (volumeCL * (drink.alcoholContent || 0) * 0.8) / 100;
                return { time: drinkTime, alcoholGrams };
            } catch { return null; }
        }).filter(d => d && d.alcoholGrams > 0);

        if (!parsedDrinks.length) return [];
        parsedDrinks.sort((a, b) => a.time - b.time);

        const dataPoints = [];
        const stepMs = stepMinutes * 60 * 1000;

        for (let t = fromTime.getTime(); t <= toTime.getTime(); t += stepMs) {
            const currentTime = new Date(t);
            let bac = 0;

            for (const drink of parsedDrinks) {
                const hoursElapsed = (currentTime - drink.time) / (1000 * 60 * 60);
                if (hoursElapsed < 0) continue;

                const peakBAC = drink.alcoholGrams / (weightKg * r);
                const cur = peakBAC - eliminationRate * hoursElapsed;
                if (cur > 0) bac += cur;
            }

            dataPoints.push({
                time: currentTime,
                bac: Math.max(0, Math.round(bac * 1000 * 100) / 100)
            });
        }

        return dataPoints;
    }

    /**
     * Calculate the full time range for the BAC curve.
     * Uses total alcohol ingested (not current BAC) so the future projection
     * always extends to true sobriety, even if BAC is still rising.
     *
     * @param {Array}  drinks        - Relevant drinks
     * @param {number} weightKg      - User weight in kg
     * @param {string} gender        - 'male' or 'female'
     * @param {Date}   referenceTime - "Now" reference
     * @returns {{fromTime:Date, toTime:Date}}
     */
    function calculateTimeRange(drinks, weightKg, gender, referenceTime) {
        let earliestDrink = referenceTime;

        for (const drink of drinks) {
            try {
                const [year, month, day] = drink.date.split('-').map(Number);
                const [hours, minutes] = drink.time.split(':').map(Number);
                const drinkTime = new Date(year, month - 1, day, hours, minutes);
                if (drinkTime < earliestDrink) earliestDrink = drinkTime;
            } catch { /* skip */ }
        }

        // 30 min before first drink
        const fromTime = new Date(earliestDrink.getTime() - 30 * 60 * 1000);

        // Sum all alcohol to get an upper-bound peak BAC
        // (as if all drinks were consumed at once — always >= actual peak)
        const r = gender === 'male' ? 0.68 : 0.55;
        let totalAlcoholGrams = 0;
        for (const drink of drinks) {
            try {
                const converted = Utils.convertToStandardUnit(drink.quantity, drink.unit);
                const volumeCL = converted.quantity;
                totalAlcoholGrams += (volumeCL * (drink.alcoholContent || 0) * 0.8) / 100;
            } catch { /* skip */ }
        }

        // Max theoretical BAC (mg/L), hours to eliminate at 150 mg/L per hour
        const maxBACMgL = (totalAlcoholGrams / (weightKg * r)) * 1000;
        const hoursToSobriety = Math.max(maxBACMgL / 150, 0.5);

        // Add 30-min buffer after sobriety
        const toTime = new Date(referenceTime.getTime() + (hoursToSobriety + 0.5) * 60 * 60 * 1000);

        return { fromTime, toTime };
    }

    /**
     * Build a BAC-level CSS gradient for the slider track.
     * Green = safe, orange = 200-500 mg/L, red = >500 mg/L.
     */
    function _buildSliderGradient(dataPoints) {
        if (dataPoints.length < 2) return null;
        const total = dataPoints.length - 1;
        const stops = [];
        let lastColor = null;

        for (let i = 0; i <= total; i++) {
            const bac = dataPoints[i].bac;
            const color = bac > 500 ? '#FF3B30' : bac > 200 ? '#FF9500' : '#34C759';
            const pct = (i / total * 100).toFixed(1);

            if (color !== lastColor) {
                if (lastColor !== null) stops.push(`${lastColor} ${pct}%`);
                stops.push(`${color} ${pct}%`);
                lastColor = color;
            }
        }
        if (lastColor) stops.push(`${lastColor} 100%`);
        return `linear-gradient(to right, ${stops.join(', ')})`;
    }

    /**
     * Create and render the BAC projection chart.
     * Annotations use numeric index positions (reliable with category scale).
     *
     * @param {string} canvasId      - Canvas element ID
     * @param {Array}  dataPoints    - From generateBACCurve()
     * @param {Date}   referenceTime - "Now" marker
     * @param {Object} chartStorage  - Object to store chart instance for cleanup
     * @returns {Chart|null}
     */
    function renderChart(canvasId, dataPoints, referenceTime, chartStorage) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !dataPoints.length) return null;

        // Destroy any previous chart on this canvas
        if (canvas._chartInstance) {
            canvas._chartInstance.destroy();
            canvas._chartInstance = null;
        }

        const canvasCtx = canvas.getContext('2d');
        const style = getComputedStyle(document.documentElement);
        const textColor  = style.getPropertyValue('--text-secondary').trim() || '#666';
        const gridColor  = style.getPropertyValue('--gray-4').trim() || '#e0e0e0';

        const labels = dataPoints.map(p =>
            p.time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        );
        const values = dataPoints.map(p => p.bac);

        // Index of the point closest to "now"
        const nowIndex = dataPoints.reduce((best, p, i) =>
            Math.abs(p.time - referenceTime) < Math.abs(dataPoints[best].time - referenceTime) ? i : best, 0);

        // Peak BAC index
        let peakIndex = 0, peakBAC = 0;
        dataPoints.forEach((p, i) => { if (p.bac > peakBAC) { peakBAC = p.bac; peakIndex = i; } });

        // First index after peak where BAC drops to ~0 (sobriety)
        let sobrietyIndex = dataPoints.length - 1;
        for (let i = peakIndex; i < dataPoints.length; i++) {
            if (dataPoints[i].bac <= 1) { sobrietyIndex = i; break; }
        }

        // ── Segment visual callbacks ─────────────────────────────────────
        // Past segment : solid, full colour
        // Future segment: dashed, lighter colour
        const segmentColor = (segCtx) => {
            const val = segCtx.p1.parsed.y;
            const isFuture = segCtx.p0.parsed.x >= nowIndex;
            const alpha = isFuture ? 0.45 : 0.9;
            if (val > 500) return `rgba(255, 59, 48, ${alpha})`;
            if (val > 200) return `rgba(255, 149, 0, ${alpha})`;
            return `rgba(52, 199, 89, ${alpha})`;
        };

        const segmentBgColor = (segCtx) => {
            const val = segCtx.p1.parsed.y;
            const isFuture = segCtx.p0.parsed.x >= nowIndex;
            const alpha = isFuture ? 0.04 : 0.14;
            if (val > 500) return `rgba(255, 59, 48, ${alpha})`;
            if (val > 200) return `rgba(255, 149, 0, ${alpha})`;
            return `rgba(52, 199, 89, ${alpha})`;
        };

        const segmentDash = (segCtx) =>
            segCtx.p0.parsed.x >= nowIndex ? [5, 4] : undefined;

        // ── Annotations ─────────────────────────────────────────────────
        // All positional annotations use numeric index (not label string)
        // to avoid ambiguity with duplicate HH:MM labels.
        const annotations = {
            legalLimit: {
                type: 'line',
                yMin: 500, yMax: 500,
                borderColor: 'rgba(255, 59, 48, 0.55)',
                borderWidth: 1.5,
                borderDash: [6, 4],
                label: {
                    display: true,
                    content: '500 mg/L',
                    position: 'end',
                    backgroundColor: 'rgba(255, 59, 48, 0.8)',
                    color: '#fff',
                    font: { size: 10 }
                }
            },
            nowLine: {
                type: 'line',
                xMin: nowIndex,
                xMax: nowIndex,
                borderColor: 'rgba(0, 122, 255, 0.85)',
                borderWidth: 2,
                borderDash: [4, 4],
                label: {
                    display: true,
                    content: 'Maintenant',
                    position: 'start',
                    backgroundColor: 'rgba(0, 122, 255, 0.85)',
                    color: '#fff',
                    font: { size: 10 }
                }
            }
        };

        // Sobriety line only if it's not at the very end (room to display)
        if (sobrietyIndex < dataPoints.length - 3) {
            annotations.sobrietyLine = {
                type: 'line',
                xMin: sobrietyIndex,
                xMax: sobrietyIndex,
                borderColor: 'rgba(52, 199, 89, 0.55)',
                borderWidth: 1.5,
                borderDash: [4, 4],
                label: {
                    display: true,
                    content: 'Sobre',
                    position: 'end',
                    backgroundColor: 'rgba(52, 199, 89, 0.8)',
                    color: '#fff',
                    font: { size: 10 }
                }
            };
        }

        const chart = new Chart(canvasCtx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Alcoolémie (mg/L)',
                    data: values,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    borderWidth: 3,
                    segment: {
                        borderColor: segmentColor,
                        backgroundColor: segmentBgColor,
                        borderDash: segmentDash
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 500, easing: 'easeInOutQuart' },
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        ticks: { color: textColor, maxTicksLimit: 8, maxRotation: 0 },
                        grid: { color: gridColor, drawBorder: false }
                    },
                    y: {
                        beginAtZero: true,
                        suggestedMax: Math.max(peakBAC * 1.15, 600),
                        ticks: {
                            color: textColor,
                            callback: v => v + ' mg/L'
                        },
                        grid: { color: gridColor, drawBorder: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            title: (items) => {
                                if (!items.length) return '';
                                return dataPoints[items[0].dataIndex].time.toLocaleTimeString('fr-FR', {
                                    hour: '2-digit', minute: '2-digit'
                                });
                            },
                            label: (item) => {
                                const bac = item.parsed.y;
                                const status = bac > 500 ? 'Limite dépassée' :
                                               bac > 200 ? 'Légèrement alcoolisé' : 'Sobre';
                                return `  ${bac.toFixed(0)} mg/L — ${status}`;
                            }
                        }
                    },
                    annotation: { annotations },
                    zoom: {
                        pan: { enabled: true, mode: 'x' },
                        zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            mode: 'x'
                        }
                    }
                }
            }
        });

        canvas._chartInstance = chart;
        if (chartStorage) chartStorage['bac-projection'] = chart;

        return chart;
    }

    /**
     * Initialize the time slider.
     * - Track gradient reflects BAC levels over time.
     * - Annotation uses numeric index → correct after zoom/pan.
     * - If selected point is outside zoomed view, resets zoom automatically.
     *
     * @param {string} sliderId    - Range input ID
     * @param {string} readoutId   - Readout div ID
     * @param {Array}  dataPoints  - BAC curve data points
     * @param {Date}   referenceTime - "Now"
     * @param {Chart}  chart       - Chart.js instance
     */
    function initSlider(sliderId, readoutId, dataPoints, referenceTime, chart) {
        const slider  = document.getElementById(sliderId);
        const readout = document.getElementById(readoutId);
        if (!slider || !readout || !dataPoints.length) return;

        // Apply BAC-zone gradient to slider track
        const gradient = _buildSliderGradient(dataPoints);
        if (gradient) slider.style.background = gradient;

        slider.min   = 0;
        slider.max   = dataPoints.length - 1;
        slider.step  = 1;

        // Position slider at "now"
        const nowIndex = dataPoints.reduce((best, p, i) =>
            Math.abs(p.time - referenceTime) < Math.abs(dataPoints[best].time - referenceTime) ? i : best, 0);
        slider.value = nowIndex;

        // Wire reset-zoom button (optional, rendered in HTML)
        const resetBtn = document.getElementById('bac-zoom-reset');
        if (resetBtn && chart) {
            resetBtn.addEventListener('click', () => chart.resetZoom());
        }

        function updateReadout() {
            const idx   = parseInt(slider.value, 10);
            const point = dataPoints[idx];
            if (!point) return;

            const diffMs  = point.time - referenceTime;
            const diffMin = Math.round(diffMs / 60000);
            const absMin  = Math.abs(diffMin);
            const h = Math.floor(absMin / 60);
            const m = absMin % 60;
            const mm = String(m).padStart(2, '0');

            let timeText;
            if (Math.abs(diffMin) < 3) {
                timeText = 'Maintenant';
            } else if (diffMin < 0) {
                timeText = h > 0 ? `Il y a ${h}h${m > 0 ? mm : ''}` : `Il y a ${m}min`;
            } else {
                timeText = h > 0 ? `Dans ${h}h${m > 0 ? mm : ''}` : `Dans ${m}min`;
            }

            const clockTime = point.time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            const bac        = point.bac;
            const levelClass = bac > 500 ? 'danger' : bac > 200 ? 'warning' : 'safe';
            const levelText  = bac > 500 ? 'Limite dépassée' : bac > 200 ? 'Légèrement alcoolisé' : 'Sobre';

            readout.innerHTML = `
                <div class="slider-readout-left">
                    <span class="slider-time">${timeText}</span>
                    <span class="slider-clock">${clockTime}</span>
                </div>
                <div class="slider-readout-right">
                    <span class="slider-bac ${levelClass}">${bac.toFixed(0)} mg/L</span>
                    <span class="slider-bac-status ${levelClass}">${levelText}</span>
                </div>
            `;

            if (chart && chart.options.plugins.annotation) {
                // If the selected index is outside the current zoomed view → reset zoom
                const scale = chart.scales && chart.scales.x;
                if (scale && (idx < Math.floor(scale.min) || idx > Math.ceil(scale.max))) {
                    chart.resetZoom();
                }

                // Update slider cursor annotation using INDEX (not label string)
                chart.options.plugins.annotation.annotations.sliderLine = {
                    type: 'line',
                    xMin: idx,
                    xMax: idx,
                    borderColor: 'rgba(88, 86, 214, 0.9)',
                    borderWidth: 2.5,
                    label: {
                        display: true,
                        content: `${bac.toFixed(0)} mg/L`,
                        position: 'end',
                        yAdjust: 18,
                        backgroundColor: levelClass === 'danger' ? 'rgba(255,59,48,0.85)' :
                                         levelClass === 'warning' ? 'rgba(255,149,0,0.85)' :
                                         'rgba(52,199,89,0.85)',
                        color: '#fff',
                        font: { size: 10 }
                    }
                };
                chart.update('none');
            }
        }

        slider.addEventListener('input', updateReadout);
        updateReadout(); // Populate readout immediately on init
    }

    return { generateBACCurve, calculateTimeRange, renderChart, initSlider };
})();

window.BACProjectionCalculator = BACProjectionCalculator;
