import { Provider, Signer, TestAccountSigningKey } from "@acala-network/bodhi";
import { evmChai } from "@acala-network/bodhi/evmChai";
import { WsProvider } from "@polkadot/api";
import { createTestPairs } from "@polkadot/keyring/testingPairs";
import { expect, use } from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { Contract, BigNumber } from "ethers";
import StateRent from "../build/StateRent.json";
import ADDRESS from "@acala-network/contracts/utils/Address";

use(solidity);
use(evmChai);

const provider = new Provider({
  provider: new WsProvider("ws://127.0.0.1:9944"),
});

const testPairs = createTestPairs();

const getWallets = async () => {
  const pairs = [
    testPairs.alice,
    testPairs.alice_stash,
    testPairs.bob,
    testPairs.bob_stash,
  ];
  const signingKey = new TestAccountSigningKey(provider.api.registry);

  signingKey.addKeyringPair(Object.values(testPairs));

  await provider.api.isReady;

  let wallets: Signer[] = [];

  for (const pair of pairs) {
    const wallet = new Signer(provider, pair.address, signingKey);

    const isClaimed = await wallet.isClaimed();

    if (!isClaimed) {
      await wallet.claimDefaultAccount();
    }

    wallets.push(wallet);
  }

  return wallets;
};

describe("StateRent", () => {
  let wallet: Signer;
  let walletTo: Signer;
  let stateRent: Contract;

  before(async () => {
    [wallet, walletTo] = await getWallets();
    stateRent = await deployContract(wallet as any, StateRent);
  });

  after(async () => {
    provider.api.disconnect()
  });

  it("stateRent works", async () => {
    expect(
      await stateRent.newContractExtraBytes()
    ).to.equal(0);

    expect(
      await stateRent.storageDepositPerByte()
    ).to.equal(0);

    expect(
      await stateRent.maintainerOf(stateRent.address)
    ).to.equal(await wallet.getAddress());

    expect(
      await stateRent.developerDeposit()
    ).to.equal(0);

    expect(
      await stateRent.deploymentFee()
    ).to.equal(0);

    // The contract created by the user cannot be transferred through the contract,
    // only through the evm dispatch call `transfer_maintainer`.
    await expect(stateRent.transferMaintainer(stateRent.address, await walletTo.getAddress())).to
      .be.reverted;
  });
});