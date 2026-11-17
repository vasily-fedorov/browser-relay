# Browser Relay

A relay-only Chrome extension that lets an AI agent control your own Chrome browser. The extension opens a WebSocket to a self-hosted relay and executes browser tools that the agent calls through the relay's MCP endpoint. There is no second transport and no local server: the relay is the only server involved.

## How it works

```
+------------------------+       wss://relay.example.com/ws       +-------------------+
| Chrome                 | <-------------------------------------> | Relay server      |
| + Browser Relay ext.   |   AUTH, LIST_TOOLS, CALL_TOOL, RESULT   | /ws    /mcp       |
+------------------------+                                         +---------+---------+
                                                                             ^
                                                          MCP over HTTP      |
                                                          Bearer <token>     |
                                                                             |
                                                                  +----------+--------+
                                                                  | Agent / MCP client |
                                                                  +-------------------+
```

The browser connects out to `/ws` and authenticates with a token. The agent connects to `/mcp` with the same token. Tool calls are forwarded over the existing WebSocket, run inside Chrome with the profile's cookies and logins, and the result travels back to the agent as MCP content.

## Install

Unzip [chrome-mcp-server-lastest.zip](releases/chrome-extension/latest/chrome-mcp-server-lastest.zip) from the repository, or build it yourself (see below).

That archive is a build artifact committed to the repo, not a GitHub Release attachment. It is refreshed by `pnpm release`, so a fresh clone carries a working build and the deployment tooling in the infra project finds it at a stable path. If you change extension sources, rebuild and commit the archive instead of editing it by hand.

1. Open `chrome://extensions/`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the unzipped folder. For a local build, select `app/chrome-extension/.output/chrome-mv3`.
4. Pin the extension if you want quick access to the popup.

The extension is Manifest V3 and needs the `debugger`, `downloads`, `history`, `bookmarks`, `webRequest`, `offscreen`, `scripting`, `storage`, and `tabs` permissions, plus access to all sites.

## Configure

Open the popup, fill in **Relay URL** and **Token**, and press **Connect**.

- **Relay URL** accepts a bare `host:port`, which becomes `wss://host:port/ws`, `https://host`, which becomes `wss://host/ws`, or `http://host`, which becomes `ws://host/ws`. An explicit `/ws` path is preserved.
- **Token** is the token registered on the relay. There is no Login field: the relay resolves the user from the token.
- After authentication the popup shows the session name and the number of advertised tools. A full build advertises 23 tools.
- **EN | RU** switches the popup language. The choice is stored in `chrome.storage.local` under `uiLanguage`.
- The connection settings are stored in `chrome.storage.local` under `remoteRelayConfig`, and the extension reconnects automatically on browser startup. **Disconnect** closes the socket but keeps the saved settings.

## Build from source

Prerequisites: Node.js 20 or newer, corepack, pnpm, and Chrome.

```bash
corepack enable
pnpm install

# Shared schemas and types first; the extension depends on its dist output
pnpm --filter browser-relay-shared build

# Extension build
pnpm --filter browser-relay-extension build

# Type check the Vue and TypeScript sources
pnpm --filter browser-relay-extension compile

# Unit tests
pnpm --filter browser-relay-extension test

# Build the zip and copy it to releases/chrome-extension/latest/chrome-mcp-server-lastest.zip
pnpm release
```

The unpacked build lands in `app/chrome-extension/.output/chrome-mv3`. For development, `pnpm --filter browser-relay-extension dev` starts WXT in watch mode.

The release zip filename keeps its historical `lastest` typo because the release tooling reads that exact path.

## Relay server

The relay lives in `app/relay-server` (Fastify plus `ws`, package name `browser-relay-server`). It exposes three endpoints:

| Endpoint  | Used by   | Purpose                                               |
| --------- | --------- | ----------------------------------------------------- |
| `/ws`     | extension | WebSocket connection and token authentication         |
| `/mcp`    | agent     | Streamable HTTP MCP endpoint, `Authorization: Bearer` |
| `/health` | ops       | Status, connected session count, uptime               |

Configuration comes from environment variables: `RELAY_PORT` (default `8080`), `RELAY_HOST` (default `0.0.0.0`), and `AUTH_TOKENS_FILE` (default `tokens.json`).

Tokens are registered server side in a JSON file shaped like the following:

```json
[{ "login": "alice", "token": "long-random-token" }]
```

Run it locally with:

```bash
pnpm --filter browser-relay-server dev     # tsx watch
pnpm --filter browser-relay-server build   # tsc
pnpm --filter browser-relay-server start   # node dist/index.js
```

The extension only ever needs the relay URL and the token. Note that a missing or empty token file puts the relay in a development fallback where any non-empty token is accepted; populate the file for real deployments.

## Available tools

The complete parameter reference is in [docs/TOOLS.md](docs/TOOLS.md). A full build advertises exactly these 23 tools:

