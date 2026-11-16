# План: mcp-chrome → relay-only расширение

Спека: `docs/superpowers/specs/2026-11-15-relay-only-chrome-extension-design.md`

## Baseline (зафиксирован 2026-11-15)

| Проверка           | До чистки                                                                                                            |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `wxt build`        | exit 0, total 13.29 MB                                                                                               |
| `vitest run`       | 483 теста прошли, 10 файлов не собрались — все `tests/record-replay-v3/*`, причина `sharp` не установлен (окружение) |
| `vue-tsc --noEmit` | exit 2, 133 ошибки — все в удаляемых файлах (record-replay-v3, element-marker, sidepanel, builder, web-editor-v2)    |

Поэтому критерий «чисто» после чистки: **0 ошибок tsc, 0 падений vitest**.
Падения до чистки — не наши и исчезают вместе с удаляемыми файлами.

Команды запускаются локальными бинарями (`./node_modules/.bin/*`): `pnpm install`
в этом workspace падает на postinstall `app/native-server` (до чистки), а после
его удаления должен пройти.

## Фаза 1 — Удаление entrypoints и popup-компонентов

1. `git rm -r` : `entrypoints/welcome`, `entrypoints/options`,
   `entrypoints/sidepanel`, `entrypoints/builder`, `entrypoints/web-editor-v2`,
   `entrypoints/web-editor-v2.ts`, `entrypoints/quick-panel.content.ts`,
   `entrypoints/content.ts`, `entrypoints/styles`.
2. `git rm -r entrypoints/popup/components/builder`.
3. `git rm` popup-компоненты: `ScheduleDialog.vue`,
   `ElementMarkerManagement.vue`, `LocalModelPage.vue`,
   `ModelCacheManagement.vue`, `ProgressIndicator.vue`, неиспользуемые
   `components/icons/*`.
4. Проверка: `grep -r "components/builder\|sidepanel\|welcome" entrypoints/popup`.

## Фаза 2 — Background: только relay

1. `git rm -r` : `background/record-replay`, `background/record-replay-v3`,
   `background/element-marker`, `background/web-editor`,
   `background/quick-panel`.
2. `git rm` : `background/semantic-similarity.ts`, `storage-manager.ts`,
   `native-host.ts`, `tools/record-replay.ts`.
3. Перенести keepalive (логика не меняется):
   - `record-replay-v3/engine/keepalive/offscreen-keepalive.ts` →
     `background/keepalive/controller.ts`;
   - `offscreen/rr-keepalive.ts` → `offscreen/keepalive.ts`;
   - `common/rr-v3-keepalive-protocol.ts` → `common/keepalive-protocol.ts`.
     Импорты и имена констант обновить механически.
4. `background/index.ts`: оставить `initRemoteRelayListener()`, затем
   `isRelayEnabled()` → `initRemoteRelay()`. Убрать `onInstalled`-welcome.
5. `offscreen/main.ts`: убрать SemanticSimilarityEngine и обработчики
   `similarityEngine*`, оставить GIF + keepalive.
6. Проверка: `grep -rn "semantic\|record-replay\|native-host\|welcome" entrypoints/background`.

## Фаза 3 — Инструменты: 23

1. `git rm` : `tools/browser/performance.ts`, `file-upload.ts`, `userscript.ts`,
   `inject-script.ts`, `vector-search.ts`.
2. `tools/browser/index.ts`: убрать соответствующие экспорты.
3. `tools/index.ts`: убрать импорт `./record-replay`, оставить
   `{ ...browserTools }`; экспортировать `toolNames` / `getRegisteredTools()`.
4. `remote-relay.ts`: `LIST_TOOLS` = `TOOL_SCHEMAS.filter(t => toolNames.has(t.name))`;
   `AUTH` отправляет `login: ''`; публичный `connectRelay(url, token)`.
5. `common/message-types.ts`, `common/constants.ts`: удалить неиспользуемые группы.
6. Проверка: `grep -rn "performance_\|upload_file\|userscript\|inject_script\|flow_run" entrypoints`.

## Фаза 4 — Utils, ассеты, inject-scripts

