CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  category TEXT NOT NULL,
  occurred_on DATE NOT NULL,
  description TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash','bank','card','transfer')),
  status TEXT NOT NULL CHECK (status IN ('paid','pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date
  ON transactions (user_id, occurred_on DESC);