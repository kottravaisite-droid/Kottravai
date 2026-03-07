const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrate() {
    try {
        console.log('🚀 Starting migration...');
        await pool.query(`
            ALTER TABLE products 
            ADD COLUMN IF NOT EXISTS is_gift_bundle_item BOOLEAN DEFAULT FALSE
        `);
        console.log('✅ Column is_gift_bundle_item added successfully');

        // Also ensure price is present and images are present for existing gift items if any
        // (Actually they should be manually managed)

        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

migrate();
