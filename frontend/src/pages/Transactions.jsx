// frontend/src/pages/Transactions.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// API genérica del proyecto
import { apiDelete, apiGet, apiPost } from "../lib/api";

// API específica de categorías
import { getCategories } from "../lib/categoriesApi";

/**
 * Convierte "YYYY-MM-DD" a "YYYY-MM"
 */
function ymFromDate(yyyy_mm_dd) {
  const s = String(yyyy_mm_dd || "");
  return s.slice(0, 7);
}

export default function Movimientos() {
  const navigate = useNavigate();

  // Lista de movimientos del mes activo
  const [items, setItems] = useState([]);

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  // Categorías activas
  const [categories, setCategories] = useState([]);

  /**
   * Formulario:
   * Ahora usamos category_id en lugar de category texto.
   */
  const [form, setForm] = useState({
    type: "income",
    amount: "",
    category_id: "",
    occurred_on: new Date().toISOString().slice(0, 10),
    description: "",
    payment_method: "cash",
    status: "paid",
  });

  // Mes activo derivado de occurred_on
  const month = useMemo(() => ymFromDate(form.occurred_on), [form.occurred_on]);

  /**
   * Cargar categorías activas al montar
   */
  useEffect(() => {
    const loadCategories = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;

      try {
        const data = await getCategories(token);
        const list = data.items || [];
        setCategories(list);

        if (list.length > 0) {
          const exists = list.some((c) => c.id === form.category_id);
          if (!exists) {
            setForm((f) => ({ ...f, category_id: list[0].id }));
          }
        } else {
          setForm((f) => ({ ...f, category_id: "" }));
        }
      } catch (err) {
        console.error("Error cargando categorías", err);
      }
    };

    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Cargar movimientos del mes activo
   */
  const load = async () => {
    setError("");
    setLoading(true);

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const data = await apiGet(`/transactions?month=${month}`, token);
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Recargar cuando cambia el mes
   */
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, month]);

  /**
   * Manejo genérico de inputs/selects
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  /**
   * Crear movimiento
   */
  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    if (!form.category_id || !String(form.category_id).trim()) {
      setError("No puedes crear un movimiento sin categoría activa. Crea una categoría primero.");
      return;
    }

    const payload = {
      ...form,
      amount: Number(form.amount),
      category_id: String(form.category_id).trim(),
    };

    if (!payload.amount || payload.amount <= 0) {
      setError("Monto inválido (debe ser mayor a 0)");
      return;
    }

    try {
      await apiPost("/transactions", payload, token);

      // Limpiamos monto y descripción, conservando fecha/categoría por velocidad operativa
      setForm((f) => ({ ...f, amount: "", description: "" }));

      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  /**
   * Eliminar movimiento
   */
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
            const m = e.target.value;
            setForm((f) => ({
              ...f,
              occurred_on: `${m}-01`,
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

        <select
          name="category_id"
          value={form.category_id}
          onChange={handleChange}
          disabled={categories.length === 0}
          title={categories.length === 0 ? "Crea una categoría en /categories" : ""}
        >
          {categories.length === 0 ? (
            <option value="">Sin categorías</option>
          ) : (
            categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))
          )}
        </select>

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

        <button type="submit" disabled={categories.length === 0}>
          Agregar
        </button>
      </form>

      {loading ? (
        <p>Cargando...</p>
      ) : items.length === 0 ? (
        <p>No hay movimientos para este mes.</p>
      ) : (
        <ul>
          {items.map((t) => (
            <li key={t.id} style={{ marginBottom: 8 }}>
              <strong>{t.type}</strong> ${t.amount} | {t.category_name || t.category} |{" "}
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