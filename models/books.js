const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

/* Create User model */
module.exports.Book = mongoose.model('Book', new Schema({
  id:           ObjectId,
  title:        {type: String, required: '{PATH} is required.'},
  url:          {type: String, required: '{PATH} is required.' },
  user:         {type: String, required: '{PATH} is required.' },
  hasRequested: {type:Boolean,default:true}
}));
