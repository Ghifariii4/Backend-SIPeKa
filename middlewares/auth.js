const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Middleware untuk verifikasi token JWT pada Authorization header
 */
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        status: 'error',
        message: 'Akses ditolak. Token autentikasi tidak ditemukan atau format tidak sesuai (Gunakan: Bearer <token>).',
        data: null
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'supersecret_jwt_key_sipeka_2026_production';

    const decoded = jwt.verify(token, secret);

    const user = await User.findByPk(decoded.id, {
      attributes: ['id', 'nisn_nip', 'name', 'role', 'is_active']
    });

    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Pengguna yang terkait dengan token ini tidak ditemukan.',
        data: null
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'Akun Anda belum aktif atau telah dinonaktifkan oleh administrator.',
        data: null
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token telah kedaluwarsa. Silakan lakukan login ulang.',
        data: null
      });
    }

    return res.status(401).json({
      status: 'error',
      message: 'Token tidak valid.',
      data: null
    });
  }
};

/**
 * Middleware untuk memastikan pengguna memiliki role 'admin'
 */
const isAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      status: 'error',
      message: 'Akses ditolak. Endpoint ini hanya dapat diakses oleh administrator.',
      data: null
    });
  }
  next();
};

/**
 * Middleware untuk memastikan pengguna memiliki role 'kasir'
 */
const isKasir = (req, res, next) => {
  if (!req.user || req.user.role !== 'kasir') {
    return res.status(403).json({
      status: 'error',
      message: 'Akses ditolak. Endpoint ini hanya dapat diakses oleh kasir.',
      data: null
    });
  }
  next();
};

/**
 * Middleware untuk memastikan pengguna memiliki role 'kasir' atau 'admin'
 */
const isKasirOrAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'kasir' && req.user.role !== 'admin')) {
    return res.status(403).json({
      status: 'error',
      message: 'Akses ditolak. Endpoint ini hanya dapat diakses oleh kasir atau administrator.',
      data: null
    });
  }
  next();
};

module.exports = {
  verifyToken,
  isAdmin,
  isKasir,
  isKasirOrAdmin
};
