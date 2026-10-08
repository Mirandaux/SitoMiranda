const buckets = new Map();
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 10;

// Per-instance defense; shared production limits should also be set at the hosting edge.
export function guardFormRequest(request, clientAddress, now = Date.now()) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ ok: false, error: 'Origine della richiesta non valida.' }, { status: 403 });
  }
  if (!clientAddress) return null;
  for (const [key, bucket] of buckets) {
    if (bucket.reset <= now) buckets.delete(key);
  }
  let bucket = buckets.get(clientAddress);
  if (!bucket) {
    if (buckets.size >= 10000) {
      return Response.json({ ok: false, error: 'Servizio temporaneamente occupato. Riprova tra poco.' }, { status: 429 });
    }
    bucket = { count: 0, reset: now + WINDOW_MS };
    buckets.set(clientAddress, bucket);
  }
  if (++bucket.count > LIMIT) {
    return Response.json({ ok: false, error: 'Troppe richieste. Riprova tra qualche minuto.' }, {
      status: 429, headers: { 'Retry-After': String(Math.ceil((bucket.reset - now) / 1000)) },
    });
  }
  return null;
}
