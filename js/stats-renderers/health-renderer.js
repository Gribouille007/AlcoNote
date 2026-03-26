// Composant de rendu pour les statistiques de santé - AlcoNote PWA

// ── Configuration des paliers d'alcoolémie ──────────────────────────
// Modifie ce tableau pour ajouter, supprimer ou changer les paliers.
// Chaque entrée : { max: seuil en mg/L, class: classe CSS, text: texte affiché }
// Les entrées doivent être triées par max croissant.
const BAC_LEVELS = [
    { max: 200,      class: 'safe',    text: 'Sobre' },
    { max: 500,      class: 'caution', text: 'OK GARMIN TROUVE MES CLÉS DE VOITURE' },
    { max: 800,      class: 'warning', text: 'OK GARMIN CACHE MES CLÉS DE VOITURE' },
    { max: 1999,     class: 'warning', text: "Il est l'heure d'aller nager dans le lac" },
    { max: 2999,     class: 'danger',  text: 'Brieuc arrête de boire' },
    { max: Infinity, class: 'danger',  text: "Y a qu'une personne pour arriver à ce stade" },
];

/**
 * Rend les statistiques de santé
 * @param {Object} stats - Statistiques de santé calculées
 * @returns {HTMLElement} Section des statistiques de santé
 */
function renderHealthStats(stats) {
    if (!stats) {
        return null;
    }

    const section = document.createElement('div');
    section.className = 'stats-section';
    section.innerHTML = `
        <div class="section-header">
            <h3>Indicateurs de santé</h3>
            <button class="info-btn" id="health-info-btn" title="Informations sur les indicateurs de santé">ℹ️</button>
        </div>
        <div class="stats-grid">
            ${stats.weeklyAlcohol !== null && stats.weeklyAlcohol !== undefined ? `
            <div class="stat-card">
                <div class="stat-value">${stats.weeklyAlcohol}g</div>
                <div class="stat-label">Alcool/semaine</div>
            </div>
            ` : ''}
            ${stats.whoComparison !== null && stats.whoComparison !== undefined ? `
            <div class="stat-card ${stats.whoComparison > 100 ? 'warning' : ''}">
                <div class="stat-value">${stats.whoComparison}%</div>
                <div class="stat-label">vs. OMS</div>
            </div>
            ` : ''}
            ${stats.bacEstimation && stats.bacEstimation.currentBAC !== null && stats.bacEstimation.currentBAC !== undefined ? `
            <div class="stat-card">
                <div class="stat-value">${Number(stats.bacEstimation.currentBAC).toFixed(0)} mg/L</div>
                <div class="stat-label">Taux estimé</div>
            </div>
            ` : ''}
        </div>
    `;

    return section;
}

/**
 * Rend la section d'estimation d'alcoolémie
 * @param {Object} context - Context including referenceDate and drinks
 * @returns {HTMLElement} Section d'estimation BAC
 */
