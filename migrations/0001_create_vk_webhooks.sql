-- Migration number: 0001
CREATE TABLE IF NOT EXISTS vk_webhooks (
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

CREATE INDEX IF NOT EXISTS idx_vk_webhooks_type ON vk_webhooks(type);
CREATE INDEX IF NOT EXISTS idx_vk_webhooks_received ON vk_webhooks(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_vk_webhooks_event_id ON vk_webhooks(event_id);
CREATE INDEX IF NOT EXISTS idx_vk_webhooks_message_kind ON vk_webhooks(message_kind);
