import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import transactionsRoutes from "./routes/transactions.routes.js";

import authRoutes from "./routes/auth.routes.js";
import meRoutes from "./routes/me.routes.js";

dotenv.config();

const app = express();

app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.use("/auth", authRoutes);
app.use("/", meRoutes);

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`);
});
app.use("/transactions", transactionsRoutes);