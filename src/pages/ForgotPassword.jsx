import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { requestPasswordReset } from "./api";
import { useTheme } from "../context/ThemeContext";
import { Sprout } from "lucide-react";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [devLink, setDevLink] = useState("");
  const [error, setError] = useState("");
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const isValidEmail = (val) => /[^@\s]+@[^@\s]+\.[^@\s]+/.test(val);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const res = await requestPasswordReset(email);
      setMessage("If this email is registered, a reset link has been sent.");
      if (res?.resetLink) setDevLink(res.resetLink);
    } catch (e) {
      // Always show generic success message to avoid enumeration
      setMessage("If this email is registered, a reset link has been sent.");
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
            <h1 className="text-2xl font-bold">Forgot Password</h1>
            <p className={isDark ? "text-gray-300" : "text-gray-600"}>
              We'll email you a reset link.
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
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
                isDark
                  ? "bg-white/5 border-white/10 text-white placeholder-gray-400"
                  : "bg-white/50 border-gray-200 text-gray-900 placeholder-gray-500"
              }`}
              required
            />
            {error && (
              <p className="text-red-600 text-sm mt-2" role="alert">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-bold py-3 rounded-xl transition disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>

        {message && (
          <div
            className={`mt-5 text-sm ${
              isDark ? "text-emerald-300" : "text-emerald-700"
            }`}
          >
            {message}
            {devLink && (
              <div className="mt-2">
                Dev link:{" "}
                <a className="underline" href={devLink}>
                  Open reset page
                </a>
              </div>
            )}
          </div>
        )}

        <button
          onClick={() => navigate("/login")}
          className={`mt-6 text-sm font-medium ${
            isDark ? "text-emerald-300" : "text-emerald-700"
          }`}
        >
          Back to login
        </button>
      </div>
    </div>
  );
};

export default ForgotPassword;
