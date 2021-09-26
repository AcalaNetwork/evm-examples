import { expect, use } from "chai";
import { ethers } from "ethers";
import { deployContract } from "ethereum-waffle";
import { evmChai } from "@acala-network/bodhi/evmChai";
import { TestAccountSigningKey, TestProvider, Signer } from "@acala-network/bodhi";
import { WsProvider } from "@polkadot/api";
import { createTestPairs } from "@polkadot/keyring/testingPairs";
import Storage from "../build/Storage.json"

use(evmChai);

const provider = new TestProvider({
  provider: new WsProvider("ws://127.0.0.1:9944"),
});

const testPairs = createTestPairs();

const next_block = async (block_number: number) => {
  return new Promise((resolve) => {
    provider.api.tx.system.remark(block_number.toString(16)).signAndSend(testPairs.alice.address, (result) => {
      if (result.status.isInBlock) {
        resolve(undefined);
      }
    });
  });
}

describe("e2e test", () => {
  let wallet: Signer;
  let walletTo: Signer;

  before(async () => {
    [wallet, walletTo] = await provider.getWallets();
  });

  after(async () => {
    provider.api.disconnect()
  });

  it("evm block number", async () => {
   let [ alice ] = await provider.getWallets();

   const contract = await deployContract(alice as any, Storage);


   console.log(await contract.getStorage("0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"));
   //console.log(await provider.getStorageAt(contract.address, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"));

   //await contract.setStorage("0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc", "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef");
   //console.log(await contract.getStorage("0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"));

   //console.log(await provider.getStorageAt(contract.address, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"));
  });
});
