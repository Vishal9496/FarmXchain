# REST Endpoint Implementations - Role-Based Order Visibility

## Overview

This document provides complete, production-ready REST endpoint implementations for retailers and distributors to view their role-specific orders.

---

## Endpoint: GET /api/orders/retailer

**Retailers see:** Orders containing products they sell (PLACED, CONFIRMED status only)

### Request

```http
GET /api/orders/retailer HTTP/1.1
Host: localhost:8080
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

### Response (200 OK)

```json
{
  "status": "success",
  "message": "Retrieved 3 pending orders",
  "count": 3,
  "data": [
    {
      "orderId": 12345,
      "customerId": 99,
      "customerName": "John Doe",
      "customerEmail": "john@example.com",
      "orderStatus": "CONFIRMED",
      "orderTotal": 250.0,
      "orderedDate": "2026-02-01T10:30:00",
      "myItems": [
        {
          "itemId": 1,
          "productId": 1,
          "productName": "Tomato",
          "quantity": 2,
          "unit": "kg",
          "pricePerUnit": 50.0,
          "itemTotal": 100.0,
          "farmerName": "Farm Fresh Co.",
          "addedDate": "2026-02-01T10:30:00"
        }
      ],
      "otherRetailerItemsCount": 1,
      "otherRetailers": [
        {
          "retailerId": 21,
          "retailerName": "Organic Store",
          "itemCount": 1
        }
      ],
      "actions": [
        {
          "action": "CONFIRM_FULFILLMENT",
          "label": "I can fulfill this order",
          "enabled": true
        },
        {
          "action": "REQUEST_ADJUSTMENT",
          "label": "Request quantity adjustment",
          "enabled": true
        },
        {
          "action": "REJECT_ORDER",
          "label": "Cannot fulfill",
          "enabled": true
        }
      ]
    },
    {
      "orderId": 12346,
      "customerId": 99,
      "customerName": "John Doe",
      "customerEmail": "john@example.com",
      "orderStatus": "PLACED",
      "orderTotal": 150.0,
      "orderedDate": "2026-02-01T09:00:00",
      "myItems": [
        {
          "itemId": 3,
          "productId": 5,
          "productName": "Onion",
          "quantity": 5,
          "unit": "kg",
          "pricePerUnit": 30.0,
          "itemTotal": 150.0,
          "farmerName": "Mountain Valley Farms",
          "addedDate": "2026-02-01T09:00:00"
        }
      ],
      "otherRetailerItemsCount": 0,
      "otherRetailers": [],
      "actions": [
        {
          "action": "CONFIRM_FULFILLMENT",
          "label": "I can fulfill this order",
          "enabled": true
        }
      ]
    }
  ],
  "summary": {
    "totalPendingOrders": 3,
    "totalItemsToFulfill": 2,
    "totalRevenue": 400.0
  }
}
```

### Error Responses

**401 Unauthorized - Missing Token:**

```json
{
  "status": "error",
  "message": "Missing or invalid Authorization header",
  "code": "UNAUTHORIZED",
  "timestamp": "2026-02-01T10:35:00"
}
```

**403 Forbidden - Wrong Role:**

```json
{
  "status": "error",
  "message": "Only retailers can access this endpoint",
  "code": "FORBIDDEN",
  "timestamp": "2026-02-01T10:35:00"
}
```

### Implementation

```java
@RestController
@RequestMapping("/api/orders")
@CrossOrigin(origins = "http://localhost:3000")
public class OrderController {

    @Autowired private OrderService orderService;
    @Autowired private JwtUtil jwtUtil;
    @Autowired private UserRepository userRepository;
    @Autowired private OrderRepository orderRepository;

