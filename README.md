# SIPeKa Backend REST API Documentation
> **Aplikasi PKK SMKN 8 (SIPeKa)**  
> Dokumentasi teknis antarmuka Application Programming Interface (API) untuk tim frontend (Mobile / Android Kotlin Developer).

---

## 📋 Daftar Isi
1. [Ringkasan Teknologi & Arsitektur](#-ringkasan-teknologi--arsitektur)
2. [Panduan Instalasi & Menjalankan Server](#-panduan-instalasi--menjalankan-server)
3. [Format Response & Autentikasi Standar](#-format-response--autentikasi-standar)
4. [Katalog Endpoint API](#-katalog-endpoint-api)
   - [1. Login (Autentikasi Pengguna)](#1-login-autentikasi-pengguna)
   - [2. Clock-In Kasir (Buka Sesi Shift)](#2-clock-in-kasir-buka-sesi-shift)
   - [3. Transaksi Beli Langsung (POS Regular)](#3-transaksi-beli-langsung-pos-regular)
   - [4. Scan QR Code Pre-Order (POS Pengambilan)](#4-scan-qr-code-pre-order-pos-pengambilan)
   - [5. Katalog Produk PKK (Melihat Daftar Barang & Stok)](#5-katalog-produk-pkk-melihat-daftar-barang--stok)
   - [6. Cek Shift Aktif Kasir & Akumulasi Kas](#6-cek-shift-aktif-kasir--akumulasi-kas)
   - [7. Riwayat Pesanan & Detail Transaksi](#7-riwayat-pesanan--detail-transaksi)
5. [Tabel Kode HTTP Status & Error Handling](#-tabel-kode-http-status--error-handling)

---

## 🛠 Ringkasan Teknologi & Arsitektur

- **Bahasa**: Go (Golang) v1.27+
- **Web Framework**: Gin Web Framework (`github.com/gin-gonic/gin`)
- **Database & ORM**: MySQL dengan GORM (`gorm.io/gorm`, `gorm.io/driver/mysql`)
- **Autentikasi**: JWT (JSON Web Token) dengan standard claims via `golang-jwt/jwt/v5`
- **Enkripsi Password**: `bcrypt` (`golang.org/x/crypto/bcrypt`)
- **Primary Key**: UUID v4 (`CHAR(36)`)
- **Base URL API**: `http://localhost:8081/api/v1`

---

## 🚀 Panduan Instalasi & Menjalankan Server

### 1. Prasyarat Sistem
- Go compiler terinstall (minimal Go 1.22+)
- MySQL Server (misal melalui XAMPP, Docker, atau instalasi native)

### 2. Konfigurasi Database MySQL
Pastikan database MySQL telah dibuat sebelum menjalankan server:
```sql
CREATE DATABASE IF NOT EXISTS db_sipeka CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Konfigurasi koneksi database default pada file `config/database.go`:
- **Database Name**: `db_sipeka`
- **Username**: `root`
- **Password**: `""` *(kosong)*
- **Host & Port**: `127.0.0.1:8888` *(atau `3306` sesuai konfigurasi MySQL lokal Anda)*

> **Tip (Opsional)**: Anda dapat meng-override konfigurasi melalui Environment Variable:
> - `DB_USER=root`
> - `DB_PASS=`
> - `DB_HOST=127.0.0.1`
> - `DB_PORT=8888`
> - `DB_NAME=db_sipeka`
> - `PORT=8081`
> - `JWT_SECRET=rahasia_jwt_sipeka`

### 3. Mengunduh Dependencies & Menjalankan Server
Jalankan perintah berikut pada root project:
```bash
# Download dependencies modul Go
go mod tidy

# Jalankan server API (Otomatis melakukan auto-migration tabel)
go run main.go
```
Jika berhasil, terminal akan menampilkan:
```text
Koneksi database MySQL ke 'db_sipeka' berhasil dibangun.
Migrasi tabel database selesai.
Server SIPeKa Gin berjalan pada port :8081
```

### 4. Akun Demo Bawaan (Auto-Seeder)
Server secara otomatis membuatkan data akun dan produk demo saat database masih kosong, sehingga Anda bisa langsung mengujinya di Postman:
- **Akun Kasir**: NISN/NIP: `1234567890` | Kata Sandi: `password123`
- **Akun Penitip**: NISN/NIP: `1122334455` | Kata Sandi: `password123`
- **Akun Admin**: NISN/NIP: `9999999999` | Kata Sandi: `password123`
- **QR Code Pre-Order Pengujian**: `ORD-PRE-20260923-001`

### 5. Menjalankan Automated Test
Untuk memverifikasi seluruh endpoint dan integrasi database secara otomatis:
```bash
go test -v .
```

---

## 🔒 Format Response & Autentikasi Standar

### Standard Response Structure
Seluruh respons API mengembalikan struktur JSON konsisten:
```json
{
  "status": "success",
  "message": "Pesan deskriptif keberhasilan",
  "data": {} // Objek / Array data hasil proses
}
```
Atau jika terjadi error:
```json
{
  "status": "error",
  "message": "Pesan deskriptif penyebab error",
  "data": null
}
```

### Autentikasi (Bearer Token JWT)
Semua endpoint berlabel **Protected** mewajibkan header `Authorization` dengan skema Bearer:
```http
Authorization: Bearer <token_jwt>
```
Token diperoleh saat pengguna berhasil melakukan login pada endpoint `POST /api/v1/auth/login`. Masa berlaku token adalah **24 jam**.

---

## 📡 Katalog Endpoint API

---

### 1. Login (Autentikasi Pengguna)
Digunakan oleh pengguna (pembeli, kasir, penitip, admin) untuk login ke dalam sistem menggunakan nomor induk (NISN/NIP) dan kata sandi.

- **URL Endpoint**: `/api/v1/auth/login`
- **Method**: `POST`
- **Tingkat Akses**: Public (Tidak butuh token)
- **Headers**:
  ```http
  Content-Type: application/json
  ```

#### Request Body
```json
{
  "nisn_nip": "1234567890",
  "password": "password123"
}
```

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Login berhasil",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZTRiMmQ1NmEtMTIzNC00NTY3LTg5YWItY2RlZjAxMjM0NTY3Iiwicm9sZSI6Imthc2lyIiwiZXhwIjoxNzk4MDk0NDAwLCJpYXQiOjE3OTgwMDgwMDB9.s1GZ_sampleTokenSignature",
    "user": {
      "id": "e4b2d56a-1234-4567-89ab-cdef01234567",
      "nisn_nip": "1234567890",
      "name": "Ahmad Kasir",
      "role": "kasir"
    }
  }
}
```

#### Error Responses
- **`400 Bad Request`** (Input tidak lengkap)
  ```json
  {
    "status": "error",
    "message": "Format data request tidak valid: nisn_nip dan password wajib diisi"
  }
  ```
- **`401 Unauthorized`** (Kredensial tidak cocok / tidak ditemukan)
  ```json
  {
    "status": "error",
    "message": "NISN/NIP atau kata sandi tidak sesuai"
  }
  ```
- **`403 Forbidden`** (Akun diblokir / nonaktif)
  ```json
  {
    "status": "error",
    "message": "Akun Anda tidak aktif. Silakan hubungi administrator"
  }
  ```

---

### 2. Clock-In Kasir (Buka Sesi Shift)
Digunakan oleh kasir saat mulai bertugas jaga kasir untuk mencatat jam buka shift dan inisialisasi saldo fisik kasir (`expected_cash`).

- **URL Endpoint**: `/api/v1/shifts/clock-in`
- **Method**: `POST`
- **Tingkat Akses**: Protected (Role: `kasir`, `admin`)
- **Headers**:
  ```http
  Authorization: Bearer <token_jwt>
  Content-Type: application/json
  ```
- **Request Body**: *None* (Kosong)

#### Success Response (`201 Created`)
```json
{
  "status": "success",
  "message": "Sesi shift kasir berhasil dimulai (clock-in)",
  "data": {
    "id": "7a8b9c0d-1111-2222-3333-444455556666",
    "kasir_id": "e4b2d56a-1234-4567-89ab-cdef01234567",
    "start_time": "2026-09-23T07:30:00+07:00",
    "end_time": null,
    "expected_cash": 0,
    "status": "active",
    "created_at": "2026-09-23T07:30:00+07:00",
    "updated_at": "2026-09-23T07:30:00+07:00"
  }
}
```

#### Error Responses
- **`400 Bad Request`** (Kasir masih memiliki sesi shift aktif yang belum ditutup)
  ```json
  {
    "status": "error",
    "message": "Kasir masih memiliki sesi shift yang aktif",
    "data": {
      "id": "7a8b9c0d-1111-2222-3333-444455556666",
      "kasir_id": "e4b2d56a-1234-4567-89ab-cdef01234567",
      "start_time": "2026-09-23T07:30:00+07:00",
      "end_time": null,
      "expected_cash": 0,
      "status": "active",
      "created_at": "2026-09-23T07:30:00+07:00",
      "updated_at": "2026-09-23T07:30:00+07:00"
    }
  }
  ```
- **`401 Unauthorized`** (Token tidak valid / tidak ada)
  ```json
  {
    "status": "error",
    "message": "Token tidak valid atau telah kedaluwarsa"
  }
  ```
- **`403 Forbidden`** (Bukan kasir/admin)
  ```json
  {
    "status": "error",
    "message": "Akses ditolak: Anda tidak memiliki izin untuk mengakses resource ini"
  }
  ```

---

### 3. Transaksi Beli Langsung (POS Regular)
Digunakan saat kasir melayani pembeli langsung di tempat. Sistem melakukan:
1. Validasi keberadaan shift kasir yang aktif.
2. Penguncian baris produk (*Row-Level Locking `SELECT ... FOR UPDATE`*) agar tidak terjadi race condition stok antar kasir.
3. Pemotongan stok barang.
4. Penyimpanan snapshot harga jual dan margin PKK sekolah.
5. Akumulasi total transaksi ke kas fisik kasir (`expected_cash`).

- **URL Endpoint**: `/api/v1/pos/transaction`
- **Method**: `POST`
- **Tingkat Akses**: Protected (Role: `kasir`, `admin`)
- **Headers**:
  ```http
  Authorization: Bearer <token_jwt>
  Content-Type: application/json
  ```

#### Request Body
```json
{
  "items": [
    {
      "product_id": "f1a2b3c4-5555-6666-7777-888899990000",
      "quantity": 2
    },
    {
      "product_id": "d9e8f7a6-1111-2222-3333-444455556666",
      "quantity": 1
    }
  ]
}
```

#### Success Response (`201 Created`)
```json
{
  "status": "success",
  "message": "Transaksi direct POS berhasil diselesaikan",
  "data": {
    "id": "c1d2e3f4-9999-8888-7777-666655554444",
    "shift_id": "7a8b9c0d-1111-2222-3333-444455556666",
    "pembeli_id": null,
    "order_type": "direct",
    "status": "completed",
    "qr_code": null,
    "total_amount": 25000,
    "order_items": [
      {
        "id": "a1b2c3d4-0001-0002-0003-000000000001",
        "order_id": "c1d2e3f4-9999-8888-7777-666655554444",
        "product_id": "f1a2b3c4-5555-6666-7777-888899990000",
        "quantity": 2,
        "price_snapshot": 10000,
        "margin_snapshot": 1000,
        "created_at": "2026-09-23T08:15:30+07:00",
        "updated_at": "2026-09-23T08:15:30+07:00"
      },
      {
        "id": "a1b2c3d4-0001-0002-0003-000000000002",
        "order_id": "c1d2e3f4-9999-8888-7777-666655554444",
        "product_id": "d9e8f7a6-1111-2222-3333-444455556666",
        "quantity": 1,
        "price_snapshot": 5000,
        "margin_snapshot": 500,
        "created_at": "2026-09-23T08:15:30+07:00",
        "updated_at": "2026-09-23T08:15:30+07:00"
      }
    ],
    "created_at": "2026-09-23T08:15:30+07:00",
    "updated_at": "2026-09-23T08:15:30+07:00"
  }
}
```

#### Error Responses
- **`400 Bad Request`** (Kasir belum clock-in)
  ```json
  {
    "status": "error",
    "message": "Tidak ditemukan shift aktif untuk kasir ini. Silakan clock-in terlebih dahulu"
  }
  ```
- **`400 Bad Request`** (Stok tidak cukup)
  ```json
  {
    "status": "error",
    "message": "Stok produk 'Risoles Mayo' tidak mencukupi (tersedia: 1, diminta: 2)"
  }
  ```
- **`400 Bad Request`** (Produk dinonaktifkan)
  ```json
  {
    "status": "error",
    "message": "Produk 'Puding Cokelat' sedang tidak aktif untuk dijual"
  }
  ```
- **`404 Not Found`** (ID produk tidak ada di database)
  ```json
  {
    "status": "error",
    "message": "Produk dengan ID 'xxx-yyy-zzz' tidak ditemukan"
  }
  ```
- **`401 Unauthorized`** (Token tidak valid / expired)
  ```json
  {
    "status": "error",
    "message": "Token tidak valid atau telah kedaluwarsa"
  }
  ```

---

### 4. Scan QR Code Pre-Order (POS Pengambilan)
Digunakan saat pembeli mengambil pesanan pre-order di kasir PKK dengan menunjukkan kode QR unik pesanan. Sistem melakukan:
1. Validasi shift kasir aktif.
2. Mengunci data order untuk menghindari klaim ganda (*Row-Level Locking*).
3. Memastikan status order adalah `pending` dan bertipe `pre_order`.
4. Mengubah status order menjadi `completed` dan menghubungkannya dengan shift kasir yang memproses.
5. Menambahkan nilai total tagihan pesanan ke saldo kas fisik shift kasir (`expected_cash`).

- **URL Endpoint**: `/api/v1/pos/scan/:qr_code`
- **Method**: `PUT`
- **Tingkat Akses**: Protected (Role: `kasir`, `admin`)
- **Headers**:
  ```http
  Authorization: Bearer <token_jwt>
  ```
- **URL Parameter**:
  - `qr_code` *(string, required)*: String QR Code unik pesanan (contoh: `ORD-PRE-20260923-001`).
- **Request Body**: *None* (Kosong)

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Pesanan pre-order berhasil diverifikasi dan diselesaikan",
  "data": {
    "id": "b8a9c0d1-3333-4444-5555-666677778888",
    "shift_id": "7a8b9c0d-1111-2222-3333-444455556666",
    "pembeli_id": "3f4e5d6c-7777-8888-9999-000011112222",
    "order_type": "pre_order",
    "status": "completed",
    "qr_code": "ORD-PRE-20260923-001",
    "total_amount": 35000,
    "order_items": [
      {
        "id": "11223344-aaaa-bbbb-cccc-ddddeeeeffff",
        "order_id": "b8a9c0d1-3333-4444-5555-666677778888",
        "product_id": "f1a2b3c4-5555-6666-7777-888899990000",
        "product": {
          "id": "f1a2b3c4-5555-6666-7777-888899990000",
          "penitip_id": "8c7b6a5d-4444-3333-2222-11110000aaaa",
          "name": "Roti Bakar Manis",
          "price": 17500,
          "school_margin": 1000,
          "stock": 10,
          "is_active": true,
          "created_at": "2026-09-23T06:00:00+07:00",
          "updated_at": "2026-09-23T06:00:00+07:00"
        },
        "quantity": 2,
        "price_snapshot": 17500,
        "margin_snapshot": 1000,
        "created_at": "2026-09-23T06:00:00+07:00",
        "updated_at": "2026-09-23T06:00:00+07:00"
      }
    ],
    "created_at": "2026-09-23T06:00:00+07:00",
    "updated_at": "2026-09-23T08:45:00+07:00"
  }
}
```

#### Error Responses
- **`400 Bad Request`** (Pesanan sudah pernah diselesaikan)
  ```json
  {
    "status": "error",
    "message": "Pesanan pre-order ini sudah pernah diselesaikan sebelumnya"
  }
  ```
- **`400 Bad Request`** (Pesanan telah dibatalkan)
  ```json
  {
    "status": "error",
    "message": "Pesanan pre-order ini telah dibatalkan dan tidak dapat diproses"
  }
  ```
- **`400 Bad Request`** (Tipe pesanan bukan pre_order)
  ```json
  {
    "status": "error",
    "message": "Pesanan ini bukan bertipe pre_order"
  }
  ```
- **`400 Bad Request`** (Kasir belum clock-in)
  ```json
  {
    "status": "error",
    "message": "Tidak ditemukan shift aktif untuk kasir ini. Silakan clock-in terlebih dahulu"
  }
  ```
- **`404 Not Found`** (QR code tidak ditemukan dalam database)
  ```json
  {
    "status": "error",
    "message": "Pesanan dengan QR Code tersebut tidak ditemukan"
  }
  ```
- **`401 Unauthorized`** (Token tidak valid / expired)
  ```json
  {
    "status": "error",
    "message": "Token tidak valid atau telah kedaluwarsa"
  }
  ```

---

### 5. Katalog Produk PKK (Melihat Daftar Barang & Stok)
Digunakan oleh aplikasi kasir dan pembeli untuk mengambil daftar barang konsinyasi PKK yang aktif beserta stok dan harga. Berguna untuk mendapatkan `product_id` sebelum melakukan transaksi.

- **URL Endpoint**: `/api/v1/products`
- **Method**: `GET`
- **Tingkat Akses**: Public
- **Query Parameter (Opsional)**:
  - `q` *(string)*: Pencarian nama produk (contoh: `/api/v1/products?q=roti`)

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Daftar produk berhasil diambil",
  "data": [
    {
      "id": "f1a2b3c4-5555-6666-7777-888899990000",
      "penitip_id": "8c7b6a5d-4444-3333-2222-11110000aaaa",
      "penitip": {
        "id": "8c7b6a5d-4444-3333-2222-11110000aaaa",
        "name": "Ibu Siti Penitip",
        "role": "penitip"
      },
      "name": "Roti Bakar Manis",
      "price": 17500,
      "school_margin": 1000,
      "stock": 10,
      "is_active": true,
      "created_at": "2026-09-23T06:00:00+07:00",
      "updated_at": "2026-09-23T06:00:00+07:00"
    }
  ]
}
```

---

### 6. Cek Shift Aktif Kasir & Akumulasi Kas
Digunakan untuk mengecek apakah kasir yang login sedang memiliki shift aktif, serta memantau jumlah total uang fisik yang harus disetorkan kasir (`expected_cash`).

- **URL Endpoint**: `/api/v1/shifts/current`
- **Method**: `GET`
- **Tingkat Akses**: Protected (Role: `kasir`, `admin`)
- **Headers**:
  ```http
  Authorization: Bearer <token_jwt>
  ```

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Data shift aktif berhasil diambil",
  "data": {
    "id": "7a8b9c0d-1111-2222-3333-444455556666",
    "kasir_id": "e4b2d56a-1234-4567-89ab-cdef01234567",
    "kasir": {
      "id": "e4b2d56a-1234-4567-89ab-cdef01234567",
      "nisn_nip": "1234567890",
      "name": "Ahmad Kasir",
      "role": "kasir"
    },
    "start_time": "2026-09-23T07:30:00+07:00",
    "end_time": null,
    "expected_cash": 60000,
    "status": "active",
    "created_at": "2026-09-23T07:30:00+07:00",
    "updated_at": "2026-09-23T08:45:00+07:00"
  }
}
```

#### Error Response (`404 Not Found`)
```json
{
  "status": "error",
  "message": "Tidak ada sesi shift aktif untuk kasir saat ini. Silakan clock-in terlebih dahulu"
}
```

---

### 7. Riwayat Pesanan & Detail Transaksi
Digunakan untuk melihat seluruh riwayat transaksi penjualan POS dan pesanan pre-order.

- **URL Endpoint**: `/api/v1/orders` (atau `/api/v1/orders/:id` untuk detail spesifik)
- **Method**: `GET`
- **Tingkat Akses**: Protected (Role: `kasir`, `admin`)
- **Headers**:
  ```http
  Authorization: Bearer <token_jwt>
  ```
- **Query Parameter (Opsional)**:
  - `status`: Filter status (`pending`, `completed`, `cancelled`)
  - `order_type`: Filter tipe (`direct`, `pre_order`)
  - `shift_id`: Filter transaksi pada shift tertentu

#### Success Response (`200 OK`)
```json
{
  "status": "success",
  "message": "Daftar riwayat transaksi berhasil diambil",
  "data": [
    {
      "id": "c1d2e3f4-9999-8888-7777-666655554444",
      "shift_id": "7a8b9c0d-1111-2222-3333-444455556666",
      "pembeli_id": null,
      "order_type": "direct",
      "status": "completed",
      "qr_code": null,
      "total_amount": 25000,
      "order_items": [
        {
          "id": "a1b2c3d4-0001-0002-0003-000000000001",
          "order_id": "c1d2e3f4-9999-8888-7777-666655554444",
          "product_id": "f1a2b3c4-5555-6666-7777-888899990000",
          "quantity": 2,
          "price_snapshot": 10000,
          "margin_snapshot": 1000,
          "created_at": "2026-09-23T08:15:30+07:00",
          "updated_at": "2026-09-23T08:15:30+07:00"
        }
      ],
      "created_at": "2026-09-23T08:15:30+07:00",
      "updated_at": "2026-09-23T08:15:30+07:00"
    }
  ]
}
```

---

## 🚦 Tabel Kode HTTP Status & Error Handling

| HTTP Status Code | Makna | Kondisi Terjadinya |
| :--- | :--- | :--- |
| `200 OK` | Berhasil | Operasi baca data (GET) atau update berhasil (PUT). |
| `201 Created` | Berhasil Dibuat | Operasi insert data transaksi / clock-in berhasil (POST). |
| `400 Bad Request` | Kesalahan Input / Validasi Bisnis | Format JSON salah, stok tidak cukup, validasi status shift/order gagal. |
| `401 Unauthorized` | Belum Login / Token Salah | Header `Authorization` tidak dikirim, format token keliru, atau token expired. |
| `403 Forbidden` | Hak Akses Ditolak | Pengguna memiliki token valid namun rolenya tidak diizinkan mengakses rute. |
| `404 Not Found` | Data Tidak Ditemukan | Record produk, order, atau qr_code tidak terdapat pada database. |
| `500 Internal Server Error` | Gangguan Server | Database mati, query gagal, atau kegagalan transaksi sistem. |

---

> 💡 **Panduan untuk Frontend Developer (Android Kotlin)**:
> 1. Gunakan Retrofit / Ktor Client dengan `HttpLoggingInterceptor` level `BODY` untuk melihat traffic JSON secara real-time.
> 2. Simpan token JWT menggunakan **EncryptedSharedPreferences** atau **DataStore** setelah login berhasil.
> 3. Buatlah Interceptor Retrofit (`OkHttp Authenticator / Interceptor`) untuk menyisipkan header `Authorization: Bearer <token>` secara otomatis pada setiap request protected.
> 4. Tangani HTTP `401 Unauthorized` di interceptor untuk otomatis mengarahkan user kembali ke halaman Login.
