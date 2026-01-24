import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { loginUser } from "./api";
import { Eye, EyeOff, Sprout } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import {
  getDashboardRoute,
  isAdminRole,
  isValidFrontendRole,
  FRONTEND_ROLE_OPTIONS,
} from "../constants/roles";

const Login = ({ setUser }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState("");

  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const heroStyle = {
    backgroundImage: isDark
      ? "linear-gradient(135deg, rgba(15,23,42,0.85), rgba(6,95,70,0.75)), url('https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1400&q=80')"
      : "linear-gradient(135deg, rgba(11,127,73,0.75), rgba(6,95,70,0.8)), url('https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1400&q=80')",
    backgroundSize: "cover",
    backgroundPosition: "center",
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!role) {
      setFormError("Please select your role to continue.");
      return;
    }
    setLoading(true);

    try {
      const user = await loginUser(email, password, role);
      setUser(user);

      // ✅ SECURITY: Get role from JWT response ONLY
      if (!user.role) {
        throw new Error("No role received from backend");
      }

      // Check if user is admin
      if (isAdminRole(user.role)) {
        navigate("/admin/dashboard");
        return;
      }

      // Validate role is a standard frontend role
      if (!isValidFrontendRole(user.role)) {
        throw new Error(`Invalid user role: ${user.role}`);
      }

      // Route to appropriate dashboard
      const dashboardPath = getDashboardRoute(user.role);
      if (!dashboardPath) {
        throw new Error("Invalid user role - no dashboard found");
      }

      navigate(dashboardPath);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div
      className={`min-h-screen flex relative overflow-hidden transition-colors duration-300 bg-gradient-to-br ${
        isDark
          ? "from-slate-950 via-slate-900 to-slate-950"
          : "from-emerald-50 via-white to-green-50"
      }`}
    >
      {/* Animated background elements */}
      <div className="absolute top-10 left-10 w-40 h-40 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-40 h-40 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute top-1/2 right-1/3 w-40 h-40 bg-amber-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>

      {/* Left side - Image & Branding */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden items-center justify-center p-12 text-white"
        style={heroStyle}
      >
        <div className="absolute inset-0 bg-black/10" />
        <div className="relative z-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/15 rounded-3xl mb-6 border border-white/20 shadow-xl backdrop-blur">
            <Sprout size={44} className="text-white drop-shadow" />
          </div>
          <h1 className="text-5xl font-bold mb-3 drop-shadow-lg">FarmChainX</h1>
          <p className="text-xl text-emerald-50 mb-8 drop-shadow">
            AI-Driven Agricultural Traceability
          </p>
          <div className="grid grid-cols-1 gap-3 text-left max-w-md mx-auto">
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-2xl px-4 py-3 border border-white/10">
              <div className="w-2 h-2 bg-emerald-200 rounded-full" />
              <p className="text-emerald-50">
                Real-time farm to table tracking
              </p>
            </div>
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-2xl px-4 py-3 border border-white/10">
              <div className="w-2 h-2 bg-emerald-200 rounded-full" />
              <p className="text-emerald-50">Transparent supply chain</p>
            </div>
            <div className="flex items-center gap-3 bg-white/10 backdrop-blur rounded-2xl px-4 py-3 border border-white/10">
              <div className="w-2 h-2 bg-emerald-200 rounded-full" />
              <p className="text-emerald-50">Quality assurance with AI</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div
            className={`backdrop-blur-xl rounded-3xl shadow-2xl p-8 border transition-colors duration-300 ${
              isDark
                ? "bg-white/5 border-white/10 text-slate-50"
                : "bg-white/80 border-white/50 text-gray-900"
            }`}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-8">
              <div className="text-left">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-400 to-green-600 rounded-2xl mb-4 shadow-lg">
                  <Sprout size={32} className="text-white" />
                </div>
                <h2
                  className={`text-3xl font-bold mb-1 ${
                    isDark ? "text-white" : "text-gray-900"
                  }`}
                >
                  Welcome Back
                </h2>
                <p className={isDark ? "text-gray-300" : "text-gray-600"}>
                  Sign in to your FarmChainX account
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-semibold border transition ${
                  isDark
                    ? "bg-white/10 border-white/20 text-white hover:bg-white/20"
                    : "bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200"
                }`}
                aria-label="Toggle light/dark mode"
              >
                <span>{isDark ? "🌙 Dark" : "☀️ Light"}</span>
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Email Input */}
              <div>
                <label
                  className={`block text-sm font-semibold mb-2 ${
                    isDark ? "text-gray-200" : "text-gray-800"
                  }`}
                >
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="your@email.com"
                  className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition border ${
                    isDark
                      ? "bg-white/5 border-white/10 text-white placeholder-gray-400"
                      : "bg-white/50 border-gray-200 text-gray-900 placeholder-gray-500"
                  }`}
                />
              </div>

              {/* Password Input */}
              <div>
                <label
                  className={`block text-sm font-semibold mb-2 ${
                    isDark ? "text-gray-200" : "text-gray-800"
                  }`}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition border ${
                      isDark
                        ? "bg-white/5 border-white/10 text-white placeholder-gray-400"
                        : "bg-white/50 border-gray-200 text-gray-900 placeholder-gray-500"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 transition ${
                      isDark
                        ? "text-gray-300 hover:text-emerald-300"
                        : "text-gray-600 hover:text-emerald-600"
                    }`}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Role Selection */}
              <div>
                <label
                  className={`block text-sm font-semibold mb-2 ${
                    isDark ? "text-gray-200" : "text-gray-800"
                  }`}
                >
                  Select Role
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  required
                  className={`w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-emerald-400 transition border appearance-none ${
                    isDark
                      ? "bg-slate-900/90 border-emerald-700/60 text-slate-50 hover:border-emerald-300"
                      : "bg-white/70 border-gray-200 text-gray-900 hover:border-emerald-400"
                  }`}
                  style={{
                    backgroundColor: isDark
                      ? "#0b1220"
                      : "rgba(255,255,255,0.7)",
                    color: isDark ? "#f8fafc" : "#0f172a",
                  }}
                >
                  <option value="">Choose your role</option>
                  {FRONTEND_ROLE_OPTIONS.map((option) => (
                    <option
                      key={option.id}
                      value={option.id}
                      style={{
                        backgroundColor: isDark ? "#0b1220" : "#ffffff",
                        color: isDark ? "#e2e8f0" : "#0f172a",
                      }}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-sm text-gray-500">
                  Admin is backend-only and cannot be selected here.
                </p>
              </div>

              {/* Forgot Password */}
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className={`text-sm font-medium transition ${
                    isDark
                      ? "text-emerald-300 hover:text-emerald-200"
                      : "text-emerald-600 hover:text-emerald-700"
                  }`}
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 rounded-xl transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 mt-6"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>

              {formError && (
                <div
                  className={`mt-3 text-sm font-medium ${
                    isDark ? "text-red-200" : "text-red-700"
                  }`}
                >
                  {formError}
                </div>
              )}
            </form>

            {/* Sign Up Link */}
            <p className="text-center text-gray-600 mt-6">
              Don't have an account?{" "}
              <Link
                to="/register"
                className="text-emerald-600 hover:text-emerald-700 font-semibold transition"
              >
                Create account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
