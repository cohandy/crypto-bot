var Bittrex = require('./classes/bittrex'),
	Database = require('./classes/Database'),
	async = require('async'),
	apiRef = new Bittrex,
	dbRef = new Database,
	Historical = require('./classes/Historical'),
	histRef = new Historical,
	mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/bittrex-trader-v2', { useMongoClient: true });
mongoose.connection.on('open', function() {
	console.log('\nmongoose connected\n');
	start();
})

function start() {
	if(process.argv[2] === "market") {

	} else if(process.argv[2] === "data") {
		switch(process.argv[3]) {
			case 'refresh-ticks': {
				refreshTickData();
				break;
			}
			case 'delete-trades': {
				deleteTrades();
				break;
			}
		}
	}
}

function refreshTickData() {
	dbRef.deleteTicks().then(() => {
		return histRef.recordPastHours();
	}).then(() => {
		console.log("done refreshing tick data");
		process.exit(-1);
	}).catch((err) => {
		console.log(err);
		process.exit(-1);
	})
}

function deleteTrades() {
	//clear data from my db
	dbRef.clearTradeData().then(() => {
		console.log("done deleting trades");
		process.exit(-1);
	}).catch((err) => {
		console.log(err);
		process.exit(-1);
	});
}