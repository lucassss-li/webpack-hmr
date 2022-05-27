import './client.js'
var d1 = document.getElementById('d1')
var d2 = document.getElementById('d2')
var input = document.createElement('input')
document.body.appendChild(input)

d2.innerHTML = require('./refresh.js')

function render() {
  d1.innerHTML = require('./hmr.js')
}
render()

//配置 hmr.js 模块的热更新策略
if (module.hot) {
  module.hot.accept(['./hmr.js'], () => {
    render()
  })
}
