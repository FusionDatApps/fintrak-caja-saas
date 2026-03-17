import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const createTxSchema = z.object({
  type: z.enum(["income", "expense"]),
  amount: z.number().nonnegative(),
  category_id: z.string().uuid(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  description: z.string().optional(),
  payment_method: z.enum(["cash", "bank", "card", "transfer"]),
  status: z.enum(["paid", "pending"]),
});

// GET /transactions?month=YYYY-MM
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.query;

    let sql = `
      SELECT
        t.id,
        t.type,
        t.amount,
        t.category,
        t.category_id,
        c.name AS category_name,
        t.occurred_on,
        t.description,
        t.payment_method,
        t.status,
        t.created_at
      FROM transactions t
      JOIN categories c
        ON t.category_id = c.id
      WHERE t.user_id = $1
    `;
    const params = [userId];

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split("-").map(Number);
      const start = `${y}-${String(m).padStart(2, "0")}-01`;

      const nextMonth = m === 12 ? 1 : m + 1;
      const nextYear = m === 12 ? y + 1 : y;
      const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

      sql += ` AND t.occurred_on >= $2 AND t.occurred_on < $3`;
      params.push(start, end);
    }

    sql += ` ORDER BY t.occurred_on DESC, t.created_at DESC LIMIT 200`;

    const result = await pool.query(sql, params);
    res.json({ items: result.rows });
  } catch (error) {
    console.error("GET /transactions error:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// POST /transactions
router.post("/", requireAuth, async (req, res) => {
  try {
    const parsed = createTxSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const userId = req.user.id;
    const {
      type,
      amount,
      category_id,
      occurred_on,
      description,
      payment_method,
      status,
    } = parsed.data;

    const categoryResult = await pool.query(
      `
      SELECT id, name, user_id, is_active
      FROM categories
      WHERE id = $1
        AND user_id = $2
        AND is_active = true
      LIMIT 1
      `,
      [category_id, userId]
    );

    if (categoryResult.rowCount === 0) {
      return res.status(400).json({
        error: "category_id inválido, inactivo o no pertenece al usuario",
      });
    }

    const category = categoryResult.rows[0];

    const result = await pool.query(
      `
      INSERT INTO transactions (
        user_id,
        type,
        amount,
        category,
        category_id,
        occurred_on,
        description,
        payment_method,
        status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING
        id,
        type,
        amount,
        category,
        category_id,
        occurred_on,
        description,
        payment_method,
        status,
        created_at
      `,
      [
        userId,
        type,
        amount,
        category.name, // compatibilidad temporal
        category.id,
        occurred_on,
        description ?? null,
        payment_method,
        status,
      ]
    );

    res.status(201).json({ item: result.rows[0] });
  } catch (error) {
    console.error("POST /transactions error:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// DELETE /transactions/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
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
  } catch (error) {
    console.error("DELETE /transactions/:id error:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

// PUT /transactions/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const parsed = createTxSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "Datos inválidos",
        details: parsed.error.flatten(),
      });
    }

    const {
      type,
      amount,
      category_id,
      occurred_on,
      description,
      payment_method,
      status,
    } = parsed.data;

    const categoryResult = await pool.query(
      `
      SELECT id, name, user_id, is_active
      FROM categories
      WHERE id = $1
        AND user_id = $2
        AND is_active = true
      LIMIT 1
      `,
      [category_id, userId]
    );

    if (categoryResult.rowCount === 0) {
      return res.status(400).json({
        error: "category_id inválido, inactivo o no pertenece al usuario",
      });
    }

    const category = categoryResult.rows[0];

    const result = await pool.query(
      `
      UPDATE transactions
      SET
        type = $1,
        amount = $2,
        category = $3,
        category_id = $4,
        occurred_on = $5,
        description = $6,
        payment_method = $7,
        status = $8
      WHERE id = $9
        AND user_id = $10
      RETURNING
        id,
        type,
        amount,
        category,
        category_id,
        occurred_on,
        description,
        payment_method,
        status,
        created_at
      `,
      [
        type,
        amount,
        category.name, // compatibilidad temporal
        category.id,
        occurred_on,
        description ?? null,
        payment_method,
        status,
        id,
        userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Movimiento no existe" });
    }

    res.json({ item: result.rows[0] });
  } catch (error) {
    console.error("PUT /transactions/:id error:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

export default router;