const db = require('./db.js');

async function runAudit() {
    try {
        console.log('--- START AUDIT ---');

        // 1. Tables
        const tablesResult = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE '%visitor%'");
        console.log('TABLES:', JSON.stringify(tablesResult.rows));

        // 2. Event Types & Counts
        const eventsResult = await db.query("SELECT event_name, COUNT(*) as count FROM visitor_events GROUP BY event_name ORDER BY count DESC");
        console.log('EVENT_TYPES:', JSON.stringify(eventsResult.rows));

        // 3. Columns
        const columnsResult = await db.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'visitor_events'");
        console.log('FIELDS:', JSON.stringify(columnsResult.rows));

        // 4. Data Range
        const rangeResult = await db.query("SELECT MIN(created_at) as start_date, MAX(created_at) as end_date, COUNT(*) as total_records FROM visitor_events");
        console.log('DATA_RANGE:', JSON.stringify(rangeResult.rows));

        // 5. Top 3 Products
        const topProductsResult = await db.query(`
            SELECT 
                metadata->>'product_name' as product_name, 
                metadata->>'product_id' as product_id,
                COUNT(*) as visit_count 
            FROM visitor_events 
            WHERE event_name = 'product_view' 
            GROUP BY metadata->>'product_name', metadata->>'product_id' 
            ORDER BY visit_count DESC 
            LIMIT 3
        `);
        console.log('TOP_3_PRODUCTS:', JSON.stringify(topProductsResult.rows));

        // 6. Average Time Spent on Site (Session Duration)
        const avgTimeResult = await db.query(`
            WITH session_durations AS (
                SELECT 
                    session_id, 
                    EXTRACT(EPOCH FROM (MAX(created_at) - MIN(created_at))) as duration_seconds
                FROM visitor_events
                GROUP BY session_id
                HAVING COUNT(*) > 1  -- Only sessions with more than one event to measure duration
            )
            SELECT AVG(duration_seconds) as avg_duration_seconds FROM session_durations
        `);
        console.log('AVG_TIME_ON_SITE:', JSON.stringify(avgTimeResult.rows));

        // 7. Top 3 Repeatedly Visiting IPs
        const topIPsResult = await db.query(`
            SELECT ip_address, COUNT(DISTINCT session_id) as sessions_count 
            FROM visitor_events 
            GROUP BY ip_address 
            HAVING COUNT(DISTINCT session_id) > 1
            ORDER BY sessions_count DESC 
            LIMIT 3
        `);
        console.log('TOP_3_IPS:', JSON.stringify(topIPsResult.rows));

        // 8. Product-level visit frequency
        const productFreqResult = await db.query(`
            SELECT 
                metadata->>'product_name' as product_name, 
                COUNT(*) as visit_count 
            FROM visitor_events 
            WHERE event_name = 'product_view'
            GROUP BY metadata->>'product_name'
            ORDER BY visit_count DESC
        `);
        console.log('PRODUCT_FREQUENCY:', JSON.stringify(productFreqResult.rows));

        // 9. IP-level visit frequency
        const ipFreqResult = await db.query(`
            SELECT ip_address, COUNT(*) as events_count 
            FROM visitor_events 
            GROUP BY ip_address 
            ORDER BY events_count DESC
        `);
        console.log('IP_FREQUENCY:', JSON.stringify(ipFreqResult.rows));

        console.log('--- END AUDIT ---');
        process.exit(0);
    } catch (err) {
        console.error('AUDIT_ERROR:', err.message);
        process.exit(1);
    }
}

runAudit();
