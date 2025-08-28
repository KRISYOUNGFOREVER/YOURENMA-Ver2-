module.exports = (apiClient) => {
  return {
    // 发送广播
    async sendBroadcast(content, location) {
      const db = wx.cloud.database();
      const broadcast = {
        content,
        location: db.Geo.Point(location.longitude, location.latitude),
        timestamp: new Date(),
        expireAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2小时后过期
        likes: 0,
        reports: 0
      };
      
      return await apiClient.add('broadcasts', broadcast);
    },

    // 获取附近广播
    async getNearbyBroadcasts(latitude, longitude, radius = 1000, limit = 20) {
      try {
        const db = wx.cloud.database();
        const _ = db.command;
        
        const res = await db.collection('broadcasts')
          .where({
            location: _.geoNear({
              geometry: db.Geo.Point(longitude, latitude),
              maxDistance: radius
            }),
            expireAt: _.gt(new Date()) // 未过期的广播
          })
          .orderBy('timestamp', 'desc')
          .limit(limit)
          .get();
        
        return res.data;
      } catch (error) {
        apiClient.handleError(error, '获取附近广播');
      }
    },

    // 点赞广播
    async likeBroadcast(broadcastId) {
      const db = wx.cloud.database();
      return await apiClient.update('broadcasts', broadcastId, {
        likes: db.command.inc(1)
      });
    },

    // 举报广播
    async reportBroadcast(broadcastId, reason, description = '') {
      return await apiClient.callFunction('handleReport', {
        type: 'broadcast',
        targetId: broadcastId,
        reason,
        description
      });
    },

    // 删除广播
    async deleteBroadcast(broadcastId) {
      return await apiClient.delete('broadcasts', broadcastId);
    }
  };
};