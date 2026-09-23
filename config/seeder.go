package config

import (
	"log"

	"backend-sipeka/models"

	"golang.org/x/crypto/bcrypt"
)

// SeedDatabase memastikan akun demo default dan data awal tersedia di database
func SeedDatabase() {
	// Hash password default: "password123"
	hashedPass, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("Gagal hash password seeder: %v", err)
		return
	}

	// 1. Akun Kasir Default (1234567890)
	var kasir models.User
	if err := DB.Where("nisn_nip = ?", "1234567890").First(&kasir).Error; err != nil {
		kasir = models.User{
			NisnNip:      "1234567890",
			Name:         "Ahmad Kasir",
			PasswordHash: string(hashedPass),
			Role:         "kasir",
			IsActive:     true,
		}
		if err := DB.Create(&kasir).Error; err != nil {
			log.Printf("Gagal seed akun kasir: %v", err)
		} else {
			log.Println(" -> Kasir Default berhasil dibuat: NISN/NIP 1234567890 | Password: password123")
		}
	}

	// 2. Akun Penitip Barang Default (1122334455)
	var penitip models.User
	if err := DB.Where("nisn_nip = ?", "1122334455").First(&penitip).Error; err != nil {
		penitip = models.User{
			NisnNip:      "1122334455",
			Name:         "Ibu Siti Penitip",
			PasswordHash: string(hashedPass),
			Role:         "penitip",
			IsActive:     true,
		}
		if err := DB.Create(&penitip).Error; err != nil {
			log.Printf("Gagal seed akun penitip: %v", err)
		} else {
			log.Println(" -> Penitip Default berhasil dibuat: NISN/NIP 1122334455 | Password: password123")
		}
	}

	// 3. Akun Admin Default (9999999999)
	var admin models.User
	if err := DB.Where("nisn_nip = ?", "9999999999").First(&admin).Error; err != nil {
		admin = models.User{
			NisnNip:      "9999999999",
			Name:         "Administrator PKK SMKN 8",
			PasswordHash: string(hashedPass),
			Role:         "admin",
			IsActive:     true,
		}
		if err := DB.Create(&admin).Error; err != nil {
			log.Printf("Gagal seed akun admin: %v", err)
		} else {
			log.Println(" -> Admin Default berhasil dibuat: NISN/NIP 9999999999 | Password: password123")
		}
	}

	// 4. Produk Konsinyasi Awal (jika belum ada produk)
	var productCount int64
	DB.Model(&models.Product{}).Count(&productCount)
	if productCount == 0 {
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
		log.Println(" -> Produk konsinyasi awal berhasil ditambahkan")
	}

	// 5. Dummy Order Pre-Order untuk di-Scan (jika belum ada)
	qrCode := "ORD-PRE-20260923-001"
	var existingOrder models.Order
	if err := DB.Where("qr_code = ?", qrCode).First(&existingOrder).Error; err != nil {
		var sampleProduct models.Product
		if err := DB.First(&sampleProduct).Error; err == nil {
			preOrder := models.Order{
				OrderType:   "pre_order",
				Status:      "pending",
				QrCode:      &qrCode,
				TotalAmount: sampleProduct.Price,
				OrderItems: []models.OrderItem{
					{
						ProductID:      sampleProduct.ID,
						Quantity:       1,
						PriceSnapshot:  sampleProduct.Price,
						MarginSnapshot: sampleProduct.SchoolMargin,
					},
				},
			}
			DB.Create(&preOrder)
			log.Println(" -> Dummy Pre-Order berhasil dibuat: ORD-PRE-20260923-001")
		}
	}
}
