const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, ethers, network } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Lottery Unit Test", async () => {
          let lottery, vrfCoordinatorV2Mock, lotteryEntranceFee, deployer, interval
          const chainId = network.config.chainId

          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer // c
              await deployments.fixture(["all"]) // deploy modules with the tag all includes mocks and lottery
              lottery = await ethers.getContract("Lottery", deployer) // returns a new connection to the raffle contract
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer) // returns a new connection to the VRFCoordinatorV2Mock contract
              lotteryEntranceFee = await lottery.getEntranceFee()
              interval = await lottery.getInterval()
          })

          describe("constructor", function () {
              it("initializes the lottery correctly", async () => {
                  // ideally we make our tesst have just 1 assert per "it"
                  // and ideally, we'd make this check everything
                  const lotteryState = await lottery.getLotteryState()
                  // comparisons for Lottery initialization
                  assert.equal(lotteryState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
          })

          describe("enterLottery", () => {
              it("reverts when don't you pay enough", async () => {
                  await expect(lottery.enterLottery()).to.be.revertedWith(
                      // is reverted when not paid enough or lottery is not open
                      "Lottery__NotEnoughETHEntered"
                  )
              })
              it("records player when they enter", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  const playerFromContract = await lottery.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })

              it("emits event on enter", async () => {
                  await expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.emit(
                      // emits LotteryEnter event if entered to index players(s) address
                      lottery,
                      "LotteryEnter"
                  )
              })

              it("doesn't allow entrance when lottery is calculating", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  // for a documentation of the methods below, go here: www.hardhat.org/hardhat-network/reference
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.request({ method: "evm_mine", params: [] })
                  // we pretend to be a keeper for a second
                  await lottery.performUpkeep([]) // changes the state to calculating for our comparison below
                  await expect(
                      lottery.enterLottery({ value: lotteryEntranceFee })
                  ).to.be.revertedWith("Lottery__NotOpen") // is reverted as lottery is calculating
              })
          })

          describe("checkUpkeep", () => {
              it("returns false if people haven't sent any ETH", async () => {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upKeepNeeded } = await lottery.callStatic.checkUpkeep([]) // upkeedNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upKeepNeeded)
              })

              it("returns false if lottery isn't open", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await lottery.performUpkeep("0x") // changes the state to calculating
                  const lotteryState = await lottery.getLotteryState() // stores the new state
                  const { upKeepNeeded } = await lottery.callStatic.checkUpkeep("0x")
                  assert.equal(lotteryState.toString(), "1")
                  assert.equal(upKeepNeeded, false)
              })

              it("returns false if enough time hasn't passed", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]) // use a higher number here if this test fails
                  await network.provider.send("evm_mine", [])
                  const { upKeepNeeded } = await lottery.callStatic.checkUpkeep([])
                  assert(!upKeepNeeded)
              })

              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upKeepNeeded } = await lottery.callStatic.checkUpkeep([])
                  assert(upKeepNeeded)
              })
          })

          describe("performUpkeep", () => {
              it("can only run if checkupkeep is true", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  tx = await lottery.performUpkeep([])
                  assert(tx)
              })

              it("reverts if chekup is false", async () => {
                  await expect(lottery.performUpkeep([])).to.be.revertedWith(
                      "Lottery__UpKeepNotNeeded"
                  )
              })

              it("updates the raffle state and emits a requestId", async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const txResponse = await lottery.performUpkeep([]) // emit requestId
                  const txReceipt = await txResponse.wait(1) // waits 1 block
                  const lotteryState = await lottery.getLotteryState() // update state
                  const requestId = await txReceipt.events[1].args.requestId
                  assert(lotteryState.toString(), "1")
                  assert(requestId.toNumber() > 0)
              })
          })

          describe("fulfillRandomWords", () => {
              beforeEach(async () => {
                  await lottery.enterLottery({ value: lotteryEntranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })

              it("can only be called after perforupKeep", async () => {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address) // reverted if not fulffiled
                  ).to.be.revertedWith("nonexistent request")
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address) // reverted if not fulffiled
                  ).to.be.revertedWith("nonexistent request")
              })

              // this test is too big...
              // This test simulates users entering the lottery and wraps the entire functionality of the lottery
              // inside a promise that will resolve if everything is successful.
              // an event listener for the WinnerPicked is set up
              // Mocks of chainlink keepers and vrf coordinator are used to kickoff this winnerPicked event
              // all the assertions are donce once the WinnerPicked event is fired

              it("picks a winner, resets, and send money", async () => {
                  const additionalEntrances = 3 // to test
                  const startingIndex = 1
                  const accounts = await ethers.getSigners()

                  for (let i = 1; i < startingIndex + additionalEntrances; i++) {
                      // starting with 1 because 0 is our deployer
                      const accountConnectedLottery = lottery.connect(accounts[i]) // returns a new instace of the lottery contract connected to player
                      await accountConnectedLottery.enterLottery({ value: lotteryEntranceFee })
                  }
                  const startingTimeStamp = await lottery.getLatestTimeStamp() // stores starting timestamp (before we fire our event)

                  // this will be more important for our staging test...
                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!")
                          // assert throws an error if it fails, so we need to wrap
                          // it in a try/catch so that the promise returns event
                          // if it fails
                          try {
                              // Now lets get the ending values
                              const recentWinner = await lottery.getRecentWinner()
                              const lotteryState = await lottery.getLotteryState()
                              const endingTimeStamp = await lottery.getLatestTimeStamp()
                              const numPlayers = await lottery.getNumberOfPlayers()
                              const winnerEndingBalance = await accounts[1].getBalance()

                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(lotteryState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)

                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance
                                      .add(
                                          lotteryEntranceFee
                                              .mul(additionalEntrances)
                                              .add(lotteryEntranceFee)
                                      )
                                      .toString()
                              )
                              resolve() // if try passes, resolves the promise
                          } catch (e) {
                              reject(e) // if try fails, rejects the promise
                          }
                      })

                      // kicking off the event by mocking the chainlink keepers and vrf coordinator
                      const tx = await lottery.performUpkeep("0x")
                      const txReceipt = await tx.wait(1)
                      const winnerStartingBalance = await accounts[1].getBalance()
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          lottery.address
                      )
                  })
              })
          })
      })
