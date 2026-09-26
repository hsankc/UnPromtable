// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test, console} from "forge-std/Test.sol";
import {GuardModelNftPurchase} from "../src/categories/GuardModelNftPurchase.sol";
import {GuardModelDefiSwap} from "../src/categories/GuardModelDefiSwap.sol";
import {GuardModelSubscription} from "../src/categories/GuardModelSubscription.sol";
import {GuardModelTreasuryDao} from "../src/categories/GuardModelTreasuryDao.sol";
import {GuardModelSocialTip} from "../src/categories/GuardModelSocialTip.sol";

contract CategoryModelsTest is Test {
    function test_nft_purchase() public pure {
        int256[8][5] memory g = [
            [int256(40), 1, 8, 120, 600, 85, 105, 0],
            [int256(8000), 0, 0, 8000, 60, 0, 4000, 1],
            [int256(300), 0, 1, 4000, 5, 10, 500, 0],
            [int256(60), 0, 0, 90, 1200, 70, 110, 0],
            [int256(500), 0, 0, 700, 1800, 40, 300, 1]
        ];
        uint8[5] memory expect = [0, 2, 2, 0, 1];
        for (uint i; i < 5; i++) {
            (uint8 d,) = GuardModelNftPurchase.decide(g[i]);
            require(d == expect[i], "nft_purchase mismatch");
        }
    }

    function test_defi_swap() public pure {
        int256[8][5] memory g = [
            [int256(20), 1, 15, 90, 600, 90, 30, 0],
            [int256(9000), 0, 0, 9000, 120, 0, 4500, 1],
            [int256(150), 0, 1, 4200, 8, 5, 600, 0],
            [int256(30), 0, 0, 60, 1200, 60, 80, 1],
            [int256(600), 0, 0, 900, 1800, 45, 600, 0]
        ];
        uint8[5] memory expect = [0, 2, 2, 0, 1];
        for (uint i; i < 5; i++) {
            (uint8 d,) = GuardModelDefiSwap.decide(g[i]);
            require(d == expect[i], "defi_swap mismatch");
        }
    }

    function test_subscription() public pure {
        int256[8][5] memory g = [
            [int256(10), 1, 20, 60, 2592, 90, 100, 0],
            [int256(5000), 1, 12, 5000, 300, 85, 3000, 0],
            [int256(120), 0, 0, 3500, 5, 10, 400, 1],
            [int256(15), 0, 0, 30, 1800, 65, 110, 1],
            [int256(300), 0, 0, 450, 900, 40, 250, 1]
        ];
        uint8[5] memory expect = [0, 2, 2, 1, 1];
        for (uint i; i < 5; i++) {
            (uint8 d,) = GuardModelSubscription.decide(g[i]);
            require(d == expect[i], "subscription mismatch");
        }
    }

    function test_treasury_dao() public pure {
        int256[8][5] memory g = [
            [int256(80), 1, 4, 200, 1800, 90, 100, 1],
            [int256(9000), 0, 0, 9000, 30, 5, 4500, 0],
            [int256(500), 0, 0, 5000, 10, 30, 600, 1],
            [int256(50), 0, 0, 90, 2400, 60, 110, 0],
            [int256(1000), 0, 0, 1400, 1200, 40, 350, 1]
        ];
        uint8[5] memory expect = [0, 2, 2, 0, 1];
        for (uint i; i < 5; i++) {
            (uint8 d,) = GuardModelTreasuryDao.decide(g[i]);
            require(d == expect[i], "treasury_dao mismatch");
        }
    }

    function test_social_tip() public pure {
        int256[8][5] memory g = [
            [int256(3), 1, 10, 15, 600, 85, 100, 0],
            [int256(7000), 0, 0, 7000, 60, 0, 4000, 0],
            [int256(20), 0, 0, 3000, 1, 5, 150, 0],
            [int256(5), 0, 0, 8, 900, 55, 110, 0],
            [int256(10), 0, 0, 15, 1200, 40, 120, 1]
        ];
        uint8[5] memory expect = [0, 2, 2, 0, 1];
        for (uint i; i < 5; i++) {
            (uint8 d,) = GuardModelSocialTip.decide(g[i]);
            require(d == expect[i], "social_tip mismatch");
        }
    }
}
