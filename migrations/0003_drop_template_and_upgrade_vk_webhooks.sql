-- Migration number: 0003
-- Removes Cloudflare template artifacts and upgrades vk_webhooks without
-- relying on ALTER TABLE IF NOT EXISTS, which SQLite/D1 does not support.

DROP TABLE IF EXISTS tasks;

-- Ensure the legacy table exists for fresh databases before the rebuild step.
CREATE TABLE IF NOT EXISTS vk_webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    type TEXT NOT NULL,
    group_id INTEGER,
    event_id TEXT,
    raw_body TEXT NOT NULL,
    secret_match BOOLEAN DEFAULT FALSE NOT NULL,
    processed BOOLEAN DEFAULT FALSE NOT NULL
);

DROP TABLE IF EXISTS vk_webhooks_rebuild;

CREATE TABLE vk_webhooks_rebuild (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    type TEXT NOT NULL,
    group_id INTEGER,
    event_id TEXT,
    user_id INTEGER,
    peer_id INTEGER,
    message_id INTEGER,
    message_kind TEXT,
    raw_body TEXT NOT NULL,
    response_text TEXT,
    secret_match BOOLEAN DEFAULT FALSE NOT NULL,
    processed BOOLEAN DEFAULT FALSE NOT NULL,
    error TEXT
);

INSERT INTO vk_webhooks_rebuild (
    id,
    received_at,
    type,
    group_id,
    event_id,
    raw_body,
    secret_match,
    processed
)
SELECT
    id,
    received_at,
    type,
    group_id,
    event_id,
    raw_body,
    COALESCE(secret_match, FALSE),
    COALESCE(processed, FALSE)
FROM vk_webhooks;

DROP TABLE vk_webhooks;
ALTER TABLE vk_webhooks_rebuild RENAME TO vk_webhooks;

CREATE INDEX IF NOT EXISTS idx_vk_webhooks_type ON vk_webhooks(type);
CREATE INDEX IF NOT EXISTS idx_vk_webhooks_received ON vk_webhooks(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_vk_webhooks_event_id ON vk_webhooks(event_id);
CREATE INDEX IF NOT EXISTS idx_vk_webhooks_message_kind ON vk_webhooks(message_kind);
