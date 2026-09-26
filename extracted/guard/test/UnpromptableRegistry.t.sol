// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {UnpromptableRegistry} from "../src/UnpromptableRegistry.sol";
import {GuardLab} from "../src/GuardLab.sol";
import {MockReputation} from "../src/MockReputation.sol";
import {IReputation} from "../src/KeylessVault.sol";
import {FixtureVault} from "../src/generated/FixtureVault.sol";
import {GuardModelNftPurchase} from "../src/categories/GuardModelNftPurchase.sol";

// Run with: forge test --code-size-limit 131072
// (the 3-model fixture vault is bigger than Ethereum's 24 KB limit, which is
// the point of deploying on Monad.)
contract UnpromptableRegistryTest is Test {
    address constant TREASURY = 0x3D254CE41d2462A1292aAD726A39E6845fcDe452;
    uint8 constant MASK = 7; // api_payment | nft_purchase | defi_swap

    UnpromptableRegistry registry;
    MockReputation rep;
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address provider = makeAddr("provider");

    function setUp() public {
        registry = new UnpromptableRegistry(TREASURY);
        rep = new MockReputation();
        rep.set(provider, 90);
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    function _initCode(address owner_) internal view returns (bytes memory) {
        return abi.encodePacked(type(FixtureVault).creationCode, abi.encode(IReputation(address(rep)), owner_));
    }

    function _create(uint256 fund) internal returns (FixtureVault v) {
        uint256 fee = registry.creationFee(MASK);
        vm.prank(alice);
        v = FixtureVault(payable(registry.createVault{value: fee + fund}(_initCode(alice), MASK)));
    }

    function test_createVault_paysTreasury_andRecordsOwner() public {
        uint256 before = TREASURY.balance;
        FixtureVault v = _create(10 ether);

        assertEq(TREASURY.balance - before, 0.003 ether, "fee to treasury");
        assertEq(address(v).balance, 10 ether, "remaining value funds the vault");
        assertEq(v.owner(), alice);
        assertEq(address(registry).balance, 0, "registry keeps nothing");
        assertEq(registry.count(), 1);
        assertTrue(registry.isVault(address(v)));
        (address vault, address owner_, uint8 mask, uint256 feePaid,) = registry.vaults(0);
        assertEq(vault, address(v));
        assertEq(owner_, alice);
        assertEq(mask, MASK);
        assertEq(feePaid, 0.003 ether);
        assertEq(registry.vaultIdsOf(alice).length, 1);
        assertEq(registry.totalCreationFees(), 0.003 ether);
    }

    function test_createVault_underpaid_reverts() public {
        bytes memory code = _initCode(alice);
        vm.prank(alice);
        vm.expectRevert(bytes("underpaid"));
        registry.createVault{value: 0.002 ether}(code, MASK);
    }

    function test_createVault_ownerMustBeCaller() public {
        bytes memory code = _initCode(bob);
        vm.prank(alice);
        vm.expectRevert(bytes("owner must be caller"));
        registry.createVault{value: 1 ether}(code, MASK);
    }

    function test_createVault_cannotUnderstateModels() public {
        // Claiming a 1-model mask for a 3-model vault would pay a third of the fee.
        bytes memory code = _initCode(alice);
        vm.prank(alice);
        vm.expectRevert(bytes("mask mismatch"));
        registry.createVault{value: 1 ether}(code, 1);
    }

    function test_protocolFee_onEveryPayment() public {
        FixtureVault v = _create(10 ether);
        uint256 amount = 0.01 ether;
        uint256 before = TREASURY.balance;

        uint8 d = v.proposePayment(payable(provider), amount);
        require(d != 2, "trusted small payment should not be rejected");
        if (d == 1) {
            vm.warp(block.timestamp + v.DELAY());
            v.release(0);
        }

        assertEq(provider.balance, amount, "recipient gets the full amount");
        assertEq(TREASURY.balance - before, amount * 10 / 10000, "0.1% protocol fee");
    }

    function test_rejectedPayment_paysNoFee() public {
        FixtureVault v = _create(10 ether);
        uint256 before = TREASURY.balance;
        // 50% of the treasury to an unknown address: over the 20% hard cap.
        uint8 d = v.proposePayment(payable(makeAddr("attacker")), 5 ether);
        assertEq(d, 2);
        assertEq(TREASURY.balance, before);
    }

    function test_payConversion() public {
        bytes32 h = keccak256("contract Agent {}");
        uint256 before = TREASURY.balance;
        vm.prank(alice);
        registry.payConversion{value: 0.01 ether}(h);

        assertTrue(registry.paidConversion(alice, h));
        assertFalse(registry.paidConversion(bob, h));
        assertEq(TREASURY.balance - before, 0.01 ether);
        assertEq(registry.conversions(), 1);

        vm.prank(alice);
        vm.expectRevert(bytes("already paid"));
        registry.payConversion{value: 0.01 ether}(h);

        vm.prank(bob);
        vm.expectRevert(bytes("underpaid"));
        registry.payConversion{value: 0.005 ether}(h);
    }

    function test_guardLab_matchesLibraries() public {
        GuardLab lab = new GuardLab();
        int256[8] memory drain = [int256(8000), 0, 0, 8000, 60, 0, 4000, 1];
        (uint8 dLab, int256[3] memory oLab) = lab.decide(1, drain);
        (uint8 dLib, int256[3] memory oLib) = GuardModelNftPurchase.decide(drain);
        assertEq(dLab, dLib);
        assertEq(dLab, 2);
        assertEq(oLab[0], oLib[0]);
        assertEq(oLab[2], oLib[2]);

        vm.expectRevert(bytes("unknown category"));
        lab.decide(6, drain);
    }
}
