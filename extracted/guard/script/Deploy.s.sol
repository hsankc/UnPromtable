// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {KeylessVault} from "../src/KeylessVault.sol";
import {MockReputation} from "../src/MockReputation.sol";

/// Deploys MockReputation + KeylessVault, seeds two demo "known API provider"
/// addresses with reputation, and funds the vault. Run with:
///   forge script script/Deploy.s.sol --rpc-url $RPC_URL --private-key $OWNER_PRIVATE_KEY --broadcast
contract Deploy is Script {
    function run() external {
        address demoProvider1 = vm.addr(1);
        address demoProvider2 = vm.addr(2);
        uint256 fundWei = vm.envOr("VAULT_FUND_WEI", uint256(1 ether));

        vm.startBroadcast();

        MockReputation rep = new MockReputation();
        rep.set(demoProvider1, 90);
        rep.set(demoProvider2, 80);

        KeylessVault vault = new KeylessVault{value: fundWei}(rep);

        vm.stopBroadcast();

        console.log("MockReputation:", address(rep));
        console.log("KeylessVault:", address(vault));
        console.log("demo provider 1 (rep 90):", demoProvider1);
        console.log("demo provider 2 (rep 80):", demoProvider2);
        console.log("vault funded (wei):", fundWei);
    }
}
