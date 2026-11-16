import { RelayMessageType, RelayConnectionState, TOOL_SCHEMAS } from 'browser-relay-shared';
import type { RelayConfig, RelayCallToolPayload } from 'browser-relay-shared';
import { RELAY_MESSAGE_TYPES } from '@/common/message-types';
import { selectAdvertisedTools } from '@/common/tool-catalogue';
import { handleCallTool, registeredToolNames } from './tools';
import { acquireKeepalive } from './keepalive-manager';

const LOG_PREFIX = '[RemoteRelay]';
const RECONNECT_BASE_DELAY_MS = 1000;
const RECONNECT_MAX_DELAY_MS = 30000;
const PING_INTERVAL_MS = 30000;

let ws: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectAttempts = 0;
let currentState = RelayConnectionState.DISCONNECTED;
let keepaliveRelease: (() => void) | null = null;
let configLoaded = false;
let currentConfig: RelayConfig | null = null;
let authenticatedLogin = '';
let lastError: string | null = null;

const ADVERTISED_TOOLS = selectAdvertisedTools(TOOL_SCHEMAS as any[], registeredToolNames);

const RELAY_CONFIG_STORAGE_KEY = 'remoteRelayConfig';
const RELAY_CONNECTION_STATE_KEY = 'remoteRelayState';

// ==================== Config Management ====================

async function loadConfig(): Promise<RelayConfig | null> {
  try {
    const result = await chrome.storage.local.get([RELAY_CONFIG_STORAGE_KEY]);
    const config = result[RELAY_CONFIG_STORAGE_KEY] as RelayConfig | undefined;
    if (config && config.url && config.token && config.enabled !== false) {
      currentConfig = config;
      configLoaded = true;
      return config;
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to load relay config`, error);
  }
  currentConfig = null;
  configLoaded = true;
  return null;
}

async function saveConfig(config: RelayConfig): Promise<void> {
  currentConfig = config;
  try {
    await chrome.storage.local.set({ [RELAY_CONFIG_STORAGE_KEY]: config });
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to save relay config`, error);
  }
}

// ==================== State Management ====================

function setState(state: RelayConnectionState): void {
  currentState = state;
  chrome.storage.local.set({ [RELAY_CONNECTION_STATE_KEY]: state }).catch(() => {});
  broadcastStateChange();
}

export interface RelaySnapshot {
  state: RelayConnectionState;
  config: RelayConfig | null;
  login: string;
  lastError: string | null;
  toolCount: number;
}

export function getRelaySnapshot(): RelaySnapshot {
  return {
    state: currentState,
    config: currentConfig,
    login: authenticatedLogin,
    lastError,
    toolCount: ADVERTISED_TOOLS.length,
  };
}

function broadcastStateChange(): void {
  chrome.runtime
    .sendMessage({ type: RELAY_MESSAGE_TYPES.STATE_CHANGED, payload: getRelaySnapshot() })
    .catch(() => {});
}

// ==================== Keepalive ====================

function syncKeepalive(): void {
  const shouldHold =
    currentState === RelayConnectionState.CONNECTED ||
    currentState === RelayConnectionState.CONNECTING ||
    currentState === RelayConnectionState.AUTHENTICATING ||
    currentState === RelayConnectionState.RECONNECTING;

  if (shouldHold && !keepaliveRelease) {
    keepaliveRelease = acquireKeepalive('remote-relay');
  } else if (!shouldHold && keepaliveRelease) {
    try {
      keepaliveRelease();
    } catch {}
    keepaliveRelease = null;
  }
}

// ==================== WebSocket Connection ====================

