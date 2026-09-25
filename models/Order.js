const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  pembeli_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  shift_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'shifts',
      key: 'id'
    }
  },
  qr_code: {
    type: DataTypes.STRING(100),
    allowNull: true,
    unique: true
  },
  total_amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  order_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'direct'
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'completed'
  }
}, {
  tableName: 'orders',
  timestamps: true,
  underscored: true
});

module.exports = Order;
