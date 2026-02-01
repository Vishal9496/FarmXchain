# FarmChainX Order Flow Architecture Analysis

## Executive Summary

**CRITICAL ISSUE**: Orders are persisted locally (frontend-only), not to the backend database. Retailer and Distributor dashboards cannot access customer orders because they're stored in separate browser `localStorage` buckets.

This is a **fundamental architectural failure** in a production multi-role system. Below is the complete analysis.

---

## 1. ROOT CAUSE: Why Orders Don't Share Across Roles

### Current Implementation (BROKEN ❌)

#### Customer Checkout Flow:

```javascript
// CustomerDashboard.js - Line 244
const handleCheckout = () => {
  if (cart.length === 0) return;
  alert("Order placed successfully! 🎉");
  setCart([]); // ❌ NO DATABASE CALL. ORDER DATA DISCARDED.
};
```

**Evidence of the problem:**

- ✅ Customer sees an alert confirming checkout succeeds
- ✅ Cart is cleared (local state)
- ❌ **NO `axios` call to `/api/orders` or any backend endpoint**
- ❌ Order is NEVER saved to database
- ❌ Retailer/Distributor have no way to see it

#### Retailer Dashboard:

```javascript
// RetailerDashboard.js - Lines 102-115
useEffect(() => {
  const loadAllOrders = () => {
    setOrderHistory(getOrdersFromStorage("retailerOrders"));
    setCustomerOrders(getOrdersFromStorage("customerOrders"));
  };
  loadAllOrders();
}, []);

// Line 101
const getOrdersFromStorage = (key) => {
  return JSON.parse(localStorage.getItem(key) || "[]");
};
```

**What's happening:**

- Retailer reads from `localStorage.getItem("retailerOrders")` and `localStorage.getItem("customerOrders")`
- These are **different browser tabs/windows** - localStorage is per-origin, not shared across tabs
- Customer runs in one tab, Retailer in another = **isolated data**

#### Distributor Dashboard:

```javascript
// DistributorDashboard.js - Lines 19-34
useEffect(() => {
  const loadOrders = () => {
    const retailerOrders = JSON.parse(
      localStorage.getItem("retailerOrders") || "[]",
    );
    setOrders(retailerOrders);
  };
  loadOrders();
}, []);
```

**Same problem:** Reading from `localStorage` in a different browser tab = empty array.

---

## 2. ARCHITECTURAL MISTAKES (Production Violations)

### ❌ Mistake #1: Client-Side State as Single Source of Truth

```javascript
// WRONG
const handleCheckout = () => {
  setCart([]); // Only updates local state
};

// CORRECT
const handleCheckout = async () => {
  const response = await axiosInstance.post("/api/orders", {
    items: cart,
    total: cartTotal,
    customerId: currentUserId,
  });
  // THEN update state
  setCart([]);
};
```

**Impact**: Data loss on browser refresh, no multi-user visibility, no audit trail.

---

### ❌ Mistake #2: Confusing Frontend-Only Persistence with Backend State

```javascript
// WRONG: Treating localStorage as if it's persistent
localStorage.setItem("retailerOrders", JSON.stringify(orders));

// WRONG: Assuming same browser tab will share data
const orders = JSON.parse(localStorage.getItem("retailerOrders"));
```

**Reality**:

- Each **browser tab** = separate `localStorage` instance
- Each **browser** = separate `localStorage` instance
- Each **device** = separate `localStorage` instance
- Refresh = data lost (no persistence)

**Production systems require**: Database as SSOT.

---

### ❌ Mistake #3: No Role-Based Order Filtering

Currently, there's **NO** differentiation between:

- What a **Customer** can see (their own orders)
- What a **Retailer** can see (orders for products they sell)
- What a **Distributor** can see (orders they need to fulfill)

**Missing backend logic**: `getOrdersByRole(userId, role)` endpoint.

---

### ❌ Mistake #4: No Order Entity in the Database

Backend has `Product` and `User` models but **NO `Order` model**.

