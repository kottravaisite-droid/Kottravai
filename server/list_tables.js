const db = require('./db.js');

async function listAll() {
    try {
        const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        const results = [];
        for (const row of tables.rows) {
            const countRes = await db.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
            results.push({ table: row.table_name, count: countRes.rows[0].count });
        }
        console.log('DATA:', JSON.stringify(results));
        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
}
listAll();
