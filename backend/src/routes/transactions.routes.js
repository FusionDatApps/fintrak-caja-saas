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

// GET /transactions
router.get("/", requireAuth, async (req, res) => {
  const userId = req.user.id;

  const result = await pool.query(
    `SELECT id, type, amount, category, occurred_on, description, payment_method, status, created_at
     FROM transactions
     WHERE user_id = $1
     ORDER BY occurred_on DESC, created_at DESC
     LIMIT 200`,
    [userId]
  );

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

export default router;