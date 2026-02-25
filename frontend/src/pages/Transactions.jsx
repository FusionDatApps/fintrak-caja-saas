
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, apiPost } from "../lib/api";

export default function Movimientos() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    type: "income",
    amount: "",
    category: "ventas",
    occurred_on: new Date().toISOString().slice(0, 10),
    description: "",
    payment_method: "cash",
    status: "paid",
  });

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    (async () => {
      try {
        const data = await apiGet("/transactions", token);
        setItems(data.items || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    const payload = {
      ...form,
      amount: Number(form.amount),
    };

    if (!payload.amount || payload.amount < 0) {
      setError("Monto inválido");
      return;
    }

    try {
      const data = await apiPost("/transactions", payload, token);
      setItems((prev) => [data.item, ...prev]);
      setForm((f) => ({ ...f, amount: "", description: "" }));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Movimientos</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleCreate} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <select name="type" value={form.type} onChange={handleChange}>
          <option value="income">Ingreso</option>
          <option value="expense">Gasto</option>
        </select>

        <input
          name="amount"
          type="number"
          placeholder="Monto"
          value={form.amount}
          onChange={handleChange}
        />

        <input
          name="category"
          placeholder="Categoría"
          value={form.category}
          onChange={handleChange}
        />

        <input
          name="occurred_on"
          type="date"
          value={form.occurred_on}
          onChange={handleChange}
        />

        <input
          name="description"
          placeholder="Descripción"
          value={form.description}
          onChange={handleChange}
        />

        <select name="payment_method" value={form.payment_method} onChange={handleChange}>
          <option value="cash">Efectivo</option>
          <option value="bank">Banco</option>
          <option value="card">Tarjeta</option>
          <option value="transfer">Transferencia</option>
        </select>

        <select name="status" value={form.status} onChange={handleChange}>
          <option value="paid">Pagado</option>
          <option value="pending">Pendiente</option>
        </select>

        <button type="submit">Agregar</button>
      </form>

      {loading ? (
        <p>Cargando...</p>
      ) : (
        <ul>
          {items.map((t) => (
            <li key={t.id}>
              <strong>{t.type}</strong> ${t.amount} | {t.category} | {String(t.occurred_on).slice(0,10)} | {t.status}
              {t.description ? ` | ${t.description}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}