    /**
     * ✅ GET /api/orders/retailer
     *
     * Retailers see orders with their products (PLACED, CONFIRMED only)
     * Returns only items from this retailer + context about other retailers
     */
    @GetMapping("/retailer")
    public ResponseEntity<?> getRetailerOrders(
            @RequestHeader(value = "Authorization", required = false) String authHeader) {

        try {
            System.out.println("[OrderController] GET /api/orders/retailer");

            // ✅ SECURITY: Validate JWT
            if (authHeader == null || !authHeader.startsWith("Bearer ")) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new ApiErrorResponse(
                        "error",
                        "Missing or invalid Authorization header",
                        "UNAUTHORIZED"));
            }

            String token = authHeader.substring(7);
            String email = jwtUtil.extractEmail(token);
            String role = jwtUtil.extractRole(token);

            // ✅ SECURITY: Validate role
            if (role == null || !"retailer".equalsIgnoreCase(role)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(new ApiErrorResponse(
                        "error",
                        "Only retailers can access this endpoint",
                        "FORBIDDEN"));
            }

            // ✅ SECURITY: Load retailer from database (never frontend-provided)
            User retailer = userRepository.findByEmail(email)
                .orElseThrow(() -> new UserNotFoundException(
                    "Retailer not found: " + email));

            System.out.println("[OrderController] Retailer ID: " + retailer.getId());

            // ✅ Query: Get pending orders for this retailer
            List<Order> orders = orderRepository.findPendingOrdersByRetailer(
                retailer.getId());

            System.out.println("[OrderController] Found " + orders.size() +
                " pending orders for retailer " + retailer.getId());

            // ✅ Transform to retailer-specific DTOs
            List<RetailerOrderDTO> retailerOrders = orders.stream()
                .map(order -> new RetailerOrderDTO(order, retailer.getId()))
                .collect(Collectors.toList());

            // ✅ Calculate summary
            int totalItems = retailerOrders.stream()
                .mapToInt(o -> o.getMyItems().size())
                .sum();

            BigDecimal totalRevenue = retailerOrders.stream()
                .map(RetailerOrderDTO::getOrderTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "Retrieved " + retailerOrders.size() +
                " pending orders");
            response.put("count", retailerOrders.size());
            response.put("data", retailerOrders);

            Map<String, Object> summary = new HashMap<>();
            summary.put("totalPendingOrders", retailerOrders.size());
            summary.put("totalItemsToFulfill", totalItems);
            summary.put("totalRevenue", totalRevenue);
            response.put("summary", summary);

            return ResponseEntity.ok(response);

        } catch (UserNotFoundException ex) {
            System.err.println("[OrderController] Error: " + ex.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiErrorResponse("error", ex.getMessage(), "USER_NOT_FOUND"));
        } catch (Exception ex) {
            System.err.println("[OrderController] Unexpected error: " + ex.getMessage());
            ex.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ApiErrorResponse("error", "Internal server error", "SERVER_ERROR"));
        }
    }
}

/**
 * ✅ DTO: RetailerOrderDTO
 *
 * What retailer sees for each order:
 * - Only items from this retailer (filtered)
 * - Count of items from other retailers (for context)
 * - Customer info (for fulfillment)
 * - Actionable buttons (what retailer can do)
 */
public class RetailerOrderDTO {
    private Long orderId;
    private Long customerId;
    private String customerName;
    private String customerEmail;
    private String orderStatus;
    private BigDecimal orderTotal;
    private LocalDateTime orderedDate;
    private List<RetailerOrderItemDTO> myItems;
    private Integer otherRetailerItemsCount;
    private List<OtherRetailerDTO> otherRetailers;
    private List<ActionDTO> actions;

