# Troubleshooting

The extension is a relay client. Almost every failure is one of three things: the relay is unreachable, the token is not accepted, or no extension session is connected. Check those first.

## Quick checks

1. `GET /health` on the relay returns `{ "status": "ok", "sessions": N, "uptime": ... }`. If `sessions` is 0, the browser side is not connected.
2. The popup shows a status and, on failure, a message under **Last error**.
3. The relay console prints authentication and session lines, plus cleanup on disconnect.
4. The extension service worker console has `[RemoteRelay]` lines with the URL it dialed, close codes, and reconnect delays.

## Cannot connect

The popup shows `Connection error` and the error text `Cannot connect to <url>`.

- Confirm the relay process is running and listening on the expected interface and port.
- Confirm the browser machine can reach the host. A private hostname that only resolves inside a VPN fails the same way as a stopped server.
- Check the scheme. A bare host becomes `wss://host/ws`, `https://host` becomes `wss://host/ws`, and `http://host` becomes `ws://host/ws`. If your relay is plain HTTP and you typed only the host, the extension tries TLS and the WebSocket handshake fails.
- Check the path. The endpoint is `/ws`. Pointing at `/mcp` opens a connection that cannot speak the relay protocol.
- A self-signed certificate is rejected by Chrome. Use a trusted certificate or a local HTTP relay.

## Invalid or unknown token

The relay answers `AUTH_ERROR` with `Invalid token` and closes the socket with code `4003`.

- Compare the token in the popup with the entry in the relay's token file.
- The relay resolves the login from the token. There is no Login field, and entering a login name in the token field fails.
- A missing token field produces `Missing token` and close code `4002`.
- If the token file is missing or empty, the relay accepts any non-empty token as a development fallback. That is useful for local testing but means a production relay with an empty file is not protected. Populate the token file.
- On `/mcp` the same condition is `401 Invalid or unknown token`. A `503` there means the token is registered but its browser is offline.

## HTTP 503 from `/mcp`

The response body says `No browser extension connected for this token`. The relay has no live session.

- Open the popup and connect the extension.
- Check `/health` for the session count.
- If the extension reconnected recently, wait a moment and retry. The relay registers the session only after `AUTH_OK`.
- A `503` on a token you believe is registered means that token has no live browser, not that the request went somewhere else: the relay never substitutes another session.

## Status stuck at Authenticating

The WebSocket opened but no `AUTH_OK` arrived.

- Verify the URL reaches the relay's `/ws` handler, not a generic HTTP server or a different application.
- The relay closes sockets that do not authenticate within 15 seconds with code `4001` and `Authentication timeout`. A proxy that buffers or drops WebSocket frames produces the same symptom.
- Check the relay console for an authentication line. If none appears, the upgrade request never reached the relay.
- Reload the extension from `chrome://extensions/` after changing relay versions, so the old service worker is gone.

## Reconnect loop

A dropped connection moves the state to `Reconnecting` and retries with exponential backoff from 1 second to 30 seconds, with jitter.

- Repeated close code `4000` means a new connection with the same token replaced the old one. Close the duplicate browser or tab.
- Repeated close code `4003` means the token is wrong. Fix the token instead of waiting for the retry to succeed.
- If the relay restarts often, check its process supervision and the `/health` uptime.
- `Disconnect` in the popup stops the current attempt, but the saved configuration remains and the extension reconnects on the next browser startup. Clear the saved configuration if you want a clean slate, or remove and reload the extension.

## Tool calls fail

Tools run inside Chrome, so their failures are usually permission or focus problems.

- `debugger` conflicts: `chrome_console`, `chrome_handle_dialog`, `chrome_gif_recorder`, and `chrome_network_capture` with `needResponseBody=true` attach the Chrome debugger. Close DevTools for that tab, because a second debugger client cannot attach. The error mentions `another debugger client` or `debugger is already attached`.
- `downloads` errors: `chrome_handle_download` waits for a download event. Make sure the download actually starts and that the filename filter matches.
- Stale refs: refs from `chrome_read_page` expire. Re-read the page before clicking or filling.
- Closed tabs: a tool that targets a `tabId` fails if that tab was closed. Omit `tabId` to use the active tab.
- Restricted pages: `chrome://` pages, the Chrome Web Store, and other protected origins reject script injection. Navigate to a normal page first.
- Timeouts: the relay waits 60 seconds for a tool response. Long operations, such as waiting for a download or a page load, can exceed that even when the tool itself would eventually finish.

## Element picker does not appear

`chrome_request_element_selection` opens a panel in the page.

- The picker runs in the top frame of a normal web page. It does not render on protected `chrome://` pages or inside cross-origin iframes.
- The page must allow content scripts. Reload the tab after installing or reloading the extension.
- Check the deadline. The default timeout is 180 seconds and the maximum is 600 seconds. An expired request closes the panel.
- If the panel is present but clicks do nothing, press Esc and retry. A page with an aggressive overlay or a full-screen canvas can swallow pointer events.

## GIF recorder errors

- `Offscreen document` errors come from the encoder. Reload the extension; the offscreen document is recreated on demand.
- Frames are captured through CDP. Close DevTools and any other debugger client for the tab.
- A recording that starts but produces no frames usually means the tab was closed or navigated away. Use `status` to inspect the recorder state, then `clear` before starting again.
- Large `width`, `height`, `fps`, or `maxFrames` values produce big files and slow encoding. Lower them before assuming the recorder is broken.
- `export` with `download=false` uploads by drag and drop and needs a valid drop target: `coordinates`, `ref`, or `selector`.

## Inspect the service worker console

1. Open `chrome://extensions/`.
2. Find the extension and click the **service worker** link. That opens a DevTools window for the background context.
3. Look for `[RemoteRelay]`, `[KeepaliveManager]`, and `[keepalive]` lines. Connection attempts, close codes, and reconnect delays are logged there.
4. The offscreen document has its own context. In the same DevTools window, use the context selector to switch to the offscreen page when debugging GIF encoding or keepalive.
5. The popup has its own DevTools: right click the popup and choose **Inspect**.

The relay logs to stdout: token count at startup, successful authentication per login, session cleanup, and MCP transport recreation.
