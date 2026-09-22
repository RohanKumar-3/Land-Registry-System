import { Link } from 'react-router-dom';
import { FiMapPin, FiMaximize2, FiCheckCircle, FiAlertCircle, FiClock } from 'react-icons/fi';
import { motion } from 'framer-motion';

const STATUS_CONFIG = {
  verified: { label: 'Verified',  icon: FiCheckCircle, cls: 'badge-verified' },
  pending:  { label: 'Pending',   icon: FiClock,       cls: 'badge-pending' },
  flagged:  { label: 'Flagged',   icon: FiAlertCircle, cls: 'badge-flagged' },
  rejected: { label: 'Rejected',  icon: FiAlertCircle, cls: 'badge-rejected' },
};

export default function LandCard({ parcel, index = 0 }) {
  const s = STATUS_CONFIG[parcel.verificationStatus] || STATUS_CONFIG.pending;
  const Icon = s.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07 }}
    >
      <Link to={`/parcels/${parcel._id}`} className="block card-hover p-5 group">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-base text-slate-100 truncate group-hover:text-earth-400 transition-colors">
              {parcel.title}
            </h3>
            <p className="font-mono text-xs text-slate-600 mt-0.5">{parcel.parcelId}</p>
          </div>
          <span className={s.cls}>
            <Icon className="text-xs" /> {s.label}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <FiMapPin className="text-earth-500 shrink-0" />
            <span className="truncate">{parcel.location?.district}, {parcel.location?.state}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <FiMaximize2 className="text-earth-500 shrink-0" />
            <span>{(parcel.areaInSqMeters / 10000).toFixed(2)} hectares</span>
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
          <span className="text-xs px-2 py-1 bg-slate-800 text-slate-400 rounded-md capitalize">
            {parcel.landType}
          </span>
          {parcel.isListed && parcel.listingPrice && (
            <span className="text-earth-400 font-mono text-sm font-medium">
              {parcel.listingPrice} ETH
            </span>
          )}
          {parcel.verificationScore !== null && (
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-linear-to-r from-earth-600 to-earth-400"
                  style={{ width: `${parcel.verificationScore}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 font-mono">{parcel.verificationScore}</span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  );
}