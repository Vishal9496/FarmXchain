# FarmChainX: Production-Ready Order Implementation

## Quick Implementation Guide

This document provides **ready-to-use code** to fix the order flow.

---

## 1. DATABASE MIGRATION

**File**: `backend/src/main/resources/db_migration_orders.sql`

```sql
-- ============================================================================
-- ORDERS TABLES MIGRATION
-- ============================================================================
-- Run this AFTER your existing migrations (products, users tables exist)

-- Create ORDERS table
CREATE TABLE IF NOT EXISTS orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED') DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create ORDER_ITEMS table (line items)
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

    INDEX idx_order (order_id),
    INDEX idx_product (product_id),
    INDEX idx_farmer (farmer_id),
    INDEX idx_retailer (retailer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create SHIPMENTS table (fulfillment tracking)
CREATE TABLE IF NOT EXISTS shipments (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    order_id BIGINT NOT NULL UNIQUE,
    distributor_id BIGINT NOT NULL,
    status ENUM('ASSIGNED', 'PICKED', 'IN_TRANSIT', 'DELIVERED') DEFAULT 'ASSIGNED',
    picked_at TIMESTAMP NULL,
    delivered_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (distributor_id) REFERENCES users(id) ON DELETE RESTRICT,

    INDEX idx_distributor (distributor_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sample data for testing
INSERT INTO orders (customer_id, total_amount, status) VALUES
(1, 250.00, 'DELIVERED'),
(1, 150.00, 'SHIPPED'),
(1, 75.50, 'PENDING');
```

---

## 2. JAVA ENTITIES

### File: `backend/src/main/java/com/farmxchain/model/Order.java`

```java
package com.farmxchain.model;

import jakarta.persistence.*;
import java.util.Date;
import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "orders")
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
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

    // ============================================================================
    // CONSTRUCTORS
    // ============================================================================

    public Order() {}

    public Order(User customer, List<OrderItem> items, Double totalAmount) {
        this.customer = customer;
        this.items = items;
        this.totalAmount = totalAmount;
        this.status = OrderStatus.PENDING;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    // ============================================================================
    // GETTERS & SETTERS
    // ============================================================================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public User getCustomer() {
        return customer;
    }

    public void setCustomer(User customer) {
        this.customer = customer;
    }

    public List<OrderItem> getItems() {
        return items;
    }

    public void setItems(List<OrderItem> items) {
        this.items = items;
    }

    public Double getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(Double totalAmount) {
        this.totalAmount = totalAmount;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
        this.updatedAt = new Date();
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }

    // ============================================================================
    // HELPER METHODS
    // ============================================================================

    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }

    public void removeItem(OrderItem item) {
        items.remove(item);
        item.setOrder(null);
    }

    @Override
    public String toString() {
        return "Order{" +
                "id=" + id +
                ", customerId=" + (customer != null ? customer.getId() : null) +
                ", totalAmount=" + totalAmount +
                ", status=" + status +
                ", itemCount=" + items.size() +
                ", createdAt=" + createdAt +
                '}';
    }
}

enum OrderStatus {
    PENDING,
    CONFIRMED,
    SHIPPED,
    DELIVERED,
    CANCELLED
}
```

---

### File: `backend/src/main/java/com/farmxchain/model/OrderItem.java`

