const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Shift = sequelize.define('Shift', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  kasir_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expected_cash: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  status: {
    type: DataTypes.ENUM('active', 'closed'),
    allowNull: false,
    defaultValue: 'active'
  }
}, {
  tableName: 'shifts',
  timestamps: true,
  underscored: true
});

module.exports = Shift;