    public RetailerOrderDTO(Order order, Long retailerId) {
        this.orderId = order.getId();
        this.customerId = order.getCustomer().getId();
        this.customerName = order.getCustomer().getFullName();
        this.customerEmail = order.getCustomer().getEmail();
        this.orderStatus = order.getStatus().toString();
        this.orderTotal = order.getTotalAmount();
        this.orderedDate = order.getCreatedAt();

        // ✅ CRITICAL: Filter to only items from this retailer
        this.myItems = order.getItems().stream()
            .filter(item -> item.getRetailerId().equals(retailerId))
            .map(RetailerOrderItemDTO::new)
            .collect(Collectors.toList());

        // Count items from other retailers
        List<OrderItem> otherItems = order.getItems().stream()
            .filter(item -> !item.getRetailerId().equals(retailerId))
            .collect(Collectors.toList());

        this.otherRetailerItemsCount = otherItems.size();

        // Get unique retailers in other items
        this.otherRetailers = otherItems.stream()
            .map(OrderItem::getRetailerId)
            .distinct()
            .map(rid -> new OtherRetailerDTO(
                rid,
                getRetailerName(rid),
                (int) otherItems.stream()
                    .filter(item -> item.getRetailerId().equals(rid))
                    .count()
            ))
            .collect(Collectors.toList());

        // Determine available actions
        this.actions = getRetailerActions(order.getStatus());
    }

    private List<ActionDTO> getRetailerActions(OrderStatus status) {
        List<ActionDTO> actions = new ArrayList<>();

        if (status == OrderStatus.PLACED || status == OrderStatus.CONFIRMED) {
            actions.add(new ActionDTO(
                "CONFIRM_FULFILLMENT",
                "I can fulfill this order",
                true
            ));
            actions.add(new ActionDTO(
                "REQUEST_ADJUSTMENT",
                "Request quantity adjustment",
                true
            ));
            actions.add(new ActionDTO(
                "REJECT_ORDER",
                "Cannot fulfill",
                true
            ));
        }

        return actions;
    }

    private String getRetailerName(Long retailerId) {
        // TODO: Lookup retailer name from cache or database
        return "Retailer #" + retailerId;
    }

    // Getters...
}

public class RetailerOrderItemDTO {
    private Long itemId;
    private Long productId;
    private String productName;
    private Integer quantity;
    private String unit;
    private BigDecimal pricePerUnit;
    private BigDecimal itemTotal;
    private String farmerName;
    private LocalDateTime addedDate;

    public RetailerOrderItemDTO(OrderItem item) {
        this.itemId = item.getId();
        this.productId = item.getProduct().getId();
        this.productName = item.getProduct().getName();
        this.quantity = item.getQuantity();
        this.unit = item.getProduct().getUnit(); // kg, units, etc.
        this.pricePerUnit = item.getPriceAtPurchase();
        this.itemTotal = item.getLineTotal();
        this.farmerName = item.getProduct().getFarmerName(); // or lookup farmer
        this.addedDate = item.getCreatedAt();
    }
}

public class OtherRetailerDTO {
    private Long retailerId;
    private String retailerName;
    private Integer itemCount;

    public OtherRetailerDTO(Long retailerId, String name, Integer count) {
        this.retailerId = retailerId;
        this.retailerName = name;
        this.itemCount = count;
    }
}

public class ActionDTO {
    private String action;
    private String label;
    private Boolean enabled;

