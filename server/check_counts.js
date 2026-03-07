const db = require('./db.js');
async function run() {
    try {
        const r = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        for (let row of r.rows) {
            const c = await db.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
            console.log(`TABLE: ${row.table_name} | COUNT: ${c.rows[0].count}`);
        }
        process.exit(0);
    } catch (e) { console.error(e); process.exit(1); }
}
run();
