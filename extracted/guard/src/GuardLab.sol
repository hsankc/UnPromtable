// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {GuardModel} from "./GuardModel.sol";
import {GuardModelNftPurchase} from "./categories/GuardModelNftPurchase.sol";
import {GuardModelDefiSwap} from "./categories/GuardModelDefiSwap.sol";
import {GuardModelSubscription} from "./categories/GuardModelSubscription.sol";
import {GuardModelTreasuryDao} from "./categories/GuardModelTreasuryDao.sol";
import {GuardModelSocialTip} from "./categories/GuardModelSocialTip.sol";

/// Read-only window onto the six trained guard models, so anyone can run a
/// feature vector through the exact on-chain weights with an eth_call.
/// Category ids match generate_vault.py (0 api_payment ... 5 social_tip).
contract GuardLab {
    function decide(uint8 category, int256[8] memory x) external pure returns (uint8 d, int256[3] memory o) {
        if (category == 0) return GuardModel.decide(x);
        if (category == 1) return GuardModelNftPurchase.decide(x);
        if (category == 2) return GuardModelDefiSwap.decide(x);
        if (category == 3) return GuardModelSubscription.decide(x);
        if (category == 4) return GuardModelTreasuryDao.decide(x);
        if (category == 5) return GuardModelSocialTip.decide(x);
        revert("unknown category");
    }
}
