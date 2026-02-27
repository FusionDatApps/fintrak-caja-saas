import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const createTxSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().nonnegative(),
  category: z.string().min(1),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  description: z.string().optional(),
  payment_method: z.enum(["cash", "bank", "card", "transfer"]),
  status: z.enum(["paid", "pending"]),
});

// GET /transactions?month=YYYY-MM
router.get("/", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { month } = req.query;

  // Query base
  let sql = `
    SELECT id, type, amount, category, occurred_on, description, payment_method, status, created_at
    FROM transactions
    WHERE user_id = $1
  `;
  const params = [userId];

  // Filtro opcional por mes
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    const start = `${y}-${String(m).padStart(2, "0")}-01`;

    // calcular primer día del mes siguiente
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    sql += ` AND occurred_on >= $2 AND occurred_on < $3`;
    params.push(start, end);
  }

  sql += ` ORDER BY occurred_on DESC, created_at DESC LIMIT 200`;

  const result = await pool.query(sql, params);
  res.json({ items: result.rows });
});

// POST /transactions
router.post("/", requireAuth, async (req, res) => {
  const parsed = createTxSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
  }

  const userId = req.user.id;
  const { type, amount, category, occurred_on, description, payment_method, status } = parsed.data;

  const result = await pool.query(
    `INSERT INTO transactions (user_id, type, amount, category, occurred_on, description, payment_method, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, type, amount, category, occurred_on, description, payment_method, status, created_at`,
    [userId, type, amount, category, occurred_on, description ?? null, payment_method, status]
  );

  res.status(201).json({ item: result.rows[0] });
});

// DELETE /transactions/:id
router.delete("/:id", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const result = await pool.query(
    "DELETE FROM transactions WHERE id=$1 AND user_id=$2 RETURNING id",
    [id, userId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Movimiento no existe" });
  }

  res.json({ ok: true });
});

// PUT /transactions/:id
router.put("/:id", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  const parsed = createTxSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos", details: parsed.error.flatten() });
  }

  const { type, amount, category, occurred_on, description, payment_method, status } = parsed.data;

  const result = await pool.query(
    `UPDATE transactions
     SET type=$1, amount=$2, category=$3, occurred_on=$4, description=$5, payment_method=$6, status=$7
     WHERE id=$8 AND user_id=$9
     RETURNING id, type, amount, category, occurred_on, description, payment_method, status, created_at`,
    [type, amount, category, occurred_on, description ?? null, payment_method, status, id, userId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({ error: "Movimiento no existe" });
  }

  res.json({ item: result.rows[0] });
});

export default router;