// frontend/src/pages/Dashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

import { apiGet } from "../lib/api";

import {
  getMonthlyCompare,
  getMonthlySummary,
  getMonthlyTrend,
  getMonthlyInsights,
  getCategorySummary,
} from "../lib/summaryApi";

/**
 * Devuelve el mes actual en formato YYYY-MM.
 */
function ymToday() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * Formatea número como COP sin símbolo.
 */
function moneyCOP(v) {
  const n = Number(v || 0);
  return new Intl.NumberFormat("es-CO").format(n);
}

/**
 * Formatea porcentajes.
 */
function fmtPct(v) {
  if (v === null || v === undefined) return "N/A";
  const n = Number(v);
  if (Number.isNaN(n)) return "N/A";
  return `${n.toFixed(1)}%`;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#AA66CC"];

export default function Dashboard() {
  const navigate = useNavigate();

  // =========================
  // SESIÓN
  // =========================
  const [user, setUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [userLoading, setUserLoading] = useState(true);

  // =========================
  // RESUMEN MENSUAL
  // =========================
  const [month, setMonth] = useState(ymToday());
  const [summary, setSummary] = useState(null);
  const [summaryError, setSummaryError] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);

  // =========================
  // INSIGHTS
  // =========================
  const [insights, setInsights] = useState([]);
  const [insightsError, setInsightsError] = useState("");
  const [insightsLoading, setInsightsLoading] = useState(false);

  // =========================
  // CATEGORÍAS
  // =========================
  const [categorySummary, setCategorySummary] = useState([]);
  const [categoryError, setCategoryError] = useState("");
  const [categoryLoading, setCategoryLoading] = useState(false);

  // =========================
  // COMPARATIVO
  // =========================
  const [monthA, setMonthA] = useState(ymToday());
  const [monthB, setMonthB] = useState(ymToday());
  const [compare, setCompare] = useState(null);
  const [compareError, setCompareError] = useState("");
  const [compareLoading, setCompareLoading] = useState(false);

  // =========================
  // TENDENCIA
  // =========================
  const [trendFrom, setTrendFrom] = useState(ymToday());
  const [trendTo, setTrendTo] = useState(ymToday());
  const [trend, setTrend] = useState(null);
  const [trendError, setTrendError] = useState("");
  const [trendLoading, setTrendLoading] = useState(false);

  /**
   * Base lista para gráfico de categorías.
   */
  const categoryChartData = useMemo(() => {
    return categorySummary.map((item) => ({
      id: item.category_id,
      label: item.category_name,
      value: Number(item.total_amount || 0),
      percentage: Number(item.percentage || 0),
    }));
  }, [categorySummary]);

  /**
   * Base para gráfico de tendencia.
   */
  const trendChartData = useMemo(() => {
    if (!trend?.months) return [];

    return trend.months.map((m) => ({
      month: m.month,
      income: Number(m.income || 0),
      expense: Number(m.expense || 0),
      balance: Number(m.balance || 0),
    }));
  }, [trend]);

  /**
   * 1) Validar sesión una sola vez.
   */
  useEffect(() => {
    let alive = true;

    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    (async () => {
      try {
        setUserLoading(true);
        const me = await apiGet("/me", token);
        if (!alive) return;

        setUser(me.user);
        setAuthError("");
      } catch (err) {
        if (!alive) return;

        setUser(null);
        setAuthError(err.message || "Sesión inválida");
        localStorage.removeItem("token");
        navigate("/login");
      } finally {
        if (alive) {
          setUserLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  /**
   * 2) Cargar resumen mensual, insights y categorías cada vez que cambia `month`.
   */
  useEffect(() => {
    let alive = true;

    const token = localStorage.getItem("token");
    if (!token) return;
    if (!user) return;

    setSummary(null);
    setSummaryError("");
    setSummaryLoading(true);

    setInsights([]);
    setInsightsError("");
    setInsightsLoading(true);

    setCategorySummary([]);
    setCategoryError("");
    setCategoryLoading(true);

    (async () => {
      try {
        const [sum, insightsData, byCategory] = await Promise.all([
          getMonthlySummary(token, month),
          getMonthlyInsights(token, month),
          getCategorySummary(token, month),
        ]);

        if (!alive) return;

        setSummary(sum);
        setSummaryError("");

        setInsights(Array.isArray(insightsData.insights) ? insightsData.insights : []);
        setInsightsError("");

        setCategorySummary(Array.isArray(byCategory) ? byCategory : []);
        setCategoryError("");
      } catch (err) {
        if (!alive) return;

        setSummary(null);
        setSummaryError(err.message || "No se pudo cargar el resumen");

        setInsights([]);
        setInsightsError(err.message || "No se pudieron cargar los insights");

        setCategorySummary([]);
        setCategoryError(err.message || "No se pudo cargar el resumen por categoría");
      } finally {
        if (alive) {
          setSummaryLoading(false);
          setInsightsLoading(false);
          setCategoryLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [user, month]);

  /**
   * Acción explícita: comparar Mes A vs Mes B.
   */
  async function handleCompare() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

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

  /**
   * Acción explícita: cargar tendencia y MoM.
   */
  async function handleTrend() {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    if (!trendFrom || !trendTo) {
      setTrend(null);
      setTrendError("Debes seleccionar un rango: desde y hasta.");
      return;
    }

    setTrendLoading(true);
    setTrendError("");
    setTrend(null);

    try {
      const data = await getMonthlyTrend(token, trendFrom, trendTo);
      setTrend(data);
    } catch (err) {
      setTrend(null);
      setTrendError(err.message || "No se pudo cargar la tendencia");
    } finally {
      setTrendLoading(false);
    }
  }

  return (
    <div>
      <h2>Panel de control</h2>

      {authError && <p style={{ color: "red" }}>{authError}</p>}

      {userLoading ? (
        <p>Cargando usuario...</p>
      ) : !user ? (
        <p>No se pudo cargar el usuario.</p>
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
              RESUMEN MENSUAL
             ========================= */}
          <h3>Resumen del mes: {month}</h3>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: "#555", marginRight: 8 }}>Cambiar mes:</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>

          {summaryError && <p style={{ color: "crimson" }}>Error cargando resumen: {summaryError}</p>}

          {summaryLoading ? (
            <p>Cargando resumen...</p>
          ) : !summary ? (
            <p>No hay resumen para el mes seleccionado.</p>
          ) : (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <div>Ingresos</div>
                <strong>${moneyCOP(summary.income)}</strong>
              </div>

              <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <div>Salidas</div>
                <strong>${moneyCOP(summary.expense)}</strong>
              </div>

              <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <div>Saldo</div>
                <strong>${moneyCOP(summary.balance)}</strong>
              </div>

              <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
                <div>Movimientos</div>
                <strong>{summary.count ?? 0}</strong>
              </div>
            </div>
          )}

          {/* =========================
              INSIGHTS DEL MES
             ========================= */}
          <hr style={{ margin: "20px 0" }} />
          <h3>📊 Análisis del mes</h3>

          {insightsError && <p style={{ color: "crimson" }}>{insightsError}</p>}

          {insightsLoading ? (
            <p>Cargando análisis...</p>
          ) : insights.length === 0 ? (
            <p style={{ fontSize: 12, color: "#666" }}>
              No hay insights disponibles para este mes.
            </p>
          ) : (
           <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
  {insights.map((item, idx) => {
    const bg =
      item.severity === "success"
        ? "#ecfdf3"
        : item.severity === "warning"
        ? "#fff7ed"
        : "#eff6ff";

    const border =
      item.severity === "success"
        ? "#22c55e"
        : item.severity === "warning"
        ? "#f59e0b"
        : "#3b82f6";

    return (
      <div
        key={`${month}-insight-${idx}`}
        style={{
          border: `1px solid ${border}`,
          borderLeft: `6px solid ${border}`,
          background: bg,
          borderRadius: 10,
          padding: 14,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            marginBottom: 6,
            color: "#111",
          }}
        >
          {item.title}
        </div>

        <div
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            color: "#333",
          }}
        >
          {item.message}
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "#666",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {item.type}
        </div>
      </div>
    );
  })}
</div>
          )}

          {/* =========================
              GASTOS POR CATEGORÍA
             ========================= */}
          <hr style={{ margin: "20px 0" }} />
          <h3>Gastos por categoría</h3>

          <p style={{ fontSize: 12, color: "#666" }}>
            Mes activo: <strong>{month}</strong>
          </p>

          {categoryError && (
            <p style={{ color: "crimson" }}>Error cargando categorías: {categoryError}</p>
          )}

          {categoryLoading ? (
            <p>Cargando categorías...</p>
          ) : categorySummary.length === 0 ? (
            <p style={{ fontSize: 12, color: "#666" }}>
              No hay gastos por categoría para el mes seleccionado.
            </p>
          ) : (
            <div style={{ marginTop: 12 }}>
              <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 760 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                      Clasificación
                    </th>
                    <th style={{ textAlign: "left", borderBottom: "1px solid #ddd", padding: 8 }}>
                      Categoría
                    </th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                      Total
                    </th>
                    <th style={{ textAlign: "right", borderBottom: "1px solid #ddd", padding: 8 }}>
                      %
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categorySummary.map((item, index) => (
                    <tr key={item.category_id}>
                      <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>N.° {index + 1}</td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>
                        {item.category_name}
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                        ${moneyCOP(item.total_amount)}
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                        {Number(item.percentage || 0).toFixed(2)} %
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ width: "100%", height: 320, marginTop: 20 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) =>
                        `${name}: ${((percent || 0) * 100).toFixed(0)}%`
                      }
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cell-${entry.id}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${moneyCOP(value)}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                Base lista para gráfico: {categoryChartData.length} categorías
              </p>
            </div>
          )}

          {/* =========================
              COMPARATIVO
             ========================= */}
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
            <p style={{ fontSize: 12, color: "#666" }}>Selecciona dos meses y pulsa Comparar</p>
          ) : (
            <div style={{ marginTop: 12 }}>
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
                Nota: el % cambio muestra N/A cuando el valor base (Mes A) es 0.
              </p>
            </div>
          )}

          {/* =========================
              TENDENCIA
             ========================= */}
          <hr style={{ margin: "20px 0" }} />
          <h3>Tendencia mensual y crecimiento MoM</h3>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
            <div>
              <label style={{ display: "block", fontSize: 12, color: "#555" }}>Desde</label>
              <input type="month" value={trendFrom} onChange={(e) => setTrendFrom(e.target.value)} />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, color: "#555" }}>Hasta</label>
              <input type="month" value={trendTo} onChange={(e) => setTrendTo(e.target.value)} />
            </div>

            <button onClick={handleTrend} disabled={trendLoading}>
              {trendLoading ? "Cargando..." : "Cargar tendencia"}
            </button>
          </div>

          {trendError && <p style={{ color: "crimson" }}>{trendError}</p>}

          {!trend ? (
            <p style={{ fontSize: 12, color: "#666" }}>Selecciona un rango y pulsa Cargar tendencia</p>
          ) : (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, color: "#666" }}>
                Rango: <strong>{trend.from}</strong> → <strong>{trend.to}</strong>
              </p>

              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead>
                  <tr>
                    {[
                      "Mes",
                      "Ingresos",
                      "MoM Ingresos",
                      "Egresos",
                      "MoM Egresos",
                      "Balance",
                      "MoM Balance",
                      "# Mov",
                      "MoM # Mov",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: h === "Mes" ? "left" : "right",
                          borderBottom: "1px solid #ddd",
                          padding: 8,
                          fontSize: 12,
                          color: "#444",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {trend.months.map((m) => (
                    <tr key={m.month}>
                      <td style={{ borderBottom: "1px solid #eee", padding: 8 }}>{m.month}</td>

                      <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                        ${moneyCOP(m.income)}
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                        {fmtPct(m.mom_income)}
                      </td>

                      <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                        ${moneyCOP(m.expense)}
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                        {fmtPct(m.mom_expense)}
                      </td>

                      <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                        ${moneyCOP(m.balance)}
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                        {fmtPct(m.mom_balance)}
                      </td>

                      <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                        {m.count ?? 0}
                      </td>
                      <td style={{ borderBottom: "1px solid #eee", padding: 8, textAlign: "right" }}>
                        {fmtPct(m.mom_count)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ width: "100%", height: 320, marginTop: 20 }}>
                <ResponsiveContainer>
                  <LineChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value) => `$${moneyCOP(value)}`} />
                    <Legend />
                    <Line type="monotone" dataKey="income" stroke="#00C49F" name="Ingresos" />
                    <Line type="monotone" dataKey="expense" stroke="#FF8042" name="Egresos" />
                    <Line type="monotone" dataKey="balance" stroke="#0088FE" name="Balance" />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
                Nota: MoM es N/A cuando no hay mes anterior o la base del mes anterior es 0.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}