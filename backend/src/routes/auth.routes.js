import { Router } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "../db/pool.js";

const router = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const { name, email, password } = parsed.data;

  const existing = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
  if (existing.rowCount > 0) return res.status(409).json({ error: "Email ya registrado" });

  const password_hash = await bcrypt.hash(password, 10);

  const result = await pool.query(
    "INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,created_at",
    [name, email, password_hash]
  );

  const user = result.rows[0];
  const token = signToken(user);

  res.json({ token, user });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Datos inválidos" });

  const { email, password } = parsed.data;

  const result = await pool.query(
    "SELECT id,name,email,password_hash,created_at FROM users WHERE email=$1",
    [email]
  );

  if (result.rowCount === 0) return res.status(401).json({ error: "Credenciales inválidas" });

  const user = result.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Credenciales inválidas" });

  const token = signToken(user);

  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, created_at: user.created_at },
  });
});

export default router;