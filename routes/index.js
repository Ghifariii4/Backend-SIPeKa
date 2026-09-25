const express = require('express');
const router = express.Router();

// Import Middlewares
const { verifyToken, isAdmin, isKasir, isKasirOrAdmin } = require('../middlewares/auth');

// Import Controllers
const authController = require('../controllers/authController');
const adminController = require('../controllers/adminController');
const posController = require('../controllers/posController');
const shiftController = require('../controllers/shiftController');
const productController = require('../controllers/productController');

// ==========================================
// 1. RUTE AUTENTIKASI (AUTH)
// ==========================================
router.post('/auth/register', authController.register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Autentikasi Pengguna (Login)
 *     description: Memvalidasi kredensial pengguna dan mengembalikan JWT token. Mengembalikan 403 Forbidden jika akun belum aktif.
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nisn_nip
 *               - password
 *             properties:
 *               nisn_nip:
 *                 type: string
 *                 example: "1234567890"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "password123"
 *     responses:
 *       200:
 *         description: Login berhasil, mengembalikan token JWT dan data user
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
 *                   example: "Login berhasil."
 *                 data:
 *                   type: object
 *                   properties:
 *                     token:
 *                       type: string
 *                       example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         nisn_nip:
 *                           type: string
 *                         name:
 *                           type: string
 *                         role:
 *                           type: string
 *                         is_active:
 *                           type: boolean
 *       400:
 *         description: Input tidak lengkap
 *       401:
 *         description: NISN/NIP atau kata sandi tidak valid
 *       403:
 *         description: Akun belum aktif / menunggu persetujuan admin
 */
router.post('/auth/login', authController.login);
router.get('/auth/me', verifyToken, authController.getMe);

// ==========================================
// 2. RUTE ADMINISTRATOR (ADMIN)
// Dilindungi: verifyToken & isAdmin
// ==========================================
router.put('/admin/users/:id/approve', verifyToken, isAdmin, adminController.approveUser);
router.post('/admin/users/approve', verifyToken, isAdmin, adminController.approveUser);
router.post('/admin/users/internal', verifyToken, isAdmin, adminController.createInternalUser);
router.get('/admin/users', verifyToken, isAdmin, adminController.getAllUsers);

// ==========================================
// 3. RUTE KATALOG PRODUK (PRODUCTS)
// ==========================================
/**
 * @openapi
 * /products:
 *   get:
 *     summary: Mengambil Daftar Produk Konsinyasi Aktif (Stok > 0)
 *     description: Mengambil seluruh produk yang tersedia dan memiliki stok lebih dari 0. Mendukung pencarian nama.
 *     tags:
 *       - Products
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         required: false
 *         description: Kata kunci pencarian nama produk
 *         example: "roti"
 *     responses:
 *       200:
 *         description: Daftar produk berhasil diambil
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
 *                   example: "Daftar produk berhasil diambil."
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         example: "2d54e63f-60da-4458-8722-7975e4fb1156"
 *                       penitip_id:
 *                         type: string
 *                         format: uuid
 *                       name:
 *                         type: string
 *                         example: "Roti Bakar Manis"
 *                       price:
 *                         type: number
 *                         example: 17500.00
 *                       school_margin:
 *                         type: number
 *                         example: 1000.00
 *                       stock:
 *                         type: integer
 *                         example: 25
 *                       penitip:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           nisn_nip:
 *                             type: string
 *                           name:
 *                             type: string
 *                           role:
 *                             type: string
 *       500:
 *         description: Terjadi kesalahan server
 */
router.get('/products', productController.getProducts);
router.get('/products/:id', productController.getProductById);

// Dilindungi: Menambah produk baru dan update stok (Penitip / Admin)
router.post('/products', verifyToken, productController.createProduct);
router.put('/products/:id/stock', verifyToken, productController.updateStock);

// ==========================================
// 4. RUTE MANAJEMEN SHIFT KASIR (SHIFTS)
// Dilindungi: verifyToken & isKasirOrAdmin
// ==========================================
router.post('/shifts/clock-in', verifyToken, isKasirOrAdmin, shiftController.clockIn);
router.post('/shifts/clock-out', verifyToken, isKasirOrAdmin, shiftController.clockOut);
router.get('/shifts/current', verifyToken, isKasirOrAdmin, shiftController.getCurrentShift);
router.get('/shifts', verifyToken, isKasirOrAdmin, shiftController.getAllShifts);

// ==========================================
// 5. RUTE POS & TRANSAKSI PENJUALAN (POS & ORDERS)
// ==========================================
// Transaksi kasir (hanya Kasir atau Admin yang sedang bertugas)
router.post('/pos/transaction', verifyToken, isKasirOrAdmin, posController.createTransaction);
router.put('/pos/scan/:qr_code', verifyToken, isKasirOrAdmin, posController.scanQrCode);

// Riwayat dan detail pesanan
router.get('/orders', verifyToken, posController.getOrders);
router.get('/orders/:id', verifyToken, posController.getOrderById);

module.exports = router;