```java
package com.farmxchain.model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "order_items")
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "farmer_id", nullable = false)
    private Long farmerId;

    @Column(name = "retailer_id", nullable = false)
    private Long retailerId;

    @Column(nullable = false)
    private Integer quantity;

    @Column(nullable = false)
    private Double priceAtPurchase;  // Immutable snapshot

    @Temporal(TemporalType.TIMESTAMP)
    @Column(nullable = false, updatable = false)
    private Date createdAt = new Date();

    // ============================================================================
    // CONSTRUCTORS
    // ============================================================================

    public OrderItem() {}

    public OrderItem(Order order, Product product, Long farmerId, Long retailerId,
                     Integer quantity, Double priceAtPurchase) {
        this.order = order;
        this.product = product;
        this.farmerId = farmerId;
        this.retailerId = retailerId;
        this.quantity = quantity;
        this.priceAtPurchase = priceAtPurchase;
        this.createdAt = new Date();
    }

    // ============================================================================
    // GETTERS & SETTERS
    // ============================================================================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Order getOrder() {
        return order;
    }

    public void setOrder(Order order) {
        this.order = order;
    }

    public Product getProduct() {
        return product;
    }

    public void setProduct(Product product) {
        this.product = product;
    }

    public Long getFarmerId() {
        return farmerId;
    }

    public void setFarmerId(Long farmerId) {
        this.farmerId = farmerId;
    }

    public Long getRetailerId() {
        return retailerId;
    }

    public void setRetailerId(Long retailerId) {
        this.retailerId = retailerId;
    }

    public Integer getQuantity() {
        return quantity;
    }

    public void setQuantity(Integer quantity) {
        this.quantity = quantity;
    }

    public Double getPriceAtPurchase() {
        return priceAtPurchase;
    }

    public void setPriceAtPurchase(Double priceAtPurchase) {
        this.priceAtPurchase = priceAtPurchase;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public String toString() {
        return "OrderItem{" +
                "id=" + id +
                ", productId=" + (product != null ? product.getId() : null) +
                ", quantity=" + quantity +
                ", priceAtPurchase=" + priceAtPurchase +
                '}';
    }
}
```

---

### File: `backend/src/main/java/com/farmxchain/model/Shipment.java`

```java
package com.farmxchain.model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(name = "shipments")
public class Shipment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "order_id", nullable = false, unique = true)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "distributor_id", nullable = false)
    private User distributor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ShipmentStatus status = ShipmentStatus.ASSIGNED;

    @Temporal(TemporalType.TIMESTAMP)
    private Date pickedAt;

    @Temporal(TemporalType.TIMESTAMP)
    private Date deliveredAt;

    @Temporal(TemporalType.TIMESTAMP)
    @Column(nullable = false, updatable = false)
    private Date createdAt = new Date();

    @Temporal(TemporalType.TIMESTAMP)
    @Column(nullable = false)
    private Date updatedAt = new Date();

    // ============================================================================
    // CONSTRUCTORS
    // ============================================================================

    public Shipment() {}

    public Shipment(Order order, User distributor) {
        this.order = order;
        this.distributor = distributor;
        this.status = ShipmentStatus.ASSIGNED;
        this.createdAt = new Date();
        this.updatedAt = new Date();
    }

    // ============================================================================
    // GETTERS & SETTERS
    // ============================================================================

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Order getOrder() {
        return order;
    }

    public void setOrder(Order order) {
        this.order = order;
    }

    public User getDistributor() {
        return distributor;
    }

    public void setDistributor(User distributor) {
        this.distributor = distributor;
    }

    public ShipmentStatus getStatus() {
        return status;
    }

    public void setStatus(ShipmentStatus status) {
        this.status = status;
        this.updatedAt = new Date();
    }

    public Date getPickedAt() {
        return pickedAt;
    }

    public void setPickedAt(Date pickedAt) {
        this.pickedAt = pickedAt;
    }

    public Date getDeliveredAt() {
        return deliveredAt;
    }

    public void setDeliveredAt(Date deliveredAt) {
        this.deliveredAt = deliveredAt;
    }

    public Date getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Date createdAt) {
        this.createdAt = createdAt;
    }

    public Date getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Date updatedAt) {
        this.updatedAt = updatedAt;
    }
}

enum ShipmentStatus {
    ASSIGNED,
    PICKED,
    IN_TRANSIT,
    DELIVERED
}
```

---

## 3. REPOSITORIES

### File: `backend/src/main/java/com/farmxchain/repository/OrderRepository.java`

```java
package com.farmxchain.repository;

import com.farmxchain.model.Order;
import com.farmxchain.model.OrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {

    // ✅ CUSTOMER: Get all orders for a specific customer
    @Query("""
        SELECT o FROM Order o
        WHERE o.customer.id = :customerId
        ORDER BY o.createdAt DESC
    """)
    List<Order> findByCustomerId(@Param("customerId") Long customerId);

    // ✅ RETAILER: Get orders containing products sold by this retailer
    @Query("""
        SELECT DISTINCT o FROM Order o
        JOIN o.items oi
        WHERE oi.retailerId = :retailerId
        ORDER BY o.createdAt DESC
    """)
    List<Order> findOrdersByRetailer(@Param("retailerId") Long retailerId);

    // ✅ FARMER: Get orders containing products from this farmer
    @Query("""
        SELECT DISTINCT o FROM Order o
        JOIN o.items oi
        WHERE oi.farmerId = :farmerId
        ORDER BY o.createdAt DESC
    """)
    List<Order> findOrdersByFarmer(@Param("farmerId") Long farmerId);

    // ✅ Count orders by status
    @Query("SELECT COUNT(o) FROM Order o WHERE o.customer.id = :customerId AND o.status = :status")
    Long countOrdersByStatusForCustomer(@Param("customerId") Long customerId,
                                        @Param("status") OrderStatus status);

    // ✅ Get recent orders (last N)
    @Query(value = """
        SELECT o FROM Order o
        WHERE o.customer.id = :customerId
        ORDER BY o.createdAt DESC
        LIMIT :limit
    """, nativeQuery = false)
    List<Order> getRecentOrdersForCustomer(@Param("customerId") Long customerId,
                                           @Param("limit") int limit);
}
```

