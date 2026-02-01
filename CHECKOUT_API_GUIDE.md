# Spring Boot Checkout API - Production Implementation

## Overview

This implementation provides a **production-grade checkout API** for FarmChainX that:

✅ Creates orders in a shared database table  
✅ Links customer, retailer, and distributor relationships  
✅ Stores order items as child entities with price snapshots  
✅ Sets initial status = PLACED  
✅ Is fully transactional with ACID compliance  
✅ Extracts customer ID from JWT (never trusts frontend)  
✅ Validates products and inventory before checkout  
✅ Handles errors gracefully with rollback

---

## 1. FILES CREATED

```
backend/src/main/java/com/farmxchain/model/
  ├── Order.java                    (Order entity with state machine)
  └── OrderItem.java                (Line item with price snapshot)

backend/src/main/java/com/farmxchain/repository/
  ├── OrderRepository.java           (Role-based queries)
  └── OrderItemRepository.java       (Line item queries)

backend/src/main/java/com/farmxchain/service/
  └── OrderService.java              (Business logic, transactions)

backend/src/main/java/com/farmxchain/controller/
  └── OrderController.java           (REST endpoints)
```

---

## 2. DATABASE SCHEMA REQUIRED

Run this migration **BEFORE** starting the application:

```sql
-- Create ORDERS table
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('PLACED', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED') DEFAULT 'PLACED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create ORDER_ITEMS table
CREATE TABLE IF NOT EXISTS order_items (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    farmer_id BIGINT NOT NULL,
    retailer_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    price_at_purchase DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
    FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (retailer_id) REFERENCES users(id) ON DELETE RESTRICT,

    INDEX idx_order_id (order_id),
    INDEX idx_product_id (product_id),
    INDEX idx_retailer_id (retailer_id),
    INDEX idx_farmer_id (farmer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

**IMPORTANT**: Your `products` table must have these columns:

- `price` (DECIMAL)
- `quantity` (INT)
- `farmer_id` (BIGINT)
- `retailer_id` (BIGINT)

---

## 3. ENTITY RELATIONSHIPS

```
┌─────────────────────────────────────────────────────┐
│ User (customer)                                     │
│ - id (PK)                                           │
│ - email                                             │
│ - role = 'customer'                                 │
└────────────────┬────────────────────────────────────┘
                 │ 1:many
                 ↓
┌─────────────────────────────────────────────────────┐
│ Order                                               │
│ - id (PK)                                           │
│ - customer_id (FK) ← Links back to User             │
│ - totalAmount (SUM of order items)                  │
│ - status: PLACED → CONFIRMED → SHIPPED → DELIVERED │
│ - createdAt (immutable)                             │
│ - updatedAt (auto-updated)                          │
└────────────────┬────────────────────────────────────┘
                 │ 1:many
                 ↓
┌─────────────────────────────────────────────────────┐
│ OrderItem                                           │
│ - id (PK)                                           │
│ - order_id (FK) ← Links to Order                    │
│ - product_id (FK) ← Links to Product                │
│ - farmer_id ← SNAPSHOT of product.farmerId          │
│ - retailer_id ← SNAPSHOT of product.retailerId      │
│ - quantity                                          │
│ - priceAtPurchase ← IMMUTABLE price snapshot        │
│ - createdAt                                         │
└─────────────────────────────────────────────────────┘
```

---

## 4. API ENDPOINTS

### POST /api/orders - **CHECKOUT** (Core Endpoint)

**Request:**

```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": 1, "quantity": 2},
      {"productId": 3, "quantity": 1}
    ]
  }'
```

**Response (201 CREATED):**

```json
{
  "id": 12345,
  "customerId": 99,
  "customerName": "John Doe",
  "totalAmount": 250.0,
  "status": "PLACED",
  "items": [
    {
      "id": 1,
      "productId": 1,
      "productName": "Tomato",
      "quantity": 2,
      "priceAtPurchase": 100.0,
      "farmerId": 10,
      "retailerId": 20,
      "lineTotal": 200.0
    },
    {
      "id": 2,
      "productId": 3,
      "productName": "Carrot",
      "quantity": 1,
      "priceAtPurchase": 50.0,
      "farmerId": 11,
      "retailerId": 21,
      "lineTotal": 50.0
    }
  ],
  "createdAt": "2026-02-01T10:30:00",
  "updatedAt": "2026-02-01T10:30:00"
}
```

**Error Responses:**

```json
// 400 - Bad Request (validation error)
{
  "message": "Insufficient stock for Tomato. Available: 1, Requested: 5",
  "timestamp": "2026-02-01T10:30:00"
}

// 401 - Unauthorized (missing JWT)
{
  "message": "Missing or invalid Authorization header",
  "timestamp": "2026-02-01T10:30:00"
}

// 403 - Forbidden (not a customer)
{
  "message": "Only customers can place orders. Your role: retailer",
  "timestamp": "2026-02-01T10:30:00"
}
```

---

### GET /api/orders/customer - Fetch Customer's Orders

```bash
curl -X GET http://localhost:8080/api/orders/customer \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

