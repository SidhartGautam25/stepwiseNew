import { describe, it, expect } from 'vitest';
import { CorrelationIdMiddleware, CORRELATION_ID_HEADER } from './middleware/correlation-id.middleware.js';

describe('CorrelationIdMiddleware', () => {
  const middleware = new CorrelationIdMiddleware();

  it('generates a new correlation ID if none is supplied', () => {
    const req: any = { headers: {} };
    const res: any = {
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
    };
    let called = false;

    middleware.use(req, res, () => {
      called = true;
    });

    expect(called).toBe(true);
    expect(req.headers[CORRELATION_ID_HEADER]).toBeDefined();
    expect(res.headers[CORRELATION_ID_HEADER]).toBe(req.headers[CORRELATION_ID_HEADER]);
  });

  it('preserves an existing correlation ID if supplied', () => {
    const req: any = { headers: { [CORRELATION_ID_HEADER]: 'existing-corr-id-1234' } };
    const res: any = {
      headers: {},
      setHeader(name: string, value: string) {
        this.headers[name] = value;
      },
    };

    middleware.use(req, res, () => {});

    expect(req.headers[CORRELATION_ID_HEADER]).toBe('existing-corr-id-1234');
    expect(res.headers[CORRELATION_ID_HEADER]).toBe('existing-corr-id-1234');
  });
});
