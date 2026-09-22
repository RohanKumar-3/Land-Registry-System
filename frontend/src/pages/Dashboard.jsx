import { useAuth }    from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { landService } from '../services/landService';
import { transactionService } from '../services/transactionService';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import StatsCard from '../components/common/StatsCard';
import MapView   from '../components/map/MapView';
import { Navigate } from 'react-router-dom';
import {
  FiMap, FiCheckCircle, FiTag,
  FiLink, FiShoppingBag, FiRefreshCw
} from 'react-icons/fi';

export default function Dashboard() {
  const { user } = useAuth();

  // Government goes straight to admin panel
  if (user?.role === 'government') {
    return <Navigate to="/admin" replace />;
  }

  return user?.role === 'landowner'
    ? <LandownerDashboard />
    : <BuyerDashboard />;
}

// ── Landowner dashboard ────────────────────────────────────────────────────
function LandownerDashboard() {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    landService.getMyParcels()
      .then(r  => setParcels(r.data.parcels || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const verified  = parcels.filter(p => p.verificationStatus === 'verified').length;
  const listed    = parcels.filter(p => p.isListed).length;
  const onChain   = parcels.filter(p => p.isOnChain).length;
  const pending   = parcels.filter(p => p.verificationStatus === 'pending').length;

  return (
    <div className="page-wrapper page-enter space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="section-title">My Land Portfolio</h1>
          <p className="section-sub">Manage your registered parcels</p>
        </div>
        <Link to="/register-land" className="btn-primary flex items-center gap-2 text-sm">
          + Register New Land
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard label="Total Parcels"   value={parcels.length} icon={FiMap}        color="earth"  />
        <StatsCard label="Verified"        value={verified}       icon={FiCheckCircle} color="green" />
        <StatsCard label="Listed for Sale" value={listed}         icon={FiTag}        color="yellow" />
        <StatsCard label="On Blockchain"   value={onChain}        icon={FiLink}       color="blue"   />
      </div>

      {/* Pending notice */}
      {pending > 0 && (
        <div className="card p-4 border-yellow-700/30 bg-yellow-900/10 text-sm text-yellow-300 flex items-center gap-2">
          ⏳ {pending} parcel{pending > 1 ? 's' : ''} awaiting AI verification or government approval
        </div>
      )}

      {/* Map */}
      {parcels.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-display text-sm text-slate-300">Parcel Locations</h2>
          </div>
          <MapView parcels={parcels} height="320px" />
        </div>
      )}

      {/* Recent parcels */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm text-slate-300">Recent Parcels</h2>
          <Link to="/my-parcels" className="text-xs text-earth-400 hover:text-earth-300">View all →</Link>
        </div>

        {loading ? (
          <div className="text-slate-500 text-sm">Loading...</div>
        ) : parcels.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-slate-400 mb-4">You haven't registered any land yet</p>
            <Link to="/register-land" className="btn-primary text-sm">Register Your First Parcel</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {parcels.slice(0, 5).map((p, i) => (
              <motion.div
                key={p._id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link to={`/parcels/${p._id}`} className="card p-4 flex items-center justify-between hover:border-earth-500/40 transition-all">
                  <div>
                    <p className="text-slate-200 text-sm font-medium">{p.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {p.location?.district}, {p.location?.state} · {p.landType}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.verificationScore !== null && (
                      <span className="font-mono text-xs text-earth-400">{p.verificationScore}/100</span>
                    )}
                    <span className={`badge text-xs ${
                      p.verificationStatus === 'verified' ? 'badge-verified' :
                      p.verificationStatus === 'flagged'  ? 'badge-flagged' :
                      'badge-pending'
                    }`}>
                      {p.verificationStatus}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Buyer dashboard ────────────────────────────────────────────────────────
function BuyerDashboard() {
  const [listed,  setListed]  = useState([]);
  const [myTxns,  setMyTxns]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      landService.getAll({ isListed: true }),
      transactionService.getMy().catch(() => ({ data: { transactions: [] } }))
    ])
      .then(([landsRes, txnRes]) => {
        setListed(landsRes.data.parcels || []);
        setMyTxns(txnRes.data.transactions || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const active    = myTxns.filter(t => ['initiated','funded','approved'].includes(t.escrowStatus)).length;
  const completed = myTxns.filter(t => t.escrowStatus === 'completed').length;

  return (
    <div className="page-wrapper page-enter space-y-6">
      <div>
        <h1 className="section-title">Land Marketplace</h1>
        <p className="section-sub">Browse and purchase verified land parcels</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
       <StatsCard label="Parcels for Sale"    value={listed.length} icon={FiShoppingBag} color="earth" />
       <StatsCard label="Active Purchases"    value={active}        icon={FiRefreshCw}   color="yellow" />
       <StatsCard label="Completed Purchases" value={completed}     icon={FiCheckCircle} color="green" />
      </div>

      {/* Map of listed parcels */}
      {listed.length > 0 && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h2 className="font-display text-sm text-slate-300">Available Parcels</h2>
            <Link to="/marketplace" className="text-xs text-earth-400 hover:text-earth-300">View all →</Link>
          </div>
          <MapView parcels={listed} height="300px" />
        </div>
      )}

      {/* Listed parcels preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm text-slate-300">Available for Purchase</h2>
          <Link to="/marketplace" className="text-xs text-earth-400 hover:text-earth-300">Browse all →</Link>
        </div>
        {loading ? (
          <div className="text-slate-500 text-sm">Loading...</div>
        ) : listed.length === 0 ? (
          <div className="card p-8 text-center text-slate-400">
            No parcels currently listed for sale
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {listed.slice(0, 4).map((p, i) => (
              <motion.div key={p._id} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: i*0.05 }}>
                <Link to={`/parcels/${p._id}`} className="card p-4 hover:border-earth-500/40 transition-all block">
                  <p className="text-slate-200 text-sm font-medium">{p.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{p.location?.district}, {p.location?.state}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-earth-400 font-mono text-sm font-bold">{p.listingPrice} ETH</span>
                    <span className="text-xs text-slate-500">{(p.areaInSqMeters/10000).toFixed(3)} ha</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Active transactions */}
      {myTxns.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm text-slate-300">My Transactions</h2>
            <Link to="/transactions" className="text-xs text-earth-400 hover:text-earth-300">View all →</Link>
          </div>
          {myTxns.slice(0,3).map(t => (
            <div key={t._id} className="card p-3 mb-2 flex items-center justify-between text-sm">
              <span className="text-slate-300">{t.parcel?.title}</span>
              <span className={`badge text-xs ${t.escrowStatus === 'completed' ? 'badge-verified' : 'badge-pending'}`}>
                {t.escrowStatus}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}