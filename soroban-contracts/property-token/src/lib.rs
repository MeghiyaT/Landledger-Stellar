#![no_std]
//! # PropertyToken — Soroban Fungible Token Contract
//!
//! ## Stellar Context
//!
//! On Stellar the canonical approach for a **custom fungible token** is to
//! deploy the **Stellar Asset Contract (SAC)** — a built-in Soroban contract
//! that wraps a Stellar Classic asset and exposes the SEP-41 (Token) interface.
//!
//! However, if you need **additional minting / burning / pause controls** (as
//! `PropertyToken.sol` did) beyond what SAC provides, the recommended pattern
//! is to write a **custom token contract** that:
//!
//! 1. Stores all balances, allowances, and supply itself.
//! 2. Implements the SEP-41 interface (`transfer`, `transfer_from`, `approve`,
//!    `balance`, `allowance`, `decimals`, `name`, `symbol`, `total_supply`).
//! 3. Extends it with platform-specific controls (`mint`, `burn`, `pause`).
//!
//! This contract follows that pattern, making it a drop-in replacement for
//! `PropertyToken.sol` while being fully native to Soroban.
//!
//! ### Supply cap
//! MAX_SUPPLY  = 1 000 000 000 × 10^7 (7 decimal places, Stellar convention)
//! INIT_SUPPLY =   100 000 000 × 10^7

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env, String,
};

// ── Constants ─────────────────────────────────────────────────────────────────

/// Maximum total supply: 1 billion tokens with 7 decimals.
const MAX_SUPPLY: i128 = 1_000_000_000 * 10_i128.pow(7);

/// Initial supply minted to the admin on `init`: 100 million tokens.
const INIT_SUPPLY: i128 = 100_000_000 * 10_i128.pow(7);

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Admin / contract owner.
    Admin,
    /// Whether token transfers are paused.
    Paused,
    /// Total token supply.
    TotalSupply,
    /// Balance of an account.
    Balance(Address),
    /// Allowance: (owner, spender) → amount.
    Allowance(Address, Address),
    /// Approved minters (in addition to admin).
    Minter(Address),
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct PropertyToken;

#[contractimpl]
impl PropertyToken {
    // ── Initialization ────────────────────────────────────────────────────────

