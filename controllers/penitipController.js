const { Product, OrderItem, User } = require('../models');

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

/**
 * Menambahkan produk konsinyasi baru oleh penitip
 * Menerima form-data (multipart).
 * Menyimpan path gambar ke `image_url` dan teks deskripsi ke `description`.
 */
const createProduct = async (req, res) => {
  try {
    const { name, price, school_margin, stock, description } = req.body;

    if (!name || price === undefined || stock === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Field name, price, dan stock wajib diisi.',
        data: null
      });
    }

    // Tentukan ID penitip dari user yang login (atau admin jika ada penitip_id)
    let effectivePenitipId = req.user.id;
    if (req.user.role === 'admin' && req.body.penitip_id) {
      effectivePenitipId = req.body.penitip_id;
    }

    // Simpan path gambar ke image_url jika file diunggah via multipart form-data
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.image_url) {
      imageUrl = req.body.image_url;
    }

    const newProduct = await Product.create({
      penitip_id: effectivePenitipId,
      name,
      price: parseFloat(price),
      school_margin: school_margin !== undefined ? parseFloat(school_margin) : 1000.00,
      stock: parseInt(stock, 10),
      image_url: imageUrl,
      description: description || null
    });

    const productWithPenitip = await Product.findByPk(newProduct.id, {
      include: [
        {
          model: User,
          as: 'penitip',
          attributes: ['id', 'nisn_nip', 'name', 'role']
        }
      ]
    });

    return res.status(201).json({
      status: 'success',
      message: 'Produk berhasil ditambahkan.',
      data: productWithPenitip
    });
  } catch (error) {
    console.error('Error saat menambahkan produk penitip:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menambahkan produk: ' + error.message,
      data: null
    });
  }
};

module.exports = {
  getDashboard,
  createProduct
};
