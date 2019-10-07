"use strict";
var  CryptoToFiat = artifacts.require("./CryptoToFiat.sol");

let Contract = require("truffle-contract");
let TokenAbi = require("singularitynet-token-contracts/abi/SingularityNetToken.json");
let TokenNetworks = require("singularitynet-token-contracts/networks/SingularityNetToken.json");
let TokenBytecode = require("singularitynet-token-contracts/bytecode/SingularityNetToken.json");
let Token = Contract({contractName: "SingularityNetToken", abi: TokenAbi, networks: TokenNetworks, bytecode: TokenBytecode});
Token.setProvider(web3.currentProvider);

var ethereumjsabi  = require('ethereumjs-abi');
var ethereumjsutil = require('ethereumjs-util');
let signFuns       = require('./sign_funs');

async function testErrorRevert(prom)
{
    let rezE = -1
    try { await prom }
    catch(e) {
        rezE = e.message.indexOf('revert') 
    }
    assert(rezE >= 0, "Must generate error and error message must contain revert");
}
  
contract('CryptoToFiat', function(accounts) {

    var cryptoToFiat;
    var tokenAddress;
    var token;

    let GAmt = 10000000;
    let N1 = 42000
    let N2 = 420000
    let N3 = 42
     
    before(async () => 
    {
        cryptoToFiat      = await CryptoToFiat.deployed();
        tokenAddress  = await cryptoToFiat.token.call();
        token         = Token.at(tokenAddress);
    });

    const mineBlocks = async(numOfBlocks) => {
        for(var i=0; i<= numOfBlocks; i++) {
            await token.approve(cryptoToFiat.address,GAmt+i+1, {from:accounts[0]}); 
        }
    };

    it ("Initial Deposit Withdraw and Transfer Test Cases", async function()
    { 
       //Deposit 42000 from accounts[0]
        await token.approve(cryptoToFiat.address,N1, {from:accounts[0]});
        await cryptoToFiat.deposit(N1, {from:accounts[0]});
        assert.equal((await cryptoToFiat.balances.call(accounts[0])).toNumber(), N1)

        //Deposit 420000 from accounts[4] (frist we need transfert from a[0] to a[4])
        await token.transfer(accounts[4],  N2, {from:accounts[0]});
        await token.approve(cryptoToFiat.address,N2, {from:accounts[4]}); 
        await cryptoToFiat.deposit(N2, {from:accounts[4]});
        
        assert.equal((await cryptoToFiat.balances.call(accounts[4])).toNumber(), N2)

        assert.equal((await token.balanceOf(cryptoToFiat.address)).toNumber(), N1 + N2)
       
        //try to withdraw more than we have
        await testErrorRevert(cryptoToFiat.withdraw(N2 + 1, {from:accounts[4]}))
        
        cryptoToFiat.withdraw(N3, {from:accounts[4]})
        assert.equal((await cryptoToFiat.balances.call(accounts[4])).toNumber(), N2 - N3)
        assert.equal((await token.balanceOf(cryptoToFiat.address)).toNumber(), N1 + N2 - N3)
        assert.equal((await token.balanceOf(accounts[4])).toNumber(), N3)

        // Check for the Transfer Function
        await token.transfer(accounts[8],  N2, {from:accounts[0]});
        await token.approve(cryptoToFiat.address,N2, {from:accounts[8]});
        await cryptoToFiat.deposit(N2, {from:accounts[8]});
        cryptoToFiat.transfer(accounts[9], N1, {from:accounts[8]} );
        assert.equal((await cryptoToFiat.balances.call(accounts[8])).toNumber(), N2 - N1)
        assert.equal((await cryptoToFiat.balances.call(accounts[9])).toNumber(), N1)

        // Transferring back to a[0] to make the remaining functions in tact
        cryptoToFiat.withdraw(N2 - N1, {from:accounts[8]})
        cryptoToFiat.withdraw(N1, {from:accounts[9]})
        await token.transfer(accounts[0],  N2 - N1, {from:accounts[8]});
        await token.transfer(accounts[0],  N1, {from:accounts[9]});

    }); 

    it ("Test Set Price for AGI", async function()
        { 
            var price = {
                "USD": 10,
                "EURO": 8,
                "ETH": 0.001
            }

            // Check for the Price Update
            await cryptoToFiat.updatePrice(JSON.stringify(price), {from:accounts[0]});
            let newPrice = await cryptoToFiat.AGIPrice.call()
            assert.equal(newPrice, JSON.stringify(price))

        }); 

    it ("Update Owner Test Case", async function()
    { 
        var newOwner = accounts[1];
        // Update the contract owner
        await cryptoToFiat.updateOwner(newOwner, {from:accounts[0]});
        let owner = await cryptoToFiat.owner.call();
        assert.equal(newOwner, owner)
    });

    it ("Only Owner Update Price Test", async function()
    { 
        var price = {
            "USD": 10,
            "EURO": 8,
            "ETH": 0.001
        }
        // Check for the Price Update by Non Owner
        testErrorRevert( cryptoToFiat.updatePrice(JSON.stringify(price), {from:accounts[0]}));

    });

    it ("Only Owner can change the contract owner Test", async function()
    { 
        var newOwner = accounts[0];
        // Update the Owner called by non-owner
        testErrorRevert(cryptoToFiat.updateOwner(newOwner, {from:accounts[0]}));
    });

    it ("Update configuration Test Case", async function()
    { 
        // Current Owner is accounts[1]
        let _minBalance = 1000
        let _conversionUpperLimit = 100
        let _txnLimitInBlocks = 9
        let _authorizer = accounts[9];

        await cryptoToFiat.setConfigurations(_authorizer, _minBalance, _conversionUpperLimit, _txnLimitInBlocks, {from:accounts[1]});
        
        let authorizer = await cryptoToFiat.authorizer.call();
        let minBalance = await cryptoToFiat.minBalance.call();
        let conversionUpperLimit = await cryptoToFiat.conversionUpperLimit.call();
        let txnLimitInBlocks = await cryptoToFiat.txnLimitInBlocks.call();

        assert.equal(_authorizer, authorizer)
        assert.equal(_minBalance, minBalance);
        assert.equal(_conversionUpperLimit, conversionUpperLimit);
        assert.equal(_txnLimitInBlocks, txnLimitInBlocks);
    });

    it ("Update configuration Test Case Only By Owner", async function()
    { 
        // Current Owner is accounts[1]
        let _minBalance = 1000
        let _conversionUpperLimit = 100
        let _txnLimitInBlocks = 9
        testErrorRevert(cryptoToFiat.setConfigurations(_minBalance, _conversionUpperLimit, _txnLimitInBlocks, {from:accounts[0]}));

    });

    it ("Initiate Conversion Test Cases", async function()
    { 
        let _conversionUpperLimit = 100
        let depositAmount = 1200
        var sender = accounts[5]
        var totalClaim = 10000
        var lastTxnBlockNumber = 0
        await token.transfer(accounts[5], depositAmount, {from:accounts[0]});
        await token.approve(cryptoToFiat.address, depositAmount , {from:accounts[5]}); 
        await cryptoToFiat.deposit(depositAmount, {from:accounts[5]});

        assert.equal((await cryptoToFiat.balances.call(accounts[5])).toNumber(), depositAmount)

        //Create the signature
        sender = accounts[5]
        let authorizer = await cryptoToFiat.authorizer.call();

        // Test to convert full balance - should not allow
        lastTxnBlockNumber = (await cryptoToFiat.lastTxnBlocks.call(sender)).toNumber();
        let sgn = await signFuns.waitSignedInitiateConversionMessage(accounts[9], cryptoToFiat.address, sender, totalClaim, lastTxnBlockNumber);        
        let vrs = signFuns.getVRSFromSignature(sgn.toString("hex"));
        
        testErrorRevert(cryptoToFiat.initiateConversion(depositAmount, totalClaim, vrs.v, vrs.r, vrs.s, {from:accounts[5]}));

        // Test to convert more than balance amount
        lastTxnBlockNumber = (await cryptoToFiat.lastTxnBlocks.call(sender)).toNumber();
        sgn = await signFuns.waitSignedInitiateConversionMessage(accounts[9], cryptoToFiat.address, sender, totalClaim, lastTxnBlockNumber);        
        vrs = signFuns.getVRSFromSignature(sgn.toString("hex"));
        testErrorRevert(cryptoToFiat.initiateConversion(depositAmount+1, totalClaim, vrs.v, vrs.r, vrs.s, {from:accounts[5]}));
        // Initiate the Conversion
        var conversionAmount = 80
        var a5_balance_b = (await cryptoToFiat.balances.call(accounts[5])).toNumber();
        var a1_balance_b = (await cryptoToFiat.balances.call(accounts[1])).toNumber();
        lastTxnBlockNumber = (await cryptoToFiat.lastTxnBlocks.call(sender)).toNumber();
        sgn = await signFuns.waitSignedInitiateConversionMessage(accounts[9], cryptoToFiat.address, sender, totalClaim, lastTxnBlockNumber);        
        vrs = signFuns.getVRSFromSignature(sgn.toString("hex"));
        await cryptoToFiat.initiateConversion(conversionAmount, totalClaim, vrs.v, vrs.r, vrs.s, {from:accounts[5]})
        var a5_balance_a = (await cryptoToFiat.balances.call(accounts[5])).toNumber();
        var a1_balance_a = (await cryptoToFiat.balances.call(accounts[1])).toNumber();

        assert.equal(a5_balance_a, a5_balance_b - conversionAmount)
        assert.equal(a1_balance_a, a1_balance_b + conversionAmount)

        // Test to convert immediately in the next txn
        lastTxnBlockNumber = (await cryptoToFiat.lastTxnBlocks.call(sender)).toNumber();
        sgn = await signFuns.waitSignedInitiateConversionMessage(accounts[9], cryptoToFiat.address, sender, totalClaim, lastTxnBlockNumber);        
        vrs = signFuns.getVRSFromSignature(sgn.toString("hex"));
        testErrorRevert(cryptoToFiat.initiateConversion(conversionAmount, totalClaim, vrs.v, vrs.r, vrs.s, {from:accounts[5]}));

        // Create Dummy Blocks to test after the min txn blocks
        let _txnLimitInBlocks = 9
        await mineBlocks(_txnLimitInBlocks);

        // Test to withdraw more than the Upper Limit for Txn
        lastTxnBlockNumber = (await cryptoToFiat.lastTxnBlocks.call(sender)).toNumber();
        sgn = await signFuns.waitSignedInitiateConversionMessage(accounts[9], cryptoToFiat.address, sender, totalClaim, lastTxnBlockNumber);        
        vrs = signFuns.getVRSFromSignature(sgn.toString("hex"));
        testErrorRevert(cryptoToFiat.initiateConversion(_conversionUpperLimit+1, totalClaim, vrs.v, vrs.r, vrs.s, {from:accounts[5]}));

        conversionAmount = 60
        a5_balance_b = (await cryptoToFiat.balances.call(accounts[5])).toNumber();
        a1_balance_b = (await cryptoToFiat.balances.call(accounts[1])).toNumber();

        lastTxnBlockNumber = (await cryptoToFiat.lastTxnBlocks.call(sender)).toNumber();
        sgn = await signFuns.waitSignedInitiateConversionMessage(accounts[9], cryptoToFiat.address, sender, totalClaim, lastTxnBlockNumber);        
        vrs = signFuns.getVRSFromSignature(sgn.toString("hex"));
        await cryptoToFiat.initiateConversion(conversionAmount, totalClaim, vrs.v, vrs.r, vrs.s, {from:accounts[5]})

        a5_balance_a = (await cryptoToFiat.balances.call(accounts[5])).toNumber();
        a1_balance_a = (await cryptoToFiat.balances.call(accounts[1])).toNumber();

        assert.equal(a5_balance_a, a5_balance_b - conversionAmount)
        assert.equal(a1_balance_a, a1_balance_b + conversionAmount)

        // TODO Need to add Negative Test Case of Signature Validation

    });

});