    /// Deploy and initialize the token.
    ///
    /// * `admin` – receives the initial supply and becomes the admin.
    ///
    /// Panics if already initialized.
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("PropertyToken: already initialized");
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &INIT_SUPPLY);

        env.storage()
            .persistent()
            .set(&DataKey::Balance(admin.clone()), &INIT_SUPPLY);

        env.events().publish(
            (symbol_short!("Token"), symbol_short!("Init")),
            (admin, INIT_SUPPLY),
        );
    }

    // ── SEP-41 Metadata ───────────────────────────────────────────────────────

    pub fn name(_env: Env) -> String {
        // soroban_sdk::String requires an Env reference; we use a workaround
        // via the passed env.
        soroban_sdk::String::from_str(&_env, "PropertyToken")
    }

    pub fn symbol(_env: Env) -> String {
        soroban_sdk::String::from_str(&_env, "PROP")
    }

    pub fn decimals(_env: Env) -> u32 {
        7
    }

    // ── SEP-41 Balance / Supply ───────────────────────────────────────────────

    pub fn total_supply(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0)
    }

    pub fn balance(env: Env, account: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Balance(account))
            .unwrap_or(0)
    }

    // ── SEP-41 Allowances ─────────────────────────────────────────────────────

    pub fn allowance(env: Env, owner: Address, spender: Address) -> i128 {
        env.storage()
            .persistent()
            .get(&DataKey::Allowance(owner, spender))
            .unwrap_or(0)
    }

    pub fn approve(env: Env, owner: Address, spender: Address, amount: i128) {
        owner.require_auth();
        if amount < 0 {
            panic!("PropertyToken: amount must be >= 0");
        }
        env.storage()
            .persistent()
            .set(&DataKey::Allowance(owner.clone(), spender.clone()), &amount);
        env.events().publish(
            (symbol_short!("Token"), symbol_short!("Approve")),
            (owner, spender, amount),
        );
    }

    // ── SEP-41 Transfer ───────────────────────────────────────────────────────

    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        Self::assert_not_paused(&env);
        Self::do_transfer(&env, &from, &to, amount);
    }

    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        Self::assert_not_paused(&env);

        let allowance = Self::allowance(env.clone(), from.clone(), spender.clone());
        if allowance < amount {
            panic!("PropertyToken: insufficient allowance");
        }
        env.storage().persistent().set(
            &DataKey::Allowance(from.clone(), spender),
            &(allowance - amount),
        );
        Self::do_transfer(&env, &from, &to, amount);
    }

    // ── Minting & Burning ─────────────────────────────────────────────────────

    /// Mint `amount` new tokens to `to`.
    ///
    /// Caller must be the admin or an approved minter.
    pub fn mint(env: Env, caller: Address, to: Address, amount: i128) {
        caller.require_auth();
        Self::assert_minter(&env, &caller);

        if amount <= 0 {
            panic!("PropertyToken: amount must be > 0");
        }

        let current_supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);
        if current_supply + amount > MAX_SUPPLY {
            panic!("PropertyToken: max supply exceeded");
        }

        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(current_supply + amount));

        let bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(bal + amount));

        env.events().publish(
            (symbol_short!("Token"), symbol_short!("Mint")),
            (to, amount),
        );
    }

    /// Burn `amount` tokens from `from` (caller must be `from` or admin).
    pub fn burn(env: Env, from: Address, amount: i128) {
        from.require_auth();

        if amount <= 0 {
            panic!("PropertyToken: amount must be > 0");
        }

        let bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if bal < amount {
            panic!("PropertyToken: insufficient balance to burn");
        }

        let current_supply: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalSupply)
            .unwrap_or(0);

        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(bal - amount));
        env.storage()
            .instance()
            .set(&DataKey::TotalSupply, &(current_supply - amount));

        env.events().publish(
            (symbol_short!("Token"), symbol_short!("Burn")),
            (from, amount),
        );
    }

    // ── Pause ─────────────────────────────────────────────────────────────────

    /// Pause all transfers (admin only).
    pub fn pause(env: Env, admin: Address) {
        admin.require_auth();
        Self::assert_admin(&env, &admin);
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events()
            .publish((symbol_short!("Token"), symbol_short!("Paused")), ());
    }

    /// Resume transfers (admin only).
    pub fn unpause(env: Env, admin: Address) {
        admin.require_auth();
        Self::assert_admin(&env, &admin);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events()
            .publish((symbol_short!("Token"), symbol_short!("Unpause")), ());
    }

    // ── Minter management ─────────────────────────────────────────────────────

    /// Grant `account` minting permission (admin only).
    pub fn add_minter(env: Env, admin: Address, account: Address) {
        admin.require_auth();
        Self::assert_admin(&env, &admin);
        env.storage()
            .persistent()
            .set(&DataKey::Minter(account.clone()), &true);
        env.events().publish(
            (symbol_short!("Token"), symbol_short!("MintAdd")),
            account,
        );
    }

    /// Revoke `account`'s minting permission (admin only).
    pub fn remove_minter(env: Env, admin: Address, account: Address) {
        admin.require_auth();
        Self::assert_admin(&env, &admin);
        env.storage()
            .persistent()
            .remove(&DataKey::Minter(account.clone()));
        env.events().publish(
            (symbol_short!("Token"), symbol_short!("MintRm")),
            account,
        );
    }

    /// Check whether `account` has minting permission.
    pub fn is_minter(env: Env, account: Address) -> bool {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin == account {
            return true;
        }
        env.storage()
            .persistent()
            .get::<_, bool>(&DataKey::Minter(account))
            .unwrap_or(false)
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    fn do_transfer(env: &Env, from: &Address, to: &Address, amount: i128) {
        if amount <= 0 {
            panic!("PropertyToken: transfer amount must be > 0");
        }
        let from_bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);
        if from_bal < amount {
            panic!("PropertyToken: insufficient balance");
        }
        env.storage()
            .persistent()
            .set(&DataKey::Balance(from.clone()), &(from_bal - amount));

        let to_bal: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(to.clone()))
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::Balance(to.clone()), &(to_bal + amount));

        env.events().publish(
            (symbol_short!("Token"), symbol_short!("Xfer")),
            (from.clone(), to.clone(), amount),
        );
    }

    fn assert_not_paused(env: &Env) {
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            panic!("PropertyToken: transfers are paused");
        }
    }

    fn assert_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != *caller {
            panic!("PropertyToken: caller is not admin");
        }
    }

    fn assert_minter(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin == *caller {
            return; // admin is always a minter
        }
        let ok: bool = env
            .storage()
            .persistent()
            .get::<_, bool>(&DataKey::Minter(caller.clone()))
            .unwrap_or(false);
        if !ok {
            panic!("PropertyToken: caller is not a minter");
        }
    }
}
