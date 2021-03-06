const path = require('path')
const express = require('express')
const mime = require('mime')
const webpack = require('webpack')
const MemoryFileSystem = require('memory-fs')
const config = require('./webpack.config')

const compiler = webpack(config)
class Server {
  constructor(compiler) {
    this.compiler = compiler
    let sockets = []
    let lastHash

    //向 done hook 上挂载回调，每次编译完成通过 ws 连接通知客户端
    compiler.hooks.done.tap('webpack-dev-server', stats => {
      //两次编译结果没有变化
      if (lastHash === stats.hash) return
      lastHash = stats.hash
      sockets.forEach(socket => {
        // 先向客户端发送最新的hash值
        socket.emit('hash', stats.hash)
        // 再向客户端发送一个ok
        socket.emit('ok')
      })
    })

    let app = new express()

    // 以监控的模块启动一次webpack编译，当编译成功之后执行回调
    // 每次编译都会产生一个hash值，另外如果是热更新的话，还会产出二个补丁文件。
    // 里面描述了从上一次结果到这一次结果都有哪些chunk和模块发生了变化
    compiler.watch({}, err => {
      console.log('compiled')
    })

    // 如果你把compiler的输出文件系统改成了 MemoryFileSystem的话，则以后再产出文件都打包内存里去了
    let fs = new MemoryFileSystem()
    compiler.outputFileSystem = fs

    function middleware(req, res, next) {
      if (req.url === '/favicon.ico') {
        return res.sendStatus(404)
      }
      let filename = path.join(config.output.path, req.url.slice(1))
      let stat = fs.statSync(filename)
      if (stat.isFile()) {
        // 判断是否存在这个文件,如果在的话直接把这个读出来发给浏览器
        let content = fs.readFileSync(filename)
        let contentType = mime.getType(filename)
        res.setHeader('Content-Type', contentType)
        res.statusCode = res.statusCode || 200
        res.send(content)
      } else {
        // next()
        return res.sendStatus(404)
      }
    }
    // express app  其实是一个请求监听函数
    app.use(middleware)
    this.server = require('http').createServer(app)
    let io = require('socket.io')(this.server)
    // 启动一个 websocket服务器，然后等待连接来到
    // 连接成功时，立马发送当前编译结果的hash值
    io.on('connection', socket => {
      sockets.push(socket)
      socket.emit('hash', lastHash)
      socket.emit('ok')
    })
  }
  listen(port) {
    this.server.listen(port, () => {
      console.log(`Project is running at http://127.0.0.1:${port}/index.html`)
    })
  }
}
let server = new Server(compiler)
server.listen(8000)
