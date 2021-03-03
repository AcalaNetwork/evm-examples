pragma solidity ^0.6.0;

import "@acala-network/contracts/schedule/ISchedule.sol";
import "@acala-network/contracts/utils/Address.sol";

contract RecurringPayment is ADDRESS {
    uint period;
    uint remainingCount;
    uint amount;
    address payable to;
    ISchedule scheduler = ISchedule(ADDRESS.Schedule);

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
