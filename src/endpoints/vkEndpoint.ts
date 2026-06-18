// src/endpoints/vkEndpoint.ts
import { Request, Response } from 'express';

/**
 * VK Callback endpoint для подтверждения вебхука
 */
export const vkEndpoint = (req: Request, res: Response) => {
    try {
        // Получаем тело запроса
        const { type, group_id } = req.body;

        // Проверяем тип запроса
        if (type === 'confirmation') {
            // Возвращаем строку подтверждения
            return res.status(200).send('4cb3749b');
        }

        // Для других типов запросов можно добавить обработку
        res.status(200).send('OK');

    } catch (error) {
        console.error('Ошибка в VK endpoint:', error);
        res.status(500).send('Internal Server Error');
    }
};
