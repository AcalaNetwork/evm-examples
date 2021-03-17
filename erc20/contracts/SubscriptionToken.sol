pragma solidity ^0.6.0;

import "./Scheduler.sol";

contract SubscriptionToken {
    uint period;
    address[] subscribers;
    mapping(address => uint) public balanceOf;
    Scheduler scheduler;

    constructor(uint _period, address scheduler_address) public payable {
        period = _period;
        scheduler = Scheduler(scheduler_address);
        scheduler.scheduleCall(address(this), 0, 50000, 100, period, abi.encodeWithSignature("paySubscribers()"));
    }

    function subscribe() public {
        subscribers.push(msg.sender);
    }

    function transfer(address _to, uint amount) public {
        require(balanceOf[msg.sender] > amount -1, "Insuffcient funds");
        balanceOf[msg.sender] -= amount;
        balanceOf[_to] += amount;
    }

    function paySubscribers() public {
        require(msg.sender == address(this));
        if (subscribers.length > 0) {
            for (uint256 i = 0; i < subscribers.length; i++) {
                address subscriber = subscribers[i];
                balanceOf[subscriber] += 1;
            }
        }
        
        scheduler.scheduleCall(address(this), 0, 50000, 100, period, abi.encodeWithSignature("paySubscribers()"));
    }
}