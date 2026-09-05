<template>
  <view class="page">
    <view class="nav">
      <text class="nav-btn" @click="goBack">‹ 返回</text>
      <text class="mode-tag">{{ mode === 'flip' ? '揭棋' : '标准' }}</text>
      <text class="god-tag" v-if="godMode">上帝视角</text>
      <view class="nav-right">
        <text class="nav-btn" :class="{ disabled: moveCount === 0 || gameOver }" @click="undo">悔棋</text>
        <text class="nav-btn warn" @click="resign">认输</text>
      </view>
    </view>

    <!-- 上方玩家栏：黑方（黑棋在棋盘上方） -->
    <view class="player-bar">
      <view class="avatar-frame">
        <image
          class="avatar-img"
          :src="avatarSrc(blackView.player.avatarUrl)"
          mode="aspectFill"
          @error="onAvatarError('black')"
        />
      </view>
      <!-- 黑方战利品：黑方吃到的暗子对红方视角只显示"？" -->
      <view class="cap-tray">
        <view
          v-for="(g, i) in blackView.tray"
          :key="i"
          class="cap-piece"
          :class="isRedP(g.t) ? 'red' : 'black'"
        >
          <text>{{ pieceName(g.t) }}</text>
          <text class="cap-count" v-if="g.count > 1">{{ g.count }}</text>
        </view>
      </view>
      <text class="player-name">
        {{ blackView.player.nickname }}
        <text class="me-tag" v-if="blackView.isMe">（我）</text>
      </text>
      <text class="check-badge" v-if="!gameOver && blackView.check">将军!</text>
      <text class="turn-tag" :class="{ active: blackView.turn && !gameOver }">
        {{ gameOver ? '已结束' : blackView.turn ? '行棋中…' : '等待' }}
      </text>
      <view class="clock-box" :class="{ urgent: !gameOver && blackView.turn && (blackView.clock <= 30 || stepRemain <= 20) }">
        <text class="clock">{{ fmt(blackView.clock) }}</text>
        <text class="step" v-if="!gameOver && blackView.turn">步 {{ stepRemain }}s</text>
      </view>
    </view>

    <view class="board-wrap">
      <view class="board">
        <view class="grid">
          <view
            v-for="i in 10"
            :key="'h' + i"
            class="h-line"
            :style="{ top: ((i - 1) * 100) / 9 + '%' }"
          ></view>
          <view
            v-for="i in 9"
            :key="'v' + i"
            class="v-line"
            :class="{ 'v-edge': i === 1 || i === 9 }"
            :style="{ left: ((i - 1) * 100) / 8 + '%' }"
          ></view>
          <view class="palace palace-top"></view>
          <view class="palace palace-bottom"></view>

          <view class="river-text river-left">汉界</view>
          <view class="river-text river-right">楚河</view>

          <view
            v-for="(m, idx) in marks"
            :key="'m' + idx"
            class="mark"
            :class="{ 'mark-edge-l': m.c === 0, 'mark-edge-r': m.c === 8 }"
            :style="{ left: (m.c * 100) / 8 + '%', top: (m.r * 100) / 9 + '%' }"
          >
            <view class="mk mk-tl"></view>
            <view class="mk mk-tr"></view>
            <view class="mk mk-bl"></view>
            <view class="mk mk-br"></view>
          </view>
        </view>

        <view class="pieces">
          <view
            v-if="lastMove"
            class="last-marker"
            :style="posStyle(lastMove.from[0], lastMove.from[1])"
          ></view>
          <view
            v-if="lastMove"
            class="last-marker"
            :style="posStyle(lastMove.to[0], lastMove.to[1])"
          ></view>
          <view
            v-for="pc in pieces"
            :key="pc.r + '-' + pc.c"
            class="piece"
            :class="[
              isRedP(pc.p) ? 'red' : 'black',
              {
                covered: pc.h,
                xray: pc.h && godMode,
                selected: sel && sel.r === pc.r && sel.c === pc.c,
              },
            ]"
            :style="posStyle(pc.r, pc.c)"
            @click="onPieceTap(pc.r, pc.c)"
            @longpress="onPieceLongPress(pc.r, pc.c)"
          >
            <text>{{ pc.h ? (godMode ? pieceName(pc.p) : '？') : pieceName(pc.p) }}</text>
          </view>
          <view
            v-for="(m, i) in targets"
            :key="'t' + i"
            class="target"
            :class="{ capture: board[m[0]][m[1]] }"
            :style="posStyle(m[0], m[1])"
            @click="onPieceTap(m[0], m[1])"
          ></view>
        </view>
      </view>

      <view v-if="floatText" class="float-text" :class="{ big: floatBig }">{{ floatText }}</view>
    </view>

    <!-- 下方玩家栏：红方（红棋在棋盘下方） -->
    <view class="player-bar">
      <view class="avatar-frame">
        <image
          class="avatar-img"
          :src="avatarSrc(redView.player.avatarUrl)"
          mode="aspectFill"
          @error="onAvatarError('red')"
        />
      </view>
      <!-- 红方战利品：红方吃到的暗子对黑方视角只显示"？" -->
      <view class="cap-tray">
        <view
          v-for="(g, i) in redView.tray"
          :key="i"
          class="cap-piece"
          :class="isRedP(g.t) ? 'red' : 'black'"
        >
          <text>{{ pieceName(g.t) }}</text>
          <text class="cap-count" v-if="g.count > 1">{{ g.count }}</text>
        </view>
      </view>
      <text class="player-name">
        {{ redView.player.nickname || userName }}
        <text class="me-tag" v-if="redView.isMe">（我）</text>
      </text>
      <text class="check-badge" v-if="!gameOver && redView.check">将军!</text>
      <text class="turn-tag" :class="{ active: redView.turn && !gameOver }">
        {{ gameOver ? '已结束' : redView.turn ? '行棋中…' : '等待' }}
      </text>
      <view class="clock-box" :class="{ urgent: !gameOver && redView.turn && (redView.clock <= 30 || stepRemain <= 20) }">
        <text class="clock">{{ fmt(redView.clock) }}</text>
        <text class="step" v-if="!gameOver && redView.turn">步 {{ stepRemain }}s</text>
      </view>
    </view>

    <view class="mask" v-if="gameOver">
      <view class="modal">
        <text class="modal-title">{{ result.winner === myColor ? '你赢了！' : '你输了' }}</text>
        <text class="modal-sub">{{ players[result.winner] ? players[result.winner].nickname : '' }} · {{ result.reason }}</text>
        <button class="confirm-btn" @click="restart">再来一局</button>
        <button class="ghost-btn" @click="goBack">返回房间</button>
      </view>
    </view>
  </view>
