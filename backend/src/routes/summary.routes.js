// backend/src/routes/summary.routes.js
import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  buildMonthlyInsights,
  buildAdvancedInsights,
  buildFinancialHealthScore,
} from "../services/insights.service.js";

const router = Router();

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Formato inválido. Usa YYYY-MM");

function isValidMonthRange(yyyyMM) {
  const mm = Number(yyyyMM.split("-")[1]);
  return mm >= 1 && mm <= 12;
}

function pctChange(base, next) {
  const b = Number(base ?? 0);
  const n = Number(next ?? 0);
  if (b === 0) return null;
  return ((n - b) / b) * 100;
}

function monthToStartDate(month) {
  return `${month}-01`;
}

function previousMonthOf(month) {
  const [y, m] = month.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

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
    percentage: monthTotal === 0 ? 0 : Number(((item.total_amount / monthTotal) * 100).toFixed(2)),
  }));
}

async function getTrendForUser(userId, from, to) {
  const months = monthsBetween(from, to);
  const startDate = monthToStartDate(from);
  const endDateExclusive = monthToStartDate(to);

  const result = await pool.query(
    `
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
    `,
    [userId, startDate, endDateExclusive]
  );

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

  const series = months.map((m) => {
    const found = byMonth.get(m);
    if (found) return found;
    return { month: m, income: 0, expense: 0, balance: 0, count: 0 };
  });

  for (let i = 0; i < series.length; i++) {
    const cur = series[i];
    const prev = i === 0 ? null : series[i - 1];

    cur.mom_income = prev ? pctChange(prev.income, cur.income) : null;
    cur.mom_expense = prev ? pctChange(prev.expense, cur.expense) : null;
    cur.mom_balance = prev ? pctChange(prev.balance, cur.balance) : null;
    cur.mom_count = prev ? pctChange(prev.count, cur.count) : null;
  }

  return series;
}

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

    const summary = await getMonthlySummaryForUser(req.user.id, month);
    return res.json(summary);
  } catch (error) {
    console.error("Error en /summary/monthly:", error);
    return res.status(500).json({ error: "Error interno al generar resumen mensual" });
  }
});

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

    const summary = await getCategorySummaryForUser(req.user.id, month);
    return res.json(summary);
  } catch (error) {
    console.error("Error en /summary/by-category:", error);
    return res.status(500).json({ error: "Error interno al generar resumen por categoría" });
  }
});

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

    const [a, b] = await Promise.all([
      getMonthlySummaryForUser(req.user.id, monthA),
      getMonthlySummaryForUser(req.user.id, monthB),
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

router.get("/trend", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;

    const pFrom = monthSchema.safeParse(from);
    const pTo = monthSchema.safeParse(to);

    if (!pFrom.success || !pTo.success) {
      return res.status(400).json({ error: "Parámetros inválidos. Usa from=YYYY-MM&to=YYYY-MM" });
    }

    if (!isValidMonthRange(from) || !isValidMonthRange(to)) {
      return res.status(400).json({ error: "Mes inválido. from/to deben estar entre 01 y 12" });
    }

    if (from > to) {
      return res.status(400).json({ error: "Rango inválido. from debe ser <= to" });
    }

    const series = await getTrendForUser(req.user.id, from, to);

    return res.json({ from, to, months: series });
  } catch (error) {
    console.error("Error en /summary/trend:", error);
    return res.status(500).json({ error: "Error interno al generar tendencia" });
  }
});

router.get("/insights", requireAuth, async (req, res) => {
  try {
    const month = req.query.month;

    const parsed = monthSchema.safeParse(month);
    if (!parsed.success) {
      return res.status(400).json({ error: "month inválido. Usa YYYY-MM" });
    }

    if (!isValidMonthRange(month)) {
      return res.status(400).json({ error: "month inválido. Mes debe estar entre 01 y 12" });
    }

    const [summary, categories] = await Promise.all([
      getMonthlySummaryForUser(req.user.id, month),
      getCategorySummaryForUser(req.user.id, month),
    ]);

    const data = buildMonthlyInsights({ month, summary, categories });

    return res.json(data);
  } catch (error) {
    console.error("Error en /summary/insights:", error);
    return res.status(500).json({ error: "Error interno al generar insights" });
  }
});

router.get("/insights-advanced", requireAuth, async (req, res) => {
  try {
    const month = req.query.month;

    const parsed = monthSchema.safeParse(month);
    if (!parsed.success) {
      return res.status(400).json({ error: "month inválido. Usa YYYY-MM" });
    }

    if (!isValidMonthRange(month)) {
      return res.status(400).json({ error: "month inválido. Mes debe estar entre 01 y 12" });
    }

    const previousMonth = previousMonthOf(month);
    const trendStart = previousMonthOf(previousMonth);

    const [summary, categories, previousCategories, trendMonths] = await Promise.all([
      getMonthlySummaryForUser(req.user.id, month),
      getCategorySummaryForUser(req.user.id, month),
      getCategorySummaryForUser(req.user.id, previousMonth),
      getTrendForUser(req.user.id, trendStart, month),
    ]);

    const data = buildAdvancedInsights({
      month,
      summary,
      categories,
      previousMonth,
      previousCategories,
      trendMonths,
    });

    return res.json(data);
  } catch (error) {
    console.error("Error en /summary/insights-advanced:", error);
    return res.status(500).json({ error: "Error interno al generar insights avanzados" });
  }
});

router.get("/health-score", requireAuth, async (req, res) => {
  try {
    const month = req.query.month;

    const parsed = monthSchema.safeParse(month);

    if (!parsed.success) {
      return res.status(400).json({
        error: "month inválido. Usa YYYY-MM",
      });
    }

    if (!isValidMonthRange(month)) {
      return res.status(400).json({
        error: "month inválido. Mes debe estar entre 01 y 12",
      });
    }

    const previousMonth = previousMonthOf(month);

    const [summary, categories, previousSummary] = await Promise.all([
      getMonthlySummaryForUser(req.user.id, month),
      getCategorySummaryForUser(req.user.id, month),
      getMonthlySummaryForUser(req.user.id, previousMonth),
    ]);

    const data = buildFinancialHealthScore({
      month,
      summary,
      categories,
      previousSummary,
    });

    return res.json(data);
  } catch (error) {
    console.error("Error en /summary/health-score:", error);

    return res.status(500).json({
      error: "Error interno al generar health score",
    });
  }
});

export default router;