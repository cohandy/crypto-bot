var mongoose = require('mongoose'),
	Models = require('../models/index'),
	Logger = require('./Logger'),
	log = new Logger,
	async = require('async');

mongoose.Promise = require('bluebird');

class Database {

	recordCompletedOrders(orders) {
		return new Promise((resolve, reject) => {
			async.each(orders, (order, callback) => {
				var method = this.recordSell;
				if(order.orderType === 'buy') {
					method = this.recordBuy;
				}
				method(order).then(() => {
					callback();
				}).catch((err) => {
					callback(err);
				});
			}, (err) => {
				if(err) {
					log.logError("Failed to record completed orders from my database");
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}

	recordBuy(order) {
		var orderObj = {
			marketName: order.marketName,
			quantity: order.quantity,
			pricePer: order.pricePer
		}
		return new Promise((resolve, reject) => {
			async.parallel([
				(callback) => {
					var newBuy = new Models.buy(orderObj);
					newBuy.save().then((buy) => {
						callback();
					}).catch((err) => {
						callback(err);
					});
				},
				(callback) => {
					//record new active coin
					var newActiveCoin = new Models.activecoin(orderObj);
					newActiveCoin.save().then((coin) => {
						callback();
					}).catch((err) => {
						callback(err);
					});
				}
			], (err) => {
				if(err) {
					reject(err);
				} else {
					log.logBuy(`${order.quantity} ${order.marketName} at ${order.pricePer}`)
					resolve();
				}
			});
		});
	}

	recordSell(order) {
		var sellObj = {
			marketName: order.marketName,
			quantity: order.quantity,
			pricePerSold: order.pricePer,
			pricePerBought: order.pricePerBought,
			profit: (order.pricePer - order.pricePerBought) * order.quantity,
			percent: ((order.pricePer/order.pricePerBought) * 100) - 100
		}
		return new Promise((resolve, reject) => {
			async.parallel([
				(callback) => {
					var newSell = new Models.sell(sellObj);
					newSell.save().then((sell) => {
						callback();
					}).catch((err) => {
						callback(err);
					})
				},
				(callback) => {
					//delete activecoin as its now sold
					Models.activecoin.remove({marketName: order.marketName}).then(() => {
						callback();
					}).catch((err) => {
						callback(err);
					});
				}
			], (err) => {
				if(err) {
					reject(err);
				} else {
					log.logSell(`${order.quantity} ${order.marketName} at ${order.pricePer}, profit ${((order.pricePer/order.pricePerBought) * 100) - 100}%`);
					resolve();
				}
			});
		});
	}

	recordTick(market, record=true) {
		return new Promise((resolve, reject) => {
			if(record) {
				var newTick = new Models.tick({
					marketName: market.MarketName,
					price: market.Last
				});
				newTick.save((err) => {
					if(err) {
						reject(err);
					} else resolve();
				});
			} else {
				resolve();
			}
		});
	}

	recordTickComplete(open, close, high, low, volume, marketName) {
		return new Promise((resolve, reject) => {
			var newTick = new Models.tick({
				marketName: marketName,
				high: high,
				open: open,
				close: close,
				low: low,
				volume: volume
			});
			newTick.save((err) => {
				if(err) {
					reject(err);
				} else resolve();
			});
		});
	}

	checkRecentSell(dateId, marketName) {
		return new Promise((resolve, reject) => {
			Models.sell.findOne({dateId: dateId, marketName: marketName}).exec((err, sell) => {
				if(err) {
					reject(err);
				} else {
					resolve(sell);
				}
			});
		});
	}

	fetchActiveCoin(marketName) {
		return new Promise((resolve, reject) => {
			Models.activecoin.findOne({marketName: marketName}).exec((err, coin) => {
				if(err) {
					log.logError("Failed to retrieve active coin");
					reject(err)
				} else {
					resolve(coin);
				}
			});
		});
	}

	countActiveCoins() {
		return new Promise((resolve, reject) => {
			Models.activecoin.count({}).exec((err, count) => {
				if(err) {
					log.logError("Failed to retrieve count of active coins");
					reject(err);
				} else {
					resolve(count);
				}
			});
		});
	}

	createOpenOrder(order) {
		return new Promise((resolve, reject) => {
			var newOrder = new Models.openorder(order);
			newOrder.save((err) => {
				if(err) {
					reject(err);
				} else {
					resolve(true);
				}
			});
		});
	}

	getOpenOrders() {
		return new Promise((resolve, reject) => {
			Models.openorder.find({}).exec((err, orders) => {
				if(err) {
					log.logError("Failed to retrieve open orders from database");
					reject("error");
				} else {
					resolve(orders);
				}
			});
		});
	}

	clearOpenOrders() {
		return new Promise((resolve, reject) => {
			Models.openorder.remove({}, (err) => {
				if(err) {
					log.logError("Failed to clear open orders from database");
					reject(err);
				} else {
					resolve();
				}
			});
		});
	}

	//commands 

	clearTradeData() {
		return new Promise((resolve, reject) => {
			async.parallel([
				(callback) => {
					Models.buy.remove({}, (err) => {
						if(err) callback(err);
						callback();
					});
				},
				(callback) => {
					Models.sell.remove({}, (err) => {
						if(err) callback(err);
						callback();
					})
				},
				(callback) => {
					Models.openorder.remove({}, (err) => {
						if(err) callback(err);
						callback();
					})
				},
				(callback) => {
					Models.activecoin.remove({}, (err) => {
						if(err) callback(err);
						callback();
					})
				}
			], (err) => {
				if(err) {
					reject(err);
				} else {
					resolve();
				}
			})
		});
	}

	deleteTicks() {
		return new Promise((resolve, reject) => {
			Models.tick.remove({}, (err) => {
				if(err) reject(err);
				resolve();
			});
		});
	}
}

module.exports = Database;