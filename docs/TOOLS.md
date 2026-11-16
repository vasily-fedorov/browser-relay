# Tool reference

The extension advertises 23 MCP tools over the relay. The agent calls them on `/mcp` with a Bearer token, the relay forwards each call to the connected extension, and the result comes back as MCP content. Most tools return text, usually JSON or a readable summary; errors come back with `isError: true` and a message.

A few conventions apply throughout:

- `tabId` defaults to the active tab. `windowId` is only used to pick the active tab when `tabId` is missing.
- `ref` and `refId` values come from a recent `chrome_read_page` response in the same tab. They can expire, and a stale ref fails rather than silently clicking something else.
- Selectors can be CSS or XPath where `selectorType` is accepted.
- Times are in milliseconds unless a parameter says otherwise.

## Windows and tabs

### get_windows_and_tabs

List all open browser windows and their tabs.

No parameters.

### chrome_close_tabs

Close one or more tabs.

| Parameter | Type     | Notes                                                     |
| --------- | -------- | --------------------------------------------------------- |
| `tabIds`  | number[] | Tab ids to close. Defaults to the active tab.             |
| `url`     | string   | Close tabs matching this URL instead of passing `tabIds`. |

### chrome_switch_tab

Activate a specific tab.

| Parameter  | Type   | Notes                         |
| ---------- | ------ | ----------------------------- |
| `tabId`    | number | Required. Tab to activate.    |
| `windowId` | number | Window that contains the tab. |

## Reading and interacting with pages

### chrome_read_page

Return an accessibility tree of elements visible in the viewport, with refs that other tools accept.

| Parameter  | Type   | Notes                                                                |
| ---------- | ------ | -------------------------------------------------------------------- |
| `filter`   | string | `interactive` limits output to buttons, links, inputs, and similar.  |
| `depth`    | number | Maximum DOM depth. Lower values produce smaller output.              |
| `refId`    | string | Focus on the subtree rooted at a previous ref, for example `ref_12`. |
| `tabId`    | number | Target tab. Defaults to the active tab.                              |
| `windowId` | number | Window used to choose the active tab when `tabId` is omitted.        |

If the element you need is not visible in the tree, take a screenshot through `chrome_computer` with `action="screenshot"` and work with coordinates.

### chrome_computer

Perform mouse and keyboard actions and take screenshots. This is the general purpose interaction tool; the dedicated click and fill tools are narrower alternatives.

| Parameter          | Type    | Notes                                                                                                                                                                                                      |
| ------------------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `action`           | string  | Required. `left_click`, `right_click`, `double_click`, `triple_click`, `left_click_drag`, `scroll`, `scroll_to`, `type`, `key`, `fill`, `fill_form`, `hover`, `wait`, `resize_page`, `zoom`, `screenshot`. |
| `ref`              | string  | Element ref from `chrome_read_page`. Takes precedence over coordinates.                                                                                                                                    |
| `coordinates`      | object  | `{ x, y }`. Required for click and scroll, and the end point for a drag.                                                                                                                                   |
| `startCoordinates` | object  | `{ x, y }` starting point for a drag.                                                                                                                                                                      |
| `startRef`         | string  | Drag start ref, as an alternative to `startCoordinates`.                                                                                                                                                   |
| `scrollDirection`  | string  | `up`, `down`, `left`, or `right`.                                                                                                                                                                          |
| `scrollAmount`     | number  | Scroll ticks from 1 to 10. Default 3.                                                                                                                                                                      |
| `text`             | string  | Text for `type`, or a key sequence for `key`, for example `Backspace Enter` or `cmd+a`.                                                                                                                    |
| `repeat`           | number  | For `key`: repeat count from 1 to 100. Default 1.                                                                                                                                                          |
| `modifiers`        | object  | `{ altKey, ctrlKey, metaKey, shiftKey }` booleans for click actions.                                                                                                                                       |
| `region`           | object  | For `zoom`: `{ x0, y0, x1, y1 }` in viewport pixels.                                                                                                                                                       |
| `selector`         | string  | CSS selector for `fill`, as an alternative to `ref`.                                                                                                                                                       |
| `value`            | any     | String, boolean, or number for `fill`.                                                                                                                                                                     |
| `elements`         | array   | For `fill_form`: array of `{ ref, value }`.                                                                                                                                                                |
| `width`, `height`  | number  | Viewport size for `resize_page`.                                                                                                                                                                           |
| `appear`           | boolean | For `wait` with text: wait for text to appear (default true) or disappear (false).                                                                                                                         |
| `timeout`          | number  | For `wait` with text: timeout in ms. Default 10000, maximum 120000.                                                                                                                                        |
| `duration`         | number  | Seconds to wait. Maximum 30.                                                                                                                                                                               |
| `tabId`            | number  | Target tab. Defaults to the active tab.                                                                                                                                                                    |
| `background`       | boolean | Avoid focusing the tab or window where possible. Default false.                                                                                                                                            |

