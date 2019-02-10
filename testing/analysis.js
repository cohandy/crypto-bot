var Historical = require('../classes/Historical'),
	histRef = new Historical,
	Database = require('../classes/Database'),
	dbRef = new Database,
	Indicator = require('../classes/Indicator'),
	customIndicator = new Indicator,
	Bittrex = require('../classes/Bittrex'),
	apiRef = new Bittrex,
	mongoose = require('mongoose'),
	tulind = require('tulind'),
	async = require('async'),
	fs = require('fs');

global.fetch = require('node-fetch')

var btcMarkets = [],
	testResults = [];

var histPrices = {}

//set up db
mongoose.connect('mongodb://localhost:27017/bittrex-trader-v2');
mongoose.connection.on('open', function() {
	console.log('\nmongoose connected\n');
	apiRef.getMarketSummaries().then((markets) => {
		var promises = [];
		for(var i=0;i<markets.length;i++) {
			if(markets[i].MarketName.split('-')[0] === "BTC") {
				btcMarkets.push(markets[i]);
				promises.push(histRef.getPastHourlyValues(markets[i].MarketName, 2000, 4));
			}
		}
		Promise.all(promises).then(values => {
			for(var i=0;i<values.length;i++) {
				if(values[i].length) {
					var marketName = values[i][0].marketName;
					histPrices[marketName] = {
						closePrices: [],
						openPrices: [],
						lowPrices: [],
						highPrices: [],
						volumes: [],
						closingDates: []
					}
					for(var k=0;k<values[i].length;k++) {
						histPrices[marketName].closePrices.push(values[i][k].close);
						histPrices[marketName].lowPrices.push(values[i][k].low);
						histPrices[marketName].highPrices.push(values[i][k].high);
						histPrices[marketName].closingDates.push(values[i][k].utcTime);
						histPrices[marketName].openPrices.push(values[i][k].open);
						histPrices[marketName].volumes.push(values[i][k].volume);
					}
				}
			}
			startAlt();
		});
	});
});

var indicators = require('./analysis-indicator');

function start() {
	loopIndicators(0);
	//iterate through indicators
	function loopIndicators(index) {
		console.log("Starting ----------- " + indicators[index].name);
		testIndicators(index).then(() => {
			if(index < indicators.length - 1) {
				loopIndicators(index + 1);
			} else {
				//test results
				for(var i=0;i<testResults.length;i++) {
					if(testResults[i].avg) {
						console.log("\n----------------------------------------------------");
						console.log(testResults[i].indicators, "\nAvg: " + testResults[i].avg, "\nSuccess: " + testResults[i].success, "\nFiat: " + testResults[i].fiat);
					}
				}
			}
		}).catch((err) => {
			console.log(err);
		});
	}
}

function startAlt() {
	var promises = [];
	for(var i=0;i<indicators.length;i++) {
		promises.push(testIndicators(i));
	}
	Promise.all(promises).then(() => {
		//test results
		var date = new Date;
		console.log("done", date.toLocaleString());
		testResults.sort(function(a, b) {
			if(a.success > b.success) {
				return 1;
			} else return -1;
		});
		for(var i=0;i<testResults.length;i++) {
			if(testResults[i].avg > 0) {
				console.log("\n----------------------------------------------------");
				console.log(testResults[i].indicators, "\nAvg: " + testResults[i].avg, "\nSuccess: " + testResults[i].success, "\nFiat: " + testResults[i].fiat, "\nTrades: " + testResults[i].trades);
			}
		}
	});
}

function testIndicators(pIndex) {
	return new Promise((resolve, reject) => {
		/*
		startRunMarkets(0)
		function startRunMarkets(cIndex) {
			runMarkets(pIndex, cIndex).then((data) => {
				testResults.push(data);
				//run basically same thing again but with a third indicator
				return testChildIndicators(pIndex, cIndex);
			}).then(() => {
				if(cIndex < indicators.length - 1) {
					startRunMarkets(cIndex + 1);
				} else {
					resolve();
				}
			}).catch((err) => {
				console.log(err);
				reject(err);
			})
		}
		*/
		var promises = []
		for(var i=0;i<indicators.length;i++) {
			promises.push(runMarkets(pIndex, i));
			for(var k=0;k<indicators.length;k++) {
				promises.push(runMarkets(pIndex, i, k));
			}
		}
		Promise.all(promises).then(() => {
			resolve();
		});
	});
}

