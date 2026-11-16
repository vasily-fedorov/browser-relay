# Дизайн: mcp-chrome как relay-only расширение для проекта `../infra`

Дата: 2026-11-15
Статус: проект (ожидает ревью)

## Контекст и цель

Расширение `mcp-chrome` используется в `../infra` ровно для одного сценария:
пользователь ставит расширение, вводит relay URL и токен, расширение держит
WebSocket до `browser-relay`, а агент вызывает браузерные MCP-инструменты через
`/mcp`. Всё остальное (welcome-страница, локальный native-bridge, workflow
builder, web editor, sidepanel-чат, quick panel, метки элементов, запись,
userscripts, semantic search) в проекте не используется и создаёт неверный flow,
лишние подключения и вес.

Цель: оставить в репозитории один осмысленный путь — **Remote Relay**; привести
интерфейс к русскому и английскому; сохранить контракт сборки, который уже
использует `../infra`.

## Принятые решения

| Вопрос                                    | Решение                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| Глубина чистки                            | Полное удаление кода лишних фич (не «спрятать»)                  |
| Подход                                    | A — точечная вырезка в текущем репозитории                       |
| Языки                                     | RU + EN с переключателем в popup; выбор в `chrome.storage.local` |
| Набор инструментов                        | Все, кроме native-зависимых (23 из 27)                           |
| `app/native-server`, `packages/wasm-simd` | Удаляются                                                        |
| `app/relay-server`, `packages/shared`     | Не меняются                                                      |
| Login в popup                             | Удаляется: relay резолвит по токену                              |
| Контракт zip для infra                    | Сохраняется без изменений                                        |

## Что удаляется

| Путь                                                                                                                                                 | Объём (файлы/строки) |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| `app/chrome-extension/entrypoints/welcome/`                                                                                                          | 3 / 404              |
| `app/chrome-extension/entrypoints/options/`                                                                                                          | 3 / 414              |
| `app/chrome-extension/entrypoints/sidepanel/`                                                                                                        | 67 / 20 225          |
| `app/chrome-extension/entrypoints/builder/`                                                                                                          | 3 / 1 282            |
| `app/chrome-extension/entrypoints/web-editor-v2/`, `entrypoints/web-editor-v2.ts`                                                                    | 62 / 42 299          |
| `app/chrome-extension/entrypoints/quick-panel.content.ts`, `entrypoints/content.ts`                                                                  | 2                    |
| `entrypoints/background/record-replay/`, `record-replay-v3/`                                                                                         | 134 / 26 216         |
| `entrypoints/background/element-marker/`, `web-editor/`, `quick-panel/`                                                                              | 6 / 3 278            |
| `entrypoints/background/semantic-similarity.ts`, `storage-manager.ts`, `native-host.ts`                                                              | 3 / 1 112            |
| `entrypoints/background/tools/record-replay.ts`                                                                                                      | 1                    |
| `entrypoints/background/tools/browser/{performance,file-upload,userscript,inject-script,vector-search}.ts`                                           | 5                    |
| `entrypoints/popup/components/builder/**`                                                                                                            | 39                   |
| `entrypoints/popup/components/{ScheduleDialog,ElementMarkerManagement,LocalModelPage,ModelCacheManagement,ProgressIndicator}.vue`                    | 5                    |
| `entrypoints/styles/tailwind.css`, `common/node-types.ts`                                                                                            | 2                    |
| `utils/{content-indexer,vector-database,semantic-similarity-engine,simd-math-engine,text-chunker,model-cache-manager,lru-cache,indexeddb-client}.ts` | 8                    |
| `workers/` (ONNX runtime + `simd_math*` + `similarity.worker.js`), `public/libs/ort.min.js`                                                          | 8                    |
| `shared/quick-panel/**`, `shared/selector/**`                                                                                                        | 9                    |
| `inject-scripts/{recorder,dom-observer,inject-bridge,props-agent,web-editor,element-marker}.js`                                                      | 6                    |
| `tests/record-replay/`, `tests/record-replay-v3/`, `tests/web-editor-v2/`, мок hnswlib                                                               |                      |
| `packages/wasm-simd/`, `app/native-server/`                                                                                                          | пакеты               |
| `README_zh.md` и `docs/*_zh.md` (китайские версии)                                                                                                   |                      |

