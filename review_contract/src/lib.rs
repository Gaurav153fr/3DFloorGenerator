#![no_std]

use soroban_sdk::{contract, contractimpl, Env, Symbol, Bytes, Address};

// Contract definition
#[contract]
pub struct ReviewContract;

// Implementation
#[contractimpl]
impl ReviewContract {

    // Create a review task with bounty
    pub fn create_task(
        env: Env,
        task_id: Symbol,
        data: Bytes,
        creator: Address,
        bounty: i128,
    ) {
        // Store task data
        env.storage().instance().set(&task_id, &(data, creator, bounty, false));
    }

    // Submit review and mark as completed
    pub fn submit_review(env: Env, task_id: Symbol, reviewer: Address) {
        let (data, creator, bounty, reviewed): (Bytes, Address, i128, bool) =
            env.storage().instance().get(&task_id).unwrap();

        // Prevent double review
        if reviewed {
            panic!("Already reviewed");
        }

        // Mark as reviewed
        env.storage().instance().set(&task_id, &(data, creator, bounty, true));

        // NOTE:
        // Real XLM transfer would go here
        // For hackathon → simulate reward
    }

    // Get task data
    pub fn get_task(env: Env, task_id: Symbol) -> (Bytes, Address, i128, bool) {
        env.storage().instance().get(&task_id).unwrap()
    }
}