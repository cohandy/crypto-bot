var Bittrex = require('./Bittrex'),
	Logger = require('./Logger'),	
	apiRef = new Bittrex,
	log = new Logger;

class Bitcoin {

	constructor() {
		this.currentPrice = null;
		this.usdPerTrade = 200;
		this.btcPerTrade = null;
	}

	fetchCurrentPrice() {
		return new Promise((resolve, reject) => {
			apiRef.getMarketSummary('USDT-BTC').then((data) => {
				this.currentPrice = data[0].Last;
				var percentInUsd = (this.usdPerTrade/this.currentPrice) * 100;
				this.btcPerTrade = (percentInUsd * 1)/100;
				resolve(this.btcPerTrade);
			}).catch((err) => {
				log.logError("Failed to get current BTC USD price");
				reject(err);
			});
		});
	}

	calculateTotal(total) {
		if(this.currentPrice) {
			var percentInUsd = (total/this.currentPrice) * 100;
			return (percentInUsd * 1)/100;
		} else {
			return null;
		}
	}

	getTradePrice() {
		return this.btcPerTrade;
	}

	btcToUsd(totalBtc) {
		if(this.currentPrice) {
			var percentInBtc = (totalBtc/1) * 100;
			return (percentInBtc * this.currentPrice)/100;
		} else {
			return null;
		}
	}
}

module.exports = Bitcoin;