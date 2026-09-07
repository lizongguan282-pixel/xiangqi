<template>
  <view class="page">
    <view class="nav">
      <text class="nav-btn" @click="goBack">‹ 返回</text>
      <text class="mode-tag">{{ modeLabel }}</text>
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
      <!-- 表情气泡：显示在头像旁，3 秒后消失 -->
      <view v-if="emojiBubble.black" class="emoji-bubble">
        <image class="emoji-bubble-img" :src="emojiUrl(emojiBubble.black)" mode="aspectFit" />
      </view>
      <!-- 短语气泡：显示在头像旁，3 秒后消失 -->
      <view v-if="phraseBubble.black" class="phrase-bubble">
        <text class="phrase-bubble-text">{{ phraseText(phraseBubble.black) }}</text>
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

    <!-- 背景音乐控制：左下角音量图标（点击静音/取消静音，长按弹出音量调节；走子音效不受影响） -->
    <view class="bgm-btn" :class="{ muted: bgmMuted }" @click="toggleBgmMute" @longpress="showBgmPanel = true">
      <text>{{ bgmMuted ? '🔇' : '🔊' }}</text>
    </view>

    <!-- 快捷表情：音量图标旁的表情按钮（点击开/关表情面板） -->
    <view class="emoji-btn" @click="toggleEmojiPanel">
      <text>😀</text>
    </view>
    <!-- 快捷短语：表情图标旁的短语按钮（点击开/关短语面板） -->
    <view class="phrase-btn" @click="togglePhrasePanel">
      <text>💬</text>
    </view>
    <!-- 表情选择面板：白色圆角框，网格展示，超出可滚动；点遮罩关闭 -->
    <view class="mask emoji-mask" v-if="showEmojiPanel" @click="showEmojiPanel = false">
      <view class="emoji-panel" @click.stop>
        <scroll-view class="emoji-scroll" scroll-y :show-scrollbar="true">
          <view class="emoji-grid">
            <view
              v-for="(e, i) in emojis"
              :key="i"
              class="emoji-item"
              @click="pickEmoji(e)"
            >
              <image class="emoji-item-img" :src="emojiUrl(e)" mode="aspectFit" />
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
    <!-- 短语选择面板：白色圆角框，文字网格，点击发送；点遮罩关闭 -->
    <view class="mask phrase-mask" v-if="showPhrasePanel" @click="showPhrasePanel = false">
      <view class="phrase-panel" @click.stop>
        <scroll-view class="phrase-scroll" scroll-y :show-scrollbar="true">
          <view class="phrase-grid">
            <view
              v-for="(p, i) in phrases"
              :key="i"
              class="phrase-item"
              @click="pickPhrase(p)"
            >
              <text class="phrase-item-text">{{ phraseText(p) }}</text>
            </view>
          </view>
        </scroll-view>
      </view>
    </view>
    <view class="mask bgm-mask" v-if="showBgmPanel" @click="showBgmPanel = false">
      <view class="modal bgm-modal" @click.stop>
        <text class="modal-title">背景音乐</text>
        <view class="bgm-slider-row">
          <text class="bgm-slider-icon">{{ bgmMuted ? '🔇' : '🔊' }}</text>
          <slider
            class="bgm-slider"
            :value="Math.round(bgmVolume * 100)"
            min="0"
            max="100"
            activeColor="#c0392b"
            backgroundColor="#d9c39a"
            block-size="24"
            @change="onBgmSliderChange"
          />
          <text class="bgm-slider-val">{{ Math.round(bgmVolume * 100) }}</text>
        </view>
        <text class="modal-sub">点击左下角图标可静音 · 走子音效不受影响</text>
        <button class="confirm-btn" @click="showBgmPanel = false">好的</button>
      </view>
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
      <!-- 表情气泡：显示在头像旁，3 秒后消失 -->
      <view v-if="emojiBubble.red" class="emoji-bubble">
        <image class="emoji-bubble-img" :src="emojiUrl(emojiBubble.red)" mode="aspectFit" />
      </view>
      <!-- 短语气泡：显示在头像旁，3 秒后消失 -->
      <view v-if="phraseBubble.red" class="phrase-bubble">
        <text class="phrase-bubble-text">{{ phraseText(phraseBubble.red) }}</text>
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

    <view class="mask" v-if="gameOver && !waitingRematch">
      <view class="modal">
        <text class="modal-title">{{ result.winner === myColor ? '你赢了！' : '你输了' }}</text>
        <text class="modal-sub">{{ players[result.winner] ? players[result.winner].nickname : '' }} · {{ result.reason }}</text>
        <button class="confirm-btn" @click="restart">再来一局</button>
        <button class="ghost-btn" @click="goBack">返回房间</button>
      </view>
    </view>

    <!-- 再来一局：等待对方回应 -->
    <view class="mask" v-if="waitingRematch">
      <view class="modal">
        <text class="modal-title">等待对方回应</text>
        <text class="modal-sub">对方点击「再来一局」后将自动开始新对局</text>
        <view class="waiting-dots">
          <text class="dot"></text>
          <text class="dot"></text>
          <text class="dot"></text>
        </view>
        <button class="ghost-btn" @click="cancelRematch">取消</button>
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

