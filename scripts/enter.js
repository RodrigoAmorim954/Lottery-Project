const { ethers } = require("hardhat")

async function enterLottery() {
    const lottery = await ethers.getContract("Lottery")
    const lotteryEntranceFee = await lottery.getEntranceFee()
    await lottery.enterLottery({ value: lotteryEntranceFee + 1 })
    console.log("entered!")
}

enterLottery()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
