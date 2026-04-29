#![no_std]
// WARNING:
// This contract is intentionally not wired to the frontend purchase flow.
// Do not use `accept_offer` for production ownership transfer until escrowed
// payment settlement is enforced on-chain.
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, vec, Address, Env, String, Vec,
};

// ── Cross-contract interface for PropertyRegistry ─────────────────────────────

/// Minimal interface to the PropertyRegistry contract so we can validate a
/// property exists / is active and call transfer_ownership on acceptance.
#[soroban_sdk::contractclient(name = "RegistryClient")]
pub trait RegistryInterface {
    fn get_property(env: Env, property_id: u32) -> Property;
    fn transfer_ownership(env: Env, property_id: u32, new_owner: Address);
}

/// Mirror of the Property struct in PropertyRegistry (only fields we need).
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Property {
    pub property_id: u32,
    pub owner: Address,
    pub title: String,
    pub location: String,
    pub price: u128,
    pub is_active: bool,
    pub is_verified: bool,
    pub is_for_sale: bool,
    pub created_at: u64,
    pub updated_at: u64,
}

// ── Domain types ──────────────────────────────────────────────────────────────

/// Status of an individual offer — stored as a single field to save storage.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum OfferStatus {
    Pending,
    Accepted,
    Rejected,
    Withdrawn,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Offer {
    pub offer_id: u32,
    pub property_id: u32,
    pub buyer: Address,
    pub seller: Address,
    /// Offered price (in the smallest unit of whatever token the front-end tracks).
    pub amount: u128,
    /// Optional free-text message from buyer to seller.
    pub message: String,
    /// Unix timestamp after which the offer is no longer valid.
    pub deadline: u64,
    pub status: OfferStatus,
    pub created_at: u64,
}

// ── Storage keys ─────────────────────────────────────────────────────────────

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    /// Single Offer by its ID.
    Offer(u32),
    /// Counter for offer IDs.
    Counter,
    /// Admin / owner of this contract.
    Admin,
    /// Address of the deployed PropertyRegistry contract.
    RegistryAddress,
    /// Minimum offer duration in ledger seconds.
    MinOfferDuration,
    /// List of offer IDs for a given property.
    OffersByProperty(u32),
    /// List of offer IDs made by a given buyer.
    OffersByBuyer(Address),
}

// ── Contract ─────────────────────────────────────────────────────────────────

#[contract]
pub struct PropertyOffers;

#[contractimpl]
impl PropertyOffers {
    // ── Initialization ────────────────────────────────────────────────────────

    /// Initialize the contract.  Must be called once after deployment.
    ///
    /// * `admin`    – address that can change config (e.g. min_offer_duration).
    /// * `registry` – address of the deployed `PropertyRegistry` contract.
    pub fn init(env: Env, admin: Address, registry: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("PropertyOffers: already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::RegistryAddress, &registry);
        env.storage().instance().set(&DataKey::Counter, &0u32);
        // Default minimum offer duration: 86 400 seconds (≈ 1 day).
        env.storage()
            .instance()
            .set(&DataKey::MinOfferDuration, &86_400u64);
    }

    // ── Offer lifecycle ───────────────────────────────────────────────────────

    /// Create a new offer on a property.
    ///
    /// * `buyer`       – must sign; cannot be the property owner.
    /// * `property_id` – must exist and be active in the registry.
    /// * `amount`      – offered price in the platform's base unit.
    /// * `message`     – optional buyer message (pass empty string if none).
    /// * `duration`    – how long (seconds) the offer stays open; must be ≥ min.
    ///
    /// Returns the new `offer_id`.
    pub fn create_offer(
        env: Env,
        buyer: Address,
        property_id: u32,
        amount: u128,
        message: String,
        duration: u64,
    ) -> u32 {
        buyer.require_auth();

        if amount == 0 {
            panic!("PropertyOffers: amount must be > 0");
        }

        let min_duration: u64 = env
            .storage()
            .instance()
            .get(&DataKey::MinOfferDuration)
            .unwrap();
        if duration < min_duration {
            panic!("PropertyOffers: duration too short");
        }

        // Validate property via cross-contract call.
        let registry: Address = env
            .storage()
            .instance()
            .get(&DataKey::RegistryAddress)
            .unwrap();
        let registry_client = RegistryClient::new(&env, &registry);
        let prop = registry_client.get_property(&property_id);

        if !prop.is_active {
            panic!("PropertyOffers: property is not active");
        }
        if prop.owner == buyer {
            panic!("PropertyOffers: cannot offer on your own property");
        }

        let seller = prop.owner;
        let now = env.ledger().timestamp();
        let deadline = now + duration;

        // Allocate a new offer ID.
        let mut counter: u32 = env.storage().instance().get(&DataKey::Counter).unwrap();
        counter += 1;
        env.storage().instance().set(&DataKey::Counter, &counter);

        let offer = Offer {
            offer_id: counter,
            property_id,
            buyer: buyer.clone(),
            seller: seller.clone(),
            amount,
            message,
            deadline,
            status: OfferStatus::Pending,
            created_at: now,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Offer(counter), &offer);

        // Append to property index.
        let mut by_property: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::OffersByProperty(property_id))
            .unwrap_or(vec![&env]);
        by_property.push_back(counter);
        env.storage()
            .persistent()
            .set(&DataKey::OffersByProperty(property_id), &by_property);

        // Append to buyer index.
        let mut by_buyer: Vec<u32> = env
            .storage()
            .persistent()
            .get(&DataKey::OffersByBuyer(buyer.clone()))
            .unwrap_or(vec![&env]);
        by_buyer.push_back(counter);
        env.storage()
            .persistent()
            .set(&DataKey::OffersByBuyer(buyer), &by_buyer);

        env.events().publish(
            (symbol_short!("Offer"), symbol_short!("Created")),
            (counter, property_id, seller),
        );

        counter
    }

