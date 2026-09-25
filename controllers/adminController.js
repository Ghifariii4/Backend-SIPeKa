const bcrypt = require('bcryptjs');
const { User } = require('../models');

/**
 * Menyetujui pendaftaran pengguna (misal akun penitip) sehingga is_active menjadi true
 */
const approveUser = async (req, res) => {
  try {
    const userId = req.params.id || req.body.id || req.body.user_id;

    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'ID pengguna wajib disertakan (via parameter URL atau body).',
        data: null
      });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: `Pengguna dengan ID '${userId}' tidak ditemukan.`,
        data: null
      });
    }

    if (user.is_active) {
      return res.status(200).json({
        status: 'success',
        message: 'Pengguna ini sudah dalam status aktif.',
        data: {
          id: user.id,
          nisn_nip: user.nisn_nip,
          name: user.name,
          role: user.role,
          is_active: user.is_active
        }
      });
    }

    user.is_active = true;
    await user.save();

    return res.status(200).json({
      status: 'success',
      message: `Akun pengguna '${user.name}' (${user.role}) berhasil disetujui dan diaktifkan.`,
      data: {
        id: user.id,
        nisn_nip: user.nisn_nip,
        name: user.name,
        role: user.role,
        is_active: user.is_active
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat menyetujui pengguna: ' + error.message,
      data: null
    });
  }
};

/**
 * Membuat akun pengguna internal (kasir atau admin) langsung aktif (is_active = true)
 */
const createInternalUser = async (req, res) => {
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

    if (normalizedRole !== 'kasir' && normalizedRole !== 'admin') {
      return res.status(400).json({
        status: 'error',
        message: "Pembuatan akun internal hanya diperuntukkan bagi role 'kasir' atau 'admin'.",
        data: null
      });
    }

    // Periksa apakah NISN/NIP sudah terdaftar
    const existingUser = await User.findOne({ where: { nisn_nip } });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: `Pengguna dengan NISN/NIP '${nisn_nip}' sudah terdaftar.`,
        data: null
      });
    }

    // Hash kata sandi
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Akun internal langsung aktif (is_active = true)
    const newUser = await User.create({
      nisn_nip,
      name,
      password_hash,
      role: normalizedRole,
      is_active: true
    });

    return res.status(201).json({
      status: 'success',
      message: `Akun internal '${newUser.name}' dengan role '${newUser.role}' berhasil dibuat.`,
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
      message: 'Terjadi kesalahan saat membuat pengguna internal: ' + error.message,
      data: null
    });
  }
};

/**
 * Mendapatkan seluruh daftar pengguna (dengan opsi filter)
 */
const getAllUsers = async (req, res) => {
  try {
    const { role, is_active } = req.query;
    const whereClause = {};

    if (role) {
      whereClause.role = role.toLowerCase();
    }

    if (is_active !== undefined) {
      whereClause.is_active = is_active === 'true' || is_active === '1';
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: ['id', 'nisn_nip', 'name', 'role', 'is_active', 'createdAt', 'updatedAt'],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      status: 'success',
      message: 'Daftar pengguna berhasil diambil.',
      data: users
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data pengguna: ' + error.message,
      data: null
    });
  }
};

module.exports = {
  approveUser,
  createInternalUser,
  getAllUsers
};
