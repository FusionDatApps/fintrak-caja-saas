// frontend/src/lib/summaryApi.js
import { apiGet } from "./api";

/**
 * Obtiene el resumen mensual para un mes (YYYY-MM).
 * Backend: GET /summary/monthly?month=YYYY-MM
 */
export function getMonthlySummary(token, month) {
  return apiGet(`/summary/monthly?month=${month}`, token);
}

/**
 * Compara dos meses (YYYY-MM vs YYYY-MM).
 * Backend: GET /summary/compare?monthA=YYYY-MM&monthB=YYYY-MM
 *
 * Devuelve:
 * { monthA, monthB, delta, pct_change, meta }
 */
export function getMonthlyCompare(token, monthA, monthB) {
  return apiGet(`/summary/compare?monthA=${monthA}&monthB=${monthB}`, token);
}