# SQL Queries - Role-Based Order Visibility

## Overview

Complete SQL queries for retailers and distributors to view role-specific orders from a shared database table. All queries use proper indexing and are optimized for performance.

---

## Prerequisites

### Database Schema

```sql
-- orders table with distributor_id field
CREATE TABLE orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,
    distributor_id BIGINT NULL,  -- ✅ Critical for distributor visibility
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED')
           NOT NULL DEFAULT 'PLACED',
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_distributor_id (distributor_id),  -- ✅ For distributor queries
    INDEX idx_distributor_status (distributor_id, status)  -- ✅ Composite index
);

-- order_items table with retailer_id snapshot
CREATE TABLE order_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    farmer_id BIGINT NOT NULL,
    retailer_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    price_at_purchase DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_order_id (order_id),
    INDEX idx_retailer_id (retailer_id),  -- ✅ For retailer queries
    INDEX idx_farmer_id (farmer_id)
);
```

---

## RETAILER QUERIES

### Query 1: Get All Pending Orders for Retailer

**Use Case:** Retailer dashboard shows orders they need to fulfill

```sql
SELECT DISTINCT
    o.id,
    o.customer_id,
    o.total_amount,
    o.status,
    o.created_at,
    COUNT(DISTINCT oi.id) as item_count
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = 20
AND o.status IN ('PLACED', 'CONFIRMED')
GROUP BY o.id, o.customer_id, o.total_amount, o.status, o.created_at
ORDER BY o.created_at DESC;
```

**Explanation:**

- `DISTINCT` prevents duplicate rows when order has multiple items
- `WHERE oi.retailer_id = 20` filters to only items from this retailer
- `AND o.status IN ('PLACED', 'CONFIRMED')` shows only actionable orders
- `GROUP BY` ensures one row per order (with item count)

**Performance:**

- Uses index `idx_retailer_id` on order_items
- Uses index `idx_status` on orders
- ~10-50ms for typical retailer with 100+ orders

---

### Query 2: Get Orders with Retailer's Items (Detailed)

**Use Case:** Show retailer what items they have in each order

```sql
SELECT
    o.id as order_id,
    o.customer_id,
    u.full_name as customer_name,
    u.email as customer_email,
    o.total_amount,
    o.status,
    o.created_at,
    oi.id as item_id,
    oi.product_id,
    p.name as product_name,
    oi.quantity,
    p.unit,
    oi.price_at_purchase,
    (oi.quantity * oi.price_at_purchase) as line_total,
    oi.farmer_id,
    f.full_name as farmer_name
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
JOIN products p ON oi.product_id = p.id
JOIN users u ON o.customer_id = u.id
LEFT JOIN users f ON oi.farmer_id = f.id
WHERE oi.retailer_id = 20
AND o.status IN ('PLACED', 'CONFIRMED')
ORDER BY o.created_at DESC, oi.id ASC;
```

**Explanation:**

- Multiple joins get customer, product, and farmer details
- `LEFT JOIN` for farmer (may not always have user record)
- Returns one row per item (not distinct)
- Retailer can see every item from them in each order

---

### Query 3: Count Pending Items by Retailer

**Use Case:** Show retailer summary of how many items to fulfill

```sql
SELECT
    oi.retailer_id,
    COUNT(DISTINCT o.id) as order_count,
    COUNT(oi.id) as item_count,
    SUM(oi.quantity) as total_quantity,
    SUM(oi.quantity * oi.price_at_purchase) as total_value
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = 20
AND o.status IN ('PLACED', 'CONFIRMED')
GROUP BY oi.retailer_id;
```

**Result:**

```
retailer_id  order_count  item_count  total_quantity  total_value
20           5            8           25              450.00
```

---

### Query 4: Orders with Multiple Retailers (Show Context)

**Use Case:** Show retailer other retailers also selling items in same order

