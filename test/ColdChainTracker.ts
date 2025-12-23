import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { ColdChainTracker, ColdChainTracker__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("ColdChainTracker")) as ColdChainTracker__factory;
  const contract = (await factory.deploy()) as ColdChainTracker;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

const RECORD_TEMP_TYPEHASH = ethers.id(
  "ColdChainTracker.record(address recorder,string location,string cargo)"
);

async function signRecordTemperature(
  signer: HardhatEthersSigner,
  location: string,
  cargo: string
): Promise<string> {
  const digest = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "bytes32", "bytes32"],
      [RECORD_TEMP_TYPEHASH, signer.address, ethers.id(location), ethers.id(cargo)]
    )
  );
  return signer.signMessage(ethers.getBytes(digest));
}

describe("ColdChainTracker", function () {
  let signers: Signers;
  let contract: ColdChainTracker;
  let contractAddress: string;

  before(async function () {
    const [deployer, alice, bob] = await ethers.getSigners();
    signers = { deployer, alice, bob };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    const deployment = await deployFixture();
    contract = deployment.contract;
    contractAddress = deployment.contractAddress;
  });

  it("should start with zero logs", async function () {
    const totalLogs = await contract.getTotalLogCount();
    expect(totalLogs).to.equal(0);
  });

  it("should get all log IDs", async function () {
    const allLogs = await contract.getAllLogIds();
    expect(allLogs.length).to.equal(0);
  });

  it("should get log count by recorder", async function () {
    const count = await contract.getLogCountByRecorder(signers.alice.address);
    expect(count).to.equal(0);
  });

  it("should get statistics", async function () {
    const stats = await contract.getStats();
    expect(stats[0]).to.equal(0); // totalLogs
    expect(stats[1]).to.equal(0); // warningCount
  });

  it("should record a temperature with signature", async function () {
    const location = "Shanghai Port";
    const cargo = "Frozen Seafood - 500kg";
    const temperature = 180n; // 18.0°C * 10 (stored as unsigned, interpreted as needed)
    const isWarning = false;

    // Encrypt the temperature
    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(temperature)
      .encrypt();

    const signature = await signRecordTemperature(signers.alice, location, cargo);

    const tx = await contract
      .connect(signers.alice)
      .recordTemperature(
        location,
        cargo,
        encryptedInput.handles[0],
        encryptedInput.inputProof,
        isWarning,
        signature
      );
    await tx.wait();

    // Check counts
    const totalLogs = await contract.getTotalLogCount();
    expect(totalLogs).to.equal(1);

    const aliceCount = await contract.getLogCountByRecorder(signers.alice.address);
    expect(aliceCount).to.equal(1);

    // Check metadata
    const [recorder, loc, carg, timestamp, warning] = await contract.getLogMeta(0);
    expect(recorder).to.equal(signers.alice.address);
    expect(loc).to.equal(location);
    expect(carg).to.equal(cargo);
    expect(timestamp).to.be.gt(0);
    expect(warning).to.equal(isWarning);

    // Decrypt and verify the temperature
    const encryptedTemp = await contract.getEncryptedTemperature(0);
    const decryptedTemp = await fhevm.userDecryptEuint(
      FhevmType.euint64,
      encryptedTemp,
      contractAddress,
      signers.alice
    );

    expect(decryptedTemp).to.equal(temperature);
  });

  it("should record multiple temperatures", async function () {
    const logs = [
      { location: "Shanghai Port", cargo: "Frozen Seafood - 500kg", temp: 180n, warning: false },
      { location: "Singapore Hub", cargo: "Frozen Seafood - 500kg", temp: 150n, warning: true },
      { location: "LA Port", cargo: "Frozen Seafood - 500kg", temp: 190n, warning: false },
    ];

    for (const log of logs) {
      const encryptedInput = await fhevm
        .createEncryptedInput(contractAddress, signers.alice.address)
        .add64(log.temp)
        .encrypt();

      const signature = await signRecordTemperature(signers.alice, log.location, log.cargo);

      const tx = await contract
        .connect(signers.alice)
        .recordTemperature(
          log.location,
          log.cargo,
          encryptedInput.handles[0],
          encryptedInput.inputProof,
          log.warning,
          signature
        );
      await tx.wait();
    }

    const totalLogs = await contract.getTotalLogCount();
    expect(totalLogs).to.equal(3);

    const stats = await contract.getStats();
    expect(stats[0]).to.equal(3); // totalLogs
    expect(stats[1]).to.equal(1); // warningCount

    // Verify each log
    for (let i = 0; i < logs.length; i++) {
      const [, loc, carg, , warning] = await contract.getLogMeta(i);
      expect(loc).to.equal(logs[i].location);
      expect(carg).to.equal(logs[i].cargo);
      expect(warning).to.equal(logs[i].warning);

      const encryptedTemp = await contract.getEncryptedTemperature(i);
      const decryptedTemp = await fhevm.userDecryptEuint(
        FhevmType.euint64,
        encryptedTemp,
        contractAddress,
        signers.alice
      );
      expect(decryptedTemp).to.equal(logs[i].temp);
    }
  });

  it("should reject invalid signature", async function () {
    const location = "Shanghai Port";
    const cargo = "Frozen Seafood - 500kg";
    const temperature = 180n;

    const encryptedInput = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add64(temperature)
      .encrypt();

    // Use a random signature instead of a valid one
    const invalidSignature = ethers.randomBytes(65);

    await expect(
      contract
        .connect(signers.alice)
        .recordTemperature(
          location,
          cargo,
          encryptedInput.handles[0],
          encryptedInput.inputProof,
          false,
          invalidSignature
        )
    ).to.be.reverted; // Will revert with ECDSA error or "Invalid record signature"
  });
});