</template>

<script>
import {
  pieceMoves,
  applyMove,
  colorOf,
  isInCheck,
  PIECE_NAMES,
} from '../../game/xiangqi'
import api, { DEFAULT_AVATAR } from '../../api'

const GAME_TIME = 10 * 60 // 局时 10 分
const STEP_TIME = 60 // 步时 1 分

const emptyHidden = () => Array.from({ length: 10 }, () => Array(9).fill(false))

// 服务端 State → 本地棋盘表示
// 暗子真实身份客户端不可见，用 Q(红)/q(黑) 占位；引擎按位置行为计算其走法（behaviorType）
// isGod=true（上帝客户端）时：暗子若带真实 t（后端只给 god 下发真身）则直接显示真身
function serverToLocal(state, isGod) {
  const board = Array.from({ length: 10 }, () => Array(9).fill(null))
  const hidden = emptyHidden()
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 9; c++) {
      const pc = state.board && state.board[r] ? state.board[r][c] : null
      if (!pc) continue
      if (pc.hidden) {
        // 上帝视角：服务端给 god 客户端的暗棋 t 下发真身（hidden 仍为 true，走法仍按位置）
        if (isGod && pc.t && pc.t !== '?') {
          board[r][c] = pc.color === 'red' ? pc.t.toUpperCase() : pc.t.toLowerCase()
        } else {
          // 普通视角：暗子用 Q(红)/q(黑) 占位，真身不可见
          board[r][c] = pc.color === 'red' ? 'Q' : 'q'
        }
        hidden[r][c] = true
      } else {
        // 颜色以 color 字段为准，t 统一归一大小写（容错后端 t 大小写不统一）
        board[r][c] = pc.color === 'red' ? pc.t.toUpperCase() : pc.t.toLowerCase()
      }
    }
  }
  const tray = (side) =>
    ((state.capturedTray && state.capturedTray[side]) || []).map((it) => ({
      t:
        it.t === '?'
          ? it.color === 'red'
            ? 'Q'
            : 'q'
          : it.color === 'red'
            ? it.t.toUpperCase()
            : it.t.toLowerCase(),
      wasHidden: !!it.wasHidden,
    }))
  return {
    board,
    hidden,
    redToMove: state.turn === 'red',
    lastMove: state.lastMove || null,
    clocks: state.clocks || { red: GAME_TIME, black: GAME_TIME },
    stepRemain: typeof state.stepRemain === 'number' ? state.stepRemain : STEP_TIME,
    mode: state.mode || 'flip',
    captured: { red: tray('red'), black: tray('black') },
  }
}

