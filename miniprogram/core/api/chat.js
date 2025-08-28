module.exports = (apiClient) => {
  return {
    // 获取聊天记录
    async getChatMessages(chatId, limit = 50, lastMessageId = null) {
      try {
        const db = wx.cloud.database();
        let query = db.collection('chats')
          .where({ chatId })
          .orderBy('timestamp', 'desc')
          .limit(limit);
        
        if (lastMessageId) {
          query = query.where({
            _id: db.command.lt(lastMessageId)
          });
        }
        
        const res = await query.get();
        return res.data.reverse(); // 按时间正序返回
      } catch (error) {
        apiClient.handleError(error, '获取聊天记录');
      }
    },

    // 发送消息
    async sendMessage(messageData) {
      const message = {
        ...messageData,
        timestamp: new Date(),
        status: 'sent',
        expireAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
      };
      
      return await apiClient.add('chats', message);
    },

    // 标记消息为已读
    async markMessageAsRead(messageId) {
      return await apiClient.update('chats', messageId, {
        isRead: true,
        readAt: new Date()
      });
    },

    // 删除消息
    async deleteMessage(messageId) {
      return await apiClient.delete('chats', messageId);
    },

    // 获取聊天列表
    async getChatList(userId, limit = 20) {
      try {
        const db = wx.cloud.database();
        const _ = db.command;
        
        // 获取用户参与的所有聊天
        const res = await db.collection('chats')
          .where(_.or([
            { senderId: userId },
            { receiverId: userId }
          ]))
          .orderBy('timestamp', 'desc')
          .limit(limit * 10) // 多获取一些，用于去重
          .get();
        
        // 按chatId分组，获取每个聊天的最新消息
        const chatMap = new Map();
        res.data.forEach(message => {
          if (!chatMap.has(message.chatId)) {
            chatMap.set(message.chatId, message);
          }
        });
        
        return Array.from(chatMap.values()).slice(0, limit);
      } catch (error) {
        apiClient.handleError(error, '获取聊天列表');
      }
    },

    // AI聊天
    async sendAIMessage(message, history = [], userLocation = null, userId = null) {
      return await apiClient.callFunction('aiChat', {
        message,
        history,
        userLocation,
        userId
      });
    }
  };
};