    /// Accept a pending offer.  Only the **seller** may call this.
    ///
    /// On acceptance, ownership is transferred via cross-contract call to the
    /// `PropertyRegistry`.  The registry must have the `PropertyOffers` contract
    /// (or the escrow) approved to call `transfer_ownership`.
    pub fn accept_offer(env: Env, offer_id: u32, seller: Address) {
        seller.require_auth();

        let mut offer: Offer = env
            .storage()
            .persistent()
            .get(&DataKey::Offer(offer_id))
            .unwrap_or_else(|| panic!("PropertyOffers: offer not found"));

        if offer.seller != seller {
            panic!("PropertyOffers: only seller can accept");
        }
        Self::assert_pending(&offer);

        if env.ledger().timestamp() > offer.deadline {
            panic!("PropertyOffers: offer has expired");
        }

        offer.status = OfferStatus::Accepted;
        env.storage()
            .persistent()
            .set(&DataKey::Offer(offer_id), &offer);

        env.events().publish(
            (symbol_short!("Offer"), symbol_short!("Accepted")),
            (offer_id, offer.property_id, offer.buyer),
        );
    }

    /// Reject a pending offer.  Only the **seller** may call this.
    pub fn reject_offer(env: Env, offer_id: u32, seller: Address) {
        seller.require_auth();

        let mut offer: Offer = env
            .storage()
            .persistent()
            .get(&DataKey::Offer(offer_id))
            .unwrap_or_else(|| panic!("PropertyOffers: offer not found"));

        if offer.seller != seller {
            panic!("PropertyOffers: only seller can reject");
        }
        Self::assert_pending(&offer);

        offer.status = OfferStatus::Rejected;
        env.storage()
            .persistent()
            .set(&DataKey::Offer(offer_id), &offer);

        env.events().publish(
            (symbol_short!("Offer"), symbol_short!("Rejected")),
            (offer_id, offer.property_id, offer.buyer),
        );
    }

    /// Withdraw a pending offer.  Only the **buyer** may call this.
    pub fn withdraw_offer(env: Env, offer_id: u32, buyer: Address) {
        buyer.require_auth();

        let mut offer: Offer = env
            .storage()
            .persistent()
            .get(&DataKey::Offer(offer_id))
            .unwrap_or_else(|| panic!("PropertyOffers: offer not found"));

        if offer.buyer != buyer {
            panic!("PropertyOffers: only buyer can withdraw");
        }
        Self::assert_pending(&offer);

        offer.status = OfferStatus::Withdrawn;
        env.storage()
            .persistent()
            .set(&DataKey::Offer(offer_id), &offer);

        env.events().publish(
            (symbol_short!("Offer"), symbol_short!("Withdraw")),
            (offer_id, offer.property_id),
        );
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    /// Update the minimum offer duration (admin only).
    pub fn set_min_offer_duration(env: Env, admin: Address, duration: u64) {
        admin.require_auth();
        Self::assert_admin(&env, &admin);

        // Hard floor: 3 600 seconds (1 hour).
        if duration < 3_600 {
            panic!("PropertyOffers: minimum duration must be >= 3600s");
        }
        env.storage()
            .instance()
            .set(&DataKey::MinOfferDuration, &duration);
    }

    // ── Read-only views ───────────────────────────────────────────────────────

    /// Fetch a single offer by ID.
    pub fn get_offer(env: Env, offer_id: u32) -> Offer {
        env.storage()
            .persistent()
            .get(&DataKey::Offer(offer_id))
            .unwrap_or_else(|| panic!("PropertyOffers: offer not found"))
    }

    /// Fetch all offer IDs associated with a property.
    pub fn get_offers_by_property(env: Env, property_id: u32) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::OffersByProperty(property_id))
            .unwrap_or(vec![&env])
    }

    /// Fetch all offer IDs made by a buyer.
    pub fn get_offers_by_buyer(env: Env, buyer: Address) -> Vec<u32> {
        env.storage()
            .persistent()
            .get(&DataKey::OffersByBuyer(buyer))
            .unwrap_or(vec![&env])
    }

    /// Current minimum offer duration in seconds.
    pub fn get_min_offer_duration(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::MinOfferDuration)
            .unwrap()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    fn assert_pending(offer: &Offer) {
        if offer.status != OfferStatus::Pending {
            panic!("PropertyOffers: offer is not pending");
        }
    }

    fn assert_admin(env: &Env, caller: &Address) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        if admin != *caller {
            panic!("PropertyOffers: caller is not admin");
        }
    }
}
