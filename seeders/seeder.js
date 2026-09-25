require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sequelize, User, Product } = require('../models');

const seedData = async () => {
  try {
    console.log('Menghubungkan ke database MySQL untuk seeding...');
    await sequelize.authenticate();
    await sequelize.sync({ alter: true });

    console.log('Memeriksa dan membuat akun bawaan demo...');
    const defaultPassword = 'password123';
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(defaultPassword, salt);

    // 1. Akun Admin
    const [adminUser] = await User.findOrCreate({
      where: { nisn_nip: '9999999999' },
      defaults: {
        name: 'Administrator SIPeKa',
        password_hash: passwordHash,
        role: 'admin',
        is_active: true
      }
    });
    console.log(`✓ Admin User siap: ${adminUser.name} (${adminUser.nisn_nip})`);

    // 2. Akun Kasir
    const [kasirUser] = await User.findOrCreate({
      where: { nisn_nip: '1234567890' },
      defaults: {
        name: 'Ahmad Kasir',
        password_hash: passwordHash,
        role: 'kasir',
        is_active: true
      }
    });
    console.log(`✓ Kasir User siap: ${kasirUser.name} (${kasirUser.nisn_nip})`);

    // 3. Akun Penitip
    const [penitipUser] = await User.findOrCreate({
      where: { nisn_nip: '1122334455' },
      defaults: {
        name: 'Ibu Siti Penitip',
        password_hash: passwordHash,
        role: 'penitip',
        is_active: true
      }
    });
    console.log(`✓ Penitip User siap: ${penitipUser.name} (${penitipUser.nisn_nip})`);

    // 4. Akun Pembeli
    const [pembeliUser] = await User.findOrCreate({
      where: { nisn_nip: '3344556677' },
      defaults: {
        name: 'Budi Siswa',
        password_hash: passwordHash,
        role: 'pembeli',
        is_active: true
      }
    });
    console.log(`✓ Pembeli User siap: ${pembeliUser.name} (${pembeliUser.nisn_nip})`);

    // 5. Produk Konsinyasi Awal
    const sampleProducts = [
      {
        name: 'Roti Bakar Manis',
        price: 17500.00,
        school_margin: 1000.00,
        stock: 25,
        penitip_id: penitipUser.id
      },
      {
        name: 'Donat Cokelat Keju',
        price: 6000.00,
        school_margin: 500.00,
        stock: 30,
        penitip_id: penitipUser.id
      },
      {
        name: 'Risoles Ayam Sayur',
        price: 4000.00,
        school_margin: 500.00,
        stock: 20,
        penitip_id: penitipUser.id
      },
      {
        name: 'Es Teh Manis Segar',
        price: 3500.00,
        school_margin: 500.00,
        stock: 40,
        penitip_id: penitipUser.id
      }
    ];

    for (const prod of sampleProducts) {
      const existingProduct = await Product.findOne({
        where: { name: prod.name, penitip_id: prod.penitip_id }
      });

      if (!existingProduct) {
        await Product.create(prod);
        console.log(`✓ Produk '${prod.name}' berhasil ditambahkan ke katalog.`);
      } else {
        console.log(`- Produk '${prod.name}' sudah ada di katalog.`);
      }
    }

    console.log('\n===========================================');
    console.log('✓ Seeding data demo selesai dengan sukses!');
    console.log('===========================================');
    console.log('Kredensial Demo (Password semua akun: password123)');
    console.log('1. Admin   : NISN/NIP 9999999999');
    console.log('2. Kasir   : NISN/NIP 1234567890');
    console.log('3. Penitip : NISN/NIP 1122334455');
    console.log('4. Pembeli : NISN/NIP 3344556677');
    console.log('===========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('✗ Terjadi kesalahan saat seeding data:', error);
    process.exit(1);
  }
};

seedData();