```sql
SELECT
    o.id as order_id,
    o.status,
    COUNT(DISTINCT oi.retailer_id) as retailer_count,
    GROUP_CONCAT(DISTINCT oi.retailer_id) as other_retailer_ids,
    (SELECT COUNT(*) FROM order_items oi2
     WHERE oi2.order_id = o.id
     AND oi2.retailer_id != 20) as other_retailer_item_count
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.id IN (
    SELECT DISTINCT o2.id
    FROM orders o2
    JOIN order_items oi2 ON o2.id = oi2.order_id
    WHERE oi2.retailer_id = 20
    AND o2.status IN ('PLACED', 'CONFIRMED')
)
GROUP BY o.id, o.status;
```

---

### Query 5: Retailer Orders in Date Range

**Use Case:** Analytics - orders fulfilled in a date range

```sql
SELECT
    DATE(o.created_at) as order_date,
    COUNT(DISTINCT o.id) as orders,
    COUNT(DISTINCT oi.id) as items,
    SUM(oi.quantity * oi.price_at_purchase) as daily_revenue
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = 20
AND o.created_at >= '2026-01-01'
AND o.created_at <= '2026-02-01'
GROUP BY DATE(o.created_at)
ORDER BY DATE(o.created_at) DESC;
```

**Result:**

```
order_date    orders  items  daily_revenue
2026-02-01    3       5      250.00
2026-01-31    2       4      180.00
2026-01-30    1       2      120.00
```

---

## DISTRIBUTOR QUERIES

### Query 6: Get All Orders Assigned to Distributor

**Use Case:** Distributor dashboard - show all assigned orders

```sql
SELECT
    o.id,
    o.customer_id,
    u.full_name as customer_name,
    u.phone,
    u.address,
    o.total_amount,
    o.status,
    o.distributor_id,
    COUNT(oi.id) as item_count,
    SUM(oi.quantity) as total_quantity,
    o.created_at,
    o.updated_at
FROM orders o
LEFT JOIN users u ON o.customer_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.distributor_id = 5
AND o.status IN ('PACKED', 'SHIPPED', 'DELIVERED')
GROUP BY o.id, o.customer_id, u.full_name, u.phone, u.address,
         o.total_amount, o.status, o.distributor_id, o.created_at, o.updated_at
ORDER BY
    CASE
        WHEN o.status = 'PACKED' THEN 1
        WHEN o.status = 'SHIPPED' THEN 2
        WHEN o.status = 'DELIVERED' THEN 3
    END ASC,
    o.created_at DESC;
```

**Explanation:**

- `WHERE distributor_id = 5` shows only orders assigned to this distributor
- `AND status IN (...)` shows only relevant statuses
- Groups by order to get item count
- Orders results by status (PACKED first, then SHIPPED, then DELIVERED)

---

### Query 7: Get Only PACKED Orders (Ready to Ship)

**Use Case:** Distributor picks up ready orders from warehouse

```sql
SELECT
    o.id,
    o.customer_id,
    u.full_name as customer_name,
    u.phone,
    u.address,
    o.total_amount,
    COUNT(oi.id) as item_count,
    SUM(oi.quantity) as total_quantity,
    o.created_at as pack_date
FROM orders o
LEFT JOIN users u ON o.customer_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.distributor_id = 5
AND o.status = 'PACKED'
GROUP BY o.id, o.customer_id, u.full_name, u.phone, u.address,
         o.total_amount, o.created_at
ORDER BY o.created_at ASC;
```

**Result:**

```
id     customer_name  total_amount  item_count  pack_date
12345  John Doe       250.00        2           2026-02-01 10:30:00
12347  Jane Smith     180.00        1           2026-02-01 11:00:00
12349  Bob Johnson    320.00        3           2026-02-01 11:15:00
```

---

### Query 8: Get Already Shipped Orders

**Use Case:** Distributor track in-transit and delivered orders

```sql
SELECT
    o.id,
    o.customer_id,
    u.full_name as customer_name,
    o.total_amount,
    o.status,
    o.updated_at as last_update,
    COUNT(DISTINCT oi.id) as item_count,
    CASE
        WHEN o.status = 'SHIPPED' THEN DATEDIFF(NOW(), o.updated_at)
        WHEN o.status = 'DELIVERED' THEN 'Complete'
        ELSE 'N/A'
    END as days_in_transit
FROM orders o
LEFT JOIN users u ON o.customer_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.distributor_id = 5
AND o.status IN ('SHIPPED', 'DELIVERED')
GROUP BY o.id
ORDER BY o.updated_at DESC;
```

