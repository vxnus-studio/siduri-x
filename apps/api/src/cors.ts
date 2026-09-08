import cors from 'cors';

export function getAllowedOrigins(): Set<string> {
  const allowed = new Set<string>([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ]);

  if (process.env.PORT) {
    allowed.add(`http://localhost:${process.env.PORT}`);
    allowed.add(`http://127.0.0.1:${process.env.PORT}`);
  }

  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    for (const origin of envOrigins.split(',')) {
      const trimmed = origin.trim();
      if (trimmed) {
        allowed.add(trimmed);
      }
    }
  }

  return allowed;
}

export function createCorsOptions(): cors.CorsOptions {
  return {
    origin: (origin, callback) => {
      // Allow non-browser requests with no origin header (e.g., native tools, curl)
      if (!origin) {
        return callback(null, true);
      }
      const allowedOrigins = getAllowedOrigins();
      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  };
}
