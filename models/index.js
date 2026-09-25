const { Sequelize, Op } = require('sequelize');
const sequelize = require('../config/database');

const User = require('./User');
const Product = require('./Product');
const Shift = require('./Shift');
const Order = require('./Order');
const OrderItem = require('./OrderItem');

// 1. User (penitip) <-> Product
User.hasMany(Product, { foreignKey: 'penitip_id', as: 'products' });
Product.belongsTo(User, { foreignKey: 'penitip_id', as: 'penitip' });

// 2. User (kasir) <-> Shift
User.hasMany(Shift, { foreignKey: 'kasir_id', as: 'shifts' });
Shift.belongsTo(User, { foreignKey: 'kasir_id', as: 'kasir' });

// 3. User (pembeli) <-> Order
User.hasMany(Order, { foreignKey: 'pembeli_id', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'pembeli_id', as: 'pembeli' });

// 4. Shift <-> Order
Shift.hasMany(Order, { foreignKey: 'shift_id', as: 'orders' });
Order.belongsTo(Shift, { foreignKey: 'shift_id', as: 'shift' });

// 5. Order <-> OrderItem
Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'order_items' });
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' });

// 6. Product <-> OrderItem
Product.hasMany(OrderItem, { foreignKey: 'product_id', as: 'order_items' });
OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' });

module.exports = {
  sequelize,
  Sequelize,
  Op,
  User,
  Product,
  Shift,
  Order,
  OrderItem
};