Удаление выполняется `git rm`; история сохраняется.

## Что остаётся

```
app/chrome-extension/
  entrypoints/
    popup/                     один экран Relay + RU|EN
    background/
      index.ts                 initRemoteRelayListener + initRemoteRelay
      remote-relay.ts          WS/auth/reconnect/ping/list_tools filter
      keepalive/controller.ts  перенос offscreen-keepalive (без изменений логики)
      tools/                   средства: base-browser + 23 инструмента
    offscreen/                 gif-encoder + keepalive
    element-picker.content.ts
  inject-scripts/              accessibility-tree-helper, click-helper, fill-helper,
                               keyboard-helper, web-fetcher-helper,
                               interactive-elements-helper, network-helper,
                               screenshot-helper, wait-helper, element-picker
  shared/element-picker/
  utils/                       cdp-session-manager, offscreen-manager, image-utils,
                               screenshot-context, output-sanitizer
  common/                      message-types (урезан), constants (урезан),
                               tool-handler, keepalive-protocol, node-types
  _locales/{en,ru}/
```

## Manifest

- `default_locale: 'en'`, `name`/`description` — `__MSG_*__`.
- permissions: `tabs`, `activeTab`, `scripting`, `downloads`, `webRequest`,
  `debugger`, `history`, `bookmarks`, `offscreen`, `storage`.
- убрать: `nativeMessaging`, `contextMenus`, `webNavigation`,
  `declarativeNetRequest`, `alarms`, `sidePanel`.
- убрать `options_ui`, `side_panel`, `commands`.
- `web_accessible_resources`: только `/inject-scripts/*`.
- `action.default_popup` остаётся.

## Popup

Один экран, без welcome и без переходов:

```
Browser Relay                     [RU | EN]
● <статус>
Relay URL   [ browser.example.com  ]
Token       [ •••••••••••••••  ] [👁]
[ Подключиться ] / [ Отключиться ]
Сессия: <login> · Инструментов: <n>
<последняя ошибка, если есть>
```

Поведение:

- Инициализация: прочитать `uiLanguage`; если нет — `chrome.i18n.getUILanguage()`
  начинается с `ru` → `ru`, иначе `en`. Прочитать `remoteRelayConfig` и текущее
  `remoteRelayState`; подписаться на обновления состояния.
- Connect: валидировать поля, `normalizeRelayUrl()`, сохранить
  `{url, token, enabled: true}` в `chrome.storage.local`, отправить
  `RELAY_CONNECT`. Disconnect: `RELAY_DISCONNECT`, конфиг сохраняется.
- Автоконнект при старте service worker уже реализован в background; popup только
  отражает состояние.
- Login не отправляется (в payload уходит `login: ''`, relay резолвит по токену).
- Блок «Remote MCP Config» не показывается: агент подключается к relay.
- «Сессия» — `login` из `AUTH_OK`; «Инструментов» — количество локально
  зарегистрированных инструментов (23), без запроса к relay.
- `entrypoints/popup/style.css` переписывается под один экран; неиспользуемые
  иконки из `components/icons/` удаляются.

`normalizeRelayUrl(input)`:

| Вход                         | Выход                         |
| ---------------------------- | ----------------------------- |
| `browser.example.com`         | `wss://browser.example.com/ws` |
| `https://browser.example.com` | `wss://browser.example.com/ws` |
| `http://localhost:8080`      | `ws://localhost:8080/ws`      |
| `ws://127.0.0.1:8080`        | `ws://127.0.0.1:8080/ws`      |
| `wss://host/custom`          | `wss://host/custom/ws`        |

