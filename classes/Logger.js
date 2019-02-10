const fs = require('fs');

class Logger {
	
	constructor() {
		this.time = new Date(Date.now()).toLocaleString().split(',')[0];
		this.logFile = 'order-log.txt';
		this.errorLogFile = 'error-log.txt';
	}

	logBuy(message) {
		var date = new Date;
		var logMessage = `\n${this.time} at ${date.getHours()}:${date.getMinutes()} - BUY: ${message}`;
		fs.appendFileSync(this.logFile, logMessage);
	}

	logAlmostSold(message) {
		var date = new Date;
		var logMessage = `\n\n${this.time} at ${date.getHours()}:${date.getMinutes()} - ALMOST SOLD: ${message}\n`;
		fs.appendFileSync(this.logFile, logMessage);
	}

	logSell(message) {
		var date = new Date;
		var logMessage = `\n\n${this.time} at ${date.getHours()}:${date.getMinutes()} - SELL: ${message}\n`;
		fs.appendFileSync(this.logFile, logMessage);
	}

	logError(error) {
		var date = new Date;
		var logMessage = `\n${this.time} at ${date.getHours()}:${date.getMinutes()} - ${error}`;
		fs.appendFileSync(this.errorLogFile, logMessage);
	}
}

module.exports = Logger;