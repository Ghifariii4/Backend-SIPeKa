const { Op, Product, User } = require('../models');

/**
 * Mengambil semua produk yang memiliki stok > 0
 * Mendukung pencarian opsional melalui query parameter ?q=nama_produk
 */
const getProducts = async (req, res) => {
  try {
    const { q } = req.query;

    const whereClause = {
      stock: {
        [Op.gt]: 0
      }
    };

    // Filter pencarian nama jika query q disertakan
    if (q) {
      whereClause.name = {
        [Op.like]: `%${q}%`
      };
    }

    const products = await Product.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'penitip',
          attributes: ['id', 'nisn_nip', 'name', 'role']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json({
      status: 'success',
      message: 'Daftar produk berhasil diambil.',
      data: products
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil daftar produk: ' + error.message,
      data: null
    });
  }
};

/**
 * Mengambil detail produk spesifik berdasarkan ID
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findByPk(id, {
      include: [
        {
          model: User,
          as: 'penitip',
          attributes: ['id', 'nisn_nip', 'name', 'role']
        }
      ]
    });

    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: `Produk dengan ID '${id}' tidak ditemukan.`,
        data: null
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Detail produk berhasil diambil.',
      data: product
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal mengambil detail produk: ' + error.message,
      data: null
    });
  }
};

/**
 * Menambahkan produk baru (biasanya dilakukan oleh penitip atau admin)
 */
const createProduct = async (req, res) => {
  try {
    const { name, price, school_margin, stock, penitip_id } = req.body;

    if (!name || price === undefined || stock === undefined) {
      return res.status(400).json({
        status: 'error',
        message: 'Field name, price, dan stock wajib diisi.',
        data: null
      });
    }

    // Tentukan ID penitip
    let effectivePenitipId = null;
    if (req.user.role === 'penitip') {
      effectivePenitipId = req.user.id;
    } else if (penitip_id) {
      effectivePenitipId = penitip_id;
    } else {
      effectivePenitipId = req.user.id;
    }

    const newProduct = await Product.create({
      penitip_id: effectivePenitipId,
      name,
      price: parseFloat(price),
      school_margin: school_margin !== undefined ? parseFloat(school_margin) : 1000.00,
      stock: parseInt(stock, 10)
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
    return res.status(500).json({
      status: 'error',
      message: 'Gagal menambahkan produk: ' + error.message,
      data: null
    });
  }
};

/**
 * Mengubah stok produk (restock oleh penitip atau admin)
 */
const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock } = req.body;

    if (stock === undefined || isNaN(stock)) {
      return res.status(400).json({
        status: 'error',
        message: 'Field stock wajib diisi dengan angka.',
        data: null
      });
    }

    const product = await Product.findByPk(id);
    if (!product) {
      return res.status(404).json({
        status: 'error',
        message: `Produk dengan ID '${id}' tidak ditemukan.`,
        data: null
      });
    }

    // Penitip hanya boleh memperbarui produk miliknya sendiri
    if (req.user.role === 'penitip' && product.penitip_id !== req.user.id) {
      return res.status(403).json({
        status: 'error',
        message: 'Akses ditolak. Anda hanya dapat mengubah stok produk konsinyasi milik Anda sendiri.',
        data: null
      });
    }

    product.stock = parseInt(stock, 10);
    await product.save();

    return res.status(200).json({
      status: 'success',
      message: 'Stok produk berhasil diperbarui.',
      data: product
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: 'Gagal memperbarui stok produk: ' + error.message,
      data: null
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateStock
};
