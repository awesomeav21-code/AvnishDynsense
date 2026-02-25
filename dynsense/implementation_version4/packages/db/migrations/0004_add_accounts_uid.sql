-- Add UID column to accounts table
ALTER TABLE "accounts" ADD COLUMN "uid" varchar(50);

-- Backfill existing accounts with generated UIDs
UPDATE "accounts" SET "uid" = 'DS-' || UPPER(SUBSTRING(md5(random()::text) FROM 1 FOR 6)) WHERE "uid" IS NULL;

-- Make UID required and unique
ALTER TABLE "accounts" ALTER COLUMN "uid" SET NOT NULL;
CREATE UNIQUE INDEX "accounts_uid_idx" ON "accounts" ("uid");
