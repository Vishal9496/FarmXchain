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

/**
 * ✅ SECURITY (P0-6): thrown when the backend cannot be reached at all.
 *
 * A dedicated error type so the UI can tell "the server is down" apart from
 * "your credentials are wrong" and show the right message. It carries no
 * authentication meaning whatsoever — if this is thrown, the caller is NOT
 * logged in and no session has been created.
 */
export class NetworkError extends Error {
  constructor(message) {
    super(message);
    this.name = "NetworkError";
    this.isNetworkError = true;
  }
}

// Login function (uses API)
// ✅ SECURITY (P0-6): there is NO offline/demo path. Authentication happens on the
// server or it does not happen at all. If the backend is unreachable this function
// THROWS — it never returns a user object and never writes to localStorage.
export const loginUser = async (email, password, role) => {
  if (!email?.trim() || !password?.trim()) {
    throw new Error("Email and password are required");
  }

  if (!role?.trim()) {
    throw new Error("Role is required");
  }

  const normalizedRole = role.toLowerCase();

  let response;
  try {
    response = await API.post("/login", {
      email,
      password,
      role: normalizedRole,
    });
  } catch (err) {
    // err.response is absent only when no HTTP response arrived at all:
    // server down, connection refused, DNS failure, CORS block, or timeout.
    if (!err.response) {
      throw new NetworkError(
        "Cannot reach the FarmXChain server. Please check that the backend is running and try again.",
      );
    }

    // The server answered. Surface its message so the user sees the real reason,
    // e.g. "Invalid email or password!" or "Role mismatch for this account...".
    throw new Error(
      err.response?.data?.message || "Login failed. Please try again.",
    );
  }

  const { user, token } = response.data;

  // A 200 without both fields means the contract is broken. Fail loudly rather
  // than storing a half-built session that will 401 on every later request.
  if (!user || !token) {
    throw new Error("Invalid login response from server. Please try again.");
  }

  localStorage.setItem("token", token);

  const userWithToken = { ...user, token };
  localStorage.setItem("user", JSON.stringify(userWithToken));

  return userWithToken;
};

// Register function (uses API)
export const registerUser = async (userData) => {
  try {
    const response = await API.post("/register", userData);
    return response.data.user || response.data;
  } catch (err) {
    // ✅ SECURITY (P0-6): same distinction as login — a network failure must not
    // be reported to the user as a validation problem.
    if (!err.response) {
      throw new NetworkError(
        "Cannot reach the FarmXChain server. Please check that the backend is running and try again.",
      );
    }
    throw new Error(err.response?.data?.message || "Registration failed");
  }
};

// Logout function
// ✅ P0-6: loginUser writes TWO keys ("token" and "user"). Both must be cleared,
// or axiosInstance.js — which reads localStorage.getItem("token") — keeps sending
// a valid JWT after the user has "logged out".
export const logoutUser = () => {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
};

// Password reset: request link.
// SECURITY: the server responds with a generic message only. The reset link is
// delivered by email (or written to the server log in development) and is never
// present in this response.
export const requestPasswordReset = async (email) => {
  try {
    const res = await AUTH_API.post("/forgot-password", { email });
    return res.data; // { message }
  } catch (err) {
    // Swallow the error so a failed request is indistinguishable from a
    // successful one — no email enumeration through the UI.
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
    const response = await PRODUCTS_API.get("/customer/products");
    console.log("[API] /customer/products response data:", response.data);
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
