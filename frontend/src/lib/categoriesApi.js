// frontend/src/lib/categoriesApi.js
import { apiDelete, apiGet, apiPost, apiPut } from "./api";

/**
 * GET categorías
 */
export function getCategories(token, { all = false } = {}) {
  const q = all ? "?all=1" : "";
  return apiGet(`/categories${q}`, token);
}

/**
 * POST crear categoría
 */
export function createCategory(token, name) {
  return apiPost(`/categories`, { name }, token);
}

/**
 * PUT renombrar categoría
 */
export function renameCategory(token, id, name) {
  return apiPut(`/categories/${id}`, { name }, token);
}

/**
 * DELETE (soft)
 */
export function deactivateCategory(token, id) {
  return apiDelete(`/categories/${id}`, token);
}