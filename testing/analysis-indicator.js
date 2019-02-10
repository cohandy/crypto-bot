var	Indicator = require('../classes/Indicator'),
	customIndicator = new Indicator,
	tulind = require('tulind');

var indicators = [
	{
		name: "cci",
		test: function(data, index, prices, priceIndex, buy) {
			var cci = data[0];
			if(buy) {
				if(cci[index] > 125 && cci[index] < 200) {
					return true;
				} else return false;
			} else {
				if(cci[index] < 100) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.cci.indicator([highPrices, lowPrices, closePrices], ['20'], (err, results) => {
				if(err) console.log(err, "error from tulind");
				data = results;
			});
			return data;
		}
	},
	{
		name: "trix",
		test: function(data, index, prices, priceIndex, buy) {
			var trixPass = false,
				trix = data[0];
			if(buy) {
				if(trix[index] > 0 || trix[index] > -30 && trix[index] > trix[index - 1]) {
					trixPass = true;
				}
			} else {
				if(trix[index] < 0 || trix[index] < 30 && trix[index] < trix[index - 1]) {
					trixPass = true;
				}
			}
			return trixPass;
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.trix.indicator([closePrices], ['18'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "rvi",
		test: function(data, index, prices, priceIndex, buy) {
			var rvi = data[0],
				rviSignal = data[1];
			if(buy) {
				var rviCrossed = false;
				for(var k=1;k<=3;k++) {
					var rviTick = rvi[index - k],
						rviSignalTick = rviSignal[index - k];

					if(rviTick < rviSignalTick) {
						rviCrossed = true;
					}
				}
				if(rvi[index] > rviSignal[index] && rviCrossed) {
					return true;
				} else return false;
			} else {
				if(rvi[index] < rviSignal[index]) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var rviCalc = customIndicator.rvi(highPrices, lowPrices, openPrices, closePrices, 10);
			return rviCalc;
		}
	},
	{
		name: "bbands",
		test: function(data, index, prices, priceIndex, buy) {
			var bbandsTop = data[2],
				bbandsBottom =data[0];
			if(buy) {
				if(prices[priceIndex] > bbandsTop[index]) {
					return true;
				} else return false;
			} else {
				if(prices[priceIndex] < bbandsBottom[index]) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.bbands.indicator([closePrices], ['20', '2'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "ad",
		test: function(data, index, prices, priceIndex, buy) {
			var ad = data[0],
				priceRise = true,
				adRise = true;
			for(var i=1;i<=3;i++) {
				if(prices[priceIndex - i] > prices[priceIndex]) {
					priceRise = false;
				} else {
					priceRise = true;
				}
				if(ad[index] < ad[index - i]) {
					adRise = false;
				} else adRise = true;
			}
			if(buy) {
				if(!priceRise && adRise && prices[priceIndex] < prices[priceIndex - 6]) {
					return true;
				} else return false;
			} else {
				if(priceRise && !adRise) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.ad.indicator([highPrices, lowPrices, closePrices, volume], [], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "chaikin-osc",
		test: function(data, index, prices, priceIndex, buy) {
			var chaikin = data[0];
			if(buy) {
				if(chaikin[index] > 0 && chaikin[index - 1] < 0) {
					return true;
				} else return false;
			} else {
				if(chaikin[index] < 0) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.adosc.indicator([highPrices, lowPrices, closePrices, volume], ['3', '10'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "adx",
		test: function(data, index, prices, priceIndex, buy) {
			var adx = data[0],
				adxRiseCount = 0,
				priceRiseCount = 0;
			for(var i=1;i<=3;i++) {
				if(adx[index] > adx[index - i]) {
					adxRiseCount++;
				}
				if(prices[priceIndex] > prices[priceIndex - i]) {
					priceRiseCount++;
				}
			}
			if(buy) {
				if(adx[index] > 25 && adxRiseCount === 3 && priceRiseCount === 3) {
					return true;
				} else return false;
			} else {
				if(adxRiseCount === 0 && priceRiseCount === 0) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.adx.indicator([highPrices, lowPrices, closePrices], ['14'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "awesome oscillator (ao)",
		test: function(data, index, prices, priceIndex, buy) {
			var ao = data[0];
			if(buy) {
				if(ao[index] > 0 && ao[index - 1] <= 0) {
					return true;
				} else return false;
			} else {
				if(ao[index] < 0) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.ao.indicator([highPrices, lowPrices], [], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "absolute price oscillator (apo)",
		test: function(data, index, prices, priceIndex, buy) {
			var apo = data[0];
			if(buy) {
				if(apo[index] > 0 && apo[index - 1] < 0) {
					return true;
				} else return false;
			} else {
				if(apo[index] < 0) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.apo.indicator([closePrices], ['10', '20'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "aroon",
		test: function(data, index, prices, priceIndex, buy) {
			var aroonDown = data[0],
				aroonUp = data[1];
			if(buy) {
				if(aroonUp[index] > aroonDown[index] && aroonUp[index - 1] < aroonDown[index - 1] && aroonUp[index] > 40) {
					return true;
				} else return false;
			} else {
				if(aroonUp[index] < aroonDown[index]) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.aroon.indicator([highPrices, lowPrices], ['14'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "average true range (atr)",
		test: function(data, index, prices, priceIndex, buy) {
			var atr = data[0],
				atrRiseCount = 0,
				priceRiseCount = 0;
			for(var i=1;i<=3;i++) {
				if(atr[index] > atr[index - i]) {
					atrRiseCount++;
				}
				if(prices[priceIndex] > prices[priceIndex - i]) {
					priceRiseCount++;
				}
			}
			if(buy) {
				if(atrRiseCount === 3 && priceRiseCount === 3) {
					return true;
				} else return false;
			} else {
				if(atrRiseCount === 0 && priceRiseCount === 0) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.atr.indicator([highPrices, lowPrices, closePrices], ['14'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "balance of power (bop)",
		test: function(data, index, prices, priceIndex, buy) {
			var bop = data[0];
			if(buy) {
				if(bop[index] > 0) {
					return true;
				} else return false;
			} else {
				if(bop[index] < 0) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.bop.indicator([openPrices, highPrices, lowPrices, closePrices], [], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "chande momentum oscillator (cmo)",
		test: function(data, index, prices, priceIndex, buy) {
			var cmo = data[0];
			if(buy) {
				if(cmo[index] > 0 && cmo[index - 1] < 0) {
					return true;
				} else return false;
			} else {
				if(cmo[index] < 0) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.cmo.indicator([closePrices], ['9'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "chaikins volatility (cvi)",
		test: function(data, index, prices, priceIndex, buy) {
			var cvi = data[0],
				cviDipCount = 0;
			for(var i=1;i<=3;i++) {
				if(cvi[index] < cvi[index - i]) {
					cviDipCount++;
				}
			}
			if(buy) {
				if(cvi[index] > 0 && cvi[index - 1] < 0) {
					return true;
				} else return false;
			} else {
				if(cviDipCount === 3) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.cvi.indicator([highPrices, lowPrices], ['10'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "directional movement (dm)",
		test: function(data, index, prices, priceIndex, buy) {
			var dmMinus = data[1],
				dmPlus = data[0];
			if(buy) {
				if(dmPlus[index] > dmMinus[index] && dmPlus[index - 1] < dmMinus[index - 1] && dmPlus[index] > 20) {
					return true;
				} else return false;
			} else {
				if(dmPlus[index] < dmMinus[index]) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.dm.indicator([highPrices, lowPrices], ['14'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "detrended price oscillator (dpo)",
		test: function(data, index, prices, priceIndex, buy) {
			var dpo = data[0];
			if(buy) {
				if(dpo[index] > 0 && dpo[index - 1] < 0) {
					return true;
				} else return false;
			} else {
				if(dpo[index] < 0) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.dpo.indicator([closePrices], ['21'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "ease of movement (emv)",
		test: function(data, index, prices, priceIndex, buy) {
			var emv = data[0];
			if(buy) {
				if(emv[index] > 0) {
					return true;
				} else return false;
			} else {
				if(emv[index] < 0) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.emv.indicator([highPrices, lowPrices, volume], [], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "fisher transform (fisher)",
		test: function(data, index, prices, priceIndex, buy) {
			var signal = data[1],
				fisher = data[0];
			if(buy) {
				if(fisher[index] > signal[index] && fisher[index - 1] < signal[index - 1] && fisher[index] > 20) {
					return true;
				} else return false;
			} else {
				if(fisher[index] < signal[index]) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.fisher.indicator([highPrices, lowPrices], ['9'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "forecast oscillator (fosc)",
		test: function(data, index, prices, priceIndex, buy) {
			var fosc = data[0];
			if(buy) {
				if(fosc[index] > 0) {
					return true;
				} else return false;
			} else {
				if(fosc[index] < 0) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.fosc.indicator([closePrices], ['14'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	/*
	{
		name: "klinger oscillator (kvo)",
		test: function(data, index, prices, priceIndex, buy) {
			var signal = data[0],
				kvo = data[1];
			if(buy) {
				if(kvo[index] > signal[index] && kvo[index - 1] < signal[index - 1]) {
					return true;
				} else return false;
			} else {
				if(kvo[index] < signal[index]) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.kvo.indicator([highPrices, lowPrices, closePrices, volume], ['13', '26'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	*/
	{
		name: "linear regression intercept (linregintercept)",
		test: function(data, index, prices, priceIndex, buy) {
			var linReg = data[0];
			if(buy) {
				if(prices[priceIndex] > linReg[index]) {
					return true;
				} else return false;
			} else {
				if(prices[priceIndex] < linReg[index]) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.linregintercept.indicator([closePrices], ['5'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "macd",
		test: function(data, index, prices, priceIndex, buy) {
			var signal = data[1],
				macd = data[0];
			if(buy) {
				if(macd[index] > signal[index] && macd[index - 1] < signal[index - 1]) {
					return true;
				} else return false;
			} else {
				if(macd[index] < signal[index]) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.macd.indicator([closePrices], ['12', '26', '9'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "money flow index (mfi)",
		test: function(data, index, prices, priceIndex, buy) {
			var mfi = data[0];
			if(buy) {
				if(mfi[index] > 20 && mfi[index - 1] < 20) {
					return true;
				} else return false;
			} else {
				if(mfi[index] > 75) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.mfi.indicator([highPrices, lowPrices, closePrices, volume], ['14'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "negative volume index (nvi)",
		test: function(data, index, prices, priceIndex, buy) {
			var nvi = data[0];
			if(buy) {
				if(nvi[index] > 1000) {
					return true;
				} else return false;
			} else {
				if(nvi[index] < 1000) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.nvi.indicator([closePrices, volume], [], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "positive volume index (pvi)",
		test: function(data, index, prices, priceIndex, buy) {
			var nvi = data[0];
			if(buy) {
				if(nvi[index] > 1000) {
					return true;
				} else return false;
			} else {
				if(nvi[index] < 1000) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.pvi.indicator([closePrices, volume], [], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "rate of change (roc)",
		test: function(data, index, prices, priceIndex, buy) {
			var roc = data[0];
			if(buy) {
				if(roc[index] > 0) {
					return true;
				} else return false;
			} else {
				if(roc[index] < 0) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.roc.indicator([closePrices], ['9'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "relative strength index (rsi)",
		test: function(data, index, prices, priceIndex, buy) {
			var rsi = data[0];
			if(buy) {
				if(rsi[index] > 45 && rsi[index - 1] < 45) {
					return true;
				} else return false;
			} else {
				var decline = 0,
					lastTick = rsi[index];
				for(var i=1;i<=25;i++) {
					if(lastTick < rsi[index - i]) {
						decline++;
					}
					lastTick = rsi[index - i];
				}
				if(rsi[index] > 70) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.rsi.indicator([closePrices], ['14'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "stoch",
		test: function(data, index, prices, priceIndex, buy) {
			var d = data[1],
				k = data[0];
			if(buy) {
				if(k[index] > d[index] && k[index - 1] < d[index - 1]) {
					return true;
				} else return false;
			} else {
				if(k[index] < d[index]) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.stoch.indicator([highPrices, lowPrices, closePrices], ['14', '13', '1'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "ultimate oscillator (ultosc)",
		test: function(data, index, prices, priceIndex, buy) {
			var ultosc = data[0];
			if(buy) {
				if(ultosc[index] > 40 && ultosc[index - 1] < 40) {
					return true;
				} else return false;
			} else {
				if(ultosc[index] > 70) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.ultosc.indicator([highPrices, lowPrices, closePrices], ['7', '14', '28'], (err, results) => {
				data = results;
			});
			return data;
		}
	},
	{
		name: "williams %R (willr)",
		test: function(data, index, prices, priceIndex, buy) {
			var willr = data[0];
			if(buy) {
				if(willr[index] > -80 && willr[index - 1] < -80) {
					return true;
				} else return false;
			} else {
				if(willr[index] > -20) {
					return true;
				} else return false;
			}
		},
		getData: function(highPrices, lowPrices, openPrices, closePrices, volume) {
			var data = [];
			tulind.indicators.willr.indicator([highPrices, lowPrices, closePrices], ['14'], (err, results) => {
				data = results;
			});
			return data;
		}
	}
]

module.exports = indicators;