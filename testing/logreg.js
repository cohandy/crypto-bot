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
	fs = require('fs'),
	ml = require('ml-regression'),
	SLR = ml.SLR,
	{Matrix} = require('ml-matrix'),
	LogRegression = require('ml-logistic-regression');

mongoose.connect('mongodb://localhost:27017/bittrex-trader-v2');
mongoose.connection.on('open', function() {
	console.log('\nmongoose connected\n');
	start();
});

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

var btcMarkets = [],
	bitcoinLinReg = null;

var histPrices = {}

function start() {
	apiRef.getMarketSummaries().then((markets) => {
		var promises = [];
		for(var i=0;i<markets.length;i++) {
			if(markets[i].MarketName.split('-')[0] === "BTC") {
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
			runMarkets().then(() => {

			});
		});
	});
}

function runMarkets() {
	return new Promise((resolve, reject) => {
		var marketData = [];
		runTest(0);
		function runTest(i) {
			testMarket(btcMarkets[i].MarketName).then((data) => {
				if(data) marketData.push(data);
				if(i < btcMarkets.length - 1) {
					runTest(i + 1);
				} else {
					var successTotal = 0,
						avgPercentTotal = 0,
						profit = 0,
						totalFiat = 0,
						days = 0,
						tradeCount = 0;

					for(var k=0;k<marketData.length;k++) {
						successTotal += marketData[k].success;
						avgPercentTotal += marketData[k].avg;
						profit += marketData[k].profit;
						totalFiat += marketData[k].fiat;
						tradeCount += marketData[k].trades;
						days += marketData[k].days;
					}
					var totalAvg = avgPercentTotal/marketData.length,
						avgDays = days/marketData.length,
						totalSuccess = successTotal/marketData.length;
					console.log("\n\n\nTOTAL --------------------------- ");
					console.log("\nAvg: " + totalAvg, "\nSuccess: " + totalSuccess, "\nFiat: " + totalFiat, "\nTrades: " + tradeCount, "\nAvg Trade Length (days): " + avgDays);
					resolve();
				}
			}).catch((err) => {
				console.log(err);
				reject(err);
			})
		}
	});
}

