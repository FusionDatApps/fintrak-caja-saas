import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Todos los campos son obligatorios");
      return;
    }

    // Simulación de login correcto
    console.log("Login con:", { email, password });

// Token simulado
localStorage.setItem("token", "fake-token-123");

navigate("/dashboard");
  };

  return (
    <div>
      <h2>Iniciar sesión</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 300 }}>
        <input
          type="email"
          placeholder="Correo electrónico"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <span style={{ color: "red" }}>{error}</span>}

        <button type="submit">Ingresar</button>
      </form>
    </div>
  );
}