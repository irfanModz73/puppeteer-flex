const http = require('http');

const DEVTOOLS_FRONTEND_URL =
  'https://chrome-devtools-frontend.appspot.com/serve_rev/@latest/inspector.html';

class DevtoolsUIServer {
  constructor(options = {}) {
    this.port = options.port || 0;
    this.host = options.host || '127.0.0.1';
    this.wsProxyUrl = options.wsProxyUrl || null;
    this.targets = [];
    this.server = null;
    this.url = null;
  }

  async start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => this._handle(req, res));
      this.server.on('error', reject);
      this.server.listen(this.port, this.host, () => {
        const addr = this.server.address();
        this.port = addr.port;
        this.url = `http://${this.host}:${this.port}`;
        resolve(this.url);
      });
    });
  }

  _handle(req, res) {
    const url = new URL(req.url, `http://${this.host}:${this.port}`);
    if (url.pathname === '/json/version') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          Browser: 'Chrome/131.0.0.0',
          'Protocol-Version': '1.3',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          webSocketDebuggerUrl: this.wsProxyUrl || '',
        })
      );
      return;
    }
    if (url.pathname === '/json' || url.pathname === '/json/list') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          this.targets.map((t) => ({
            id: t.id,
            type: 'page',
            title: t.title || 'Page',
            url: t.url || 'about:blank',
            webSocketDebuggerUrl: t.wsUrl || '',
          }))
        )
      );
      return;
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(this._render());
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
  }

  _render() {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Puppeteer-Flex DevTools</title>
<style>
html,body{margin:0;padding:0;background:#202124;color:#e8eaed;font-family:system-ui,sans-serif}
.header{padding:14px 20px;background:#292a2d;border-bottom:1px solid #3c4043}
.header h1{margin:0 0 4px;font-size:16px}
.header p{margin:0;font-size:12px;color:#9aa0a6}
.header code{background:#1a1a1a;padding:2px 6px;border-radius:4px;color:#7fba7f;font-family:monospace;font-size:11px}
.targets{padding:20px}
.target{padding:12px 16px;background:#292a2d;border-radius:8px;margin-bottom:8px}
.target-title{font-size:14px;margin-bottom:4px}
.target-url{font-size:12px;color:#9aa0a6;word-break:break-all}
.target-ws{font-size:11px;color:#5f6368;margin-top:6px;font-family:monospace}
.empty{color:#9aa0a6;text-align:center;padding:40px}
.actions{display:flex;gap:8px;margin-top:10px}
button{background:#8ab4f8;color:#202124;border:none;padding:6px 12px;border-radius:4px;font-size:12px;cursor:pointer;font-weight:500}
button:hover{background:#aecbfa}
button.secondary{background:#3c4043;color:#e8eaed}
button.secondary:hover{background:#5f6368}
pre{background:#1a1a1a;padding:12px;border-radius:6px;font-size:12px;overflow:auto;max-height:400px;color:#a8c7fa}
</style></head><body>
<div class="header"><h1>Puppeteer-Flex DevTools</h1>
<p>Targets: <span id="count">0</span> • WS Proxy: <code id="wsUrl">${this.wsProxyUrl || 'n/a'}</code></p></div>
<div class="targets" id="targets"><div class="empty">Loading...</div></div>
<script>
async function load(){
try{const r=await fetch('/json');const ts=await r.json();
document.getElementById('count').textContent=ts.length;
const c=document.getElementById('targets');
if(ts.length===0){c.innerHTML='<div class="empty">No targets</div>';return}
c.innerHTML=ts.map(t=>\`<div class="target">
<div class="target-title">\${esc(t.title)}</div>
<div class="target-url">\${esc(t.url)}</div>
<div class="target-ws">\${esc(t.webSocketDebuggerUrl)}</div>
<div class="actions"><button onclick="open('\${t.webSocketDebuggerUrl}')">Open DevTools</button>
<button class="secondary" onclick="ping('\${t.webSocketDebuggerUrl}','\${t.id}')">Ping CDP</button></div>
<pre id="ping-\${t.id}" style="display:none"></pre></div>\`).join('')
}catch(e){document.getElementById('targets').innerHTML='<div class="empty">Error: '+e.message+'</div>'}}
function esc(s){if(!s)return'';return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
function open(ws){window.open('${DEVTOOLS_FRONTEND_URL}?ws='+encodeURIComponent(ws),'_blank')}
async function ping(ws,id){const p=document.getElementById('ping-'+id);p.style.display='block';
try{const s=new WebSocket(ws);let d=false;s.onopen=()=>s.send(JSON.stringify({id:1,method:'Browser.getVersion'}));
s.onmessage=e=>{if(d)return;d=true;p.textContent='Response:\\n'+JSON.stringify(JSON.parse(e.data),null,2);s.close()};
s.onerror=()=>{p.textContent='Error'};
setTimeout(()=>{if(!d){d=true;p.textContent='Timeout';try{s.close()}catch(_){}}},5000)
}catch(e){p.textContent='Error: '+e.message}}
load();setInterval(load,3000);
</script></body></html>`;
  }

  setTargets(t) {
    this.targets = t;
  }

  async stop() {
    if (this.server) {
      await new Promise((r) => this.server.close(() => r()));
      this.server = null;
    }
  }
}

module.exports = DevtoolsUIServer;