// Monthly Trends Renderer - AlcoNote PWA (ECharts)
// Dual-axis line chart with zoom/pan and rich tooltips.

const TrendsStatsRenderer = (() => {
    'use strict';

    function cssVar(name, fallback) {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        return v || fallback;
    }

    function renderTrendsStats(stats) {
        const section = document.createElement('div');
        section.className = 'stats-section trends-section';

        if (!stats || !stats.months || stats.months.length < 2) {
            section.innerHTML = `
                <div class="section-header"><h3>Évolution mensuelle</h3></div>
                <div class="empty-message">Sélectionnez une période d'au moins 2 mois pour voir l'évolution.</div>
            `;
            return section;
        }

        section.innerHTML = `
            <div class="echarts-wrapper" id="trends-monthly-chart" style="height: 300px;"></div>
        `;
        section._trendsData = stats;
        return section;
    }

    function postRenderTrendsStats(stats, ctx) {
        const scope = ctx?.containerEl || document;
        const section = (scope.querySelector && scope.querySelector('.trends-section')) || document.querySelector('.trends-section');
        const data = section?._trendsData || stats;
        if (!data?.months || data.months.length < 2) return;
        const dom = (section && section.querySelector('#trends-monthly-chart')) || document.getElementById('trends-monthly-chart');
        if (!dom || typeof echarts === 'undefined') return;

        const prev = echarts.getInstanceByDom(dom);
        if (prev) prev.dispose();

        const chart = echarts.init(dom, null, { renderer: 'canvas' });
        const primary = cssVar('--primary-color', '#007AFF');
        const warning = cssVar('--warning-color', '#FF9500');
        const text = cssVar('--text-secondary', '#666');
        const grid = cssVar('--separator', '#e5e5ea');

        chart.setOption({
            tooltip: {
                trigger: 'axis',
                backgroundColor: cssVar('--bg-primary', '#fff'),
                borderColor: grid,
                borderWidth: 1,
                textStyle: { color: cssVar('--text-primary', '#000'), fontSize: 12 },
                axisPointer: { type: 'cross', crossStyle: { color: grid } }
            },
            legend: {
                data: ['Verres', 'Alcool (g)'],
                bottom: 0,
                textStyle: { color: text }
            },
            grid: { left: 48, right: 56, top: 20, bottom: 48 },
            dataZoom: [
                { type: 'inside', throttle: 50 },
                { type: 'slider', height: 18, bottom: 30, borderColor: 'transparent',
                  fillerColor: primary + '33', handleStyle: { color: primary } }
            ],
            xAxis: {
                type: 'category',
                data: data.months.map(m => m.label),
                axisLine: { lineStyle: { color: grid } },
                axisLabel: { color: text, fontSize: 11 }
            },
            yAxis: [
                {
                    type: 'value', name: 'Verres', position: 'left',
                    axisLine: { show: true, lineStyle: { color: primary } },
                    axisLabel: { color: text, fontSize: 10 },
                    splitLine: { lineStyle: { color: grid, type: 'dashed' } }
                },
                {
                    type: 'value', name: 'Alcool (g)', position: 'right',
                    axisLine: { show: true, lineStyle: { color: warning } },
                    axisLabel: { color: text, fontSize: 10 },
                    splitLine: { show: false }
                }
            ],
            series: [
                {
                    name: 'Verres', type: 'line', smooth: true,
                    data: data.months.map(m => m.drinkCount),
                    lineStyle: { width: 2.5, color: primary },
                    itemStyle: { color: primary },
                    areaStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: primary + '55' },
                                { offset: 1, color: primary + '00' }
                            ]
                        }
                    },
                    symbol: 'circle', symbolSize: 6
                },
                {
                    name: 'Alcool (g)', type: 'line', smooth: true,
                    yAxisIndex: 1,
                    data: data.months.map(m => m.alcoholGrams),
                    lineStyle: { width: 2.5, color: warning },
                    itemStyle: { color: warning },
                    areaStyle: {
                        color: {
                            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
                            colorStops: [
                                { offset: 0, color: warning + '44' },
                                { offset: 1, color: warning + '00' }
                            ]
                        }
                    },
                    symbol: 'circle', symbolSize: 6
                }
            ]
        });

        // Resize on window resize
        const resize = () => chart.resize();
        window.addEventListener('resize', resize);

        if (window.modularStatsManager) {
            window.modularStatsManager.charts['trends-monthly'] = {
                destroy: () => {
                    window.removeEventListener('resize', resize);
                    chart.dispose();
                }
            };
        }
    }

    return { renderTrendsStats, postRenderTrendsStats };
})();

window.TrendsStatsRenderer = TrendsStatsRenderer;
