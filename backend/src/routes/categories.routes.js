// backend/src/routes/categories.routes.js

import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/pool.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

/*
  Schema de validación para crear/renombrar categoría
  - name obligatorio
  - mínimo 1 carácter real (trim)
*/
const categorySchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
});

/*
  GET /categories
  Devuelve categorías del usuario autenticado.

  Query opcional:
    ?all=1  -> incluye inactivas
*/
router.get("/", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const { all } = req.query;

  let sql = `
    SELECT id, name, is_active, created_at
    FROM categories
    WHERE user_id = $1
  `;
  const params = [userId];

  if (all !== "1") {
    sql += " AND is_active = true";
  }

  sql += " ORDER BY name ASC";

  const result = await pool.query(sql, params);

  res.json({ items: result.rows });
});

/*
  POST /categories
  Crea nueva categoría
*/
router.post("/", requireAuth, async (req, res) => {
  const parsed = categorySchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Datos inválidos",
      details: parsed.error.flatten(),
    });
  }

  const userId = req.user.id;
  const name = parsed.data.name.trim();

  try {
    const result = await pool.query(
      `
      INSERT INTO categories (user_id, name)
      VALUES ($1, $2)
      RETURNING id, name, is_active, created_at
      `,
      [userId, name]
    );

    res.status(201).json({ item: result.rows[0] });
  } catch (err) {
    // Violación de unicidad (duplicado)
    if (err.code === "23505") {
      return res.status(409).json({
        error: "La categoría ya existe para este usuario",
      });
    }
    throw err;
  }
});

/*
  PUT /categories/:id
  Renombrar categoría
*/
router.put("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Datos inválidos",
      details: parsed.error.flatten(),
    });
  }

  const userId = req.user.id;
  const name = parsed.data.name.trim();

  try {
    const result = await pool.query(
      `
      UPDATE categories
      SET name = $1
      WHERE id = $2
        AND user_id = $3
      RETURNING id, name, is_active, created_at
      `,
      [name, id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "Categoría no encontrada",
      });
    }

    res.json({ item: result.rows[0] });
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({
        error: "Ya existe otra categoría con ese nombre",
      });
    }
    throw err;
  }
});

/*
  DELETE /categories/:id
  Soft delete: marca is_active=false
*/
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const result = await pool.query(
    `
    UPDATE categories
    SET is_active = false
    WHERE id = $1
      AND user_id = $2
    RETURNING id
    `,
    [id, userId]
  );

  if (result.rowCount === 0) {
    return res.status(404).json({
      error: "Categoría no encontrada",
    });
  }

  res.json({ ok: true });
});

export default router;