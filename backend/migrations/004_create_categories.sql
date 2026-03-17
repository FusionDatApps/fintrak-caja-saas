-- 004_create_categories.sql
-- Día 5 - Categorías administrables por usuario
-- Mantiene transactions.category como TEXT (compatibilidad total)

BEGIN;

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name text NOT NULL,

  -- Normalización para evitar duplicados por mayúsculas/espacios
  name_norm text GENERATED ALWAYS AS (lower(btrim(name))) STORED,

  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT categories_user_name_norm_uniq UNIQUE (user_id, name_norm)
);

-- Bootstrap desde categorías ya existentes en transactions
INSERT INTO categories (user_id, name)
SELECT
  t.user_id,
  btrim(t.category)
FROM transactions t
WHERE t.category IS NOT NULL
  AND btrim(t.category) <> ''
GROUP BY t.user_id, btrim(t.category)
ON CONFLICT (user_id, name_norm) DO NOTHING;

COMMIT;