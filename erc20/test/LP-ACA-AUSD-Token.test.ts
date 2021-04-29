import { expect, use } from "chai";
import { ethers, Contract, BigNumber } from "ethers";
import { deployContract, solidity } from "ethereum-waffle";
import { evmChai } from "@acala-network/bodhi/evmChai";
import { TestAccountSigningKey, Provider, Signer } from "@acala-network/bodhi";
import { WsProvider } from "@polkadot/api";
import { createTestPairs } from "@polkadot/keyring/testingPairs";
import ADDRESS from "@acala-network/contracts/utils/Address";

use(solidity)
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

const ERC20_ABI = require("@acala-network/contracts/build/contracts/Token.json").abi;

describe("LP ACA-AUSD Token", () => {
  let wallet: Signer;
  let walletTo: Signer;
  let token: Contract;

  before(async () => {
    [wallet, walletTo] = await getWallets();
    token = new ethers.Contract(ADDRESS.LP_ACA_AUSD, ERC20_ABI, wallet as any);
  });

  after(async () => {
    provider.api.disconnect();
  });

  it("get currency id", async () => {
    const currency_id = await token.currencyId();
    expect(currency_id).to.equal(BigNumber.from("0x0000000000000000000000010000000000000001000000000000000000000000"));
  });

  it("get token name", async () => {
    const name = await token.name();
    expect(name).to.equal("LP Acala - Acala Dollar");
  });

  it("get token symbol", async () => {
    const symbol = await token.symbol();
    expect(symbol).to.equal("LP_ACA_AUSD");
  });

  it("get token decimals", async () => {
    const decimals = await token.decimals();
    expect(decimals).to.equal(12);
  });

  it("Transfer adds amount to destination account", async () => {
    const balance = await token.balanceOf(await walletTo.getAddress());
    await token.transfer(await walletTo.getAddress(), 7);
    expect((await token.balanceOf(await walletTo.getAddress())).sub(balance)).to.equal(7);
  });

  it("Transfer emits event", async () => {
    await expect(token.transfer(await walletTo.getAddress(), 7))
      .to.emit(token, "Transfer")
      .withArgs(await wallet.getAddress(), await walletTo.getAddress(), 7);
  });

  it("Can not transfer above the amount", async () => {
    const balance = await token.balanceOf(await wallet.getAddress());
    await expect(token.transfer(await walletTo.getAddress(), balance.add(7))).to.be
      .reverted;
  });
});