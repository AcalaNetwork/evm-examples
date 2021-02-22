pragma solidity ^0.6.0;

import "./Scheduler.sol";

contract RecurringPayment {
    uint period;
    uint remainingCount;
    uint amount;
    address payable to;
    Scheduler constant scheduler = Scheduler(0x0000000000000000000000000000000000000802);

    constructor(uint _period, uint _count, uint _amount, address payable _to) public payable {
        require(msg.value >= _count * _amount);

        period = _period;
        remainingCount = _count;
        amount = _amount;
        to = _to;

        scheduler.scheduleCall(address(this), 0, 50000, 100, _period, abi.encodeWithSignature("pay()"));
    }

    function pay() public {
        require(msg.sender == address(this));

        if (remainingCount == 1) {
            selfdestruct(to);
        } else {
            to.transfer(amount);
            
            remainingCount--;
            scheduler.scheduleCall(address(this), 0, 50000, 100, period, abi.encodeWithSignature("pay()"));
        }
    }
}
