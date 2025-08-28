module.exports = (apiClient) => {
  return {
    // 获取用户信息
    async getUserInfo(userId) {
      return await apiClient.get('users', userId);
    },

    // 创建用户
    async createUser(userInfo) {
      return await apiClient.add('users', {
        ...userInfo,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    },

    // 更新用户信息
    async updateUser(userId, updates) {
      return await apiClient.update('users', userId, {
        ...updates,
        updatedAt: new Date()
      });
    },

    // 更新用户位置
    async updateUserLocation(userId, location) {
      const db = wx.cloud.database();
      return await apiClient.update('users', userId, {
        location: db.Geo.Point(location.longitude, location.latitude),
        lastLocationUpdate: new Date()
      });
    },

    // 获取附近用户
    async getNearbyUsers(latitude, longitude, radius = 1000, limit = 20) {
      try {
        const db = wx.cloud.database();
        const _ = db.command;
        
        const res = await db.collection('users')
          .where({
            location: _.geoNear({
              geometry: db.Geo.Point(longitude, latitude),
              maxDistance: radius
            })
          })
          .limit(limit)
          .get();
        
        return res.data;
      } catch (error) {
        apiClient.handleError(error, '获取附近用户');
      }
    },

    // 搜索用户
    async searchUsers(keyword, limit = 10) {
      try {
        const db = wx.cloud.database();
        const _ = db.command;
        
        const res = await db.collection('users')
          .where({
            nickname: _.regex({
              regexp: keyword,
              options: 'i'
            })
          })
          .limit(limit)
          .get();
        
        return res.data;
      } catch (error) {
        apiClient.handleError(error, '搜索用户');
      }
    },

    // 举报用户
    async reportUser(targetUserId, reason, description = '') {
      return await apiClient.callFunction('handleReport', {
        type: 'user',
        targetId: targetUserId,
        reason,
        description
      });
    }
  };
};