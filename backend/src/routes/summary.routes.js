import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/); // YYYY-MM

router.get("/monthly", requireAuth, async (req, res) => {
  const month = req.query.month;

  const parsed = monthSchema.safeParse(month);
  if (!parsed.success) return res.status(400).json({ error: "month inválido. Usa YYYY-MM" });

  const userId = req.user.id;

  // Construye rango [inicioMes, inicioMesSiguiente)
  const start = `${month}-01`;
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

  res.json({ month, ...result.rows[0] });
});

export default router;