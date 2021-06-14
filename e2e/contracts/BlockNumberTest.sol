pragma solidity ^0.6.0;

contract BlcokNumberTest {
    function currentBlock() public view  returns(uint) {
        return block.number;
    }
}
