pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract CryptoToFiat {
    
    using SafeMath for uint256;

    // Owner of the contract
    address public owner;

    // Configurable Parameters
    string public AGIPrice; // Price JSON
    uint256 public minBalance;
    uint256 public conversionUpperLimit; // Upper limit on the AGI conversion
    uint256 public txnLimitInBlocks; // Number of blocks to be wait between Transactions
    address public authorizer; // Authorizer address singing the conversion process

    // To store the last txn Block Number
    mapping(address => uint256) public lastTxnBlocks;

    // To store the total conversion amount
    mapping(address => uint256) public totalConvertedAmt;

    //Tokens which have been deposit into the contract
    mapping (address => uint256) public balances;
    
    // Address of token contract
    ERC20 public token;

    // Events
    event PriceUpdated(string price);
    event NewOwner(address owner);
    event ConfigurationUpdate(uint256 minBalance, uint256 conversionUpperLimit, uint256 txnLimitInBlocks);
    event DepositFunds(address indexed sender, uint256 amount);
    event WithdrawFunds(address indexed sender, uint256 amount);
    event TransferFunds(address indexed sender, address indexed receiver, uint256 amount);
    event ConvertFunds(address indexed sender, address indexed owner, uint256 amount);
    
    // Modifiers
    modifier onlyOwner() {
        require(
            msg.sender == owner,
            "Only owner can call this function."
        );
        _;
    }

    constructor (address _token)
    public
    {
        token = ERC20(_token);
        owner = msg.sender;
    }
  
    function deposit(uint256 value) 
    public
    returns(bool) 
    {
        require(token.transferFrom(msg.sender, this, value), "Unable to transfer token to the contract."); 
        balances[msg.sender] = balances[msg.sender].add(value);
        emit DepositFunds(msg.sender, value);
        return true;
    }
    
    function withdraw(uint256 value)
    public
    returns(bool)
    {
        require(balances[msg.sender] >= value, "Insufficient balance in the contract.");
        require(token.transfer(msg.sender, value), "Unable to transfer token from the contract.");
        balances[msg.sender] = balances[msg.sender].sub(value);
        emit WithdrawFunds(msg.sender, value);
        return true;
    }
    
    function transfer(address receiver, uint256 value)
    public
    returns(bool)
    {
        require(balances[msg.sender] >= value, "Insufficient balance in the contract");
        balances[msg.sender] = balances[msg.sender].sub(value);
        balances[receiver] = balances[receiver].add(value);

        emit TransferFunds(msg.sender, receiver, value);
        return true;
    }

    function initiateConversion(uint256 value, uint256 totalClaim, uint8 v, bytes32 r, bytes32 s)
    public
    returns(bool)
    {
        require(balances[msg.sender] >= value, "Insufficient balance in the contract");
        require(balances[msg.sender] >= value.add(minBalance), "Minimum balance to be maintained in the contract");
        require(value <= conversionUpperLimit, "Exceeding the conversion limit");
        require(lastTxnBlocks[msg.sender] <= block.number.sub(txnLimitInBlocks), "Exceeding the number of transactions in given time");
        require(totalConvertedAmt[msg.sender].add(value) <= totalClaim, "Exceeding the claims made so far");

        //compose the message which was signed
        bytes32 message = prefixed(keccak256(abi.encodePacked("__Conversion", this, msg.sender, totalClaim, lastTxnBlocks[msg.sender])));
        
        // check that the signature is from the authorizer
        address authAddress = ecrecover(message, v, r, s);
        require(authAddress == authorizer, "Invalid signature");

        balances[msg.sender] = balances[msg.sender].sub(value);
        balances[owner] = balances[owner].add(value);

        lastTxnBlocks[msg.sender] = block.number;
        totalConvertedAmt[msg.sender] = totalConvertedAmt[msg.sender].add(value);

        // This event is monitored to initiate the fiat transfer based on AGIPrice field
        emit ConvertFunds(msg.sender, owner, value); 
        return true;
    }


    function updateOwner(address _owner) public onlyOwner {
       owner = _owner;
       emit NewOwner(_owner);
    }

    function updatePrice(string memory _sPrice) public onlyOwner {
       AGIPrice = _sPrice;
       emit PriceUpdated(_sPrice);
    }

   function setConfigurations(address _authorizer, uint256 _minBalance, uint256 _conversionUpperLimit, uint256 _txnLimitInBlocks) public onlyOwner {
        authorizer = _authorizer;
        minBalance = _minBalance;
        conversionUpperLimit = _conversionUpperLimit;
        txnLimitInBlocks = _txnLimitInBlocks;
        emit ConfigurationUpdate(_minBalance, _conversionUpperLimit, _txnLimitInBlocks);
    }

    /// builds a prefixed hash to mimic the behavior of ethSign.
    function prefixed(bytes32 hash) internal pure returns (bytes32) 
    {
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash));
    }

}