-- Make disclosure transaction identity null-safe and repair semantic duplicates
-- created while nullable ticker or transaction dates bypassed the old constraint.

WITH ranked AS (
    SELECT transaction_id,
           row_number() OVER (
               PARTITION BY document_id,
                            owner_type,
                            asset_name,
                            COALESCE(ticker, ''),
                            transaction_type,
                            COALESCE(transaction_date, DATE '0001-01-01')
               ORDER BY (
                            (amount_min IS NOT NULL)::integer
                          + (amount_max IS NOT NULL)::integer
                          + (disclosure_date IS NOT NULL)::integer
                          + (filing_url IS NOT NULL)::integer
                        ) DESC,
                        transaction_id DESC
           ) AS duplicate_rank
    FROM disclosure_transactions
)
DELETE FROM disclosure_transactions target
USING ranked
WHERE target.transaction_id = ranked.transaction_id
  AND ranked.duplicate_rank > 1;

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT con.conname
      INTO constraint_name
      FROM pg_constraint con
     WHERE con.conrelid = 'disclosure_transactions'::regclass
       AND con.contype = 'u'
       AND pg_get_constraintdef(con.oid) LIKE
           'UNIQUE (document_id, owner_type, asset_name, ticker, transaction_type, transaction_date)%'
     LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format(
            'ALTER TABLE disclosure_transactions DROP CONSTRAINT %I',
            constraint_name
        );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS disclosure_transactions_semantic_key
    ON disclosure_transactions (
        document_id,
        owner_type,
        asset_name,
        COALESCE(ticker, ''),
        transaction_type,
        COALESCE(transaction_date, DATE '0001-01-01')
    );
