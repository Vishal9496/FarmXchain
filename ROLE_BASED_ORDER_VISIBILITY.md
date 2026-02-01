# Role-Based Order Visibility Implementation

## Overview

This document explains how FarmChainX implements **role-based order visibility** where each role sees only orders relevant to them from a **single shared `orders` table**. No frontend state tricks, pure database-driven access control.

---

## Architecture

### Key Principle

```
Single Source of Truth: orders table
       ↓
Role-Specific Queries (via JPA @Query)
       ↓
Different Views per Role
```

**Why this approach:**

- ✅ Orders persist in database (not localStorage)
- ✅ All roles query same table (consistency)
- ✅ Query-level access control (security)
- ✅ No data duplication (single table)
- ✅ Audit trail visible to all (with permissions)

---

## Order Status Lifecycle

```
PLACED
  ↓ (customer → retailer)
CONFIRMED
  ↓ (retailer → warehouse)
PACKED (distributor assigned here)
  ↓ (warehouse → distributor)
SHIPPED
  ↓ (distributor → customer)
DELIVERED

OR at any step:
  ↓
CANCELLED (with inventory restoration)
```

**Critical: PACKED status is the trigger for distributor visibility!**

---

## Role-Based Visibility Rules

### 1. CUSTOMER

```sql
Customer sees: All orders they placed (customer_id matches)
Status visibility: ALL (PLACED, CONFIRMED, PACKED, SHIPPED, DELIVERED, CANCELLED)
```

**Use Case:** "Show me my order history"

```sql
SELECT * FROM orders
WHERE customer_id = 99
ORDER BY created_at DESC;
```

**JPA Query:**

```java
List<Order> findByCustomerId(@Param("customerId") Long customerId);
```

---

### 2. RETAILER

```sql
Retailer sees: Orders containing their products (items.retailer_id matches)
Status visibility: PLACED, CONFIRMED (not PACKED onwards - that's distributor's job)
Location: In order_items table - multiple retailers can be in same order
```

**Use Case:** "Show me orders I need to fulfill"

```sql
SELECT DISTINCT o.*
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = 20
AND o.status IN ('PLACED', 'CONFIRMED')
ORDER BY o.created_at DESC;
```

**Why DISTINCT?** Order can have multiple line items from same retailer OR different retailers

**JPA Query:**

```java
@Query("""
    SELECT DISTINCT o FROM Order o
    JOIN o.items oi
    WHERE oi.retailerId = :retailerId
    AND o.status IN ('PLACED', 'CONFIRMED')
    ORDER BY o.createdAt DESC
""")
List<Order> findPendingOrdersByRetailer(@Param("retailerId") Long retailerId);
```

**Example Query Result:**

```
Order #12345: customer_id=99, status=CONFIRMED
  Item 1: product=Tomato (retailer_id=20, farmer_id=10, qty=2, price=$100)
  Item 2: product=Carrot (retailer_id=21, farmer_id=11, qty=1, price=$50)

← Retailer 20 sees this (has Item 1)
← Retailer 21 sees this (has Item 2)
← Retailer 30 does NOT see this (not in any items)
```

---

### 3. DISTRIBUTOR (Complex - Multiple Visibility Levels)

#### Level A: PACKED Orders (Waiting for Pickup)

```sql
Distributor sees: Orders they are assigned to + status = PACKED
Meaning: "Show me orders I need to pick up and ship"
```

**Use Case:** "What orders are ready for me to ship?"

```sql
SELECT o.*
FROM orders o
WHERE o.distributor_id = 5
AND o.status = 'PACKED'
ORDER BY o.created_at ASC;
```

**JPA Query:**

```java
@Query("""
    SELECT o FROM Order o
    WHERE o.distributorId = :distributorId
    AND o.status = 'PACKED'
    ORDER BY o.createdAt ASC
""")
List<Order> findReadyToShipOrders(@Param("distributorId") Long distributorId);
```

#### Level B: All Assigned Orders (Complete View)

```sql
Distributor sees: Orders they are assigned to + status IN (PACKED, SHIPPED, DELIVERED)
Meaning: "Show me all orders I'm handling or have handled"
```

**Use Case:** "What's the status of all my orders?"

