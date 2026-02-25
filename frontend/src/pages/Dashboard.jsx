import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../lib/api";

export default function Dashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    (async () => {
      try {
        const data = await apiGet("/me", token);
        setUser(data.user);
      } catch (err) {
        setError(err.message);
        localStorage.removeItem("token");
        navigate("/login");
      }
    })();
  }, [navigate]);

  return (
    <div>
      <h2>Dashboard</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {!user ? (
        <p>Cargando usuario...</p>
      ) : (
        <>
          <p>
            Bienvenido, <strong>{user.name}</strong>
          </p>
          <p style={{ fontSize: 12, color: "#555" }}>{user.email}</p>
        </>
      )}
      <button
  onClick={() => {
    localStorage.removeItem("token");
    navigate("/login");
  }}
>
  Cerrar sesión
</button>
    </div>
  );
}