function testChildIndicators(pIndex, cIndex) {
	return new Promise((resolve, reject) => {
		startRunMarkets(cIndex, 0);
		function startRunMarkets(cIndex, scIndex) {
			runMarkets(pIndex, cIndex, scIndex).then((data) => {
				testResults.push(data);
				if(scIndex < indicators.length - 1) {
					startRunMarkets(scIndex + 1);
				} else {
					resolve();
				}
			}).catch((err) => {
				console.log(err);
				reject(err);
			})
		}
	});
}

function runMarkets(pIndex, cIndex, scIndex) {
	return new Promise((resolve, reject) => {
		var marketData = [];
		runTest(0);
		function runTest(i) {
			testMarket(btcMarkets[i].MarketName, pIndex, cIndex, scIndex).then((data) => {
				if(data) marketData.push(data);
				if(i < btcMarkets.length - 1) {
					runTest(i + 1);
				} else {
					var successTotal = 0,
						avgPercentTotal = 0,
						profit = 0,
						totalFiat = 0,
						tradeCount = 0;

					for(var k=0;k<marketData.length;k++) {
						successTotal += marketData[k].success;
						avgPercentTotal += marketData[k].avg;
						profit += marketData[k].profit;
						totalFiat += marketData[k].fiat;
						tradeCount += marketData[k].trades;
					}
					var totalAvg = avgPercentTotal/marketData.length,
						totalSuccess = successTotal/marketData.length;
					var indicatorString = indicators[pIndex].name + ", " + indicators[cIndex].name;
					if(scIndex) {
						indicatorString += ", " + indicators[scIndex].name;
					}
					testResults.push({indicators: indicatorString, fiat: totalFiat, avg: totalAvg, success: totalSuccess, trades: tradeCount});
					resolve();
				}
			}).catch((err) => {
				console.log(err);
				reject(err);
			})
		}
		/*
		var promises = [];
		for(var i=0;i<btcMarkets.length;i++) {
			promises.push(testMarket(btcMarkets[i].MarketName, pIndex, cIndex, scIndex));
		}
		Promise.all(promises).then((marketData) => {
			var successTotal = 0,
				avgPercentTotal = 0,
				profit = 0,
				totalFiat = 0,
				tradeCount = 0;

			for(var k=0;k<marketData.length;k++) {
				successTotal += marketData[k].success;
				avgPercentTotal += marketData[k].avg;
				profit += marketData[k].profit;
				totalFiat += marketData[k].fiat;
				tradeCount += marketData[k].trades;
			}
			var totalAvg = avgPercentTotal/marketData.length,
				totalSuccess = successTotal/marketData.length;
			testResults.push({indicators: `${indicators[pIndex].name} - ${indicators[cIndex].name}`, fiat: totalFiat, avg: totalAvg, success: totalSuccess, trades: tradeCount});
			var indicatorString = indicators[pIndex].name + ", " + indicators[cIndex].name;
			if(scIndex) {
				indicatorString += ", " + indicators[scIndex].name;
			}
			console.log(indicatorString);
			resolve();
		});
		*/
	});
}