export default {
  data() {
    return {
      mode: 'flip', // 由服务端下发：flip=揭棋 / standard=标准
      godMode: false, // 上帝模式（服务端 State.god 为 true 时开启：透视暗棋真身，仅自己可见）
      roomId: '',
      myColor: 'red', // 我执方，由服务端下发
      moveCount: 0, // 服务端已走步数（轮询增量判断）
      board: Array.from({ length: 10 }, () => Array(9).fill(null)),
      hidden: emptyHidden(),
      redToMove: true,
      sel: null,
      targets: [],
      gameOver: false,
      result: null,
      userName: '',
      lastMove: null,
      inCheck: false,
      captured: { red: [], black: [] },
      players: { red: { nickname: '红方' }, black: { nickname: '黑方' } },
      ending: false,
      floatText: '',
      floatBig: false,
      pendingOver: false,
      floatTimer: null,
      overTimer: null,
      clocks: { red: GAME_TIME, black: GAME_TIME },
      stepRemain: STEP_TIME,
      timer: null,
      syncTimer: null,
      lastMoveCount: -1,
      firedCheckCount: -1, // 已弹过"将军"浮字的步数（防轮询重复弹）
      unsubs: [], // WebSocket 订阅取消函数
      // 炮位与兵位坐标（列 0-8，行 0-9）
      marks: [
        { c: 1, r: 2 },
        { c: 7, r: 2 },
        { c: 1, r: 7 },
        { c: 7, r: 7 },
        { c: 0, r: 3 },
        { c: 2, r: 3 },
        { c: 4, r: 3 },
        { c: 6, r: 3 },
        { c: 8, r: 3 },
        { c: 0, r: 6 },
        { c: 2, r: 6 },
        { c: 4, r: 6 },
        { c: 6, r: 6 },
        { c: 8, r: 6 },
      ],
    }
  },
  computed: {
    flipMode() {
      return this.mode === 'flip'
    },
    // 玩家栏按棋子颜色固定：黑方棋子在棋盘上方(row 0)→ 黑方栏在上；红方棋子在下方(row 9)→ 红方栏在下。
    // 双方客户端看到的朝向一致（不翻屏）；"我是哪方"仅用于走子权限、战利品视角保密和胜负文案。
    blackView() {
      return {
        side: 'black',
        player: this.players.black || { nickname: '黑方' },
        turn: !this.redToMove,
        clock: this.clocks.black || 0,
        check: this.inCheck && !this.redToMove,
        tray: this.capTraysFor('black'),
        isMe: this.myColor === 'black',
      }
    },
    redView() {
      return {
        side: 'red',
        player: this.players.red || { nickname: '红方' },
        turn: this.redToMove,
        clock: this.clocks.red || 0,
        check: this.inCheck && this.redToMove,
        tray: this.capTraysFor('red'),
        isMe: this.myColor === 'red',
      }
    },
    pieces() {
      const list = []
      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 9; c++) {
          if (this.board[r][c]) {
            list.push({ r, c, p: this.board[r][c], h: this.hidden[r][c] })
          }
        }
      }
      return list
    },
    // 某方（my/对手）的战利品分组由 methods.capTraysFor 提供（按视角过滤）
    capTrays() { return null },
  },
  onLoad(options) {
    // 昵称不再读本地缓存：由服务端 State.players.red/black.nickname 下发
    this.userName = ''
    this.roomId = (options && options.roomId) || ''
    if (!this.roomId) {
      uni.showToast({ title: '缺少房间参数', icon: 'none' })
      setTimeout(() => this.goBack(), 800)
      return
    }
    this.loadState()
    this.bindWS()
  },
  onUnload() {
    clearInterval(this.timer)
    clearInterval(this.syncTimer)
    clearTimeout(this.floatTimer)
    clearTimeout(this.overTimer)
    // 取消所有 WebSocket 订阅
    this.unsubs.forEach((off) => off())
    this.unsubs = []
  },
  methods: {
    // 某方（我/对方）的战利品分组。视角规则：
    // 我方盘子：自己吃到的子全部见真身（服务端下发真实 t）
    // 对方盘子：明棋正常显示；对方吃到的暗子（wasHidden=true）只显示"？"（t 已在 serverToLocal 转成 Q/q）
    capTraysFor(side) {
      const groups = []
      const map = {}
      const isMine = side === this.myColor
      for (const it of (this.captured[side] || [])) {
        const displayT = isMine || !it.wasHidden ? it.t : (this.isRedP(it.t) ? 'Q' : 'q')
        const key = (it.wasHidden ? 'H' : 'O') + displayT
        if (!map[key]) {
          map[key] = { t: displayT, count: 0 }
          groups.push(map[key])
        }
        map[key].count++
      }
      return groups
    },
    // 头像加载失败：清空该方 avatarUrl，模板自动回落 DEFAULT_AVATAR
    onAvatarError(side) {
      if (this.players[side]) this.players[side].avatarUrl = ''
    },
    // 显示层过滤：blob: 等小程序无法加载的协议回落默认图（历史脏数据兜底）
    avatarSrc(url) {
      if (!url) return DEFAULT_AVATAR
      // #ifndef H5
      if (url.indexOf('blob:') === 0) return DEFAULT_AVATAR
      // #endif
      return url
    },
    pieceName(p) {
      return PIECE_NAMES[p] || '？'
    },
    isRedP(p) {
      return p === p.toUpperCase()
    },
    posStyle(r, c) {
      return { left: (c * 100) / 8 + '%', top: (r * 100) / 9 + '%' }
    },
    fmt(t) {
      t = Math.max(0, Math.floor(t))
      const m = Math.floor(t / 60)
      const s = t % 60
      return m + ':' + (s < 10 ? '0' : '') + s
    },
    startTimer() {
      clearInterval(this.timer)
      this.timer = setInterval(() => this.tick(), 1000)
    },
    // WebSocket 实时推送订阅（docs/api.md §4）
    bindWS() {
      const ws = api.ws
      // 确保已连接（首页登录后已连，保险重连一次）
      const token = uni.getStorageSync('token')
      if (token) ws.connect(token)
      // move_applied：对手落子 → 用下发的 State 刷新
      this.unsubs.push(
        ws.on('move_applied', (state) => this.applyServerState(state))
      )
      // game_over：终局（winner + reason）
      this.unsubs.push(
        ws.on('game_over', (data) => this.handleEnd(data.winner, data.reason))
      )
      // undo_request：对方请求悔棋 → 弹窗让我选择
      this.unsubs.push(
        ws.on('undo_request', (data) => {
          uni.showModal({
            title: '悔棋请求',
            content: (data.from === 'red' ? '红方' : '黑方') + '请求悔棋，是否同意？',
            success: async (res) => {
              try {
                await api.undoResponse(this.roomId, !!res.confirm)
              } catch (e) {
                uni.showToast({ title: e.message, icon: 'none' })
              }
            },
          })
        })
      )
      // undo_result：同意则带 state 刷新；拒绝则 Toast
      this.unsubs.push(
        ws.on('undo_result', (data) => {
          if (data.agree && data.state) {
            this.lastMoveCount = -1
            this.applyServerState(data.state)
            uni.showToast({ title: '悔棋成功', icon: 'none' })
          } else if (!data.agree) {
            uni.showToast({ title: '对方拒绝了悔棋', icon: 'none' })
          }
        })
      )
      // opponent_offline：对手断线（加 3 秒防抖，收到后立刻用 state/players 验证，真断线才弹）
      this.unsubs.push(
        ws.on('opponent_offline', () => {
          clearTimeout(this._offlineTimer)
          this._offlineTimer = setTimeout(async () => {
            try {
              const state = await api.getState(this.roomId)
              const opp = this.myColor === 'red' ? 'black' : 'red'
              const hasOpp = state.players && state.players[opp] && state.players[opp].userId
              if (!hasOpp) uni.showToast({ title: '对手已断线', icon: 'none' })
            } catch (e) {
              uni.showToast({ title: '对手已断线', icon: 'none' })
            }
          }, 3000)
        })
      )
      // game_start：再来一局重新开局
      this.unsubs.push(
        ws.on('game_start', (state) => {
          this.lastMoveCount = -1
          this.applyServerState(state)
        })
      )
    },
    // 首次进入：拉取服务端局面并启动轮询同步
    async loadState() {
      try {
        const state = await api.getState(this.roomId)
        this.lastMoveCount = -1
        if (state.myColor) this.myColor = state.myColor
        this.applyServerState(state)
        this.startTimer()
        this.startSync()
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' })
      }
    },
    // 轮询降级：每 2 秒拉局面（WS 实时推送为主，轮询兜底防丢消息）
    startSync() {
      clearInterval(this.syncTimer)
      this.syncTimer = setInterval(async () => {
        // 已宣判后停止；印章等待期(pendingOver)仍要继续拉，保证终局最后一步棋盘能刷新
        if (this.gameOver) {
          clearInterval(this.syncTimer)
          return
        }
        try {
          const state = await api.getState(this.roomId)
          this.applyServerState(state)
        } catch (e) {
          /* 静默重试：后端未接入或网络波动 */
        }
      }, 2000)
    },
    // 应用服务端下发的完整局面（State 结构见 docs/api.md §3.1）
    // opts.force=true 强制应用棋盘（用于 god-swap：moveCount 不变但暗子真身变了）
    // 竞态保护：force 应用时若 state.moveCount < 本地（对手在换棋请求途中走了棋），跳过，
    // 由 WS move_applied / 轮询拿到更新的权威 State 覆盖，双方棋盘最终一致
    applyServerState(state, opts) {
      if (!state) return
      const force = !!(opts && opts.force)
      const isEnded = state.status === 'ended'
      // god 是用户级属性，局内不会消失：一旦确认为上帝就锁定，防止个别响应漏带 god 字段导致透视闪烁变"？"
      if (!this.godMode && state.god === true) this.godMode = true
      const local = serverToLocal(state, this.godMode)
      if (state.myColor) this.myColor = state.myColor
      if (state.players) {
        this.players = {
          red: state.players.red || { nickname: '红方' },
          black: state.players.black || { nickname: '黑方' },
        }
      }
      // 时钟对时（本地每秒递减做平滑显示，服务端为计时权威）
      this.clocks = local.clocks
      this.stepRemain = local.stepRemain
      const stale = state.moveCount < this.lastMoveCount // 响应落后于本地（对手已走出更新的步）
      const changed = state.moveCount !== this.lastMoveCount
      // 终局这一步也必须应用棋盘（否则最后一步吃子/绝杀位置看不到）
      if ((changed && !stale) || isEnded || (force && !stale)) {
        this.lastMoveCount = state.moveCount
        this.board = local.board
        this.hidden = local.hidden
        this.redToMove = local.redToMove
        this.mode = local.mode
        this.lastMove = local.lastMove
        this.moveCount = state.moveCount
        this.captured = local.captured
        this.sel = null
        this.targets = []
      }
      if (isEnded) {
        // 棋盘已应用，再走统一终局入口（handleEnd 内 ending 门闩，重复调用安全）
        this.handleEnd(state.winner, state.reason)
        return
      }
      // 对局（重新）开始：复位终局状态（再来一局由服务端重发牌，moveCount 归零触发 changed）
      if (this.gameOver || this.pendingOver) {
        this.gameOver = false
        this.ending = false
        this.result = null
        this.pendingOver = false
        this.floatText = ''
        clearTimeout(this.overTimer)
        this.startTimer()
      }
      this.inCheck = !!state.check
      // 将军浮字只在"新一步造成将军"时弹一次（moveCount 去重），轮询/重发不重复弹
      if (state.check) {
        if (this.firedCheckCount !== state.moveCount) {
          this.firedCheckCount = state.moveCount
          this.showFloatText('将军', false, 1500)
        }
      } else {
        this.firedCheckCount = -1
      }
    },
    // 终局处理（单一入口 + ending 门闩防重复）：绝杀/困毙 → 印章 3 秒后宣判；认输/超时 → 直接宣判
    handleEnd(winner, reason) {
      if (this.ending || this.gameOver) return
      this.ending = true
      clearInterval(this.timer)
      this.inCheck = false
      // reason 枚举与 docs/api.md §3.3 对齐：绝杀(将死) / 困毙 / 认输 / 超时
      if (reason === '绝杀' || reason === '困毙') {
        this.pendingOver = true
        this.showFloatText(reason, true, 0)
        this.overTimer = setTimeout(() => {
          this.floatText = ''
          this.pendingOver = false
          this.gameOver = true
          this.result = { winner, reason }
        }, 3000)
      } else {
        this.gameOver = true
        this.result = { winner, reason }
      }
    },
    // 浮字提示：将军为金色小字渐隐；绝杀/困毙为红印章大字，停留到宣判
    showFloatText(text, big, duration) {
      clearTimeout(this.floatTimer)
      this.floatText = text
      this.floatBig = big
      if (duration > 0) {
        this.floatTimer = setTimeout(() => {
          this.floatText = ''
        }, duration)
      }
    },
    tick() {
      if (this.gameOver || this.pendingOver) {
        clearInterval(this.timer)
        return
      }
      const side = this.redToMove ? 'red' : 'black'
      // 仅作显示倒计时；超时判负由服务端裁决，每 2s 轮询与服务端对时
      this.clocks[side] = Math.max(0, this.clocks[side] - 1)
      this.stepRemain = Math.max(0, this.stepRemain - 1)
    },
    // 悔棋（协商制骨架）：请求发服务端，对方同意后经轮询/推送同步回退后的局面
    async undo() {
      if (this.moveCount === 0 || this.gameOver || this.pendingOver) return
      try {
        await api.undoRequest(this.roomId)
        uni.showToast({ title: '悔棋请求已发送，等待对方同意', icon: 'none' })
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' })
      }
    },
    onPieceTap(r, c) {
      if (this.gameOver || this.pendingOver) return
      // 联机：只能操作己方棋子，且必须轮到自己
      if ((this.myColor === 'red') !== this.redToMove) {
        uni.showToast({ title: '等待对方走棋', icon: 'none' })
        return
      }
      const p = this.board[r][c]
      if (p && colorOf(p) === this.myColor) {
        this.sel = { r, c }
        // 全部伪合法走法（含送将的，走时拒绝）；揭棋暗子按所在位置的原有棋子行为
        this.targets = pieceMoves(this.board, r, c, this.hidden, this.flipMode)
        return
      }
      if (this.sel && this.targets.some((m) => m[0] === r && m[1] === c)) {
        this.doMove(this.sel.r, this.sel.c, r, c)
        return
      }
      this.sel = null
      this.targets = []
    },
    // 上帝模式：长按暗棋 → 选择目标类型 → 服务端随机找同色暗棋互换真身（守恒，不凭空增减）
    onPieceLongPress(r, c) {
      if (!this.godMode) return // 普通玩家无任何响应（功能不暴露）
      if (this.gameOver || this.pendingOver) return
      const p = this.board[r][c]
      if (!p) return
      if (!this.hidden[r][c]) {
        uni.showToast({ title: '仅暗棋可更换', icon: 'none' })
        return
      }
      const curType = p.toUpperCase()
      if (curType === 'K') {
        uni.showToast({ title: '将帅不可更换', icon: 'none' })
        return
      }
      const isRed = this.isRedP(p)
      // 透视下暗棋格子即真身：统计同色暗棋中各类型数量（用于守恒配对）
      const counts = {}
      for (let rr = 0; rr < 10; rr++) {
        for (let cc = 0; cc < 9; cc++) {
          const q = this.board[rr][cc]
          if (q && this.hidden[rr][cc] && this.isRedP(q) === isRed) {
            const t = q.toUpperCase()
            counts[t] = (counts[t] || 0) + 1
          }
        }
      }
      const TYPE_NAMES = { R: '车', N: '马', C: '炮', B: '相/象', A: '仕/士', P: '兵/卒' }
      const order = ['R', 'N', 'C', 'B', 'A', 'P']
      const items = []
      const types = []
      for (const t of order) {
        if (t === curType || t === 'K') continue
        if ((counts[t] || 0) >= 1) {
          items.push(`换成${TYPE_NAMES[t]}（可配对暗棋×${counts[t]}）`)
          types.push(t)
        }
      }
      if (!items.length) {
        uni.showToast({ title: '没有可交换的暗棋类型', icon: 'none' })
        return
      }
      uni.showActionSheet({
        itemList: items,
        success: async (res) => {
          const toType = types[res.tapIndex]
          try {
            uni.showLoading({ title: '更换中…', mask: true })
            // 服务端返回换子后的权威上帝视角 State（换子不改 moveCount，需 force 应用）
            const state = await api.godSwap(this.roomId, [r, c], toType)
            uni.hideLoading()
            this.applyServerState(state, { force: true })
            uni.showToast({ title: '已更换', icon: 'none' })
          } catch (e) {
            uni.hideLoading()
            uni.showToast({ title: (e && e.message) || '更换失败', icon: 'none' })
          }
        },
      })
    },
    async doMove(r, c, tr, tc) {
      // 本地预检（提示用）：送将/将帅照面的落点直接拒绝；最终以服务端校验为准
      const sim = applyMove(this.board, r, c, tr, tc)
      if (isInCheck(sim, this.isRedP(this.board[r][c]), this.hidden, this.flipMode)) {
        this.showFloatText('不要送将', false, 1500)
        return
      }
      this.sel = null
      this.targets = []
      try {
        const state = await api.makeMove(this.roomId, [r, c], [tr, tc])
        // 走子方响应：若吃掉暗子，额外带 captured 字段（仅吃方可见真身）
        if (state.captured && state.captured.revealed) {
          const capT = state.captured.color === 'red' ? state.captured.t.toUpperCase() : state.captured.t.toLowerCase()
          const name = PIECE_NAMES[capT] || '子'
          uni.showToast({ title: '你吃掉暗子：' + name, icon: 'none' })
        }
        this.applyServerState(state)
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' })
      }
    },
    resign() {
      if (this.gameOver || this.pendingOver) return
      uni.showModal({
        title: '认输',
        content: (this.myColor === 'red' ? '红方' : '黑方') + '认输将直接判负，确定吗？',
        success: async (res) => {
          if (!res.confirm) return
          try {
            const result = await api.resign(this.roomId)
            this.handleEnd(result.winner, result.reason)
          } catch (e) {
            uni.showToast({ title: e.message, icon: 'none' })
          }
        },
      })
    },
    async restart() {
      try {
        const data = await api.rematch(this.roomId)
        // 第一个请求方：等对方也请求（双方都 rematch 后服务端自动推 game_start）
        if (data.started) {
          // 双方都已请求，服务端会推 game_start 刷新局面
          this.gameOver = false
          this.result = null
        } else {
          uni.showToast({ title: '已请求再来一局，等待对方同意', icon: 'none' })
        }
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' })
      }
    },
    goBack() {
      if (this.roomId) {
        api.leaveRoom(this.roomId).catch(() => {})
      }
      uni.navigateBack()
    },
  },
}
</script>