```sql
SELECT o.*
FROM orders o
WHERE o.distributor_id = 5
AND o.status IN ('PACKED', 'SHIPPED', 'DELIVERED')
ORDER BY o.status ASC, o.created_at DESC;
```

**JPA Query:**

```java
@Query("""
    SELECT o FROM Order o
    WHERE o.distributorId = :distributorId
    AND o.status IN ('PACKED', 'SHIPPED', 'DELIVERED')
    ORDER BY o.status ASC, o.createdAt DESC
""")
List<Order> findOrdersByDistributor(@Param("distributorId") Long distributorId);
```

#### Level C: Analytics (Orders by Status)

```sql
SELECT o.status, COUNT(*) as count
FROM orders o
WHERE o.distributor_id = 5
GROUP BY o.status
ORDER BY o.status;
```

**Response:**

```
PACKED: 3
SHIPPED: 12
DELIVERED: 45
```

---

## Database Schema

### orders Table

```sql
CREATE TABLE orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    customer_id BIGINT NOT NULL,

    -- ✅ CRITICAL: Distributor visibility field
    distributor_id BIGINT NULL,  -- NULL until status=PACKED

    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED')
           NOT NULL DEFAULT 'PLACED',

    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,

    FOREIGN KEY (customer_id) REFERENCES users(id),

    -- ✅ Indexes for role-based queries
    INDEX idx_customer_id (customer_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    INDEX idx_distributor_id (distributor_id),  -- ✅ NEW
    INDEX idx_distributor_status (distributor_id, status)  -- ✅ NEW
);
```

### order_items Table

```sql
CREATE TABLE order_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,

    -- ✅ SNAPSHOT columns (immutable at purchase time)
    farmer_id BIGINT NOT NULL,
    retailer_id BIGINT NOT NULL,

    quantity INT NOT NULL,
    price_at_purchase DECIMAL(10, 2) NOT NULL,

    created_at TIMESTAMP NOT NULL,

    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id),

    -- ✅ Indexes for retailer visibility queries
    INDEX idx_retailer_id (retailer_id),
    INDEX idx_farmer_id (farmer_id),
    INDEX idx_order_id (order_id)
);
```

---

## REST Endpoints

### Retailer: Get My Orders

**Endpoint:**

```
GET /api/orders/retailer
Authorization: Bearer <JWT>
```

**Security Validation:**

```java
String role = jwtUtil.extractRole(token);
if (!"retailer".equalsIgnoreCase(role)) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(new ErrorResponse("Only retailers can access this endpoint"));
}

Long retailerId = userRepository.findByEmail(jwtUtil.extractEmail(token)).getId();
// Use retailerId from database, not frontend
```

**Response (200 OK):**

```json
{
  "status": "success",
  "count": 3,
  "orders": [
    {
      "id": 12345,
      "customerId": 99,
      "customerName": "John Doe",
      "totalAmount": 250.0,
      "status": "CONFIRMED",
      "myItems": [
        {
          "id": 1,
          "productId": 1,
          "productName": "Tomato",
          "quantity": 2,
          "priceAtPurchase": 100.0,
          "lineTotal": 200.0
        }
      ],
      "otherRetailerItems": 1,
      "createdAt": "2026-02-01T10:30:00",
      "actionableBy": ["CONFIRM", "REQUEST_ADJUSTMENT"]
    },
    {
      "id": 12346,
      "customerId": 99,
      "customerName": "John Doe",
      "totalAmount": 150.0,
      "status": "PLACED",
      "myItems": [
        {
          "id": 3,
          "productId": 5,
          "productName": "Onion",
          "quantity": 5,
          "priceAtPurchase": 30.0,
          "lineTotal": 150.0
        }
      ],
      "otherRetailerItems": 0,
      "createdAt": "2026-02-01T09:00:00",
      "actionableBy": ["CONFIRM"]
    }
  ]
}
```

**Spring Boot Implementation:**

