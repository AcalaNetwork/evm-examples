pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Scheduler.sol";

contract RecurringTokenPayment {
    using SafeERC20 for IERC20;
    using SafeMath for uint;

    Scheduler constant scheduler = Scheduler(0x0000000000000000000000000000000000000902);

    function schedule(IERC20 _token, uint _period, uint _count, uint _amount, address _to) payable public {
        require(_count > 0, "invalid _count");
        _token.safeTransferFrom(msg.sender, address(this), _count.mul(_amount));
        
        scheduler.scheduleCall(address(this), 0, 50000, 100, _period, abi.encodeWithSignature("pay(address,uint256,uint256,uint256,address)", _token, _period, _count, _amount, _to));
    }

    function pay(IERC20 _token, uint _period, uint _count, uint _amount, address _to) public {
        require(msg.sender == address(this));

        _token.safeTransfer(_to, _amount);

        if (_count > 0) {
            scheduler.scheduleCall(address(this), 0, 50000, 100, _period, abi.encodeWithSignature("pay(address,uint256,uint256,uint256,address)", _token, _period, _count - 1, _amount, _to));
        }
    }
}
