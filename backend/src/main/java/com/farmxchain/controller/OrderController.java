package com.farmxchain.controller;

import com.farmxchain.model.*;
import com.farmxchain.repository.UserRepository;
import com.farmxchain.service.OrderService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
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
 * ✅ SECURITY (P0-11): every method that used to declare
 * {@code @RequestHeader("Authorization") String authHeader} and manually
 * {@code substring(7)} it, then call {@code jwtUtil.extractEmail}/
 * {@code extractRole} and compare the result to a role string by hand, now
 * instead declares {@code @PreAuthorize(...)} for the static role gate and, if
 * the method body needs the caller's identity, takes {@code Authentication} and
 * reads {@code authentication.getName()}. That pattern was duplicated seven
 * times across this file before this change — once per endpoint — despite
 * {@code JwtAuthFilter} already performing the equivalent verification for
 * every request and already populating the {@code SecurityContext} with the
 * result. All seven copies are gone.
 *
 * {@code getOrder} and {@code cancelOrder} (P0-8 and P0-9) already used
 * {@code Authentication} rather than manual header parsing, and are reproduced
 * here unchanged — they are not part of this fix because they were never part
 * of the problem it addresses. Their authorization logic is data-dependent
 * (per-order ownership across five stakeholder types) rather than a static
 * role check, so it remains a plain conditional in the method body rather than
 * a {@code @PreAuthorize} expression; see the note above
 * {@code isAuthorizedToViewOrder} below for why.
 */
@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "http://localhost:3000")
public class OrderController {

