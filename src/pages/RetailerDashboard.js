import React, { useState, useEffect } from "react";
import { useTheme } from "../context/ThemeContext";
import {
  ShoppingCart,
  Truck,
  AlertCircle,
  Plus,
  BarChart3,
} from "lucide-react";
import { getRetailerInventory, getAllProducts } from "./api";
import "../styles/RetailerDashboard.css";

const RetailerDashboard = () => {
  const { isDark } = useTheme();

  // ✅ State for products from backend
  const [availableProducts, setAvailableProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retailerInfo, setRetailerInfo] = useState(null);

  const [cart, setCart] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("inventory");
  const [addedProductId, setAddedProductId] = useState(null);

  // ✅ Fetch retailer inventory and all products
  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError(null);
      try {
        // Get retailer's assigned products
        const retailerData = await getRetailerInventory();
        setRetailerInfo({
          id: retailerData.retailerId,
          name: retailerData.retailerName,
        });

        // Map backend products to display format
        const mappedProducts = retailerData.products.map((product) => ({
          id: product.id,
          name: product.cropType,
          price: 2.5, // Backend doesn't have price yet, using default
          supplier: `Farmer ID: ${product.farmerId}`,
          stock: 100, // Default stock
          image: "📦", // Default product icon
          ...product, // Include all backend fields
        }));

        setAvailableProducts(mappedProducts);
      } catch (err) {
        console.error("Failed to fetch products:", err);
        // Fallback to mock data if backend is unavailable
        setError(err.message);
        setAvailableProducts([
          {
            id: 1,
            name: "Organic Tomatoes",
            price: 2.5,
            supplier: "Green Fields Farm",
            stock: 120,
            image: "🍅",
          },
          {
            id: 2,
            name: "Bell Peppers",
            price: 3.0,
            supplier: "Sunshine Acres",
            stock: 85,
            image: "🫑",
          },
          {
            id: 3,
            name: "Carrots",
            price: 1.8,
            supplier: "Riverbend Farm",
            stock: 60,
            image: "🥕",
          },
          {
            id: 4,
            name: "Banana",
            price: 2.8,
            supplier: "Riverbend Farm",
            stock: 150,
            image: "🍌",
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Function to safely get orders from local storage
  const getOrdersFromStorage = (key) => {
    return JSON.parse(localStorage.getItem(key) || "[]");
  };

  useEffect(() => {
    const loadAllOrders = () => {
      setOrderHistory(getOrdersFromStorage("retailerOrders"));
      setCustomerOrders(getOrdersFromStorage("customerOrders"));
    };
    loadAllOrders();

    const handleStorageChange = () => {
      loadAllOrders();
    };
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  const addToCart = (product) => {
    const existingItem = cart.find((item) => item.id === product.id);
    if (existingItem) {
      setCart(
        cart.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
    setAddedProductId(product.id);
    setTimeout(() => setAddedProductId(null), 1500);
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter((item) => item.id !== productId));
  };

  const updateQuantity = (productId, newQuantity) => {
    if (newQuantity <= 0) {
      removeFromCart(productId);
    } else {
      setCart(
        cart.map((item) =>
          item.id === productId ? { ...item, quantity: newQuantity } : item
        )
      );
    }
  };

  const placeOrder = () => {
    if (cart.length === 0) {
      alert("Cart is empty!");
      return;
    }

    const newOrder = {
      id: Date.now(),
      items: cart.map(({ id, name, quantity }) => ({ id, name, quantity })),
      total: cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
      date: new Date().toLocaleDateString(),
      status: "Pending",
    };

    const updatedOrders = [...orderHistory, newOrder];
    localStorage.setItem("retailerOrders", JSON.stringify(updatedOrders));
    setOrderHistory(updatedOrders);
    setCart([]);
    alert("Order placed successfully!");
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // USD to INR conversion rate for retailer totals (env override supported)
  const usdToInrRate = Number(process.env.REACT_APP_USD_TO_INR_RATE) || 82;

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
          <div>
            {/* Removed emoji/icon to show plain heading text only */}
            <h1
              className={`text-3xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              Retailer Dashboard
            </h1>
            <p
              className={`mt-1 ${isDark ? "text-slate-300" : "text-gray-600"}`}
            >
              Manage inventory and orders from distributors
            </p>
          </div>
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
          {[
            { id: "inventory", label: "Inventory" },
            { id: "cart", label: "Cart", badge: cart.length },
            { id: "orders", label: "Orders", badge: orderHistory.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 font-semibold transition-all border-b-2 relative ${
                activeTab === tab.id
                  ? "text-emerald-600 border-emerald-600"
                  : isDark
                  ? "text-slate-400 border-transparent hover:text-slate-300"
                  : "text-gray-600 border-transparent hover:text-gray-900"
              }`}
            >
              {tab.label}
              {tab.badge > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Inventory Tab */}
        {activeTab === "inventory" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {availableProducts.map((product) => (
              <div
                key={product.id}
                className={`backdrop-blur-xl rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition ${
                  isDark
                    ? "bg-slate-800/50 border border-slate-700"
                    : "bg-white/80 border border-white/50"
                }`}
              >
                {/* Product Image */}
                <div className="h-32 bg-gradient-to-br from-emerald-200 to-green-300 flex items-center justify-center text-5xl">
                  {product.image}
                </div>

                {/* Product Info */}
                <div className="p-6">
                  <h3
                    className={`text-lg font-bold mb-2 ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {product.name}
                  </h3>
                  <p
                    className={`text-sm mb-4 ${
                      isDark ? "text-slate-300" : "text-gray-600"
                    }`}
                  >
                    {product.supplier}
                  </p>

                  {/* Stock Level */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className={`text-sm font-semibold ${
                          isDark ? "text-slate-300" : "text-gray-700"
                        }`}
                      >
                        Stock
                      </span>
                      <span
                        className={`text-sm font-bold ${
                          product.stock > 50
                            ? "text-green-600"
                            : "text-orange-600"
                        }`}
                      >
                        {product.stock} kg
                      </span>
                    </div>
                    <div
                      className={`w-full h-2 rounded-full overflow-hidden ${
                        isDark ? "bg-slate-700" : "bg-gray-200"
                      }`}
                    >
                      <div
                        className={`h-full transition-all ${
                          product.stock > 50
                            ? "bg-gradient-to-r from-green-400 to-emerald-600"
                            : "bg-gradient-to-r from-orange-400 to-red-600"
                        }`}
                        style={{
                          width: `${Math.min(product.stock / 2, 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-4">
                    <p className="text-2xl font-bold text-emerald-600">
                      ${product.price.toFixed(2)}/kg
                    </p>
                  </div>

                  {/* Add to Cart Button */}
                  <button
                    onClick={() => addToCart(product)}
                    className={`w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg font-semibold transition-all ${
                      addedProductId === product.id
                        ? isDark
                          ? "bg-green-900/40 text-green-300"
                          : "bg-green-100 text-green-900"
                        : "bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white"
                    }`}
                  >
                    <Plus size={18} />
                    {addedProductId === product.id ? "Added!" : "Add to Cart"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Cart Tab */}
        {activeTab === "cart" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div
              className={`lg:col-span-2 backdrop-blur-xl rounded-2xl overflow-hidden shadow-lg ${
                isDark
                  ? "bg-slate-800/50 border border-slate-700"
                  : "bg-white/80 border border-white/50"
              }`}
            >
              <div
                className={`p-6 border-b ${
                  isDark ? "border-slate-700" : "border-gray-200"
                }`}
              >
                <h2
                  className={`text-2xl font-bold ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Shopping Cart
                </h2>
              </div>

              {cart.length === 0 ? (
                <div className="p-12 text-center">
                  <ShoppingCart
                    size={48}
                    className={`mx-auto mb-4 ${
                      isDark ? "text-slate-500" : "text-gray-300"
                    }`}
                  />
                  <p
                    className={`font-medium ${
                      isDark ? "text-slate-400" : "text-gray-500"
                    }`}
                  >
                    Your cart is empty
                  </p>
                </div>
              ) : (
                <div
                  className={`divide-y ${
                    isDark ? "divide-slate-700" : "divide-gray-200"
                  }`}
                >
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className={`p-6 transition ${
                        isDark ? "hover:bg-slate-700/50" : "hover:bg-gray-50/50"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="text-4xl">{item.image}</div>
                          <div>
                            <p
                              className={`font-bold ${
                                isDark ? "text-white" : "text-gray-900"
                              }`}
                            >
                              {item.name}
                            </p>
                            <p
                              className={`text-sm ${
                                isDark ? "text-slate-300" : "text-gray-600"
                              }`}
                            >
                              ${item.price.toFixed(2)}/kg
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity - 1)
                            }
                            className="quantity-btn"
                          >
                            −
                          </button>
                          <span
                            className={`w-12 text-center font-semibold ${
                              isDark ? "text-white" : ""
                            }`}
                          >
                            {item.quantity}
                          </span>
                          <button
                            onClick={() =>
                              updateQuantity(item.id, item.quantity + 1)
                            }
                            className="quantity-btn"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <p
                          className={`text-lg font-bold ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          ${(item.price * item.quantity).toFixed(2)}
                        </p>
                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="cart-remove-btn"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cart Summary */}
            <div
              className={`backdrop-blur-xl rounded-2xl p-6 shadow-lg h-fit ${
                isDark
                  ? "bg-slate-800/50 border border-slate-700"
                  : "bg-white/80 border border-white/50"
              }`}
            >
              <h3
                className={`text-xl font-bold mb-6 ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Order Summary
              </h3>

              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span className={isDark ? "text-slate-300" : "text-gray-600"}>
                    Subtotal
                  </span>
                  <span
                    className={`font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    {(() => {
                      const inrSubtotal = Math.round(Number(cartTotal) * 82);
                      // USD->INR conversion for retailer summary (integer display)
                      return `₹${inrSubtotal}`;
                    })()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className={isDark ? "text-slate-300" : "text-gray-600"}>
                    Shipping
                  </span>
                  <span
                    className={`font-semibold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    FREE
                  </span>
                </div>
                <div
                  className={`border-t pt-4 flex justify-between ${
                    isDark ? "border-slate-700" : "border-gray-200"
                  }`}
                >
                  <span
                    className={`text-lg font-bold ${
                      isDark ? "text-white" : "text-gray-900"
                    }`}
                  >
                    Total
                  </span>
                  <span className="text-lg font-bold text-emerald-600">
                    {(() => {
                      const inrTotal = Math.round(Number(cartTotal) * 82);
                      // USD->INR conversion for retailer summary (integer display)
                      return `₹${inrTotal}`;
                    })()}
                  </span>
                </div>
              </div>

              <button
                onClick={placeOrder}
                disabled={cart.length === 0}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                Place Order
              </button>
            </div>
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === "orders" && (
          <div
            className={`backdrop-blur-xl rounded-2xl overflow-hidden shadow-lg ${
              isDark
                ? "bg-slate-800/50 border border-slate-700"
                : "bg-white/80 border border-white/50"
            }`}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    className={`border-b ${
                      isDark
                        ? "border-slate-700 bg-slate-700/30"
                        : "border-gray-200 bg-gray-50/50"
                    }`}
                  >
                    <th
                      className={`px-6 py-4 text-left text-sm font-semibold ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Order ID
                    </th>
                    <th
                      className={`px-6 py-4 text-left text-sm font-semibold ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Items
                    </th>
                    <th
                      className={`px-6 py-4 text-left text-sm font-semibold ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Total
                    </th>
                    <th
                      className={`px-6 py-4 text-left text-sm font-semibold ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Date
                    </th>
                    <th
                      className={`px-6 py-4 text-left text-sm font-semibold ${
                        isDark ? "text-white" : "text-gray-900"
                      }`}
                    >
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {orderHistory.length === 0 ? (
                    <tr>
                      <td
                        colSpan="5"
                        className={`px-6 py-8 text-center ${
                          isDark ? "text-slate-400" : "text-gray-500"
                        }`}
                      >
                        <div className="flex flex-col items-center">
                          <AlertCircle
                            size={40}
                            className={`mb-2 ${
                              isDark ? "text-slate-600" : "text-gray-300"
                            }`}
                          />
                          <p>No orders yet</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    orderHistory.map((order) => (
                      <tr
                        key={order.id}
                        className={`border-b transition ${
                          isDark
                            ? "border-slate-700 hover:bg-slate-700/50"
                            : "border-gray-100 hover:bg-gray-50/50"
                        }`}
                      >
                        <td
                          className={`px-6 py-4 text-sm font-medium ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          #{order.id}
                        </td>
                        <td
                          className={`px-6 py-4 text-sm ${
                            isDark ? "text-slate-300" : "text-gray-600"
                          }`}
                        >
                          {order.items?.map((item, idx) => (
                            <div key={idx}>
                              {item.name} ×{item.quantity}
                            </div>
                          ))}
                        </td>
                        <td
                          className={`px-6 py-4 text-sm font-semibold ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {(() => {
                            const inrTotal = Math.round(
                              Number(order.total || 0) * usdToInrRate
                            );
                            // Display IN₹ integer for retailer orders (USD->INR conversion)
                            return `₹${inrTotal}`;
                          })()}
                        </td>
                        <td
                          className={`px-6 py-4 text-sm ${
                            isDark ? "text-slate-300" : "text-gray-600"
                          }`}
                        >
                          {order.date}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-block px-3 py-1 rounded-lg text-sm font-medium ${
                              order.status === "Pending"
                                ? isDark
                                  ? "bg-yellow-900/40 text-yellow-300"
                                  : "bg-yellow-100 text-yellow-900"
                                : order.status === "Shipped"
                                ? isDark
                                  ? "bg-blue-900/40 text-blue-300"
                                  : "bg-blue-100 text-blue-900"
                                : isDark
                                ? "bg-green-900/40 text-green-300"
                                : "bg-green-100 text-green-900"
                            }`}
                          >
                            {order.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default RetailerDashboard;
