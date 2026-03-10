const db = require('./db.js');
const fs = require('fs');

async function runAudit() {
    const report = {};
    try {
        const tables = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%visitor%'");
        report.tables = tables.rows;

        const events = await db.query("SELECT event_name, COUNT(*) as count FROM visitor_events GROUP BY event_name ORDER BY count DESC");
        report.event_types = events.rows;

        const columns = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'visitor_events'");
        report.fields = columns.rows;

        const range = await db.query("SELECT MIN(created_at) as start_date, MAX(created_at) as end_date, COUNT(*) as total_records FROM visitor_events");
        report.data_range = range.rows[0];

        // Top 3 Products
        const topProducts = await db.query("SELECT metadata->>'product_name' as product_name, COUNT(*) as visit_count FROM visitor_events WHERE event_name = 'product_view' GROUP BY metadata->>'product_name' ORDER BY visit_count DESC LIMIT 3");
        report.top_products = topProducts.rows;

        // Avg Time
        const avgTime = await db.query("WITH session_durations AS (SELECT session_id, EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as duration FROM visitor_events GROUP BY session_id HAVING COUNT(*) > 1) SELECT AVG(duration) as avg_seconds FROM session_durations");
        report.avg_time = avgTime.rows[0];

        // Top IPs
        const topIps = await db.query("SELECT ip_address, COUNT(DISTINCT session_id) as session_count FROM visitor_events GROUP BY ip_address HAVING COUNT(DISTINCT session_id) > 1 ORDER BY session_count DESC LIMIT 3");
        report.top_ips = topIps.rows;

        fs.writeFileSync('audit_results.json', JSON.stringify(report, null, 2));
        process.exit(0);
    } catch (err) {
        fs.writeFileSync('audit_error.txt', err.message);
        process.exit(1);
    }
}
runAudit();