    public ActionDTO(String action, String label, Boolean enabled) {
        this.action = action;
        this.label = label;
        this.enabled = enabled;
    }
}
```

---

## Endpoint: GET /api/orders/distributor

**Distributors see:** Orders assigned to them with status = PACKED, SHIPPED, or DELIVERED

### Request

```http
GET /api/orders/distributor?status=PACKED HTTP/1.1
Host: localhost:8080
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Accept: application/json
```

**Query Parameters:**

- `status=PACKED` - Only orders ready to ship (default: all)
- `status=SHIPPED` - Only orders already shipped
- `status=ALL` - All assigned orders (all statuses)

### Response (200 OK)

```json
{
  "status": "success",
  "message": "Retrieved 3 assigned orders",
  "count": 3,
  "data": [
    {
      "orderId": 12345,
      "customerId": 99,
      "customerName": "John Doe",
      "customerPhone": "+1-555-0123",
      "customerCity": "Springfield",
      "customerAddress": "123 Main St, Springfield, IL 62701",
      "orderStatus": "PACKED",
      "orderTotal": 250.0,
      "itemCount": 2,
      "totalWeight": "5.2 kg",
      "totalVolume": "0.08 m³",
      "items": [
        {
          "productId": 1,
          "productName": "Tomato",
          "quantity": 2,
          "unit": "kg",
          "retailerName": "Fresh Market",
          "farmerName": "Farm Fresh Co."
        },
        {
          "productId": 5,
          "productName": "Onion",
          "quantity": 1,
          "unit": "kg",
          "retailerName": "Organic Store",
          "farmerName": "Mountain Valley Farms"
        }
      ],
      "packingDate": "2026-02-01T10:30:00",
      "expectedDeliveryDate": "2026-02-04",
      "trackingNumber": "DIST-20260201-00123",
      "shippingMethod": "Express",
      "estimatedCost": 25.0,
      "actions": [
        {
          "action": "MARK_SHIPPED",
          "label": "Mark as shipped",
          "enabled": true
        },
        {
          "action": "REQUEST_EXTENSION",
          "label": "Request delivery extension",
          "enabled": true
        },
        {
          "action": "REPORT_ISSUE",
          "label": "Report problem",
          "enabled": true
        }
      ]
    },
    {
      "orderId": 12346,
      "customerId": 100,
      "customerName": "Jane Smith",
      "customerPhone": "+1-555-0456",
      "customerCity": "Shelbyville",
      "customerAddress": "456 Oak Ave, Shelbyville, IL 62702",
      "orderStatus": "PACKED",
      "orderTotal": 180.0,
      "itemCount": 1,
      "totalWeight": "3.0 kg",
      "totalVolume": "0.04 m³",
      "items": [
        {
          "productId": 3,
          "productName": "Carrot",
          "quantity": 3,
          "unit": "kg",
          "retailerName": "Fresh Market",
          "farmerName": "Countryside Produce"
        }
      ],
      "packingDate": "2026-02-01T11:00:00",
      "expectedDeliveryDate": "2026-02-04",
      "trackingNumber": "DIST-20260201-00124",
      "shippingMethod": "Standard",
      "estimatedCost": 15.0,
      "actions": [
        {
          "action": "MARK_SHIPPED",
          "label": "Mark as shipped",
          "enabled": true
        }
      ]
    }
  ],
  "summary": {
    "totalAssigned": 20,
    "readyToShip": 3,
    "inTransit": 5,
    "delivered": 12,
    "totalItemsToShip": 3,
    "totalWeightToShip": "8.2 kg",
    "estimatedRevenueToday": 40.0
  }
}
```

### Error Responses

**403 Forbidden - Not a Distributor:**

```json
{
  "status": "error",
  "message": "Only distributors can access this endpoint",
  "code": "FORBIDDEN",
  "timestamp": "2026-02-01T10:35:00"
}
```

### Implementation

```java
@GetMapping("/distributor")
public ResponseEntity<?> getDistributorOrders(
        @RequestHeader(value = "Authorization", required = false) String authHeader,
        @RequestParam(value = "status", defaultValue = "ALL") String statusFilter) {

    try {
        System.out.println("[OrderController] GET /api/orders/distributor?status=" +
            statusFilter);

        // ✅ SECURITY: Validate JWT
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .body(new ApiErrorResponse("error", "Missing Authorization header",
                    "UNAUTHORIZED"));
        }

        String token = authHeader.substring(7);
        String email = jwtUtil.extractEmail(token);
        String role = jwtUtil.extractRole(token);

        // ✅ SECURITY: Validate role
        if (role == null || !"distributor".equalsIgnoreCase(role)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(new ApiErrorResponse("error",
                    "Only distributors can access this endpoint", "FORBIDDEN"));
        }

        // ✅ SECURITY: Load distributor from database
        User distributor = userRepository.findByEmail(email)
            .orElseThrow(() -> new UserNotFoundException(
                "Distributor not found: " + email));

        System.out.println("[OrderController] Distributor ID: " + distributor.getId());

        // ✅ Query: Based on status filter
        List<Order> orders;

        if ("PACKED".equalsIgnoreCase(statusFilter)) {
            // Only orders ready to ship
            orders = orderRepository.findReadyToShipOrders(distributor.getId());
            System.out.println("[OrderController] Found " + orders.size() +
                " PACKED orders");

        } else if ("SHIPPED".equalsIgnoreCase(statusFilter)) {
            // Only already shipped
            orders = orderRepository.findShippedOrdersByDistributor(distributor.getId());
            System.out.println("[OrderController] Found " + orders.size() +
                " SHIPPED orders");

        } else {
            // All assigned orders (default)
            orders = orderRepository.findOrdersByDistributor(distributor.getId());
            System.out.println("[OrderController] Found " + orders.size() +
                " total assigned orders");
        }

        // ✅ Transform to distributor-specific DTOs
        List<DistributorOrderDTO> distributorOrders = orders.stream()
            .map(order -> new DistributorOrderDTO(order, distributor.getId()))
            .collect(Collectors.toList());

        // ✅ Calculate summary statistics
        List<Order> allOrders = orderRepository.findOrdersByDistributor(
            distributor.getId());

        long readyToShip = allOrders.stream()
            .filter(o -> o.getStatus() == OrderStatus.PACKED)
            .count();

        long inTransit = allOrders.stream()
            .filter(o -> o.getStatus() == OrderStatus.SHIPPED)
            .count();

        long delivered = allOrders.stream()
            .filter(o -> o.getStatus() == OrderStatus.DELIVERED)
            .count();

        Map<String, Object> response = new HashMap<>();
        response.put("status", "success");
        response.put("message", "Retrieved " + distributorOrders.size() +
            " assigned orders");
        response.put("count", distributorOrders.size());
        response.put("data", distributorOrders);

        Map<String, Object> summary = new HashMap<>();
        summary.put("totalAssigned", allOrders.size());
        summary.put("readyToShip", readyToShip);
        summary.put("inTransit", inTransit);
        summary.put("delivered", delivered);

        BigDecimal totalWeight = distributorOrders.stream()
            .map(DistributorOrderDTO::getTotalWeightKg)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        summary.put("totalItemsToShip", distributorOrders.size());
        summary.put("totalWeightToShip", totalWeight + " kg");

        BigDecimal totalCost = distributorOrders.stream()
            .map(DistributorOrderDTO::getEstimatedCost)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
        summary.put("estimatedRevenueToday", totalCost);

        response.put("summary", summary);

        return ResponseEntity.ok(response);

    } catch (UserNotFoundException ex) {
        System.err.println("[OrderController] Error: " + ex.getMessage());
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(new ApiErrorResponse("error", ex.getMessage(), "USER_NOT_FOUND"));

    } catch (Exception ex) {
        System.err.println("[OrderController] Unexpected error: " +
            ex.getMessage());
        ex.printStackTrace();
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(new ApiErrorResponse("error", "Internal server error",
                "SERVER_ERROR"));
    }
}

