const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkProductsSchema() {
    try {
        const result = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'products'
        `);
        console.log('COLUMNS:' + result.rows.map(r => r.column_name).join(','));
        process.exit(0);
    } catch (error) {
        console.log('ERROR:' + error.message);
        process.exit(1);
    }
}

checkProductsSchema();
