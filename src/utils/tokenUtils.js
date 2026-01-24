// ✅ JWT Token Management Utility
// Centralized place to manage JWT tokens across the application

/**
 * Get the JWT token from localStorage
 * @returns {string|null} JWT token or null if not found
 */
export const getToken = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    return user?.token || null;
  } catch {
    return null;
  }
};

/**
 * Get authenticated user info from localStorage
 * @returns {object|null} User object with id, email, role, token
 */
export const getAuthenticatedUser = () => {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    return user || null;
  } catch {
    return null;
  }
};

/**
 * Get Authorization header for API requests
 * @returns {object} Header object with Authorization: Bearer {token}
 */
export const getAuthHeaders = () => {
  const token = getToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

/**
 * Verify user is authenticated and has required role
 * @param {string} requiredRole - Expected user role (farmer, retailer, etc.)
 * @returns {boolean} True if authenticated and role matches
 */
export const isAuthenticatedWithRole = (requiredRole) => {
  const user = getAuthenticatedUser();
  return user && user.role === requiredRole;
};

/**
 * Check if token exists and is likely valid
 * @returns {boolean} True if token exists
 */
export const isTokenValid = () => {
  return getToken() !== null;
};

/**
 * Clear authentication data (logout)
 */
export const clearAuth = () => {
  localStorage.removeItem("user");
};
