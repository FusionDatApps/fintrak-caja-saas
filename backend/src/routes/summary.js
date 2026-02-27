import express from "express";
import { authMiddleware } from "../middleware/auth.js";
import { Movement } from "../models/Movement.js"; // o como se llame tu modelo

const router = express.Router();

/**
 * GET /summary/monthly?month=YYYY-MM
 * Retorna: { income, expense, balance, count }
 */
router.get("/monthly", authMiddleware, async (req, res) => {
  try {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ message: "month inválido. Usa YYYY-MM" });
    }

    const [y, m] = month.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 1);

    // Ajusta campos según tu schema real:
    // - userId o user
    // - amount
    // - type: "income" | "expense"
    const movements = await Movement.find({
      userId: req.user.id,
      date: { $gte: start, $lt: end },
    });

    let income = 0;
    let expense = 0;

    for (const mv of movements) {
      const amt = Number(mv.amount || 0);
      if (mv.type === "income") income += amt;
      if (mv.type === "expense") expense += amt;
    }

    const balance = income - expense;

    return res.json({
      income,
      expense,
      balance,
      count: movements.length,
    });
  } catch (err) {
    return res.status(500).json({ message: "Error generando resumen mensual" });
  }
});

export default router;