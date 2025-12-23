"use client";

import { ethers } from "ethers";
import { useCallback, useState, useEffect, useMemo } from "react";
import type { FhevmInstance } from "@/fhevm/fhevmTypes";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { FrostKeyChainABI } from "@/abi/FrostKeyChainABI";
import { FrostKeyChainAddresses } from "@/abi/FrostKeyChainAddresses";
import { useMetaMaskEthersSigner } from "./metamask/useMetaMaskEthersSigner";

export interface KeyEntry {
  id: number;
  keyName: string;
  owner: string;
  createdAt: number;
  updatedAt: number;
  decryptedValue?: bigint;
}

type FrostKeyChainAddressBook = Record<
  string,
  {
    address: `0x${string}`;
    chainId: number;
    chainName: string;
  }
>;

interface UseFrostKeyChainParams {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  chainId: number | undefined;
}

export function useFrostKeyChain({
  instance,
  fhevmDecryptionSignatureStorage,
  chainId,
}: UseFrostKeyChainParams) {
  const { ethersSigner, ethersReadonlyProvider } = useMetaMaskEthersSigner();

  const [keys, setKeys] = useState<KeyEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStoring, setIsStoring] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [message, setMessage] = useState("Ready");
  const [contractAddress, setContractAddress] = useState<`0x${string}` | undefined>(
    undefined,
  );

  const isDeployed = useMemo(() => {
    if (!chainId) return undefined;
    const addressBook = FrostKeyChainAddresses as unknown as FrostKeyChainAddressBook;
    const entry = addressBook[chainId.toString()];
    if (!entry || !entry.address || entry.address === ethers.ZeroAddress) {
      return false;
    }
    if (contractAddress !== entry.address) {
      setContractAddress(entry.address as `0x${string}`);
    }
    return true;
  }, [chainId, contractAddress]);

  const loadKeys = async () => {
    if (!ethersReadonlyProvider || !contractAddress) {
      return;
    }
    setIsLoading(true);
    try {
      const contract = new ethers.Contract(
        contractAddress,
        FrostKeyChainABI.abi,
        ethersReadonlyProvider,
      );
      const owner: string | undefined = ethersSigner?.address;
      if (!owner) return;
      const ids: bigint[] = await contract.getKeyIdsByOwner(owner);
      const loaded: KeyEntry[] = [];
      for (const id of ids) {
        const meta = await contract.getKeyMeta(id);
        loaded.push({
          id: Number(id),
          owner: meta[0],
          keyName: meta[1],
          createdAt: Number(meta[2]),
          updatedAt: Number(meta[3]),
        });
      }
      setKeys(loaded);
      setMessage("Keys loaded");
    } catch (e) {
      setMessage(`Load keys failed: ${String(e)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const storeKey = async (keyName: string, value: bigint) => {
    if (!instance || !ethersSigner || !contractAddress) return;
    setIsStoring(true);
    setMessage(`Encrypting and storing key: ${keyName}`);

    try {
      const input = instance.createEncryptedInput(contractAddress, ethersSigner.address);
      input.add64(value);
      const enc = await input.encrypt();

      // Match contract's STORE_KEY_TYPEHASH encoding
      const STORE_KEY_TYPEHASH = ethers.id("FrostKeyChain.store(address owner,string keyName)");
      const digest = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ["bytes32", "address", "bytes32"],
          [STORE_KEY_TYPEHASH, ethersSigner.address, ethers.id(keyName)]
        )
      );
      const signature = await ethersSigner.signMessage(ethers.getBytes(digest));

      const contract = new ethers.Contract(
        contractAddress,
        FrostKeyChainABI.abi,
        ethersSigner,
      );

      const tx: ethers.TransactionResponse = await contract.storeKey(
        keyName,
        enc.handles[0],
        enc.inputProof,
        signature,
      );
      setMessage(`Waiting tx ${tx.hash}`);
      await tx.wait();
      setMessage("Key stored on-chain");
      await loadKeys();
    } catch (e) {
      setMessage(`Store key failed: ${String(e)}`);
    } finally {
      setIsStoring(false);
    }
  };

  const decryptKey = async (keyId: number) => {
    if (!instance || !ethersSigner || !contractAddress) return;
    setIsDecrypting(true);
    setMessage(`Decrypting key ${keyId}...`);

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
        FrostKeyChainABI.abi,
        ethersSigner,
      );
      const encValue = await contract.getEncryptedValue(keyId);

      const res = await instance.userDecrypt(
        [{ handle: encValue, contractAddress }],
        sig.privateKey,
        sig.publicKey,
        sig.signature,
        sig.contractAddresses,
        sig.userAddress,
        sig.startTimestamp,
        sig.durationDays,
      );

      const clear = res[encValue as string];
      setKeys((prev) =>
        prev.map((k) => (k.id === keyId ? { ...k, decryptedValue: BigInt(clear) } : k)),
      );
      setMessage("Key decrypted successfully");
    } catch (e) {
      setMessage(`Decrypt failed: ${String(e)}`);
    } finally {
      setIsDecrypting(false);
    }
  };

  return {
    keys,
    isLoading,
    isStoring,
    isDecrypting,
    message,
    contractAddress,
    isDeployed,
    storeKey,
    decryptKey,
    loadKeys,
    canStore:
      !isStoring &&
      !isLoading &&
      isDeployed === true &&
      !!instance &&
      !!ethersSigner &&
      !!contractAddress,
    canDecrypt:
      !isDecrypting &&
      !isLoading &&
      isDeployed === true &&
      !!instance &&
      !!ethersSigner &&
      !!contractAddress,
  };
}
