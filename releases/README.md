# Prebuilt extension archive

Download the archive directly from the repository:

[chrome-mcp-server-lastest.zip](chrome-extension/latest/chrome-mcp-server-lastest.zip)

This is a build artifact committed to git, not a GitHub Release attachment. There is no CI job that publishes it: `pnpm release` builds the extension and copies the zip here, and the result is committed together with the source change that produced it. That keeps a fresh clone usable without a build step, and it gives the deployment tooling in the infra project the stable path it reads.

The `lastest` spelling is intentional. Do not rename the archive.

## Install

1. Download and unzip the archive.
2. Open `chrome://extensions/` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the unzipped folder.
5. Pin the extension if you want the popup in the toolbar.

## Configure

1. Start the relay server, or use the one your team already runs.
2. Open the extension popup.
3. Enter the **Relay URL**, for example `relay.example.com` or `https://relay.example.com`.
4. Enter the **Token** registered on the relay.
5. Press **Connect**.

There is no Login field. The relay resolves the user from the token. When the status becomes **Connected**, the popup shows the session name and the tool count. Use **EN | RU** to switch the interface language; the choice is stored in the extension.

If the connection fails, read the **Last error** line in the popup, confirm the relay is reachable, and confirm the token exists in the relay's token file. An HTTP 503 from the relay means the extension is not connected. See [../docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) for more.

## Security

The extension can control the Chrome profile it is installed in, including pages, cookies, history, and bookmarks. Use a dedicated profile for agent work, and treat the token like a password. Only the WebSocket endpoint should be exposed publicly; keep the MCP endpoint on the private network.

## По-русски

Архив лежит прямо в репозитории: [chrome-mcp-server-lastest.zip](chrome-extension/latest/chrome-mcp-server-lastest.zip). Это не GitHub Release, а собранный артефакт, который обновляет `pnpm release` и коммитит вместе с изменениями исходников. Опечатка в имени файла оставлена намеренно: инструменты развёртывания читают именно этот путь.

**Установка.** Распакуйте архив, откройте `chrome://extensions/`, включите режим разработчика, нажмите «Загрузить распакованное расширение» и выберите папку.

**Настройка.** Откройте popup, укажите Relay URL и токен, нажмите «Подключиться». Поля Login нет: relay определяет пользователя по токену. Язык переключается кнопками EN и RU. После подключения видны имя сессии, число инструментов и последняя ошибка.

**Если не работает.** Проверьте строку «Последняя ошибка» в popup, доступность relay и наличие токена в файле токенов на сервере. Ответ 503 означает, что расширение не подключено. Подробнее: [../docs/TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md).

**Безопасность.** Используйте отдельный профиль Chrome. Токен даёт доступ к этому профилю, поэтому храните его как пароль. Наружу стоит открывать только WebSocket, а MCP-эндпоинт держать во внутренней сети.
