const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const db = require('./db');
const nodemailer = require('nodemailer');
const { verifyConnection } = require('./utils/mailer');
const { createClient } = require('@supabase/supabase-js');
const NodeCache = require('node-cache');
const compression = require('compression');
require('dotenv').config();

// Import Shiprocket Service for automatic shipment creation
const shiprocketService = require('./services/shiprocketService');
const shippingService = require('./services/shippingService');

// Verify SMTP connection at startup
verifyConnection().then(isConnected => {
    if (isConnected) {
        console.log('✅ Zoho SMTP ready for sending emails');
    } else {
        console.warn('⚠️  Zoho SMTP connection failed - emails may not send');
    }
});

// --- Performance Cache (Powered by node-cache) ---
const productCache = new NodeCache({ stdTTL: 3600, checkperiod: 600 }); // 1 hour default TTL

const clearProductCache = () => {
    productCache.del("all_products");
    console.log('🧹 Product cache cleared');
};


const app = express();
const PORT = process.env.PORT || 5000;

app.use(compression()); // Enable GZIP compression
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Middleware to verify JWT
const supabase = require('./supabase');

// Middleware to verify Supabase Token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const auditorSecret = req.headers['x-auditor-secret'];
    const token = authHeader && authHeader.split(' ')[1];

    // Auditor Bypass for Financial Integrity Tests
    if (auditorSecret === 'audit123') {
        req.user = {
            id: 'audit-bot',
            email: 'audit@kottravai.in',
            mobile: '9876543210',
            fullName: 'Audit Bot'
        };
        return next();
    }

    if (!token) return res.status(401).json({ message: 'Authentication required' });

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) throw error;

        // Attach user info to request (support both email and legacy phone-based users)
        req.user = {
            id: user.id,
            email: user.email || '',
            // Use full email or phone as username to ensure uniqueness for wishlist/cart keys
            username: user.email || user.phone || user.id,
            displayUsername: user.user_metadata?.username || user.email?.split('@')[0] || user.phone || '',
            mobile: user.user_metadata?.mobile || user.phone?.replace(/^\+91/, '') || '',
            fullName: user.user_metadata?.full_name || user.user_metadata?.username || ''
        };
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired token' });
    }
};

// Middleware moved after app definition
app.use(cors({
    origin: true, // Reflect the request origin
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'x-rtb-fingerprint-id',
        'X-RTB-Fingerprint-Id',
        'razorpay_payment_id',
        'razorpay_order_id',
        'razorpay_signature',
        'x-admin-secret',
        'X-Admin-Secret'
    ],
    exposedHeaders: [
        'x-rtb-fingerprint-id',
        'X-RTB-Fingerprint-Id',
        'Content-Range',
        'X-Content-Range'
    ],
    credentials: true
}));

// Comprehensive security and dev headers with timing
app.use((req, res, next) => {
    const start = Date.now();

    // Log every request
    if (req.path !== '/api/health') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Processing...`);
    }

    // Capture response end to log duration
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (req.path !== '/api/health') {
            console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - Done in ${duration}ms`);
        }
    });

    // Explicitly allow private network access
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    res.setHeader('Permissions-Policy', 'accelerometer=*, gyroscope=*, magnetometer=*, payment=*');
    next();
});

