import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    // Simulación: si no hay "token", lo mando a login
    const fakeToken = localStorage.getItem("token");
    if (!fakeToken) navigate("/login");
  }, [navigate]);

  return (
    <div>
      <h2>Dashboard</h2>
      <p>Resumen mensual: ingresos, egresos, balance (MVP)</p>
    </div>
  );
}