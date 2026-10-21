import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth.js';
import { getStockDataAccess, hashPayload } from '../services/stockDataAccess.js';

export function idempotencyMiddleware() {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const rawKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    if (!rawKey || typeof rawKey !== 'string') {
      return next();
    }

    const key = rawKey.trim();
    if (key.length < 8 || key.length > 128) {
      return res.status(400).json({
        error: 'Idempotency-Key header must be between 8 and 128 characters.',
      });
    }

    const userId = req.user ? req.user._id.toString() : 'anonymous';
    const endpoint = `${req.method} ${req.baseUrl}${req.path}`;
    const payloadHash = hashPayload(req.body);
    const dataAccess = getStockDataAccess();

    try {
      const claimResult = await dataAccess.claimIdempotencyKey({
        key,
        userId,
        endpoint,
        payloadHash,
      });

      if (!claimResult.claimed) {
        const existing = claimResult.existing;
        if (!existing) {
          return res.status(409).json({
            error: 'Idempotency conflict: key was already claimed.',
            code: 'IDEMPOTENCY_CONFLICT',
          });
        }

        if (existing.payloadHash !== payloadHash) {
          return res.status(409).json({
            error: 'Idempotency conflict: The Idempotency-Key has already been used with a different request payload.',
            code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          });
        }

        // Wait/poll briefly if concurrent request is still IN_PROGRESS
        let resolved = existing;
        if (resolved.status === 'IN_PROGRESS') {
          for (let i = 0; i < 25; i++) {
            await new Promise((r) => setTimeout(r, 80));
            const poll = await dataAccess.getIdempotencyRecord(key, userId, endpoint);
            if (poll && poll.status === 'RESOLVED') {
              resolved = poll;
              break;
            }
          }
        }

        if (resolved.status === 'IN_PROGRESS') {
          return res.status(409).json({
            error: 'A request with this Idempotency-Key is currently in progress. Please retry shortly.',
            code: 'IDEMPOTENCY_IN_PROGRESS',
          });
        }

        res.set('X-Cache-Lookup', 'HIT-IDEMPOTENT');
        return res.status(resolved.statusCode || 200).json(resolved.responseBody);
      }

      // Intercept response to resolve the claimed idempotency key upon completion
      const originalJson = res.json.bind(res);
      res.json = (body: any) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          dataAccess
            .resolveIdempotencyKey({
              key,
              userId,
              endpoint,
              statusCode: res.statusCode,
              responseBody: body,
            })
            .catch((err) => {
              console.error('[Idempotency] Failed to resolve key:', err);
            });
        }
        return originalJson(body);
      };

      next();
    } catch (err: any) {
      console.error('[Idempotency] Error reading idempotency key:', err);
      next();
    }
  };
}
