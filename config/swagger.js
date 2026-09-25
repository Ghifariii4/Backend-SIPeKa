const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'SIPeKa REST API Documentation',
      version: '1.0.0',
      description: 'Dokumentasi interaktif REST API untuk Sistem Kasir SIPeKa (Sistem Informasi PKK SMKN 8)'
    },
    servers: [
      {
        url: 'http://localhost:8081/api/v1',
        description: 'Development Server (Base URL: /api/v1)'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Masukkan token JWT (contoh: Bearer <token>)'
        }
      }
    }
  },
  apis: ['./routes/*.js', './controllers/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = {
  swaggerUi,
  swaggerSpec
};
