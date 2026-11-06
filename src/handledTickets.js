// Zammad sends the webhook several times for one ticket, and our own emails add articles to the same ticket.
// A ticket is handled once: it is remembered while it is being handled and for 24 hours afterwards.
// If handling fails the ticket is forgotten again, so that a later call can try again.
// (The memory is lost when the pod restarts.)
export function createHandledTickets({ ttlMs = 24 * 60 * 60 * 1000, max = 1000, now = () => Date.now() } = {}) {
    const seen = new Map();
    const prune = () => {
        const t = now();
        for (const [k, at] of seen) if (t - at > ttlMs) seen.delete(k);
        while (seen.size > max) seen.delete(seen.keys().next().value);
    };
    return {
        // true if the ticket is new (and now remembered), false if it was already handled
        claim(ticketId) {
            prune();
            const k = String(ticketId);
            if (seen.has(k)) return false;
            seen.set(k, now());
            return true;
        },
        release(ticketId) { seen.delete(String(ticketId)); },
    };
}
