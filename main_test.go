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

func seedTestData(t *testing.T) (models.User, models.User, models.Product) {
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

	// 2. Seed User Admin
	admin := models.User{
		NisnNip:      fmt.Sprintf("ADMIN_%d", time.Now().UnixNano()),
		Name:         "Admin SIPeKa Uji",
		PasswordHash: string(hashedPass),
		Role:         "admin",
		IsActive:     true,
	}
	if err := config.DB.Create(&admin).Error; err != nil {
		t.Fatalf("Gagal seed user admin: %v", err)
	}

	// 3. Seed Product
	product := models.Product{
		PenitipID:    admin.ID, // gunakan ID user valid
		Name:         "Roti Bakar Keju Uji",
		Price:        15000,
		SchoolMargin: 1000,
		Stock:        20,
		IsActive:     true,
	}
	if err := config.DB.Create(&product).Error; err != nil {
		t.Fatalf("Gagal seed produk: %v", err)
	}

	return kasir, admin, product
}

// TestRegistrationAndApprovalFlow menguji fitur Register, modifikasi Login, dan Admin User Management
func TestRegistrationAndApprovalFlow(t *testing.T) {
	ts := setupTestApp()
	defer ts.Close()

	_, admin, _ := seedTestData(t)

	var adminToken string
	// 0. Login Admin untuk mendapatkan token admin
	t.Run("0. Login Admin", func(t *testing.T) {
		loginPayload := map[string]string{
			"nisn_nip": admin.NisnNip,
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
			Data struct {
				Token string `json:"token"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		adminToken = res.Data.Token
	})

	// 1. Registrasi Pembeli (Harus langsung is_active = true)
	pembeliNisn := fmt.Sprintf("PEMBELI_%d", time.Now().UnixNano())
	t.Run("1. POST /api/v1/auth/register (Pembeli -> is_active = true)", func(t *testing.T) {
		payload := map[string]string{
			"nisn_nip": pembeliNisn,
			"name":     "Siswa Pembeli Uji",
			"password": "password123",
			"role":     "pembeli",
		}
		bodyBytes, _ := json.Marshal(payload)
		resp, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewBuffer(bodyBytes))
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
				IsActive bool   `json:"is_active"`
				Role     string `json:"role"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		if !res.Data.IsActive {
			t.Errorf("Expected pembeli to be active automatically, got is_active=false")
		}
	})

	// 2. Registrasi Penitip (Harus is_active = false / menunggu persetujuan)
	penitipNisn := fmt.Sprintf("PENITIP_REG_%d", time.Now().UnixNano())
	var pendingPenitipID string
	t.Run("2. POST /api/v1/auth/register (Penitip -> is_active = false)", func(t *testing.T) {
		payload := map[string]string{
			"nisn_nip": penitipNisn,
			"name":     "Ibu Titip Mandiri",
			"password": "password123",
			"role":     "penitip",
		}
		bodyBytes, _ := json.Marshal(payload)
		resp, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewBuffer(bodyBytes))
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
				ID       string `json:"id"`
				IsActive bool   `json:"is_active"`
				Role     string `json:"role"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		if res.Data.IsActive {
			t.Errorf("Expected penitip to be inactive initially, got is_active=true")
		}
		pendingPenitipID = res.Data.ID
	})

	// 3. Registrasi Kasir / Admin Mandiri Ditolak (403 Forbidden)
	t.Run("3. POST /api/v1/auth/register (Kasir/Admin mandiri ditolak 403)", func(t *testing.T) {
		payload := map[string]string{
			"nisn_nip": fmt.Sprintf("HACK_KASIR_%d", time.Now().UnixNano()),
			"name":     "Hacker Kasir",
			"password": "password123",
			"role":     "kasir",
		}
		bodyBytes, _ := json.Marshal(payload)
		resp, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewBuffer(bodyBytes))
		if err != nil {
			t.Fatalf("Request error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("Expected status 403 Forbidden for kasir registration, got %d", resp.StatusCode)
		}
	})

	// 4. Login Penitip Belum Aktif Ditolak (403 Forbidden)
	t.Run("4. POST /api/v1/auth/login (Penitip pending ditolak 403)", func(t *testing.T) {
		loginPayload := map[string]string{
			"nisn_nip": penitipNisn,
			"password": "password123",
		}
		bodyBytes, _ := json.Marshal(loginPayload)
		resp, err := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(bodyBytes))
		if err != nil {
			t.Fatalf("Request error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusForbidden {
			t.Fatalf("Expected status 403 Forbidden for inactive account, got %d", resp.StatusCode)
		}

		var res struct {
			Status  string `json:"status"`
			Message string `json:"message"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		expectedMsg := "Akun Anda sedang menunggu persetujuan Admin. Silakan hubungi pembina PKK."
		if res.Message != expectedMsg {
			t.Errorf("Expected message '%s', got '%s'", expectedMsg, res.Message)
		}
	})

	// 5. Admin Membuat User Internal (POST /api/v1/admin/users)
	internalKasirNisn := fmt.Sprintf("INT_KASIR_%d", time.Now().UnixNano())
	t.Run("5. POST /api/v1/admin/users (Admin buat user kasir)", func(t *testing.T) {
		payload := map[string]string{
			"nisn_nip": internalKasirNisn,
			"name":     "Kasir Internal Baru",
			"password": "password123",
			"role":     "kasir",
		}
		bodyBytes, _ := json.Marshal(payload)
		req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/v1/admin/users", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Authorization", "Bearer "+adminToken)
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
			Data struct {
				IsActive bool   `json:"is_active"`
				Role     string `json:"role"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		if !res.Data.IsActive || res.Data.Role != "kasir" {
			t.Errorf("Expected active kasir user created")
		}
	})

	// 6. Admin Menyetujui Penitip (PUT /api/v1/admin/users/:id/approve)
	t.Run("6. PUT /api/v1/admin/users/:id/approve (Admin approve penitip)", func(t *testing.T) {
		req, _ := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/api/v1/admin/users/%s/approve", ts.URL, pendingPenitipID), nil)
		req.Header.Set("Authorization", "Bearer "+adminToken)

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
			Status  string `json:"status"`
			Message string `json:"message"`
			Data    struct {
				IsActive bool `json:"is_active"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		expectedMsg := "Akun pengguna berhasil disetujui dan diaktifkan"
		if res.Message != expectedMsg {
			t.Errorf("Expected message '%s', got '%s'", expectedMsg, res.Message)
		}
		if !res.Data.IsActive {
			t.Errorf("Expected user is_active = true after approval")
		}
	})

	// 7. Login Penitip Setelah Disetujui (Harus Berhasil 200 OK)
	t.Run("7. POST /api/v1/auth/login (Penitip approved berhasil login)", func(t *testing.T) {
		loginPayload := map[string]string{
			"nisn_nip": penitipNisn,
			"password": "password123",
		}
		bodyBytes, _ := json.Marshal(loginPayload)
		resp, err := http.Post(ts.URL+"/api/v1/auth/login", "application/json", bytes.NewBuffer(bodyBytes))
		if err != nil {
			t.Fatalf("Request error: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Fatalf("Expected status 200 OK after approval, got %d", resp.StatusCode)
		}

		var res struct {
			Status string `json:"status"`
			Data   struct {
				Token string `json:"token"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		if res.Data.Token == "" {
			t.Fatalf("Expected valid token after login approved penitip")
		}
	})
}

func TestCompleteSIPeKaFlow(t *testing.T) {
	ts := setupTestApp()
	defer ts.Close()

	kasir, _, product := seedTestData(t)

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
				ID      string `json:"id"`
				KasirID string `json:"kasir_id"`
				Status  string `json:"status"`
			} `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		if res.Data.ID == "" || res.Data.Status != "active" {
			t.Errorf("Shift gagal dibuat atau tidak aktif: %+v", res)
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

		var res struct {
			Status string       `json:"status"`
			Data   models.Shift `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		if res.Data.KasirID != kasir.ID {
			t.Errorf("Expected shift kasir_id '%s', got '%s'", kasir.ID, res.Data.KasirID)
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
			t.Errorf("Expected products count > 0")
		}
	})

	// ==========================================
	// 6. TEST CREATE DIRECT TRANSACTION
	// ==========================================
	t.Run("6. POST /api/v1/pos/transaction", func(t *testing.T) {
		payload := map[string]interface{}{
			"order_type": "direct",
			"items": []map[string]interface{}{
				{
					"product_id": product.ID,
					"quantity":   2,
				},
			},
		}
		bodyBytes, _ := json.Marshal(payload)
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
			Status string       `json:"status"`
			Data   models.Order `json:"data"`
		}
		json.NewDecoder(resp.Body).Decode(&res)
		expectedTotal := 15000.0 * 2
		if res.Data.TotalAmount != expectedTotal {
			t.Errorf("Expected total amount %f, got %f", expectedTotal, res.Data.TotalAmount)
		}

		// Verifikasi stok produk berkurang di DB
		var updatedProduct models.Product
		config.DB.First(&updatedProduct, "id = ?", product.ID)
		if updatedProduct.Stock != 18 {
			t.Errorf("Expected product stock 18, got %d", updatedProduct.Stock)
		}
	})

	// ==========================================
	// 7. TEST SCAN PRE-ORDER
	// ==========================================
	t.Run("7. PUT /api/v1/pos/scan/:qr_code", func(t *testing.T) {
		qrCode := fmt.Sprintf("PRE-ORDER-TEST-%d", time.Now().UnixNano())
		preOrder := models.Order{
			OrderType:   "pre_order",
			Status:      "pending",
			QrCode:      &qrCode,
			TotalAmount: 15000,
		}
		if err := config.DB.Create(&preOrder).Error; err != nil {
			t.Fatalf("Gagal membuat dummy pre-order: %v", err)
		}

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
