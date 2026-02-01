# Frontend Integration - Replace localStorage Checkout

## Current Implementation (BROKEN ❌)

**File**: `src/pages/CustomerDashboard.js` (current checkout)

```javascript
const handleCheckout = () => {
  if (cart.length === 0) return;
  alert("Order placed successfully! 🎉"); // ❌ NO DATABASE CALL
  setCart([]); // ❌ DATA DISCARDED
};
```

**Problem:**

- Order only in React state
- Discarded on page refresh
- Retailer/Distributor never see it
- No transaction guarantees

---

## Fixed Implementation (CORRECT ✅)

### Option 1: Update Existing CustomerDashboard.js

**Replace** the `handleCheckout` function with this:

```javascript
// Add this state
const [checkoutLoading, setCheckoutLoading] = useState(false);
const [checkoutError, setCheckoutError] = useState(null);

// Replace handleCheckout
const handleCheckout = async () => {
  if (cart.length === 0) {
    alert("Cart is empty!");
    return;
  }

  setCheckoutLoading(true);
  setCheckoutError(null);

  try {
    // ✅ Call backend checkout endpoint
    const response = await axiosInstance.post("/api/orders", {
      items: cart.map((item) => ({
        productId: item.id,
        quantity: item.quantity,
      })),
    });

    const order = response.data;

    // ✅ Show success with order details
    alert(
      `✅ Order #${order.id} placed successfully!\n\n` +
        `Total: ₹${Math.round(order.totalAmount * 83)}\n` +
        `Status: ${order.status}\n\n` +
        `Your fresh produce will be delivered soon!\n` +
        `Track your order from farm to door.`,
    );

    // ✅ Clear cart after successful order
    setCart([]);

    // ✅ Optional: Redirect to order tracking
    // navigate(`/orders/${order.id}`);
  } catch (error) {
    console.error("Checkout failed:", error);

    // Extract error message from response
    const errorMsg =
      error.response?.data?.message ||
      error.message ||
      "Checkout failed. Please try again.";

    setCheckoutError(errorMsg);
    alert(`❌ Checkout failed: ${errorMsg}`);
  } finally {
    setCheckoutLoading(false);
  }
};

// Update the checkout button (find in your JSX)
// Replace:
// <button onClick={handleCheckout} ...>Checkout</button>

// With:
<button
  onClick={handleCheckout}
  disabled={checkoutLoading || cart.length === 0}
  className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 rounded-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
>
  {checkoutLoading ? (
    <>
      <span className="inline-block animate-spin mr-2">⏳</span>
      Processing...
    </>
  ) : (
    `Checkout (${formatINR(cartTotalINR)})`
  )}
</button>;

// Optional: Show error banner
{
  checkoutError && (
    <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
      <p className="text-red-800 font-semibold">Checkout Error</p>
      <p className="text-red-700 text-sm mt-1">{checkoutError}</p>
    </div>
  );
}
```

---

### Option 2: Create New Order Tracking Page

**File**: `src/pages/OrderTrackingPage.js`

```javascript
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { Clock, CheckCircle, Truck, Package, AlertCircle } from "lucide-react";
import axiosInstance from "../api/axiosInstance";

const OrderTrackingPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ Fetch order from backend
  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const response = await axiosInstance.get(`/api/orders/${orderId}`);
        setOrder(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();

    // ✅ Refresh every 10 seconds
    const interval = setInterval(fetchOrder, 10000);
    return () => clearInterval(interval);
  }, [orderId]);

  if (loading) {
    return (
      <div
        className={`min-h-screen ${isDark ? "bg-slate-900" : "bg-white"} flex items-center justify-center`}
      >
        <p className={isDark ? "text-white" : "text-gray-900"}>
          Loading order...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`min-h-screen ${isDark ? "bg-slate-900" : "bg-white"} flex items-center justify-center`}
      >
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <p className="text-red-800 font-semibold">Order not found</p>
          <p className="text-red-700 text-sm mt-2">{error}</p>
          <button
            onClick={() => navigate("/orders/customer")}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  // ✅ Status timeline
  const statusSteps = [
    { status: "PLACED", icon: Package, label: "Order Placed" },
    { status: "CONFIRMED", icon: CheckCircle, label: "Confirmed" },
    { status: "SHIPPED", icon: Truck, label: "Shipped" },
    { status: "DELIVERED", icon: CheckCircle, label: "Delivered" },
  ];

  const currentStepIndex = statusSteps.findIndex(
    (step) => step.status === order.status,
  );

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"
          : "bg-gradient-to-br from-emerald-50 via-white to-green-50"
      }`}
    >
      {/* Header */}
      <header
        className={`backdrop-blur-xl border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
      >
        <div className="max-w-4xl mx-auto px-6 py-6">
          <h1
            className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          >
            Order #{order.id}
          </h1>
          <p className={isDark ? "text-slate-400" : "text-gray-600"}>
            Placed on {new Date(order.createdAt).toLocaleDateString()}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {/* Status Timeline */}
        <div
          className={`backdrop-blur-xl border rounded-2xl p-8 mb-8 ${
            isDark
              ? "bg-slate-800/50 border-slate-700"
              : "bg-white/80 border-gray-200"
          }`}
        >
          <h2
            className={`text-xl font-bold mb-6 ${isDark ? "text-white" : "text-gray-900"}`}
          >
            Order Status
          </h2>

          <div className="space-y-4">
            {statusSteps.map((step, index) => {
              const isActive = index <= currentStepIndex;
              const IconComponent = step.icon;

              return (
                <div key={step.status} className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center transition ${
                      isActive
                        ? "bg-emerald-500 text-white"
                        : isDark
                          ? "bg-slate-700 text-slate-500"
                          : "bg-gray-200 text-gray-400"
                    }`}
                  >
                    <IconComponent size={24} />
                  </div>

                  <div className="flex-1">
                    <p
                      className={`font-semibold ${
                        isActive
                          ? isDark
                            ? "text-white"
                            : "text-gray-900"
                          : isDark
                            ? "text-slate-500"
                            : "text-gray-500"
                      }`}
                    >
                      {step.label}
                    </p>
                    <p
                      className={`text-sm ${
                        isActive
                          ? isDark
                            ? "text-slate-300"
                            : "text-gray-700"
                          : isDark
                            ? "text-slate-600"
                            : "text-gray-400"
                      }`}
                    >
                      {step.status}
                    </p>
                  </div>

                  {index < statusSteps.length - 1 && (
                    <div
                      className={`w-0.5 h-16 ${
                        isActive
                          ? "bg-emerald-500"
                          : isDark
                            ? "bg-slate-700"
                            : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Details */}
        <div
          className={`backdrop-blur-xl border rounded-2xl p-8 ${
            isDark
              ? "bg-slate-800/50 border-slate-700"
              : "bg-white/80 border-gray-200"
          }`}
        >
          <h2
            className={`text-xl font-bold mb-6 ${isDark ? "text-white" : "text-gray-900"}`}
          >
            Order Items
          </h2>

          <div className="space-y-4">
            {order.items.map((item) => (
              <div
                key={item.id}
                className={`flex justify-between items-center p-4 rounded-lg ${
                  isDark ? "bg-slate-700/50" : "bg-gray-50"
                }`}
              >
                <div>
                  <p
                    className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
                  >
                    {item.productName}
                  </p>
                  <p
                    className={`text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}
                  >
                    Quantity: {item.quantity} kg
                  </p>
                </div>

                <div className="text-right">
                  <p
                    className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
                  >
                    ₹{Math.round(item.lineTotal * 83)}
                  </p>
                  <p
                    className={`text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}
                  >
                    @ ₹{Math.round(item.priceAtPurchase * 83)}/kg
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Order Total */}
          <div
            className={`mt-6 pt-6 border-t ${isDark ? "border-slate-700" : "border-gray-200"}`}
          >
            <div className="flex justify-between items-center">
              <p
                className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
              >
                Total
              </p>
              <p className="text-2xl font-bold text-emerald-600">
                ₹{Math.round(order.totalAmount * 83)}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 space-y-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold transition"
          >
            Continue Shopping
          </button>

          <button
            onClick={() => navigate("/orders/customer")}
            className={`w-full px-6 py-3 rounded-lg font-semibold transition ${
              isDark
                ? "bg-slate-700 hover:bg-slate-600 text-white"
                : "bg-gray-200 hover:bg-gray-300 text-gray-900"
            }`}
          >
            View All Orders
          </button>
        </div>
      </main>
    </div>
  );
};

export default OrderTrackingPage;
```

---

### Update React Router

**File**: `src/App.js`

```javascript
import OrderTrackingPage from "./pages/OrderTrackingPage";

// Add to router:
<Route path="/orders/:orderId" element={<OrderTrackingPage />} />;
```

---

### Update Customer Orders List Page

**File**: `src/pages/CustomerOrdersPage.js` (create new)

```javascript
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import { Package, Truck, CheckCircle } from "lucide-react";
import axiosInstance from "../api/axiosInstance";

const CustomerOrdersPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ Fetch customer's orders from backend
  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await axiosInstance.get("/api/orders/customer");
        setOrders(response.data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();

    // ✅ Refresh every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case "PLACED":
        return <Package className="text-yellow-500" size={20} />;
      case "CONFIRMED":
        return <CheckCircle className="text-blue-500" size={20} />;
      case "SHIPPED":
        return <Truck className="text-purple-500" size={20} />;
      case "DELIVERED":
        return <CheckCircle className="text-green-500" size={20} />;
      default:
        return <Package size={20} />;
    }
  };

  return (
    <div
      className={`min-h-screen ${
        isDark
          ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"
          : "bg-gradient-to-br from-emerald-50 via-white to-green-50"
      }`}
    >
      {/* Header */}
      <header
        className={`backdrop-blur-xl border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
      >
        <div className="max-w-6xl mx-auto px-6 py-6">
          <h1
            className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          >
            My Orders
          </h1>
          <p className={isDark ? "text-slate-400" : "text-gray-600"}>
            Track your orders from farm to door
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-12">
        {loading ? (
          <p className={isDark ? "text-slate-400" : "text-gray-600"}>
            Loading orders...
          </p>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-semibold">Error: {error}</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12">
            <Package
              size={48}
              className={`mx-auto mb-4 ${isDark ? "text-slate-600" : "text-gray-300"}`}
            />
            <p className={isDark ? "text-slate-400" : "text-gray-600"}>
              No orders yet. Start shopping!
            </p>
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-6 px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Continue Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order.id}
                onClick={() => navigate(`/orders/${order.id}`)}
                className={`backdrop-blur-xl border rounded-lg p-6 cursor-pointer hover:shadow-lg transition ${
                  isDark
                    ? "bg-slate-800/50 border-slate-700"
                    : "bg-white/80 border-gray-200"
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3
                      className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
                    >
                      Order #{order.id}
                    </h3>
                    <p
                      className={`text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}
                    >
                      {new Date(order.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusIcon(order.status)}
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        order.status === "DELIVERED"
                          ? "bg-green-100 text-green-800"
                          : order.status === "SHIPPED"
                            ? "bg-purple-100 text-purple-800"
                            : order.status === "CONFIRMED"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p
                      className={`text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}
                    >
                      Items
                    </p>
                    <p
                      className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}
                    >
                      {order.items.length}
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`text-sm ${isDark ? "text-slate-400" : "text-gray-600"}`}
                    >
                      Total
                    </p>
                    <p className="text-lg font-semibold text-emerald-600">
                      ₹{Math.round(order.totalAmount * 83)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default CustomerOrdersPage;
```

---

## Testing the Integration

### Test 1: Successful Checkout

```javascript
// In browser console
const items = [
  { productId: 1, quantity: 2 },
  { productId: 3, quantity: 1 },
];

fetch("http://localhost:8080/api/orders", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ items }),
})
  .then((r) => r.json())
  .then((order) => console.log("Order created:", order))
  .catch((e) => console.error("Error:", e));
```

### Test 2: Verify Order in Database

```sql
SELECT * FROM orders WHERE customer_id = ?;
SELECT * FROM order_items WHERE order_id = ?;
```

### Test 3: Verify Retailer Sees Order

```javascript
// Login as retailer, call:
fetch("http://localhost:8080/api/orders/retailer", {
  headers: {
    Authorization: `Bearer ${retailerToken}`,
  },
})
  .then((r) => r.json())
  .then((orders) => console.log("Retailer orders:", orders));
```

---

## Next Steps

1. ✅ Backend code deployed
2. ✅ Database migrations run
3. ✅ Update CustomerDashboard.js checkout
4. ✅ Create OrderTrackingPage.js
5. ✅ Create CustomerOrdersPage.js
6. ✅ Update React Router
7. ✅ Test checkout flow
8. ✅ Verify orders appear in retailer/farmer dashboards
9. ✅ Deploy to production

Done! Orders now go to database instead of localStorage. 🚀
