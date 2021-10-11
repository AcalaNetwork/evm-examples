import { TestProvider } from "@acala-network/bodhi";
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

const provider = new TestProvider({
  provider: new WsProvider("ws://127.0.0.1:9944"),
});

const testPairs = createTestPairs();

const feedValues = async (token: string, price: string) => {
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
  let oracleContract: Contract;

  before(async () => {
    const [wallet] = await provider.getWallets();
    oracleContract = await deployContract(wallet as any, Prices);
  });

  after(async () => {
    provider.api.disconnect();
  });

  it("feed/get price RENBTC", async () => {
    const TOKEN = "RENBTC";
    const price = BigNumber.from(34_500)
      .mul(BigNumber.from(10).pow(18))
      .toString();
    await feedValues(TOKEN, price);
    expect(await oracleContract.getPrice(ADDRESS.RENBTC)).to.equal(price);
  });

  it("feed/get price DOT", async () => {
    const TOKEN = "RENBTC";
    const price = BigNumber.from(34_500)
      .mul(BigNumber.from(10).pow(18))
      .toString();
    await feedValues(TOKEN, price);
    expect(await oracleContract.getPrice(ADDRESS.RENBTC)).to.equal(price);
  });

  it("get price AUSD/KUSD", async () => {
    expect(await oracleContract.getPrice(ADDRESS.AUSD)).to.equal(
      BigNumber.from(1).mul(BigNumber.from(10).pow(18)).toString()
    );

    expect(await oracleContract.getPrice(ADDRESS.KUSD)).to.equal(0);
  });

  it("ignores invalid address", async () => {
    // not system contract
    await expect(
      oracleContract.getPrice("0x1000000000000000000000000000000000000000")
    ).to.be.reverted;
    // not MultiCurrency token
    await expect(
      oracleContract.getPrice("0x0000000000000000000000000000000000000000")
    ).to.be.reverted;
  });
});
