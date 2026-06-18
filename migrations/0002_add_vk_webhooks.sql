-- Migration number: 0002
CREATE TABLE IF NOT EXISTS vk_webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    received_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    type TEXT NOT NULL,
    group_id INTEGER,
    event_id TEXT,           -- например, update_id или event_id из VK
    raw_body TEXT NOT NULL,  -- весь JSON как строка
    secret_match BOOLEAN DEFAULT FALSE,
    processed BOOLEAN DEFAULT FALSE
);

-- Индексы для быстрых запросов
CREATE INDEX IF NOT EXISTS idx_vk_webhooks_type ON vk_webhooks(type);
CREATE INDEX IF NOT EXISTS idx_vk_webhooks_received ON vk_webhooks(received_at DESC);
