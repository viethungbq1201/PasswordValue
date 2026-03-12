-- V2__advanced_features.sql
-- Add multi-device sync engine tracking and conflict resolution

CREATE TABLE device_sync_state (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id       VARCHAR(255) NOT NULL,
    last_sync_at    TIMESTAMP NOT NULL,
    device_name     VARCHAR(255),
    device_type     VARCHAR(50),
    UNIQUE(user_id, device_id)
);

ALTER TABLE vault_items
ADD COLUMN revision_number INT NOT NULL DEFAULT 1;

-- Update the existing items to have a revision number
UPDATE vault_items SET revision_number = 1 WHERE revision_number IS NULL;
