/**
 * @fileoverview Offscreen document entry point.
 * @description Hosts the work that cannot run in the MV3 service worker:
 * GIF encoding and the keepalive port that keeps the worker alive.
 */

import { MessageTarget } from '@/common/message-types';
import { handleGifMessage } from './gif-encoder';
import { initKeepalive } from './keepalive';

// Keepalive must start as early as possible so the worker is not suspended.
initKeepalive();

interface OffscreenMessage {
  target: MessageTarget | string;
  type: string;
}

type MessageResponse = {
  result?: string;
  error?: string;
  success?: boolean;
};

chrome.runtime.onMessage.addListener(
  (
    message: OffscreenMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: MessageResponse) => void,
  ) => {
    if (message.target !== MessageTarget.Offscreen) {
      return;
    }

    if (handleGifMessage(message, sendResponse)) {
      return true;
    }

    sendResponse({ error: `Unknown message type: ${message.type}` });
    return true;
  },
);
