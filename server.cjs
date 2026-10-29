// Optional Node.js launcher. Windows users can simply use 启动游戏.cmd.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.wav': 'audio/wav' };
http.createServer((req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(p => p.startsWith('.')) || !['.html','.js','.css','.svg','.png','.json','.wav'].includes(path.extname(file))) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (error, data) => { if (error) { res.writeHead(404); return res.end('Not found'); } res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(data); });
  } catch { res.writeHead(400); res.end('Bad request'); }
}).listen(5173, '127.0.0.1', () => console.log('Lakeside V0.1: http://127.0.0.1:5173  (Ctrl+C to stop)')).on('error', error => { console.error(error.message); process.exitCode = 1; });
