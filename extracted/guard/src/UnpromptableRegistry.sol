// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IGuardVault {
    function owner() external view returns (address);
    function CATEGORY_MASK() external view returns (uint8);
}

/// v2 of the platform registry. Unlike CategoryRegistry (v1), it deploys the
/// vault itself, so a vault only exists here if its creation fee was paid in
/// the same transaction. It also sells ContractX conversions. Every fee is
/// forwarded to `treasury` immediately; nothing accumulates in this contract.
contract UnpromptableRegistry {
    address public immutable treasury;
    uint256 public constant FEE_PER_MODEL = 0.001 ether; // MON on Monad
    uint256 public constant CONVERSION_FEE = 0.01 ether;

    // bit i set => category i included (0 api_payment, 1 nft_purchase,
    // 2 defi_swap, 3 subscription, 4 treasury_dao, 5 social_tip).
    struct Entry {
        address vault;
        address owner;
        uint8 categoryBitmask;
        uint256 feePaid;
        uint64 deployedAt;
    }

    Entry[] public vaults;
    mapping(address => uint256[]) internal _vaultsOf; // owner => indices into `vaults`
    mapping(address => bool) public isVault;
    mapping(address => mapping(bytes32 => bool)) public paidConversion; // payer => source hash => paid

    uint256 public totalCreationFees;
    uint256 public totalConversionFees;
    uint256 public conversions;

    event VaultCreated(address indexed vault, address indexed owner, uint8 categoryBitmask, uint256 feePaid, uint256 funded);
    event ConversionPaid(address indexed payer, bytes32 indexed sourceHash, uint256 feePaid);

    constructor(address _treasury) {
        require(_treasury != address(0), "treasury");
        treasury = _treasury;
    }

    function popcount(uint8 x) public pure returns (uint8 n) {
        while (x != 0) {
            n += x & 1;
            x >>= 1;
        }
    }

    function creationFee(uint8 mask) public pure returns (uint256) {
        return FEE_PER_MODEL * popcount(mask);
    }

    /// Deploys a generated guard vault from `initCode` (creation code plus
    /// abi-encoded constructor args). msg.value = creation fee + starting
    /// balance. The vault must name the caller as owner and declare `mask`,
    /// so the fee always matches the models actually inside it.
    function createVault(bytes memory initCode, uint8 mask) external payable returns (address vault) {
        require(mask != 0 && mask < 64, "bad mask");
        uint256 fee = creationFee(mask);
        require(msg.value >= fee, "underpaid");
        uint256 fund = msg.value - fee;

        assembly {
            vault := create(fund, add(initCode, 0x20), mload(initCode))
        }
        require(vault != address(0), "deploy failed");
        require(IGuardVault(vault).owner() == msg.sender, "owner must be caller");
        require(IGuardVault(vault).CATEGORY_MASK() == mask, "mask mismatch");

        isVault[vault] = true;
        totalCreationFees += fee;
        _vaultsOf[msg.sender].push(vaults.length);
        vaults.push(Entry(vault, msg.sender, mask, fee, uint64(block.timestamp)));
        _toTreasury(fee);
        emit VaultCreated(vault, msg.sender, mask, fee, fund);
    }

    /// Pays for one ContractX conversion of the source whose keccak256 is
    /// `sourceHash`. The conversion service checks `paidConversion` on-chain
    /// before it produces anything.
    function payConversion(bytes32 sourceHash) external payable {
        require(msg.value >= CONVERSION_FEE, "underpaid");
        require(!paidConversion[msg.sender][sourceHash], "already paid");
        paidConversion[msg.sender][sourceHash] = true;
        conversions += 1;
        totalConversionFees += msg.value;
        _toTreasury(msg.value);
        emit ConversionPaid(msg.sender, sourceHash, msg.value);
    }

    function count() external view returns (uint256) {
        return vaults.length;
    }

    function allVaults() external view returns (Entry[] memory) {
        return vaults;
    }

    function vaultIdsOf(address owner_) external view returns (uint256[] memory) {
        return _vaultsOf[owner_];
    }

    function _toTreasury(uint256 amount) internal {
        if (amount == 0) return;
        (bool ok,) = treasury.call{value: amount}("");
        require(ok, "treasury transfer failed");
    }
}
