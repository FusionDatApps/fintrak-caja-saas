import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import authRoutes from "./routes/auth.routes.js";
import meRoutes from "./routes/me.routes.js";
import transactionsRoutes from "./routes/transactions.routes.js";
import summaryRoutes from "./routes/summary.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";

dotenv.config();

const app = express();

// Middlewares
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// Health check
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Rutas (ANTES del listen)
app.use("/auth", authRoutes);
app.use("/", meRoutes);
app.use("/transactions", transactionsRoutes);
app.use("/summary", summaryRoutes);
app.use("/categories", categoriesRoutes);

// Listen (SIEMPRE al final)
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});