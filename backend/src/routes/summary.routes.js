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
 */
function isValidMonthRange(yyyyMM) {
  const mm = Number(yyyyMM.split("-")[1]);
  return mm >= 1 && mm <= 12;
}

/**
 * Helpers de cálculo
 * - pctChange: % cambio vs base
 * - Si base = 0 => null (evita división por cero)
 */
function pctChange(base, next) {
  const b = Number(base ?? 0);
  const n = Number(next ?? 0);
  if (b === 0) return null;
  return ((n - b) / b) * 100;
}

/**
 * Convierte YYYY-MM a YYYY-MM-01
 */
function monthToStartDate(month) {
  return `${month}-01`;
}

/**
 * Genera una lista de meses YYYY-MM entre from y to (incluidos).
 * Ej: from=2026-01, to=2026-03 => ["2026-01","2026-02","2026-03"]
 */
function monthsBetween(from, to) {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);

  let y = fy;
  let m = fm;

  const out = [];
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m === 13) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/**
 * Consulta de resumen mensual para un usuario y un mes.
 * Devuelve: { month, income, expense, balance, count }
 */
async function getMonthlySummaryForUser(userId, month) {
  const start = monthToStartDate(month);

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
 * Consulta de resumen por categoría para un usuario y un mes.
 * Devuelve:
 * [
 *   {
 *     category_id,
 *     category_name,
 *     total_amount,
 *     percentage
 *   }
 * ]
 */
async function getCategorySummaryForUser(userId, month) {
  const start = monthToStartDate(month);

  const result = await pool.query(
    `
    SELECT
      c.id AS category_id,
      c.name AS category_name,
      COALESCE(SUM(t.amount), 0) AS total_amount
    FROM transactions t
    JOIN categories c
      ON t.category_id = c.id
    WHERE t.user_id = $1
      AND t.type = 'expense'
      AND t.occurred_on >= $2::date
      AND t.occurred_on < (date_trunc('month', $2::date) + interval '1 month')::date
    GROUP BY c.id, c.name
    ORDER BY total_amount DESC
    `,
    [userId, start]
  );

  const normalized = result.rows.map((row) => ({
    category_id: row.category_id,
    category_name: row.category_name,
    total_amount: Number(row.total_amount ?? 0),
  }));

  const monthTotal = normalized.reduce((acc, item) => acc + item.total_amount, 0);

  return normalized.map((item) => ({
    ...item,
    percentage:
      monthTotal === 0
        ? 0
        : Number(((item.total_amount / monthTotal) * 100).toFixed(2)),
  }));
}

/**
 * GET /summary/monthly?month=YYYY-MM
 */
router.get("/monthly", requireAuth, async (req, res) => {
  try {
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
  } catch (error) {
    console.error("Error en /summary/monthly:", error);
    return res.status(500).json({ error: "Error interno al generar resumen mensual" });
  }
});

/**
 * GET /summary/by-category?month=YYYY-MM
 */
router.get("/by-category", requireAuth, async (req, res) => {
  try {
    const month = req.query.month;

    const parsed = monthSchema.safeParse(month);
    if (!parsed.success) {
      return res.status(400).json({ error: "month inválido. Usa YYYY-MM" });
    }

    if (!isValidMonthRange(month)) {
      return res.status(400).json({ error: "month inválido. Mes debe estar entre 01 y 12" });
    }

    const userId = req.user.id;
    const summary = await getCategorySummaryForUser(userId, month);

    return res.json(summary);
  } catch (error) {
    console.error("Error en /summary/by-category:", error);
    return res.status(500).json({ error: "Error interno al generar resumen por categoría" });
  }
});

/**
 * GET /summary/compare?monthA=YYYY-MM&monthB=YYYY-MM
 */
router.get("/compare", requireAuth, async (req, res) => {
  try {
    const { monthA, monthB } = req.query;

    const parsedA = monthSchema.safeParse(monthA);
    const parsedB = monthSchema.safeParse(monthB);

    if (!parsedA.success || !parsedB.success) {
      return res.status(400).json({
        error: "Parámetros inválidos. Usa monthA=YYYY-MM y monthB=YYYY-MM",
      });
    }

    if (!isValidMonthRange(monthA) || !isValidMonthRange(monthB)) {
      return res.status(400).json({
        error: "Mes inválido. monthA y monthB deben estar entre 01 y 12",
      });
    }

    const userId = req.user.id;

    const [a, b] = await Promise.all([
      getMonthlySummaryForUser(userId, monthA),
      getMonthlySummaryForUser(userId, monthB),
    ]);

    const delta = {
      income: Number(b.income) - Number(a.income),
      expense: Number(b.expense) - Number(a.expense),
      balance: Number(b.balance) - Number(a.balance),
      count: Number(b.count) - Number(a.count),
    };

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
      meta: { note: "pct_change es null cuando el valor base (monthA) es 0" },
    });
  } catch (error) {
    console.error("Error en /summary/compare:", error);
    return res.status(500).json({ error: "Error interno al generar comparativo" });
  }
});

