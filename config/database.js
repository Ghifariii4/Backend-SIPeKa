require('dotenv').config();
const { Sequelize } = require('sequelize');

const dbName = process.env.DB_NAME || 'db_sipeka';
const dbUser = process.env.DB_USER || 'root';
const dbPass = process.env.DB_PASS || '';
const dbHost = process.env.DB_HOST || '127.0.0.1';
const dbPort = parseInt(process.env.DB_PORT, 10) || 8888;

const sequelize = new Sequelize(dbName, dbUser, dbPass, {
  host: dbHost,
  port: dbPort,
  dialect: 'mysql',
  logging: process.env.NODE_ENV === 'development' ? false : false,
  timezone: '+07:00',
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

module.exports = sequelize;
