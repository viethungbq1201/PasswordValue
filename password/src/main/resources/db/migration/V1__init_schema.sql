-- V1__init_schema.sql
-- SecureVault database schema

CREATE TABLE users (
    id              UUID PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(500) NOT NULL,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE devices (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_name     VARCHAR(255),
    device_type     VARCHAR(50),
    last_sync       TIMESTAMP,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE folders (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(255) NOT NULL,
    deleted_at      TIMESTAMP
);

CREATE TABLE vault_items (
    id              UUID PRIMARY KEY,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    folder_id       UUID REFERENCES folders(id) ON DELETE SET NULL,
    type            VARCHAR(50) NOT NULL,
    encrypted_data  BYTEA NOT NULL,
    favorite        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_vault_items_user_id ON vault_items(user_id);
CREATE INDEX idx_vault_items_user_deleted ON vault_items(user_id, deleted_at);
CREATE INDEX idx_vault_items_user_favorite ON vault_items(user_id, favorite) WHERE deleted_at IS NULL;
CREATE INDEX idx_vault_items_user_updated ON vault_items(user_id, updated_at);
CREATE INDEX idx_vault_items_folder ON vault_items(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_folders_user_id ON folders(user_id);
CREATE INDEX idx_devices_user_id ON devices(user_id);
