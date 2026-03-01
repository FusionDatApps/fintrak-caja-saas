// frontend/src/pages/Dashboard.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";
import { getMonthlyCompare, getMonthlySummary } from "../lib/summaryApi";

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

function fmtPct(v) {
  // Backend devuelve null cuando no se puede calcular (base=0).
  if (v === null || v === undefined) return "N/A";
  const n = Number(v);
  if (Number.isNaN(n)) return "N/A";
  return `${n.toFixed(1)}%`;
}

export default function Dashboard() {
  const navigate = useNavigate();

  // Estado actual (MVP)
  const [user, setUser] = useState(null);
  const [summary, setSummary] = useState(null);
  const [authError, setAuthError] = useState("");
  const [summaryError, setSummaryError] = useState("");

  // Selector de mes existente (MVP)
  const [month, setMonth] = useState(ymToday());

  // ==============================
  // NUEVO (Día 5 - Sección A): Comparativo Mensual
  // ==============================
  const [monthA, setMonthA] = useState(ymToday()); // default: mes actual (puedes cambiarlo)
  const [monthB, setMonthB] = useState(ymToday()); // default: mes actual
  const [compare, setCompare] = useState(null);
  const [compareError, setCompareError] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);

  // Guardamos token en estado local del efecto (no global)
  // porque el token vive en localStorage.
  useEffect(() => {
    let alive = true;

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    (async () => {
      try {
        // 1) Validar token con /me (si esto falla, es problema de sesión)
        const me = await apiGet("/me", token);
        if (!alive) return;
        setUser(me.user);
        setAuthError("");

        // 2) Cargar resumen mensual (MVP). Si falla, NO cierres sesión.
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

  /**
   * Acción explícita: comparar mes A vs mes B.
   * No lo hacemos automático en useEffect para:
   * - no spamear el backend por cada cambio de input
   * - mantener UX con botón controlado
   */
  async function handleCompare() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    // Validación mínima en frontend (el backend también valida).
    if (!monthA || !monthB) {
      setCompare(null);
      setCompareError("Debes seleccionar Mes A y Mes B.");
      return;
    }

    setCompareLoading(true);
    setCompareError("");
    setCompare(null);

    try {
      const data = await getMonthlyCompare(token, monthA, monthB);
      setCompare(data);
    } catch (err) {
      setCompare(null);
      setCompareError(err.message || "No se pudo comparar los meses");
    } finally {
      setCompareLoading(false);
    }
  }

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

          {/* =========================
              MVP: Resumen mensual actual
             ========================= */}
          <h3>Resumen del mes: {month}</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#555", marginRight: 8 }}>
              Cambiar mes:
            </label>

            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>

          {summaryError && (
            <p style={{ color: "crimson" }}>Error cargando resumen: {summaryError}</p>
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

          {/* ==========================================
              Día 5 - A: Comparativo mensual (A vs B)
             ========================================== */}
          <hr style={{ margin: "20px 0" }} />
          <h3>Comparativo mensual (Mes A vs Mes B)</h3>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#555" }}>Mes A</label>
              <input type="month" value={monthA} onChange={(e) => setMonthA(e.target.value)} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "#555" }}>Mes B</label>
              <input type="month" value={monthB} onChange={(e) => setMonthB(e.target.value)} />
            </div>

            <button onClick={handleCompare} disabled={compareLoading}>
              {compareLoading ? "Comparando..." : "Comparar"}
            </button>
          </div>

          {compareError && <p style={{ color: "crimson" }}>{compareError}</p>}

          {!compare ? (
            <p style={{ fontSize: 12, color: "#666" }}>
              Selecciona dos meses y pulsa <strong>Comparar</strong>.
            </p>
          ) : (
            <div style={{ marginTop: 12 }}>
              {/* Tabla simple para mostrar A, B, delta y % */}
              <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                      Métrica
                    </th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                      {compare.monthA.month}
                    </th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                      {compare.monthB.month}
                    </th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                      Δ (B - A)
                    </th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                      % cambio
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Ingresos", "income", true],
                    ["Egresos", "expense", true],
                    ["Balance", "balance", true],
                    ["Movimientos", "count", false],
                  ].map(([label, key, isMoney]) => {
                    const a = compare.monthA[key];
                    const b = compare.monthB[key];
                    const d = compare.delta[key];
                    const p = compare.pct_change[key];

                    return (
                      <tr key={key}>
                        <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{label}</td>

                        <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                          {isMoney ? `$${moneyCOP(a)}` : a ?? 0}
                        </td>

                        <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                          {isMoney ? `$${moneyCOP(b)}` : b ?? 0}
                        </td>

                        <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                          {isMoney ? `$${moneyCOP(d)}` : d ?? 0}
                        </td>

                        <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                          {fmtPct(p)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                Nota: el % cambio muestra <strong>N/A</strong> cuando el valor base (Mes A) es 0.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}