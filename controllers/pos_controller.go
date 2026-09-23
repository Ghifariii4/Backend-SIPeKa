package controllers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"backend-sipeka/config"
	"backend-sipeka/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// TransactionItemInput merepresentasikan input per item untuk transaksi POS direct
type TransactionItemInput struct {
	ProductID string `json:"product_id" binding:"required"`
	Quantity  int    `json:"quantity" binding:"required,min=1"`
}

// TransactionRequest merepresentasikan request body untuk transaksi POS direct
type TransactionRequest struct {
	Items []TransactionItemInput `json:"items" binding:"required,min=1,dive"`
}

// ClockInShift memulai sesi shift baru untuk kasir yang sedang login
func ClockInShift(c *gin.Context) {
	kasirID := c.GetString("user_id")
	if kasirID == "" {
		c.JSON(http.StatusUnauthorized, models.Response{
			Status:  "error",
			Message: "Pengguna tidak terautentikasi",
		})
		return
	}

	// Cek apakah kasir masih memiliki shift dengan status 'active'
	var existingShift models.Shift
	err := config.DB.Where("kasir_id = ? AND status = ?", kasirID, "active").First(&existingShift).Error
	if err == nil {
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Kasir masih memiliki sesi shift yang aktif",
			Data:    existingShift,
		})
		return
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal memeriksa status shift kasir",
		})
		return
	}

	// Buat shift baru
	newShift := models.Shift{
		KasirID:      kasirID,
		StartTime:    time.Now(),
		ExpectedCash: 0,
		Status:       "active",
	}

	if err := config.DB.Create(&newShift).Error; err != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal memulai sesi shift kasir",
		})
		return
	}

	c.JSON(http.StatusCreated, models.Response{
		Status:  "success",
		Message: "Sesi shift kasir berhasil dimulai (clock-in)",
		Data:    newShift,
	})
}

// CreateDirectTransaction menangani transaksi langsung POS dengan GORM Transaction & Row Locking
func CreateDirectTransaction(c *gin.Context) {
	kasirID := c.GetString("user_id")
	if kasirID == "" {
		c.JSON(http.StatusUnauthorized, models.Response{
			Status:  "error",
			Message: "Pengguna tidak terautentikasi",
		})
		return
	}

	// Validasi request body
	var req TransactionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: fmt.Sprintf("Format request transaksi tidak valid: %v", err.Error()),
		})
		return
	}

	// Cari shift aktif kasir
	var activeShift models.Shift
	if err := config.DB.Where("kasir_id = ? AND status = ?", kasirID, "active").First(&activeShift).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, models.Response{
				Status:  "error",
				Message: "Tidak ditemukan shift aktif untuk kasir ini. Silakan clock-in terlebih dahulu",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal mengambil data shift kasir",
		})
		return
	}

	// Mulai Database Transaction
	tx := config.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal memulai transaksi database",
		})
		return
	}

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var totalAmount float64 = 0
	var orderItems []models.OrderItem

	// Proses setiap item pesanan dengan Row Locking
	for _, item := range req.Items {
		var product models.Product

		// Row Locking: SELECT ... FOR UPDATE untuk mencegah Race Condition stok
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", item.ProductID).First(&product).Error; err != nil {
			tx.Rollback()
			if errors.Is(err, gorm.ErrRecordNotFound) {
				c.JSON(http.StatusNotFound, models.Response{
					Status:  "error",
					Message: fmt.Sprintf("Produk dengan ID '%s' tidak ditemukan", item.ProductID),
				})
				return
			}
			c.JSON(http.StatusInternalServerError, models.Response{
				Status:  "error",
				Message: "Terjadi kesalahan saat mengunci baris data produk",
			})
			return
		}

		// Validasi status aktif produk
		if !product.IsActive {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, models.Response{
				Status:  "error",
				Message: fmt.Sprintf("Produk '%s' sedang tidak aktif untuk dijual", product.Name),
			})
			return
		}

		// Validasi ketersediaan stok
		if product.Stock < item.Quantity {
			tx.Rollback()
			c.JSON(http.StatusBadRequest, models.Response{
				Status:  "error",
				Message: fmt.Sprintf("Stok produk '%s' tidak mencukupi (tersedia: %d, diminta: %d)", product.Name, product.Stock, item.Quantity),
			})
			return
		}

		// Potong stok produk
		product.Stock -= item.Quantity
		if err := tx.Save(&product).Error; err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, models.Response{
				Status:  "error",
				Message: fmt.Sprintf("Gagal memperbarui stok produk '%s'", product.Name),
			})
			return
		}

		// Hitung subtotal
		subtotal := product.Price * float64(item.Quantity)
		totalAmount += subtotal

		// Siapkan snapshot order item
		orderItems = append(orderItems, models.OrderItem{
			ProductID:      product.ID,
			Quantity:       item.Quantity,
			PriceSnapshot:  product.Price,
			MarginSnapshot: product.SchoolMargin,
		})
	}

	// Buat Order baru
	order := models.Order{
		ShiftID:     &activeShift.ID,
		PembeliID:   nil,
		OrderType:   "direct",
		Status:      "completed",
		QrCode:      nil,
		TotalAmount: totalAmount,
		OrderItems:  orderItems,
	}

	if err := tx.Create(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal menyimpan transaksi pesanan",
		})
		return
	}

	// Update expected_cash pada shift kasir
	newExpectedCash := activeShift.ExpectedCash + totalAmount
	if err := tx.Model(&models.Shift{}).Where("id = ?", activeShift.ID).Update("expected_cash", newExpectedCash).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal memperbarui total expected_cash pada shift kasir",
		})
		return
	}

	// Commit Transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal menyelesaikan commit transaksi database",
		})
		return
	}

	c.JSON(http.StatusCreated, models.Response{
		Status:  "success",
		Message: "Transaksi direct POS berhasil diselesaikan",
		Data:    order,
	})
}