/**
 * GET /summary/trend?from=YYYY-MM&to=YYYY-MM
 *
 * Devuelve una serie mensual (incluye meses vacíos) + MoM (% cambio mes a mes).
 */
router.get("/trend", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;

    // 1) Validación básica
    const pFrom = monthSchema.safeParse(from);
    const pTo = monthSchema.safeParse(to);

    if (!pFrom.success || !pTo.success) {
      return res.status(400).json({ error: "Parámetros inválidos. Usa from=YYYY-MM&to=YYYY-MM" });
    }

    if (!isValidMonthRange(from) || !isValidMonthRange(to)) {
      return res.status(400).json({ error: "Mes inválido. from/to deben estar entre 01 y 12" });
    }

    // 2) Orden válido
    if (from > to) {
      return res.status(400).json({ error: "Rango inválido. from debe ser <= to" });
    }

    const userId = req.user.id;

    // 3) Lista de meses
    const months = monthsBetween(from, to);

    // 4) Query agrupada por mes
    const startDate = monthToStartDate(from);
    const endDateExclusive = monthToStartDate(to);

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

    const result = await pool.query(sql, [userId, startDate, endDateExclusive]);

    // 5) Mapear resultados por mes
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

    // 6) Serie completa (rellena meses vacíos con 0)
    const series = months.map((m) => {
      const found = byMonth.get(m);
      if (found) return found;

      return { month: m, income: 0, expense: 0, balance: 0, count: 0 };
    });

    // 7) Calcular MoM (vs mes anterior)
    for (let i = 0; i < series.length; i++) {
      const cur = series[i];
      const prev = i === 0 ? null : series[i - 1];

      cur.mom_income = prev ? pctChange(prev.income, cur.income) : null;
      cur.mom_expense = prev ? pctChange(prev.expense, cur.expense) : null;
      cur.mom_balance = prev ? pctChange(prev.balance, cur.balance) : null;
      cur.mom_count = prev ? pctChange(prev.count, cur.count) : null;
    }

    return res.json({ from, to, months: series });
  } catch (error) {
    console.error("Error en /summary/trend:", error);
    return res.status(500).json({ error: "Error interno al generar tendencia" });
  }
});

/**
 * Genera insights del mes usando:
 * - resumen mensual
 * - categorías
 */
async function getInsightsForUser(userId, month) {
  const [summary, categories] = await Promise.all([
    getMonthlySummaryForUser(userId, month),
    getCategorySummaryForUser(userId, month),
  ]);

  const income = Number(summary.income);
  const expense = Number(summary.expense);
  const balance = Number(summary.balance);

  const insights = [];

  // Insight 1: balance
  if (income > expense) {
    insights.push(
      `Tus ingresos superan tus gastos en $${balance.toLocaleString()}`
    );
  } else if (expense > income) {
    insights.push(
      `Tus gastos superan tus ingresos en $${Math.abs(balance).toLocaleString()}`
    );
  } else {
    insights.push(`Tus ingresos y gastos están equilibrados`);
  }

  // Insight 2: categoría dominante
  if (categories.length > 0) {
    const top = categories[0];
    insights.push(
      `Tu mayor gasto fue en "${top.category_name}" (${top.percentage}%)`
    );
  }

  // Insight 3: ratio gasto/ingreso
  if (income > 0) {
    const ratio = ((expense / income) * 100).toFixed(0);
    insights.push(
      `Tus gastos representan el ${ratio}% de tus ingresos`
    );
  }

  return {
    month,
    insights,
  };
}

/**
 * GET /summary/insights?month=YYYY-MM
 */
router.get("/insights", requireAuth, async (req, res) => {
  try {
    const month = req.query.month;

    const parsed = monthSchema.safeParse(month);
    if (!parsed.success) {
      return res.status(400).json({ error: "month inválido. Usa YYYY-MM" });
    }

    if (!isValidMonthRange(month)) {
      return res.status(400).json({
        error: "month inválido. Mes debe estar entre 01 y 12",
      });
    }

    const userId = req.user.id;

    const data = await getInsightsForUser(userId, month);

    return res.json(data);
  } catch (error) {
    console.error("Error en /summary/insights:", error);
    return res.status(500).json({
      error: "Error interno al generar insights",
    });
  }
});
export default router;