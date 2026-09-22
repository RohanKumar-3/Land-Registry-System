import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { transactionService } from "../services/transactionService";
import {
  approveNFTForTransfer,
  buyParcel,
  sellerApproveOnChain,
  governmentApproveOnChain,
} from "../services/blockchainService";
import { useWeb3 } from "../context/Web3Context";
import { landService } from "../services/landService";
import { useAuth } from "../context/AuthContext";
import MapView from "../components/map/MapView";
import LoadingSpinner from "../components/common/LoadingSpinner";
import WalletGuard from "../components/common/WalletGuard";
import toast from "react-hot-toast";
import {
  FiMapPin,
  FiUser,
  FiCalendar,
  FiShield,
  FiRefreshCw,
  FiCheck,
  FiCheckCircle,
  FiAlertTriangle,
  FiMaximize2,
  FiArrowLeft,
  FiExternalLink,
  FiTag,
} from "react-icons/fi";
import { FaSatellite } from "react-icons/fa";
import { motion } from "framer-motion";

// ── Score helpers ─────────────────────────────────────────────────────────────
const scoreColor = (s) =>
  s >= 70 ? "text-green-400" : s >= 40 ? "text-yellow-400" : "text-red-400";

const scoreBg = (s) =>
  s >= 70
    ? "bg-forest-700/20 border-forest-600/30 text-green-300"
    : s >= 40
      ? "bg-yellow-900/20 border-yellow-700/30 text-yellow-300"
      : "bg-red-900/20 border-red-700/30 text-red-300";

const scoreGradient = (s) =>
  s >= 70
    ? "from-forest-600 to-green-400"
    : s >= 40
      ? "from-yellow-700 to-yellow-400"
      : "from-red-800 to-red-400";

const scoreMessage = (s) =>
  s >= 70
    ? "✅ Land type matches claim. No encroachments detected. Ready for government approval."
    : s >= 40
      ? "⚠️ Minor discrepancies found. Government review required before approval."
      : "❌ Significant issues detected. Manual inspection recommended.";

// ─────────────────────────────────────────────────────────────────────────────

