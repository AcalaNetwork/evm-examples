// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

abstract contract Oracle {
    function getPrice(uint256 currencyId) virtual public view returns (uint256, uint256);
}
