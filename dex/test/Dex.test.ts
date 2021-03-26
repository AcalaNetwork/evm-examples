import { Provider, Signer, TestAccountSigningKey } from "@acala-network/bodhi";
import { evmChai } from "@acala-network/bodhi/evmChai";
import { WsProvider } from "@polkadot/api";
import { createTestPairs } from "@polkadot/keyring/testingPairs";
import { expect, use } from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { Contract, BigNumber, ethers } from "ethers";
import Dex from "../build/Dex.json";
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

const ERC20_ABI = require("@acala-network/contracts/build/contracts/ERC20.json").abi;

describe("Dex", () => {
  let wallet: Signer;
  let dex: Contract;

  before(async () => {
    [wallet] = await getWallets();
    dex = await deployContract(wallet as any, Dex);
  });

  after(async () => {
    provider.api.disconnect()
  });

  // Note: swap will change the pool, need to restart the node to test all the cases.

  it("getLiquidityPool works", async () => {
    const pool = await dex.getLiquidityPool(ADDRESS.XBTC, ADDRESS.AUSD);
    expect(pool[0]).to.equal(2000000);
    expect(pool[1]).to.equal(1000000);
  });

  it("getLiquidityPool should not works", async () => {
    // system contract addresses start with 12 zero bytes
    await expect(
      dex.getLiquidityPool(ADDRESS.XBTC, "0x0000000000000000000000010000000000000000")
    ).to.be.revertedWith("not a system contract");
  });

  it("getSwapTargetAmount works", async () => {
    expect(await dex.getSwapTargetAmount([ADDRESS.XBTC, ADDRESS.AUSD], 1000)).to.equal(127);
    expect(await dex.getSwapTargetAmount([ADDRESS.XBTC, ADDRESS.AUSD, ADDRESS.DOT], 1000)).to.equal(509);
  });

  it("getSwapTargetAmount should not works", async () => {
    await expect(dex.getSwapTargetAmount([ADDRESS.XBTC], 1000)).to.be.revertedWith("token path over the limit");
    await expect(dex.getSwapTargetAmount([ADDRESS.XBTC, ADDRESS.AUSD, ADDRESS.DOT, ADDRESS.RENBTC], 1000)).to.be.revertedWith("token path over the limit");
    await expect(
      dex.getSwapTargetAmount([ADDRESS.XBTC, "0x0000000000000000000000010000000000000000"], 1000)
    ).to.be.revertedWith("not a system contract");
  });

  it("getSwapSupplyAmount works", async () => {
    expect(await dex.getSwapSupplyAmount([ADDRESS.XBTC, ADDRESS.AUSD], 1000)).to.equal(127);
    expect(await dex.getSwapSupplyAmount([ADDRESS.XBTC, ADDRESS.AUSD, ADDRESS.DOT], 1000)).to.equal(509);
  });

  it("getSwapSupplyAmount should not works", async () => {
    await expect(dex.getSwapSupplyAmount([ADDRESS.XBTC], 1000)).to.be.revertedWith("token path over the limit");
    await expect(dex.getSwapSupplyAmount([ADDRESS.XBTC, ADDRESS.AUSD, ADDRESS.DOT, ADDRESS.RENBTC], 1000)).to.be.revertedWith("token path over the limit");
    await expect(
      dex.getSwapSupplyAmount([ADDRESS.XBTC, "0x0000000000000000000000010000000000000000"], 1000)
    ).to.be.revertedWith("not a system contract");
  });

  it("swapWithExactSupply works", async () => {
    const swap = await deployContract(wallet as any, Dex);
    const AUSD = new ethers.Contract(ADDRESS.AUSD, ERC20_ABI, wallet as any);
    expect((await AUSD.balanceOf(swap.address)).toNumber()).to.equal(0);
    expect(await swap.swapWithExactSupply([ADDRESS.ACA, ADDRESS.AUSD], 1000, 1, { value: 5000, gasLimit: 2_000_000 })).to.be.ok;
    expect((await AUSD.balanceOf(swap.address)).toNumber()).to.equal(1996);
    const XBTC = new ethers.Contract(ADDRESS.XBTC, ERC20_ABI, wallet as any);
    expect((await XBTC.balanceOf(swap.address)).toNumber()).to.equal(0);
    expect(await swap.swapWithExactSupply([ADDRESS.ACA, ADDRESS.AUSD, ADDRESS.XBTC], 1000, 1, { value: 5000, gasLimit: 2_000_000 })).to.be.ok;
    expect((await XBTC.balanceOf(swap.address)).toNumber()).to.equal(3972);
  });

  it("swapWithExactSupply should not works", async () => {
    await expect(dex.swapWithExactSupply([ADDRESS.ACA], 1000, 1)).to.be.revertedWith("token path over the limit");
    await expect(dex.swapWithExactSupply([ADDRESS.ACA, ADDRESS.AUSD, ADDRESS.XBTC, ADDRESS.RENBTC], 1000, 1)).to.be.revertedWith("token path over the limit");
    await expect(
      dex.swapWithExactSupply([ADDRESS.XBTC, "0x0000000000000000000000010000000000000000"], 1000, 1)
    ).to.be.revertedWith("not a system contract");
  });

  it("swapWithExactTarget works", async () => {
    const swap = await deployContract(wallet as any, Dex);
    const AUSD = new ethers.Contract(ADDRESS.AUSD, ERC20_ABI, wallet as any);
    expect((await AUSD.balanceOf(swap.address)).toNumber()).to.equal(0);
    expect(await swap.swapWithExactTarget([ADDRESS.ACA, ADDRESS.AUSD], 1, 1000, { value: 5000, gasLimit: 2_000_000 })).to.be.ok;
    expect((await AUSD.balanceOf(swap.address)).toNumber()).to.equal(1);
    const XBTC = new ethers.Contract(ADDRESS.XBTC, ERC20_ABI, wallet as any);
    expect((await XBTC.balanceOf(swap.address)).toNumber()).to.equal(0);
    expect(await swap.swapWithExactTarget([ADDRESS.ACA, ADDRESS.AUSD, ADDRESS.XBTC], 1, 1000, { value: 5000, gasLimit: 2_000_000 })).to.be.ok;
    expect((await XBTC.balanceOf(swap.address)).toNumber()).to.equal(1);
  });

  it("swapWithExactTarget should not works", async () => {
    await expect(dex.swapWithExactTarget([ADDRESS.ACA], 1, 1000)).to.be.revertedWith("token path over the limit");
    await expect(dex.swapWithExactTarget([ADDRESS.ACA, ADDRESS.AUSD, ADDRESS.XBTC, ADDRESS.RENBTC], 1, 1000)).to.be.revertedWith("token path over the limit");
    await expect(
      dex.swapWithExactTarget([ADDRESS.XBTC, "0x0000000000000000000000010000000000000000"], 1, 1000)
    ).to.be.revertedWith("not a system contract");
  });
});
