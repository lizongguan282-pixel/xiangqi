<template>
  <view class="page">
    <view class="top-bar">
      <view class="avatar-frame">
        <image
          class="avatar-img"
          :src="avatarSrc(avatarUrl)"
          mode="aspectFill"
          @error="avatarUrl = ''"
        />
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

          <!-- 楚河汉界 -->
          <view class="river-text river-left">汉界</view>
          <view class="river-text river-right">楚河</view>

          <!-- 炮位/兵位标记 -->
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
      </view>

      <view class="board-overlay">
        <view class="info-card">
          <view class="card-title">
            <text>揭棋</text>
          </view>
          <view class="card-body">
            <text class="card-line">局时: 10分</text>
            <text class="card-line">步时: 1分</text>
            <text class="card-line">读秒: 30秒</text>
          </view>
        </view>
        <view class="btn-row">
          <view class="btn btn-start" @click="startGame">开 始</view>
          <button class="btn btn-invite" open-type="share">邀请好友</button>
        </view>
        <view class="btn-row btn-row-2">
          <view class="btn btn-join" @click="openJoinModal">加入房间</view>
        </view>
        <view class="stamp" v-if="prepared">已准备</view>
      </view>
    </view>

    <view class="float-btns">
      <view class="circle-btn">🔊</view>
      <view class="circle-btn">💬</view>
    </view>

    <view class="player-info">
      <text class="player-name">[揭1-1] {{ userName }}</text>
      <view class="avatar-frame small">
        <image class="avatar-img" :src="avatarSrc(avatarUrl)" mode="aspectFill" @error="avatarUrl = ''" />
      </view>
    </view>

    <!-- 房间等待浮层：准备后等对方加入 + 双方就绪 -->
    <view class="mask" v-if="waiting">
      <view class="modal">
        <text class="modal-title">等待对手</text>
        <text class="room-id-label">房间号</text>
        <view class="room-id-wrap" @click="copyRoomId">
          <text class="room-id">{{ roomId }}</text>
          <text class="copy-tag">点击复制</text>
        </view>
        <view class="room-status">
          <view class="rs-row">
            <view class="rs-avatar">
              <image class="rs-avatar-img" :src="avatarSrc(avatarUrl)" mode="aspectFill" />
            </view>
            <text class="rs-name">{{ userName || '玩家' }}</text>
            <text class="rs-tag ready">已准备</text>
          </view>
          <view class="rs-row" v-if="oppInRoom">
            <view class="rs-avatar">
              <image class="rs-avatar-img" :src="avatarSrc(oppPlayer && oppPlayer.avatarUrl)" mode="aspectFill" />
            </view>
            <text class="rs-name">{{ (oppPlayer && oppPlayer.nickname) || '对手' }}</text>
            <text class="rs-tag" :class="oppPlayer.ready ? 'ready' : 'waiting'">
              {{ oppPlayer.ready ? '已准备' : '准备中…' }}
            </text>
          </view>
          <view class="rs-row" v-else>
            <view class="rs-avatar rs-avatar-empty"><text>？</text></view>
            <text class="rs-name rs-name-empty">等待对方加入…</text>
          </view>
        </view>
        <text class="rs-hint">双方准备后自动开局</text>
        <view class="modal-btn-row">
          <button class="ghost-btn" @click="leaveRoom">退出房间</button>
          <button class="confirm-btn" open-type="share">分享邀请</button>
        </view>
      </view>
    </view>

    <!-- 加入房间弹窗 -->
    <view class="mask" v-if="showJoinModal">
      <view class="modal">
        <text class="modal-title">输入房间号</text>
        <input
          class="name-input"
          v-model="joinInput"
          placeholder="请输入 8 位房间号"
          placeholder-class="input-placeholder"
          maxlength="16"
          focus
        />
        <view class="modal-btn-row">
          <button class="ghost-btn" @click="showJoinModal = false">取消</button>
          <button class="confirm-btn" @click="confirmJoinRoom">加入</button>
        </view>
      </view>
    </view>

    <view class="mask" v-if="showNameModal">
      <view class="modal">
        <text class="modal-title">设置你的信息</text>
        <!-- 选择微信头像：小程序用 open-type="chooseAvatar" 新规范；H5 用 chooseImage 手动选 -->
        <view class="avatar-pick">
          <!-- #ifdef H5 -->
          <view class="avatar-frame small" @click="chooseAvatar">
            <image class="avatar-img" :src="avatarSrc(avatarUrl)" mode="aspectFill" @error="avatarUrl = ''" />
          </view>
          <!-- #endif -->
          <!-- #ifndef H5 -->
          <button class="avatar-btn" open-type="chooseAvatar" @chooseavatar="onChooseAvatar">
            <image class="avatar-img small-img" :src="avatarSrc(avatarUrl)" mode="aspectFill" @error="avatarUrl = ''" />
          </button>
          <!-- #endif -->
          <text class="avatar-tip">点击选择微信头像</text>
        </view>
        <input
          class="name-input"
          v-model="nameInput"
          placeholder="请输入名字"
          placeholder-class="input-placeholder"
          maxlength="10"
          focus
        />
        <button class="confirm-btn" @click="confirmName">确定</button>
      </view>
    </view>
  </view>
