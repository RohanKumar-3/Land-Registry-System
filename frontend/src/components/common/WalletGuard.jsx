import { useAuth } from '../../context/AuthContext';
import { useWeb3 } from '../../context/Web3Context';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

/**
 * WalletMismatchGuard
 *
 * Wraps any on-chain action button/section.
 * Shows a warning banner if the connected MetaMask wallet
 * does not match the wallet registered in the user's DB account.
 *
 * Usage:
 *   <WalletMismatchGuard>
 *     <button onClick={handleBuy}>Buy</button>
 *   </WalletMismatchGuard>
 *
 * Props:
 *   children   — the content to render (buttons, forms etc.)
 *   action     — short description shown in warning e.g. "purchase this parcel"
 *   blockAction — if true, hides children completely when mismatch (default: false = just warns)
 */
export default function WalletMismatchGuard({
  children,
  action      = 'perform this action',
  blockAction = false,
}) {
  const { user }                        = useAuth();
  const { account, connectWallet, connecting } = useWeb3();

  // ── No wallet connected at all ────────────────────────────────────────────
  if (!account) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 p-3 bg-slate-800/60
                        border border-slate-700 rounded-lg">
          <FiAlertTriangle className="text-yellow-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-yellow-300 text-sm font-medium">Wallet not connected</p>
            <p className="text-slate-500 text-xs mt-0.5">
              Connect your MetaMask wallet to {action}.
            </p>
          </div>
          <button
            onClick={connectWallet}
            disabled={connecting}
            className="btn-primary text-xs px-3 py-1.5 shrink-0"
          >
            {connecting ? (
              <span className="flex items-center gap-1">
                <FiRefreshCw className="animate-spin text-xs" /> Connecting...
              </span>
            ) : 'Connect'}
          </button>
        </div>
        {!blockAction && children}
      </div>
    );
  }

  // ── Wallet connected but doesn't match DB ─────────────────────────────────
  const registeredWallet = user?.walletAddress?.toLowerCase();
  const connectedWallet  = account?.toLowerCase();
  const isMismatch       = registeredWallet && connectedWallet &&
                           registeredWallet !== connectedWallet;

  if (isMismatch) {
    return (
      <div className="space-y-3">
        {/* Warning banner */}
        <div className="flex items-start gap-3 p-4 bg-red-900/20
                        border border-red-700/40 rounded-lg">
          <FiAlertTriangle className="text-red-400 shrink-0 mt-0.5 text-lg" />
          <div className="space-y-2 flex-1">
            <p className="text-red-300 text-sm font-medium">
              Wrong wallet connected
            </p>
            <p className="text-slate-400 text-xs leading-relaxed">
              Your account is registered with a different wallet.
              Switch MetaMask to the correct wallet to {action}.
            </p>

            {/* Show both wallets so user knows which to switch to */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 w-24 shrink-0">Registered:</span>
                <span className="font-mono text-green-400 bg-slate-800 px-2 py-0.5 rounded truncate">
                  {registeredWallet.slice(0, 10)}...{registeredWallet.slice(-6)}
                </span>
                <span className="text-green-600 text-xs">← use this</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 w-24 shrink-0">Connected:</span>
                <span className="font-mono text-red-400 bg-slate-800 px-2 py-0.5 rounded truncate">
                  {connectedWallet.slice(0, 10)}...{connectedWallet.slice(-6)}
                </span>
                <span className="text-red-600 text-xs">← wrong</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 pt-1">
              Open MetaMask → click your account icon → switch to the registered wallet above.
            </p>
          </div>
        </div>

        {/* Show children greyed out if blockAction=false */}
        {!blockAction && (
          <div className="opacity-40 pointer-events-none select-none">
            {children}
          </div>
        )}
      </div>
    );
  }

  // ── All good — wallets match ──────────────────────────────────────────────
  return <>{children}</>;
}