    @Autowired
    private OrderService orderService;

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
     * ✅ SECURITY (P0-11): the header-presence check, the manual
     * {@code substring(7)}, and the manual "only customers can checkout" role
     * comparison are gone. {@code @PreAuthorize("hasRole('CUSTOMER')")} rejects
     * a non-customer token before this method body runs at all, and
     * {@code Authentication.getName()} supplies the verified email directly.
     */
    @PreAuthorize("hasRole('CUSTOMER')")
    @PostMapping
    public ResponseEntity<?> checkout(
            @RequestBody CheckoutRequest request,
            Authentication authentication) {

        try {
            System.out.println("[OrderController] Checkout request received");

            // ✅ SECURITY: Get customer from database (not frontend-provided)
            Optional<User> customerOpt = userRepository.findByEmail(authentication.getName());
            if (!customerOpt.isPresent()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(new ErrorResponse("User account not found"));
            }

            User customer = customerOpt.get();
            System.out.println("[OrderController] Customer: " + customer.getId() + " (" + customer.getEmail() + ")");

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
            List<OrderService.CheckoutItem> serviceItems = request.items.stream()
                    .map(i -> new OrderService.CheckoutItem(i.productId, i.quantity))
                    .collect(Collectors.toList());

            Order order = orderService.createOrderFromCheckout(customer, serviceItems);

            System.out.println("[OrderController] Order created: " + order.getId());

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
     * Get all orders for authenticated customer.
     *
     * ✅ SECURITY (P0-11): manual header parsing removed, as above.
     */
    @PreAuthorize("hasRole('CUSTOMER')")
    @GetMapping("/customer")
    public ResponseEntity<?> getCustomerOrders(Authentication authentication) {

        Optional<User> customerOpt = userRepository.findByEmail(authentication.getName());
        if (customerOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("User account not found"));
        }

        List<Order> orders = orderService.getCustomerOrders(customerOpt.get().getId());

        List<OrderResponse> response = orders.stream()
                .map(OrderResponse::new)
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    // ============================================================================
    // GET /api/orders/retailer - RETAILER'S ORDERS
    // ============================================================================

    /**
     * Get all orders containing products from this retailer.
     *
     * ✅ SECURITY (P0-11): manual header parsing removed, as above.
     */
    @PreAuthorize("hasRole('RETAILER')")
    @GetMapping("/retailer")
    public ResponseEntity<?> getRetailerOrders(Authentication authentication) {

        Optional<User> retailerOpt = userRepository.findByEmail(authentication.getName());
        if (retailerOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("User account not found"));
        }

        List<Order> orders = orderService.getRetailerOrders(retailerOpt.get().getId());

        List<OrderResponse> response = orders.stream()
                .map(OrderResponse::new)
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    // ============================================================================
    // GET /api/orders/farmer - FARMER'S ORDERS
    // ============================================================================

    /**
     * Get all orders containing products from this farmer.
     *
     * ✅ SECURITY (P0-11): manual header parsing removed, as above.
     */
    @PreAuthorize("hasRole('FARMER')")
    @GetMapping("/farmer")
    public ResponseEntity<?> getFarmerOrders(Authentication authentication) {

        Optional<User> farmerOpt = userRepository.findByEmail(authentication.getName());
        if (farmerOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("User account not found"));
        }

        List<Order> orders = orderService.getFarmerOrders(farmerOpt.get().getId());

        List<OrderResponse> response = orders.stream()
                .map(OrderResponse::new)
                .collect(Collectors.toList());

        return ResponseEntity.ok(response);
    }

    // ============================================================================
    // GET /api/orders/{id} - ORDER DETAILS
    // ============================================================================

    /**
     * Get details of a specific order.
     *
     * NOT modified by P0-11 — already used {@code Authentication} instead of
     * manual header parsing since P0-8. Reproduced unchanged so this file
     * compiles as a complete unit.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getOrder(
            @PathVariable Long id,
            Authentication authentication) {

        Order order;
        try {
            order = orderService.getOrder(id);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("Order not found"));
        }

        if (!isAuthorizedToViewOrder(order, authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ErrorResponse("You are not authorized to view this order"));
        }

        return ResponseEntity.ok(new OrderResponse(order));
    }

    /**
     * ✅ Not converted to {@code @PreAuthorize} — and deliberately so. This check
     * depends on loaded row data (which specific farmers/retailers have a line
     * item on THIS order, and who the assigned distributor is), not on a static
     * role the caller either has or doesn't. Expressing that in a
     * {@code @PreAuthorize} SpEL expression would require a custom
     * {@code PermissionEvaluator} or a security bean invoked as
     * {@code @PreAuthorize("@orderSecurity.canView(#id, authentication)")} — a
     * reasonable follow-up, but a larger architectural change than "stop
     * manually parsing the Authorization header," which is what this fix
     * addresses. {@code Authentication} is still used throughout, per the
     * requirement, exactly as it was under P0-8.
     */
    private boolean isAuthorizedToViewOrder(Order order, Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }

        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_ADMIN"));
        if (isAdmin) {
            return true;
        }

        Optional<User> callerOpt = userRepository.findByEmail(authentication.getName());
        if (callerOpt.isEmpty()) {
            return false;
        }
        Long callerId = callerOpt.get().getId();

        if (order.getCustomer() != null && callerId.equals(order.getCustomer().getId())) {
            return true;
        }

        if (order.getDistributorId() != null && callerId.equals(order.getDistributorId())) {
            return true;
        }

        boolean isFarmerOnOrder = order.getItems().stream()
                .anyMatch(item -> callerId.equals(item.getFarmerId()));
        if (isFarmerOnOrder) {
            return true;
        }

        boolean isRetailerOnOrder = order.getItems().stream()
                .anyMatch(item -> callerId.equals(item.getRetailerId()));
        if (isRetailerOnOrder) {
            return true;
        }

        return false;
    }

    // ============================================================================
    // PUT /api/orders/{id}/confirm - CONFIRM ORDER
    // ============================================================================

