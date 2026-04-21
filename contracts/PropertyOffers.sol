// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PropertyRegistry.sol";

/**
 * @title PropertyOffers
 * @dev Contract for managing property offers on-chain
 */
contract PropertyOffers is Ownable, ReentrancyGuard {
    PropertyRegistry public propertyRegistry;
    
    // Offer structure
    struct Offer {
        uint256 offerId;
        uint256 propertyId;
        address buyer;
        address seller;
        uint256 amount;
        string message;
        uint256 deadline; // Offer expiration
        bool isAccepted;
        bool isRejected;
        bool isWithdrawn;
        uint256 createdAt;
    }
    
    // Mapping from offer ID to Offer
    mapping(uint256 => Offer) public offers;
    
    // Mapping from property ID to offer IDs
    mapping(uint256 => uint256[]) public offersByProperty;
    
    // Mapping from buyer address to offer IDs
    mapping(address => uint256[]) public offersByBuyer;
    
    // Counter for offer IDs
    uint256 public offerCounter;
    
    // Minimum offer duration (in seconds)
    uint256 public minOfferDuration = 1 days;
    
    // Events
    event OfferCreated(
        uint256 indexed offerId,
        uint256 indexed propertyId,
        address indexed buyer,
        address seller,
        uint256 amount,
        uint256 deadline
    );
    
    event OfferAccepted(
        uint256 indexed offerId,
        uint256 indexed propertyId,
        address indexed buyer,
        address seller
    );
    
    event OfferRejected(
        uint256 indexed offerId,
        uint256 indexed propertyId,
        address indexed buyer
    );
    
    event OfferWithdrawn(
        uint256 indexed offerId,
        uint256 indexed propertyId,
        address indexed buyer
    );

    constructor(address initialOwner, address _propertyRegistry) Ownable(initialOwner) {
        propertyRegistry = PropertyRegistry(_propertyRegistry);
    }

    /**
     * @dev Create a new offer
     * @param propertyId Property ID
     * @param amount Offer amount
     * @param message Offer message
     * @param duration Offer duration in seconds
     */
    function createOffer(
        uint256 propertyId,
        uint256 amount,
        string memory message,
        uint256 duration
    ) public returns (uint256) {
        require(amount > 0, "PropertyOffers: Offer amount must be greater than 0");
        require(duration >= minOfferDuration, "PropertyOffers: Duration too short");
        
        // Verify property exists
        (uint256 id, address seller, , , , bool isActive, ,) = 
            propertyRegistry.getProperty(propertyId);
        require(id != 0, "PropertyOffers: Property does not exist");
        require(isActive, "PropertyOffers: Property is not active");
        require(seller != msg.sender, "PropertyOffers: Cannot make offer on your own property");
        
        offerCounter++;
        uint256 offerId = offerCounter;
        
        uint256 deadline = block.timestamp + duration;
        
        offers[offerId] = Offer({
            offerId: offerId,
            propertyId: propertyId,
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            message: message,
            deadline: deadline,
            isAccepted: false,
            isRejected: false,
            isWithdrawn: false,
            createdAt: block.timestamp
        });
        
        offersByProperty[propertyId].push(offerId);
        offersByBuyer[msg.sender].push(offerId);
        
        emit OfferCreated(offerId, propertyId, msg.sender, seller, amount, deadline);
        
        return offerId;
    }

    /**
     * @dev Accept an offer (only seller)
     * @param offerId Offer ID
     */
    function acceptOffer(uint256 offerId) public {
        Offer storage offer = offers[offerId];
        require(offer.offerId != 0, "PropertyOffers: Offer does not exist");
        require(offer.seller == msg.sender, "PropertyOffers: Only seller can accept");
        require(!offer.isAccepted, "PropertyOffers: Offer already accepted");
        require(!offer.isRejected, "PropertyOffers: Offer already rejected");
        require(!offer.isWithdrawn, "PropertyOffers: Offer already withdrawn");
        require(block.timestamp <= offer.deadline, "PropertyOffers: Offer expired");
        
        offer.isAccepted = true;
        
        // Transfer property ownership
        propertyRegistry.transferOwnership(offer.propertyId, offer.buyer, "sale");
        
        emit OfferAccepted(offerId, offer.propertyId, offer.buyer, offer.seller);
    }

    /**
     * @dev Reject an offer (only seller)
     * @param offerId Offer ID
     */
    function rejectOffer(uint256 offerId) public {
        Offer storage offer = offers[offerId];
        require(offer.offerId != 0, "PropertyOffers: Offer does not exist");
        require(offer.seller == msg.sender, "PropertyOffers: Only seller can reject");
        require(!offer.isAccepted, "PropertyOffers: Offer already accepted");
        require(!offer.isRejected, "PropertyOffers: Offer already rejected");
        require(!offer.isWithdrawn, "PropertyOffers: Offer already withdrawn");
        
        offer.isRejected = true;
        
        emit OfferRejected(offerId, offer.propertyId, offer.buyer);
    }

    /**
     * @dev Withdraw an offer (only buyer)
     * @param offerId Offer ID
     */
    function withdrawOffer(uint256 offerId) public {
        Offer storage offer = offers[offerId];
        require(offer.offerId != 0, "PropertyOffers: Offer does not exist");
        require(offer.buyer == msg.sender, "PropertyOffers: Only buyer can withdraw");
        require(!offer.isAccepted, "PropertyOffers: Offer already accepted");
        require(!offer.isRejected, "PropertyOffers: Offer already rejected");
        require(!offer.isWithdrawn, "PropertyOffers: Offer already withdrawn");
        
        offer.isWithdrawn = true;
        
        emit OfferWithdrawn(offerId, offer.propertyId, offer.buyer);
    }

    /**
     * @dev Get offer details
     * @param offerId Offer ID
     */
    function getOffer(uint256 offerId) public view returns (
        uint256 id,
        uint256 propertyId,
        address buyer,
        address seller,
        uint256 amount,
        string memory message,
        uint256 deadline,
        bool isAccepted,
        bool isRejected,
        bool isWithdrawn,
        uint256 createdAt
    ) {
        Offer memory offer = offers[offerId];
        return (
            offer.offerId,
            offer.propertyId,
            offer.buyer,
            offer.seller,
            offer.amount,
            offer.message,
            offer.deadline,
            offer.isAccepted,
            offer.isRejected,
            offer.isWithdrawn,
            offer.createdAt
        );
    }

    /**
     * @dev Get offers for a property
     * @param propertyId Property ID
     */
    function getOffersByProperty(uint256 propertyId) public view returns (uint256[] memory) {
        return offersByProperty[propertyId];
    }

    /**
     * @dev Get offers by buyer
     * @param buyer Buyer address
     */
    function getOffersByBuyer(address buyer) public view returns (uint256[] memory) {
        return offersByBuyer[buyer];
    }

    /**
     * @dev Set minimum offer duration (only owner)
     * @param duration Minimum duration in seconds
     */
    function setMinOfferDuration(uint256 duration) public onlyOwner {
        require(duration >= 1 hours, "PropertyOffers: Duration too short");
        minOfferDuration = duration;
    }
}

