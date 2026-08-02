# Database Schema Reference — Mamator

**Database:** `store_mamator` @ fleet-postgres (PostgreSQL 16.14)  
**Schema:** `public`  
**App role:** `store_mamator`  
**Primary key convention:** `uuid` via `gen_random_uuid()` unless noted

Active store tables only (34 tables). Legacy Supabase auth/storage tables are not present.

---

## Custom enum types

| Type | Values |
|------|--------|
| `user_role` | admin, staff, customer |
| `gender_type` | male, female, other, prefer_not_to_say |
| `address_type` | shipping, billing, both |
| `product_status` | active, draft, archived |
| `category_status` | active, inactive |
| `order_status` | pending, awaiting_payment, processing, shipped, delivered, cancelled, refunded |
| `payment_status` | pending, paid, failed, refunded, partially_refunded, **partially_paid** |
| `discount_type` | percentage, fixed_amount, free_shipping |
| `review_status` | pending, approved, rejected |
| `blog_status` | draft, published, archived |
| `ticket_status` | open, in_progress, waiting_customer, resolved, closed |
| `ticket_priority` | low, medium, high, urgent |
| `return_status` | pending, approved, rejected, processing, completed |

---

## Auth and users

### `users`

| | |
|--|--|
| **Purpose** | Credential store (formerly Supabase `auth.users`) |
| **PK** | `id` uuid |
| **Unique** | `email` |
| **Key columns** | `encrypted_password`, `email_confirmed_at`, `raw_user_meta_data`, `last_sign_in_at` |
| **FKs** | Referenced by `profiles`, orders, addresses, etc. |
| **Indexes** | `users_email_key`; `idx_users_email_lower` (009) |
| **APIs** | `/api/auth/login`, `/api/auth/signup`, `/api/auth/me`, `/api/auth/forgot-password` |

### `profiles`

| | |
|--|--|
| **Purpose** | Extended user profile and role |
| **PK** | `id` uuid (= `users.id`) |
| **Unique** | `email` |
| **Key columns** | `role` (user_role), `full_name`, `phone`, `avatar_url`, `preferences` jsonb |
| **FKs** | `id` → `users.id` |
| **Indexes** | `idx_profiles_email`, `idx_profiles_role` |
| **Triggers** | `handle_new_user` on users INSERT creates profile |
| **APIs** | `/api/auth/profile`, `/api/auth/me` |

---

## Catalog

### `categories`

| | |
|--|--|
| **Purpose** | Product taxonomy (nested via `parent_id`) |
| **PK** | `id` uuid |
| **Unique** | `slug` |
| **Key columns** | `name`, `description`, `parent_id`, `position`, `status`, `image_url` |
| **FKs** | `parent_id` → `categories.id` |
| **Indexes** | `idx_categories_slug`, `idx_categories_parent` |
| **APIs** | `/api/catalog/categories`, `/api/storefront/categories` |

### `products`

| | |
|--|--|
| **Purpose** | Core product catalog |
| **PK** | `id` uuid |
| **Unique** | `slug`, `sku` (nullable unique) |
| **Key columns** | `name`, `price`, `sale_price`, `quantity`, `category_id`, `status`, `featured`, `options` jsonb, `moq`, `tags` text[] |
| **FKs** | `category_id` → `categories.id` |
| **Checks** | `moq >= 1`; `quantity >= 0` (009) |
| **Indexes** | `idx_products_slug`, `_category`, `_status`, `_featured`, `_tags` (GIN) |
| **APIs** | `/api/catalog/products`, `/api/storefront/products`, `/api/storefront/products/[slug]`, `/api/storefront/search` |

### `product_variants`

| | |
|--|--|
| **Purpose** | SKU-level variants (size/color/etc.) |
| **PK** | `id` uuid |
| **Unique** | `sku` |
| **Key columns** | `product_id`, `name`, `price`, `quantity`, `option1`–`option3`, `image_url` |
| **FKs** | `product_id` → `products.id` |
| **APIs** | Included in product catalog APIs |

