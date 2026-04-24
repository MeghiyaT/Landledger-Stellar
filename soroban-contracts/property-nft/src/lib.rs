#![no_std]
//! # PropertyNFT — SEP-50 Compliant Non-Fungible Token
//!
//! This contract implements the **SEP-50** Non-Fungible Token interface for
//! Soroban, mapping each property deed to a unique, non-fungible token (NFT).
//!
//! ## SEP-50 Interface (all required functions are implemented)
//!
//! | Function              | Description                                         |
//! |-----------------------|-----------------------------------------------------|
//! | `balance`             | Number of tokens owned by an address                |
//! | `owner_of`            | Owner of a given token_id                           |
//! | `transfer`            | Owner-initiated transfer                            |
//! | `transfer_from`       | Approved spender / operator-initiated transfer      |
//! | `approve`             | Per-token approval with ledger-based expiry         |
//! | `approve_for_all`     | Operator approval over all tokens for an owner      |
//! | `get_approved`        | Get approved address for a token_id                 |
//! | `is_approved_for_all` | Check operator approval                             |
//! | `name`                | Collection name                                     |
//! | `symbol`              | Collection symbol                                   |
//! | `token_uri`           | Metadata URI (IPFS → SEP-50 JSON schema)            |
//!
//! ## Landledger Extensions (beyond SEP-50 core)
//!
//! | Function              | Description                                         |
//! |-----------------------|-----------------------------------------------------|
//! | `init`                | One-time initialization                             |
//! | `mint`                | Admin-only minting; links token to a property ID    |
//! | `set_token_uri`       | Admin updates the metadata URI post-mint            |
//! | `total_supply`        | Total tokens minted                                 |
//! | `get_token_by_property` | Lookup token_id from property_id                  |
//! | `has_token`           | Check if a property already has an NFT              |

use soroban_sdk::{
    contract, contractimpl, contracttype, Address, Env, String, Symbol,
};

// ── Type aliases (matching SEP-50 spec) ──────────────────────────────────────

/// SEP-50 uses a generic `TokenID` unsigned integer.  We use `u32` which
/// covers all realistic property counts.


/// `u32` should be the same type as `TokenID` per the SEP-50 spec.


// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Contract admin (can mint, update URIs).
    Admin,
    /// Total minted token counter.
    Counter,
    /// Owner of a token_id.
    Owner(u32),
    /// Token URI (IPFS / metadata URL) for a token_id.
    Uri(u32),
    /// Property ID → token_id (Landledger extension: 1-to-1 mapping).
    PropertyToToken(u32),
    /// Whether a property already has a token minted.
    HasToken(u32),
    /// Per-token approval: (token_id) → (approved_address, live_until_ledger).
    Approval(u32),
    /// Per-owner operator approval: (owner, operator) → live_until_ledger.
    OperatorApproval(Address, Address),
    /// Per-owner token balance.
    Balance(Address),
}

// ── Approval storage structs ──────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApprovalEntry {
    pub approved: Address,
    /// Ledger number at which this approval expires (0 = revoked).
    pub live_until_ledger: u32,
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct PropertyNft;

#[contractimpl]
impl PropertyNft {
    // ── Initialization ────────────────────────────────────────────────────────

    /// Initialize the contract.  Must be called once after deployment.
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("PropertyNft: already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Counter, &0u32);
    }

    // ── SEP-50: Metadata ──────────────────────────────────────────────────────

    /// Returns the collection name.
    /// SEP-50 required: `fn name(e: &Env) -> String`
    pub fn name(env: Env) -> String {
        String::from_str(&env, "Landledger Property Deed")
    }

    /// Returns the collection symbol.
    /// SEP-50 required: `fn symbol(e: &Env) -> String`
    pub fn symbol(env: Env) -> String {
        String::from_str(&env, "DEED")
    }