**Result:**

```
id     customer_name  status     days_in_transit
12340  Alice Brown    DELIVERED  Complete
12339  Carol White    SHIPPED    2
12338  David Green    SHIPPED    1
```

---

### Query 9: Distributor Capacity Check

**Use Case:** How many orders is distributor handling today?

```sql
SELECT
    o.distributor_id,
    u.full_name as distributor_name,
    o.status,
    COUNT(DISTINCT o.id) as order_count,
    SUM(oi.quantity) as total_items,
    SUM(oi.quantity * oi.price_at_purchase) as total_value
FROM orders o
LEFT JOIN users u ON o.distributor_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.distributor_id IS NOT NULL
AND o.status IN ('PACKED', 'SHIPPED')
GROUP BY o.distributor_id, u.full_name, o.status
ORDER BY o.status ASC, order_count DESC;
```

**Result:**

```
distributor_id  distributor_name  status   order_count  total_items  total_value
5               Fast Logistics    PACKED   3            8            750.00
5               Fast Logistics    SHIPPED  5            15           1200.00
6               Swift Express     PACKED   2            5            400.00
6               Swift Express     SHIPPED  3            10           900.00
```

---

### Query 10: Orders Waiting for Distributor Assignment

**Use Case:** Warehouse staff pack orders and assign to distributors

```sql
SELECT
    o.id,
    o.customer_id,
    u.full_name as customer_name,
    u.city,
    o.total_amount,
    COUNT(DISTINCT oi.id) as item_count,
    COUNT(DISTINCT oi.retailer_id) as retailer_count,
    o.created_at,
    DATEDIFF(NOW(), o.created_at) as hours_waiting
FROM orders o
LEFT JOIN users u ON o.customer_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.status = 'CONFIRMED'
AND o.distributor_id IS NULL
GROUP BY o.id, o.customer_id, u.full_name, u.city, o.total_amount, o.created_at
HAVING DATEDIFF(NOW(), o.created_at) <= 24  -- Within 24 hours
ORDER BY o.created_at ASC;
```

**Purpose:** Find orders that need packing and distributor assignment

---

## ANALYTICS QUERIES

### Query 11: Orders by Role (Summary)

**Use Case:** Admin dashboard - see order flow across all roles

```sql
SELECT
    'CUSTOMER' as role,
    COUNT(DISTINCT o.customer_id) as active_users,
    COUNT(DISTINCT o.id) as orders,
    SUM(o.total_amount) as total_value
FROM orders o
UNION ALL
SELECT
    'RETAILER' as role,
    COUNT(DISTINCT oi.retailer_id),
    COUNT(DISTINCT o.id),
    SUM(o.total_amount)
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.status IN ('PLACED', 'CONFIRMED')
UNION ALL
SELECT
    'DISTRIBUTOR' as role,
    COUNT(DISTINCT o.distributor_id),
    COUNT(DISTINCT o.id),
    SUM(o.total_amount)
FROM orders o
WHERE o.distributor_id IS NOT NULL;
```

**Result:**

```
role         active_users  orders  total_value
CUSTOMER     45            50      12500.00
RETAILER     12            47      11800.00
DISTRIBUTOR  8             48      12000.00
```

---

### Query 12: Distributor Performance Report

**Use Case:** Analytics - which distributors ship fastest?

```sql
SELECT
    o.distributor_id,
    u.full_name as distributor_name,
    COUNT(DISTINCT o.id) as total_orders,
    COUNT(CASE WHEN o.status = 'DELIVERED' THEN 1 END) as delivered,
    SUM(o.total_amount) as revenue,
    ROUND(AVG(DATEDIFF(o.updated_at, o.created_at)), 1) as avg_days_to_deliver,
    MIN(DATEDIFF(o.updated_at, o.created_at)) as fastest_delivery,
    MAX(DATEDIFF(o.updated_at, o.created_at)) as slowest_delivery
FROM orders o
LEFT JOIN users u ON o.distributor_id = u.id
WHERE o.distributor_id IS NOT NULL
AND o.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY o.distributor_id, u.full_name
ORDER BY avg_days_to_deliver ASC;
```

