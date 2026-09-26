// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {GuardModel} from "./GuardModel.sol";

interface IReputation { function score(address who) external view returns (uint8); }

/// Treasury of an AI agent. The LLM ("thinker") holds no key and can only propose.
/// The only exit for funds is propose(), gated by a neural net executed inside the tx.
contract KeylessVault {
    address public immutable owner;        // can veto delayed txs, cannot bypass the model
    IReputation public immutable rep;      // ERC-8004-style reputation source (mocked in tests)
    uint256 public constant DELAY = 600;   // seconds a "delay" verdict waits for veto
    uint256 public constant HARD_CAP_BPS = 2000; // backstop: never >20% of treasury in one tx

    mapping(address => uint256) public paidCount;
    uint256 public totalPaid; uint256 public numPaid;
    uint256 public lastOut; uint256 public windowStart; uint256 public windowOut;

    // Fix found by red-teaming our own model: trust must come from OUTSIDE the vault.
    mapping(address => bool) public allow;          // owner-curated
    uint256 public dayStart; uint256 public dayUnknownOut; uint256 public dayCap;
    uint256 public constant UNKNOWN_DAILY_BPS = 100; // unknown recipients: max 1%/day in total, whatever the model says
    function setAllow(address a, bool b) external { require(msg.sender == owner); allow[a] = b; }
    function trusted(address a) public view returns (bool) { return allow[a] || rep.score(a) >= 50; }

    struct Pending { address to; uint256 amount; uint64 releaseAt; bool vetoed; bool done; }
    Pending[] public pending;

    event Executed(address indexed to, uint256 amount, int256[3] logits);
    event Delayed(uint256 indexed id, address indexed to, uint256 amount, int256[3] logits);
    event Rejected(address indexed to, uint256 amount, int256[3] logits);

    constructor(IReputation _rep) payable { owner = msg.sender; rep = _rep; windowStart = block.timestamp; }
    receive() external payable {}

    function features(address to, uint256 amount) public view returns (int256[8] memory x) {
        uint256 t = address(this).balance;
        uint256 wOut = block.timestamp - windowStart > 3600 ? 0 : windowOut;
        uint256 since = lastOut == 0 ? 3600 : block.timestamp - lastOut;
        uint256 avg = numPaid == 0 ? 0 : totalPaid / numPaid;
        uint256 c = paidCount[to];
        x[0] = int256(amount * 10000 / t);
        x[1] = c > 0 ? int256(1) : int256(0);
        x[2] = int256(c > 50 ? 50 : c);
        x[3] = int256((wOut + amount) * 10000 / t);
        x[4] = int256(since > 3600 ? 3600 : since);
        x[5] = int256(uint256(rep.score(to)));
        uint256 ratio = avg == 0 ? 100 : amount * 100 / avg; // cold start: neutral
        x[6] = int256(ratio > 5000 ? 5000 : ratio);
        x[7] = to.code.length > 0 ? int256(1) : int256(0);
    }

    /// Anyone (the LLM's relayer) can call this. No signature from the agent is needed.
    function propose(address payable to, uint256 amount) external returns (uint8 d) {
        int256[3] memory o;
        (d, o) = GuardModel.decide(features(to, amount));
        if (amount * 10000 > address(this).balance * HARD_CAP_BPS) d = 2;
        if (block.timestamp - dayStart > 86400) { dayStart = block.timestamp; dayUnknownOut = 0; dayCap = address(this).balance * UNKNOWN_DAILY_BPS / 10000; }
        if (!trusted(to) && dayUnknownOut + amount > dayCap) d = 2;
        if (d == 0) { _pay(to, amount); emit Executed(to, amount, o); }
        else if (d == 1) { pending.push(Pending(to, amount, uint64(block.timestamp + DELAY), false, false)); emit Delayed(pending.length - 1, to, amount, o); }
        else emit Rejected(to, amount, o);
    }

    function veto(uint256 id) external { require(msg.sender == owner); pending[id].vetoed = true; }
    function release(uint256 id) external {
        Pending storage p = pending[id];
        require(!p.vetoed && !p.done && block.timestamp >= p.releaseAt);
        p.done = true; _pay(payable(p.to), p.amount);
    }

    function _pay(address payable to, uint256 amount) internal {
        if (block.timestamp - windowStart > 3600) { windowStart = block.timestamp; windowOut = 0; }
        windowOut += amount; lastOut = block.timestamp;
        if (trusted(to)) paidCount[to] += 1; else dayUnknownOut += amount; // no circular trust
        totalPaid += amount; numPaid += 1;
        (bool ok,) = to.call{value: amount}(""); require(ok);
    }
}
