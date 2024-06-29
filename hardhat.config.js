require('dotenv').config();
require('@nomiclabs/hardhat-waffle');
require('@nomiclabs/hardhat-truffle5');
require("@nomiclabs/hardhat-etherscan");
require('hardhat-gas-reporter');
require('solidity-coverage');
require('@nomiclabs/hardhat-solhint');
require('hardhat-contract-sizer');
require('@openzeppelin/hardhat-upgrades');

const MAINNET_PRIVATE_KEY = process.env.MAINNET_PRIVATE_KEY;
const MAINNET_URL = process.env.MAINNET_URL;
const MAINNET_CHAINID = process.env.MAINNET_CHAINID *1;
const TESTNET_PRIVATE_KEY = process.env.TESTNET_PRIVATE_KEY;
const TESTNET_URL = process.env.TESTNET_URL;
const TESTNET_CHAINID = process.env.TESTNET_CHAINID *1;

module.exports = {
  solidity: {
    version: '0.8.21',
    settings: {
      optimizer: {
        enabled: true,
        runs: 5000,
      },
	  evmVersion : 'london'
    },
  },
  gasReporter: {
    currency: 'USD',
    enabled: false,
    gasPrice: 50,
  },
  networks: {
    mainnet: {
      url: MAINNET_URL,
      chainId: MAINNET_CHAINID,
      accounts: [`0x${MAINNET_PRIVATE_KEY}`]
    },
    testnet: {
      url: TESTNET_URL,
      chainId: TESTNET_CHAINID,
      accounts: [`0x${TESTNET_PRIVATE_KEY}`],
	  gasPrice: "auto"
    },
    coverage: {
      url: 'http://localhost:8555',
    },
    
    localhost: {
      url: `http://127.0.0.1:8545`
    },
  },
  etherscan: {
    apiKey: ''
  }
};
