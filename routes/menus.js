const router = require('koa-router')()
const utils = require('../utils/utils')
const Menu = require('../models/menuSchema')

router.prefix('/menu')

// 菜单新增/编辑/删除
router.post('/operate', async (ctx) => {
  const { _id, action, ...params } = ctx.request.body
  let res, info;
  try {
    if (action === 'add') {
      res = await Menu.create(params)
      info = '创建成功'
    } else if (action === 'edit') {
      params.updateTime = new Date()
      res = await Menu.findByIdAndUpdate(_id, params)
      info = '编辑成功'
    } else {
      res = await Menu.findByIdAndDelete(_id)
      // 删除当前菜单_id 所有的关联
      // 菜单集合中只要包含当前_id的都删除
      await Menu.deleteMany({ parentId: { $all: [_id] } })
      info = '删除成功'
    }
    ctx.body = utils.success('', info)
  } catch (error) {
    ctx.body = utils.fail('删除失败', error.stack)
  }
})

// 菜单列表
router.get('/list', async (ctx) => {
  const { menuName, menuState } = ctx.request.query
  const params = {}
  if (menuName) params.menuName = menuName
  if (menuState) params.menuState = menuState
  let rootList = await Menu.find(params) || []
  const permissionList = utils.getTreeMenu(rootList, null, [])
  ctx.body = utils.success(permissionList)
})


module.exports = router
