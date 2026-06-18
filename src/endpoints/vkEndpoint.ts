// src/endpoints/vkEndpoint.ts
import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';

const AnyVKEventSchema = z.object({
    type: z.string(),
    group_id: z.number().optional(),
    secret: z.string().optional(),
    object: z.record(z.any()).optional(),
}).passthrough();

export class VkWebhookRoute extends OpenAPIRoute {
    static schema = {
        method: 'post',
        path: '/vk',
        summary: 'VK Callback API Webhook',
        tags: ['VK'],
        request: {
            body: {
                content: {
                    'application/json': {
                        schema: AnyVKEventSchema,
                    },
                },
            },
        },
        responses: {
            200: {
                description: 'Success',
                content: { 'text/plain': { schema: z.string() } },
            },
        },
    };

    async handle(c: Context<{ Bindings: Env }>) {
        try {
            const body = await c.req.json();
            const rawBody = JSON.stringify(body);

            console.log(`VK Event: ${body.type || 'unknown'}`, body);

            // Сохраняем в базу
            await c.env.DB.prepare(`
                INSERT INTO vk_webhooks (type, group_id, raw_body)
                VALUES (?, ?, ?)
            `).bind(
                body.type || 'unknown',
                body.group_id || null,
                rawBody
            ).run();

            if (body.type === 'confirmation') {
                return c.text('4cb3749b');
            }

            return c.text('ok');
        } catch (err: any) {
            console.error('VK webhook error:', err);

            await c.env.DB.prepare(`
                INSERT INTO vk_webhooks (type, raw_body) 
                VALUES ('error', ?)
            `).bind(err.message?.slice(0, 500) || 'unknown error').run();

            return c.text('error', 500);
        }
    }
}