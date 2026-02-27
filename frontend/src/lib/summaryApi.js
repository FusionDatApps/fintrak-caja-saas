import { apiGet } from "./api";

export function getMonthlySummary(token, month) {
  return apiGet(`/summary/monthly?month=${month}`, token);
}