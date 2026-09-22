// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface ILandRegistry {
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function isGovernmentAuthority(address addr) external view returns (bool);
}

contract TransferContract is ReentrancyGuard, Ownable {

    enum EscrowStatus {
        Funded,
        SellerApproved,
        GovApproved,
        Completed,
        Cancelled,
        Disputed
    }

    struct Escrow {
        uint256 escrowId;
        uint256 tokenId;
        address seller;
        address buyer;
        uint256 price;
        EscrowStatus status;
        bool sellerApproved;
        bool buyerApproved;
        bool govApproved;
        uint256 createdAt;
        uint256 completedAt;
    }

    ILandRegistry public landRegistry;

    uint256 public escrowCounter;
    uint256 public platformFeePercent = 1;

    mapping(uint256 => Escrow) public escrows;
    mapping(uint256 => uint256) public activeEscrow;

    event EscrowInitiated(uint256 escrowId, uint256 tokenId, address buyer, address seller, uint256 price);
    event EscrowCompleted(uint256 escrowId, uint256 tokenId, address buyer);
    event EscrowCancelled(uint256 escrowId);

    constructor(address landRegistryAddress) Ownable() {
        landRegistry = ILandRegistry(landRegistryAddress);
    }

    function initiatePurchase(uint256 tokenId)
        external
        payable
        nonReentrant
        returns (uint256)
    {
        address seller = landRegistry.ownerOf(tokenId);

        require(seller != msg.sender, "Cannot buy own land");
        require(activeEscrow[tokenId] == 0, "Escrow exists");

        escrowCounter++;
        uint256 escrowId = escrowCounter;

        escrows[escrowId] = Escrow({
            escrowId: escrowId,
            tokenId: tokenId,
            seller: seller,
            buyer: msg.sender,
            price: msg.value,
            status: EscrowStatus.Funded,
            sellerApproved: false,
            buyerApproved: true,
            govApproved: false,
            createdAt: block.timestamp,
            completedAt: 0
        });

        activeEscrow[tokenId] = escrowId;

        emit EscrowInitiated(escrowId, tokenId, msg.sender, seller, msg.value);

        return escrowId;
    }

    function sellerApprove(uint256 escrowId) external {

        Escrow storage e = escrows[escrowId];

        require(msg.sender == e.seller, "Only seller");

        e.sellerApproved = true;
        e.status = EscrowStatus.SellerApproved;

        _checkComplete(escrowId);
    }

   function governmentApprove(uint256 escrowId) external onlyOwner {
    // onlyOwner = deployer wallet = government wallet
    // Government connects MetaMask (their deployer wallet) to call this
    Escrow storage e = escrows[escrowId];
    require(!e.govApproved, "Already approved");
    require(e.status != EscrowStatus.Cancelled, "Cancelled");

    e.govApproved = true;
    e.status = EscrowStatus.GovApproved;

    _checkComplete(escrowId);
}

    function _checkComplete(uint256 escrowId) internal {

        Escrow storage e = escrows[escrowId];

        if (e.sellerApproved && e.buyerApproved && e.govApproved) {
            _completeTransfer(escrowId);
        }
    }

    function _completeTransfer(uint256 escrowId) internal {

        Escrow storage e = escrows[escrowId];

        e.status = EscrowStatus.Completed;
        e.completedAt = block.timestamp;

        activeEscrow[e.tokenId] = 0;

        uint256 fee = (e.price * platformFeePercent) / 100;
        uint256 sellerAmount = e.price - fee;

        landRegistry.safeTransferFrom(e.seller, e.buyer, e.tokenId);

        payable(e.seller).transfer(sellerAmount);

        if (fee > 0) {
            payable(owner()).transfer(fee);
        }

        emit EscrowCompleted(escrowId, e.tokenId, e.buyer);
    }

    function cancelEscrow(uint256 escrowId) external nonReentrant {

        Escrow storage e = escrows[escrowId];

        require(
            msg.sender == e.buyer ||
            msg.sender == e.seller,
            "Not allowed"
        );

        e.status = EscrowStatus.Cancelled;

        activeEscrow[e.tokenId] = 0;

        payable(e.buyer).transfer(e.price);

        emit EscrowCancelled(escrowId);
    }

    receive() external payable {}

}