---

### File: `backend/src/main/java/com/farmxchain/repository/OrderItemRepository.java`

```java
package com.farmxchain.repository;

import com.farmxchain.model.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface OrderItemRepository extends JpaRepository<OrderItem, Long> {

    @Query("SELECT oi FROM OrderItem oi WHERE oi.order.id = :orderId")
    List<OrderItem> findByOrderId(@Param("orderId") Long orderId);

    @Query("SELECT oi FROM OrderItem oi WHERE oi.retailerId = :retailerId")
    List<OrderItem> findByRetailerId(@Param("retailerId") Long retailerId);

    @Query("SELECT oi FROM OrderItem oi WHERE oi.farmerId = :farmerId")
    List<OrderItem> findByFarmerId(@Param("farmerId") Long farmerId);
}
```

---

### File: `backend/src/main/java/com/farmxchain/repository/ShipmentRepository.java`

```java
package com.farmxchain.repository;

import com.farmxchain.model.Shipment;
import com.farmxchain.model.ShipmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ShipmentRepository extends JpaRepository<Shipment, Long> {

    @Query("SELECT s FROM Shipment s WHERE s.order.id = :orderId")
    Optional<Shipment> findByOrderId(@Param("orderId") Long orderId);

    @Query("""
        SELECT s FROM Shipment s
        WHERE s.distributor.id = :distributorId
        ORDER BY s.createdAt DESC
    """)
    List<Shipment> findByDistributorId(@Param("distributorId") Long distributorId);

    @Query("""
        SELECT s FROM Shipment s
        WHERE s.distributor.id = :distributorId
        AND s.status IN ('ASSIGNED', 'PICKED', 'IN_TRANSIT')
        ORDER BY s.createdAt DESC
    """)
    List<Shipment> findActiveShipmentsForDistributor(@Param("distributorId") Long distributorId);
}
```

---

## 4. SERVICES

### File: `backend/src/main/java/com/farmxchain/service/OrderService.java`

