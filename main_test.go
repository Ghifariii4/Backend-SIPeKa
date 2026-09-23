package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"backend-sipeka/config"
	"backend-sipeka/models"
	"backend-sipeka/routes"

	"golang.org/x/crypto/bcrypt"
)

func setupTestApp() *httptest.Server {
	config.ConnectDatabase()
	r := routes.SetupRouter()
	return httptest.NewServer(r)
}

func seedTestData(t *testing.T) (models.User, models.Product) {
	// Buat hash password
	hashedPass, err := bcrypt.GenerateFromPassword([]byte("password123"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("Gagal hash password: %v", err)
	}

	// 1. Seed User Kasir
	kasir := models.User{
		NisnNip:      fmt.Sprintf("KASIR_%d", time.Now().UnixNano()),
		Name:         "Ahmad Kasir Uji",
		PasswordHash: string(hashedPass),
		Role:         "kasir",
		IsActive:     true,
	}
	if err := config.DB.Create(&kasir).Error; err != nil {
		t.Fatalf("Gagal seed user kasir: %v", err)
	}

	// 2. Seed User Penitip
	penitip := models.User{
		NisnNip:      fmt.Sprintf("PENITIP_%d", time.Now().UnixNano()),
		Name:         "Ibu Siti Penitip Uji",
		PasswordHash: string(hashedPass),
		Role:         "penitip",
		IsActive:     true,
	}
	if err := config.DB.Create(&penitip).Error; err != nil {
		t.Fatalf("Gagal seed user penitip: %v", err)
	}

	// 3. Seed Product
	product := models.Product{
		PenitipID:    penitip.ID,
		Name:         "Roti Bakar Keju Uji",
		Price:        15000,
		SchoolMargin: 1000,
		Stock:        20,
		IsActive:     true,
	}
	if err := config.DB.Create(&product).Error; err != nil {
		t.Fatalf("Gagal seed produk: %v", err)
	}

	return kasir, product
}

func TestCompleteSIPeKaFlow(t *testing.T) {
	ts := setupTestApp()
	defer ts.Close()

	kasir, product := seedTestData(t)

	// ==========================================
	// 1. TEST HEALTH CHECK
	// ==========================================
	t.Run("1. GET /health", func(t *testing.T) {
		resp, err := http.Get(ts.URL + "/health")
		if err != nil {
			t.Fatalf("Request error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}
	})

	// ==========================================
	// 2. TEST AUTH LOGIN
	// ==========================================
	var jwtToken string
	t.Run("2. POST /api/v1/auth/login", func(t *testing.T) {
		loginPayload := map[string]string{
			"nisn_nip": kasir.NisnNip,
			"password": "password123",
		}
		bodyBytes, _ := json.Marshal(loginPayload)
		resp, err := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(bodyBytes))
		if err != nil {
			t.Fatalf("Request error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200, got %d", resp.StatusCode)
		}

		var res struct {
			Status string `json:"status"`
			Data   struct {
				Token string `json:"token"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		if res.Data.Token == "" {
			t.Fatalf("Token tidak boleh kosong")
		}
		jwtToken = res.Data.Token
	})

	// ==========================================
	// 3. TEST CLOCK-IN KASIR
	// ==========================================
	t.Run("3. POST /api/v1/shifts/clock-in", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/v1/shifts/clock-in", nil)
		req.Header.Set("Authorization", "Bearer "+jwtToken)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Request error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("Expected status 201 Created, got %d", resp.StatusCode)
		}

		var res struct {
			Status string `json:"status"`
			Data   struct {
				ID           string  `json:"id"`
				Status       string  `json:"status"`
				ExpectedCash float64 `json:"expected_cash"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		if res.Data.Status != "active" {
			t.Errorf("Expected shift status 'active', got '%s'", res.Data.Status)
		}
	})

	// ==========================================
	// 4. TEST GET CURRENT SHIFT
	// ==========================================
	t.Run("4. GET /api/v1/shifts/current", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/v1/shifts/current", nil)
		req.Header.Set("Authorization", "Bearer "+jwtToken)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Request error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200 OK, got %d", resp.StatusCode)
		}
	})

	// ==========================================
	// 5. TEST GET PRODUCTS
	// ==========================================
	t.Run("5. GET /api/v1/products", func(t *testing.T) {
		resp, err := http.Get(ts.URL + "/api/v1/products")
		if err != nil {
			t.Fatalf("Request error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200 OK, got %d", resp.StatusCode)
		}

		var res struct {
			Status string           `json:"status"`
			Data   []models.Product `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		if len(res.Data) == 0 {
			t.Errorf("Expected at least 1 product")
		}
	})

	// ==========================================
	// 6. TEST POS DIRECT TRANSACTION WITH ROW LOCKING
	// ==========================================
	t.Run("6. POST /api/v1/pos/transaction", func(t *testing.T) {
		trxPayload := map[string]interface{}{
			"items": []map[string]interface{}{
				{
					"product_id": product.ID,
					"quantity":   2,
				},
			},
		}
		bodyBytes, _ := json.Marshal(trxPayload)
		req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/v1/pos/transaction", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Authorization", "Bearer "+jwtToken)
		req.Header.Set("Content-Type", "application/json")

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Request error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("Expected status 201 Created, got %d", resp.StatusCode)
		}

		var res struct {
			Status string `json:"status"`
			Data   struct {
				TotalAmount float64 `json:"total_amount"`
				Status      string  `json:"status"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)

		// 2 x 15000 = 30000
		if res.Data.TotalAmount != 30000 {
			t.Errorf("Expected total amount 30000, got %f", res.Data.TotalAmount)
		}

		// Verifikasi stok produk berkurang dari 20 jadi 18
		var updatedProduct models.Product
		config.DB.First(&updatedProduct, "id = ?", product.ID)
		if updatedProduct.Stock != 18 {
			t.Errorf("Expected stock 18, got %d", updatedProduct.Stock)
		}
	})

	// ==========================================
	// 7. TEST SCAN PRE-ORDER
	// ==========================================
	t.Run("7. PUT /api/v1/pos/scan/:qr_code", func(t *testing.T) {
		// Buat dummy pre-order berstatus pending
		qrCode := fmt.Sprintf("PRE-ORDER-TEST-%d", time.Now().UnixNano())
		preOrder := models.Order{
			OrderType:   "pre_order",
			Status:      "pending",
			QrCode:      &qrCode,
			TotalAmount: 15000,
		}
		config.DB.Create(&preOrder)

		req, _ := http.NewRequest(http.MethodPut, ts.URL+"/api/v1/pos/scan/"+qrCode, nil)
		req.Header.Set("Authorization", "Bearer "+jwtToken)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Request error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200 OK, got %d", resp.StatusCode)
		}

		// Cek di DB status berubah jadi completed
		var updatedOrder models.Order
		config.DB.First(&updatedOrder, "id = ?", preOrder.ID)
		if updatedOrder.Status != "completed" {
			t.Errorf("Expected order status 'completed', got '%s'", updatedOrder.Status)
		}
	})

	// ==========================================
	// 8. TEST GET ORDERS
	// ==========================================
	t.Run("8. GET /api/v1/orders", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/v1/orders", nil)
		req.Header.Set("Authorization", "Bearer "+jwtToken)

		client := &http.Client{}
		resp, err := client.Do(req)
		if err != nil {
			t.Fatalf("Request error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200 OK, got %d", resp.StatusCode)
		}

		var res struct {
			Status string         `json:"status"`
			Data   []models.Order `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		if len(res.Data) == 0 {
			t.Errorf("Expected at least 1 order in list")
		}
	})
}
