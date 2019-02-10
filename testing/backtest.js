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

//set up db
mongoose.connect('mongodb://localhost:27017/bittrex-trader-v2');
mongoose.connection.on('open', function() {
	console.log('\nmongoose connected\n');
	run();
});

function run() {
	/*
	cciRvi('BTC-NEO').then(() => {

	});
	*/
	runMarkets(true);
}

function runMarkets(chosen) {
	var chosenMarkets = ["BTC-BAY","BTC-BLOCK","BTC-BNT","BTC-BSD","BTC-CLOAK","BTC-DASH","BTC-DCT","BTC-EGC","BTC-EMC","BTC-EMC2","BTC-FUN","BTC-IOP","BTC-KORE","BTC-LSK","BTC-MCO","BTC-MONA","BTC-MYST","BTC-NAV","BTC-NXC","BTC-NXS","BTC-OK","BTC-OMG","BTC-PINK","BTC-PKB","BTC-RISE","BTC-SHIFT","BTC-SLR","BTC-SPR","BTC-SWIFT","BTC-SYS","BTC-TKS","BTC-TRIG","BTC-TX","BTC-VTC","BTC-XAUR","BTC-XCP","BTC-XLM","BTC-XMG","BTC-XWC","BTC-XZC","BTC-ZCL"];
	var marketData = [];
	apiRef.getMarketSummaries().then((markets) => {
		var btcMarkets = [];
		for(var i=0;i<markets.length;i++) {
			if(chosen) {
				if(chosenMarkets.indexOf(markets[i].MarketName) !== -1) {
					btcMarkets.push(markets[i]);
				}
			} else {
				if(markets[i].MarketName.split('-')[0] === "BTC") {
					btcMarkets.push(markets[i]);
				}
			}
		}
		runTest(0);
		function runTest(i) {
			cciRvi(btcMarkets[i].MarketName).then((data) => {
				marketData.push(data);
				if(i < btcMarkets.length - 1) {
					runTest(i + 1);
				} else {
					testResults();
				}
			}).catch((err) => {
				console.log(err);
			})
		}
		function testResults() {
			var successTotal = 0,
				avgPercentTotal = 0,
				profit = 0,
				totalFiat = 0,
				tradeCount = 0;

			var marketString = "[",
				count = 0;
			for(var i=0;i<marketData.length;i++) {
				successTotal += marketData[i].success;
				avgPercentTotal += marketData[i].avg;
				profit += marketData[i].profit;
				totalFiat += marketData[i].fiat;
				tradeCount += marketData[i].trades;
				if(marketData[i].avg > 4) {
					count++;
					marketString += `"${marketData[i].market}",`;
				}
			}
			console.log(count)
			console.log(marketString);
			console.log("\n\n\nTOTAL");
			console.log("Total Fiat: $", totalFiat);
			console.log("Avg Trade %: ", avgPercentTotal/marketData.length);
			console.log("Success % Avg: ", successTotal/marketData.length);
			console.log("Num of Trades: ", tradeCount);
		}
	}).catch((err) => {
		console.log(err);
	});
}

