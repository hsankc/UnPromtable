// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IReputation} from "./KeylessVault.sol";

/// Standalone ERC-8004-style reputation source for demo deployment.
/// Owner curates scores; production would source this from a real registry.
contract MockReputation is IReputation {
    address public immutable owner;
    mapping(address => uint8) public s;

    constructor() {
        owner = msg.sender;
    }

    function set(address who, uint8 v) external {
        require(msg.sender == owner);
        s[who] = v;
    }

    function score(address who) external view returns (uint8) {
        return s[who];
    }
}
