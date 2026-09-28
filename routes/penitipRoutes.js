const express = require('express');
const router = express.Router();
const penitipController = require('../controllers/penitipController');
const { verifyToken } = require('../middlewares/auth');

/**
 * @openapi
 * /penitip/dashboard:
 *   get:
 *     summary: Mengambil Ringkasan Dashboard Penitip
 *     description: Mengambil seluruh produk milik penitip yang sedang login dan total pendapatan yang belum dibayar oleh admin.
 *     tags:
 *       - Penitip
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data dashboard penitip berhasil diambil
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "success"
 *                 message:
 *                   type: string
 *                   example: "Data dashboard penitip berhasil diambil."
 *                 products:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total_unpaid_earnings:
 *                   type: number
 *                   example: 15000
 *                 data:
 *                   type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                     total_unpaid_earnings:
 *                       type: number
 *                       example: 15000
 *       401:
 *         description: Akses ditolak. Token tidak ditemukan atau tidak valid
 *       500:
 *         description: Terjadi kesalahan pada server
 */
router.get('/dashboard', verifyToken, penitipController.getDashboard);
router.get('/penitip/dashboard', verifyToken, penitipController.getDashboard);

const upload = require('../middlewares/upload');

/**
 * @openapi
 * /penitip/products:
 *   post:
 *     summary: Menambahkan Produk Baru oleh Penitip
 *     description: Menambahkan produk konsinyasi baru milik penitip yang terautentikasi dengan dukungan upload foto produk (form-data / multipart).
 *     tags:
 *       - Penitip
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - price
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Kue Lumpur Manis"
 *               price:
 *                 type: number
 *                 example: 5000
 *               school_margin:
 *                 type: number
 *                 example: 500
 *               stock:
 *                 type: integer
 *                 example: 20
 *               description:
 *                 type: string
 *                 example: "Kue lumpur kentang lembut dan manis"
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Foto produk konsinyasi
 *     responses:
 *       201:
 *         description: Produk berhasil ditambahkan
 *       400:
 *         description: Input tidak valid
 *       401:
 *         description: Akses ditolak
 */
router.post('/products', verifyToken, upload.flexible, penitipController.createProduct);
router.post('/', verifyToken, upload.flexible, penitipController.createProduct);

// Endpoint Hard Delete Produk
router.delete('/products/:id', penitipController.deleteProduct);
router.delete('/:id', penitipController.deleteProduct);

module.exports = router;
