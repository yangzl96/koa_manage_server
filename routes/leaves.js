const router = require('koa-router')()
const utils = require('../utils/utils')
const jwt = require('jsonwebtoken')
const Leave = require('../models/leaveSchema')
const Dept = require('../models/deptSchema')
router.prefix('/leave')

// 查看申请列表
router.get('/list', async (ctx) => {
  const { applyState, type } = ctx.request.query
  const { page, skipIndex } = utils.pager(ctx.request.query)
  let authorization = ctx.request.headers.authorization
  let { data } = utils.decoded(authorization)
  try {
    let params = {}
    if (type === 'approve') { //有审批权利的人
      if (applyState == 1 || applyState == 2) { //查询参数是 待审批/审批中
        params.curAuditUserName = data.userName
        // 第一级审批人applyState是1 审批通过后 第二级审批人applyState是2了
        // 所以库里面要查等于1的或者等于2的
        params.$or = [{ applyState: 1 }, { applyState: 2 }]
      } else if (applyState > 2) { //审批通过、审批拒绝
        // 子查询 审批流中有关于当前这个审批人的同时状态满足的
        params = { 'auditFlows.userId': data.userId, applyState }
      } else { //查询所有流程 关于当前审批人的
        params = { 'auditFlows.userId': data.userId }
      }
    } else {
      // 查询所有
      params = {
        'applyUser.userId': data.userId
      }
      if (applyState) params.applyState = applyState
    }
    // await Leave.find() 不可取 会影响query.skip链式调用
    console.log('=>=>=>=>=>' + JSON.stringify(params))
    const query = Leave.find(params)
    const list = await query.skip(skipIndex).limit(page.pageSize)
    const total = await Leave.countDocuments(params)
    ctx.body = utils.success({
      page: {
        ...page,
        total
      },
      list
    })
  } catch (error) {
    ctx.body = utils.fail(`查询失败: ${error.stack}`)
  }
})


router.post('/operate', async (ctx) => {
  const { _id, action, ...params } = ctx.request.body
  let authorization = ctx.request.headers.authorization
  let { data } = utils.decoded(authorization)

  // 创建申请
  if (action === 'create') {
    // 生成申请单号
    let orderNo = 'XJ'
    const total = await Leave.countDocuments()
    orderNo += utils.formateDate(new Date(), 'yyyyMMdd') + total
    params.orderNo = orderNo

    // 获取用户当前所在部门的 ID
    let id = data.deptId.pop()
    // 根据部门信息 查找负责人
    let dept = await Dept.findById(id)
    // 获取人事部门和财务部门负责人信息
    let userList = await Dept.find({ deptName: { $in: ['人事部门', '财务部门'] } })
    // 审批人
    let auditUsers = dept.userName
    // 审批流
    let auditFlows = [
      { userId: dept.userId, userName: dept.userName, userEmail: dept.userEmail }
    ]
    userList.map(item => {
      auditFlows.push({
        userId: item.userId, userName: item.userName, userEmail: item.userEmail
      })
      // 拼接审批人
      auditUsers += ',' + item.userName
    })
    // 当前审批人
    params.curAuditUserName = dept.userName
    params.auditUsers = auditUsers
    params.auditFlows = auditFlows
    params.auditLogs = []
    params.applyUser = {
      userId: data.userId,
      userName: data.userName,
      userEmail: data.userEmail,
    }
    let res = await Leave.create(params)
    ctx.body = utils.success('', '创建成功')
  } else { //作废
    await Leave.findByIdAndUpdate(_id, { applyState: 5 })
    ctx.body = utils.success('', '操作成功')
  }
})

// 审批
// 1待审批 2审批中 3审批拒绝 4审批通过 5作废
router.post('/approve', async (ctx) => {
  const { action, remark, _id } = ctx.request.body
  let authorization = ctx.request.headers.authorization
  let { data } = utils.decoded(authorization)
  let params = {}
  try {
    let doc = await Leave.findById(_id)
    let auditLogs = doc.auditLogs || []
    if (action === 'refuse') {
      // 拒绝
      params.applyState = 3
    } else {
      // 通过
      // 三次审批日志已经都写过了
      if (doc.auditFlows.length === doc.auditLogs.length) {
        ctx.body = utils.success('当前申请单已处理，请勿重复提交')
        return
      } else if (doc.auditFlows.length === doc.auditLogs.length + 1) {
        // 到最后一级审批了 通过就是通过
        params.applyState = 4
      } else if (doc.auditFlows.length > doc.auditLogs.length) {
        // 审批中 改变状态 将当前审批人更换到下一个
        params.applyState = 2
        params.curAuditUserName = doc.auditFlows[doc.auditLogs.length + 1].userName
      }
    }
    // 添加入审核流
    auditLogs.push({
      userId: data.userId,
      userName: data.userName,
      createTime: new Date(),
      remark,
      action: action === 'refuse' ? '审核拒绝' : '审核通过'
    })
    params.auditLogs = auditLogs
    let res = await Leave.findByIdAndUpdate(_id, params)
    ctx.body = utils.success('', '处理成功')
  } catch (error) {
    ctx.body = utils.fail(error.stack)
  }
})

// 查询当前用户的审批提醒个数
router.get('/count', async (ctx, next) => {
  let authorization = ctx.request.headers.authorization
  let { data } = utils.decoded(authorization)
  let params = {}
  try {
    params.curAuditUserName = data.userName
    params.$or = [{ applyState: 1 }, { applyState: 2 }]
    const total = await Leave.countDocuments(params)
    ctx.body = utils.success(total)
  } catch (error) {
    ctx.body = utils.fail(error.stack)
  }
})

module.exports = router