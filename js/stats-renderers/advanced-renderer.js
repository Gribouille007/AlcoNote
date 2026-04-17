// Advanced Analytics Renderer — AlcoNote PWA
// Renders: rolling avg chart, hourly polar, session histogram, comparison sparklines
// All charts use Apache ECharts for rich interactivity.

const AdvancedStatsRenderer = (() => {
    'use strict';

    const chartInstances = [];

    function cssVar(name, fallback) {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
    }

    function renderAdvancedStats(stats) {
        const section = document.createElement('div');
        section.className = 'stats-section advanced-section';

        const hasAny = (stats && (stats.rolling?.length || stats.sessions?.sessions?.length || stats.polar?.some(v => v > 0)));
        if (!hasAny) {
            section.innerHTML = `<div class="empty-message">Pas assez de données pour les analyses avancées.</div>`;
            return section;
        }

        const blocks = [];

        if (stats.rolling?.length >= 2) {
            blocks.push(`
                <div class="advanced-block">
                    <h4 class="advanced-block-title">Moyenne mobile — alcool / jour</h4>
                    <p class="advanced-block-subtitle">Consommation quotidienne lissée sur 7 et 30 jours</p>
                    <div class="echarts-wrapper" id="advanced-rolling" style="height: 260px;"></div>
                </div>
            `);
        }

        if (stats.polar?.some(v => v > 0)) {
            blocks.push(`
                <div class="advanced-block">
                    <h4 class="advanced-block-title">Horloge des consommations</h4>
                    <p class="advanced-block-subtitle">Répartition sur les 24 heures</p>
                    <div class="echarts-wrapper" id="advanced-polar" style="height: 320px;"></div>
                </div>
            `);
        }

        if (stats.sessions?.sessions?.length) {
            const hasBAC = stats.sessionBAC && stats.sessionBAC.sessionsWithBAC > 0;
            const bacSubtitle = hasBAC
                ? `Durée et alcoolémie moyenne (${stats.sessionBAC.avgPeakBAC.toFixed(2)} g/L en moyenne)`
                : 'Durée des sessions — configurez votre profil pour voir l\'alcoolémie par session';
            blocks.push(`
                <div class="advanced-block">
                    <h4 class="advanced-block-title">Distribution des sessions</h4>
                    <p class="advanced-block-subtitle">${bacSubtitle}</p>
                    <div class="advanced-dual">
                        <div class="echarts-wrapper" id="advanced-duration" style="height: 240px;"></div>
                        ${hasBAC ? '<div class="echarts-wrapper" id="advanced-session-bac" style="height: 240px;"></div>' : ''}
                    </div>
                </div>
            `);
        }

        if (stats.comparison) {
            blocks.push(`
                <div class="advanced-block">
                    <h4 class="advanced-block-title">Comparaison inter-périodes</h4>
                    <p class="advanced-block-subtitle">Cette période vs. période précédente équivalente</p>
                    <div class="echarts-wrapper" id="advanced-comparison" style="height: 220px;"></div>
                </div>
            `);
        }

        section.innerHTML = blocks.join('');
        section._advancedData = stats;
        return section;
    }

    function postRenderAdvancedStats(stats, ctx) {
        const scope = ctx?.containerEl || document;
        const section = (scope.querySelector && scope.querySelector('.advanced-section')) || document.querySelector('.advanced-section');
        const data = section?._advancedData || stats;
        if (!data || typeof echarts === 'undefined') return;

        // Clean up prior instances
        chartInstances.forEach(c => { try { c.dispose(); } catch {} });
        chartInstances.length = 0;

        if (data.rolling?.length >= 2) renderRolling(data.rolling, section);
        if (data.polar?.some(v => v > 0)) renderPolar(data.polar, section);
        if (data.sessions?.sessions?.length) {
            renderDuration(data.sessions.durationBuckets, section);
            if (data.sessionBAC && data.sessionBAC.sessionsWithBAC > 0) {
                renderSessionBAC(data.sessionBAC, section);
            }
        }
        if (data.comparison) renderComparison(data.comparison, section);

        // Resize observer
        const resize = () => chartInstances.forEach(c => { try { c.resize(); } catch {} });
        window.addEventListener('resize', resize);
        if (window.modularStatsManager) {
            window.modularStatsManager.charts['advanced-all'] = {
                destroy: () => {
                    window.removeEventListener('resize', resize);
                    chartInstances.forEach(c => { try { c.dispose(); } catch {} });
                    chartInstances.length = 0;
                }
            };
        }
    }

    function initChart(id, section) {
        const dom = (section && section.querySelector && section.querySelector('#' + id)) || document.getElementById(id);
        if (!dom) return null;
        const prev = echarts.getInstanceByDom(dom);
        if (prev) prev.dispose();
        const chart = echarts.init(dom);
        chartInstances.push(chart);
        return chart;
    }

    function renderRolling(rolling, section) {
        const chart = initChart('advanced-rolling', section);
        if (!chart) return;
        const primary = cssVar('--primary-color', '#007AFF');
        const secondary = cssVar('--secondary-color', '#5856D6');
        const text = cssVar('--text-secondary', '#666');
        const grid = cssVar('--separator', '#e5e5ea');
        const labels = rolling.map(r => r.date.slice(5));

        chart.setOption({
            tooltip: {
                trigger: 'axis',
                backgroundColor: cssVar('--bg-primary', '#fff'),
                borderColor: grid,
                textStyle: { color: cssVar('--text-primary', '#000') },
                valueFormatter: v => v.toFixed(1) + ' g'
            },
            legend: { data: ['Brut', '7 jours', '30 jours'], bottom: 0, textStyle: { color: text } },
            grid: { left: 44, right: 16, top: 16, bottom: 64, containLabel: true },
            dataZoom: [
                { type: 'inside' },
                { type: 'slider', height: 16, bottom: 28, fillerColor: primary + '22' }
            ],
            xAxis: {
                type: 'category', data: labels,
                axisLabel: { color: text, fontSize: 10 },
                axisLine: { lineStyle: { color: grid } }
            },
            yAxis: {
                type: 'value', name: 'g',
                axisLabel: { color: text, fontSize: 10, formatter: v => v.toFixed(0) + 'g' },
                splitLine: { lineStyle: { color: grid, type: 'dashed' } }
            },
            series: [
                {
                    name: 'Brut', type: 'bar',
                    data: rolling.map(r => r.daily),
                    itemStyle: { color: primary + '33', borderRadius: [3, 3, 0, 0] }
                },
                {
                    name: '7 jours', type: 'line', smooth: true,
                    data: rolling.map(r => r.rolling7),
                    lineStyle: { width: 2.5, color: primary },
                    itemStyle: { color: primary }, symbol: 'none'
                },
                {
                    name: '30 jours', type: 'line', smooth: true,
                    data: rolling.map(r => r.rolling30),
                    lineStyle: { width: 2, color: secondary, type: 'dashed' },
                    itemStyle: { color: secondary }, symbol: 'none'
                }
            ]
        });
    }

    function renderPolar(hours, section) {
        const chart = initChart('advanced-polar', section);
        if (!chart) return;
        const primary = cssVar('--primary-color', '#007AFF');
        const text = cssVar('--text-secondary', '#666');
        const grid = cssVar('--separator', '#e5e5ea');

        chart.setOption({
            polar: { radius: ['20%', '82%'] },
            angleAxis: {
                type: 'category',
                data: Array.from({ length: 24 }, (_, i) => String(i) + 'h'),
                startAngle: 90,
                axisLabel: { color: text, fontSize: 10 },
                axisLine: { lineStyle: { color: grid } },
                axisTick: { show: false },
                splitLine: { lineStyle: { color: grid, type: 'dashed' } }
            },
            radiusAxis: {
                axisLabel: { color: text, fontSize: 9 },
                splitLine: { lineStyle: { color: grid, type: 'dashed' } }
            },
            tooltip: {
                backgroundColor: cssVar('--bg-primary', '#fff'),
                borderColor: grid,
                textStyle: { color: cssVar('--text-primary', '#000') },
                formatter: p => `${p.name} : <b>${p.value}</b> conso.`
            },
            series: [{
                type: 'bar',
                coordinateSystem: 'polar',
                data: hours,
                itemStyle: {
                    color: {
                        type: 'radial', x: 0.5, y: 0.5, r: 0.8,
                        colorStops: [
                            { offset: 0, color: primary + 'bb' },
                            { offset: 1, color: primary + '66' }
                        ]
                    },
                    borderRadius: [4, 4, 0, 0]
                }
            }]
        });
    }

    function renderDuration(buckets, section) {
        const chart = initChart('advanced-duration', section);
        if (!chart) return;
        const primary = cssVar('--primary-color', '#007AFF');
        const text = cssVar('--text-secondary', '#666');
        const grid = cssVar('--separator', '#e5e5ea');
        const labels = ['<1h', '1-2h', '2-3h', '3-4h', '4-5h', '5-6h', '6-7h', '7-8h', '8h+'];
        chart.setOption({
            title: { text: 'Durée', left: 'center', top: 4, textStyle: { color: text, fontSize: 12 } },
            tooltip: { trigger: 'axis', valueFormatter: v => v + ' sessions' },
            grid: { left: 44, right: 16, top: 34, bottom: 40, containLabel: true },
            xAxis: { type: 'category', data: labels, axisLabel: { color: text, fontSize: 10, rotate: 30 }, axisLine: { lineStyle: { color: grid } } },
            yAxis: { type: 'value', minInterval: 1, axisLabel: { color: text, fontSize: 10 }, splitLine: { lineStyle: { color: grid, type: 'dashed' } } },
            series: [{
                type: 'bar', data: buckets,
                itemStyle: { color: primary, borderRadius: [4, 4, 0, 0] }
            }]
        });
    }

    function renderSessionBAC(sessionBAC, section) {
        const chart = initChart('advanced-session-bac', section);
        if (!chart) return;
        const warning = cssVar('--warning-color', '#FF9500');
        const text = cssVar('--text-secondary', '#666');
        const grid = cssVar('--separator', '#e5e5ea');
        const labels = ['<0,2', '0,2-0,5', '0,5-0,8', '0,8-1,2', '1,2+'];
        chart.setOption({
            title: { text: 'Alcoolémie par session (g/L)', left: 'center', top: 4, textStyle: { color: text, fontSize: 12 } },
            tooltip: { trigger: 'axis', valueFormatter: v => v + ' sessions' },
            grid: { left: 44, right: 16, top: 34, bottom: 40, containLabel: true },
            xAxis: { type: 'category', data: labels, axisLabel: { color: text, fontSize: 10, rotate: 30 }, axisLine: { lineStyle: { color: grid } } },
            yAxis: { type: 'value', minInterval: 1, axisLabel: { color: text, fontSize: 10 }, splitLine: { lineStyle: { color: grid, type: 'dashed' } } },
            series: [{
                type: 'bar', data: sessionBAC.buckets,
                itemStyle: { color: warning, borderRadius: [4, 4, 0, 0] }
            }]
        });
    }

    function renderComparison(comparison, section) {
        const chart = initChart('advanced-comparison', section);
        if (!chart) return;
        const primary = cssVar('--primary-color', '#007AFF');
        const gray = cssVar('--gray-2', '#AEAEB2');
        const text = cssVar('--text-secondary', '#666');
        const grid = cssVar('--separator', '#e5e5ea');
        const n = comparison.current.data.length;
        const xLabels = Array.from({ length: n }, (_, i) => 'J+' + (i + 1));
        chart.setOption({
            tooltip: {
                trigger: 'axis',
                backgroundColor: cssVar('--bg-primary', '#fff'),
                borderColor: grid,
                textStyle: { color: cssVar('--text-primary', '#000') },
                valueFormatter: v => v.toFixed(1) + ' g'
            },
            legend: { data: [comparison.current.label, comparison.previous.label], bottom: 0, textStyle: { color: text } },
            grid: { left: 44, right: 16, top: 10, bottom: 48, containLabel: true },
            xAxis: { type: 'category', data: xLabels, axisLabel: { color: text, fontSize: 10 }, axisLine: { lineStyle: { color: grid } } },
            yAxis: { type: 'value', axisLabel: { color: text, fontSize: 10, formatter: v => v.toFixed(0) + 'g' }, splitLine: { lineStyle: { color: grid, type: 'dashed' } } },
            series: [
                {
                    name: comparison.current.label, type: 'line', smooth: true,
                    data: comparison.current.data,
                    lineStyle: { width: 2.5, color: primary },
                    itemStyle: { color: primary }, symbol: 'none',
                    areaStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: primary + '55' },
                                { offset: 1, color: primary + '00' }
                            ]
                        }
                    }
                },
                {
                    name: comparison.previous.label, type: 'line', smooth: true,
                    data: comparison.previous.data,
                    lineStyle: { width: 2, color: gray, type: 'dashed' },
                    itemStyle: { color: gray }, symbol: 'none'
                }
            ]
        });
    }

    return { renderAdvancedStats, postRenderAdvancedStats };
})();

window.AdvancedStatsRenderer = AdvancedStatsRenderer;
