package com.farmxchain.model;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * ✅ PRODUCTION ORDER ITEM ENTITY
 * 
 * Represents a single line item in an order.
 * Stores immutable price snapshot at time of purchase.
 * Links to product, farmer, and retailer for traceability.
 * 
 * Schema:
 * - order_id: Parent order reference
 * - product_id: Which product was ordered
 * - farmer_id: Original farmer who produced the product
 * - retailer_id: Which retailer sold this product
 * - quantity: How many units ordered
 * - price_at_purchase: IMMUTABLE price snapshot (prevents disputes)
 * - created_at: When item was created
 */
@Entity
@Table(name = "order_items", indexes = {
    @Index(name = "idx_order_id", columnList = "order_id"),
    @Index(name = "idx_product_id", columnList = "product_id"),
    @Index(name = "idx_retailer_id", columnList = "retailer_id"),
    @Index(name = "idx_farmer_id", columnList = "farmer_id")
})
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // ============================================================================
    // RELATIONSHIPS
    // ============================================================================

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    // ============================================================================
    // TRACEABILITY COLUMNS
    // ============================================================================

    /**
     * ✅ CRITICAL: Store farmer ID at purchase time
     * Ensures we always know who produced this item
     * even if product-farmer relationship changes
     */
    @Column(name = "farmer_id", nullable = false)
    private Long farmerId;

    /**
     * ✅ CRITICAL: Store retailer ID at purchase time
     * Enables retailer dashboard to see orders for products they sold
     */
    @Column(name = "retailer_id", nullable = false)
    private Long retailerId;

    // ============================================================================
    // ORDER ITEM DATA
    // ============================================================================

    /**
     * Quantity ordered (in units/kg)
     */
    @Column(nullable = false)
    private Integer quantity;

    /**
     * ✅ CRITICAL: Price snapshot at time of order
     * IMMUTABLE - prevents price disputes
     * Why: Product prices can change after order placed
     * This ensures historical accuracy
     */
    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal priceAtPurchase;

    // ============================================================================
    // AUDIT
    // ============================================================================

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // ============================================================================
    // JPA LIFECYCLE CALLBACKS
    // ============================================================================

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    // ============================================================================
    // CONSTRUCTORS
    // ============================================================================

    public OrderItem() {}

    public OrderItem(Order order, Product product, Long farmerId, Long retailerId, 
                     Integer quantity, BigDecimal priceAtPurchase) {
        this.order = order;
        this.product = product;
        this.farmerId = farmerId;
        this.retailerId = retailerId;
        this.quantity = quantity;
        this.priceAtPurchase = priceAtPurchase;
    }

    // ============================================================================
    // BUSINESS METHODS
    // ============================================================================

    /**
     * Calculate subtotal for this line item
     * @return quantity * priceAtPurchase
     */
    public BigDecimal getLineTotal() {
        return priceAtPurchase.multiply(new BigDecimal(quantity));
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

    public BigDecimal getPriceAtPurchase() {
        return priceAtPurchase;
    }

    public void setPriceAtPurchase(BigDecimal priceAtPurchase) {
        this.priceAtPurchase = priceAtPurchase;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    // ============================================================================
    // UTILITY METHODS
    // ============================================================================

    @Override
    public String toString() {
        return "OrderItem{" +
                "id=" + id +
                ", productId=" + (product != null ? product.getId() : null) +
                ", retailerId=" + retailerId +
                ", farmerId=" + farmerId +
                ", quantity=" + quantity +
                ", priceAtPurchase=" + priceAtPurchase +
                ", lineTotal=" + getLineTotal() +
                '}';
    }
}
