# Architecture

The extension has one job: keep a WebSocket to a remote relay and execute browser tool calls that arrive over it. Everything below supports that job. There is no second transport.

## Topology

```
+--------------------------------------------------------------+
| Chrome                                                       |
|                                                              |
|  +-------------+   messages   +---------------------------+  |
|  | Popup       | -----------> | Background service worker |  |
|  | (Vue 3)     | <----------- |  remote-relay.ts          |  |
|  +-------------+  state       |  tools/*, keepalive       |  |
|                               +------+--------------+-----+  |
|                                      |              |        |
|                     chrome.scripting |              | offscreen
|                                      v              v        |
|                          +-------------------+  +----------+  |
|                          | Content script /  |  | Offscreen |  |
|                          | inject scripts    |  | GIF + KA  |  |
|                          +-------------------+  +----------+  |
+--------------------------------------|-----------------------+
                                       | WebSocket wss://relay/ws
                                       v
                          +--------------------------+
                          | Relay (Fastify + ws)     |
                          | /ws  sessions  /mcp      |
                          +-------------+------------+
                                        ^
                                        | HTTP, Bearer token
                                        |
                              +---------+---------+
                              | Agent / MCP client |
                              +-------------------+
```

## Components

### Popup

`app/chrome-extension/entrypoints/popup` is a single Vue screen. It shows the connection status, Relay URL, Token, Connect or Disconnect, the session name, the tool count, and the last error. It has no navigation and no other pages.

The popup does not touch the WebSocket. It sends `CONNECT`, `DISCONNECT`, and `GET_STATE` runtime messages to the background and re-renders from the snapshot the background returns. It also subscribes to `STATE_CHANGED` broadcasts. The EN and RU buttons write `uiLanguage` to `chrome.storage.local` and swap the local string table.

`normalizeRelayUrl()` converts user input into a WebSocket endpoint:

| Input                  | Output               |
| ---------------------- | -------------------- |
| `host:8080`            | `wss://host:8080/ws` |
| `https://host`         | `wss://host/ws`      |
| `http://host`          | `ws://host/ws`       |
| `wss://host/custom/ws` | kept as is           |

### Background service worker

`entrypoints/background/index.ts` is deliberately small: it registers the relay message listener and, if a saved configuration exists, starts the connection. It does not initialize any other UI surface or onboarding flow.

`entrypoints/background/remote-relay.ts` owns the connection:

- Loads and saves `remoteRelayConfig`.
- Opens the WebSocket, sends `AUTH` with `{ login: '', token }`, and waits for `AUTH_OK` or `AUTH_ERROR`.
- Tracks the state machine: `disconnected`, `connecting`, `authenticating`, `connected`, `reconnecting`, `error`.
- Answers relay `PING` with `PONG` and sends its own `PING` every 30 seconds.
- Reconnects with exponential backoff from 1 second to 30 seconds, with jitter.
- Handles `LIST_TOOLS` and `CALL_TOOL`, and replies with `TOOLS_LIST` or `TOOL_RESULT` keyed by `requestId`.
- Holds a keepalive reference while the connection is connecting, authenticating, connected, or reconnecting.

`entrypoints/background/tools` contains the executor registry. `tools/index.ts` builds a map from exported tool objects, exposes `registeredToolNames`, and routes `handleCallTool` to `tool.execute(args)`.

`entrypoints/background/keepalive-manager.ts` and `keepalive/controller.ts` implement the service worker keepalive described below.

### Offscreen document

`entrypoints/offscreen` handles work that a Manifest V3 service worker cannot do:

- Encodes captured frames into an animated GIF. The recorder collects frames in the background and sends them to the offscreen document for encoding.
- Hosts the keepalive port and ping loop.

Only one offscreen document exists. `utils/offscreen-manager.ts` creates it on demand and guards against concurrent creation.

### Content script and inject scripts

`entrypoints/element-picker.content.ts` runs in the top frame on all sites. It renders the element picker panel inside a shadow root, forwards cancel, pick, clear, and confirm actions to the background, and updates from picker state messages.

`inject-scripts/` holds small helpers that tools inject into a page when needed: accessibility tree, click, fill, keyboard, interactive elements, network, screenshot, wait, web fetcher, and element picker. Some helpers run in the isolated world so they can use `chrome.runtime` messaging; the rest run in the page context. They are declared as web accessible resources and copied into the build by WXT.

`shared/element-picker/` holds the panel controller, shadow host, styles, and the EN and RU string tables used by the picker.

### Relay server

`app/relay-server` is a Fastify server with a `ws` WebSocket server attached to the same HTTP listener.

- `auth.ts` loads `tokens.json` into a token to login map. If the file is missing or empty, any non-empty token is accepted and the first eight characters become the login. That is a development fallback, not a production mode.
- `ws-server.ts` accepts connections on `/ws`. The first message must be `AUTH` with a token, otherwise the socket gets `AUTH_ERROR`. Sessions are keyed by token, and a new connection replaces the old one with close code `4000`. Unauthenticated sockets are closed after 15 seconds.
- `sessions.ts` stores the live session per token: WebSocket, MCP server, MCP transport, connection time, and pending requests.
- `mcp-manager.ts` creates one MCP `Server` per session. `tools/list` sends `LIST_TOOLS` to the extension and waits for `TOOLS_LIST`; `tools/call` sends `CALL_TOOL` and waits for `TOOL_RESULT`. Each pending request has a 60 second timeout and is resolved by `requestId`.
- `index.ts` exposes `/mcp` over Streamable HTTP. Every method resolves the session through one helper: an unregistered token is `401`, a registered token with no live session is `503`, and a request never falls through to another token's session. `/health` reports status, session count, and uptime.

