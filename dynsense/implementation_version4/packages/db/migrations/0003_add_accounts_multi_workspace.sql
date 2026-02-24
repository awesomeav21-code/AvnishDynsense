-- Multi-workspace support: global accounts table + accountId on users
-- This migration is safe for zero-downtime deployment (all additive steps)

-- Step 1: Create accounts table (global identity)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Populate accounts from existing users (deduplicate by email, keep oldest)
INSERT INTO accounts (id, email, password_hash, name, created_at, updated_at)
SELECT DISTINCT ON (email)
  gen_random_uuid(),
  email,
  password_hash,
  name,
  created_at,
  updated_at
FROM users
ORDER BY email, created_at ASC
ON CONFLICT (email) DO NOTHING;

-- Step 3: Add account_id to users as NULLABLE first
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_id UUID;

-- Step 4: Backfill account_id by matching email
UPDATE users u
SET account_id = a.id
FROM accounts a
WHERE u.email = a.email
  AND u.account_id IS NULL;

-- Step 5: Add FK constraint
ALTER TABLE users ADD CONSTRAINT users_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- Step 6: Add unique index (tenant_id, account_id)
CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_account_idx ON users(tenant_id, account_id);

-- Step 7: Add index on account_id for workspace lookups
CREATE INDEX IF NOT EXISTS users_account_idx ON users(account_id);
