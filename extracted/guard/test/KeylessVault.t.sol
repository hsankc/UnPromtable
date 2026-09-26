// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test, console} from "forge-std/Test.sol";
import {KeylessVault, IReputation} from "../src/KeylessVault.sol";

contract MockRep is IReputation {
    mapping(address => uint8) public s;
    function set(address a, uint8 v) external { s[a] = v; }
    function score(address a) external view returns (uint8) { return s[a]; }
}
contract ApiProvider { receive() external payable {} }

contract KeylessVaultTest is Test {
    KeylessVault v; MockRep rep; ApiProvider api1; ApiProvider api2; address attacker = address(0xBAD);

    function setUp() public {
        vm.warp(1_800_000_000);
        rep = new MockRep(); api1 = new ApiProvider(); api2 = new ApiProvider();
        rep.set(address(api1), 90); rep.set(address(api2), 80);
        v = new KeylessVault{value: 100 ether}(rep);
        // build a normal history: 20 small x402-style API payments
        for (uint i; i < 20; i++) { vm.warp(block.timestamp + 300); v.propose(payable(address(i % 2 == 0 ? api1 : api2)), 0.1 ether); }
    }

    function test_normal_payment_passes() public {
        vm.warp(block.timestamp + 300);
        uint256 g = gasleft(); uint8 d = v.propose(payable(address(api1)), 0.12 ether); g -= gasleft();
        console.log("normal payment verdict", d, "gas", g);
        assertEq(d, 0);
    }
    function test_grok_style_drain_rejected() public {
        vm.warp(block.timestamp + 300);
        uint256 g = gasleft(); uint8 d = v.propose(payable(attacker), 95 ether); g -= gasleft();
        console.log("drain verdict", d, "gas", g);
        assertEq(d, 2); assertEq(attacker.balance, 0);
    }
    function test_under_hard_cap_drain_still_rejected() public {
        vm.warp(block.timestamp + 300);
        uint8 d = v.propose(payable(attacker), 15 ether); // 15%: passes the 20% hard cap, model must catch it
        console.log("15% to fresh address verdict", d);
        assertTrue(d != 0); assertEq(attacker.balance, 0);
    }
    function test_salami_attack() public {
        uint8 d; uint i;
        for (i = 0; i < 40; i++) { vm.warp(block.timestamp + 5); d = v.propose(payable(attacker), 1.2 ether); if (d != 0) break; }
        console.log("salami: slices that got through", i, "then verdict", d);
        console.log("attacker got (milli-MON)", attacker.balance / 1e15);
    }
}
