const { WebSocketServer } = require('ws');

class WSProxy {
  constructor(options = {}) {
    this.port = options.port || 0;
    this.host = options.host || '127.0.0.1';
    this.sessions = new Map();
    this.server = null;
    this.url = null;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = new WebSocketServer(
        { host: this.host, port: this.port },
        () => {
          const addr = this.server.address();
          this.port = addr.port;
          this.url = `ws://${this.host}:${this.port}`;
          resolve(this.url);
        }
      );
      this.server.on('error', reject);
      this.server.on('connection', (client, req) => {
        const url = new URL(req.url, `ws://${this.host}:${this.port}`);
        const sid = url.searchParams.get('sessionId');
        const s = this.sessions.get(sid);
        if (!s) {
          try {
            client.close(1008, 'Session not found');
          } catch (_) {}
          return;
        }
        s.clients.add(client);
        client.on('message', async (data) => {
          let m = null;
          try {
            m = JSON.parse(data.toString());
          } catch (_) {
            return;
          }
          try {
            const r = await s.handler(m.method, m.params);
            if (m.id !== undefined)
              client.send(JSON.stringify({ id: m.id, result: r }));
          } catch (e) {
            if (m && m.id !== undefined) {
              try {
                client.send(
                  JSON.stringify({
                    id: m.id,
                    error: { message: e.message, code: -32000 },
                  })
                );
              } catch (_) {}
            }
          }
        });
        client.on('close', () => s.clients.delete(client));
        client.on('error', () => s.clients.delete(client));
      });
    });
  }

  register(handler) {
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.sessions.set(id, { id, handler, clients: new Set() });
    return { id, url: `${this.url}?sessionId=${id}` };
  }

  unregister(id) {
    const s = this.sessions.get(id);
    if (s) {
      for (const c of s.clients) {
        try {
          c.close();
        } catch (_) {}
      }
    }
    this.sessions.delete(id);
  }

  async stop() {
    for (const s of this.sessions.values()) {
      for (const c of s.clients) {
        try {
          c.close();
        } catch (_) {}
      }
    }
    this.sessions.clear();
    if (this.server) {
      await new Promise((r) => this.server.close(() => r()));
      this.server = null;
    }
  }
}

module.exports = WSProxy;