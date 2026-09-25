const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User } = require('../models');

/**
 * Registrasi pengguna mandiri (pembeli & penitip)
 */
const register = async (req, res) => {
  try {
    const { nisn_nip, name, password, role } = req.body;

    if (!nisn_nip || !name || !password || !role) {
      return res.status(400).json({
        status: 'error',
        message: 'Field nisn_nip, name, password, dan role wajib diisi.',
        data: null
      });
    }

    const normalizedRole = role.toLowerCase();

    // Tolak jika request role kasir atau admin
    if (normalizedRole === 'kasir' || normalizedRole === 'admin') {
      return res.status(400).json({
        status: 'error',
        message: "Pendaftaran mandiri untuk role 'kasir' atau 'admin' tidak diperbolehkan. Akun internal harus dibuat oleh Administrator.",
        data: null
      });
    }

    // Hanya pembeli dan penitip yang diizinkan untuk registrasi mandiri
    if (normalizedRole !== 'pembeli' && normalizedRole !== 'penitip') {
      return res.status(400).json({
        status: 'error',
        message: "Role yang valid untuk pendaftaran mandiri hanyalah 'pembeli' atau 'penitip'.",
        data: null
      });
    }

    // Cek apakah NISN/NIP sudah terdaftar
    const existingUser = await User.findOne({ where: { nisn_nip } });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: `Pengguna dengan NISN/NIP '${nisn_nip}' sudah terdaftar.`,
        data: null
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Aturan status keaktifan: pembeli = true, penitip = false
    const is_active = (normalizedRole === 'pembeli');

    const newUser = await User.create({
      nisn_nip,
      name,
      password_hash,
      role: normalizedRole,
      is_active
    });

    const message = normalizedRole === 'penitip'
      ? 'Registrasi akun penitip berhasil. Akun Anda menunggu persetujuan (approval) dari Administrator sebelum dapat digunakan.'
      : 'Registrasi akun pembeli berhasil.';

    return res.status(201).json({
      status: 'success',
      message,
      data: {
        id: newUser.id,
        nisn_nip: newUser.nisn_nip,
        name: newUser.name,
        role: newUser.role,
        is_active: newUser.is_active
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat memproses registrasi: ' + error.message,
      data: null
    });
  }
};

/**
 * Login pengguna
 */
const login = async (req, res) => {
  try {
    const { nisn_nip, password } = req.body;

    if (!nisn_nip || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'NISN/NIP dan password wajib diisi.',
        data: null
      });
    }

    // Cari user berdasarkan NISN/NIP
    const user = await User.findOne({ where: { nisn_nip } });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'NISN/NIP atau kata sandi tidak valid.',
        data: null
      });
    }

    // Verifikasi kata sandi dengan bcrypt
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'NISN/NIP atau kata sandi tidak valid.',
        data: null
      });
    }

    // Cek keaktifan akun: jika is_active=false, tolak dengan 403
    if (!user.is_active) {
      return res.status(403).json({
        status: 'error',
        message: 'Akun Anda belum aktif atau menunggu persetujuan dari Administrator.',
        data: null
      });
    }

    // Buat JWT Token
    const secret = process.env.JWT_SECRET || 'supersecret_jwt_key_sipeka_2026_production';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';

    const token = jwt.sign(
      {
        id: user.id,
        nisn_nip: user.nisn_nip,
        role: user.role,
        name: user.name
      },
      secret,
      { expiresIn }
    );

    return res.status(200).json({
      status: 'success',
      message: 'Login berhasil.',
      data: {
        token,
        user: {
          id: user.id,
          nisn_nip: user.nisn_nip,
          name: user.name,
          role: user.role,
          is_active: user.is_active
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat memproses login: ' + error.message,
      data: null
    });
  }
};

/**
 * Mendapatkan info profil akun saat ini yang sedang login
 */
const getMe = async (req, res) => {
  try {
    return res.status(200).json({
      status: 'success',
      message: 'Data profil berhasil diambil.',
      data: {
        id: req.user.id,
        nisn_nip: req.user.nisn_nip,
        name: req.user.name,
        role: req.user.role,
        is_active: req.user.is_active
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data profil: ' + error.message,
      data: null
    });
  }
};

module.exports = {
  register,
  login,
  getMe
};
