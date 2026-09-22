import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { FiMail, FiLock, FiMap } from "react-icons/fi";
import toast from "react-hot-toast";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
  e.preventDefault();

  if (!form.email || !form.password) {
    toast.error("Please enter your email and password");
    return;
  }

  setLoading(true);
  try {
    const loggedUser = await login(form.email, form.password);

    // ── Toast shows BEFORE navigate unmounts the page ──
    toast.success(`Welcome back, ${loggedUser.name}!`, { duration: 3000 });

    setTimeout(() => {
      if (loggedUser.role === "government") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    }, 500); // 500ms gap lets toast render before unmount

  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data?.message;

    if (status === 401 || message?.toLowerCase().includes("invalid")) {
      toast.error("Incorrect email or password", { duration: 4000 });
    } else if (status === 404) {
      toast.error("No account found with this email", { duration: 4000 });
    } else if (status === 429) {
      toast.error("Too many attempts. Please wait a moment.", { duration: 5000 });
    } else {
      toast.error(message || "Login failed. Please try again.");
    }
  } finally {
    setLoading(false);
  }
};

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 page-enter">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-earth-500 flex items-center justify-center mx-auto mb-4 shadow-earth">
            <FiMap className="text-white text-xl" />
          </div>
          <h1 className="font-display text-3xl text-slate-100 mb-2">Welcome back</h1>
          <p className="text-slate-400 text-sm">Sign in to your LandChain account</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Email address</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  className="input-field pl-10"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="label">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  className="input-field pl-10"
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm(p => ({ ...p, password: e.target.value }))}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center flex items-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            No account?{" "}
            <Link to="/register" className="text-earth-400 hover:text-earth-300 font-medium">
              Create one
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}