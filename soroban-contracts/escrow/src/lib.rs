#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, Symbol, token};

// We create a minimal interface trait to call the PropertyRegistry contract
#[soroban_sdk::contractclient(name = "RegistryClient")]
pub trait RegistryInterface {
    fn transfer_ownership(env: Env, property_id: u32, new_owner: Address);
    fn get_property(env: Env, property_id: u32) -> Property;
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Property {
    pub property_id: u32,
    pub owner: Address,
    // ...other fields, we primarily need this for interface alignment in actual impl
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowTransaction {
    pub transaction_id: u32,
    pub property_id: u32,
    pub buyer: Address,
    pub seller: Address,
    pub amount: u128,
    pub token: Address,
    pub deadline: u64,
    pub is_completed: bool,
    pub is_cancelled: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum DataKey {
    Transaction(u32),
    Counter,
    RegistryAddress,
    PlatformFeeBps,
    Admin,
}

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    pub fn init(env: Env, admin: Address, registry: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Escrow already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::RegistryAddress, &registry);
        env.storage().instance().set(&DataKey::Counter, &0u32);
        env.storage().instance().set(&DataKey::PlatformFeeBps, &250u32); // 2.5% platform fee
    }

    pub fn create_escrow(
        env: Env,
        buyer: Address, // explicitly passed here to sign
        property_id: u32,
        seller: Address,
        token: Address,
        amount: u128,
        deadline: u64,
    ) -> u32 {
        buyer.require_auth();

        if deadline <= env.ledger().timestamp() {
            panic!("Invalid deadline");
        }

        // Lock buyer's tokens into the escrow contract
        let token_client = token::Client::new(&env, &token);
        token_client.transfer(&buyer, &env.current_contract_address(), &(amount as i128));

        let mut counter: u32 = env.storage().instance().get(&DataKey::Counter).unwrap();
        counter += 1;
        env.storage().instance().set(&DataKey::Counter, &counter);

        let txn = EscrowTransaction {
            transaction_id: counter,
            property_id,
            buyer: buyer.clone(),
            seller: seller.clone(),
            amount,
            token,
            deadline,
            is_completed: false,
            is_cancelled: false,
        };

        env.storage().persistent().set(&DataKey::Transaction(counter), &txn);
        env.events().publish((symbol_short!("Escrow"), symbol_short!("Created")), counter);
        
        counter
    }

    pub fn complete_escrow(env: Env, transaction_id: u32, buyer: Address) {
        buyer.require_auth();

        let mut txn: EscrowTransaction = env.storage().persistent().get(&DataKey::Transaction(transaction_id)).unwrap();
        
        if txn.buyer != buyer {
            panic!("Only buyer can complete");
        }
        if txn.is_completed || txn.is_cancelled {
            panic!("Transaction closed");
        }
        if env.ledger().timestamp() > txn.deadline {
            panic!("Transaction expired");
        }

        txn.is_completed = true;
        env.storage().persistent().set(&DataKey::Transaction(transaction_id), &txn);

        let fee_bps: u32 = env.storage().instance().get(&DataKey::PlatformFeeBps).unwrap();
        let fee = (txn.amount * (fee_bps as u128)) / 10000;
        let seller_amount = txn.amount - fee;

        let token_client = token::Client::new(&env, &txn.token);
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();

        // Payout seller
        token_client.transfer(&env.current_contract_address(), &txn.seller, &(seller_amount as i128));
        
        // Payout admin fee
        if fee > 0 {
            token_client.transfer(&env.current_contract_address(), &admin, &(fee as i128));
        }

        // Cross-contract call to Registry to transfer ownership
        let registry: Address = env.storage().instance().get(&DataKey::RegistryAddress).unwrap();
        let registry_client = RegistryClient::new(&env, &registry);
        registry_client.transfer_ownership(&txn.property_id, &txn.buyer);

        env.events().publish((symbol_short!("Escrow"), symbol_short!("Complete")), transaction_id);
    }

    pub fn cancel_escrow(env: Env, transaction_id: u32, buyer: Address) {
        buyer.require_auth();

        let mut txn: EscrowTransaction = env.storage().persistent().get(&DataKey::Transaction(transaction_id)).unwrap();

        if txn.buyer != buyer {
            panic!("Only buyer can cancel");
        }
        if txn.is_completed || txn.is_cancelled {
            panic!("Transaction closed");
        }
        if env.ledger().timestamp() <= txn.deadline {
            panic!("Cannot cancel before deadline");
        }

        txn.is_cancelled = true;
        env.storage().persistent().set(&DataKey::Transaction(transaction_id), &txn);

        // Refund buyer
        let token_client = token::Client::new(&env, &txn.token);
        token_client.transfer(&env.current_contract_address(), &txn.buyer, &(txn.amount as i128));

        env.events().publish((symbol_short!("Escrow"), symbol_short!("Cancel")), transaction_id);
    }
}
