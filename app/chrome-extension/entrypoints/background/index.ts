/**
 * Background service worker entry point.
 *
 * The extension has exactly one job: keep a WebSocket to the remote relay and
 * execute browser tool calls that arrive over it. There is no local bridge and
 * no onboarding flow, so nothing else is initialised here.
 */

import { initRemoteRelay, initRemoteRelayListener, isRelayEnabled } from './remote-relay';

export default defineBackground(() => {
  initRemoteRelayListener();

  isRelayEnabled()
    .then((enabled) => {
      if (!enabled) return;
      return initRemoteRelay().catch((error) => {
        console.warn('Background: Failed to initialize remote relay:', error);
      });
    })
    .catch(() => {});
});