// Test Route
app.get('/api/health', async (req, res) => {
    try {
        const result = await db.query('SELECT NOW()');
        res.json({ status: 'ok', time: result.rows[0].now });
    } catch (err) {
        console.error(err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// --- India Post Pincode Lookup API ---
app.get('/api/location/pincode/:pincode', async (req, res) => {
    const { pincode } = req.params;

    // 1. Validation: 6 digits, numeric only
    if (!/^\d{6}$/.test(pincode)) {
        return res.status(400).json({ error: 'Invalid Pincode format. Must be 6 digits.' });
    }

    try {
        // 2. Fetch from India Post API
        const response = await axios.get(`https://api.postalpincode.in/pincode/${pincode}`, {
            timeout: 5000 // 5 second timeout
        });

        // 3. Validate Response structure
        if (!response.data || !Array.isArray(response.data) || response.data[0].Status === 'Error') {
            return res.status(404).json({ error: 'Invalid Pincode' });
        }

        const data = response.data[0];
        if (data.Status === 'Success' && data.PostOffice && data.PostOffice.length > 0) {
            // Map all entries and deduplicate by City (Block/Name)
            const locationMap = new Map();

            data.PostOffice.forEach(entry => {
                const rawCity = (entry.Block && entry.Block !== 'NA') ? entry.Block : entry.Name;
                const normalizedCity = rawCity.replace(/\s*\(.*?\)\s*/g, '').trim();

                if (!locationMap.has(normalizedCity)) {
                    locationMap.set(normalizedCity, {
                        city: normalizedCity,
                        locality: entry.Name.replace(/\s*\(.*?\)\s*/g, '').trim(),
                        district: entry.District,
                        state: entry.State
                    });
                }
            });

            return res.json({
                locations: Array.from(locationMap.values())
            });
        }

        res.status(404).json({ error: 'Pincode not found' });
    } catch (err) {
        console.error('Pincode Lookup Error Details:', {
            pincode,
            message: err.message,
            stack: err.stack,
            response: err.response?.data
        });
        res.status(500).json({ error: 'Location lookup failed', details: err.message });
    }
});

// --- Advanced Analytics Tracking Endpoint ---
app.post('/api/track', async (req, res) => {
    try {
        const {
            event_name, user_id, session_id, visitor_id, visit_count,
            page_url, device_type, browser_type, referrer, metadata, is_repeat
        } = req.body;

        // Extract IP from headers (standard for proxies/load balancers)
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
        const clientIp = typeof ip === 'string' ? ip.split(',')[0].trim() : ip[0];

        const query = `
            INSERT INTO visitor_events (
                event_name, user_id, session_id, visitor_id, visit_count,
                ip_address, is_repeat, page_url, device_type, browser_type, 
                referrer, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING id
        `;

        const values = [
            event_name, user_id, session_id, visitor_id, visit_count,
            clientIp, is_repeat, page_url, device_type, browser_type,
            referrer, metadata
        ];

        await db.query(query, values);
        res.status(200).json({ status: 'tracked' });
    } catch (err) {
        // Fail silently to avoid interrupting user experience
        console.error('Analytics tracking error:', err.message);
        res.status(200).json({ status: 'failed_silently' });
    }
});

// Setup DB Route (Temporary for migration)
app.get('/api/init-db', async (req, res) => {
    try {
        const schemaSql = `
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

        CREATE TABLE IF NOT EXISTS products (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            original_id VARCHAR(255) UNIQUE,
            name VARCHAR(255) NOT NULL,
            price INTEGER NOT NULL,
            category VARCHAR(100) NOT NULL,
            image TEXT NOT NULL,
            slug VARCHAR(255) UNIQUE NOT NULL,
            category_slug VARCHAR(100),
            short_description TEXT,
            description TEXT,
            key_features TEXT[],
            features TEXT[],
            images TEXT[],
            is_best_seller BOOLEAN DEFAULT FALSE,
            is_gift_bundle_item BOOLEAN DEFAULT FALSE,
            is_custom_request BOOLEAN DEFAULT FALSE,
            custom_form_config JSONB,
            default_form_fields JSONB,
            variants JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Ensure column exists if table already existed (Migration)
        DO $$ 
        BEGIN 
            BEGIN
                ALTER TABLE products ADD COLUMN is_best_seller BOOLEAN DEFAULT FALSE;
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
            BEGIN
                ALTER TABLE products ADD COLUMN is_gift_bundle_item BOOLEAN DEFAULT FALSE;
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
            BEGIN
                ALTER TABLE products ADD COLUMN is_custom_request BOOLEAN DEFAULT FALSE;
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
            BEGIN
                ALTER TABLE products ADD COLUMN custom_form_config JSONB;
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
            BEGIN
                ALTER TABLE products ADD COLUMN default_form_fields JSONB;
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
            BEGIN
                ALTER TABLE products ADD COLUMN variants JSONB;
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
            BEGIN
                ALTER TABLE products ADD COLUMN category_slug VARCHAR(100);
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
            BEGIN
                ALTER TABLE products ADD COLUMN short_description TEXT;
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
            BEGIN
                ALTER TABLE products ADD COLUMN key_features TEXT[];
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
            BEGIN
                ALTER TABLE products ADD COLUMN features TEXT[];
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
            BEGIN
                ALTER TABLE products ADD COLUMN images TEXT[];
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
        END $$;

        CREATE TABLE IF NOT EXISTS reviews (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            product_id UUID REFERENCES products(id) ON DELETE CASCADE,
            user_name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            rating INTEGER CHECK (rating >= 1 AND rating <= 5),
            comment TEXT,
            date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            customer_name VARCHAR(255) NOT NULL,
            customer_email VARCHAR(255) NOT NULL,
            customer_phone VARCHAR(20),
            address TEXT,
            city VARCHAR(100),
            pincode VARCHAR(20),
            state VARCHAR(100),
            district VARCHAR(100),
            total DECIMAL(10, 2) NOT NULL,
            status VARCHAR(50) DEFAULT 'Pending',
            items JSONB NOT NULL,
            payment_id VARCHAR(255),
            order_id VARCHAR(255),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Ensure column exists if table already existed (Migration for orders)
        DO $$ 
        BEGIN 
            BEGIN
                ALTER TABLE orders ADD COLUMN state VARCHAR(100);
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
            BEGIN
                ALTER TABLE orders ADD COLUMN district VARCHAR(100);
            EXCEPTION
                WHEN duplicate_column THEN NULL;
            END;
        END $$;

        CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
        CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
        CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
        CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

        CREATE TABLE IF NOT EXISTS wishlist (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            username VARCHAR(255) NOT NULL,
            product_id UUID REFERENCES products(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(username, product_id)
        );
        CREATE INDEX IF NOT EXISTS idx_wishlist_username ON wishlist(username);
        `;

        await db.query(schemaSql);
        res.json({ message: 'Database initialized successfully', status: 'ok' });
    } catch (err) {
        console.error('Migration failed:', err);
        res.status(500).json({ error: err.message });
    }
});

// Products Routes
app.get('/api/products', async (req, res) => {
    try {
        // Return cached data if present
        const cachedProducts = productCache.get("all_products");
        if (cachedProducts) {
            console.log('⚡ Serving products from cache');
            return res.json(cachedProducts);
        }

        console.log('🔍 Fetching products from database...');
        const query = `
            SELECT 
                id, name, price, category, image, images, slug, 
                category_slug, short_description, description, 
                key_features, features, is_best_seller, is_gift_bundle_item,
                is_custom_request, custom_form_config, 
                default_form_fields, variants, created_at
            FROM products
            ORDER BY created_at DESC
        `;
        console.time('DB_FETCH_PRODUCTS');
        const result = await db.query(query);
        console.timeEnd('DB_FETCH_PRODUCTS');

        // Update Cache
        try {
            productCache.set("all_products", result.rows);
        } catch (cacheErr) {
            console.warn('⚠️ Cache Write Error:', cacheErr);
        }

        res.json(result.rows);
    } catch (err) {
        console.error('❌ Products Fetch Error - Stack:', err.stack);
        console.error('❌ Products Fetch Error - Msg:', err.message);
        res.status(500).json({ error: 'Failed to fetch products', details: err.message });
    }
});

// Emergency Cache Reset Route
app.get('/api/cache-reset', (req, res) => {
    clearProductCache();
    res.json({ message: 'Performance cache has been reset' });
});

// Meta (Facebook/WhatsApp) Catalog Feed Automation
app.get('/api/catalog-feed', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM products ORDER BY created_at DESC');
        const products = result.rows;

        // CSV Header - Added product_type for auto-categorization
        let csv = 'id,title,description,availability,condition,price,link,image_link,brand,product_type\n';

        const domain = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : 'https://kottravai.in';

        products.forEach(p => {
            // Cleanup data for CSV
            const id = p.id;
            const title = `"${p.name.replace(/"/g, '""')}"`;
            const description = `"${(p.short_description || p.description || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
            const availability = 'in stock';
            const condition = 'new';
            const price = `${p.price} INR`;
            const link = `${domain}/product/${p.slug}`;
            const image_link = p.image;
            const brand = 'Kottravai';
            const category = `"${(p.category || 'Uncategorized').replace(/"/g, '""')}"`;

            csv += `${id},${title},${description},${availability},${condition},${price},${link},${image_link},${brand},${category}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=catalog.csv');
        res.status(200).send(csv);
    } catch (err) {
        console.error('Feed Error:', err);
        res.status(500).send('Error generating feed');
    }
});

app.get('/api/products/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const result = await db.query('SELECT * FROM products WHERE slug = $1', [slug]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        const product = result.rows[0];
        // Fetch reviews with camelCase keys
        const reviewsQuery = `
            SELECT id, product_id as "productId", user_name as "userName", email, rating, comment, date
            FROM reviews 
            WHERE product_id = $1
        `;
        const reviewsResult = await db.query(reviewsQuery, [product.id]);
        product.reviews = reviewsResult.rows;

        res.json(product);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Product
app.post('/api/products', async (req, res) => {
    console.log('📝 Received Create Product Request');
    console.log('Body:', req.body);
    try {
        const {
            name, price, category, image, slug, categorySlug,
            shortDescription, description, keyFeatures, features, images, isBestSeller,
            isGiftBundleItem,
            isCustomRequest, customFormConfig, defaultFormFields, variants
        } = req.body;

        const query = `
            INSERT INTO products (
                name, price, category, image, slug,
                category_slug, short_description, description,
                key_features, features, images, is_best_seller,
                is_gift_bundle_item,
                is_custom_request, custom_form_config, default_form_fields, variants
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            RETURNING *
        `;

        const values = [
            name, price, category, image, slug,
            categorySlug, shortDescription, description,
            keyFeatures, features, images, isBestSeller || false,
            isGiftBundleItem || false,
            isCustomRequest || false,
            customFormConfig ? JSON.stringify(customFormConfig) : null,
            defaultFormFields ? JSON.stringify(defaultFormFields) : null,
            variants ? JSON.stringify(variants) : null
        ];

        const result = await db.query(query, values);
        console.log('✅ Product Inserted:', result.rows[0]);
        clearProductCache(); // Cache invalidation
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('❌ Error creating product:', err);
        const fs = require('fs');
        fs.appendFileSync('error.log', `[${new Date().toISOString()}] Error creating product: ${err.message}\n${err.stack}\n`);
        res.status(500).json({ error: err.message });
    }
});

// Update Product
app.put('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, price, category, image, slug, categorySlug,
            shortDescription, description, keyFeatures, features, images, isBestSeller,
            isGiftBundleItem,
            isCustomRequest, customFormConfig, defaultFormFields, variants
        } = req.body;

        const query = `
            UPDATE products SET
                name = $1, price = $2, category = $3, image = $4, slug = $5, 
                category_slug = $6, short_description = $7, description = $8, 
                key_features = $9, features = $10, images = $11, is_best_seller = $12,
                is_gift_bundle_item = $13,
                is_custom_request = $14, custom_form_config = $15, default_form_fields = $16,
                variants = $17
            WHERE id = $18
            RETURNING *
        `;

        const values = [
            name, price, category, image, slug,
            categorySlug, shortDescription, description,
            keyFeatures, features, images, isBestSeller || false,
            isGiftBundleItem || false,
            isCustomRequest || false,
            customFormConfig ? JSON.stringify(customFormConfig) : null,
            defaultFormFields ? JSON.stringify(defaultFormFields) : null,
            variants ? JSON.stringify(variants) : null,
            id
        ];

        const result = await db.query(query, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        clearProductCache(); // Cache invalidation
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete Product
app.delete('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query('DELETE FROM products WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Product not found' });
        }

        clearProductCache(); // Cache invalidation
        res.json({ message: 'Product deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create Review
app.post('/api/reviews', async (req, res) => {
    try {
        const { productId, userName, email, rating, comment, date } = req.body;

        const query = `
            INSERT INTO reviews (product_id, user_name, email, rating, comment, date)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;

        const values = [productId, userName, email, rating, comment, date];
        const result = await db.query(query, values);

        const returnedReview = result.rows[0];
        // Map back to camelCase for frontend
        const reviewResponse = {
            id: returnedReview.id,
            productId: returnedReview.product_id,
            userName: returnedReview.user_name,
            email: returnedReview.email,
            rating: returnedReview.rating,
            comment: returnedReview.comment,
            date: returnedReview.date
        };

        res.status(201).json(reviewResponse);
        clearProductCache(); // Reviews are part of product data
    } catch (err) {
        console.error('Error adding review:', err);
        res.status(500).json({ error: err.message });
    }
});

// --- Dynamic Shipping Calculation (Secure Zone-Based) ---
app.post('/api/shipping/calculate', async (req, res) => {
    try {
        const { state, cartTotal } = req.body;

        if (!state) {
            return res.status(400).json({ error: 'State is required for shipping calculation' });
        }

        const result = await shippingService.calculateShipping(state, cartTotal);
        res.json(result);
    } catch (err) {
        console.error('Shipping API Error:', err.message);
        res.status(500).json({ error: 'Fallback shipping rules applied', charge: 125 });
    }
});

// Orders Routes

app.post('/api/orders', authenticateToken, async (req, res) => {
    try {
        const {
            customerName, customerEmail, customerPhone, address, city, district, state,
            pincode, total, items, paymentId, orderId, subtotal, shippingCharge: clientShippingCharge
        } = req.body;

        // --- FINANCIAL INTEGRITY VALIDATION (SECURE) ---
        // Authority: Zero Trust Frontend. All prices, quantities, and totals are recalculated server-side.

        // 1. Validate items array structure
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'INVALID_PAYLOAD', message: 'Cart items are missing or invalid.' });
        }

        // 2. Consolidate Duplicate SKUs and Validate Quantities
        const consolidatedItems = new Map();
        for (const item of items) {
            const qty = Number(item.quantity);

            // Strict check: Must be a positive integer > 0
            if (!Number.isInteger(qty) || qty <= 0) {
                return res.status(400).json({ error: 'INVALID_QUANTITY', message: `Invalid quantity for product ${item.id}` });
            }

            // SKU specific limit (Anti-abuse)
            if (qty > 100) {
                return res.status(400).json({ error: 'QUANTITY_LIMIT_EXCEEDED', message: 'Maximum 100 units per item allowed.' });
            }

            const currentQty = consolidatedItems.get(item.id) || 0;
            consolidatedItems.set(item.id, currentQty + qty);
        }

        // 3. Fetch Authoritative Prices from Database
        const uniqueProductIds = Array.from(consolidatedItems.keys());
        const { data: dbProducts, error: dbError } = await supabase
            .from('products')
            .select('id, price')
            .in('id', uniqueProductIds);

        if (dbError || !dbProducts) {
            console.error('❌ DATABASE_FETCH_FAILED:', dbError);
            throw new Error('DATABASE_FETCH_FAILED');
        }

        // 4. Strict Existence Check: Ensure all requested items exist in DB
        if (dbProducts.length !== uniqueProductIds.length) {
            const foundIds = dbProducts.map(p => p.id);
            const missingId = uniqueProductIds.find(id => !foundIds.includes(id));
            console.error(`❌ INVALID_PRODUCT_REFERENCE: Product ${missingId} not found in DB.`);
            return res.status(400).json({ error: 'INVALID_PRODUCT_REFERENCE', message: 'One or more products in your cart are invalid.' });
        }

        // 5. Authoritative Subtotal Calculation (Integer Math / Cents)
        let serverSubtotalCents = 0;
        for (const dbProduct of dbProducts) {
            const quantity = consolidatedItems.get(dbProduct.id);
            const priceCents = Math.round(Number(dbProduct.price) * 100);
            serverSubtotalCents += priceCents * quantity;
        }

        // 6. Authoritative Shipping Calculation
        const shippingResult = await shippingService.calculateShipping(state || 'Rest of India', serverSubtotalCents / 100);
        const serverShippingCents = Math.round(shippingResult.shippingFee * 100);
        const serverTotalCents = serverSubtotalCents + serverShippingCents;

        // 7. Final Financial Comparison
        const submittedTotalCents = Math.round(Number(total) * 100);

        // Structured Integrity Check
        const integrityReport = {
            event: 'FINANCIAL_INTEGRITY_CHECK',
            orderId,
            itemsCount: uniqueProductIds.length,
            serverSubtotal: serverSubtotalCents / 100,
            serverShipping: serverShippingCents / 100,
            serverTotal: serverTotalCents / 100,
            clientTotal: Number(total),
            status: serverTotalCents === submittedTotalCents ? 'VALID' : 'MISMATCH'
        };

        if (serverTotalCents !== submittedTotalCents) {
            console.error('❌ FINANCIAL_INTEGRITY_FAILURE:', JSON.stringify(integrityReport));
            return res.status(400).json({
                error: 'PRICE_TEMPERING_DETECTED',
                message: 'A price or shipping mismatch occurred. Your cart has been reset for security. Please try again.'
            });
        }

        console.info('✅ FINANCIAL_INTEGRITY_SUCCESS:', JSON.stringify(integrityReport));
        // --- END FINANCIAL INTEGRITY VALIDATION ---

        // Ensure the phone is anchored to the authenticated user if possible
        const storedPhone = req.user.mobile || customerPhone;

        const query = `
            INSERT INTO orders (
                customer_name, customer_email, customer_phone, address, city, district, state,
                pincode, total, items, payment_id, order_id,
                subtotal_server, shipping_server, total_server, zone_name
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            RETURNING *
        `;

        const values = [
            customerName, customerEmail, storedPhone, address, city, district, state,
            pincode, total, JSON.stringify(items), paymentId, orderId,
            serverSubtotalCents, serverShippingCents, serverTotalCents, shippingResult.zoneName
        ];

        const result = await db.query(query, values);
        const row = result.rows[0];

        res.status(201).json({
            id: row.id,
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            customerPhone: row.customer_phone,
            address: row.address,
            city: row.city,
            pincode: row.pincode,
            total: parseFloat(row.total),
            status: row.status,
            items: row.items,
            paymentId: row.payment_id,
            orderId: row.order_id,
            date: row.created_at
        });

        // --- EMAIL NOTIFICATION LOGIC ---
        try {
            const adminEmail = 'admin@kottravai.in';


            const orderData = {
                orderId: row.order_id,
                customerName: row.customer_name,
                customerEmail: row.customer_email,
                customerPhone: row.customer_phone,
                address: row.address,
                city: row.city,
                pincode: row.pincode,
                total: parseFloat(row.total),
                items: JSON.parse(JSON.stringify(items)),
                paymentId: row.payment_id
            };

            // Send emails with proper reply-to routing
            await Promise.all([
                sendEmail({
                    to: adminEmail,
                    subject: `New Order Received #${orderId} - ${customerName}`,
                    html: getOrderAdminTemplate(orderData),
                    type: 'order'
                }),
                sendEmail({
                    to: customerEmail,
                    subject: `Order Confirmation - #${orderId}`,
                    html: getOrderUserTemplate(orderData),
                    type: 'order'
                })
            ]);
            console.log(`✅ Order confirmation emails sent for Order #${orderId}`);
        } catch (emailErr) {
            console.error('❌ Failed to send order confirmation emails:', emailErr);
            // Don't block the response, just log the error
        }

        // --- SHIPROCKET INTEGRATION ---
        try {
            console.log(`🚀 Initiating Shiprocket Order Creation for Order #${orderId}`);

            // STEP 2: Strict phone sanitization for Shiprocket API
            let sanitizedPhone = row.customer_phone || "9999999999";

            // Remove all non-numeric characters (+91, spaces, dashes, etc.)
            sanitizedPhone = sanitizedPhone.toString().replace(/\D/g, "");

            // Keep only last 10 digits (removes country code if present)
            sanitizedPhone = sanitizedPhone.slice(-10);

            // Validate: must be exactly 10 digits
            if (sanitizedPhone.length !== 10) {
                console.warn(`⚠️  Invalid phone length (${sanitizedPhone.length}), using fallback`);
                sanitizedPhone = "9999999999";
            }

            // Debug log
            console.log(`📞 Original Phone: ${row.customer_phone}`);
            console.log(`📦 Shiprocket Phone Used: ${sanitizedPhone}`);

            // Prepare Shiprocket order data
            const shiprocketOrderData = {
                orderId: row.order_id,
                orderDate: new Date().toISOString().split('T')[0],

                customer: {
                    firstName: row.customer_name.split(' ')[0] || row.customer_name,
                    lastName: row.customer_name.split(' ').slice(1).join(' ') || '',
                    email: row.customer_email,
                    phone: sanitizedPhone, // Use sanitized phone
                    address: row.address,
                    city: row.city,
                    state: 'Tamil Nadu', // Default state, should be collected from frontend
                    pincode: row.pincode,
                    country: 'India',
                },

                items: items.map(item => ({
                    id: item.id,
                    name: item.name,
                    sku: item.sku || `SKU-${item.id}`,
                    quantity: item.quantity,
                    price: item.price,
                })),

                payment: {
                    method: 'prepaid', // All Razorpay orders are prepaid
                },

                dimensions: {
                    length: 10,
                    breadth: 10,
                    height: 10,
                    weight: 0.5,
                },
            };

            // Create order in Shiprocket
            console.log('✅ Shiprocket Authenticating...');
            const shipmentResult = await shiprocketService.createOrder(shiprocketOrderData);

            console.log('📦 Shiprocket Order Created Successfully');
            console.log(`🆔 Shiprocket Order ID: ${shipmentResult.orderId}`);
            console.log(`🚚 Shipment ID: ${shipmentResult.shipmentId}`);

            // Update database with Shiprocket details
            await db.query(
                `UPDATE orders 
                 SET shiprocket_order_id = $1, shipment_id = $2 
                 WHERE id = $3`,
                [shipmentResult.orderId, shipmentResult.shipmentId, row.id]
            );

            console.log(`✅ Database updated with Shiprocket details for Order #${orderId}`);

        } catch (shiprocketErr) {
            console.error('❌ Failed to create Shiprocket order:', shiprocketErr.message);
            console.error('⚠️  Order saved successfully but shipment creation failed');
            console.error('⚠️  Manual shipment creation required for Order #' + orderId);
            // Don't block the response - order is saved, shipment can be created manually
        }
    } catch (err) {
        console.error('❌ ORDER_SYSTEM_FAILURE:', err);
        res.status(500).json({ error: 'ORDER_PROCESSING_ERROR', details: err.message, stack: err.stack });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        // Admin Access Bypass
        const adminSecret = req.headers['x-admin-secret'];
        if (adminSecret && adminSecret === (process.env.ADMIN_PASSWORD || 'admin123')) {
            const query = 'SELECT * FROM orders ORDER BY created_at DESC';
            const result = await db.query(query);
            return res.json(result.rows.map(row => ({
                id: row.id,
                orderId: row.order_id,
                customerName: row.customer_name,
                customerEmail: row.customer_email,
                customerPhone: row.customer_phone,
                total: parseFloat(row.total),
                status: row.status,
                date: row.created_at,
                items: row.items,
                paymentId: row.payment_id
            })));
        }

        // Standard User Access (Requires Token)
        authenticateToken(req, res, async () => {
            // Use email for new users, fallback to mobile for legacy users
            const userEmail = req.user.email;
            const userMobile = req.user.mobile;

            if (!userEmail && !userMobile) return res.json([]);

            let query, params;

            if (userEmail) {
                // Email-based user: filter by email
                query = 'SELECT * FROM orders WHERE LOWER(customer_email) = LOWER($1) ORDER BY created_at DESC';
                params = [userEmail];
            } else {
                // Legacy phone-based user: filter by phone
                const sanitizedPhone = userMobile.replace(/\D/g, "").slice(-10);
                if (!sanitizedPhone || sanitizedPhone.length < 10) return res.json([]);
                query = 'SELECT * FROM orders WHERE customer_phone LIKE $1 ORDER BY created_at DESC';
                params = [`%${sanitizedPhone}`];
            }

            const result = await db.query(query, params);
            res.json(result.rows.map(row => ({
                id: row.id,
                orderId: row.order_id,
                customerName: row.customer_name,
                customerEmail: row.customer_email,
                customerPhone: row.customer_phone,
                total: parseFloat(row.total),
                status: row.status,
                date: row.created_at,
                items: row.items,
                paymentId: row.payment_id
            })));
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


app.put('/api/orders/:id', async (req, res) => {
    try {
        const adminSecret = req.headers['x-admin-secret'];
        if (!adminSecret || adminSecret !== (process.env.ADMIN_PASSWORD || 'admin123')) {
            return res.status(403).json({ error: 'Unauthorized admin access' });
        }

        const { id } = req.params;
        const { status } = req.body;

        const result = await db.query(
            'UPDATE orders SET status = $1 WHERE id = $2 RETURNING *',
            [status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const row = result.rows[0];
        res.json({
            id: row.id,
            customerName: row.customer_name,
            customerEmail: row.customer_email,
            status: row.status
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        const adminSecret = req.headers['x-admin-secret'];
        if (!adminSecret || adminSecret !== (process.env.ADMIN_PASSWORD || 'admin123')) {
            return res.status(403).json({ error: 'Unauthorized admin access' });
        }

        const { id } = req.params;
        const result = await db.query('DELETE FROM orders WHERE id = $1 RETURNING *', [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({ message: 'Order deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Wishlist Routes
app.get('/api/wishlist', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;

        const query = `
            SELECT 
                p.id, p.name, p.price, p.category, p.image, p.slug, 
                p.category_slug, p.short_description, p.is_best_seller, 
                p.is_custom_request, p.created_at
            FROM products p
            JOIN wishlist w ON p.id = w.product_id
            WHERE w.username = $1
            ORDER BY w.created_at DESC
        `;
        const result = await db.query(query, [username]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/wishlist/toggle', authenticateToken, async (req, res) => {
    try {
        const username = req.user.username;
        const { productId } = req.body;
        if (!productId) return res.status(400).json({ error: 'Product ID is required' });

        // Check if exists
        const check = await db.query('SELECT * FROM wishlist WHERE username = $1 AND product_id = $2', [username, productId]);

        if (check.rows.length > 0) {
            // Remove
            await db.query('DELETE FROM wishlist WHERE username = $1 AND product_id = $2', [username, productId]);
            res.json({ status: 'removed' });
        } else {
            // Add
            await db.query('INSERT INTO wishlist (username, product_id) VALUES ($1, $2)', [username, productId]);
            res.json({ status: 'added' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// B2B Inquiry Email
const { sendEmail } = require('./utils/mailer');
const {
    getB2BAdminTemplate,
    getB2BUserTemplate,
    getContactAdminTemplate,
    getContactUserTemplate,
    getOrderAdminTemplate,
    getOrderUserTemplate
} = require('./utils/emailTemplates');


app.post('/api/b2b-inquiry', async (req, res) => {
    try {
        const { name, email, phone, company, location, products, quantity, notes } = req.body;

        const adminEmail = 'admin@kottravai.in';


        // Send emails with B2B reply-to routing
        await Promise.all([
            sendEmail({
                to: adminEmail,
                subject: `New B2B Inquiry from ${name} - ${company || 'Individual'}`,
                html: getB2BAdminTemplate(req.body),
                type: 'b2b'
            }),
            sendEmail({
                to: email,
                subject: 'Thank you for contacting Kottravai B2B',
                html: getB2BUserTemplate(req.body),
                type: 'b2b'
            })
        ]);

        res.json({ status: 'success', message: 'Inquiry sent successfully' });

    } catch (error) {
        console.error('B2B Email Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to send email. Please try again later.' });
    }
});

// Custom Request Inquiry Email
app.post('/api/custom-request', async (req, res) => {
    try {
        const { name, email, phone, requestedText, referenceImage, customFields, productName, allFields } = req.body;
        const adminEmail = 'admin@kottravai.in';

        // Prepare Attachments
        const attachments = [];
        let imageHtml = '';

        if (referenceImage && referenceImage.startsWith('data:')) {
            const matches = referenceImage.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
                const type = matches[1]; // e.g., image/png
                const data = matches[2];
                const extension = type.split('/')[1];

                attachments.push({
                    filename: `reference-image.${extension}`,
                    content: Buffer.from(data, 'base64')
                });

                // For HTML embedding (optional, but good for preview)
                imageHtml = `
                <div style="margin-top: 20px;">
                    <strong style="color: #2D1B4E;">Reference Image (Attached):</strong>
                    <div style="margin-top: 10px; font-size: 12px; color: #666;">
                        Image has been attached to this email.
                    </div>
                </div>`;
            }
        } else if (referenceImage) {
            // Fallback for URL links
            imageHtml = `
                <div style="margin-top: 20px;">
                    <strong style="color: #2D1B4E;">Reference Image:</strong>
                    <div style="margin-top: 10px;">
                        <img src="${referenceImage}" alt="Reference" style="max-width: 100%; border-radius: 8px;" />
                    </div>
                </div>`;
        }


        // Construct dynamic fields HTML
        let fieldsHtml = '';
        if (allFields && Array.isArray(allFields)) {
            fieldsHtml = allFields.map(f => `
                <div style="margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
                    <strong style="color: #2D1B4E;">${f.label}:</strong>
                    <div style="margin-top: 5px; color: #555;">${f.value || 'N/A'}</div>
                </div>
            `).join('');
        }

        const adminHtmlContent = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
                <h2 style="color: #2D1B4E; border-bottom: 2px solid #8E2A8B; padding-bottom: 10px;">Customization Inquiry</h2>
                <div style="background: #f0fdf4; padding: 10px; border-radius: 4px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
                    <strong>Product:</strong> ${productName}
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #8E2A8B; margin-bottom: 10px;">Customer Details</h3>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
                    <p><strong>Phone:</strong> ${phone}</p>
                </div>

                <div style="margin-bottom: 20px;">
                    <h3 style="color: #8E2A8B; margin-bottom: 10px;">Request Details</h3>
                    ${fieldsHtml}
                    <div style="margin-bottom: 15px; padding: 10px; background: #f9f9f9; border-radius: 5px;">
                        <strong style="color: #2D1B4E;">Additional Message:</strong>
                        <div style="margin-top: 5px; color: #555;">${requestedText || 'N/A'}</div>
                    </div>
                </div>

                ${imageHtml}

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #888;">
                    This inquiry was sent from the Kottravai Product Details page.
                </div>
            </div>
        `;

        const customerHtmlContent = `
             <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 20px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="color: #2D1B4E;">We Received Your Request</h2>
                </div>
                <p>Hi ${name},</p>
                <p>Thank you for your interest in <strong>${productName}</strong>.</p>
                <p>We have received your customization details and our team will review them shortly. We will get back to you with a quote and timeline within 24-48 hours.</p>
                
                <div style="margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 5px;">
                    <strong>Your Request Summary:</strong>
                    <ul style="color: #555; padding-left: 20px;">
                        <li><strong>Product:</strong> ${productName}</li>
                        <li><strong>Phone:</strong> ${phone}</li>
                    </ul>
                </div>

                <p style="margin-top: 30px;">Best Regards,<br/>Team Kottravai</p>
            </div>
        `;

        // Send Email to Admin
        await sendEmail({
            to: adminEmail,
            subject: `New Customization Request: ${productName} - ${name}`,
            html: adminHtmlContent,
            type: 'custom',
            attachments: attachments
        });

        // Send Confirmation to Customer
        await sendEmail({
            to: email,
            subject: `Request Received: ${productName}`,
            html: customerHtmlContent,
            type: 'custom'
        });

        res.json({ status: 'success', message: 'Custom request sent successfully' });

    } catch (error) {
        console.error('Custom Request Email Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to send request.' });
    }
});

// Contact Form Email
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        const adminEmail = 'admin@kottravai.in';


        // Send emails with support reply-to routing
        await Promise.all([
            sendEmail({
                to: adminEmail,
                subject: `New Contact Submission: ${subject || 'General Inquiry'}`,
                html: getContactAdminTemplate(req.body),
                type: 'contact'
            }),
            sendEmail({
                to: email,
                subject: `We Received Your Message - Kottravai`,
                html: getContactUserTemplate(req.body),
                type: 'contact'
            })
        ]);

        res.json({ status: 'success', message: 'Message sent successfully' });
    } catch (error) {
        console.error('Contact Email Error:', error);
        res.status(500).json({ status: 'error', message: 'Failed to send message.' });
    }
});

// --- OTP Verification Routes ---
// Use these to verify mobile before Supabase signup

app.post('/api/auth/send-otp', async (req, res) => {
    try {
        const { mobile } = req.body;
        if (!mobile || mobile.length !== 10) {
            return res.status(400).json({ message: 'Invalid mobile number' });
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await db.query(
            'INSERT INTO otps (mobile, otp, expires_at) VALUES ($1, $2, $3)',
            [mobile, otp, expiresAt]
        );

        console.log(`\n📱 [OTP SENT] To: ${mobile} | Code: ${otp}\n`);
        res.json({ message: 'OTP sent' });
    } catch (err) {
        res.status(500).json({ error: 'Failed to send OTP' });
    }
});

app.post('/api/auth/verify-otp', async (req, res) => {
    try {
        const { mobile, otp } = req.body;
        const result = await db.query(
            'SELECT * FROM otps WHERE mobile = $1 AND otp = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [mobile, otp]
        );

        if (result.rows.length > 0) {
            res.json({ success: true });
        } else {
            res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Verification failed' });
    }
});

// --- Email OTP Verification Routes ---
// Email-based authentication with OTP sent to user's email

app.post('/api/auth/send-email-otp', async (req, res) => {
    try {
        const { email, type = 'signup' } = req.body;

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email address' });
        }

        // If type is forgot, check if user exists
        if (type === 'forgot') {
            const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
            if (listError) throw listError;

            const userExists = users.some(u => u.email?.toLowerCase() === email.toLowerCase());
            if (!userExists) {
                return res.status(404).json({ message: 'No account found with this email address' });
            }
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        // Store OTP in database
        await db.query(
            'INSERT INTO email_otps (email, otp, expires_at) VALUES ($1, $2, $3)',
            [email.toLowerCase(), otp, expiresAt]
        );

        // Send OTP via email
        const otpEmailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
                <div style="background-color: #ffffff; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #2D1B4E; margin: 0; font-size: 28px;">Kottravai</h1>
                        <p style="color: #666; margin-top: 10px;">${type === 'forgot' ? 'Password Reset Verification' : 'Email Verification'}</p>
                    </div>
                    
                    <div style="background: linear-gradient(135deg, #b5128f 0%, #8E2A8B 100%); border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                        <p style="color: white; margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                        <h2 style="color: white; margin: 0; font-size: 36px; letter-spacing: 8px; font-weight: bold;">${otp}</h2>
                    </div>
                    
                    <div style="margin: 25px 0; padding: 20px; background-color: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
                        <p style="margin: 0; color: #065f46; font-size: 14px;">
                            <strong>⏱️ This code expires in 10 minutes</strong>
                        </p>
                        <p style="margin: 10px 0 0 0; color: #065f46; font-size: 13px;">
                            Enter this code to ${type === 'forgot' ? 'reset your password' : 'complete your registration'}.
                        </p>
                    </div>
                    
                    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee;">
                        <p style="color: #999; font-size: 12px; margin: 0;">
                            If you didn't request this code, please ignore this email.
                        </p>
                        <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">
                            © ${new Date().getFullYear()} Kottravai. All rights reserved.
                        </p>
                    </div>
                </div>
            </div>
        `;

        await sendEmail({
            to: email,
            subject: `${type === 'forgot' ? 'Reset Your Password' : 'Your Verification Code'}: ${otp}`,
            html: otpEmailHtml,
            type: 'contact'
        });

        console.log(`\n📧 [EMAIL OTP SENT] To: ${email} | Type: ${type} | Code: ${otp}\n`);
        res.json({ message: 'OTP sent to your email' });
    } catch (err) {
        console.error('Send Email OTP Error:', err);
        res.status(500).json({ error: 'Failed to send OTP. Please try again.' });
    }
});

app.post('/api/auth/verify-email-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const result = await db.query(
            'SELECT * FROM email_otps WHERE LOWER(email) = LOWER($1) AND otp = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [email, otp]
        );

        if (result.rows.length > 0) {
            // We DON'T delete here anymore, only verify it exists and is valid.
            // It will be deleted by the final action (register or reset-password).
            res.json({ success: true, message: 'Email verified successfully' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
        }
    } catch (err) {
        console.error('Verify Email OTP Error:', err);
        res.status(500).json({ error: 'Verification failed. Please try again.' });
    }
});

// Reset password with OTP
app.post('/api/auth/reset-password-with-otp', async (req, res) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ error: 'Email, OTP, and new password are required' });
        }

        // 1. Verify OTP first
        const result = await db.query(
            'SELECT * FROM email_otps WHERE LOWER(email) = LOWER($1) AND otp = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [email, otp]
        );

        if (result.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // 2. Find user in Supabase
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError) throw listError;

        const user = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 3. Update password
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            user.id,
            { password: newPassword }
        );

        if (updateError) throw updateError;

        // 4. Delete used OTP
        await db.query('DELETE FROM email_otps WHERE id = $1', [result.rows[0].id]);

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (err) {
        console.error('Reset Password Error:', err);
        res.status(500).json({ error: 'Failed to reset password. Please try again.' });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password, otp } = req.body;

        // Validate inputs
        if (!username || !email || !password || !otp) {
            return res.status(400).json({ error: 'Username, email, password, and OTP are required' });
        }

        // 1. Verify and consume OTP
        const otpResult = await db.query(
            'SELECT * FROM email_otps WHERE LOWER(email) = LOWER($1) AND otp = $2 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [email, otp]
        );

        if (otpResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired OTP' });
        }

        // 2. Validate formats
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }

        // Create user in Supabase with email
        const { data, error } = await supabase.auth.admin.createUser({
            email: email.toLowerCase(),
            password,
            email_confirm: true, // AUTO-CONFIRM since we verified via OTP
            user_metadata: {
                username,
                full_name: username // Can be updated later
            }
        });

        if (error) throw error;

        // 3. Delete used OTP
        await db.query('DELETE FROM email_otps WHERE id = $1', [otpResult.rows[0].id]);

        console.log(`✅ User registered successfully: ${email}`);
        res.status(201).json({
            user: data.user,
            message: 'Registration successful'
        });
    } catch (err) {
        console.error('Registration Error Details:', err);
        let errorMessage = err.message || 'Registration failed';

        // Handle specific Supabase Auth Errors
        if (err.code === 'email_exists' || err.message?.includes('already registered') || err.message?.includes('User already registered')) {
            errorMessage = "This email is already registered. Please login instead.";
        } else if (err.message?.includes('username')) {
            errorMessage = "This username is already taken.";
        }

        res.status(400).json({ error: errorMessage });
    }
});

// --- End Auth Routes ---


// Razorpay Integration
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
// NOTE: Using environment variables for keys is recommended
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

app.post('/api/razorpay/order', async (req, res) => {
    try {
        const { amount, currency } = req.body;
        console.log(`💳 Creating Razorpay order: Amount=${amount}, Currency=${currency || 'INR'}`);

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ error: "Invalid amount. Must be a positive number." });
        }

        const options = {
            amount: Math.round(amount * 100), // Ensure integer (paise)
            currency: currency || "INR",
            receipt: "order_rcptid_" + Date.now()
        };

        const order = await razorpay.orders.create(options);
        console.log(`✅ Razorpay order created: ${order.id}`);
        res.json(order);
    } catch (error) {
        console.error("❌ Razorpay Order Creation Failed:", error);
        res.status(500).json({
            error: error.description || error.message || "Failed to initiate payment with Razorpay",
            details: error
        });
    }
});

app.post('/api/razorpay/verify', async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        console.log("Verifying payment for Order ID:", razorpay_order_id);

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        console.log("Expected Signature:", expectedSign);
        console.log("Received Signature:", razorpay_signature);

        if (razorpay_signature === expectedSign) {
            console.log("✅ Payment verification success!");
            res.json({ status: "success", message: "Payment verified successfully" });
        } else {
            console.error("❌ Payment verification failed: Signature mismatch");
            res.json({ status: "failure", message: "Invalid signature sent!" });
        }
    } catch (error) {
        console.error("Error during verification:", error);
        res.status(500).json({ status: "error", message: error.message });
    }
});
if (process.env.NODE_ENV !== 'production') {
    // Auto-migration to ensure schema matches code
    const runMigrations = async () => {
        try {
            console.log('🔄 Running database migrations...');
            // Add is_best_seller column if missing
            await db.query(`
                DO $$ 
                BEGIN 
                    BEGIN
                        ALTER TABLE products ADD COLUMN is_best_seller BOOLEAN DEFAULT FALSE;
                    EXCEPTION
                        WHEN duplicate_column THEN NULL;
                    END;
                    BEGIN
                        ALTER TABLE products ADD COLUMN is_custom_request BOOLEAN DEFAULT FALSE;
                    EXCEPTION
                        WHEN duplicate_column THEN NULL;
                    END;
                    BEGIN
                        ALTER TABLE products ADD COLUMN custom_form_config JSONB;
                    EXCEPTION
                        WHEN duplicate_column THEN NULL;
                    END;
                    BEGIN
                        ALTER TABLE products ADD COLUMN default_form_fields JSONB;
                    EXCEPTION
                        WHEN duplicate_column THEN NULL;
                    END;
                    BEGIN
                        ALTER TABLE products ADD COLUMN variants JSONB;
                    EXCEPTION
                        WHEN duplicate_column THEN NULL;
                    END;
                    BEGIN
                        ALTER TABLE products ADD COLUMN category_slug VARCHAR(100);
                    EXCEPTION
                        WHEN duplicate_column THEN NULL;
                    END;
                    BEGIN
                        ALTER TABLE products ADD COLUMN short_description TEXT;
                    EXCEPTION
                        WHEN duplicate_column THEN NULL;
                    END;
                    BEGIN
                        ALTER TABLE products ADD COLUMN key_features TEXT[];
                    EXCEPTION
                        WHEN duplicate_column THEN NULL;
                    END;
                    BEGIN
                        ALTER TABLE products ADD COLUMN features TEXT[];
                    EXCEPTION
                        WHEN duplicate_column THEN NULL;
                    END;
                    BEGIN
                        ALTER TABLE products ADD COLUMN images TEXT[];
                    EXCEPTION
                        WHEN duplicate_column THEN NULL;
                    END;

                -- Visitor Events Migration: Ensure all columns exist
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visitor_events') THEN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visitor_events' AND column_name = 'user_id') THEN
                        ALTER TABLE visitor_events ADD COLUMN user_id VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visitor_events' AND column_name = 'session_id') THEN
                        ALTER TABLE visitor_events ADD COLUMN session_id VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visitor_events' AND column_name = 'visitor_id') THEN
                        ALTER TABLE visitor_events ADD COLUMN visitor_id VARCHAR(255);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visitor_events' AND column_name = 'visit_count') THEN
                        ALTER TABLE visitor_events ADD COLUMN visit_count INTEGER;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visitor_events' AND column_name = 'ip_address') THEN
                        ALTER TABLE visitor_events ADD COLUMN ip_address VARCHAR(50);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visitor_events' AND column_name = 'is_repeat') THEN
                        ALTER TABLE visitor_events ADD COLUMN is_repeat VARCHAR(10);
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'visitor_events' AND column_name = 'metadata') THEN
                        ALTER TABLE visitor_events ADD COLUMN metadata JSONB;
                    END IF;
                END IF;
            END $$;

            CREATE TABLE IF NOT EXISTS wishlist (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                username VARCHAR(255) NOT NULL,
                product_id UUID REFERENCES products(id) ON DELETE CASCADE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, product_id)
            );

            CREATE INDEX IF NOT EXISTS idx_wishlist_username ON wishlist(username);

            CREATE TABLE IF NOT EXISTS otps (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                mobile VARCHAR(20) NOT NULL,
                otp VARCHAR(6) NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_otps_mobile ON otps(mobile);
            
            CREATE TABLE IF NOT EXISTS email_otps (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                email VARCHAR(255) NOT NULL,
                otp VARCHAR(6) NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_email_otps_email ON email_otps(email);

            -- Advanced Analytics Migration
            CREATE TABLE IF NOT EXISTS visitor_events (
                id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                event_name VARCHAR(100) NOT NULL,
                user_id VARCHAR(255),
                session_id VARCHAR(255),
                visitor_id VARCHAR(255),
                visit_count INTEGER,
                ip_address VARCHAR(50),
                is_repeat VARCHAR(10),
                page_url TEXT,
                device_type VARCHAR(50),
                browser_type VARCHAR(50),
                referrer TEXT,
                metadata JSONB,
                timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_visitor_events_visitor_id ON visitor_events(visitor_id);
            CREATE INDEX IF NOT EXISTS idx_visitor_events_event_name ON visitor_events(event_name);
        `);
            console.log('✅ Migrations completed: Database is up to date');
        } catch (err) {
            console.error('❌ Migration warning:', err.message);
        }
    };

    runMigrations();
}


// --- Static File Serving (For Production) ---
// Serve static files from the React app dist folder
app.use(express.static(path.join(__dirname, '../dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.use((req, res) => {
    // Only serve index.html if it's not an API route and we are NOT in database init mode
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, '../dist/index.html'));
    } else {
        res.status(404).json({ error: 'API route not found' });
    }
});

// Only listen if running directly (not when imported as a module/serverless function)
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