### `product_images`

| | |
|--|--|
| **Purpose** | Product gallery images |
| **PK** | `id` uuid |
| **Key columns** | `product_id`, `url`, `alt_text`, `position` |
| **FKs** | `product_id` → `products.id` |
| **Indexes** | `idx_product_images_product_pos` (009) |
| **APIs** | Product detail / admin product CRUD |

---

## Orders and commerce

### `orders`

| | |
|--|--|
| **Purpose** | Customer orders and payment state |
| **PK** | `id` uuid |
| **Unique** | `order_number` |
| **Key columns** | `user_id`, `email`, `phone`, `status`, `payment_status`, `currency` (default **GHS**), totals, `shipping_address`/`billing_address` jsonb, `metadata` jsonb, reminder flags |
| **FKs** | `user_id` → `users.id` (nullable for guest checkout) |
| **Checks** | `total >= 0`, `subtotal >= 0` (009) |
| **Indexes** | `idx_orders_order_number`, `_status`, `_user`, `_pending_reminders`, `idx_orders_payment_status_created`, `idx_orders_email_lower` |
| **RPCs** | `record_order_payment`, `mark_order_paid`, `update_customer_stats` |
| **APIs** | `/api/orders`, `/api/orders/[id]`, `/api/orders/summary`, `/api/orders/track`, `/api/admin/pos/checkout` |

**Important metadata keys:** `payment_option`, `amount_paid`, `balance_due`, `moolre_externalref`, `confirmation_sent_at`, `stock_reduced`.

### `order_items`

| | |
|--|--|
| **Purpose** | Line items (denormalized product names at order time) |
| **PK** | `id` uuid |
| **Key columns** | `order_id`, `product_id`, `variant_id`, `product_name`, `variant_name`, `quantity`, `unit_price`, `total_price` |
| **FKs** | `order_id` → `orders.id`; `product_id` → `products.id`; `variant_id` → `product_variants.id` |
| **Checks** | `quantity > 0`, `unit_price >= 0` (009) |
| **Indexes** | `idx_order_items_order`, `idx_order_items_product` |
| **APIs** | Nested in order APIs |

### `order_status_history`

| | |
|--|--|
| **Purpose** | Audit trail of order status changes |
| **PK** | `id` uuid |
| **Key columns** | `order_id`, `status`, `notes`, `created_by` |
| **FKs** | `order_id` → `orders.id`; `created_by` → `users.id` |
| **APIs** | Admin order detail |

### `customers`

| | |
|--|--|
| **Purpose** | CRM customer records (deduped by email) |
| **PK** | `id` uuid |
| **Unique** | `email` |
| **Key columns** | `phone`, names, `user_id`, `total_orders`, `total_spent`, `secondary_email`, `secondary_phone` |
| **FKs** | `user_id` → `users.id` |
| **Indexes** | `idx_customers_email`, `_user_id`, secondary contact indexes |
| **RPCs** | `upsert_customer_from_order`, `update_customer_stats` |
| **APIs** | `/api/admin/customers` |

### `addresses`

| | |
|--|--|
| **Purpose** | Saved user addresses |
| **PK** | `id` uuid |
| **Key columns** | `user_id`, `type`, `full_name`, `phone`, address lines, `is_default` |
| **FKs** | `user_id` → `users.id` |
| **Indexes** | `idx_addresses_user_id` |
| **APIs** | `/api/addresses`, `/api/addresses/[id]` |

### `coupons`

| | |
|--|--|
| **Purpose** | Discount codes |
| **PK** | `id` uuid |
| **Unique** | `code` |
| **Key columns** | `type`, `value`, limits, dates, `usage_count`, `is_active` |
| **Indexes** | `idx_coupons_code` |
| **APIs** | `/api/admin/coupons`, `/api/admin/coupons/[id]` |

