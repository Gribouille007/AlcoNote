// Composant de rendu pour les statistiques de santé - AlcoNote PWA

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
 * @returns {HTMLElement} Section d'estimation BAC
 */
async function renderBACEstimation() {
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
        
        // Calculate BAC statistics
        const bacStats = await Utils.calculateBACStats(userWeight, userGender);
        
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
                        const drinkTime = new Date(`${drink.date}T${drink.time}`);
                        const hoursAgo = Math.round((new Date() - drinkTime) / (1000 * 60 * 60) * 10) / 10;
                        return `
                            <div class="relevant-drink-item">
                                <span class="drink-name">${drink.name}</span>
                                <span class="drink-details">${Utils.formatQuantity(drink.quantity, drink.unit)} • ${drink.alcoholContent || 0}%</span>
                                <span class="drink-time">il y a ${hoursAgo}h</span>
                            </div>
                        `;
                    }).join('')}
                    ${bacStats.relevantDrinks.length > 3 ? `
                        <div class="more-drinks">+${bacStats.relevantDrinks.length - 3} autre${bacStats.relevantDrinks.length - 3 > 1 ? 's' : ''}</div>
                    ` : ''}
                </div>
            </div>
            ` : ''}
            
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
 * Get BAC level CSS class for styling (bacLevel in mg/L)
 */
function getBACLevelClass(bacLevel) {
    if (bacLevel <= 50) return 'safe';        
    if (bacLevel <= 500) return 'caution';    
    if (bacLevel <= 800) return 'warning';    
    return 'danger';                          
}

/**
 * Get BAC level descriptive text (bacLevel in mg/L)
 */
function getBACLevelText(bacLevel) {
    if (bacLevel <= 50) return 'Sobre';
    if (bacLevel <= 500) return 'Conduite autorisée';
    if (bacLevel <= 800) return 'Conduite interdite';
    if (bacLevel <= 1999) return 'État d\'ébriété dangereux';
    return 'Brieuc arrête de boire';
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
            window.MathJax.typesetPromise([modal]).catch(() => {});
        }
    } catch (e) {}
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
