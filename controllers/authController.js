const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
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
          kelas: user.kelas,
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
        kelas: req.user.kelas,
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

/**
 * Memperbarui data profil akun sendiri (atau admin mengubah akun user)
 */
const updateProfile = async (req, res) => {
  try {
    const targetUserId = req.params.id || req.body.id || (req.user ? req.user.id : null);

    if (!targetUserId) {
      return res.status(401).json({
        status: 'error',
        message: 'Sesi pengguna tidak valid. Silakan login kembali.',
        data: null
      });
    }

    // Jika bukan admin dan ID berbeda dengan yang login, tolak
    if (req.user && req.user.role !== 'admin' && req.user.id !== targetUserId) {
      return res.status(403).json({
        status: 'error',
        message: 'Anda tidak memiliki hak akses untuk mengubah profil pengguna lain.',
        data: null
      });
    }

    const user = await User.findByPk(targetUserId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: `Pengguna dengan ID '${targetUserId}' tidak ditemukan.`,
        data: null
      });
    }

    const { name, nisn_nip, nisnNip, kelas, password, role } = req.body;
    const effectiveNisnNip = nisn_nip || nisnNip;

    // ATURAN 1: Kasir tidak diizinkan mengubah kata sandi mandiri
    if (req.user && req.user.role === 'kasir' && password && password.trim()) {
      return res.status(403).json({
        status: 'error',
        message: 'Kasir tidak diizinkan mengubah kata sandi mandiri. Hubungi Admin / Guru Pembina.',
        data: null
      });
    }

    // ATURAN 2: Admin hanya diizinkan untuk mengedit kata sandi akun Kasir
    if (req.user && req.user.role === 'admin' && req.user.id !== user.id && password && password.trim()) {
      if (user.role !== 'kasir') {
        return res.status(403).json({
          status: 'error',
          message: 'Admin hanya diizinkan untuk mengedit kata sandi akun Kasir.',
          data: null
        });
      }
    }

    if (name && name.trim()) {
      user.name = name.trim();
    }

    if (effectiveNisnNip && effectiveNisnNip.trim() && effectiveNisnNip.trim() !== user.nisn_nip) {
      const cleanNisn = effectiveNisnNip.trim();
      const existing = await User.findOne({
        where: {
          nisn_nip: cleanNisn,
          id: { [Op.ne]: user.id }
        }
      });
      if (existing) {
        return res.status(400).json({
          status: 'error',
          message: `NISN/NIP '${cleanNisn}' sudah digunakan oleh akun lain.`,
          data: null
        });
      }
      user.nisn_nip = cleanNisn;
    }

    if (kelas !== undefined) {
      user.kelas = kelas ? kelas.trim() : null;
    }

    // Admin dapat memperbarui role jika ditentukan
    if (req.user && req.user.role === 'admin' && role && role.trim()) {
      const allowedRoles = ['siswa', 'kasir', 'penitip', 'admin'];
      const targetRole = role.trim().toLowerCase();
      if (allowedRoles.includes(targetRole)) {
        user.role = targetRole;
      }
    }

    if (password && password.trim()) {
      const cleanPassword = password.trim();
      if (cleanPassword.length < 6) {
        return res.status(400).json({
          status: 'error',
          message: 'Kata sandi baru minimal harus 6 karakter.',
          data: null
        });
      }
      const salt = await bcrypt.genSalt(10);
      user.password_hash = await bcrypt.hash(cleanPassword, salt);
    }

    await user.save();

    // Buat JWT token baru hanya jika user memperbarui akun miliknya sendiri
    let token = null;
    if (req.user && req.user.id === user.id) {
      const secret = process.env.JWT_SECRET || 'supersecret_jwt_key_sipeka_2026_production';
      const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
      token = jwt.sign(
        {
          id: user.id,
          nisn_nip: user.nisn_nip,
          role: user.role,
          name: user.name
        },
        secret,
        { expiresIn }
      );
    }

    return res.status(200).json({
      status: 'success',
      message: 'Profil akun berhasil diperbarui.',
      data: {
        id: user.id,
        nisn_nip: user.nisn_nip,
        name: user.name,
        role: user.role,
        kelas: user.kelas,
        is_active: user.is_active,
        token
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui profil: ' + error.message,
      data: null
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile
};
