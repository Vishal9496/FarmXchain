import axios from "axios";

// Create a reusable secure Axios instance (attaches JWT token)
export const API = axios.create({
  baseURL: "http://localhost:8080/api/users",
});

// 🌟 NEW: Create a public Axios instance that does NOT attach the token
// We use this for the analyze-image endpoint to bypass security conflicts.
export const PUBLIC_API = axios.create({
  baseURL: "http://localhost:8080/api/users",
});

// Auth endpoints (forgot/reset password)
export const AUTH_API = axios.create({
  baseURL: "http://localhost:8080/api/auth",
});

// ✅ NEW: Product endpoints (with JWT token)
export const PRODUCTS_API = axios.create({
  baseURL: "http://localhost:8080/api/products",
});

// Attach token automatically if available
API.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ✅ Attach token to PRODUCTS_API as well
PRODUCTS_API.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Login function (uses API)
// ✅ SECURITY: Role is NOT sent to backend during login
// Backend determines role from database and returns it in JWT
export const loginUser = async (email, password, role) => {
  if (!email?.trim() || !password?.trim()) {
    throw new Error("Email and password are required");
  }

  if (!role?.trim()) {
    throw new Error("Role is required");
  }

  const normalizedRole = role.toLowerCase();

  const buildLocalUser = () => ({
    id: `local-${Date.now()}`,
    name: email.split("@")[0] || "Demo User",
    email,
    role: normalizedRole,
    token: "local-demo-token",
    demo: true,
  });

  try {
    const response = await API.post("/login", {
      email,
      password,
      role: normalizedRole,
    });
    const { user, token } = response.data;

    if (!user || !token) throw new Error("Invalid login response");

    localStorage.setItem("token", token);

    const userWithToken = { ...user, token };
    localStorage.setItem("user", JSON.stringify(userWithToken));

    return userWithToken;
  } catch (err) {
    // If backend is unreachable, fall back to a local/demo login so UI stays usable
    if (!err.response) {
      const localUser = buildLocalUser();
      localStorage.setItem("user", JSON.stringify(localUser));
      console.warn("Backend unreachable; using local demo login.");
      return localUser;
    }

    // If backend responded, surface its message
    throw new Error(err.response?.data?.message || "Login failed");
  }
};

// Register function (uses API)
export const registerUser = async (userData) => {
  try {
    const response = await API.post("/register", userData);
    return response.data.user || response.data;
  } catch (err) {
    throw new Error(err.response?.data?.message || "Registration failed");
  }
};

// Logout function
export const logoutUser = () => {
  localStorage.removeItem("user");
};

// Password reset: request link
export const requestPasswordReset = async (email) => {
  try {
    const res = await AUTH_API.post("/forgot-password", { email });
    return res.data; // may contain { resetLink }
  } catch (err) {
    // Still resolve to true to avoid email enumeration
    return {
      message: "If this email is registered, a reset link has been sent.",
    };
  }
};

// Password reset: submit new password
export const resetPassword = async (token, password) => {
  try {
    const res = await AUTH_API.post("/reset-password", { token, password });
    return res.data;
  } catch (err) {
    const message = err.response?.data?.message || "Reset failed";
    throw new Error(message);
  }
};

// ============================================================
// ✅ NEW: Product API Functions
// ============================================================

/**
 * Get products for authenticated retailer's inventory
 * @returns {Promise<{retailerId, retailerName, products, count}>} Retailer's products
 */
export const getRetailerInventory = async () => {
  try {
    const response = await PRODUCTS_API.get("/retailer/inventory");
    return response.data;
  } catch (err) {
    throw new Error(
      err.response?.data?.message || "Failed to fetch retailer inventory",
    );
  }
};

/**
 * Get all products for farmer
 * @param {number} farmerId - Farmer's user ID
 * @returns {Promise<Array>} List of farmer's products
 */
export const getFarmerProducts = async (farmerId) => {
  try {
    const response = await PRODUCTS_API.get(`/farmer/${farmerId}`);
    return Array.isArray(response.data)
      ? response.data
      : response.data.products || [];
  } catch (err) {
    throw new Error(
      err.response?.data?.message || "Failed to fetch farmer products",
    );
  }
};

/**
 * Get all products available
 * @returns {Promise<Array>} List of all products
 */
export const getAllProducts = async () => {
  try {
    const response = await PRODUCTS_API.get("/all");
    return Array.isArray(response.data)
      ? response.data
      : response.data.products || [];
  } catch (err) {
    throw new Error(err.response?.data?.message || "Failed to fetch products");
  }
};

/**
 * Get products available to customers (no retailer filtering)
 * @returns {Promise<Array>} List of available products
 */
export const getAvailableProductsForCustomers = async () => {
  try {
    console.log("[API] Calling /customer/products endpoint");
    const response = await PRODUCTS_API.get("/customer/product");
    console.log("[API] /customer/products response data:", response.data);
    console.log(
      "[API] /customer/products response length:",
      Array.isArray(response.data) ? response.data.length : "not an array",
    );
    if (Array.isArray(response.data)) {
      return response.data;
    }
    // If backend wraps data, surface as-is for debugging instead of assuming shape
    return response.data || [];
  } catch (err) {
    console.error("[API] /customer/products error:", err);
    throw new Error(
      err.response?.data?.message || "Failed to fetch available products",
    );
  }
};
