var mongoose = require('mongoose'),
	Schema = mongoose.Schema;

var OpenOrderSchema = new Schema({
	marketName: { type: String, required: true },
	created_at: { type: Date, default: Date.now },
	quantity: { type: Number },
	pricePer: { type: Number },
	pricePerBought: { type: Number, default: null },
	orderType: { type: String },
	uuid: { type: String },
	total: { type: Number }
});

module.exports = mongoose.model('openorder', OpenOrderSchema);