const router = require('koa-router')()
const utils = require('../utils/utils')
const jwt = require('jsonwebtoken');
const User = require('../models/userSchema')
const Menu = require('../models/menuSchema')
const Role = require('../models/roleSchema')
const Counter = require('../models/counterSchema')
const md5 = require('md5')
router.prefix('/users')

// 登录
router.post('/login', async (ctx, next) => {
  try {
    const { userName, userPwd } = ctx.request.body
    /**
     * 返回指定字段的三种方式
     * 1. 'userId userName userEmail state role deptId roleList'
     * 2. {userId: 1,} || {userId: 0} 要么都是 1 要么都是 0 不可 0 1 混用
     * 3. .select('userName')
     */
    let md5Pwd = userName !== 'admin' ? md5(userPwd) : userPwd
    const res = await User.findOne({
      userName,
      userPwd: md5Pwd
    }, 'userId userName userEmail state role deptId roleList')
    if (res) {
      const data = res._doc
      const token = jwt.sign({
        data,
      }, 'miyao', { expiresIn: '1h' })
      data.token = token
      ctx.body = utils.success(data)
    } else {
      ctx.body = utils.fail('账号或者密码错误')
    }
  } catch (error) {
    console.log(error);
    ctx.body = utils.fail(error.msg)
  }
})

// 列表
router.get('/list', async (ctx) => {
  const { userId, userName, state } = ctx.request.query
  const { page, skipIndex } = utils.pager(ctx.request.query)
  let params = {}
  if (userId) params.userId = userId
  if (userName) params.userName = userName
  if (state && state != '0') params.state = state
  try {
    const query = User.find(params, { _id: 0, userPwd: 0 })
    const list = await query.skip(skipIndex).limit(page.pageSize)
    const total = await User.countDocuments(params)
    ctx.body = utils.success({
      page: {
        ...page,
        total
      },
      list
    })
  } catch (error) {
    ctx.body = utils.fail(`查询异常: ${error.stack}`)
  }
})

// 删除 改变状态为 离职
router.post('/delete', async (ctx) => {
  try {
    const { userIds } = ctx.request.body
    // User.updateMany({ $or: [{userId: 10001}, {userId: 10002}] })
    const res = await User.updateMany({ userId: { $in: userIds } }, { state: 2 })
    if (res.nModified) {
      ctx.body = utils.success(res, `共删除成功${res.nModified}条`)
      return
    }
    ctx.body = utils.fail('删除失败')
  } catch (error) {
    ctx.body = utils.fail('删除失败:' + error.stack)
  }
})

// 新增/编辑
router.post('/operate', async (ctx) => {
  const { userId, userName, userEmail, mobile, job, state, roleList, deptId, action } = ctx.request.body
  if (action === 'add') { //新增
    if (!userName || !userEmail || !deptId) {
      ctx.body = utils.fail('参数错误', utils.CODE.PARAM_ERROR)
      return
    }
    // { new: true } 返回更新后的文档
    try {
      const res = await User.findOne({ $or: [{ userName }, { userEmail }] }, 'userName userEmail')
      if (res) {
        ctx.body = utils.fail(`系统检测到有重复的用户，信息如下: ${res.userName} - ${res.userEmail}`)
      } else {
        try {
          const doc = await Counter.findOneAndUpdate({ _id: 'userId' }, { $inc: { sequence_value: 1 } }, { new: true })
          const user = new User({
            userId: doc.sequence_value,
            userName,
            userEmail,
            mobile,
            job,
            state,
            roleList,
            deptId,
            userPwd: md5('123456')
          })
          user.save()
          ctx.body = utils.success({}, '用户创建成功')
        } catch (error) {
          ctx.body = utils.fail(`用户创建失败: ${error.stack}`)
        }
      }
    } catch (error) {
      ctx.body = utils.fail(`操作异常: ${error.stack}`)
    }
  } else { //编辑
    if (!deptId) {
      ctx.body = utils.fail('部门不能为空', utils.CODE.PARAM_ERROR)
      return
    }
    try {
      const res = await User.findOneAndUpdate({ userId }, { mobile, job, state, roleList, deptId })
      ctx.body = utils.success({}, '更新成功')
    } catch (error) {
      ctx.body = utils.fail(res, '更新失败')
    }
  }
})

// 获取全量用户列表 离职的不查
router.get('/all/list', async (ctx) => {
  try {
    const list = await User.find({state:{$in: [1,3]}}, 'userName userId userEmail')
    ctx.body = utils.success(list)
  } catch (error) {
    ctx.body = utils.fail(error.stack)
  }
})

// 获取用户对应的权限菜单
router.get('/getPermissionList', async (ctx) => {
  let authorization = ctx.request.headers.authorization
  let { data } = utils.decoded(authorization)
  let menuList = await getMenuList(data.role, data.roleList)
  // 获取操作按钮
  let actionList = await getActionList(JSON.parse(JSON.stringify(menuList)))
  console.log(actionList)
  ctx.body = utils.success({ menuList, actionList })
})

// 获取菜单
async function getMenuList (userRole, roleKeys) {
  let rootList = []
  if (userRole == 0) { //系统管理员
    rootList = await Menu.find({}) || []
  } else {
    //根据用户拥有的角色，获取权限列表
    //先查找用户对应的角色列表数据 roleKeys: ["60fe7bb6cc0aed3264d29918", "60fe7b94cc0aed3264d29904"]
    let roleList = await Role.find({ _id: { $in: roleKeys } })
    let permissionList = []
    roleList.map(role => {
      let { checkedKeys, halfCheckedKeys } = role.permissionList
      // 将所有角色具有的权限进行合并
      permissionList = permissionList.concat([...checkedKeys, ...halfCheckedKeys])
    })
    // 去重
    permissionList = [...new Set(permissionList)]
    // 找到所有在 permissionList 里面的菜单数据
    rootList = await Menu.find({ _id: { $in: permissionList } })
  }
  // 生成菜单树
  return utils.getTreeMenu(rootList, null, [])
}

// 获取操作按钮
async function getActionList (list) {
  const actionList = []
  const deep = (arr) => {
    while (arr.length) {
      let item = arr.pop()
      if (item.action) {
        item.action.map(action => {
          actionList.push(action.menuCode)
        })
      }
      if (item.children && !item.action) {
        deep(item.children)
      }
    }
  }
  deep(list)
  return actionList
}

module.exports = router