<style>
.page {
  min-height: 100vh;
  background-color: #5e4026;
  background-image: repeating-linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.1) 0rpx,
      rgba(0, 0, 0, 0.1) 6rpx,
      transparent 6rpx,
      transparent 24rpx
    ),
    linear-gradient(180deg, #6a4a2c 0%, #53361e 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-bottom: 40rpx;
  overflow: hidden;
}

.nav {
  width: 100%;
  box-sizing: border-box;
  padding: calc(var(--status-bar-height) + 10rpx) 30rpx 10rpx 30rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-right {
  display: flex;
}

.mode-tag {
  padding: 8rpx 28rpx;
  font-size: 28rpx;
  color: rgba(243, 226, 192, 0.6);
  border: 2rpx solid rgba(243, 226, 192, 0.45);
  border-radius: 26rpx;
}

.god-tag {
  margin-left: 12rpx;
  padding: 6rpx 18rpx;
  font-size: 22rpx;
  color: rgba(255, 215, 106, 0.55);
  border: 2rpx solid rgba(255, 215, 106, 0.4);
  border-radius: 20rpx;
}

.check-badge {
  margin-left: auto;
  color: #ff6b57;
  font-size: 30rpx;
  font-weight: bold;
}

.nav-btn {
  color: #f3e2c0;
  font-size: 28rpx;
  padding: 8rpx 24rpx;
  border: 2rpx solid rgba(243, 226, 192, 0.45);
  border-radius: 26rpx;
  margin-left: 16rpx;
}

.nav-btn.warn {
  color: #ffb0a2;
  border-color: rgba(255, 176, 162, 0.45);
}

.nav-btn.disabled {
  opacity: 0.4;
}

.player-bar {
  width: 92%;
  margin: 14rpx 0;
  display: flex;
  align-items: center;
}

.avatar-frame {
  width: 90rpx;
  height: 90rpx;
  background: #d8d5cc;
  border: 4rpx solid #c9bd9c;
  border-radius: 12rpx;
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.35);
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
}
.avatar-img {
  width: 100%;
  height: 100%;
  display: block;
  background: #d8d5cc;
}