```java
@GetMapping("/retailer")
public ResponseEntity<?> getRetailerOrders(
        @RequestHeader("Authorization") String authHeader) {

    String token = authHeader.substring(7);
    String email = jwtUtil.extractEmail(token);
    String role = jwtUtil.extractRole(token);

    if (!"retailer".equalsIgnoreCase(role)) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(new ErrorResponse("Only retailers can access this endpoint"));
    }

    User retailer = userRepository.findByEmail(email)
        .orElseThrow(() -> new UserNotFoundException("Retailer not found"));

    List<Order> orders = orderRepository.findPendingOrdersByRetailer(retailer.getId());

    // ✅ Transform to retailer-specific DTO
    List<RetailerOrderDTO> response = orders.stream()
        .map(order -> new RetailerOrderDTO(order, retailer.getId()))
        .collect(Collectors.toList());

    return ResponseEntity.ok(new ApiResponse("success", response.size(), response));
}
```

---

### Distributor: Get My Assigned Orders

**Endpoint:**

```
GET /api/orders/distributor
Authorization: Bearer <JWT>
```

**Optional Query Parameters:**

```
?status=PACKED          # Only ready to ship
?status=SHIPPED         # Already shipped
?status=ALL             # All statuses
```

**Security Validation:**

```java
String role = jwtUtil.extractRole(token);
if (!"distributor".equalsIgnoreCase(role)) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN)
        .body(new ErrorResponse("Only distributors can access this endpoint"));
}

Long distributorId = userRepository.findByEmail(jwtUtil.extractEmail(token)).getId();
// Use distributorId from database, not frontend
```

**Response (200 OK):**

```json
{
  "status": "success",
  "summary": {
    "totalAssigned": 20,
    "readyToShip": 3,
    "inTransit": 5,
    "delivered": 12
  },
  "orders": [
    {
      "id": 12345,
      "customerId": 99,
      "customerName": "John Doe",
      "customerPhone": "+1-555-0123",
      "customerAddress": "123 Main St, City, State 12345",
      "totalAmount": 250.0,
      "status": "PACKED",
      "itemCount": 2,
      "weight": "5.2 kg",
      "volume": "0.08 m³",
      "items": [
        {
          "productId": 1,
          "productName": "Tomato",
          "quantity": 2,
          "unit": "kg",
          "retailerName": "Fresh Market"
        },
        {
          "productId": 5,
          "productName": "Onion",
          "quantity": 1,
          "unit": "kg",
          "retailerName": "Organic Store"
        }
      ],
      "packingDate": "2026-02-01T10:30:00",
      "expectedDeliveryDate": "2026-02-03",
      "trackingNumber": "DIST-20260201-00123",
      "actionableBy": ["MARK_SHIPPED", "REQUEST_EXTENSION"]
    }
  ]
}
```

**Spring Boot Implementation:**

```java
@GetMapping("/distributor")
public ResponseEntity<?> getDistributorOrders(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam(defaultValue = "ALL") String status) {

    String token = authHeader.substring(7);
    String email = jwtUtil.extractEmail(token);
    String role = jwtUtil.extractRole(token);

    if (!"distributor".equalsIgnoreCase(role)) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(new ErrorResponse("Only distributors can access this endpoint"));
    }

    User distributor = userRepository.findByEmail(email)
        .orElseThrow(() -> new UserNotFoundException("Distributor not found"));

    List<Order> orders;

    if ("PACKED".equals(status)) {
        orders = orderRepository.findReadyToShipOrders(distributor.getId());
    } else if ("SHIPPED".equals(status)) {
        orders = orderRepository.findShippedOrdersByDistributor(distributor.getId());
    } else {
        orders = orderRepository.findOrdersByDistributor(distributor.getId());
    }

    // ✅ Transform to distributor-specific DTO with extra logistics fields
    List<DistributorOrderDTO> response = orders.stream()
        .map(order -> new DistributorOrderDTO(order, distributor.getId()))
        .collect(Collectors.toList());

    return ResponseEntity.ok(new ApiResponse("success", response.size(), response));
}
```

---

## Response DTOs

### RetailerOrderDTO

