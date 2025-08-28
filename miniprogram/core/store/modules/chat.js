module.exports = {
  state: {
    currentChatId: null,
    currentTargetUser: null,
    messages: [],
    messageListeners: {},
    unreadCounts: {},
    chatHistory: [],
    isInChatRange: true
  },

  mutations: {
    SET_CURRENT_CHAT(state, { chatId, targetUser }) {
      state.currentChatId = chatId;
      state.currentTargetUser = targetUser;
    },

    SET_MESSAGES(state, messages) {
      state.messages = messages;
    },

    ADD_MESSAGE(state, message) {
      state.messages.push(message);
    },

    UPDATE_MESSAGE(state, { messageId, updates }) {
      const index = state.messages.findIndex(m => m._id === messageId);
      if (index >= 0) {
        Object.assign(state.messages[index], updates);
      }
    },

    SET_MESSAGE_LISTENER(state, { chatId, listener }) {
      state.messageListeners[chatId] = listener;
    },

    REMOVE_MESSAGE_LISTENER(state, chatId) {
      delete state.messageListeners[chatId];
    },

    SET_UNREAD_COUNT(state, { chatId, count }) {
      state.unreadCounts[chatId] = count;
    },

    SET_CHAT_RANGE_STATUS(state, inRange) {
      state.isInChatRange = inRange;
    },

    ADD_CHAT_HISTORY(state, chatInfo) {
      const existingIndex = state.chatHistory.findIndex(c => c.chatId === chatInfo.chatId);
      if (existingIndex >= 0) {
        state.chatHistory[existingIndex] = chatInfo;
      } else {
        state.chatHistory.unshift(chatInfo);
      }
      
      // 限制历史记录数量
      if (state.chatHistory.length > 50) {
        state.chatHistory.pop();
      }
    },

    CLEAR_CURRENT_CHAT(state) {
      state.currentChatId = null;
      state.currentTargetUser = null;
      state.messages = [];
    },

    CLEAR_ALL_CHAT_DATA(state) {
      state.currentChatId = null;
      state.currentTargetUser = null;
      state.messages = [];
      state.messageListeners = {};
      state.unreadCounts = {};
      state.chatHistory = [];
      state.isInChatRange = true;
    }
  },

  actions: {
    // 开始聊天
    async startChat({ commit, dispatch }, { targetUserId, targetUser }) {
      try {
        const chatId = generateChatId(targetUserId);
        commit('SET_CURRENT_CHAT', { chatId, targetUser });
        
        // 获取聊天记录
        await dispatch('fetchMessages', chatId);
        
        // 开始监听新消息
        dispatch('startMessageListener', chatId);
        
        // 添加到聊天历史
        commit('ADD_CHAT_HISTORY', {
          chatId,
          targetUser,
          lastActiveTime: Date.now()
        });
        
        return chatId;
      } catch (error) {
        console.error('开始聊天失败:', error);
        throw error;
      }
    },

    // 获取消息列表
    async fetchMessages({ commit }, chatId) {
      try {
        const db = wx.cloud.database();
        const res = await db.collection('chats')
          .where({ chatId })
          .orderBy('timestamp', 'asc')
          .limit(100)
          .get();
        
        commit('SET_MESSAGES', res.data);
        return res.data;
      } catch (error) {
        console.error('获取消息失败:', error);
        throw error;
      }
    },

    // 发送消息
    async sendMessage({ commit, state, rootState }, { content, type = 'text' }) {
      try {
        if (!state.currentChatId || !state.currentTargetUser) {
          throw new Error('当前没有活跃的聊天');
        }

        const message = {
          chatId: state.currentChatId,
          senderId: rootState.user.userId,
          receiverId: state.currentTargetUser._id,
          content,
          type,
          timestamp: new Date(),
          status: 'sending'
        };

        // 先添加到本地状态
        commit('ADD_MESSAGE', message);

        // 发送到数据库
        const db = wx.cloud.database();
        const res = await db.collection('chats').add({ data: message });
        
        // 更新消息状态
        commit('UPDATE_MESSAGE', {
          messageId: res._id,
          updates: { _id: res._id, status: 'sent' }
        });

        return res._id;
      } catch (error) {
        console.error('发送消息失败:', error);
        
        // 更新消息状态为失败
        commit('UPDATE_MESSAGE', {
          messageId: 'temp_' + Date.now(),
          updates: { status: 'failed' }
        });
        
        throw error;
      }
    },

    // 开始监听消息
    startMessageListener({ commit, state }, chatId) {
      if (state.messageListeners[chatId]) {
        return; // 已经在监听
      }

      const db = wx.cloud.database();
      const listener = db.collection('chats')
        .where({ chatId })
        .watch({
          onChange: (snapshot) => {
            snapshot.docChanges.forEach((change) => {
              if (change.queueType === 'enqueue') {
                commit('ADD_MESSAGE', change.doc);
              }
            });
          },
          onError: (error) => {
            console.error('消息监听错误:', error);
          }
        });

      commit('SET_MESSAGE_LISTENER', { chatId, listener });
    },

    // 停止监听消息
    stopMessageListener({ commit, state }, chatId) {
      const listener = state.messageListeners[chatId];
      if (listener) {
        listener.close();
        commit('REMOVE_MESSAGE_LISTENER', chatId);
      }
    },

    // 结束聊天
    endChat({ commit, dispatch, state }) {
      if (state.currentChatId) {
        dispatch('stopMessageListener', state.currentChatId);
      }
      commit('CLEAR_CURRENT_CHAT');
    }
  }
};

// 生成聊天ID的工具函数
function generateChatId(targetUserId) {
  const app = getApp();
  const currentUserId = app.globalData.userId;
  const ids = [currentUserId, targetUserId].sort();
  return ids.join('_');
}