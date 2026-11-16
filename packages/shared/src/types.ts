export enum NativeMessageType {
  START = 'start',
  STARTED = 'started',
  STOP = 'stop',
  STOPPED = 'stopped',
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',
  PROCESS_DATA = 'process_data',
  PROCESS_DATA_RESPONSE = 'process_data_response',
  CALL_TOOL = 'call_tool',
  CALL_TOOL_RESPONSE = 'call_tool_response',
  // Additional message types used in Chrome extension
  SERVER_STARTED = 'server_started',
  SERVER_STOPPED = 'server_stopped',
  ERROR_FROM_NATIVE_HOST = 'error_from_native_host',
  CONNECT_NATIVE = 'connectNative',
  ENSURE_NATIVE = 'ensure_native',
  PING_NATIVE = 'ping_native',
  DISCONNECT_NATIVE = 'disconnect_native',
}

// ============================================================
// Remote Relay Protocol (WebSocket between Extension and Relay Server)
// ============================================================

/** Message types for the WebSocket relay protocol */
export enum RelayMessageType {
  AUTH = 'auth',
  AUTH_OK = 'auth_ok',
  AUTH_ERROR = 'auth_error',
  CALL_TOOL = 'call_tool',
  TOOL_RESULT = 'tool_result',
  LIST_TOOLS = 'list_tools',
  TOOLS_LIST = 'tools_list',
  PROCESS_DATA = 'process_data',
  PROCESS_RESULT = 'process_result',
  PING = 'ping',
  PONG = 'pong',
  ERROR = 'error',
}

/** Base interface for all relay WebSocket messages */
export interface RelayMessage {
  type: RelayMessageType;
  requestId?: string;
  responseToRequestId?: string;
  payload?: unknown;
  error?: string;
}

/** Authentication payload sent from extension to relay */
export interface RelayAuthPayload {
  login: string;
  token: string;
}

/** Tools list returned from extension */
export interface RelayToolsListPayload {
  tools: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
}

/** Tool call payload sent from relay to extension */
export interface RelayCallToolPayload {
  name: string;
  args: Record<string, unknown>;
}

/** Tool result returned from extension */
export interface RelayToolResultPayload {
  status: 'success' | 'error';
  data?: unknown;
  message?: string;
}

/** Remote relay connection state */
export enum RelayConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/** Relay configuration stored in extension storage */
export interface RelayConfig {
  url: string;
  login: string;
  token: string;
  enabled: boolean;
}

export interface NativeMessage<P = any, E = any> {
  type?: NativeMessageType;
  responseToRequestId?: string;
  payload?: P;
  error?: E;
}

// ============================================================
// Element Picker Types (chrome_request_element_selection)
// ============================================================

/**
 * A single element selection request from the AI.
 */
export interface ElementPickerRequest {
  /**
   * Optional stable request id. If omitted, the extension will generate one.
   */
  id?: string;
  /**
   * Short label shown to the user (e.g., "Login button").
   */
  name: string;
  /**
   * Optional longer instruction shown to the user.
   */
  description?: string;
}

/**
 * Bounding rectangle of a picked element.
 */
export interface PickedElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Center point of a picked element.
 */
export interface PickedElementPoint {
  x: number;
  y: number;
}

/**
 * A picked element that can be used with other tools (click, fill, etc.).
 */
export interface PickedElement {
  /**
   * Element ref written into window.__claudeElementMap (frame-local).
   * Can be used directly with chrome_click_element, chrome_fill_or_select, etc.
   */
  ref: string;
  /**
   * Best-effort stable CSS selector.
   */
  selector: string;
  /**
   * Selector type (currently CSS only).
   */
  selectorType: 'css';
  /**
   * Bounding rect in the element's frame viewport coordinates.
   */
  rect: PickedElementRect;
  /**
   * Center point in the element's frame viewport coordinates.
   * Can be used as coordinates for chrome_computer.
   */
  center: PickedElementPoint;
  /**
   * Optional text snippet to help verify the selection.
   */
  text?: string;
  /**
   * Lowercased tag name.
   */
  tagName?: string;
  /**
   * Chrome frameId for iframe targeting.
   * Pass this to chrome_click_element/chrome_fill_or_select for cross-frame support.
   */
  frameId: number;
}

/**
 * Result for a single element selection request.
 */
export interface ElementPickerResultItem {
  /**
   * The request id (matches the input request).
   */
  id: string;
  /**
   * The request name (for reference).
   */
  name: string;
  /**
   * The picked element, or null if not selected.
   */
  element: PickedElement | null;
  /**
   * Error message if selection failed for this request.
   */
  error?: string;
}

/**
 * Result of the chrome_request_element_selection tool.
 */
export interface ElementPickerResult {
  /**
   * True if the user confirmed all selections.
   */
  success: boolean;
  /**
   * Session identifier for this picker session.
   */
  sessionId: string;
  /**
   * Timeout value used for this session.
   */
  timeoutMs: number;
  /**
   * True if the user cancelled the selection.
   */
  cancelled?: boolean;
  /**
   * True if the selection timed out.
   */
  timedOut?: boolean;
  /**
   * List of request IDs that were not selected (for debugging).
   */
  missingRequestIds?: string[];
  /**
   * Results for each requested element.
   */
  results: ElementPickerResultItem[];
}
