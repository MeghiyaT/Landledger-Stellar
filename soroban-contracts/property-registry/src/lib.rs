#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String};

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

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Property(u32),
    Counter,
    Admin,
    Approval(u32),
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ApprovalEntry {
    pub approved: Address,
    pub live_until_ledger: u32,
}

#[contract]
pub struct PropertyRegistry;

#[contractimpl]
impl PropertyRegistry {
    /// Initialize the registry with an admin address
    pub fn init(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Registry already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Counter, &0u32);
    }

    /// Register a new property
    pub fn register_property(
        env: Env,
        owner: Address,
        title: String,
        location: String,
        price: u128,
    ) -> u32 {
        owner.require_auth();

        let mut counter: u32 = env.storage().instance().get(&DataKey::Counter).unwrap();
        counter += 1;
        env.storage().instance().set(&DataKey::Counter, &counter);

        let timestamp = env.ledger().timestamp();
        let prop = Property {
            property_id: counter,
            owner,
            title,
            location,
            price,
            is_active: true,
            is_verified: true, // Known limitation: auto-verified until an admin verification flow is introduced and redeployed.
            is_for_sale: false,
            created_at: timestamp,
            updated_at: timestamp,
        };

        env.storage().persistent().set(&DataKey::Property(counter), &prop);
        
        env.events().publish((symbol_short!("Register"), counter), prop.clone());
        counter
    }

    /// Update property details (Only Owner)
    pub fn update_property(
        env: Env,
        property_id: u32,
        title: String,
        price: u128,
    ) {
        let mut prop: Property = env.storage().persistent().get(&DataKey::Property(property_id)).unwrap();
        prop.owner.require_auth();
        
        if !prop.is_active {
            panic!("Property is not active");
        }

        prop.title = title;
        prop.price = price;
        prop.updated_at = env.ledger().timestamp();

        env.storage().persistent().set(&DataKey::Property(property_id), &prop);
        env.events().publish((symbol_short!("Updated"), property_id), prop);
    }

    /// Transfer property ownership 
    pub fn transfer_ownership(
        env: Env,
        property_id: u32,
        new_owner: Address,
    ) {
        let mut prop: Property = env.storage().persistent().get(&DataKey::Property(property_id)).unwrap();
        
        // Authorization: owner OR approved escrow contract
        let current_ledger = env.ledger().sequence();
        let is_approved = if let Some(approval) = env.storage().persistent().get::<_, ApprovalEntry>(&DataKey::Approval(property_id)) {
            if approval.live_until_ledger < current_ledger {
                env.storage().persistent().remove(&DataKey::Approval(property_id));
                false
            } else {
                approval.approved.require_auth();
                true
            }
        } else {
            false
        };

        if !is_approved {
            prop.owner.require_auth();
        }

        if !prop.is_active {
            panic!("Property is not active");
        }
        if !prop.is_verified {
            panic!("Property must be verified");
        }

        // Clear approval
        env.storage().persistent().remove(&DataKey::Approval(property_id));

        prop.owner = new_owner.clone();
        prop.is_for_sale = false;
        prop.updated_at = env.ledger().timestamp();

        env.storage().persistent().set(&DataKey::Property(property_id), &prop);
        env.events().publish((symbol_short!("Transfer"), property_id), new_owner);
    }

    /// List property for sale
    pub fn list_for_sale(
        env: Env,
        property_id: u32,
        price: u128,
    ) {
        let mut prop: Property = env.storage().persistent().get(&DataKey::Property(property_id)).unwrap();
        prop.owner.require_auth();

        if !prop.is_active || !prop.is_verified {
            panic!("Property cannot be listed");
        }

        prop.is_for_sale = true;
        prop.price = price;
        prop.updated_at = env.ledger().timestamp();

        env.storage().persistent().set(&DataKey::Property(property_id), &prop);
        env.events().publish((symbol_short!("Listed"), property_id), price);
    }

    /// Remove property from sale
    pub fn remove_from_sale(
        env: Env,
        property_id: u32,
    ) {
        let mut prop: Property = env.storage().persistent().get(&DataKey::Property(property_id)).unwrap();
        prop.owner.require_auth();

        prop.is_for_sale = false;
        prop.updated_at = env.ledger().timestamp();

        env.storage().persistent().set(&DataKey::Property(property_id), &prop);
    }

    /// Approve an address for transfer (e.g. Escrow Contract)
    pub fn approve(
        env: Env,
        property_id: u32,
        to: Address,
    ) {
        let default_expiry = env.ledger().sequence().saturating_add(518_400u32);
        Self::approve_with_expiry(env, property_id, to, default_expiry);
    }

    pub fn approve_with_expiry(
        env: Env,
        property_id: u32,
        to: Address,
        live_until_ledger: u32,
    ) {
        let prop: Property = env.storage().persistent().get(&DataKey::Property(property_id)).unwrap();
        prop.owner.require_auth();

        if live_until_ledger < env.ledger().sequence() {
            panic!("Approval expiry must be in the future");
        }

        let approval = ApprovalEntry {
            approved: to,
            live_until_ledger,
        };

        env.storage().persistent().set(&DataKey::Approval(property_id), &approval);
    }

    /// Get property details
    pub fn get_property(
        env: Env,
        property_id: u32,
    ) -> Property {
        env.storage().persistent().get(&DataKey::Property(property_id)).unwrap()
    }
}
