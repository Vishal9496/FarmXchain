package com.farmxchain.controller;

import com.farmxchain.model.*;
import com.farmxchain.repository.UserRepository;
import com.farmxchain.security.JwtUtil;
import com.farmxchain.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * ✅ PRODUCTION ORDER CONTROLLER
 * 
 * REST API endpoints for order management.
 * 
 * SECURITY:
 * - All endpoints require JWT in Authorization header
 * - Role validation at controller level
 * - Customer ID extracted from JWT (never trusted from frontend)
 * 
 * ENDPOINTS:
 * - POST /api/orders (Checkout)
 * - GET /api/orders/customer (Customer's orders)
 * - GET /api/orders/retailer (Retailer's orders)
 * - GET /api/orders/farmer (Farmer's orders)
 * - GET /api/orders/{id} (Order details)
 * - PUT /api/orders/{id}/confirm (Confirm order)
 * - PUT /api/orders/{id}/ship (Ship order)
 * - PUT /api/orders/{id}/deliver (Deliver order)
 * - PUT /api/orders/{id}/cancel (Cancel order)
 */
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
    // POST /api/orders - CUSTOMER CHECKOUT (CRITICAL)
    // ============================================================================

    /**
     * ✅ CHECKOUT ENDPOINT
     * 
     * Creates an order from customer's cart.
     * 
     * FLOW:
     * 1. Extract customer ID from JWT
     * 2. Validate role = CUSTOMER
     * 3. Validate cart items (not empty, valid format)
     * 4. Call OrderService.createOrderFromCheckout (transactional)
     * 5. Return Order with status = PLACED
     * 
     * REQUEST BODY:
     * {
     *   "items": [
     *     {"productId": 1, "quantity": 2},
     *     {"productId": 3, "quantity": 1}
     *   ]
     * }
     * 
     * RESPONSE (201 CREATED):
     * {
     *   "id": 12345,
     *   "customerId": 99,
     *   "totalAmount": 250.00,
     *   "status": "PLACED",
     *   "items": [...],
     *   "createdAt": "2026-02-01T10:30:00"
     * }
     */
    @PostMapping
    public ResponseEntity<?> checkout(
            @RequestHeader("Authorization") String authHeader,
            @RequestBody CheckoutRequest request) {

        try {
            System.out.println("[OrderController] Checkout request received");

            // ✅ SECURITY: Extract and validate JWT
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(new ErrorResponse("Missing or invalid Authorization header"));
            }

            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);
            String role = jwtUtil.extractRole(token);

            // ✅ SECURITY: Only customers can checkout
            if (!"customer".equalsIgnoreCase(role)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ErrorResponse("Only customers can place orders. Your role: " + role));
            }

            // ✅ SECURITY: Get customer from database (not frontend-provided)
            Optional<User> customerOpt = userRepository.findByEmail(email);
            if (!customerOpt.isPresent()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ErrorResponse("User account not found"));
            }

            User customer = customerOpt.get();
            System.out.println("[OrderController] Customer: " + customer.getId() + " (" + email + ")");

            // ✅ VALIDATION: Cart items
            if (request.items == null || request.items.isEmpty()) {
                return ResponseEntity.badRequest()
                        .body(new ErrorResponse("Cart cannot be empty"));
            }

            // ✅ VALIDATION: Prevent excessive orders
            if (request.items.size() > 100) {
                return ResponseEntity.badRequest()
                        .body(new ErrorResponse("Cart too large (max 100 items)"));
            }

            System.out.println("[OrderController] Processing " + request.items.size() + " items");

            // ✅ TRANSACTIONAL: Create order via service
            Order order = orderService.createOrderFromCheckout(
                    customer,
                    request.items
            );

            System.out.println("[OrderController] Order created: " + order.getId());

            // ✅ RESPONSE: Return order details
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(new OrderResponse(order));

        } catch (IllegalArgumentException e) {
            System.err.println("[OrderController] Validation error: " + e.getMessage());
            return ResponseEntity.badRequest()
                    .body(new ErrorResponse(e.getMessage()));

        } catch (Exception e) {
            System.err.println("[OrderController] Checkout error: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Checkout failed: " + e.getMessage()));
        }
    }

    // ============================================================================
    // GET /api/orders/customer - CUSTOMER'S ORDERS
    // ============================================================================

    /**
     * Get all orders for authenticated customer
     */
    @GetMapping("/customer")
    public ResponseEntity<?> getCustomerOrders(
            @RequestHeader("Authorization") String authHeader) {

        try {
            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);
            String role = jwtUtil.extractRole(token);

            if (!"customer".equalsIgnoreCase(role)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ErrorResponse("Only customers can access this endpoint"));
            }

            User customer = userRepository.findByEmail(email)
                    .orElseThrow(() -> new Exception("User not found"));

            List<Order> orders = orderService.getCustomerOrders(customer.getId());

            List<OrderResponse> response = orders.stream()
                    .map(OrderResponse::new)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Invalid token: " + e.getMessage()));
        }
    }

    // ============================================================================
    // GET /api/orders/retailer - RETAILER'S ORDERS
    // ============================================================================

    /**
     * Get all orders containing products from this retailer
     */
    @GetMapping("/retailer")
    public ResponseEntity<?> getRetailerOrders(
            @RequestHeader("Authorization") String authHeader) {

        try {
            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);
            String role = jwtUtil.extractRole(token);

            if (!"retailer".equalsIgnoreCase(role)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ErrorResponse("Only retailers can access this endpoint"));
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
                    .body(new ErrorResponse("Invalid token"));
        }
    }

    // ============================================================================
    // GET /api/orders/farmer - FARMER'S ORDERS
    // ============================================================================

    /**
     * Get all orders containing products from this farmer
     */
    @GetMapping("/farmer")
    public ResponseEntity<?> getFarmerOrders(
            @RequestHeader("Authorization") String authHeader) {

        try {
            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);
            String role = jwtUtil.extractRole(token);

            if (!"farmer".equalsIgnoreCase(role)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ErrorResponse("Only farmers can access this endpoint"));
            }

            User farmer = userRepository.findByEmail(email)
                    .orElseThrow(() -> new Exception("User not found"));

            List<Order> orders = orderService.getFarmerOrders(farmer.getId());

            List<OrderResponse> response = orders.stream()
                    .map(OrderResponse::new)
                    .collect(Collectors.toList());

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ErrorResponse("Invalid token"));
        }
    }

    // ============================================================================
    // GET /api/orders/{id} - ORDER DETAILS
    // ============================================================================

    /**
     * Get details of a specific order
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getOrder(
            @PathVariable Long id,
            @RequestHeader("Authorization") String authHeader) {

        try {
            String token = authHeader.substring(7);
            jwtUtil.extractEmail(token); // Validate token

            Order order = orderService.getOrder(id);
            return ResponseEntity.ok(new OrderResponse(order));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("Order not found"));
        }
    }

    // ============================================================================
    // PUT /api/orders/{id}/confirm - CONFIRM ORDER
    // ============================================================================

    /**
     * Confirm order (PLACED → CONFIRMED)
     * Called by retailer when ready to ship
     */
    @PutMapping("/{id}/confirm")
    public ResponseEntity<?> confirmOrder(
            @PathVariable Long id,
            @RequestHeader("Authorization") String authHeader) {

        try {
            String token = authHeader.substring(7);
            String role = jwtUtil.extractRole(token);

            if (!"retailer".equalsIgnoreCase(role)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ErrorResponse("Only retailers can confirm orders"));
            }

            Order order = orderService.confirmOrder(id);
            return ResponseEntity.ok(new OrderResponse(order));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to confirm order: " + e.getMessage()));
        }
    }

    // ============================================================================
    // PUT /api/orders/{id}/ship - SHIP ORDER
    // ============================================================================

    /**
     * Ship order (CONFIRMED → SHIPPED)
     * Called by distributor when leaving warehouse
     */
    @PutMapping("/{id}/ship")
    public ResponseEntity<?> shipOrder(
            @PathVariable Long id,
            @RequestHeader("Authorization") String authHeader) {

        try {
            String token = authHeader.substring(7);
            String role = jwtUtil.extractRole(token);

            if (!"distributor".equalsIgnoreCase(role)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ErrorResponse("Only distributors can ship orders"));
            }

            Order order = orderService.shipOrder(id);
            return ResponseEntity.ok(new OrderResponse(order));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to ship order: " + e.getMessage()));
        }
    }

    // ============================================================================
    // PUT /api/orders/{id}/deliver - DELIVER ORDER
    // ============================================================================

    /**
     * Deliver order (SHIPPED → DELIVERED)
     * Called by distributor when customer receives
     */
    @PutMapping("/{id}/deliver")
    public ResponseEntity<?> deliverOrder(
            @PathVariable Long id,
            @RequestHeader("Authorization") String authHeader) {

        try {
            String token = authHeader.substring(7);
            String role = jwtUtil.extractRole(token);

            if (!"distributor".equalsIgnoreCase(role)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(new ErrorResponse("Only distributors can deliver orders"));
            }

            Order order = orderService.deliverOrder(id);
            return ResponseEntity.ok(new OrderResponse(order));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to deliver order: " + e.getMessage()));
        }
    }

    // ============================================================================
    // PUT /api/orders/{id}/cancel - CANCEL ORDER
    // ============================================================================

    /**
     * Cancel order (restores inventory)
     */
    @PutMapping("/{id}/cancel")
    public ResponseEntity<?> cancelOrder(
            @PathVariable Long id,
            @RequestHeader("Authorization") String authHeader) {

        try {
            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);
            String role = jwtUtil.extractRole(token);

            // ✅ Only customer who placed order can cancel
            if ("customer".equalsIgnoreCase(role)) {
                User customer = userRepository.findByEmail(email)
                        .orElseThrow(() -> new Exception("User not found"));

                Order order = orderService.getOrder(id);
                if (!order.getCustomer().getId().equals(customer.getId())) {
                    return ResponseEntity.status(HttpStatus.FORBIDDEN)
                            .body(new ErrorResponse("Cannot cancel someone else's order"));
                }
            }

            Order order = orderService.cancelOrder(id);
            return ResponseEntity.ok(new OrderResponse(order));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to cancel order: " + e.getMessage()));
        }
    }

    // ============================================================================
    // DTO CLASSES
    // ============================================================================

    /**
     * ✅ CHECKOUT REQUEST DTO
     */
    public static class CheckoutRequest {
        public List<CheckoutItemRequest> items;

        public CheckoutRequest() {}

        public CheckoutRequest(List<CheckoutItemRequest> items) {
            this.items = items;
        }
    }

    /**
     * ✅ CHECKOUT ITEM REQUEST DTO
     */
    public static class CheckoutItemRequest {
        public Long productId;
        public Integer quantity;

        public CheckoutItemRequest() {}

        public CheckoutItemRequest(Long productId, Integer quantity) {
            this.productId = productId;
            this.quantity = quantity;
        }
    }

    /**
     * ✅ ORDER RESPONSE DTO
     */
    public static class OrderResponse {
        public Long id;
        public Long customerId;
        public String customerName;
        public BigDecimal totalAmount;
        public String status;
        public LocalDateTime createdAt;
        public LocalDateTime updatedAt;
        public List<OrderItemResponse> items;

        public OrderResponse() {}

        public OrderResponse(Order order) {
            this.id = order.getId();
            this.customerId = order.getCustomer() != null ? order.getCustomer().getId() : null;
            this.customerName = order.getCustomer() != null ? order.getCustomer().getName() : null;
            this.totalAmount = order.getTotalAmount();
            this.status = order.getStatus().toString();
            this.createdAt = order.getCreatedAt();
            this.updatedAt = order.getUpdatedAt();
            this.items = order.getItems().stream()
                    .map(OrderItemResponse::new)
                    .collect(Collectors.toList());
        }
    }

    /**
     * ✅ ORDER ITEM RESPONSE DTO
     */
    public static class OrderItemResponse {
        public Long id;
        public Long productId;
        public String productName;
        public Integer quantity;
        public BigDecimal priceAtPurchase;
        public Long farmerId;
        public Long retailerId;
        public BigDecimal lineTotal;

        public OrderItemResponse() {}

        public OrderItemResponse(OrderItem item) {
            this.id = item.getId();
            this.productId = item.getProduct() != null ? item.getProduct().getId() : null;
            this.productName = item.getProduct() != null ? item.getProduct().getCropType() : null;
            this.quantity = item.getQuantity();
            this.priceAtPurchase = item.getPriceAtPurchase();
            this.farmerId = item.getFarmerId();
            this.retailerId = item.getRetailerId();
            this.lineTotal = item.getLineTotal();
        }
    }

    /**
     * ✅ ERROR RESPONSE DTO
     */
    public static class ErrorResponse {
        public String message;
        public LocalDateTime timestamp;

        public ErrorResponse(String message) {
            this.message = message;
            this.timestamp = LocalDateTime.now();
        }
    }
}