```java
public class RetailerOrderDTO {
    private Long id;
    private Long customerId;
    private String customerName;
    private BigDecimal totalAmount;
    private String status;
    private List<OrderItemDTO> myItems;           // Only items from this retailer
    private Integer otherRetailerItemsCount;      // How many items from other retailers
    private LocalDateTime createdAt;
    private List<String> actionableBy;           // What actions retailer can take

    public RetailerOrderDTO(Order order, Long retailerId) {
        this.id = order.getId();
        this.customerId = order.getCustomer().getId();
        this.customerName = order.getCustomer().getFullName();
        this.totalAmount = order.getTotalAmount();
        this.status = order.getStatus().toString();
        this.createdAt = order.getCreatedAt();

        // Filter: only show items from this retailer
        this.myItems = order.getItems().stream()
            .filter(item -> item.getRetailerId().equals(retailerId))
            .map(OrderItemDTO::new)
            .collect(Collectors.toList());

        // Calculate: items from other retailers
        this.otherRetailerItemsCount = (int) order.getItems().stream()
            .filter(item -> !item.getRetailerId().equals(retailerId))
            .count();

        // Determine: what actions retailer can take
        this.actionableBy = getRetailerActions(order.getStatus());
    }

    private List<String> getRetailerActions(OrderStatus status) {
        List<String> actions = new ArrayList<>();
        if (status == OrderStatus.PLACED || status == OrderStatus.CONFIRMED) {
            actions.add("CONFIRM");
            actions.add("REQUEST_ADJUSTMENT");
        }
        return actions;
    }
}
```

### DistributorOrderDTO

```java
public class DistributorOrderDTO {
    private Long id;
    private Long customerId;
    private String customerName;
    private String customerPhone;
    private String customerAddress;
    private BigDecimal totalAmount;
    private String status;
    private Integer itemCount;
    private String weight;
    private String volume;
    private List<DistributorItemDTO> items;
    private LocalDateTime packingDate;
    private LocalDate expectedDeliveryDate;
    private String trackingNumber;
    private List<String> actionableBy;

    public DistributorOrderDTO(Order order, Long distributorId) {
        this.id = order.getId();
        this.customerId = order.getCustomer().getId();
        this.customerName = order.getCustomer().getFullName();
        this.customerPhone = order.getCustomer().getPhoneNumber();
        this.customerAddress = order.getCustomer().getAddress();
        this.totalAmount = order.getTotalAmount();
        this.status = order.getStatus().toString();
        this.itemCount = order.getItems().size();
        this.packingDate = order.getUpdatedAt();

        // Calculate weight/volume (from product master data)
        this.weight = calculateWeight(order);
        this.volume = calculateVolume(order);

        // Generate tracking number
        this.trackingNumber = generateTrackingNumber(order, distributorId);

        // Set expected delivery (3 days from packing)
        this.expectedDeliveryDate = LocalDate.from(
            order.getUpdatedAt().plusDays(3)
        );

        // Transform items
        this.items = order.getItems().stream()
            .map(DistributorItemDTO::new)
            .collect(Collectors.toList());

        // Determine actions
        this.actionableBy = getDistributorActions(order.getStatus());
    }

    private String generateTrackingNumber(Order order, Long distributorId) {
        return "DIST-" +
               order.getUpdatedAt().format(DateTimeFormatter.ofPattern("yyyyMMdd")) +
               "-" + String.format("%05d", distributorId * 1000 + (order.getId() % 1000));
    }

    private List<String> getDistributorActions(OrderStatus status) {
        List<String> actions = new ArrayList<>();
        if (status == OrderStatus.PACKED) {
            actions.add("MARK_SHIPPED");
            actions.add("REQUEST_EXTENSION");
            actions.add("REPORT_ISSUE");
        } else if (status == OrderStatus.SHIPPED) {
            actions.add("MARK_DELIVERED");
            actions.add("REPORT_DELAY");
        }
        return actions;
    }
}
```

---

## SQL Queries Summary

### Query: All Orders by Retailer (Pending)

```sql
SELECT DISTINCT o.id, o.customer_id, o.total_amount, o.status, o.created_at
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = 20
AND o.status IN ('PLACED', 'CONFIRMED')
ORDER BY o.created_at DESC;
```

### Query: All Orders by Distributor (Ready to Ship)

```sql
SELECT o.id, o.customer_id, o.total_amount, o.status, o.created_at,
       o.distributor_id, u.full_name, u.phone, u.address
FROM orders o
LEFT JOIN users u ON o.customer_id = u.id
WHERE o.distributor_id = 5
AND o.status = 'PACKED'
ORDER BY o.created_at ASC;
```

### Query: Analytics - Orders by Distributor Status

```sql
SELECT o.distributor_id, o.status, COUNT(*) as count
FROM orders o
WHERE o.distributor_id IS NOT NULL
GROUP BY o.distributor_id, o.status
ORDER BY o.distributor_id, o.status;
```

