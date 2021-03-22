import { Provider, Signer, TestAccountSigningKey } from "@acala-network/bodhi";
import { evmChai } from "@acala-network/bodhi/evmChai";
import { WsProvider } from "@polkadot/api";
import { createTestPairs } from "@polkadot/keyring/testingPairs";
import { expect, use } from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { Contract, BigNumber } from "ethers";
import Prices from "../build/Prices.json";
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
      await feedValues("XBTC", BigNumber.from(34_500).mul(BigNumber.from(10).pow(8)).toString());
      expect(
        await prices.getPrice(ADDRESS.XBTC)
      ).to.equal(BigNumber.from(34_500).mul(BigNumber.from(10).pow(18)).toString());

      await feedValues("XBTC", BigNumber.from(33_800).mul(BigNumber.from(10).pow(8)).toString());
      expect(
        await prices.getPrice(ADDRESS.XBTC)
      ).to.equal(BigNumber.from(33_800).mul(BigNumber.from(10).pow(18)).toString());

      await feedValues("DOT", BigNumber.from(15).mul(BigNumber.from(10).pow(10)).toString());
      expect(
        await prices.getPrice(ADDRESS.DOT)
      ).to.equal(BigNumber.from(15).mul(BigNumber.from(10).pow(18)).toString());

      await feedValues("DOT", BigNumber.from(16).mul(BigNumber.from(10).pow(10)).toString());
      expect(
        await prices.getPrice(ADDRESS.DOT)
      ).to.equal(BigNumber.from(16).mul(BigNumber.from(10).pow(18)).toString());

      expect(
        await prices.getPrice(ADDRESS.AUSD)
	// AUSD right shift the decimal point (18-12) places
      ).to.equal(BigNumber.from(1).mul(BigNumber.from(10).pow(18 + 6)).toString());
  });

  it("ignores invalid address", async () => {
    // system contract addresses start with 12 zero bytes
    await expect(
      prices.getPrice("0x0000000000000000000000010000000000000000")
    ).to.be.revertedWith("not a system contract");
    await expect(
      prices.getPrice("0x1000000000000000000000000000000000000000")
    ).to.be.revertedWith("not a system contract");
    // not MultiCurrency token
    await expect(prices.getPrice("0x0000000000000000000000000000000000000000"))
      .to.be.reverted;
  });
});