/**
 * ✅ DTO: DistributorOrderDTO
 *
 * What distributor sees for each order:
 * - Customer details (delivery address, phone)
 * - All items in order (all products)
 * - Logistics info (weight, volume, tracking)
 * - Status timeline (packing → shipping → delivery)
 * - Available actions (mark shipped, report issue)
 */
public class DistributorOrderDTO {
    private Long orderId;
    private Long customerId;
    private String customerName;
    private String customerPhone;
    private String customerCity;
    private String customerAddress;
    private String orderStatus;
    private BigDecimal orderTotal;
    private Integer itemCount;
    private BigDecimal totalWeight;
    private String totalVolume;
    private List<DistributorOrderItemDTO> items;
    private LocalDateTime packingDate;
    private LocalDate expectedDeliveryDate;
    private String trackingNumber;
    private String shippingMethod;
    private BigDecimal estimatedCost;
    private List<ActionDTO> actions;

    public DistributorOrderDTO(Order order, Long distributorId) {
        this.orderId = order.getId();
        this.customerId = order.getCustomer().getId();
        this.customerName = order.getCustomer().getFullName();
        this.customerPhone = order.getCustomer().getPhoneNumber();
        this.customerCity = order.getCustomer().getCity();
        this.customerAddress = order.getCustomer().getAddress();
        this.orderStatus = order.getStatus().toString();
        this.orderTotal = order.getTotalAmount();
        this.itemCount = order.getItems().size();
        this.packingDate = order.getUpdatedAt();

        // Calculate weight and volume from items
        this.totalWeight = calculateWeight(order);
        this.totalVolume = calculateVolume(order);

        // Transform items
        this.items = order.getItems().stream()
            .map(DistributorOrderItemDTO::new)
            .collect(Collectors.toList());

        // Generate tracking number
        this.trackingNumber = generateTrackingNumber(order, distributorId);

        // Set expected delivery (3 days from packing)
        this.expectedDeliveryDate = LocalDate.from(
            order.getUpdatedAt().plusDays(3));

        // Set shipping method (could be based on weight/distance)
        this.shippingMethod = order.getTotalAmount().compareTo(
            BigDecimal.valueOf(200)) > 0 ? "Express" : "Standard";

        // Estimate shipping cost
        this.estimatedCost = calculateShippingCost(this.totalWeight,
            this.shippingMethod);

        // Determine actions
        this.actions = getDistributorActions(order.getStatus());
    }