function testMarket(marketName, pIndex, cIndex, scIndex) {
	var usTradePrice = 50;
	return new Promise((resolve, reject) => {
		if(histPrices.hasOwnProperty(marketName)) {
			var indicatorString = indicators[pIndex].name + ", " + indicators[cIndex].name;
			if(scIndex) {
				indicatorString += ", " + indicators[scIndex].name;
			}
			if(marketName === 'BTC-1ST' || marketName === 'BTC-FTC' || marketName === 'BTC-OMG' || marketName === 'BTC-VTC') {
				console.log(marketName, indicatorString);
			}
			var closePrices = histPrices[marketName].closePrices,
				openPrices = histPrices[marketName].openPrices,
				lowPrices = histPrices[marketName].lowPrices,
				highPrices = histPrices[marketName].highPrices,
				volumes = histPrices[marketName].volumes,
				closingDates = histPrices[marketName].closingDates;
		
			var parentIndicatorResults = indicators[pIndex].getData(highPrices, lowPrices, openPrices, closePrices, volumes),
				childIndicatorResults = indicators[cIndex].getData(highPrices, lowPrices, openPrices, closePrices, volumes),
				subChildIndicatorResults = [];

			if(scIndex) {
				subChildIndicatorResults = indicators[scIndex].getData(highPrices, lowPrices, openPrices, closePrices, volumes);
			}

			var indicatorArrs = [parentIndicatorResults[0], childIndicatorResults[0]],
				shortestIndArr = parentIndicatorResults[0];
			if(scIndex) {
				indicatorArrs.push(subChildIndicatorResults);
			}
			for(var i=0;i<indicatorArrs.length;i++) {
				if(indicatorArrs[i].length < shortestIndArr.length) {
					shortestIndArr = indicatorArrs[i];
				}
			}
			var parentIndexDiff = parentIndicatorResults[0].length - shortestIndArr.length,
				childIndexDiff = childIndicatorResults[0].length - shortestIndArr.length,
				scIndexDiff = 0,
				timeIndexDiff = closingDates.length - shortestIndArr.length,
				priceIndexDiff = closePrices.length - shortestIndArr.length,
				activeTrade = null;

			if(scIndex) {
				scIndexDiff = subChildIndicatorResults[0].length - shortestIndArr.length;
			}

			var trades = [];
			for(var i=0;i<shortestIndArr.length;i++) {
				var date = new Date(closingDates[i + timeIndexDiff] * 1000).getMonth() + "m" + new Date(closingDates[i + timeIndexDiff] * 1000).getDate() + "d" + new Date(closingDates[i + timeIndexDiff] * 1000).getHours() + "h";
				if(activeTrade) {
					//sell
					var currentDate = new Date(closingDates[i + timeIndexDiff] * 1000),
						timeMsDiff = currentDate - activeTrade.date,
						hourDiff = ((timeMsDiff/1000)/60)/60;

					var parentIndSell = indicators[pIndex].test(parentIndicatorResults, i + parentIndexDiff, openPrices, i + priceIndexDiff, false),
						childIndSell = indicators[cIndex].test(childIndicatorResults, i + childIndexDiff, openPrices, i + priceIndexDiff, false);
					if(parentIndSell) {
						var percent = (((closePrices[i + priceIndexDiff]/activeTrade.price) * 100) - 100),
							success = false,
							profit = closePrices[i + priceIndexDiff] - activeTrade.price;
						if(percent > 0) {
							success = true;
						}
						var fiatPercent = (percent/100) * usTradePrice;
						activeTrade = null;
						trades.push({"percent": percent, "success": success, "profit": profit, "fiat": fiatPercent});
					}
				} else {
					var parentIndBuy = indicators[pIndex].test(parentIndicatorResults, i + parentIndexDiff, openPrices, i + priceIndexDiff, true),
						childIndBuy = indicators[cIndex].test(childIndicatorResults, i + childIndexDiff, openPrices, i + priceIndexDiff, true);
					if(scIndex) {
						var scIndBuy = indicators[scIndex].test(subChildIndicatorResults, i + scIndexDiff, openPrices, i + priceIndexDiff, true);
						if(parentIndBuy && childIndBuy && scIndBuy) {
							activeTrade = {"price": openPrices[i + priceIndexDiff], "date": new Date(closingDates[i + timeIndexDiff] * 1000)};
						}
					} else {
						if(parentIndBuy && childIndBuy) {
							activeTrade = {"price": openPrices[i + priceIndexDiff], "date": new Date(closingDates[i + timeIndexDiff] * 1000)};
						}
					}
				}
			}
			var totalProfit = 0,
				avgPercent = 0,
				successPercent = 0,
				totalFiat = 0;
			for(var k=0;k<trades.length;k++) {
				totalProfit += trades[k].profit;
				avgPercent += trades[k].percent;
				totalFiat += trades[k].fiat;
				if(trades[k].profit > 0) {
					successPercent += 1;
				}
			}
			var totalAveragePercent = avgPercent/trades.length,
				avgSuccessPercent = (successPercent/trades.length) * 100;
			if(!avgSuccessPercent) avgSuccessPercent = 100;
			if(!totalAveragePercent) totalAveragePercent = 0;
			resolve({"profit": totalProfit, "avg": totalAveragePercent, "success": avgSuccessPercent, "trades": trades.length, "market": marketName, "fiat": totalFiat});
		} else {
			resolve(null);
		}
	});
}