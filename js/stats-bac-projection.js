// BAC Projection Calculator for AlcoNote Statistics
// Generates time-series BAC curve data for chart visualization

const BACProjectionCalculator = (() => {

    /**
     * Generate BAC curve data points over a time range
     * Reuses the Widmark formula logic from Utils.calculateCurrentBAC()
     * @param {Array} drinks - Array of drink objects with date, time, quantity, unit, alcoholContent
     * @param {number} weightKg - User weight in kg
     * @param {string} gender - 'male' or 'female'
     * @param {Date} fromTime - Start of the curve
     * @param {Date} toTime - End of the curve (projected sobriety)
     * @param {number} [stepMinutes=5] - Time step in minutes
     * @returns {Array<{time: Date, bac: number}>} BAC curve data points (bac in mg/L)
     */
    function generateBACCurve(drinks, weightKg, gender, fromTime, toTime, stepMinutes = 5) {
        if (!drinks || !drinks.length || !weightKg || !gender) {
            return [];
        }

        const r = gender === 'male' ? 0.68 : 0.55;
        const eliminationRate = 0.15; // g/L per hour

        // Parse drinks into {time: Date, alcoholGrams: number}
        const parsedDrinks = drinks.map(drink => {
            try {
                const [year, month, day] = drink.date.split('-').map(Number);
                const [hours, minutes] = drink.time.split(':').map(Number);
                const drinkTime = new Date(year, month - 1, day, hours, minutes);

                // Calculate alcohol in grams
                const converted = Utils.convertToStandardUnit(drink.quantity, drink.unit);
                const volumeCL = converted.quantity;
                const alcoholGrams = (volumeCL * (drink.alcoholContent || 0) * 0.8) / 100;

                return { time: drinkTime, alcoholGrams };
            } catch {
                return null;
            }
        }).filter(d => d && d.alcoholGrams > 0);

        if (!parsedDrinks.length) return [];

        // Sort by time
        parsedDrinks.sort((a, b) => a.time - b.time);

        const dataPoints = [];
        const stepMs = stepMinutes * 60 * 1000;

        for (let t = fromTime.getTime(); t <= toTime.getTime(); t += stepMs) {
            const currentTime = new Date(t);
            let bac = 0;

            // Sum contribution of each drink at this time point
            for (const drink of parsedDrinks) {
                const hoursElapsed = (currentTime - drink.time) / (1000 * 60 * 60);

                if (hoursElapsed < 0) continue; // Drink hasn't happened yet

                // Widmark formula: BAC from this drink (g/L)
                const peakBAC = drink.alcoholGrams / (weightKg * r);
                const currentBAC = peakBAC - (eliminationRate * hoursElapsed);

                if (currentBAC > 0) {
                    bac += currentBAC;
                }
            }

            // Convert g/L to mg/L
            dataPoints.push({
                time: currentTime,
                bac: Math.max(0, Math.round(bac * 1000 * 100) / 100)
            });
        }

        return dataPoints;
    }

    /**
     * Calculate the full time range for the BAC curve
     * @param {Array} drinks - Relevant drinks
     * @param {number} currentBACMgL - Current BAC in mg/L
     * @param {Date} referenceTime - Current/reference time
     * @returns {{fromTime: Date, toTime: Date}}
     */
    function calculateTimeRange(drinks, currentBACMgL, referenceTime) {
        // Find earliest drink time
        let earliestDrink = referenceTime;
        for (const drink of drinks) {
            try {
                const [year, month, day] = drink.date.split('-').map(Number);
                const [hours, minutes] = drink.time.split(':').map(Number);
                const drinkTime = new Date(year, month - 1, day, hours, minutes);
                if (drinkTime < earliestDrink) {
                    earliestDrink = drinkTime;
                }
            } catch { /* skip */ }
        }

        // From: 30 min before first drink
        const fromTime = new Date(earliestDrink.getTime() - 30 * 60 * 1000);

        // To: time to full sobriety + 30 min buffer
        const hoursToSobriety = currentBACMgL / 150; // 150 mg/L per hour elimination
        const sobrietyTime = new Date(referenceTime.getTime() + hoursToSobriety * 60 * 60 * 1000);
        const toTime = new Date(sobrietyTime.getTime() + 30 * 60 * 1000);

        return { fromTime, toTime };
    }

    /**
     * Create and render the BAC projection chart on a canvas
     * @param {string} canvasId - Canvas element ID
     * @param {Array} dataPoints - From generateBACCurve()
     * @param {Date} referenceTime - "Now" marker
     * @param {Object} chartStorage - Object to store chart instance for cleanup
     * @returns {Chart|null} Chart instance
     */
    function renderChart(canvasId, dataPoints, referenceTime, chartStorage) {
        const canvas = document.getElementById(canvasId);
        if (!canvas || !dataPoints.length) return null;

        const ctx = canvas.getContext('2d');
        const style = getComputedStyle(document.documentElement);
        const textColor = style.getPropertyValue('--text-secondary').trim() || '#666';
        const gridColor = style.getPropertyValue('--gray-4').trim() || '#e0e0e0';

        // Use formatted time strings as labels (avoids needing date adapter)
        const labels = dataPoints.map(p =>
            p.time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        );
        const values = dataPoints.map(p => p.bac);

        // Find the index closest to "now" for the vertical annotation
        let nowIndex = 0;
        let minDiff = Infinity;
        dataPoints.forEach((p, i) => {
            const diff = Math.abs(p.time - referenceTime);
            if (diff < minDiff) { minDiff = diff; nowIndex = i; }
        });

        // Segment colors based on BAC level
        const segmentColor = (ctx) => {
            const val = ctx.p1.parsed.y;
            if (val > 500) return 'rgba(255, 59, 48, 0.8)';   // danger
            if (val > 200) return 'rgba(255, 149, 0, 0.8)';    // warning
            return 'rgba(52, 199, 89, 0.8)';                    // safe
        };

        const segmentBgColor = (ctx) => {
            const val = ctx.p1.parsed.y;
            if (val > 500) return 'rgba(255, 59, 48, 0.15)';
            if (val > 200) return 'rgba(255, 149, 0, 0.15)';
            return 'rgba(52, 199, 89, 0.15)';
        };

        const chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Alcoolémie (mg/L)',
                    data: values,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    borderWidth: 2.5,
                    segment: {
                        borderColor: segmentColor,
                        backgroundColor: segmentBgColor
                    }
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        ticks: {
                            color: textColor,
                            maxTicksLimit: 8,
                            maxRotation: 0
                        },
                        grid: { color: gridColor, drawBorder: false }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: textColor,
                            callback: (val) => val + ' mg/L'
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
                                return labels[items[0].dataIndex] || '';
                            },
                            label: (item) => `${item.parsed.y.toFixed(0)} mg/L`
                        }
                    },
                    annotation: {
                        annotations: {
                            legalLimit: {
                                type: 'line',
                                yMin: 500,
                                yMax: 500,
                                borderColor: 'rgba(255, 59, 48, 0.6)',
                                borderWidth: 2,
                                borderDash: [6, 4],
                                label: {
                                    display: true,
                                    content: 'Limite légale (500 mg/L)',
                                    position: 'start',
                                    backgroundColor: 'rgba(255, 59, 48, 0.8)',
                                    color: '#fff',
                                    font: { size: 10 }
                                }
                            },
                            nowLine: {
                                type: 'line',
                                xScaleID: 'x',
                                xMin: labels[nowIndex],
                                xMax: labels[nowIndex],
                                borderColor: 'rgba(0, 122, 255, 0.7)',
                                borderWidth: 2,
                                borderDash: [4, 4],
                                label: {
                                    display: true,
                                    content: 'Maintenant',
                                    position: 'start',
                                    backgroundColor: 'rgba(0, 122, 255, 0.8)',
                                    color: '#fff',
                                    font: { size: 10 }
                                }
                            }
                        }
                    },
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

        if (chartStorage) {
            chartStorage['bac-projection'] = chart;
        }

        return chart;
    }

    /**
     * Initialize the time slider for BAC projection
     * @param {string} sliderId - Slider input element ID
     * @param {string} readoutId - Readout display element ID
     * @param {Array} dataPoints - BAC curve data points
     * @param {Date} referenceTime - "Now" time
     * @param {Chart} chart - Chart.js instance
     */
    function initSlider(sliderId, readoutId, dataPoints, referenceTime, chart) {
        const slider = document.getElementById(sliderId);
        const readout = document.getElementById(readoutId);
        if (!slider || !readout || !dataPoints.length) return;

        slider.min = 0;
        slider.max = dataPoints.length - 1;

        // Set initial position to "now"
        const nowIndex = dataPoints.findIndex(p => p.time >= referenceTime);
        slider.value = nowIndex >= 0 ? nowIndex : Math.floor(dataPoints.length / 2);

        function updateReadout() {
            const idx = parseInt(slider.value);
            const point = dataPoints[idx];
            if (!point) return;

            const diffMs = point.time - referenceTime;
            const diffMin = Math.round(diffMs / 60000);
            const absDiffMin = Math.abs(diffMin);
            const hours = Math.floor(absDiffMin / 60);
            const mins = absDiffMin % 60;

            let timeText;
            if (Math.abs(diffMin) < 3) {
                timeText = 'Maintenant';
            } else if (diffMin < 0) {
                timeText = hours > 0 ? `Il y a ${hours}h${mins > 0 ? mins + 'min' : ''}` : `Il y a ${mins}min`;
            } else {
                timeText = hours > 0 ? `Dans ${hours}h${mins > 0 ? mins + 'min' : ''}` : `Dans ${mins}min`;
            }

            const bacText = `${point.bac.toFixed(0)} mg/L`;
            const levelClass = point.bac > 500 ? 'danger' : point.bac > 200 ? 'warning' : 'safe';

            readout.innerHTML = `<span class="slider-time">${timeText}</span> <span class="slider-bac ${levelClass}">${bacText}</span>`;

            // Update chart crosshair via annotation
            if (chart && chart.options.plugins.annotation) {
                const label = dataPoints[idx].time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                chart.options.plugins.annotation.annotations.sliderLine = {
                    type: 'line',
                    xScaleID: 'x',
                    xMin: label,
                    xMax: label,
                    borderColor: 'rgba(88, 86, 214, 0.7)',
                    borderWidth: 2
                };
                chart.update('none');
            }
        }

        slider.addEventListener('input', updateReadout);
        updateReadout();
    }

    return { generateBACCurve, calculateTimeRange, renderChart, initSlider };
})();

window.BACProjectionCalculator = BACProjectionCalculator;