// 背景音乐外链（CDN / 自有服务器），不打入小程序包（避免超 2MB 限制）
// 注意：该域名必须已加入小程序后台「downloadFile 合法域名」，否则真机无法加载
const BGM_URL = 'https://gcwtnunyhfap.sealosbja.site/static/bgm.mp3'
// 将军变速版：预渲染 1.2x 变速变调（Audacity 等工具离线做好），避免 playbackRate 跨设备听感不一致
// 后端需将 bgm_fast.mp3 放到 /static/ 目录（Express 静态服务已挂好）
const BGM_FAST_URL = 'https://gcwtnunyhfap.sealosbja.site/static/bgm_fast.mp3'

// 局内快捷表情（图片版）：文件位于 src/static/emoji/eN.png
// 替换/新增表情：直接覆盖同名图片文件，或增删改此数组（代号必须与文件名一致，如 'e9' → e9.png）
// WS 只传代号（e1~e8），双端各自从本地 static 渲染
const EMOJIS = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7', 'e8']

// 局内快捷短语（文字+语音版）：
//   文字显示：面板内直接渲染 phraseMap[code].text
//   语音文件：src/static/voice/vN.mp3（前端包内，和 move.wav 同理）
//   WS 只传代号（v1~v8），后端白名单校验，双方各自从本地 static 渲染/播放
// 修改说明：改短语文字 → 改 phraseMap 里对应 code 的 text；
//          增删短语 → 增删 phraseMap 项 + 同步改后端白名单；
//          换语音 → 替换对应 vN.mp3 文件；后端零改动
const PHRASES = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8']
const phraseMap = {
  v1: { text: '你走！', voice: '/static/voice/v1.mp3' },
  v2: { text: '老叟戏顽童', voice: '/static/voice/v2.mp3' },
  v3: { text: 'Fahh~~', voice: '/static/voice/v3.mp3' },
  v4: { text: '菜就多练', voice: '/static/voice/v4.mp3' },
  v5: { text: '认输吧', voice: '/static/voice/v5.mp3' },
  v6: { text: '等等', voice: '/static/voice/v6.mp3' },
  v7: { text: '不客气', voice: '/static/voice/v7.mp3' },
  v8: { text: '加油', voice: '/static/voice/v8.mp3' },
}

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
          // 占位颜色按"位置方"（row>=5 红半场）而非下发的 color：
          // 全随机模式暗子归属跟所在半场，且真身颜色绝不能从渲染层泄露
          board[r][c] = r >= 5 ? 'Q' : 'q'
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
      moveAudio: null, // 走子音效播放器（uni.createInnerAudioContext 单例）
      waitingRematch: false, // 已请求再来一局，等待对方回应
      bgmAudio: null, // 背景音乐播放器：原速 bgm.mp3（非将军时播放）
      bgmFastAudio: null, // 将军变速版播放器：bgm_fast.mp3（将军时从头播放，正常时暂停）
      _bgmResumePos: null, // 进入将军前 normal bgm 的暂停位置，解将时续播用
      bgmMuted: false, // 背景音乐静音（仅影响 BGM，走子音效不受影响）
      bgmVolume: 0.35, // 背景音乐音量 0~1
      showBgmPanel: false, // 音量调节浮层
      showEmojiPanel: false, // 表情选择面板
      emojis: EMOJIS, // 表情列表（模板网格渲染）
      emojiBubble: { red: '', black: '' }, // 头像旁显示的表情气泡
      emojiTimers: { red: null, black: null }, // 气泡消失定时器
      showPhrasePanel: false, // 短语选择面板
      phrases: PHRASES, // 短语列表（模板网格渲染）
      phraseBubble: { red: '', black: '' }, // 头像旁显示的短语气泡
      phraseTimers: { red: null, black: null }, // 短语气泡消失定时器
      phraseAudio: null, // 短语语音播放器（独立单例，不影响 BGM）
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
    // 导航栏模式名
    modeLabel() {
      return this.mode === 'random' ? '全随机' : this.mode === 'standard' ? '标准' : '揭棋'
    },
    // 翻棋类模式（揭棋 / 揭棋全随机）：暗子按位置行为、翻开士相解限
    flipMode() {
      return this.mode === 'flip' || this.mode === 'random'
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
    // 背景音乐：读取持久化的静音/音量设置并开始循环播放（正式对局中）
    const m = uni.getStorageSync('bgmMuted')
    if (m === true || m === false) this.bgmMuted = m
    const v = parseFloat(uni.getStorageSync('bgmVolume'))
    if (!isNaN(v) && v >= 0 && v <= 1) this.bgmVolume = v
    try {
      // 双音频方案：原速 bgm.mp3 + 将军变速 bgm_fast.mp3，各用独立 InnerAudioContext
      const normal = uni.createInnerAudioContext()
      normal.src = BGM_URL
      normal.loop = true
      normal.volume = this.bgmMuted ? 0 : this.bgmVolume
      this.bgmAudio = normal

      const fast = uni.createInnerAudioContext()
      fast.src = BGM_FAST_URL
      fast.loop = true
      fast.volume = this.bgmMuted ? 0 : this.bgmVolume
      this.bgmFastAudio = fast

      // 初始状态（非将军）：只播 normal，fast 保持暂停
      this.applyBgmCheckState()
    } catch (e) {}
    this.loadState()
    this.bindWS()
  },
  onUnload() {
    clearInterval(this.timer)
    clearInterval(this.syncTimer)
    clearTimeout(this.floatTimer)
    clearTimeout(this.overTimer)
    // 销毁走子音效与背景音乐播放器
    if (this.moveAudio) {
      try {
        this.moveAudio.destroy()
      } catch (e) {}
      this.moveAudio = null
    }
    if (this.bgmAudio) {
      try {
        this.bgmAudio.destroy()
      } catch (e) {}
      this.bgmAudio = null
    }
    if (this.bgmFastAudio) {
      try {
        this.bgmFastAudio.destroy()
      } catch (e) {}
      this.bgmFastAudio = null
    }
    // 清理表情气泡定时器
    clearTimeout(this.emojiTimers.red)
    clearTimeout(this.emojiTimers.black)
    clearTimeout(this.phraseTimers.red)
    clearTimeout(this.phraseTimers.black)
    // 销毁短语语音播放器（独立单例，不影响 BGM/走子音效）
    if (this.phraseAudio) {
      try {
        this.phraseAudio.destroy()
      } catch (e) {}
      this.phraseAudio = null
    }
    // 取消所有 WebSocket 订阅
    this.unsubs.forEach((off) => off())
    this.unsubs = []
  },
  methods: {
    // 某方（我/对方）的战利品分组。视角规则：
    // 我方盘子：自己吃到的子全部见真身（服务端下发真实 t）
    // 对方盘子：明棋正常显示；揭棋模式下对方吃到的暗子（wasHidden=true）只显示"？"
    // 全随机（random）模式：战利品全公开，明子暗子均显示真实身份（对接文档 §4）
    capTraysFor(side) {
      const groups = []
      const map = {}
      const isMine = side === this.myColor
      const publicCaptures = this.mode === 'random'
      for (const it of (this.captured[side] || [])) {
        const displayT = isMine || !it.wasHidden || publicCaptures ? it.t : (this.isRedP(it.t) ? 'Q' : 'q')
        const key = displayT
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
      // move_applied：对手落子 → 用下发的 State 刷新（带 fromMove 播落子音效）
      this.unsubs.push(
        ws.on('move_applied', (state) => this.applyServerState(state, { fromMove: true }))
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
          this.waitingRematch = false // 对方已回应，关闭"等待对方回应"窗口
          this.lastMoveCount = -1
          this.applyServerState(state)
        })
      )
      // emoji：对方发送的快捷表情 → 在其头像旁显示气泡
      //（自己发的已在本地显示，服务端回显 same from 时跳过防重复）
      this.unsubs.push(
        ws.on('emoji', (data) => {
          if (data && data.from && data.code && data.from !== this.myColor) {
            this.showEmoji(data.from, data.code)
          }
        })
      )
      // phrase：对方发送的快捷短语 → 在其头像旁显示文字气泡 + 播放对应语音
      //（自己发的已在本地显示+播放，服务端回显 same from 时跳过防重复）
      this.unsubs.push(
        ws.on('phrase', (data) => {
          if (data && data.from && data.code && data.from !== this.myColor) {
            this.showPhrase(data.from, data.code)
            this.playPhrase(data.code)
          }
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
      const fromMove = !!(opts && opts.fromMove) // 来自走子（本地确认 / 对手 move_applied），需播落子音效
      const isEnded = state.status === 'ended'
      // god 是用户级属性，局内不会消失：一旦确认为上帝就锁定，防止个别响应漏带 god 字段导致透视闪烁变"？"
      // 全随机（random）模式下上帝模式强制关闭：即使后端漏拦，前端也不再开启透视
      if (!this.godMode && state.god === true && state.mode !== 'random') this.godMode = true
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
        // 落子音效：仅当确为一步新走子（moveCount 前进、且来自走子通道）时播放。
        // 轮询/初始加载/god-swap/重开不播；绝杀的最后一步也播（changed&&!stale 成立）
        if (fromMove && changed && !stale) {
          this.playMoveSound()
        }
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
        // 终局时轮询已自停（见 startSync 内 gameOver 短路），rematch/重开后必须重启，
        // 否则 game_start 推送一旦丢失（后端漏推/WS 抖动）就再也无法自愈，只能刷新
        this.startSync()
        this.resumeBgm() // 新对局开始，恢复背景音乐
      }
      // 将军进入/解除时切换 BGM：将军→从头播 bgm_fast；解将→从头播 normal
      const wasCheck = this.inCheck
      this.inCheck = !!state.check
      if (wasCheck !== this.inCheck) this.applyBgmCheckState()
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
      // 终局：两个 BGM 播放器都暂停 + 清空恢复位置（下一局由 resumeBgm / applyBgmCheckState 从正常态恢复）
      this._bgmResumePos = null
      if (this.bgmAudio) {
        try { this.bgmAudio.pause() } catch (e) {}
      }
      if (this.bgmFastAudio) {
        try { this.bgmFastAudio.pause() } catch (e) {}
      }
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
    // 走子音效：每步落子播放一次（本地走子 + 对手走子均触发），
    // 作为"轮到谁"的听觉提示。用单例 InnerAudioContext，重复调用 seek(0)+play 避免并发叠音
    playMoveSound() {
      try {
        if (!this.moveAudio) {
          this.moveAudio = uni.createInnerAudioContext()
          this.moveAudio.src = '/static/move.wav'
          this.moveAudio.volume = 0.8
        }
        this.moveAudio.seek(0)
        this.moveAudio.play()
      } catch (e) {
        // 音效播放失败不影响对局
      }
    },
    // 恢复背景音乐（对局进行中且未静音时）：根据当前是否将军决定恢复 normal 还是 fast
    resumeBgm() {
      if (this.bgmMuted) return
      if (this.inCheck) {
        if (!this.bgmFastAudio) return
        try { this.bgmFastAudio.play() } catch (e) {}
      } else {
        if (!this.bgmAudio) return
        try { this.bgmAudio.play() } catch (e) {}
      }
    },
    // 双音频方案：将军时暂停原速 bgm、从头播 bgm_fast；解将军时暂停 fast、从暂停处恢复 normal。
    // 所有修改 this.inCheck 的点（applyServerState / handleEnd / restart）都必须调用本方法，
    // 否则会出现"将军期认输后下一局 BGM 仍跑 fast"的状态泄漏。
    applyBgmCheckState() {
      if (!this.bgmAudio || !this.bgmFastAudio) return
      if (this.bgmMuted) return // 静音时两个都不播，切换留给 toggleBgmMute 处理
      if (this.inCheck) {
        // 进入将军：保存 normal 当前播放位置，pause normal，fast 从头开始
        try {
          this._bgmResumePos = this.bgmAudio.currentTime || 0
          this.bgmAudio.pause()
        } catch (e) {}
        try { this.bgmFastAudio.seek(0); this.bgmFastAudio.play() } catch (e) {}
      } else {
        // 解除将军 / 初始 / 终局复位：pause fast，normal 恢复到进入将军前的位置续播；
        // 若无保存位置（初始 onLoad、终局后新对局），则从头开始
        try { this.bgmFastAudio.pause() } catch (e) {}
        if (this._bgmResumePos != null && this._bgmResumePos > 0) {
          try { this.bgmAudio.seek(this._bgmResumePos); this.bgmAudio.play() } catch (e) {}
          this._bgmResumePos = null
        } else {
          try { this.bgmAudio.seek(0); this.bgmAudio.play() } catch (e) {}
        }
      }
    },
    // H5 浏览器可能拦截自动播放：任意点击棋盘时兜底补播（小程序无影响）
    ensureBgm() {
      if ((this.bgmAudio || this.bgmFastAudio) && !this.bgmMuted && !this.gameOver && !this.pendingOver) {
        this.resumeBgm()
      }
    },
    // 点击左下角音量图标：静音/取消静音（仅 BGM，走子音效独立不受影响）
    // 静音时两个播放器都 pause；取消静音时根据当前 inCheck 恢复对应播放器
    toggleBgmMute() {
      this.bgmMuted = !this.bgmMuted
      uni.setStorageSync('bgmMuted', this.bgmMuted)
      if (this.bgmAudio) {
        try {
          this.bgmAudio.volume = this.bgmMuted ? 0 : this.bgmVolume
          if (this.bgmMuted) {
            this.bgmAudio.pause()
          }
        } catch (e) {}
      }
      if (this.bgmFastAudio) {
        try {
          this.bgmFastAudio.volume = this.bgmMuted ? 0 : this.bgmVolume
          if (this.bgmMuted) {
            this.bgmFastAudio.pause()
          }
        } catch (e) {}
      }
      // 取消静音时：根据当前状态恢复对应播放器（非终局才恢复）
      if (!this.bgmMuted && !this.gameOver && !this.pendingOver) {
        this.applyBgmCheckState()
      }
    },
    // 音量滑块调整（0~100 → 0~1）；拖动即取消静音并持久化
    // 音量同时作用于 normal 和 fast 两个播放器
    onBgmSliderChange(e) {
      const v = e.detail.value / 100
      this.bgmVolume = v
      uni.setStorageSync('bgmVolume', v)
      const wasMuted = this.bgmMuted
      if (v > 0 && this.bgmMuted) {
        this.bgmMuted = false
        uni.setStorageSync('bgmMuted', false)
      }
      if (this.bgmAudio) {
        try { this.bgmAudio.volume = v } catch (e) {}
      }
      if (this.bgmFastAudio) {
        try { this.bgmFastAudio.volume = v } catch (e) {}
      }
      // 从静音滑出声音时：恢复当前活跃的播放器（非终局）
      if (wasMuted && !this.bgmMuted && !this.gameOver && !this.pendingOver) {
        this.applyBgmCheckState()
      }
    },
    // 表情图片路径：代号 eN → /static/emoji/eN.png
    emojiUrl(code) {
      return '/static/emoji/' + code + '.png'
    },
    // 点击表情按钮：开/关表情选择面板（互斥关短语面板）
    toggleEmojiPanel() {
      this.showEmojiPanel = !this.showEmojiPanel
      if (this.showEmojiPanel) this.showPhrasePanel = false
    },
    // 选中表情：关面板 → 本地气泡立即显示 → WS 发给对方（后端未上线时仅自己可见）
    pickEmoji(code) {
      this.showEmojiPanel = false
      this.showEmoji(this.myColor, code)
      api.ws.send({ type: 'emoji', roomId: this.roomId, code })
    },
    // 表情气泡：显示在 side（red/black）玩家头像旁，3 秒后自动消失
    showEmoji(side, code) {
      if (side !== 'red' && side !== 'black') return
      clearTimeout(this.emojiTimers[side])
      this.emojiBubble[side] = code
      this.emojiTimers[side] = setTimeout(() => {
        this.emojiBubble[side] = ''
      }, 3000)
    },
    // 短语文字：代号 vN → phraseMap 里的 text
    phraseText(code) {
      return (phraseMap[code] && phraseMap[code].text) || code
    },
    // 点击短语按钮：开/关短语选择面板（互斥关表情面板）
    togglePhrasePanel() {
      this.showPhrasePanel = !this.showPhrasePanel
      if (this.showPhrasePanel) this.showEmojiPanel = false
    },
    // 选中短语：关面板 → 本地气泡+语音立即显示/播放 → WS 发给对方
    pickPhrase(code) {
      this.showPhrasePanel = false
      this.showPhrase(this.myColor, code)
      this.playPhrase(code)
      api.ws.send({ type: 'phrase', roomId: this.roomId, code })
    },
    // 短语气泡：显示在 side（red/black）玩家头像旁，3 秒后自动消失
    showPhrase(side, code) {
      if (side !== 'red' && side !== 'black') return
      clearTimeout(this.phraseTimers[side])
      this.phraseBubble[side] = code
      this.phraseTimers[side] = setTimeout(() => {
        this.phraseBubble[side] = ''
      }, 3000)
    },
    // 播放短语语音：独立 InnerAudioContext 单例，重复 seek(0)+play 避免叠音；
    // 完全独立于 bgmAudio / bgmFastAudio / moveAudio，互不影响
    playPhrase(code) {
      try {
        if (!this.phraseAudio) {
          this.phraseAudio = uni.createInnerAudioContext()
          this.phraseAudio.volume = 0.9
        }
        const info = phraseMap[code]
        if (!info || !info.voice) return
        if (this.phraseAudio.src !== info.voice) {
          this.phraseAudio.src = info.voice
        }
        this.phraseAudio.seek(0)
        this.phraseAudio.play()
      } catch (e) {
        // 语音播放失败不影响对局（和走子音效同理）
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
      this.ensureBgm() // H5 自动播放被拦截时兜底补播
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
        this.applyServerState(state, { fromMove: true })
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
          this.waitingRematch = false
          // 先复位终局门闩，避免 game_start 到来前 UI 停在半复位态（ending=true、旧棋盘）
          this.gameOver = false
          this.ending = false
          this.pendingOver = false
          this.result = null
          this.floatText = ''
          clearTimeout(this.overTimer)
          // 重启轮询兜底：若 game_start 推送丢失，2s 轮询会拉到新局面自愈
          this.startTimer()
          this.startSync()
          this.applyBgmCheckState() // 新对局 BGM 状态归一（handleEnd 已 pause 两者 + inCheck=false，此处为 resumeBgm 前的双保险）
          this.resumeBgm() // 新对局开始，恢复背景音乐
        } else {
          // 弹出"等待对方回应"窗口，等对方也点再来一局（game_start 到来时自动关闭）
          this.waitingRematch = true
        }
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' })
      }
    },
    // 取消再来一局请求：仅本地关闭等待窗口（服务端无取消 rematch 接口，
    // 对方若随后也点再来一局仍会开局；此处只是让本端不再显示等待态）
    cancelRematch() {
      this.waitingRematch = false
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
  position: relative; /* 表情气泡的定位锚点 */
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

/* 再来一局：等待对方回应的三点跳动动画 */
.waiting-dots {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 36rpx 0 8rpx;
  height: 24rpx;
}
.waiting-dots .dot {
  width: 18rpx;
  height: 18rpx;
  margin: 0 10rpx;
  border-radius: 50%;
  background: #c0392b;
  opacity: 0.3;
  animation: dotBounce 1.2s infinite ease-in-out;
}
.waiting-dots .dot:nth-child(2) {
  animation-delay: 0.2s;
}
.waiting-dots .dot:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes dotBounce {
  0%, 80%, 100% {
    transform: scale(0.6);
    opacity: 0.3;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 背景音乐控制：左下角悬浮音量按钮 */
.bgm-btn {
  position: fixed;
  left: 20rpx;
  bottom: 170rpx;
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.28);
  border: 2rpx solid rgba(243, 226, 192, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  z-index: 30;
}
.bgm-btn.muted {
  opacity: 0.55;
}

/* 音量调节浮层 */
.bgm-mask {
  z-index: 60;
}
.bgm-modal {
  width: 82%;
}
.bgm-slider-row {
  display: flex;
  align-items: center;
  margin: 34rpx 6rpx 12rpx;
}
.bgm-slider-icon {
  font-size: 34rpx;
}
.bgm-slider {
  flex: 1;
  margin: 0 14rpx;
}
.bgm-slider-val {
  min-width: 52rpx;
  text-align: right;
  font-size: 26rpx;
  color: #8a6a3a;
}

/* 快捷表情：音量图标旁的表情按钮 */
.emoji-btn {
  position: fixed;
  left: 104rpx;
  bottom: 170rpx;
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: 2rpx solid rgba(243, 226, 192, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  z-index: 30;
}

/* 表情选择面板：白色圆角框，贴左下角展开，内部可滚动 */
.emoji-mask {
  z-index: 40;
}
.emoji-panel {
  position: fixed;
  left: 20rpx;
  bottom: 260rpx;
  width: 460rpx;
  max-height: 500rpx;
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 8rpx 30rpx rgba(0, 0, 0, 0.4);
  padding: 16rpx;
  box-sizing: border-box;
  z-index: 41;
}
.emoji-scroll {
  max-height: 468rpx;
}
.emoji-grid {
  display: flex;
  flex-wrap: wrap;
}
.emoji-item {
  width: 96rpx;
  height: 96rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
}
.emoji-item:active {
  background: #f0e6d2;
}
.emoji-item-img {
  width: 72rpx;
  height: 72rpx;
}

/* 表情气泡：显示在发送者头像旁，弹出动画（白底圆角框内嵌表情图片） */
.emoji-bubble {
  position: absolute;
  left: 76rpx;
  top: -30rpx;
  z-index: 20;
  padding: 10rpx;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 18rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.35);
  animation: emojiPop 0.25s ease-out;
}
.emoji-bubble-img {
  width: 56rpx;
  height: 56rpx;
  display: block;
}
.emoji-bubble::after {
  content: '';
  position: absolute;
  left: -8rpx;
  top: 50%;
  margin-top: -8rpx;
  border: 8rpx solid transparent;
  border-right-color: rgba(255, 255, 255, 0.95);
  border-left: none;
}
@keyframes emojiPop {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  70% {
    transform: scale(1.15);
    opacity: 1;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

/* 快捷短语按钮：表情按钮右侧 */
.phrase-btn {
  position: fixed;
  left: 184rpx;
  bottom: 170rpx;
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  border: 2rpx solid rgba(243, 226, 192, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 34rpx;
  z-index: 30;
}

/* 短语选择面板：复用表情面板样式 */
.phrase-mask {
  z-index: 40;
}
.phrase-panel {
  position: fixed;
  left: 20rpx;
  bottom: 260rpx;
  width: 460rpx;
  max-height: 500rpx;
  background: #ffffff;
  border-radius: 20rpx;
  box-shadow: 0 8rpx 30rpx rgba(0, 0, 0, 0.4);
  padding: 16rpx;
  box-sizing: border-box;
  z-index: 41;
}
.phrase-scroll {
  max-height: 468rpx;
}
.phrase-grid {
  display: flex;
  flex-wrap: wrap;
}
.phrase-item {
  width: 132rpx;
  height: 72rpx;
  margin: 6rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12rpx;
  background: #faf6ed;
  border: 1rpx solid #e8dcc0;
}
.phrase-item:active {
  background: #f0e6d2;
}
.phrase-item-text {
  font-size: 26rpx;
  color: #5a3a1a;
  font-family: 'Kaiti SC', 'STKaiti', 'KaiTi', serif;
}

/* 短语气泡：和表情气泡同位置/动画，文字版 */
.phrase-bubble {
  position: absolute;
  left: 76rpx;
  top: -30rpx;
  z-index: 20;
  padding: 10rpx 16rpx;
  background: rgba(255, 255, 255, 0.95);
  border-radius: 18rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.35);
  animation: emojiPop 0.25s ease-out;
  white-space: nowrap;
}
.phrase-bubble-text {
  font-size: 26rpx;
  color: #5a3a1a;
  font-family: 'Kaiti SC', 'STKaiti', 'KaiTi', serif;
}
.phrase-bubble::after {
  content: '';
  position: absolute;
  left: -8rpx;
  top: 50%;
  margin-top: -8rpx;
  border: 8rpx solid transparent;
  border-right-color: rgba(255, 255, 255, 0.95);
  border-left: none;
}
</style>
