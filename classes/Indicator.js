var Historical = require('./Historical'),
	histRef = new Historical,
	Database = require('./Database'),
	dbRef = new Database,
	Bittrex = require('./Bittrex'),
	apiRef = new Bittrex,
	mongoose = require('mongoose'),
	tulind = require('tulind'),
	async = require('async'),
	fs = require('fs'),
	ml = require('ml-regression'),
	SLR = ml.SLR,
	{Matrix} = require('ml-matrix'),
	LogRegression = require('ml-logistic-regression');

class Indicator {

	rvi(high, low, open, close, period) {
		var rvi = [],
			signal = [],
			value1 = [],
			value2 = [];
		for(var i=0;i<open.length;i++) {
			value1.push(((close[i] - open[i]) + (2 * (close[i - 1] - open[i - 1])) + (2 * (close[i - 2] - open[i - 2])) + (close[i - 3] - open[i - 3])) / 6);
			value2.push(((high[i] - low[i]) + (2 * (high[i - 1] - low[i - 1])) + (2 * (high[i - 2] - low[i - 2])) + (high[i - 3] - low[i - 3])) / 6);

			var num = 0,
				denum = 0;
			for(var k=0;k<period;k++) {
				num += value1[i - k];
				denum += value2[i - k];
			}
			rvi.push(num/denum);
			signal.push((rvi[i] + (2 * rvi[i - 1]) + (2 * rvi[i - 2]) + rvi[i - 3]) / 6);
		}
		return [rvi, signal];
	}

	logReg(high, low, open, close, volume, currentPrice) {
		return new Promise((resolve, reject) => {
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
			for(var i=0;i<(indResults[0].length - 1);i++) {
				var y = 0,
					closeOpenDiff = ((open[i + priceIndexDiff]/close[(i + priceIndexDiff)]) * 100) - 100;
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
				//shuffle data, create Y data arr from y data lumped into xData arr
				xData = shuffle(xData);
				var yData = [];
				for(var i=0;i<xData.length;i++) {
					yData.push(xData[i].pop());
				}
				var X = new Matrix(xData),
					Y = Matrix.columnVector(yData),
					logReg = new LogRegression({numSteps: 1000, learningRate: 5e-3});

				logReg.train(X, Y);
				var currentRunTest = [];

				currentRunTest.push(currentPrice);
				for(var i=0;i<indResults.length;i++) {
					currentRunTest.push(indResults[i][indResults[i].length - 1]);
				}
				var xTest = new Matrix([currentRunTest]),
					predictedIncrease = logReg.predict(xTest);
			} else {
				var predictedIncrease = [0];
			}

			resolve(predictedIncrease[0]);

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
		});
	}
}

module.exports = Indicator;