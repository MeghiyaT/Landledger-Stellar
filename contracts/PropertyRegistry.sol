// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PropertyRegistry
 * @dev Registry for property ownership on the blockchain
 * Tracks property ownership, transfers, and history
 */
contract PropertyRegistry is Ownable, ReentrancyGuard {
    // Property structure
    struct Property {
        uint256 propertyId;
        address owner;
        string title;
        string location;
        uint256 price; // Price in wei (ETH) or token amount
        bool isActive;
        bool isVerified; // TRUE if admin has verified the real-world deed
        bool isForSale;
        uint256 createdAt;
        uint256 updatedAt;
    }

    // Ownership history entry
    struct OwnershipHistory {
        address previousOwner;
        address newOwner;
        uint256 timestamp;
        string transferType; // "sale", "transfer", "gift"
    }

    // Mapping from property ID to Property
    mapping(uint256 => Property) public properties;
    
    // Mapping from property ID to ownership history
    mapping(uint256 => OwnershipHistory[]) public ownershipHistory;
    
    // Mapping to track property IDs by owner
    mapping(address => uint256[]) public propertiesByOwner;
    
    // Mapping for escrow/operator assignment
    mapping(uint256 => address) public propertyApprovals;
    
    // Counter for property IDs
    uint256 public propertyCounter;
    
    // Events
    event PropertyRegistered(
        uint256 indexed propertyId,
        address indexed owner,
        string title,
        string location,
        uint256 price
    );
    
    event PropertyUpdated(
        uint256 indexed propertyId,
        address indexed owner,
        string title,
        uint256 price
    );
    
    event OwnershipTransferred(
        uint256 indexed propertyId,
        address indexed previousOwner,
        address indexed newOwner,
        string transferType
    );
    
    event PropertyListedForSale(
        uint256 indexed propertyId,
        address indexed owner,
        uint256 price
    );
    
    event PropertyRemovedFromSale(
        uint256 indexed propertyId,
        address indexed owner
    );

    event PropertyVerified(
        uint256 indexed propertyId
    );
    
    event Approval(
        uint256 indexed propertyId,
        address indexed owner,
        address indexed approved
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @dev Register a new property
     * @param title Property title
     * @param location Property location
     * @param price Initial price
     */
    function registerProperty(
        string memory title,
        string memory location,
        uint256 price
    ) public returns (uint256) {
        propertyCounter++;
        uint256 propertyId = propertyCounter;
        
        properties[propertyId] = Property({
            propertyId: propertyId,
            owner: msg.sender,
            title: title,
            location: location,
            price: price,
            isActive: true,
            isVerified: true, // DEV NOTE: Set to false in production to enforce KYC/Oracle verification
            isForSale: false,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });
        
        propertiesByOwner[msg.sender].push(propertyId);
        
        emit PropertyRegistered(propertyId, msg.sender, title, location, price);
        
        return propertyId;
    }

    /**
     * @dev Update property details (only owner)
     * @param propertyId Property ID
     * @param title New title
     * @param price New price
     */
    function updateProperty(
        uint256 propertyId,
        string memory title,
        uint256 price
    ) public {
        require(properties[propertyId].propertyId != 0, "Property does not exist");
        require(properties[propertyId].owner == msg.sender, "Not the property owner");
        require(properties[propertyId].isActive, "Property is not active");
        
        properties[propertyId].title = title;
        properties[propertyId].price = price;
        properties[propertyId].updatedAt = block.timestamp;
        
        emit PropertyUpdated(propertyId, msg.sender, title, price);
    }

    /**
     * @dev Transfer property ownership
     * @param propertyId Property ID
     * @param newOwner New owner address
     * @param transferType Type of transfer ("sale", "transfer", "gift")
     */
    function transferOwnership(
        uint256 propertyId,
        address newOwner,
        string memory transferType
    ) public {
        require(properties[propertyId].propertyId != 0, "Property does not exist");
        require(
            properties[propertyId].owner == msg.sender || propertyApprovals[propertyId] == msg.sender, 
            "Not the property owner or approved"
        );
        require(properties[propertyId].isActive, "Property is not active");
        require(properties[propertyId].isVerified, "Property must be verified");
        require(newOwner != address(0), "Cannot transfer to zero address");
        require(newOwner != msg.sender, "Cannot transfer to yourself");
        
        address previousOwner = properties[propertyId].owner;
        
        // Clear approval
        propertyApprovals[propertyId] = address(0);
        
        // Update ownership
        properties[propertyId].owner = newOwner;
        properties[propertyId].isForSale = false; // Remove from sale when transferred
        properties[propertyId].updatedAt = block.timestamp;
        
        // Add to ownership history
        ownershipHistory[propertyId].push(OwnershipHistory({
            previousOwner: previousOwner,
            newOwner: newOwner,
            timestamp: block.timestamp,
            transferType: transferType
        }));
        
        // Update properties by owner mappings
        _removePropertyFromOwner(previousOwner, propertyId);
        propertiesByOwner[newOwner].push(propertyId);
        
        emit OwnershipTransferred(propertyId, previousOwner, newOwner, transferType);
    }

    /**
     * @dev List property for sale
     * @param propertyId Property ID
     * @param price Sale price
     */
    function listForSale(uint256 propertyId, uint256 price) public {
        require(properties[propertyId].propertyId != 0, "Property does not exist");
        require(properties[propertyId].owner == msg.sender, "Not the property owner");
        require(properties[propertyId].isActive, "Property is not active");
        require(properties[propertyId].isVerified, "Property must be verified");
        
        properties[propertyId].isForSale = true;
        properties[propertyId].price = price;
        properties[propertyId].updatedAt = block.timestamp;
        
        emit PropertyListedForSale(propertyId, msg.sender, price);
    }

    /**
     * @dev Remove property from sale
     * @param propertyId Property ID
     */
    function removeFromSale(uint256 propertyId) public {
        require(properties[propertyId].propertyId != 0, "Property does not exist");
        require(properties[propertyId].owner == msg.sender, "Not the property owner");
        
        properties[propertyId].isForSale = false;
        properties[propertyId].updatedAt = block.timestamp;
        
        emit PropertyRemovedFromSale(propertyId, msg.sender);
    }

    /**
     * @dev Get property details
     * @param propertyId Property ID
     */
    function getProperty(uint256 propertyId) public view returns (
        uint256 id,
        address owner,
        string memory title,
        string memory location,
        uint256 price,
        bool isActive,
        bool isForSale,
        uint256 createdAt
    ) {
        Property memory prop = properties[propertyId];
        return (
            prop.propertyId,
            prop.owner,
            prop.title,
            prop.location,
            prop.price,
            prop.isActive,
            prop.isForSale,
            prop.createdAt
        );
    }

    /**
     * @dev Get ownership history for a property
     * @param propertyId Property ID
     */
    function getOwnershipHistory(uint256 propertyId) public view returns (OwnershipHistory[] memory) {
        return ownershipHistory[propertyId];
    }

    /**
     * @dev Get properties owned by an address
     * @param owner Owner address
     */
    function getPropertiesByOwner(address owner) public view returns (uint256[] memory) {
        return propertiesByOwner[owner];
    }

    /**
     * @dev Remove property from owner's list (internal)
     */
    function _removePropertyFromOwner(address owner, uint256 propertyId) internal {
        uint256[] storage ownerProperties = propertiesByOwner[owner];
        for (uint256 i = 0; i < ownerProperties.length; i++) {
            if (ownerProperties[i] == propertyId) {
                ownerProperties[i] = ownerProperties[ownerProperties.length - 1];
                ownerProperties.pop();
                break;
            }
        }
    }

    /**
     * @dev Deactivate a property (only owner)
     * @param propertyId Property ID
     */
    function deactivateProperty(uint256 propertyId) public {
        require(properties[propertyId].propertyId != 0, "Property does not exist");
        require(properties[propertyId].owner == msg.sender, "Not the property owner");
        
        properties[propertyId].isActive = false;
        properties[propertyId].isForSale = false;
        properties[propertyId].updatedAt = block.timestamp;
    }

    /**
     * @dev Approve an address to transfer a property (fixes Escrow lock issue)
     */
    function approve(address to, uint256 propertyId) public {
        require(properties[propertyId].propertyId != 0, "Property does not exist");
        require(properties[propertyId].owner == msg.sender, "Not the property owner");
        propertyApprovals[propertyId] = to;
        emit Approval(propertyId, msg.sender, to);
    }

    /**
     * @dev Verify a property (Admin or Oracle)
     */
    function verifyProperty(uint256 propertyId) public onlyOwner {
        require(properties[propertyId].propertyId != 0, "Property does not exist");
        properties[propertyId].isVerified = true;
        emit PropertyVerified(propertyId);
    }
}