// ScanPreOrder memvalidasi QR Code pesanan pre-order, mengubah status menjadi 'completed', dan update expected_cash shift
func ScanPreOrder(c *gin.Context) {
	kasirID := c.GetString("user_id")
	if kasirID == "" {
		c.JSON(http.StatusUnauthorized, models.Response{
			Status:  "error",
			Message: "Pengguna tidak terautentikasi",
		})
		return
	}

	qrCode := c.Param("qr_code")
	if qrCode == "" {
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Parameter qr_code tidak boleh kosong",
		})
		return
	}

	// Cek shift aktif kasir
	var activeShift models.Shift
	if err := config.DB.Where("kasir_id = ? AND status = ?", kasirID, "active").First(&activeShift).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusBadRequest, models.Response{
				Status:  "error",
				Message: "Tidak ditemukan shift aktif untuk kasir ini. Silakan clock-in terlebih dahulu",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal mengambil data shift kasir",
		})
		return
	}

	// Mulai Database Transaction
	tx := config.DB.Begin()
	if tx.Error != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal memulai transaksi database",
		})
		return
	}

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Cari pesanan berdasarkan qr_code dengan Row Locking
	var order models.Order
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("OrderItems.Product").Where("qr_code = ?", qrCode).First(&order).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, models.Response{
				Status:  "error",
				Message: "Pesanan dengan QR Code tersebut tidak ditemukan",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Terjadi kesalahan saat memproses data pesanan",
		})
		return
	}

	// Validasi tipe order
	if order.OrderType != "pre_order" {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Pesanan ini bukan bertipe pre_order",
		})
		return
	}

	// Validasi status order
	if order.Status == "completed" {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Pesanan pre-order ini sudah pernah diselesaikan sebelumnya",
		})
		return
	}

	if order.Status == "cancelled" {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Pesanan pre-order ini telah dibatalkan dan tidak dapat diproses",
		})
		return
	}

	if order.Status != "pending" {
		tx.Rollback()
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: fmt.Sprintf("Status pesanan tidak valid (%s) untuk diselesaikan", order.Status),
		})
		return
	}

	// Update order status menjadi completed dan pasangkan ke shift aktif kasir saat ini
	order.Status = "completed"
	order.ShiftID = &activeShift.ID

	if err := tx.Save(&order).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal memperbarui status pesanan",
		})
		return
	}

	// Update expected_cash pada shift kasir
	newExpectedCash := activeShift.ExpectedCash + order.TotalAmount
	if err := tx.Model(&models.Shift{}).Where("id = ?", activeShift.ID).Update("expected_cash", newExpectedCash).Error; err != nil {
		tx.Rollback()
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal memperbarui total expected_cash pada shift kasir",
		})
		return
	}

	// Commit Transaction
	if err := tx.Commit().Error; err != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal menyelesaikan commit transaksi database",
		})
		return
	}

	c.JSON(http.StatusOK, models.Response{
		Status:  "success",
		Message: "Pesanan pre-order berhasil diverifikasi dan diselesaikan",
		Data:    order,
	})
}

// GetCurrentShift mengambil informasi sesi shift yang sedang aktif untuk kasir saat ini
func GetCurrentShift(c *gin.Context) {
	kasirID := c.GetString("user_id")
	if kasirID == "" {
		c.JSON(http.StatusUnauthorized, models.Response{
			Status:  "error",
			Message: "Pengguna tidak terautentikasi",
		})
		return
	}

	var activeShift models.Shift
	err := config.DB.Preload("Kasir", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "name", "nisn_nip", "role")
	}).Where("kasir_id = ? AND status = ?", kasirID, "active").First(&activeShift).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, models.Response{
				Status:  "error",
				Message: "Tidak ada sesi shift aktif untuk kasir saat ini. Silakan clock-in terlebih dahulu",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal mengambil data shift kasir",
		})
		return
	}

	c.JSON(http.StatusOK, models.Response{
		Status:  "success",
		Message: "Data shift aktif berhasil diambil",
		Data:    activeShift,
	})
}

// GetOrders mengambil riwayat transaksi pesanan (dapat difilter berdasarkan shift_id atau status)
func GetOrders(c *gin.Context) {
	var orders []models.Order

	query := config.DB.Preload("OrderItems.Product").Preload("Shift").Preload("Pembeli", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "name", "nisn_nip", "role")
	})

	if shiftID := c.Query("shift_id"); shiftID != "" {
		query = query.Where("shift_id = ?", shiftID)
	}
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}
	if orderType := c.Query("order_type"); orderType != "" {
		query = query.Where("order_type = ?", orderType)
	}

	if err := query.Order("created_at DESC").Find(&orders).Error; err != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal mengambil daftar riwayat transaksi",
		})
		return
	}

	c.JSON(http.StatusOK, models.Response{
		Status:  "success",
		Message: "Daftar riwayat transaksi berhasil diambil",
		Data:    orders,
	})
}

// GetOrderByID mengambil detail transaksi pesanan berdasarkan ID pesanan
func GetOrderByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Parameter id transaksi tidak boleh kosong",
		})
		return
	}

	var order models.Order
	err := config.DB.Preload("OrderItems.Product").Preload("Shift").Preload("Pembeli", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "name", "nisn_nip", "role")
	}).Where("id = ?", id).First(&order).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, models.Response{
				Status:  "error",
				Message: "Data transaksi pesanan tidak ditemukan",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal mengambil detail transaksi",
		})
		return
	}

	c.JSON(http.StatusOK, models.Response{
		Status:  "success",
		Message: "Detail transaksi berhasil diambil",
		Data:    order,
	})
}

