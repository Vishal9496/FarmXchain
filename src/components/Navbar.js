import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import "../styles/Navbar.css";

const Navbar = ({ user, setUser }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleTheme, isDark } = useTheme();

  const hideBrandLogo = location.pathname === "/distributor-dashboard";

  const handleLogout = () => {
    localStorage.removeItem("user");
    setUser(null);
    navigate("/login");
  };

  const isActive = (path) => {
    return location.pathname === path ? "active" : "";
  };

  // Don't show navbar on login/register pages
  if (location.pathname === "/login" || location.pathname === "/register") {
    return null;
  }

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div
          className="navbar-brand"
          onClick={() => {
            if (user?.role === "farmer") navigate("/farmer-dashboard");
            else if (user?.role === "admin") navigate("/admin-dashboard");
            else if (user?.role === "distributor")
              navigate("/distributor-dashboard");
            else if (user?.role === "retailer") navigate("/retailer-dashboard");
            else if (user?.role === "customer") navigate("/customer-dashboard");
          }}
          style={{ cursor: "pointer" }}
        >
          <span
            className={`brand-icon ${hideBrandLogo ? "brand-icon-hidden" : ""}`}
          >
            🌾
          </span>
          <span className="brand-name">FarmXChain</span>
        </div>

        {user && (
          <>
            <div className="navbar-menu">
              {user.role === "farmer" && (
                <>
                  <Link
                    to="/farmer-dashboard"
                    className={`nav-link ${isActive("/farmer-dashboard")}`}
                  >
                    Products
                  </Link>
                  <Link
                    to="/add-product"
                    className={`nav-link ${isActive("/add-product")}`}
                  >
                    Add Product
                  </Link>
                </>
              )}

              {user.role === "distributor" && (
                <>
                  <Link
                    to="/distributor-dashboard"
                    className={`nav-link ${isActive("/distributor-dashboard")}`}
                  >
                    Orders
                  </Link>
                </>
              )}

              {user.role === "retailer" && (
                <>
                  <Link
                    to="/retailer-dashboard"
                    className={`nav-link ${isActive("/retailer-dashboard")}`}
                  >
                    Products
                  </Link>
                </>
              )}

              {user.role === "customer" && (
                <>
                  <Link
                    to="/customer-dashboard"
                    className={`nav-link ${isActive("/customer-dashboard")}`}
                  >
                    Marketplace
                  </Link>
                  <button
                    onClick={() =>
                      window.dispatchEvent(new Event("openAIQualityCheck"))
                    }
                    className="nav-link"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    AI Quality Check
                  </button>
                </>
              )}
            </div>

            <div className="navbar-actions">
              {user.role === "admin" && (
                <Link to="/admin-dashboard" className="nav-btn nav-btn-admin">
                  Admin
                </Link>
              )}

              <button
                onClick={toggleTheme}
                className="nav-btn nav-btn-theme"
                title={`Switch to ${isDark ? "light" : "dark"} mode`}
              >
                {isDark ? "☀️" : "🌙"}
              </button>

              <div className="user-info">
                <span className="user-role">{user.role}</span>
                <span className="user-name">{user.name || user.email}</span>
              </div>

              <button onClick={handleLogout} className="nav-btn nav-btn-logout">
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