</template>

<script>
import api, { DEFAULT_AVATAR } from '../../api'

export default {
  data() {
    return {
      showNameModal: false,
      nameInput: '',
      avatarUrl: '', // 临时头像（选好后本次会话内使用）
      userName: '',
      roomId: '', // 有值=从好友邀请进入 / 已创建房间
      prepared: false,
      waiting: false, // 准备后等待对方 + 开局
      roomInfo: null, // Room 结构（room_update 推送 / 查询得到）
      mySide: 'red', // 我是红方还是黑方
      showJoinModal: false,
      joinInput: '',
      unsubs: [], // WS 订阅取消函数
      enteredGame: false, // 本房间是否已进入过对局（返回首页时据此清空旧房间状态）
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
    // 等待浮层中"对方"的玩家信息（从 Room 结构按 mySide 取）
    oppPlayer() {
      if (!this.roomInfo) return null
      const oppSide = this.mySide === 'red' ? 'black' : 'red'
      return this.roomInfo[oppSide] || null
    },
    oppInRoom() {
      return !!(this.oppPlayer && this.oppPlayer.userId)
    },
  },
  onLoad(options) {
    // 不读缓存：每次重新加载小程序都要重新输名字
    this.userName = ''
    if (options && options.roomId) {
      this.roomId = options.roomId
      // 先弹名字，确认后再 join
      this.showNameModal = true
    } else {
      // 正常打开：每次都弹名字
      this.showNameModal = true
    }
  },
  onShow() {
    // 从其他页面切回来、或小程序前台唤醒，只要没名字就继续弹
    if (!this.userName) {
      this.showNameModal = true
      return
    }
    // 从对局页返回首页（index 重新成为栈顶）：
    // 上一局房间已结束（服务端会回收），必须清空旧 roomId，
    // 否则再点「开始」会对旧房间 setReady 报"房间不存在"，无法新建房
    if (this.enteredGame) {
      this.enteredGame = false
      const oldRoom = this.roomId
      this.waiting = false
      this.prepared = false
      this.roomId = ''
      this.roomInfo = null
      this.mySide = 'red'
      if (oldRoom) api.leaveRoom(oldRoom).catch(() => {}) // 尽量让服务端也移除（失败无碍）
    }
  },
  onUnload() {
    this.unsubs.forEach((off) => off())
    this.unsubs = []
  },
  onShareAppMessage() {
    return {
      title: '来和我下一局揭棋吧！',
      path: '/pages/index/index' + (this.roomId ? '?roomId=' + this.roomId : ''),
    }
  },
  methods: {
    confirmName() {
      const name = this.nameInput.trim()
      if (!name) {
        uni.showToast({ title: '请输入名字', icon: 'none' })
        return
      }
      this.userName = name
      // 名字不持久化：关闭重开小程序就必须重新输入
      this.showNameModal = false
      this.login().then(() => {
        // 好友从分享链接带 roomId 进入：输完名字自动加入房间
        if (this.roomId) {
          this.prepared = true
          this.joinRoom()
        }
      })
    },
    // 选择微信头像：新小程序基础库 <button open-type="chooseAvatar">；H5/旧基础库降级为 chooseImage
    chooseAvatar() {
      // #ifdef H5
      uni.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const path = res.tempFilePaths && res.tempFilePaths[0]
          if (!path) return
          // blob: URL 只在当前浏览器页面有效，转 base64 dataURL 才能跨端/提交后端
          fetch(path)
            .then((r) => r.blob())
            .then((blob) => {
              const reader = new FileReader()
              reader.onload = () => { this.avatarUrl = reader.result }
              reader.readAsDataURL(blob)
            })
            .catch(() => { this.avatarUrl = path })
        },
      })
      // #endif
      // #ifndef H5
      // 小程序端：open-type="chooseAvatar" 在模板中绑定 onChooseAvatar；此处为兜底手动选图
      uni.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: (res) => {
          const f = res.tempFiles && res.tempFiles[0]
          if (f && f.tempFilePath) this.localToDataUrl(f.tempFilePath)
        },
        fail: () => {},
      })
      // #endif
    },
    // 新规范：头像按钮触发的 chooseavatar（模板 button @chooseavatar 回传）
    onChooseAvatar(e) {
      const url = e && e.detail && e.detail.avatarUrl
      if (!url) return
      // 注意：chooseAvatar 返回的多是本机临时路径（http://tmp/... 开发者工具 / wxfile:// 真机），
      // 只有 https 的微信 CDN 地址才能直接给对方用；其余一律转 base64 再提交
      const isLocalTmp = url.indexOf('wxfile://') === 0 || url.indexOf('http://tmp') === 0 || url.indexOf('blob:') === 0
      if (/^https:\/\//.test(url) && !isLocalTmp) {
        this.avatarUrl = url
      } else {
        this.localToDataUrl(url)
      }
    },
    // 小程序本地临时图片 → 压缩 → base64 dataURL（跨端可见，可提交后端存储）
    localToDataUrl(filePath) {
      // #ifndef H5
      uni.compressImage({
        src: filePath,
        quality: 80,
        success: (cr) => this.readFileAsDataUrl(cr.tempFilePath || filePath),
        fail: () => this.readFileAsDataUrl(filePath),
      })
      // #endif
      // #ifdef H5
      this.avatarUrl = filePath
      // #endif
    },
    // #ifndef H5
    readFileAsDataUrl(filePath) {
      try {
        uni.getFileSystemManager().readFile({
          filePath,
          encoding: 'base64',
          success: (r) => {
            const ext = ((filePath.match(/\.(\w+)(\?|$)/) || [])[1] || 'jpeg').toLowerCase()
            const mime = ext === 'png' ? 'image/png' : 'image/jpeg'
            this.avatarUrl = 'data:' + mime + ';base64,' + r.data
          },
          fail: () => { this.avatarUrl = filePath }, // 兜底：本端临时路径仍可显示
        })
      } catch (err) {
        this.avatarUrl = filePath
      }
    },
    // #endif
    // 显示层过滤：blob: 等小程序无法加载的协议回落默认图
    avatarSrc(url) {
      if (!url) return DEFAULT_AVATAR
      // #ifndef H5
      if (url.indexOf('blob:') === 0) return DEFAULT_AVATAR
      // #endif
      return url
    },
    // 微信登录 → 拿 token → 连 WebSocket 订阅房间/开局推送
    // H5 环境无 uni.login，直接用随机 code 调登录（后端开发模式 code 可传任意字符串）
    login() {
      return new Promise((resolve) => {
        const doLogin = async (code) => {
          try {
            const data = await api.login(code, this.userName, this.avatarUrl || undefined)
            uni.setStorageSync('token', data.token)
            if (data.userId) uni.setStorageSync('userId', data.userId)
            this.bindWS()
          } catch (e) {
            uni.showToast({ title: e.message, icon: 'none' })
          }
          resolve()
        }
        // #ifdef H5
        doLogin('h5_' + Date.now())
        // #endif
        // #ifndef H5
        uni.login({
          provider: 'weixin',
          success: (res) => doLogin(res.code),
          fail: () => resolve(),
        })
        // #endif
      })
    },
    // 订阅房间变化与开局推送（docs/api.md §4.2）
    bindWS() {
      const ws = api.ws
      const token = uni.getStorageSync('token')
      if (token) ws.connect(token)
      // room_update：对方加入/离开/准备状态变化
      this.unsubs.push(
        ws.on('room_update', (room) => {
          this.roomInfo = room
          // 加入房间后，根据自己所在位置判定 mySide（创建者=red，受邀方=black）
          const meId = uni.getStorageSync('userId')
          if (room.red && room.red.userId === meId) this.mySide = 'red'
          if (room.black && room.black.userId === meId) this.mySide = 'black'
        })
      )
      // game_start：双方就绪，服务端自动开局 → 跳对局页
      this.unsubs.push(
        ws.on('game_start', (state) => {
          this.waiting = false
          this.enteredGame = true // 进入过对局：返回首页后旧房间不可复用
          if (state.myColor) this.mySide = state.myColor
          uni.navigateTo({ url: '/pages/game/game?roomId=' + this.roomId })
        })
      )
    },
    // 加入好友房间（邀请链接进入 / 手动输房间号进入）
    async joinRoom() {
      if (!this.roomId) return
      try {
        const room = await api.joinRoom(this.roomId)
        this.roomInfo = room
        const meId = uni.getStorageSync('userId')
        if (room.red && room.red.userId === meId) this.mySide = 'red'
        if (room.black && room.black.userId === meId) this.mySide = 'black'
        // 加入后自动 ready + 显示等待浮层
        await api.setReady(this.roomId, true)
        this.prepared = true
        this.waiting = true
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' })
      }
    },
    async startGame() {
      if (this.waiting) return
      try {
        if (!this.roomId) {
          // 创建房间（创建者=红方，揭棋，局时10分/步时1分）
          const room = await api.createRoom()
          this.roomId = room.roomId
          this.roomInfo = room
          this.mySide = 'red'
        }
        await api.setReady(this.roomId, true)
        this.prepared = true
        this.waiting = true
        // 收到 game_start 推送后自动跳转对局页（见 bindWS）
      } catch (e) {
        uni.showToast({ title: e.message, icon: 'none' })
      }
    },
    // 手动加入房间弹窗
    openJoinModal() {
      this.joinInput = ''
      this.showJoinModal = true
    },
    async confirmJoinRoom() {
      const id = this.joinInput.trim().toUpperCase()
      if (!id) {
        uni.showToast({ title: '请输入房间号', icon: 'none' })
        return
      }
      this.showJoinModal = false
      this.roomId = id
      await this.joinRoom()
    },
    // 退出房间（真的调用 leaveRoom，服务端会从房间移除，游戏中离开=认输）
    async leaveRoom() {
      try {
        if (this.roomId) await api.leaveRoom(this.roomId)
      } catch (e) {
        // 已失效房间也按本地清理处理
      }
      this.waiting = false
      this.prepared = false
      this.roomId = ''
      this.roomInfo = null
      this.mySide = 'red'
    },
    // 复制房间号
    copyRoomId() {
      uni.setClipboardData({
        data: this.roomId || '',
        success: () => uni.showToast({ title: '房间号已复制', icon: 'none' }),
      })
    },
  },
}
</script>

