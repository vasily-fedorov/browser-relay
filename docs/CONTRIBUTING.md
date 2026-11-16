# Contributing

Thanks for taking the time to improve the project. This guide covers the workspace layout, the commands that exist today, and the workflow for changing the extension or the relay.

## Workspace layout

The repository is a pnpm workspace with three packages:

```
mcp-chrome/
├── app/
│   ├── chrome-extension/   # WXT + Vue 3 extension
│   │   ├── entrypoints/    # background, popup, offscreen, element picker content script
│   │   ├── inject-scripts/ # helpers injected into pages by tools
│   │   ├── shared/         # element picker controller and strings
│   │   ├── common/         # message types, keepalive protocol, tool catalogue
│   │   ├── utils/          # i18n, offscreen manager, disposer
│   │   ├── _locales/       # en and ru
│   │   └── tests/          # vitest tests
│   └── relay-server/       # Fastify + ws relay, /ws and /mcp
├── packages/
│   └── shared/             # tool schemas, relay message types, shared payloads
├── docs/
└── releases/               # committed build artifact (not a GitHub Release)
```

The extension is a relay client. It has no separate local server. Changes that assume another UI surface or a local MCP port are out of scope.

`releases/chrome-extension/latest/` holds the zip produced by `pnpm release`. Commit it together with the source change that changed the build, so a clone and the infra packaging script both stay in sync.

## Prerequisites

- Node.js 20 or newer
- corepack and pnpm
- Chrome or Chromium for manual testing

## Setup

```bash
corepack enable
pnpm install
pnpm --filter browser-relay-shared build
```

The shared package must be built before the extension or the relay, because both import its `dist` output. After changing `packages/shared/src`, rebuild it before running anything else.

## Commands

Run these from the repository root.

| Command                                            | What it does                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm --filter browser-relay-shared build`         | Build shared schemas and types with tsup                           |
| `pnpm --filter browser-relay-shared dev`           | Rebuild shared on change                                           |
| `pnpm --filter browser-relay-extension build`      | Build the extension with WXT into `.output/chrome-mv3`             |
| `pnpm --filter browser-relay-extension dev`        | Run WXT in watch mode                                              |
| `pnpm --filter browser-relay-extension compile`    | Type check the extension with `vue-tsc --noEmit`                   |
| `pnpm --filter browser-relay-extension test`       | Run the extension test suite once with vitest                      |
| `pnpm --filter browser-relay-extension test:watch` | Run vitest in watch mode                                           |
| `pnpm --filter browser-relay-server dev`           | Run the relay with `tsx watch`                                     |
| `pnpm --filter browser-relay-server build`         | Compile the relay with `tsc`                                       |
| `pnpm --filter browser-relay-server start`         | Run the compiled relay                                             |
| `pnpm lint`                                        | Lint every package                                                 |
| `pnpm lint:fix`                                    | Lint and apply safe fixes                                          |
| `pnpm format`                                      | Format every package with Prettier                                 |
| `pnpm typecheck`                                   | Run `tsc --noEmit` in every package that has a tsconfig            |
| `pnpm release`                                     | Build the zip and copy it into `releases/chrome-extension/latest/` |

Load the unpacked build from `app/chrome-extension/.output/chrome-mv3` in `chrome://extensions/` with Developer mode enabled.

## Development loop

1. Build shared after any schema or protocol change.
2. Run `pnpm --filter browser-relay-extension dev`, or build and reload the unpacked extension.
3. Start the relay with `pnpm --filter browser-relay-server dev`.
4. In the popup, enter the relay URL and a token from `app/relay-server/tokens.json`, then connect.
5. Watch the service worker console at `chrome://extensions/` for `[RemoteRelay]` and `[keepalive]` lines.

For relay-only changes you do not need the extension running to check `/health`, but you do need it for `/mcp` tool calls.

## Adding or changing a tool

1. Add or edit the schema in `packages/shared/src/tools.ts` under `TOOL_SCHEMAS`. Use the existing entries as the pattern for `name`, `description`, and `inputSchema`.
2. Implement the executor in `app/chrome-extension/entrypoints/background/tools/browser/`. Tools extend the browser tool base class and expose `name` and `execute(args)`.
3. Export the tool from `app/chrome-extension/entrypoints/background/tools/browser/index.ts`. The registry in `tools/index.ts` builds from these exports.
4. Rebuild shared, then run the extension build and the type check.
5. Add or update a test under `app/chrome-extension/tests/`.

Advertised tools are the intersection of `TOOL_SCHEMAS` and `registeredToolNames`. A schema without an executor is silently hidden from the agent, which is deliberate: the two lists must match. When adding a tool, verify the popup's tool count changes and that the tool appears in an MCP `tools/list` response.

When removing a tool, remove both the schema and the executor export. Leaving one behind makes the build inconsistent even if nothing fails at runtime.

## Relay changes

The relay is in `app/relay-server`:

- `src/auth.ts` loads the token map from `tokens.json` or `AUTH_TOKENS_FILE`.
- `src/ws-server.ts` handles `/ws`, authentication, and message routing.
- `src/mcp-manager.ts` maps MCP `tools/list` and `tools/call` onto relay messages.
- `src/index.ts` wires Fastify, `/mcp`, and `/health`.

Relay message types come from `packages/shared`. Rebuild shared after changing them, and keep both sides in sync in the same change.

For manual testing, start the relay, connect the extension, and call `/health` to confirm the session count. Then send an MCP request to `/mcp` with `Authorization: Bearer <token>`.

## Tests

- Tests use vitest and live under `app/chrome-extension/tests/`.
- Run the suite with `pnpm --filter browser-relay-extension test`.
- Keep tests deterministic. Do not use fixed sleeps to wait for async state; subscribe to the event or await the state change with a bounded timeout.
- A test that only pins prose, comments, or documentation wording does not belong in the suite.

There is no test suite in the relay package today. If you add one, add the script and document it in the command table.

## Code style

- TypeScript with strict types. Avoid `any` when a real type is available.
- ESLint and Prettier are configured at the root. Run `pnpm lint` and `pnpm format` before opening a pull request.
- Follow the existing module boundaries: protocol types in `packages/shared`, browser execution in `background/tools`, relay transport in `app/relay-server`.
- Handle errors at the tool boundary and return a readable message. Do not swallow failures silently.
- Keep the popup a single screen. New settings belong in `chrome.storage.local` with a documented key.

## Commit and pull request workflow

1. Create a branch: `git checkout -b feature/your-change`.
2. Make the change and run the relevant checks: shared build, extension build, `compile`, and tests. For relay changes, build the relay and exercise `/health` and `/mcp`.
3. Commit with a Conventional Commit message. The repository uses commitlint:
   - `feat: ...` for a feature
   - `fix: ...` for a bug fix
   - `docs: ...` for documentation
   - `test: ...` for tests
   - `refactor: ...` for a refactor
4. Push the branch and open a pull request describing the change, the commands you ran, and any manual verification.

## Reporting bugs

Include the browser and Node versions, the relay version or commit, the popup status and last error, the service worker console output, and the relay console output around the failure. If the problem is a missing session, include the `/health` response.

## Resources

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Chrome extension development](https://developer.chrome.com/docs/extensions/)
- [WXT](https://wxt.dev/)
- [Architecture](ARCHITECTURE.md)
- [Tool reference](TOOLS.md)
- [Troubleshooting](TROUBLESHOOTING.md)

By contributing, you agree that your changes are licensed under the MIT License.
