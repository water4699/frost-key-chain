import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FrostKeyChain, FrostKeyChain__factory } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FrostKeyChain")) as FrostKeyChain__factory;
  const frostKeyChainContract = (await factory.deploy()) as FrostKeyChain;
  const frostKeyChainContractAddress = await frostKeyChainContract.getAddress();

  return { frostKeyChainContract, frostKeyChainContractAddress };
}

const STORE_KEY_TYPEHASH = ethers.id("FrostKeyChain.store(address owner,string keyName)");
const UPDATE_KEY_TYPEHASH = ethers.id("FrostKeyChain.update(address owner,uint256 id)");

async function signStoreKey(signer: HardhatEthersSigner, keyName: string): Promise<string> {
  const digest = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "bytes32"],
      [STORE_KEY_TYPEHASH, signer.address, ethers.id(keyName)],
    ),
  );
  return signer.signMessage(ethers.getBytes(digest));
}

async function signUpdateKey(
  signer: HardhatEthersSigner,
  id: bigint | number,
): Promise<string> {
  const digest = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256"],
      [UPDATE_KEY_TYPEHASH, signer.address, id],
    ),
  );
  return signer.signMessage(ethers.getBytes(digest));
}

describe("FrostKeyChain", function () {
  let signers: Signers;
  let frostKeyChainContract: FrostKeyChain;
  let frostKeyChainContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ frostKeyChainContract, frostKeyChainContractAddress } = await deployFixture());
  });

  it("should start with zero keys", async function () {
    const totalCount = await frostKeyChainContract.getTotalKeyCount();
    expect(totalCount).to.eq(0);

    const aliceCount = await frostKeyChainContract.getKeyCountByOwner(signers.alice.address);
    expect(aliceCount).to.eq(0);
  });

  it("should store a new encrypted key", async function () {
    const keyName = "My API Key";
    const clearValue = 123456789n;

    // Encrypt the value as euint64
    const encryptedInput = await fhevm
      .createEncryptedInput(frostKeyChainContractAddress, signers.alice.address)
      .add64(clearValue)
      .encrypt();

    const signature = await signStoreKey(signers.alice, keyName);
    const tx = await frostKeyChainContract
      .connect(signers.alice)
      .storeKey(keyName, encryptedInput.handles[0], encryptedInput.inputProof, signature);
    await tx.wait();

    // Check counts
    const totalCount = await frostKeyChainContract.getTotalKeyCount();
    expect(totalCount).to.eq(1);

    const aliceCount = await frostKeyChainContract.getKeyCountByOwner(signers.alice.address);
    expect(aliceCount).to.eq(1);

    // Check key IDs
    const aliceKeyIds = await frostKeyChainContract.getKeyIdsByOwner(signers.alice.address);
    expect(aliceKeyIds.length).to.eq(1);
    expect(aliceKeyIds[0]).to.eq(0);

    // Check metadata
    const [owner, name, createdAt, updatedAt] = await frostKeyChainContract.getKeyMeta(0);
    expect(owner).to.eq(signers.alice.address);
    expect(name).to.eq(keyName);
    expect(createdAt).to.be.gt(0);
    expect(updatedAt).to.eq(createdAt);

    // Decrypt and verify the value
    const encryptedValue = await frostKeyChainContract.getEncryptedValue(0);
    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedValue,
      frostKeyChainContractAddress,
      signers.alice,
    );

    expect(decryptedValue).to.eq(clearValue);
  });

  it("should store multiple keys for the same user", async function () {
    const keys = [
      { name: "API Key 1", value: 111n },
      { name: "API Key 2", value: 222n },
      { name: "Password", value: 333n },
    ];

    for (const key of keys) {
      const encryptedInput = await fhevm
        .createEncryptedInput(frostKeyChainContractAddress, signers.alice.address)
        .add64(key.value)
        .encrypt();

      const signature = await signStoreKey(signers.alice, key.name);
      const tx = await frostKeyChainContract
        .connect(signers.alice)
        .storeKey(key.name, encryptedInput.handles[0], encryptedInput.inputProof, signature);
      await tx.wait();
    }

    const aliceCount = await frostKeyChainContract.getKeyCountByOwner(signers.alice.address);
    expect(aliceCount).to.eq(3);

    const aliceKeyIds = await frostKeyChainContract.getKeyIdsByOwner(signers.alice.address);
    expect(aliceKeyIds.length).to.eq(3);

    // Verify each key
    for (let i = 0; i < keys.length; i++) {
      const [, name] = await frostKeyChainContract.getKeyMeta(i);
      expect(name).to.eq(keys[i].name);

      const encryptedValue = await frostKeyChainContract.getEncryptedValue(i);
      const decryptedValue = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedValue,
        frostKeyChainContractAddress,
        signers.alice,
      );
      expect(decryptedValue).to.eq(keys[i].value);
    }
  });

  it("should update an existing key", async function () {
    const keyName = "Updatable Key";
    const initialValue = 100n;
    const updatedValue = 200n;

    // Store initial key
    let encryptedInput = await fhevm
      .createEncryptedInput(frostKeyChainContractAddress, signers.alice.address)
      .add64(initialValue)
      .encrypt();

    const storeSignature = await signStoreKey(signers.alice, keyName);
    let tx = await frostKeyChainContract
      .connect(signers.alice)
      .storeKey(keyName, encryptedInput.handles[0], encryptedInput.inputProof, storeSignature);
    await tx.wait();

    // Update the key
    encryptedInput = await fhevm
      .createEncryptedInput(frostKeyChainContractAddress, signers.alice.address)
      .add64(updatedValue)
      .encrypt();

    const updateSignature = await signUpdateKey(signers.alice, 0);
    tx = await frostKeyChainContract
      .connect(signers.alice)
      .updateKey(0, encryptedInput.handles[0], encryptedInput.inputProof, updateSignature);
    await tx.wait();

    // Verify the updated value
    const encryptedValue = await frostKeyChainContract.getEncryptedValue(0);
    const decryptedValue = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedValue,
      frostKeyChainContractAddress,
      signers.alice,
    );

    expect(decryptedValue).to.eq(updatedValue);

    // Check that updatedAt changed
    const [, , createdAt, updatedAt] = await frostKeyChainContract.getKeyMeta(0);
    expect(updatedAt).to.be.gte(createdAt);
  });

  it("should prevent non-owner from updating a key", async function () {
    const keyName = "Alice's Key";
    const initialValue = 100n;

    // Alice stores a key
    const encryptedInput = await fhevm
      .createEncryptedInput(frostKeyChainContractAddress, signers.alice.address)
      .add64(initialValue)
      .encrypt();

    const storeSignature = await signStoreKey(signers.alice, keyName);
    const tx = await frostKeyChainContract
      .connect(signers.alice)
      .storeKey(keyName, encryptedInput.handles[0], encryptedInput.inputProof, storeSignature);
    await tx.wait();

    // Bob tries to update Alice's key
    const bobEncryptedInput = await fhevm
      .createEncryptedInput(frostKeyChainContractAddress, signers.bob.address)
      .add64(999n)
      .encrypt();

    const dummySignature = ethers.randomBytes(65);

    await expect(
      frostKeyChainContract
        .connect(signers.bob)
        .updateKey(0, bobEncryptedInput.handles[0], bobEncryptedInput.inputProof, dummySignature)
    ).to.be.revertedWith("Not the owner");
  });

  it("should isolate keys between different users", async function () {
    // Alice stores a key
    const aliceEncryptedInput = await fhevm
      .createEncryptedInput(frostKeyChainContractAddress, signers.alice.address)
      .add64(111n)
      .encrypt();

    const aliceSignature = await signStoreKey(signers.alice, "Alice Key");
    let tx = await frostKeyChainContract
      .connect(signers.alice)
      .storeKey("Alice Key", aliceEncryptedInput.handles[0], aliceEncryptedInput.inputProof, aliceSignature);
    await tx.wait();

    // Bob stores a key
    const bobEncryptedInput = await fhevm
      .createEncryptedInput(frostKeyChainContractAddress, signers.bob.address)
      .add64(222n)
      .encrypt();

    const bobSignature = await signStoreKey(signers.bob, "Bob Key");
    tx = await frostKeyChainContract
      .connect(signers.bob)
      .storeKey("Bob Key", bobEncryptedInput.handles[0], bobEncryptedInput.inputProof, bobSignature);
    await tx.wait();

    // Check counts
    const aliceCount = await frostKeyChainContract.getKeyCountByOwner(signers.alice.address);
    const bobCount = await frostKeyChainContract.getKeyCountByOwner(signers.bob.address);
    expect(aliceCount).to.eq(1);
    expect(bobCount).to.eq(1);

    // Check key IDs
    const aliceKeyIds = await frostKeyChainContract.getKeyIdsByOwner(signers.alice.address);
    const bobKeyIds = await frostKeyChainContract.getKeyIdsByOwner(signers.bob.address);
    expect(aliceKeyIds[0]).to.eq(0);
    expect(bobKeyIds[0]).to.eq(1);
  });
});