| Tool                               | Purpose                                                      |
| ---------------------------------- | ------------------------------------------------------------ |
| `get_windows_and_tabs`             | List open windows and tabs                                   |
| `chrome_read_page`                 | Accessibility tree of visible page elements with stable refs |
| `chrome_computer`                  | Mouse, keyboard, scroll, drag, zoom, and screenshot actions  |
| `chrome_navigate`                  | Open a URL, refresh, or go back and forward                  |
| `chrome_screenshot`                | Screenshot the viewport, full page, or a selected element    |
| `chrome_close_tabs`                | Close tabs by id or URL                                      |
| `chrome_switch_tab`                | Activate a tab                                               |
| `chrome_get_web_content`           | Read visible text or HTML from a page or element             |
| `chrome_network_request`           | Send an HTTP request with the browser's cookies              |
| `chrome_network_capture`           | Capture network requests, optionally with response bodies    |
| `chrome_handle_download`           | Wait for a download and return its details                   |
| `chrome_history`                   | Search browsing history by text and time range               |
| `chrome_bookmark_search`           | Search bookmarks                                             |
| `chrome_bookmark_add`              | Add a bookmark, optionally creating a folder                 |
| `chrome_bookmark_delete`           | Delete a bookmark by id or URL                               |
| `chrome_javascript`                | Run JavaScript in a tab and return the result                |
| `chrome_click_element`             | Click by selector, XPath, ref, or coordinates                |
| `chrome_fill_or_select`            | Fill inputs and select options, checkboxes, or radios        |
| `chrome_keyboard`                  | Send keys, shortcuts, or text to a page                      |
| `chrome_console`                   | Read console output and exceptions from a tab                |
| `chrome_handle_dialog`             | Accept or dismiss alert, confirm, and prompt dialogs         |
| `chrome_request_element_selection` | Ask the user to pick elements and return refs                |
| `chrome_gif_recorder`              | Record tab activity as an animated GIF                       |

## Security notes

- The token is the only credential. Anyone with it can drive that Chrome profile, so treat it like a password and rotate it if it leaks.
- Use a dedicated Chrome profile for agent work. The extension can read history, bookmarks, cookies-backed requests, and page content.
- Only `/ws` should be reachable from the public internet. Keep `/mcp` inside a private network, or put it behind an authenticating proxy, because it accepts tool calls for a connected browser.
- `/mcp` accepts only a token present in the relay's token file: an unknown token gets `401`, and a known token whose browser is offline gets `503`. A request never reaches a session that belongs to a different token.
- TLS terminates at your reverse proxy. The extension uses `wss://` unless you explicitly enter an `http://` URL.

## Troubleshooting

- **Cannot connect.** Confirm the relay is running and that the host and port resolve from the browser's machine. The popup reports the error under **Last error**, and the service worker console logs the WebSocket URL it tried.
- **Invalid or unknown token.** The relay closes the socket with code `4003` and the popup shows `Invalid token`. Check the token against the relay's token file.
- **HTTP 503 from `/mcp`.** The relay has no connected extension for that token. Open the popup and connect, then retry.
- **Status stays at Authenticating.** The socket opened but the relay did not answer `AUTH`. Verify the URL points at `/ws`, not `/mcp`, and check the relay logs. The relay drops unauthenticated sockets after 15 seconds.
- **Tool calls fail.** Some tools need the `debugger` or `downloads` permission, and a debugger-based capture can conflict with an open DevTools window. Close DevTools and retry.

More detail is in [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Tool reference](docs/TOOLS.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Contributing](docs/CONTRIBUTING.md)
- [Changelog](docs/CHANGELOG.md)

## По-русски

Расширение Chrome, которое управляет вашим браузером по запросу AI-агента. Оно подключается по WebSocket к вашему relay-серверу и выполняет браузерные инструменты, которые агент вызывает через `/mcp`. Отдельный локальный сервер не нужен.

**Установка.** Распакуйте [chrome-mcp-server-lastest.zip](releases/chrome-extension/latest/chrome-mcp-server-lastest.zip) из репозитория, откройте `chrome://extensions/`, включите режим разработчика и нажмите «Загрузить распакованное расширение». Это готовый архив, лежащий прямо в репозитории (не GitHub Release): его обновляет `pnpm release`, поэтому свежий клон сразу содержит рабочую сборку. Для локальной сборки выбирайте папку `app/chrome-extension/.output/chrome-mv3`.

**Настройка.** Откройте popup, укажите Relay URL и токен, нажмите «Подключиться». Поля Login нет: relay сам определяет пользователя по токену. Адрес можно вводить как `host:port` (получится `wss://host:port/ws`), как `https://host` (получится `wss://host/ws`) или как `http://host` (получится `ws://host/ws`). Язык переключается кнопками EN и RU. После подключения видны имя сессии, число инструментов и последняя ошибка.

**Инструменты.** Доступны 23 инструмента: вкладки и окна, чтение страницы, клики и ввод, навигация, скриншоты, сеть, история, закладки, JavaScript, консоль, диалоги, выбор элементов пользователем и запись GIF. Полный список с параметрами: [docs/TOOLS.md](docs/TOOLS.md).

**Если не подключается.** Проверьте, что relay запущен и доступен с машины браузера. Ошибка `Invalid token` означает, что токена нет в файле токенов relay. Ответ 503 от `/mcp` означает, что расширение не подключено. Если статус завис на «Аутентификация», проверьте, что URL ведёт на `/ws`, а не на `/mcp`.

**Безопасность.** Токен даёт полный доступ к профилю браузера. Используйте отдельный профиль Chrome. Наружу стоит открывать только `/ws`, а `/mcp` держать во внутренней сети.

## License and provenance

MIT. See [LICENSE](LICENSE).

This project is a derivative work of [mcp-chrome](https://github.com/hangwin/mcp-chrome) (Copyright (c) 2024 hangye, MIT). It was imported from the fork `vasily-fedorov/mcp-chrome` at commit `6aac27a` and then reduced to the relay-only design described above. See [NOTICE](NOTICE) for details.

The archive keeps the historical filename `chrome-mcp-server-lastest.zip`, typo included, because the deployment tooling in the infra project reads that exact path. The product name in the popup and in the extension manifest is **Browser Relay**.
