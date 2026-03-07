const db = require('./db.js');

async function check() {
    try {
        const res = await db.query('SELECT COUNT(*) FROM visitor_events');
        console.log('COUNT:', res.rows[0].count);

        const events = await db.query('SELECT event_name, COUNT(*) FROM visitor_events GROUP BY event_name');
        console.log('EVENTS:', JSON.stringify(events.rows));

        const sample = await db.query('SELECT * FROM visitor_events LIMIT 1');
        console.log('SAMPLE:', JSON.stringify(sample.rows));

        process.exit(0);
    } catch (err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
}
check();
