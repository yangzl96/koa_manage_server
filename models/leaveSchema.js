const mongoose = require('mongoose')


const leaveSchema = mongoose.Schema({
  orderNo: String,
  applyType: Number, //申请类型
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date, default: Date.now },
  applyUser: { //申请人
    userId: String,
    userName: String,
    userEmail: String
  },
  leaveTime: String,
  reasons: String,
  auditUsers: String, //完整审批人
  curAuditUserName: String, //当前审批人
  auditFlows: [ //审批人流
    {
      userId: String,
      userName: String,
      userEmail: String
    }
  ],
  auditLogs: [ //审批流程日志
    {
      userId: String,
      userName: String,
      createTime: Date,
      remark: String,
      action: String
    }
  ],
  applyState: { type: Number, default: 1 },
  createTime: { type: Date, default: Date.now }
})

module.exports = mongoose.model('leave', leaveSchema, 'leaves')