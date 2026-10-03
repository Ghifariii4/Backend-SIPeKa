const { Op, Product, User, OrderItem } = require('../models');

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

    let products;
    try {
      products = await Product.findAll({
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
    } catch (findErr) {
      if (findErr.message && (findErr.message.includes('category') || findErr.message.includes('Unknown column') || findErr.name === 'SequelizeDatabaseError')) {
        try {
          await Product.sequelize.query("ALTER TABLE products ADD COLUMN category VARCHAR(50) NULL DEFAULT 'Makanan';");
        } catch (_) {}
        try {
          await Product.sequelize.query("ALTER TABLE products ADD COLUMN description TEXT NULL;");
        } catch (_) {}
        products = await Product.findAll({
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
      } else {
        throw findErr;
      }
    }

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

    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock, 10);
    const margin = school_margin !== undefined ? parseFloat(school_margin) : 1000.00;

    if (isNaN(parsedPrice) || parsedPrice <= margin) {
      return res.status(400).json({
        status: 'error',
        message: `Harga jual produk harus lebih besar dari margin kas sekolah (Rp 1.000).`,
        data: null
      });
    }

    if (isNaN(parsedStock) || parsedStock < 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Stok produk tidak boleh bernilai negatif.',
        data: null
      });
    }

    // Tentukan ID penitip
    let effectivePenitipId = null;
    if (req.user && req.user.role === 'penitip') {
      effectivePenitipId = req.user.id;
    } else if (penitip_id) {
      effectivePenitipId = penitip_id;
    } else if (req.user) {
      effectivePenitipId = req.user.id;
    }

    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    } else if (req.body.image_url) {
      imageUrl = req.body.image_url;
    }

    let newProduct;
    try {
      newProduct = await Product.create({
        penitip_id: effectivePenitipId,
        name,
        price: parsedPrice,
        school_margin: margin,
        stock: parsedStock,
        category: req.body.category || 'Makanan',
        image_url: imageUrl,
        description: req.body.description || null
      });
    } catch (createErr) {
      if (createErr.message && (createErr.message.includes('category') || createErr.message.includes('Unknown column') || createErr.name === 'SequelizeDatabaseError')) {
        try {
          await Product.sequelize.query("ALTER TABLE products ADD COLUMN category VARCHAR(50) NULL DEFAULT 'Makanan';");
        } catch (_) {}
        try {
          await Product.sequelize.query("ALTER TABLE products ADD COLUMN description TEXT NULL;");
        } catch (_) {}
        try {
          await Product.sequelize.query("ALTER TABLE products ADD COLUMN image_url VARCHAR(255) NULL;");
        } catch (_) {}
        try {
          await Product.sequelize.query("ALTER TABLE products ADD COLUMN school_margin DECIMAL(12, 2) NOT NULL DEFAULT 1000.00;");
        } catch (_) {}

        try {
          newProduct = await Product.create({
            penitip_id: effectivePenitipId,
            name,
            price: parsedPrice,
            school_margin: margin,
            stock: parsedStock,
            category: req.body.category || 'Makanan',
            image_url: imageUrl,
            description: req.body.description || null
          });
        } catch (_) {
          // Fallback tanpa field category jika schema MySQL belum mendukung
          newProduct = await Product.create({
            penitip_id: effectivePenitipId,
            name,
            price: parsedPrice,
            school_margin: margin,
            stock: parsedStock,
            image_url: imageUrl
          });
        }
      } else {
        throw createErr;
      }
    }

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

/**
 * Menghapus produk secara permanen (HARD DELETE) dari database MySQL
 * Beserta menghapus relasi terkait di tabel order_items terlebih dahulu
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // A. Hapus dulu relasi di tabel order_items jika ada agar tidak bentrok Foreign Key
    try {
      await OrderItem.destroy({
        where: { product_id: id },
        force: true
      });
    } catch (fkError) {
      console.log('No associated order_items or bypass FK');
    }

    // B. Hapus total baris produk dari tabel products di MySQL
    const deletedRows = await Product.destroy({
      where: { id: id },
      force: true // HARD DELETE PERMANEN
    });

    if (deletedRows === 0) {
      return res.status(404).json({
        status: 'fail',
        message: 'Produk tidak ditemukan di database'
      });
    }

    return res.status(200).json({
      status: 'success',
      message: 'Produk berhasil dihapus total dan permanen dari database!'
    });
  } catch (error) {
    console.error('Error hard delete product:', error);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateStock,
  deleteProduct
};
