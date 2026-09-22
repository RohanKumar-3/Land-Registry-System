import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShield, FiCpu, FiMap, FiArrowRight, FiCheckCircle } from 'react-icons/fi';

const FEATURES = [
  { icon: FiShield, title: 'Blockchain Security',    desc: 'Land titles stored as NFTs on Ethereum. Immutable, transparent, tamper-proof.' },
  { icon: FiCpu,    title: 'AI Verification',        desc: 'Satellite imagery analyzed by CNN to auto-detect land use and encroachments.' },
  { icon: FiMap,    title: 'Interactive Maps',       desc: 'Draw and visualize land boundaries on live maps with color-coded status.' },
];

const STEPS = [
  'Register your land parcel with boundary coordinates',
  'AI analyzes satellite imagery and assigns a verification score',
  'Government authority reviews and approves on-chain',
  'Land title minted as NFT — fully owned, fully yours',
];

export default function Home() {
  return (
    <div className="page-enter">
      {/* Hero */}
      <section className="relative min-h-[88vh] flex items-center overflow-hidden">
        {/* Background orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-earth-600/8 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-forest-600/8 rounded-full blur-3xl" />
        </div>

        <div className="page-wrapper relative w-full">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full
                         bg-earth-500/10 border border-earth-500/25 text-earth-400 text-xs font-medium mb-8"
            >
              <span className="w-1.5 h-1.5 bg-earth-400 rounded-full animate-pulse" />
              Blockchain + AI Land Registry
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="font-display text-5xl md:text-7xl text-slate-100 leading-[1.1] mb-6"
            >
              Land ownership,{' '}
              <span className="text-earth-400">reimagined</span>{' '}
              for the digital age.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg text-slate-400 leading-relaxed mb-10 max-w-xl"
            >
              Transparent, fraud-proof land records powered by blockchain immutability
              and AI-driven satellite verification.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <Link to="/register" className="btn-primary flex items-center gap-2">
                Get Started <FiArrowRight />
              </Link>
              <Link to="/marketplace" className="btn-secondary flex items-center gap-2">
                View Registry
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="page-wrapper border-t border-slate-800/50">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl text-slate-100 mb-3">How it works</h2>
          <p className="text-slate-400 max-w-lg mx-auto">Three technologies working together to solve one of the world's oldest problems.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              viewport={{ once: true }}
              className="card p-6 group hover:border-earth-700 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-earth-500/10 border border-earth-500/20
                              flex items-center justify-center mb-4 group-hover:bg-earth-500/20 transition-colors">
                <Icon className="text-earth-400" size={18} />
              </div>
              <h3 className="font-display text-lg text-slate-100 mb-2">{title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Steps */}
        <div className="card p-8 max-w-2xl mx-auto">
          <h3 className="font-display text-xl text-slate-100 mb-6 text-center">Registration Process</h3>
          <div className="space-y-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                viewport={{ once: true }}
                className="flex items-start gap-4"
              >
                <div className="w-7 h-7 rounded-full bg-earth-500/15 border border-earth-500/30
                                flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-earth-400 text-xs font-mono font-bold">{i + 1}</span>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed pt-1">{step}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}