```java
package com.farmxchain.service;

import com.farmxchain.model.*;
import com.farmxchain.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ShipmentRepository shipmentRepository;

    @Autowired
    private UserRepository userRepository;

    // ============================================================================
    // CREATE ORDER (Customer Checkout)
    // ============================================================================

    @Transactional
    public Order createOrder(User customer, List<CartItem> cartItems) throws Exception {
        if (cartItems == null || cartItems.isEmpty()) {
            throw new IllegalArgumentException("Cart cannot be empty");
        }

        // ✅ Validate all products and calculate total
        List<OrderItem> orderItems = new java.util.ArrayList<>();
        Double totalAmount = 0.0;

        for (CartItem cartItem : cartItems) {
            Product product = productRepository.findById(cartItem.getProductId())
                    .orElseThrow(() -> new Exception("Product not found: " + cartItem.getProductId()));

            // ✅ Check inventory
            if (product.getQuantity() == null || product.getQuantity() < cartItem.getQuantity()) {
                throw new Exception("Insufficient inventory for product: " + product.getCropType());
            }

            // ✅ Create order item with price snapshot
            OrderItem item = new OrderItem();
            item.setProduct(product);
            item.setQuantity(cartItem.getQuantity());
            item.setPriceAtPurchase(product.getPrice() != null ? product.getPrice() : 2.5);
            item.setFarmerId(product.getFarmerId());
            item.setRetailerId(product.getRetailerId());

            orderItems.add(item);
            totalAmount += item.getPriceAtPurchase() * cartItem.getQuantity();
        }

        // ✅ Create order
        Order order = new Order();
        order.setCustomer(customer);
        order.setTotalAmount(totalAmount);
        order.setStatus(OrderStatus.PENDING);
        Order savedOrder = orderRepository.save(order);

        // ✅ Add items to order and save
        for (OrderItem item : orderItems) {
            item.setOrder(savedOrder);
            orderItemRepository.save(item);

            // ✅ Decrement product inventory
            Product product = item.getProduct();
            product.setQuantity(product.getQuantity() - item.getQuantity());
            productRepository.save(product);
        }

        // ✅ Create shipment and assign distributor
        User distributor = assignDistributorForOrder(savedOrder);
        Shipment shipment = new Shipment();
        shipment.setOrder(savedOrder);
        shipment.setDistributor(distributor);
        shipment.setStatus(ShipmentStatus.ASSIGNED);
        shipmentRepository.save(shipment);

        System.out.println("[OrderService] Order created: #" + savedOrder.getId() +
                           ", Total: " + totalAmount + ", Items: " + orderItems.size());

        return savedOrder;
    }

    // ============================================================================
    // RETRIEVE ORDERS BY ROLE
    // ============================================================================

    public List<Order> getCustomerOrders(Long customerId) {
        return orderRepository.findByCustomerId(customerId);
    }

    public List<Order> getRetailerOrders(Long retailerId) {
        return orderRepository.findOrdersByRetailer(retailerId);
    }

    public List<Order> getFarmerOrders(Long farmerId) {
        return orderRepository.findOrdersByFarmer(farmerId);
    }

    public List<Shipment> getDistributorShipments(Long distributorId) {
        return shipmentRepository.findByDistributorId(distributorId);
    }

    // ============================================================================
    // UPDATE ORDER STATUS
    // ============================================================================

    @Transactional
    public Order updateOrderStatus(Long orderId, OrderStatus newStatus) throws Exception {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new Exception("Order not found: " + orderId));

        order.setStatus(newStatus);
        return orderRepository.save(order);
    }

    @Transactional
    public Shipment updateShipmentStatus(Long shipmentId, ShipmentStatus newStatus) throws Exception {
        Shipment shipment = shipmentRepository.findById(shipmentId)
                .orElseThrow(() -> new Exception("Shipment not found: " + shipmentId));

        shipment.setStatus(newStatus);

        // ✅ Update order status accordingly
        if (newStatus == ShipmentStatus.IN_TRANSIT) {
            shipment.getOrder().setStatus(OrderStatus.SHIPPED);
        } else if (newStatus == ShipmentStatus.DELIVERED) {
            shipment.getOrder().setStatus(OrderStatus.DELIVERED);
            shipment.setDeliveredAt(new java.util.Date());
        }

        orderRepository.save(shipment.getOrder());
        return shipmentRepository.save(shipment);
    }

    // ============================================================================
    // HELPER: Assign distributor to order
    // ============================================================================

    private User assignDistributorForOrder(Order order) throws Exception {
        // ✅ SIMPLE STRATEGY: Get first distributor
        // TODO: Replace with smart assignment (load balancing, geo-proximity, etc.)

        List<User> distributors = userRepository.findByRole("DISTRIBUTOR");
        if (distributors == null || distributors.isEmpty()) {
            throw new Exception("No distributors available");
        }

        // For now, just use the first distributor
        return distributors.get(0);
    }

    // ============================================================================
    // HELPER: Cart item DTO
    // ============================================================================

    public static class CartItem {
        private Long productId;
        private Integer quantity;

        public CartItem() {}

        public CartItem(Long productId, Integer quantity) {
            this.productId = productId;
            this.quantity = quantity;
        }

        public Long getProductId() {
            return productId;
        }

        public void setProductId(Long productId) {
            this.productId = productId;
        }

        public Integer getQuantity() {
            return quantity;
        }

        public void setQuantity(Integer quantity) {
            this.quantity = quantity;
        }
    }
}
```

---

## 5. API CONTROLLER

### File: `backend/src/main/java/com/farmxchain/controller/OrderController.java`