export default function ParcelDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { account, connectWallet } = useWeb3();

  const [parcel, setParcel] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [approving, setApproving] = useState(false);
  const [buying, setBuying] = useState(false);
  const [myTxn, setMyTxn] = useState(null);
  // ── NEW: seller approve loading state ─────────────────────────────────────
  const [sellerApproving, setSellerApproving] = useState(false);

  // ── List for sale state ───────────────────────────────────────────────────
  const [listingPrice, setListingPrice] = useState("");
  const [listing, setListing] = useState(false);

  // ── Fetch parcel + poll until ML score arrives ────────────────────────────
  useEffect(() => {
    let interval = null;

    const fetchParcel = async () => {
      try {
        const { data } = await landService.getById(id);
        setParcel(data.parcel);
        if (data.parcel.verificationScore !== null) clearInterval(interval);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const fetchActiveTransaction = async () => {
      try {
        const { data } = await transactionService.getMy();
        const active = data.transactions?.find(
          (t) => t.parcel?._id === id || t.parcel === id,
        );
        if (active) setMyTxn(active);
      } catch {}
    };

    landService
      .getLogs(id)
      .then((r) => setLogs(r.data.logs || []))
      .catch(() => {});

    fetchParcel();
    fetchActiveTransaction();

    interval = setInterval(async () => {
      try {
        const { data } = await landService.getById(id);
        if (data.parcel) {
          setParcel(data.parcel);
          if (data.parcel.verificationScore !== null) clearInterval(interval);
        }
      } catch {}
    }, 4000);

    return () => clearInterval(interval);
  }, [id]);

  // ── Re-trigger ML verification ────────────────────────────────────────────
  const handleVerify = async () => {
    setVerifying(true);
    try {
      await landService.triggerVerify(id);
      toast.success("Verification triggered! Results update shortly.");
      const [p, l] = await Promise.all([
        landService.getById(id),
        landService.getLogs(id),
      ]);
      setParcel(p.data.parcel);
      setLogs(l.data.logs || []);
    } catch {
      toast.error("Verification failed. Check ML service is running.");
    } finally {
      setVerifying(false);
    }
  };

  // ── Government approve & mint NFT ─────────────────────────────────────────
  const handleGovApprove = async () => {
    if (!account) {
      toast.error("Connect your MetaMask wallet before approving.");
      return;
    }
    setApproving(true);
    try {
      await landService.govApprove(id);
      toast.success("Parcel approved! NFT being minted on blockchain.");
      const { data } = await landService.getById(id);
      setParcel(data.parcel);
    } catch (err) {
      toast.error(err.response?.data?.message || "Approval failed");
    } finally {
      setApproving(false);
    }
  };

  // ── List parcel for sale ──────────────────────────────────────────────────
  const handleListForSale = async () => {
    if (!listingPrice || Number(listingPrice) <= 0) {
      toast.error("Enter a valid price in ETH");
      return;
    }
    if (!account) {
      toast.error("Connect your MetaMask wallet first");
      return;
    }
    setListing(true);
    try {
      toast("Step 1/2: Approve NFT in MetaMask...", { icon: "🔑" });
      await approveNFTForTransfer(parcel.tokenId);
      toast.success("NFT approved!");

      toast("Step 2/2: Listing on marketplace...", { icon: "🏷️" });
      await landService.listForSale(parcel._id, {
        listingPrice: Number(listingPrice),
      });

      toast.success("Parcel listed for sale!");
      const { data } = await landService.getById(id);
      setParcel(data.parcel);
      setListingPrice("");
    } catch (err) {
      if (err.code === 4001) toast.error("MetaMask: Transaction rejected");
      else toast.error(err.message || "Listing failed");
    } finally {
      setListing(false);
    }
  };

  // ── Buy parcel ────────────────────────────────────────────────────────────
  const handleBuy = async () => {
    if (!account) {
      const addr = await connectWallet();
      if (!addr) return;
    }
    setBuying(true);
    try {
      toast("Confirm payment in MetaMask...", { icon: "💰" });
      const { hash, escrowId } = await buyParcel(
        parcel.tokenId,
        parcel.listingPrice,
      );

      if (!escrowId) {
        toast.error("Could not get escrowId from contract event");
        return;
      }

      const { data } = await transactionService.initiate({
        parcelId: parcel._id,
        offeredPrice: parcel.listingPrice,
        escrowId,
        txHash: hash,
      });

      setMyTxn(data.transaction);
      toast.success(`Purchase initiated! Escrow #${escrowId} created.`);
    } catch (err) {
      if (err.code === 4001) toast.error("MetaMask: Transaction rejected");
      else
        toast.error(
          err.response?.data?.message || err.message || "Purchase failed",
        );
    } finally {
      setBuying(false);
    }
  };

  // ── NEW: Seller approves sale — on-chain first, then DB ───────────────────
  const handleSellerApprove = async () => {
    if (!myTxn?._id) {
      toast.error("Transaction not found — refresh the page");
      return;
    }

    // contractEscrowId is saved to DB when buyer initiates purchase
    if (!myTxn?.contractEscrowId) {
      toast.error("Escrow ID not found. The buyer may need to re-initiate.");
      return;
    }

    if (!account) {
      toast.error("Connect your MetaMask wallet first");
      return;
    }

    setSellerApproving(true);
    try {
      // Step 1: Seller signs on-chain (MetaMask popup)
      // This calls sellerApprove(escrowId) on TransferContract
      toast("Confirm approval in MetaMask...", { icon: "✍️" });
      const txHash = await sellerApproveOnChain(myTxn.contractEscrowId);

      // Step 2: Mirror in DB
      await transactionService.sellerApprove(myTxn._id, { txHash });
      toast.success("You approved the sale on-chain! ✅");

      // Step 3: Refresh parcel + transaction state
      const [parcelRes, txnRes] = await Promise.all([
        landService.getById(id),
        transactionService.getMy(),
      ]);
      setParcel(parcelRes.data.parcel);
      const active = txnRes.data.transactions?.find(
        (t) => t.parcel?._id === id || t.parcel === id,
      );
      if (active) setMyTxn(active);
    } catch (err) {
      if (err.code === 4001) toast.error("MetaMask: Transaction rejected");
      else
        toast.error(
          err.response?.data?.message || err.message || "Approval failed",
        );
    } finally {
      setSellerApproving(false);
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (loading) return <LoadingSpinner text="Loading parcel details..." />;
  if (!parcel)
    return (
      <div className="page-wrapper text-center text-slate-400 py-20">
        <p className="text-2xl mb-4">🗺️</p>
        <p>Parcel not found</p>
        <button
          onClick={() => navigate(-1)}
          className="btn-secondary mt-4 inline-flex gap-2"
        >
          <FiArrowLeft /> Go back
        </button>
      </div>
    );

  const isOwner = user?._id === parcel.owner?._id;
  const isGov = user?.role === "government";

  const canList =
    isOwner &&
    parcel.governmentApproved &&
    parcel.isOnChain &&
    !parcel.isListed;

  return (
    <div className="page-wrapper page-enter space-y-6 max-w-7xl">
      {/* ── Back + Header ──────────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300
                     transition-colors mb-4"
        >
          <FiArrowLeft className="text-xs" /> Back
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="section-title">{parcel.title}</h1>
            <p className="font-mono text-xs text-slate-500 mt-1">
              {parcel.parcelId}
            </p>
          </div>
          {isGov && (
            <button
              onClick={handleVerify}
              disabled={verifying}
              className="btn-secondary flex items-center gap-2 text-sm"
            >
              <FiRefreshCw className={verifying ? "animate-spin" : ""} />
              {verifying ? "Re-verifying..." : "Re-verify (AI)"}
            </button>
          )}
        </div>
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* ═══════════════════ LEFT COLUMN ══════════════════════════════ */}
        <div className="lg:col-span-1 space-y-4">
          {/* Status card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-5 space-y-4"
          >
            <h2 className="font-display text-base text-slate-200">Status</h2>
            <div className="space-y-3">
              {[
                {
                  label: "Verification",
                  value: parcel.verificationStatus,
                  badge: true,
                },
                {
                  label: "Gov. Approved",
                  value: parcel.governmentApproved ? "Yes ✅" : "Pending",
                },
                {
                  label: "On Blockchain",
                  value: parcel.isOnChain ? "Yes ⛓️" : "No",
                },
                {
                  label: "For Sale",
                  value: parcel.isListed ? `${parcel.listingPrice} ETH` : "No",
                },
              ].map(({ label, value, badge }) => (
                <div
                  key={label}
                  className="flex justify-between items-center text-sm"
                >
                  <span className="text-slate-500">{label}</span>
                  {badge ? (
                    <span className={`badge badge-${value}`}>{value}</span>
                  ) : (
                    <span className="text-slate-300 font-medium">{value}</span>
                  )}
                </div>
              ))}
            </div>

            {parcel.verificationScore !== null ? (
              <div>
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>AI Score</span>
                  <span
                    className={`font-mono font-bold ${scoreColor(parcel.verificationScore)}`}
                  >
                    {parcel.verificationScore}/100
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-linear-to-r ${scoreGradient(parcel.verificationScore)} transition-all duration-700`}
                    style={{ width: `${parcel.verificationScore}%` }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-3 h-3 border border-slate-600 border-t-earth-400 rounded-full animate-spin" />
                AI verification in progress...
              </div>
            )}
          </motion.div>

          {/* Land details */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="card p-5 space-y-3"
          >
            <h2 className="font-display text-base text-slate-200">Details</h2>
            {[
              {
                icon: FiMapPin,
                label: `${parcel.location?.district}, ${parcel.location?.state}`,
              },
              { icon: FiUser, label: parcel.owner?.name },
              {
                icon: FiCalendar,
                label: new Date(parcel.createdAt).toLocaleDateString("en-IN", {
                  dateStyle: "long",
                }),
              },
              {
                icon: FiMaximize2,
                label: `${(parcel.areaInSqMeters / 10000).toFixed(3)} hectares`,
              },
              {
                icon: FiShield,
                label:
                  parcel.landType?.charAt(0).toUpperCase() +
                  parcel.landType?.slice(1),
              },
            ].map(({ icon: Icon, label }, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm text-slate-400"
              >
                <Icon className="text-earth-500 shrink-0" />
                <span>{label}</span>
              </div>
            ))}
            {parcel.description && (
              <p className="text-xs text-slate-500 pt-2 border-t border-slate-800 leading-relaxed">
                {parcel.description}
              </p>
            )}
          </motion.div>

          {/* Documents */}
          {parcel.documents?.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14 }}
              className="card p-5"
            >
              <h2 className="font-display text-base text-slate-200 mb-3">
                Documents
              </h2>
              <div className="space-y-2">
                {parcel.documents.map((doc, i) => (
                  <a
                    key={i}
                    href={`https://gateway.pinata.cloud/ipfs/${doc.ipfsHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-earth-400 hover:text-earth-300
                               bg-slate-800 px-3 py-2 rounded-lg transition-colors"
                  >
                    <span>📄</span>
                    <span className="flex-1 truncate">{doc.name}</span>
                    <FiExternalLink className="text-xs shrink-0" />
                  </a>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* ═══════════════════ RIGHT COLUMN ═════════════════════════════ */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <MapView
              parcels={[parcel]}
              center={parcel.centerPoint}
              height="340px"
              showLocate={true}
            />
          </motion.div>

          {/* Satellite Image */}
          {parcel.satelliteImageUrl && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="card overflow-hidden"
            >
              <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                <FaSatellite className="text-earth-400" />
                <h3 className="font-display text-base text-slate-200">
                  Satellite View
                </h3>
                <span className="text-xs text-slate-500 ml-auto font-mono">
                  via Sentinel-2 (GEE)
                </span>
              </div>
              <img
                src={parcel.satelliteImageUrl}
                alt="Satellite imagery of land parcel"
                className="w-full h-64 object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
              <div className="px-4 py-2.5 bg-slate-800/40 text-xs text-slate-500">
                Fetched at time of AI verification · Used to detect land use
                &amp; encroachments
              </div>
            </motion.div>
          )}

          {/* AI Analysis Result */}
          {parcel.verificationScore !== null && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="card p-5"
            >
              <h3 className="font-display text-base text-slate-200 mb-4 flex items-center gap-2">
                🤖 AI Analysis Result
                {parcel.lastVerifiedAt && (
                  <span className="text-xs text-slate-600 font-body font-normal ml-auto">
                    Last checked:{" "}
                    {new Date(parcel.lastVerifiedAt).toLocaleDateString()}
                  </span>
                )}
              </h3>
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Verification Score</span>
                  <span
                    className={`font-mono font-bold text-lg ${scoreColor(parcel.verificationScore)}`}
                  >
                    {parcel.verificationScore}/100
                  </span>
                </div>
                <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-linear-to-r ${scoreGradient(parcel.verificationScore)} transition-all duration-700`}
                    style={{ width: `${parcel.verificationScore}%` }}
                  />
                </div>
              </div>
              <div
                className={`flex items-start gap-2 p-3 rounded-lg text-xs border ${scoreBg(parcel.verificationScore)}`}
              >
                {scoreMessage(parcel.verificationScore)}
              </div>
              {parcel.verificationNotes && (
                <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-800">
                  {parcel.verificationNotes}
                </p>
              )}
            </motion.div>
          )}

          {/* Government Approval Panel */}
          {isGov && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="card p-5"
            >
              <h3 className="font-display text-base text-slate-200 mb-3 flex items-center gap-2">
                <FiShield className="text-earth-400" /> Government Approval
              </h3>
              {parcel.governmentApproved ? (
                <div className="flex items-center gap-3 p-3 bg-forest-700/20 border border-forest-600/30 rounded-lg">
                  <FiCheckCircle className="text-green-400 text-xl shrink-0" />
                  <div>
                    <p className="text-green-300 text-sm font-medium">
                      Approved ✅
                    </p>
                    <p className="text-green-600 text-xs mt-0.5">
                      By {parcel.approvedBy?.name || "Government Authority"} ·{" "}
                      {parcel.approvedAt
                        ? new Date(parcel.approvedAt).toLocaleDateString(
                            "en-IN",
                            { dateStyle: "long" },
                          )
                        : ""}
                    </p>
                  </div>
                </div>
              ) : (
                <WalletGuard action="Connect your wallet to approve parcels and mint land NFTs.">
                  <div className="space-y-3">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Review the AI score and satellite image above. Approving
                      will trigger the land NFT to be minted on the blockchain —
                      this action is irreversible.
                    </p>
                    {parcel.verificationScore !== null &&
                      parcel.verificationScore < 40 && (
                        <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-700/30 rounded-lg text-xs text-red-300">
                          <FiAlertTriangle className="shrink-0 mt-0.5" />
                          Low AI score — consider requesting re-verification or
                          physical inspection first.
                        </div>
                      )}
                    <button
                      onClick={handleGovApprove}
                      disabled={approving}
                      className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                    >
                      {approving ? (
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <FiCheckCircle />
                      )}
                      {approving
                        ? "Minting NFT on blockchain..."
                        : "Approve & Mint Land NFT"}
                    </button>
                    <button
                      onClick={handleVerify}
                      disabled={verifying}
                      className="btn-secondary w-full flex items-center justify-center gap-2 text-sm"
                    >
                      <FiRefreshCw
                        className={verifying ? "animate-spin" : ""}
                      />
                      {verifying
                        ? "Re-verifying via satellite..."
                        : "Request Re-verification"}
                    </button>
                  </div>
                </WalletGuard>
              )}
            </motion.div>
          )}

          {/* List for Sale Panel */}
          {canList && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card p-5"
            >
              <h3 className="font-display text-base text-slate-200 mb-3 flex items-center gap-2">
                <FiTag className="text-earth-400" /> List Parcel for Sale
              </h3>
              
                <div className="space-y-3">
                  <p className="text-xs text-slate-400">
                    Your parcel has been approved and minted as an NFT. Set a
                    price to list it on the marketplace.
                  </p>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">
                      Price in ETH
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        placeholder="e.g. 0.5"
                        value={listingPrice}
                        onChange={(e) => setListingPrice(e.target.value)}
                        className="input flex-1 font-mono"
                      />
                      <WalletGuard action="list this parcel for sale">
                      <button
                        onClick={handleListForSale}
                        disabled={listing || !listingPrice}
                        className="btn-primary text-sm px-4 disabled:opacity-40"
                      >
                        {listing ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                        ) : (
                          "🏷️ List"
                        )}
                      </button>
                      </WalletGuard>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600">
                    Once listed, buyers can view and purchase your parcel from
                    the marketplace.
                  </p>
                </div>
              
            </motion.div>
          )}

          {/* Currently listed — price display for owner */}
          {isOwner && parcel.isListed && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4 border-earth-500/20 bg-earth-500/5"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">
                  Listed for sale at
                </span>
                <span className="font-mono text-earth-400 text-lg font-bold">
                  {parcel.listingPrice} ETH
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                Visible to all buyers in the marketplace
              </p>
            </motion.div>
          )}

          {/* Buy Panel */}
          {parcel.isListed && user && !isOwner && !isGov && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="card p-5"
            >
              <h3 className="font-display text-base text-slate-200 mb-3 flex items-center gap-2">
                🛒 Purchase This Land
              </h3>
              
                <div className="space-y-3">
                  {/* ── ADD THIS — show status if already bought ─────────────── */}
                  {myTxn ? (
                    <div
                      className="flex items-center gap-3 p-4 bg-forest-700/20
                          border border-forest-600/30 rounded-lg"
                    >
                      <FiCheckCircle className="text-green-400 text-xl shrink-0" />
                      <div>
                        <p className="text-green-300 text-sm font-medium">
                          Purchase Initiated ✅
                        </p>
                        <p className="text-green-600 text-xs mt-0.5">
                          Escrow #{myTxn.contractEscrowId} · Waiting for seller
                          approval
                        </p>
                        <p className="font-mono text-xs text-slate-600 mt-1 truncate">
                          {myTxn.blockchainTxHash?.slice(0, 20)}...
                        </p>
                      </div>
                    </div>
                  ) : (
                    // ── Original buy UI — only shown if no active transaction ──
                    <>
                      <div
                        className="flex items-center justify-between p-3
                            bg-earth-500/10 border border-earth-500/20 rounded-lg"
                      >
                        <span className="text-slate-400 text-sm">
                          Listing Price
                        </span>
                        <span className="text-earth-400 font-mono text-xl font-bold">
                          {parcel.listingPrice} ETH
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1">
                        <p>
                          Token ID:{" "}
                          <span className="font-mono text-slate-400">
                            {parcel.tokenId || "Pending mint"}
                          </span>
                        </p>
                        <p>
                          Area:{" "}
                          <span className="text-slate-400">
                            {(parcel.areaInSqMeters / 10000).toFixed(3)}{" "}
                            hectares
                          </span>
                        </p>
                        <p>
                          Owner:{" "}
                          <span className="text-slate-400">
                            {parcel.owner?.name}
                          </span>
                        </p>
                      </div>

                      {!parcel.isOnChain && (
                        <div
                          className="flex items-center gap-2 p-3 bg-slate-800
                              rounded-lg text-xs text-slate-400"
                        >
                          ℹ️ NFT not yet minted — cannot purchase until
                          government approves
                        </div>
                      )}
                      <WalletGuard action="purchase this parcel">
                      <button
                        onClick={handleBuy}
                        disabled={buying || !parcel.isOnChain}
                        className="btn-primary w-full flex items-center justify-center
                         gap-2 text-sm disabled:opacity-40"
                      >
                        {buying ? (
                          <span
                            className="w-4 h-4 border-2 border-white/30
                                   border-t-white rounded-full animate-spin"
                          />
                        ) : (
                          "💰"
                        )}
                        {buying
                          ? "Processing on blockchain..."
                          : `Buy for ${parcel.listingPrice} ETH`}
                      </button>
                      </WalletGuard>
                      <p className="text-xs text-slate-600 text-center">
                        Funds held in smart contract escrow until all parties
                        approve
                      </p>
                    </>
                  )}
                </div>
              
            </motion.div>
          )}

          {/* ── Seller Pending Sale Panel ─────────────────────────────────────
               THIS IS THE SECTION THAT WAS CHANGED — uses handleSellerApprove  */}
          {isOwner && parcel.status === "under_transfer" && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-5 border-yellow-700/30 bg-yellow-900/5"
            >
              <h3 className="font-display text-base text-slate-200 mb-3">
                📋 Pending Sale
              </h3>

              {myTxn?.sellerApproved ? (
                // Already approved on-chain — show status
                <div className="flex items-center gap-3 p-3 bg-forest-700/20 border border-forest-600/30 rounded-lg">
                  <FiCheckCircle className="text-green-400 text-xl shrink-0" />
                  <div>
                    <p className="text-green-300 text-sm font-medium">
                      You approved the sale ✅
                    </p>
                    <p className="text-green-600 text-xs mt-0.5">
                      Waiting for government approval to complete transfer
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-400 mb-3">
                    A buyer has initiated purchase of your land. Approving will
                    sign a transaction on Sepolia — MetaMask will open.
                  </p>

                  {/* Show escrow ID for transparency */}
                  {myTxn?.contractEscrowId && (
                    <p className="text-xs text-slate-600 font-mono mb-3">
                      Escrow #{myTxn.contractEscrowId} · {myTxn.price} ETH
                      locked in contract
                    </p>
                  )}

                  {/* Warning if no escrow ID */}
                  {!myTxn?.contractEscrowId && (
                    <div className="p-3 bg-red-900/20 border border-red-700/30 rounded-lg text-xs text-red-300 mb-3">
                      ⚠️ No escrow ID found. The buyer may need to re-initiate
                      the purchase.
                    </div>
                  )}

                  {/* ── THE CHANGED BUTTON — now calls handleSellerApprove ── */}
                  <WalletGuard action="approve this sale">
                  <button
                    onClick={handleSellerApprove}
                    disabled={sellerApproving || !myTxn?.contractEscrowId}
                    className="btn-primary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {sellerApproving ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <FiCheckCircle />
                    )}
                    {sellerApproving
                      ? "Signing on blockchain..."
                      : "✅ Approve Sale (Sign in MetaMask)"}
                  </button>
                  </WalletGuard>
                </>
              )}
            </motion.div>
          )}

          {/* Blockchain Record */}
          {parcel.isOnChain && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="card p-5"
            >
              <h3 className="font-display text-base text-slate-200 mb-3 flex items-center gap-2">
                ⛓️ Blockchain Record
              </h3>
              <div className="space-y-3">
                {[
                  ["Token ID", parcel.tokenId],
                  ["Tx Hash", parcel.blockchainTxHash],
                  ["IPFS Docs", parcel.ipfsDocumentHash],
                  ["Network", "Sepolia Testnet"],
                ].map(([k, v]) =>
                  v ? (
                    <div key={k}>
                      <p className="text-xs text-slate-500 mb-1">{k}</p>
                      <div className="flex items-center gap-2">
                        <p className="font-mono text-xs text-earth-400 break-all bg-slate-800 px-3 py-2 rounded-lg flex-1">
                          {v}
                        </p>
                        {(k === "Tx Hash" || k === "Token ID") && (
                          <a
                            href={`https://sepolia.etherscan.io/${k === "Tx Hash" ? "tx" : "token"}/${v}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-500 hover:text-earth-400 transition-colors p-2"
                          >
                            <FiExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  ) : null,
                )}
              </div>
            </motion.div>
          )}

          {/* Verification History */}
          {logs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="card p-5"
            >
              <h3 className="font-display text-base text-slate-200 mb-4">
                Verification History
                <span className="text-xs text-slate-600 font-body font-normal ml-2">
                  ({logs.length} check{logs.length !== 1 ? "s" : ""})
                </span>
              </h3>
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log._id}
                    className="flex items-start justify-between bg-slate-800/50 rounded-lg p-3 text-sm"
                  >
                    <div className="space-y-1">
                      <p className="text-slate-300 capitalize font-medium">
                        {log.triggeredBy} verification
                      </p>
                      <p className="text-slate-600 text-xs">
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                      {log.detectedLandType && (
                        <p className="text-xs text-slate-500">
                          Detected:{" "}
                          <span className="text-slate-400 capitalize">
                            {log.detectedLandType}
                          </span>
                        </p>
                      )}
                      {log.encroachmentDetected && (
                        <p className="text-red-400 text-xs">
                          ⚠ Encroachment detected
                        </p>
                      )}
                      {log.boundaryMismatch && (
                        <p className="text-yellow-400 text-xs">
                          ⚠ Boundary mismatch
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span
                        className={`font-mono text-base font-bold ${scoreColor(log.score)}`}
                      >
                        {log.score ?? "—"}/100
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          log.status === "success"
                            ? "bg-forest-700/20 text-green-500"
                            : log.status === "failed"
                              ? "bg-red-900/20 text-red-400"
                              : "bg-slate-700 text-slate-500"
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
          {/* ── Ownership History ────────────────────────────────────── */}
          {(parcel.previousOwners?.length > 0 || parcel.isOnChain) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 }}
              className="card p-5"
            >
              <h3 className="font-display text-base text-slate-200 mb-4 flex items-center gap-2">
                🏛️ Ownership History
                <span className="text-xs text-slate-600 font-body font-normal ml-auto">
                  Full chain of title
                </span>
              </h3>

              <div className="relative">
                {/* Vertical timeline line */}
                <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-700" />

                <div className="space-y-0">

                  {/* ── Original registration ──────────────────────── */}
                  <div className="relative flex gap-4 pb-4">
                    <div className="w-7 h-7 rounded-full bg-earth-500/20 border-2 border-earth-500
                                    flex items-center justify-center shrink-0 z-10">
                      <span className="text-xs">🏗️</span>
                    </div>
                    <div className="flex-1 bg-slate-800/40 rounded-lg p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300 font-medium">Land Registered</span>
                        <span className="text-slate-600">
                          {new Date(parcel.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Original owner:</span>
                        <span className="text-earth-400 font-medium">
                          {parcel.previousOwners?.length > 0
                            ? parcel.previousOwners[0]?.user?.name || 'Unknown'
                            : parcel.owner?.name}
                        </span>
                      </div>
                      {parcel.blockchainTxHash && (
                        <a
                          href={`https://sepolia.etherscan.io/tx/${parcel.blockchainTxHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-earth-500 hover:text-earth-400 font-mono"
                        >
                          Mint tx: {parcel.blockchainTxHash.slice(0, 14)}...
                          <FiExternalLink className="text-xs" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* ── Government approval ────────────────────────── */}
                  {parcel.governmentApproved && (
                    <div className="relative flex gap-4 pb-4">
                      <div className="w-7 h-7 rounded-full bg-blue-500/20 border-2 border-blue-500
                                      flex items-center justify-center shrink-0 z-10">
                        <span className="text-xs">🏛️</span>
                      </div>
                      <div className="flex-1 bg-slate-800/40 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 font-medium">Government Approved & NFT Minted</span>
                          <span className="text-slate-600">
                            {parcel.approvedAt
                              ? new Date(parcel.approvedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                              : '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">Approved by:</span>
                          <span className="text-blue-400 font-medium">
                            {parcel.approvedBy?.name || 'Government Authority'}
                          </span>
                        </div>
                        {parcel.tokenId && (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">Token ID:</span>
                            <a
                              href={`https://sepolia.etherscan.io/token/${parcel.tokenId}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-earth-400 hover:text-earth-300 font-mono flex items-center gap-1"
                            >
                              #{parcel.tokenId}
                              <FiExternalLink className="text-xs" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Previous transfers ─────────────────────────── */}
                  {parcel.previousOwners?.map((prev, i) => (
                    <div key={i} className="relative flex gap-4 pb-4">
                      <div className="w-7 h-7 rounded-full bg-purple-500/20 border-2 border-purple-500
                                      flex items-center justify-center shrink-0 z-10">
                        <span className="text-xs">🔄</span>
                      </div>
                      <div className="flex-1 bg-slate-800/40 rounded-lg p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-300 font-medium">
                            Ownership Transferred
                          </span>
                          <span className="text-slate-600">
                            {prev.transferredAt
                              ? new Date(prev.transferredAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })
                              : '—'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500">From:</span>
                          <span className="text-purple-400 font-medium">
                            {prev.user?.name || `Owner #${i + 1}`}
                          </span>
                        </div>
                        {prev.user?.walletAddress && (
                          <a
                            href={`https://sepolia.etherscan.io/address/${prev.user.walletAddress}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-slate-500 hover:text-earth-400 font-mono"
                          >
                            {prev.user.walletAddress.slice(0, 16)}...
                            <FiExternalLink className="text-xs" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* ── Current owner ──────────────────────────────── */}
                  <div className="relative flex gap-4">
                    <div className="w-7 h-7 rounded-full bg-green-500/20 border-2 border-green-400
                                    flex items-center justify-center shrink-0 z-10">
                      <span className="text-xs">👤</span>
                    </div>
                    <div className="flex-1 bg-green-900/10 border border-green-700/20 rounded-lg p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-green-300 font-medium">Current Owner</span>
                        <span className="text-green-600 text-xs">Now</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500">Owner:</span>
                        <span className="text-green-400 font-medium">{parcel.owner?.name}</span>
                      </div>
                      {parcel.owner?.walletAddress && (
                        <a
                          href={`https://sepolia.etherscan.io/address/${parcel.owner.walletAddress}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-slate-500 hover:text-earth-400 font-mono"
                        >
                          {parcel.owner.walletAddress.slice(0, 16)}...
                          <FiExternalLink className="text-xs" />
                        </a>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Total transfers count */}
              {parcel.previousOwners?.length > 0 && (
                <p className="text-xs text-slate-600 mt-3 text-center border-t border-slate-800 pt-3">
                  This parcel has changed hands {parcel.previousOwners.length} time{parcel.previousOwners.length !== 1 ? 's' : ''}
                </p>
              )}
            </motion.div>
          )}
        </div>
        {/* ═══════════════════ END RIGHT COLUMN ════════════════════════ */}
      </div>
    </div>
  );
}