<style>
.page {
  position: relative;
  width: 100%;
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
  overflow: hidden;
}

.top-bar {
  position: absolute;
  top: 100rpx;
  left: 30rpx;
  z-index: 10;
}

.avatar-frame {
  width: 120rpx;
  height: 120rpx;
  background: #d8d5cc;
  border: 5rpx solid #c9bd9c;
  border-radius: 14rpx;
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.35);
  position: relative;
  overflow: hidden;
}
.avatar-img {
  width: 100%;
  height: 100%;
  display: block;
  background: #d8d5cc;
}

.avatar-frame.small {
  width: 110rpx;
  height: 110rpx;
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

/* 名字弹窗里的头像选择区 */
.avatar-pick {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 32rpx;
}
.avatar-btn {
  padding: 0 !important;
  margin: 0 !important;
  width: 140rpx;
  height: 140rpx;
  border: 5rpx solid #c9bd9c;
  border-radius: 14rpx;
  background: #d8d5cc !important;
  overflow: hidden;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.25);
}
.avatar-btn::after { border: none; }
.avatar-img.small-img {
  width: 100%;
  height: 100%;
}
.avatar-tip {
  font-size: 22rpx;
  color: #8a7f68;
  margin-top: 14rpx;
}

.board-wrap {
  position: relative;
  width: 96%;
  margin-top: 240rpx;
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

/* 楚河汉界 */
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

/* 炮位/兵位折角标记（角贴交点，臂沿棋盘线向外） */
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

/* 左上象限：竖臂贴纵线向上、横臂贴横线向左，交于靠近交点的角 */
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

/* 边线上的兵位只画内侧标记 */
.mark-edge-l .mk-tl,
.mark-edge-l .mk-bl,
.mark-edge-r .mk-tr,
.mark-edge-r .mk-br {
  display: none;
}

.board-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 12%;
}