    private BigDecimal calculateWeight(Order order) {
        // TODO: Sum weights from products
        // For now, estimate based on quantity
        return BigDecimal.valueOf(order.getItems().stream()
            .mapToInt(OrderItem::getQuantity)
            .sum() / 2.0);
    }

    private String calculateVolume(Order order) {
        // TODO: Calculate volume from products
        return String.format("%.2f m³", order.getItems().size() * 0.02);
    }

    private String generateTrackingNumber(Order order, Long distributorId) {
        return "DIST-" +
            order.getUpdatedAt().format(
                DateTimeFormatter.ofPattern("yyyyMMdd")) +
            "-" + String.format("%05d",
                (int)(distributorId * 1000 + (order.getId() % 1000)));
    }

    private BigDecimal calculateShippingCost(BigDecimal weight,
            String method) {
        BigDecimal baseCost = weight.multiply(BigDecimal.valueOf(3.5));
        if ("Express".equals(method)) {
            baseCost = baseCost.multiply(BigDecimal.valueOf(1.5));
        }
        return baseCost;
    }

    private List<ActionDTO> getDistributorActions(OrderStatus status) {
        List<ActionDTO> actions = new ArrayList<>();

        if (status == OrderStatus.PACKED) {
            actions.add(new ActionDTO("MARK_SHIPPED",
                "Mark as shipped", true));
            actions.add(new ActionDTO("REQUEST_EXTENSION",
                "Request delivery extension", true));
            actions.add(new ActionDTO("REPORT_ISSUE",
                "Report problem", true));
        } else if (status == OrderStatus.SHIPPED) {
            actions.add(new ActionDTO("MARK_DELIVERED",
                "Mark as delivered", true));
            actions.add(new ActionDTO("REPORT_DELAY",
                "Report delivery delay", true));
        }

        return actions;
    }

    // Getters...
    public BigDecimal getTotalWeightKg() {
        return this.totalWeight;
    }
}

public class DistributorOrderItemDTO {
    private Long productId;
    private String productName;
    private Integer quantity;
    private String unit;
    private String retailerName;
    private String farmerName;

    public DistributorOrderItemDTO(OrderItem item) {
        this.productId = item.getProduct().getId();
        this.productName = item.getProduct().getName();
        this.quantity = item.getQuantity();
        this.unit = item.getProduct().getUnit();
        this.retailerName = item.getProduct().getRetailerName(); // lookup
        this.farmerName = item.getProduct().getFarmerName(); // lookup
    }
}
```

---

## Testing with curl

### Test Retailer Endpoint

```bash
# Get retailer's pending orders
curl -X GET http://localhost:8080/api/orders/retailer \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -v
```

### Test Distributor Endpoint

```bash
# Get all assigned orders
curl -X GET http://localhost:8080/api/orders/distributor \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -v

