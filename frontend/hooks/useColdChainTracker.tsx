"use client";

import { ethers } from "ethers";
import { useMemo, useState, useCallback } from "react";
import type { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { ColdChainTrackerABI } from "@/abi/ColdChainTrackerABI";
import { ColdChainTrackerAddresses } from "@/abi/ColdChainTrackerAddresses";
import { useMetaMaskEthersSigner } from "./metamask/useMetaMaskEthersSigner";

export interface TemperatureLog {
  id: number;
  recorder: string;
  location: string;
  cargo: string;
  timestamp: number;
  isWarning: boolean;
  decryptedTemperature?: number; // Temperature in Celsius (already divided by 10)
}

type ColdChainTrackerAddressBook = Record<
  string,
  {
    address: `0x${string}`;
    chainId: number;
    chainName: string;
  }
>;

interface UseColdChainTrackerParams {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  chainId: number | undefined;
}

export function useColdChainTracker({
  instance,
  fhevmDecryptionSignatureStorage,
  chainId,
}: UseColdChainTrackerParams) {
  const { ethersSigner, ethersReadonlyProvider } = useMetaMaskEthersSigner();

  const [logs, setLogs] = useState<TemperatureLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [contractAddress, setContractAddress] = useState<`0x${string}` | undefined>(
    undefined,
  );

  const isDeployed = useMemo(() => {
    if (!chainId) return undefined;
    const addressBook = ColdChainTrackerAddresses as unknown as ColdChainTrackerAddressBook;
    const entry = addressBook[chainId.toString()];
    if (!entry || !entry.address || entry.address === ethers.ZeroAddress) {
      return false;
    }
    if (contractAddress !== entry.address) {
      setContractAddress(entry.address as `0x${string}`);
    }
    return true;
  }, [chainId, contractAddress]);

  const loadLogs = async () => {
    if (!ethersReadonlyProvider || !contractAddress) {
      console.log("[useColdChainTracker] loadLogs skipped - missing provider or address");
      return;
    }
    setIsLoading(true);
    console.log("[useColdChainTracker] Loading logs from contract:", contractAddress);
    try {
      const contract = new ethers.Contract(
        contractAddress,
        ColdChainTrackerABI.abi,
        ethersReadonlyProvider,
      );
      
      // Get all log IDs
      const ids: bigint[] = await contract.getAllLogIds();
      console.log("[useColdChainTracker] Found log IDs:", ids.map(id => id.toString()));
      const loaded: TemperatureLog[] = [];
      
      for (const id of ids) {
        const meta = await contract.getLogMeta(id);
        loaded.push({
          id: Number(id),
          recorder: meta[0],
          location: meta[1],
          cargo: meta[2],
          timestamp: Number(meta[3]),
          isWarning: meta[4],
        });
      }
      
      console.log("[useColdChainTracker] Loaded logs:", loaded);
      setLogs(loaded);
      setMessage("Logs loaded");
    } catch (e) {
      console.error("[useColdChainTracker] Load logs failed:", e);
      setMessage(`Load logs failed: ${String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const recordTemperature = async (
    location: string,
    cargo: string,
    temperature: number, // Temperature in Celsius
    isWarning: boolean
  ) => {
    console.log("[useColdChainTracker] recordTemperature called:", { location, cargo, temperature, isWarning });
    if (!instance || !ethersSigner || !contractAddress) {
      console.error("[useColdChainTracker] Missing dependencies:", { 
        hasInstance: !!instance, 
        hasSigner: !!ethersSigner, 
        contractAddress 
      });
      return;
    }
    setIsRecording(true);
    setMessage(`Encrypting and recording temperature: ${temperature}°C`);

    try {
      // Convert temperature to unsigned integer
      // Add offset of 1000 to handle negative temperatures (-100°C to +100°C range)
      // Multiply by 10 to preserve one decimal place
      // Example: -10°C -> (-10 + 100) * 10 = 900
      const TEMP_OFFSET = 100; // Offset in Celsius
      const tempValue = BigInt(Math.round((temperature + TEMP_OFFSET) * 10));
      console.log("[useColdChainTracker] Temperature value (offset+x10):", tempValue.toString(), "from", temperature, "°C");
      
      const input = instance.createEncryptedInput(contractAddress, ethersSigner.address);
      input.add64(tempValue);
      console.log("[useColdChainTracker] Encrypting input...");
      const enc = await input.encrypt();
      console.log("[useColdChainTracker] Encryption complete");

      // Match contract's RECORD_TEMP_TYPEHASH encoding
      const RECORD_TEMP_TYPEHASH = ethers.id(
        "ColdChainTracker.record(address recorder,string location,string cargo)"
      );
      const digest = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "address", "bytes32", "bytes32"],
          [
            RECORD_TEMP_TYPEHASH,
            ethersSigner.address,
            ethers.id(location),
            ethers.id(cargo),
          ]
        )
      );
      const signature = await ethersSigner.signMessage(ethers.getBytes(digest));

      const contract = new ethers.Contract(
        contractAddress,
        ColdChainTrackerABI.abi,
        ethersSigner,
      );

      console.log("[useColdChainTracker] Calling recordTemperature with signature:", signature.slice(0, 20) + "...");
      const tx: ethers.TransactionResponse = await contract.recordTemperature(
        location,
        cargo,
        enc.handles[0],
        enc.inputProof,
        isWarning,
        signature,
      );
      setMessage(`Waiting tx ${tx.hash}`);
      console.log("[useColdChainTracker] Transaction sent:", tx.hash);
      await tx.wait();
      console.log("[useColdChainTracker] Transaction confirmed");
      setMessage("Temperature recorded on-chain");
      
      // Reload logs after successful recording
      await loadLogs();
    } catch (e) {
      setMessage(`Record temperature failed: ${String(e)}`);
      throw e;
    } finally {
      setIsRecording(false);
    }
  };

  const decryptTemperature = async (logId: number) => {
    if (!instance || !ethersSigner || !contractAddress) return;
    setIsDecrypting(true);
    setMessage(`Decrypting temperature for log ${logId}...`);

    try {
      // Generate new keypair and require fresh signature for each decryption
      const { publicKey, privateKey } = instance.generateKeypair();
      
      const sig = await FhevmDecryptionSignature.new(
        instance,
        [contractAddress],
        publicKey,
        privateKey,
        ethersSigner,
      );
      if (!sig) {
        setMessage("Unable to build FHEVM decryption signature");
        return;
      }

      const contract = new ethers.Contract(
        contractAddress,
        ColdChainTrackerABI.abi,
        ethersSigner,
      );
      const encTemp = await contract.getEncryptedTemperature(logId);

      const res = await instance.userDecrypt(
        [{ handle: encTemp, contractAddress }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays,
      );

      const clearValue = res[encTemp as string];
      // Convert back to Celsius: subtract offset and divide by 10
      // Example: 900 -> (900 / 10) - 100 = -10°C
      const TEMP_OFFSET = 100; // Must match the offset used in recordTemperature
      const tempCelsius = (Number(clearValue) / 10) - TEMP_OFFSET;
      
      setLogs((prev) =>
        prev.map((log) =>
          log.id === logId ? { ...log, decryptedTemperature: tempCelsius } : log
        )
      );
      setMessage("Temperature decrypted successfully");
    } catch (e) {
      setMessage(`Decrypt failed: ${String(e)}`);
      throw e;
    } finally {
      setIsDecrypting(false);
    }
  };

  // Memoize canRecord and canDecrypt to prevent unnecessary re-renders
  const canRecord = useMemo(
    () =>
      !isRecording &&
      !isLoading &&
      isDeployed === true &&
      !!instance &&
      !!ethersSigner &&
      !!contractAddress,
    [isRecording, isLoading, isDeployed, instance, ethersSigner, contractAddress]
  );

  const canDecrypt = useMemo(
    () =>
      !isDecrypting &&
      !isLoading &&
      isDeployed === true &&
      !!instance &&
      !!ethersSigner &&
      !!contractAddress,
    [isDecrypting, isLoading, isDeployed, instance, ethersSigner, contractAddress]
  );

  return {
    logs,
    isLoading,
    isRecording,
    isDecrypting,
    message,
    contractAddress,
    isDeployed,
    recordTemperature,
    decryptTemperature,
    loadLogs,
    canRecord,
    canDecrypt,
  };
}