```java
package com.farmxchain.controller;

import com.farmxchain.model.*;
import com.farmxchain.repository.UserRepository;
import com.farmxchain.security.JwtUtil;
import com.farmxchain.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "http://localhost:3000")
public class OrderController {

    @Autowired
    private OrderService orderService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserRepository userRepository;

    // ============================================================================
    // POST /api/orders - CUSTOMER CHECKOUT
    // ============================================================================

    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<?> createOrder(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody CreateOrderRequest request) {

        try {
            // ✅ Extract customer ID from JWT
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("message", "Missing authorization header"));
            }

            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);
            String role = jwtUtil.extractRole(token);

            if (!"customer".equalsIgnoreCase(role)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Only customers can checkout"));
            }

            // ✅ Get customer from database
            Optional<User> customerOpt = userRepository.findByEmail(email);
            if (!customerOpt.isPresent()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("message", "User not found"));
            }

            User customer = customerOpt.get();

            // ✅ Create order via service
            Order order = orderService.createOrder(customer, request.items);

            // ✅ Return order response
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new OrderResponse(order));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        } catch (Exception e) {
            System.err.println("[OrderController] Checkout error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Checkout failed: " + e.getMessage()));
        }
    }

    // ============================================================================
    // GET /api/orders/customer - CUSTOMER'S ORDERS
    // ============================================================================

    @GetMapping("/customer")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<?> getCustomerOrders(
            @RequestHeader("Authorization") String authHeader) {

        try {
            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);

            User customer = userRepository.findByEmail(email)
                    .orElseThrow(() -> new Exception("User not found"));

            List<Order> orders = orderService.getCustomerOrders(customer.getId());

            List<OrderResponse> response = orders.stream()
                    .map(OrderResponse::new)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid token"));
        }
    }

    // ============================================================================
    // GET /api/orders/retailer - RETAILER'S ORDERS
    // ============================================================================

    @GetMapping("/retailer")
    @PreAuthorize("hasRole('RETAILER')")
    public ResponseEntity<?> getRetailerOrders(
            @RequestHeader("Authorization") String authHeader) {

        try {
            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);
            String role = jwtUtil.extractRole(token);

            if (!"retailer".equalsIgnoreCase(role)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Only retailers can access this"));
            }

            User retailer = userRepository.findByEmail(email)
                    .orElseThrow(() -> new Exception("User not found"));

            List<Order> orders = orderService.getRetailerOrders(retailer.getId());

            List<OrderResponse> response = orders.stream()
                    .map(OrderResponse::new)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid token"));
        }
    }

    // ============================================================================
    // GET /api/orders/distributor - DISTRIBUTOR'S SHIPMENTS
    // ============================================================================

    @GetMapping("/distributor")
    @PreAuthorize("hasRole('DISTRIBUTOR')")
    public ResponseEntity<?> getDistributorOrders(
            @RequestHeader("Authorization") String authHeader) {

        try {
            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);
            String role = jwtUtil.extractRole(token);

            if (!"distributor".equalsIgnoreCase(role)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("message", "Only distributors can access this"));
            }

            User distributor = userRepository.findByEmail(email)
                    .orElseThrow(() -> new Exception("User not found"));

            List<Shipment> shipments = orderService.getDistributorShipments(distributor.getId());

            List<ShipmentResponse> response = shipments.stream()
                    .map(ShipmentResponse::new)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Invalid token"));
        }
    }

    // ============================================================================
    // PUT /api/orders/{id}/status - UPDATE ORDER STATUS
    // ============================================================================

    @PutMapping("/{id}/status")
    @PreAuthorize("hasRole('DISTRIBUTOR') or hasRole('RETAILER')")
    public ResponseEntity<?> updateOrderStatus(
            @PathVariable Long id,
            @RequestHeader("Authorization") String authHeader,
            @RequestBody UpdateStatusRequest request) {

        try {
            String token = authHeader.substring(7);
            String role = jwtUtil.extractRole(token);

            Order order = orderService.updateOrderStatus(id, OrderStatus.valueOf(request.status));

            return ResponseEntity.ok(new OrderResponse(order));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Invalid status: " + e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to update status"));
        }
    }

    // ============================================================================
    // PUT /api/orders/{id}/shipment-status - UPDATE SHIPMENT STATUS
    // ============================================================================

    @PutMapping("/{id}/shipment-status")
    @PreAuthorize("hasRole('DISTRIBUTOR')")
    public ResponseEntity<?> updateShipmentStatus(
            @PathVariable Long id,
            @RequestHeader("Authorization") String authHeader,
            @RequestBody UpdateStatusRequest request) {

        try {
            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);

            Shipment shipment = orderService.updateShipmentStatus(id, ShipmentStatus.valueOf(request.status));

            return ResponseEntity.ok(new ShipmentResponse(shipment));

        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("message", "Invalid shipment status"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("message", "Failed to update shipment"));
        }
    }

    // ============================================================================
    // DTOs & RESPONSE CLASSES
    // ============================================================================

    public static class CreateOrderRequest {
        public List<OrderService.CartItem> items;

        public CreateOrderRequest() {}

        public CreateOrderRequest(List<OrderService.CartItem> items) {
            this.items = items;
        }
    }

    public static class UpdateStatusRequest {
        public String status;

        public UpdateStatusRequest() {}

        public UpdateStatusRequest(String status) {
            this.status = status;
        }
    }

    public static class OrderResponse {
        public Long id;
        public Long customerId;
        public Double totalAmount;
        public String status;
        public Date createdAt;
        public List<OrderItemResponse> items;

        public OrderResponse() {}

        public OrderResponse(Order order) {
            this.id = order.getId();
            this.customerId = order.getCustomer() != null ? order.getCustomer().getId() : null;
            this.totalAmount = order.getTotalAmount();
            this.status = order.getStatus().toString();
            this.createdAt = order.getCreatedAt();
            this.items = order.getItems().stream()
                    .map(OrderItemResponse::new)
                    .collect(Collectors.toList());
        }
    }

    public static class OrderItemResponse {
        public Long id;
        public String productName;
        public Integer quantity;
        public Double priceAtPurchase;
        public Long farmerId;
        public Long retailerId;

        public OrderItemResponse() {}

        public OrderItemResponse(OrderItem item) {
            this.id = item.getId();
            this.productName = item.getProduct() != null ? item.getProduct().getCropType() : null;
            this.quantity = item.getQuantity();
            this.priceAtPurchase = item.getPriceAtPurchase();
            this.farmerId = item.getFarmerId();
            this.retailerId = item.getRetailerId();
        }
    }

    public static class ShipmentResponse {
        public Long id;
        public Long orderId;
        public Long distributorId;
        public String status;
        public Date createdAt;
        public Date deliveredAt;
        public OrderResponse order;

        public ShipmentResponse() {}

        public ShipmentResponse(Shipment shipment) {
            this.id = shipment.getId();
            this.orderId = shipment.getOrder() != null ? shipment.getOrder().getId() : null;
            this.distributorId = shipment.getDistributor() != null ? shipment.getDistributor().getId() : null;
            this.status = shipment.getStatus().toString();
            this.createdAt = shipment.getCreatedAt();
            this.deliveredAt = shipment.getDeliveredAt();
            this.order = shipment.getOrder() != null ? new OrderResponse(shipment.getOrder()) : null;
        }
    }
}
```

