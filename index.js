var Bittrex = require('./classes/bittrex'),
	Database = require('./classes/Database'),
	Logger = require('./classes/Logger'),
	Coin = require('./classes/Coin'),
	Bitcoin = require('./classes/Bitcoin'),
	Totals = require('./classes/Totals'),
	total = new Totals,
	globalBitcoin = new Bitcoin,
	async = require('async'),
	apiRef = new Bittrex,
	dbRef = new Database,
	log = new Logger,
	mongoose = require('mongoose');

//GLOBAL VARS
var globalBtcTotal = 0,
	usdToSpend = 2000,
	maxActiveCoins = 4, //maximum amount of active coins to hold
	activeCoinCount = 0, //amount of coins currently owned
	iterationRate = 60, //in minutes
	runtime = 24; //in hours

//set up db
mongoose.connect('mongodb://localhost:27017/bittrex-trader-v2', { useMongoClient: true });
mongoose.connection.on('connected', function() {
	console.log('\nmongoose connected\n');
	//get current bitcoin prices to set total to spend
	globalBitcoin.fetchCurrentPrice().then(() => {
		globalBtcTotal = globalBitcoin.calculateTotal(usdToSpend);
		console.log(`Starting Total: ${globalBtcTotal} BTC\n`);
		countdown();
	}).catch(() => {
		log.logError("Failed to set global total");
		applicationError("Failed to set global total");
	});
});

mongoose.connection.on('error', function(err) {
	console.log(err, "mongoose connection error");
});

mongoose.connection.on('disconnected', function() {
	console.log("mongoose disconnected error");
});

//will start 2 minutes after the hour, so all hourly data will be entered
function countdown() {
	var date = new Date;
	if(date.getMinutes()) {
		console.log("Starting....");
		loop();
	} else {
		setTimeout(function() {
			countdown();
		}, 10000);
	}
}

function loop(sellCheck) {
	dbRef.countActiveCoins().then((count) => {
		activeCoinCount = count;
		if(sellCheck) {
			if(count > 0) {
				start(true);
			}
		} else {
			if(count < maxActiveCoins) {
				start();
			} else {
				start(true);
			}
			setTimeout(() => {
				loop();
			}, iterationRate * 60000);
		}
	}).catch((err) => {
		applicationError(err);
	});
}

function start(sellOnly=false) {
	var bitcoin = new Bitcoin,
		btcPerTrade = null,
		dateStamp = new Date(),
		bittrexOrders = [];
	console.log("\nStarting Iteration " + dateStamp.getHours() + ":" + dateStamp.getMinutes() + ", " + (dateStamp.getMonth() + 1) + "/" + dateStamp.getDate() + "\n");
	//get current price of bitcoin
	bitcoin.fetchCurrentPrice().then((price) => {
		btcPerTrade = price;
		return apiRef.getOpenOrders();
	//get open orders from bittrex and my db
	}).then((orders) => {
		bittrexOrders = orders;
		return dbRef.getOpenOrders();
	//compare orders
	}).then((dbOrders) => {
		var openBittrexOrders = [],
			closedOrders = [];
		for(var i=0;i<dbOrders.length;i++) {
			for(var k=0;k<bittrexOrders.length;k++) {
				//if myOrder uuid is found in bittrexOrders, order is still active
				if(dbOrders[i].uuid === bittrexOrders[k].OrderUuid) {
					dbOrders[i].stillPlaced = true;
					openBittrexOrders.push(bittrexOrders[k]);
				}
			}
		}
		//orders without stillPlaced prop have been completed, compile array
		for(var i=0;i<dbOrders.length;i++) {
			if(!dbOrders[i].stillPlaced) {
				closedOrders.push(dbOrders[i]);
			} else {
				//correct globalBtcTotal balance if orders didn't go through
				if(dbOrders[i].orderType === "sell") {
					globalBtcTotal -= dbOrders[i].total;
				} else {
					globalBtcTotal += bitcoin.getTradePrice(); 
				}
			}
		}
		//cancel any open orders on bittrex, record any completed orders and delete current open orders in my db
		return new Promise((resolve, reject) => {
			async.parallel([
				(callback) => {
					/*
					if(openBittrexOrders.length > 0) {
						apiRef.clearOpenOrders().then(() => {
							callback();
						}).catch((err) => {
							callback(err);
						})
					} else callback();
					*/
					callback();
				},
				(callback) => {
					if(closedOrders.length) {
						dbRef.recordCompletedOrders(closedOrders).then(() => {
							callback();
						}).catch((err) => {
							callback(err);
						});
					} else callback();
				},
				(callback) => {
					dbRef.clearOpenOrders().then(() => {
						callback();
					}).catch((err) => {
						callback(err);
					})
				}
			], (err) => {
				if(err) {
					reject(err);
				} else resolve();
			});
		});
	}).then(() => {
		//fetch all active markets from bittrex
		return apiRef.getMarketSummaries();
	}).then((markets) => {

		//iterate through markets
		var btcMarkets = [];
		for(var i=0;i<markets.length;i++) {
			if(markets[i].MarketName.split('-')[0] === "BTC") {
				btcMarkets.push(markets[i]);
			}
		}

		//loop through all coins, check if buy or sell
		return new Promise((resolve, reject) => {
			coinLoop(0);
			function coinLoop(i) {
				var market = btcMarkets[i];
				//only get bitcoin markets
				var coinSellOnly = false;
				if(sellOnly || activeCoinCount >= maxActiveCoins) {
					coinSellOnly = true;
				}
				var coin = new Coin(market, btcPerTrade, globalBtcTotal, iterationRate, coinSellOnly);
				coin.startChecks().then((order) => {
					if(order.type === "buy") {
						globalBtcTotal -= bitcoin.getTradePrice();
						activeCoinCount += 1;
					} else if(order.type === "sell") {
						globalBtcTotal += order.price;
						activeCoinCount -= 1;
					}
				}).then(() => {
					startNewTimeout();
				}).catch((err) => {
					reject(err);
				});

				function startNewTimeout() {
					setTimeout(function() {
						if(i < btcMarkets.length - 1) {
							coinLoop(i + 1);
						} else {
							resolve();
						}
					}, 1);
				}
			}
		});
	}).then(() => {
		console.log("\n\nIteration Completed\nTotal BTC " + globalBtcTotal);
	}).catch((err) => {
		applicationError(err);
	});
}

function applicationError(err) {
	console.log(err);
	console.log("ERROR OCCURRED EXITING...");
	var exitMessage = `${err}\nError in script, SORRY :(`;
	process.exit(-1);
}