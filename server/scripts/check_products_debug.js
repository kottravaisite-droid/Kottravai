const { Pool } = require('pg');
require('dotenv').config({ path: 'e:/Kottravai__1-main/Kottravai__1-main/Kottravai__1-main/Kottravai__1-main/Kottravai__1-main/server/.env' });

const check = async () => {
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        const res = await pool.query("SELECT COUNT(*) FROM products WHERE price < 50");
        console.log('PRODUCTS_BELOW_50: ' + res.rows[0].count);

        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

check();