.avatar-head {
  position: absolute;
  top: 16%;
  left: 50%;
  transform: translateX(-50%);
  width: 34%;
  height: 34%;
  border-radius: 50%;
  background: #9c9c9c;
}

.avatar-body {
  position: absolute;
  bottom: -6%;
  left: 50%;
  transform: translateX(-50%);
  width: 62%;
  height: 42%;
  border-radius: 50% 50% 0 0;
  background: #9c9c9c;
}

.player-name {
  margin-left: 16rpx;
  background: rgba(45, 28, 16, 0.8);
  color: #ffffff;
  font-size: 28rpx;
  padding: 8rpx 20rpx;
  border-radius: 10rpx;
}
.me-tag {
  color: #ffd76a;
  font-size: 24rpx;
  margin-left: 6rpx;
}

/* 战利品托盘：吃掉的子显示在头像旁，同类型堆叠+角标数字 */
.cap-tray {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  margin-left: 12rpx;
  max-width: 320rpx;
}

.cap-piece {
  position: relative;
  width: 38rpx;
  height: 38rpx;
  margin: 3rpx 6rpx 3rpx 0;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fdf6e0, #eeda9f 70%, #d8bc7c);
  border: 1rpx solid #8a5a2b;
  box-shadow: 0 2rpx 4rpx rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22rpx;
  font-weight: bold;
  font-family: 'Kaiti SC', 'STKaiti', 'KaiTi', serif;
  box-sizing: border-box;
}

