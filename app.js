const Koa = require('koa')
const app = new Koa()
const views = require('koa-views')
const json = require('koa-json')
const onerror = require('koa-onerror')
const bodyparser = require('koa-bodyparser')
const log4js = require('./utils/log4j')
const koajwt = require('koa-jwt')
const utils = require('./utils/utils')

const users = require('./routes/users')
const menus = require('./routes/menus')
const roles = require('./routes/roles')
const depts = require('./routes/depts')
const leaves = require('./routes/leaves')

// error handler
onerror(app)
require('./config/db')
// middlewares
app.use(bodyparser({
  enableTypes: ['json', 'form', 'text']
}))
app.use(json())
app.use(require('koa-static')(__dirname + '/public'))

app.use(views(__dirname + '/views', {
  extension: 'pug'
}))

// logger
app.use(async (ctx, next) => {
  log4js.info(`get params: ${JSON.stringify(ctx.request.query)}`)
  log4js.info(`post params: ${JSON.stringify(ctx.request.body)}`)
  const start = new Date()
  await next().catch(err => {
    if (err.status === 401) {
      ctx.status = 200
      ctx.body = utils.fail('Token认证失败', utils.CODE.AUTH_ERROR)
    } else {
      throw err
    }
  })
  const ms = new Date() - start
  log4js.info(`${ctx.method} ${ctx.url} - ${ms}ms`)
})

app.use(koajwt({ secret: 'miyao' }).unless({ path: [/\/users\/login/] }))

// routes
app.use(users.routes(), users.allowedMethods())
app.use(menus.routes(), menus.allowedMethods())
app.use(roles.routes(), roles.allowedMethods())
app.use(depts.routes(), depts.allowedMethods())
app.use(leaves.routes(), leaves.allowedMethods())

// error-handling
app.on('error', (err, ctx) => {
  console.error('server error', err, ctx)
});

module.exports = app