function connect(): void {
  const config = currentConfig;
  if (!config || !config.url || !config.token) return;

  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  clearReconnectTimer();
  setState(RelayConnectionState.CONNECTING);
  syncKeepalive();

  let url = config.url;
  if (!url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = url.replace(/^https?:\/\//, '');
    url = `wss://${url}/ws`;
  }
  if (!url.endsWith('/ws')) {
    if (!url.endsWith('/')) url += '/';
    url += 'ws';
  }

  try {
    console.log(`${LOG_PREFIX} Connecting to ${url}...`);
    ws = new WebSocket(url);
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to create WebSocket:`, error);
    setState(RelayConnectionState.ERROR);
    syncKeepalive();
    scheduleReconnect('connect_error');
    return;
  }

  ws.onopen = () => {
    console.log(`${LOG_PREFIX} WebSocket connected to ${url}, authenticating...`);
    setState(RelayConnectionState.AUTHENTICATING);
    syncKeepalive();

    const authPayload = {
      login: '',
      token: config.token,
    };
    ws!.send(
      JSON.stringify({
        type: RelayMessageType.AUTH,
        payload: authPayload,
      }),
    );
  };

  ws.onmessage = (event: MessageEvent) => {
    let message: any;
    try {
      message = JSON.parse(event.data as string);
    } catch {
      console.warn(`${LOG_PREFIX} Invalid message received`);
      return;
    }
    handleMessage(message);
  };

  ws.onclose = (event: CloseEvent) => {
    console.log(
      `${LOG_PREFIX} WebSocket closed: code=${event.code}, reason=${event.reason}, wasClean=${event.wasClean}`,
    );
    authenticatedLogin = '';
    if (event.code !== 1000 && event.reason) lastError = event.reason;
    cleanupConnection();
    if (
      currentState === RelayConnectionState.CONNECTED ||
      currentState === RelayConnectionState.AUTHENTICATING ||
      currentState === RelayConnectionState.CONNECTING
    ) {
      scheduleReconnect(`closed_${event.code}`);
    }
  };

  ws.onerror = (event: Event) => {
    console.error(`${LOG_PREFIX} WebSocket error for ${url}`, event);
    lastError = `Cannot connect to ${url}`;
    cleanupConnection();
    setState(RelayConnectionState.ERROR);
    syncKeepalive();
    scheduleReconnect('error');
  };
}

function handleMessage(message: any): void {
  const msgType = message.type;

  if (msgType === RelayMessageType.AUTH_OK) {
    console.log(`${LOG_PREFIX} Authenticated successfully`);
    authenticatedLogin = message.payload?.login || '';
    lastError = null;
    reconnectAttempts = 0;
    clearReconnectTimer();
    setState(RelayConnectionState.CONNECTED);
    syncKeepalive();
    startPing();
    return;
  }

  if (msgType === RelayMessageType.AUTH_ERROR) {
    console.error(`${LOG_PREFIX} Auth failed: ${message.error}`);
    lastError = message.error || 'Authentication failed';
    authenticatedLogin = '';
    setState(RelayConnectionState.ERROR);
    syncKeepalive();
    if (ws) {
      try {
        ws.close(4003, message.error);
      } catch {}
    }
    return;
  }

  if (msgType === RelayMessageType.PONG) {
    return;
  }

  if (msgType === RelayMessageType.PING) {
    sendMessage({ type: RelayMessageType.PONG });
    return;
  }

  // Handle tool calls from relay
  if (msgType === RelayMessageType.CALL_TOOL && message.requestId) {
    const requestId = message.requestId;
    const payload = message.payload as RelayCallToolPayload;
    handleCallTool({ name: payload.name, args: payload.args })
      .then((result) => {
        sendMessage({
          type: RelayMessageType.TOOL_RESULT,
          responseToRequestId: requestId,
          payload: { status: 'success', data: result },
        });
      })
      .catch((error) => {
        sendMessage({
          type: RelayMessageType.TOOL_RESULT,
          responseToRequestId: requestId,
          payload: {
            status: 'error',
            message: error instanceof Error ? error.message : String(error),
          },
        });
      });
    return;
  }

  // Handle list tools from relay
  if (msgType === RelayMessageType.LIST_TOOLS && message.requestId) {
    const requestId = message.requestId;
    const tools = ADVERTISED_TOOLS;
    sendMessage({
      type: RelayMessageType.TOOLS_LIST,
      responseToRequestId: requestId,
      payload: { tools },
    });
    return;
  }

  // Handle process data from relay
  if (msgType === RelayMessageType.PROCESS_DATA && message.requestId) {
    const requestId = message.requestId;
    // For now, just echo back success
    sendMessage({
      type: RelayMessageType.PROCESS_RESULT,
      responseToRequestId: requestId,
      payload: { status: 'success', message: 'processed' },
    });
    return;
  }
}

function cleanupConnection(): void {
  stopPing();
  if (ws) {
    try {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
    } catch {}
    ws = null;
  }
}

function sendMessage(message: Record<string, unknown>): void {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(message));
  } catch (error) {
    console.warn(`${LOG_PREFIX} Failed to send message`, error);
  }
}

// ==================== Ping/Pong ====================

function startPing(): void {
  stopPing();
  pingTimer = setInterval(() => {
    sendMessage({ type: RelayMessageType.PING });
  }, PING_INTERVAL_MS);
}

function stopPing(): void {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

// ==================== Reconnect ====================

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function withJitter(ms: number): number {
  const ratio = 0.7 + Math.random() * 0.6;
  return Math.round(ms * ratio);
}

function scheduleReconnect(reason: string): void {
  if (reconnectTimer) return;

  const delay = Math.min(
    RECONNECT_BASE_DELAY_MS * Math.pow(2, reconnectAttempts),
    RECONNECT_MAX_DELAY_MS,
  );
  const jittered = withJitter(delay);
  console.debug(
    `${LOG_PREFIX} Reconnect in ${jittered}ms (attempt=${reconnectAttempts}, reason=${reason})`,
  );

  setState(RelayConnectionState.RECONNECTING);
  syncKeepalive();

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempts += 1;
    connect();
  }, jittered);
}

// ==================== Public API ====================

export async function initRemoteRelay(): Promise<void> {
  const config = await loadConfig();
  if (config && config.enabled !== false) {
    console.log(`${LOG_PREFIX} Auto-connecting to ${config.url}`);
    connect();
  }
}

export async function connectRelay(url: string, token: string): Promise<void> {
  lastError = null;
  const config: RelayConfig = { url, login: '', token, enabled: true };
  await saveConfig(config);
  disconnectRelay();
  reconnectAttempts = 0;
  connect();
}

export function disconnectRelay(): void {
  clearReconnectTimer();
  cleanupConnection();
  setState(RelayConnectionState.DISCONNECTED);
  syncKeepalive();
}

export async function getRelayConfig(): Promise<RelayConfig | null> {
  return loadConfig();
}

export function getRelayState(): RelayConnectionState {
  return currentState;
}

export async function isRelayEnabled(): Promise<boolean> {
  const config = await loadConfig();
  return !!(config && config.enabled !== false);
}

// ==================== Message Listener ====================

export function initRemoteRelayListener(): void {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === RELAY_MESSAGE_TYPES.CONNECT && message.url && message.token) {
      connectRelay(message.url, message.token)
        .then(() => sendResponse({ success: true, state: currentState }))
        .catch((e) => sendResponse({ success: false, error: String(e) }));
      return true;
    }

    if (message && message.type === RELAY_MESSAGE_TYPES.DISCONNECT) {
      disconnectRelay();
      sendResponse({ success: true });
      return true;
    }

    if (message && message.type === RELAY_MESSAGE_TYPES.GET_STATE) {
      sendResponse(getRelaySnapshot());
      return true;
    }
  });

  chrome.runtime.onStartup.addListener(() => {
    initRemoteRelay().catch(() => {});
  });

  chrome.runtime.onInstalled.addListener(() => {
    initRemoteRelay().catch(() => {});
  });
}
