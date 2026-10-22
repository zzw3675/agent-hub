// agent-hub: tiny data exchange space for AI agents.
// Auth: header "Authorization: Bearer <API_KEY>" or "X-API-Key: <API_KEY>"
// Storage: KV namespace bound as HUB. Keys prefixed kv: / file:
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    if (path === '/' && req.method === 'GET') {
      return json({ service: 'agent-hub', auth: 'Authorization: Bearer <API_KEY>', endpoints: {
        'PUT /kv/<key>': 'store text/JSON (body)', 'GET /kv/<key>': 'read value', 'DELETE /kv/<key>': 'delete',
        'GET /kv': 'list keys', 'PUT /files/<name>': 'upload file (raw body)', 'GET /files/<name>': 'download file',
        'DELETE /files/<name>': 'delete file', 'GET /files': 'list files' } });
    }
    const presented = ((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '') || req.headers.get('X-API-Key') || '').trim();
    const valid = (env.API_KEYS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (!presented || !valid.includes(presented)) return json({ error: 'unauthorized' }, 401);
    try {
      if (path.startsWith('/kv/')) {
        const k = 'kv:' + decodeURIComponent(path.slice(4));
        if (req.method === 'PUT' || req.method === 'POST') { const body = await req.text(); await env.HUB.put(k, body); return json({ ok: true, key: k.slice(3), bytes: body.length }); }
        if (req.method === 'GET') { const v = await env.HUB.get(k); if (v === null) return json({ error: 'not found' }, 404); return new Response(v, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }); }
        if (req.method === 'DELETE') { await env.HUB.delete(k); return json({ ok: true }); }
      }
      if (path === '/kv' && req.method === 'GET') { const list = await env.HUB.list({ prefix: 'kv:', limit: 1000 }); return json({ keys: list.keys.map(x => x.name.slice(3)) }); }
      if (path.startsWith('/files/')) {
        const k = 'file:' + decodeURIComponent(path.slice(7));
        if (req.method === 'PUT' || req.method === 'POST') { const buf = await req.arrayBuffer(); await env.HUB.put(k, buf); return json({ ok: true, name: k.slice(5), bytes: buf.byteLength }); }
        if (req.method === 'GET') { const v = await env.HUB.get(k, 'arrayBuffer'); if (v === null) return json({ error: 'not found' }, 404); return new Response(v, { headers: { 'Content-Type': 'application/octet-stream' } }); }
        if (req.method === 'DELETE') { await env.HUB.delete(k); return json({ ok: true }); }
      }
      if (path === '/files' && req.method === 'GET') { const list = await env.HUB.list({ prefix: 'file:', limit: 1000 }); return json({ files: list.keys.map(x => x.name.slice(5)) }); }
      return json({ error: 'not found' }, 404);
    } catch (e) { return json({ error: String(e) }, 500); }
  }
};
