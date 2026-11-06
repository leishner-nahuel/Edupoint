const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const ROOT = __dirname;
const EVIDENCE_DIR = path.join(ROOT, 'evidencias');
const PORT = Number(process.env.PORT) || 4173;
const MAX_BODY = 10 * 1024 * 1024;
const SESSION_TTL = 30 * 60 * 1000;
const sessions = new Map();

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

function getAddresses() {
  const found = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const item of list || []) {
      if (item.family === 'IPv4' && !item.internal) found.push(item.address);
    }
  }
  return [...new Set(found)];
}
function preferredAddress() {
  const addresses = getAddresses();
  return addresses.find(ip => /^192\.168\./.test(ip) || /^10\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) || addresses[0] || '127.0.0.1';
}
function send(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(data));
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY) {
        reject(Object.assign(new Error('La foto supera el tamaño permitido.'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(Object.assign(new Error('La solicitud no contiene datos válidos.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
function mimeFor(file) {
  return ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' })[path.extname(file).toLowerCase()] || 'application/octet-stream';
}
function serveFile(req, res, requestedPath) {
  const safePath = path.normalize(requestedPath).replace(/^([.][.][/\\])+/, '');
  const file = path.join(ROOT, safePath);
  if (!file.startsWith(ROOT + path.sep) && file !== path.join(ROOT, 'index.html')) {
    res.writeHead(403); return res.end('Prohibido');
  }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': mimeFor(file), 'Cache-Control': file.endsWith('.html') ? 'no-store' : 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  });
}
function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) sessions.delete(token);
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (req.method === 'GET' && pathname === '/api/info') {
      return send(res, 200, { port: PORT, addresses: getAddresses(), preferredAddress: preferredAddress() });
    }

    if (req.method === 'POST' && pathname === '/api/sessions') {
      cleanupSessions();
      const body = await readJson(req);
      if (!body.missionId || !body.title || !Number.isFinite(Number(body.points))) return send(res, 400, { error: 'Faltan datos de la misión.' });
      const token = crypto.randomBytes(18).toString('hex');
      const session = { token, missionId: String(body.missionId), title: String(body.title).slice(0, 140), points: Number(body.points), status: 'waiting', createdAt: Date.now(), evidenceUrl: null };
      sessions.set(token, session);
      const mobileUrl = `http://${preferredAddress()}:${PORT}/mobile.html?token=${token}`;
      return send(res, 201, { token, mobileUrl, expiresInMinutes: 30 });
    }

    const sessionMatch = pathname.match(/^\/api\/sessions\/([a-f0-9]{36})$/);
    if (sessionMatch && req.method === 'GET') {
      cleanupSessions();
      const session = sessions.get(sessionMatch[1]);
      if (!session) return send(res, 404, { error: 'El QR venció o la sesión ya no existe.' });
      return send(res, 200, { missionId: session.missionId, title: session.title, points: session.points, status: session.status, evidenceUrl: session.evidenceUrl });
    }

    const uploadMatch = pathname.match(/^\/api\/sessions\/([a-f0-9]{36})\/photo$/);
    if (uploadMatch && req.method === 'POST') {
      cleanupSessions();
      const session = sessions.get(uploadMatch[1]);
      if (!session) return send(res, 404, { error: 'El QR venció. Volvé a generar uno desde la computadora.' });
      if (session.status === 'uploaded') return send(res, 409, { error: 'Esta misión ya recibió una foto.' });
      const body = await readJson(req);
      const match = String(body.imageData || '').match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
      if (!match) return send(res, 400, { error: 'No se pudo leer la foto. Probá con JPG, PNG o WebP.' });
      const image = Buffer.from(match[2], 'base64');
      if (!image.length || image.length > 7 * 1024 * 1024) return send(res, 413, { error: 'La foto es demasiado grande. Volvé a tomarla con menor resolución.' });
      const extension = match[1] === 'jpeg' ? 'jpg' : match[1];
      const filename = `${session.token}.${extension}`;
      fs.writeFileSync(path.join(EVIDENCE_DIR, filename), image);
      session.status = 'uploaded';
      session.evidenceUrl = `/evidencias/${filename}`;
      session.uploadedAt = Date.now();
      return send(res, 200, { ok: true, status: session.status });
    }

    if (pathname.startsWith('/evidencias/')) {
      const name = path.basename(pathname);
      if (!/^[a-f0-9]{36}\.(jpg|png|webp)$/.test(name)) { res.writeHead(404); return res.end('No encontrado'); }
      return serveFile(req, res, `evidencias/${name}`);
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
      return serveFile(req, res, requested);
    }
    return send(res, 404, { error: 'Ruta no encontrada.' });
  } catch (error) {
    console.error(error);
    if (!res.headersSent) send(res, error.status || 500, { error: error.message || 'Error interno del servidor.' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('\n==============================================');
  console.log('  EDUPOINT · SERVIDOR DE FOTOS');
  console.log('==============================================');
  console.log(`En esta computadora: http://localhost:${PORT}`);
  console.log(`En el celular (misma Wi-Fi): http://${preferredAddress()}:${PORT}`);
  if (getAddresses().length > 1) console.log(`Otras direcciones de red: ${getAddresses().join(', ')}`);
  console.log('\nDejá esta ventana abierta mientras usás los QR.');
  console.log('Para cerrar el servidor, presioná Ctrl + C.\n');
});