### Query: Find Orders Waiting for Packing Assignment

```sql
SELECT o.id, o.customer_id, o.total_amount, COUNT(DISTINCT oi.retailer_id) as retailer_count
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.status = 'CONFIRMED'
AND o.distributor_id IS NULL
GROUP BY o.id, o.customer_id, o.total_amount
ORDER BY o.created_at ASC;
```

### Query: Distributor Performance (Shipped Orders in Date Range)

```sql
SELECT o.distributor_id, u.full_name as distributor_name,
       COUNT(o.id) as orders_shipped,
       SUM(o.total_amount) as revenue,
       AVG(DATEDIFF(o.updated_at, o.created_at)) as avg_days_to_deliver
FROM orders o
LEFT JOIN users u ON o.distributor_id = u.id
WHERE o.status IN ('SHIPPED', 'DELIVERED')
AND o.distributor_id IS NOT NULL
AND o.updated_at >= '2026-01-01'
AND o.updated_at <= '2026-02-01'
GROUP BY o.distributor_id, u.full_name
ORDER BY orders_shipped DESC;
```

---

## Security & Validation

### Retailer Access Control

```java
@GetMapping("/retailer")
public ResponseEntity<?> getRetailerOrders(
        @RequestHeader("Authorization") String authHeader) {

    // ✅ Step 1: Extract & validate JWT
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(new ErrorResponse("Missing Authorization header"));
    }

    String token = authHeader.substring(7);
    String email = jwtUtil.extractEmail(token);
    String role = jwtUtil.extractRole(token);

    // ✅ Step 2: Validate role
    if (!"retailer".equalsIgnoreCase(role)) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(new ErrorResponse("Only retailers can access this endpoint"));
    }

    // ✅ Step 3: Load user from database (never trust frontend)
    User retailer = userRepository.findByEmail(email)
        .orElseThrow(() -> new UserNotFoundException("Retailer not found: " + email));

    // ✅ Step 4: Validate user is actually retailer
    if (!role.equals(retailer.getRole())) {
        // Token role doesn't match database role = security breach
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(new ErrorResponse("Role mismatch - access denied"));
    }

    // ✅ Step 5: Query using database retailer ID (not frontend-provided)
    List<Order> orders = orderRepository.findPendingOrdersByRetailer(retailer.getId());

    // ✅ Step 6: Transform & return
    List<RetailerOrderDTO> response = orders.stream()
        .map(order -> new RetailerOrderDTO(order, retailer.getId()))
        .collect(Collectors.toList());

    return ResponseEntity.ok(response);
}
```

### Distributor Access Control

```java
@GetMapping("/distributor")
public ResponseEntity<?> getDistributorOrders(
        @RequestHeader("Authorization") String authHeader,
        @RequestParam(defaultValue = "ALL") String status) {

    // ✅ Same 6-step validation as retailer
    String token = authHeader.substring(7);
    String email = jwtUtil.extractEmail(token);
    String role = jwtUtil.extractRole(token);

    if (!"distributor".equalsIgnoreCase(role)) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(new ErrorResponse("Only distributors can access this endpoint"));
    }

    User distributor = userRepository.findByEmail(email)
        .orElseThrow(() -> new UserNotFoundException("Distributor not found"));

    // ✅ Query uses database distributor ID
    List<Order> orders = orderRepository.findOrdersByDistributor(distributor.getId());

    return ResponseEntity.ok(orders);
}
```

---

