// frontend/src/pages/Categories.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCategories,
  createCategory,
  renameCategory,
  deactivateCategory,
} from "../lib/categoriesApi";

export default function Categories() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const token = localStorage.getItem("token");

  const load = async () => {
    if (!token) {
      navigate("/login");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await getCategories(token);
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");

    if (!newName.trim()) {
      setError("Nombre requerido");
      return;
    }

    try {
      await createCategory(token, newName.trim());
      setNewName("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRename = async (id) => {
    if (!editingName.trim()) {
      setError("Nombre requerido");
      return;
    }

    try {
      await renameCategory(token, id, editingName.trim());
      setEditingId(null);
      setEditingName("");
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deactivateCategory(token, id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <h2>Categorías</h2>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <form onSubmit={handleCreate} style={{ marginBottom: 16 }}>
        <input
          placeholder="Nueva categoría"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button type="submit" style={{ marginLeft: 8 }}>
          Crear
        </button>
      </form>

      {loading ? (
        <p>Cargando...</p>
      ) : items.length === 0 ? (
        <p>No hay categorías.</p>
      ) : (
        <ul>
          {items.map((c) => (
            <li key={c.id} style={{ marginBottom: 8 }}>
              {editingId === c.id ? (
                <>
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                  <button onClick={() => handleRename(c.id)}>
                    Guardar
                  </button>
                  <button onClick={() => setEditingId(null)}>
                    Cancelar
                  </button>
                </>
              ) : (
                <>
                  <strong>{c.name}</strong>
                  <button
                    onClick={() => {
                      setEditingId(c.id);
                      setEditingName(c.name);
                    }}
                    style={{ marginLeft: 8 }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    style={{ marginLeft: 4 }}
                  >
                    Desactivar
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}