# Checkout API - Quick Reference

## Files Created

```
✅ Order.java                    (Entity with state machine)
✅ OrderItem.java                (Line item with price snapshot)
✅ OrderRepository.java          (Role-based queries)
✅ OrderItemRepository.java      (Item queries)
✅ OrderService.java             (Transactional checkout logic)
✅ OrderController.java          (REST endpoints)
```

## Step 1: Run SQL Migration

```sql
CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    customer_id BIGINT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status ENUM('PLACED','CONFIRMED','SHIPPED','DELIVERED','CANCELLED') DEFAULT 'PLACED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_customer_id (customer_id)
);

CREATE TABLE order_items (
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
    FOREIGN KEY (retailer_id) REFERENCES users(id) ON DELETE RESTRICT
);
```

## Step 2: Ensure Products Table Has

- `price` DECIMAL(10, 2)
- `quantity` INT
- `farmer_id` BIGINT
- `retailer_id` BIGINT

## Step 3: Rebuild & Test

```bash
# Build
mvn clean package

# Run
mvn spring-boot:run

# Test checkout
curl -X POST http://localhost:8080/api/orders \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [{"productId": 1, "quantity": 2}]
  }'
```

## Core Endpoints

| Method | Endpoint                 | Role        | Purpose           |
| ------ | ------------------------ | ----------- | ----------------- |
| POST   | /api/orders              | customer    | Checkout          |
| GET    | /api/orders/customer     | customer    | My orders         |
| GET    | /api/orders/retailer     | retailer    | Orders to fulfill |
| GET    | /api/orders/farmer       | farmer      | My product orders |
| GET    | /api/orders/{id}         | any         | Order details     |
| PUT    | /api/orders/{id}/confirm | retailer    | Confirm order     |
| PUT    | /api/orders/{id}/ship    | distributor | Ship order        |
| PUT    | /api/orders/{id}/deliver | distributor | Deliver order     |
| PUT    | /api/orders/{id}/cancel  | customer    | Cancel order      |

## Key Features

✅ **Transactional**: All or nothing - if anything fails, entire order rolled back  
✅ **Secure**: Customer ID from JWT, not frontend  
✅ **Validated**: Stock check, price validation, product existence  
✅ **Traceable**: farmer_id, retailer_id stored in order_items  
✅ **Price Locked**: priceAtPurchase immutable for audit trail  
✅ **Inventory Managed**: Stock decremented on order, restored on cancel  
✅ **State Machine**: PLACED → CONFIRMED → SHIPPED → DELIVERED/CANCELLED

## Order Lifecycle

```
PLACED (Customer creates)
  ↓
CONFIRMED (Retailer approves)
  ↓
SHIPPED (Distributor leaves)
  ↓
DELIVERED (Customer receives)

OR at any point:
  → CANCELLED (Restores inventory)
```

## Checkout Validation

1. ✅ JWT valid & role = customer
2. ✅ Cart not empty, not too large
3. ✅ Each product exists
4. ✅ Product has farmer_id & retailer_id
5. ✅ Product has price > 0
6. ✅ Product has enough stock
7. ✅ Create order & items
8. ✅ Decrement inventory
9. ✅ Return order ID

## Response Format

### Success (201 CREATED)

```json
{
  "id": 12345,
  "customerId": 99,
  "totalAmount": 250.0,
  "status": "PLACED",
  "items": [
    {
      "id": 1,
      "productId": 1,
      "productName": "Tomato",
      "quantity": 2,
      "priceAtPurchase": 100.0,
      "farmerId": 10,
      "retailerId": 20
    }
  ],
  "createdAt": "2026-02-01T10:30:00"
}
```

### Error (400/401/403/500)

```json
{
  "message": "Insufficient stock for Tomato",
  "timestamp": "2026-02-01T10:30:00"
}
```

## Example: Customer Checkout Flow

```javascript
// Frontend
const checkout = async (cartItems) => {
  const response = await fetch("http://localhost:8080/api/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwtToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      items: cartItems.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
    }),
  });

  const order = await response.json();
  console.log("Order created:", order.id);
  return order;
};
```

## Permissions Matrix

| Endpoint      | Customer | Retailer | Farmer | Distributor |
| ------------- | -------- | -------- | ------ | ----------- |
| POST /orders  | ✅       | ❌       | ❌     | ❌          |
| GET /customer | ✅       | ❌       | ❌     | ❌          |
| GET /retailer | ❌       | ✅       | ❌     | ❌          |
| GET /farmer   | ❌       | ❌       | ✅     | ❌          |
| PUT /confirm  | ❌       | ✅       | ❌     | ❌          |
| PUT /ship     | ❌       | ❌       | ❌     | ✅          |
| PUT /deliver  | ❌       | ❌       | ❌     | ✅          |
| PUT /cancel   | ✅       | ❌       | ❌     | ❌          |

## Error Codes

| Code | Meaning                  | Solution                    |
| ---- | ------------------------ | --------------------------- |
| 201  | Order created ✅         | —                           |
| 400  | Bad request (validation) | Check cart, quantities, etc |
| 401  | Invalid/missing JWT      | Provide valid token         |
| 403  | Wrong role               | Use correct user role       |
| 404  | Not found                | Check product ID exists     |
| 500  | Server error             | Check logs, database        |

## Troubleshooting

**"Product not found"**

- Verify product exists: `SELECT * FROM products WHERE id = ?`
- Check product ID in request

**"Insufficient stock"**

- Check inventory: `SELECT quantity FROM products WHERE id = ?`
- Request qty <= available qty

**"Missing farmer_id"**

- Ensure all products have farmer_id set
- `UPDATE products SET farmer_id = 1 WHERE farmer_id IS NULL`

**"JWT extraction failed"**

- Token expired? Generate new one
- Invalid format? Check "Bearer " prefix

**Inventory not decremented**

- Check transaction committed
- Look for rollback in logs
- Verify product_id in order_items matches

---

**Done? Update frontend to call POST /api/orders instead of localStorage!** 🚀
