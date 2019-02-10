var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

var ActiveCoinSchema = new Schema({
	marketName: { type: String, required: true },
	created_at: { type: Date, default: Date.now },
	quantity: { type: Number },
	utcTime: { type: Number, default: utcTime },
	pricePer: { type: Number }
});

function utcTime() {
	return Math.floor(new Date().getTime()/1000);
}

module.exports = mongoose.model('activecoin', ActiveCoinSchema);