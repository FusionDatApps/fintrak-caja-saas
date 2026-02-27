import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";
import { getMonthlySummary } from "../lib/summaryApi";

function ymToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function moneyCOP(v) {
  const n = Number(v || 0);
  return new Intl.NumberFormat("es-CO").format(n);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);

  const [authError, setAuthError] = useState("");
  const [summaryError, setSummaryError] = useState("");

 // const month = useMemo(() => ymToday(), []);
  const [month, setMonth] = useState(ymToday());
  useEffect(() => {
    let alive = true;

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    (async () => {
      try {
        // 1) Validar token con /me (si esto falla, sí es problema de sesión)
        const me = await apiGet("/me", token);
        if (!alive) return;
        setUser(me.user);
        setAuthError("");

        // 2) Cargar resumen (si falla, NO cierres sesión)
        try {
          const sum = await getMonthlySummary(token, month);
          if (!alive) return;
          setSummary(sum);
          setSummaryError("");
        } catch (err) {
          if (!alive) return;
          setSummary(null);
          setSummaryError(err.message || "No se pudo cargar el resumen");
        }
      } catch (err) {
        if (!alive) return;
        setAuthError(err.message || "Sesión inválida");
        localStorage.removeItem("token");
        navigate("/login");
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate, month]);

  return (
    <div>
      <h2>Dashboard</h2>

      {authError && <p style={{ color: "red" }}>{authError}</p>}

      {!user ? (
        <p>Cargando usuario...</p>
      ) : (
        <>
          <p>
            Bienvenido, <strong>{user.name}</strong>
          </p>
          <p style={{ fontSize: 12, color: "#555" }}>{user.email}</p>

          <button
            onClick={() => {
              localStorage.removeItem("token");
              navigate("/login");
            }}
          >
            Cerrar sesión
          </button>

          <hr style={{ margin: "16px 0" }} />

          <h3>Resumen del mes: {month}</h3>
<div style={{ marginBottom: 12 }}>
  <label style={{ fontSize: 12, color: "#555", marginRight: 8 }}>
    Cambiar mes:
  </label>

  <input
    type="month"
    value={month}
    onChange={(e) => setMonth(e.target.value)}
  />
</div>
          {summaryError && (
            <p style={{ color: "crimson" }}>
              Error cargando resumen: {summaryError}
            </p>
          )}

          {!summary ? (
            <p>Cargando resumen...</p>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <div>Ingresos</div>
                <strong>${moneyCOP(summary.income)}</strong>
              </div>

              <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <div>Egresos</div>
                <strong>${moneyCOP(summary.expense)}</strong>
              </div>

              <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <div>Balance</div>
                <strong>${moneyCOP(summary.balance)}</strong>
              </div>

              <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <div>Movimientos</div>
                <strong>{summary.count ?? 0}</strong>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}