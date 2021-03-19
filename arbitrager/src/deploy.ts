import { Contract, ContractFactory, BigNumber } from "ethers";
import ADDRESS from "@acala-network/contracts/utils/Address";

import UniswapFactory from "../artifacts/UniswapV2Factory.json";
import UniswapRouter from "../artifacts/UniswapV2Router02.json";
import Arbitrager from "../build/Arbitrager.json";
import IERC20 from "../artifacts/IERC20.json";
import setup from "./setup";

const main = async () => {
    const { wallet, provider, pair } = await setup();
    const deployerAddress = await wallet.getAddress();
    const tokenAUSD = new Contract(ADDRESS.AUSD, IERC20.abi, wallet);
    const tokenDOT = new Contract(ADDRESS.DOT, IERC20.abi, wallet);

    console.log('Deploy Uniswap');

    // deploy factory
    const factory = await ContractFactory.fromSolidity(UniswapFactory).connect(wallet).deploy(deployerAddress)

    // deploy router
    const router = await ContractFactory.fromSolidity(UniswapRouter).connect(wallet).deploy(factory.address, ADDRESS.ACA);

    console.log({
        factory: factory.address,
        router: router.address,
    })

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
    })

    console.log('Deploy Arbitrager');

    // deploy arbitrager, scheduled every 3 blocks
    
    const arbitrager = await ContractFactory.fromSolidity(Arbitrager).connect(wallet)
        .deploy(factory.address, router.address, ADDRESS.AUSD, ADDRESS.DOT, 1);

    await tokenAUSD.transfer(arbitrager.address, BigNumber.from(10).pow(13));
    await tokenDOT.transfer(arbitrager.address, BigNumber.from(10).pow(13));

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
    }

    await provider.api.tx.acalaOracle.feedValues([[{ Token: 'AUSD'}, 1000], [{ Token: 'DOT'}, 2000]]).signAndSend(pair);

    await printBalance();

    const nextBlock = async () => {
        return new Promise((resolve) => {
          provider.api.tx.system.remark('').signAndSend(pair, (result) => {
            if (result.status.isInBlock) {
              resolve(undefined);
            }
          });
        });
      }

    
    await nextBlock();
    await nextBlock();

    await printBalance();

    await nextBlock();
    await provider.api.tx.acalaOracle.feedValues([[{ Token: 'AUSD'}, 2000], [{ Token: 'DOT'}, 1000]]).signAndSend(pair);

    await printBalance();

    await nextBlock();
    await nextBlock();

    await printBalance();

    provider.api.disconnect();
}

main()
