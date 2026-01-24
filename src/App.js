import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// Theme
import { ThemeProvider } from "./context/ThemeContext";
import "./styles/theme.css";

// ✅ SECURITY: Import role utilities
import { isAdminRole, isValidFrontendRole } from "./constants/roles";

// Components
import Navbar from "./components/Navbar";

// Pages
import Login from "./pages/Login";
import Register from "./pages/Register";
import AIQualityCheck from "./pages/AIQualityCheck";

import ProductsPage from "./pages/farmer-dashboard/ProductsPage";
import AddProductPage from "./pages/farmer-dashboard/AddProductPage";
import DistributorDashboard from "./pages/DistributorDashboard";
import RetailerDashboard from "./pages/RetailerDashboard";
import CustomerDashboard from "./pages/CustomerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProductDetail from "./pages/ProductDetail";
import Unauthorized from "./pages/Unauthorized";
import EditProductPage from "./pages/farmer-dashboard/EditProductPage";
import PrivateRoute from "./components/PrivateRoute";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

function App() {
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem("user") || "null");
    // ✅ SECURITY: Validate user role from storage (should come from JWT)
    if (userData && userData.role) {
      if (!isValidFrontendRole(userData.role) && !isAdminRole(userData.role)) {
        console.warn(`Invalid role stored: ${userData.role}, clearing user`);
        localStorage.removeItem("user");
        setUser(null);
      } else {
        setUser(userData);
      }
    }

    const storedProducts = JSON.parse(localStorage.getItem("products") || "[]");
    setProducts(storedProducts);
  }, []);

  const addProduct = (newProduct) => {
    const updatedProducts = [...products, newProduct];
    setProducts(updatedProducts);
    localStorage.setItem("products", JSON.stringify(updatedProducts));
  };

  const deleteProduct = (productId) => {
    const updatedProducts = products.filter(
      (product) => product.id !== productId
    );
    setProducts(updatedProducts);
    localStorage.setItem("products", JSON.stringify(updatedProducts));
  };

  return (
    <ThemeProvider>
      <Router>
        <Navbar user={user} setUser={setUser} />
        <div style={{ paddingTop: "64px" }}>
          <Routes>
            {/* Default Route → Redirect to Login */}
            <Route path="/" element={<Navigate to="/login" />} />
            {/* Public Routes */}
            <Route path="/login" element={<Login setUser={setUser} />} />
            <Route path="/register" element={<Register setUser={setUser} />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/unauthorized" element={<Unauthorized />} />{" "}
            <Route
              path="/ai-quality-check"
              element={
                <PrivateRoute allowedRoles={["customer"]}>
                  <AIQualityCheck />
                </PrivateRoute>
              }
            />{" "}
            <Route
              path="/edit-product/:id"
              element={
                <EditProductPage
                  products={products}
                  setProducts={setProducts}
                />
              }
            />
            {/* Protected Routes */}
            <Route
              path="/farmer-dashboard"
              element={
                <PrivateRoute allowedRoles={["farmer"]}>
                  <ProductsPage
                    products={products}
                    onDeleteProduct={deleteProduct}
                  />
                </PrivateRoute>
              }
            />
            <Route
              path="/add-product"
              element={
                <PrivateRoute allowedRoles={["farmer"]}>
                  <AddProductPage addProduct={addProduct} />
                </PrivateRoute>
              }
            />
            <Route
              path="/distributor-dashboard"
              element={
                <PrivateRoute allowedRoles={["distributor"]}>
                  <DistributorDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/retailer-dashboard"
              element={
                <PrivateRoute allowedRoles={["retailer"]}>
                  <RetailerDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer-dashboard"
              element={
                <PrivateRoute allowedRoles={["customer"]}>
                  <CustomerDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin-dashboard"
              element={
                <PrivateRoute user={user} allowedRoles={["admin"]}>
                  <AdminDashboard />
                </PrivateRoute>
              }
            />
            {/* ✅ SECURITY: Admin route protection - new standardized path */}
            <Route
              path="/admin/dashboard"
              element={
                <PrivateRoute user={user} allowedRoles={["admin"]}>
                  <AdminDashboard />
                </PrivateRoute>
              }
            />
            {/* Catch-all route */}
            <Route path="*" element={<Navigate to="/login" />} />
          </Routes>
        </div>
      </Router>
    </ThemeProvider>
  );
}

export default App;
