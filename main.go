package main

import (
	"log"
	"os"

	"backend-sipeka/config"
	"backend-sipeka/routes"
)

func main() {
	log.Println("Memulai server SIPeKa (Sistem Informasi PKK SMKN 8)...")

	// Inisialisasi koneksi database MySQL & migrasi skema tabel
	config.ConnectDatabase()

	// Inisialisasi Gin router
	r := routes.SetupRouter()

	// Konfigurasi port server Gin (default :8888)
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server SIPeKa Gin berjalan pada port :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Gagal menjalankan server: %v", err)
	}
}
