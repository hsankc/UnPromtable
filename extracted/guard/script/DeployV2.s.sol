// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {UnpromptableRegistry} from "../src/UnpromptableRegistry.sol";
import {GuardLab} from "../src/GuardLab.sol";

/// Deploys the v2 registry (vault factory + fee collector) and GuardLab.
/// Every fee the registry takes goes straight to TREASURY_ADDRESS.
///   TREASURY_ADDRESS=0x... forge script script/DeployV2.s.sol --rpc-url $RPC \
///     --private-key $KEY --broadcast --legacy --disable-code-size-limit
contract DeployV2 is Script {
    function run() external {
        address treasury = vm.envAddress("TREASURY_ADDRESS");

        vm.startBroadcast();
        UnpromptableRegistry registry = new UnpromptableRegistry(treasury);
        GuardLab lab = new GuardLab();
        vm.stopBroadcast();

        console.log("UnpromptableRegistry:", address(registry));
        console.log("GuardLab:", address(lab));
        console.log("treasury:", treasury);
    }
}