# Get only PACKED orders (ready to ship)
curl -X GET "http://localhost:8080/api/orders/distributor?status=PACKED" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -v

# Get only SHIPPED orders
curl -X GET "http://localhost:8080/api/orders/distributor?status=SHIPPED" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -v
```

---

## Response DTOs

### ApiErrorResponse

```java
public class ApiErrorResponse {
    private String status;
    private String message;
    private String code;
    private LocalDateTime timestamp;

    public ApiErrorResponse(String status, String message, String code) {
        this.status = status;
        this.message = message;
        this.code = code;
        this.timestamp = LocalDateTime.now();
    }
}
```

### UserNotFoundException

```java
public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String message) {
        super(message);
    }
}
```

---

## Integration with Frontend

### React: Retailer Order List

```javascript
// RetailerDashboard.js
import React, { useState, useEffect } from "react";

export function RetailerDashboard() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRetailerOrders();
  }, []);

  const fetchRetailerOrders = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch("/api/orders/retailer", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch orders");
      }

      const data = await response.json();
      setOrders(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="retailer-dashboard">
      <h2>Pending Orders ({orders.length})</h2>
      {orders.map((order) => (
        <div key={order.orderId} className="order-card">
          <h3>Order #{order.orderId}</h3>
          <p>Customer: {order.customerName}</p>
          <p>Status: {order.orderStatus}</p>
          <p>Items to fulfill: {order.myItems.length}</p>
          <div className="actions">
            {order.actions.map((action) => (
              <button
                key={action.action}
                disabled={!action.enabled}
                onClick={() => handleAction(action.action, order.orderId)}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

### React: Distributor Order List

```javascript
// DistributorDashboard.js
import React, { useState, useEffect } from "react";

export function DistributorDashboard() {
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("PACKED");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDistributorOrders();
  }, [statusFilter]);

  const fetchDistributorOrders = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/orders/distributor?status=${statusFilter}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = await response.json();
      setOrders(data.data);
    } catch (err) {
      console.error("Failed to fetch orders:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="distributor-dashboard">
      <div className="filters">
        <button
          onClick={() => setStatusFilter("PACKED")}
          className={statusFilter === "PACKED" ? "active" : ""}
        >
          Ready to Ship ({orders.length})
        </button>
        <button
          onClick={() => setStatusFilter("SHIPPED")}
          className={statusFilter === "SHIPPED" ? "active" : ""}
        >
          In Transit
        </button>
        <button
          onClick={() => setStatusFilter("ALL")}
          className={statusFilter === "ALL" ? "active" : ""}
        >
          All Orders
        </button>
      </div>

      {orders.map((order) => (
        <div key={order.orderId} className="shipment-card">
          <h3>Tracking: {order.trackingNumber}</h3>
          <p>Deliver to: {order.customerName}</p>
          <p>{order.customerAddress}</p>
          <p>Weight: {order.totalWeight}kg</p>
          <p>Expected: {order.expectedDeliveryDate}</p>
        </div>
      ))}
    </div>
  );
}
```

---

## Summary

| Feature               | Retailer                  | Distributor                         |
| --------------------- | ------------------------- | ----------------------------------- |
| **Visibility Filter** | `order_items.retailer_id` | `order.distributor_id` + status     |
| **Status Visibility** | PLACED, CONFIRMED         | PACKED, SHIPPED, DELIVERED          |
| **Items Shown**       | Only retailer's items     | All items in order                  |
| **Customer Info**     | Name, email               | Name, phone, address                |
| **Actions**           | Confirm, Reject, Adjust   | Mark Shipped, Deliver, Report       |
| **Tracking**          | Order ID                  | Tracking Number                     |
| **Performance**       | Indexed by retailer_id    | Indexed by (distributor_id, status) |
