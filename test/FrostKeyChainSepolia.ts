import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { FrostKeyChain } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";
 
const STORE_KEY_TYPEHASH = ethers.id("FrostKeyChain.store(address owner,string keyName)");

async function signStoreKey(signer: HardhatEthersSigner, keyName: string): Promise<string> {
  const digest = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "bytes32"],
      [STORE_KEY_TYPEHASH, signer.address, ethers.id(keyName)],
    ),
  );
  return signer.signMessage(ethers.getBytes(digest));
}

describe("FrostKeyChain on Sepolia", function () {
  let deployer: HardhatEthersSigner;
  let frostKeyChainContract: FrostKeyChain;
  let frostKeyChainContractAddress: string;

  before(async function () {
    // Skip if running on mock environment
    if (fhevm.isMock) {
      console.warn(`This test suite is for Sepolia Testnet only`);
      this.skip();
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    deployer = ethSigners[0];

    // Get deployed contract
    await deployments.fixture(["FHECounter"]);
    const frostKeyChainDeployment = await deployments.get("FrostKeyChain");
    frostKeyChainContractAddress = frostKeyChainDeployment.address;
    frostKeyChainContract = await ethers.getContractAt(
      "FrostKeyChain",
      frostKeyChainContractAddress
    ) as FrostKeyChain;

    console.log("FrostKeyChain contract address:", frostKeyChainContractAddress);
    console.log("Deployer address:", deployer.address);
  });

  it("should store and decrypt a key on Sepolia", async function () {
    this.timeout(120000); // 2 minutes timeout for Sepolia

    const keyName = "Test API Key";
    const clearValue = 987654321n;

    console.log("Creating encrypted input...");
    const encryptedInput = await fhevm
      .createEncryptedInput(frostKeyChainContractAddress, deployer.address)
      .add64(clearValue)
      .encrypt();

    console.log("Storing key...");
    const signature = await signStoreKey(deployer, keyName);
    const tx = await frostKeyChainContract
      .connect(deployer)
      .storeKey(keyName, encryptedInput.handles[0], encryptedInput.inputProof, signature);
    
    console.log("Waiting for transaction confirmation...");
    const receipt = await tx.wait();
    console.log("Transaction confirmed:", receipt?.hash);

    // Get the key ID (should be the last one)
    const keyIds = await frostKeyChainContract.getKeyIdsByOwner(deployer.address);
    const keyId = keyIds[keyIds.length - 1];
    console.log("Key ID:", keyId);

    // Check metadata
    const [owner, name, createdAt, updatedAt] = await frostKeyChainContract.getKeyMeta(keyId);
    expect(owner).to.eq(deployer.address);
    expect(name).to.eq(keyName);
    expect(createdAt).to.be.gt(0);
    expect(updatedAt).to.eq(createdAt);

    console.log("Key metadata:", { owner, name, createdAt, updatedAt });

    // Get encrypted value
    const encryptedValue = await frostKeyChainContract.getEncryptedValue(keyId);
    console.log("Encrypted value handle:", encryptedValue);

    // Decrypt the value
    console.log("Decrypting value...");
    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedValue,
      frostKeyChainContractAddress,
      deployer,
    );

    console.log("Decrypted value:", decryptedValue);
    expect(decryptedValue).to.eq(clearValue);
  });

  it("should list all keys for the deployer", async function () {
    this.timeout(60000);

    const keyCount = await frostKeyChainContract.getKeyCountByOwner(deployer.address);
    console.log("Total keys for deployer:", keyCount);

    const keyIds = await frostKeyChainContract.getKeyIdsByOwner(deployer.address);
    console.log("Key IDs:", keyIds);

    for (const keyId of keyIds) {
      const [owner, name, createdAt] = await frostKeyChainContract.getKeyMeta(keyId);
      console.log(`Key ${keyId}:`, { owner, name, createdAt });
    }

    expect(keyCount).to.be.gt(0);
  });
});
