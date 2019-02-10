var request = require('request'),
	cc = require('cryptocompare');

global.fetch = require('node-fetch')


class CryptoCompare {

	getPastDailyValues(coin, days=100) {
		return new Promise((resolve, reject) => {
			var baseUrl = 'https://min-api.cryptocompare.com/data/histoday';

			var url = baseUrl + `?fsym=${coin}&tsym=BTC&e=BitTrex&limit=${days}`;
			var options = {
				url: url,
				method: "GET"
			}
			request(options, (err, resp, body) => {
				if(err) {
					reject(err);
				} else {
					var json = JSON.parse(body);
					if(json.Response === "Success") {
						resolve(json.Data);
					} else {
						reject(err);
					}
				}
			});
		});
	}

	getPastHourlyValues(coin) {
		return new Promise((resolve, reject) => {
			cc.histoHour(coin, 'BTC', { limit: 200, exchange: 'BitTrex'}).then((data) => {
				console.log(data[data.length - 1]);
				resolve(data);
			}).catch((err) => {
				console.log(coin + "api couldn't find it");
				resolve([]);
			});
		});
	}
}

module.exports = CryptoCompare;