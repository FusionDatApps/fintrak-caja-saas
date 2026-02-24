import { Link } from "react-router-dom";

export default function Nav() {
  return (
    <nav style={{ display: "flex", gap: 12, marginBottom: 24 }}>
      <Link to="/login">Login</Link>
      <Link to="/register">Registro</Link>
      <Link to="/dashboard">Dashboard</Link>
      <Link to="/transactions">Movimientos</Link>
    </nav>
  );
}