// backend/src/routes/summary.routes.js
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

/**
 * Validación estricta de meses:
 * - Formato: YYYY-MM
 * - Esto valida formato, no valida que el mes exista (eso lo validamos con otra regla).
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
 * - pctChange: % cambio vs base (monthA o mes anterior)
 * - Si base = 0 => null (evita división por cero y porcentajes infinitos)
 */
function pctChange(base, next) {
  const b = Number(base ?? 0);
  const n = Number(next ?? 0);
  if (b === 0) return null;
  return ((n - b) / b) * 100;
}

/**
 * Convierte YYYY-MM -> YYYY-MM-01 (string), para usar como fecha base del mes.
 */
function monthToStartDate(yyyyMM) {
  return `${yyyyMM}-01`;
}

/**
 * Genera una lista de meses YYYY-MM entre from y to (incluidos).
 * Ej: from=2026-01, to=2026-03 => ["2026-01","2026-02","2026-03"]
 *
 * Nota: esto NO depende de locale. Se construye con Date UTC para evitar líos.
 */
function monthsBetween(from, to) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);

  // Date.UTC: mes 0-based (0=enero)
  const start = new Date(Date.UTC(fy, fm - 1, 1));
  const end = new Date(Date.UTC(ty, tm - 1, 1));

  const out = [];
  const cur = new Date(start);

  while (cur <= end) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    out.push(`${y}-${m}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }

  return out;
}

/**
 * Resumen mensual robusto para un usuario y un mes.
 * Usa rango [inicioMes, inicioMesSiguiente) con occurred_on.
 * COALESCE para que meses vacíos devuelvan 0 en vez de null.
 */
async function getMonthlySummaryForUser(userId, month) {
  const start = monthToStartDate(month); // YYYY-MM-01

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

  // Consultas en paralelo
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

/**
 * GET /summary/trend?from=YYYY-MM&to=YYYY-MM
 *
 * Devuelve una serie mensual (incluye meses vacíos) + MoM (% cambio mes a mes).
 *
 * Reglas:
 * - from y to obligatorios
 * - YYYY-MM y mes 01..12
 * - from <= to (si no, 400)
 * - MoM = null cuando:
 *   - no hay mes anterior (primer mes)
 *   - el valor del mes anterior es 0
 */
router.get("/trend", requireAuth, async (req, res) => {
  const { from, to } = req.query;

  const pFrom = monthSchema.safeParse(from);
  const pTo = monthSchema.safeParse(to);

  if (!pFrom.success || !pTo.success) {
    return res.status(400).json({ error: "Parámetros inválidos. Usa from=YYYY-MM&to=YYYY-MM" });
  }
  if (!isValidMonthRange(from) || !isValidMonthRange(to)) {
    return res.status(400).json({ error: "Mes inválido. from/to deben estar entre 01 y 12" });
  }

  // YYYY-MM funciona lexicográficamente para orden
  if (from > to) {
    return res.status(400).json({ error: "Rango inválido. from debe ser <= to" });
  }

  const userId = req.user.id;

  // 1) Lista completa de meses
  const months = monthsBetween(from, to);

  // 2) Query agrupada por mes en el rango
  const startDate = monthToStartDate(from);
  const endDateExclusiveBase = monthToStartDate(to);

  const sql = `
    SELECT
      to_char(date_trunc('month', occurred_on), 'YYYY-MM') AS month,
      COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) AS income,
      COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS expense,
      COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) AS balance,
      COUNT(*)::int AS count
    FROM transactions
    WHERE user_id = $1
      AND occurred_on >= $2::date
      AND occurred_on < (date_trunc('month', $3::date) + interval '1 month')::date
    GROUP BY 1
    ORDER BY 1 ASC
  `;

  const result = await pool.query(sql, [userId, startDate, endDateExclusiveBase]);

  // 3) Mapear resultados por mes
  const byMonth = new Map();
  for (const row of result.rows) {
    byMonth.set(row.month, {
      month: row.month,
      income: row.income,
      expense: row.expense,
      balance: row.balance,
      count: row.count,
    });
  }

  // 4) Rellenar meses vacíos con 0
  const series = months.map((m) => {
    const found = byMonth.get(m);
    if (found) return found;

    return { month: m, income: 0, expense: 0, balance: 0, count: 0 };
  });

  // 5) Calcular MoM
  for (let i = 0; i < series.length; i++) {
    const cur = series[i];
    const prev = i === 0 ? null : series[i - 1];

    cur.mom_income = prev ? pctChange(prev.income, cur.income) : null;
    cur.mom_expense = prev ? pctChange(prev.expense, cur.expense) : null;
    cur.mom_balance = prev ? pctChange(prev.balance, cur.balance) : null;
    cur.mom_count = prev ? pctChange(prev.count, cur.count) : null;
  }

  return res.json({ from, to, months: series });
});

export default router;
