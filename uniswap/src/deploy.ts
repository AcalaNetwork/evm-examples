import { Contract, ContractFactory, BigNumber } from "ethers";
import UniswapFactory from "../artifacts/UniswapV2Factory.json";
import UniswapRouter from "../artifacts/UniswapV2Router02.json";
import IERC20 from "../artifacts/IERC20.json";
import setup from "./setup";
import ADDRESS from "@acala-network/contracts/utils/Address";

const dollar = BigNumber.from('10000000000000');

const main = async () => {
    const { wallet, provider } = await setup();
    const deployerAddress = await wallet.getAddress();
    const tokenACA = new Contract(ADDRESS.ACA, IERC20.abi, wallet);
    const tokenDOT = new Contract(ADDRESS.DOT, IERC20.abi, wallet);

    // deploy factory
    const factory = await ContractFactory.fromSolidity(UniswapFactory).connect(wallet).deploy(deployerAddress)

    // deploy router
    const router = await ContractFactory.fromSolidity(UniswapRouter).connect(wallet).deploy(factory.address, ADDRESS.ACA);

    console.log('Deploy done')
    console.log({
        factory: factory.address,
        router: router.address,
    })

    // approve
    await tokenACA.approve(router.address, dollar.mul(100));
    await tokenDOT.approve(router.address, dollar.mul(100));

    // add liquidity
    await router.addLiquidity(ADDRESS.ACA, ADDRESS.DOT, dollar.mul(2), dollar, 0, 0, deployerAddress, 10000000000);

    // check
    const tradingPairAddress = await factory.getPair(ADDRESS.ACA, ADDRESS.DOT);
    const tradingPair = new Contract(tradingPairAddress, IERC20.abi, wallet);
    const lpTokenAmount = await tradingPair.balanceOf(deployerAddress);
    const acaAmount = await tokenACA.balanceOf(tradingPairAddress);
    const dotAmount = await tokenDOT.balanceOf(tradingPairAddress);
    
    console.log({
        tradingPair: tradingPairAddress,
        lpTokenAmount: lpTokenAmount.toString(),
        liquidityPoolAcaAmount: acaAmount.toString(),
        liquidityPoolDotAmount: dotAmount.toString(),
    })

    provider.api.disconnect();
}

main()