**Response (200 OK):**

```json
[
  {
    "id": 12345,
    "customerId": 99,
    "totalAmount": 250.00,
    "status": "PLACED",
    "items": [...],
    "createdAt": "2026-02-01T10:30:00"
  },
  {
    "id": 12346,
    "customerId": 99,
    "totalAmount": 150.00,
    "status": "DELIVERED",
    "items": [...],
    "createdAt": "2026-01-25T14:00:00"
  }
]
```

---

### GET /api/orders/retailer - Fetch Retailer's Orders

```bash
curl -X GET http://localhost:8080/api/orders/retailer \
  -H "Authorization: Bearer <RETAILER_JWT_TOKEN>"
```

Returns all orders containing items sold by this retailer.

---

### GET /api/orders/farmer - Fetch Farmer's Orders

```bash
curl -X GET http://localhost:8080/api/orders/farmer \
  -H "Authorization: Bearer <FARMER_JWT_TOKEN>"
```

Returns all orders containing items from this farmer's products.

---

### GET /api/orders/{id} - Get Order Details

```bash
curl -X GET http://localhost:8080/api/orders/12345 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

### PUT /api/orders/{id}/confirm - Retailer Confirms Order

```bash
curl -X PUT http://localhost:8080/api/orders/12345/confirm \
  -H "Authorization: Bearer <RETAILER_JWT_TOKEN>"
```

Transitions: PLACED → CONFIRMED

---

### PUT /api/orders/{id}/ship - Distributor Ships Order

```bash
curl -X PUT http://localhost:8080/api/orders/12345/ship \
  -H "Authorization: Bearer <DISTRIBUTOR_JWT_TOKEN>"
```

Transitions: CONFIRMED → SHIPPED

---

### PUT /api/orders/{id}/deliver - Distributor Delivers Order

```bash
curl -X PUT http://localhost:8080/api/orders/12345/deliver \
  -H "Authorization: Bearer <DISTRIBUTOR_JWT_TOKEN>"
```

Transitions: SHIPPED → DELIVERED

---

### PUT /api/orders/{id}/cancel - Cancel Order

```bash
curl -X PUT http://localhost:8080/api/orders/12345/cancel \
  -H "Authorization: Bearer <CUSTOMER_JWT_TOKEN>"
```

- Restores inventory
- Only customer who placed order can cancel
- Can cancel at any stage before delivery

---

## 5. TRANSACTIONAL CHECKOUT FLOW

```
POST /api/orders
│
├─ 1. SECURITY: Extract JWT
│     • Extract email from token
│     • Extract role from token
│     • Validate role = 'customer'
│     • Get User from database (never trust frontend)
│
├─ 2. VALIDATION: Validate cart
│     • Check cart not empty
│     • Check cart size <= 100
│
├─ 3. FOR EACH ITEM (in transaction):
│     • Load Product from database
│     • Validate product exists
│     • Validate farmerId NOT NULL
│     • Validate retailerId NOT NULL
│     • Validate quantity > 0
│     • Validate price > 0
│     • Check stock: product.quantity >= requested
│
├─ 4. CREATE ORDER:
│     • Create Order entity
│     • Set customer_id from JWT
│     • Set totalAmount = SUM(price * qty)
│     • Set status = PLACED
│     • Set createdAt, updatedAt = NOW()
│     • SAVE to database
│
├─ 5. CREATE ORDER ITEMS:
│     • For each cart item:
│       • Create OrderItem
│       • Set order_id to created order
│       • Set product_id
│       • Set farmerId = product.farmerId (SNAPSHOT)
│       • Set retailerId = product.retailerId (SNAPSHOT)
│       • Set priceAtPurchase = product.price (IMMUTABLE)
│       • Set quantity
│       • SAVE to database
│
├─ 6. UPDATE INVENTORY:
│     • For each product in order:
│       • product.quantity -= orderItem.quantity
│       • SAVE to database
│
├─ 7. ON SUCCESS:
│     • Return Order with status = PLACED
│     • HTTP 201 CREATED
│
└─ ON ERROR:
      • Rollback all database changes
      • Return error message
      • HTTP 4xx or 5xx
```

---

## 6. SECURITY ARCHITECTURE

### JWT Extraction

```java
// From Authorization header
String token = authHeader.substring(7);  // Remove "Bearer "

// Extract claims (verified with secret key)
String email = jwtUtil.extractEmail(token);
String role = jwtUtil.extractRole(token);

// Get user from database (NEVER trust frontend)
User customer = userRepository.findByEmail(email);
```

### Why This Matters

❌ **WRONG:**

```javascript
// Frontend sends user ID
POST /api/orders
{ "customerId": 99, "items": [...] }
// Anyone can send any customer ID!
```

✅ **CORRECT:**

```java
// Backend extracts from JWT
String token = authHeader.substring(7);
String email = jwtUtil.extractEmail(token);
User customer = userRepository.findByEmail(email);  // From DB
// customerId = customer.getId();  // Secure!
```

---

## 7. PRICE SNAPSHOT LOGIC

### Why Lock Price at Purchase?

Product prices change over time:

```
Timeline:
  T0: Product price = $2.50/kg
      Customer orders 10kg
      OrderItem.priceAtPurchase = 2.50

  T1: Product price changes to $3.00/kg (inflation, etc)

  T2: View order receipt
      Shows $2.50/kg (locked price)
      Not $3.00/kg (current price)
