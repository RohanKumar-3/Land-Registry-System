// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LandRegistry
 * @dev NFT-based land registry. Each token = one land parcel.
 *      Only authorized government addresses can mint/approve.
 */
contract LandRegistry is ERC721, ERC721URIStorage, Ownable {

    // ── State ──────────────────────────────────────────────────────────────
    uint256 private _tokenIdCounter;

    mapping(address => bool) public governmentAuthorities;

    mapping(string => uint256) public parcelToToken;

    mapping(uint256 => LandParcel) public parcels;

    mapping(address => uint256[]) public ownerParcels;

    // ── Struct ─────────────────────────────────────────────────────────────
    struct LandParcel {
        uint256 tokenId;
        string parcelId;
        address owner;
        string locationHash;
        uint256 areaInSqMeters;
        string landType;
        uint8 verificationScore;
        bool isVerified;
        bool isListed;
        uint256 listingPrice;
        uint256 mintedAt;
        string ipfsDocHash;
    }

    // ── Events ─────────────────────────────────────────────────────────────
    event ParcelMinted(
        uint256 indexed tokenId,
        string indexed parcelId,
        address indexed owner,
        uint256 areaInSqMeters,
        string landType
    );

    event ParcelVerified(
        uint256 indexed tokenId,
        uint8 score,
        bool isVerified
    );

    event ParcelListed(uint256 indexed tokenId, uint256 price);
    event ParcelDelisted(uint256 indexed tokenId);

    event LandOwnershipTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 price
    );

    event AuthorityAdded(address indexed authority);
    event AuthorityRemoved(address indexed authority);

    // ── Modifiers ──────────────────────────────────────────────────────────
    modifier onlyGovernment() {
        require(
            governmentAuthorities[msg.sender] || msg.sender == owner(),
            "Not government authority"
        );
        _;
    }

    modifier onlyParcelOwner(uint256 tokenId) {
        require(ownerOf(tokenId) == msg.sender, "Not parcel owner");
        _;
    }

    modifier parcelExists(uint256 tokenId) {
        require(parcels[tokenId].mintedAt != 0, "Parcel does not exist");
        _;
    }

    // ── Constructor ────────────────────────────────────────────────────────
    constructor() ERC721("LandChain Registry", "LAND") Ownable() {
        governmentAuthorities[msg.sender] = true;
        emit AuthorityAdded(msg.sender);
    }

    // ── Government Authority Management ────────────────────────────────────
    function addGovernmentAuthority(address authority) external onlyOwner {
        require(authority != address(0), "Invalid address");
        governmentAuthorities[authority] = true;
        emit AuthorityAdded(authority);
    }

    function removeGovernmentAuthority(address authority) external onlyOwner {
        governmentAuthorities[authority] = false;
        emit AuthorityRemoved(authority);
    }

    // ── Mint Land NFT ──────────────────────────────────────────────────────
    function mintLandParcel(
        address to,
        string memory parcelId,
        string memory locationHash,
        uint256 areaInSqMeters,
        string memory landType,
        uint8 verificationScore,
        string memory ipfsDocHash,
        string memory tokenURI_
    ) external onlyGovernment returns (uint256) {

        require(to != address(0), "Invalid owner");
        require(bytes(parcelId).length > 0, "Parcel ID required");
        require(areaInSqMeters > 0, "Invalid area");
        require(verificationScore <= 100, "Score must be 0-100");
        require(parcelToToken[parcelId] == 0, "Parcel already registered");

        _tokenIdCounter++;
        uint256 newTokenId = _tokenIdCounter;

        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, tokenURI_);

        parcels[newTokenId] = LandParcel({
            tokenId: newTokenId,
            parcelId: parcelId,
            owner: to,
            locationHash: locationHash,
            areaInSqMeters: areaInSqMeters,
            landType: landType,
            verificationScore: verificationScore,
            isVerified: verificationScore >= 70,
            isListed: false,
            listingPrice: 0,
            mintedAt: block.timestamp,
            ipfsDocHash: ipfsDocHash
        });

        parcelToToken[parcelId] = newTokenId;
        ownerParcels[to].push(newTokenId);

        emit ParcelMinted(newTokenId, parcelId, to, areaInSqMeters, landType);

        return newTokenId;
    }

    // ── Update Verification Score ─────────────────────────────────────────
    function updateVerificationScore(
        uint256 tokenId,
        uint8 newScore
    ) external onlyGovernment parcelExists(tokenId) {

        require(newScore <= 100, "Invalid score");

        parcels[tokenId].verificationScore = newScore;
        parcels[tokenId].isVerified = newScore >= 70;

        emit ParcelVerified(tokenId, newScore, newScore >= 70);
    }

    // ── Listing ───────────────────────────────────────────────────────────
    function listParcel(
        uint256 tokenId,
        uint256 price
    ) external onlyParcelOwner(tokenId) parcelExists(tokenId) {

        require(price > 0, "Invalid price");
        require(parcels[tokenId].isVerified, "Parcel not verified");

        parcels[tokenId].isListed = true;
        parcels[tokenId].listingPrice = price;

        emit ParcelListed(tokenId, price);
    }

    function delistParcel(uint256 tokenId)
        external
        onlyParcelOwner(tokenId)
        parcelExists(tokenId)
    {
        parcels[tokenId].isListed = false;
        parcels[tokenId].listingPrice = 0;

        emit ParcelDelisted(tokenId);
    }

    // ── Read Functions ────────────────────────────────────────────────────
    function getParcel(uint256 tokenId)
        external
        view
        parcelExists(tokenId)
        returns (LandParcel memory)
    {
        return parcels[tokenId];
    }

    function getOwnerParcels(address owner_)
        external
        view
        returns (uint256[] memory)
    {
        return ownerParcels[owner_];
    }

    function totalParcels() external view returns (uint256) {
        return _tokenIdCounter;
    }

    function isGovernmentAuthority(address addr)
        external
        view
        returns (bool)
    {
        return governmentAuthorities[addr];
    }

    // ── Overrides ─────────────────────────────────────────────────────────
    function tokenURI(uint256 tokenId)
    public
    view
    override(ERC721, ERC721URIStorage)
    returns (string memory)
{
    return super.tokenURI(tokenId);
}

function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC721, ERC721URIStorage)
    returns (bool)
{
    return super.supportsInterface(interfaceId);
}

function _burn(uint256 tokenId)
    internal
    override(ERC721, ERC721URIStorage)
{
    super._burn(tokenId);
}
}