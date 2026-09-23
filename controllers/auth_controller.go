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

// RegisterInput merepresentasikan payload request untuk registrasi mandiri
type RegisterInput struct {
	NisnNip  string `json:"nisn_nip" binding:"required"`
	Name     string `json:"name" binding:"required"`
	Password string `json:"password" binding:"required"`
	Role     string `json:"role" binding:"required"`
}

// LoginInput merepresentasikan payload request untuk login
type LoginInput struct {
	NisnNip  string `json:"nisn_nip" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// UserResponseData merepresentasikan data profil pengguna tanpa password hash
type UserResponseData struct {
	ID       string `json:"id"`
	NisnNip  string `json:"nisn_nip"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	IsActive bool   `json:"is_active"`
}

// LoginResponseData merepresentasikan isi data response login
type LoginResponseData struct {
	Token string           `json:"token"`
	User  UserResponseData `json:"user"`
}

// UserInfo adalah alias kompatibilitas untuk response login
type UserInfo = UserResponseData

// Register menangani registrasi akun baru secara mandiri (khusus role 'pembeli' dan 'penitip')
func Register(c *gin.Context) {
	var input RegisterInput
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Format data request tidak valid: nisn_nip, name, password, dan role wajib diisi",
		})
		return
	}

	// Logika Keamanan: Role kasir atau admin dilarang registrasi mandiri
	if input.Role == "kasir" || input.Role == "admin" {
		c.JSON(http.StatusForbidden, models.Response{
			Status:  "error",
			Message: "Role tidak diizinkan untuk registrasi mandiri. Akun kasir dan admin hanya dapat dibuat oleh Admin",
		})
		return
	}

	// Validasi role registrasi mandiri yang diizinkan
	if input.Role != "pembeli" && input.Role != "penitip" {
		c.JSON(http.StatusBadRequest, models.Response{
			Status:  "error",
			Message: "Role tidak valid. Registrasi mandiri hanya diizinkan untuk 'pembeli' atau 'penitip'",
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

	// Logika Approval:
	// - Jika role == "pembeli", langsung aktif (is_active = true)
	// - Jika role == "penitip", menunggu approval admin (is_active = false)
	isActive := false
	if input.Role == "pembeli" {
		isActive = true
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

	newUser := models.User{
		NisnNip:      input.NisnNip,
		Name:         input.Name,
		PasswordHash: string(hashedPass),
		Role:         input.Role,
		IsActive:     isActive,
	}

	if err := config.DB.Select("ID", "NisnNip", "Name", "PasswordHash", "Role", "IsActive").Create(&newUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, models.Response{
			Status:  "error",
			Message: "Gagal menyimpan data pengguna ke database",
		})
		return
	}

	message := "Registrasi berhasil. Akun Anda telah aktif dan dapat langsung digunakan untuk login."
	if !isActive {
		message = "Registrasi berhasil. Akun Anda sedang menunggu persetujuan Admin sebelum dapat digunakan."
	}

	c.JSON(http.StatusCreated, models.Response{
		Status:  "success",
		Message: message,
		Data: UserResponseData{
			ID:       newUser.ID,
			NisnNip:  newUser.NisnNip,
			Name:     newUser.Name,
			Role:     newUser.Role,
			IsActive: newUser.IsActive,
		},
	})
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

	// 1. Verifikasi hash password menggunakan bcrypt
	err = bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(input.Password))
	if err != nil {
		c.JSON(http.StatusUnauthorized, models.Response{
			Status:  "error",
			Message: "NISN/NIP atau kata sandi tidak sesuai",
		})
		return
	}

	// 2. Setelah password divalidasi dengan bcrypt, cek kolom is_active
	if !user.IsActive {
		c.JSON(http.StatusForbidden, models.Response{
			Status:  "error",
			Message: "Akun Anda sedang menunggu persetujuan Admin. Silakan hubungi pembina PKK.",
		})
		return
	}

	// 3. Buat token JWT yang menyimpan user_id dan role
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
			User: UserResponseData{
				ID:       user.ID,
				NisnNip:  user.NisnNip,
				Name:     user.Name,
				Role:     user.Role,
				IsActive: user.IsActive,
			},
		},
	})
}
