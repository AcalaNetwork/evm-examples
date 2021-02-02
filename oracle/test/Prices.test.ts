import { Provider, Signer, TestAccountSigningKey } from "@acala-network/bodhi";
import { evmChai } from "@acala-network/bodhi/evmChai";
import { WsProvider } from "@polkadot/api";
import { createTestPairs } from "@polkadot/keyring/testingPairs";
import { expect, use } from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { Contract } from "ethers";
import Prices from "../build/Prices.json";

use(solidity);
use(evmChai);

const provider = new Provider({
  provider: new WsProvider("ws://192.168.50.10:9944"),
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

const feedValues = async (token: string, price: number) => {
  return new Promise((resolve) => {
    provider.api.tx.acalaOracle
      .feedValues([[{ Token: token }, price]])
      .signAndSend(testPairs.alice.address, (result) => {
        if (result.status.isInBlock) {
          resolve(undefined);
        }
      });
  });
};

describe("Prices", () => {
  let prices: Contract;

  before(async () => {
    const [wallet] = await getWallets();
    prices = await deployContract(wallet as any, Prices);
  });

  after(async () => {
    provider.api.disconnect()
  });

  it("getPrice works", async () => {
    await feedValues("XBTC", 34_500);
    expect(
      await prices.getPrice("0x0000000000000000000000000000000000000803")
    ).to.equal(34_500);

    await feedValues("XBTC", 33_800);
    expect(
      await prices.getPrice("0x0000000000000000000000000000000000000803")
    ).to.equal(33_800);

    await feedValues("DOT", 15);
    expect(
      await prices.getPrice("0x0000000000000000000000000000000000000802")
    ).to.equal(15);

    await feedValues("DOT", 16);
    expect(
      await prices.getPrice("0x0000000000000000000000000000000000000802")
    ).to.equal(16);
  });

  it("ignores invalid address", async () => {
    // system contract addresses start with 12 zero bytes
    await expect(
      prices.getPrice("0x0000000000000000000000010000000000000000")
    ).to.be.revertedWith("Oracle: Not a system contract");
    await expect(
      prices.getPrice("0x1000000000000000000000000000000000000000")
    ).to.be.revertedWith("Oracle: Not a system contract");
    // not MultiCurrency token
    await expect(prices.getPrice("0x0000000000000000000000000000000000000806"))
      .to.be.reverted;
  });
});
