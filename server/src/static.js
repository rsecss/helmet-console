import sirv from 'sirv';

function sendJson(res, statusCode, body) {
  const payload = JSON.stringify(body);

  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(payload);
}

export function createStaticHandler({ staticDir, getClientCount }) {
  const serve = sirv(staticDir, {
    dev: process.env.NODE_ENV !== 'production',
    etag: true,
    extensions: ['html'],
  });

  return function handleRequest(req, res) {
    const url = new URL(req.url, 'http://localhost');

    if (req.method === 'GET' && url.pathname === '/healthz') {
      sendJson(res, 200, {
        status: 'ok',
        uptime: Math.floor(process.uptime()),
        clients: getClientCount(),
      });
      return;
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendJson(res, 405, { status: 'error', message: 'Method not allowed' });
      return;
    }

    serve(req, res, () => {
      sendJson(res, 404, { status: 'error', message: 'Not found' });
    });
  };
}
