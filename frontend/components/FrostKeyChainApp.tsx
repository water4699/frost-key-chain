"use client";

import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { useFhevm } from "../fhevm/useFhevm";
import { useInMemoryStorage } from "../hooks/useInMemoryStorage";
import { useFrostKeyChain } from "@/hooks/useFrostKeyChain";
import { errorNotDeployed } from "./ErrorNotDeployed";

/*
 * Main FrostKeyChain React component
 * Allows users to store and decrypt encrypted keys using FHE
 */
export const FrostKeyChainApp = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();

  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");

  //////////////////////////////////////////////////////////////////////////////
  // FHEVM instance
  //////////////////////////////////////////////////////////////////////////////

  const {
    instance: fhevmInstance,
    status: fhevmStatus,
    error: fhevmError,
  } = useFhevm({
    provider: undefined,
    chainId,
    initialMockChains: { 31337: "http://127.0.0.1:8545" },
    enabled: isConnected,
  });

  //////////////////////////////////////////////////////////////////////////////
  // useFrostKeyChain is a custom hook containing all the FrostKeyChain logic
  //////////////////////////////////////////////////////////////////////////////

  const frostKeyChain = useFrostKeyChain({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
    chainId,
  });

  //////////////////////////////////////////////////////////////////////////////
  // UI Stuff - matching original frontend style exactly
  //////////////////////////////////////////////////////////////////////////////

  const buttonClass =
    "inline-flex items-center justify-center rounded-xl bg-black px-4 py-4 font-semibold text-white shadow-sm " +
    "transition-colors duration-200 hover:bg-blue-700 active:bg-blue-800 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 " +
    "disabled:opacity-50 disabled:pointer-events-none";

  const titleClass = "font-semibold text-black text-lg mt-4";

  if (!isConnected) {
    return (
      <div className="mx-auto">
        <button
          className={buttonClass}
          disabled={true}
        >
          <span className="text-4xl p-6">Please connect your wallet</span>
        </button>
      </div>
    );
  }

  if (frostKeyChain.isDeployed === false) {
    return errorNotDeployed(chainId);
  }

  const handleStoreKey = async () => {
    if (!newKeyName || !newKeyValue) return;
    if (newKeyName.length > 100) {
      alert("Key name must be 100 characters or less");
      return;
    }
    try {
      const value = BigInt(newKeyValue);
      await frostKeyChain.storeKey(newKeyName, value);
      setNewKeyName("");
      setNewKeyValue("");
    } catch (error) {
      console.error("Failed to store key:", error);
      alert("Failed to store key. Please check your input and try again.");
    }
  };

  return (
    <div className="grid w-full gap-4">
      <div className="col-span-full mx-20 bg-black text-white">
        <p className="font-semibold text-3xl m-5">
          FHEVM React Minimal Template -{" "}
          <span className="font-mono font-normal text-gray-400">
            FrostKeyChain.sol
          </span>
        </p>
      </div>
      <div className="col-span-full mx-20 mt-4 px-5 pb-4 rounded-lg bg-white border-2 border-black">
        <p className={titleClass}>Chain Infos</p>
        {printProperty("ChainId", chainId)}
        {printProperty("Wallet", address)}
        <p className={titleClass}>Contract</p>
        {printProperty("FrostKeyChain", frostKeyChain.contractAddress)}
        {printProperty("isDeployed", frostKeyChain.isDeployed)}
      </div>
      <div className="col-span-full mx-20">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg bg-white border-2 border-black pb-4 px-4">
            <p className={titleClass}>FHEVM instance</p>
            {printProperty(
              "Fhevm Instance",
              fhevmInstance ? "OK" : "undefined"
            )}
            {printProperty("Fhevm Status", fhevmStatus)}
            {printProperty("Fhevm Error", fhevmError ?? "No Error")}
          </div>
          <div className="rounded-lg bg-white border-2 border-black pb-4 px-4">
            <p className={titleClass}>Status</p>
            {printProperty("isLoading", frostKeyChain.isLoading)}
            {printProperty("isStoring", frostKeyChain.isStoring)}
            {printProperty("isDecrypting", frostKeyChain.isDecrypting)}
            {printProperty("canStore", frostKeyChain.canStore)}
            {printProperty("canDecrypt", frostKeyChain.canDecrypt)}
          </div>
        </div>
      </div>
      <div className="col-span-full mx-20 px-4 pb-4 rounded-lg bg-white border-2 border-black">
        <p className={titleClass}>Store New Key</p>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-black font-semibold">Key Name:</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="w-full mt-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black"
              placeholder="e.g., API Key, Password"
            />
          </div>
          <div>
            <label className="text-black font-semibold">Key Value (numeric):</label>
            <input
              type="number"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              className="w-full mt-1 px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-black"
              placeholder="e.g., 123456789"
            />
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 mx-20 gap-4">
        <button
          className={buttonClass}
          disabled={!frostKeyChain.canStore || !newKeyName || !newKeyValue}
          onClick={handleStoreKey}
        >
          {frostKeyChain.canStore && newKeyName && newKeyValue
            ? "Store Key"
            : frostKeyChain.isStoring
              ? "Storing..."
              : "Cannot store"}
        </button>
        <button
          className={buttonClass}
          disabled={!frostKeyChain.canStore}
          onClick={frostKeyChain.loadKeys}
        >
          {frostKeyChain.canStore
            ? "Refresh Keys"
            : "FrostKeyChain is not available"}
        </button>
      </div>
      <div className="col-span-full mx-20 px-4 pb-4 rounded-lg bg-white border-2 border-black">
        <p className={titleClass}>Your Keys</p>
        {frostKeyChain.keys.length === 0 ? (
          <p className="text-gray-500 mt-2">No keys stored yet</p>
        ) : (
          <div className="mt-4 space-y-3">
            {frostKeyChain.keys.map((key) => (
              <div key={key.id} className="border-2 border-gray-300 rounded-lg p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    {printProperty("Key Name", key.keyName)}
                    {printProperty("Key ID", key.id)}
                    {printProperty(
                      "Created",
                      new Date(key.createdAt * 1000).toLocaleString()
                    )}
                    {key.decryptedValue
                      ? printProperty(
                          "Decrypted Value",
                          key.decryptedValue.toString()
                        )
                      : printProperty("Value", "🔒 Encrypted (Click Decrypt to view)")}
                  </div>
                  <div className="flex items-center justify-end">
                    <button
                      className={buttonClass}
                      disabled={!frostKeyChain.canDecrypt || !!key.decryptedValue}
                      onClick={() => frostKeyChain.decryptKey(key.id)}
                    >
                      {key.decryptedValue
                        ? "Decrypted"
                        : frostKeyChain.isDecrypting
                          ? "Decrypting..."
                          : "Decrypt"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="col-span-full mx-20 p-4 rounded-lg bg-white border-2 border-black">
        {printProperty("Message", frostKeyChain.message)}
      </div>
    </div>
  );
};

function printProperty(name: string, value: unknown) {
  let displayValue: string;

  if (typeof value === "boolean") {
    return printBooleanProperty(name, value);
  } else if (typeof value === "string" || typeof value === "number") {
    displayValue = String(value);
  } else if (typeof value === "bigint") {
    displayValue = String(value);
  } else if (value === null) {
    displayValue = "null";
  } else if (value === undefined) {
    displayValue = "undefined";
  } else if (value instanceof Error) {
    displayValue = value.message;
  } else {
    displayValue = JSON.stringify(value);
  }

  return (
    <p className="text-black">
      {name}:{" "}
      <span className="font-mono font-semibold text-black">{displayValue}</span>
    </p>
  );
}

function printBooleanProperty(name: string, value: boolean) {
  if (value) {
    return (
      <p className="text-black">
        {name}:{" "}
        <span className="font-mono font-semibold text-green-500">true</span>
      </p>
    );
  }

  return (
    <p className="text-black">
      {name}:{" "}
      <span className="font-mono font-semibold text-red-500">false</span>
    </p>
  );
}
