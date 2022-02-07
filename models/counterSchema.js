const mongoose = require('mongoose')

// 维护用户id自增长
const counterSchema = mongoose.Schema({
  _id: String,
  sequence_value: Number
})

module.exports = mongoose.model('counter', counterSchema, 'counters')