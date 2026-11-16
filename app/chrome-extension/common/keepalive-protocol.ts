/**
 * @fileoverview Keepalive protocol constants
 * @description Shared constants for the background <-> offscreen keepalive channel.
 */

/** Name of the keepalive port used between background and offscreen document. */
export const KEEPALIVE_PORT_NAME = 'keepalive' as const;

/** Keepalive message types. */
export type KeepaliveMessageType =
  'keepalive.ping' | 'keepalive.pong' | 'keepalive.start' | 'keepalive.stop';

/** Keepalive message envelope. */
export interface KeepaliveMessage {
  type: KeepaliveMessageType;
  timestamp: number;
}

/** Default heartbeat interval (ms): how often the offscreen document sends a ping. */
export const DEFAULT_KEEPALIVE_PING_INTERVAL_MS = 20_000;