    /**
     * Confirm order (PLACED → CONFIRMED). Called by retailer when ready to ship.
     *
     * ✅ SECURITY (P0-11): the method body never used the caller's identity —
     * only the role, to gate the operation. {@code @PreAuthorize} replaces that
     * role check entirely, so the {@code Authorization} header, the token
     * variable, and the role variable all disappear from the signature and body.
     */
    @PreAuthorize("hasRole('RETAILER')")
    @PutMapping("/{id}/confirm")
    public ResponseEntity<?> confirmOrder(@PathVariable Long id) {

        try {
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
     * Ship order (CONFIRMED → SHIPPED). Called by distributor when leaving warehouse.
     *
     * ✅ SECURITY (P0-11): same simplification as {@link #confirmOrder}.
     */
    @PreAuthorize("hasRole('DISTRIBUTOR')")
    @PutMapping("/{id}/ship")
    public ResponseEntity<?> shipOrder(@PathVariable Long id) {

        try {
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
     * Deliver order (SHIPPED → DELIVERED). Called by distributor when customer receives.
     *
     * ✅ SECURITY (P0-11): same simplification as {@link #confirmOrder}.
     */
    @PreAuthorize("hasRole('DISTRIBUTOR')")
    @PutMapping("/{id}/deliver")
    public ResponseEntity<?> deliverOrder(@PathVariable Long id) {

        try {
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
     * Cancel order (restores inventory).
     *
     * NOT modified by P0-11 — already used {@code Authentication} instead of
     * manual header parsing since P0-9. Reproduced unchanged so this file
     * compiles as a complete unit.
     */
    @PutMapping("/{id}/cancel")
    public ResponseEntity<?> cancelOrder(
            @PathVariable Long id,
            Authentication authentication) {

        Order order;
        try {
            order = orderService.getOrder(id);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new ErrorResponse("Order not found"));
        }

        if (!isAuthorizedToCancelOrder(order, authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ErrorResponse("You are not authorized to cancel this order"));
        }

        try {
            Order cancelledOrder = orderService.cancelOrder(id);
            return ResponseEntity.ok(new OrderResponse(cancelledOrder));

        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new ErrorResponse(e.getMessage()));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorResponse("Failed to cancel order: " + e.getMessage()));
        }
    }

    /**
     * Same data-dependent-authorization rationale as
     * {@link #isAuthorizedToViewOrder} — not converted to {@code @PreAuthorize}
     * for the same reason. Not modified by P0-11.
     */
    private boolean isAuthorizedToCancelOrder(Order order, Authentication authentication) {

        if (authentication == null || !authentication.isAuthenticated()) {
            return false;
        }

        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_ADMIN"));
        if (isAdmin) {
            return true;
        }

        Optional<User> callerOpt = userRepository.findByEmail(authentication.getName());
        if (callerOpt.isEmpty()) {
            return false;
        }
        Long callerId = callerOpt.get().getId();

        if (order.getCustomer() != null && callerId.equals(order.getCustomer().getId())) {
            return true;
        }

        boolean callerIsRetailer = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equalsIgnoreCase("ROLE_RETAILER"));
        if (callerIsRetailer) {
            boolean isRetailerOnOrder = order.getItems().stream()
                    .anyMatch(item -> callerId.equals(item.getRetailerId()));
            if (isRetailerOnOrder) {
                return true;
            }
        }

        return false;
    }

    // ============================================================================
    // DTO CLASSES
    // ============================================================================

    public static class CheckoutRequest {
        public List<CheckoutItemRequest> items;

        public CheckoutRequest() {}

        public CheckoutRequest(List<CheckoutItemRequest> items) {
            this.items = items;
        }
    }

    public static class CheckoutItemRequest {
        public Long productId;
        public Integer quantity;

        public CheckoutItemRequest() {}

        public CheckoutItemRequest(Long productId, Integer quantity) {
            this.productId = productId;
            this.quantity = quantity;
        }
    }

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

    public static class ErrorResponse {
        public String message;
        public LocalDateTime timestamp;

        public ErrorResponse(String message) {
            this.message = message;
            this.timestamp = LocalDateTime.now();
        }
    }
}