async function renderBACEstimation(context = {}) {
    try {
        const settings = await dbManager.getAllSettings();
        const userWeight = settings.userWeight;
        const userGender = settings.userGender;

        const section = document.createElement('div');
        section.className = 'stats-section bac-estimation-section';
        section.id = 'bac-estimation-section';

        if (!userWeight || !userGender) {
            // Show setup message if user data is missing
            section.innerHTML = `
                <div class="section-header">
                    <h3>🍺 Estimation alcoolémie</h3>
                    <button class="info-btn" id="bac-info-btn" title="Informations sur l'estimation d'alcoolémie">ℹ️</button>
                </div>
                <div class="bac-setup-message">
                    <div class="setup-icon">⚙️</div>
                    <h4>Configuration requise</h4>
                    <p>Pour calculer votre taux d'alcoolémie, veuillez renseigner votre poids et sexe dans les paramètres.</p>
                    <button id="open-profile-settings" class="btn-primary">Configurer mon profil</button>
                </div>
                <div class="bac-disclaimer">
                    <p><strong>⚠️ Ces valeurs sont indicatives et ne remplacent pas un test certifié.</strong></p>
                </div>
            `;

            return section;
        }

        // Determine reference time for BAC calculation
        // CRITICAL: Use current time for 'today' or when dateRange end is today
        // Otherwise BAC will be calculated hours in the future, showing near-zero values
        let referenceTime = new Date();

        // If we have a specific dateRange in context that's NOT today, use the end of that range
        if (context.dateRange) {
            const endDate = context.dateRange.end;
            const today = Utils.getCurrentDate(); // Get today in YYYY-MM-DD format

            // Only use end-of-day if we're looking at a past date
            if (endDate !== today && endDate < today) {
                // Parse the date and set time to end of day (23:59:59)
                const [year, month, day] = endDate.split('-').map(Number);
                referenceTime = new Date(year, month - 1, day, 23, 59, 59);
            } else {
                // Using current time as referenceTime (date is today or future)
            }
        } else {
            // Using current time as referenceTime (no dateRange in context)
        }

        // Get drinks from context if available, otherwise fetch
        const drinksForBAC = context.drinks || [];

        // Calculate BAC statistics with reference time and drinks
        const bacStats = await Utils.calculateBACStats(userWeight, userGender, referenceTime, drinksForBAC);

        if (!bacStats) {
            section.innerHTML = `
                <div class="section-header">
                    <h3>🍺 Estimation alcoolémie</h3>
                    <button class="info-btn" id="bac-info-btn" title="Informations sur l'estimation d'alcoolémie">ℹ️</button>
                </div>
                <div class="bac-error">
                    <p>Impossible de calculer l'alcoolémie. Vérifiez vos données de profil.</p>
                </div>
            `;
            return section;
        }

        // Try to record this BAC if it's a peak (only for current time, not historical)
        const isCurrentTime = Math.abs(referenceTime - new Date()) < 60000; // Within 1 minute
        if (isCurrentTime && bacStats.currentBAC > 0) {
            await Utils.recordBACIfPeak(
                bacStats.currentBAC,
                bacStats.relevantDrinks.length,
                bacStats.relevantDrinks
            );
        }

        // Fetch BAC records for display
        const bacRecords = await dbManager.getBACRecords(5);
        const highestRecord = await dbManager.getHighestBACRecord();

        // Render BAC estimation with current values in mg/L
        const bacLevel = bacStats.currentBAC; // Already in mg/L from utils.js
        const bacLevelClass = getBACLevelClass(bacLevel);
        const bacLevelText = getBACLevelText(bacLevel);

        section.innerHTML = `
            <div class="section-header">
                <h3>🍺 Estimation alcoolémie</h3>
                <button class="info-btn" id="bac-info-btn" title="Informations sur l'estimation d'alcoolémie">ℹ️</button>
            </div>
            
            <div class="bac-main-display">
                <div class="bac-gauge-container">
                    <div class="bac-gauge ${bacLevelClass}">
                        <div class="bac-value">${bacLevel.toFixed(0)}</div>
                        <div class="bac-unit">mg/L</div>
                    </div>
                    <div class="bac-status ${bacLevelClass}">
                        ${bacLevelText}
                    </div>
                </div>
            </div>
            
            <div class="bac-times-grid">
                <div class="bac-time-card">
                    <div class="time-icon">🕐</div>
                    <div class="time-info">
                        <div class="time-label">Sobriété complète (0 mg/L)</div>
                        <div class="time-value">${Utils.formatTimeToSobriety(bacStats.timeToSobriety)}</div>
                    </div>
                </div>
                <div class="bac-time-card">
                    <div class="time-icon">🚗</div>
                    <div class="time-info">
                        <div class="time-label">Conduite autorisée (< 500 mg/L)</div>
                        <div class="time-value">${Utils.formatTimeToSobriety(bacStats.timeToLegalLimit)}</div>
                    </div>
                </div>
            </div>
            
            ${bacStats.relevantDrinks.length > 0 ? `
            <div class="bac-drinks-summary">
                <h4>Consommations prises en compte (${bacStats.relevantDrinks.length})</h4>
                <div class="relevant-drinks-list">
                    ${bacStats.relevantDrinks.slice(0, 3).map(drink => {
            try {
                const [year, month, day] = drink.date.split('-').map(Number);
                const [hours, minutes] = drink.time.split(':').map(Number);
                const drinkTime = new Date(year, month - 1, day, hours, minutes);
                const hoursAgo = Math.round((referenceTime - drinkTime) / (1000 * 60 * 60) * 10) / 10;
                return `
                                <div class="relevant-drink-item">
                                    <span class="drink-name">${drink.name}</span>
                                    <span class="drink-details">${Utils.formatQuantity(drink.quantity, drink.unit)} • ${drink.alcoholContent || 0}%</span>
                                    <span class="drink-time">il y a ${hoursAgo}h</span>
                                </div>
                            `;
            } catch (e) {
                return '';
            }
        }).join('')}
                    ${bacStats.relevantDrinks.length > 3 ? `
                        <div class="more-drinks">+${bacStats.relevantDrinks.length - 3} autre${bacStats.relevantDrinks.length - 3 > 1 ? 's' : ''}</div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
            ${renderBACRecordsSection(bacRecords, highestRecord)}
            
            <div class="bac-disclaimer">
                <p><strong>⚠️ Ces valeurs sont indicatives et ne remplacent pas un test certifié.</strong></p>
            </div>
        `;

        return section;

    } catch (error) {
        console.error('Error rendering BAC estimation:', error);
        const section = document.createElement('div');
        section.className = 'stats-section bac-estimation-section';
        section.innerHTML = `
            <div class="section-header">
                <h3>🍺 Estimation alcoolémie</h3>
            </div>
            <div class="bac-error">
                <p>Erreur lors du calcul de l'alcoolémie.</p>
            </div>
        `;
        return section;
    }
}

/**
 * Render BAC records section
 */
function renderBACRecordsSection(records, highestRecord) {
    if (!records || records.length === 0) {
        return '';
    }

    return `
        <div class="bac-records-section">
            <h4>📊 Records de taux d'alcoolémie</h4>
            ${highestRecord ? `
            <div class="bac-record-card bac-record-highest" data-record-id="${highestRecord.id}">
                <div class="record-badge ${getBACLevelClass(highestRecord.bacValue)}">
                    <span class="badge-icon">👑</span>
                    <span class="badge-value">${highestRecord.bacValue.toFixed(0)} mg/L</span>
                </div>
                <div class="record-info">
                    <div class="record-label">Record absolu</div>
                    <div class="record-date">${formatRecordDate(highestRecord.timestamp)}</div>
                    <div class="record-drinks">${highestRecord.drinkCount} consommation${highestRecord.drinkCount > 1 ? 's' : ''}</div>
                </div>
                <button class="bac-record-delete" data-record-id="${highestRecord.id}" title="Supprimer">🗑️</button>
            </div>
            ` : ''}
            <div class="bac-records-list">
                ${records.slice(0, 5).map(record => `
                    <div class="bac-record-card" data-record-id="${record.id}">
                        <div class="record-badge ${getBACLevelClass(record.bacValue)}">
                            <span class="badge-value">${record.bacValue.toFixed(0)} mg/L</span>
                        </div>
                        <div class="record-info">
                            <div class="record-date">${formatRecordDate(record.timestamp)}</div>
                            <div class="record-drinks">${record.drinkCount} consommation${record.drinkCount > 1 ? 's' : ''}</div>
                        </div>
                        <button class="bac-record-delete" data-record-id="${record.id}" title="Supprimer">🗑️</button>
                    </div>
                `).join('')}
            </div>
            ${records.length > 5 ? `
                <button class="btn-secondary view-all-records" id="view-all-records-btn">Voir tout l'historique (${records.length})</button>
            ` : ''}
        </div>
    `;
}

/**
 * Format record timestamp to readable date
 */
function formatRecordDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 24) {
        return `Aujourd'hui à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
        return `Hier à ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
        return `${diffDays} jours • ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
    } else {
        return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    }
}

/**
 * Get BAC level CSS class for styling (bacLevel in mg/L)
 */
function getBACLevelClass(bacLevel) {
    const level = BAC_LEVELS.find(l => bacLevel < l.max || bacLevel <= l.max);
    return level ? level.class : 'danger';
}

/**
 * Get BAC level descriptive text (bacLevel in mg/L)
 */
function getBACLevelText(bacLevel) {
    const level = BAC_LEVELS.find(l => bacLevel < l.max || bacLevel <= l.max);
    return level ? level.text : BAC_LEVELS[BAC_LEVELS.length - 1].text;
}

/**
 * Confirmation inline de suppression d'un record BAC
 */
function confirmDeleteBACRecord(recordId, cardElement) {
    const originalContent = cardElement.innerHTML;
    const isHighest = cardElement.classList.contains('bac-record-highest');

    cardElement.innerHTML = `
        <div class="bac-delete-confirm">
            <span>Supprimer ${isHighest ? 'le record absolu' : 'cet enregistrement'} ?</span>
            <div class="bac-delete-confirm-actions">
                <button class="btn-danger confirm-yes">Oui</button>
                <button class="btn-secondary confirm-no">Non</button>
            </div>
        </div>
    `;

    cardElement.querySelector('.confirm-yes').addEventListener('click', async () => {
        try {
            await dbManager.deleteBACRecord(recordId);
            // If it was the highest record, re-render the whole records section
            if (isHighest) {
                const section = cardElement.closest('.bac-records-section');
                if (section) {
                    const records = await dbManager.getBACRecords(5);
                    const newHighest = await dbManager.getHighestBACRecord();
                    section.outerHTML = renderBACRecordsSection(records, newHighest);
                    // Re-attach delete handlers on the new DOM
                    attachDeleteHandlers();
                }
            } else {
                cardElement.remove();
            }
        } catch (e) {
            console.error('Error deleting BAC record:', e);
            cardElement.innerHTML = originalContent;
        }
    });

    cardElement.querySelector('.confirm-no').addEventListener('click', () => {
        cardElement.innerHTML = originalContent;
        // Re-attach delete handler on the restored button
        const btn = cardElement.querySelector('.bac-record-delete');
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                confirmDeleteBACRecord(parseInt(btn.dataset.recordId), cardElement);
            });
        }
    });
}

/**
 * Attache les handlers de suppression sur tous les boutons .bac-record-delete
 */
function attachDeleteHandlers() {
    document.querySelectorAll('.bac-record-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const recordId = parseInt(btn.dataset.recordId);
            const card = btn.closest('.bac-record-card');
            if (card) {
                confirmDeleteBACRecord(recordId, card);
            }
        });
    });
}

/**
 * Post-traitement après rendu
 * @param {Object} stats - Statistiques de santé
 */
function postRenderHealthStats(stats) {
    // Add click event for health info button
    const infoBtn = document.getElementById('health-info-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', () => {
            showHealthInfoModal();
        });
    }

    // Add click event for BAC info button
    const bacInfoBtn = document.getElementById('bac-info-btn');
    if (bacInfoBtn) {
        bacInfoBtn.addEventListener('click', () => {
            showBACInfoModal();
        });
    }

    // Add click event for profile settings
    const openSettingsBtn = document.getElementById('open-profile-settings');
    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
            openProfileSettings();
        });
    }

    // Attach delete handlers on BAC record cards
    attachDeleteHandlers();
}

/**
 * Open profile settings
 */
function openProfileSettings() {
    const settingsMenu = document.getElementById('settings-menu');
    if (settingsMenu) {
        settingsMenu.classList.add('active');

        // Focus on weight input
        setTimeout(() => {
            const weightInput = document.getElementById('user-weight');
            if (weightInput) {
                weightInput.focus();
            }
        }, 300);
    }
}

/**
 * Show health information modal (simplified version)
 */
function showHealthInfoModal() {
    const existing = document.getElementById('health-info-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'health-info-modal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content health-info-modal">
            <div class="modal-header">
                <h2>📊 Indicateurs de santé</h2>
                <button class="modal-close" onclick="document.getElementById('health-info-modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="info-card">
                    <div class="info-header">
                        <h3>🍺 Alcool/semaine (g)</h3>
                        <div class="info-badge">Gramme d'éthanol</div>
                    </div>
                    <div class="info-body">
                        <p>Somme des grammes d'alcool pur consommés, ramenée à une moyenne hebdomadaire sur la période sélectionnée.</p>
                        <p>Calcul: Volume(cL) × Degré(%) × 0,8 ÷ 100.</p>
                    </div>
                </div>
                <div class="info-card">
                    <div class="info-header">
                        <h3>🏥 Comparaison OMS</h3>
                        <div class="info-badge">Référence santé publique</div>
                    </div>
                    <div class="info-body">
                        <p>Limites hebdomadaires: 140g (femmes) / 210g (hommes). Valeur affichée = (Moyenne hebdomadaire / Limite) × 100.</p>
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="document.getElementById('health-info-modal').remove()">Fermer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.remove());
}

/**
 * Show BAC information modal (simplified version)
 */
function showBACInfoModal() {
    const existing = document.getElementById('bac-info-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'bac-info-modal';
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-backdrop"></div>
        <div class="modal-content">
            <div class="modal-header">
                <h2>🍺 Estimation d'alcoolémie</h2>
                <button class="modal-close" onclick="document.getElementById('bac-info-modal').remove()">&times;</button>
            </div>
            <div class="modal-body">
                <div class="info-section">
                    <h3>🧮 Formule de Widmark (LaTeX)</h3>
                    <p><strong>Modèle avec élimination :</strong></p>
                    <div class="formula-box">
                        <p>$$ C(t) = \\max\\left(0, \\frac{A}{m\\,\\cdot\\,r} - \\beta\\, t \\right) \\quad [\\text{g/L}] $$</p>
                    </div>
                    <ul>
                        <li>\\(A\\) = alcool ingéré (g)</li>
                        <li>\\(m\\) = masse corporelle (kg)</li>
                        <li>\\(r\\) = coefficient (homme: \\(0{,}68\\), femme: \\(0{,}55\\))</li>
                        <li>\\(\\beta\\) = vitesse d'élimination (\\(0{,}15\\ \\text{g/L/h}\\) en moyenne)</li>
                    </ul>
                </div>
                <div class="info-section">
                    <h3>🔢 Calcul de l'alcool ingéré</h3>
                    <p><strong>À partir des volumes (en litres) et degrés :</strong></p>
                    <div class="formula-box">
                        <p>$$ A = \\sum_i V_i\\, \\cdot\\, \\frac{p_i}{100} \\cdot 0{,}8 \\cdot 1000 \\quad [\\text{g}] $$</p>
                    </div>
                    <ul>
                        <li>\\(V_i\\) = volume de la boisson i (L)</li>
                        <li>\\(p_i\\) = degré alcoolique (\\%)</li>
                        <li>\\(0{,}8\\) = densité de l'éthanol (g/mL)</li>
                        <li>Multiplication par \\(1000\\) pour convertir en grammes</li>
                    </ul>
                    <p><em>Si volumes en cL:</em> \\(V_i\\,[\\text{L}] = \\frac{V_i\\,[\\text{cL}]}{100}\\).</p>
                </div>
                <div class="info-section">
                    <h3>📏 Unités et seuils</h3>
                    <ul>
                        <li>Conversion: \\(1\\ \\text{g/L} = 1000\\ \\text{mg/L}\\)</li>
                        <li>Affichage dans l'app: \\(\\text{mg/L}\\)</li>
                        <li>Seuil légal général: \\(500\\ \\text{mg/L} = 0{,}5\\ \\text{g/L}\\)</li>
                        <li>Jeunes conducteurs: \\(0{,}2\\ \\text{g/L} = 200\\ \\text{mg/L}\\)</li>
                    </ul>
                </div>
                <div class="info-section">
                    <h3>ℹ️ Remarques importantes</h3>
                    <ul>
                        <li>Le modèle est une estimation théorique, non un diagnostic médical</li>
                        <li>De nombreux facteurs individuels influencent \\(\\beta\\) et l'absorption</li>
                        <li>En cas de doute: ne conduisez pas et utilisez un éthylotest certifié</li>
                    </ul>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn-secondary" onclick="document.getElementById('bac-info-modal').remove()">Fermer</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    // Typeset LaTeX if MathJax is available
    try {
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([modal]).catch(() => { });
        }
    } catch (e) { }
    modal.querySelector('.modal-backdrop').addEventListener('click', () => modal.remove());
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        renderHealthStats,
        renderBACEstimation,
        postRenderHealthStats
    };
} else {
    window.HealthStatsRenderer = {
        renderHealthStats,
        renderBACEstimation,
        postRenderHealthStats
    };
}
