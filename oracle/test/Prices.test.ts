import { TestProvider, Signer, TestAccountSigningKey } from "@acala-network/bodhi";
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
//provider: new WsProvider("wss://acala-mandala.api.onfinality.io/public-ws"),
});

const testPairs = createTestPairs();

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
    const [wallet] = await provider.getWallets();
    prices = await deployContract(wallet as any, Prices);
  });

  after(async () => {
    provider.api.disconnect()
  });

  it("getPrice works", async () => {
      expect(
        await prices.getPrice(ADDRESS.AUSD)
      ).to.equal(BigNumber.from(1).mul(BigNumber.from(10).pow(18)).toString());
  });
});
