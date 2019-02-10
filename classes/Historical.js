var mongoose = require('mongoose'),
	Models = require('../models/index'),
	Logger = require('./Logger'),
	Bittrex = require('./Bittrex'),
	apiRef = new Bittrex,
	async = require('async'),
	log = new Logger,
	cc = require('cryptocompare'),
	async = require('async');

global.fetch = require('node-fetch');

class Historical {

	getPastHourlyValues(marketName, limit=200, period=1) {
		return new Promise((resolve, reject) => {
			Models.tick.find({marketName: marketName}).sort({utcTime: -1}).limit(limit).exec((err, ticks) => {
				if(err) {
					reject(err);
				} else {
					if(period > 1) {
						var count = 0,
							currentGroupTicks = [],
							newTicks = [];
						for(var i=0;i<ticks.length;i++) {
							if(count === period) {
								var newTick = {
									open: currentGroupTicks[currentGroupTicks.length - 1].open,
									close: currentGroupTicks[0].close,
									utcTime: currentGroupTicks[0].utcTime
								}
								var high = currentGroupTicks[0].high,
									low = currentGroupTicks[0].low,
									volume = 0;
								for(var k=0;k<currentGroupTicks.length;k++) {
									if(currentGroupTicks[k].high > high) {
										high = currentGroupTicks[k].high;
									}
									if(currentGroupTicks[k].low < low) {
										low = currentGroupTicks[k].low;
									}
									volume += currentGroupTicks[k].volume;
								}
								newTick.volume = volume;
								newTick.high = high;
								newTick.low = low;
								newTick.marketName = marketName;
								newTicks.push(newTick);
								currentGroupTicks = [];
								count = 0;
							}
							currentGroupTicks.push(ticks[i]);
							count += 1;
						}
						resolve(newTicks.reverse());
					} else {
						resolve(ticks.reverse());
					}
				}
			});
		});
	}

	getPastDailyValues(marketName, limit=200) {
		return new Promise((resolve, reject) => {
			Models.daytick.find({marketName: marketName}).sort({utcTime: -1}).limit(limit).exec((err, ticks) => {
				if(err) {
					reject(err);
				} else {
					resolve(ticks.reverse());
				}
			});
		});
	}

	recordPastHours(limit=2000) {
		return new Promise((resolve, reject) => {
			var markets = [],
				errorMarkets = [];
			apiRef.getMarketSummaries().then((bitMarkets) => {
				markets = bitMarkets
				coinLoop(0);
			}).catch((err) => {
				console.log(err);
			});

			function coinLoop(i) {
				var market = markets[i];

				var splitCoin = market.MarketName.split('-');

				if(splitCoin[0] === "BTC") {
					cc.histoHour(splitCoin[1], 'BTC', { limit: limit, exchange: 'BitTrex'}).then((data) => {
						async.each(data, (hour, callback) => {
							var newTick = new Models.tick({
								marketName: market.MarketName,
								close: hour.close,
								open: hour.open,
								high: hour.high,
								low: hour.low,
								volume: hour.volumefrom,
								utcTime: hour.time
							});
							newTick.save((err) => {
								if(err) console.log(err);
								callback();
							});
						}, (err) => {
							if(err) console.log(err);
							startNewTimeout();
						})
					}).catch((err) => {
						console.log(err);
						if(err.hasOwnProperty('name')) {
							coinLoop(i);
						} else {
							startNewTimeout();
						}
					});
				}

				function startNewTimeout() {
					setTimeout(function() {
						if(i < markets.length) {
							console.log(markets[i].MarketName)
							coinLoop(i + 1);
						} else {
							resolve();
						}
					}, 1);
				}
			}
		});
	}

	recordPastHoursSingle(market) {
		cc.histoHour(market, 'BTC', { limit: 2000, exchange: 'BitTrex'}).then((data) => {
			async.each(data, (hour, callback) => {
				var newTick = new Models.tick({
					marketName: 'BTC-' + market,
					close: hour.close,
					open: hour.open,
					high: hour.high,
					low: hour.low,
					volume: hour.volumefrom,
					utcTime: hour.time
				});
				newTick.save((err) => {
					if(err) console.log(err);
					callback();
				});
			}, (err) => {
				if(err) console.log(err);
				console.log("done")
			});
		}).catch((err) => {
			console.log(err);
		});
	}

	recordPastHoursBitcoin() {
		cc.histoHour('BTC', 'USD', { limit: 2000, exchange: 'Coinbase'}).then((data) => {
			async.each(data, (hour, callback) => {
				var newTick = new Models.tick({
					marketName: 'USDT-BTC',
					close: hour.close,
					open: hour.open,
					high: hour.high,
					low: hour.low,
					volume: hour.volumefrom,
					utcTime: hour.time
				});
				newTick.save((err) => {
					if(err) console.log(err);
					callback();
				});
			}, (err) => {
				if(err) console.log(err);
				console.log("done")
			});
		}).catch((err) => {
			console.log(err);
		});
	}

	recordPastDays() {
		var markets = [];
		apiRef.getMarketSummaries().then((bitMarkets) => {
			markets = bitMarkets
			coinLoop(0);
		}).catch((err) => {
			console.log(err);
		});

		function coinLoop(i) {
			var market = markets[i];

			var splitCoin = market.MarketName.split('-');

			if(splitCoin[0] === "BTC") {
				cc.histoDay(splitCoin[1], 'BTC', { limit: 2000, exchange: 'BitTrex'}).then((data) => {
					async.each(data, (hour, callback) => {
						var newTick = new Models.daytick({
							marketName: market.MarketName,
							close: hour.close,
							open: hour.open,
							high: hour.high,
							low: hour.low,
							volume: hour.volumefrom,
							utcTime: hour.time
						});
						newTick.save((err) => {
							if(err) console.log(err);
							callback();
						});
					}, (err) => {
						if(err) console.log(err);
						startNewTimeout();
					})
				}).catch((err) => {
					console.log(err);
					startNewTimeout();
				})
			}

			function startNewTimeout() {
				setTimeout(function() {
					if(i < markets.length) {
						console.log(markets[i].MarketName)
						coinLoop(i + 1);
					} else {
						console.log("done")
					}
				}, 1);
			}
		}
	}
}

module.exports = Historical;