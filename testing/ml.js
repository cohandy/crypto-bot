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
	startAll();
});

function start() {
	var intervalHour = 2;
	histRef.getPastHourlyValues('BTC-VTC', 20000, intervalHour).then((data) => {
		var closingPrices = [],
			openingPrices = [],
			lowPrices = [],
			highPrices = [],
			volume = [],
			closingDates = [];
		for(var i=0;i<data.length;i++) {
			closingPrices.push(data[i].close);
			lowPrices.push(data[i].low);
			highPrices.push(data[i].high);
			closingDates.push(data[i].utcTime);
			openingPrices.push(data[i].open);
			volume.push(data[i].volume);
		}
		var rsi = [],
			bop = [],
			emv = [],
			willr = [],
			cmo = [],
			ad = [],
			fosc = [],
			roc = [],
			macd = [],
			macdSignal = [],
			trix = [],
			stochD = [],
			stochK = [],
			dpo = [],
			ultosc;
		tulind.indicators.rsi.indicator([closingPrices], ['14'], (err, results) => {
			rsi = results[0];
		});
		tulind.indicators.bop.indicator([openingPrices, highPrices, lowPrices, closingPrices], [], (err, results) => {
			bop = results[0];
		});
		tulind.indicators.emv.indicator([highPrices, lowPrices, volume], [], (err, results) => {
			emv = results[0];
		});
		tulind.indicators.willr.indicator([highPrices, lowPrices, closingPrices], ['14'], (err, results) => {
			willr = results[0];
		});
		tulind.indicators.ultosc.indicator([highPrices, lowPrices, closingPrices], ['7', '14', '28'], (err, results) => {
			ultosc = results[0];
		});
		tulind.indicators.cmo.indicator([closingPrices], ['9'], (err, results) => {
			cmo = results[0];
		});
		tulind.indicators.ad.indicator([highPrices, lowPrices, closingPrices, volume], [], (err, results) => {
			ad = results[0];
		});
		tulind.indicators.roc.indicator([closingPrices], ['9'], (err, results) => {
			roc = results[0];
		});
		tulind.indicators.fosc.indicator([closingPrices], ['14'], (err, results) => {
			fosc = results[0];
		});
		tulind.indicators.macd.indicator([closingPrices], ['12', '26', '9'], (err, results) => {
			macd = results[0];
			macdSignal = results[1];
		});
		tulind.indicators.stoch.indicator([highPrices, lowPrices, closingPrices], ['14', '13', '1'], (err, results) => {
			stochD = results[1];
			stochK = results[0];
		});
		tulind.indicators.dpo.indicator([closingPrices], ['21'], (err, results) => {
			dpo = results[0];
		});
		var indicatorArrs = [rsi, bop, openingPrices, emv, willr, ultosc, cmo, macd, stochD, fosc, roc, ad, dpo],
			shortestIndArr = rsi;
		for(var i=0;i<indicatorArrs.length;i++) {
			if(indicatorArrs[i].length < shortestIndArr.length) {
				shortestIndArr = indicatorArrs[i];
			}
		}
		var rsiIndexDiff = rsi.length - shortestIndArr.length,
			timeIndexDiff = closingDates.length - shortestIndArr.length,
			priceIndexDiff = closingPrices.length - shortestIndArr.length,
			bopIndexDiff = bop.length - shortestIndArr.length,
			willrIndexDiff = willr.length - shortestIndArr.length,
			ultoscIndexDiff = ultosc.length - shortestIndArr.length,
			emvIndexDiff = emv.length - shortestIndArr.length,
			cmoIndexDiff = cmo.length - shortestIndArr.length,
			adIndexDiff = ad.length - shortestIndArr.length,
			rocIndexDiff = roc.length - shortestIndArr.length,
			foscIndexDiff = fosc.length - shortestIndArr.length,
			macIndexDiff = macd.length - shortestIndArr.length,
			stochIndexDiff = stochD.length - shortestIndArr.length,
			dpoIndexDiff = dpo.length - shortestIndArr.length,
			activeTrade = null;

		var xData = [];
		for(var i=0;i<Math.floor(shortestIndArr.length * 0.7);i++) {
			var y = 0,
				closeOpenDiff = ((openingPrices[i + priceIndexDiff]/closingPrices[(i + priceIndexDiff) + 5]) * 100) - 100;
			if(closeOpenDiff > 12.5) {
				y = 1;
			}
			var macdCross = 0;
			if(macd[i + macIndexDiff] > macdSignal[i + macIndexDiff] && macd[(i + macIndexDiff) - 1] < macdSignal[(i + macIndexDiff) - 1]) {
				macdCross = 1;
			}
			var stochCross = 0;
			if(stochK[i + stochIndexDiff] > stochD[i + stochIndexDiff] && stochK[(i + stochIndexDiff) - 1] < stochD[(i + stochIndexDiff) - 1]) {
				stochCross = 1;
			}
			xData.push([openingPrices[i + priceIndexDiff], rsi[i + rsiIndexDiff], bop[i + bopIndexDiff], willr[i + willrIndexDiff], ultosc[i + ultoscIndexDiff], emv[i + emvIndexDiff], cmo[i + cmoIndexDiff], ad[i + adIndexDiff], roc[i + rocIndexDiff], fosc[i + foscIndexDiff], macdCross, stochCross, dpo[i + dpoIndexDiff], y]);
		}
		xData = shuffle(xData);
		var yData = [];
		for(var i=0;i<xData.length;i++) {
			yData.push(xData[i].pop());
		}
		var X = new Matrix(xData),
			Y = Matrix.columnVector(yData),
			logReg = new LogRegression({numSteps: 2000, learningRate: 5e-3});
		logReg.train(X, Y);
		var trade = null;
		for(var i=Math.floor(shortestIndArr.length * 0.7);i<shortestIndArr.length;i++) {
			var macdCross = 0;
			if(macd[i + macIndexDiff] > macdSignal[i + macIndexDiff] && macd[(i + macIndexDiff) - 1] < macdSignal[(i + macIndexDiff) - 1]) {
				macdCross = 1;
			}
			var stochCross = 0;
			if(stochK[i + stochIndexDiff] > stochD[i + stochIndexDiff] && stochK[(i + stochIndexDiff) - 1] < stochD[(i + stochIndexDiff) - 1]) {
				stochCross = 1;
			}
			var xTest = new Matrix([[openingPrices[i + priceIndexDiff], rsi[i + rsiIndexDiff], bop[i + bopIndexDiff], willr[i + willrIndexDiff], ultosc[i + ultoscIndexDiff], emv[i + emvIndexDiff], cmo[i + cmoIndexDiff], ad[i + adIndexDiff], roc[i + rocIndexDiff], fosc[i + foscIndexDiff], macdCross, stochCross, dpo[i + dpoIndexDiff]]]),
				predictedIncrease = logReg.predict(xTest),
				date = new Date(closingDates[i] * 1000).getMonth() + "m" + new Date(closingDates[i] * 1000).getDate() + "d" + new Date(closingDates[i] * 1000).getHours() + "h";
			if(trade) {
				var profitPercent = ((openingPrices[i]/trade.price) * 100) - 100;
				if(profitPercent < -20 || profitPercent > 7 || predictedIncrease[0] === 0 || trade.skips > 48) {
					console.log("\nSELL: Profit - ", profitPercent, " DATE: ", date);
					trade = null;
				} else trade.skips += 1;
			} else {
				if(predictedIncrease[0] > 0 && rsi[i + indexDiffs.rsi] > 50 && rsi[(i + indexDiffs.rsi) - 1] < 50) {
					trade = {"price": openingPrices[i], "skips": 0};
					console.log(`\nBUY - open: ${openingPrices[i]} - date: ${date}`);
				}
			}
		}
		console.log("done");
	});
}

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