---

## 6. FRONTEND: Updated Customer Checkout

### File: Update `src/pages/CustomerDashboard.js` - handleCheckout function

```javascript
// Replace the existing handleCheckout (around line 244) with this:

const handleCheckout = async () => {
  if (cart.length === 0) {
    alert("Cart is empty!");
    return;
  }

  setCheckoutLoading(true);

  try {
    // ✅ POST to backend instead of localStorage
    const response = await axiosInstance.post("/api/orders", {
      items: cart.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
    });

    const order = response.data;

    // ✅ Show success with order ID
    alert(
      `Order #${order.id} placed successfully! 🎉\n\n` +
        `Total: ${formatINR(order.totalAmount)}\n` +
        `Your fresh produce will be delivered soon.\n` +
        `Track your order from farm to door.`,
    );

    // ✅ Clear cart after successful order
    setCart([]);

    // ✅ Optional: Redirect to order tracking
    // navigate(`/orders/${order.id}`);
  } catch (error) {
    console.error("Checkout failed:", error);
    const errorMsg =
      error.response?.data?.message || error.message || "Checkout failed";
    alert(`❌ Checkout failed: ${errorMsg}`);
  } finally {
    setCheckoutLoading(false);
  }
};

// Add this state
const [checkoutLoading, setCheckoutLoading] = useState(false);

// Update the checkout button to show loading state:
<button
  onClick={handleCheckout}
  disabled={checkoutLoading || cart.length === 0}
  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
