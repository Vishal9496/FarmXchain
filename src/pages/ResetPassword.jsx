import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { resetPassword } from "./api";
import { useTheme } from "../context/ThemeContext";
import { Sprout } from "lucide-react";

const passwordValid = (pwd) => {
  // Min 8 chars, 1 uppercase, 1 number, 1 special char
  const re =
    /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-={}\][|;:'",.<>/?]).{8,}$/;
  return re.test(pwd);
};

const ResetPassword = () => {
  const { isDark } = useTheme();
  const [params] = useSearchParams();
  const token = useMemo(() => params.get("token") || "", [params]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Reset token missing.");
      return;
    }
    if (!passwordValid(password)) {
      setError(
        "Password must be 8+ chars with uppercase, number, and special."
      );
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, password);
      alert("Password updated. You can sign in now.");
      navigate("/login");
    } catch (e) {
      setError(e.message || "Reset failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 ${
        isDark ? "bg-slate-950" : "bg-emerald-50"
      }`}
    >
      <div
        className={`w-full max-w-md rounded-3xl p-8 shadow-2xl border ${
          isDark
            ? "bg-white/5 border-white/10 text-slate-50"
            : "bg-white border-white/50 text-gray-900"
        }`}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-emerald-400 to-green-600 rounded-xl">
            <Sprout className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Reset Password</h1>
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              Enter your new password.
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label
              className={`block text-sm font-semibold mb-2 ${
                isDark ? "text-gray-200" : "text-gray-800"
              }`}
            >
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                isDark
                  ? "bg-white/5 border-white/10 text-white placeholder-gray-400"
                  : "bg-white/50 border-gray-200 text-gray-900 placeholder-gray-500"
              }`}
              placeholder="••••••••"
              required
            />
          </div>

          <div>
            <label
              className={`block text-sm font-semibold mb-2 ${
                isDark ? "text-gray-200" : "text-gray-800"
              }`}
            >
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                isDark
                  ? "bg-white/5 border-white/10 text-white placeholder-gray-400"
                  : "bg-white/50 border-gray-200 text-gray-900 placeholder-gray-500"
              }`}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
