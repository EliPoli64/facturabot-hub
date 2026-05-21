const CACHE_TTL = 60 * 60 * 1000;
let cachedRate: { rate: number; timestamp: number } | null = null;

export async function getExchangeRate(): Promise<number> {
  if (cachedRate && Date.now() - cachedRate.timestamp < CACHE_TTL) {
    return cachedRate.rate;
  }
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    const rate = data.rates?.CRC ?? 515.0;
    cachedRate = { rate, timestamp: Date.now() };
    return rate;
  } catch {
    return 515.0;
  }
}
