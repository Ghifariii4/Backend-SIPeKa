package config

import (
	"fmt"
	"log"
	"os"
	"time"

	"backend-sipeka/models"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

// ConnectDatabase menginisialisasi koneksi ke database MySQL dan menjalankan AutoMigrate
func ConnectDatabase() {
	// DSN MySQL sesuai aturan konfigurasi SIPeKa (db_sipeka)
	// Default DSN: root:@tcp(127.0.0.1:3306)/db_sipeka?charset=utf8mb4&parseTime=True&loc=Local
	// Jika database berjalan di port lain (misal 8888), dapat diatur melalui environment variable DB_PORT
	dbUser := "root"
	dbPass := ""
	dbHost := "127.0.0.1"
	dbPort := "8888"
	dbName := "db_sipeka"

	if portEnv := os.Getenv("DB_PORT"); portEnv != "" {
		dbPort = portEnv
	}
	if hostEnv := os.Getenv("DB_HOST"); hostEnv != "" {
		dbHost = hostEnv
	}
	if userEnv := os.Getenv("DB_USER"); userEnv != "" {
		dbUser = userEnv
	}
	if passEnv := os.Getenv("DB_PASS"); passEnv != "" {
		dbPass = passEnv
	}
	if nameEnv := os.Getenv("DB_NAME"); nameEnv != "" {
		dbName = nameEnv
	}

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=Local",
		dbUser, dbPass, dbHost, dbPort, dbName)

	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Fatalf("Gagal terhubung ke database MySQL (%s): %v", dsn, err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("Gagal mendapatkan database instance: %v", err)
	}

	// Konfigurasi Connection Pool
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	log.Printf("Koneksi database MySQL ke '%s' berhasil dibangun.", dbName)

	// Jalankan Auto Migration skema database
	err = DB.AutoMigrate(
		&models.User{},
		&models.Product{},
		&models.Shift{},
		&models.Order{},
		&models.OrderItem{},
		&models.Payout{},
	)
	if err != nil {
		log.Fatalf("Gagal melakukan migrasi database: %v", err)
	}

	log.Println("Migrasi tabel database selesai.")

	// Jalankan seed data awal jika database masih kosong
	SeedDatabase()
}

