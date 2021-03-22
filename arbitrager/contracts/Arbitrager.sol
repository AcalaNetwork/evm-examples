// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import '@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router01.sol';
import '@uniswap/v2-periphery/contracts/libraries/UniswapV2Library.sol';

import "@acala-network/contracts/oracle/IOracle.sol";
import "@acala-network/contracts/schedule/ISchedule.sol";
import "@acala-network/contracts/utils/Address.sol";

contract Arbitrager is ADDRESS {
    address public immutable factory;
    IUniswapV2Router01 public immutable router;
    IERC20 public immutable tokenA;
    IERC20 public immutable tokenB;
    uint256 public immutable period;

    uint256 constant MAX_INT = uint256(-1);

    constructor(address factory_, IUniswapV2Router01 router_, IERC20 tokenA_, IERC20 tokenB_, uint period_) public {
        factory = factory_;
        router = router_;
        tokenA = tokenA_;
        tokenB = tokenB_;
        period = period_;

        tokenA_.approve(address(router_), MAX_INT);
        tokenB_.approve(address(router_), MAX_INT);

        ISchedule(ADDRESS.Schedule).scheduleCall(address(this), 0, 1000000, 5000, period_, abi.encodeWithSignature("trigger()"));
    }

    function trigger() public {
        require(msg.sender == address(this));
        ISchedule(ADDRESS.Schedule).scheduleCall(address(this), 0, 1000000, 5000, period, abi.encodeWithSignature("trigger()"));

        uint256 priceA = IOracle(ADDRESS.Oracle).getPrice(address(tokenA));
        uint256 priceB = IOracle(ADDRESS.Oracle).getPrice(address(tokenB));

        uint256 balA = tokenA.balanceOf(address(this));
        uint256 balB = tokenB.balanceOf(address(this));

        (uint256 reserveA, uint256 reserveB) = UniswapV2Library.getReserves(factory, address(tokenA), address(tokenB));

        bool buyA;
        if (reserveA > reserveB) {
            uint256 price1 = reserveA * 1000 / reserveB;
            uint256 price2 = priceA * 1000 / priceB;
            buyA = price1 < price2;
        } else {
            uint256 price1 = reserveB * 1000 / reserveA;
            uint256 price2 = priceB * 1000 / priceA;
            buyA = price1 > price2;
        }

        uint256 amount;
        address[] memory path = new address[](2);
        if (buyA) {
            amount = balB / 10;
            path[0] = address(tokenB);
            path[1] = address(tokenA);
        } else {
            amount = balA / 10;
            path[0] = address(tokenA);
            path[1] = address(tokenB);
        }

        if (amount != 0) {
            router.swapExactTokensForTokens(
                amount,
                0,
                path,
                address(this),
                now + 1
            );
        }
    }
}
