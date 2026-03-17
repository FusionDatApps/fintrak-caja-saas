BEGIN;

-- 1) nueva columna
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS category_id uuid;

-- 2) backfill
UPDATE transactions t
SET category_id = c.id
FROM categories c
WHERE t.user_id = c.user_id
  AND t.category = c.name
  AND t.category_id IS NULL;

-- 3) FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_category_fk'
  ) THEN
    ALTER TABLE transactions
    ADD CONSTRAINT transactions_category_fk
    FOREIGN KEY (category_id)
    REFERENCES categories(id);
  END IF;
END $$;

COMMIT;