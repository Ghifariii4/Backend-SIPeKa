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
// Publik: Melihat produk yang tersedia (stock > 0)
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
