package com.farmxchain.service;

import com.farmxchain.model.*;
import com.farmxchain.repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * ✅ PRODUCTION ORDER SERVICE
 * 
 * Business logic for order management.
 * All database operations are TRANSACTIONAL for ACID compliance.
 * 
 * Key responsibilities:
 * 1. Validate cart items (products exist, stock available)
 * 2. Create order with line items
 * 3. Lock prices at time of purchase
 * 4. Decrement inventory
 * 5. Track farmer/retailer relationships
 */
@Service
public class OrderService {

    @Autowired
    private OrderRepository orderRepository;

    @Autowired
    private OrderItemRepository orderItemRepository;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private UserRepository userRepository;

    // ============================================================================
    // CHECKOUT FLOW (TRANSACTIONAL)
    // ============================================================================

    /**
     * ✅ CRITICAL: Create order from customer cart
     * 
     * TRANSACTION FLOW:
     * 1. Validate all cart items
     * 2. Create Order entity (status = PLACED)
     * 3. Create OrderItems with price snapshots
     * 4. Decrement product inventory
     * 5. Return complete Order or rollback on error
     * 
     * @param customer The customer placing the order (from JWT)
     * @param cartItems Items to order
     * @return Created Order with status = PLACED
     * @throws Exception if validation fails
     */
    @Transactional
    public Order createOrderFromCheckout(User customer, List<CheckoutItem> cartItems) throws Exception {
        
        if (cartItems == null || cartItems.isEmpty()) {
            throw new IllegalArgumentException("Cart cannot be empty");
        }

        System.out.println("[OrderService] Creating order for customer: " + customer.getId() + 
                           ", items: " + cartItems.size());

        // ============================================================================
        // STEP 1: VALIDATE ALL CART ITEMS
        // ============================================================================
        
        List<OrderItem> orderItems = new ArrayList<>();
        BigDecimal totalAmount = BigDecimal.ZERO;

        for (CheckoutItem cartItem : cartItems) {
            
            // Get product from database
            Product product = productRepository.findById(cartItem.productId)
                    .orElseThrow(() -> new Exception("Product not found: " + cartItem.productId));

            // Validate product has required fields
            if (product.getFarmerId() == null) {
                throw new Exception("Product missing farmer ID: " + product.getId());
            }
            if (product.getRetailerId() == null) {
                throw new Exception("Product missing retailer ID: " + product.getId());
            }

            // Validate inventory
            if (product.getQuantity() == null || product.getQuantity() <= 0) {
                throw new Exception("Product out of stock: " + product.getCropType());
            }
            if (product.getQuantity() < cartItem.quantity) {
                throw new Exception("Insufficient stock for " + product.getCropType() + 
                                  ". Available: " + product.getQuantity() + 
                                  ", Requested: " + cartItem.quantity);
            }

            // Validate price exists
            if (product.getPrice() == null || product.getPrice() <= 0) {
                throw new Exception("Product has invalid price: " + product.getId());
            }

            // ============================================================================
            // STEP 2: CREATE ORDER ITEM WITH PRICE SNAPSHOT
            // ============================================================================

            OrderItem item = new OrderItem();
            item.setProduct(product);
            item.setQuantity(cartItem.quantity);
            item.setFarmerId(product.getFarmerId());
            item.setRetailerId(product.getRetailerId());
            
            // ✅ CRITICAL: Lock price at time of checkout
            BigDecimal priceAtPurchase = BigDecimal.valueOf(product.getPrice());
            item.setPriceAtPurchase(priceAtPurchase);

            orderItems.add(item);

            // Calculate total
            BigDecimal lineTotal = priceAtPurchase.multiply(new BigDecimal(cartItem.quantity));
            totalAmount = totalAmount.add(lineTotal);

            System.out.println("[OrderService] Item validated: productId=" + product.getId() + 
                             ", qty=" + cartItem.quantity + ", price=" + priceAtPurchase);
        }

        // ============================================================================
        // STEP 3: CREATE ORDER ENTITY
        // ============================================================================

        Order order = new Order();
        order.setCustomer(customer);
        order.setTotalAmount(totalAmount);
        order.setStatus(OrderStatus.PLACED);

        // ✅ Save order (triggers @PrePersist: sets createdAt, updatedAt)
        Order savedOrder = orderRepository.save(order);
        System.out.println("[OrderService] Order created with id=" + savedOrder.getId() + 
                           ", total=" + totalAmount);

        // ============================================================================
        // STEP 4: CREATE ORDER ITEMS
        // ============================================================================

        for (OrderItem item : orderItems) {
            item.setOrder(savedOrder);
            orderItemRepository.save(item);
        }

        savedOrder.setItems(orderItems);

        // ============================================================================
        // STEP 5: DECREMENT INVENTORY
        // ============================================================================

        for (OrderItem item : orderItems) {
            Product product = item.getProduct();
            Integer newQuantity = product.getQuantity() - item.getQuantity();
            product.setQuantity(newQuantity);
            productRepository.save(product);

            System.out.println("[OrderService] Inventory updated: productId=" + product.getId() + 
                             ", newQuantity=" + newQuantity);
        }

        System.out.println("[OrderService] Order checkout complete: orderId=" + savedOrder.getId() + 
                           ", status=" + savedOrder.getStatus());

        return savedOrder;
    }

