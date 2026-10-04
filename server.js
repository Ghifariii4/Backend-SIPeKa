require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sequelize } = require('./models');
const apiRoutes = require('./routes');
const penitipRoutes = require('./routes/penitipRoutes');
const productRoutes = require('./routes/productRoutes');
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

// Menyajikan file statis gambar upload untuk akses client/Android
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/uploads', express.static('public/uploads'));

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
app.use('/api/v1/penitip', penitipRoutes);
app.use('/api/v1/products', productRoutes);

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
    await sequelize.sync();
    
    // Auto-migration aman untuk memastikan kolom baru tersedia di database MySQL live
    const safeAlterQueries = [
      "ALTER TABLE users ADD COLUMN kelas VARCHAR(50) NULL AFTER role;",
      "ALTER TABLE products ADD COLUMN category VARCHAR(50) NULL DEFAULT 'Makanan';",
      "ALTER TABLE products ADD COLUMN description TEXT NULL;",
      "ALTER TABLE products ADD COLUMN image_url VARCHAR(255) NULL;",
      "ALTER TABLE products ADD COLUMN school_margin DECIMAL(12, 2) NOT NULL DEFAULT 1000.00;",
      "ALTER TABLE shifts ADD COLUMN is_validated BOOLEAN NOT NULL DEFAULT FALSE;",
      "ALTER TABLE order_items ADD COLUMN is_paid_to_penitip BOOLEAN NOT NULL DEFAULT FALSE;"
    ];

    for (const q of safeAlterQueries) {
      try {
        await sequelize.query(q);
      } catch (_) {}
    }

    // Pastikan akun demo Admin dan Kasir aktif dengan password default 'password123'
    try {
      const bcrypt = require('bcryptjs');
      const { User } = require('./models');
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash('password123', salt);

      // Admin demo
      const [adminUser, adminCreated] = await User.findOrCreate({
        where: { nisn_nip: '9999999999' },
        defaults: {
          name: 'Administrator SIPeKa',
          password_hash: passwordHash,
          role: 'admin',
          is_active: true
        }
      });
      if (!adminCreated) {
        adminUser.password_hash = passwordHash;
        adminUser.role = 'admin';
        adminUser.is_active = true;
        await adminUser.save();
      }

      // Kasir demo
      const [kasirUser, kasirCreated] = await User.findOrCreate({
        where: { nisn_nip: '1234567890' },
        defaults: {
          name: 'Ahmad Kasir',
          password_hash: passwordHash,
          role: 'kasir',
          is_active: true
        }
      });
      if (!kasirCreated) {
        kasirUser.password_hash = passwordHash;
        kasirUser.role = 'kasir';
        kasirUser.is_active = true;
        await kasirUser.save();
      }
    } catch (seedErr) {
      console.warn('Peringatan saat auto-seed akun demo:', seedErr.message);
    }

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
