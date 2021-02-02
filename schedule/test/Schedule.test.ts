import { expect, use } from "chai";
import { ethers, Contract } from "ethers";
import { deployContract, solidity } from "ethereum-waffle";
import { evmChai } from "@acala-network/bodhi/evmChai";
import { Wallet, Provider } from "@acala-network/bodhi";
import { WsProvider } from "@polkadot/api";
import { WalletSigningKey } from "@acala-network/bodhi";
import { createTestPairs } from "@polkadot/keyring/testingPairs";
import RecurringPayment from "../build/RecurringPayment.json";

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

const testPairs = createTestPairs();

const getWallets = async () => {
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

const next_block = async (block_number: number) => {
  return new Promise((resolve) => {
    provider.api.tx.system.remark(block_number.toString(16)).signAndSend(testPairs.alice, (result) => {
      if (result.status.isInBlock) {
        resolve();
      }
    });
  });
}

const SCHEDULE_CALL_ADDRESS = '0x0000000000000000000000000000000000000808';
const SCHEDULE_CALL_ABI = [
  "function scheduleCall(address contract_address, uint256 value, uint256 gas_limit, uint256 storage_limit, uint256 min_delay, bytes calldata input_data) public returns (uint256, uint256)",
]

const ACA_ERC20_ADDRESS = '0x0000000000000000000000000000000000000800';
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
  let wallet: any;
  let walletTo: any;
  let schedule: Contract;

  before(async () => {
    [wallet, walletTo] = await getWallets();
    schedule = await new ethers.Contract(SCHEDULE_CALL_ADDRESS, SCHEDULE_CALL_ABI, wallet as any);
  });

  after(async () => {
    process.exit(0);
  });

  it("ScheduleCall works", async () => {
    const target_block_number = Number(await provider.api.query.system.number()) + 4;

    const erc20 = new ethers.Contract(ACA_ERC20_ADDRESS, ERC20_ABI, walletTo as any);
    const tx = await erc20.populateTransaction.transfer(walletTo.address, 1_000_000);
    console.log(tx, ethers.utils.hexlify(tx.data));

    await schedule.scheduleCall(ACA_ERC20_ADDRESS, 0, 300000, 10000, 1, ethers.utils.hexlify(tx.data));
    //await expect(schedule.scheduleCall(ACA_ERC20_ADDRESS, 0, 300000, 10000, 1, ethers.utils.hexlify(tx.data)))
    //  .to.emit(schedule, "LocalScheduledCall")
    //  .withArgs(wallet.address, ACA_ERC20_ADDRESS, target_block_number, 0);

    let current_block_number = Number(await provider.api.query.system.number());
    let balance = await erc20.balanceOf(walletTo.address);
    while (current_block_number < target_block_number) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    let new_balance = await erc20.balanceOf(walletTo.address);
    expect(new_balance.eq(balance.add(1_000_000))).to.be.ok;
  });

  it("works with RecurringPayment", async () => {
    const inital_block_number = Number(await provider.api.query.system.number());

    const initalWalletBal = await provider.getBalance(wallet.address);
    const initalWalletToBal = await provider.getBalance(walletTo.address);

    const recurringPayment = await deployContract(wallet as any, RecurringPayment, [3, 4, 1000, walletTo.address], { value: 4000 });

    expect(await provider.getBalance(recurringPayment.address)).to.equal(4000);

    let current_block_number = Number(await provider.api.query.system.number());

    while (current_block_number < (inital_block_number + 3)) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    expect(await provider.getBalance(recurringPayment.address)).to.equal(3000);
    expect(await provider.getBalance(walletTo.address)).to.equal(initalWalletToBal.add(1000));

    current_block_number = Number(await provider.api.query.system.number());
    while (current_block_number < (inital_block_number + 9)) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    expect(await provider.getBalance(recurringPayment.address)).to.equal(1000);
    expect(await provider.getBalance(walletTo.address)).to.equal(initalWalletToBal.add(3000));

    current_block_number = Number(await provider.api.query.system.number());
    while (current_block_number < (inital_block_number + 12)) {
      await next_block(current_block_number);
      current_block_number = Number(await provider.api.query.system.number());
    }

    expect(await provider.getBalance(recurringPayment.address)).to.equal(0);
    expect(await provider.getBalance(walletTo.address)).to.equal(initalWalletToBal.add(4000));
  });
});