## Локализация

- `entrypoints/popup/i18n.ts`: словари `en`/`ru` (около 18 ключей), `ref<Lang>`
  для мгновенного переключения, `initLang()`, `setLang()`, `t(key, subs)`.
  Background не импортирует Vue и словарь.
- `chrome.storage.local` ключ `uiLanguage`.
- `_locales/en` и `_locales/ru`: `extensionName`, `extensionDescription` и
  строки оверлеев, инжектируемых как статические JS (element picker / подсказки),
  через `chrome.i18n.getMessage`. `zh_CN/zh_TW/de/ja/ko` удаляются.
- Китайский в `inject-scripts/web-fetcher-helper.js` — это данные (regex
  «реклама/загрузка»), не UI: остаётся.

Ключи popup:

| Ключ                   | EN                | RU                 |
| ---------------------- | ----------------- | ------------------ |
| `statusConnected`      | Connected         | Подключено         |
| `statusDisconnected`   | Not connected     | Не подключено      |
| `statusConnecting`     | Connecting…       | Подключение…       |
| `statusAuthenticating` | Authenticating…   | Аутентификация…    |
| `statusReconnecting`   | Reconnecting…     | Переподключение…   |
| `statusError`          | Connection error  | Ошибка подключения |
| `relayUrlLabel`        | Relay URL         | URL relay          |
| `tokenLabel`           | Token             | Токен              |
| `connect`              | Connect           | Подключиться       |
| `disconnect`           | Disconnect        | Отключиться        |
| `sessionLabel`         | Session           | Сессия             |
| `toolsCount`           | Tools: {0}        | Инструментов: {0}  |
| `lastErrorLabel`       | Last error        | Последняя ошибка   |
| `invalidUrl`           | Enter a relay URL | Укажите URL relay  |
| `tokenRequired`        | Enter a token     | Укажите токен      |
| `showToken`            | Show token        | Показать токен     |
| `hideToken`            | Hide token        | Скрыть токен       |
| `languageLabel`        | Language          | Язык               |

## Runtime

`background/index.ts`:

```ts
export default defineBackground(() => {
  initRemoteRelayListener();
  isRelayEnabled()
    .then((enabled) => enabled && initRemoteRelay())
    .catch(() => {});
});
```

- `remote-relay.ts`: убрать `login` из UI-потока; `list_tools` формируется как
  `TOOL_SCHEMAS.filter((s) => toolNames.has(s.name))` (`toolNames` — ключи
  `toolsMap`), чтобы рекламировались только исполнимые инструменты.
- keepalive переносится из `record-replay-v3/engine/keepalive/offscreen-keepalive.ts`
  и `offscreen/rr-keepalive.ts` без изменения логики; протокол —
  `common/keepalive-protocol.ts`.
- `offscreen/main.ts`: без SemanticSimilarityEngine; GIF + keepalive.
- `common/message-types.ts` / `constants.ts`: удалить неиспользуемые группы
  (semantic, quick-panel, RR, web-editor, element-marker, native).

## Инструменты (23)

`get_windows_and_tabs`, `chrome_navigate`, `chrome_screenshot`, `chrome_read_page`,
`chrome_computer`, `chrome_get_web_content`, `chrome_click_element`,
`chrome_fill_or_select`, `chrome_keyboard`, `chrome_javascript`, `chrome_console`,
`chrome_close_tabs`, `chrome_switch_tab`, `chrome_network_request`,
`chrome_network_capture`, `chrome_handle_download`, `chrome_history`,
`chrome_bookmark_search`, `chrome_bookmark_add`, `chrome_bookmark_delete`,
`chrome_request_element_selection`, `chrome_handle_dialog`, `chrome_gif_recorder`.

Удаляются: `performance_start_trace`, `performance_stop_trace`,
`performance_analyze_insight`, `chrome_upload_file` (работают только через
native-host), а также нерекламируемые `userscript`, `inject_script`,
`vector_search`, `flow_run`, `list_published_flows`.