```java
// MISSING entirely:
@Entity
@Table(name = "orders")
public class Order {
  @Id private Long id;
  @ManyToOne private User customer;
  @Column private Double totalAmount;
  @Column private LocalDateTime createdAt;
  @Column private String status;  // PENDING, CONFIRMED, SHIPPED, DELIVERED
}

@Entity
@Table(name = "order_items")
public class OrderItem {
  @Id private Long id;
  @ManyToOne private Order order;
  @ManyToOne private Product product;
  @Column private Integer quantity;
  @Column private Double priceAtPurchase;
}
```

---

### ❌ Mistake #5: No Order API Endpoints

Currently exists:

- `GET /api/products/customer/products` ✅
- `GET /api/products/retailer/inventory` ✅
- `POST /api/products` ✅ (add product)

Missing:

- `POST /api/orders` ❌ (customer checkout)
- `GET /api/orders/customer` ❌ (customer's orders)
- `GET /api/orders/retailer` ❌ (retailer's received orders)
- `GET /api/orders/distributor` ❌ (distributor's orders to fulfill)
- `PUT /api/orders/{id}/status` ❌ (update order status)

---

### ❌ Mistake #6: Mixing Concerns - Products vs Orders

The `Product` entity currently has this:

```java
@Column(name = "retailer_id", nullable = true)
private Long retailerId;  // ✅ Good for inventory assignment

@Column(name = "status", nullable = false)
private String status = "AVAILABLE";  // ❌ Wrong: this is product availability, not order status
```

**Better design**:

- **Products** track what exists in inventory
- **Orders** + **OrderItems** track what was purchased
- **OrderStatus** (enum) tracks fulfillment progress

---

## 3. CORRECT MULTI-ROLE ORDER ARCHITECTURE

### 3.1 Database Schema

```sql
-- ORDERS TABLE (Single source of truth for all transactions)
CREATE TABLE orders (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  customer_id BIGINT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED') DEFAULT 'PENDING',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id),
  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- ORDER ITEMS (Line items in each order)
CREATE TABLE order_items (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL,
  product_id BIGINT NOT NULL,
  farmer_id BIGINT NOT NULL,      -- Track original farmer for traceability
  retailer_id BIGINT NOT NULL,    -- Track which retailer sells this product
  quantity INT NOT NULL,
  price_at_purchase DECIMAL(10, 2) NOT NULL,  -- Lock price at time of purchase
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (farmer_id) REFERENCES users(id),
  FOREIGN KEY (retailer_id) REFERENCES users(id),
  INDEX idx_order (order_id),
  INDEX idx_product (product_id),
  INDEX idx_farmer (farmer_id),
  INDEX idx_retailer (retailer_id)
);

-- SHIPMENTS (Distributor fulfillment tracking)
CREATE TABLE shipments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE,
  distributor_id BIGINT NOT NULL,
  status ENUM('ASSIGNED', 'PICKED', 'IN_TRANSIT', 'DELIVERED') DEFAULT 'ASSIGNED',
  picked_at TIMESTAMP NULL,
  delivered_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (distributor_id) REFERENCES users(id),
  INDEX idx_distributor (distributor_id),
  INDEX idx_status (status)
);

-- PRODUCT INVENTORY (Current stock levels)
CREATE TABLE inventory (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT NOT NULL UNIQUE,
  retailer_id BIGINT NOT NULL,
  available_quantity INT NOT NULL DEFAULT 0,
  reserved_quantity INT NOT NULL DEFAULT 0,  -- From pending orders
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (retailer_id) REFERENCES users(id),
  INDEX idx_retailer (retailer_id)
);
```

### 3.2 Java Entity Models

**Order.java:**

```java
@Entity
@Table(name = "orders")
public class Order {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderItem> items = new ArrayList<>();

    @Column(nullable = false)
    private Double totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.PENDING;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(nullable = false, updatable = false)
    private Date createdAt = new Date();

    @Temporal(TemporalType.TIMESTAMP)
    @Column(nullable = false)
    private Date updatedAt = new Date();

    // Getters/Setters...
}

enum OrderStatus {
    PENDING, CONFIRMED, SHIPPED, DELIVERED, CANCELLED
}
```

**OrderItem.java:**

```java
@Entity
@Table(name = "order_items")
public class OrderItem {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "farmer_id", nullable = false)
    private Long farmerId;

    @Column(name = "retailer_id", nullable = false)
    private Long retailerId;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private Double priceAtPurchase;  // Immutable price snapshot

    @Temporal(TemporalType.TIMESTAMP)
    @Column(nullable = false, updatable = false)
    private Date createdAt = new Date();

    // Getters/Setters...
}
```

---

## 4. ROLE-BASED QUERY PATTERNS

### Query: Customer sees their own orders

```sql
SELECT o.* FROM orders o
WHERE o.customer_id = ?
  AND o.status NOT IN ('CANCELLED')
ORDER BY o.created_at DESC;
```

**SQL via JPA:**

```java
@Query("""
    SELECT o FROM Order o
    WHERE o.customer.id = :customerId
      AND o.status != 'CANCELLED'
    ORDER BY o.createdAt DESC
""")
List<Order> getCustomerOrders(@Param("customerId") Long customerId);
```

---

### Query: Retailer sees orders for products they sell

```sql
SELECT DISTINCT o.* FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.retailer_id = ?
  AND o.status IN ('CONFIRMED', 'SHIPPED', 'DELIVERED')
ORDER BY o.created_at DESC;
```

**SQL via JPA:**

```java
@Query("""
    SELECT DISTINCT o FROM Order o
    JOIN o.items oi
    WHERE oi.retailerId = :retailerId
      AND o.status IN ('CONFIRMED', 'SHIPPED', 'DELIVERED')
    ORDER BY o.createdAt DESC
""")
List<Order> getRetailerOrders(@Param("retailerId") Long retailerId);
```

---

### Query: Distributor sees orders to fulfill

```sql
SELECT o.* FROM orders o
JOIN shipments s ON o.id = s.order_id
WHERE s.distributor_id = ?
  AND s.status IN ('ASSIGNED', 'PICKED', 'IN_TRANSIT')
ORDER BY o.created_at DESC;
```

**SQL via JPA:**

```java
@Query("""
    SELECT DISTINCT o FROM Order o
    JOIN Shipment s ON s.order.id = o.id
    WHERE s.distributor.id = :distributorId
      AND s.status IN ('ASSIGNED', 'PICKED', 'IN_TRANSIT')
    ORDER BY o.createdAt DESC
""")
List<Order> getDistributorOrders(@Param("distributorId") Long distributorId);
```

---

### Query: Farmer sees orders for their products

```sql
SELECT DISTINCT o.* FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE oi.farmer_id = ?
ORDER BY o.created_at DESC;
```

**SQL via JPA:**

```java
@Query("""
    SELECT DISTINCT o FROM Order o
    JOIN o.items oi
    WHERE oi.farmerId = :farmerId
    ORDER BY o.createdAt DESC
""")
List<Order> getFarmerOrders(@Param("farmerId") Long farmerId);
```

---

## 5. BACKEND API ENDPOINTS

### POST /api/orders (Customer Checkout)

```java
@PostMapping
@PreAuthorize("hasRole('CUSTOMER')")
public ResponseEntity<?> createOrder(
    @RequestHeader("Authorization") String authHeader,
    @RequestBody CreateOrderRequest request) {

    // ✅ Extract customer ID from JWT
    String email = jwtUtil.extractEmail(authHeader.substring(7));
    Optional<User> customer = userRepository.findByEmail(email);

    if (!customer.isPresent()) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(Map.of("message", "User not found"));
    }

    // ✅ Validate cart items exist and are available
    List<OrderItem> items = new ArrayList<>();
    Double totalAmount = 0.0;

    for (CartItem cartItem : request.items) {
        Product product = productRepository.findById(cartItem.productId)
            .orElseThrow(() -> new ProductNotFoundException("Product not found"));

        // ✅ Check inventory
        if (product.getQuantity() < cartItem.quantity) {
            return ResponseEntity.badRequest()
                .body(Map.of("message", "Insufficient inventory"));
        }

        OrderItem item = new OrderItem();
        item.setProduct(product);
        item.setQuantity(cartItem.quantity);
        item.setPriceAtPurchase(product.getPrice());
        item.setFarmerId(product.getFarmerId());
        item.setRetailerId(product.getRetailerId());

        items.add(item);
        totalAmount += product.getPrice() * cartItem.quantity;
    }

    // ✅ Create and save order
    Order order = new Order();
    order.setCustomer(customer.get());
    order.setItems(items);
    order.setTotalAmount(totalAmount);
    order.setStatus(OrderStatus.PENDING);

    Order savedOrder = orderRepository.save(order);

    // ✅ Reduce inventory (or trigger fulfillment workflow)
    for (OrderItem item : items) {
        item.setOrder(savedOrder);
        item.getProduct().setQuantity(item.getProduct().getQuantity() - item.getQuantity());
        productRepository.save(item.getProduct());
    }

    // ✅ Create shipment entry for distributor
    Shipment shipment = new Shipment();
    shipment.setOrder(savedOrder);
    shipment.setDistributor(assignDistributor(items));  // Smart assignment
    shipment.setStatus(ShipmentStatus.ASSIGNED);
    shipmentRepository.save(shipment);

    return ResponseEntity.status(HttpStatus.CREATED)
        .body(new OrderResponse(savedOrder));
}
```

---

### GET /api/orders/customer (Customer's Orders)

```java
@GetMapping("/customer")
@PreAuthorize("hasRole('CUSTOMER')")
public ResponseEntity<?> getCustomerOrders(
    @RequestHeader("Authorization") String authHeader) {

    String email = jwtUtil.extractEmail(authHeader.substring(7));
    User customer = userRepository.findByEmail(email)
        .orElseThrow(() -> new RuntimeException("User not found"));

    List<Order> orders = orderRepository.getCustomerOrders(customer.getId());

    return ResponseEntity.ok(orders.stream()
        .map(OrderResponse::new)
        .collect(Collectors.toList()));
}
```

---

### GET /api/orders/retailer (Retailer's Orders)

```java
@GetMapping("/retailer")
@PreAuthorize("hasRole('RETAILER')")
public ResponseEntity<?> getRetailerOrders(
    @RequestHeader("Authorization") String authHeader) {

    String email = jwtUtil.extractEmail(authHeader.substring(7));
    User retailer = userRepository.findByEmail(email)
        .orElseThrow(() -> new RuntimeException("User not found"));

    List<Order> orders = orderRepository.getRetailerOrders(retailer.getId());

    return ResponseEntity.ok(orders.stream()
        .map(order -> new OrderResponse(order, retailer.getId()))  // Filter sensitive data
        .collect(Collectors.toList()));
}
```

---

### GET /api/orders/distributor (Distributor's Orders)

```java
@GetMapping("/distributor")
@PreAuthorize("hasRole('DISTRIBUTOR')")
public ResponseEntity<?> getDistributorOrders(
    @RequestHeader("Authorization") String authHeader) {

    String email = jwtUtil.extractEmail(authHeader.substring(7));
    User distributor = userRepository.findByEmail(email)
        .orElseThrow(() -> new RuntimeException("User not found"));

    List<Order> orders = orderRepository.getDistributorOrders(distributor.getId());

    // Include shipment status
    return ResponseEntity.ok(orders.stream()
        .map(order -> new OrderWithShipmentResponse(order, distributor.getId()))
        .collect(Collectors.toList()));
}
```

---

### PUT /api/orders/{id}/status (Update Status)

```java
@PutMapping("/{id}/status")
@PreAuthorize("hasRole('DISTRIBUTOR') or hasRole('RETAILER')")
public ResponseEntity<?> updateOrderStatus(
    @PathVariable Long id,
    @RequestHeader("Authorization") String authHeader,
    @RequestBody UpdateStatusRequest request) {

    String email = jwtUtil.extractEmail(authHeader.substring(7));
    User user = userRepository.findByEmail(email).orElseThrow();

    Order order = orderRepository.findById(id)
        .orElseThrow(() -> new OrderNotFoundException("Order not found"));

    // ✅ Authorization: Only assigned distributor or involved retailer can update
    if ("DISTRIBUTOR".equals(user.getRole())) {
        Shipment shipment = shipmentRepository.findByOrder(order);
        if (shipment == null || !shipment.getDistributor().getId().equals(user.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("message", "Not assigned to this order"));
        }
        shipment.setStatus(ShipmentStatus.valueOf(request.status));
        shipmentRepository.save(shipment);
    }

    order.setStatus(OrderStatus.valueOf(request.status));
    order.setUpdatedAt(new Date());
    orderRepository.save(order);

    return ResponseEntity.ok(new OrderResponse(order));
}
```

---

## 6. FRONTEND INTEGRATION (React)

### Customer Checkout

```javascript
const handleCheckout = async () => {
  if (cart.length === 0) return;

  try {
    // ✅ POST to backend
    const response = await axiosInstance.post("/api/orders", {
      items: cart.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
    });

    const order = response.data;

    // ✅ Show success with order ID
    alert(`Order #${order.id} placed successfully! 🎉`);

    // ✅ Clear cart only after successful backend save
    setCart([]);

    // ✅ Redirect to order tracking
    navigate(`/orders/${order.id}`);
  } catch (error) {
    alert(`Checkout failed: ${error.message}`);
  }
};
```

---

### Retailer Orders View

```javascript
const RetailerOrdersTab = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // ✅ Fetch from backend, not localStorage
        const response = await axiosInstance.get("/api/orders/retailer");
        setOrders(response.data);
      } catch (error) {
        console.error("Failed to load orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  return (
    <div>
      {orders.map((order) => (
        <OrderCard key={order.id} order={order} />
      ))}
    </div>
  );
};
```

---

### Distributor Orders View

```javascript
const DistributorOrdersTab = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        // ✅ Fetch from backend, not localStorage
        const response = await axiosInstance.get("/api/orders/distributor");
        setOrders(response.data);
      } catch (error) {
        console.error("Failed to load orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    // ✅ Refetch on interval (real-time updates)
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      {orders.map((shipment) => (
        <ShipmentCard key={shipment.id} shipment={shipment} />
      ))}
    </div>
  );
};
```

---

## 7. TRANSACTION FLOW (End-to-End)

```
┌─────────────────────────────────────────────────────────────────┐
│ CUSTOMER WORKFLOW                                               │
└─────────────────────────────────────────────────────────────────┘
1. Customer browses FarmChainX Marketplace
   → GET /api/products/customer/products → List all AVAILABLE products

