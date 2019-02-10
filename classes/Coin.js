var Database = require('./Database'),
	Logger = require('./Logger'),
	Bittrex = require('./Bittrex'),
	mongoose = require('mongoose'),
	Models = require('../models/index'),
	Historical = require('./Historical'),
	Indicator = require('../classes/Indicator'),
	customIndicator = new Indicator,
	histRef = new Historical,
	tulind = require('tulind'),
	apiRef = new Bittrex,	
	log = new Logger,
	dbRef = new Database;

class Coin {
	
	constructor(market, tradePrice, globalTotal, iterationRate, sellOnly=false) {
		this.market = market;
		this.tradePrice = tradePrice;
		this.globalTotal = globalTotal;
		this.sellOnly = sellOnly;
		this.iterationRate = iterationRate
		this.live = false;
		//don't forget to switch cancelling open bittrex orders before turning this live
	}

	startChecks() {
		return new Promise((resolve, reject) => {
			dbRef.recordTick(this.market, false).then(() => {
				return dbRef.fetchActiveCoin(this.market.MarketName);
			//search for active coins
			}).then((coin) => {
				//if coin is found check to see if I should sell
				if(coin) {
					this.checkSell(coin).then((order) => {
						resolve(order);
					}).catch((err) => {
						log.logError("Failed in startChecks checkSell");
						reject(err);
					});
				} else {
					if(this.globalTotal >= this.tradePrice && !this.sellOnly) {
						this.checkBuy().then((order) => {
							resolve(order);
						}).catch((err) => {
							log.logError("Failed in startChecks checkBuy");
							reject(err);
						})
					} else resolve({ type: false });
				}
			}).catch((err) => {
				reject(err);
			});
		});
	}

	checkSell(activeCoin) {
		//active coin is coin in my db that I own
		//this.market is the current market coin
		return new Promise((resolve, reject) => {
			var refreshedMarket = this.market;
			apiRef.getMarketSummary(this.market.MarketName).then((updatedMarket) => {
				refreshedMarket = updatedMarket[0];
				return histRef.getPastHourlyValues(this.market.MarketName, 20000, 4);
			}).then((data) => {
				if(data.length) {
					var close = [],
						open = [],
						low = [],
						high = [],
						closingDates = [];
						for(var i=0;i<data.length;i++) {
							close.push(data[i].close);
							low.push(data[i].low);
							high.push(data[i].high);
							closingDates.push(data[i].utcTime);
							open.push(data[i].open);
						}
					var rsi = [];
					tulind.indicators.rsi.indicator([close], ['14'], (err, results) => {
						rsi = results[0];
					});
					var stochK = [],
						stochD = [];
					tulind.indicators.stoch.indicator([high, low, close], ['14', '13', '1'], (err, results) => {
						stochK = results[0];
						stochD = results[1];
					});
					var currentDate = new Date,
						tradeDate = new Date(activeCoin.utcTime * 1000)
					var timeMsDiff = currentDate - tradeDate,
						hourDiff = ((timeMsDiff/1000)/60)/60,
						profitPercent = ((refreshedMarket.Last/activeCoin.pricePer) * 100) - 100,
						stochCross = false;
					if(stochD[stochD.length - 1] >= 50) {
						if(stochK[stochD.length - 1] < stochD[stochD.length - 1] && stochK[(stochD.length - 1) - 1] > stochD[(stochD.length - 1) - 1] && profitPercent > 0) {
							stochCross = true;
						}
					}
					var dropTrade = false;
					if(hourDiff >= 18 && profitPercent > 1) {
						dropTrade = true;
					}
					if(stochCross) console.log("STOCH CROSS TRUE");
					console.log("CHECK SELL: ", this.market.MarketName, " ", profitPercent, "%");
					//predictedClose <= this.market.Last || hourDiff > 18 && activeCoin.pricePer < this.market.Last || activeCoin.pricePer < predictedClose || hourDiff > 164 && profitPercent < 10
					if(profitPercent > 5 || profitPercent < -15 || rsi[rsi.length - 1] >= 85 || stochCross || dropTrade) {
						console.log(this.market.MarketName, " @ " + refreshedMarket.Last);
						console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^SOLD^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
						//sell
						return this.sellOrder(activeCoin.pricePer, activeCoin.quantity);
					} else {
						//wait
						return Promise.resolve(false);
					}
				} else {
					return Promise.resolve(false);
				}
			}).then((sell) => {
				if(sell) {
					resolve({type: "sell", price: refreshedMarket.Bid * activeCoin.quantity});
				} else {
					resolve({type: false});
				}
			}).catch((err) => {
				reject(err);
			})
		});
	}

