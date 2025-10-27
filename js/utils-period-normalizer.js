// Utilitaire global pour fiabiliser les calculs de périodes
// Empêche les dépassements de jours incohérents entre mois ou années

/**
 * Normalise la différence de jours entre deux dates selon la période courante
 * @param {string} periodType - "today" | "week" | "month" | "year" | "custom"
 * @param {string} startDate - Date début au format YYYY-MM-DD
 * @param {string} endDate - Date fin au format YYYY-MM-DD
 * @returns {number} Nombre de jours corrigé (1 minimum, borne max selon la période)
 */
function normalizeDaysForPeriod(periodType, startDate, endDate) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  if (isNaN(start) || isNaN(end)) return 1;

  // Calcul précis incluant le jour de début ET le jour de fin
  const diffTime = end - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const days = Math.max(1, diffDays);
  
  switch (periodType) {
    case "today":
      return 1;
    case "week":
      return Math.min(days, 7);
    case "month": {
      const monthDays = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
      return Math.min(days, monthDays);
    }
    case "year": {
      // Gérer les années bissextiles
      const isLeapYear = (year) => (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
      const yearDays = isLeapYear(start.getFullYear()) ? 366 : 365;
      return Math.min(days, yearDays);
    }
    default:
      return days;
  }
}

// Export universel
if (typeof module !== "undefined" && module.exports) {
  module.exports = { normalizeDaysForPeriod };
} else {
  window.normalizeDaysForPeriod = normalizeDaysForPeriod;
}