>
  {checkoutLoading ? "Processing..." : `Checkout (${formatINR(cartTotalINR)})`}
</button>;
```

---

## 7. FRONTEND: Retailer Orders View

### File: Update `src/pages/RetailerDashboard.js` - Orders Tab

```javascript
// Replace the orders tab rendering section with this:

{
  activeTab === "orders" && (
    <div>
      {loading ? (
        <div className="text-center py-12">
          <p className={isDark ? "text-gray-300" : "text-gray-600"}>
            Loading orders...
          </p>
        </div>
      ) : orderHistory.length === 0 ? (
        <div className="text-center py-12">
          <Package
            size={48}
            className={`mx-auto mb-4 ${isDark ? "text-slate-600" : "text-gray-300"}`}
          />
          <p className={isDark ? "text-slate-400" : "text-gray-500"}>
            No orders yet
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orderHistory.map((order) => (
            <div
              key={order.id}
              className={`backdrop-blur-xl border rounded-lg p-6 ${
                isDark
                  ? "bg-slate-800/50 border-slate-700"
                  : "bg-white/80 border-white/50"
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h4
                    className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                  >
                    Order #{order.id}
                  </h4>
                  <p
                    className={`text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}
                  >
                    {new Date(order.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-semibold ${
                    order.status === "DELIVERED"
                      ? "bg-green-100 text-green-800"
                      : order.status === "SHIPPED"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {order.status}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                {order.items?.map((item) => (
                  <div
                    key={item.id}
                    className={`text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}
                  >
                    {item.productName} × {item.quantity} @ ₹
                    {Math.round(item.priceAtPurchase * 83)}/kg
                  </div>
                ))}
              </div>

              <div
                className={`pt-4 border-t ${isDark ? "border-slate-700" : "border-gray-200"}`}
              >
                <p
                  className={`font-bold text-lg ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  Total: ₹{Math.round(order.totalAmount * 83)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## 8. FRONTEND: Distributor Orders View

### File: Update `src/pages/DistributorDashboard.js` - Orders Tab

```javascript
// Replace the entire DistributorDashboard component with this updated version

import React, { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import {
  Package,
  Truck,
  TrendingUp,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import axiosInstance from "../api/axiosInstance";
import "../styles/DistributorDashboard.css";

const DistributorDashboard = () => {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("orders");
  const { isDark } = useTheme();

  // ✅ Fetch shipments from backend (not localStorage)
  useEffect(() => {
    const fetchShipments = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axiosInstance.get("/api/orders/distributor");
        setShipments(response.data || []);
      } catch (err) {
        console.error("Failed to fetch shipments:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchShipments();

    // ✅ Refresh every 30 seconds
    const interval = setInterval(fetchShipments, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateShipmentStatus = async (shipmentId, newStatus) => {
    try {
      const response = await axiosInstance.put(
        `/api/orders/${shipmentId}/shipment-status`,
        { status: newStatus },
      );

      // Update local state
      setShipments(
        shipments.map((s) =>
          s.id === shipmentId ? { ...s, status: newStatus } : s,
        ),
      );

      alert(`Shipment status updated to: ${newStatus}`);
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    }
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-200 ${
        isDark
          ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"
          : "bg-gradient-to-br from-emerald-50 via-white to-green-50"
      }`}
    >
      {/* Header */}
      <header
        className={`backdrop-blur-xl sticky top-0 z-40 transition-colors duration-200 ${
          isDark
            ? "bg-slate-800/80 border-b border-slate-700"
            : "bg-white/80 border-b border-white/50"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1
            className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          >
            Distributor Dashboard
          </h1>
          <p className={`mt-1 ${isDark ? "text-slate-300" : "text-gray-600"}`}>
            Manage shipments and fulfill orders
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Tabs */}
        <div
          className={`flex gap-4 mb-8 border-b ${
            isDark ? "border-slate-700" : "border-gray-200"
          }`}
        >
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-6 py-3 font-semibold transition-all border-b-2 ${
              activeTab === "orders"
                ? "text-emerald-600 border-emerald-600"
                : isDark
                  ? "text-slate-400 border-transparent hover:text-slate-300"
                  : "text-gray-600 border-transparent hover:text-gray-900"
            }`}
          >
            Shipments ({shipments.length})
          </button>
        </div>

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div>
            {loading ? (
              <div className="text-center py-12">
                <p className={isDark ? "text-gray-300" : "text-gray-600"}>
                  Loading shipments...
                </p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 font-semibold">Error: {error}</p>
              </div>
            ) : shipments.length === 0 ? (
              <div className="text-center py-12">
                <Truck
                  size={48}
                  className={`mx-auto mb-4 ${isDark ? "text-slate-600" : "text-gray-300"}`}
                />
                <p className={isDark ? "text-slate-400" : "text-gray-500"}>
                  No shipments assigned
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {shipments.map((shipment) => (
                  <div
                    key={shipment.id}
                    className={`backdrop-blur-xl border rounded-lg p-6 ${
                      isDark
                        ? "bg-slate-800/50 border-slate-700"
                        : "bg-white/80 border-white/50"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4
                          className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                        >
                          Shipment #{shipment.id}
                        </h4>
                        <p
                          className={`text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}
                        >
                          Order #{shipment.orderId}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-semibold ${
                          shipment.status === "DELIVERED"
                            ? "bg-green-100 text-green-800"
                            : shipment.status === "IN_TRANSIT"
                              ? "bg-blue-100 text-blue-800"
                              : shipment.status === "PICKED"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {shipment.status}
                      </span>
                    </div>

                    {/* Items */}
                    {shipment.order?.items && (
                      <div className="mb-4 space-y-2">
                        {shipment.order.items.map((item) => (
                          <div
                            key={item.id}
                            className={`text-sm ${isDark ? "text-slate-300" : "text-gray-700"}`}
                          >
                            📦 {item.productName} × {item.quantity} kg @ ₹
                            {Math.round(item.priceAtPurchase * 83)}/kg
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Total & Actions */}
                    <div
                      className={`pt-4 border-t ${isDark ? "border-slate-700" : "border-gray-200"}`}
                    >
                      <p
                        className={`font-bold text-lg mb-4 ${isDark ? "text-white" : "text-gray-900"}`}
                      >
                        Total: ₹
                        {Math.round(shipment.order?.totalAmount * 83 || 0)}
                      </p>

                      {/* Status Update Buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {shipment.status !== "DELIVERED" && (
                          <>
                            {shipment.status === "ASSIGNED" && (
                              <button
                                onClick={() =>
                                  updateShipmentStatus(shipment.id, "PICKED")
                                }
                                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition text-sm font-semibold"
                              >
                                Mark as Picked
                              </button>
                            )}
                            {shipment.status === "PICKED" && (
                              <button
                                onClick={() =>
                                  updateShipmentStatus(
                                    shipment.id,
                                    "IN_TRANSIT",
                                  )
                                }
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-semibold"
                              >
                                Mark as In Transit
                              </button>
                            )}
                            {shipment.status === "IN_TRANSIT" && (
                              <button
                                onClick={() =>
                                  updateShipmentStatus(shipment.id, "DELIVERED")
                                }
                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition text-sm font-semibold"
                              >
                                Mark as Delivered
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default DistributorDashboard;
```

---

## 9. UPDATE UserRepository

Add this method to find users by role:

### File: `backend/src/main/java/com/farmxchain/repository/UserRepository.java`

```java
@Query("SELECT u FROM User u WHERE u.role = :role")
List<User> findByRole(@Param("role") String role);
```

---

## 10. DEPLOYMENT CHECKLIST

```
☐ Backup current MySQL database
☐ Run migration script (db_migration_orders.sql)
☐ Compile backend (mvn clean package)
☐ Test OrderService locally
☐ Deploy backend to server
☐ Update frontend OrderAPI calls
☐ Clear browser localStorage
☐ Test end-to-end:
  - Customer checkout → creates order in DB
  - Retailer views orders from /api/orders/retailer
  - Distributor views shipments from /api/orders/distributor
☐ Monitor logs for errors
☐ Alert users to place new orders
```

---

## QUICK START

1. Run migration: `mysql -u root -p database_name < db_migration_orders.sql`
2. Add entities to `model/` folder
3. Add repositories to `repository/` folder
4. Add OrderService to `service/` folder
5. Add OrderController to `controller/` folder
6. Update CustomerDashboard handleCheckout
7. Update RetailerDashboard & DistributorDashboard
8. Restart Spring Boot backend
9. Test from Frontend

Orders will now flow through the database instead of localStorage! ✅