.cap-piece.red {
  color: #b02318;
}

.cap-piece.black {
  color: #1f1f1f;
}

.cap-count {
  position: absolute;
  top: -10rpx;
  right: -10rpx;
  min-width: 24rpx;
  height: 24rpx;
  line-height: 24rpx;
  padding: 0 5rpx;
  border-radius: 12rpx;
  background: #c0392b;
  color: #ffffff;
  font-size: 17rpx;
  text-align: center;
  font-family: sans-serif;
  box-sizing: border-box;
}

.turn-tag {
  margin-left: auto;
  color: rgba(243, 226, 192, 0.5);
  font-size: 26rpx;
}

.turn-tag.active {
  color: #ffd76e;
  font-weight: bold;
}

.clock-box {
  margin-left: 16rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 110rpx;
}

.clock {
  color: #f3e2c0;
  font-size: 34rpx;
  font-weight: bold;
  font-variant-numeric: tabular-nums;
}

.step {
  color: rgba(243, 226, 192, 0.6);
  font-size: 22rpx;
}

.clock-box.urgent .clock,
.clock-box.urgent .step {
  color: #ff6b57;
}

.board-wrap {
  position: relative;
  width: 96%;
  margin-top: 6rpx;
}

.board {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 104%;
  background-color: #e6ba76;
  background-image: repeating-linear-gradient(
    90deg,
    rgba(140, 80, 20, 0.08) 0rpx,
    rgba(140, 80, 20, 0.08) 8rpx,
    transparent 8rpx,
    transparent 32rpx
  );
  border: 10rpx solid #6d4520;
  border-radius: 10rpx;
  box-shadow: 0 10rpx 30rpx rgba(0, 0, 0, 0.4);
}

