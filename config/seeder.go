package config

import (
	"log"

	"backend-sipeka/models"

	"golang.org/x/crypto/bcrypt"
)

// SeedDatabase mengisi data awal (dummy/demo) jika database masih kosong
func SeedDatabase() {
	var userCount int64
	DB.Model(&models.User{}).Count(&userCount)
	if userCount > 0 {
		return // Database sudah memiliki data, lewati proses seeding
	}

	log.Println("Database masih kosong. Menjalankan auto-seeding data awal untuk pengujian...")

	// Hash password default: "password123"
	hashedPass, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Gagal hash password seeder: %v", err)
		return
	}

	// 1. Akun Kasir
	kasir := models.User{
		NisnNip:      "1234567890",
		Name:         "Ahmad Kasir",
		PasswordHash: string(hashedPass),
		Role:         "kasir",
		IsActive:     true,
	}
	DB.Create(&kasir)

	// 2. Akun Penitip Barang
	penitip := models.User{
		NisnNip:      "1122334455",
		Name:         "Ibu Siti Penitip",
		PasswordHash: string(hashedPass),
		Role:         "penitip",
		IsActive:     true,
	}
	DB.Create(&penitip)

	// 3. Akun Admin
	admin := models.User{
		NisnNip:      "9999999999",
		Name:         "Administrator PKK SMKN 8",
		PasswordHash: string(hashedPass),
		Role:         "admin",
		IsActive:     true,
	}
	DB.Create(&admin)

	// 4. Produk Konsinyasi Awal
	products := []models.Product{
		{
			PenitipID:    penitip.ID,
			Name:         "Roti Bakar Keju",
			Price:        15000,
			SchoolMargin: 1000,
			Stock:        25,
			IsActive:     true,
		},
		{
			PenitipID:    penitip.ID,
			Name:         "Risoles Mayo Spesial",
			Price:        5000,
			SchoolMargin: 500,
			Stock:        30,
			IsActive:     true,
		},
		{
			PenitipID:    penitip.ID,
			Name:         "Teh Kotak Sosro 250ml",
			Price:        4000,
			SchoolMargin: 500,
			Stock:        50,
			IsActive:     true,
		},
	}
	for i := range products {
		DB.Create(&products[i])
	}

	// 5. Dummy Order Pre-Order untuk di-Scan
	qrCode := "ORD-PRE-20260923-001"
	preOrder := models.Order{
		OrderType:   "pre_order",
		Status:      "pending",
		QrCode:      &qrCode,
		TotalAmount: 20000,
		OrderItems: []models.OrderItem{
			{
				ProductID:      products[0].ID,
				Quantity:       1,
				PriceSnapshot:  products[0].Price,
				MarginSnapshot: products[0].SchoolMargin,
			},
			{
				ProductID:      products[1].ID,
				Quantity:       1,
				PriceSnapshot:  products[1].Price,
				MarginSnapshot: products[1].SchoolMargin,
			},
		},
	}
	DB.Create(&preOrder)

	log.Println("Auto-seeding data awal berhasil diselesaikan!")
	log.Println(" -> Kasir Default  : NISN/NIP: 1234567890 | Password: password123")
	log.Println(" -> QR Pre-Order   : ORD-PRE-20260923-001")
}
