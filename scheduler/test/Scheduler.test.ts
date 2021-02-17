import { expect, use } from "chai";
import { ethers, Contract } from "ethers";
import { deployContract, solidity } from "ethereum-waffle";
import { evmChai } from "@acala-network/bodhi/evmChai";
import { TestAccountSigningKey, Provider, Signer } from "@acala-network/bodhi";
import { WsProvider } from "@polkadot/api";
import { createTestPairs } from "@polkadot/keyring/testingPairs";
import RecurringPayment from "../build/RecurringPayment.json";

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

const SCHEDULE_CALL_ADDRESS = '0x0000000000000000000000000000000000000808';
const SCHEDULE_CALL_ABI = [
  "function scheduleCall(address contract_address, uint256 value, uint256 gas_limit, uint256 storage_limit, uint256 min_delay, bytes memory input_data) public returns (bool)",
  "function cancelCall(bytes memory task_id) public returns (bool)",
  "function rescheduleCall(uint256 min_delay, bytes memory task_id) public returns (bool)",

   "event ScheduledCall(address indexed sender, address indexed contract_address, bytes task_id)",
   "event CanceledCall(address indexed sender, bytes task_id)",
   "event RescheduledCall(address indexed sender, bytes task_id)",
]

const DOT_ERC20_ADDRESS = '0x0000000000000000000000000000000000000802';
const ERC20_ABI = [
  // Read-Only Functions
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",

  // Authenticated Functions
  "function transfer(address to, uint256 amount) public returns (bool)",

  // Events
  "event Transfer(address indexed from, address indexed to, uint256 amount)",
];

describe("Schedule", () => {
  let wallet: Signer;
  let walletTo: Signer;
  let schedule: Contract;

  before(async () => {
    [wallet, walletTo] = await getWallets();
    schedule = await new ethers.Contract(SCHEDULE_CALL_ADDRESS, SCHEDULE_CALL_ABI, wallet as any);
  });

  after(async () => {
    provider.api.disconnect()
  });

  it("ScheduleCall works", async () => {
    const target_block_number = Number(await provider.api.query.system.number()) + 4;

    const erc20 = new ethers.Contract(DOT_ERC20_ADDRESS, ERC20_ABI, walletTo as any);
    const tx = await erc20.populateTransaction.transfer(walletTo.getAddress(), 1_000_000);
    console.log(tx, ethers.utils.hexlify(tx.data as string));

    await schedule.scheduleCall(DOT_ERC20_ADDRESS, 0, 300000, 10000, 1, ethers.utils.hexlify(tx.data as string));

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
    const erc20 = new ethers.Contract(DOT_ERC20_ADDRESS, ERC20_ABI, walletTo as any);
    const tx = await erc20.populateTransaction.transfer(walletTo.getAddress(), 1_000_000);
    console.log(tx, ethers.utils.hexlify(tx.data as string));

    let iface = new ethers.utils.Interface(SCHEDULE_CALL_ABI);

    let current_block_number = Number(await provider.api.query.system.number());
    await schedule.scheduleCall(DOT_ERC20_ADDRESS, 0, 300000, 10000, 2, ethers.utils.hexlify(tx.data as string));

    let block_hash = await provider.api.query.system.blockHash(current_block_number);
    const data = await provider.api.derive.tx.events(block_hash);
    //let event = data.events.filter(item => item.event.data.some(data => data.address == SCHEDULE_CALL_ADDRESS));
    let event = data.events.filter(item => item.event.data.some(data => data.address == SCHEDULE_CALL_ADDRESS && data.topics[0]=='0xf50ab0aa329811f23150e5490fc00ea0baf136a55280b7e88703b4753d4097ce'));
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
    const erc20 = new ethers.Contract(DOT_ERC20_ADDRESS, ERC20_ABI, walletTo as any);
    const tx = await erc20.populateTransaction.transfer(walletTo.getAddress(), 1_000_000);
    console.log(tx, ethers.utils.hexlify(tx.data as string));

    let iface = new ethers.utils.Interface(SCHEDULE_CALL_ABI);

    let current_block_number = Number(await provider.api.query.system.number());
    await schedule.scheduleCall(DOT_ERC20_ADDRESS, 0, 300000, 10000, 4, ethers.utils.hexlify(tx.data as string));

    let block_hash = await provider.api.query.system.blockHash(current_block_number);
    const data = await provider.api.derive.tx.events(block_hash);
    let event = data.events.filter(item => item.event.data.some(data => data.address == SCHEDULE_CALL_ADDRESS && data.topics[0]=='0xf50ab0aa329811f23150e5490fc00ea0baf136a55280b7e88703b4753d4097ce'));
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
    const transferTo = await ethers.Wallet.createRandom().getAddress();
    const inital_block_number = Number(await provider.api.query.system.number());

    const recurringPayment = await deployContract(wallet as any, RecurringPayment, [3, 4, 1000, transferTo], { value: 5000, gasLimit: 2_000_000 });

    expect((await provider.getBalance(transferTo)).toNumber()).to.equal(0);

    let current_block_number = Number(await provider.api.query.system.number());

    while (current_block_number < (inital_block_number + 5)) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    expect((await provider.getBalance(transferTo)).toNumber()).to.equal(1000);

    current_block_number = Number(await provider.api.query.system.number());
    while (current_block_number < (inital_block_number + 14)) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    expect((await provider.getBalance(transferTo)).toNumber()).to.equal(3000);

    current_block_number = Number(await provider.api.query.system.number());
    while (current_block_number < (inital_block_number + 17)) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    expect((await provider.getBalance(recurringPayment.address)).toNumber()).to.equal(0);
    expect((await provider.getBalance(transferTo)).toNumber()).to.equal(5000);
  });
});
