package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Response adalah format standar JSON API SIPeKa
type Response struct {
	Status  string      `json:"status"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// User merepresentasikan pengguna sistem SIPeKa
type User struct {
	ID           string    `gorm:"type:char(36);primaryKey" json:"id"`
	NisnNip      string    `gorm:"type:varchar(50);unique;not null;index" json:"nisn_nip"`
	Name         string    `gorm:"type:varchar(100);not null" json:"name"`
	PasswordHash string    `gorm:"type:varchar(255);not null" json:"-"`
	Role         string    `gorm:"type:varchar(20);not null" json:"role"` // pembeli, kasir, penitip, admin
	IsActive     bool      `gorm:"type:boolean;default:true;not null" json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (u *User) BeforeCreate(tx *gorm.DB) (err error) {
	if u.ID == "" {
		u.ID = uuid.New().String()
	}
	return nil
}

// Product merepresentasikan barang konsinyasi PKK
type Product struct {
	ID           string    `gorm:"type:char(36);primaryKey" json:"id"`
	PenitipID    string    `gorm:"type:char(36);not null;index" json:"penitip_id"`
	Penitip      User      `gorm:"foreignKey:PenitipID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;" json:"penitip,omitempty"`
	Name         string    `gorm:"type:varchar(150);not null" json:"name"`
	Price        float64   `gorm:"type:decimal(12,2);not null" json:"price"`
	SchoolMargin float64   `gorm:"type:decimal(12,2);default:1000;not null" json:"school_margin"`
	Stock        int       `gorm:"type:int;not null;default:0" json:"stock"`
	IsActive     bool      `gorm:"type:boolean;default:true;not null" json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

func (p *Product) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}

// Shift merepresentasikan sesi kerja kasir
type Shift struct {
	ID           string     `gorm:"type:char(36);primaryKey" json:"id"`
	KasirID      string     `gorm:"type:char(36);not null;index" json:"kasir_id"`
	Kasir        User       `gorm:"foreignKey:KasirID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;" json:"kasir,omitempty"`
	StartTime    time.Time  `gorm:"not null" json:"start_time"`
	EndTime      *time.Time `gorm:"null" json:"end_time"`
	ExpectedCash float64    `gorm:"type:decimal(12,2);default:0;not null" json:"expected_cash"`
	Status       string     `gorm:"type:varchar(20);default:'active';not null" json:"status"` // active, closed
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

func (s *Shift) BeforeCreate(tx *gorm.DB) (err error) {
	if s.ID == "" {
		s.ID = uuid.New().String()
	}
	return nil
}

// Order merepresentasikan transaksi penjualan (direct atau pre-order)
type Order struct {
	ID          string      `gorm:"type:char(36);primaryKey" json:"id"`
	ShiftID     *string     `gorm:"type:char(36);null;index" json:"shift_id"`
	Shift       *Shift      `gorm:"foreignKey:ShiftID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"shift,omitempty"`
	PembeliID   *string     `gorm:"type:char(36);null;index" json:"pembeli_id"`
	Pembeli     *User       `gorm:"foreignKey:PembeliID;constraint:OnUpdate:CASCADE,OnDelete:SET NULL;" json:"pembeli,omitempty"`
	OrderType   string      `gorm:"type:varchar(20);not null" json:"order_type"`           // pre_order, direct
	Status      string      `gorm:"type:varchar(20);not null" json:"status"`               // pending, completed, cancelled
	QrCode      *string     `gorm:"type:varchar(100);unique;null;index" json:"qr_code"`    // nullable, unique
	TotalAmount float64     `gorm:"type:decimal(12,2);not null;default:0" json:"total_amount"`
	OrderItems  []OrderItem `gorm:"foreignKey:OrderID;constraint:OnUpdate:CASCADE,OnDelete:CASCADE;" json:"order_items,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

func (o *Order) BeforeCreate(tx *gorm.DB) (err error) {
	if o.ID == "" {
		o.ID = uuid.New().String()
	}
	return nil
}

// OrderItem merepresentasikan detail item dalam pesanan
type OrderItem struct {
	ID             string    `gorm:"type:char(36);primaryKey" json:"id"`
	OrderID        string    `gorm:"type:char(36);not null;index" json:"order_id"`
	ProductID      string    `gorm:"type:char(36);not null;index" json:"product_id"`
	Product        Product   `gorm:"foreignKey:ProductID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;" json:"product,omitempty"`
	Quantity       int       `gorm:"type:int;not null" json:"quantity"`
	PriceSnapshot  float64   `gorm:"type:decimal(12,2);not null" json:"price_snapshot"`
	MarginSnapshot float64   `gorm:"type:decimal(12,2);not null" json:"margin_snapshot"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

func (oi *OrderItem) BeforeCreate(tx *gorm.DB) (err error) {
	if oi.ID == "" {
		oi.ID = uuid.New().String()
	}
	return nil
}

// Payout merepresentasikan pencairan dana hasil titipan kepada penitip barang
type Payout struct {
	ID         string    `gorm:"type:char(36);primaryKey" json:"id"`
	PenitipID  string    `gorm:"type:char(36);not null;index" json:"penitip_id"`
	Penitip    User      `gorm:"foreignKey:PenitipID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;" json:"penitip,omitempty"`
	AdminID    string    `gorm:"type:char(36);not null;index" json:"admin_id"`
	Admin      User      `gorm:"foreignKey:AdminID;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT;" json:"admin,omitempty"`
	Amount     float64   `gorm:"type:decimal(12,2);not null" json:"amount"`
	PayoutDate time.Time `gorm:"not null" json:"payout_date"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (p *Payout) BeforeCreate(tx *gorm.DB) (err error) {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	return nil
}
