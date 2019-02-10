var Database = require('./classes/Database'),
	dbRef = new Database,
	Bittrex = require('./classes/Bittrex'),
	apiRef = new Bittrex,
	mongoose = require('mongoose'),
	async = require('async'),
	Models = require('./models/index'),
	cc = require('cryptocompare'),
	async = require('async');

global.fetch = require('node-fetch');

//set up db
mongoose.connect('mongodb://localhost:27017/bittrex-trader-v2');
mongoose.connection.on('open', function() {
	console.log('\nmongoose connected\n');
	start();
});

/*
function loop() {
	recordTicks();
	setTimeout(function() {
		loop();
	}, (1000 * 60) * 60);
}


function recordTicks() {
	var promises = [];
	apiRef.getMarketSummaries().then((markets) => {
		for(var i=0;i<markets.length;i++) {
			if(markets[i].MarketName.split('-')[0] === "BTC") {
				promises.push(dbRef.recordTick(markets[i]));
			}
		}
		Promise.all(promises);
		console.log("done")
	});
}

*/

var minuteTicks = {};

function start() {
	var date = new Date;
	if(date.getMinutes() === 0) {
		console.log("Starting....")
		recordCCHour();
		setTimeout(function() {
			start();
		}, 120000);
	} else {
		setTimeout(function() {
			start();
		}, 1000);
	}
}

function loopMarkets() {
	var date = new Date;
	if(date.getMinutes() === 0 && Object.keys(minuteTicks).length) {
		var promises = [];
		for(var market in minuteTicks) {
			var marketTicks = minuteTicks[market].prices,
				volumeTicks = minuteTicks[market].volumes,
				close = marketTicks[marketTicks.length - 1],
				open = marketTicks[0],
				volume = (volumeTicks[volumeTicks.length - 1] - volumeTicks[0]);

			marketTicks.sort(function(a, b) {
				if(a < b) {
					return -1;
				} else return 1;
			});
			var low = marketTicks[0],
				high = marketTicks[marketTicks.length - 1];

			promises.push(dbRef.recordTickComplete(open, close, high, low, volume, market));
		}
		minuteTicks = {};
		Promise.all(promises).then(() => {
			console.log("Hourly ticks stored");
		}).catch((err) => {
			console.log(err, "Database fetch");
		});
	}
	fetchMinuteTicks();
	setTimeout(function() {
		loopMarkets();
	}, 60000);
}

function fetchMinuteTicks() {
	apiRef.getMarketSummaries().then((markets) => {
		for(var i=0;i<markets.length;i++) {
			if(markets[i].MarketName.split('-')[0] === "BTC") {
				if(minuteTicks.hasOwnProperty(markets[i].MarketName)) {
					minuteTicks[markets[i].MarketName].prices.push(markets[i].Last);
					minuteTicks[markets[i].MarketName].volumes.push(markets[i].Volume);
				} else {
					minuteTicks[markets[i].MarketName] = { "prices": [], "volumes": [] }
					minuteTicks[markets[i].MarketName].prices.push(markets[i].Last);
					minuteTicks[markets[i].MarketName].volumes.push(markets[i].Volume);
				}
			}
		}
	}).catch((err) => {
		console.log(err, "fetch ticks");
	});
}

function recordCCHour() {
	var markets = [],
		groupCount = 0;
	apiRef.getMarketSummaries().then((bitMarkets) => {
		for(var i=0;i<bitMarkets.length;i++) {
			var splitCoin = bitMarkets[i].MarketName.split('-');
			if(splitCoin[0] === "BTC") {
				markets.push(bitMarkets[i]);
			}
		}
		coinLoop(0);
	}).catch((err) => {
		console.log(err);
	});

	function coinLoop(i) {
		groupCount++;
		var market = markets[i];

		cc.histoHour(market.MarketName.split('-')[1], 'BTC', { limit: 1, exchange: 'BitTrex'}).then((data) => {
			var newData = [data[1]];
			async.each(newData, (hour, callback) => {
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
			});
		}).catch((err) => {
			console.log("cc error");
			if(err.hasOwnProperty('name')) {
				coinLoop(i);
			} else {
				startNewTimeout();
			}
		});

		function startNewTimeout() {
			if(groupCount === 15) {
				groupCount = 0;
				setTimeout(function() {
					if(markets[i + 1]) {
						console.log(markets[i].MarketName)
						coinLoop(i + 1);
					} else {
						console.log("done");
						var dateStamp = new Date();
						console.log("\n" + dateStamp.getHours() + ":" + dateStamp.getMinutes() + ", " + (dateStamp.getMonth() + 1) + "/" + dateStamp.getDate() + "\n");
					}
				}, 1000);
			} else {
				if(i + 1 < markets.length) {
					console.log(markets[i].MarketName)
					coinLoop(i + 1);
				} else {
					console.log("done");
					var dateStamp = new Date();
					console.log("\n" + dateStamp.getHours() + ":" + dateStamp.getMinutes() + ", " + (dateStamp.getMonth() + 1) + "/" + dateStamp.getDate() + "\n");
				}
			}
		}
	}
}