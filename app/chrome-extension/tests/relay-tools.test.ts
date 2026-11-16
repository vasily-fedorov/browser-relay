import { describe, expect, it } from 'vitest';
import { TOOL_SCHEMAS } from 'browser-relay-shared';
import { selectAdvertisedTools } from '@/common/tool-catalogue';
import { registeredToolNames } from '@/entrypoints/background/tools';

const EXPECTED_TOOLS = [
  'get_windows_and_tabs',
  'chrome_read_page',
  'chrome_computer',
  'chrome_navigate',
  'chrome_screenshot',
  'chrome_close_tabs',
  'chrome_switch_tab',
  'chrome_get_web_content',
  'chrome_network_request',
  'chrome_network_capture',
  'chrome_handle_download',
  'chrome_history',
  'chrome_bookmark_search',
  'chrome_bookmark_add',
  'chrome_bookmark_delete',
  'chrome_javascript',
  'chrome_click_element',
  'chrome_fill_or_select',
  'chrome_keyboard',
  'chrome_console',
  'chrome_handle_dialog',
  'chrome_request_element_selection',
  'chrome_gif_recorder',
];

const REMOVED_TOOLS = [
  'performance_start_trace',
  'performance_stop_trace',
  'performance_analyze_insight',
  'chrome_upload_file',
];

describe('relay tool catalogue', () => {
  const advertised = selectAdvertisedTools(TOOL_SCHEMAS as any[], registeredToolNames);
  const names = advertised.map((tool) => tool.name);

  it('advertises exactly the tools this build can execute', () => {
    expect([...names].sort()).toEqual([...EXPECTED_TOOLS].sort());
  });

  it('never advertises a schema without an executor', () => {
    for (const tool of advertised) {
      expect(registeredToolNames.has(tool.name)).toBe(true);
    }
    expect(advertised.length).toBeGreaterThan(0);
  });

  it('drops tools that needed the local native bridge', () => {
    for (const removed of REMOVED_TOOLS) {
      expect(names).not.toContain(removed);
    }
  });

  it('keeps schemas intact for advertised tools', () => {
    const navigate = advertised.find((tool) => tool.name === 'chrome_navigate');
    expect(navigate?.description).toBeTruthy();
    expect(navigate?.inputSchema).toMatchObject({ type: 'object' });
  });

  it('executes every advertised tool name from the registry', () => {
    for (const name of EXPECTED_TOOLS) {
      expect(registeredToolNames.has(name)).toBe(true);
    }
  });
});
