const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  // The dev server proxies /api to this process, but a reviewer poking at the
  // port directly from the app origin should not hit a CORS wall.
  'access-control-allow-origin': '*',
};

function send(res, status, body) {
  res.writeHead(status, JSON_HEADERS);
  res.end(JSON.stringify(body));
}

/**
 * The sidecar's HTTP surface. Three routes, each answering one question a
 * reviewer or an orchestrator actually asks: is it up, what is it doing, and
 * what does the board look like in words.
 */
export function createRequestHandler({ market, hub, ticker, commentary, startedAt = Date.now() }) {
  return async function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method === 'OPTIONS') {
      res.writeHead(204, JSON_HEADERS);
      res.end();
      return;
    }

    switch (url.pathname) {
      case '/healthz': {
        const { lastError } = ticker.stats();
        // Healthy means "serving quotes". A degraded upstream still serves
        // quotes via the synthetic fallback, so that is 200 with a flag.
        send(res, market.isEmpty ? 503 : 200, {
          status: market.isEmpty ? 'starting' : 'ok',
          symbols: market.quotes().length,
          lastError,
        });
        return;
      }
      case '/metrics': {
        send(res, 200, {
          uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
          sequence: market.sequence,
          ...ticker.stats(),
          ...hub.stats(),
        });
        return;
      }
      case '/commentary': {
        const quotes = market.quotes();
        if (quotes.length === 0) {
          send(res, 503, { error: 'no quotes yet' });
          return;
        }
        const result = await commentary.get(quotes);
        send(res, 200, {
          text: result.text,
          provider: result.provider,
          generatedAt: new Date(result.at).toISOString(),
        });
        return;
      }
      default:
        send(res, 404, {
          error: 'not found',
          routes: ['/healthz', '/metrics', '/commentary', '/stream (websocket)'],
        });
    }
  };
}