function cciRvi(symbol) {
	var usTradePrice = 50;
	return new Promise((resolve, reject) => {
		histRef.getPastHourlyValues(symbol, 2000, 4).then((data) => {
			console.log("\n----------------------------------------------------");
			console.log(symbol);
			var closingPrices = [],
				openingPrices = [],
				lowPrices = [],
				highPrices = [],
				closingDates = [];
				for(var i=0;i<data.length;i++) {
					closingPrices.push(data[i].close);
					lowPrices.push(data[i].low);
					highPrices.push(data[i].high);
					closingDates.push(data[i].utcTime);
					openingPrices.push(data[i].open);
				}
			var cci = [],
				trix = [],
				bbandsTop = [];
			tulind.indicators.cci.indicator([highPrices, lowPrices, closingPrices], ['20'], (err, results) => {
				if(err) console.log(err, "error from tulind");
				cci = results[0];
			});
			tulind.indicators.trix.indicator([closingPrices], ['18'], (err, results) => {
				trix = results[0];
			});
			tulind.indicators.bbands.indicator([closingPrices], ['20', '2'], (err, results) => {
				bbandsTop = results[2];
			});
			var rviCalc = customIndicator.rvi(highPrices, lowPrices, openingPrices, closingPrices, 10),
				rvi = rviCalc[0],
				rviSignal = rviCalc[1];
			/*
			for(var i =0;i<rvi.length;i++) {
				console.log(`{"rvi":${rvi[i]}, "signal":${rviSignal[i]}},`);
			}
			*/
			var indicators = [rvi, cci, trix, bbandsTop],
				shortestIndArr = indicators[0];
			for(var i=0;i<indicators.length;i++) {
				if(indicators[i].length < shortestIndArr.length) {
					shortestIndArr = indicators[i];
				}
			}
			var timeIndexDiff = closingDates.length - shortestIndArr.length,
				priceIndexDiff = closingPrices.length - shortestIndArr.length,
				cciIndexDiff = cci.length - shortestIndArr.length,
				rviIndexDiff = rvi.length - shortestIndArr.length,
				trixIndexDiff = trix.length - shortestIndArr.length,
				bbandsIndexDiff = bbandsTop.length - shortestIndArr.length,
				activeTrade = null;

			var trades = [];
			for(var i=0;i<shortestIndArr.length;i++) {
				var date = new Date(closingDates[i + timeIndexDiff] * 1000).getMonth() + "m" + new Date(closingDates[i + timeIndexDiff] * 1000).getDate() + "d" + new Date(closingDates[i + timeIndexDiff] * 1000).getHours() + "h";
				if(activeTrade) {
					//sell
					var currentDate = new Date(closingDates[i + timeIndexDiff] * 1000),
						timeMsDiff = currentDate - activeTrade.date,
						hourDiff = ((timeMsDiff/1000)/60)/60;
					if(rvi[i + rviIndexDiff] < rviSignal[i + rviIndexDiff] && hourDiff >= 6) {
						var percent = (((closingPrices[i + priceIndexDiff]/activeTrade.price) * 100) - 100),
							success = false,
							profit = closingPrices[i + priceIndexDiff] - activeTrade.price;
						if(percent > 0) {
							success = true;
						}
						var fiatPercent = (percent/100) * usTradePrice;
						console.log("SELL - " + date + "      $" + closingPrices[i + priceIndexDiff]);
						console.log("Percent: " + percent, " Fiat: $", fiatPercent);
						activeTrade = null;
						trades.push({"percent": percent, "success": success, "profit": profit, "fiat": fiatPercent});
					}
				} else {
					var rviCrossed = false,
						cciCrossed = false;
					for(var k=1;k<=3;k++) {
						var rviTick = rvi[(i + rviIndexDiff) - k],
							rviSignalTick = rviSignal[(i + rviIndexDiff) - k],
							cciTick = cci[(i + cciIndexDiff) - k];

						if(cci[(i + cciIndexDiff)] < cciTick) {
							cciCrossed = true;
						}
						if(rviTick < rviSignalTick) {
							rviCrossed = true;
						}
					}
					var trixPass = false;
					if(trix[i + trixIndexDiff] > 0) {
						trixPass = true;
					} else if(trix[i + trixIndexDiff] > -20 && trix[i + trixIndexDiff] > trix[(i + trixIndexDiff) - 1]) {
						trixPass = true;
					}
					var priceRise = false;
					if(lowPrices[i + priceIndexDiff] > lowPrices[(i + priceIndexDiff) - 6]) {
						priceRise = true;
					}
					if(cci[i + cciIndexDiff] > 125 && cci[i + cciIndexDiff] < 200 && trixPass && rvi[i + rviIndexDiff] > rviSignal[i + rviIndexDiff] && rviCrossed && priceRise) {
						activeTrade = {"price": closingPrices[i + priceIndexDiff], "date": new Date(closingDates[i + timeIndexDiff] * 1000)};
						console.log("\n" + "BUY - " + date + "      $" + closingPrices[i + priceIndexDiff]);
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
			console.log("\nProfit: $", totalProfit);
			console.log("Avg: %", totalAveragePercent);
			console.log("Success: %", avgSuccessPercent);
			console.log("Trade Amount: ", trades.length);
			if(!avgSuccessPercent) avgSuccessPercent = 0;
			if(!totalAveragePercent) totalAveragePercent = 0;
			resolve({"profit": totalProfit, "avg": totalAveragePercent, "success": avgSuccessPercent, "trades": trades.length, "market": symbol, "fiat": totalFiat});
		}).catch((err) => {
			console.log(err);
			reject(err);
		});
	});
}