function startAll() {
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
			//pricing data
			var closingPrices = histPrices[marketName].closePrices,
				openingPrices = histPrices[marketName].openPrices,
				lowPrices = histPrices[marketName].lowPrices,
				highPrices = histPrices[marketName].highPrices,
				volume = histPrices[marketName].volumes,
				closingDates = histPrices[marketName].closingDates;

			//indicator data
			var rsi = [],
				bop = [],
				emv = [],
				willr = [],
				cmo = [],
				ad = [],
				fosc = [],
				roc = [],
				macd = [],
				macdSignal = [],
				trix = [],
				stochD = [],
				stochK = [],
				dpo = [],
				cci = [],
				bbandsTop = [],
				adosc = [],
				ultosc = [],
				ao = [],
				apo = [],
				cvi = [],
				linreg = [],
				mfi = [],
				pvi = [],
				nvi = [],
				aroonUp = [],
				aroonDown = [],
				atr = [],
				dmPlus = [],
				dmMinus = [],
				fisher = [],
				fisherSignal = [],
				adx = [];
			tulind.indicators.rsi.indicator([closingPrices], ['14'], (err, results) => {
				rsi = results[0];
			});
			tulind.indicators.bop.indicator([openingPrices, highPrices, lowPrices, closingPrices], [], (err, results) => {
				bop = results[0];
			});
			tulind.indicators.emv.indicator([highPrices, lowPrices, volume], [], (err, results) => {
				emv = results[0];
			});
			tulind.indicators.willr.indicator([highPrices, lowPrices, closingPrices], ['14'], (err, results) => {
				willr = results[0];
			});
			tulind.indicators.ultosc.indicator([highPrices, lowPrices, closingPrices], ['7', '14', '28'], (err, results) => {
				ultosc = results[0];
			});
			tulind.indicators.cmo.indicator([closingPrices], ['9'], (err, results) => {
				cmo = results[0];
			});
			tulind.indicators.ad.indicator([highPrices, lowPrices, closingPrices, volume], [], (err, results) => {
				ad = results[0];
			});
			tulind.indicators.roc.indicator([closingPrices], ['9'], (err, results) => {
				roc = results[0];
			});
			tulind.indicators.fosc.indicator([closingPrices], ['14'], (err, results) => {
				fosc = results[0];
			});
			tulind.indicators.macd.indicator([closingPrices], ['12', '26', '9'], (err, results) => {
				macd = results[0];
				macdSignal = results[1];
			});
			tulind.indicators.stoch.indicator([highPrices, lowPrices, closingPrices], ['14', '13', '1'], (err, results) => {
				stochD = results[1];
				stochK = results[0];
			});
			tulind.indicators.dpo.indicator([closingPrices], ['21'], (err, results) => {
				dpo = results[0];
			});
			tulind.indicators.cci.indicator([highPrices, lowPrices, closingPrices], ['20'], (err, results) => {
				cci = results[0];
			});
			tulind.indicators.bbands.indicator([closingPrices], ['20', '2'], (err, results) => {
				bbands = results[1];
			});
			tulind.indicators.adosc.indicator([highPrices, lowPrices, closingPrices, volume], ['3', '10'], (err, results) => {
				adosc = results[0];
			});
			tulind.indicators.adx.indicator([highPrices, lowPrices, closingPrices], ['14'], (err, results) => {
				adx = results[0];
			});
			tulind.indicators.ao.indicator([highPrices, lowPrices], [], (err, results) => {
				ao = results[0];
			});
			tulind.indicators.apo.indicator([closingPrices], ['10', '20'], (err, results) => {
				apo = results[0];
			});
			tulind.indicators.cvi.indicator([highPrices, lowPrices], ['10'], (err, results) => {
				cvi = results[0];
			});
			tulind.indicators.linregintercept.indicator([closingPrices], ['5'], (err, results) => {
				linreg = results[0];
			});
			tulind.indicators.mfi.indicator([highPrices, lowPrices, closingPrices, volume], ['14'], (err, results) => {
				mfi = results[0];
			});
			tulind.indicators.pvi.indicator([closingPrices, volume], [], (err, results) => {
				pvi = results[0];
			});
			tulind.indicators.nvi.indicator([closingPrices, volume], [], (err, results) => {
				nvi = results[0];
			});
			tulind.indicators.aroon.indicator([highPrices, lowPrices], ['14'], (err, results) => {
				aroonDown = results[0],
				aroonUp = results[1];
			});
			tulind.indicators.atr.indicator([highPrices, lowPrices, closingPrices], ['14'], (err, results) => {
				atr = results[0];
			});
			tulind.indicators.dm.indicator([highPrices, lowPrices], ['14'], (err, results) => {
				dmMinus = results[1],
				dmPlus = results[0];
			});
			tulind.indicators.fisher.indicator([highPrices, lowPrices], ['9'], (err, results) => {
				fisherSignal = results[1],
				fisher = results[0];
			});
			//find shortest arr for iterating
			var indicatorArrs = [{"name": "rsi", "data": rsi}, {"name": "bop", "data": bop}, {"name": "price", "data": openingPrices }, 
								{"name": "emv", "data": emv }, {"name": "willr", "data": willr }, {"name": "ultosc", "data": ultosc }, 
								{"name": "cmo", "data": cmo }, {"name": "macd", "data": macd }, {"name": "stoch", "data": stochD }, 
								{"name": "fosc", "data": fosc }, {"name": "roc", "data": roc }, {"name": "ad", "data": ad }, 
								{"name": "dpo", "data": dpo}, {"name": "cci", "data": cci}, {"name": "bbands", "data": bbands}, 
								{"name": "adosc", "data": adosc}, {"name": "adx", "data": adx}, {"name": "apo", "data": apo},
								{"name": "cvi", "data": cvi}, {"name": "linreg", "data": linreg}, {"name": "mfi", "data": mfi},
								{"name": "nvi", "data": nvi}, {"name": "aroon", "data": aroonUp}, {"name": "atr", "data": atr},
								{"name": "dm", "data": dmPlus}, {"name": "fisher", "data": fisher}];
			var shortestIndArr = rsi;
			for(var i=0;i<indicatorArrs.length;i++) {
				if(indicatorArrs[i].data.length < shortestIndArr.length) {
					shortestIndArr = indicatorArrs[i].data;
				}
			}
			//get each indicators length index diff with shortest arr
			var indexDiffs = {}
			for(var i=0;i<indicatorArrs.length;i++) {
				indexDiffs[indicatorArrs[i].name] = indicatorArrs[i].data.length - shortestIndArr.length;
			}
			//collect logReg data
			var xData = [];
			for(var i=0;i<Math.floor(shortestIndArr.length * 0.7);i++) {
				var y = 0,
					closeOpenDiff = ((openingPrices[i + indexDiffs.price]/closingPrices[(i + indexDiffs.price)]) * 100) - 100;
				if(closeOpenDiff > 10) {
					y = 1;
				}
				xData.push([openingPrices[i + indexDiffs.price], rsi[i + indexDiffs.rsi], bop[i + indexDiffs.bop], willr[i + indexDiffs.willr], 
							ultosc[i + indexDiffs.ultosc], emv[i + indexDiffs.emv], cmo[i + indexDiffs.cmo], ad[i + indexDiffs.ad], roc[i + indexDiffs.roc], 
							fosc[i + indexDiffs.fosc], macd[i + indexDiffs.macd], macdSignal[i + indexDiffs.macd], stochK[i + indexDiffs.stoch], stochD[i + indexDiffs.stoch], dpo[i + indexDiffs.dpo], cci[i + indexDiffs.cci], bbands[i + indexDiffs.bbands], 
							adx[i + indexDiffs.adx], apo[i + indexDiffs.apo],  cvi[i + indexDiffs.cvi], linreg[i + indexDiffs.linreg], 
							mfi[i + indexDiffs.mfi], nvi[i + indexDiffs.nvi], pvi[i + indexDiffs.nvi], aroonUp[i + indexDiffs.aroon], aroonDown[i + indexDiffs.aroon], 
							atr[i + indexDiffs.atr], dmPlus[i + indexDiffs.dm], dmMinus[i + indexDiffs.dm], fisher[i + indexDiffs.fisher], fisherSignal[i + indexDiffs.fisher], y]);
			}
			//shuffle data, create Y data arr from y data lumped into xData arr
			xData = shuffle(xData);
			var yData = [];
			for(var i=0;i<xData.length;i++) {
				yData.push(xData[i].pop());
			}
			var X = new Matrix(xData),
				Y = Matrix.columnVector(yData),
				logReg = new LogRegression({numSteps: 2000, learningRate: 5e-3}),
				activeTrade = null;

			logReg.train(X, Y);
			//start iterating, starting at 70% of data collected 
			var trades = [];
			for(var i=Math.floor(shortestIndArr.length * 0.7);i<shortestIndArr.length;i++) {
				//collect prediction data
				var xTest = new Matrix([[openingPrices[i + indexDiffs.price], rsi[i + indexDiffs.rsi], bop[i + indexDiffs.bop], willr[i + indexDiffs.willr], 
										ultosc[i + indexDiffs.ultosc], emv[i + indexDiffs.emv], cmo[i + indexDiffs.cmo], ad[i + indexDiffs.ad], roc[i + indexDiffs.roc], 
										fosc[i + indexDiffs.fosc], macd[i + indexDiffs.macd], macdSignal[i + indexDiffs.macd], stochK[i + indexDiffs.stoch], stochD[i + indexDiffs.stoch], dpo[i + indexDiffs.dpo], cci[i + indexDiffs.cci], bbands[i + indexDiffs.bbands], 
										adx[i + indexDiffs.adx], apo[i + indexDiffs.apo], cvi[i + indexDiffs.cvi], linreg[i + indexDiffs.linreg],
										mfi[i + indexDiffs.mfi], nvi[i + indexDiffs.nvi], pvi[i + indexDiffs.nvi], aroonUp[i + indexDiffs.aroon], aroonDown[i + indexDiffs.aroon],
										atr[i + indexDiffs.atr], dmPlus[i + indexDiffs.dm], dmMinus[i + indexDiffs.dm], fisher[i + indexDiffs.fisher], fisherSignal[i + indexDiffs.fisher]]]),
					predictedIncrease = logReg.predict(xTest),
					date = new Date(closingDates[i + indexDiffs.price] * 1000).getMonth() + "m" + new Date(closingDates[i + indexDiffs.price] * 1000).getDate() + "d" + new Date(closingDates[i + indexDiffs.price] * 1000).getHours() + "h";

				//console.log(predictedIncrease, ((openingPrices[i + indexDiffs.price]/closingPrices[(i + indexDiffs.price)]) * 100) - 100, marketName);
				//if current trade
				if(activeTrade) {
					//sell
					var profitPercent = ((openingPrices[i + indexDiffs.price]/activeTrade.price) * 100) - 100;
					if(profitPercent < -15 || profitPercent > 5 || predictedIncrease[0] === 0 || activeTrade.skips > 48) {
						var percent = (((openingPrices[i + indexDiffs.price]/activeTrade.price) * 100) - 100),
							success = false,
							profit = openingPrices[i + indexDiffs.price] - activeTrade.price;
						if(percent > 0) {
							success = true;
						}
						var fiatPercent = (percent/100) * usTradePrice,
							days = ((activeTrade.skips * 4)/24);
						trades.push({"percent": percent, "success": success, "profit": profit, "fiat": fiatPercent, "days": days});
						activeTrade = null;
						console.log("SELL - " + date + "      $" + openingPrices[i + indexDiffs.price]);
						console.log("Percent: " + percent, " Fiat: $", fiatPercent);
					} else activeTrade.skips += 1;
				//if no active trade, looking to buy
				} else {
					if(predictedIncrease[0] > 0 && rsi[i + indexDiffs.rsi] > 50 && rsi[(i + indexDiffs.rsi) - 1] < 50) {
						activeTrade = {"price": openingPrices[i + indexDiffs.price], "date": new Date(closingDates[i + indexDiffs.price] * 1000), "skips": 0};
						console.log("\n" + "BUY - " + date + "      $" + openingPrices[i + indexDiffs.price]);
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