	checkBuy() {
		return new Promise((resolve, reject) => {
			var close = [],
				open = [],
				low = [],
				high = [],
				volume = [];

			//gather historical price data (as much as I have pretty much)
			histRef.getPastHourlyValues(this.market.MarketName, 20000, 4).then((data) => {
				if(data.length) {
					for(var i=0;i<data.length;i++) {
						close.push(data[i].close);
						low.push(data[i].low);
						high.push(data[i].high);
						open.push(data[i].open);
						volume.push(data[i].volume);
					}
					//retrieve logistic regression prediction
					return customIndicator.logReg(high, low, open, close, volume, this.market.Last);
				} else {
					return Promise.resolve(0);
				}
			}).then((predictedIncrease) => {
				//any extra indicator data
				var rsi = [];
				tulind.indicators.rsi.indicator([close], ['14'], (err, results) => {
					rsi = results[0];
				});
				//if buy
				if(predictedIncrease === 1) {
					console.log("ALMOST BOUGHT ", this.market.MarketName, " rsi:", rsi[rsi.length - 1]);
				}
				//if predictedIncrease is not 0 then log reg suggests a buy, use rsi indicator to confirm
				if(predictedIncrease > 0 && rsi[rsi.length - 1] > 50 && rsi[(rsi.length - 1) - 1] < 50 && rsi[rsi.length - 1] <= 75) {
					console.log(this.market.MarketName);
					console.log("^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^BOUGHT^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^");
					//buy
					return this.buyOrder();
				} else {
					return Promise.resolve(false);
				}
			}).then((buy) => {
				if(!buy) {
					resolve({type: false});
				} else {
					resolve({type: 'buy'});
				}
			}).catch((err) => {
				reject(err);
			})
		});
	}

	findBidAskOrder(type, marketName, quantity, rate, priceBought) {
		return new Promise((resolve, reject) => {
			getOrderBook().then((data) => {
				resolve(data);
			}).catch((err) => {
				reject(err);
			});
		});

		function getOrderBook() {
			var acceptableRates = [],
				lowestSellPercent = -3.5;
			if(type === "buy" && ((rate/priceBought) * 100) - 100 > 7) {
				lowestSellPercent = -4.5;
			}
			return new Promise((resolve, reject) => {
				apiRef.getOrderBook(marketName, type).then((data) => {
					var orders = data,
						foundRate = loopOrders(-0.1, orders);
					if(foundRate) {
						resolve(foundRate);
					} else {
						reject(false);
					}
				}).catch((err) => {
					reject(err);
				});
			});

			function loopOrders(percent, orders) {
				var foundRate = null;
				for(var i=0;i<orders.length;i++) {
					if(type === "buy") {
						var thisRate = ((orders[i].Rate/rate) - 1) * 100;
					} else {
						var thisRate = ((rate/orders[i].Rate) - 1) * 100;
					}
					if(orders[i].Quantity >= quantity && thisRate >= percent) {
						foundRate = orders[i].Rate;
					} else if(orders[i].Quantity >= quantity) {
						acceptableRates.push(orders[i].Rate);
					}
				}
				if(foundRate) {
					return foundRate;
				} else {
					if(percent <= lowestSellPercent) {
						acceptableRates.sort();
						var lowestPrice = acceptableRates[0];
						if(lowestPrice) {
							return lowestPrice;
						} else {
							return false;
						}
					} else {
						loopOrders(percent - 0.1, orders);
					}
				}
			}
		}
	}

	buyOrder() {
		return new Promise((resolve, reject) =>{
			var newRate = null,
				quantity = null;
			//get updated market stats (potentially been several minutes since grabbing initial getMarketSummaries from bittrex)
			apiRef.getMarketSummary(this.market.MarketName).then((refreshedMarket) => {
				//find best sell order matching requirements
				quantity = this.tradePrice/refreshedMarket[0].Ask;
				return this.findBidAskOrder("sell", this.market.MarketName, quantity, refreshedMarket[0].Ask);
			}).then((newPrice) => {
				//initiate buy if live
				newRate = newPrice;
				if(newRate) {
					if(this.live) {
						return apiRef.buyLimit(this.market.MarketName, quantity, newRate);
					} else {
						return new Promise((resolve) => { resolve(1); });
					}
				} else {
					return Promise.resolve(false);
				}
			}).then((uuid) => {
				//record order
				if(uuid) {
					var order = {
						marketName: this.market.MarketName,
						quantity: quantity,
						pricePer: newRate,
						orderType: "buy",
						total: newRate * quantity,
						uuid: uuid
					}
					return dbRef.createOpenOrder(order);
				} else {
					return Promise.resolve(false);
				}
			}).then((success) => {
				resolve(success);
			}).catch((err) => {
				console.log(err);
				resolve(false);
			});
		});
	}

	sellOrder(priceBought, quantity) {
		return new Promise((resolve, reject) =>{
			var newRate = null;
			apiRef.getMarketSummary(this.market.MarketName).then((refreshedMarket) => {
				return this.findBidAskOrder("buy", this.market.MarketName, quantity, refreshedMarket[0].Bid, priceBought);
			}).then((newPrice) => {
				newRate = newPrice;
				if(newRate) {
					if(this.live) {
						return apiRef.sellLimit(this.market.MarketName, quantity, newRate);
					} else {
						return new Promise((resolve) => { resolve(1); });
					}
				} else {
					return new Promise((resolve) => { resolve(false); });
				}
			}).then((uuid) => {
				if(uuid) {
					var order = {
						marketName: this.market.MarketName,
						quantity: quantity,
						pricePer: newRate,
						pricePerBought: priceBought,
						orderType: "sell",
						total: newRate * quantity,
						uuid: uuid
					}
					return dbRef.createOpenOrder(order);
				} else {
					return Promise.resolve(false);
				}
			}).then((success) => {
				resolve(success);
			}).catch((err) => {
				console.log(err);
				resolve(false);
			});
		});
	}
}

module.exports = Coin;