2. Customer adds items to cart (local state only)

3. Customer clicks CHECKOUT
   → POST /api/orders { items: [{productId, quantity}, ...] }
   → Backend: Creates Order + OrderItems + Shipment + Updates Inventory
   → Response: Order ID (e.g., #12345)

4. Order saved to database ✅
   → Status: PENDING


┌─────────────────────────────────────────────────────────────────┐
│ RETAILER WORKFLOW                                               │
└─────────────────────────────────────────────────────────────────┘
5. Retailer logs in, views dashboard
   → GET /api/orders/retailer
   → Backend: Queries orders WHERE oi.retailer_id = $retailerId
   → Response: [Order #12345, Order #12346, ...]

6. Retailer sees products sold in orders
   → OrderItem shows: Product Name, Quantity, Price Locked at Purchase


┌─────────────────────────────────────────────────────────────────┐
│ DISTRIBUTOR WORKFLOW                                            │
└─────────────────────────────────────────────────────────────────┘
7. Distributor logs in, views dashboard
   → GET /api/orders/distributor
   → Backend: Queries orders WHERE s.distributor_id = $distributorId
   → Response: [Shipment #1 (Order #12345), Shipment #2 (Order #12346), ...]

8. Distributor picks & ships
   → PUT /api/orders/12345/status { status: "SHIPPED" }
   → Backend: Updates order.status + shipment.status
   → Notification triggered to Customer

9. Order delivered
   → PUT /api/orders/12345/status { status: "DELIVERED" }
   → Order completion in system ✅
```

---

## 8. CRITICAL DESIGN DECISIONS

### Decision 1: Single Orders Table vs Role-Specific Order Tables

**WRONG** ❌:

```sql
-- Never do this:
CREATE TABLE customer_orders (...);
CREATE TABLE retailer_orders (...);
CREATE TABLE distributor_orders (...);
```

**CORRECT** ✅:

```sql
-- Single source of truth
CREATE TABLE orders (...);
-- Query with WHERE clause based on role
```

**Why**: Single table with proper indexing = consistency, no sync issues, ACID compliance.

---

### Decision 2: Price Snapshots in OrderItems

```java
// CORRECT: Store price when order was placed
private Double priceAtPurchase;  // Immutable snapshot

// WRONG: Just store product reference
// (price could change after order placed)
@ManyToOne
private Product product;  // Don't rely on product.price
```

**Why**: Audit trail, prevents price disputes, supports historical analysis.

---

### Decision 3: Retailer vs Product Inventory

```java
// CORRECT: Separate from product
@Entity
@Table(name = "inventory")
private Long retailerId;
private Integer availableQuantity;
private Integer reservedQuantity;

// WRONG: Store in product itself
@Column
private Integer quantity;  // Ambiguous: available? total? reserved?
```

**Why**: Multiple retailers can sell same product with different stock levels.

---

### Decision 4: Shipment as Separate Entity

```java
// CORRECT: Track fulfillment separately
@Entity
public class Shipment {
    private Long distributorId;
    private ShipmentStatus status;  // ASSIGNED, PICKED, IN_TRANSIT, DELIVERED
}

// WRONG: Put status directly on Order
@Column
private String status;  // Order vs Shipment status collision
```

**Why**: Order lifecycle (PENDING → CONFIRMED) ≠ Fulfillment lifecycle (ASSIGNED → DELIVERED).

---

## 9. IMPLEMENTATION CHECKLIST

### Phase 1: Database & Models (Foundation)

- [ ] Create `Order.java` entity with relationships
- [ ] Create `OrderItem.java` entity
- [ ] Create `Shipment.java` entity
- [ ] Create `Inventory.java` entity
- [ ] Create SQL migration script
- [ ] Add repository interfaces (OrderRepository, etc.)
- [ ] Add custom `@Query` methods for role-based filtering

### Phase 2: Backend Controllers

- [ ] `OrderController.java` with all 5 endpoints
- [ ] `OrderService.java` with business logic
- [ ] Authorization checks (JWT validation)
- [ ] Inventory decrement logic
- [ ] Shipment assignment logic
- [ ] Transaction management (`@Transactional`)

### Phase 3: Frontend Integration

- [ ] Remove `localStorage` from customer checkout
- [ ] Update `CustomerDashboard.js` checkout → `POST /api/orders`
- [ ] Update `RetailerDashboard.js` → fetch from `/api/orders/retailer`
- [ ] Update `DistributorDashboard.js` → fetch from `/api/orders/distributor`
- [ ] Add order tracking page
- [ ] Add real-time status updates (polling or WebSocket)

### Phase 4: Testing & Validation

- [ ] Unit tests: OrderService, authorization logic
- [ ] Integration tests: End-to-end order flow
- [ ] Concurrency tests: Multiple simultaneous orders
- [ ] Data isolation tests: Role-based visibility
- [ ] Load testing: Inventory contention

### Phase 5: Deployment

- [ ] Database migration (backup first)
- [ ] Blue-green deployment strategy
- [ ] Monitoring: Order volume, error rates, latency
- [ ] Rollback plan

---

## 10. COMMON ARCHITECTURAL MISTAKES (Production Anti-Patterns)

| Mistake                                | Your System                         | Correct Approach                          | Impact                         |
| -------------------------------------- | ----------------------------------- | ----------------------------------------- | ------------------------------ |
| **Client-side state as SSOT**          | Orders only in React state          | Database as SSOT                          | Data loss on refresh           |
| **localStorage ≠ Database**            | Orders in `localStorage`            | Persistent backend store                  | No cross-tab/cross-device sync |
| **No order entity**                    | Orders don't exist in DB            | `Order` + `OrderItem` tables              | No business logic possible     |
| **Single status field**                | Can't distinguish order vs shipment | Separate `OrderStatus` + `ShipmentStatus` | Status confusion               |
| **Price not locked**                   | Product price mutable               | Store `priceAtPurchase`                   | Price disputes                 |
| **No inventory reserve**               | Overselling possible                | Reserve on order creation                 | Fulfillment issues             |
| **Role-based visibility not enforced** | All dashboards see same data        | Query filters by role                     | Data leaks, incorrect views    |
| **No audit trail**                     | Can't track changes                 | Add `createdAt`, `updatedAt`, `createdBy` | Compliance failures            |
| **Synchronous inventory update**       | Race conditions                     | Transactional locks or message queue      | Inventory corruption           |
| **No error handling**                  | Frontend shows undefined errors     | Structured error responses                | Poor UX                        |

---

## 11. PERFORMANCE CONSIDERATIONS

### Indexing Strategy

```sql
-- Critical for fast queries
INDEX idx_customer (customer_id);
INDEX idx_retailer (retailer_id);
INDEX idx_distributor (distributor_id);
INDEX idx_status (status);
INDEX idx_created_at (created_at);

-- Composite for multi-column queries
INDEX idx_order_status (order_id, status);
INDEX idx_item_retailer_status (retailer_id, order_status);
```

### Query Optimization

```java
// ❌ WRONG: N+1 query problem
List<Order> orders = orderRepository.findByCustomerId(customerId);
for (Order order : orders) {
    List<OrderItem> items = order.getItems();  // SELECT per order!
}

// ✅ CORRECT: Eager loading
@Query("""
    SELECT DISTINCT o FROM Order o
    LEFT JOIN FETCH o.items
    WHERE o.customer.id = :customerId
""")
List<Order> getCustomerOrders(@Param("customerId") Long customerId);
```

### Caching

```java
@Cacheable(value = "retailerOrders", key = "#retailerId")
public List<Order> getRetailerOrders(Long retailerId) {
    return orderRepository.getRetailerOrders(retailerId);
}

// Invalidate after order status change
@CacheEvict(value = "retailerOrders", key = "#order.items[0].retailerId")
public Order updateOrderStatus(Order order) {
    // ...
}
```

---

## 12. SECURITY CONSIDERATIONS

### JWT Authorization

```java
// ✅ CORRECT: Extract from JWT, validate role
String email = jwtUtil.extractEmail(token);
String role = jwtUtil.extractRole(token);

// Verify user matches email from JWT
User user = userRepository.findByEmail(email);
if (!user.getRole().equals("RETAILER")) {
    throw new ForbiddenException("Only retailers can access this");
}
```

### Row-Level Security (RLS)

```java
// ✅ CORRECT: Only see own data
@Query("""
    SELECT o FROM Order o
    WHERE o.customer.id = :customerId
""")
List<Order> getCustomerOrders(@Param("customerId") Long customerId);

// ✅ CORRECT: Only see orders for products you sell
@Query("""
    SELECT DISTINCT o FROM Order o
    JOIN o.items oi
    WHERE oi.retailerId = :retailerId
""")
List<Order> getRetailerOrders(@Param("retailerId") Long retailerId);
```

### Input Validation

```java
@PostMapping
public ResponseEntity<?> createOrder(@Valid @RequestBody CreateOrderRequest request) {
    if (request.items.isEmpty()) {
        return ResponseEntity.badRequest().body("Cart cannot be empty");
    }

    if (request.items.size() > 100) {
        return ResponseEntity.badRequest().body("Order too large");
    }

    // ...
}
```

---

## Summary: What to Fix (Priority Order)

1. **CRITICAL**: Add `Order`, `OrderItem`, `Shipment` entities + migration
2. **CRITICAL**: Create `/api/orders` POST endpoint (customer checkout)
3. **CRITICAL**: Update `CustomerDashboard.js` checkout to call backend
4. **HIGH**: Create `/api/orders/{role}` GET endpoints
5. **HIGH**: Update Retailer/Distributor dashboards to query backend
6. **HIGH**: Add `OrderRepository` with role-based queries
7. **MEDIUM**: Implement inventory decrement + shipment assignment
8. **MEDIUM**: Add order status update endpoints
9. **LOW**: Add caching, monitoring, audit logs

---

**By implementing this architecture, you'll have:**

- ✅ Single source of truth (database)
- ✅ Cross-device/cross-browser synchronization
- ✅ Proper role-based visibility
- ✅ Audit trail for compliance
- ✅ Scalability for production load
- ✅ Transaction safety (ACID)
