const db = require('./db.js');

async function setup() {
    try {
        console.log('Checking for UUID extension...');
        await db.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

        console.log('Creating visitor_events table...');
        await db.query(`
            CREATE TABLE IF NOT EXISTS visitor_events (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                ip_address VARCHAR(45),
                session_id VARCHAR(100),
                visitor_id VARCHAR(100),
                event_type VARCHAR(100),
                event_name VARCHAR(100),
                product_id VARCHAR(100),
                page_url TEXT,
                source VARCHAR(100),
                device_type VARCHAR(50),
                browser_type VARCHAR(50),
                referrer TEXT,
                metadata JSONB,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ visitor_events table ready');

        // Add some indexes for the auditor's queries
        await db.query('CREATE INDEX IF NOT EXISTS idx_visitor_ip ON visitor_events(ip_address)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_visitor_id ON visitor_events(visitor_id)');
        await db.query('CREATE INDEX IF NOT EXISTS idx_visitor_event_name ON visitor_events(event_name)');
        console.log('✅ Indexes created');

    } catch (err) {
        console.error('❌ Setup failed:', err.message);
        process.exit(1);
    }
}

setup();