    /// Returns the metadata URI for `token_id`.
    ///
    /// The URI should point to a JSON file conforming to the SEP-50
    /// "Non-Fungible Metadata JSON Schema" (with `name`, `description`,
    /// `image`, `external_url`, `attributes` fields).
    ///
    /// SEP-50 required: `fn token_uri(e: &Env, token_id: TokenID) -> String`
    ///
    /// Panics if the token does not exist.
    pub fn token_uri(env: Env, token_id: u32) -> String {
        Self::assert_exists(&env, token_id);
        env.storage()
            .persistent()
            .get(&DataKey::Uri(token_id))
            .unwrap_or(String::from_str(&env, ""))
    }

    // ── SEP-50: u32 & Ownership ───────────────────────────────────────────

    /// Returns the number of tokens held by `owner`.
    /// SEP-50 required: `fn balance(e: &Env, owner: Address) -> u32`
    pub fn balance(env: Env, owner: Address) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(owner))
            .unwrap_or(0u32)
    }

    /// Returns the owner of `token_id`.
    /// Panics if the token does not exist.
    /// SEP-50 required: `fn owner_of(e: &Env, token_id: TokenID) -> Address`
    pub fn owner_of(env: Env, token_id: u32) -> Address {
        env.storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .unwrap_or_else(|| panic!("PropertyNft: token does not exist"))
    }

    // ── SEP-50: Transfer ──────────────────────────────────────────────────────

    /// Transfer `token_id` from `from` to `to`.  `from` must authorize.
    ///
    /// SEP-50 required: `fn transfer(e: &Env, from: Address, to: Address, token_id: TokenID)`
    ///
    /// Events (SEP-50 spec):
    /// * topics – `["transfer", from: Address, to: Address]`
    /// * data   – `token_id: TokenID`
    pub fn transfer(env: Env, from: Address, to: Address, token_id: u32) {
        from.require_auth();
        Self::assert_exists(&env, token_id);

        let owner: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .unwrap();

        if owner != from {
            panic!("PropertyNft: from is not the token owner");
        }

        Self::do_transfer(&env, from.clone(), to.clone(), token_id);
    }

    /// Transfer `token_id` from `from` to `to` using `spender`'s approval.
    ///
    /// `spender` must be:
    /// * the per-token approved address (via `approve`), OR
    /// * an approved operator for `from` (via `approve_for_all`).
    ///
    /// SEP-50 required: `fn transfer_from(e: &Env, spender: Address, from: Address, to: Address, token_id: TokenID)`
    ///
    /// Events (SEP-50 spec):
    /// * topics – `["transfer", from: Address, to: Address]`
    /// * data   – `token_id: TokenID`
    pub fn transfer_from(
        env: Env,
        spender: Address,
        from: Address,
        to: Address,
        token_id: u32,
    ) {
        spender.require_auth();
        Self::assert_exists(&env, token_id);

        let owner: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .unwrap();

        if owner != from {
            panic!("PropertyNft: from is not the token owner");
        }

        let current_ledger = env.ledger().sequence();

        // Check per-token approval.
        let token_approved = env
            .storage()
            .persistent()
            .get::<_, ApprovalEntry>(&DataKey::Approval(token_id))
            .map(|e| e.approved == spender && e.live_until_ledger >= current_ledger)
            .unwrap_or(false);

        // Check operator approval (approve_for_all).
        let operator_approved = env
            .storage()
            .persistent()
            .get::<_, u32>(&DataKey::OperatorApproval(from.clone(), spender.clone()))
            .map(|exp| exp >= current_ledger)
            .unwrap_or(false);

        if !token_approved && !operator_approved {
            panic!("PropertyNft: spender is not approved");
        }

        Self::do_transfer(&env, from.clone(), to.clone(), token_id);
    }

    // ── SEP-50: Approvals ─────────────────────────────────────────────────────

    /// Approve `approved` to transfer `token_id` until `live_until_ledger`.
    ///
    /// * `approver` must be the token owner or a valid `approve_for_all` operator.
    /// * Only one address can be approved per token at a time.
    /// * To remove approval, approve your own address (or set live_until_ledger = 0).
    ///
    /// SEP-50 required: `fn approve(e, approver, approved, token_id, live_until_ledger)`
    ///
    /// Events (SEP-50 spec):
    /// * topics – `["approve", owner: Address, token_id: TokenID]`
    /// * data   – `[approved: Address, live_until_ledger: u32]`
    pub fn approve(
        env: Env,
        approver: Address,
        approved: Address,
        token_id: u32,
        live_until_ledger: u32,
    ) {
        approver.require_auth();
        Self::assert_exists(&env, token_id);

        let owner: Address = env
            .storage()
            .persistent()
            .get(&DataKey::Owner(token_id))
            .unwrap();

        // Approver must be token owner OR a valid operator for the owner.
        let current_ledger = env.ledger().sequence();
        let is_operator = env
            .storage()
            .persistent()
            .get::<_, u32>(&DataKey::OperatorApproval(owner.clone(), approver.clone()))
            .map(|exp| exp >= current_ledger)
            .unwrap_or(false);

        if owner != approver && !is_operator {
            panic!("PropertyNft: approver is not owner or operator");
        }

        if live_until_ledger == 0 {
            // Revoke approval.
            env.storage()
                .persistent()
                .remove(&DataKey::Approval(token_id));
        } else {
            if live_until_ledger < current_ledger {
                panic!("PropertyNft: live_until_ledger is in the past");
            }
            env.storage().persistent().set(
                &DataKey::Approval(token_id),
                &ApprovalEntry {
                    approved: approved.clone(),
                    live_until_ledger,
                },
            );
        }

        // SEP-50 event: topics ["approve", owner, token_id], data [approved, live_until_ledger]
        env.events().publish(
            (Symbol::new(&env, "approve"), owner, token_id),
            (approved, live_until_ledger),
        );
    }

    /// Grant or revoke `operator` as an operator for all tokens owned by `owner`.
    ///
    /// Operators can call `transfer_from` on any token held by `owner` and can
    /// call `approve` on behalf of `owner`.
    ///
    /// Set `live_until_ledger = 0` to revoke.
    ///
    /// SEP-50 required: `fn approve_for_all(e, owner, operator, live_until_ledger)`
    ///
    /// Events (SEP-50 spec):
    /// * topics – `["approve_for_all", owner: Address]`
    /// * data   – `[operator: Address, live_until_ledger: u32]`
    pub fn approve_for_all(env: Env, owner: Address, operator: Address, live_until_ledger: u32) {
        owner.require_auth();

        if live_until_ledger == 0 {
            // Revoke operator.
            env.storage()
                .persistent()
                .remove(&DataKey::OperatorApproval(owner.clone(), operator.clone()));
        } else {
            let current_ledger = env.ledger().sequence();
            if live_until_ledger < current_ledger {
                panic!("PropertyNft: live_until_ledger is in the past");
            }
            env.storage().persistent().set(
                &DataKey::OperatorApproval(owner.clone(), operator.clone()),
                &live_until_ledger,
            );
        }

        // SEP-50 event: topics ["approve_for_all", owner], data [operator, live_until_ledger]
        env.events().publish(
            (Symbol::new(&env, "approve_for_all"), owner),
            (operator, live_until_ledger),
        );
    }

    /// Returns the currently approved address for `token_id`, if any and not expired.
    /// Panics if the token does not exist.
    /// SEP-50 required: `fn get_approved(e: &Env, token_id: TokenID) -> Option<Address>`
    pub fn get_approved(env: Env, token_id: u32) -> Option<Address> {
        Self::assert_exists(&env, token_id);
        let current_ledger = env.ledger().sequence();
        env.storage()
            .persistent()
            .get::<_, ApprovalEntry>(&DataKey::Approval(token_id))
            .and_then(|e| {
                if e.live_until_ledger >= current_ledger {
                    Some(e.approved)
                } else {
                    None
                }
            })
    }

    /// Returns whether `operator` is approved to manage all tokens of `owner`.
    /// SEP-50 required: `fn is_approved_for_all(e: &Env, owner: Address, operator: Address) -> bool`
    pub fn is_approved_for_all(env: Env, owner: Address, operator: Address) -> bool {
        let current_ledger = env.ledger().sequence();
        env.storage()
            .persistent()
            .get::<_, u32>(&DataKey::OperatorApproval(owner, operator))
            .map(|exp| exp >= current_ledger)
            .unwrap_or(false)
    }

    // ── Landledger Extensions ─────────────────────────────────────────────────

    /// Mint a new property deed NFT to `to`.
    ///
    /// * Admin-only.
    /// * Each `property_id` may only have **one** token minted.
    /// * `token_uri` should point to a JSON file conforming to the SEP-50
    ///   "Non-Fungible Metadata JSON Schema".
    ///
    /// SEP-50 Mint event:
    /// * topics – `["mint", to: Address]`
    /// * data   – `token_id: TokenID`
    pub fn mint(
        env: Env,
        admin: Address,
        to: Address,
        property_id: u32,
        token_uri: String,
    ) -> u32 {
        admin.require_auth();
        Self::assert_admin(&env, &admin);

        if env
            .storage()
            .persistent()
            .has(&DataKey::HasToken(property_id))
        {
            panic!("PropertyNft: property already has a token");
        }

        let mut counter: u32 = env.storage().instance().get(&DataKey::Counter).unwrap();
        counter += 1;
        env.storage().instance().set(&DataKey::Counter, &counter);

        // Store ownership and URI.
        env.storage()
            .persistent()
            .set(&DataKey::Owner(counter), &to);
        env.storage()
            .persistent()
            .set(&DataKey::Uri(counter), &token_uri);

        // Update balance.
        let bal: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0u32);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(bal + 1));

        // Store property → token mapping.
        env.storage()
            .persistent()
            .set(&DataKey::PropertyToToken(property_id), &counter);
        env.storage()
            .persistent()
            .set(&DataKey::HasToken(property_id), &true);

        // SEP-50 mint event: topics ["mint", to], data token_id
        env.events()
            .publish((Symbol::new(&env, "mint"), to), counter);

        counter
    }

    /// Update the metadata URI for an existing token (admin only).
    pub fn set_token_uri(env: Env, admin: Address, token_id: u32, token_uri: String) {
        admin.require_auth();
        Self::assert_admin(&env, &admin);
        Self::assert_exists(&env, token_id);
        env.storage()
            .persistent()
            .set(&DataKey::Uri(token_id), &token_uri);
    }

    /// Total number of tokens minted.
    pub fn total_supply(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Counter).unwrap()
    }

    /// Get the `token_id` for a given `property_id`.
    pub fn get_token_by_property(env: Env, property_id: u32) -> u32 {
        env.storage()
            .persistent()
            .get(&DataKey::PropertyToToken(property_id))
            .unwrap_or_else(|| panic!("PropertyNft: no token for this property"))
    }

    /// Check whether a `property_id` already has a minted token.
    pub fn has_token(env: Env, property_id: u32) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::HasToken(property_id))
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /// Shared transfer logic: updates owner, balance, and clears per-token approval.
    fn do_transfer(env: &Env, from: Address, to: Address, token_id: u32) {
        // Update ownership.
        env.storage()
            .persistent()
            .set(&DataKey::Owner(token_id), &to);

        // Decrement sender balance.
        let from_bal: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0u32);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &from_bal.saturating_sub(1));

        // Increment receiver balance.
        let to_bal: u32 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0u32);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(to_bal + 1));

        // Clear per-token approval (SEP-50: "The approval is cleared when the token is transferred").
        env.storage()
            .persistent()
            .remove(&DataKey::Approval(token_id));

        // SEP-50 transfer event: topics ["transfer", from, to], data token_id
        env.events().publish(
            (Symbol::new(env, "transfer"), from, to),
            token_id,
        );
    }

    fn assert_exists(env: &Env, token_id: u32) {
        if !env.storage().persistent().has(&DataKey::Owner(token_id)) {
            panic!("PropertyNft: token does not exist");
        }
    }

    fn assert_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != *caller {
            panic!("PropertyNft: caller is not admin");
        }
    }
}
