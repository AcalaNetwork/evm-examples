import { Contract, ContractFactory, BigNumber, ethers } from "ethers";
import ADDRESS from "@acala-network/contracts/utils/Address";

import UniswapFactory from "../artifacts/UniswapV2Factory.json";
import UniswapRouter from "../artifacts/UniswapV2Router02.json";
import Arbitrager from "../build/Arbitrager.json";
import ISchedule from "../build/ISchedule.json";
import IERC20 from "../artifacts/IERC20.json";
import setup from "./setup";

import { hexlify } from "ethers/lib/utils";

const main = async () => {
    const { wallet, provider, pair } = await setup();
    const deployerAddress = await wallet.getAddress();
    const tokenAUSD = new Contract(ADDRESS.AUSD, IERC20.abi, wallet);
    const tokenDOT = new Contract(ADDRESS.DOT, IERC20.abi, wallet);
    const schedulerAbi = require("@acala-network/contracts/build/contracts/Schedule.json").abi
    const scheduler = new Contract(ADDRESS.Schedule, schedulerAbi, wallet as any);
    // const scheduler = new Contract(ADDRESS.Schedule, ISchedule.abi, wallet);

    const nextBlock = async () => {
      return new Promise((resolve) => {
        provider.api.tx.system.remark('').signAndSend(pair, (result) => {
          if (result.status.isInBlock) {
            resolve(undefined);
          }
        });
      });
    };

    const printBalance = async () => {
      const amountAUSD = await tokenAUSD.balanceOf(arbitrager.address);
      const amountDOT = await tokenDOT.balanceOf(arbitrager.address);
      const lpAmountAUSD = await tokenAUSD.balanceOf(tradingPairAddress);
      const lpAmountDOT = await tokenDOT.balanceOf(tradingPairAddress);

      console.log({
        arbitrager: arbitrager.address,
        amountAUSD: amountAUSD.toString(),
        amountDOT: amountDOT.toString(),
        lpAmountAUSD: lpAmountAUSD.toString(),
        lpAmountDOT: lpAmountDOT.toString(),
      })
    };

    console.log('Deploy Uniswap');

    // deploy factory
    const factory = await ContractFactory.fromSolidity(UniswapFactory).connect(wallet).deploy(deployerAddress)

    // deploy router
    const router = await ContractFactory.fromSolidity(UniswapRouter).connect(wallet).deploy(factory.address, ADDRESS.ACA);

    console.log({
        factory: factory.address,
        router: router.address,
    });

    await tokenAUSD.approve(router.address, BigNumber.from(10).pow(18));
    await tokenDOT.approve(router.address, BigNumber.from(10).pow(18));

    await router.addLiquidity(ADDRESS.AUSD, ADDRESS.DOT, BigNumber.from(10).pow(15), BigNumber.from(10).pow(15), 0, 0, deployerAddress, 10000000000);

    // check
    const tradingPairAddress = await factory.getPair(ADDRESS.AUSD, ADDRESS.DOT);
    const tradingPair = new Contract(tradingPairAddress, IERC20.abi, wallet);
    const lpTokenAmount = await tradingPair.balanceOf(deployerAddress);
    const amountAUSD = await tokenAUSD.balanceOf(tradingPairAddress);
    const amountDOT = await tokenDOT.balanceOf(tradingPairAddress);
    
    console.log({
        tradingPair: tradingPairAddress,
        lpTokenAmount: lpTokenAmount.toString(),
        liquidityPoolAmountAUSD: amountAUSD.toString(),
        liquidityPoolAmountDOT: amountDOT.toString(),
    });

    console.log('Deploy Arbitrager');

    // deploy arbitrager
    const arbitrager = await ContractFactory.fromSolidity(Arbitrager).connect(wallet)
        .deploy(factory.address, router.address, ADDRESS.AUSD, ADDRESS.DOT);

    console.log("Arbitrager is deployed at: " + arbitrager.address);

    let iface = new ethers.utils.Interface(schedulerAbi);

    let current_block_number = Number(await provider.api.query.system.number());

    // schedule trigger() call every 3 blocks
    await arbitrager.scheduleTriggerCall(1);

    // get task_id form Event emitted by Scheduler
    let block_hash = await provider.api.query.system.blockHash(current_block_number);
    const data = await provider.api.derive.tx.events(block_hash);
    let event = data.events.filter(item => item.event.data.some(data => data.address == ADDRESS.Schedule && data.topics[0] == iface.getEventTopic(iface.getEvent("ScheduledCall"))));

    let log = {
      topics: [event[0].event.data[0].topics[0].toString(), event[0].event.data[0].topics[1].toString(), event[0].event.data[0].topics[2].toString()], data: event[0].event.data[0].data.toString()
    };
    let decode_log = await iface.parseLog(log);

    const task_id = decode_log.args.task_id;

    console.log("task_id for managing Scheduler subscription is: " + task_id);

    // save task_id to Arbitrager
    await arbitrager.setTaskId(ethers.utils.hexlify(task_id));

    await tokenAUSD.transfer(arbitrager.address, BigNumber.from(10).pow(13));
    await tokenDOT.transfer(arbitrager.address, BigNumber.from(10).pow(13));

    await provider.api.tx.acalaOracle.feedValues([[{ Token: 'AUSD'}, 1000], [{ Token: 'DOT'}, 2000]]).signAndSend(pair);

    await printBalance();
    
    await nextBlock();
    await nextBlock();

    await printBalance();

    await nextBlock();
    await provider.api.tx.acalaOracle.feedValues([[{ Token: 'AUSD'}, 2000], [{ Token: 'DOT'}, 1000]]).signAndSend(pair);

    await printBalance();

    await nextBlock();
    await nextBlock();

    await printBalance();

    // change the Scheduler subscription to call trigger() every 5th block
    // console.log("Update Scheduler subscription");
    // await scheduler.rescheduleCall(5, ethers.utils.formatBytes32String(task_id));
    // console.log("foo");
    // await arbitrager.rescheduleTriggerCall(4);

    // await nextBlock();
    // await nextBlock();

    // // balances don't change, since the Scheduler subscription has been modified
    // console.log("Since not enough time has elapsed, balance has not changed:");
    // await printBalance();

    // await nextBlock();
    // await nextBlock();

    // // the trigger() was called
    // console.log("Now the updated trigger() call comes into effect:");
    // await printBalance();

    // cancel the trigger() call subscription with Scheduler
    // console.log("Cancel the trigger() call subscription with Scheduler");
    // await arbitrager.cancelTriggerCall();

    provider.api.disconnect();
}

main()
