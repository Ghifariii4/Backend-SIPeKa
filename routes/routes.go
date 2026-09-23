package routes

import (
	"net/http"

	"backend-sipeka/controllers"
	"backend-sipeka/middlewares"
	"backend-sipeka/models"

	"github.com/gin-gonic/gin"
)

// corsMiddleware menangani Cross-Origin Resource Sharing (CORS)
func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE, PATCH")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// SetupRouter menginisialisasi router Gin dan mendefinisikan rute-rute API SIPeKa
func SetupRouter() *gin.Engine {
	r := gin.New()

	// Global Middleware
	r.Use(gin.Logger())
	r.Use(gin.Recovery())
	r.Use(corsMiddleware())

	// Health Check Endpoint
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, models.Response{
			Status:  "success",
			Message: "SIPeKa API Server is healthy and running",
		})
	})

	apiV1 := r.Group("/api/v1")
	{
		// Public Routes - Autentikasi (Register & Login)
		authRoutes := apiV1.Group("/auth")
		{
			authRoutes.POST("/register", controllers.Register)
			authRoutes.POST("/login", controllers.Login)
		}

		// Public Routes - Katalog Produk (Bisa diakses siapapun untuk melihat daftar barang & product_id)
		productRoutes := apiV1.Group("/products")
		{
			productRoutes.GET("", controllers.GetProducts)
			productRoutes.GET("/:id", controllers.GetProductByID)
		}

		// Protected Routes - Khusus Admin (Token JWT & Role Admin)
		adminRoutes := apiV1.Group("/admin")
		adminRoutes.Use(middlewares.AuthMiddleware("admin"))
		{
			adminRoutes.GET("/users", controllers.GetUsers)
			adminRoutes.POST("/users", controllers.CreateUserInternal)
			adminRoutes.PUT("/users/:id/approve", controllers.ApproveUser)
		}

		// Protected Routes - Membutuhkan token JWT & role yang sesuai (Kasir / Admin)
		cashierRole := []string{"kasir", "admin"}

		// Routes Sesi Shift Kasir
		shiftRoutes := apiV1.Group("/shifts")
		shiftRoutes.Use(middlewares.AuthMiddleware(cashierRole...))
		{
			shiftRoutes.POST("/clock-in", controllers.ClockInShift)
			shiftRoutes.GET("/current", controllers.GetCurrentShift)
		}

		// Routes Point of Sale (POS)
		posRoutes := apiV1.Group("/pos")
		posRoutes.Use(middlewares.AuthMiddleware(cashierRole...))
		{
			posRoutes.POST("/transaction", controllers.CreateDirectTransaction)
			posRoutes.PUT("/scan/:qr_code", controllers.ScanPreOrder)
		}

		// Routes Riwayat Transaksi / Order
		orderRoutes := apiV1.Group("/orders")
		orderRoutes.Use(middlewares.AuthMiddleware(cashierRole...))
		{
			orderRoutes.GET("", controllers.GetOrders)
			orderRoutes.GET("/:id", controllers.GetOrderByID)
		}
	}

	return r
}
