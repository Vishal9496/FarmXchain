import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Sprout, Tractor, Truck, Store, User, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { FRONTEND_ROLE_OPTIONS } from "../constants/roles";

const Register = () => {
  const { isDark, toggleTheme } = useTheme();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "",
  });
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const navigate = useNavigate();

  // ✅ SECURITY: Map role options to use frontend-only roles
  const roles = FRONTEND_ROLE_OPTIONS.map((role) => ({
    id: role.id,
    label: role.label,
    icon:
      role.id === "farmer"
        ? Tractor
        : role.id === "distributor"
        ? Truck
        : role.id === "retailer"
        ? Store
        : User,
    color:
      role.id === "farmer"
        ? "from-amber-400 to-orange-500"
        : role.id === "distributor"
        ? "from-blue-400 to-cyan-500"
        : role.id === "retailer"
        ? "from-purple-400 to-pink-500"
        : "from-green-400 to-emerald-500",
  }));

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    // Real-time password validation
    if (name === "confirmPassword" || name === "password") {
      if (formData.password && value && formData.password !== value) {
        setPasswordError("Passwords do not match!");
      } else {
        setPasswordError("");
      }
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }

    // ✅ SECURITY: Send ONLY whitelisted role to backend
    const userData = {
      name: formData.name,
      email: formData.email,
      password: formData.password,
      role: formData.role, // Backend will validate and enforce role
    };

    setLoading(true);
    try {
      const response = await axios.post(
        "http://localhost:8080/api/users/register",
        userData
      );

      alert("Registration Success: " + response.data.message);
      navigate("/login");
    } catch (error) {
      if (error.response?.data?.message) {
        alert("Registration Failed: " + error.response.data.message);
      } else {
        alert("Registration Failed: " + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex relative overflow-hidden transition-colors duration-300 ${
        isDark
          ? "dark bg-slate-950"
          : "bg-gradient-to-br from-emerald-50 via-white to-green-50"
      }`}
    >
      {/* Theme Toggle Button */}
      <button
        onClick={toggleTheme}
        className={`absolute top-6 right-6 z-50 p-3 rounded-full transition-all ${
          isDark
            ? "bg-slate-800 text-yellow-400 hover:bg-slate-700"
            : "bg-white text-gray-700 hover:bg-gray-100"
        } shadow-lg`}
      >
        {isDark ? <Sun size={24} /> : <Moon size={24} />}
      </button>

      {/* Animated background */}
      <div className="absolute top-10 left-10 w-40 h-40 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute top-1/2 right-1/3 w-40 h-40 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>

      {/* Content */}
      <div className="w-full flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-xl">
          <div
            className={`backdrop-blur-xl rounded-3xl shadow-2xl p-8 border transition-colors ${
              isDark
                ? "bg-slate-900/80 border-slate-700/50"
                : "bg-white/80 border-white/50"
            }`}
          >
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl mb-4">
                <Sprout size={32} className="text-white" />
              </div>
              <h2
                className={`text-3xl font-bold mb-2 ${
                  isDark ? "text-white" : "text-gray-900"
                }`}
              >
                Create Your Account
              </h2>
              <p className={isDark ? "text-slate-400" : "text-gray-600"}>
                Join FarmChainX and select your role
              </p>
            </div>

            <form onSubmit={handleRegister} className="space-y-5">
              {/* Full Name */}
              <div>
                <label
                  className={`block text-sm font-semibold mb-2 ${
                    isDark ? "text-slate-300" : "text-gray-800"
                  }`}
                >
                  Full Name
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Vishal"
                  className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition ${
                    isDark
                      ? "bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500"
                      : "bg-white/50 border border-gray-200 text-gray-900 placeholder-gray-500"
                  }`}
                />
              </div>

              {/* Email */}
              <div>
                <label
                  className={`block text-sm font-semibold mb-2 ${
                    isDark ? "text-slate-300" : "text-gray-800"
                  }`}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="your@email.com"
                  className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition ${
                    isDark
                      ? "bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500"
                      : "bg-white/50 border border-gray-200 text-gray-900 placeholder-gray-500"
                  }`}
                />
              </div>

              {/* Password */}
              <div>
                <label
                  className={`block text-sm font-semibold mb-2 ${
                    isDark ? "text-slate-300" : "text-gray-800"
                  }`}
                >
                  Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  minLength="6"
                  className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition ${
                    isDark
                      ? "bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500"
                      : "bg-white/50 border border-gray-200 text-gray-900 placeholder-gray-500"
                  }`}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label
                  className={`block text-sm font-semibold mb-2 ${
                    isDark ? "text-slate-300" : "text-gray-800"
                  }`}
                >
                  Confirm Password
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  placeholder="••••••••"
                  className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:border-transparent transition ${
                    isDark
                      ? `bg-slate-800/50 border placeholder-slate-500 text-white ${
                          passwordError
                            ? "border-red-400 focus:ring-2 focus:ring-red-400"
                            : "border-slate-700 focus:ring-2 focus:ring-emerald-400"
                        }`
                      : `bg-white/50 border placeholder-gray-500 text-gray-900 ${
                          passwordError
                            ? "border-red-400 focus:ring-2 focus:ring-red-400"
                            : "border-gray-200 focus:ring-2 focus:ring-emerald-400"
                        }`
                  }`}
                />
                {passwordError && (
                  <p className="text-red-500 text-sm mt-1">
                    ⚠️ {passwordError}
                  </p>
                )}
              </div>

              {/* Role Selection */}
              <div>
                <label
                  className={`block text-sm font-semibold mb-3 ${
                    isDark ? "text-slate-300" : "text-gray-800"
                  }`}
                >
                  Select Your Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {roles.map((role) => {
                    const IconComponent = role.icon;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, role: role.id })
                        }
                        className={`p-4 rounded-xl border-2 transition-all ${
                          formData.role === role.id
                            ? isDark
                              ? "border-emerald-500 bg-emerald-950"
                              : "border-emerald-500 bg-emerald-50"
                            : isDark
                            ? "border-slate-700 bg-slate-800/50 hover:border-slate-600"
                            : "border-gray-200 bg-white/50 hover:border-gray-300"
                        }`}
                      >
                        <div
                          className={`inline-flex items-center justify-center w-10 h-10 bg-gradient-to-br ${role.color} rounded-lg mb-2`}
                        >
                          <IconComponent size={20} className="text-white" />
                        </div>
                        <p
                          className={`font-semibold text-sm ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        >
                          {role.label}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !formData.role}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-6"
              >
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>

            {/* Sign In Link */}
            <p
              className={`text-center mt-6 ${
                isDark ? "text-slate-400" : "text-gray-600"
              }`}
            >
              Already have an account?{" "}
              <Link
                to="/login"
                className={`font-semibold transition ${
                  isDark
                    ? "text-emerald-400 hover:text-emerald-300"
                    : "text-emerald-600 hover:text-emerald-700"
                }`}
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