```

### Implementation

```java
// At checkout time
BigDecimal priceAtPurchase = BigDecimal.valueOf(product.getPrice());
item.setPriceAtPurchase(priceAtPurchase);

// Store in DB as IMMUTABLE (no setter after creation)
// Can only be set during OrderItem construction
```

**Benefits:**

- Prevents price disputes
- Audit trail of historical prices
- Compliance with regulations
- Accurate financial reporting

---

## 8. INVENTORY MANAGEMENT

### Stock Check Before Checkout

```java
if (product.getQuantity() == null || product.getQuantity() <= 0) {
    throw new Exception("Product out of stock");
}

if (product.getQuantity() < cartItem.quantity) {
    throw new Exception("Insufficient stock. Available: " +
                       product.getQuantity() +
                       ", Requested: " + cartItem.quantity);
}
```

### Decrement After Order Created

```java
// Only after order successfully persisted
product.setQuantity(product.getQuantity() - quantity);
productRepository.save(product);
```

### Restore on Cancellation

```java
// When order cancelled, restore inventory
for (OrderItem item : order.getItems()) {
    Product product = item.getProduct();
    product.setQuantity(product.getQuantity() + item.getQuantity());
    productRepository.save(product);
}
```

---

## 9. PRODUCTION CHECKLIST

Before deploying to production:

- [ ] Database migrations run successfully
- [ ] `products` table has: `price`, `quantity`, `farmer_id`, `retailer_id`
- [ ] `users` table has: `id`, `email`, `role`, `name`
- [ ] JWT secret key configured (32+ chars)
- [ ] Test checkout with valid JWT
- [ ] Test insufficient inventory error
- [ ] Test invalid product error
- [ ] Test missing required fields error
- [ ] Verify order appears in customer orders
- [ ] Verify retailer can see order
- [ ] Verify farmer can see order
- [ ] Test order status transitions (confirm → ship → deliver)
- [ ] Test order cancellation (inventory restored)
- [ ] Load test with 100+ concurrent checkouts
- [ ] Monitor database transaction performance
- [ ] Setup error logging and alerts
- [ ] Create database backup before go-live

---

## 10. TESTING EXAMPLES

### Test 1: Successful Checkout

```bash
# 1. Get JWT token for customer
CUSTOMER_TOKEN=$(curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"customer@test.com","password":"pass123"}' \
  | jq -r '.token')

# 2. Verify products exist
curl http://localhost:8080/api/products/1 -H "Authorization: Bearer $CUSTOMER_TOKEN"

# 3. Checkout
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": 1, "quantity": 2},
      {"productId": 2, "quantity": 1}
    ]
  }' | jq .

# Expected: 201 CREATED with Order details
```

### Test 2: Insufficient Inventory

```bash
# Request more than available
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer $CUSTOMER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"productId": 1, "quantity": 9999}
    ]
  }' | jq .

# Expected: 400 BAD REQUEST with error message
```

### Test 3: Unauthorized (Missing JWT)

```bash
curl -X POST http://localhost:8080/api/orders \
  -H "Content-Type: application/json" \
  -d '{"items": [...]}'

# Expected: 401 UNAUTHORIZED
```

### Test 4: Wrong Role (Retailer tries to checkout)

```bash
RETAILER_TOKEN=$(curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"retailer@test.com","password":"pass123"}' \
  | jq -r '.token')

curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer $RETAILER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items": [...]}'

# Expected: 403 FORBIDDEN
```

---

## 11. MONITORING & OBSERVABILITY

### Logging

The service logs key events:

```
[OrderController] Checkout request received
[OrderController] Customer: 99 (customer@test.com)
[OrderController] Processing 2 items
[OrderService] Creating order for customer: 99, items: 2
[OrderService] Item validated: productId=1, qty=2, price=100.00
[OrderService] Order created with id=12345, total=250.00
[OrderService] Inventory updated: productId=1, newQuantity=8
[OrderController] Order created: 12345
```

### Metrics to Monitor

- Orders created per minute
- Average order value
- Inventory updates per minute
- Transaction duration (target: <1s)
- Error rate (target: <0.1%)
- JWT validation failures
- Database connection pool usage

### Alerts

```
CRITICAL: OrderService Exception
ERROR: Insufficient stock detected
WARNING: Order creation > 5 seconds
WARNING: Database transaction rollback
```

---

## 12. NEXT STEPS

1. **Copy files** from this document to your backend
2. **Run SQL migration** to create tables
3. **Rebuild Spring Boot**: `mvn clean package`
4. **Test manually** with curl commands above
5. **Update React frontend** to call POST /api/orders
6. **Deploy** with database backup
7. **Monitor** for errors and performance

---

**Questions?** Check the ARCHITECTURE_ANALYSIS.md for design decisions.
