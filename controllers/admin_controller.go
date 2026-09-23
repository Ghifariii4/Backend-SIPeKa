package controllers

import (
	"errors"
	"net/http"

	"backend-sipeka/config"
	"backend-sipeka/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// CreateUserInternalInput mendefinisikan payload untuk pembuatan user oleh Admin
type CreateUserInternalInput struct {
	NisnNip  string `json:"nisn_nip" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Password string `json:"password" binding:"required"`
	Role     string `json:"role" binding:"required"`
}

// CreateUserInternal membuat akun internal baru (khusus kasir atau admin) oleh Admin
func CreateUserInternal(c *gin.Context) {
	var input CreateUserInternalInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Format data request tidak valid: nisn_nip, name, password, dan role wajib diisi",
		})
		return
	}

	// Validasi role internal yang diizinkan (kasir atau admin)
	if input.Role != "kasir" && input.Role != "admin" {
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Pembuatan akun internal hanya diperbolehkan untuk role 'kasir' atau 'admin'",
		})
		return
	}

	// Cek apakah NISN/NIP sudah terdaftar
	var existingUser models.User
	if err := config.DB.Where("nisn_nip = ?", input.NisnNip).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, models.Response{
			Status:  "error",
			Message: "NISN/NIP sudah terdaftar dalam sistem",
		})
		return
	}

	// Hash password menggunakan bcrypt
	hashedPass, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal mengenkripsi kata sandi",
		})
		return
	}

	// Set is_active = true secara default untuk akun internal yang dibuat admin
	newUser := models.User{
		NisnNip:      input.NisnNip,
		Name:         input.Name,
		PasswordHash: string(hashedPass),
		Role:         input.Role,
		IsActive:     true,
	}

	if err := config.DB.Create(&newUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal menyimpan akun pengguna internal ke database",
		})
		return
	}

	c.JSON(http.StatusCreated, models.Response{
		Status:  "success",
		Message: "Akun pengguna internal berhasil dibuat",
		Data: UserResponseData{
			ID:       newUser.ID,
			NisnNip:  newUser.NisnNip,
			Name:     newUser.Name,
			Role:     newUser.Role,
			IsActive: newUser.IsActive,
		},
	})
}

// ApproveUser menyetujui dan mengaktifkan akun pengguna (terutama penitip) berdasarkan ID
func ApproveUser(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Parameter ID pengguna tidak boleh kosong",
		})
		return
	}

	var user models.User
	err := config.DB.Where("id = ?", id).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, models.Response{
				Status:  "error",
				Message: "Pengguna dengan ID tersebut tidak ditemukan",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Terjadi kesalahan internal saat mencari data pengguna",
		})
		return
	}

	// Update is_active = true
	if err := config.DB.Model(&user).Update("is_active", true).Error; err != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal mengaktifkan akun pengguna",
		})
		return
	}
	user.IsActive = true

	c.JSON(http.StatusOK, models.Response{
		Status:  "success",
		Message: "Akun pengguna berhasil disetujui dan diaktifkan",
		Data: UserResponseData{
			ID:       user.ID,
			NisnNip:  user.NisnNip,
			Name:     user.Name,
			Role:     user.Role,
			IsActive: user.IsActive,
		},
	})
}

// GetUsers mengambil daftar seluruh pengguna dengan filter opsional (role, status is_active)
func GetUsers(c *gin.Context) {
	var users []models.User
	query := config.DB.Model(&models.User{})

	if role := c.Query("role"); role != "" {
		query = query.Where("role = ?", role)
	}
	if active := c.Query("is_active"); active != "" {
		if active == "true" || active == "1" {
			query = query.Where("is_active = ?", true)
		} else if active == "false" || active == "0" {
			query = query.Where("is_active = ?", false)
		}
	}

	if err := query.Order("created_at DESC").Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal mengambil daftar pengguna",
		})
		return
	}

	var result []UserResponseData
	for _, u := range users {
		result = append(result, UserResponseData{
			ID:       u.ID,
			NisnNip:  u.NisnNip,
			Name:     u.Name,
			Role:     u.Role,
			IsActive: u.IsActive,
		})
	}

	c.JSON(http.StatusOK, models.Response{
		Status:  "success",
		Message: "Daftar pengguna berhasil diambil",
		Data:    result,
	})
}
