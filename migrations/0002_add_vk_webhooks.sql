-- Migration number: 0002
-- Base VK webhook table. Kept under the original filename so existing D1
-- databases that already applied it do not try to replay renamed history.
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

CREATE INDEX IF NOT EXISTS idx_vk_webhooks_type ON vk_webhooks(type);
CREATE INDEX IF NOT EXISTS idx_vk_webhooks_received ON vk_webhooks(received_at DESC);
