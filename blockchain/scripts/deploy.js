import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { run } = hre;
const ethers = hre.ethers;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('\n🚀 Starting deployment to Sepolia...\n');

  const [deployer] = await ethers.getSigners();
  const network    = await ethers.provider.getNetwork();

  console.log(`📡 Network:  ${network.name} (chainId: ${network.chainId})`);
  console.log(`👤 Deployer: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance:  ${ethers.formatEther(balance)} ETH`);

  if (ethers.formatEther(balance) < 0.05) {
    console.warn('\n⚠️  Low balance! Get Sepolia ETH from https://sepoliafaucet.com\n');
  }

  console.log('');

  // ── 1. Deploy LandRegistry ───────────────────────────────────────────────
  console.log('📋 Deploying LandRegistry.sol...');
  const LandRegistry = await ethers.getContractFactory('LandRegistry');
  const landRegistry = await LandRegistry.deploy();
  await landRegistry.waitForDeployment();

  const landRegistryAddress = await landRegistry.getAddress();
  console.log(`✅ LandRegistry:     ${landRegistryAddress}`);
  console.log(`   Etherscan: https://sepolia.etherscan.io/address/${landRegistryAddress}`);

  // ── 2. Deploy TransferContract ───────────────────────────────────────────
  console.log('\n📋 Deploying TransferContract.sol...');
  const TransferContract = await ethers.getContractFactory('TransferContract');
  const transferContract = await TransferContract.deploy(landRegistryAddress);
  await transferContract.waitForDeployment();

  const transferContractAddress = await transferContract.getAddress();
  console.log(`✅ TransferContract: ${transferContractAddress}`);
  console.log(`   Etherscan: https://sepolia.etherscan.io/address/${transferContractAddress}`);

  // ── 3. Authorize TransferContract ────────────────────────────────────────
  console.log('\n🔑 Authorizing TransferContract as government authority...');
  const authTx = await landRegistry.addGovernmentAuthority(transferContractAddress);
  await authTx.wait();
  console.log('✅ TransferContract authorized to mint NFTs');

  // ── 4. Wait for Etherscan to index (needed for verification) ─────────────
  if (network.chainId === 11155111n) {
    console.log('\n⏳ Waiting 30s for Etherscan to index contracts...');
    await new Promise(resolve => setTimeout(resolve, 30000));

    // ── 5. Verify on Etherscan ─────────────────────────────────────────────
    console.log('\n🔍 Verifying LandRegistry on Etherscan...');
    try {
      await run('verify:verify', {
        address:              landRegistryAddress,
        constructorArguments: [],
      });
      console.log('✅ LandRegistry verified on Etherscan!');
    } catch (err) {
      if (err.message.includes('Already Verified')) {
        console.log('ℹ️  LandRegistry already verified');
      } else {
        console.warn('⚠️  LandRegistry verification failed:', err.message);
      }
    }

    console.log('\n🔍 Verifying TransferContract on Etherscan...');
    try {
      await run('verify:verify', {
        address:              transferContractAddress,
        constructorArguments: [landRegistryAddress],
      });
      console.log('✅ TransferContract verified on Etherscan!');
    } catch (err) {
      if (err.message.includes('Already Verified')) {
        console.log('ℹ️  TransferContract already verified');
      } else {
        console.warn('⚠️  TransferContract verification failed:', err.message);
      }
    }
  }

  // ── 6. Save deployment info ───────────────────────────────────────────────
  const deploymentInfo = {
    network:     network.name,
    chainId:     network.chainId.toString(),
    deployer:    deployer.address,
    deployedAt:  new Date().toISOString(),
    explorer:    'https://sepolia.etherscan.io',
    contracts: {
      LandRegistry: {
        address:  landRegistryAddress,
        explorer: `https://sepolia.etherscan.io/address/${landRegistryAddress}`,
      },
      TransferContract: {
        address:  transferContractAddress,
        explorer: `https://sepolia.etherscan.io/address/${transferContractAddress}`,
      },
    },
  };

  // Save to blockchain/deployments/
  const outputDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
  fs.writeFileSync(
    path.join(outputDir, `${network.name}.json`),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log(`\n📄 Saved: blockchain/deployments/${network.name}.json`);

  // ── 7. Copy ABIs + addresses to backend ──────────────────────────────────
  await copyToBackend(landRegistryAddress, transferContractAddress);

  // ── 8. Copy ABIs + addresses to frontend ─────────────────────────────────
  await copyToFrontend(deploymentInfo);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║              DEPLOYMENT COMPLETE ✨                  ║');
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  Network:          Sepolia Testnet                   ║`);
  console.log(`║  LandRegistry:     ${landRegistryAddress.slice(0, 20)}...  ║`);
  console.log(`║  TransferContract: ${transferContractAddress.slice(0, 20)}...  ║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log(`║  View on Etherscan:                                  ║`);
  console.log(`║  https://sepolia.etherscan.io                        ║`);
  console.log('╚══════════════════════════════════════════════════════╝\n');
}

