# SIPeKa Backend REST API (Node.js & Express.js)

> **Sistem Informasi PKK SMKN 8 (SIPeKa)**  
> Dokumentasi teknis antarmuka Application Programming Interface (API) berbasis Node.js, Express.js, Sequelize ORM, dan MySQL untuk aplikasi Point of Sale (POS) kasir kantin/PKK sekolah.

---

## 📋 Daftar Isi
1. [Ringkasan Teknologi & Arsitektur](#-ringkasan-teknologi--arsitektur)
2. [Arsitektur Database (Sequelize Models)](#-arsitektur-database-sequelize-models)
3. [Panduan Instalasi & Menjalankan Server](#-panduan-instalasi--menjalankan-server)
4. [Format Respons Standar](#-format-respons-standar)
5. [Katalog Endpoint API](#-katalog-endpoint-api)
   - [Autentikasi (Auth)](#1-autentikasi-auth)
   - [Manajemen Pengguna oleh Admin](#2-manajemen-pengguna-oleh-admin)
   - [Manajemen Shift Kasir](#3-manajemen-shift-kasir)
   - [Katalog Produk Konsinyasi](#4-katalog-produk-konsinyasi)
   - [Transaksi Kasir (POS) & Pesanan](#5-transaksi-kasir-pos--pesanan)
6. [Pengujian Otomatis (Automated Tests)](#-pengujian-otomatis-automated-tests)

---

## 🛠 Ringkasan Teknologi & Arsitektur

- **Runtime & Framework**: Node.js & Express.js
- **Database & ORM**: MySQL2 dengan Sequelize ORM (`sequelize.sync({ alter: true })`)
- **Autentikasi & Keamanan**: JSON Web Token (`jsonwebtoken`) & Hash Password (`bcryptjs`)
- **Konfigurasi Lingkungan**: `dotenv`
- **CORS Support**: `cors`
- **Primary Key**: UUID Version 4 (`UUIDV4`)
- **Base URL API**: `http://localhost:8081/api/v1`

---

## 🗄 Arsitektur Database (Sequelize Models)

Semua entitas menggunakan `UUID` bertipe `UUIDV4` sebagai Primary Key (`id`):

1. **User (`users`)**:
   - `id`: UUID (PK)
   - `nisn_nip`: String (Unique)
   - `name`: String
   - `password_hash`: String (bcrypt hash)
   - `role`: ENUM (`'pembeli'`, `'kasir'`, `'penitip'`, `'admin'`)
   - `is_active`: Boolean (Default: `true`)

2. **Product (`products`)**:
   - `id`: UUID (PK)
   - `penitip_id`: UUID (FK ke `users.id`)
   - `name`: String
   - `price`: Decimal(12, 2)
   - `school_margin`: Decimal(12, 2) (Default: `1000.00`)
   - `stock`: Integer (Default: `0`)

3. **Shift (`shifts`)**:
   - `id`: UUID (PK)
   - `kasir_id`: UUID (FK ke `users.id`)
   - `start_time`: Date (Default: `NOW`)
   - `end_time`: Date (Nullable)
   - `expected_cash`: Decimal(12, 2) (Default: `0.00`)
   - `status`: ENUM (`'active'`, `'closed'`) (Default: `'active'`)

4. **Order (`orders`)**:
   - `id`: UUID (PK)
   - `pembeli_id`: UUID (FK ke `users.id`, Nullable)
   - `shift_id`: UUID (FK ke `shifts.id`, Nullable)
   - `qr_code`: String (Unique, Nullable)
   - `total_amount`: Decimal(12, 2)
   - `order_type`: String (Default: `'direct'`)
   - `status`: String (Default: `'completed'`)

5. **OrderItem (`order_items`)**:
   - `id`: UUID (PK)
   - `order_id`: UUID (FK ke `orders.id`)
   - `product_id`: UUID (FK ke `products.id`)
   - `quantity`: Integer
   - `price_snapshot`: Decimal(12, 2)
   - `margin_snapshot`: Decimal(12, 2)

---

## 🚀 Panduan Instalasi & Menjalankan Server

### 1. Instalasi Dependencies
Pastikan Node.js v18+ dan MySQL telah terpasang, lalu jalankan:
```bash
npm install
```

### 2. Konfigurasi Lingkungan (`.env`)
Salin file `.env.example` menjadi `.env` lalu sesuaikan port dan kredensial database:
```env
PORT=8081
NODE_ENV=development

DB_HOST=127.0.0.1
DB_PORT=8888
DB_USER=root
DB_PASS=
DB_NAME=db_sipeka

JWT_SECRET=supersecret_jwt_key_sipeka_2026_production
JWT_EXPIRES_IN=24h
```

### 3. Buat Database MySQL
```sql
CREATE DATABASE IF NOT EXISTS db_sipeka CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 4. Menjalankan Seeder Data Demo (Opsional)
Untuk mengisi database dengan akun demo bawaan dan produk awal:
```bash
npm run seed
```

**Kredensial Demo Bawaan (Password semua: `password123`)**:
- **Admin**: NISN/NIP: `9999999999`
- **Kasir**: NISN/NIP: `1234567890`
- **Penitip**: NISN/NIP: `1122334455`
- **Pembeli**: NISN/NIP: `3344556677`

### 5. Menjalankan Server
Mode Development (auto-reload dengan Nodemon):
```bash
npm run dev
```

Mode Production:
```bash
npm start
```

---

## 🔒 Format Respons Standar

Semua endpoint mengembalikan respons dengan format JSON standar:
```json
{
  "status": "success",
  "message": "Pesan deskripsi keberhasilan operasi",
  "data": { ... }
}
```

Jika terjadi kesalahan / validasi gagal:
```json
{
  "status": "error",
  "message": "Pesan deskripsi kesalahan",
  "data": null
}
```

---

## 📡 Katalog Endpoint API

### 1. Autentikasi (Auth)

#### a. Registrasi Mandiri
- **Endpoint**: `POST /api/v1/auth/register`
- **Akses**: Publik
- **Keterangan**:
  - Role `'pembeli'` otomatis `is_active: true`.
  - Role `'penitip'` otomatis `is_active: false` (memerlukan approval admin).
  - Role `'kasir'` / `'admin'` **ditolak** (harus dibuat oleh Admin).
- **Request Body**:
```json
{
  "nisn_nip": "1122334455",
  "name": "Ibu Siti Penitip",
  "password": "password123",
  "role": "penitip"
}
```

#### b. Login
- **Endpoint**: `POST /api/v1/auth/login`
- **Akses**: Publik
- **Keterangan**: Mengembalikan HTTP `403` jika `is_active: false`. Mengembalikan JWT token jika login sukses.
- **Request Body**:
```json
{
  "nisn_nip": "1234567890",
  "password": "password123"
}
```

---

### 2. Manajemen Pengguna oleh Admin

#### a. Menyetujui Akun Pengguna (Approve User)
- **Endpoint**: `PUT /api/v1/admin/users/:id/approve`
- **Akses**: Protected (`verifyToken` + `isAdmin`)
- **Headers**: `Authorization: Bearer <token_admin>`

#### b. Membuat Akun Internal (Kasir / Admin)
- **Endpoint**: `POST /api/v1/admin/users/internal`
- **Akses**: Protected (`verifyToken` + `isAdmin`)
- **Headers**: `Authorization: Bearer <token_admin>`
- **Request Body**:
```json
{
  "nisn_nip": "1234567891",
  "name": "Kasir Shift Siang",
  "password": "password123",
  "role": "kasir"
}
```

---

### 3. Manajemen Shift Kasir

#### a. Buka Sesi Shift (Clock-In)
- **Endpoint**: `POST /api/v1/shifts/clock-in`
- **Akses**: Protected (`verifyToken` + `isKasirOrAdmin`)
- **Headers**: `Authorization: Bearer <token_kasir>`
- **Request Body**:
```json
{
  "starting_cash": 50000
}
```

#### b. Tutup Sesi Shift (Clock-Out)
- **Endpoint**: `POST /api/v1/shifts/clock-out`
- **Akses**: Protected (`verifyToken` + `isKasirOrAdmin`)

#### c. Cek Shift Aktif
- **Endpoint**: `GET /api/v1/shifts/current`
- **Akses**: Protected (`verifyToken` + `isKasirOrAdmin`)

---

### 4. Katalog Produk Konsinyasi

#### a. Mengambil Daftar Produk Aktif (Stok > 0)
- **Endpoint**: `GET /api/v1/products`
- **Akses**: Publik
- **Query Params**: `q` *(opsional, pencarian nama)*

#### b. Tambah Produk Baru
- **Endpoint**: `POST /api/v1/products`
- **Akses**: Protected (`verifyToken`)
- **Request Body**:
```json
{
  "name": "Roti Bakar Manis",
  "price": 17500,
  "school_margin": 1000,
  "stock": 20
}
```

---

### 5. Transaksi Kasir (POS) & Pesanan

#### a. Membuat Transaksi Penjualan (POS Direct)
- **Endpoint**: `POST /api/v1/pos/transaction`
- **Akses**: Protected (`verifyToken` + `isKasirOrAdmin`)
- **Keterangan**: Menggunakan **Sequelize Transaction** untuk validasi stok secara atomik, pemotongan stok otomatis, snapshot harga & margin, dan akumulasi kas fisik (`expected_cash`).
- **Request Body**:
```json
{
  "items": [
    {
      "product_id": "f1a2b3c4-5555-6666-7777-888899990000",
      "quantity": 2
    }
  ]
}
```

#### b. Scan QR Code Pre-Order
- **Endpoint**: `PUT /api/v1/pos/scan/:qr_code`
- **Akses**: Protected (`verifyToken` + `isKasirOrAdmin`)

#### c. Riwayat Transaksi
- **Endpoint**: `GET /api/v1/orders`
- **Akses**: Protected (`verifyToken`)

---

## 🧪 Pengujian Otomatis (Automated Tests)

Skrip pengujian integrasi end-to-end tersedia pada `test_api.js`:
```bash
node test_api.js
```
Skrip ini memvalidasi seluruh alur kerja mulai dari registrasi pembeli/penitip, penolakan registrasi kasir/admin, pengecekan HTTP 403 saat login unapproved, approval user oleh admin, clock-in kasir, pemotongan stok secara atomik dengan Sequelize Transaction, serta rollback jika stok tidak mencukupi.
