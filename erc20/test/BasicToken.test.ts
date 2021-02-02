import { expect, use } from "chai";
import { Contract } from "ethers";
import { deployContract, solidity } from "ethereum-waffle";
import { evmChai } from "@acala-network/bodhi/evmChai";
import BasicToken from "../build/BasicToken.json";
import { Wallet, Provider } from "@acala-network/bodhi";
import { WsProvider } from "@polkadot/api";
import { WalletSigningKey } from "@acala-network/bodhi";
import { createTestPairs } from "@polkadot/keyring/testingPairs";

use(solidity);
use(evmChai);

const PRIVATES = [
  "0x3a32660c3aff5b3087c68b071aa278362b2a3df2916551b4744927d105e0718b",
  "0xb04b26b3f8f30c79ee2d8a37f94e0f14fa4612bee23b448ad446909893ad658f",
  "0xfcf4d14f0d6278a033843989285cf8b0713db44d0335e877730f34c65d7a655f",
  "0x8c62fab824288c49319b06ecc3a8d68f4d9efa8497cda294b749b2b04f660052",
  "0x2e2e3f97cdb4077d6bd7d673e61f9a74fcc79d48b89e41b8ec073d2fae0491a1",
  "0xf024d03371d94b35aec0024e5a2c01ee421df49aa838f1cc7d1aef2165dfc85d",
  "0xefc44f8ded2ce7589228d472cf26c99a1da9bcfa72a0dcd04cd459189aaa6a99",
  "0x5a78d856a6ea9d29d97d90810bdae89c54eee62641ff9876b63c09dc8cbd3634",
  "0x1aeb6d3e92815a3a190afb624348bca9df15db6415e9122cf89f3e7c1261286c",
  "0x8430425785e8ad67866029c4ebc1b33bcb9d62ce6d84dfc8507411390baf5985",
];

const provider = new Provider({
  provider: new WsProvider("ws://127.0.0.1:9944"),
});

const getWallets = async () => {
  const testPairs = createTestPairs();

  const pairs = [
    testPairs.alice,
    testPairs.alice_stash,
    testPairs.bob,
    testPairs.bob_stash,
  ];
  await provider.api.isReady;

  let wallets: any[] = [];

  for (const [index, pair] of pairs.entries()) {
    const wallet = new Wallet(
      provider,
      pair,
      new WalletSigningKey(PRIVATES[index])
    );

    const isConnected = await wallet.isConnented();

    if (!isConnected) {
      wallet.claimEvmAccount();
    }

    wallets.push(wallet);
  }

  return wallets as any[];
};

describe("BasicToken", () => {
  let wallet: any;
  let walletTo: any;
  let emptyWallet: any;
  let token: Contract;

  before(async () => {
    [wallet, walletTo, emptyWallet] = await getWallets();
    token = await deployContract(wallet as any, BasicToken, [1000]);
  });

  after(async () => {
    process.exit(0);
  });

  it("Assigns initial balance", async () => {
    expect(await token.balanceOf(wallet.address)).to.equal(1000);
  });

  it("Transfer adds amount to destination account", async () => {
    await token.transfer(walletTo.address, 7);
    expect(await token.balanceOf(walletTo.address)).to.equal(7);
  });

  it("Transfer emits event", async () => {
    await expect(token.transfer(walletTo.address, 7))
      .to.emit(token, "Transfer")
      .withArgs(wallet.address, walletTo.address, 7);
  });

  it("Can not transfer above the amount", async () => {
    await expect(token.transfer(walletTo.address, 1007)).to.be.reverted;
  });

  it("Can not transfer from empty account", async () => {
    const tokenFromOtherWallet = token.connect(emptyWallet);
    await expect(tokenFromOtherWallet.transfer(wallet.address, 1)).to.be
      .reverted;
  });
});
