package controllers

import (
	"errors"
	"net/http"

	"backend-sipeka/config"
	"backend-sipeka/middlewares"
	"backend-sipeka/models"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// LoginInput merepresentasikan payload request untuk login
type LoginInput struct {
	NisnNip  string `json:"nisn_nip" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// LoginResponseData merepresentasikan isi data response login
type LoginResponseData struct {
	Token string   `json:"token"`
	User  UserInfo `json:"user"`
}

// UserInfo adalah data user ringkas yang dikembalikan pada response login
type UserInfo struct {
	ID      string `json:"id"`
	NisnNip string `json:"nisn_nip"`
	Name    string `json:"name"`
	Role    string `json:"role"`
}

// Login memproses autentikasi pengguna berdasarkan NISN/NIP dan password
func Login(c *gin.Context) {
	var input LoginInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Format data request tidak valid: nisn_nip dan password wajib diisi",
		})
		return
	}

	var user models.User
	err := config.DB.Where("nisn_nip = ?", input.NisnNip).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusUnauthorized, models.Response{
				Status:  "error",
				Message: "NISN/NIP atau kata sandi tidak sesuai",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Terjadi kesalahan internal pada server",
		})
		return
	}

	// Cek status keaktifan akun user
	if !user.IsActive {
		c.JSON(http.StatusForbidden, models.Response{
			Status:  "error",
			Message: "Akun Anda tidak aktif. Silakan hubungi administrator",
		})
		return
	}

	// Verifikasi hash password menggunakan bcrypt
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.Response{
			Status:  "error",
			Message: "NISN/NIP atau kata sandi tidak sesuai",
		})
		return
	}

	// Buat token JWT yang menyimpan user_id dan role
	token, err := middlewares.GenerateToken(user.ID, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal membuat token autentikasi",
		})
		return
	}

	c.JSON(http.StatusOK, models.Response{
		Status:  "success",
		Message: "Login berhasil",
		Data: LoginResponseData{
			Token: token,
			User: UserInfo{
				ID:      user.ID,
				NisnNip: user.NisnNip,
				Name:    user.Name,
				Role:    user.Role,
			},
		},
	})
}
