// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @title ColdChainTracker - Encrypted temperature monitoring with FHE
/// @notice Stores temperature logs with encrypted values using FHE for cold chain logistics
/// @dev Temperature values are stored as FHE euint64 (temperature * 10 to preserve decimals)
contract ColdChainTracker is SepoliaConfig {
    struct TemperatureLog {
        address recorder;
        string location;
        string cargo;
        euint64 encryptedTemperature; // FHE-encrypted temperature in Celsius * 10
        uint64 timestamp;
        bool isWarning; // true if temperature is out of safe range
    }

    TemperatureLog[] private _logs;
    mapping(address => uint256[]) private _logsOf;

    event TemperatureRecorded(
        uint256 indexed id,
        address indexed recorder,
        string location,
        string cargo,
        uint64 timestamp,
        bool isWarning
    );

    bytes32 private constant RECORD_TEMP_TYPEHASH =
        keccak256("ColdChainTracker.record(address recorder,string location,string cargo)");

    function _verifyRecordSignature(
        string calldata location,
        string calldata cargo,
        bytes calldata signature
    ) private view {
        bytes32 digest = keccak256(
            abi.encode(RECORD_TEMP_TYPEHASH, msg.sender, keccak256(bytes(location)), keccak256(bytes(cargo)))
        );
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(digest);
        address signer = ECDSA.recover(hash, signature);
        require(signer == msg.sender, "Invalid record signature");
    }

    /// @notice Record a new temperature reading
    /// @param location Location of the reading (e.g., "Shanghai Port")
    /// @param cargo Cargo description (e.g., "Frozen Seafood - 500kg")
    /// @param encTemp External encrypted uint64 temperature value (temp * 10)
    /// @param inputProof The Zama input proof for `encTemp`
    /// @param isWarning Whether this reading is a warning (out of safe range)
    /// @param signature ECDSA signature for authorization
    function recordTemperature(
        string calldata location,
        string calldata cargo,
        externalEuint64 encTemp,
        bytes calldata inputProof,
        bool isWarning,
        bytes calldata signature
    ) external {
        require(bytes(location).length > 0, "Location cannot be empty");
        require(bytes(cargo).length > 0, "Cargo description cannot be empty");
        
        _verifyRecordSignature(location, cargo, signature);
        euint64 encryptedTemperature = FHE.fromExternal(encTemp, inputProof);

        TemperatureLog memory log;
        log.recorder = msg.sender;
        log.location = location;
        log.cargo = cargo;
        log.encryptedTemperature = encryptedTemperature;
        log.timestamp = uint64(block.timestamp);
        log.isWarning = isWarning;

        // Persist and index
        _logs.push(log);
        uint256 id = _logs.length - 1;
        _logsOf[msg.sender].push(id);

        // ACL: allow contract and user to access the encrypted temperature for re-encryption
        FHE.allowThis(_logs[id].encryptedTemperature);
        FHE.allow(_logs[id].encryptedTemperature, msg.sender);

        emit TemperatureRecorded(id, msg.sender, location, cargo, log.timestamp, isWarning);
    }

    /// @notice Get log metadata (non-encrypted fields)
    /// @param id The log id
    /// @return recorder Address who recorded the temperature
    /// @return location Location string
    /// @return cargo Cargo description
    /// @return timestamp Unix timestamp
    /// @return isWarning Warning flag
    function getLogMeta(uint256 id)
        external
        view
        returns (address recorder, string memory location, string memory cargo, uint64 timestamp, bool isWarning)
    {
        require(id < _logs.length, "Log does not exist");
        TemperatureLog storage log = _logs[id];
        return (log.recorder, log.location, log.cargo, log.timestamp, log.isWarning);
    }

    /// @notice Get log count for a recorder
    /// @param recorder The address to query for
    /// @return count Number of logs
    function getLogCountByRecorder(address recorder) external view returns (uint256 count) {
        return _logsOf[recorder].length;
    }

    /// @notice Get log ids for a recorder
    /// @param recorder The address to query for
    /// @return ids Array of log ids
    function getLogIdsByRecorder(address recorder) external view returns (uint256[] memory ids) {
        return _logsOf[recorder];
    }

    /// @notice Get all log ids (for displaying all shipments)
    /// @return ids Array of all log ids
    function getAllLogIds() external view returns (uint256[] memory ids) {
        ids = new uint256[](_logs.length);
        for (uint256 i = 0; i < _logs.length; i++) {
            ids[i] = i;
        }
        return ids;
    }

    /// @notice Get the encrypted temperature for a log id
    /// @param id The log id
    /// @return encryptedTemperature The FHE-encrypted temperature value
    function getEncryptedTemperature(uint256 id) external view returns (euint64 encryptedTemperature) {
        require(id < _logs.length, "Log does not exist");
        return _logs[id].encryptedTemperature;
    }

    /// @notice Get total number of logs in the system
    /// @return Total number of temperature logs
    function getTotalLogCount() external view returns (uint256) {
        return _logs.length;
    }

    /// @notice Get statistics for dashboard
    /// @return totalLogs Total number of logs
    /// @return warningCount Number of warning logs
    function getStats() external view returns (uint256 totalLogs, uint256 warningCount) {
        totalLogs = _logs.length;
        warningCount = 0;
        for (uint256 i = 0; i < _logs.length; i++) {
            if (_logs[i].isWarning) {
                warningCount++;
            }
        }
        return (totalLogs, warningCount);
    }
}
