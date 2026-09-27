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

module.exports = router;