function testMarket(marketName) {
	var usTradePrice = 50;
	return new Promise((resolve, reject) => {
		if(histPrices.hasOwnProperty(marketName)) {
			var close = histPrices[marketName].closePrices,
				open = histPrices[marketName].openPrices,
				low = histPrices[marketName].lowPrices,
				high = histPrices[marketName].highPrices,
				volume = histPrices[marketName].volumes,
				closingDates = histPrices[marketName].closingDates;

			var indicatorObjs = tulind.indicators,
				indResults = [];

			var optionPeriods = {
				cci: ['20'],
				trix: ['18'],
				bbands: ['20', '2'],
				adosc: ['3', '10'],
				aroon: ['14'],
				adx: ['14'],
				apo: ['10', '20'],
				atr: ['14'],
				cmo: ['9'],
				cvi: ['10'],
				dm: ['14'],
				dpo: ['21'],
				fisher: ['9'],
				fosc: ['14'],
				ppo: ['12', '26'],
				kvo: ['13', '26'],
				linregintercept: ['5'],
				macd: ['12', '26', '9'],
				mfi: ['14'],
				roc: ['9'],
				rsi: ['14'],
				stoch: ['14', '13', '1'],
				ultosc: ['7', '14', '28'],
				willr: ['14'],
				adxr: ['14'],
				psar: ['.2', '2'],
				vidya: ['12', '26', '.2'],
				vosc: ['9', '18']
			}

			//iterate through indicators
			for(var ind in indicatorObjs) {
				var inputNames = indicatorObjs[ind].input_names,
					outputNames = indicatorObjs[ind].output_names,
					name = indicatorObjs[ind].name,
					priceArr = [];
				//collect price data
				for(var i=0;i<inputNames.length;i++) {
					switch(inputNames[i]) {
						case 'high': {
							priceArr.push(high);
							break;
						}
						case 'low': {
							priceArr.push(low);
							break;
						}
						case 'open': {
							priceArr.push(open);
							break;
						}
						case 'close': {
							priceArr.push(close);
							break;
						}
						case 'volume': {
							priceArr.push(volume);
							break;
						}
						case 'real': {
							priceArr.push(close);
							break;
						}
					}
				}
				//find unque options via optionPeriod objects
				var options = [];
				if(indicatorObjs[ind].options > 0) {
					if(optionPeriods.hasOwnProperty(name)) {
						options = optionPeriods[name];
					} else {
						options = ['14'];
					}
				}
				//fetch results from api
				var results = [];
				tulind.indicators[name].indicator(priceArr, options, (err, data) => {
					results = data;
				});
				//push arrays to indResults
				for(var i=0;i<results.length;i++) {
					if(results[i].length) {
						indResults.push(results[i]);
					}
				}
			}
			//find shortest ind arr
			var shortestIndArr = indResults[0];
			for(var i=0;i<indResults.length;i++) {
				if(indResults[i].length < shortestIndArr.length) {
					shortestIndArr = indResults[i];
				}
			}
			//make all arrays same length
			for(var i=0;i<indResults.length;i++) {
				var diff = indResults[i].length - shortestIndArr.length;
				indResults[i].splice(0, diff);
			}
			//gather training data for log reg
			var xData = [],
				priceIndexDiff = close.length - shortestIndArr.length;
			for(var i=0;i<Math.floor(shortestIndArr.length * 0.7);i++) {
				var y = 0,
					closeOpenDiff = ((open[i + priceIndexDiff]/close[(i + priceIndexDiff)]) * 100) - 100,
					closeOpenDiff2 = ((open[(i + priceIndexDiff) + 1]/close[(i + priceIndexDiff) + 1]) * 100) - 100;
				if(closeOpenDiff > 10) {
					y = 1;
				}
				var roundData = [open[i + priceIndexDiff]];
				for(var k=0;k<indResults.length;k++) {
					roundData.push(indResults[k][i]);
				}
				roundData.push(y);
				xData.push(roundData);
			}
			if(xData.length) {
				xData = shuffle(xData);
				var yData = [];
				for(var i=0;i<xData.length;i++) {
					yData.push(xData[i].pop());
				}
				var X = new Matrix(xData),
					Y = Matrix.columnVector(yData),
					logReg = new LogRegression({numSteps: 1000, learningRate: 5e-3});

				logReg.train(X, Y);
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
			var rsiIndexDiff = rsi.length - shortestIndArr.length,
				stochIndexDiff = stochD.length - shortestIndArr.length;
			//start iterating, starting at 70% of data collected 
			var trades = [],
				activeTrade = null;
			for(var i=Math.floor(shortestIndArr.length * 0.7);i<shortestIndArr.length;i++) {
				//collect prediction data
				var date = new Date(closingDates[i + priceIndexDiff] * 1000).getMonth() + "m" + new Date(closingDates[i + priceIndexDiff] * 1000).getDate() + "d" + new Date(closingDates[i + priceIndexDiff] * 1000).getHours() + "h";
				var xSingle = [];
				if(xData.length) {
					xSingle.push(open[i + priceIndexDiff]);
					for(var k=0;k<indResults.length;k++) {
						xSingle.push(indResults[k][i]);
					}
					var xTest = new Matrix([xSingle]),
						predictedIncrease = logReg.predict(xTest);
				} else predictedIncrease = 0;
				//if current trade
				if(activeTrade) {
					//sell
					var profitPercent = ((open[i + priceIndexDiff]/activeTrade.price) * 100) - 100,
						stochCross = false;
					if(stochD[i + stochIndexDiff] >= 50) {
						if(stochK[i + stochIndexDiff] < stochD[i + stochIndexDiff] && stochK[(i + stochIndexDiff) - 1] > stochD[(i + stochIndexDiff) - 1]) {
							stochCross = true;
						}
					}
					if(profitPercent < -15 || profitPercent > 5 || activeTrade.skips > 48 || rsi[i + rsiIndexDiff] >= 78 || stochCross) {
						var percent = (((open[i + priceIndexDiff]/activeTrade.price) * 100) - 100),
							success = false,
							profit = open[i + priceIndexDiff] - activeTrade.price;
						if(percent > 0) {
							success = true;
						}
						var fiatPercent = (percent/100) * usTradePrice,
							days = ((activeTrade.skips * 4)/24);
						trades.push({"percent": percent, "success": success, "profit": profit, "fiat": fiatPercent, "days": days});
						activeTrade = null;
						console.log("SELL - " + date + "      $" + open[i + priceIndexDiff]);
						console.log("Percent: " + percent, " Fiat: $", fiatPercent);
					} else activeTrade.skips += 1;
				//if no active trade, looking to buy
				} else {
					if(predictedIncrease[0] > 0 && rsi[i + rsiIndexDiff] > 50 && rsi[(i + rsiIndexDiff) - 1] < 50) {
						activeTrade = {"price": open[i + priceIndexDiff], "date": new Date(closingDates[i + priceIndexDiff] * 1000), "skips": 0};
						console.log("\n" + "BUY - " + date + "      $" + open[i + priceIndexDiff]);
					}
				}
			}
			//collect all trade data
			if(trades.length) {
				var totalProfit = 0,
					avgPercent = 0,
					successPercent = 0,
					days = 0;
					totalFiat = 0;
				for(var k=0;k<trades.length;k++) {
					totalProfit += trades[k].profit;
					avgPercent += trades[k].percent;
					totalFiat += trades[k].fiat;
					days += trades[k].days;
					if(trades[k].profit >= 0) {
						successPercent += 1;
					}
				}
				var totalAveragePercent = avgPercent/trades.length,
					avgDays = days/trades.length,
					avgSuccessPercent = (successPercent/trades.length) * 100;
				if(!avgSuccessPercent) avgSuccessPercent = 0;
				if(!totalAveragePercent) totalAveragePercent = 0;
				if(!avgDays) avgDays = 0; 
				console.log("\nMarket: " + marketName, "\nAvg: " + totalAveragePercent, "\nSuccess: " + avgSuccessPercent, "\nFiat: " + totalFiat, "\nTrades: " + trades.length, "\nAvg Trade Length (days): " + avgDays);
				resolve({"profit": totalProfit, "avg": totalAveragePercent, "success": avgSuccessPercent, "trades": trades.length, "market": marketName, "fiat": totalFiat, "days": avgDays});
			} else {
				console.log("\nNo trades for " + marketName);
				resolve(null);
			}
		} else {
			resolve(null);
		}
	});
}