import { WebSocketServer } from 'ws';
import { MAX_CLIENT_BACKLOG_BYTES, MISSED_HEARTBEATS_BEFORE_TERMINATE } from './config.js';

const OPEN = 1;

/**
 * Owns every connected WebSocket. Three things here are easy to leave out and
 * painful to leave out:
 *
 *  - a new client is sent the current board immediately, so it renders on connect
 *    instead of staring at a spinner until the next poll;
 *  - every socket gets an `error` listener, because an unhandled `error` event on
 *    a Node EventEmitter is rethrown and takes the process down;
 *  - dead sockets are found by heartbeat and slow ones are dropped on backlog, so
 *    neither can accumulate.
 */
export function createHub({ market, heartbeatIntervalMs, providerName, logger = console }) {
  const clients = new Map();
  let framesSent = 0;
  let clientsDropped = 0;
  let heartbeat = null;

  function snapshotFrame() {
    return JSON.stringify({
      type: 'snapshot',
      sequence: market.sequence,
      provider: providerName(),
      quotes: market.quotes(),
      history: market.series(),
    });
  }

  function deliver(socket, payload) {
    if (socket.readyState !== OPEN) return;
    if (socket.bufferedAmount > MAX_CLIENT_BACKLOG_BYTES) {
      // The client is not draining. Dropping it is kinder than growing the
      // buffer until the process runs out of memory.
      clientsDropped += 1;
      logger.warn('dropping client with %d bytes buffered', socket.bufferedAmount);
      socket.terminate();
      return;
    }
    socket.send(payload);
    framesSent += 1;
  }

  return {
    attach(server) {
      const wss = new WebSocketServer({ server, path: '/stream' });

      wss.on('connection', (socket) => {
        clients.set(socket, { missedBeats: 0 });
        socket.on('error', (err) => logger.warn('client socket error: %s', err.message));
        socket.on('pong', () => {
          const state = clients.get(socket);
          if (state) state.missedBeats = 0;
        });
        socket.on('close', () => clients.delete(socket));
        if (!market.isEmpty) deliver(socket, snapshotFrame());
      });

      wss.on('error', (err) => logger.error('websocket server error: %s', err.message));

      heartbeat = setInterval(() => {
        for (const [socket, state] of clients) {
          if (state.missedBeats >= MISSED_HEARTBEATS_BEFORE_TERMINATE) {
            clients.delete(socket);
            socket.terminate();
            continue;
          }
          state.missedBeats += 1;
          socket.ping();
        }
      }, heartbeatIntervalMs);
      heartbeat.unref?.();

      return wss;
    },

    /** One frame per poll carrying every symbol, not one frame per symbol. */
    broadcast(quotes, sequence) {
      const payload = JSON.stringify({ type: 'tick', sequence, quotes });
      for (const socket of clients.keys()) deliver(socket, payload);
    },

    stats() {
      return { clients: clients.size, framesSent, clientsDropped };
    },

    close() {
      if (heartbeat) clearInterval(heartbeat);
      heartbeat = null;
      for (const socket of clients.keys()) socket.terminate();
      clients.clear();
    },
  };
}
