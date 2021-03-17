import { Contract, BigNumber } from "ethers";
import UniswapFactory from "../artifacts/UniswapV2Factory.json";
import UniswapRouter from "../artifacts/UniswapV2Router02.json";
import IERC20 from "../artifacts/IERC20.json";
import setup from "./setup";
import ADDRESS from "@acala-network/contracts/utils/Address";

const ROUTER_ADDRESS = "0x16704f5E329c86c8C31fEf2d363d795D6CAc5d01";

const dollar = BigNumber.from('1000000000000000000');

const main = async () => {
    const { wallet, provider } = await setup();
    const deployerAddress = await wallet.getAddress();
    const tokenACA = new Contract(ADDRESS.ACA, IERC20.abi, wallet);
    const tokenDOT = new Contract(ADDRESS.DOT, IERC20.abi, wallet);
    
    const router = new Contract(ROUTER_ADDRESS, UniswapRouter.abi, wallet);
    const factory = new Contract(await router.factory(), UniswapFactory.abi, wallet);
    
    // approve
    await tokenACA.approve(router.address, dollar.mul(100));
    await tokenDOT.approve(router.address, dollar.mul(100));

    const tradingPairAddress = await factory.getPair(ADDRESS.ACA, ADDRESS.DOT);
    let lpAcaAmount = await tokenACA.balanceOf(tradingPairAddress);
    let lpDotAmount = await tokenDOT.balanceOf(tradingPairAddress);
    const acaAmountBefore = await tokenACA.balanceOf(deployerAddress)
    const dotAmountBefore = await tokenDOT.balanceOf(deployerAddress)

    // before

    console.log('------ before -------')
    console.log({
        acaAmountBefore: acaAmountBefore.toString(),
        dotAmountBefore: dotAmountBefore.toString(),
        liquidityPoolAcaAmount: lpAcaAmount.toString(),
        liquidityPoolDotAmount: lpDotAmount.toString(),
    });

    // trade

    const path = [ADDRESS.DOT, ADDRESS.ACA];
    const buyAmount = BigNumber.from('100000000000');

    console.log('------ trade -------')
    console.log('Trade', {
        path,
        buyAmount: buyAmount.toString(),
    })
    
    await router.swapExactTokensForTokens(buyAmount, 0, path, deployerAddress, 10000000000);

    // check
    
    const tradingPair = new Contract(tradingPairAddress, IERC20.abi, wallet);
    const lpTokenAmount = await tradingPair.balanceOf(deployerAddress);
    lpAcaAmount = await tokenACA.balanceOf(tradingPairAddress);
    lpDotAmount = await tokenDOT.balanceOf(tradingPairAddress);
    const acaAmountAfter = await tokenACA.balanceOf(deployerAddress);
    const dotAmountAfter = await tokenDOT.balanceOf(deployerAddress);
    
    console.log('------ after -------')
    console.log({
        acaAmountAfter: acaAmountAfter.toString(),
        lpTokenAmount: lpTokenAmount.toString(),
        liquidityPoolAcaAmount: lpAcaAmount.toString(),
        liquidityPoolDotAmount: lpDotAmount.toString(),
        dotAmountAfter: dotAmountAfter.toString(),
    });

    provider.api.disconnect();
}

main()
