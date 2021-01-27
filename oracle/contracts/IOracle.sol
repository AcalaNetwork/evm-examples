// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

interface IOracle {
    function getPrice(address token) external view returns (uint256, uint256);
}