### Shared package

`packages/shared` exports the tool schemas, relay message types and state enum, and shared payload types. Both the extension and the relay import it, so a protocol change is a single edit followed by a rebuild of the shared package.

## Tool execution path

```
Agent                Relay                    Background                 Chrome
  |                    |                          |                        |
  | tools/call         |                          |                        |
  +------------------->|                          |                        |
  |                    | CALL_TOOL {requestId}    |                        |
  |                    +------------------------->|                        |
  |                    |                          | handleCallTool(name)   |
  |                    |                          |------------------------>
  |                    |                          | tool.execute(args)     |
  |                    |                          |<------------------------
  |                    | TOOL_RESULT {requestId}  |                        |
  |                    |<-------------------------+                        |
  | MCP content        |                          |                        |
  |<-------------------+                          |                        |
```

The extension advertises only tools that both have a schema in `TOOL_SCHEMAS` and an executor in `registeredToolNames`. `selectAdvertisedTools()` performs that intersection, so a schema without an implementation never reaches the agent, and the tool count in the popup matches the same set.

Successful results are returned as MCP content. If a tool returns a `content` array it passes through; otherwise the relay serializes the data as pretty printed JSON. Tool errors become `isError: true` with the error text.

## Message types

The relay protocol uses `RelayMessageType` from `packages/shared`:

| Direction          | Types                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Extension to relay | `AUTH`, `PING`, `PONG`, `TOOLS_LIST`, `TOOL_RESULT`, `PROCESS_RESULT`                       |
| Relay to extension | `AUTH_OK`, `AUTH_ERROR`, `PING`, `PONG`, `LIST_TOOLS`, `CALL_TOOL`, `PROCESS_DATA`, `ERROR` |

Every request carries a `requestId`, and every response carries `responseToRequestId`. The relay keeps the pending map per session.

## State storage

All extension state lives in `chrome.storage.local`.

| Key                 | Shape                                                                                | Written by                                  |
| ------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------- |
| `remoteRelayConfig` | `{ url, login, token, enabled }`                                                     | Popup connect, relay on load                |
| `remoteRelayState`  | `disconnected`, `connecting`, `authenticating`, `connected`, `reconnecting`, `error` | `remote-relay.ts` on every state change     |
| `uiLanguage`        | `en` or `ru`                                                                         | Popup language switch, shared by the picker |

The saved `login` field stays empty. The relay resolves the login from the token, and the popup displays the login returned in `AUTH_OK`.

## Keepalive

A Manifest V3 service worker is suspended after roughly 30 seconds of inactivity. An open WebSocket alone does not guarantee that the worker stays alive, so the extension holds an offscreen document with an active port:

1. `remote-relay.ts` calls `acquireKeepalive('remote-relay')` when the state becomes connecting, authenticating, connected, or reconnecting.
2. The keepalive controller reference counts tags. On the first reference it ensures the offscreen document exists and sends a `keepalive.control` start message, plus `keepalive.start` over the port when the port is connected.
3. The offscreen document opens a named port `keepalive`, sends `keepalive.ping` immediately and then every 20 seconds, and the background answers with `keepalive.pong`.
4. On the last release, the controller sends stop, disconnects the port, and the offscreen document clears its interval and stops reconnecting.
5. Port disconnects trigger a reconnect after one second, but only while keepalive is still desired.

The ping traffic keeps the worker scheduled and the port keeps the channel open. The offscreen document is not closed on release because the GIF encoder shares it.

## Internationalization

The extension ships two locales:

- `_locales/en/messages.json` and `_locales/ru/messages.json` provide the manifest strings, such as the extension name and description, through `chrome.i18n`.
- `entrypoints/popup/i18n.ts` holds the popup string table and resolves `uiLanguage`, falling back to the browser UI language.
- `shared/element-picker/strings.ts` holds the picker panel strings and reads the same `uiLanguage` key, so the in-page panel follows the popup choice.
- `utils/i18n.ts` wraps `chrome.i18n.getMessage` with English fallbacks for contexts where the API is unavailable.

There are exactly two locales. Adding a third means adding the locale folder, a popup string table, and picker strings.

## Build and packaging

The workspace has three packages: `app/chrome-extension`, `app/relay-server`, and `packages/shared`.

WXT builds the extension into `app/chrome-extension/.output/chrome-mv3`. `wxt zip` produces the release archive, and `scripts/copy-release.mjs` copies the newest zip to `releases/chrome-extension/latest/chrome-mcp-server-lastest.zip`. The misspelling in that filename is historical and is consumed by release tooling, so it must not be renamed.

## Security boundaries

- The token is the credential for both the WebSocket and the MCP endpoint. Possession means control of that Chrome profile.
- `/ws` is the endpoint meant to face the internet. `/mcp` should stay inside a private network or behind an authenticating proxy.
- The extension requests broad host access plus `debugger`, `downloads`, `history`, `bookmarks`, `webRequest`, `offscreen`, `scripting`, `storage`, and `tabs`.
- Page content, cookies, history, and bookmarks are all reachable through tools. Use a dedicated profile for agent work.
- The relay does not add authorization beyond the token map and the session lookup described above.
