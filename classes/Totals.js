var mongoose = require('mongoose'),
	Models = require('../models/index'),
	Logger = require('./Logger'),
	Bitcoin = require('./Bitcoin'),
	btc = new Bitcoin,
	log = new Logger,
	async = require('async');

class Totals {

	calculateProfit(timeFrame="all") {
		var sellObj = {}
		switch(timeFrame) {
			case "day": {
				sellObj.dateId = new Date(Date.now()).toLocaleString().split(',')[0];
			}
		}
		return new Promise((resolve, reject) => {
			Models.sell.find(sellObj).exec((err, sells) => {
				if(err) {
					reject(err);		
				} else {
					var total = 0,
						percent = 0;
					for(var i=0;i<sells.length;i++) {
						total += sells[i].profit;
						percent += sells[i].percent;
					}
					btc.fetchCurrentPrice().then(() => {
						var totalUsd = btc.btcToUsd(total),
							message = `${timeFrame} total in BTC: ${total}\n${timeFrame} total in USD: ${totalUsd}\nPercent Gain/Loss: ${percent}`
						console.log(message);
						resolve(message);
					}).catch((err) => {
						reject(err);
					});
				}
			});
		});
	}
}

module.exports = Totals;