1. `git rm` : `utils/{content-indexer,vector-database,semantic-similarity-engine,simd-math-engine,text-chunker,model-cache-manager,lru-cache,indexeddb-client}.ts`,
   `workers/`, `public/libs/`, `common/node-types.ts`,
   `shared/quick-panel`, `shared/selector`.
2. `git rm` : `inject-scripts/{recorder,dom-observer,inject-bridge,props-agent,web-editor,element-marker}.js`.
3. `git rm -r` : `tests/record-replay`, `tests/record-replay-v3`,
   `tests/web-editor-v2`, `tests/__mocks__/hnswlib-wasm-static.ts`.
4. `git rm -r` : `app/native-server`, `packages/wasm-simd`.
5. Проверка: `grep -rn "semantic-similarity-engine\|vector-database\|content-indexer\|node-types" app/chrome-extension --include='*.ts' --include='*.vue'`.

## Фаза 5 — Popup и i18n

1. `entrypoints/popup/i18n.ts`: словари `en`/`ru`, `initLang()` (storage →
   `chrome.i18n.getUILanguage()`), `setLang()`, `t()`. Ключи — из спеки.
2. `entrypoints/popup/normalizeRelayUrl.ts` — чистая функция по таблице спеки.
3. `entrypoints/popup/App.vue`: один экран (статус, URL, токен, connect/
   disconnect, сессия, число инструментов, последняя ошибка, переключатель RU|EN).
4. `entrypoints/popup/style.css` — переписать под один экран.
5. `entrypoints/popup/main.ts` — без `ENSURE_NATIVE`.
6. `_locales/{en,ru}/messages.json` — `extensionName`, `extensionDescription`,
   строки оверлея element picker; `zh_CN/zh_TW/de/ja/ko` удалить.
7. `inject-scripts/element-picker.js`: перевести оставшиеся китайские строки
   через `chrome.i18n.getMessage`.

## Фаза 6 — Manifest, сборка, зависимости

1. `wxt.config.ts`: permissions relay-only; убрать `options_ui`, `side_panel`,
   `commands`, tailwind-плагин, копирование `workers`; `default_locale: 'en'`.
2. `app/chrome-extension/package.json`: убрать `@vue-flow/*`, `elkjs`,
   `markstream-vue`, `@xenova/transformers`, `hnswlib-wasm-static`, `zod`,
   `tailwindcss`, `@tailwindcss/vite`.
3. root `package.json`: убрать `build:native`, `dev:native`, `build:wasm`,
   `copy:wasm`; добавить `release` (build + zip в
   `releases/chrome-extension/latest/chrome-mcp-server-lastest.zip`).

## Фаза 7 — Тесты

`tests/i18n.test.ts`, `tests/relay-url.test.ts`, `tests/relay-tools.test.ts`:
паритет ключей en/ru; дефолт языка; таблица URL;
`list_tools ⊆ toolsMap` и отсутствие 4 удалённых имён.

## Фаза 8 — Документация

`README.md` (EN + RU, relay-only), `docs/TOOLS.md` (23 инструмента),
`docs/ARCHITECTURE.md`, `docs/TROUBLESHOOTING.md`, `releases/README.md`;
удалить `README_zh.md` и `docs/*_zh.md`, `docs/VisualEditor*.md`,
`docs/mcp-cli-config.md` (описывает native/CLI-подключение, которого больше нет).

`../infra/shared-skills/browser-control/SKILL.md`: убрать Login из инструкции.

## Фаза 9 — Проверка

1. `vue-tsc --noEmit` → 0 ошибок.
2. `eslint` → 0 ошибок.
3. `vitest run` → все тесты прошли.
4. `wxt build` → exit 0, размер заметно меньше 13.29 MB.
5. `zip` в путь, который читает `../infra/scripts/package-extensions`.
6. E2E Playwright: локальный relay + `--load-extension`, Connect → Connected,
   `/mcp` `tools/list` = 23, `chrome_navigate` открывает страницу.

## Откат

Каждая фаза — отдельный коммит не создаётся (коммит только по просьбе);
откат = `git checkout -- .` / `git restore` до начала работы, история файлов
сохраняется в git.
