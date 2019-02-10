var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

var SellSchema = new Schema({
	marketName: { type: String, required: true },
	created_at: { type: Date, default: Date.now },
	quantity: { type: Number },
	pricePerBought: { type: Number },
	pricePerSold: { type: Number },
	profit: { type: Number },
	percent: { type: Number },
	dateId: { type: String, default: defaultDateId() }
});

//default dateId function
function defaultDateId() {
	return new Date(Date.now()).toLocaleString().split(',')[0];
}

module.exports = mongoose.model('sell', SellSchema);