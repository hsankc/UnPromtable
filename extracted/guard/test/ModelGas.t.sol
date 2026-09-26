// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test, console} from "forge-std/Test.sol";
import {GuardModel} from "../src/GuardModel.sol";
contract H { function d(int256[8] memory x) external pure returns (uint8 r){ (r,) = GuardModel.decide(x);} }
contract ModelGasTest is Test {
    function test_model_only_gas_and_golden() public {
        H h = new H();
        int256[8][5] memory g = [
            [int256(15),1,20,120,600,85,100,1],      // normal_api -> 0
            [int256(9500),0,0,9500,900,0,5000,0],    // grok_drain -> 2
            [int256(120),0,0,4200,8,5,400,0],        // salami -> 2
            [int256(25),0,0,60,1200,70,120,1],       // new_vendor_small -> 0
            [int256(700),0,0,900,1800,40,900,0]];    // big_to_new -> 1
        uint8[5] memory expect = [0,2,2,0,1];
        for (uint i; i < 5; i++) {
            uint256 gs = gasleft(); uint8 r = h.d(g[i]); gs -= gasleft();
            console.log("case", i, "verdict", r); console.log("   model-only gas", gs);
            assertEq(r, expect[i]);
        }
    }
}