.grid {
  position: absolute;
  top: 4%;
  left: 4%;
  right: 4%;
  bottom: 4%;
}

.h-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 2rpx;
  background: #8a5a2b;
}

.v-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2rpx;
  background: linear-gradient(
    180deg,
    #8a5a2b 0%,
    #8a5a2b 44.4%,
    transparent 44.4%,
    transparent 55.6%,
    #8a5a2b 55.6%,
    #8a5a2b 100%
  );
}

.v-edge {
  background: #8a5a2b;
}

.palace {
  position: absolute;
  left: 37.5%;
  width: 25%;
  height: 22.2%;
}

.palace-top {
  top: 0;
}

.palace-bottom {
  bottom: 0;
}

.palace::before,
.palace::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}

.palace::before {
  background: linear-gradient(
    to top right,
    transparent calc(50% - 1rpx),
    #8a5a2b calc(50% - 1rpx),
    #8a5a2b calc(50% + 1rpx),
    transparent calc(50% + 1rpx)
  );
}

.palace::after {
  background: linear-gradient(
    to bottom right,
    transparent calc(50% - 1rpx),
    #8a5a2b calc(50% - 1rpx),
    #8a5a2b calc(50% + 1rpx),
    transparent calc(50% + 1rpx)
  );
}

.river-text {
  position: absolute;
  top: 50%;
  margin-top: -40rpx;
  height: 80rpx;
  line-height: 80rpx;
  font-family: 'Kaiti SC', 'STKaiti', 'KaiTi', serif;
  font-size: 54rpx;
  font-weight: bold;
  color: #4a2f14;
  letter-spacing: 30rpx;
}

.river-left {
  left: 12%;
}

.river-right {
  right: 12%;
  transform: rotate(180deg);
}

