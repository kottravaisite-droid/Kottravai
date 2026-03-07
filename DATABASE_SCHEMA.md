# Kottravai Database Schema

Generated on: 7/3/2026, 5:32:40 pm

## Table: `products`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| **id** | `uuid` | NO | uuid_generate_v4() |
| **original_id** | `character varying` | YES |  |
| **name** | `character varying` | NO |  |
| **price** | `integer` | NO |  |
| **category** | `character varying` | NO |  |
| **image** | `text` | NO |  |
| **slug** | `character varying` | NO |  |
| **category_slug** | `character varying` | YES |  |
| **short_description** | `text` | YES |  |
| **description** | `text` | YES |  |
| **key_features** | `ARRAY` | YES |  |
| **features** | `ARRAY` | YES |  |
| **images** | `ARRAY` | YES |  |
| **is_best_seller** | `boolean` | YES | false |
| **is_custom_request** | `boolean` | YES | false |
| **custom_form_config** | `jsonb` | YES |  |
| **default_form_fields** | `jsonb` | YES |  |
| **variants** | `jsonb` | YES |  |
| **created_at** | `timestamp with time zone` | YES | CURRENT_TIMESTAMP |
| **is_gift_bundle_item** | `boolean` | YES | false |

### Indexes

- `products_pkey`: `CREATE UNIQUE INDEX products_pkey ON public.products USING btree (id)`
- `products_original_id_key`: `CREATE UNIQUE INDEX products_original_id_key ON public.products USING btree (original_id)`
- `products_slug_key`: `CREATE UNIQUE INDEX products_slug_key ON public.products USING btree (slug)`
- `idx_products_slug`: `CREATE INDEX idx_products_slug ON public.products USING btree (slug)`
- `idx_products_category`: `CREATE INDEX idx_products_category ON public.products USING btree (category)`

*Total Records: 51 products*

---

## Table: `reviews`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| **id** | `uuid` | NO | uuid_generate_v4() |
| **product_id** | `uuid` | YES |  |
| **user_name** | `character varying` | NO |  |
| **email** | `character varying` | YES |  |
| **rating** | `integer` | YES |  |
| **comment** | `text` | YES |  |
| **date** | `timestamp with time zone` | YES | CURRENT_TIMESTAMP |

### Indexes

- `reviews_pkey`: `CREATE UNIQUE INDEX reviews_pkey ON public.reviews USING btree (id)`
- `idx_reviews_product_id`: `CREATE INDEX idx_reviews_product_id ON public.reviews USING btree (product_id)`

---

## Table: `wishlist`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| **id** | `uuid` | NO | uuid_generate_v4() |
| **username** | `character varying` | NO |  |
| **product_id** | `uuid` | YES |  |
| **created_at** | `timestamp with time zone` | YES | CURRENT_TIMESTAMP |

### Indexes

- `wishlist_pkey`: `CREATE UNIQUE INDEX wishlist_pkey ON public.wishlist USING btree (id)`
- `wishlist_user_email_product_id_key`: `CREATE UNIQUE INDEX wishlist_user_email_product_id_key ON public.wishlist USING btree (username, product_id)`
- `idx_wishlist_user_email`: `CREATE INDEX idx_wishlist_user_email ON public.wishlist USING btree (username)`
- `idx_wishlist_username`: `CREATE INDEX idx_wishlist_username ON public.wishlist USING btree (username)`

---

## Table: `orders`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| **id** | `uuid` | NO | uuid_generate_v4() |
| **customer_name** | `character varying` | NO |  |
| **customer_email** | `character varying` | NO |  |
| **customer_phone** | `character varying` | YES |  |
| **address** | `text` | YES |  |
| **city** | `character varying` | YES |  |
| **pincode** | `character varying` | YES |  |
| **total** | `numeric` | NO |  |
| **status** | `character varying` | YES | 'Pending'::character varying |
| **items** | `jsonb` | NO |  |
| **payment_id** | `character varying` | YES |  |
| **order_id** | `character varying` | YES |  |
| **created_at** | `timestamp with time zone` | YES | CURRENT_TIMESTAMP |
| **subtotal_server** | `integer` | YES |  |
| **shipping_server** | `integer` | YES |  |
| **total_server** | `integer` | YES |  |
| **zone_name** | `character varying` | YES |  |
| **rule_version** | `integer` | YES | 1 |

### Indexes

