const app = getApp();
const { calculateDistance } = require('../../core/utils/location.js');
const { DISTANCE, LIMITS, MESSAGE_TYPES } = require('../../core/utils/constants.js');
const storage = require('../../core/utils/storage.js');

Page({
  data: {
    targetUserId: '',
    targetUser: null,
    messages: [],
    inputContent: '',
    hasInputContent: false,  // 新增：控制发送按钮显示
    scrollIntoView: '',
    inRange: true,
    reportModalVisible: false,
    isMockChat: false,
    isLoading: false,
    userLocation: null,
    locationPermission: false,
    messagePageSize: 20,
    hasMoreMessages: true,
    isLoadingMore: false,
    isRecording: false,
    recordDuration: 0,
    replyingTo: null,
    showReplyPanel: false,
    isSending: false,
    isDarkMode: false,
    showMorePanel: false
  },

  // 状态订阅取消函数
  unsubscribers: [],
  
  // 距离检查定时器
  distanceCheckTimer: null,
  
  // 语音录制相关
  recordManager: null,
  recordTimer: null,

  onLoad: function (options) {
    const targetUserId = options.targetUserId;
    this.setData({ targetUserId });
    
    this.initChat(targetUserId);
    this.getUserLocation();
    
    // 初始化录音管理器
    this.recordManager = wx.getRecorderManager();
    this.initRecordManager();
    
    // 新增：为当前用户生成可用头像地址
    const currentUser = (app.globalData && app.globalData.user) || {};
    this.setData({
      currentUserAvatarSrc: this.generateAvatarPath(currentUser.avatarUrl)
    });
    
    // 加载主题设置
    const savedTheme = wx.getStorageSync('isDarkMode');
    if (savedTheme !== '') {
      this.setData({ isDarkMode: savedTheme });
    } else {
      // 根据系统主题自动设置
      wx.getSystemInfo({
        success: (res) => {
          if (res.theme === 'dark') {
            this.setData({ isDarkMode: true });
          }
        }
      });
    }
  },

  onUnload: function () {
    this.cleanup();
  },

  /**
   * 初始化聊天
   */
  async initChat(targetUserId) {
    try {
      this.setData({ isLoading: true });
      
      // 订阅状态变化
      this.subscribeToStore();
      
      if (targetUserId === 'mock_user_001') {
        await this.initMockChat();
      } else {
        await this.initRealChat(targetUserId);
      }
      
    } catch (error) {
      console.error('初始化聊天失败:', error);
      wx.showToast({
        title: '初始化失败',
        icon: 'none'
      });
    } finally {
      this.setData({ isLoading: false });
    }
  },

  /**
   * 订阅状态管理器
   */
  formatTimeMs: function(ts) {
    let ms = ts;
    if (ts && typeof ts === 'object' && typeof ts.getTime === 'function') {
      ms = ts.getTime();
    } else if (typeof ts !== 'number') {
      return '';
    }
    const d = new Date(ms);
    let h = d.getHours();
    let m = d.getMinutes();
    if (h < 10) h = '0' + h;
    if (m < 10) m = '0' + m;
    return h + ':' + m;
  },

  mapMessagesWithDisplayTime: function(messages) {
    const self = this;
    return (messages || []).map(function (msg) {
      let ms = Date.now();
      if (msg && msg.timestamp) {
        if (typeof msg.timestamp === 'object' && typeof msg.timestamp.getTime === 'function') {
          ms = msg.timestamp.getTime();
        } else if (typeof msg.timestamp === 'number') {
          ms = msg.timestamp;
        }
      }
      return Object.assign({}, msg, { displayTime: self.formatTimeMs(ms) });
    });
  },

  subscribeToStore: function() {
    const store = app.getStore();

    const unsubscribeChat = store.subscribe('chat', (chatState) => {
      const transformed = this.mapMessagesWithDisplayTime(chatState.messages);
      this.setData({
        messages: transformed,
        inRange: chatState.isInChatRange
      });

      if (transformed.length > 0) {
        this.setData({
          scrollIntoView: 'msg-' + (transformed.length - 1)
        });
      }
    });

    this.unsubscribers.push(unsubscribeChat);
  },

  /**
   * 初始化模拟聊天
   */
  async initMockChat() {
    const targetUser = {
      _id: 'mock_user_001',
      nickname: '小凼',
      avatarUrl: '#4ECDC4',
      isMock: true
    };
    // 新增：为 targetUser 生成可用头像地址
    targetUser.avatarSrc = this.generateAvatarPath(targetUser.avatarUrl);
    
    this.setData({
      targetUser,
      isMockChat: true,
      inRange: true
    });
    
    // 从本地存储获取聊天记录
    const savedMessages = storage.getStorage('mockUserMessages', []);
    
    if (savedMessages.length > 0) {
      const transformed = this.mapMessagesWithDisplayTime(savedMessages);
      this.setData({ messages: transformed });
    } else {
      const now = Date.now();
      const initialRaw = [
        {
          _id: 'init_1',
          content: '您好！我是小凼，很高兴认识您！',
          senderId: 'mock_user_001',
          type: MESSAGE_TYPES.TEXT,
          timestamp: now - 120000,
          status: 'sent'
        },
        {
          _id: 'init_2',
          content: '我会陪伴您的出行，有什么我能帮到您的吗？',
          senderId: 'mock_user_001',
          type: MESSAGE_TYPES.TEXT,
          timestamp: now - 60000,
          status: 'sent'
        }
      ];
      const initialMessages = this.mapMessagesWithDisplayTime(initialRaw);
      this.setData({ messages: initialMessages });
      storage.setStorage('mockUserMessages', initialMessages);
    }
    
    if (this.data.messages.length > 0) {
      this.setData({
        scrollIntoView: 'msg-' + (this.data.messages.length - 1)
      });
    }
  },

  /**
   * 初始化真实聊天
   */
  async initRealChat(targetUserId) {
    const store = app.getStore();
    const api = app.getApi();
    
    try {
      // 获取目标用户信息
      const targetUser = await api.user.getUserInfo(targetUserId);
      // 新增：为 targetUser 生成可用头像地址
      targetUser.avatarSrc = this.generateAvatarPath(targetUser.avatarUrl);
      this.setData({ targetUser });
      
      // 开始聊天
      await store['chat/startChat']({
        targetUserId,
        targetUser
      });
      
      // 开始距离检查
      this.startDistanceCheck();
      
    } catch (error) {
      console.error('初始化真实聊天失败:', error);
      throw error;
    }
  },

  /**
   * 开始距离检查
   */
  startDistanceCheck: function() {
    // 立即检查一次
    this.checkDistance();
    
    // 每10秒检查一次
    this.distanceCheckTimer = setInterval(() => {
      this.checkDistance();
    }, 10000);
  },

  /**
   * 检查距离
   */
  async checkDistance() {
    const store = app.getStore();
    const api = app.getApi();
    
    try {
      const locationState = store.getState('location');
      const myLocation = locationState.currentLocation;
      
      if (!myLocation) {
        return;
      }
      
      // 获取目标用户最新位置
      const targetUser = await api.user.getUserInfo(this.data.targetUserId);
      
      if (!targetUser.location || !targetUser.location.coordinates) {
        return;
      }
      
      const targetLocation = {
        latitude: targetUser.location.coordinates[1],
        longitude: targetUser.location.coordinates[0]
      };
      
      // 计算距离
      const distance = calculateDistance(
        myLocation.latitude,
        myLocation.longitude,
        targetLocation.latitude,
        targetLocation.longitude
      );
      
      const inRange = distance <= DISTANCE.CHAT_RANGE;
      
      // 更新聊天范围状态
      store['chat/SET_CHAT_RANGE_STATUS'](inRange);
      
      // 如果超出范围，提示用户
      if (!inRange && this.data.messages.length > 0) {
        wx.showToast({
          title: '对方已超出聊天范围',
          icon: 'none'
        });
      }
      
    } catch (error) {
      console.error('检查距离失败:', error);
    }
  },

  /**
   * 输入消息内容
   */
  onInputChange: function(e) {
    console.log('输入内容:', e.detail.value); // 添加调试日志
    console.log('trim后:', e.detail.value.trim()); // 检查trim结果
    const inputContent = e.detail.value;
    const hasContent = inputContent.trim().length > 0;
    
    this.setData({
      inputContent: inputContent,
      hasInputContent: hasContent  // 新增：专门控制发送按钮显示的布尔值
    });
    console.log('当前inputContent:', this.data.inputContent); // 确认数据更新
    console.log('hasInputContent:', this.data.hasInputContent); // 确认按钮显示状态
  },

  // 新增：头像路径修正工具，防止颜色值(#xxxxxx)被当作图片路径
  generateAvatarPath: function(avatarUrl) {
    if (avatarUrl && avatarUrl.startsWith('#')) {
      return '/images/mock_avatar.png';
    }
    if (avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('/'))) {
      return avatarUrl;
    }
    return '/images/mock_avatar.png';
  },

  /**
   * 发送消息
   */
  async sendMessage() {
    const content = this.data.inputContent.trim();
    if (!content || !this.data.inRange) return;
    
    this.setData({ 
      inputContent: '',
      hasInputContent: false  // 重置发送按钮显示状态
    });
    
    const message = {
      id: Date.now().toString(),
      content,
      type: 'text',
      senderId: app.globalData.userId,
      timestamp: Date.now(),
      quotedMessage: this.data.replyingTo,
      readStatus: 'unread',
      status: 'sending'
    };
    
    this.setData({
      messages: [...this.data.messages, message]
    });
    
    try {
      if (this.data.isMockChat) {
        await this.sendMockMessage(content);
      } else {
        await this.sendRealMessage(message);
      }
      
      const messages = this.data.messages;
      const lastMessage = messages[messages.length - 1];
      lastMessage.status = 'sent';
      this.setData({ messages });
      
    } catch (error) {
      console.error('发送失败', error);
      const messages = this.data.messages;
      const lastMessage = messages[messages.length - 1];
      lastMessage.status = 'failed';
      this.setData({ messages });
    }
    
    this.cancelReply();
    this.scrollToBottom();
  },
  
  markMessagesAsRead: function() {
    const messages = this.data.messages.map(msg => {
      if (msg.senderId === this.data.targetUserId && msg.readStatus === 'unread') {
        msg.readStatus = 'read';
      }
      return msg;
    });
    
    this.setData({ messages });
    this.sendReadReceipt();
  },
  
  async sendReadReceipt() {
    try {
      await wx.cloud.callFunction({
        name: 'updateReadStatus',
        data: {
          targetUserId: this.data.targetUserId,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('发送已读回执失败', error);
    }
  },
  
  onShow: function() {
    this.markMessagesAsRead();
  },

  /**
   * 发送模拟消息
   */
  async sendMockMessage(content) {
    const store = app.getStore();
    const api = app.getApi();
    const userState = store.getState('user');
  
    const now = Date.now();
    const userMessage = {
      _id: 'temp_' + now,
      content,
      senderId: userState.userId,
      type: MESSAGE_TYPES.TEXT,
      timestamp: now,
      status: 'sent',
      displayTime: this.formatTimeMs(now)
    };
  
    const messages = [...this.data.messages, userMessage];
    this.setData({ messages });
    storage.setStorage('mockUserMessages', messages);
    this.setData({ scrollIntoView: 'msg-' + (messages.length - 1) });
  
    wx.showLoading({ title: '小凼正在思考...', mask: false });
    
    const timeoutWarning = setTimeout(() => {
      wx.showLoading({ title: '网络有点慢，请稍候...', mask: false });
    }, 3000);
    
    try {
      const history = this.data.messages.slice(-5).map((msg) => ({
        role: msg.senderId === userState.userId ? 'user' : 'assistant',
        content: msg.content
      }));
  
      const locationState = store.getState('location') || {};
      const location = this.data.userLocation || locationState.currentLocation || null;
  
      const aiResponse = await api.chat.sendAIMessage(
        content,
        history,
        location,
        userState.userId
      );
  
      clearTimeout(timeoutWarning);
      wx.hideLoading();
  
      if (aiResponse && aiResponse.reply) {
        const ts = Date.now();
        const aiMessage = {
          _id: 'ai_' + ts,
          content: aiResponse.reply,
          senderId: 'mock_user_001',
          type: MESSAGE_TYPES.TEXT,
          timestamp: ts,
          status: 'sent',
          displayTime: this.formatTimeMs(ts)
        };
  
        const updatedMessages = [...this.data.messages, aiMessage];
        this.setData({ messages: updatedMessages });
        storage.setStorage('mockUserMessages', updatedMessages);
        this.setData({ scrollIntoView: 'msg-' + (updatedMessages.length - 1) });
      }
    } catch (error) {
      clearTimeout(timeoutWarning);
      wx.hideLoading();
  
      const ts = Date.now();
      const fallbackReplies = [
        '抱歉，我现在信号不太好...',
        '网络似乎有点问题，稍后再和你聊吧',
        '我好像听不清你说什么了，再说一次？',
        '不好意思，刚才走神了，你能再说一遍吗？'
      ];
      const randomReply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)];
  
      const fallbackMessage = {
        _id: 'fallback_' + ts,
        content: randomReply,
        senderId: 'mock_user_001',
        type: MESSAGE_TYPES.TEXT,
        timestamp: ts,
        status: 'sent',
        displayTime: this.formatTimeMs(ts)
      };
  
      const updatedMessages = [...this.data.messages, fallbackMessage];
      this.setData({ messages: updatedMessages });
      storage.setStorage('mockUserMessages', updatedMessages);
      this.setData({ scrollIntoView: 'msg-' + (updatedMessages.length - 1) });
    } finally {
      wx.hideLoading();
    }
  },

  /**
   * 发送真实消息
   */
  async sendRealMessage(content) {
    if (!this.data.inRange) {
      wx.showToast({
        title: '对方已超出聊天范围',
        icon: 'none'
      });
      return;
    }
    
    const store = app.getStore();
    
    try {
      await store['chat/sendMessage']({
        content,
        type: MESSAGE_TYPES.TEXT
      });
    } catch (error) {
      console.error('发送真实消息失败:', error);
      throw error;
    }
  },

  /**
   * 显示举报对话框
   */
  showReportModal: function() {
    this.setData({ reportModalVisible: true });
  },

  /**
   * 关闭举报对话框
   */
  closeReportModal: function() {
    this.setData({ reportModalVisible: false });
  },

  /**
   * 提交举报
   */
  async submitReport(e) {
    const reason = e.currentTarget.dataset.reason;
    const api = app.getApi();
    
    try {
      await api.user.reportUser(this.data.targetUserId, reason);
      
      wx.showToast({
        title: '举报成功',
        icon: 'success'
      });
      
      this.closeReportModal();
      
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
      
    } catch (error) {
      console.error('举报失败:', error);
      wx.showToast({
        title: '举报失败',
        icon: 'none'
      });
    }
  },

  /**
   * 清理资源
   */
  cleanup: function() {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    
    if (this.distanceCheckTimer) {
      clearInterval(this.distanceCheckTimer);
      this.distanceCheckTimer = null;
    }
    
    const store = app.getStore();
    store['chat/endChat']();
  },

  /**
   * 获取用户位置
   */
  getUserLocation: function() {
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.userLocation']) {
          this.requestLocation();
        } else {
          wx.authorize({
            scope: 'scope.userLocation',
            success: () => {
              this.requestLocation();
            },
            fail: () => {
              console.log('用户拒绝位置授权');
              this.setData({ locationPermission: false });
            }
          });
        }
      }
    });
  },

  /**
   * 请求位置信息
   */
  requestLocation: function() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        console.log('获取位置成功:', res);
        this.setData({
          userLocation: {
            latitude: res.latitude,
            longitude: res.longitude
          },
          locationPermission: true
        });
        
        this.preloadNearbyMerchants();
      },
      fail: (err) => {
        console.error('获取位置失败:', err);
        this.setData({ locationPermission: false });
      }
    });
  },

  /**
   * 预加载附近商户
   */
  preloadNearbyMerchants: function() {
    if (!this.data.userLocation) return;
    
    wx.cloud.callFunction({
      name: 'getMerchants',
      data: {
        latitude: this.data.userLocation.latitude,
        longitude: this.data.userLocation.longitude,
        radius: 1000
      },
      success: (res) => {
        console.log('预加载商户成功:', res.result);
      },
      fail: (err) => {
        console.error('预加载商户失败:', err);
      }
    });
  },

  // 初始化录音管理器
  initRecordManager: function() {
    this.recordManager.onStart(() => {
      console.log('开始录音');
      this.setData({ isRecording: true, recordDuration: 0 });
      this.startRecordTimer();
    });
    
    this.recordManager.onStop((res) => {
      console.log('录音结束', res);
      this.setData({ isRecording: false });
      this.stopRecordTimer();
      
      if (res.duration > 1000) {
        this.sendVoiceMessage(res.tempFilePath, Math.floor(res.duration / 1000));
      } else {
        wx.showToast({
          title: '录音时间太短',
          icon: 'none'
        });
      }
    });
    
    this.recordManager.onError((err) => {
      console.error('录音错误', err);
      this.setData({ isRecording: false });
      this.stopRecordTimer();
      wx.showToast({
        title: '录音失败',
        icon: 'error'
      });
    });
  },

  // 开始录音
  startRecord: function() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.recordManager.start({
          duration: 60000,
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 96000,
          format: 'mp3'
        });
      },
      fail: () => {
        wx.showModal({
          title: '需要录音权限',
          content: '请在设置中开启录音权限',
          showCancel: false
        });
      }
    });
  },

  // 停止录音
  stopRecord: function() {
    this.recordManager.stop();
  },

  // 取消录音
  cancelRecord: function() {
    this.recordManager.stop();
    this.setData({ isRecording: false });
    this.stopRecordTimer();
  },

  // 录音计时器
  startRecordTimer: function() {
    this.recordTimer = setInterval(() => {
      this.setData({
        recordDuration: this.data.recordDuration + 1
      });
    }, 1000);
  },

  stopRecordTimer: function() {
    if (this.recordTimer) {
      clearInterval(this.recordTimer);
      this.recordTimer = null;
    }
  },

  // 发送语音消息
  async sendVoiceMessage(tempFilePath, duration) {
    try {
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: `voice/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp3`,
        filePath: tempFilePath
      });
      
      const voiceMessage = {
        type: 'voice',
        voicePath: uploadResult.fileID,
        duration: duration,
        senderId: app.globalData.userId,
        timestamp: Date.now(),
        quotedMessage: this.data.replyingTo
      };
      
      if (this.data.isMockChat) {
        await this.sendMockVoiceMessage(voiceMessage);
      } else {
        await this.sendRealVoiceMessage(voiceMessage);
      }
      
      this.cancelReply();
      
    } catch (error) {
      console.error('发送语音消息失败', error);
      wx.showToast({
        title: '发送失败',
        icon: 'error'
      });
    }
  },

  // 发送模拟语音消息
  async sendMockVoiceMessage(voiceMessage) {
    const messages = [...this.data.messages, voiceMessage];
    this.setData({ messages });
    storage.setStorage('mockUserMessages', messages);
    this.setData({ scrollIntoView: 'msg-' + (messages.length - 1) });
  },

  // 发送真实语音消息
  async sendRealVoiceMessage(voiceMessage) {
    const store = app.getStore();
    try {
      await store['chat/sendMessage']({
        type: MESSAGE_TYPES.VOICE,
        voicePath: voiceMessage.voicePath,
        duration: voiceMessage.duration,
        quotedMessage: voiceMessage.quotedMessage
      });
    } catch (error) {
      console.error('发送真实语音消息失败:', error);
      throw error;
    }
  },

  // 播放语音
  playVoice: function(e) {
    const { path, duration } = e.currentTarget.dataset;
    
    wx.stopBackgroundAudio();
    
    wx.playBackgroundAudio({
      dataUrl: path,
      title: '语音消息',
      success: () => {
        const messages = this.data.messages.map(msg => {
          if (msg.voicePath === path) {
            msg.isPlaying = true;
          } else {
            msg.isPlaying = false;
          }
          return msg;
        });
        this.setData({ messages });
        
        setTimeout(() => {
          const updatedMessages = this.data.messages.map(msg => {
            msg.isPlaying = false;
            return msg;
          });
          this.setData({ messages: updatedMessages });
        }, duration * 1000);
      }
    });
  },

  // 上拉加载更多消息
  onScrollToUpper: function() {
    if (this.data.hasMoreMessages && !this.data.isLoadingMore) {
      this.loadMoreMessages();
    }
  },

  async loadMoreMessages() {
    this.setData({ isLoadingMore: true });
    
    try {
      const olderMessages = await this.fetchOlderMessages();
      
      this.setData({
        messages: [...olderMessages, ...this.data.messages],
        hasMoreMessages: olderMessages.length === this.data.messagePageSize
      });
    } catch (error) {
      console.error('加载消息失败:', error);
    } finally {
      this.setData({ isLoadingMore: false });
    }
  },

  // 获取更早的消息
  async fetchOlderMessages() {
    return [];
  },

  // 添加长按消息事件处理
  onMessageLongPress: function(e) {
    const { index } = e.currentTarget.dataset;
    const message = this.data.messages[index];
    
    wx.showActionSheet({
      itemList: ['引用回复', '复制', '删除'],
      success: (res) => {
        switch(res.tapIndex) {
          case 0:
            this.startReply(message);
            break;
          case 1:
            this.copyMessage(message);
            break;
          case 2:
            this.deleteMessage(index);
            break;
        }
      }
    });
  },

  // 开始引用回复
  startReply: function(message) {
    this.setData({
      replyingTo: {
        id: message._id || message.id,
        content: message.content,
        senderName: message.senderName || '对方',
        type: message.type || 'text'
      },
      showReplyPanel: true
    });
  },

  // 取消引用回复
  cancelReply: function() {
    this.setData({
      replyingTo: null,
      showReplyPanel: false
    });
  },

  // 复制消息
  copyMessage: function(message) {
    if (message.type === 'text') {
      wx.setClipboardData({
        data: message.content,
        success: () => {
          wx.showToast({
            title: '已复制',
            icon: 'success'
          });
        }
      });
    }
  },

  // 删除消息
  deleteMessage: function(index) {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条消息吗？',
      success: (res) => {
        if (res.confirm) {
          const messages = [...this.data.messages];
          messages.splice(index, 1);
          this.setData({ messages });
          
          if (this.data.isMockChat) {
            storage.setStorage('mockUserMessages', messages);
          }
        }
      }
    });
  },

  // 切换夜间模式
  toggleDarkMode: function() {
    const isDarkMode = !this.data.isDarkMode;
    this.setData({ isDarkMode });
    
    wx.setStorageSync('isDarkMode', isDarkMode);
    
    wx.vibrateShort({
      type: 'light'
    });
  },

  // 滚动到底部
  scrollToBottom: function() {
    if (this.data.messages.length > 0) {
      this.setData({
        scrollIntoView: 'msg-' + (this.data.messages.length - 1)
      });
    }
  },

  // 返回上一页
  navigateBack: function() {
    wx.navigateBack({
      delta: 1
    });
  },

  // 显示/隐藏更多选项面板
  showMoreOptions: function() {
    this.setData({
      showMorePanel: !this.data.showMorePanel
    });
    
    wx.vibrateShort({
      type: 'light'
    });
  },

  // 选择图片
  selectImage: function() {
    const that = this;
    
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function(res) {
        const tempFilePath = res.tempFiles[0].tempFilePath;
        that.sendImageMessage(tempFilePath);
        that.setData({ showMorePanel: false });
      },
      fail: function(err) {
        console.error('选择图片失败:', err);
        wx.showToast({
          title: '选择图片失败',
          icon: 'error'
        });
      }
    });
  },

  // 选择位置
  selectLocation: function() {
    const that = this;
    
    wx.chooseLocation({
      success: function(res) {
        that.sendLocationMessage(res);
        that.setData({ showMorePanel: false });
      },
      fail: function(err) {
        console.error('选择位置失败:', err);
        wx.showToast({
          title: '选择位置失败',
          icon: 'error'
        });
      }
    });
  },

  // 选择文件
  selectFile: function() {
    wx.showToast({
      title: '文件功能开发中',
      icon: 'none'
    });
    this.setData({ showMorePanel: false });
  },

  // 发送图片消息
  async sendImageMessage(tempFilePath) {
    try {
      this.setData({ isSending: true });
      
      const cloudPath = `chat-images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`;
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: tempFilePath
      });
      
      const imageMessage = {
        id: Date.now().toString(),
        type: 'image',
        content: '[图片]',
        imageUrl: uploadResult.fileID,
        senderId: app.globalData.user.openid,
        receiverId: this.data.targetUserId,
        timestamp: Date.now(),
        status: 'sending',
        statusText: '发送中',
        statusIcon: '⏳'
      };
      
      const messages = [...this.data.messages, imageMessage];
      this.setData({ 
        messages: this.mapMessagesWithDisplayTime(messages),
        isSending: false
      });
      
      if (this.data.isMockChat) {
        await this.sendMockImageMessage(imageMessage);
      } else {
        await this.sendRealImageMessage(imageMessage);
      }
      
      this.scrollToBottom();
      
    } catch (error) {
      console.error('发送图片失败:', error);
      this.setData({ isSending: false });
      wx.showToast({
        title: '发送失败',
        icon: 'error'
      });
    }
  },

  // 发送位置消息
  async sendLocationMessage(locationData) {
    try {
      this.setData({ isSending: true });
      
      const locationMessage = {
        id: Date.now().toString(),
        type: 'location',
        content: `[位置] ${locationData.name}`,
        location: {
          name: locationData.name,
          address: locationData.address,
          latitude: locationData.latitude,
          longitude: locationData.longitude
        },
        senderId: app.globalData.user.openid,
        receiverId: this.data.targetUserId,
        timestamp: Date.now(),
        status: 'sending',
        statusText: '发送中',
        statusIcon: '⏳'
      };
      
      const messages = [...this.data.messages, locationMessage];
      this.setData({ 
        messages: this.mapMessagesWithDisplayTime(messages),
        isSending: false
      });
      
      if (this.data.isMockChat) {
        await this.sendMockLocationMessage(locationMessage);
      } else {
        await this.sendRealLocationMessage(locationMessage);
      }
      
      this.scrollToBottom();
      
    } catch (error) {
      console.error('发送位置失败:', error);
      this.setData({ isSending: false });
      wx.showToast({
        title: '发送失败',
        icon: 'error'
      });
    }
  },

  // 发送模拟图片消息
  async sendMockImageMessage(imageMessage) {
    const messages = this.data.messages.map(msg => {
      if (msg.id === imageMessage.id) {
        return {
          ...msg,
          status: 'sent',
          statusText: '已发送',
          statusIcon: '✓'
        };
      }
      return msg;
    });
    
    this.setData({ messages });
    
    setTimeout(() => {
      const replyMessage = {
        id: Date.now().toString(),
        type: 'text',
        content: '收到了你的图片！',
        senderId: this.data.targetUserId,
        receiverId: app.globalData.user.openid,
        timestamp: Date.now()
      };
      
      const newMessages = [...this.data.messages, replyMessage];
      this.setData({ 
        messages: this.mapMessagesWithDisplayTime(newMessages)
      });
      this.scrollToBottom();
    }, 2000);
  },

  // 发送模拟位置消息
  async sendMockLocationMessage(locationMessage) {
    const messages = this.data.messages.map(msg => {
      if (msg.id === locationMessage.id) {
        return {
          ...msg,
          status: 'sent',
          statusText: '已发送',
          statusIcon: '✓'
        };
      }
      return msg;
    });
    
    this.setData({ messages });
    
    setTimeout(() => {
      const replyMessage = {
        id: Date.now().toString(),
        type: 'text',
        content: '收到了你的位置信息！',
        senderId: this.data.targetUserId,
        receiverId: app.globalData.user.openid,
        timestamp: Date.now()
      };
      
      const newMessages = [...this.data.messages, replyMessage];
      this.setData({ 
        messages: this.mapMessagesWithDisplayTime(newMessages)
      });
      this.scrollToBottom();
    }, 2000);
  },

  // 发送真实图片消息
  async sendRealImageMessage(imageMessage) {
    const messages = this.data.messages.map(msg => {
      if (msg.id === imageMessage.id) {
        return {
          ...msg,
          status: 'sent',
          statusText: '已发送',
          statusIcon: '✓'
        };
      }
      return msg;
    });
    
    this.setData({ messages });
  },

  // 发送真实位置消息
  async sendRealLocationMessage(locationMessage) {
    const messages = this.data.messages.map(msg => {
      if (msg.id === locationMessage.id) {
        return {
          ...msg,
          status: 'sent',
          statusText: '已发送',
          statusIcon: '✓'
        };
      }
      return msg;
    });
    
    this.setData({ messages });
  }
});