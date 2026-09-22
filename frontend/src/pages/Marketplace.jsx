import { useEffect, useState } from "react";
import { landService } from "../services/landService";
import LandCard from "../components/common/LandCard";
import MapView from "../components/map/MapView";
import LoadingSpinner from "../components/common/LoadingSpinner";
import { FiSearch, FiFilter } from "react-icons/fi";

const TYPES = [
  "all",
  "agricultural",
  "residential",
  "commercial",
  "industrial",
  "forest",
];

export default function Marketplace() {
  const [parcels, setParcels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [view, setView] = useState("grid");

  useEffect(() => {
    const params = {
      ...(search && { search }),
      ...(type !== "all" && { landType: type }),
    };
    setLoading(true);
    landService
      .getAll(params)
      .then((r) => setParcels(r.data.parcels))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, type]);

  return (
    <div className="page-wrapper page-enter space-y-6">
      <div>
        <h1 className="section-title">Land Registry</h1>
        <p className="section-sub">Browse all registered land parcels</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-50">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input-field pl-9 h-10"
            placeholder="Search parcels..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all
                ${type === t ? "bg-earth-500 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"}`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {["grid", "map"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all
                ${view === v ? "bg-slate-700 text-slate-100" : "text-slate-500 hover:text-slate-300"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingSpinner text="Loading parcels..." />
      ) : view === "map" ? (
        <MapView parcels={parcels} height="600px" />
      ) : parcels.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          No parcels found matching your filters
        </div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>{parcels.length} parcels found</span>
            <span>·</span>
            <span>{parcels.filter((p) => p.isListed).length} for sale</span>
            <span>·</span>
            <span>
              {
                parcels.filter((p) => p.verificationStatus === "verified")
                  .length
              }{" "}
              verified
            </span>
          </div>

          {/* Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {parcels.map((p, i) => (
              <LandCard key={p._id} parcel={p} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
