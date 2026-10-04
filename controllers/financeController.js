const { sequelize, Op, Shift, Order, OrderItem, Product, User } = require('../models');

/**
 * Controller Keuangan Admin (Finance Controller)
 * Menangani perhitungan laba sekolah, validasi setoran shift kasir,
 * dan persetujuan pencairan bagi hasil penitip konsinyasi.
 */

// 1. GET /api/v1/admin/finance/profit
const getProfit = async (req, res) => {
  try {
    const items = await OrderItem.findAll({
      include: [
        {
          model: Order,
          as: 'order',
          where: {
            status: 'completed'
          },
          required: false
        }
      ]
    });

    let totalProfit = 0;
    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const margin = parseFloat(item.margin_snapshot) || 1000.0;
      totalProfit += qty * margin;
    }

    totalProfit = parseFloat(totalProfit.toFixed(2));

    return res.status(200).json({
      status: 'success',
      message: 'Data laba sekolah berhasil diambil.',
      data: {
        total_profit: totalProfit,
        school_profit: totalProfit,
        profit: totalProfit,
        net_profit: totalProfit,
        date: new Date().toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menghitung laba sekolah: ' + error.message,
      data: null
    });
  }
};

// 2. GET /api/v1/admin/finance/shifts
const getPendingShifts = async (req, res) => {
  try {
    try {
      await Shift.sequelize.query("ALTER TABLE shifts ADD COLUMN is_validated BOOLEAN NOT NULL DEFAULT FALSE;");
    } catch (_) {}

    const shifts = await Shift.findAll({
      where: {
        status: 'closed',
        is_validated: false
      },
      include: [
        {
          model: User,
          as: 'kasir',
          attributes: ['id', 'nisn_nip', 'name', 'role']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const formatted = shifts.map(s => ({
      id: s.id,
      kasir_id: s.kasir_id,
      kasir_name: s.kasir ? s.kasir.name : 'Petugas Kasir',
      start_time: s.start_time,
      end_time: s.end_time,
      clock_out: s.end_time,
      starting_cash: 0.0,
      expected_cash: parseFloat(s.expected_cash) || 0.0,
      status: s.status
    }));

    return res.status(200).json({
      status: 'success',
      message: 'Daftar shift kasir menunggu validasi berhasil diambil.',
      data: formatted
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil data shift kasir: ' + error.message,
      data: null
    });
  }
};

// 3. PUT /api/v1/admin/finance/shifts/:id/validate
const validateShift = async (req, res) => {
  try {
    const { id } = req.params;

    try {
      await Shift.sequelize.query("ALTER TABLE shifts ADD COLUMN is_validated BOOLEAN NOT NULL DEFAULT FALSE;");
    } catch (_) {}

    const shift = await Shift.findByPk(id);
    if (!shift) {
      return res.status(404).json({
        status: 'error',
        message: `Shift dengan ID '${id}' tidak ditemukan.`,
        data: null
      });
    }

    shift.is_validated = true;
    await shift.save();

    return res.status(200).json({
      status: 'success',
      message: 'Setoran kas shift kasir berhasil divalidasi oleh admin.',
      data: shift
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memvalidasi shift: ' + error.message,
      data: null
    });
  }
};

// 4. GET /api/v1/admin/finance/payouts
const getPendingPayouts = async (req, res) => {
  try {
    try {
      await OrderItem.sequelize.query("ALTER TABLE order_items ADD COLUMN is_paid_to_penitip BOOLEAN NOT NULL DEFAULT FALSE;");
    } catch (_) {}

    const unpaidItems = await OrderItem.findAll({
      where: {
        is_paid_to_penitip: false
      },
      include: [
        {
          model: Product,
          as: 'product',
          required: true,
          include: [
            {
              model: User,
              as: 'penitip',
              attributes: ['id', 'name', 'nisn_nip'],
              required: false
            }
          ]
        }
      ]
    });

    const penitipMap = new Map();

    for (const item of unpaidItems) {
      const prod = item.product;
      const penitipId = prod ? prod.penitip_id : null;
      if (!penitipId) continue;

      const penitipName = (prod.penitip && prod.penitip.name) ? prod.penitip.name : 'Mitra Siswa/Guru (Penitip)';
      const qty = Number(item.quantity) || 0;
      const price = parseFloat(item.price_snapshot) || 0;
      const margin = parseFloat(item.margin_snapshot) || 1000;
      const sales = qty * price;
      const net = qty * Math.max(0, price - margin);

      if (!penitipMap.has(penitipId)) {
        penitipMap.set(penitipId, {
          penitip_id: penitipId,
          penitip_name: penitipName,
          total_sales: 0,
          net_amount: 0,
          status: 'pending'
        });
      }

      const existing = penitipMap.get(penitipId);
      existing.total_sales += sales;
      existing.net_amount += net;
    }

    const result = Array.from(penitipMap.values()).map(p => ({
      penitip_id: p.penitip_id,
      penitip_name: p.penitip_name,
      total_sales: parseFloat(p.total_sales.toFixed(2)),
      net_amount: parseFloat(p.net_amount.toFixed(2)),
      payout_amount: parseFloat(p.net_amount.toFixed(2)),
      total_payout: parseFloat(p.net_amount.toFixed(2)),
      status: 'pending'
    }));

    return res.status(200).json({
      status: 'success',
      message: 'Daftar bagi hasil menunggu persetujuan berhasil diambil.',
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil daftar bagi hasil: ' + error.message,
      data: null
    });
  }
};

// 5. PUT /api/v1/admin/finance/payouts/:penitip_id
const processPayout = async (req, res) => {
  try {
    const { penitip_id } = req.params;

    try {
      await OrderItem.sequelize.query("ALTER TABLE order_items ADD COLUMN is_paid_to_penitip BOOLEAN NOT NULL DEFAULT FALSE;");
    } catch (_) {}

    const products = await Product.findAll({
      where: { penitip_id },
      attributes: ['id']
    });

    const productIds = products.map(p => p.id);

    if (productIds.length > 0) {
      await OrderItem.update(
        { is_paid_to_penitip: true },
        {
          where: {
            product_id: {
              [Op.in]: productIds
            },
            is_paid_to_penitip: false
          }
        }
      );
    }

    return res.status(200).json({
      status: 'success',
      message: 'Pencairan bagi hasil penitip berhasil disetujui dan dicairkan.',
      data: null
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memproses pencairan bagi hasil: ' + error.message,
      data: null
    });
  }
};

module.exports = {
  getProfit,
  getPendingShifts,
  validateShift,
  getPendingPayouts,
  processPayout
};
