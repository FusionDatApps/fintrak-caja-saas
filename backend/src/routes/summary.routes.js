// backend/src/routes/summary.routes.js
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

/**
 * Validación estricta de meses:
 * - Formato: YYYY-MM
 * - OJO: esto valida formato, no valida que el mes exista (eso lo validamos con otra regla).
 */
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Formato inválido. Usa YYYY-MM");

/**
 * Validación extra para que el mes sea 01..12.
 * (Porque 2026-99 pasa la regex y eso es basura.)
 */
function isValidMonthRange(yyyyMM) {
  const mm = Number(yyyyMM.split("-")[1]);
  return mm >= 1 && mm <= 12;
}

/**
 * Helpers de cálculo
 * - pctChange: % cambio vs base (monthA)
 * - Si base = 0 => null (evita división por cero y porcentajes infinitos)
 */
function pctChange(base, next) {
  const b = Number(base ?? 0);
  const n = Number(next ?? 0);
  if (b === 0) return null;
  return ((n - b) / b) * 100;
}

/**
 * Consulta de resumen mensual para un usuario y un mes.
 * Devuelve: { month, income, expense, balance, count }
 *
 * IMPORTANTÍSIMO:
 * - Esto usa rango [inicioMes, inicioMesSiguiente) con occurred_on.
 * - COALESCE para que meses vacíos devuelvan 0 en vez de null.
 */
async function getMonthlySummaryForUser(userId, month) {
  const start = `${month}-01`; // YYYY-MM-01
  const result = await pool.query(
    `
    SELECT
      COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS expense,
      COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS balance,
      COUNT(*)::int AS count
    FROM transactions
    WHERE user_id = $1
      AND occurred_on >= $2::date
      AND occurred_on < (date_trunc('month', $2::date) + interval '1 month')::date
    `,
    [userId, start]
  );

  return { month, ...result.rows[0] };
}

/**
 * GET /summary/monthly?month=YYYY-MM
 * Resumen mensual existente (MVP).
 */
router.get("/monthly", requireAuth, async (req, res) => {
  const month = req.query.month;

  const parsed = monthSchema.safeParse(month);
  if (!parsed.success) {
    return res.status(400).json({ error: "month inválido. Usa YYYY-MM" });
  }
  if (!isValidMonthRange(month)) {
    return res.status(400).json({ error: "month inválido. Mes debe estar entre 01 y 12" });
  }

  const userId = req.user.id;

  // MISMA lógica robusta que usaremos en compare
  const summary = await getMonthlySummaryForUser(userId, month);

  return res.json(summary);
});

/**
 * GET /summary/compare?monthA=YYYY-MM&monthB=YYYY-MM
 * Comparativo de mes A vs mes B (para el usuario autenticado)
 *
 * Respuesta:
 * {
 *   monthA: {...},
 *   monthB: {...},
 *   delta: {...},         // (B - A)
 *   pct_change: {...}     // % cambio vs A, null si A es 0
 * }
 */
router.get("/compare", requireAuth, async (req, res) => {
  const { monthA, monthB } = req.query;

  // Validación formato YYYY-MM
  const parsedA = monthSchema.safeParse(monthA);
  const parsedB = monthSchema.safeParse(monthB);

  if (!parsedA.success || !parsedB.success) {
    return res.status(400).json({
      error: "Parámetros inválidos. Usa monthA=YYYY-MM y monthB=YYYY-MM",
    });
  }

  // Validación rango 01..12
  if (!isValidMonthRange(monthA) || !isValidMonthRange(monthB)) {
    return res.status(400).json({
      error: "Mes inválido. monthA y monthB deben estar entre 01 y 12",
    });
  }

  const userId = req.user.id;

  // Consultas en paralelo (más rápido y limpio)
  const [a, b] = await Promise.all([
    getMonthlySummaryForUser(userId, monthA),
    getMonthlySummaryForUser(userId, monthB),
  ]);

  // Delta = B - A
  const delta = {
    income: Number(b.income) - Number(a.income),
    expense: Number(b.expense) - Number(a.expense),
    balance: Number(b.balance) - Number(a.balance),
    count: Number(b.count) - Number(a.count),
  };

  // % cambio vs A
  const pct_change = {
    income: pctChange(a.income, b.income),
    expense: pctChange(a.expense, b.expense),
    balance: pctChange(a.balance, b.balance),
    count: pctChange(a.count, b.count),
  };

  return res.json({
    monthA: a,
    monthB: b,
    delta,
    pct_change,
    meta: {
      note: "pct_change es null cuando el valor base (monthA) es 0",
    },
  });
});

export default router;