// src/endpoints/vkEndpoint.ts
import { createRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';

const AnyVKEvent = z.object({
    type: z.string(),
    group_id: z.number().optional(),
    secret: z.string().optional(),
    object: z.record(z.any()).optional(),   // любой payload
}).passthrough(); // разрешает все остальные поля

export const VkWebhookRoute = createRoute({
    method: 'post',
    path: '/vk',
    summary: 'VK Callback API Webhook',
    tags: ['VK'],
    request: {
        body: {
            content: {
                'application/json': {
                    schema: AnyVKEvent,
                },
            },
        },
    },
    responses: {
        200: { description: 'OK', content: { 'text/plain': { schema: z.string() } } },
    },
});

export const vkHandler = async (c: Context<{ Bindings: Env }>) => {
    try {
        const body = await c.req.json();
        const rawBody = JSON.stringify(body);

        console.log(`VK Event: ${body.type}`, body);

        // === Сохранение ВСЕГО в базу ===
        await c.env.DB.prepare(`
            INSERT INTO vk_webhooks 
            (type, group_id, raw_body)
            VALUES (?, ?, ?)
        `).bind(
            body.type || 'unknown',
            body.group_id || null,
            rawBody
        ).run();

        // Подтверждение адреса сервера
        if (body.type === 'confirmation') {
            return c.text('4cb3749b');
        }

        // TODO: Здесь потом будешь обрабатывать разные типы
        // if (body.type === 'message_new') { ... }

        return c.text('ok');

    } catch (err: any) {
        console.error(err);

        await c.env.DB.prepare(`
            INSERT INTO vk_webhooks (type, raw_body) 
            VALUES ('error', ?)
        `).bind(err.message?.slice(0, 1000) || 'Parse error').run();

        return c.text('error', 500);
    }
};
