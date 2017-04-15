const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const ObjectId = Schema.ObjectId;

/* Create User model */
module.exports.User = mongoose.model('User', new Schema({
  id:           ObjectId,
  username:     { type: String, required: '{PATH} is required.',unique:true},
  first_name:   { type: String, required: '{PATH} is required.' },
  last_name:    { type: String, required: '{PATH} is required.' },
  city:         { type: String, required: '{PATH} is required.' },
  email:        { type: String, required: '{PATH} is required.',unique: true },
  password:     { type: String,  min: [6, 'Password must be at least 6 characters'], required: '{PATH} is required.' },
  isAuth:       {type:Boolean, default:false},
  resetPasswordToken: String,
  resetPasswordExpires: Date
}));
