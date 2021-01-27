// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "./IOracle.sol";

contract Prices {
    IOracle oracle = IOracle(0x0000000000000000000000000000000000000807);

    function getPrice(address token) public view returns (uint256) {
        (uint256 price, uint256 timestamp) = oracle.getPrice(token);
        return price;
    }
}
