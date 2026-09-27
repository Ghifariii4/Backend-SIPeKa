const { Product, OrderItem } = require('../models');

/**
 * Controller untuk Dashboard Penitip
 * Mengambil data produk milik penitip yang sedang login
 * dan menghitung total pendapatan yang belum dibayarkan oleh admin.
 */
const getDashboard = async (req, res) => {
  try {
    const penitipId = req.user.id;

    // 1. Ambil semua data dari tabel Product di mana penitip_id = req.user.id
    const products = await Product.findAll({
      where: {
        penitip_id: penitipId
      },
      order: [['createdAt', 'DESC']]
    });

    // 2. Hitung total uang milik penitip yang BELUM dibayar oleh admin.
    // Query ke tabel OrderItem join Product di mana Product.penitip_id = req.user.id dan OrderItem.is_paid_to_penitip = false
    const unpaidOrderItems = await OrderItem.findAll({
      where: {
        is_paid_to_penitip: false
      },
      include: [
        {
          model: Product,
          as: 'product',
          where: {
            penitip_id: penitipId
          },
          required: true
        }
      ]
    });

    // 3. Rumus pendapatan per item = quantity * (price_snapshot - margin_snapshot)
    let totalUnpaidEarnings = 0;
    for (const item of unpaidOrderItems) {
      const quantity = Number(item.quantity) || 0;
      const priceSnapshot = parseFloat(item.price_snapshot) || 0;
      const marginSnapshot = parseFloat(item.margin_snapshot) || 0;
      const itemEarnings = quantity * (priceSnapshot - marginSnapshot);
      totalUnpaidEarnings += itemEarnings;
    }

    // Format nilai desimal presisi 2 digit menjadi number
    totalUnpaidEarnings = parseFloat(totalUnpaidEarnings.toFixed(2));

    // 4. Return JSON: { products: [...], total_unpaid_earnings: 15000 }
    return res.status(200).json({
      status: 'success',
      message: 'Data dashboard penitip berhasil diambil.',
      products,
      total_unpaid_earnings: totalUnpaidEarnings,
      data: {
        products,
        total_unpaid_earnings: totalUnpaidEarnings
      }
    });
  } catch (error) {
    console.error('Error saat memuat dashboard penitip:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memuat dashboard penitip: ' + error.message,
      data: null
    });
  }
};

module.exports = {
  getDashboard
};
