import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';

function blocked() {
  throw new Error('OFFLINE_TEST: network access is forbidden.');
}

globalThis.fetch = blocked;
globalThis.WebSocket = blocked;
http.request = http.get = https.request = https.get = blocked;
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const target = args[0];
  // tsx uses Unix-domain IPC; TCP connections remain prohibited.
  if ((typeof target === 'object' && target?.path) || (typeof target === 'string' && target.startsWith('/'))) {
    return connect.apply(this, args);
  }
  return blocked();
};
syncBuiltinESMExports();
