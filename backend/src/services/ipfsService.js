const axios    = require('axios');
const FormData = require('form-data');

const uploadFile = async (buffer, filename) => {
  try {
    if (!process.env.PINATA_JWT && !process.env.PINATA_API_KEY) {
      console.warn('IPFS not configured, skipping upload');
      return 'ipfs-not-configured';
    }

    const formData = new FormData();
    formData.append('file', buffer, { filename });

    // Use JWT if available (newer, more reliable), else fall back to API key
    const headers = process.env.PINATA_JWT
      ? {
          ...formData.getHeaders(),
          Authorization: `Bearer ${process.env.PINATA_JWT}`,
        }
      : {
          ...formData.getHeaders(),
          pinata_api_key:        process.env.PINATA_API_KEY,
          pinata_secret_api_key: process.env.PINATA_SECRET_KEY,
        };

    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinFileToIPFS',
      formData,
      {
        maxBodyLength: Infinity,
        headers,
        timeout: 30000,
      }
    );

    console.log(`✅ IPFS uploaded: ${filename} → ${response.data.IpfsHash}`);
    return response.data.IpfsHash;

  } catch (error) {
    const status = error.response?.status;
    const detail = error.response?.data?.error?.details || error.message;
    console.error(`IPFS upload error (${status}): ${detail}`);

    if (status === 401) console.error('→ JWT/API key is invalid or expired. Get new keys from app.pinata.cloud');
    if (status === 403) console.error('→ Key exists but missing permissions. Enable pinFileToIPFS in Pinata dashboard.');

    return null;
  }
};

const uploadJSON = async (jsonObject, name = 'metadata.json') => {
  try {
    if (!process.env.PINATA_JWT && !process.env.PINATA_API_KEY) return null;

    const headers = process.env.PINATA_JWT
      ? { Authorization: `Bearer ${process.env.PINATA_JWT}` }
      : {
          pinata_api_key:        process.env.PINATA_API_KEY,
          pinata_secret_api_key: process.env.PINATA_SECRET_KEY,
        };

    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      { pinataContent: jsonObject, pinataMetadata: { name } },
      { headers: { ...headers, 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    return response.data.IpfsHash;
  } catch (error) {
    console.error('IPFS JSON upload error:', error.response?.data || error.message);
    return null;
  }
};

const getFileUrl = (ipfsHash) => {
  if (!ipfsHash || ipfsHash === 'ipfs-not-configured') return null;
  return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
};

module.exports = { uploadFile, uploadJSON, getFileUrl };