// frontend/src/pages/Transactions.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

// API genérica del proyecto (ya existente)
import { apiDelete, apiGet, apiPost } from "../lib/api";

// API específica de categorías (la creamos en Día 5)
import { getCategories } from "../lib/categoriesApi";

/**
 * =========================================================
 * Helpers (funciones pequeñas para no repetir lógica)
 * =========================================================
 */

/**
 * Convierte "YYYY-MM-DD" a "YYYY-MM"
 * Ej: "2026-02-26" -> "2026-02"
 *
 * Por qué:
 * - Nuestro filtro por mes se basa en YYYY-MM
 * - El input date nos da YYYY-MM-DD
 */
function ymFromDate(yyyy_mm_dd) {
  const s = String(yyyy_mm_dd || "");
  return s.slice(0, 7);
}

export default function Movimientos() {
  /**
   * =========================================================
   * 1) Navegación y estados principales
   * =========================================================
   */
  const navigate = useNavigate();

  // Lista de movimientos del mes activo
  const [items, setItems] = useState([]);

  // Estados de UI
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  /**
   * =========================================================
   * 2) Estado del formulario de creación
   * =========================================================
   *
   * Nota:
   * - category sigue siendo texto (compatibilidad con tabla transactions.category TEXT)
   * - más adelante podríamos migrar a category_id, pero hoy NO.
   */
  const [form, setForm] = useState({
    type: "income",
    amount: "",
    category: "ventas", // valor por defecto (si existe)
    occurred_on: new Date().toISOString().slice(0, 10),
    description: "",
    payment_method: "cash",
    status: "paid",
  });

  /**
   * =========================================================
   * 3) Mes activo (derivado de occurred_on)
   * =========================================================
   *
   * Por qué useMemo:
   * - month depende de occurred_on
   * - evita recalcular si occurred_on no cambia
   */
  const month = useMemo(() => ymFromDate(form.occurred_on), [form.occurred_on]);

  /**
   * =========================================================
   * 4) Categorías (cargadas desde backend)
   * =========================================================
   */
  const [categories, setCategories] = useState([]);

  /**
   * =========================================================
   * 5) Cargar categorías activas al montar
   * =========================================================
   *
   * Por qué separado del load de transacciones:
   * - Son recursos distintos (/categories vs /transactions)
   * - Si falla categorías, igual debería funcionar el CRUD de transacciones
   */
  useEffect(() => {
    const loadCategories = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        // Si no hay token, el resto de la app ya redirige por su lógica
        return;
      }

      try {
        const data = await getCategories(token); // solo activas
        const list = data.items || [];
        setCategories(list);

        // Ajuste defensivo:
        // Si la categoría actual del form no existe en el listado activo,
        // ponemos la primera disponible para evitar que el <select> quede "inconsistente".
        if (list.length > 0) {
          const exists = list.some((c) => c.name === form.category);
          if (!exists) {
            setForm((f) => ({ ...f, category: list[0].name }));
          }
        } else {
          // Si no hay categorías activas, dejamos category vacía (y el select muestra "Sin categorías")
          setForm((f) => ({ ...f, category: "" }));
        }
      } catch (err) {
        // No bloqueamos el flujo de transacciones; solo dejamos log para depurar
        console.error("Error cargando categorías", err);
      }
    };

    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar

  /**
   * =========================================================
   * 6) Cargar movimientos del mes activo
   * =========================================================
   *
   * Por qué:
   * - el usuario trabaja por meses
   * - month cambia al cambiar el date o el selector type="month"
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
   * =========================================================
   * 7) Effect: recargar transacciones cuando cambia el mes
   * =========================================================
   */
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, month]);

  /**
   * =========================================================
   * 8) Handlers de formulario (input/select)
   * =========================================================
   */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  /**
   * =========================================================
   * 9) Crear movimiento (POST /transactions)
   * =========================================================
   *
   * Reglas de negocio mínimas:
   * - amount > 0
   * - category debe existir (si no hay categorías, bloqueamos)
   */
  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    // Si no hay categorías activas, no dejamos crear (evita category vacío)
    if (!form.category || !String(form.category).trim()) {
      setError("No puedes crear un movimiento sin categoría activa. Crea una categoría primero.");
      return;
    }

    const payload = {
      ...form,
      amount: Number(form.amount),
      category: String(form.category).trim(),
    };

    if (!payload.amount || payload.amount <= 0) {
      setError("Monto inválido (debe ser mayor a 0)");
      return;
    }

    try {
      await apiPost("/transactions", payload, token);

      // Limpiamos campos típicos, mantenemos fecha/categoría para velocidad operativa
      setForm((f) => ({ ...f, amount: "", description: "" }));

      // Recargar lista (más confiable que insertar a mano)
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  /**
   * =========================================================
   * 10) Eliminar movimiento (DELETE /transactions/:id)
   * =========================================================
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

  /**
   * =========================================================
   * 11) Render UI
   * =========================================================
   */
  return (
    <div>
      <h2>Movimientos</h2>

      {/* Indicador del mes activo (derivado del date) */}
      <p style={{ fontSize: 12, color: "#555" }}>Mes activo: {month}</p>

      {/* Selector de mes: cambia occurred_on al día 01 del mes elegido */}
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

      {/* Formulario creación */}
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

        {/* Categoría PRO: select alimentado desde /categories */}
        <select
          name="category"
          value={form.category}
          onChange={handleChange}
          disabled={categories.length === 0}
          title={categories.length === 0 ? "Crea una categoría en /categories" : ""}
        >
          {categories.length === 0 ? (
            <option value="">Sin categorías</option>
          ) : (
            categories.map((c) => (
              <option key={c.id} value={c.name}>
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

      {/* Lista */}
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