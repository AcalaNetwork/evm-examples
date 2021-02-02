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
  "function scheduleCall(address contract_address, uint256 value, uint256 gas_limit, uint256 storage_limit, uint256 min_delay, bytes calldata input_data) public returns (uint256, uint256)",
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
