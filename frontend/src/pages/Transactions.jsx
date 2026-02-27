import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiDelete, apiGet, apiPost } from "../lib/api";

function ymFromDate(yyyy_mm_dd) {
  const s = String(yyyy_mm_dd || "");
  // "2026-02-26" -> "2026-02"
  return s.slice(0, 7);
}

export default function Movimientos() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
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

  const month = useMemo(() => ymFromDate(form.occurred_on), [form.occurred_on]);

  const load = async () => {
    setError("");
    setLoading(true);

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      // Si tu backend aún no filtra por mes, esto igual funciona.
      // Cuando implementes filtro en backend, ya lo tienes listo:
      const data = await apiGet(`/transactions?month=${month}`, token);
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, month]);

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

    if (!payload.amount || payload.amount <= 0) {
      setError("Monto inválido (debe ser mayor a 0)");
      return;
    }

    try {
      await apiPost("/transactions", payload, token);
      setForm((f) => ({ ...f, amount: "", description: "" }));
      // Recargar lista (más confiable que “insertar a mano”)
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    setError("");

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    setBusyId(id);
    try {
      await apiDelete(`/transactions/${id}`, token);
      // Recargar lista
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <h2>Movimientos</h2>
      <p style={{ fontSize: 12, color: "#555" }}>Mes activo: {month}</p>
<div style={{ marginBottom: 12 }}>
  <label style={{ fontSize: 12, color: "#555", marginRight: 8 }}>
    Cambiar mes:
  </label>

  <input
    type="month"
    value={month}
    onChange={(e) => {
      const m = e.target.value; // "2026-02"
      setForm((f) => ({
        ...f,
        occurred_on: `${m}-01`, // fija el día 01 del mes elegido
      }));
    }}
  />
</div>
      {error && <p style={{ color: "red" }}>{error}</p>}

      <form
        onSubmit={handleCreate}
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
      >
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

        <select
          name="payment_method"
          value={form.payment_method}
          onChange={handleChange}
        >
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
      ) : items.length === 0 ? (
        <p>No hay movimientos para este mes.</p>
      ) : (
        <ul>
          {items.map((t) => (
            <li key={t.id} style={{ marginBottom: 8 }}>
              <strong>{t.type}</strong> ${t.amount} | {t.category} |{" "}
              {String(t.occurred_on).slice(0, 10)} | {t.status}
              {t.description ? ` | ${t.description}` : ""}{" "}
              <button
                onClick={() => handleDelete(t.id)}
                disabled={busyId === t.id}
                style={{ marginLeft: 8 }}
              >
                {busyId === t.id ? "Eliminando..." : "Eliminar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}