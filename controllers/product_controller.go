package controllers

import (
	"errors"
	"net/http"

	"backend-sipeka/config"
	"backend-sipeka/models"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// GetProducts mengambil daftar seluruh produk PKK yang aktif
func GetProducts(c *gin.Context) {
	var products []models.Product

	query := config.DB.Where("is_active = ?", true)

	// Filter pencarian berdasarkan nama produk jika parameter 'q' diberikan
	search := c.Query("q")
	if search != "" {
		query = query.Where("name LIKE ?", "%"+search+"%")
	}

	if err := query.Preload("Penitip", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "name", "role")
	}).Order("created_at DESC").Find(&products).Error; err != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal mengambil data produk",
		})
		return
	}

	c.JSON(http.StatusOK, models.Response{
		Status:  "success",
		Message: "Daftar produk berhasil diambil",
		Data:    products,
	})
}

// GetProductByID mengambil detail produk berdasarkan ID produk
func GetProductByID(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Parameter id produk tidak boleh kosong",
		})
		return
	}

	var product models.Product
	err := config.DB.Preload("Penitip", func(db *gorm.DB) *gorm.DB {
		return db.Select("id", "name", "role")
	}).Where("id = ?", id).First(&product).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, models.Response{
				Status:  "error",
				Message: "Produk tidak ditemukan",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal mengambil detail produk",
		})
		return
	}

	c.JSON(http.StatusOK, models.Response{
		Status:  "success",
		Message: "Detail produk berhasil diambil",
		Data:    product,
	})
}
