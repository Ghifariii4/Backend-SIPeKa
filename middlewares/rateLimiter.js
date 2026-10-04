/**
 * Rate Limiting Middleware (In-Memory IP Bucket)
 * Mencegah serangan brute-force login & penipuan checkout ganda (Anti-Fraud)
 * Sesuai Master Security Rules SIPeKa: Rule 5 (Anti-Fraud & Rate Limiting)
 */

const createRateLimiter = (options = {}) => {
  const windowMs = options.windowMs || 60 * 1000; // default 1 menit
  const maxRequests = options.max || 30; // default 30 request
  const message = options.message || 'Terlalu banyak permintaan. Silakan tunggu beberapa saat lagi.';

  // Map penyimpanan timestamp request per IP: ip -> array of timestamps
  const ipHits = new Map();

  // Bersihkan data lama secara berkala setiap 5 menit agar memori tetap ringan
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipHits.entries()) {
      const validTimestamps = timestamps.filter(t => now - t < windowMs);
      if (validTimestamps.length === 0) {
        ipHits.delete(ip);
      } else {
        ipHits.set(ip, validTimestamps);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req, res, next) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    const timestamps = ipHits.get(clientIp) || [];
    const validTimestamps = timestamps.filter(t => now - t < windowMs);

    if (validTimestamps.length >= maxRequests) {
      return res.status(429).json({
        status: 'error',
        message,
        data: null
      });
    }

    validTimestamps.push(now);
    ipHits.set(clientIp, validTimestamps);
    next();
  };
};

// Rate limiter ketat untuk autentikasi/login: Maksimal 10 percobaan per 15 menit
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Terlalu banyak percobaan login gagal. Mohon tunggu 15 menit sebelum mencoba kembali.'
});

// Rate limiter untuk transaksi & pemesanan: Maksimal 30 pesanan per menit
const orderRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Batas frekuensi transaksi tercapai. Silakan coba kembali dalam 1 menit.'
});

module.exports = {
  createRateLimiter,
  loginRateLimiter,
  orderRateLimiter
};
