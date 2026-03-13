-- V3__vault_urls.sql
-- Add vault URL matching system for autofill

CREATE TABLE vault_urls (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vault_item_id   UUID NOT NULL REFERENCES vault_items(id) ON DELETE CASCADE,
    url             VARCHAR(2048) NOT NULL,
    match_type      VARCHAR(20) NOT NULL DEFAULT 'DOMAIN'
);

CREATE INDEX idx_vault_urls_item ON vault_urls(vault_item_id);
CREATE INDEX idx_vault_urls_url ON vault_urls(url);
