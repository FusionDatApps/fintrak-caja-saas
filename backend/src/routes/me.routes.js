import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { pool } from "../db/pool.js";

const router = Router();

router.get("/me", requireAuth, async (req, res) => {
  const result = await pool.query(
    "SELECT id,name,email,created_at FROM users WHERE id=$1",
    [req.user.id]
  );

  if (result.rowCount === 0) return res.status(404).json({ error: "Usuario no existe" });

  res.json({ user: result.rows[0] });
});

export default router;