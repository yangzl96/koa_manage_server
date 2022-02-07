const router = require('koa-router')()
const utils = require('../utils/utils')
const Dept = require('../models/deptSchema')
router.prefix('/dept')

// 部门树形列表
router.get('/list', async (ctx) => {
  let { deptName } = ctx.request.query
  let params = {}
  if (deptName) params.deptName = deptName
  let rootList = await Dept.find(params)
  if (deptName) { //带参数的时候 直接返回某一个部门
    ctx.body = utils.success(rootList)
  } else { // 不带参数的时候 返回一个树形结构 
    let treeList = getTreeDept(rootList, null, [])
    ctx.body = utils.success(treeList)
  }
})
// 递归拼接树形列表
function getTreeDept (rootList, id, list) {
  for (let i = 0; i < rootList.length; i++) {
    let item = rootList[i]
    // id 是 objectId buffer类型 需要String一下
    if (String(item.parentId.slice().pop()) == String(id)) {
      console.log('item => ', item);
      // list.push(item) item可以获取对象 但是不能改变值(添加children数组) 需要push item._doc 他的原有文档
      list.push(item._doc)
    }
  }
  list.map(item => {
    item.children = []
    getTreeDept(rootList, item._id, item.children)
    if (item.children.length === 0) {
      delete item.children
    }
  })
  return list
}

// 部门 创建、编辑、删除
router.post('/operate', async (ctx) => {
  const { _id, action, ...params } = ctx.request.body
  let res, info
  try {
    if (action === 'create') {
      await Dept.create(params)
      info = '创建成功'
    } else if (action === 'edit') {
      await Dept.findByIdAndUpdate(_id, params)
      info = '编辑成功'
    } else if (action === 'delete') {
      // 删除当前部门要删除当前部门下面的所有子集
      await Dept.findByIdAndRemove(_id)
      // 删除所有parentId 存在当前被删除部门id的
      await Dept.deleteMany({ parentId: { $all: [_id] } })
      info = '删除成功'
    }
    ctx.body = utils.success('', info)
  } catch (error) {
    ctx.body = utils.fail(error.stack)
  }
})

module.exports = router