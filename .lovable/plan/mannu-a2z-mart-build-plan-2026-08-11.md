# Mannu A2Z Mart — Build Plan

Hyperlocal multi-vendor delivery platform with four roles: Admin, Customer, Seller, Delivery Partner.

## Stack reality (important)

The app runs on this project's fixed stack: React + TanStack Start (Vite), Tailwind, Lucide, and Lovable Cloud for the backend (PostgreSQL, auth, realtime, server functions). Equivalent capabilities, different plumbing:

- Express/Node API -> server functions on the same app server
- Socket.IO rooms/events -> Cloud Realtime channels (same event names: `order:new`, `order:status_update`, `delivery:new_request`, `delivery:location_update`)
- JWT + bcrypt -> built-in auth (bcrypt-equivalent hashing, JWT sessions)
- On-device SQLite offline cache -> IndexedDB queue for GPS pings, flushed on reconnect
- React-Leaflet maps stay as specified

Phone + password login uses a synthetic internal email (`<phone>@mannu.local`), so login is phone-only as requested; email password reset will not be available.

## Phase 1 — Foundation, Admin, Customer storefront (this build)

1. **Database + seed**: users/profiles, user_roles (separate table), customer_addresses, stores, store_relocation_requests, categories, units, products, orders, order_items, delivery_location_logs, system_settings. RLS on every table, role checks via a security-definer `has_role`. Seed admin (`7643840194` / `Admin@Suraj1992`), default categories (Ration, Sabji, Meat, Fruits, Kapda, Jewellery, Kitchen), units (kg, pcs, ltr, darjan), distance slabs 0-3/3-6/6-9/9-12 km, platform fee, COD limit, multi-pickup bonus, plus demo stores and products.
2. **Auth + approval flow**: phone/password signup as CUSTOMER (APPROVED), profile forms to request SELLER or DELIVERY (PENDING), role-gated routing.
3. **Customer panel**: Instamart-style home (category grid, banners, store list, search), store page, single-store cart lock warning, saved addresses with Leaflet pin-drop + landmark fields, checkout with dynamic distance-slab delivery charge.
4. **Admin panel**: dashboard (active orders, revenue, driver cash limits), unified approval queue (seller / delivery / relocation), CRUD for categories, units, and system settings incl. commissions, surge, coupons.

## Phase 2 — Seller + Delivery + live tracking

- Seller: incoming-order loud ring alert, accept + prep-time selector, out-of-stock toggle, product CRUD, relocation request with map pin.
- Delivery: online/offline duty toggle, offer screen with distance and earnings (base + multi-pickup bonus), step-by-step route Pickup A -> Pickup B -> Deliver, 4-digit OTP completion, background GPS with offline IndexedDB batching.
- Customer live tracking map with animated partner marker; admin route-history playback.
- Two-store batched multi-pickup within 12 km.

## Design direction

Mobile-first, dense Indian quick-commerce look: warm saffron/deep-green accents on off-white, chunky rounded cards, large tap targets, bottom tab bar for customer and delivery panels, data-dense tables for admin. Semantic design tokens only.

## Technical notes

- Roles live in a dedicated `user_roles` table (never on profiles) to prevent privilege escalation.
- Approval status changes and any admin action run through auth-checked server functions verifying the admin role server-side.
- Order placement, OTP verification, and earnings math are server-side; the client never computes payouts.
- Maps load client-side only (lazy `react-leaflet` behind a client-only boundary) to keep SSR working.
