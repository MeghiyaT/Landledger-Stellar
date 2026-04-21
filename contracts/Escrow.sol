// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./PropertyRegistry.sol";

/**
 * @title Escrow
 * @dev Escrow contract for secure property transactions
 * Holds funds until transaction conditions are met
 */
contract Escrow is Ownable, ReentrancyGuard {
    PropertyRegistry public propertyRegistry;
    IERC20 public propertyToken; // Optional: for token-based payments
    
    // Escrow transaction structure
    struct EscrowTransaction {
        uint256 transactionId;
        uint256 propertyId;
        address buyer;
        address seller;
        uint256 amount;
        bool isTokenPayment; // true if using tokens, false if ETH
        uint256 deadline; // Deadline for completion
        bool isCompleted;
        bool isCancelled;
        address arbitrator; // Optional arbitrator for disputes
    }
    
    // Mapping from transaction ID to EscrowTransaction
    mapping(uint256 => EscrowTransaction) public transactions;
    
    // Mapping to track funds held in escrow
    mapping(uint256 => uint256) public escrowBalances;
    
    // Counter for transaction IDs
    uint256 public transactionCounter;
    
    // Platform fee (in basis points, e.g., 250 = 2.5%)
    uint256 public platformFeeBps = 250; // 2.5% default
    
    // Events
    event EscrowCreated(
        uint256 indexed transactionId,
        uint256 indexed propertyId,
        address indexed buyer,
        address seller,
        uint256 amount,
        bool isTokenPayment
    );
    
    event EscrowCompleted(
        uint256 indexed transactionId,
        address indexed buyer,
        address indexed seller,
        uint256 amount
    );
    
    event EscrowCancelled(
        uint256 indexed transactionId,
        address indexed initiator
    );
    
    event FundsReleased(
        uint256 indexed transactionId,
        address indexed recipient,
        uint256 amount
    );
    
    event PlatformFeeUpdated(uint256 newFeeBps);

    constructor(
        address initialOwner,
        address _propertyRegistry,
        address _propertyToken
    ) Ownable(initialOwner) {
        propertyRegistry = PropertyRegistry(_propertyRegistry);
        propertyToken = IERC20(_propertyToken);
    }

    /**
     * @dev Create a new escrow transaction (ETH payment)
     * @param propertyId Property ID
     * @param seller Seller address
     * @param deadline Transaction deadline (timestamp)
     */
    function createEscrowETH(
        uint256 propertyId,
        address seller,
        uint256 deadline
    ) public payable nonReentrant returns (uint256) {
        require(msg.value > 0, "Escrow: Amount must be greater than 0");
        require(seller != address(0), "Escrow: Invalid seller address");
        require(seller != msg.sender, "Escrow: Cannot create escrow with yourself");
        require(deadline > block.timestamp, "Escrow: Invalid deadline");
        
        // Verify property exists and is for sale
        (,,, , uint256 price, bool isActive, bool isForSale,) = propertyRegistry.getProperty(propertyId);
        require(isActive, "Escrow: Property is not active");
        require(isForSale, "Escrow: Property is not for sale");
        require(msg.value >= price, "Escrow: Insufficient payment amount");
        
        transactionCounter++;
        uint256 transactionId = transactionCounter;
        
        transactions[transactionId] = EscrowTransaction({
            transactionId: transactionId,
            propertyId: propertyId,
            buyer: msg.sender,
            seller: seller,
            amount: msg.value,
            isTokenPayment: false,
            deadline: deadline,
            isCompleted: false,
            isCancelled: false,
            arbitrator: address(0)
        });
        
        escrowBalances[transactionId] = msg.value;
        
        emit EscrowCreated(transactionId, propertyId, msg.sender, seller, msg.value, false);
        
        return transactionId;
    }

    /**
     * @dev Create a new escrow transaction (Token payment)
     * @param propertyId Property ID
     * @param seller Seller address
     * @param amount Token amount
     * @param deadline Transaction deadline (timestamp)
     */
    function createEscrowToken(
        uint256 propertyId,
        address seller,
        uint256 amount,
        uint256 deadline
    ) public nonReentrant returns (uint256) {
        require(amount > 0, "Escrow: Amount must be greater than 0");
        require(seller != address(0), "Escrow: Invalid seller address");
        require(seller != msg.sender, "Escrow: Cannot create escrow with yourself");
        require(deadline > block.timestamp, "Escrow: Invalid deadline");
        
        // Verify property exists and is for sale
        (,,, , uint256 price, bool isActive, bool isForSale,) = propertyRegistry.getProperty(propertyId);
        require(isActive, "Escrow: Property is not active");
        require(isForSale, "Escrow: Property is not for sale");
        require(amount >= price, "Escrow: Insufficient payment amount");
        
        // Transfer tokens from buyer to escrow
        require(
            propertyToken.transferFrom(msg.sender, address(this), amount),
            "Escrow: Token transfer failed"
        );
        
        transactionCounter++;
        uint256 transactionId = transactionCounter;
        
        transactions[transactionId] = EscrowTransaction({
            transactionId: transactionId,
            propertyId: propertyId,
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            isTokenPayment: true,
            deadline: deadline,
            isCompleted: false,
            isCancelled: false,
            arbitrator: address(0)
        });
        
        escrowBalances[transactionId] = amount;
        
        emit EscrowCreated(transactionId, propertyId, msg.sender, seller, amount, true);
        
        return transactionId;
    }

    /**
     * @dev Complete escrow transaction (buyer confirms receipt of offline deed)
     * @param transactionId Transaction ID
     */
    function completeEscrow(uint256 transactionId) public nonReentrant {
        EscrowTransaction storage txn = transactions[transactionId];
        require(txn.transactionId != 0, "Escrow: Transaction does not exist");
        require(txn.buyer == msg.sender, "Escrow: Only buyer can complete");
        require(!txn.isCompleted, "Escrow: Transaction already completed");
        require(!txn.isCancelled, "Escrow: Transaction is cancelled");
        require(block.timestamp <= txn.deadline, "Escrow: Transaction expired");
        
        txn.isCompleted = true;
        
        // Calculate platform fee
        uint256 fee = (txn.amount * platformFeeBps) / 10000;
        uint256 sellerAmount = txn.amount - fee;
        
        // Transfer funds
        if (txn.isTokenPayment) {
            require(propertyToken.transfer(txn.seller, sellerAmount), "Escrow: Token transfer failed");
            if (fee > 0) {
                require(propertyToken.transfer(owner(), fee), "Escrow: Fee transfer failed");
            }
        } else {
            (bool success1, ) = payable(txn.seller).call{value: sellerAmount}("");
            require(success1, "Escrow: ETH transfer to seller failed");
            if (fee > 0) {
                (bool success2, ) = payable(owner()).call{value: fee}("");
                require(success2, "Escrow: Fee transfer failed");
            }
        }
        
        // Transfer property ownership
        propertyRegistry.transferOwnership(txn.propertyId, txn.buyer, "sale");
        
        escrowBalances[transactionId] = 0;
        
        emit EscrowCompleted(transactionId, txn.buyer, txn.seller, txn.amount);
        emit FundsReleased(transactionId, txn.seller, sellerAmount);
    }

    /**
     * @dev Cancel escrow transaction (buyer can cancel after deadline if not completed)
     * @param transactionId Transaction ID
     */
    function cancelEscrow(uint256 transactionId) public nonReentrant {
        EscrowTransaction storage txn = transactions[transactionId];
        require(txn.transactionId != 0, "Escrow: Transaction does not exist");
        require(txn.buyer == msg.sender, "Escrow: Only buyer can cancel");
        require(!txn.isCompleted, "Escrow: Transaction already completed");
        require(!txn.isCancelled, "Escrow: Transaction already cancelled");
        require(block.timestamp > txn.deadline, "Escrow: Cannot cancel before deadline");
        
        txn.isCancelled = true;
        
        // Refund to buyer
        if (txn.isTokenPayment) {
            require(propertyToken.transfer(txn.buyer, txn.amount), "Escrow: Token refund failed");
        } else {
            (bool success, ) = payable(txn.buyer).call{value: txn.amount}("");
            require(success, "Escrow: ETH refund failed");
        }
        
        escrowBalances[transactionId] = 0;
        
        emit EscrowCancelled(transactionId, msg.sender);
        emit FundsReleased(transactionId, txn.buyer, txn.amount);
    }

    /**
     * @dev Get escrow transaction details
     * @param transactionId Transaction ID
     */
    function getTransaction(uint256 transactionId) public view returns (
        uint256 id,
        uint256 propertyId,
        address buyer,
        address seller,
        uint256 amount,
        bool isTokenPayment,
        uint256 deadline,
        bool isCompleted,
        bool isCancelled
    ) {
        EscrowTransaction memory txn = transactions[transactionId];
        return (
            txn.transactionId,
            txn.propertyId,
            txn.buyer,
            txn.seller,
            txn.amount,
            txn.isTokenPayment,
            txn.deadline,
            txn.isCompleted,
            txn.isCancelled
        );
    }

    /**
     * @dev Update platform fee (only owner)
     * @param newFeeBps New fee in basis points
     */
    function setPlatformFee(uint256 newFeeBps) public onlyOwner {
        require(newFeeBps <= 1000, "Escrow: Fee cannot exceed 10%");
        platformFeeBps = newFeeBps;
        emit PlatformFeeUpdated(newFeeBps);
    }

    /**
     * @dev Emergency withdraw (only owner, for stuck funds)
     */
    function emergencyWithdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success, ) = payable(owner()).call{value: balance}("");
            require(success, "Escrow: Emergency withdraw failed");
        }
    }

    // Allow contract to receive ETH
    receive() external payable {}
}



