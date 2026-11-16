/**
 * Message type constants shared by the popup, background, offscreen document
 * and injected content helpers.
 */

// Message targets for routing
export enum MessageTarget {
  Offscreen = 'offscreen',
  ContentScript = 'content_script',
  Background = 'background',
}

/** Popup <-> background messages that drive the relay connection. */
export const RELAY_MESSAGE_TYPES = {
  CONNECT: 'relay_connect',
  DISCONNECT: 'relay_disconnect',
  GET_STATE: 'relay_get_state',
  STATE_CHANGED: 'relay_state_changed',
} as const;

// Offscreen message types
export const OFFSCREEN_MESSAGE_TYPES = {
  // GIF encoding
  GIF_ADD_FRAME: 'gifAddFrame',
  GIF_FINISH: 'gifFinish',
  GIF_RESET: 'gifReset',
} as const;

// Tool action message types (for chrome.runtime.sendMessage)
export const TOOL_MESSAGE_TYPES = {
  // Screenshot related
  SCREENSHOT_PREPARE_PAGE_FOR_CAPTURE: 'preparePageForCapture',
  SCREENSHOT_GET_PAGE_DETAILS: 'getPageDetails',
  SCREENSHOT_GET_ELEMENT_DETAILS: 'getElementDetails',
  SCREENSHOT_SCROLL_PAGE: 'scrollPage',
  SCREENSHOT_RESET_PAGE_AFTER_CAPTURE: 'resetPageAfterCapture',

  // Web content fetching
  WEB_FETCHER_GET_HTML_CONTENT: 'getHtmlContent',
  WEB_FETCHER_GET_TEXT_CONTENT: 'getTextContent',

  // User interactions
  CLICK_ELEMENT: 'clickElement',
  FILL_ELEMENT: 'fillElement',
  SIMULATE_KEYBOARD: 'simulateKeyboard',

  // Interactive elements
  GET_INTERACTIVE_ELEMENTS: 'getInteractiveElements',

  // Accessibility tree
  GENERATE_ACCESSIBILITY_TREE: 'generateAccessibilityTree',
  RESOLVE_REF: 'resolveRef',
  ENSURE_REF_FOR_SELECTOR: 'ensureRefForSelector',
  VERIFY_FINGERPRINT: 'verifyFingerprint',
  DISPATCH_HOVER_FOR_REF: 'dispatchHoverForRef',

  // Network requests
  NETWORK_SEND_REQUEST: 'sendPureNetworkRequest',

  // Wait helper
  WAIT_FOR_TEXT: 'waitForText',

  // Element picker (tool-driven, background <-> content scripts)
  ELEMENT_PICKER_START: 'elementPickerStart',
  ELEMENT_PICKER_STOP: 'elementPickerStop',
  ELEMENT_PICKER_SET_ACTIVE_REQUEST: 'elementPickerSetActiveRequest',
  ELEMENT_PICKER_UI_PING: 'elementPickerUiPing',
  ELEMENT_PICKER_UI_SHOW: 'elementPickerUiShow',
  ELEMENT_PICKER_UI_UPDATE: 'elementPickerUiUpdate',
  ELEMENT_PICKER_UI_HIDE: 'elementPickerUiHide',

  // Element picker panel events (content script <-> background)
  ELEMENT_PICKER_UI_EVENT: 'element_picker_ui_event',
  ELEMENT_PICKER_FRAME_EVENT: 'element_picker_frame_event',
} as const;

export const ELEMENT_PICKER_MESSAGE_TYPES = {
  UI_EVENT: TOOL_MESSAGE_TYPES.ELEMENT_PICKER_UI_EVENT,
  FRAME_EVENT: TOOL_MESSAGE_TYPES.ELEMENT_PICKER_FRAME_EVENT,
} as const;

export type OffscreenMessageType =
  (typeof OFFSCREEN_MESSAGE_TYPES)[keyof typeof OFFSCREEN_MESSAGE_TYPES];
export type ToolMessageType = (typeof TOOL_MESSAGE_TYPES)[keyof typeof TOOL_MESSAGE_TYPES];
export type RelayMessageType = (typeof RELAY_MESSAGE_TYPES)[keyof typeof RELAY_MESSAGE_TYPES];
