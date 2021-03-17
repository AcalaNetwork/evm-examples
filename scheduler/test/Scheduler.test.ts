import { expect, use } from "chai";
import { ethers, Contract } from "ethers";
import { deployContract, solidity } from "ethereum-waffle";
import { evmChai } from "@acala-network/bodhi/evmChai";
import { TestAccountSigningKey, Provider, Signer } from "@acala-network/bodhi";
import { WsProvider } from "@polkadot/api";
import { createTestPairs } from "@polkadot/keyring/testingPairs";
import RecurringPayment from "../build/RecurringPayment.json";
import Subscription from "../build/Subscription.json";
import ADDRESS from "@acala-network/contracts/utils/Address";

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

const next_block = async (block_number: number) => {
  return new Promise((resolve) => {
    provider.api.tx.system.remark(block_number.toString(16)).signAndSend(testPairs.alice.address, (result) => {
      if (result.status.isInBlock) {
        resolve(undefined);
      }
    });
  });
}

const SCHEDULE_CALL_ABI = require("@acala-network/contracts/build/contracts/Schedule.json").abi;
const ERC20_ABI = require("@acala-network/contracts/build/contracts/ERC20.json").abi;

describe("Schedule", () => {
  let wallet: Signer;
  let walletTo: Signer;
  let subscriber: Signer
  let schedule: Contract;

  before(async () => {
    [wallet, walletTo, subscriber] = await getWallets();
    schedule = await new ethers.Contract(ADDRESS.Schedule, SCHEDULE_CALL_ABI, wallet as any);
  });

  after(async () => {
    provider.api.disconnect()
  });

  it("ScheduleCall works", async () => {
    const target_block_number = Number(await provider.api.query.system.number()) + 4;

    const erc20 = new ethers.Contract(ADDRESS.DOT, ERC20_ABI, walletTo as any);
    const tx = await erc20.populateTransaction.transfer(walletTo.getAddress(), 1_000_000);
    console.log(tx, ethers.utils.hexlify(tx.data as string));

    await schedule.scheduleCall(ADDRESS.DOT, 0, 300000, 10000, 1, ethers.utils.hexlify(tx.data as string));

    let current_block_number = Number(await provider.api.query.system.number());
    let balance = await erc20.balanceOf(await walletTo.getAddress());
    while (current_block_number < target_block_number) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    let new_balance = await erc20.balanceOf(await walletTo.getAddress());
    expect(new_balance.toString()).to.equal(balance.add(1_000_000).toString());
  });

  it("CancelCall works", async () => {
    const erc20 = new ethers.Contract(ADDRESS.DOT, ERC20_ABI, walletTo as any);
    const tx = await erc20.populateTransaction.transfer(walletTo.getAddress(), 1_000_000);
    console.log(tx, ethers.utils.hexlify(tx.data as string));

    let iface = new ethers.utils.Interface(SCHEDULE_CALL_ABI);

    let current_block_number = Number(await provider.api.query.system.number());
    await schedule.scheduleCall(ADDRESS.DOT, 0, 300000, 10000, 2, ethers.utils.hexlify(tx.data as string));

    let block_hash = await provider.api.query.system.blockHash(current_block_number);
    const data = await provider.api.derive.tx.events(block_hash);
    //let event = data.events.filter(item => item.event.data.some(data => data.address == ADDRESS.Schedule));
    let event = data.events.filter(item => item.event.data.some(data => data.address == ADDRESS.Schedule && data.topics[0] == iface.getEventTopic(iface.getEvent("ScheduledCall"))));
    console.log("event:", event.toString());
    if (event.length > 0) {
      let log = {
        topics: [event[0].event.data[0].topics[0].toString(), event[0].event.data[0].topics[1].toString(), event[0].event.data[0].topics[2].toString()], data: event[0].event.data[0].data.toString()
      };
      let decode_log = await iface.parseLog(log);
      console.log("task_id:" + decode_log.args.task_id);
      await schedule.cancelCall(ethers.utils.hexlify(decode_log.args.task_id));
    } else {
      expect(false).to.not.be.ok;
    }
  });

  it("RescheduleCall works", async () => {
    const erc20 = new ethers.Contract(ADDRESS.DOT, ERC20_ABI, walletTo as any);
    const tx = await erc20.populateTransaction.transfer(walletTo.getAddress(), 1_000_000);
    console.log(tx, ethers.utils.hexlify(tx.data as string));

    let iface = new ethers.utils.Interface(SCHEDULE_CALL_ABI);

    let current_block_number = Number(await provider.api.query.system.number());
    await schedule.scheduleCall(ADDRESS.DOT, 0, 300000, 10000, 4, ethers.utils.hexlify(tx.data as string));

    let block_hash = await provider.api.query.system.blockHash(current_block_number);
    const data = await provider.api.derive.tx.events(block_hash);
    let event = data.events.filter(item => item.event.data.some(data => data.address == ADDRESS.Schedule && data.topics[0]== iface.getEventTopic(iface.getEvent("ScheduledCall"))));
    console.log("event:", event.toString());
    if (event.length > 0) {
      let log = {
        topics: [event[0].event.data[0].topics[0].toString(), event[0].event.data[0].topics[1].toString(), event[0].event.data[0].topics[2].toString()], data: event[0].event.data[0].data.toString()
      };
      let decode_log = await iface.parseLog(log);
      console.log("task_id:" + decode_log.args.task_id);
      await schedule.rescheduleCall(5, ethers.utils.hexlify(decode_log.args.task_id));
    } else {
      expect(false).to.not.be.ok;
    }
  });

  it("works with RecurringPayment", async () => {
    const erc20 = new ethers.Contract(ADDRESS.ACA, ERC20_ABI, walletTo as any);
    const transferTo = await ethers.Wallet.createRandom().getAddress();
    const inital_block_number = Number(await provider.api.query.system.number());

    const recurringPayment = await deployContract(wallet as any, RecurringPayment, [3, 4, 1000, transferTo], { value: 5000, gasLimit: 2_000_000 });

    //expect((await provider.getBalance(transferTo)).toNumber()).to.equal(0);
    expect((await erc20.balanceOf(transferTo)).toNumber()).to.equal(0);

    let current_block_number = Number(await provider.api.query.system.number());

    while (current_block_number < (inital_block_number + 5)) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    //expect((await provider.getBalance(transferTo)).toNumber()).to.equal(1000);
    expect((await erc20.balanceOf(transferTo)).toNumber()).to.equal(1000);

    current_block_number = Number(await provider.api.query.system.number());
    while (current_block_number < (inital_block_number + 14)) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    //expect((await provider.getBalance(transferTo)).toNumber()).to.equal(3000);
    expect((await erc20.balanceOf(transferTo)).toNumber()).to.equal(3000);

    current_block_number = Number(await provider.api.query.system.number());
    while (current_block_number < (inital_block_number + 17)) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    //expect((await provider.getBalance(recurringPayment.address)).toNumber()).to.equal(0);
    //expect((await provider.getBalance(transferTo)).toNumber()).to.equal(5000);
    expect((await erc20.balanceOf(recurringPayment.address)).toNumber()).to.equal(0);
    expect((await erc20.balanceOf(transferTo)).toNumber()).to.equal(5000);
  });

  it("works with Subscription", async () => {
    const period = 10;
    const subPrice = 1000;

    const subscription = await deployContract(wallet as any, Subscription, [subPrice, period], { value: 5000, gasLimit: 2_000_000 });

    expect((await subscription.balanceOf(subscriber.getAddress())).toNumber()).to.equal(0);
    expect((await subscription.subTokensOf(subscriber.getAddress())).toNumber()).to.equal(0);
    expect((await subscription.monthsSubscribed(subscriber.getAddress())).toNumber()).to.equal(0);
    
    const subscriberContract = subscription.connect(subscriber as any);
    await subscriberContract.subscribe({ value: 10_000, gasLimit: 2_000_000 });

    expect((await subscription.balanceOf(subscriber.getAddress())).toNumber()).to.equal(10_000 - subPrice);
    expect((await subscription.subTokensOf(subscriber.getAddress())).toNumber()).to.equal(1);
    expect((await subscription.monthsSubscribed(subscriber.getAddress())).toNumber()).to.equal(1);

    let current_block_number = Number(await provider.api.query.system.number());
    for (let i = 0; i < period; i++) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    expect((await subscription.balanceOf(subscriber.getAddress())).toNumber()).to.equal(10_000 - (subPrice * 2));
    expect((await subscription.subTokensOf(subscriber.getAddress())).toNumber()).to.equal(3);
    expect((await subscription.monthsSubscribed(subscriber.getAddress())).toNumber()).to.equal(2);

    current_block_number = Number(await provider.api.query.system.number());
    for (let i = 0; i < period + 1; i++) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    expect((await subscription.balanceOf(subscriber.getAddress())).toNumber()).to.equal(10_000 - (subPrice * 3));
    expect((await subscription.subTokensOf(subscriber.getAddress())).toNumber()).to.equal(6);
    expect((await subscription.monthsSubscribed(subscriber.getAddress())).toNumber()).to.equal(3);

    await subscriberContract.unsubscribe({ gasLimit: 2_000_000 });

    current_block_number = Number(await provider.api.query.system.number());
    await next_block(current_block_number);

    expect((await subscription.balanceOf(subscriber.getAddress())).toNumber()).to.equal(0);
    expect((await subscription.subTokensOf(subscriber.getAddress())).toNumber()).to.equal(6);
    expect((await subscription.monthsSubscribed(subscriber.getAddress())).toNumber()).to.equal(0);
  });
});
