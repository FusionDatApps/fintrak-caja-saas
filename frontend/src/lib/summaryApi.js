// frontend/src/lib/summaryApi.js
import { apiGet } from "./api";

/**
 * Resumen mensual:
 * Backend: GET /summary/monthly?month=YYYY-MM
 */
export function getMonthlySummary(token, month) {
  return apiGet(`/summary/monthly?month=${month}`, token);
}

/**
 * Resumen por categoría:
 * Backend: GET /summary/by-category?month=YYYY-MM
 */
export function getCategorySummary(token, month) {
  return apiGet(`/summary/by-category?month=${month}`, token);
}

/**
 * Comparativo mensual:
 * Backend: GET /summary/compare?monthA=YYYY-MM&monthB=YYYY-MM
 */
export function getMonthlyCompare(token, monthA, monthB) {
  return apiGet(`/summary/compare?monthA=${monthA}&monthB=${monthB}`, token);
}

/**
 * Tendencia mensual + MoM (Month-over-Month = variación mes contra mes).
 * Backend: GET /summary/trend?from=YYYY-MM&to=YYYY-MM
 */
export function getMonthlyTrend(token, from, to) {
  return apiGet(`/summary/trend?from=${from}&to=${to}`, token);
}
