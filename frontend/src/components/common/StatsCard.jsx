import { motion } from 'framer-motion';

export default function StatsCard({ icon: Icon, label, value, sub, color = 'earth', index = 0 }) {
 const colors = {
  earth:  'bg-earth-500/10  text-earth-400  border-earth-500/20',
  green:  'bg-forest-700/20 text-green-400  border-forest-600/20',
  blue:   'bg-blue-900/20   text-blue-400   border-blue-700/20',
  yellow: 'bg-yellow-900/20 text-yellow-400 border-yellow-700/20',
  amber:  'bg-yellow-900/20 text-yellow-400 border-yellow-700/20',  // ← add
  purple: 'bg-purple-900/20 text-purple-400 border-purple-700/20',  // ← add
};

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="stat-card"
    >
      <div className={`p-3 rounded-xl border ${colors[color]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-2xl font-display text-slate-100">{value}</p>
        <p className="text-sm font-medium text-slate-300">{label}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}