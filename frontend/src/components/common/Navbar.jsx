import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useWeb3 } from '../../context/Web3Context';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMap, FiHome, FiGrid, FiPlusSquare,
  FiShoppingBag, FiShield, FiMenu, FiX,
  FiLogOut, FiArrowRight, FiFileText
} from 'react-icons/fi';

// ── Role-based nav links ──────────────────────────────────────────────────────
// 'public'   = visible to everyone including non-logged-in
// 'auth'     = visible to all logged-in users
// roles array = visible only to those specific roles
const NAV_LINKS = [
  { to: '/',              label: 'Home',          icon: FiHome,        show: 'public'                          },
  // Landowner links
  { to: '/dashboard',     label: 'Dashboard',     icon: FiGrid,        show: 'roles', roles: ['landowner','buyer'] },
  { to: '/register-land', label: 'Register Land', icon: FiPlusSquare,  show: 'roles', roles: ['landowner']         },
  { to: '/my-parcels',    label: 'My Parcels',    icon: FiMap,         show: 'roles', roles: ['landowner']         },
  // Buyer links
  { to: '/marketplace',   label: 'Marketplace',   icon: FiShoppingBag, show: 'roles', roles: ['buyer','landowner'] },
  { to: '/transactions',  label: 'Transactions',  icon: FiArrowRight,  show: 'roles', roles: ['landowner','buyer'] },
  // Government — only Admin Panel, no dashboard, no marketplace
  { to: '/admin',         label: 'Admin Panel',   icon: FiShield,      show: 'roles', roles: ['government']        },
];

export default function Navbar() {
  const { user, logout }                       = useAuth();
  const { account, connectWallet, connecting } = useWeb3();
  const { pathname }                           = useLocation();
  const navigate                               = useNavigate();
  const [mobileOpen, setMobileOpen]            = useState(false);

  // Filter links based on login state and role
  const visibleLinks = NAV_LINKS.filter(link => {
    if (link.show === 'public') return true;
    if (!user) return false;                                      // not logged in → hide all auth links
    if (link.show === 'auth') return true;
    if (link.show === 'roles') return link.roles.includes(user.role);
    return false;
  });

  const handleLogout = () => {
    logout();           // AuthContext handles toast + redirect to '/'
    setMobileOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ──────────────────────────────────────────────────── */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-earth-500 flex items-center justify-center
                            shadow-earth group-hover:shadow-glow transition-all">
              <FiMap className="text-white text-sm" />
            </div>
            <span className="font-display text-lg text-slate-100">
              Land<span className="text-earth-400">Chain</span>
            </span>
          </Link>

          {/* ── Desktop Nav ───────────────────────────────────────────── */}
          <nav className="hidden md:flex items-center gap-1">
            {visibleLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
                            transition-all duration-200
                  ${pathname === to
                    ? 'bg-earth-500/15 text-earth-400'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}
              >
                <Icon className="text-base" />
                {label}
              </Link>
            ))}
          </nav>

          {/* ── Right side ────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">

            {/* Wallet connect button — only show when logged in */}
            {user && (
              <button
                onClick={connectWallet}
                disabled={connecting}
                className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg
                            text-xs font-mono font-medium transition-all
                  ${account
                    ? 'bg-forest-700/30 text-green-400 border border-forest-600/50'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:border-earth-600 hover:text-earth-400'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${account ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                {connecting
                  ? 'Connecting...'
                  : account
                    ? `${account.slice(0, 6)}...${account.slice(-4)}`
                    : 'Connect Wallet'}
              </button>
            )}

            {/* User info + logout  OR  Sign In button */}
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-medium text-slate-200">{user.name}</span>
                  <span className="text-xs text-earth-500 capitalize">{user.role}</span>
                </div>
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-all"
                >
                  <FiLogOut />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login"    className="btn-secondary text-sm py-1.5 px-3">Sign In</Link>
                <Link to="/register" className="btn-primary  text-sm py-1.5 px-3">Sign Up</Link>
              </div>
            )}

            {/* Mobile menu toggle */}
            <button
              className="md:hidden p-2 text-slate-400 hover:text-slate-100"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-slate-800 bg-slate-950"
          >
            <div className="px-4 py-3 space-y-1">
              {visibleLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                    ${pathname === to
                      ? 'bg-earth-500/15 text-earth-400'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}
                >
                  <Icon size={16} /> {label}
                </Link>
              ))}

              {/* Mobile wallet button */}
              {user && (
                <button
                  onClick={() => { connectWallet(); setMobileOpen(false); }}
                  disabled={connecting}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                    ${account
                      ? 'text-green-400 bg-forest-700/20'
                      : 'text-slate-400 hover:text-earth-400 hover:bg-slate-800'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${account ? 'bg-green-400' : 'bg-slate-600'}`} />
                  {connecting ? 'Connecting...' : account
                    ? `${account.slice(0, 6)}...${account.slice(-4)}`
                    : 'Connect Wallet'}
                </button>
              )}

              {/* Mobile logout */}
              {user && (
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                             text-sm text-red-400 hover:bg-red-900/20 transition-all"
                >
                  <FiLogOut size={16} /> Logout
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