### chrome_click_element

Click an element using a selector, an XPath, a page ref, or viewport coordinates.

| Parameter           | Type    | Notes                                                        |
| ------------------- | ------- | ------------------------------------------------------------ |
| `selector`          | string  | CSS selector or XPath.                                       |
| `selectorType`      | string  | `css` (default) or `xpath`.                                  |
| `ref`               | string  | Ref from `chrome_read_page`. Takes precedence over selector. |
| `coordinates`       | object  | `{ x, y }` in the viewport.                                  |
| `double`            | boolean | Double click. Default false.                                 |
| `button`            | string  | `left` (default), `right`, or `middle`.                      |
| `modifiers`         | object  | `{ altKey, ctrlKey, metaKey, shiftKey }`.                    |
| `waitForNavigation` | boolean | Wait for a navigation after the click. Default false.        |
| `timeout`           | number  | Wait timeout in ms. Default 5000.                            |
| `tabId`             | number  | Target tab.                                                  |
| `windowId`          | number  | Window used to choose the active tab.                        |
| `frameId`           | number  | Target iframe.                                               |

### chrome_fill_or_select

Fill or select a form control: input, textarea, select, checkbox, or radio.

| Parameter      | Type                    | Notes                                                                                     |
| -------------- | ----------------------- | ----------------------------------------------------------------------------------------- |
| `selector`     | string                  | CSS selector or XPath.                                                                    |
| `selectorType` | string                  | `css` (default) or `xpath`.                                                               |
| `ref`          | string                  | Ref from `chrome_read_page`, takes precedence over the selector.                          |
| `value`        | string, boolean, number | Required. Text for inputs, boolean for checkboxes and radios, value or label for selects. |
| `tabId`        | number                  | Target tab.                                                                               |
| `windowId`     | number                  | Window used to choose the active tab.                                                     |
| `frameId`      | number                  | Target iframe.                                                                            |

### chrome_keyboard

Send keys, key combinations, or literal text to a page.

| Parameter      | Type   | Notes                                                                    |
| -------------- | ------ | ------------------------------------------------------------------------ |
| `keys`         | string | Required. Examples: `Enter`, `Ctrl+C`, `Shift+Tab`, `Hello World`.       |
| `selector`     | string | Element that should receive the events. Defaults to the focused element. |
| `selectorType` | string | `css` (default) or `xpath`.                                              |
| `delay`        | number | Delay between keystrokes in ms. Default 50.                              |
| `tabId`        | number | Target tab.                                                              |
| `windowId`     | number | Window used to choose the active tab.                                    |
| `frameId`      | number | Target iframe.                                                           |

### chrome_javascript

Execute JavaScript in a tab and return the result. The code runs inside an async function body, so top-level `await` and `return` work.

| Parameter        | Type   | Notes                                                                     |
| ---------------- | ------ | ------------------------------------------------------------------------- |
| `code`           | string | Required. JavaScript to execute.                                          |
| `tabId`          | number | Target tab. Defaults to the active tab.                                   |
| `timeoutMs`      | number | Execution timeout. Default 15000.                                         |
| `maxOutputBytes` | number | Output cap after sanitization. Default 51200. Larger output is truncated. |

Evaluation uses CDP with `awaitPromise` and `returnByValue`, and falls back to `chrome.scripting.executeScript` when the debugger is busy. Sensitive values in the output are redacted.

### chrome_request_element_selection

Ask the user to pick one or more elements on the page. Use this as a human-in-the-loop fallback after about three failed attempts to locate an element.

