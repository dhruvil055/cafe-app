import { randomUUID } from 'node:crypto';

export const requestContext = (req, res, next) => {
  const requestId = randomUUID();
  const startedAt = process.hrtime.bigint();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => {
    if (process.env.NODE_ENV === 'test') return;
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    process.stdout.write(`${JSON.stringify({
      timestamp: new Date().toISOString(),
      level: res.statusCode >= 500 ? 'error' : 'info',
      event: 'http.request',
      requestId,
      method: req.method,
      path: String(req.originalUrl || req.url).split('?')[0],
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    })}\n`);
  });
  next();
};