## Сборка и зависимости

- `app/chrome-extension/package.json`: убрать `@vue-flow/core`,
  `@vue-flow/background`, `@vue-flow/controls`, `@vue-flow/minimap`, `elkjs`,
  `markstream-vue`, `@xenova/transformers`, `hnswlib-wasm-static`, `zod`,
  `tailwindcss`, `@tailwindcss/vite`. Оставить `vue`, `browser-relay-shared`,
  `@modelcontextprotocol/sdk`, `date-fns`, `gifenc`, `unplugin-icons`,
  `unplugin-vue-components`, `wxt` и типовые dev-зависимости.
- `wxt.config.ts`: убрать tailwind-плагин, копирование `workers`, оставить
  копирование `inject-scripts` и `_locales`.
- root `package.json`: убрать `build:native`, `dev:native`, `build:wasm`,
  `copy:wasm`; добавить `release` — сборка + копия zip в
  `releases/chrome-extension/latest/chrome-mcp-server-lastest.zip` (имя с
  опечаткой сохраняется ради `../infra/scripts/package-extensions`).

## Тестирование

1. `pnpm --filter browser-relay-extension compile` (vue-tsc) — чисто.
2. `pnpm -r lint` — чисто.
3. vitest:
   - `tests/i18n.test.ts` — паритет ключей en/ru; дефолт языка (`ru*` → ru,
     `en*`/`de*` → en).
   - `tests/relay-url.test.ts` — таблица `normalizeRelayUrl`.
   - `tests/relay-tools.test.ts` — в `list_tools` попадают только инструменты
     из `toolsMap`; отсутствуют 4 удалённых имени.
4. `pnpm build` — exit 0; размер zip заметно меньше 11.5 МБ.
5. E2E (Playwright + локальный relay): поднять relay с тестовым токеном,
   запустить Chromium с `--load-extension=.output/chrome-mv3`, получить id
   расширения из service worker, открыть popup, ввести URL+токен, Connect →
   статус Connected; `POST /mcp` c Bearer → `tools/list` = 23 инструмента,
   `chrome_navigate` открывает страницу. Если Chromium в окружении не
   запускается — протокольная симуляция WS + ручной шаг, отмеченный как
   непроверенный.

## Документация и следствия для `../infra`

- `README.md` — новый relay-only flow (EN + RU), `README_zh.md` удаляется;
  китайские доки (`docs/*_zh.md`, `docs/VisualEditor*.md`,
  `docs/WINDOWS_INSTALL_zh.md`) удаляются.
- `docs/TOOLS.md` — оставить только 23 инструмента (убрать
  `search_tabs_content`, `performance_*`, `chrome_upload_file`, userscript,
  inject-script, flow-инструменты); `docs/ARCHITECTURE.md` и
  `docs/TROUBLESHOOTING.md` — переписать под relay-only (native/welcome/builder
  убрать).
- `releases/README.md` — новая инструкция установки (RU/EN).
- `../infra/shared-skills/browser-control/SKILL.md`: убрать «Login: оставь
  пустым»; шаги подключения — Relay URL + Token; упоминание native не нужно.
- `../infra/scripts/package-extensions` не меняется (путь к zip сохранён).
- `../infra/compose/dockerfiles/browser-relay` не пересобирается: `shared` и
  `relay-server` не меняются.

## Риски и откат

- Скрытые импорты удалённых модулей: ловятся `vue-tsc` + `eslint` + сборкой.
- Неиспользуемые ассеты/зависимости: проверяются `grep` по оставшемуся коду.
- Откат — `git revert` коммита чистки; история удалённых файлов сохраняется.

## Вне скоупа (YAGNI)

- Изменения в `relay-server`, `packages/shared`, auth-протоколе.
- Новые MCP-инструменты.
- Перевод описаний MCP-инструментов (остаются английскими).
- Вендоринг расширения в `../infra`.
