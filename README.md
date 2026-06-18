# VK Callback API Worker

Cloudflare Worker принимает события VK Callback API, сохраняет весь входящий JSON в D1 и отправляет простые шаблонные ответы пользователю через `messages.send`.

## Что реализовано

- `POST /vk` — webhook для VK Callback API.
- `GET /vk/logs` — просмотр сохраненных callback-событий, защищен токеном.
- Проверка `secret` из VK Callback API через секрет `VK_SECRET_TOKEN`.
- Код подтверждения Callback API берется из секрета `VK_CONFIRMATION_CODE`.
- Все входящие события пишутся в таблицу `vk_webhooks`, включая ошибочные и события с неверным секретом.
- Для `message_new` определяется тип сообщения и готовится шаблонный ответ:
  - текст: `Вижу пришел текст: ...`
  - картинка: `Вижу пришла картинка`
  - голосовое: `Вижу пришло голосовое`
  - файл: `Вижу пришел файл`
  - видео, аудио, стикер, ссылка и неизвестный тип.
- Если задан `VK_GROUP_ACCESS_TOKEN`, Worker отправляет шаблонный ответ в VK через `messages.send`.
- Ручной GitHub Action `.github/workflows/import-google-drive-archive.yml` скачивает ZIP-архив с Google Drive, распаковывает его в репозиторий и коммитит изменения в `main`.

## Переменные и секреты

### Cloudflare Worker secrets

```bash
npx wrangler secret put API_AUTH_TOKEN
npx wrangler secret put VK_CONFIRMATION_CODE
npx wrangler secret put VK_SECRET_TOKEN
npx wrangler secret put VK_GROUP_ACCESS_TOKEN
```

`VK_GROUP_ACCESS_TOKEN` нужен только если Worker должен сам отправлять ответы пользователям. Без него события все равно сохраняются в D1, а подготовленный ответ пишется в `response_text`.

Опционально можно задать версию VK API:

```bash
npx wrangler secret put VK_API_VERSION
```

### GitHub Actions

Для ручного импорта архива с Google Drive:

- repository variable `GOOGLE_DRIVE_FILE_ID` — ID ZIP-файла на Google Drive, если не хотите вводить ID при каждом запуске workflow;
- repository secret `REPO_PAT` — опциональный PAT для коммита в `main`. Если секрет не задан, workflow использует стандартный `GITHUB_TOKEN` с `contents: write`.

Файл на Google Drive должен быть доступен workflow. Для публичного файла достаточно доступа по ссылке.

## Установка и запуск

```bash
npm install
npx wrangler d1 create openapi-db
```

После создания D1 замените `database_id` в `wrangler.jsonc`.

```bash
npm run migrate:remote
npm run deploy
```

Локально:

```bash
npm run migrate:local
npm run dev
```

Тесты:

```bash
npm test
```

## Примеры curl

Замените `https://example.workers.dev` на адрес вашего Worker.

### Проверка confirmation

```bash
curl -i -X POST 'https://example.workers.dev/vk' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "confirmation",
    "group_id": 123,
    "secret": "<VK_SECRET_TOKEN>"
  }'
```

Ответом должен быть текст из `VK_CONFIRMATION_CODE`.

### Текстовое сообщение

```bash
curl -i -X POST 'https://example.workers.dev/vk' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "message_new",
    "group_id": 123,
    "secret": "<VK_SECRET_TOKEN>",
    "object": {
      "message": {
        "id": 1001,
        "from_id": 456,
        "peer_id": 456,
        "text": "Привет"
      }
    }
  }'
```

### Картинка

```bash
curl -i -X POST 'https://example.workers.dev/vk' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "message_new",
    "group_id": 123,
    "secret": "<VK_SECRET_TOKEN>",
    "object": {
      "message": {
        "id": 1002,
        "from_id": 456,
        "peer_id": 456,
        "attachments": [{ "type": "photo" }]
      }
    }
  }'
```

### Голосовое

```bash
curl -i -X POST 'https://example.workers.dev/vk' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "message_new",
    "group_id": 123,
    "secret": "<VK_SECRET_TOKEN>",
    "object": {
      "message": {
        "id": 1003,
        "from_id": 456,
        "peer_id": 456,
        "attachments": [{ "type": "audio_message" }]
      }
    }
  }'
```

### Файл

```bash
curl -i -X POST 'https://example.workers.dev/vk' \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "message_new",
    "group_id": 123,
    "secret": "<VK_SECRET_TOKEN>",
    "object": {
      "message": {
        "id": 1004,
        "from_id": 456,
        "peer_id": 456,
        "attachments": [{ "type": "doc" }]
      }
    }
  }'
```

### Просмотр логов

```bash
curl -i 'https://example.workers.dev/vk/logs?limit=20' \
  -H 'Authorization: Bearer <API_AUTH_TOKEN>'
```

Фильтр по типу события:

```bash
curl -i 'https://example.workers.dev/vk/logs?type=message_new&message_kind=photo' \
  -H 'Authorization: Bearer <API_AUTH_TOKEN>'
```

## Ручной импорт архива из Google Drive

Запуск: GitHub → Actions → `Import Google Drive archive` → `Run workflow`.

Можно передать `google_drive_file_id` вручную при запуске или заранее задать repository variable `GOOGLE_DRIVE_FILE_ID`. Workflow распаковывает ZIP в корень репозитория, сохраняет сам workflow-файл и коммитит изменения в ветку `main`.
