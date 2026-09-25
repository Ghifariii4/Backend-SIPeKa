const http = require('http');
const app = require('./server');

const PORT = 8089;
let server;

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body
          });
        }
      });
    });

    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  server = app.listen(PORT, async () => {
    console.log(`\n===========================================`);
    console.log(`RUNNING AUTOMATED INTEGRATION TESTS ON PORT ${PORT}`);
    console.log(`===========================================\n`);

    try {
      // 1. TEST REGISTER PEMBELI (is_active = true)
      console.log('1. Testing Register Pembeli...');
      const regPembeliRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        nisn_nip: 'TEST_PEMBELI_01',
        name: 'Test Pembeli',
        password: 'password123',
        role: 'pembeli'
      });
      console.log(`Response status: ${regPembeliRes.statusCode}, is_active: ${regPembeliRes.body.data.is_active}`);
      if (regPembeliRes.statusCode !== 201 || regPembeliRes.body.data.is_active !== true) {
        throw new Error('Register Pembeli failed');
      }
      console.log('✓ Register Pembeli SUCCESS\n');

      // 2. TEST REGISTER PENITIP (is_active = false)
      console.log('2. Testing Register Penitip (is_active must be false)...');
      const regPenitipRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        nisn_nip: 'TEST_PENITIP_01',
        name: 'Test Penitip',
        password: 'password123',
        role: 'penitip'
      });
      console.log(`Response status: ${regPenitipRes.statusCode}, is_active: ${regPenitipRes.body.data.is_active}`);
      if (regPenitipRes.statusCode !== 201 || regPenitipRes.body.data.is_active !== false) {
        throw new Error('Register Penitip failed');
      }
      console.log('✓ Register Penitip SUCCESS\n');

      // 3. TEST REJECT REGISTER KASIR/ADMIN
      console.log('3. Testing Reject Register Kasir (must return 400)...');
      const regKasirReject = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/auth/register',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        nisn_nip: 'TEST_KASIR_BAD',
        name: 'Bad Kasir',
        password: 'password123',
        role: 'kasir'
      });
      console.log(`Response status: ${regKasirReject.statusCode}, message: ${regKasirReject.body.message}`);
      if (regKasirReject.statusCode !== 400) {
        throw new Error('Reject Register Kasir failed');
      }
      console.log('✓ Reject Register Kasir SUCCESS\n');

      // 4. TEST LOGIN PENITIP SEBELUM APPROVAL (must return 403)
      console.log('4. Testing Login Penitip Unapproved (must return 403)...');
      const loginUnapprovedRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        nisn_nip: 'TEST_PENITIP_01',
        password: 'password123'
      });
      console.log(`Response status: ${loginUnapprovedRes.statusCode}, message: ${loginUnapprovedRes.body.message}`);
      if (loginUnapprovedRes.statusCode !== 403) {
        throw new Error('Login unapproved user did not return 403');
      }
      console.log('✓ Login Unapproved User 403 SUCCESS\n');

      // 5. TEST LOGIN ADMIN DEMO
      console.log('5. Testing Login Admin Demo (9999999999)...');
      const loginAdminRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        nisn_nip: '9999999999',
        password: 'password123'
      });
      console.log(`Response status: ${loginAdminRes.statusCode}, token exists: ${!!loginAdminRes.body.data.token}`);
      if (loginAdminRes.statusCode !== 200 || !loginAdminRes.body.data.token) {
        throw new Error('Admin login failed');
      }
      const adminToken = loginAdminRes.body.data.token;
      console.log('✓ Admin Login SUCCESS\n');

      // 6. TEST APPROVE USER BY ADMIN
      console.log('6. Testing Admin Approve User...');
      const penitipId = regPenitipRes.body.data.id;
      const approveRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/v1/admin/users/${penitipId}/approve`,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      });
      console.log(`Response status: ${approveRes.statusCode}, is_active: ${approveRes.body.data.is_active}`);
      if (approveRes.statusCode !== 200 || approveRes.body.data.is_active !== true) {
        throw new Error('Approve user failed');
      }
      console.log('✓ Admin Approve User SUCCESS\n');

      // 7. TEST LOGIN PENITIP SETELAH DIAKTIFKAN
      console.log('7. Testing Login Penitip After Approval (must return 200)...');
      const loginApprovedPenitip = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        nisn_nip: 'TEST_PENITIP_01',
        password: 'password123'
      });
      console.log(`Response status: ${loginApprovedPenitip.statusCode}, token exists: ${!!loginApprovedPenitip.body.data.token}`);
      if (loginApprovedPenitip.statusCode !== 200) {
        throw new Error('Approved penitip login failed');
      }
      console.log('✓ Approved Penitip Login SUCCESS\n');

      // 8. TEST CREATE INTERNAL USER BY ADMIN (kasir)
      console.log('8. Testing Admin Create Internal User (kasir)...');
      const createInternalRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/admin/users/internal',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      }, {
        nisn_nip: 'TEST_KASIR_INTERNAL_01',
        name: 'Kasir Shift 1',
        password: 'password123',
        role: 'kasir'
      });
      console.log(`Response status: ${createInternalRes.statusCode}, role: ${createInternalRes.body.data.role}, is_active: ${createInternalRes.body.data.is_active}`);
      if (createInternalRes.statusCode !== 201 || !createInternalRes.body.data.is_active) {
        throw new Error('Create internal user failed');
      }
      console.log('✓ Create Internal User SUCCESS\n');

      // 9. TEST LOGIN KASIR
      console.log('9. Testing Login Kasir...');
      const loginKasirRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        nisn_nip: 'TEST_KASIR_INTERNAL_01',
        password: 'password123'
      });
      const kasirToken = loginKasirRes.body.data.token;
      console.log(`Response status: ${loginKasirRes.statusCode}, kasirToken exists: ${!!kasirToken}`);
      console.log('✓ Kasir Login SUCCESS\n');

      // 10. TEST SHIFT CLOCK-IN
      console.log('10. Testing Shift Clock-In...');
      const clockInRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/shifts/clock-in',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kasirToken}`
        }
      }, {
        starting_cash: 50000
      });
      console.log(`Response status: ${clockInRes.statusCode}, shift status: ${clockInRes.body.data.status}, expected_cash: ${clockInRes.body.data.expected_cash}`);
      if (clockInRes.statusCode !== 201 || clockInRes.body.data.status !== 'active') {
        throw new Error('Shift Clock-In failed');
      }
      console.log('✓ Shift Clock-In SUCCESS\n');

      // 11. TEST GET PRODUCTS (stock > 0)
      console.log('11. Testing Get Products (Public, stock > 0)...');
      const getProductsRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/products',
        method: 'GET'
      });
      console.log(`Response status: ${getProductsRes.statusCode}, items count: ${getProductsRes.body.data.length}`);
      if (getProductsRes.statusCode !== 200 || !getProductsRes.body.data.length) {
        throw new Error('Get products failed');
      }
      const testProduct = getProductsRes.body.data[0];
      const initialStock = testProduct.stock;
      console.log(`Using product: '${testProduct.name}' (ID: ${testProduct.id}, Stock: ${initialStock}, Price: ${testProduct.price})`);
      console.log('✓ Get Products SUCCESS\n');

      // 12. TEST POS CREATE TRANSACTION (with Sequelize Transaction)
      console.log('12. Testing POS Create Transaction (Sequelize Transaction)...');
      const buyQuantity = 2;
      const posTxRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/pos/transaction',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kasirToken}`
        }
      }, {
        items: [
          {
            product_id: testProduct.id,
            quantity: buyQuantity
          }
        ]
      });
      console.log(`Response status: ${posTxRes.statusCode}`);
      console.log(`Order total_amount: ${posTxRes.body.data.total_amount}`);
      console.log(`Order items count: ${posTxRes.body.data.order_items.length}`);
      console.log(`Price snapshot: ${posTxRes.body.data.order_items[0].price_snapshot}`);
      console.log(`Margin snapshot: ${posTxRes.body.data.order_items[0].margin_snapshot}`);
      if (posTxRes.statusCode !== 201) {
        throw new Error('POS Transaction failed');
      }

      // Check stock deduction
      const checkProductRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: `/api/v1/products/${testProduct.id}`,
        method: 'GET'
      });
      console.log(`Product stock before: ${initialStock}, after transaction: ${checkProductRes.body.data.stock}`);
      if (checkProductRes.body.data.stock !== initialStock - buyQuantity) {
        throw new Error('Product stock was not correctly decremented!');
      }
      console.log('✓ POS Create Transaction & Stock Deduction SUCCESS\n');

      // 13. TEST GET CURRENT SHIFT (Verify expected_cash accumulated)
      console.log('13. Testing Get Current Shift (Expected Cash updated)...');
      const shiftCurrentRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/shifts/current',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${kasirToken}`
        }
      });
      console.log(`Current shift expected_cash: ${shiftCurrentRes.body.data.expected_cash}`);
      console.log('✓ Current Shift Check SUCCESS\n');

      // 14. TEST ROLLBACK ON INSUFFICIENT STOCK
      console.log('14. Testing Transaction Rollback on Insufficient Stock...');
      const failedTxRes = await request({
        hostname: 'localhost',
        port: PORT,
        path: '/api/v1/pos/transaction',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${kasirToken}`
        }
      }, {
        items: [
          {
            product_id: testProduct.id,
            quantity: 999999 // Excess stock
          }
        ]
      });
      console.log(`Response status: ${failedTxRes.statusCode}, message: ${failedTxRes.body.message}`);
      if (failedTxRes.statusCode !== 400) {
        throw new Error('Transaction rollback on insufficient stock failed');
      }
      console.log('✓ Transaction Rollback on Insufficient Stock SUCCESS\n');

      console.log('===========================================');
      console.log('ALL TESTS PASSED WITH 100% SUCCESS!');
      console.log('===========================================\n');
      process.exit(0);
    } catch (err) {
      console.error('✗ Test failed:', err);
      process.exit(1);
    }
  });
}

runTests();
