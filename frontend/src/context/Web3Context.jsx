import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { ethers } from 'ethers';
import api from '../services/api';
import toast from 'react-hot-toast';

const Web3Context = createContext(null);

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_HEX      = '0xaa36a7';

export const Web3Provider = ({ children }) => {
  const [account,      setAccount]      = useState(null);
  const [provider,     setProvider]     = useState(null);
  const [signer,       setSigner]       = useState(null);
  const [chainId,      setChainId]      = useState(null);
  const [connecting,   setConnecting]   = useState(false);
  const [wrongNetwork, setWrongNetwork] = useState(false);

  // ── Switch to Sepolia ──────────────────────────────────────────────────
  const switchToSepolia = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: SEPOLIA_HEX }],
      });
      return true;
    } catch (switchErr) {
      if (switchErr.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId:           SEPOLIA_HEX,
              chainName:         'Sepolia Testnet',
              nativeCurrency:    { name: 'SepoliaETH', symbol: 'ETH', decimals: 18 },
              rpcUrls:           ['https://rpc.sepolia.org'],
              blockExplorerUrls: ['https://sepolia.etherscan.io'],
            }],
          });
          return true;
        } catch {
          toast.error('Failed to add Sepolia network to MetaMask');
          return false;
        }
      }
      return false;
    }
  };

  // ── Save wallet address to DB ──────────────────────────────────────────
  const saveWalletToDB = async (address) => {
    try {
      await api.put('/auth/update-wallet', {
        walletAddress: address.toLowerCase()
      });
      console.log('✅ Wallet saved to DB:', address);
    } catch (err) {
      console.warn('⚠️  Could not save wallet to DB:', err.message);
    }
  };

  // ── Connect wallet ─────────────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('MetaMask not installed! Get it at metamask.io');
      return null;
    }

    setConnecting(true);
    try {
      const _provider = new ethers.BrowserProvider(window.ethereum);
      await _provider.send('eth_requestAccounts', []);

      const network = await _provider.getNetwork();

      // Force Sepolia
      if (Number(network.chainId) !== SEPOLIA_CHAIN_ID) {
        toast.loading('Switching to Sepolia network...', { id: 'network' });
        const switched = await switchToSepolia();
        if (!switched) {
          toast.error('Please switch to Sepolia manually in MetaMask', { id: 'network' });
          setConnecting(false);
          setWrongNetwork(true);
          return null;
        }
        toast.success('Switched to Sepolia!', { id: 'network' });
      }

      const finalProvider = new ethers.BrowserProvider(window.ethereum);
      const _signer       = await finalProvider.getSigner();
      const _account      = await _signer.getAddress();
      const finalNetwork  = await finalProvider.getNetwork();

      setProvider(finalProvider);
      setSigner(_signer);
      setAccount(_account);
      setChainId(Number(finalNetwork.chainId));
      setWrongNetwork(false);

      // ── Save to database ─────────────────────────────────────────
      await saveWalletToDB(_account);

      toast.success(`Wallet connected: ${_account.slice(0,6)}...${_account.slice(-4)}`);
      return _account;

    } catch (err) {
      if (err.code === 4001) {
        toast.error('Connection rejected by user');
      } else {
        toast.error('Failed to connect wallet');
      }
      return null;
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = () => {
    setAccount(null);
    setProvider(null);
    setSigner(null);
    setChainId(null);
    toast.success('Wallet disconnected');
  };

  // ── Listen for account/network changes ────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        setAccount(accounts[0]);
        toast('Account changed', { icon: '🔄' });
        // ── Update DB when user switches MetaMask account ──────────
        await saveWalletToDB(accounts[0]);
      }
    };

    const handleChainChanged = (chainIdHex) => {
      const id = parseInt(chainIdHex, 16);
      setChainId(id);
      if (id !== SEPOLIA_CHAIN_ID) {
        setWrongNetwork(true);
        toast.error('Please switch back to Sepolia Testnet');
      } else {
        setWrongNetwork(false);
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged',    handleChainChanged);

    // Cleanup listeners on unmount
    return () => {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged',    handleChainChanged);
    };
  }, []);

  return (
    <Web3Context.Provider value={{
      account, provider, signer, chainId,
      connecting, wrongNetwork,
      connectWallet, disconnect, switchToSepolia,
    }}>
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => useContext(Web3Context);