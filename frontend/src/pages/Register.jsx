import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { FiUser, FiMail, FiLock, FiPhone, FiMap } from "react-icons/fi";
import toast from "react-hot-toast";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "landowner",
  });

  const [loading, setLoading] = useState(false);

  const set = (key) => (e) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    const { name, email, phone, password, confirmPassword, role } = form;

    if (!name || !email || !password || !phone) {
      toast.error("All fields are required");
      return;
    }

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      await register({ name, email, password, phone, role });

      toast.success("Account created! Welcome to LandChain.");
      navigate("/dashboard");
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (
        status === 409 ||
        message?.toLowerCase().includes("duplicate") ||
        message?.toLowerCase().includes("already")
      ) {
        toast.error("An account with this email already exists");
      } else if (status === 400) {
        toast.error(message || "Please check your details and try again");
      } else {
        toast.error("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12 page-enter">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-earth-500 flex items-center justify-center mx-auto mb-4 shadow-earth">
            <FiMap className="text-white text-xl" />
          </div>

          <h1 className="font-display text-3xl text-slate-100 mb-2">
            Create account
          </h1>

          <p className="text-slate-400 text-sm">Join LandChain registry</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Name */}
            <div>
              <label className="label">Name</label>
              <div className="relative">
                <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  className="input-field pl-10"
                  placeholder="Full name"
                  value={form.name}
                  onChange={set("name")}
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="email"
                  required
                  className="input-field pl-10"
                  placeholder="Email address"
                  value={form.email}
                  onChange={set("email")}
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="label">Phone</label>
              <div className="relative">
                <FiPhone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="tel"
                  required
                  className="input-field pl-10"
                  placeholder="Phone number"
                  value={form.phone}
                  onChange={set("phone")}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  className="input-field pl-10"
                  placeholder="Password (min 6 chars)"
                  value={form.password}
                  onChange={set("password")}
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="label">Confirm Password</label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  className="input-field pl-10"
                  placeholder="Confirm password"
                  value={form.confirmPassword}
                  onChange={set("confirmPassword")}
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="label">Role</label>
              <select
                className="input-field"
                value={form.role}
                onChange={set("role")}
              >
                <option value="landowner">Land Owner</option>
                <option value="buyer">Buyer</option>
                <option value="government">Government Authority</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center flex items-center gap-2 mt-2"
            >
              {loading ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}

              {loading ? "Creating..." : "Create Account"}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            Already have an account?{" "}
            <Link
              to="/login"
              className="text-earth-400 hover:text-earth-300 font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}