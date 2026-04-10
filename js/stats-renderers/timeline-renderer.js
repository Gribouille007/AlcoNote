// Session Timeline Renderer - AlcoNote PWA
// Renders a horizontal timeline of drinking sessions

const TimelineStatsRenderer = {
    /**
     * Render the session timeline
     * @param {Object} stats - From TimelineStatsCalculator
     * @returns {HTMLElement}
     */
    renderTimelineStats(stats) {
        const section = document.createElement('div');
        section.className = 'stats-section timeline-section';

        if (!stats || !stats.sessions || !stats.sessions.length) {
            section.innerHTML = `
                <div class="section-header"><h3>Timeline des sessions</h3></div>
                <div class="empty-message">Aucune session de consommation détectée.</div>
            `;
            return section;
        }

        const sessions = stats.sessions;

        section.innerHTML = `
            <div class="timeline-summary">
                <span class="timeline-stat">${stats.totalSessions} session${stats.totalSessions > 1 ? 's' : ''}</span>
            </div>
            <div class="timeline-scroll-wrapper">
                <div class="timeline-track">
                    ${sessions.map((session, i) => {
                        const intensityClass = session.intensity > 0.75 ? 'high'
                            : session.intensity > 0.4 ? 'medium' : 'low';
                        const dateLabel = formatSessionDate(session.startTime);
                        const timeLabel = formatSessionTime(session.startTime);
                        return `
                            <div class="timeline-session ${intensityClass}" data-index="${i}">
                                <div class="session-bar" style="--intensity: ${session.intensity}">
                                    <div class="session-fill"></div>
                                </div>
                                <div class="session-info">
                                    <div class="session-date">${dateLabel}</div>
                                    <div class="session-time">${timeLabel}</div>
                                    <div class="session-details">
                                        ${session.drinkCount} verre${session.drinkCount > 1 ? 's' : ''} • ${session.durationText}
                                    </div>
                                    <div class="session-alcohol">${Math.round(session.totalAlcohol)}g alcool</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        return section;
    },

    postRenderTimelineStats() {
        // Pure DOM — no chart to initialize
    }
};

function formatSessionDate(dateTime) {
    try {
        return dateTime.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
        return '';
    }
}

function formatSessionTime(dateTime) {
    try {
        return dateTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return '';
    }
}

window.TimelineStatsRenderer = TimelineStatsRenderer;
