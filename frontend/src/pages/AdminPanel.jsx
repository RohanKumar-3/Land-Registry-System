import { useEffect, useState } from 'react';
import { landService } from '../services/landService';
import { transactionService } from '../services/transactionService';
import LandCard from '../components/common/LandCard';
import LoadingSpinner from '../components/common/LoadingSpinner';
import StatsCard from '../components/common/StatsCard';
import { FiMap, FiCheckCircle, FiAlertCircle, FiClock, FiArrowRight } from 'react-icons/fi';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { governmentApproveOnChain } from '../services/blockchainService';
import WalletGuard from "../components/common/WalletGuard";


export default function AdminPanel() {
  const [parcels,     setParcels]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('all');
  const [pendingTxns, setPendingTxns] = useState([]);
  const [txnLoading,  setTxnLoading]  = useState(true);
  const [approvingId, setApprovingId] = useState(null);

  // ── Fetch parcels ──────────────────────────────────────────────────
  useEffect(() => {
    landService.getAll({ limit: 100 })
      .then(r => setParcels(r.data.parcels || []))
      .finally(() => setLoading(false));
  }, []);

  // ── Fetch pending transactions ─────────────────────────────────────
  useEffect(() => {
    transactionService.getPending()
      .then(r => setPendingTxns(r.data.transactions || []))
      .catch(() => setPendingTxns([]))
      .finally(() => setTxnLoading(false));
  }, []);

  const refreshTxns = () => {
    transactionService.getPending()
      .then(r => setPendingTxns(r.data.transactions || []))
      .catch(() => {});
  };

  // ── Approve transfer ───────────────────────────────────────────────
  const handleGovApproveTxn = async (txn) => {  // ← pass full txn, not just id
  setApprovingId(txn._id);
  try {
    // Step 1: Government signs on-chain (MetaMask popup)
    // This triggers contract to auto-transfer NFT + ETH
    toast('Confirm in MetaMask — this will transfer the NFT...', { icon: '⛓️' });
    const txHash = await governmentApproveOnChain(txn.contractEscrowId);

    // Step 2: Update DB
    await transactionService.govApprove(txn._id, { txHash });

    toast.success('NFT transferred to buyer on Sepolia! ✅');
    refreshTxns();
  } catch (err) {
    if (err.code === 4001) toast.error('MetaMask: Transaction rejected');
    else toast.error(err.response?.data?.message || 'Approval failed');
  } finally {
    setApprovingId(null);
  }
};

  const stats = {
    total:    parcels.length,
    verified: parcels.filter(p => p.governmentApproved).length,
    flagged:  parcels.filter(p => p.verificationStatus === 'flagged').length,
    pending:  parcels.filter(p => !p.governmentApproved).length,
  };

  const filtered = filter === 'all'       ? parcels
    : filter === 'flagged'                ? parcels.filter(p => p.verificationStatus === 'flagged')
    : filter === 'unapproved'             ? parcels.filter(p => !p.governmentApproved)
    : parcels.filter(p => p.governmentApproved);

  return (
    <div className="page-wrapper page-enter space-y-8">
      <div>
        <h1 className="section-title">Admin Panel</h1>
        <p className="section-sub">Government authority dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard icon={FiMap}         label="Total Parcels"     value={stats.total}    color="earth"  index={0} />
        <StatsCard icon={FiCheckCircle} label="Approved"          value={stats.verified} color="green"  index={1} />
        <StatsCard icon={FiClock}       label="Awaiting Approval" value={stats.pending}  color="yellow" index={2} />
        <StatsCard icon={FiAlertCircle} label="Flagged"           value={stats.flagged}  color="blue"   index={3} />
      </div>

      {/* ── Pending Transfers Section ──────────────────────────────── */}
      <div>
        <h2 className="font-display text-base text-slate-200 mb-3 flex items-center gap-2">
          <FiArrowRight className="text-earth-400" />
          Pending Land Transfers
          {pendingTxns.length > 0 && (
            <span className="ml-1 px-2 py-0.5 rounded-full bg-yellow-900/30
                             text-yellow-400 text-xs border border-yellow-700/30">
              {pendingTxns.length}
            </span>
          )}
        </h2>

        {txnLoading ? (
          <div className="text-slate-500 text-sm">Loading transactions...</div>
        ) : pendingTxns.length === 0 ? (
          <div className="card p-5 text-center text-slate-500 text-sm">
            No pending transfers at the moment
          </div>
        ) : (
          <div className="space-y-3">
            {pendingTxns.map((txn, i) => (
              <motion.div
                key={txn._id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card p-4 space-y-3"
              >
                {/* Parcel info */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-slate-200 text-sm font-medium">
                      {txn.parcel?.title}
                    </p>
                    <p className="font-mono text-xs text-slate-500 mt-0.5">
                      {txn.parcel?.parcelId} · Token #{txn.parcel?.tokenId}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-earth-400 font-mono text-sm font-bold">
                      {txn.price} ETH
                    </span>
                    <span className="badge badge-pending text-xs">
                      {txn.escrowStatus}
                    </span>
                  </div>
                </div>

                {/* Seller → Buyer */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-slate-800/50 rounded-lg p-2.5">
                    <p className="text-slate-500 mb-1">Seller</p>
                    <p className="text-slate-300 font-medium">{txn.seller?.name}</p>
                    <p className="font-mono text-slate-600 truncate text-xs mt-0.5">
                      {txn.seller?.walletAddress?.slice(0,10)}...
                    </p>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2.5">
                    <p className="text-slate-500 mb-1">Buyer</p>
                    <p className="text-slate-300 font-medium">{txn.buyer?.name}</p>
                    <p className="font-mono text-slate-600 truncate text-xs mt-0.5">
                      {txn.buyer?.walletAddress?.slice(0,10)}...
                    </p>
                  </div>
                </div>

                {/* Approval status */}
                <div className="flex items-center gap-2 text-xs flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full border ${
                    txn.sellerApproved
                      ? 'bg-green-900/20 text-green-400 border-green-700/30'
                      : 'bg-slate-800 text-slate-500 border-slate-700'
                  }`}>
                    Seller {txn.sellerApproved ? '✅' : '⏳'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full border
                                   bg-green-900/20 text-green-400 border-green-700/30">
                    Buyer ✅
                  </span>
                  <span className="px-2 py-0.5 rounded-full border
                                   bg-slate-800 text-slate-500 border-slate-700">
                    Govt ⏳
                  </span>
                </div>

                {/* Approve button — only show when seller approved */}
                {txn.sellerApproved ? (
                  <WalletGuard action="Connect your wallet to transfer NFTs.">
                  <button
                    onClick={() => handleGovApproveTxn(txn)}
                    disabled={approvingId === txn._id}
                    className="btn-primary w-full text-sm flex items-center justify-center gap-2"
                  >
                    {approvingId === txn._id ? (
                      <span className="w-4 h-4 border-2 border-white/30
                                       border-t-white rounded-full animate-spin" />
                    ) : (
                      <FiCheckCircle />
                    )}
                    {approvingId === txn._id
                      ? 'Transferring NFT...'
                      : 'Approve Transfer & Send NFT to Buyer'}
                  </button>
                  </WalletGuard>
                ) : (
                  <div className="text-xs text-yellow-400 bg-yellow-900/10
                                  border border-yellow-700/30 rounded-lg p-2 text-center">
                    ⏳ Waiting for seller to approve first
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Land Parcels Section ───────────────────────────────────── */}
      <div>
        <h2 className="font-display text-base text-slate-200 mb-3">
          Land Parcels
        </h2>

        <div className="flex gap-2 mb-4">
          {[
            ['all',       'All'],
            ['unapproved','Needs Approval'],
            ['flagged',   'Flagged'],
            ['approved',  'Approved'],
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

        {loading ? (
          <LoadingSpinner text="Loading all parcels..." />
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center text-slate-500 text-sm">
            No parcels found
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((p, i) => (
              <LandCard key={p._id} parcel={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}