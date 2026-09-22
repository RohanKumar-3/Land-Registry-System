import { useEffect, useState } from 'react';
import { transactionService } from '../services/transactionService';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  FiArrowRight, FiExternalLink, FiCheckCircle,
  FiClock, FiXCircle, FiAlertCircle
} from 'react-icons/fi';
import LoadingSpinner from '../components/common/LoadingSpinner';

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS = {
  initiated:       { label: 'Initiated',       color: 'text-slate-400',  bg: 'bg-slate-800 border-slate-700',         icon: FiClock        },
  funded:          { label: 'Funded',           color: 'text-blue-400',   bg: 'bg-blue-900/20 border-blue-700/30',     icon: FiClock        },
  approved:        { label: 'Approved',         color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/30', icon: FiClock        },
  seller_approved: { label: 'Seller Approved',  color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-700/30', icon: FiClock        },
  completed:       { label: 'Completed',        color: 'text-green-400',  bg: 'bg-green-900/20 border-green-700/30',   icon: FiCheckCircle  },
  cancelled:       { label: 'Cancelled',        color: 'text-red-400',    bg: 'bg-red-900/20 border-red-700/30',       icon: FiXCircle      },
  disputed:        { label: 'Disputed',         color: 'text-orange-400', bg: 'bg-orange-900/20 border-orange-700/30', icon: FiAlertCircle  },
};

const getStatus = (key) => STATUS[key] || STATUS['initiated'];

export default function Transactions() {
  const { user }                          = useAuth();
  const [transactions, setTransactions]   = useState([]);
  const [loading,      setLoading]        = useState(true);
  const [filter,       setFilter]         = useState('all');

  useEffect(() => {
    transactionService.getMy()
      .then(r => setTransactions(r.data.transactions || []))
      .catch(() => setTransactions([]))
      .finally(() => setLoading(false));
  }, []);

  // ── Filter transactions ───────────────────────────────────────────────────
  const filtered =
    filter === 'all'       ? transactions :
    filter === 'buying'    ? transactions.filter(t => t.buyer?._id  === user?._id) :
    filter === 'selling'   ? transactions.filter(t => t.seller?._id === user?._id) :
    filter === 'completed' ? transactions.filter(t => t.escrowStatus === 'completed') :
                             transactions.filter(t => t.escrowStatus !== 'completed' && t.escrowStatus !== 'cancelled');

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = {
    total:     transactions.length,
    buying:    transactions.filter(t => t.buyer?._id  === user?._id).length,
    selling:   transactions.filter(t => t.seller?._id === user?._id).length,
    completed: transactions.filter(t => t.escrowStatus === 'completed').length,
  };

  if (loading) return <LoadingSpinner text="Loading transaction history..." />;

  return (
    <div className="page-wrapper page-enter space-y-6">
      <div>
        <h1 className="section-title">Transaction History</h1>
        <p className="section-sub">All your land purchases and sales</p>
      </div>

      {/* ── Stats row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total',     value: stats.total,     color: 'text-slate-300' },
          { label: 'Buying',    value: stats.buying,    color: 'text-blue-400'  },
          { label: 'Selling',   value: stats.selling,   color: 'text-earth-400' },
          { label: 'Completed', value: stats.completed, color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-2xl font-mono font-bold ${color}`}>{value}</p>
            <p className="text-xs text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Filter tabs ────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {[
          ['all',       'All'],
          ['buying',    'Buying'],
          ['selling',   'Selling'],
          ['active',    'Active'],
          ['completed', 'Completed'],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${filter === k
                ? 'bg-earth-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {/* ── Transaction list ───────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-slate-400 text-sm">No transactions found</p>
          <Link to="/marketplace" className="btn-primary mt-4 inline-flex text-sm">
            Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((txn, i) => {
            const isBuyer   = txn.buyer?._id  === user?._id;
            const isSeller  = txn.seller?._id === user?._id;
            const status    = getStatus(txn.escrowStatus);
            const StatusIcon = status.icon;

            return (
              <motion.div
                key={txn._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="card p-5 space-y-4"
              >
                {/* ── Top row ──────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    {/* Role badge */}
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium
                        ${isBuyer
                          ? 'bg-blue-900/20 text-blue-400 border-blue-700/30'
                          : 'bg-earth-500/15 text-earth-400 border-earth-500/30'}`}>
                        {isBuyer ? '🛒 Buying' : '🏷️ Selling'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${status.bg} ${status.color}`}>
                        <StatusIcon className="inline mr-1 text-xs" />
                        {status.label}
                      </span>
                    </div>

                    {/* Parcel title */}
                    <Link
                      to={`/parcels/${txn.parcel?._id}`}
                      className="text-slate-200 font-medium text-sm hover:text-earth-400 transition-colors flex items-center gap-1"
                    >
                      {txn.parcel?.title || 'Unknown Parcel'}
                      <FiExternalLink className="text-xs text-slate-500" />
                    </Link>
                    <p className="font-mono text-xs text-slate-500">
                      {txn.parcel?.parcelId} · Token #{txn.parcel?.tokenId}
                    </p>
                  </div>

                  {/* Price */}
                  <div className="text-right">
                    <p className="font-mono text-earth-400 text-lg font-bold">
                      {txn.price} ETH
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(txn.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                    </p>
                  </div>
                </div>

                {/* ── Parties row ───────────────────────────────────────── */}
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {/* Seller */}
                  <div className="bg-slate-800/50 rounded-lg p-2.5">
                    <p className="text-slate-500 mb-1">Seller</p>
                    <p className={`font-medium ${isSeller ? 'text-earth-400' : 'text-slate-300'}`}>
                      {isSeller ? 'You' : txn.seller?.name}
                    </p>
                    {txn.seller?.walletAddress && (
                      <p className="font-mono text-slate-600 text-xs mt-0.5 truncate">
                        {txn.seller.walletAddress.slice(0,8)}...
                      </p>
                    )}
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center justify-center">
                    <FiArrowRight className="text-slate-600 text-lg" />
                  </div>

                  {/* Buyer */}
                  <div className="bg-slate-800/50 rounded-lg p-2.5">
                    <p className="text-slate-500 mb-1">Buyer</p>
                    <p className={`font-medium ${isBuyer ? 'text-blue-400' : 'text-slate-300'}`}>
                      {isBuyer ? 'You' : txn.buyer?.name}
                    </p>
                    {txn.buyer?.walletAddress && (
                      <p className="font-mono text-slate-600 text-xs mt-0.5 truncate">
                        {txn.buyer.walletAddress.slice(0,8)}...
                      </p>
                    )}
                  </div>
                </div>

                {/* ── Approval status pills ────────────────────────────── */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    txn.buyerApproved
                      ? 'bg-green-900/20 text-green-400 border-green-700/30'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    Buyer {txn.buyerApproved ? '✅' : '⏳'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    txn.sellerApproved
                      ? 'bg-green-900/20 text-green-400 border-green-700/30'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    Seller {txn.sellerApproved ? '✅' : '⏳'}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${
                    txn.governmentApproved
                      ? 'bg-green-900/20 text-green-400 border-green-700/30'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    Govt {txn.governmentApproved ? '✅' : '⏳'}
                  </span>

                  {/* Escrow ID */}
                  {txn.contractEscrowId && (
                    <span className="ml-auto text-xs font-mono text-slate-600">
                      Escrow #{txn.contractEscrowId}
                    </span>
                  )}
                </div>

                {/* ── Blockchain link (completed only) ─────────────────── */}
                {txn.escrowStatus === 'completed' && txn.blockchainTxHash && (
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <span className="text-xs text-slate-500">On-chain proof:</span>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${txn.blockchainTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-earth-400
                                 hover:text-earth-300 font-mono transition-colors"
                    >
                      {txn.blockchainTxHash.slice(0, 18)}...
                      <FiExternalLink className="text-xs" />
                    </a>
                    {txn.completedAt && (
                      <span className="ml-auto text-xs text-slate-600">
                        Completed {new Date(txn.completedAt).toLocaleDateString('en-IN')}
                      </span>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
