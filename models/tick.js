var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

var TickSchema = new Schema({
	marketName: { type: String, required: true },
	created_at: { type: Date, default: Date.now },
	close: { type: Number },
	open: { type: Number },
	high: { type: Number },
	low: { type: Number },
	volume: { type: Number },
	utcTime: { type: Number, default: utcTime },
	dateId: { type: String, default: defaultDateId }
});

//default dateId function
function defaultDateId() {
	return new Date(Date.now()).toLocaleString().split(',')[0];
}

function utcTime() {
	return Math.floor(new Date().getTime()/1000)
}

module.exports = mongoose.model('tick', TickSchema);