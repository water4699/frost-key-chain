// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title FrostKeyChain - Encrypted key storage with FHE
/// @notice Stores user keys with encrypted values using FHE
/// @dev Key values are stored as FHE euint64. Key names are plaintext for listing purposes.
contract FrostKeyChain is SepoliaConfig {
    struct KeyEntry {
        address owner;
        string keyName;
        euint64 encryptedValue; // FHE-encrypted key value
        uint64 createdAt; // unix seconds
        uint64 updatedAt; // unix seconds
    }

    KeyEntry[] private _keys;
    mapping(address => uint256[]) private _keysOf;

    event KeyStored(uint256 indexed id, address indexed owner, string keyName, uint64 createdAt);
    event KeyUpdated(uint256 indexed id, address indexed owner, string keyName, uint64 updatedAt);

    bytes32 private constant STORE_KEY_TYPEHASH =
        keccak256("FrostKeyChain.store(address owner,string keyName)");
    bytes32 private constant UPDATE_KEY_TYPEHASH =
        keccak256("FrostKeyChain.update(address owner,uint256 id)");

    function _verifyStoreSignature(string calldata keyName, bytes calldata signature) private view {
        bytes32 digest =
            keccak256(abi.encode(STORE_KEY_TYPEHASH, msg.sender, keccak256(bytes(keyName))));
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(digest);
        address signer = ECDSA.recover(hash, signature);
        require(signer == msg.sender, "Invalid store signature");
    }

    function _verifyUpdateSignature(uint256 id, bytes calldata signature) private view {
        bytes32 digest = keccak256(abi.encode(UPDATE_KEY_TYPEHASH, msg.sender, id));
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(digest);
        address signer = ECDSA.recover(hash, signature);
        require(signer == msg.sender, "Invalid update signature");
    }

    /// @notice Store a new encrypted key
    /// @param keyName A short plaintext name for the key
    /// @param encValue External encrypted uint64 input handle
    /// @param inputProof The Zama input proof for `encValue`
    function storeKey(
        string calldata keyName,
        externalEuint64 encValue,
        bytes calldata inputProof,
        bytes calldata signature
    ) external {
        require(bytes(keyName).length > 0, "Key name cannot be empty");
        require(bytes(keyName).length <= 100, "Key name too long");
        
        _verifyStoreSignature(keyName, signature);
        euint64 encryptedValue = FHE.fromExternal(encValue, inputProof);

        KeyEntry memory entry;
        entry.owner = msg.sender;
        entry.keyName = keyName;
        entry.encryptedValue = encryptedValue;
        entry.createdAt = uint64(block.timestamp);
        entry.updatedAt = uint64(block.timestamp);

        // Persist and index
        _keys.push(entry);
        uint256 id = _keys.length - 1;
        _keysOf[msg.sender].push(id);

        // ACL: allow contract and user to access the encrypted value for re-encryption
        FHE.allowThis(_keys[id].encryptedValue);
        FHE.allow(_keys[id].encryptedValue, msg.sender);

        emit KeyStored(id, msg.sender, keyName, entry.createdAt);
    }

    /// @notice Update an existing key's encrypted value
    /// @param id The key id to update
    /// @param encValue External encrypted uint64 input handle
    /// @param inputProof The Zama input proof for `encValue`
    function updateKey(
        uint256 id,
        externalEuint64 encValue,
        bytes calldata inputProof,
        bytes calldata signature
    ) external {
        require(id < _keys.length, "Key does not exist");
        require(_keys[id].owner == msg.sender, "Not the owner");
        require(_keys[id].updatedAt < uint64(block.timestamp), "Cannot update same timestamp");

        _verifyUpdateSignature(id, signature);

        euint64 encryptedValue = FHE.fromExternal(encValue, inputProof);
        _keys[id].encryptedValue = encryptedValue;
        _keys[id].updatedAt = uint64(block.timestamp);

        // ACL: allow contract and user to access the encrypted value
        FHE.allowThis(_keys[id].encryptedValue);
        FHE.allow(_keys[id].encryptedValue, msg.sender);

        emit KeyUpdated(id, msg.sender, _keys[id].keyName, _keys[id].updatedAt);
    }

    /// @notice Get key count for an owner
    /// @param owner The address to query for
    /// @return count Number of keys
    function getKeyCountByOwner(address owner) external view returns (uint256 count) {
        return _keysOf[owner].length;
    }

    /// @notice Get key ids for an owner
    /// @param owner The address to query for
    /// @return ids Array of key ids
    function getKeyIdsByOwner(address owner) external view returns (uint256[] memory ids) {
        return _keysOf[owner];
    }

    /// @notice Get metadata for a key id
    /// @param id The key id
    /// @return owner Owner address
    /// @return keyName Key name string
    /// @return createdAt Timestamp (seconds)
    /// @return updatedAt Timestamp (seconds)
    function getKeyMeta(uint256 id)
        external
        view
        returns (address owner, string memory keyName, uint64 createdAt, uint64 updatedAt)
    {
        require(id < _keys.length, "Key does not exist");
        KeyEntry storage entry = _keys[id];
        return (entry.owner, entry.keyName, entry.createdAt, entry.updatedAt);
    }

    /// @notice Get the encrypted value for a key id
    /// @param id The key id
    /// @return encryptedValue The FHE-encrypted key value
    function getEncryptedValue(uint256 id) external view returns (euint64 encryptedValue) {
        require(id < _keys.length, "Key does not exist");
        return _keys[id].encryptedValue;
    }

    /// @notice Get total number of keys in the system
    /// @return Total number of keys
    function getTotalKeyCount() external view returns (uint256) {
        return _keys.length;
    }
}
