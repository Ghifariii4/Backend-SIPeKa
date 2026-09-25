const { sequelize, Order, OrderItem, Product, Shift, User } = require('../models');

/**
 * Membuat transaksi penjualan kasir (POS)
 * Menggunakan Sequelize Transaction untuk memastikan integritas stok dan pencatatan order
 */
const createTransaction = async (req, res) => {
  let transaction;

  try {
    const { items, pembeli_id, shift_id, order_type, qr_code } = req.body;

    // Validasi input items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Daftar items transaksi wajib disertakan dan tidak boleh kosong.',
        data: null
      });
    }

    // Tentukan shift kasir aktif jika user yang melakukan transaksi adalah kasir
    let activeShift = null;
    if (req.user && req.user.role === 'kasir') {
      activeShift = await Shift.findOne({
        where: {
          kasir_id: req.user.id,
          status: 'active'
        }
      });

      if (!activeShift) {
        return res.status(400).json({
          status: 'error',
          message: 'Kasir belum membuka shift aktif. Silakan lakukan clock-in terlebih dahulu sebelum memproses transaksi.',
          data: null
        });
      }
    } else if (shift_id) {
      activeShift = await Shift.findByPk(shift_id);
    }

    // Memulai Sequelize Transaction
    transaction = await sequelize.transaction();

    let totalAmount = 0;
    const preparedOrderItems = [];

    // Loop setiap item pesanan: validasi produk & potong stok
    for (const item of items) {
      const { product_id, quantity } = item;

      if (!product_id || !quantity || quantity <= 0) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: 'Setiap item harus memiliki product_id yang valid dan quantity lebih dari 0.',
          data: null
        });
      }

      // Ambil produk dan kunci baris untuk update (concurrency safety)
      const product = await Product.findByPk(product_id, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });

      if (!product) {
        await transaction.rollback();
        return res.status(404).json({
          status: 'error',
          message: `Produk dengan ID '${product_id}' tidak ditemukan.`,
          data: null
        });
      }

      // Cek ketersediaan stok
      if (product.stock < quantity) {
        await transaction.rollback();
        return res.status(400).json({
          status: 'error',
          message: `Stok tidak mencukupi untuk produk '${product.name}'. Stok tersedia: ${product.stock}, diminta: ${quantity}.`,
          data: null
        });
      }

      // Potong stok produk
      product.stock -= quantity;
      await product.save({ transaction });

      // Hitung subtotal dan siapkan snapshot harga & margin
      const priceSnapshot = parseFloat(product.price);
      const marginSnapshot = parseFloat(product.school_margin);
      const itemSubtotal = priceSnapshot * quantity;
      totalAmount += itemSubtotal;

      preparedOrderItems.push({
        product_id: product.id,
        quantity,
        price_snapshot: priceSnapshot,
        margin_snapshot: marginSnapshot
      });
    }

    // Tentukan pembeli_id
    let buyerId = pembeli_id || null;
    if (!buyerId && req.user && req.user.role === 'pembeli') {
      buyerId = req.user.id;
    }

    // Buat data Order
    const newOrder = await Order.create({
      pembeli_id: buyerId,
      shift_id: activeShift ? activeShift.id : null,
      qr_code: qr_code || null,
      total_amount: totalAmount,
      order_type: order_type || 'direct',
      status: 'completed'
    }, { transaction });

    // Buat data OrderItem
    for (const orderItem of preparedOrderItems) {
      await OrderItem.create({
        order_id: newOrder.id,
        product_id: orderItem.product_id,
        quantity: orderItem.quantity,
        price_snapshot: orderItem.price_snapshot,
        margin_snapshot: orderItem.margin_snapshot
      }, { transaction });
    }

    // Jika ada shift aktif, update kas fisik yang diharapkan (expected_cash)
    if (activeShift) {
      activeShift.expected_cash = parseFloat(activeShift.expected_cash) + totalAmount;
      await activeShift.save({ transaction });
    }

    // Commit transaksi Sequelize jika semua proses di atas berhasil
    await transaction.commit();

    // Ambil order lengkap beserta relasi untuk response
    const completeOrder = await Order.findByPk(newOrder.id, {
      include: [
        {
          model: OrderItem,
          as: 'order_items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'price', 'school_margin', 'stock']
            }
          ]
        },
        {
          model: Shift,
          as: 'shift',
          attributes: ['id', 'kasir_id', 'status', 'expected_cash']
        },
        {
          model: User,
          as: 'pembeli',
          attributes: ['id', 'name', 'nisn_nip']
        }
      ]
    });

    return res.status(201).json({
      status: 'success',
      message: 'Transaksi kasir (POS) berhasil diproses.',
      data: completeOrder
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan sistem saat memproses transaksi: ' + error.message,
      data: null
    });
  }
};

