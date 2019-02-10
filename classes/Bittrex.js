var bittrex = require('node.bittrex.api');
bittrex.options({
	'apikey': process.env.APIKEY,
	'apisecret': process.env.APISECRET
});

var Logger = require('./Logger'),
	async = require('async'),
	log = new Logger;

class BittrexApi {

	getMarketSummaries() {
		return new Promise((resolve, reject) => {
			bittrex.getmarketsummaries((data, err) => {
				if(err) {
					log.logError("Failed to get market summaries from Bittrex");
					reject("error");
				} else {
					resolve(data.result);
				}
			});
		});
	}

	getMarketSummary(marketName) {
		return new Promise((resolve, reject) => {
			bittrex.getmarketsummary({market: marketName}, (data, err) => {
				if(err) {
					reject(err);
				} else resolve(data.result);
			})
		});
	}

	getTicker(marketName) {
		return new Promise((resolve, reject) => {
			bittrex.getticker({market: marketName}, (data, err) => {
				if(err) {
					reject(err);
				} else {
					resolve(data);
				}
			});
		});
	}

	getOpenOrders() {
		return new Promise((resolve, reject) => {
			bittrex.getopenorders({}, (data, err) => {
				if(err) {
					log.logError("Failed to retrieve open orders from Bittrex");
					reject(err);
				} else {
					resolve(data.result);
				}
			});
		});
	}

	clearOpenOrders(orders) {
		return new Promise((resolve, reject) => {
			async.each(orders, (order, callback) => {
				bittrex.cancel({uuid: order.OrderUuid}, (err) => {
					if(err) {
						callback(err);
					} else {
						callback();
					}
				});
			}, (err) => {
				if(err) {
					log.logError("Failed to clear orders from Bittrex");
					reject(err);
				} else resolve();
			})
		});
	}

	getOrderBook(marketName, type) {
		return new Promise((resolve, reject) => {
			bittrex.getorderbook({market: marketName, type: type}, (data, err) => {
				if(err) {
					log.logError("Failed to retrieve order book from Bittrex");
					reject(err);
				} else {
					resolve(data.result);
				}
			});
		});
	}

	//buy sell limit

	buyLimit(marketName, quantity, rate) {
		return new Promise((resolve, reject) => {
			bittrex.buylimit({market: marketName, quantity: quantity, rate: rate}, (data, err) => {
				if(!data.success || err) {
					reject(err);
				} else {
					resolve(data.result.uuid);
				}
			});
		});
	}

	sellLimit(marketName, quantity, rate) {
		return new Promise((resolve, reject) => {
			bittrex.selllimit({market: marketName, quantity: quantity, rate: rate}, (data, err) => {
				if(!data.success || err) {
					reject(err);
				} else {
					resolve(data.result.uuid);
				}
			});
		});
	}
}

module.exports = BittrexApi;