
//import { useEffect, useMemo, useState } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { loadTransactions, saveTransactions } from "../lib/storage";

function formatMoneyCOP(value) {
  // Formato COP simple (sin complicarnos hoy)
  return new Intl.NumberFormat("es-CO").format(value);
}

export default function Transactions() {
  const [type, setType] = useState("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Insumos/Inventario");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [status, setStatus] = useState("paid");
  const [counterparty, setCounterparty] = useState("");
  const [error, setError] = useState("");

  const [transactions, setTransactions] = useState([]);
  const skipFirstSave = useRef(true);
  const hasLoaded = useRef(false);

  // Cargar desde localStorage al iniciar
  useEffect(() => {
  const existing = loadTransactions();
  setTransactions(existing);
}, []);

  // Guardar cada vez que cambie la lista
  useEffect(() => {
  // En React dev + StrictMode, este efecto puede correr con el estado inicial []
  // antes de que se refleje la carga. Así que saltamos la primera ejecución.
  if (skipFirstSave.current) {
    skipFirstSave.current = false;
    return;
  }
  saveTransactions(transactions);
}, [transactions]);

  const totals = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const t of transactions) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const numericAmount = Number(amount);

    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) {
      setError("El importe debe ser un número mayor que 0");
      return;
    }
    if (!date) {
      setError("La fecha es obligatoria");
      return;
    }
    if (!category) {
      setError("La categoría es obligatoria");
      return;
    }

    const newTx = {
      id: crypto.randomUUID(),
      type,
      amount: numericAmount,
      category,
      date,
      description: description.trim(),
      counterparty: counterparty.trim(),
      payment_method: paymentMethod,
      status,
      created_at: new Date().toISOString(),
    };

    setTransactions((prev) => [newTx, ...prev]);

    // Limpiar algunos campos
    setAmount("");
    setDescription("");
    setCounterparty("");
  };

  const handleDelete = (id) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div>
      <h2>Movimientos</h2>
      <p>Registra ingresos/egresos y controla tu caja.</p>

      <div style={{ display: "flex", gap: 16, margin: "16px 0" }}>
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <div>Ingresos</div>
          <strong>${formatMoneyCOP(totals.income)}</strong>
        </div>
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <div>Egresos</div>
          <strong>${formatMoneyCOP(totals.expense)}</strong>
        </div>
        <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
          <div>Balance</div>
          <strong>${formatMoneyCOP(totals.balance)}</strong>
        </div>
      </div>

      <h3>Nuevo movimiento</h3>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
          maxWidth: 720,
          padding: 12,
          border: "1px solid #ddd",
          borderRadius: 8,
          marginBottom: 20,
        }}
      >
        <label>
          Tipo
          <select value={type} onChange={(e) => setType(e.target.value)} style={{ width: "100%" }}>
            <option value="expense">Egreso</option>
            <option value="income">Ingreso</option>
          </select>
        </label>

        <label>
          Importe (COP)
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Ej: 50000"
            style={{ width: "100%" }}
          />
        </label>

        <label>
          Categoría
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: "100%" }}>
            <option>Ventas</option>
            <option>Servicios</option>
            <option>Insumos/Inventario</option>
            <option>Transporte</option>
            <option>Arriendo</option>
            <option>Servicios públicos</option>
            <option>Nómina</option>
            <option>Impuestos</option>
            <option>Marketing</option>
            <option>Otros</option>
          </select>
        </label>

        <label>
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%" }} />
        </label>

        <label>
          Método de pago
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="cash">Efectivo</option>
            <option value="bank">Banco</option>
            <option value="card">Tarjeta</option>
            <option value="transfer">Transferencia</option>
          </select>
        </label>

        <label>
          Estado
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: "100%" }}>
            <option value="paid">Pagado</option>
            <option value="pending">Pendiente</option>
          </select>
        </label>

        <label style={{ gridColumn: "1 / -1" }}>
          Descripción
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: compra de bolsas, venta mostrador..."
            style={{ width: "100%" }}
          />
        </label>

        <label style={{ gridColumn: "1 / -1" }}>
          Cliente / Proveedor (opcional)
          <input
            type="text"
            value={counterparty}
            onChange={(e) => setCounterparty(e.target.value)}
            placeholder="Ej: Proveedor XYZ"
            style={{ width: "100%" }}
          />
        </label>

        {error && (
          <div style={{ gridColumn: "1 / -1", color: "red" }}>
            {error}
          </div>
        )}

        <button type="submit" style={{ gridColumn: "1 / -1" }}>
          Guardar movimiento
        </button>
      </form>

      <h3>Listado</h3>

      {transactions.length === 0 ? (
        <p>No hay movimientos aún. Agrega el primero.</p>
      ) : (
        <div style={{ display: "grid", gap: 10, maxWidth: 900 }}>
          {transactions.map((t) => (
            <div
              key={t.id}
              style={{
                display: "grid",
                gridTemplateColumns: "140px 1fr 140px 120px 120px 90px",
                gap: 10,
                alignItems: "center",
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 8,
              }}
            >
              <div>
                <strong>{t.type === "income" ? "Ingreso" : "Egreso"}</strong>
                <div style={{ fontSize: 12, color: "#555" }}>{t.date}</div>
              </div>

              <div>
                <div><strong>{t.category}</strong></div>
                <div style={{ fontSize: 12, color: "#555" }}>
                  {t.description || "(sin descripción)"} {t.counterparty ? `· ${t.counterparty}` : ""}
                </div>
              </div>

              <div style={{ textAlign: "right" }}>
                <strong>${formatMoneyCOP(t.amount)}</strong>
              </div>

              <div style={{ fontSize: 12 }}>
                {t.payment_method === "cash" && "Efectivo"}
                {t.payment_method === "bank" && "Banco"}
                {t.payment_method === "card" && "Tarjeta"}
                {t.payment_method === "transfer" && "Transferencia"}
              </div>

              <div style={{ fontSize: 12 }}>
                {t.status === "paid" ? "Pagado" : "Pendiente"}
              </div>

              <button onClick={() => handleDelete(t.id)}>Borrar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}