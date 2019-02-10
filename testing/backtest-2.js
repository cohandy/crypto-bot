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

var btcMarkets = [];

var histPrices = {},
	indicators = require('./analysis-indicator');

var skipMarkets = ['BTC-XEL', 'BTC-ZEN', 'BTC-XMG', 'BTC-XCP', 'BTC-UBQ', 'BTC-TKS', 'BTC-TIME', 'BTC-SPR', 'BTC-SNT', 'BTC-SNGLS', 'BTC-SLS', 'BTC-SAFEX', 'BTC-RLC', 'BTC-QWARK', 'BTC-QTUM', 'BTC-PPC', 'BTC-PINK', 'BTC-PAY', 'BTC-NXS', 'BTC-MYST', 'BTC-MTL', 'BTC-MCO', 'BTC-LTC', 'BTC-LGD', 'BTC-HMQ', 'BTC-GUP', 'BTC-GOLOS', 'BTC-GNO', 'BTC-GEO', 'BTC-FLDC', 'BTC-ETC', 'BTC-ENRG', 'BTC-EDG', 'BTC-EBST', 'BTC-DYN', 'BTC-DTB', 'BTC-DOGE', 'BTC-DCT', 'BTC-DCR', 'BTC-CVC', 'BTC-CLUB', 'BTC-CLAM', 'BTC-CFI', 'BTC-BRX', 'BTC-BLK', 'BTC-BCY', 'BTC-APX', 'BTC-AMP', 'BTC-ARGS', 'BTC-ADX', 'BTC-1ST'];

//set up db
mongoose.connect('mongodb://localhost:27017/bittrex-trader-v2');
mongoose.connection.on('open', function() {
	console.log('\nmongoose connected\n');
	apiRef.getMarketSummaries().then((markets) => {
		var promises = [];
		for(var i=0;i<markets.length;i++) {
			if(markets[i].MarketName.split('-')[0] === "BTC" && skipMarkets.indexOf(markets[i].MarketName) === -1) {
				btcMarkets.push(markets[i]);
				promises.push(histRef.getPastHourlyValues(markets[i].MarketName, 2000, 4));
				//promises.push(histRef.getPastDailyValues(markets[i].MarketName, 2000));
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
			start();
		});
	});
});

function start() {
	var indicatorString = "rsi bop",
		indSplit = indicatorString.split(" "),
		indArr = [];
	for(var i=0;i<indSplit.length;i++) {
		for(var k=0;k<indicators.length;k++) {
			var indTest = new RegExp(indSplit[i]);
			if(indTest.test(indicators[k].name)) {
				indArr.push(k);
				console.log(indicators[k].name);
			}
		}
	}
	if(indArr.length === 2) {
		indArr[2] = null;
	}
	runMarkets(indArr[0], indArr[1], indArr[2]).then(() => {
		
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
					console.log("\n\n\nTOTAL --------------------------- ");
					console.log("\nAvg: " + totalAvg, "\nSuccess: " + totalSuccess, "\nFiat: " + totalFiat, "\nTrades: " + tradeCount);
					resolve();
				}
			}).catch((err) => {
				console.log(err);
				reject(err);
			})
		}
	});
}

function testMarket(marketName, pIndex, cIndex, scIndex) {
	var usTradePrice = 50;
	return new Promise((resolve, reject) => {
		if(histPrices.hasOwnProperty(marketName)) {
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

					var parentIndSell = indicators[pIndex].test(parentIndicatorResults, i + parentIndexDiff, openPrices, i + priceIndexDiff, false);
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
						console.log("SELL - " + date + "      $" + closePrices[i + priceIndexDiff]);
						console.log("Percent: " + percent, " Fiat: $", fiatPercent);
					}
				} else {
					var parentIndBuy = indicators[pIndex].test(parentIndicatorResults, i + parentIndexDiff, openPrices, i + priceIndexDiff, true),
						childIndBuy = indicators[cIndex].test(childIndicatorResults, i + childIndexDiff, openPrices, i + priceIndexDiff, true);
					if(scIndex) {
						var scIndBuy = indicators[scIndex].test(subChildIndicatorResults, i + scIndexDiff, openPrices, i + priceIndexDiff, true);
						if(parentIndBuy && childIndBuy && scIndBuy) {
							activeTrade = {"price": closePrices[i + priceIndexDiff], "date": new Date(closingDates[i + timeIndexDiff] * 1000)};
						}
					} else {
						if(parentIndBuy && childIndBuy) {
							activeTrade = {"price": closePrices[i + priceIndexDiff], "date": new Date(closingDates[i + timeIndexDiff] * 1000)};
							console.log("\n" + "BUY - " + date + "      $" + closePrices[i + priceIndexDiff]);
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
			console.log("\nMarket: " + marketName, "\nAvg: " + totalAveragePercent, "\nSuccess: " + avgSuccessPercent, "\nFiat: " + totalFiat, "\nTrades: " + trades.length);
			resolve({"profit": totalProfit, "avg": totalAveragePercent, "success": avgSuccessPercent, "trades": trades.length, "market": marketName, "fiat": totalFiat});
		} else {
			resolve(null);
		}
	});
}