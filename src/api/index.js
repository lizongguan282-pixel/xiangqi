// 后端 API 客户端 + WebSocket 实时推送
// 接口约定见 docs/api.md
// H5 开发环境用相对路径走 Vite proxy（绕过 CORS），小程序用绝对路径
// #ifdef H5
export const BASE_URL = ''
const WS_BASE = 'wss://gcwtnunyhfap.sealosbja.site/ws'
// #endif
// #ifndef H5
export const BASE_URL = 'https://gcwtnunyhfap.sealosbja.site'
const WS_BASE = 'wss://gcwtnunyhfap.sealosbja.site/ws'
// #endif

// 默认头像：项目内静态资源（加载失败兜底用，必存在）
export const DEFAULT_AVATAR = '/static/logo.png'

// 错误码 → 人话（docs/api.md §0.5）
const ERR_MSG = {
  1001: '未登录或 token 失效',
  2001: '房间不存在',
  2002: '房间已满',
  2003: '对局中不可加入',
  4000: '参数错误',
  4001: '还没轮到你走棋',
  4002: '非法走法',
  4003: '送将 / 将帅照面',
  4004: '对局已结束',
  4040: '接口不存在',
  5000: '服务器内部错误',
}

function getToken() {
  return uni.getStorageSync('token') || ''
}

// 统一请求：返回 data，非 0 code 抛错（message 已转为人话）
export function request(path, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    uni.request({
      url: BASE_URL + path,
      method,
      data,
      header: { Authorization: 'Bearer ' + getToken() },
      success: (res) => {
        const body = res.data || {}
        if (body.code === 0) {
          resolve(body.data)
        } else {
          const err = new Error(ERR_MSG[body.code] || body.msg || '错误码 ' + body.code)
          err.code = body.code
          reject(err)
        }
      },
      fail: () => reject(new Error('网络连接失败')),
    })
  })
}

// ─── WebSocket 单例（心跳 30s / 自动重连 / 按 type 订阅） ───
const wsManager = {
  socket: null,
  handlers: {}, // type → Set<handler>
  pingTimer: null,
  reconnectTimer: null,
  closed: false, // 主动关闭时不再重连
  currentToken: null, // 已连接的 token，用于幂等判断
  connecting: false, // 正在建立连接的过程中
  socketTask: null, // socketTask 实例（onOpen/onMessage 只绑一次）

  connect(token) {
    if (!token) return
    // 幂等：已经有有效连接且 token 相同 → 直接返回，不再 close+重连
    if (this.socket && this.currentToken === token) return
    // 正在建立连接 → 等待即可
    if (this.connecting && this.currentToken === token) return
    this.currentToken = token
    this.closed = false
    this.connecting = true
    const doBind = (task) => {
      this.socketTask = task
      task.onOpen(() => {
        this.connecting = false
        clearInterval(this.pingTimer)
        this.pingTimer = setInterval(() => {
          this.send({ type: 'ping' })
        }, 30000)
      })
      task.onMessage((res) => {
        let msg
        try {
          msg = JSON.parse(res.data)
        } catch (e) {
          return
        }
        if (msg.type === 'pong') return
        const set = this.handlers[msg.type]
        if (set) set.forEach((h) => h(msg.data))
        const all = this.handlers['*']
        if (all) all.forEach((h) => h(msg))
      })
      task.onClose(() => {
        clearInterval(this.pingTimer)
        this.socket = null
        this.socketTask = null
        this.connecting = false
        if (!this.closed) {
          // 异常断开，5s 后自动重连
          this.reconnectTimer = setTimeout(() => this.connect(getToken()), 5000)
        }
      })
      task.onError(() => {
        // 失败也走 onClose 触发重连
      })
    }
    try {
      this.socket = uni.connectSocket({
        url: WS_BASE + '?token=' + token,
        complete: () => {},
      })
      // uni.connectSocket 可能直接返回 socketTask 或 Promise
      const st = this.socket
      if (st && typeof st.then === 'function') {
        st.then((res) => doBind(res)).catch(() => {
          this.connecting = false
        })
      } else {
        doBind(st)
      }
    } catch (e) {
      this.connecting = false
    }
  },

  send(msg) {
    const task = this.socketTask
    if (task) {
      try {
        task.send({ data: JSON.stringify(msg) })
      } catch (e) { /* 连接未就绪时静默忽略 */ }
    }
  },

  // 订阅某类推送，返回取消订阅函数
  on(type, handler) {
    if (!this.handlers[type]) this.handlers[type] = new Set()
    this.handlers[type].add(handler)
    return () => this.off(type, handler)
  },

  off(type, handler) {
    if (this.handlers[type]) this.handlers[type].delete(handler)
  },

  // 注意：小程序长连接是全局单条，页面间共享；只有 App 卸载时才真的 close，一般页面卸载不要调它
  close() {
    this.closed = true
    clearInterval(this.pingTimer)
    clearTimeout(this.reconnectTimer)
    if (this.socketTask) {
      try {
        this.socketTask.close()
      } catch (e) {}
      this.socketTask = null
    }
    this.socket = null
  },
}

const api = {
  // 用户（avatarUrl 可选，小程序新规范建议前端采集后提交）
  login: (code, nickname, avatarUrl) => request('/api/user/login', 'POST', { code, nickname, avatarUrl }),
  me: () => request('/api/user/me'),
  // 房间
  createRoom: (mode = 'flip') => request('/api/room/create', 'POST', { mode, gameTime: 600, stepTime: 60 }),
  joinRoom: (roomId) => request('/api/room/join', 'POST', { roomId }),
  getRoom: (roomId) => request('/api/room/' + roomId),
  setReady: (roomId, ready) => request('/api/room/ready', 'POST', { roomId, ready }),
  leaveRoom: (roomId) => request('/api/room/leave', 'POST', { roomId }),
  // 对局
  getState: (roomId) => request('/api/game/' + roomId + '/state'),
  makeMove: (roomId, from, to) => request('/api/game/' + roomId + '/move', 'POST', { from, to }),
  resign: (roomId) => request('/api/game/' + roomId + '/resign', 'POST', {}),
  undoRequest: (roomId) => request('/api/game/' + roomId + '/undo-request', 'POST', {}),
  undoResponse: (roomId, agree) => request('/api/game/' + roomId + '/undo-response', 'POST', { agree }),
  rematch: (roomId) => request('/api/game/' + roomId + '/rematch', 'POST', {}),
  // 上帝模式：交换暗棋真身（仅 god 用户可调，后端鉴权；详见 docs/上帝模式实现方案.md）
  godSwap: (roomId, from, toType) =>
    request('/api/game/' + roomId + '/god-swap', 'POST', { from, toType }),
  // WebSocket
  ws: wsManager,
  connectWS: (token) => wsManager.connect(token),
}

export default api
