pragma solidity ^0.6.0;

abstract contract Scheduler {
    function scheduleCall(address contract_address, uint256 value, uint256 gas_limit, uint256 storage_limit, uint256 min_delay, bytes memory input_data) virtual public returns (uint256, uint256);
}