const admin = require('firebase-admin');
const serviceAccount = require('./config/service-account.json');
const readline = require('readline');
const { query, closeConnection } = require('./db/connection');

// Initialize Firebase Admin
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'pill-tracer-887b2'
});

const auth = admin.auth();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function setupFirebase() {
    try {
        console.log('\n🔧 Setup Wizard for Pill Tracer (Oracle + Firebase Auth)\n');
        console.log('This script will help you set up the Super Admin account.\n');

        // Check if super admin exists in Oracle
        console.log('👤 Checking for super admin account...');
        const users = await query('SELECT * FROM users WHERE role = :1', ['super_admin']);

        if (users.length > 0) {
            console.log('✅ Super admin account already exists in Oracle!\n');
            const superAdmin = users[0];
            console.log(`   Email: ${superAdmin.email}`);
            console.log(`   Status: ${superAdmin.status}\n`);
        } else {
            console.log('⚠️  No super admin found. Let\'s create one!\n');

            const email = await question('Enter super admin email (default: admin@pilltracer.com): ') || 'admin@pilltracer.com';
            const password = await question('Enter super admin password (min 6 chars, default: Admin123!): ') || 'Admin123!';

            if (password.length < 6) {
                console.log('❌ Password must be at least 6 characters!');
                await closeConnection();
                process.exit(1);
            }

            console.log('\n🔨 Creating super admin account...');

            // Create Firebase Auth user
            let userRecord;
            let firebaseUid;
            try {
                userRecord = await auth.createUser({
                    email: email,
                    password: password,
                    emailVerified: true
                });
                firebaseUid = userRecord.uid;
                console.log('✅ Firebase Auth user created!');
            } catch (error) {
                if (error.code === 'auth/email-already-exists') {
                    console.log('⚠️  User already exists in Firebase Auth, fetching...');
                    userRecord = await auth.getUserByEmail(email);
                    firebaseUid = userRecord.uid;
                } else {
                    throw error;
                }
            }

            // Create Super Admin in Oracle
            await query(
                'INSERT INTO users (id, email, pharmacy_name, role, status, phone, address, license_number) VALUES (:1, :2, :3, :4, :5, :6, :7, :8)',
                [firebaseUid, email, 'System Administrator', 'super_admin', 'approved', '', 'System', 'ADMIN-001']
            );

            console.log('✅ Oracle user record created!');
            console.log('\n🎉 Super Admin Account Created Successfully!\n');
            console.log(`   Email: ${email}`);
            console.log(`   Password: ${password}`);
            console.log(`   Role: super_admin`);
            console.log(`   Status: approved\n`);
        }

        console.log('🎊 Setup complete!\n');
        console.log('You can now:');
        console.log('1. Start the server: npm start');
        console.log('2. Visit: http://localhost:3000/auth.html');
        console.log('3. Login with your super admin credentials');

    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.log(error);
    } finally {
        await closeConnection();
        rl.close();
        process.exit(0);
    }
}

setupFirebase();
