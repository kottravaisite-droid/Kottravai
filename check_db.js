const { Pool } = require('pg');
require('dotenv').config({ path: './server/.env' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
    try {
        const res = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'orders'");
        console.log('Columns:', res.rows.map(r => r.column_name).sort().join(', '));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pool.end();
    }
}

checkColumns();
