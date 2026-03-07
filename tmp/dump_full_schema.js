const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'server', '.env') });
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function dumpSchema() {
    try {
        const tablesResult = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
        `);

        let fullSchema = "# Kottravai Database Schema\n\n";
        fullSchema += "Generated on: " + new Date().toLocaleString() + "\n\n";

        for (const tableRow of tablesResult.rows) {
            const tableName = tableRow.table_name;
            fullSchema += `## Table: \`${tableName}\`\n\n`;

            const columnsResult = await pool.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns 
                WHERE table_name = $1 
                ORDER BY ordinal_position
            `, [tableName]);

            fullSchema += "| Column | Type | Nullable | Default |\n";
            fullSchema += "| --- | --- | --- | --- |\n";

            columnsResult.rows.forEach(col => {
                fullSchema += `| **${col.column_name}** | \`${col.data_type}\` | ${col.is_nullable} | ${col.column_default || ''} |\n`;
            });

            fullSchema += "\n";

            // Get Indexes
            const indexesResult = await pool.query(`
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = $1
            `, [tableName]);

            if (indexesResult.rows.length > 0) {
                fullSchema += "### Indexes\n\n";
                indexesResult.rows.forEach(idx => {
                    fullSchema += `- \`${idx.indexname}\`: \`${idx.indexdef}\`\n`;
                });
                fullSchema += "\n";
            }

            if (tableName === 'products') {
                const countRes = await pool.query('SELECT COUNT(*) FROM products');
                fullSchema += `*Total Records: ${countRes.rows[0].count} products*\n\n`;
            }

            fullSchema += "---\n\n";
        }

        fs.writeFileSync(path.join(__dirname, '..', 'DATABASE_SCHEMA.md'), fullSchema, 'utf8');
        console.log('✅ DATABASE_SCHEMA.md has been generated successfully.');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error dumping schema:', error.message);
        process.exit(1);
    }
}

dumpSchema();