## Order Status Transitions & Visibility

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORDER LIFECYCLE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PLACED                                                         │
│  ├─ Created by: CUSTOMER                                        │
│  ├─ Visible to: CUSTOMER, RETAILER (in order_items.retailer_id)│
│  ├─ Actions: Customer can CANCEL, Retailer can CONFIRM         │
│  ├─ Database: distributor_id = NULL                            │
│  └─ Next: CONFIRMED                                             │
│     │                                                            │
│     ▼                                                            │
│  CONFIRMED                                                      │
│  ├─ Created by: RETAILER                                        │
│  ├─ Visible to: CUSTOMER, RETAILER                             │
│  ├─ Actions: Warehouse staff PACK (assign distributor)          │
│  ├─ Database: distributor_id = NULL (still)                    │
│  └─ Next: PACKED                                                │
│     │                                                            │
│     ▼                                                            │
│  PACKED ✅ DISTRIBUTOR VISIBILITY STARTS HERE                   │
│  ├─ Created by: WAREHOUSE (via pack() method)                  │
│  ├─ Visible to: CUSTOMER, RETAILER, DISTRIBUTOR               │
│  ├─ Actions: Distributor SHIPS                                 │
│  ├─ Database: distributor_id = <assigned value>               │
│  └─ Next: SHIPPED                                               │
│     │                                                            │
│     ▼                                                            │
│  SHIPPED                                                        │
│  ├─ Created by: DISTRIBUTOR                                    │
│  ├─ Visible to: CUSTOMER, DISTRIBUTOR                         │
│  ├─ Actions: Distributor updates tracking                      │
│  ├─ Database: distributor_id = <same value>                   │
│  └─ Next: DELIVERED                                             │
│     │                                                            │
│     ▼                                                            │
│  DELIVERED                                                      │
│  ├─ Created by: DISTRIBUTOR (or auto-confirmed by system)      │
│  ├─ Visible to: CUSTOMER, DISTRIBUTOR                         │
│  ├─ Actions: Customer can rate/review                          │
│  ├─ Database: distributor_id = <same value>                   │
│  └─ Terminal: Order complete                                    │
│                                                                 │
│  OR at ANY step above:                                          │
│     │                                                            │
│     ▼                                                            │
│  CANCELLED                                                      │
│  ├─ Created by: CUSTOMER (via cancel() method)                 │
│  ├─ Actions: Inventory restored, refund processed              │
│  ├─ Terminal: Order abandoned                                   │
│  └─ Note: DELIVERED orders cannot be cancelled                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Migration

```sql
-- ✅ Update existing orders table
ALTER TABLE orders ADD COLUMN distributor_id BIGINT NULL;
ALTER TABLE orders ADD INDEX idx_distributor_id (distributor_id);
ALTER TABLE orders ADD INDEX idx_distributor_status (distributor_id, status);

-- ✅ Update status enum to include PACKED
ALTER TABLE orders MODIFY status ENUM(
    'PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'
) NOT NULL DEFAULT 'PLACED';
```

---

## Testing

### Test: Retailer Sees Orders with Their Products

```java
@Test
public void testRetailerSeesOnlyOwnOrders() {
    // Setup: Create order with items from retailer 20 and 21
    Order order = new Order(customer, items, BigDecimal.valueOf(250));
    orderRepository.save(order);

    // Execute: Retailer 20 queries their orders
    List<Order> retailer20Orders =
        orderRepository.findPendingOrdersByRetailer(20L);

    // Assert: Retailer 20 sees the order
    assertTrue(retailer20Orders.stream()
        .anyMatch(o -> o.getId().equals(order.getId())));

    // Assert: Retailer 20 can filter to only their items
    List<OrderItem> retailer20Items = order.getItems().stream()
        .filter(item -> item.getRetailerId().equals(20L))
        .collect(Collectors.toList());

    assertTrue(retailer20Items.size() > 0);
}
```

### Test: Distributor Sees Only Assigned Orders

```java
@Test
public void testDistributorSeesOnlyAssignedOrders() {
    // Setup: Pack orders and assign to different distributors
    Order order1 = new Order(...);
    order1.pack(5L);  // Assign to distributor 5
    orderRepository.save(order1);

    Order order2 = new Order(...);
    order2.pack(6L);  // Assign to distributor 6
    orderRepository.save(order2);

    // Execute: Distributor 5 queries their orders
    List<Order> distributor5Orders =
        orderRepository.findOrdersByDistributor(5L);

    // Assert: Distributor 5 sees only their order
    assertEquals(1, distributor5Orders.size());
    assertEquals(5L, distributor5Orders.get(0).getDistributorId());

    // Assert: Distributor 5 does NOT see distributor 6's orders
    assertFalse(distributor5Orders.stream()
        .anyMatch(o -> o.getDistributorId().equals(6L)));
}
```

### Test: Distributor Visibility Triggered by PACKED Status

