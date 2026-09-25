const { Shift, User } = require('../models');

/**
 * Membuka shift baru (clock-in) untuk kasir yang sedang login
 */
const clockIn = async (req, res) => {
  try {
    const kasirId = req.user.id;

    // Periksa apakah kasir sudah memiliki shift aktif yang belum ditutup
    const existingActiveShift = await Shift.findOne({
      where: {
        kasir_id: kasirId,
        status: 'active'
      }
    });

    if (existingActiveShift) {
      return res.status(400).json({
        status: 'error',
        message: 'Kasir masih memiliki sesi shift aktif yang belum ditutup. Silakan lakukan clock-out terlebih dahulu sebelum membuka shift baru.',
        data: existingActiveShift
      });
    }

    const startingCash = req.body.starting_cash ? parseFloat(req.body.starting_cash) : 0.00;

    const newShift = await Shift.create({
      kasir_id: kasirId,
      start_time: new Date(),
      end_time: null,
      expected_cash: startingCash,
      status: 'active'
    });

    const shiftWithKasir = await Shift.findByPk(newShift.id, {
      include: [
        {
          model: User,
          as: 'kasir',
          attributes: ['id', 'nisn_nip', 'name', 'role']
        }
      ]
    });

    return res.status(201).json({
      status: 'success',
      message: 'Sesi shift kasir berhasil dibuka (clock-in).',
      data: shiftWithKasir
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat melakukan clock-in: ' + error.message,
      data: null
    });
  }
};

/**
 * Menutup sesi shift yang sedang aktif (clock-out) untuk kasir yang sedang login
 */
const clockOut = async (req, res) => {
  try {
    const kasirId = req.user.id;

    // Cari shift aktif kasir
    const activeShift = await Shift.findOne({
      where: {
        kasir_id: kasirId,
        status: 'active'
      }
    });

    if (!activeShift) {
      return res.status(404).json({
        status: 'error',
        message: 'Tidak ditemukan sesi shift aktif untuk kasir saat ini. Anda belum melakukan clock-in.',
        data: null
      });
    }

    activeShift.status = 'closed';
    activeShift.end_time = new Date();
    await activeShift.save();

    const closedShiftWithKasir = await Shift.findByPk(activeShift.id, {
      include: [
        {
          model: User,
          as: 'kasir',
          attributes: ['id', 'nisn_nip', 'name', 'role']
        }
      ]
    });

    return res.status(200).json({
      status: 'success',
      message: 'Sesi shift kasir berhasil ditutup (clock-out).',
      data: closedShiftWithKasir
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat melakukan clock-out: ' + error.message,
      data: null
    });
  }
};

/**
 * Mendapatkan data shift aktif kasir yang sedang login
 */
const getCurrentShift = async (req, res) => {
  try {
    const kasirId = req.user.id;

    const activeShift = await Shift.findOne({
      where: {
        kasir_id: kasirId,
        status: 'active'
      },
      include: [
        {
          model: User,
          as: 'kasir',
          attributes: ['id', 'nisn_nip', 'name', 'role']
        }
      ]
    });

    if (!activeShift) {
      return res.status(404).json({
        status: 'error',
        message: 'Tidak ada sesi shift aktif untuk kasir saat ini. Silakan clock-in terlebih dahulu.',
        data: null
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Data shift aktif berhasil diambil.',
      data: activeShift
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data shift aktif: ' + error.message,
      data: null
    });
  }
};

/**
 * Mendapatkan seluruh riwayat shift (berguna untuk laporan admin)
 */
const getAllShifts = async (req, res) => {
  try {
    const { status } = req.query;
    const whereClause = {};

    if (status) {
      whereClause.status = status;
    }

    // Jika kasir, hanya lihat shift miliknya sendiri
    if (req.user.role === 'kasir') {
      whereClause.kasir_id = req.user.id;
    }

    const shifts = await Shift.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'kasir',
          attributes: ['id', 'nisn_nip', 'name', 'role']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      status: 'success',
      message: 'Daftar riwayat shift berhasil diambil.',
      data: shifts
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil riwayat shift: ' + error.message,
      data: null
    });
  }
};

module.exports = {
  clockIn,
  clockOut,
  getCurrentShift,
  getAllShifts
};
