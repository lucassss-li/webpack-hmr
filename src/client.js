//连接 ws
let socket = io('/')
class Emitter {
  constructor() {
    this.listeners = {}
  }
  on(type, listener) {
    this.listeners[type] = listener
  }
  emit(type) {
    this.listeners[type] && this.listeners[type]()
  }
}
let hotEmitter = new Emitter()
const onConnected = () => {
  console.log('ws connected')
}

let lastHash // lastHash 上一次 hash值
let currentHash // 这一次的hash值

//监听 ws 消息
socket.on('hash', hash => {
  //更新hash
  currentHash = hash
})
socket.on('ok', () => {
  //更新
  reloadApp(true)
})

// 热更新使用的时上次编译的 hash 值作为生成文件名
// lastHash.hot-update.json
// chunkID.lastHash.hot-update.js
hotEmitter.on('webpackHotUpdate', () => {
  if (!lastHash || lastHash === currentHash) {
    return (lastHash = currentHash)
  }
  hotCheck()
})

function hotCheck() {
  hotDownloadManifest().then(update => {
    let chunkIds = Object.keys(update.c)
    // 根据 chunk 变化信息，加载新模块 chunkID.lastHash.hot-update.js
    chunkIds.forEach(chunkId => {
      hotDownloadUpdateChunk(chunkId)
    })
  })
}

// 根据 chunkId 下载对应的变更文件
// 采用的时 JSONP 方式，所以获取的文件会直接执行
// 返回的JS文件会调用 webpackHotUpdate
function hotDownloadUpdateChunk(chunkId) {
  let script = document.createElement('script')
  script.charset = 'utf-8'
  // /main.xxxx.hot-update.js
  script.src = '/' + chunkId + '.' + lastHash + '.hot-update.js'
  document.head.appendChild(script)
}
// 请求 lastHash.hot-update.json 文件，获取变化信息
function hotDownloadManifest() {
  return new Promise(function (resolve) {
    let request = new XMLHttpRequest()
    //hot-update.json文件里存放着从上一次编译到这一次编译 取到差异
    let requestPath = '/' + lastHash + '.hot-update.json'
    request.open('GET', requestPath, true)
    request.onreadystatechange = function () {
      if (request.readyState === 4) {
        let update = JSON.parse(request.responseText)
        resolve(update)
      }
    }
    request.send()
  })
}
// 当收到ok事件后，会重新刷新app
function reloadApp(hot) {
  if (hot) {
    // 如果hot为true 走热更新的逻辑
    hotEmitter.emit('webpackHotUpdate')
  } else {
    // 如果不支持热更新，则直接重新加载
    window.location.reload()
  }
}
window.hotCreateModule = function () {
  let hot = {
    _acceptedDependencies: {},
    dispose() {
      // 销毁老的元素
    },
    accept: function (deps, callback) {
      for (let i = 0; i < deps.length; i++) {
        // hot._acceptedDependencies={'./title': render}
        hot._acceptedDependencies[deps[i]] = callback
      }
    }
  }
  return hot
}

// 执行 chunkID.lastHash.hot-update.js 文件
window.webpackHotUpdate = function (chunkId, moreModules) {
  // 循环新拉来的模块
  for (let moduleId in moreModules) {
    // 从模块缓存中取到老的模块定义
    let oldModule = __webpack_require__.c[moduleId]
    // parents哪些模块引用这个模块 children这个模块引用了哪些模块
    // parents=['./src/index.js']
    let { parents, children } = oldModule
    // 更新缓存为最新代码 缓存进行更新
    let module = (__webpack_require__.c[moduleId] = {
      i: moduleId,
      l: false,
      exports: {},
      parents,
      children,
      hot: window.hotCreateModule(moduleId)
    })
    // 执行新的模块
    moreModules[moduleId].call(
      module.exports,
      module,
      module.exports,
      __webpack_require__
    )
    module.l = true

    //执行父模块设置的当前模块的更新策略
    parents.forEach(parent => {
      let parentModule = __webpack_require__.c[parent]
      if (
        parentModule &&
        parentModule.hot &&
        parentModule.hot._acceptedDependencies[moduleId]
      ) {
        parentModule.hot._acceptedDependencies[moduleId]()
      } else {
        //父模块没有配置对应子模块的更新策略，则直接从头开始运行程序
        location.reload()
      }
    })
    lastHash = currentHash
  }
}
socket.on('connect', onConnected)
