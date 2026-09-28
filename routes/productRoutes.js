const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { verifyToken } = require('../middlewares/auth');
const upload = require('../middlewares/upload');

/**
 * @openapi
 * /products:
 *   get:
 *     summary: Mengambil Daftar Produk Konsinyasi Aktif
 *     tags:
 *       - Products
 *     responses:
 *       200:
 *         description: Daftar produk berhasil diambil
 */
router.get('/', productController.getProducts);

/**
 * @openapi
 * /products/{id}:
 *   get:
 *     summary: Mengambil Detail Produk
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detail produk berhasil diambil
 *       404:
 *         description: Produk tidak ditemukan
 */
router.get('/:id', productController.getProductById);

/**
 * @openapi
 * /products:
 *   post:
 *     summary: Menambahkan Produk Baru
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Produk berhasil ditambahkan
 */
router.post('/', verifyToken, upload.flexible, productController.createProduct);

/**
 * @openapi
 * /products/{id}/stock:
 *   put:
 *     summary: Memperbarui Stok Produk
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Stok berhasil diperbarui
 */
router.put('/:id/stock', verifyToken, productController.updateStock);

/**
 * @openapi
 * /products/{id}:
 *   delete:
 *     summary: Menghapus Produk Permanen (HARD DELETE)
 *     description: Menghapus permanen baris produk dari database MySQL beserta membersihkan relasi tabel order_items
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID Produk yang akan dihapus
 *     responses:
 *       200:
 *         description: Produk berhasil dihapus total dan permanen
 *       404:
 *         description: Produk tidak ditemukan di database
 *       500:
 *         description: Terjadi kesalahan pada server
 */
router.delete('/:id', productController.deleteProduct);

module.exports = router;
