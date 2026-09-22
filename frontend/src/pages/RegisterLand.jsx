import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { landService } from "../services/landService";
import ParcelDrawer from "../components/map/ParcelDrawer";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { FiUpload, FiCheckCircle, FiInfo } from "react-icons/fi";
import { useWeb3 } from '../context/Web3Context';
import WalletGuard from '../components/common/WalletGuard';


const LAND_TYPES = [
  "agricultural",
  "residential",
  "commercial",
  "industrial",
  "forest",
  "wasteland",
];
const STEPS = [
  "Basic Info",
  "Location",
  "Draw Boundary",
  "Documents",
  "Review & Submit",
];

export default function RegisterLand() {
  const { account } = useWeb3();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [boundaries, setBoundaries] = useState([]);
  const [center, setCenter] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    landType: "agricultural",
    areaInSqMeters: "",
    listingPrice: "",
    location: {
      state: "",
      district: "",
      village: "",
      pincode: "",
      fullAddress: "",
    },
  });
  if (!account) {
    return (
      <div className="page-wrapper flex items-center justify-center min-h-[60vh]">
        <div className="max-w-md w-full">
          <WalletGuard message="You must connect your MetaMask wallet before registering land. Your wallet address will be permanently linked to this parcel." />
        </div>
      </div>
    );
  }

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const setLoc = (k) => (e) =>
    setForm((p) => ({
      ...p,
      location: { ...p.location, [k]: e.target.value },
    }));

  const canNext = () => {
    if (step === 0) return form.title && form.landType && form.areaInSqMeters;
    if (step === 1) return form.location.state && form.location.district;
    if (step === 2) return boundaries.length > 0;
    return true;
  };

  const handleSubmit = async () => {
    if (!boundaries.length)
      return toast.error("Please draw your land boundary on the map");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("landType", form.landType);
      fd.append("areaInSqMeters", form.areaInSqMeters);
      fd.append("location", JSON.stringify(form.location));
      fd.append("boundaries", JSON.stringify(boundaries));
      fd.append("centerPoint", JSON.stringify(center));
      if (form.listingPrice) fd.append("listingPrice", form.listingPrice);
      files.forEach((f) => fd.append("documents", f));

      const res = await landService.register(fd);
      toast.success("Land registered! AI verification has started 🛰️");
      navigate(`/parcels/${res.data.parcel._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-5">
            <div>
              <label className="label">Parcel Title *</label>
              <input
                className="input-field"
                placeholder="e.g. North Farm Plot, Survey No. 42"
                value={form.title}
                onChange={set("title")}
                required
              />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea
                className="input-field min-h-22.5 resize-none"
                placeholder="Describe the land — current use, features, any structures..."
                value={form.description}
                onChange={set("description")}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Land Type *</label>
                <select
                  className="input-field"
                  value={form.landType}
                  onChange={set("landType")}
                >
                  {LAND_TYPES.map((t) => (
                    <option
                      key={t}
                      value={t}
                      className="capitalize bg-slate-900"
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Area (sq. meters) *</label>
                <input
                  className="input-field"
                  type="number"
                  min="1"
                  placeholder="e.g. 10000"
                  value={form.areaInSqMeters}
                  onChange={set("areaInSqMeters")}
                />
                {form.areaInSqMeters && (
                  <p className="text-xs text-slate-500 mt-1">
                    ≈ {(form.areaInSqMeters / 10000).toFixed(3)} hectares
                  </p>
                )}
              </div>
            </div>
            <div>
              <label className="label">
                Listing Price in ETH{" "}
                <span className="text-slate-600 font-normal">
                  (optional — leave blank if not for sale)
                </span>
              </label>
              <input
                className="input-field"
                type="number"
                step="0.001"
                min="0"
                placeholder="e.g. 0.5"
                value={form.listingPrice}
                onChange={set("listingPrice")}
              />
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {[
                ["state", "State *", "e.g. Maharashtra"],
                ["district", "District *", "e.g. Pune"],
                ["village", "Village", "e.g. Hadapsar"],
                ["pincode", "Pincode", "e.g. 411028"],
              ].map(([k, lbl, placeholder]) => (
                <div key={k}>
                  <label className="label">{lbl}</label>
                  <input
                    className="input-field"
                    placeholder={placeholder}
                    value={form.location[k]}
                    onChange={setLoc(k)}
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="label">Full Address</label>
              <textarea
                className="input-field resize-none min-h-20"
                placeholder="Complete postal address of the land..."
                value={form.location.fullAddress}
                onChange={setLoc("fullAddress")}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-2">
            <div className="flex items-start gap-2 p-3 bg-earth-500/8 border border-earth-500/20 rounded-lg mb-4">
              <FiInfo className="text-earth-400 shrink-0 mt-0.5 text-sm" />
              <div className="text-xs text-earth-300/80 leading-relaxed">
                <strong className="text-earth-300">
                  How satellite verification works:
                </strong>{" "}
                Once you draw the boundary, our AI will fetch a recent satellite
                image (Sentinel-2) of this exact area and analyze it to verify
                land type, detect encroachments, and assign a verification
                score. The government authority will then see this score before
                approving.
              </div>
            </div>
            <ParcelDrawer
              onBoundariesChange={setBoundaries}
              onCenterChange={setCenter}
              onAreaChange={(sqm) => {
                if (sqm > 0)
                  setForm((p) => ({ ...p, areaInSqMeters: sqm.toString() }));
              }}
            />
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Upload supporting documents. These will be stored on IPFS and the
              hash recorded on the blockchain.
            </p>
            <label
              className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed
                            border-slate-700 rounded-xl cursor-pointer hover:border-earth-600 transition-colors group"
            >
              <div
                className="w-10 h-10 rounded-xl bg-slate-800 group-hover:bg-earth-500/10 flex items-center
                            justify-center transition-colors"
              >
                <FiUpload className="text-slate-500 group-hover:text-earth-400 text-lg transition-colors" />
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                  Click to upload documents
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  Sale deed, survey map, mutation records — PDF, JPG, PNG up to
                  10MB
                </p>
              </div>
              <input
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files))}
              />
            </label>

            {files.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                  Selected Files
                </p>
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm bg-slate-800 px-4 py-2.5 rounded-lg"
                  >
                    <span className="text-lg">📄</span>
                    <span className="text-slate-300 flex-1 truncate">
                      {f.name}
                    </span>
                    <span className="text-slate-600 text-xs font-mono shrink-0">
                      {(f.size / 1024).toFixed(0)} KB
                    </span>
                    <button
                      onClick={() =>
                        setFiles((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="card p-5 space-y-3">
              <h3 className="font-display text-lg text-slate-100 mb-4">
                Review Your Submission
              </h3>
              {[
                ["Parcel Title", form.title || "—"],
                ["Land Type", form.landType],
                [
                  "Area",
                  form.areaInSqMeters
                    ? `${Number(form.areaInSqMeters).toLocaleString()} sqm (${(form.areaInSqMeters / 10000).toFixed(3)} ha)`
                    : "—",
                ],
                [
                  "Location",
                  `${form.location.village ? form.location.village + ", " : ""}${form.location.district}, ${form.location.state}`,
                ],
                ["Pincode", form.location.pincode || "—"],
                [
                  "Boundary",
                  boundaries.length > 0
                    ? `✅ ${boundaries.length} GPS points drawn`
                    : "⚠️ Not drawn",
                ],
                [
                  "GPS Center",
                  center
                    ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`
                    : "—",
                ],
                [
                  "Documents",
                  files.length > 0
                    ? `${files.length} file(s) selected`
                    : "None",
                ],
                [
                  "Listing Price",
                  form.listingPrice ? `${form.listingPrice} ETH` : "Not listed",
                ],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex items-start justify-between text-sm py-2 border-b border-slate-800 last:border-0"
                >
                  <span className="text-slate-500 shrink-0 w-36">{k}</span>
                  <span className="text-slate-200 font-medium text-right">
                    {v}
                  </span>
                </div>
              ))}
            </div>

            <div className="p-4 bg-slate-800/60 border border-slate-700/50 rounded-xl text-sm text-slate-400 leading-relaxed space-y-2">
              <p className="flex items-center gap-2 text-slate-300 font-medium">
                <span>🛰️</span> What happens after submission:
              </p>
              <ol className="space-y-1.5 pl-6 list-decimal text-xs">
                <li>Land record saved to MongoDB with your drawn boundary</li>
                <li>
                  AI fetches Sentinel-2 satellite image of your coordinates
                </li>
                <li>CNN model analyzes land type & detects encroachments</li>
                <li>Verification score (0–100) stored in DB</li>
                <li>Government authority reviews score + satellite image</li>
                <li>On approval → Land NFT minted on blockchain (Phase 4)</li>
              </ol>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`page-wrapper page-enter ${step === 2 ? "max-w-4xl" : "max-w-2xl"} mx-auto`}
    >
      <div className="mb-8">
        <h1 className="section-title">Register Land Parcel</h1>
        <p className="section-sub">
          Your land will be verified by satellite AI and recorded on blockchain
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center mb-8">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <button
              onClick={() => i < step && setStep(i)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono
                          font-bold shrink-0 transition-all duration-300
                ${
                  i < step
                    ? "bg-earth-500 text-white cursor-pointer hover:bg-earth-400"
                    : i === step
                      ? "bg-earth-500/20 border-2 border-earth-500 text-earth-400"
                      : "bg-slate-800 text-slate-600 cursor-default"
                }`}
            >
              {i < step ? <FiCheckCircle className="text-sm" /> : i + 1}
            </button>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 transition-all duration-300
                ${i < step ? "bg-earth-500" : "bg-slate-800"}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step label */}
      <p className="text-xs text-slate-500 mb-4 font-medium uppercase tracking-wider">
        Step {step + 1} of {STEPS.length} — {STEPS[step]}
      </p>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="card p-6"
        >
          <h2 className="font-display text-xl text-slate-100 mb-5">
            {STEPS[step]}
          </h2>
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="btn-secondary disabled:opacity-40 disabled:cursor-not-allowed"
        >
          ← Back
        </button>

        <div className="flex items-center gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all
              ${i === step ? "bg-earth-400 w-4" : i < step ? "bg-earth-700" : "bg-slate-700"}`}
            />
          ))}
        </div>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading || !boundaries.length}
            className="btn-primary flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              "🔗"
            )}
            {loading ? "Registering on blockchain..." : "Submit & Mint NFT"}
          </button>
        )}
      </div>
    </div>
  );
}
