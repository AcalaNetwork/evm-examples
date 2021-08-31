import { TestProvider, Signer, TestAccountSigningKey } from "@acala-network/bodhi";
import { evmChai } from "@acala-network/bodhi/evmChai";
import { WsProvider } from "@polkadot/api";
import { createTestPairs } from "@polkadot/keyring/testingPairs";
import { expect, use } from "chai";
import { deployContract, solidity } from "ethereum-waffle";
import { Contract, ContractFactory, BigNumber, ethers } from "ethers";
import ADDRESS from "@acala-network/contracts/utils/Address";

import UniswapFactory from "../artifacts/UniswapV2Factory.json";
import UniswapRouter from "../artifacts/UniswapV2Router02.json";
import Arbitrager from "../build/Arbitrager.json";
import IERC20 from "../artifacts/IERC20.json";
import { Bytes, SigningKey } from "ethers/lib/utils";
import { it } from "mocha";

use(solidity);
use(evmChai);

const provider = new TestProvider({
    provider: new WsProvider("ws://127.0.0.1:9944"),
});

const SCHEDULE_CALL_ABI = require("@acala-network/contracts/build/contracts/Schedule.json").abi;

describe("Arbitrager", () => {

    const pair = createTestPairs().alice;
    const signingKey = new TestAccountSigningKey(provider.api.registry);
    signingKey.addKeyringPair(pair);

    let factory: Contract;
    let router: Contract;
    let arbitrager: Contract;
    let tokenAUSD: Contract;
    let tokenDOT: Contract;
    let wallet: Signer;
    let schedulerTaskId: Bytes;
    
    before(async () => {
        await provider.api.isReady;

        wallet = new Signer(provider, pair.address, signingKey);
        const deployer = await wallet.getAddress();

        tokenAUSD = new Contract(ADDRESS.AUSD, IERC20.abi, wallet);
        tokenDOT = new Contract(ADDRESS.DOT, IERC20.abi, wallet);

        factory = await ContractFactory.fromSolidity(UniswapFactory).connect(wallet).deploy(deployer);
        router = await ContractFactory.fromSolidity(UniswapRouter).connect(wallet).deploy(factory.address, ADDRESS.ACA);

        await tokenAUSD.approve(router.address, BigNumber.from(10).pow(18));
        await tokenDOT.approve(router.address, BigNumber.from(10).pow(18));

        await router.addLiquidity(ADDRESS.AUSD, ADDRESS.DOT, BigNumber.from(10).pow(15), BigNumber.from(10).pow(15), 0, 0, deployer, 10000000000);

        arbitrager = await ContractFactory.fromSolidity(Arbitrager).connect(wallet).deploy(factory.address, router.address, ADDRESS.AUSD, ADDRESS.DOT);

        expect(arbitrager.address).to.be.properAddress;

        let iface = new ethers.utils.Interface(SCHEDULE_CALL_ABI);

        let current_block_number = Number(await provider.api.query.system.number());

        await arbitrager.scheduleTriggerCall(1);

        let block_hash = await provider.api.query.system.blockHash(current_block_number);
        const data = await provider.api.derive.tx.events(block_hash);
        let event = data.events.filter(item => item.event.data.some(data => data.address == ADDRESS.Schedule && data.topics[0] == iface.getEventTopic(iface.getEvent("ScheduledCall"))));
        
        if (event.length > 0) {
            let log = {
                topics: [event[0].event.data[0].topics[0].toString(), event[0].event.data[0].topics[1].toString(), event[0].event.data[0].topics[2].toString()], data: event[0].event.data[0].data.toString()
            };
            let decode_log = await iface.parseLog(log);

            schedulerTaskId = decode_log.args.task_id;

            await arbitrager.setTaskId(ethers.utils.hexlify(schedulerTaskId));
        } else {
            expect(false).to.not.be.ok;
        }

        await tokenAUSD.transfer(arbitrager.address, BigNumber.from(10).pow(13));
        await tokenDOT.transfer(arbitrager.address, BigNumber.from(10).pow(13));
        
        
        expect(await tokenAUSD.balanceOf(arbitrager.address)).to.equal(BigNumber.from(10).pow(13));
        expect(await tokenDOT.balanceOf(arbitrager.address)).to.equal(BigNumber.from(10).pow(13));
    });

    after(async () => {
        provider.api.disconnect();
    });

    const nextBlock = async () => {
        return new Promise((resolve) => {
            provider.api.tx.system.remark('').signAndSend(pair, (result) => {
                if (result.status.isInBlock) {
                    resolve(undefined);
                }
            });
        });
    }

    it("successfuly deploys the contract", () => {
        expect(arbitrager.address).to.be.properAddress;
    });

    it("correctly sets the global variables upon being deployed", async () => {
        const factoryAddress = await arbitrager.factory();
        const routerAddress = await arbitrager.router();
        const tokenAAddress = await arbitrager.tokenA();
        const tokenBAddress = await arbitrager.tokenB();
        const assignedPeriod = await arbitrager.period();

        expect(factoryAddress).to.equal(factory.address);
        expect(routerAddress).to.equal(router.address);
        expect(tokenAAddress).to.equal(tokenAUSD.address);
        expect(tokenBAddress).to.equal(tokenDOT.address);
        expect(assignedPeriod).to.equal(1);
    });

    it("sets the schedulerTaskId variable", async () => {
        expect(await arbitrager.schedulerTaskId()).to.equal(schedulerTaskId);
    });

    it("sets the initial period variable", async () => {
        expect(await arbitrager.period()).to.equal(1);
    });

    it("prohibits calling trigger() by anyone other than self", async () => {
        await expect(arbitrager.trigger({ from: wallet })).to.be.reverted;
    });

    it("buys AUSD if it is cheaper than DOT", async () => {
        await provider.api.tx.acalaOracle.feedValues([[{ Token: 'AUSD' }, 1000], [{ Token: 'DOT' }, 2000]]).signAndSend(pair);

        const initialBalanceAUSD = await await tokenAUSD.balanceOf(arbitrager.address);
        const initialBalanceDOT = await await tokenDOT.balanceOf(arbitrager.address);

        await nextBlock();
        await nextBlock();

        const balanceAUSD = await await tokenAUSD.balanceOf(arbitrager.address);
        const balanceDOT = await await tokenDOT.balanceOf(arbitrager.address);

        expect(balanceDOT).to.be.below(initialBalanceDOT);
        expect(balanceAUSD).to.be.above(initialBalanceAUSD);
    });

    it("buys DOT if it is cheaper than AUSD", async () => {
        await provider.api.tx.acalaOracle.feedValues([[{ Token: 'AUSD' }, 2000], [{ Token: 'DOT' }, 1000]]).signAndSend(pair);

        const initialBalanceAUSD = await await tokenAUSD.balanceOf(arbitrager.address);
        const initialBalanceDOT = await await tokenDOT.balanceOf(arbitrager.address);

        await nextBlock();
        await nextBlock();

        const balanceAUSD = await await tokenAUSD.balanceOf(arbitrager.address);
        const balanceDOT = await await tokenDOT.balanceOf(arbitrager.address);

        expect(balanceDOT).to.be.above(initialBalanceDOT);
        expect(balanceAUSD).to.be.below(initialBalanceAUSD);
    });

    it("schedules another trigger() call after trigger() is called", async () => {
        await provider.api.tx.acalaOracle.feedValues([[{ Token: 'AUSD' }, 1000], [{ Token: 'DOT' }, 2000]]).signAndSend(pair);

        await nextBlock();
        await nextBlock();

        const firstBalanceAUSD = await await tokenAUSD.balanceOf(arbitrager.address);

        await nextBlock();
        await nextBlock();

        const secondBalanceAUSD = await await tokenAUSD.balanceOf(arbitrager.address);

        expect(firstBalanceAUSD).not.to.be.equal(secondBalanceAUSD);
    });

    // it("reschedules trigger() call with Scheduler", async () => {
    //     expect(await arbitrager.rescheduleTriggerCall(2)).to.equal(true);

    //     expect(await arbitrager.period()).to.equal(2);
    // });

    // it("cancels trigger() call with Scheduler", async () => {
    //     expect(await arbitrager.cancelTriggerCall()).to.equal(true);

    //     expect(await arbitrager.schedulerTaskId()).to.be.empty;
    // });
});