-- V4: Simplify vault architecture — add website column, drop vault_urls table
ALTER TABLE vault_items ADD COLUMN website VARCHAR(2048);

-- Migrate first URL from vault_urls into vault_items.website
UPDATE vault_items vi SET website = (
    SELECT url FROM vault_urls vu WHERE vu.vault_item_id = vi.id LIMIT 1
) WHERE vi.website IS NULL;

-- Drop vault_urls table
DROP TABLE IF EXISTS vault_urls;
