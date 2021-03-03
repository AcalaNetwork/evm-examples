// SPDX-License-Identifier: MIT
pragma solidity ^0.6.0;

import "@acala-network/contracts/oracle/IOracle.sol";
import "@acala-network/contracts/utils/Address.sol";

contract Prices is ADDRESS {
    IOracle oracle = IOracle(ADDRESS.Oracle);

    function getPrice(address token) public view returns (uint256) {
        (uint256 price, uint256 timestamp) = oracle.getPrice(token);
        return price;
    }
}
