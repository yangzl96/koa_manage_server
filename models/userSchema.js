const mongoose = require('mongoose')

const userSchema = mongoose.Schema({
  "userId": Number,
  "userName": String,
  "userPwd": String,
  "userEmail": String,
  "mobile": String,
  "sex": Number,
  "deptId": [],
  "job": String,
  "state": {
    type: Number,
    default: 1 //1在职 2离职 3试用期
  },
  "role": {
    type: Number,
    default: 1 // 0系统管理员 1 普通用户
  },
  "roleList": [], //系统角色 
  "createTime": {
    type: Date,
    default: Date.now()
  },
  "lastLoginTime": {
    type: Date,
    default: Date.now()
  },
  "remark": String
})

module.exports = mongoose.model('users', userSchema, 'users')