/**
 * Input Sanitization Middleware
 * Membersihkan karakter berbahaya (null bytes, strip injection fragments) pada req.body & req.query
 * Sesuai Master Security Rules SIPeKa: Rule 3 (Injection-Proof Queries & Input Sanitization)
 */

const sanitizeValue = (val) => {
  if (typeof val === 'string') {
    // 1. Hapus null byte character yang umum dipakai dalam null-byte injection
    let clean = val.replace(/\0/g, '');
    // 2. Trim spasi di awal/akhir
    clean = clean.trim();
    return clean;
  }

  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }

  if (val !== null && typeof val === 'object') {
    const sanitizedObj = {};
    for (const [k, v] of Object.entries(val)) {
      // Cegah prototype pollution
      if (k === '__proto__' || k === 'constructor' || k === 'prototype') {
        continue;
      }
      sanitizedObj[k] = sanitizeValue(v);
    }
    return sanitizedObj;
  }

  return val;
};

const sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeValue(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeValue(req.query);
  }
  next();
};

module.exports = sanitizeInput;
