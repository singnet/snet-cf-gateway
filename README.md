# SNET-CF-Gateway Contracts

[![CircleCI](https://circleci.com/gh/singnet/platform-contracts.svg?style=svg)](https://circleci.com/gh/singnet/SNET-CF-Gateway-Contracts)

Includes SingularityNET Crypto to Fiat contracts, migrations, tests

## Contracts

### CryptoToFiat
* Contract that maintains a Crypto to fiat conversion for Service Providers and AI Developers. Consumers can use this service to convert the AGI received as part if their services utilization.

## Requirements
* [Node.js](https://github.com/nodejs/node) (8+)
* [Npm](https://www.npmjs.com/package/npm)

## Install

### Dependencies
```bash
npm install
```

### Compile 
```bash
truffle compile
```

### Test 
```bash
truffle test
```

## Package
```bash
npm run package-npm
```

## Release
Contract build artifacts are published to NPM: COMING SOON
