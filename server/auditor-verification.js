const db = require('./db.js');

async function runAuditChecks() {
    console.log('━━━━━━━━━━━━━━━━━━━━');
    console.log('1️⃣ DATABASE VERIFICATION');
    console.log('━━━━━━━━━━━━━━━━━━━━');

    try {
        const tableCheck = await db.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'visitor_events'
        `);
        console.log('Columns in visitor_events:');
        tableCheck.rows.forEach(row => console.log(` - ${row.column_name} (${row.data_type})`));

        const countCheck = await db.query('SELECT COUNT(*) FROM visitor_events');
        console.log(`\nSELECT COUNT(*) FROM visitor_events: ${countCheck.rows[0].count}`);

        const repeatCheck = await db.query(`
            SELECT ip_address, COUNT(*) 
            FROM visitor_events 
            GROUP BY ip_address
            LIMIT 5
        `);
        console.log('\nGroup by IP results:');
        repeatCheck.rows.forEach(row => console.log(` - IP: ${row.ip_address}, Count: ${row.count}`));

        const nullIpCheck = await db.query('SELECT COUNT(*) FROM visitor_events WHERE ip_address IS NULL');
        console.log(`\nNULL IP Count: ${nullIpCheck.rows[0].count}`);

    } catch (err) {
        console.error('Audit Check 1 Failed:', err.message);
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━');
    console.log('4️⃣ ANALYTICS QUERIES VERIFICATION');
    console.log('━━━━━━━━━━━━━━━━━━━━');

    try {
        // A) Visitors who came 2 times
        const qA = await db.query('SELECT visitor_id FROM visitor_events GROUP BY visitor_id HAVING COUNT(*) = 2');
        console.log(`A) Visitors who came 2 times: ${qA.rows.length}`);

        // B) Visitors who came 3 times
        const qB = await db.query('SELECT visitor_id FROM visitor_events GROUP BY visitor_id HAVING COUNT(*) = 3');
        console.log(`B) Visitors who came 3 times: ${qB.rows.length}`);

        // C) Added to cart but no purchase
        const qC = await db.query(`
            SELECT visitor_id FROM visitor_events WHERE event_name = 'add_to_cart'
            EXCEPT
            SELECT visitor_id FROM visitor_events WHERE event_name = 'payment_success'
        `);
        console.log(`C) Added to cart but no purchase: ${qC.rows.length}`);

        // D) Products added but not purchased
        const qD = await db.query(`
            SELECT metadata->>'product_name' as product FROM visitor_events WHERE event_name = 'add_to_cart'
            AND visitor_id NOT IN (SELECT visitor_id FROM visitor_events WHERE event_name = 'payment_success')
        `);
        console.log(`D) Products added but not purchased: ${qD.rows.length}`);

        // E) Top 3 products
        const qE = await db.query(`
            SELECT metadata->>'product_name' as product, COUNT(*) as views
            FROM visitor_events 
            WHERE event_name = 'product_view'
            GROUP BY product
            ORDER BY views DESC
            LIMIT 3
        `);
        console.log('E) Top 3 products:');
        qE.rows.forEach(row => console.log(` - ${row.product}: ${row.views} views`));

    } catch (err) {
        console.error('Audit Check 4 Failed:', err.message);
    }

    process.exit(0);
}

runAuditChecks();
