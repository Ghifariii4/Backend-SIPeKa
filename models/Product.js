const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  penitip_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  school_margin: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 1000.00
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'products',
  timestamps: true,
  underscored: true
});

module.exports = Product;
