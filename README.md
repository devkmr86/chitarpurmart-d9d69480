# Mannu Mart Connect

Act as a Senior Full-Stack Architect. Build "Mannu A2Z Mart" — a full-stack, production-ready hyperlocal multi-vendor delivery platform.

### 1. TECH STACK REQUIREMENTS
* Frontend: React (Vite), Tailwind CSS, Lucide Icons, React-Leaflet for Maps, Socket.io-client.
* Backend: Node.js, Express.js, PostgreSQL, Socket.IO, JWT, Bcrypt.js.
* Mobile/PWA Optimization: Mobile-first responsive UI with offline SQLite caching for background location updates.

---

### 2. ROLE-BASED AUTHENTICATION & APPROVAL FLOW
* Roles: ADMIN, CUSTOMER, SELLER, DELIVERY.
* Customer Auth: Direct phone number + password registration/login. Immediate status: APPROVED.
* Seller & Delivery Registration:
  1. Users register as a Customer first.
  2. In Profile, they submit a "Become Seller" or "Become Delivery Partner" request with store details / identity docs.
  3. Status stays PENDING until Admin approves.
* Admin Default Credentials:
  * Phone: `7643840194`
  * Password: `Admin@Suraj1992` (Hashed using bcrypt in PostgreSQL seed).

---

### 3. DATABASE SCHEMA & DATA MODELS
Build a PostgreSQL database with the following entities:
* Users: `id`, `phone`, `password_hash`, `full_name`, `role`, `status` (PENDING, APPROVED, REJECTED).
* Customer_Addresses: `id`, `customer_id`, `address_type`, `house_flat_no`, `street_area`, `landmark`, `latitude`, `longitude`, `is_default`.
* Stores: `id`, `seller_id`, `store_name`, `category_id`, `address_line`, `latitude`, `longitude`, `is_active`.
* Store_Relocation_Requests: `id`, `store_id`, `old_address`, `old_lat`, `old_lng`, `new_address`, `new_lat`, `new_lng`, `status`.
* Categories & Units: Dynamic CRUD tables managed by Admin (e.g., Ration, Sabji, Meat, Fruits, Kapda, Jewellery, Kitchen / kg, pcs, ltr, darjan).
* Products: `id`, `store_id`, `product_name`, `price`, `unit_id`, `stock_qty`, `is_available`.
* Orders & Order_Items: Supports single-store cart locks and 2-store batched multi-pickups within a 12 km radius.
* Delivery_Location_Logs: `id`, `delivery_boy_id`, `order_id`, `latitude`, `longitude`, `speed`, `heading`, `battery_level`, `recorded_at`.
* System_Settings: Dynamic dynamic delivery charges, distance slabs (0-3km, 3-6km, 6-9km, 9-12km), platform fees, COD cash limits, and multi-pickup bonuses.

---

### 4. CORE FEATURES & PAGE WORKFLOWS

#### A. Customer Panel
* App Home: Instamart-style UI with category grids, store listings, banner slides, and dynamic search.
* Single-Store Cart Lock: Warns customer if adding items from a different store.
* Saved Address & Location Picker: Map-based GPS pin drop with landmark fields.
* Real-Time Live Order Tracking: Interactive Leaflet map showing store marker, customer destination, and animated delivery partner marker via Socket.IO with speed heatmap capability.

#### B. Seller Panel
* Loud Ringing Sound Alert on receiving new incoming orders.
* Order Prep Time selector and instant Out-of-Stock toggle for perishable items.
* Relocation Management: Form to request store location updates (e.g., Kadru to Lalpur) with map pin drop, pending Admin approval.

#### C. Delivery Partner Panel
* Online/Offline Duty Toggle.
* Order Acceptance Screen: Displays distance, total earnings (Base Pay + Multi-pickup Bonus), and route overview.
* Step-by-Step Delivery Route: Sequential navigation (`Pickup Store A` -> `Pickup Store B` -> `Deliver to Customer`) with 4-digit OTP confirmation for delivery completion.
* Background GPS Tracker: Batches offline location pings to SQLite and flushes upon reconnection.

#### D. Admin Panel
* Master Dashboard: Oversee active orders, real-time revenue, and driver wallet cash limits.
* Unified Approval Queue: Approve/Reject Seller requests, Delivery Partner applications, and Store Relocation requests.
* Dynamic Configuration: Live edit delivery charges, commission percentages per category, surge pricing, and promotional discount coupons.
* Route History Playback: Reconstruct and view completed delivery trajectories on an interactive map.

---

### 5. REAL-TIME ARCHITECTURE (SOCKET.IO)
* Implement authenticated rooms: `user_{id}`, `store_{id}`, `admin_room`, `active_delivery_boys`.
* Events to support: `order:new`, `order:status_update`, `delivery:new_request`, `delivery:location_update`.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://chitarpurmart.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d0ddaf7e-4f2d-4149-a397-32fd718bc682).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
