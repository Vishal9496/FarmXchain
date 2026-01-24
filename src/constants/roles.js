/**
 * Centralized Role Management
 *
 * ⚠️ SECURITY CRITICAL:
 * - These are the ONLY roles allowed in the frontend UI
 * - Admin role is NOT included here (admin users are backend-only)
 * - User role is determined by JWT token, NOT frontend selection
 * - Never modify these values without security review
 */

export const ALLOWED_FRONTEND_ROLES = {
  FARMER: "farmer",
  DISTRIBUTOR: "distributor",
  RETAILER: "retailer",
  CUSTOMER: "customer",
};

/**
 * List of role options for UI dropdowns/selectors
 * Used in Login and Register forms
 */
export const FRONTEND_ROLE_OPTIONS = [
  {
    id: "farmer",
    label: "FARMER",
    description: "Manage farm products and supply chain",
  },
  {
    id: "distributor",
    label: "DISTRIBUTOR",
    description: "Handle product distribution",
  },
  {
    id: "retailer",
    label: "RETAILER",
    description: "Manage retail operations",
  },
  {
    id: "customer",
    label: "CUSTOMER",
    description: "Purchase and track products",
  },
];

/**
 * All possible roles in the system (including backend-only)
 * Used for validation and routing
 */
export const ALL_ROLES = {
  ...ALLOWED_FRONTEND_ROLES,
  ADMIN: "admin",
};

/**
 * Dashboard routes for each role
 */
export const ROLE_DASHBOARD_ROUTES = {
  [ALL_ROLES.FARMER]: "/farmer-dashboard",
  [ALL_ROLES.DISTRIBUTOR]: "/distributor-dashboard",
  [ALL_ROLES.RETAILER]: "/retailer-dashboard",
  [ALL_ROLES.CUSTOMER]: "/customer-dashboard",
  [ALL_ROLES.ADMIN]: "/admin/dashboard",
};

/**
 * Get dashboard route for a role
 * @param {string} role - User role from JWT
 * @returns {string|null} Dashboard route or null if not found
 */
export const getDashboardRoute = (role) => {
  if (!role) return null;
  return ROLE_DASHBOARD_ROUTES[role.toLowerCase()] || null;
};

/**
 * Check if a role is valid frontend role
 * @param {string} role - Role to validate
 * @returns {boolean} True if role is allowed in frontend
 */
export const isValidFrontendRole = (role) => {
  return Object.values(ALLOWED_FRONTEND_ROLES).includes(role?.toLowerCase());
};

/**
 * Check if a user is admin (from JWT)
 * @param {string} role - User role from JWT token
 * @returns {boolean} True if user has admin role
 */
export const isAdminRole = (role) => {
  return role?.toLowerCase() === ALL_ROLES.ADMIN;
};
