// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PropertyNFT
 * @dev ERC721 NFT contract for property ownership certificates
 * Each property gets a unique NFT token that represents ownership
 */
contract PropertyNFT is ERC721URIStorage, Ownable, ReentrancyGuard {
    // Token counter
    uint256 private _tokenCounter;
    
    // Mapping from property ID (from PropertyRegistry) to token ID
    mapping(uint256 => uint256) public propertyToTokenId;
    
    // Mapping from token ID to property ID
    mapping(uint256 => uint256) public tokenIdToProperty;
    
    // Mapping to check if a property already has an NFT
    mapping(uint256 => bool) public propertyHasNFT;
    
    // Base URI for token metadata
    string private _baseTokenURI;
    
    // Events
    event PropertyNFTMinted(
        uint256 indexed tokenId,
        uint256 indexed propertyId,
        address indexed owner,
        string tokenURI
    );
    
    event PropertyNFTTransferred(
        uint256 indexed tokenId,
        uint256 propertyId,
        address indexed from,
        address indexed to
    );
    
    constructor(address initialOwner) ERC721("Property Certificate", "PROPERTY") Ownable(initialOwner) {
        _tokenCounter = 0;
    }
    
    /**
     * @dev Mint a new NFT for a property
     * @param to Address to mint the NFT to
     * @param propertyId Property ID from PropertyRegistry
     * @param tokenURI URI for the token metadata (can be IPFS hash)
     */
    function mintPropertyNFT(
        address to,
        uint256 propertyId,
        string memory tokenURI
    ) public onlyOwner nonReentrant returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(!propertyHasNFT[propertyId], "Property already has an NFT");
        
        _tokenCounter++;
        uint256 tokenId = _tokenCounter;
        
        // Mint the NFT
        _safeMint(to, tokenId);
        
        // Set token URI if provided
        if (bytes(tokenURI).length > 0) {
            _setTokenURI(tokenId, tokenURI);
        }
        
        // Map property ID to token ID
        propertyToTokenId[propertyId] = tokenId;
        tokenIdToProperty[tokenId] = propertyId;
        propertyHasNFT[propertyId] = true;
        
        emit PropertyNFTMinted(tokenId, propertyId, to, tokenURI);
        
        return tokenId;
    }
    
    /**
     * @dev Transfer NFT ownership (called when property is sold)
     * @param propertyId Property ID from PropertyRegistry
     * @param to New owner address
     */
    function transferPropertyNFT(
        uint256 propertyId,
        address to
    ) public nonReentrant returns (bool) {
        require(propertyHasNFT[propertyId], "Property does not have an NFT");
        require(to != address(0), "Cannot transfer to zero address");
        
        uint256 tokenId = propertyToTokenId[propertyId];
        address currentOwner = ownerOf(tokenId);
        
        require(currentOwner == msg.sender, "Not the NFT owner");
        require(to != currentOwner, "Cannot transfer to yourself");
        
        // Transfer the NFT
        _transfer(currentOwner, to, tokenId);
        
        emit PropertyNFTTransferred(tokenId, propertyId, currentOwner, to);
        
        return true;
    }
    
    /**
     * @dev Get token ID for a property
     * @param propertyId Property ID from PropertyRegistry
     * @return tokenId The NFT token ID
     */
    function getTokenIdByProperty(uint256 propertyId) public view returns (uint256) {
        require(propertyHasNFT[propertyId], "Property does not have an NFT");
        return propertyToTokenId[propertyId];
    }
    
    /**
     * @dev Get property ID for a token
     * @param tokenId NFT token ID
     * @return propertyId The property ID
     */
    function getPropertyByTokenId(uint256 tokenId) public view returns (uint256) {
        require(_ownerOf(tokenId) != address(0), "Token does not exist");
        return tokenIdToProperty[tokenId];
    }
    
    /**
     * @dev Get the current owner of a property's NFT
     * @param propertyId Property ID from PropertyRegistry
     * @return owner The current owner address
     */
    function getPropertyNFTOwner(uint256 propertyId) public view returns (address) {
        require(propertyHasNFT[propertyId], "Property does not have an NFT");
        uint256 tokenId = propertyToTokenId[propertyId];
        return ownerOf(tokenId);
    }
    
    /**
     * @dev Set base URI for token metadata
     * @param baseURI Base URI string
     */
    function setBaseURI(string memory baseURI) public onlyOwner {
        _baseTokenURI = baseURI;
    }
    
    /**
     * @dev Get total number of NFTs minted
     * @return total The total supply
     */
    function totalSupply() public view returns (uint256) {
        return _tokenCounter;
    }
    
    /**
     * @dev Override base URI
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    /**
     * @dev Check if a property has an NFT
     * @param propertyId Property ID from PropertyRegistry
     * @return hasNFT True if property has an NFT
     */
    function hasNFT(uint256 propertyId) public view returns (bool) {
        return propertyHasNFT[propertyId];
    }
}