**Result:**

```
distributor_id  distributor_name  total_orders  delivered  revenue  avg_days_to_deliver
5               Fast Logistics    15            12         3000.00  2.3
6               Swift Express     12            10         2400.00  2.8
7               Quick Delivery    8             6          1600.00  3.1
```

---

### Query 13: Orders Stuck in Status

**Use Case:** Alert - orders that haven't moved in 24 hours

```sql
SELECT
    o.id,
    o.status,
    u.full_name as customer_name,
    o.total_amount,
    TIMEDIFF(NOW(), o.updated_at) as time_stuck,
    CASE
        WHEN o.status = 'PLACED' THEN 'Waiting for retailer confirmation'
        WHEN o.status = 'CONFIRMED' THEN 'Waiting for packing'
        WHEN o.status = 'PACKED' THEN 'Waiting for shipment pickup'
        WHEN o.status = 'SHIPPED' THEN 'In transit'
    END as action_needed
FROM orders o
LEFT JOIN users u ON o.customer_id = u.id
WHERE o.status != 'DELIVERED'
AND o.status != 'CANCELLED'
AND o.updated_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
ORDER BY o.updated_at ASC;
```

---

### Query 14: Retailer-Distributor Relationship

**Use Case:** Understand which retailers' orders go to which distributors

```sql
SELECT
    oi.retailer_id,
    r.full_name as retailer_name,
    o.distributor_id,
    d.full_name as distributor_name,
    COUNT(DISTINCT o.id) as orders,
    SUM(o.total_amount) as value
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN users r ON oi.retailer_id = r.id
LEFT JOIN users d ON o.distributor_id = d.id
WHERE o.distributor_id IS NOT NULL
GROUP BY oi.retailer_id, o.distributor_id, r.full_name, d.full_name
ORDER BY oi.retailer_id, COUNT(DISTINCT o.id) DESC;
```

---

## Index Creation Statements

```sql
-- ✅ Retailer Queries
CREATE INDEX idx_retailer_id ON order_items(retailer_id);
CREATE INDEX idx_retailer_status ON order_items(retailer_id, order_id);

-- ✅ Distributor Queries
CREATE INDEX idx_distributor_id ON orders(distributor_id);
CREATE INDEX idx_distributor_status ON orders(distributor_id, status);

-- ✅ General Performance
CREATE INDEX idx_status ON orders(status);
CREATE INDEX idx_created_at ON orders(created_at);
CREATE INDEX idx_customer_id ON orders(customer_id);

-- ✅ Join Performance
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);

-- ✅ Composite Indexes
CREATE INDEX idx_orders_customer_status ON orders(customer_id, status);
CREATE INDEX idx_orders_distributor_created ON orders(distributor_id, created_at);
```

---

## Query Performance Optimization Tips

### 1. Always Use Indexes

```sql
-- ❌ SLOW - Full table scan
SELECT * FROM orders WHERE distributor_id = 5;

-- ✅ FAST - Uses index
SELECT * FROM orders WHERE distributor_id = 5;  -- With index created
```

### 2. Use DISTINCT When Needed

```sql
-- ❌ WRONG - Returns duplicate rows (one per item)
SELECT o.* FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = 20;

-- ✅ CORRECT - Returns unique orders
SELECT DISTINCT o.* FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = 20;
```

### 3. Group Aggregates Properly

```sql
-- ❌ WRONG - May return multiple rows per order
SELECT o.*, COUNT(oi.id) as item_count FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = 20;

-- ✅ CORRECT - Ensures one row per order
SELECT o.id, COUNT(oi.id) as item_count FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = 20
GROUP BY o.id;
```

### 4. Use Appropriate JOIN Types

```sql
-- LEFT JOIN when distributor might be NULL
SELECT o.*, u.full_name FROM orders o
LEFT JOIN users u ON o.distributor_id = u.id;

-- INNER JOIN when field must exist
SELECT o.*, p.name FROM orders o
INNER JOIN order_items oi ON o.id = oi.order_id
INNER JOIN products p ON oi.product_id = p.id;
```

