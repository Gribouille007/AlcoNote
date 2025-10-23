// Configuration des statistiques - AlcoNote PWA
// Ce fichier définit quelles statistiques afficher et dans quel ordre

const STATS_CONFIG = {
    // Désactiver le fallback vers l'ancien système pour éviter les duplications
    legacyFallbackEnabled: false,

    // Sections principales des statistiques
    sections: [
        {
            id: 'general',
            title: 'Statistiques générales',
            description: 'Vue d\'ensemble de votre consommation',
            enabled: true,
            calculator: 'general',
            renderer: 'general',
            order: 1
        },
        {
            id: 'temporal',
            title: 'Analyse temporelle',
            description: 'Répartition par heures et jours',
            enabled: true,
            calculator: 'temporal',
            renderer: 'temporal',
            order: 2
        },
        {
            id: 'categories',
            title: 'Analyse par catégorie',
            description: 'Statistiques par type de boisson',
            enabled: true,
            calculator: 'categories',
            renderer: 'categories',
            order: 3
        },
        {
            id: 'drinks',
            title: 'Top des boissons',
            description: 'Vos boissons les plus consommées',
            enabled: true,
            calculator: 'drinks',
            renderer: 'drinks',
            order: 4
        },
        {
            id: 'health',
            title: 'Alcoolémie',
            description: 'Estimation d\'alcoolémie (BAC)',
            enabled: true,
            calculator: 'health',
            renderer: 'health',
            order: 6
        },
        {
            id: 'location',
            title: 'Carte des consommations',
            description: 'Localisation de vos consommations',
            enabled: true,
            calculator: 'location',
            renderer: 'location',
            order: 5
        }
    ],

    // Configuration des graphiques
    charts: {
        colors: {
            primary: '#007AFF',
            secondary: '#34C759',
            warning: '#FF9500',
            danger: '#FF3B30',
            info: '#5AC8FA'
        },
        defaultOptions: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    },

    // Configuration des cartes
    maps: {
        defaultZoom: 12,
        clusterRadius: 80,
        maxMarkers: 500
    },

    // Configuration du cache
    cache: {
        maxAge: 5 * 60 * 1000, // 5 minutes
        enabled: true
    }
};

// Fonction utilitaire pour obtenir les sections activées
function getEnabledSections() {
    return STATS_CONFIG.sections
        .filter(section => section.enabled)
        .sort((a, b) => a.order - b.order);
}

// Fonction utilitaire pour obtenir une section par ID
function getSectionById(id) {
    return STATS_CONFIG.sections.find(section => section.id === id);
}

// Fonction pour activer/désactiver une section
function toggleSection(id, enabled) {
    const section = getSectionById(id);
    if (section) {
        section.enabled = enabled;
    }
}

// Export pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STATS_CONFIG,
        getEnabledSections,
        getSectionById,
        toggleSection
    };
} else {
    // Pour utilisation dans le navigateur
    window.StatsConfig = {
        STATS_CONFIG,
        getEnabledSections,
        getSectionById,
        toggleSection
    };
}
