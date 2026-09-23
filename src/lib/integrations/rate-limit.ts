/** Limitador em memória (janela deslizante) por cliente. Suficiente para uma instância; com réplicas, mover para Redis/DB. */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= limit) { hits.set(key, recent); return { allowed: false, retryAfter: Math.ceil((windowMs - (now - recent[0])) / 1000) }; }
    recent.push(now); hits.set(key, recent);
    return { allowed: true, retryAfter: 0 };
  };
}
