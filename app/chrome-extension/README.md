# Browser Relay extension

WXT + Vue 3 Manifest V3 extension. It connects to a remote relay over WebSocket and executes browser tool calls that arrive from an agent through the relay's MCP endpoint.

## Run

From the repository root:

```bash
pnpm --filter browser-relay-shared build
pnpm --filter browser-relay-extension dev
```

Load `app/chrome-extension/.output/chrome-mv3` in `chrome://extensions/` with Developer mode enabled. For a production build and zip, use `pnpm --filter browser-relay-extension build` and `pnpm release`.

## Configure

Open the popup, enter the relay URL and token, and press Connect. There is no Login field. The URL accepts `host:port`, `https://host`, or `http://host`, and is normalized to the relay's `/ws` endpoint.

## Layout

- `entrypoints/background`: service worker, relay connection, tool executors, keepalive
- `entrypoints/popup`: the single settings and status screen, EN and RU
- `entrypoints/offscreen`: GIF encoding and the keepalive port
- `entrypoints/element-picker.content.ts`: in-page element picker panel
- `inject-scripts`: helpers injected into pages by tools
- `_locales`: English and Russian manifest strings

See [../../README.md](../../README.md), [../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md), and [../../docs/TOOLS.md](../../docs/TOOLS.md).