- `orders_pkey`: `CREATE UNIQUE INDEX orders_pkey ON public.orders USING btree (id)`
- `idx_orders_customer_email`: `CREATE INDEX idx_orders_customer_email ON public.orders USING btree (customer_email)`
- `idx_orders_status`: `CREATE INDEX idx_orders_status ON public.orders USING btree (status)`
- `idx_orders_created_at`: `CREATE INDEX idx_orders_created_at ON public.orders USING btree (created_at)`

---

## Table: `otps`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| **id** | `uuid` | NO | uuid_generate_v4() |
| **mobile** | `character varying` | NO |  |
| **otp** | `character varying` | NO |  |
| **expires_at** | `timestamp with time zone` | NO |  |
| **created_at** | `timestamp with time zone` | YES | CURRENT_TIMESTAMP |

### Indexes

- `otps_pkey`: `CREATE UNIQUE INDEX otps_pkey ON public.otps USING btree (id)`
- `idx_otps_mobile`: `CREATE INDEX idx_otps_mobile ON public.otps USING btree (mobile)`

---

## Table: `email_otps`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| **id** | `uuid` | NO | uuid_generate_v4() |
| **email** | `character varying` | NO |  |
| **otp** | `character varying` | NO |  |
| **expires_at** | `timestamp with time zone` | NO |  |
| **created_at** | `timestamp with time zone` | YES | CURRENT_TIMESTAMP |

### Indexes

- `email_otps_pkey`: `CREATE UNIQUE INDEX email_otps_pkey ON public.email_otps USING btree (id)`
- `idx_email_otps_email`: `CREATE INDEX idx_email_otps_email ON public.email_otps USING btree (email)`

---

## Table: `visitor_events`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| **id** | `uuid` | NO | uuid_generate_v4() |
| **ip_address** | `character varying` | YES |  |
| **session_id** | `character varying` | YES |  |
| **visitor_id** | `character varying` | YES |  |
| **event_type** | `character varying` | YES |  |
| **event_name** | `character varying` | YES |  |
| **product_id** | `character varying` | YES |  |
| **page_url** | `text` | YES |  |
| **source** | `character varying` | YES |  |
| **device_type** | `character varying` | YES |  |
| **browser_type** | `character varying` | YES |  |
| **referrer** | `text` | YES |  |
| **metadata** | `jsonb` | YES |  |
| **created_at** | `timestamp with time zone` | YES | CURRENT_TIMESTAMP |
| **user_id** | `character varying` | YES |  |
| **visit_count** | `integer` | YES |  |
| **is_repeat** | `character varying` | YES |  |

### Indexes

- `visitor_events_pkey`: `CREATE UNIQUE INDEX visitor_events_pkey ON public.visitor_events USING btree (id)`
- `idx_visitor_ip`: `CREATE INDEX idx_visitor_ip ON public.visitor_events USING btree (ip_address)`
- `idx_visitor_id`: `CREATE INDEX idx_visitor_id ON public.visitor_events USING btree (visitor_id)`
- `idx_visitor_event_name`: `CREATE INDEX idx_visitor_event_name ON public.visitor_events USING btree (event_name)`
- `idx_visitor_events_visitor_id`: `CREATE INDEX idx_visitor_events_visitor_id ON public.visitor_events USING btree (visitor_id)`
- `idx_visitor_events_event_name`: `CREATE INDEX idx_visitor_events_event_name ON public.visitor_events USING btree (event_name)`

---

## Table: `shipping_zones`

| Column | Type | Nullable | Default |
| --- | --- | --- | --- |
| **id** | `integer` | NO | nextval('shipping_zones_id_seq'::regclass) |
| **zone_name** | `character varying` | NO |  |
| **states** | `ARRAY` | NO |  |
| **free_shipping_threshold** | `numeric` | NO |  |
| **shipping_charge** | `numeric` | NO |  |
| **is_active** | `boolean` | YES | true |
| **created_at** | `timestamp without time zone` | YES | now() |
| **is_fallback** | `boolean` | YES | false |

### Indexes

- `shipping_zones_pkey`: `CREATE UNIQUE INDEX shipping_zones_pkey ON public.shipping_zones USING btree (id)`
- `idx_shipping_zones_active`: `CREATE INDEX idx_shipping_zones_active ON public.shipping_zones USING btree (is_active) WHERE (is_active = true)`
- `idx_shipping_zones_fallback`: `CREATE INDEX idx_shipping_zones_fallback ON public.shipping_zones USING btree (is_fallback) WHERE (is_fallback = true)`
- `idx_single_fallback`: `CREATE UNIQUE INDEX idx_single_fallback ON public.shipping_zones USING btree (is_fallback) WHERE (is_fallback = true)`

---