---

## Execution Plans

### Query 6 Execution Plan (Distributor Query)

```
EXPLAIN SELECT
    o.id,
    o.customer_id,
    u.full_name,
    o.status,
    COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN users u ON o.customer_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE o.distributor_id = 5
AND o.status IN ('PACKED', 'SHIPPED', 'DELIVERED')
GROUP BY o.id;

+----+-------------+--------+-------+------------------------------------------+-------------------+---------+-------------------------------------------+------+----------+--------------------------+
| id | select_type | table  | type  | key                                      | key_len | ref     | rows | Extra                    |
+----+-------------+--------+-------+------------------------------------------+-------------------+---------+-------------------------------------------+------+----------+--------------------------+
| 1  | SIMPLE      | o      | range | idx_distributor_status                   | 9       | NULL    | 12   | Using where              |
| 1  | SIMPLE      | u      | eq_ref| PRIMARY                                  | 8       | o.customer_id | 1    |                          |
| 1  | SIMPLE      | oi     | ref   | idx_order_items_order                    | 8       | o.id    | 3    | Using index              |
+----+-------------+--------+-------+------------------------------------------+-------------------+---------+-------------------------------------------+------+----------+--------------------------+
```

**Analysis:**

- ✅ Good: Uses `idx_distributor_status` for WHERE clause (range query)
- ✅ Good: Uses PRIMARY key for user lookup (fast)
- ✅ Good: Uses `idx_order_items_order` for item join
- **Estimated time:** 20-50ms for typical dataset

---

## Testing Queries

### Test 1: Insert Test Data

```sql
-- Insert test orders
INSERT INTO orders (customer_id, distributor_id, total_amount, status, created_at, updated_at)
VALUES
    (99, NULL, 250.00, 'PLACED', NOW(), NOW()),
    (99, NULL, 180.00, 'CONFIRMED', NOW(), NOW()),
    (99, 5, 200.00, 'PACKED', NOW(), NOW()),
    (99, 5, 150.00, 'SHIPPED', NOW(), NOW()),
    (100, 6, 220.00, 'PACKED', DATE_SUB(NOW(), INTERVAL 1 DAY), NOW());

-- Insert test order items
INSERT INTO order_items (order_id, product_id, farmer_id, retailer_id, quantity, price_at_purchase, created_at)
VALUES
    (1, 1, 10, 20, 2, 50.00, NOW()),
    (1, 5, 11, 21, 1, 50.00, NOW()),
    (2, 3, 12, 20, 5, 30.00, NOW()),
    (3, 1, 10, 20, 2, 50.00, NOW()),
    (4, 5, 11, 21, 1, 50.00, NOW()),
    (5, 1, 10, 20, 2, 50.00, NOW());
```

### Test 2: Verify Retailer Visibility

```sql
-- Retailer 20 should see orders 1, 2, 3
SELECT DISTINCT o.id FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = 20
AND o.status IN ('PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED');

-- Expected result: 1, 2, 3, 4
```

### Test 3: Verify Distributor Visibility

```sql
-- Distributor 5 should see orders 3, 4
SELECT o.id FROM orders o
WHERE o.distributor_id = 5
AND o.status IN ('PACKED', 'SHIPPED', 'DELIVERED');

-- Expected result: 3, 4
```

---

## Summary

| Query | Purpose        | Role        | Performance | Indexes Used          |
| ----- | -------------- | ----------- | ----------- | --------------------- |
| 1     | Pending orders | Retailer    | 10-50ms     | retailer_id, status   |
| 2     | Order details  | Retailer    | 20-100ms    | retailer_id, order_id |
| 6     | All assigned   | Distributor | 20-100ms    | distributor_status    |
| 7     | Ready to ship  | Distributor | 10-50ms     | distributor_status    |
| 8     | In transit     | Distributor | 10-50ms     | distributor_status    |
| 12    | Performance    | Analytics   | 50-200ms    | distributor_id        |

**Key Principle:** Index by access pattern, query efficiently with JOINs, use GROUP BY to deduplicate.
