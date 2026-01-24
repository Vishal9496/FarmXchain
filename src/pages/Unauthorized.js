import React from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Home } from "lucide-react";
import "../styles/Unauthorized.css";

const Unauthorized = () => {
  const navigate = useNavigate();

  return (
    <div className="unauthorized-wrapper">
      <div className="unauthorized-container">
        {/* Icon Section */}
        <div className="unauthorized-icon-container">
          <div className="unauthorized-icon">
            <Lock size={56} strokeWidth={1.5} />
          </div>
        </div>

        {/* Content Card */}
        <div className="unauthorized-card">
          {/* Heading */}
          <h1 className="unauthorized-heading">Access Denied</h1>

          {/* Subheading */}
          <p className="unauthorized-subtext">
            You don't have permission to access this page.
          </p>

          {/* Description */}
          <p className="unauthorized-description">
            Please check that you're logged in with the correct account, or
            contact support if you believe this is an error.
          </p>

          {/* Action Buttons */}
          <div className="unauthorized-actions">
            <button
              className="unauthorized-btn unauthorized-btn-primary"
              onClick={() => navigate("/login")}
              aria-label="Return to login page"
            >
              <Home size={18} />
              Go to Login
            </button>
            <button
              className="unauthorized-btn unauthorized-btn-secondary"
              onClick={() => navigate("/")}
              aria-label="Go to home page"
            >
              Back to Home
            </button>
          </div>

          {/* Error Code */}
          <p className="unauthorized-code">Error Code: 403</p>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;
