import crypto from 'crypto';

// Checks that a webhook call really comes from Zammad.
// Zammad can sign every webhook (Admin > Webhooks > "HMAC SHA1 Signature Token": header X-Hub-Signature, HMAC-SHA1 of the
// raw body, normally written "sha1=<hex>") and/or send a Bearer token (Authorization: Bearer <token>).
//   WEBHOOK_SECRET        the signature token set in Zammad
//   WEBHOOK_BEARER_TOKEN  the bearer token set in Zammad
// If neither is set the endpoint stays open (so that a deployment does not break before Zammad is configured);
// the server logs a warning at start. If one of them is set, a call must pass at least one of the configured checks.
const safeEqual = (a, b) => {
    const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export function signatureValid(rawBody, header, secret) {
    if (!secret || !header || !rawBody) return false;
    const given = String(header).trim().replace(/^sha1=/i, '').toLowerCase();
    const expected = crypto.createHmac('sha1', secret).update(rawBody).digest('hex');
    return safeEqual(given, expected);
}

export function bearerValid(header, token) {
    if (!token || !header) return false;
    const m = String(header).match(/^Bearer\s+(.+)$/i);
    return !!m && safeEqual(m[1].trim(), token);
}

export function authConfigured({ secret, bearer }) { return !!(secret || bearer); }

export function webhookAllowed(req, { secret, bearer }) {
    if (!authConfigured({ secret, bearer })) return true;
    return signatureValid(req.rawBody, req.headers['x-hub-signature'], secret)
        || bearerValid(req.headers['authorization'], bearer);
}