// ── Copy ABIs to backend/src/config/abis/ ────────────────────────────────────
async function copyToBackend(landAddr, transferAddr) {
  const abiDir = path.join(__dirname, '../../backend/src/config/abis');
  if (!fs.existsSync(abiDir)) fs.mkdirSync(abiDir, { recursive: true });

  for (const name of ['LandRegistry', 'TransferContract']) {
    const src = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
    if (fs.existsSync(src)) {
      const { abi } = JSON.parse(fs.readFileSync(src, 'utf8'));
      fs.writeFileSync(
        path.join(abiDir, `${name}.json`),
        JSON.stringify({ abi }, null, 2)
      );
      console.log(`✅ ABI → backend/src/config/abis/${name}.json`);
    }
  }

  fs.writeFileSync(
    path.join(abiDir, 'addresses.json'),
    JSON.stringify({
      LandRegistry:     landAddr,
      TransferContract: transferAddr,
      network:          'sepolia',
      chainId:          '11155111',
      explorer:         'https://sepolia.etherscan.io',
    }, null, 2)
  );
  console.log('✅ Addresses → backend/src/config/abis/addresses.json');
}

// ── Copy ABIs + contracts.js to frontend ─────────────────────────────────────
async function copyToFrontend(info) {
  // ABIs
  const frontendAbiDir = path.join(__dirname, '../../frontend/src/utils/abis');
  if (!fs.existsSync(frontendAbiDir)) fs.mkdirSync(frontendAbiDir, { recursive: true });

  for (const name of ['LandRegistry', 'TransferContract']) {
    const src = path.join(__dirname, `../artifacts/contracts/${name}.sol/${name}.json`);
    if (fs.existsSync(src)) {
      const { abi } = JSON.parse(fs.readFileSync(src, 'utf8'));
      fs.writeFileSync(
        path.join(frontendAbiDir, `${name}.json`),
        JSON.stringify({ abi }, null, 2)
      );
      console.log(`✅ ABI → frontend/src/utils/abis/${name}.json`);
    }
  }

  // contracts.js
  const content = `// Auto-generated by deploy.js — DO NOT EDIT
// Deployed: ${info.deployedAt}
// Network:  ${info.network} (chainId: ${info.chainId})

export const CONTRACT_ADDRESSES = {
  LAND_REGISTRY:     '${info.contracts.LandRegistry.address}',
  TRANSFER_CONTRACT: '${info.contracts.TransferContract.address}',
};

export const NETWORK_CONFIG = {
  chainId:     ${info.chainId},
  name:        '${info.network}',
  explorer:    '${info.explorer}',
  rpcUrl:      'https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_KEY || 'YOUR_KEY'}',
};

export const EXPLORER_URL = '${info.explorer}';
`;

  fs.writeFileSync(
    path.join(__dirname, '../../frontend/src/utils/contracts.js'),
    content
  );
  console.log('✅ contracts.js → frontend/src/utils/contracts.js');
}

main().catch(err => {
  console.error('\n❌ Deployment failed:', err.message);
  process.exit(1);
});