.info-card {
  width: 80%;
  background: #f8f1dc;
  border: 2rpx solid #cbb98a;
  border-radius: 16rpx;
  padding: 30rpx;
  box-shadow: 0 6rpx 16rpx rgba(90, 50, 10, 0.25);
}

.card-title {
  width: 320rpx;
  margin: 0 auto;
  text-align: center;
  border-top: 2rpx solid #b49b62;
  border-bottom: 2rpx solid #b49b62;
  padding: 12rpx 0;
  position: relative;
  font-size: 40rpx;
  font-weight: bold;
  color: #3a2a1a;
  letter-spacing: 6rpx;
}

.card-body {
  margin-top: 26rpx;
  background: #f3e9cb;
  border-radius: 8rpx;
  padding: 30rpx 60rpx;
  display: flex;
  flex-direction: column;
}

.card-line {
  font-size: 34rpx;
  color: #3a2a1a;
  line-height: 2;
}

.btn-row {
  margin-top: 34rpx;
  width: 92%;
  display: flex;
  justify-content: space-between;
}
.btn-row-2 {
  margin-top: 18rpx;
  justify-content: center;
}

.btn {
  width: 44%;
  height: 92rpx;
  line-height: 92rpx;
  text-align: center;
  border-radius: 46rpx;
  font-size: 36rpx;
  font-weight: bold;
  color: #6e2a1e;
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

.btn-start {
  background: linear-gradient(180deg, #e2d7bd, #b9ac90);
  border: 2rpx solid #a3946f;
  box-shadow: 0 6rpx 0 rgba(120, 100, 60, 0.45);
}

.btn-invite {
  background: linear-gradient(180deg, #f7d47f, #dfa53c);
  border: 2rpx solid #c78f2a;
  box-shadow: 0 6rpx 0 rgba(160, 110, 20, 0.55);
}

.btn-invite::after {
  border: none;
}

.btn-join {
  width: 92%;
  background: linear-gradient(180deg, #d5ded0, #9db295);
  border: 2rpx solid #7b9576;
  box-shadow: 0 6rpx 0 rgba(90, 120, 80, 0.45);
  color: #2c4430;
}

.stamp {
  margin-top: 40rpx;
  transform: rotate(-12deg);
  color: #cf2a1b;
  border: 6rpx solid #cf2a1b;
  border-radius: 10rpx;
  padding: 4rpx 28rpx;
  font-size: 64rpx;
  font-weight: bold;
  letter-spacing: 8rpx;
  opacity: 0.85;
}

.float-btns {
  position: absolute;
  left: 30rpx;
  bottom: 100rpx;
  display: flex;
  z-index: 10;
}

.circle-btn {
  width: 90rpx;
  height: 90rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
  margin-right: 24rpx;
  box-shadow: 0 4rpx 10rpx rgba(0, 0, 0, 0.3);
}

.player-info {
  position: absolute;
  right: 24rpx;
  bottom: 100rpx;
  display: flex;
  align-items: center;
  z-index: 10;
}

.player-name {
  background: rgba(45, 28, 16, 0.8);
  color: #ffffff;
  font-size: 30rpx;
  padding: 10rpx 20rpx;
  border-radius: 10rpx;
  margin-right: 16rpx;
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
  font-size: 36rpx;
  font-weight: bold;
  color: #5a3a1a;
}

.name-input {
  margin-top: 40rpx;
  width: 100%;
  height: 88rpx;
  border: 2rpx solid #d9c39a;
  border-radius: 12rpx;
  padding: 0 24rpx;
  box-sizing: border-box;
  font-size: 30rpx;
  background: #ffffff;
}

.input-placeholder {
  color: #bfae8a;
}

.confirm-btn {
  height: 88rpx;
  line-height: 88rpx;
  background: #c0392b;
  color: #ffffff;
  font-size: 32rpx;
  border-radius: 12rpx;
  border: none;
  flex: 1;
  margin-left: 16rpx;
}

.confirm-btn::after {
  border: none;
}

/* 弹窗按钮行（左右两列） */
.modal-btn-row {
  margin-top: 32rpx;
  width: 100%;
  display: flex;
  justify-content: space-between;
}

/* 房间等待浮层 */
.room-id-label {
  margin-top: 10rpx;
  font-size: 26rpx;
  color: #a18a65;
  letter-spacing: 2rpx;
}
.room-id-wrap {
  margin-top: 6rpx;
  padding: 18rpx 28rpx;
  background: #fff5d9;
  border: 2rpx dashed #d9b85c;
  border-radius: 10rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.room-id {
  font-size: 56rpx;
  font-weight: bold;
  letter-spacing: 8rpx;
  color: #3a2a1a;
}
.copy-tag {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: #a18a65;
}

.room-status {
  margin-top: 24rpx;
  width: 100%;
  background: #f3e9cb;
  border-radius: 8rpx;
  padding: 24rpx 30rpx;
  box-sizing: border-box;
}

.rs-line {
  font-size: 30rpx;
  color: #3a2a1a;
  line-height: 1.8;
  display: block;
}

/* 等待浮层玩家行（头像 + 昵称 + 状态） */
.rs-row {
  display: flex;
  align-items: center;
  padding: 12rpx 0;
}
.rs-avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 12rpx;
  border: 3rpx solid #c9bd9c;
  overflow: hidden;
  background: #d8d5cc;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.rs-avatar-img {
  width: 100%;
  height: 100%;
}
.rs-avatar-empty {
  color: #b0a58a;
  font-size: 34rpx;
  font-weight: bold;
}
.rs-name {
  flex: 1;
  margin-left: 18rpx;
  font-size: 30rpx;
  color: #3a2a1a;
}
.rs-name-empty {
  color: #8a7f68;
}
.rs-tag {
  font-size: 24rpx;
  padding: 6rpx 18rpx;
  border-radius: 20rpx;
}
.rs-tag.ready {
  background: #e3f0dc;
  color: #3a7a32;
}
.rs-tag.waiting {
  background: #f7ecc9;
  color: #a18a45;
}

.rs-hint {
  margin-top: 24rpx;
  font-size: 26rpx;
  color: #bfae8a;
}

.ghost-btn {
  height: 88rpx;
  line-height: 88rpx;
  background: transparent;
  color: #8a6a3a;
  font-size: 30rpx;
  border-radius: 12rpx;
  border: 2rpx solid #d9c39a;
  flex: 1;
  margin-right: 16rpx;
}

.ghost-btn::after {
  border: none;
}
</style>
