package middlewares

import (
	"net/http"
	"os"
	"strings"
	"time"

	"backend-sipeka/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// JWTClaims mendefinisikan payload token JWT
type JWTClaims struct {
	UserID string `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

// GetJWTSecret mengambil secret key JWT dari environment variable
func GetJWTSecret() []byte {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		secret = "sipeka_super_secret_jwt_key_smkn8_2026"
	}
	return []byte(secret)
}

// GenerateToken membuat JWT token baru untuk user yang berhasil login
func GenerateToken(userID, role string) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &JWTClaims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(GetJWTSecret())
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// AuthMiddleware memvalidasi token JWT dan mengotorisasi role pengguna
func AuthMiddleware(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, models.Response{
				Status:  "error",
				Message: "Header otorisasi tidak ditemukan",
			})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, models.Response{
				Status:  "error",
				Message: "Format token otorisasi tidak valid (harus 'Bearer <token>')",
			})
			c.Abort()
			return
		}

		tokenString := parts[1]
		claims := &JWTClaims{}

		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return GetJWTSecret(), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, models.Response{
				Status:  "error",
				Message: "Token tidak valid atau telah kedaluwarsa",
			})
			c.Abort()
			return
		}

		// Validasi role jika ada pembatasan role
		if len(allowedRoles) > 0 {
			roleAuthorized := false
			for _, role := range allowedRoles {
				if claims.Role == role {
					roleAuthorized = true
					break
				}
			}

			if !roleAuthorized {
				c.JSON(http.StatusForbidden, models.Response{
					Status:  "error",
					Message: "Akses ditolak: Anda tidak memiliki izin untuk mengakses resource ini",
				})
				c.Abort()
				return
			}
		}

		// Simpan user_id dan role ke context Gin
		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)

		c.Next()
	}
}