| Parameter   | Type   | Notes                                                                                                                                                                                                               |
| ----------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requests`  | array  | Required. Array of `{ id?, name, description? }`. `name` is the short label shown to the user, `description` adds context, and `id` is an optional stable correlation id. Each request produces one picked element. |
| `timeoutMs` | number | Time for the user to finish all selections. Default 180000, maximum 600000.                                                                                                                                         |
| `tabId`     | number | Target tab.                                                                                                                                                                                                         |
| `windowId`  | number | Window used to choose the active tab.                                                                                                                                                                               |

The result contains refs compatible with `chrome_click_element` and `chrome_fill_or_select`, including `frameId` for cross-frame picks.

## Navigation and capture

### chrome_navigate

Open a URL, refresh the current tab, or move through history.

| Parameter         | Type    | Notes                                                                     |
| ----------------- | ------- | ------------------------------------------------------------------------- |
| `url`             | string  | URL to open, or `back` / `forward` for history navigation.                |
| `newWindow`       | boolean | Open the URL in a new window. Default false.                              |
| `tabId`           | number  | Navigate, refresh, or go back and forward in this tab.                    |
| `windowId`        | number  | Window for a new tab, or for choosing the active tab.                     |
| `background`      | boolean | Do not focus the tab or window. Default false.                            |
| `width`, `height` | number  | Window size. Providing either creates a new window. Defaults 1280 by 720. |
| `refresh`         | boolean | Refresh the active tab and ignore `url`. Default false.                   |

### chrome_screenshot

Capture the viewport, the full page, or one element.

| Parameter         | Type    | Notes                                                                    |
| ----------------- | ------- | ------------------------------------------------------------------------ |
| `name`            | string  | Name to use when saving the PNG.                                         |
| `selector`        | string  | CSS selector of the element to capture.                                  |
| `tabId`           | number  | Target tab.                                                              |
| `windowId`        | number  | Window used to choose the active tab.                                    |
| `background`      | boolean | Try to capture without bringing the tab forward. Default false.          |
| `width`, `height` | number  | Output size. Defaults 800 by 600.                                        |
| `storeBase64`     | boolean | Return the image as base64. Use this when the model should see the page. |
| `fullPage`        | boolean | Capture the entire page. Default true.                                   |
| `savePng`         | boolean | Save a PNG file. Default true. Set false when only base64 is needed.     |

For new work, prefer `chrome_read_page`, and prefer `chrome_computer` with `action="screenshot"` when interaction is involved. This tool remains for advanced options.

### chrome_gif_recorder

Record tab activity as an animated GIF. Frames are encoded in the extension's offscreen document.

| Parameter                        | Type    | Notes                                                                                |
| -------------------------------- | ------- | ------------------------------------------------------------------------------------ |
| `action`                         | string  | Required. `start`, `stop`, `status`, `auto_start`, `capture`, `clear`, or `export`.  |
| `tabId`                          | number  | Target tab. Also the upload target for `export` when `download` is false.            |
| `fps`                            | number  | Fixed-FPS mode rate from 1 to 30. Default 5.                                         |
| `durationMs`                     | number  | Fixed-FPS maximum duration. Default 5000, maximum 60000.                             |
| `maxFrames`                      | number  | Frame cap. Default 50 in fixed mode and 100 in auto mode, maximum 300.               |
| `width`, `height`                | number  | Output size. Defaults 800 by 600, maximum 1920 by 1080.                              |
| `maxColors`                      | number  | Palette size. Default 256. Fewer colors produce a smaller file.                      |
| `filename`                       | string  | Output name without the extension. Defaults to a timestamp.                          |
| `captureDelayMs`                 | number  | Auto mode: delay after an action before capturing. Default 150.                      |
| `frameDelayCs`                   | number  | Auto mode: display time per frame in centiseconds. Default 20, which is 200 ms.      |
| `annotation`                     | string  | Auto mode with `capture`: label drawn on the frame.                                  |
| `download`                       | boolean | Export: download the GIF (default true) or upload it by drag and drop (false).       |
| `coordinates`, `ref`, `selector` | mixed   | Export with `download=false`: drop target for the upload.                            |
| `enhancedRendering`              | object  | Auto mode: overlays for clicks, drag paths, and labels. `true` enables the defaults. |

### chrome_get_web_content

Read visible text or HTML from a page, or from one element.

| Parameter     | Type    | Notes                                                       |
| ------------- | ------- | ----------------------------------------------------------- |
| `url`         | string  | Page to fetch. Defaults to the active tab.                  |
| `tabId`       | number  | Existing tab to read.                                       |
| `background`  | boolean | Do not activate the tab or focus the window. Default false. |
| `htmlContent` | boolean | Return visible HTML. Takes precedence over `textContent`.   |
| `textContent` | boolean | Return visible text with metadata. Default true.            |
| `selector`    | string  | Restrict output to this element.                            |

## Network

### chrome_network_request

Send an HTTP request from the browser, with the profile's cookies and context.

| Parameter  | Type   | Notes                                                                                                                                                                                                                                                                     |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `url`      | string | Required. Request URL.                                                                                                                                                                                                                                                    |
| `method`   | string | HTTP method. Default GET.                                                                                                                                                                                                                                                 |
| `headers`  | object | Request headers.                                                                                                                                                                                                                                                          |
| `body`     | string | Request body for methods such as POST or PUT.                                                                                                                                                                                                                             |
| `timeout`  | number | Timeout in ms. Default 30000.                                                                                                                                                                                                                                             |
| `formData` | object | Multipart descriptor: `{ fields?, files? }` where files accept `fileUrl`, `filePath`, or `base64Data`, plus optional `filename` and `contentType`. Overrides `body`. Also accepts compact `[name, fileSpec, filename?]` entries with `url:`, `file:`, or `base64:` specs. |

### chrome_network_capture

Capture network traffic for a tab.

| Parameter           | Type    | Notes                                                                                           |
| ------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `action`            | string  | Required. `start` begins capture, `stop` ends it and returns the entries.                       |
| `needResponseBody`  | boolean | Capture response bodies through the Debugger API. Default false; it can conflict with DevTools. |
| `url`               | string  | Page to capture. Defaults to the active tab.                                                    |
| `maxCaptureTime`    | number  | Maximum capture duration. Default 180000.                                                       |
| `inactivityTimeout` | number  | Stop after this much inactivity. Default 60000. Set 0 to disable.                               |
| `includeStatic`     | boolean | Include images, scripts, and styles. Default false.                                             |

The default mode uses `webRequest` and is lightweight. Response bodies require the debugger mode.

### chrome_handle_download

Wait for a browser download and return its details.

| Parameter          | Type    | Notes                                            |
| ------------------ | ------- | ------------------------------------------------ |
| `filenameContains` | string  | Match a substring in the filename or URL.        |
| `timeoutMs`        | number  | Wait timeout. Default 60000, maximum 300000.     |
| `waitForComplete`  | boolean | Wait until the download completes. Default true. |

## Data

### chrome_history

Search browsing history by text and time range.

| Parameter            | Type    | Notes                                                                                                |
| -------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `text`               | string  | Match against URLs and titles. Empty returns everything in the range.                                |
| `startTime`          | string  | ISO date, relative time such as `2 weeks ago`, or `now`, `today`, `yesterday`. Default 24 hours ago. |
| `endTime`            | string  | Same formats as `startTime`. Default now.                                                            |
| `maxResults`         | number  | Result cap. Default 100.                                                                             |
| `excludeCurrentTabs` | boolean | Skip URLs that are currently open. Default false.                                                    |

### chrome_bookmark_search

Search bookmarks by title and URL.

| Parameter    | Type   | Notes                                                                     |
| ------------ | ------ | ------------------------------------------------------------------------- |
| `query`      | string | Match against titles and URLs. Empty returns all bookmarks.               |
| `maxResults` | number | Result cap. Default 50.                                                   |
| `folderPath` | string | Folder path such as `Work/Projects`, or a folder id, to limit the search. |

### chrome_bookmark_add

Add a bookmark.

| Parameter      | Type    | Notes                                                           |
| -------------- | ------- | --------------------------------------------------------------- |
| `url`          | string  | Page to bookmark. Defaults to the active tab URL.               |
| `title`        | string  | Bookmark title. Defaults to the page title.                     |
| `parentId`     | string  | Folder path or id. Defaults to the Bookmarks Bar.               |
| `createFolder` | boolean | Create the parent folder when it does not exist. Default false. |

### chrome_bookmark_delete

Delete a bookmark.

| Parameter    | Type   | Notes                                            |
| ------------ | ------ | ------------------------------------------------ |
| `bookmarkId` | string | Bookmark id. Provide this or `url`.              |
| `url`        | string | Bookmark URL, used when `bookmarkId` is missing. |
| `title`      | string | Title used to disambiguate a URL match.          |

## Console and dialogs

### chrome_console

Read console output and uncaught exceptions from a tab.

| Parameter           | Type    | Notes                                                                                     |
| ------------------- | ------- | ----------------------------------------------------------------------------------------- |
| `url`               | string  | Page to open and capture. Defaults to the active tab.                                     |
| `tabId`             | number  | Target tab.                                                                               |
| `windowId`          | number  | Window used to choose the active tab.                                                     |
| `background`        | boolean | Do not activate the tab while capturing. Default false.                                   |
| `includeExceptions` | boolean | Include uncaught exceptions. Default true.                                                |
| `maxMessages`       | number  | Snapshot message cap. Default 100.                                                        |
| `mode`              | string  | `snapshot` waits about two seconds, `buffer` reads a persistent per-tab buffer instantly. |
| `buffer`            | boolean | Alias for `mode="buffer"`.                                                                |
| `clear`             | boolean | Buffer mode: clear stored logs before reading.                                            |
| `clearAfterRead`    | boolean | Buffer mode: clear after reading so the next call does not repeat messages.               |
| `pattern`           | string  | Regex filter on message text. Supports `/pattern/flags`.                                  |
| `onlyErrors`        | boolean | Only error-level messages and exceptions.                                                 |
| `limit`             | number  | Returned message cap. In snapshot mode this is an alias for `maxMessages`.                |

### chrome_handle_dialog

Handle a JavaScript dialog through CDP.

| Parameter    | Type   | Notes                                  |
| ------------ | ------ | -------------------------------------- |
| `action`     | string | Required. `accept` or `dismiss`.       |
| `promptText` | string | Text to enter when accepting a prompt. |
