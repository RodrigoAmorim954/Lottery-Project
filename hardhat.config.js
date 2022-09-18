require("@nomiclabs/hardhat-waffle")
require("@nomiclabs/hardhat-etherscan")
require("hardhat-deploy")
require("solidity-coverage")
require("hardhat-gas-reporter")
require("hardhat-contract-sizer")
require("dotenv").config()

const GOERLI_URL_RPC = process.env.GOERLI_URL_RPC
const PRIVATE_KEY = process.env.PRIVATE_KEY
const ETHERSCAN_URL = process.env.ETHERSCAN_URL
const COINMARKETCAP_API = process.env.COINMARKETCAP_API

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
        },
        localhost: {
            chainId: 31337,
        },
        goerli: {
            chainId: 5,
            blockConfirmations: 6,
            url: GOERLI_URL_RPC,
            accounts: [PRIVATE_KEY],
        },
    },
    solidity: "0.8.7",
    namedAccounts: {
        deployer: {
            default: 0,
        },
        player: {
            default: 1,
        },
    },
    gasReporter: {
        enabled: false,
        currency: "USD",
        outputFile: "gas-reporter.txt",
        noColors: true,
    },
    mocha: {
        timeout: 500000,
    },
    etherscan: {
        apiKey: {
            goerli: ETHERSCAN_URL,
        },
    },
    contractSizer: {
        runOnCompile: false,
        only: ["Raffle"],
    },
}
