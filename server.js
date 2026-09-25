require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const apiRoutes = require('./routes');
const { swaggerUi, swaggerSpec } = require('./config/swagger');

const app = express();

// ==========================================
// Middleware Global
// ==========================================
// Mengaktifkan CORS (Cross-Origin Resource Sharing)
app.use(cors());

// Parsing JSON body dan URL-encoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// Dokumentasi Interaktif Swagger UI
// ==========================================
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ==========================================
// Rute Root / Health Check
// ==========================================
app.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Backend REST API SIPeKa (Sistem Informasi PKK) berjalan dengan baik.',
    data: {
      version: '1.0.0',
      swagger_docs: '/api-docs',
      timestamp: new Date().toISOString()
    }
  });
});

// ==========================================
// Mounting API Routes (Prefix: /api/v1)
// ==========================================
app.use('/api/v1', apiRoutes);

// ==========================================
// Handler Rute Tidak Ditemukan (404)
// ==========================================
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Endpoint '${req.originalUrl}' dengan method ${req.method} tidak ditemukan pada server ini.`,
    data: null
  });
});

// ==========================================
// Global Error Handler
// ==========================================
app.use((err, req, res, next) => {
  console.error('Terjadi kesalahan internal pada server:', err);
  res.status(500).json({
    status: 'error',
    message: 'Terjadi kesalahan pada server: ' + (err.message || 'Internal Server Error'),
    data: null
  });
});

// ==========================================
// Inisialisasi Database dan Menjalankan Server
// ==========================================
const PORT = process.env.PORT || 8081;

const startServer = async () => {
  try {
    // 1. Verifikasi koneksi ke database MySQL
    await sequelize.authenticate();
    console.log('✓ Koneksi ke database MySQL berhasil tersambung.');

    // 2. Sinkronisasi model tabel ke database secara otomatis
    await sequelize.sync({ alter: true });
    console.log('✓ Seluruh tabel model (users, products, shifts, orders, order_items) berhasil disinkronkan.');

    // 3. Menjalankan server Express
    app.listen(PORT, () => {
      console.log(`✓ Server SIPeKa Express.js berjalan aktif pada port :${PORT}`);
      console.log(`✓ Base URL: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    console.error('✗ Gagal memulai server atau menyambungkan ke database:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
