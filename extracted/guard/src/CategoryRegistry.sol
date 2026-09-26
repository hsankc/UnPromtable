// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// Public, on-chain record of every custom guard vault deployed through the
/// platform, and the fee-collection point for doing so. Anyone can read
/// `vaults`/`vaultsOf` to see what's been deployed and with which category
/// models — this is the "everyone can see what it is" ledger. The deploy
/// script pays FEE_PER_MODEL * (number of categories selected) here, in the
/// same flow as deployment, and it's forwarded to `treasury` immediately —
/// no manual withdrawal step, no accumulation risk.
contract CategoryRegistry {
    address public immutable treasury;
    uint256 public constant FEE_PER_MODEL = 0.001 ether; // MON on Monad

    // bit i set => category i included. See categories.json for the
    // canonical id->name mapping (0 api_payment, 1 nft_purchase,
    // 2 defi_swap, 3 subscription, 4 treasury_dao, 5 social_tip).
    struct Entry {
        address vault;
        address owner;
        uint8 categoryBitmask;
        uint256 feePaid;
        uint64 deployedAt;
    }

    Entry[] public vaults;
    mapping(address => uint256[]) public vaultsOf; // owner => indices into `vaults`

    event VaultRegistered(address indexed vault, address indexed owner, uint8 categoryBitmask, uint256 feePaid);

    constructor(address _treasury) {
        treasury = _treasury;
    }

    function popcount(uint8 x) public pure returns (uint8 n) {
        while (x != 0) {
            n += x & 1;
            x >>= 1;
        }
    }

    /// Called once, right after a generated vault is deployed. Pays the
    /// platform fee (proportional to how many category models the vault
    /// includes) and records the vault publicly.
    function registerVault(address vault, address owner_, uint8 categoryBitmask) external payable {
        uint256 fee = FEE_PER_MODEL * popcount(categoryBitmask);
        require(msg.value >= fee, "underpaid");
        (bool ok,) = treasury.call{value: msg.value}("");
        require(ok);

        vaultsOf[owner_].push(vaults.length);
        vaults.push(Entry(vault, owner_, categoryBitmask, msg.value, uint64(block.timestamp)));
        emit VaultRegistered(vault, owner_, categoryBitmask, msg.value);
    }

    function count() external view returns (uint256) {
        return vaults.length;
    }

    function allVaults() external view returns (Entry[] memory) {
        return vaults;
    }
}
