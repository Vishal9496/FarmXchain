package com.farmxchain.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * ✅ PRODUCTION ORDER ENTITY
 * 
 * Single source of truth for all order transactions.
 * Links customer, retailer, and distributor in one place.
 * 
 * Schema:
 * - customer_id: Who placed the order
 * - retailer_id: Which retailer(s) fulfill it
 * - distributor_id: Which distributor ships it
 * - status: PLACED → CONFIRMED → SHIPPED → DELIVERED
 * - created_at: Immutable timestamp
 * - updated_at: Last modification timestamp
 */
@Entity
@Table(name = "orders", indexes = {
    @Index(name = "idx_customer_id", columnList = "customer_id"),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_created_at", columnList = "created_at")
})
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ============================================================================
    // RELATIONSHIPS
    // ============================================================================

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id", nullable = false)
    private User customer;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<OrderItem> items = new ArrayList<>();

    // ============================================================================
    // DISTRIBUTOR ASSIGNMENT
    // ============================================================================

    /**
     * ✅ DISTRIBUTOR VISIBILITY
     * Distributor ID assigned when order status = PACKED
     * Enables role-based visibility: distributors see only orders assigned to them
     * NULL until order is packed and ready for shipment
     */
    @Column(name = "distributor_id", nullable = true)
    private Long distributorId;

    // ============================================================================
    // ORDER DATA
    // ============================================================================

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private OrderStatus status = OrderStatus.PLACED;

    // ============================================================================
    // AUDIT COLUMNS
    // ============================================================================

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    // ============================================================================
    // JPA LIFECYCLE CALLBACKS
    // ============================================================================

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    // ============================================================================
    // CONSTRUCTORS
    // ============================================================================

    public Order() {}

    public Order(User customer, List<OrderItem> items, BigDecimal totalAmount) {
        this.customer = customer;
        this.items = items;
        this.totalAmount = totalAmount;
        this.status = OrderStatus.PLACED;
    }

    // ============================================================================
    // BUSINESS METHODS
    // ============================================================================

    /**
     * Add order item to this order
     */
    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }

    /**
     * Remove order item from this order
     */
    public void removeItem(OrderItem item) {
        items.remove(item);
        item.setOrder(null);
    }

    /**
     * Confirm order (move from PLACED → CONFIRMED)
     */
    public void confirm() {
        if (this.status != OrderStatus.PLACED) {
            throw new IllegalStateException("Only PLACED orders can be confirmed");
        }
        this.status = OrderStatus.CONFIRMED;
    }

    /**
     * Pack order for shipment (move to PACKED)
     * Assigns distributor at this point
     */
    public void pack(Long distributorId) {
        if (this.status != OrderStatus.CONFIRMED) {
            throw new IllegalStateException("Only CONFIRMED orders can be packed");
        }
        if (distributorId == null || distributorId <= 0) {
            throw new IllegalArgumentException("Valid distributor ID required");
        }
        this.status = OrderStatus.PACKED;
        this.distributorId = distributorId;
    }

    /**
     * Mark order as shipped (move to SHIPPED)
     */
    public void ship() {
        if (this.status != OrderStatus.PACKED) {
            throw new IllegalStateException("Only PACKED orders can be shipped");
        }
        this.status = OrderStatus.SHIPPED;
    }

    /**
     * Mark order as delivered (move to DELIVERED)
     */
    public void deliver() {
        if (this.status != OrderStatus.SHIPPED) {
            throw new IllegalStateException("Only SHIPPED orders can be delivered");
        }
        this.status = OrderStatus.DELIVERED;
    }

    /**
     * Cancel order
     */
    public void cancel() {
        if (this.status == OrderStatus.DELIVERED || this.status == OrderStatus.CANCELLED) {
            throw new IllegalStateException("Cannot cancel " + this.status + " orders");
        }
        this.status = OrderStatus.CANCELLED;
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

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public OrderStatus getStatus() {
        return status;
    }

    public void setStatus(OrderStatus status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public Long getDistributorId() {
        return distributorId;
    }

    public void setDistributorId(Long distributorId) {
        this.distributorId = distributorId;
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    @Override
    public String toString() {
        return "Order{" +
                "id=" + id +
                ", customerId=" + (customer != null ? customer.getId() : null) +
                ", itemCount=" + items.size() +
                ", totalAmount=" + totalAmount +
                ", status=" + status +
                ", createdAt=" + createdAt +
                '}';
    }
}

/**
 * ✅ ORDER LIFECYCLE STATES
 */
enum OrderStatus {
    PLACED,      // Customer submitted order
    CONFIRMED,   // Retailer confirmed order
    PACKED,      // Order packed and ready for shipment (distributor assigned here)
    SHIPPED,     // Distributor shipped order
    DELIVERED,   // Customer received order
    CANCELLED    // Order was cancelled
}
