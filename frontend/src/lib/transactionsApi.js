import { apiGet, apiPost } from "./api";

export function listTransactions(token) {
  return apiGet("/transactions", token);
}

export function createTransaction(token, tx) {
  return apiPost("/transactions", tx, token);
}
