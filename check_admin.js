
require('dotenv').config();
const oracledb = require('oracledb');

async function checkAdmin() {
    try {
        const conn = await oracledb.getConnection({
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            connectString: process.env.DB_CONNECT_STRING
        });

        const result = await conn.execute(
            "SELECT email, role, status FROM users WHERE email = 'admin@pilltracer.com'"
        );
        console.log('Admin user in DB:', result.rows);

        await conn.close();
    } catch (err) {
        console.error('Check failed:', err);
    }
}

checkAdmin();
