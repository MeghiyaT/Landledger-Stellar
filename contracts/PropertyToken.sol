// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";

/**
 * @title PropertyToken
 * @dev Custom ERC-20 token for the real estate platform
 * Features:
 * - Standard ERC-20 functionality
 * - Burnable tokens
 * - Pausable transfers (for emergencies)
 * - Minting capability (for rewards, etc.)
 */
contract PropertyToken is ERC20, ERC20Burnable, Ownable, ERC20Pausable {
    uint256 public constant MAX_SUPPLY = 1000000000 * 10**18; // 1 billion tokens max
    uint256 public constant INITIAL_SUPPLY = 100000000 * 10**18; // 100 million initial supply

    // Mapping to track if address can mint
    mapping(address => bool) public minters;

    event MinterAdded(address indexed account);
    event MinterRemoved(address indexed account);
    event TokensMinted(address indexed to, uint256 amount);

    constructor(address initialOwner) 
        ERC20("PropertyToken", "PROP") 
        Ownable(initialOwner)
    {
        // Mint initial supply to the owner
        _mint(initialOwner, INITIAL_SUPPLY);
    }

    /**
     * @dev Mint tokens to a specific address
     * @param to Address to receive tokens
     * @param amount Amount of tokens to mint
     */
    function mint(address to, uint256 amount) public onlyMinter {
        require(totalSupply() + amount <= MAX_SUPPLY, "PropertyToken: Max supply exceeded");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @dev Add a minter address
     * @param account Address to grant minting permission
     */
    function addMinter(address account) public onlyOwner {
        require(account != address(0), "PropertyToken: Cannot add zero address");
        minters[account] = true;
        emit MinterAdded(account);
    }

    /**
     * @dev Remove a minter address
     * @param account Address to revoke minting permission
     */
    function removeMinter(address account) public onlyOwner {
        minters[account] = false;
        emit MinterRemoved(account);
    }

    /**
     * @dev Pause all token transfers
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause all token transfers
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    /**
     * @dev Check if address is a minter
     */
    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "PropertyToken: Not a minter");
        _;
    }

    // Override required by Solidity
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
    }
}



