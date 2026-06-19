# VK Callback API Worker

Версия API: `v4`.

Cloudflare Worker принимает события VK Callback API, сохраняет весь входящий JSON в D1 и отправляет простые шаблонные ответы пользователю через `messages.send`.

## Что реализовано

- `POST /vk` — webhook для VK Callback API.
- `GET /vk/logs` — просмотр сохраненных callback-событий, защищен тем же `VK_SECRET_TOKEN`, который приходит в body webhook от VK.
- Swagger UI доступен на `/`.
- OpenAPI JSON доступен на `/openapi.json`.
- В Swagger UI добавлена авторизация для защищенных методов:
  - `BearerAuth` — вставьте `VK_SECRET_TOKEN`, Swagger сам отправит `Authorization: Bearer ...`;
  - `ApiTokenHeader` — альтернативно отправляет `x-api-token: ...`.
- В Swagger UI для `POST /vk` есть поле тела запроса и примеры body, включая `confirmation` без реальных секретов и реального `group_id`.
- Проверка `secret` из VK Callback API и авторизация `/vk/logs` используют один общий секрет `VK_SECRET_TOKEN`.
- Код подтверждения Callback API берется из секрета `VK_CONFIRMATION_CODE`.
- Все входящие события пишутся в таблицу `vk_webhooks`, включая ошибочные и события с неверным секретом.
- Raw body сохраняется как пришел. JSON-парсер дополнительно умеет принимать тело, скопированное с неразрывными пробелами, например из мессенджера или документа.
- Для `message_new` определяется тип сообщения и готовится шаблонный ответ:
  - текст: `Вижу пришел текст: ...`
  - картинка: `Вижу пришла картинка`
  - голосовое: `Вижу пришло голосовое`
  - файл: `Вижу пришел файл`
  - видео, аудио, стикер, ссылка и неизвестный тип.
- Если задан `VK_GROUP_ACCESS_TOKEN`, Worker отправляет шаблонный ответ в VK через `messages.send`.
- Ручной GitHub Action `.github/workflows/import-google-drive-archive.yml` скачивает ZIP-архив с Google Drive, распаковывает его в репозиторий и коммитит изменения в `main`.
- История D1-миграций сохранена совместимой со старым проектом: старые имена файлов не переименованы, а новая схема применяется отдельной миграцией `0003_drop_template_and_upgrade_vk_webhooks.sql`.

## Версионирование

Версия API задается в `src/version.ts` и отображается в Swagger UI / OpenAPI `info.version`.

Правило для публикаций: версия API должна совпадать с суффиксом имени архива. Для архива `my-vk-openapi-ready-v4.zip` в Swagger/OpenAPI указано `v4`.

`package.json` использует semver-совместимое значение `4.0.0`, чтобы npm не ругался на формат версии.

Текущая версия API: `v4`.

## Переменные и секреты

### Cloudflare Worker secrets

```bash
npx wrangler secret put VK_CONFIRMATION_CODE
npx wrangler secret put VK_SECRET_TOKEN
npx wrangler secret put VK_GROUP_ACCESS_TOKEN
```

`VK_SECRET_TOKEN` используется в двух местах: VK отправляет его в поле `secret` каждого callback body, а вы указываете это же значение в Swagger/curl для просмотра `/vk/logs`.

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

Для автоматической сборки и публикации в Cloudflare используйте команду:

```bash
npm run deploy
```

Перед `wrangler deploy` автоматически выполнится `predeploy`: `wrangler d1 migrations apply DB --remote`.

Если нужно применить миграции вручную без деплоя:

```bash
npm run migrate:remote
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

## Swagger UI

Откройте адрес Worker в браузере:

```text
https://example.workers.dev/
```

Для проверки защищенного `GET /vk/logs` нажмите `Authorize` и укажите токен одним из способов:

- `BearerAuth`: вставьте значение `VK_SECRET_TOKEN` без слова `Bearer`;
- `ApiTokenHeader`: вставьте значение `VK_SECRET_TOKEN`.

Для `POST /vk` откройте метод в Swagger UI, нажмите `Try it out`, выберите пример `confirmation` или `messageText`, измените значения и выполните запрос.

Пример `confirmation`, который есть в Swagger UI:

```json
{
  "group_id": 123456789,
  "event_id": "0000000000000000000000000000000000000000",
  "v": "5.199",
  "type": "confirmation",
  "secret": "vk_callback_secret_from_cloudflare"
}
```

## Примеры curl

Замените `https://example.workers.dev` на адрес вашего Worker.

### Проверка confirmation

```bash
curl -i -X POST 'https://example.workers.dev/vk' \
  -H 'Content-Type: application/json' \
  -d '{
    "group_id": 123456789,
    "event_id": "0000000000000000000000000000000000000000",
    "v": "5.199",
    "type": "confirmation",
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
    "group_id": 123456789,
    "event_id": "1111111111111111111111111111111111111111",
    "v": "5.199",
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
    "group_id": 123456789,
    "event_id": "2222222222222222222222222222222222222222",
    "v": "5.199",
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
    "group_id": 123456789,
    "event_id": "3333333333333333333333333333333333333333",
    "v": "5.199",
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
    "group_id": 123456789,
    "event_id": "4444444444444444444444444444444444444444",
    "v": "5.199",
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

Через `Authorization: Bearer`:

```bash
curl -i 'https://example.workers.dev/vk/logs?limit=20' \
  -H 'Authorization: Bearer <VK_SECRET_TOKEN>'
```

Через `x-api-token`:

```bash
curl -i 'https://example.workers.dev/vk/logs?limit=20' \
  -H 'x-api-token: <VK_SECRET_TOKEN>'
```

Фильтр по типу события:

```bash
curl -i 'https://example.workers.dev/vk/logs?type=message_new&message_kind=photo' \
  -H 'Authorization: Bearer <VK_SECRET_TOKEN>'
```

## Ручной импорт архива из Google Drive

Запуск: GitHub → Actions → `Import Google Drive archive` → `Run workflow`.

Можно передать `google_drive_file_id` вручную при запуске или заранее задать repository variable `GOOGLE_DRIVE_FILE_ID`. Workflow распаковывает ZIP в корень репозитория, сохраняет сам workflow-файл и коммитит изменения в ветку `main`.