/**
 * Scan QR Code untuk pengambilan pesanan pre-order di kasir
 */
const scanQrCode = async (req, res) => {
  let transaction;

  try {
    const { qr_code } = req.params;

    if (!qr_code) {
      return res.status(400).json({
        status: 'error',
        message: 'Parameter qr_code wajib disertakan.',
        data: null
      });
    }

    // Cek shift aktif kasir yang sedang login
    const activeShift = await Shift.findOne({
      where: {
        kasir_id: req.user.id,
        status: 'active'
      }
    });

    if (!activeShift) {
      return res.status(400).json({
        status: 'error',
        message: 'Tidak ditemukan shift aktif untuk kasir ini. Silakan clock-in terlebih dahulu.',
        data: null
      });
    }

    transaction = await sequelize.transaction();

    // Cari pesanan berdasarkan QR Code
    const order = await Order.findOne({
      where: { qr_code },
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!order) {
      await transaction.rollback();
      return res.status(404).json({
        status: 'error',
        message: `Pesanan dengan QR Code '${qr_code}' tidak ditemukan.`,
        data: null
      });
    }

    if (order.status === 'completed') {
      await transaction.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Pesanan pre-order ini sudah pernah diselesaikan sebelumnya.',
        data: null
      });
    }

    if (order.status === 'cancelled') {
      await transaction.rollback();
      return res.status(400).json({
        status: 'error',
        message: 'Pesanan pre-order ini telah dibatalkan dan tidak dapat diproses.',
        data: null
      });
    }

    // Update status order menjadi completed dan hubungkan dengan shift aktif saat ini
    order.status = 'completed';
    order.shift_id = activeShift.id;
    await order.save({ transaction });

    // Tambahkan nilai pesanan ke expected_cash shift
    activeShift.expected_cash = parseFloat(activeShift.expected_cash) + parseFloat(order.total_amount);
    await activeShift.save({ transaction });

    await transaction.commit();

    // Ambil order terbaru dengan relasinya
    const updatedOrder = await Order.findByPk(order.id, {
      include: [
        {
          model: OrderItem,
          as: 'order_items',
          include: [
            {
              model: Product,
              as: 'product'
            }
          ]
        },
        {
          model: Shift,
          as: 'shift'
        },
        {
          model: User,
          as: 'pembeli',
          attributes: ['id', 'name', 'nisn_nip']
        }
      ]
    });

    return res.status(200).json({
      status: 'success',
      message: 'Pesanan pre-order berhasil diverifikasi dan diselesaikan.',
      data: updatedOrder
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }

    return res.status(500).json({
      status: 'error',
      message: 'Terjadi kesalahan saat memproses scan QR Code: ' + error.message,
      data: null
    });
  }
};

/**
 * Mendapatkan daftar riwayat transaksi order
 */
const getOrders = async (req, res) => {
  try {
    const { status, order_type, shift_id } = req.query;
    const whereClause = {};

    if (status) whereClause.status = status;
    if (order_type) whereClause.order_type = order_type;
    if (shift_id) whereClause.shift_id = shift_id;

    // Jika role pembeli, hanya boleh melihat order miliknya
    if (req.user.role === 'pembeli') {
      whereClause.pembeli_id = req.user.id;
    }

    const orders = await Order.findAll({
      where: whereClause,
      include: [
        {
          model: OrderItem,
          as: 'order_items',
          include: [
            {
              model: Product,
              as: 'product',
              attributes: ['id', 'name', 'price', 'school_margin']
            }
          ]
        },
        {
          model: User,
          as: 'pembeli',
          attributes: ['id', 'name', 'nisn_nip']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      status: 'success',
      message: 'Daftar riwayat transaksi berhasil diambil.',
      data: orders
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil riwayat transaksi: ' + error.message,
      data: null
    });
  }
};

/**
 * Mendapatkan detail pesanan berdasarkan ID
 */
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findByPk(id, {
      include: [
        {
          model: OrderItem,
          as: 'order_items',
          include: [
            {
              model: Product,
              as: 'product'
            }
          ]
        },
        {
          model: Shift,
          as: 'shift'
        },
        {
          model: User,
          as: 'pembeli',
          attributes: ['id', 'name', 'nisn_nip']
        }
      ]
    });

    if (!order) {
      return res.status(404).json({
        status: 'error',
        message: `Pesanan dengan ID '${id}' tidak ditemukan.`,
        data: null
      });
    }

    // Pembeli hanya bisa melihat order sendiri
    if (req.user.role === 'pembeli' && order.pembeli_id !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak. Anda tidak memiliki izin untuk melihat pesanan ini.',
        data: null
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Detail pesanan berhasil diambil.',
      data: order
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil detail pesanan: ' + error.message,
      data: null
    });
  }
};

module.exports = {
  createTransaction,
  scanQrCode,
  getOrders,
  getOrderById
};
