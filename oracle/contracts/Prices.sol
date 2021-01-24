// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "./Oracle.sol";

contract Prices {
    Oracle oracle = Oracle(0x0000000000000000000000000000000000000807);

    function getPrice(uint256 currencyId) public view returns (uint256) {
        (uint256 price, uint256 timestamp) = oracle.getPrice(currencyId);
        return price;
    }
}