### `cart_items`

| | |
|--|--|
| **Purpose** | Persistent shopping cart per user |
| **PK** | `id` uuid |
| **Unique** | `(user_id, product_id, variant_id)` |
| **FKs** | `user_id` → `users`; `product_id` → `products`; `variant_id` → `product_variants` |
| **APIs** | Cart logic in storefront (server actions / API as implemented) |

### `wishlist_items`

| | |
|--|--|
| **Purpose** | Saved products per user |
| **PK** | `id` uuid |
| **Unique** | `(user_id, product_id)` |
| **FKs** | `user_id` → `users`; `product_id` → `products` |

---

## Payments

### `payment_reconciliation_log`

| | |
|--|--|
| **Purpose** | Admin payment reconcile audit |
| **PK** | `id` uuid |
| **Key columns** | `order_number`, `action`, `result`, `admin_user_id`, `details` |
| **Indexes** | By `order_number`, `created_at DESC` |
| **Migration** | 005 |
| **APIs** | `/api/admin/payments/reconcile` |

### `payment_callback_events`

| | |
|--|--|
| **Purpose** | Idempotent Moolre callback/verify event log |
| **PK** | `id` uuid |
| **Key columns** | `gateway` (default moolre), `order_number`, `external_ref`, `gateway_reference`, `processing_status`, `amount`, `currency` |
| **Unique** | Partial indexes on processed gateway/external refs |
| **Migration** | 008 |
| **APIs** | Written by `/api/payment/moolre/callback`, verify route |

---

## Reviews and content

### `reviews`

| | |
|--|--|
| **Purpose** | Product reviews |
| **PK** | `id` uuid |
| **Key columns** | `product_id`, `user_id`, `rating` (1–5), `content`, `status`, `verified_purchase` |
| **FKs** | → `products`, `users` |
| **Checks** | `rating >= 1 AND rating <= 5` |
| **Triggers** | Updates `products.rating_avg`, `review_count` |
| **APIs** | `/api/reviews`, `/api/admin/reviews` |

### `review_images`

| | |
|--|--|
| **Purpose** | Images attached to reviews |
| **PK** | `id` uuid |
| **FKs** | `review_id` → `reviews.id` |

### `blog_posts`

| | |
|--|--|
| **Purpose** | Store blog |
| **PK** | `id` uuid |
| **Unique** | `slug` |
| **Key columns** | `title`, `content`, `author_id`, `status`, `published_at`, SEO fields |
| **FKs** | `author_id` → `users.id` |
| **APIs** | `/api/storefront/blog`, `/api/admin/blog` |

### `pages`

| | |
|--|--|
| **Purpose** | Static CMS pages |
| **PK** | `id` uuid |
| **Unique** | `slug` |

---

## CMS and storefront config

### `cms_content`

| | |
|--|--|
| **Purpose** | Structured homepage/section blocks |
| **PK** | `id` uuid |
| **Unique** | `(section, block_key)` |
| **Key columns** | `title`, `content`, `image_url`, `sort_order`, `is_active` |
| **APIs** | `/api/settings` (with site settings) |

### `banners`

| | |
|--|--|
| **Purpose** | Promotional banners with schedule |
| **PK** | `id` uuid |
| **Key columns** | `name`, `type`, dates, colors, CTA, `position`, `sort_order` |

### `navigation_menus` / `navigation_items`

| | |
|--|--|
| **Purpose** | Header/footer menu trees |
| **PK** | `id` uuid |
| **FKs** | items.`menu_id` → menus; items.`parent_id` → items |

### `site_settings`

| | |
|--|--|
| **Purpose** | Key/value site config |
| **PK** | `id` uuid |
| **Unique** | `key` |

### `store_settings`

| | |
|--|--|
| **Purpose** | Admin-editable store config (JSON values) |
| **PK** | `key` text |
| **FKs** | `updated_by` → `users.id` |
| **APIs** | `/api/settings` |

