// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MultiGuardVault} from "../src/generated/MultiGuardVault.sol";
import {MockReputation} from "../src/MockReputation.sol";
import {CategoryRegistry} from "../src/CategoryRegistry.sol";

/// Deploys (or reuses) a CategoryRegistry, deploys a generated MultiGuardVault,
/// then registers it — paying the per-model platform fee in the same flow.
///   forge script script/DeployMulti.s.sol --rpc-url $RPC --private-key $KEY --broadcast
contract DeployMulti is Script {
    function run() external {
        address treasury = vm.envOr("TREASURY_ADDRESS", msg.sender);
        uint256 fundWei = vm.envOr("VAULT_FUND_WEI", uint256(1 ether));
        address registryAddr = vm.envOr("REGISTRY_ADDRESS", address(0));

        vm.startBroadcast();

        CategoryRegistry registry = registryAddr == address(0) ? new CategoryRegistry(treasury) : CategoryRegistry(registryAddr);

        MockReputation rep = new MockReputation();
        address demoProvider1 = vm.addr(1);
        address demoProvider2 = vm.addr(2);
        rep.set(demoProvider1, 90);
        rep.set(demoProvider2, 80);

        MultiGuardVault vault = new MultiGuardVault{value: fundWei}(rep, msg.sender);

        uint8 mask = vault.CATEGORY_MASK();
        uint256 fee = registry.FEE_PER_MODEL() * registry.popcount(mask);
        registry.registerVault{value: fee}(address(vault), msg.sender, mask);

        vm.stopBroadcast();

        console.log("CategoryRegistry:", address(registry));
        console.log("MultiGuardVault:", address(vault));
        console.log("category mask:", mask);
        console.log("fee paid (wei):", fee);
        console.log("demo provider 1 (rep 90):", demoProvider1);
        console.log("demo provider 2 (rep 80):", demoProvider2);
    }
}
