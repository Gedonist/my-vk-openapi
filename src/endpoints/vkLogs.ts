// src/endpoints/vkLogs.ts
import { OpenAPIRoute } from 'chanfana';
import { z } from 'zod';
import type { Context } from 'hono';

export class VkLogsRoute extends OpenAPIRoute {
    static schema = {
        method: 'get',
        path: '/vk/logs',
        summary: 'Получить список всех VK вебхуков',
        tags: ['VK'],
        request: {
            query: z.object({
                limit: z.string().optional().default('50'),
                type: z.string().optional(),
            }),
        },
        responses: {
            200: {
                description: 'Список вебхуков',
                content: {
                    'application/json': {
                        schema: z.object({
                            success: z.boolean(),
                            data: z.array(z.any()),
                        }),
                    },
                },
            },
        },
    };

    async handle(c: Context<{ Bindings: Env }>) {
        const limit = parseInt(c.req.query('limit') || '50');
        const typeFilter = c.req.query('type');

        let query = `SELECT * FROM vk_webhooks ORDER BY received_at DESC LIMIT ?`;
        const params: any[] = [limit];

        if (typeFilter) {
            query = `SELECT * FROM vk_webhooks WHERE type = ? ORDER BY received_at DESC LIMIT ?`;
            params.unshift(typeFilter);
        }

        const { results } = await c.env.DB.prepare(query).bind(...params).all();

        return c.json({ success: true, data: results });
    }
}