.mark {
  position: absolute;
  width: 0;
  height: 0;
}

.mk {
  position: absolute;
  width: 16rpx;
  height: 16rpx;
}

.mk-tl {
  left: -22rpx;
  top: -22rpx;
  border-right: 3rpx solid #7a4e24;
  border-bottom: 3rpx solid #7a4e24;
}

.mk-tr {
  left: 6rpx;
  top: -22rpx;
  border-left: 3rpx solid #7a4e24;
  border-bottom: 3rpx solid #7a4e24;
}

.mk-bl {
  left: -22rpx;
  top: 6rpx;
  border-right: 3rpx solid #7a4e24;
  border-top: 3rpx solid #7a4e24;
}

.mk-br {
  left: 6rpx;
  top: 6rpx;
  border-left: 3rpx solid #7a4e24;
  border-top: 3rpx solid #7a4e24;
}

.mark-edge-l .mk-tl,
.mark-edge-l .mk-bl,
.mark-edge-r .mk-tr,
.mark-edge-r .mk-br {
  display: none;
}

.pieces {
  position: absolute;
  top: 4%;
  left: 4%;
  right: 4%;
  bottom: 4%;
}

.last-marker {
  position: absolute;
  width: 72rpx;
  height: 72rpx;
  margin: -36rpx 0 0 -36rpx;
  border-radius: 10rpx;
  background: rgba(255, 215, 110, 0.35);
}

.piece {
  position: absolute;
  width: 82rpx;
  height: 82rpx;
  margin: -41rpx 0 0 -41rpx;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #fdf6e0, #eeda9f 70%, #d8bc7c);
  border: 2rpx solid #8a5a2b;
  box-shadow: 0 6rpx 10rpx rgba(0, 0, 0, 0.45), inset 0 0 0 3rpx rgba(120, 80, 30, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  font-weight: bold;
  font-family: 'Kaiti SC', 'STKaiti', 'KaiTi', serif;
}

.piece.red {
  color: #b02318;
}

.piece.black {
  color: #1f1f1f;
}

.piece.covered {
  background: radial-gradient(circle at 35% 30%, #c99e63, #a5783c 70%, #7c5426);
  border-color: #5e3c1a;
}

.piece.covered text {
  color: rgba(255, 240, 200, 0.85);
  font-size: 40rpx;
}

/* 上帝透视：暗棋显示真身但整体压暗一档，与明棋一眼区分（仅 god 端渲染） */
.piece.xray {
  opacity: 0.82;
  filter: brightness(0.88);
}

.piece.selected {
  box-shadow: 0 0 0 6rpx #ffd76e, 0 6rpx 10rpx rgba(0, 0, 0, 0.45),
    inset 0 0 0 3rpx rgba(120, 80, 30, 0.3);
}

.target {
  position: absolute;
  width: 24rpx;
  height: 24rpx;
  margin: -12rpx 0 0 -12rpx;
  border-radius: 50%;
  background: rgba(50, 130, 60, 0.55);
}

.target.capture {
  width: 94rpx;
  height: 94rpx;
  margin: -47rpx 0 0 -47rpx;
  background: transparent;
  border: 5rpx solid rgba(205, 45, 35, 0.85);
}

/* 浮字提示 */
.float-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 50;
  font-family: 'Kaiti SC', 'STKaiti', 'KaiTi', serif;
  font-size: 76rpx;
  font-weight: bold;
  color: #ffd76e;
  letter-spacing: 14rpx;
  white-space: nowrap;
  pointer-events: none;
  text-shadow: 0 4rpx 14rpx rgba(0, 0, 0, 0.65);
  animation: floatLife 1.5s ease forwards;
}

.float-text.big {
  font-size: 132rpx;
  color: #e33a26;
  letter-spacing: 20rpx;
  transform: translate(-50%, -50%) rotate(-8deg);
  text-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.55);
  animation: stampIn 0.5s cubic-bezier(0.25, 1.5, 0.45, 1) forwards;
}

@keyframes floatLife {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(1.8);
  }
  18% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  70% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.96);
  }
}

@keyframes stampIn {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) rotate(-18deg) scale(2.2);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(-8deg) scale(1);
  }
}

.mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal {
  width: 560rpx;
  background: #fffdf5;
  border-radius: 24rpx;
  padding: 48rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.modal-title {
  font-size: 44rpx;
  font-weight: bold;
  color: #5a3a1a;
}

.modal-sub {
  margin-top: 16rpx;
  font-size: 30rpx;
  color: #8a6a3a;
}

.confirm-btn {
  margin-top: 40rpx;
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  background: #c0392b;
  color: #ffffff;
  font-size: 32rpx;
  border-radius: 12rpx;
  border: none;
}

.confirm-btn::after {
  border: none;
}

.ghost-btn {
  margin-top: 20rpx;
  width: 100%;
  height: 84rpx;
  line-height: 84rpx;
  background: transparent;
  color: #8a6a3a;
  font-size: 30rpx;
  border-radius: 12rpx;
  border: 2rpx solid #d9c39a;
}

.ghost-btn::after {
  border: none;
}
</style>