```java
@Test
public void testDistributorVisibilityStartsAtPacked() {
    Order order = new Order(customer, items, BigDecimal.valueOf(250));
    order.confirm();  // status = CONFIRMED, distributor_id = NULL
    orderRepository.save(order);

    // Before packing: distributor shouldn't see this
    List<Order> distributor5Orders =
        orderRepository.findOrdersByDistributor(5L);
    assertFalse(distributor5Orders.stream()
        .anyMatch(o -> o.getId().equals(order.getId())));

    // After packing: distributor should see it
    order.pack(5L);  // status = PACKED, distributor_id = 5
    orderRepository.save(order);

    distributor5Orders = orderRepository.findOrdersByDistributor(5L);
    assertTrue(distributor5Orders.stream()
        .anyMatch(o -> o.getId().equals(order.getId())));
}
```

---

## Best Practices

### 1. Always Filter at Database Level

```java
// ❌ WRONG: Load all orders, filter in code
List<Order> allOrders = orderRepository.findAll();
List<Order> filtered = allOrders.stream()
    .filter(o -> o.getDistributorId().equals(distributorId))
    .collect(Collectors.toList());

// ✅ CORRECT: Let database filter
List<Order> orders = orderRepository.findOrdersByDistributor(distributorId);
```

### 2. Never Trust Frontend ID

```java
// ❌ WRONG: Use retailer ID from request parameter
@GetMapping("/retailer/{retailerId}")
public ResponseEntity<?> getOrders(@PathVariable Long retailerId) {
    return ResponseEntity.ok(orderRepository.findOrdersByRetailer(retailerId));
}

// ✅ CORRECT: Extract retailer ID from JWT & database
@GetMapping("/retailer")
public ResponseEntity<?> getOrders(@RequestHeader String authHeader) {
    String email = jwtUtil.extractEmail(authHeader);
    Long retailerId = userRepository.findByEmail(email).getId();
    return ResponseEntity.ok(orderRepository.findOrdersByRetailer(retailerId));
}
```

### 3. Use Indexes for Performance

```sql
-- Without indexes, queries are slow:
-- Retailer query: O(n) - scans entire orders table
-- With indexes:
CREATE INDEX idx_retailer_items ON order_items(retailer_id);
CREATE INDEX idx_distributor_status ON orders(distributor_id, status);
-- Queries become O(log n) - much faster
```

### 4. Include Related Data in Response

```java
// When retailer sees order, also show:
// 1. Items from other retailers (context)
// 2. What actions they can take (UX)
// 3. Customer details (fulfillment)
// 4. Timestamps (tracking)

return new RetailerOrderDTO(order, retailerId);
```

### 5. Audit Trail for All Actions

```java
// Log when distributor accesses orders
logger.info("Distributor {} accessed {} assigned orders",
    distributorId, orders.size());

// Log when status changes
logger.info("Order {} packed and assigned to distributor {}",
    orderId, distributorId);
```

---

## Common Issues & Solutions

### Issue: Retailer sees orders from competitors

**Root Cause:** Missing DISTINCT in query

```java
// ❌ WRONG - returns duplicate rows
SELECT o.* FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = 20;

// ✅ CORRECT - deduplicates
SELECT DISTINCT o.* FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = 20;
```

### Issue: Distributor doesn't see newly assigned orders

**Root Cause:** Old cached data or N+1 query problem

```java
// Ensure queries use JOIN FETCH to prevent N+1
@Query("""
    SELECT o FROM Order o
    LEFT JOIN FETCH o.items
    WHERE o.distributorId = :distributorId
    AND o.status = 'PACKED'
""")
List<Order> findReadyToShipOrders(@Param("distributorId") Long distributorId);
```

### Issue: Retailer can access other retailers' orders

**Root Cause:** No role validation

```java
// ✅ Always validate role
if (!"retailer".equalsIgnoreCase(role)) {
    throw new AccessDeniedException("Only retailers can access this endpoint");
}
```

---

## Summary

| Role            | Sees                               | Query Field                 | Trigger               |
| --------------- | ---------------------------------- | --------------------------- | --------------------- |
| **Customer**    | All own orders                     | `customer_id`               | Order creation        |
| **Retailer**    | Pending orders with their products | `order_items.retailer_id`   | Item added to order   |
| **Distributor** | Assigned orders in certain states  | `distributor_id` + `status` | Order status = PACKED |

**Key Principle:** Single shared `orders` table, role-specific JPA queries, database-level access control.