### `store_modules`

| | |
|--|--|
| **Purpose** | Feature flags per module id |
| **PK** | `id` text |
| **Key columns** | `enabled` boolean |

---

## Support and returns

### `support_tickets`

| | |
|--|--|
| **Purpose** | Customer support tickets |
| **PK** | `id` uuid |
| **Key columns** | `ticket_number` (serial), `user_id`, `email`, `subject`, `status`, `priority`, `assigned_to` |
| **FKs** | `user_id`, `assigned_to` → `users` |
| **Indexes** | `idx_tickets_status`, `idx_tickets_user` |

### `support_messages`

| | |
|--|--|
| **Purpose** | Thread messages on tickets |
| **PK** | `id` uuid |
| **FKs** | `ticket_id` → `support_tickets`; `user_id` → `users` |

### `return_requests` / `return_items`

| | |
|--|--|
| **Purpose** | RMA workflow |
| **PK** | uuid |
| **FKs** | request → `orders`, `users`; item → `return_requests`, `order_items` |

---

## Notifications and audit

### `notifications`

| | |
|--|--|
| **Purpose** | In-app user notifications |
| **PK** | `id` uuid |
| **FKs** | `user_id` → `users` |
| **Indexes** | `idx_notifications_user`, partial unread index |
| **APIs** | `/api/notifications` |

### `audit_logs`

| | |
|--|--|
| **Purpose** | Generic admin audit trail |
| **PK** | `id` uuid |
| **FKs** | `user_id` → `users` |
| **Indexes** | `idx_audit_logs_action`, `_user_id` |

---

## Migration infrastructure

### `schema_migrations`

| | |
|--|--|
| **Purpose** | Tracks applied `db/migrations/*.sql` files |
| **PK** | `id` text (filename) |
| **Key columns** | `applied_at` |
| **Migration** | 006 (bootstrap) |
| **APIs** | — (ops only); checked by `/api/health/db` |

---

## Key PostgreSQL functions

| Function | Purpose |
|----------|---------|
| `record_order_payment(order_ref, moolre_ref, charged_amount)` | Full/half payment settlement + stock |
| `mark_order_paid(order_ref, moolre_ref)` | Legacy full-payment settlement |
| `handle_new_user()` | Trigger: create profile on signup |
| `update_product_rating_stats()` | Trigger: maintain product ratings |
| `upsert_customer_from_order(...)` | CRM dedupe on order |
| `update_customer_stats(email, total)` | Post-payment customer aggregates |
| `reduce_stock_on_order(uuid)` | Alternate stock reduction |
| `update_updated_at_column()` | Trigger: touch `updated_at` |
| `is_admin_or_staff()` | Stub (returns false); app uses JWT roles |

---

## Entity relationship (core commerce)

```
users ──┬── profiles
        ├── addresses
        ├── cart_items ── products ──┬── product_variants
        │                            └── product_images
        ├── wishlist_items ── products
        └── orders ──┬── order_items ── products / variants
                     ├── order_status_history
                     ├── payment_callback_events (by order_number)
                     └── return_requests

categories ── products
customers (by email, optional user_id)
coupons (applied at checkout — stored in order metadata)
```

---

## SMS / email (not tables)

Outbound SMS uses Moolre VAS API (`lib/notifications.ts`). Dedupe fields live on `orders.metadata` (`confirmation_sent_at`) and reminder flags on `orders` columns. No `sms_messages` table exists.

---

## Schema smoke test

```bash
node scripts/test-db-schema.mjs
```

Verifies critical tables above plus `record_order_payment` and `mark_order_paid` functions.

---

## Related documents

- `DATABASE_AUDIT_AND_REPAIR_REPORT.md`
- `MIGRATION_STATUS_REPORT.md`
- `PAYMENT_DATABASE_AUDIT.md`
