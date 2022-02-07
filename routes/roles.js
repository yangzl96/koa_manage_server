const router = require('koa-router')()
const utils = require('../utils/utils')
const Role = require('../models/roleSchema')
router.prefix('/roles')

// 所有角色列表
router.get('/allList', async (ctx) => {
  const list = await Role.find({}, '_id roleName')
  ctx.body = utils.success(list)
})

// 分页获取角色列表
router.get('/list', async (ctx) => {
  const { roleName } = ctx.request.query
  const { page, skipIndex } = utils.pager(ctx.request.query)
  try {
    let params = {}
    if (roleName) params.roleName = roleName
    const query = Role.find(params)
    const list = await query.skip(skipIndex).limit(page.pageSize)
    const total = await Role.countDocuments(params)
    ctx.body = utils.success({
      list,
      page: {
        ...page,
        total
      }
    })
  } catch (error) {
    ctx.body = utils.fail(`查询失败: ${eror.stack}`)
  }
})

// 角色操作 创建、编辑、删除
router.post('/operate', async (ctx) => {
  const { _id, roleName, remark, action } = ctx.request.body
  let res, info
  try {
    if (action === 'create') {
      res = await Role.create({ roleName, remark })
      info = '创建成功'
    } else if (action === 'edit') {
      if (_id) {
        let params = { roleName, remark }
        params.updateTime = new Date()
        res = await Role.findByIdAndUpdate(_id, params)
        info = '编辑成功'
      } else {
        ctx.body = utils.fail(`缺少必要参数: _id`)
        return
      }
    } else {
      res = await Role.findByIdAndRemove(_id)
      info = '删除成功'
    }
    ctx.body = utils.success(res, info)
  } catch (error) {
    ctx.body = utils.fail(`操作失败: ${eror.stack}`)
  }
})

// 权限设置
router.post('/update/permissionList', async (ctx) => {
  const { _id, permissionList } = ctx.request.body
  try {
    let params = { permissionList, updateTime: new Date() }
    await Role.findByIdAndUpdate(_id, params)
    ctx.body = utils.success({}, '权限设置成功')
  } catch (error) {
    ctx.body = utils.fail({}, '权限设置失败')
  }
})

module.exports = router