    // ============================================================================
    // ORDER RETRIEVAL (READ-ONLY, NO TRANSACTION NEEDED)
    // ============================================================================

    /**
     * Get all orders for a customer
     */
    public List<Order> getCustomerOrders(Long customerId) {
        return orderRepository.findByCustomerId(customerId);
    }

    /**
     * Get all orders containing products from a retailer
     */
    public List<Order> getRetailerOrders(Long retailerId) {
        return orderRepository.findOrdersByRetailer(retailerId);
    }

    /**
     * Get pending orders for a retailer (to confirm)
     */
    public List<Order> getPendingRetailerOrders(Long retailerId) {
        return orderRepository.findPendingOrdersByRetailer(retailerId);
    }

    /**
     * Get all orders containing products from a farmer
     */
    public List<Order> getFarmerOrders(Long farmerId) {
        return orderRepository.findOrdersByFarmer(farmerId);
    }

    /**
     * Get single order by ID
     */
    public Order getOrder(Long orderId) throws Exception {
        return orderRepository.findByIdWithItems(orderId)
                .orElseThrow(() -> new Exception("Order not found: " + orderId));
    }

    // ============================================================================
    // ORDER STATUS UPDATES (TRANSACTIONAL)
    // ============================================================================

    /**
     * Confirm order (PLACED → CONFIRMED)
     * Called by retailer when order is ready to ship
     */
    @Transactional
    public Order confirmOrder(Long orderId) throws Exception {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new Exception("Order not found: " + orderId));

        order.confirm();
        return orderRepository.save(order);
    }

    /**
     * Ship order (CONFIRMED → SHIPPED)
     * Called by distributor when order leaves warehouse
     */
    @Transactional
    public Order shipOrder(Long orderId) throws Exception {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new Exception("Order not found: " + orderId));

        order.ship();
        return orderRepository.save(order);
    }

    /**
     * Deliver order (SHIPPED → DELIVERED)
     * Called by distributor when customer receives order
     */
    @Transactional
    public Order deliverOrder(Long orderId) throws Exception {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new Exception("Order not found: " + orderId));

        order.deliver();
        return orderRepository.save(order);
    }

    /**
     * Cancel order
     * Can be called at any point before delivery
     */
    @Transactional
    public Order cancelOrder(Long orderId) throws Exception {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new Exception("Order not found: " + orderId));

        // Restore inventory when cancelling
        for (OrderItem item : order.getItems()) {
            Product product = item.getProduct();
            product.setQuantity(product.getQuantity() + item.getQuantity());
            productRepository.save(product);

            System.out.println("[OrderService] Inventory restored after cancel: productId=" + 
                             product.getId() + ", quantity=" + product.getQuantity());
        }

        order.cancel();
        return orderRepository.save(order);
    }

    // ============================================================================
    // DTO CLASSES
    // ============================================================================

    /**
     * ✅ CHECKOUT ITEM DTO
     * Represents a single item in customer's checkout cart
     */
    public static class CheckoutItem {
        public Long productId;
        public Integer quantity;

        public CheckoutItem() {}

        public CheckoutItem(Long productId, Integer quantity) {
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

        @Override
        public String toString() {
            return "CheckoutItem{productId=" + productId + ", quantity=" + quantity + "}";
        }
    }
}
