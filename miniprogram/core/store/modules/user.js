module.exports = {
  state: {
    userInfo: null,
    userId: null,
    isLoggedIn: false,
    nearbyUsers: []
  },

  mutations: {
    SET_USER_INFO(state, userInfo) {
      state.userInfo = userInfo;
      state.isLoggedIn = !!userInfo;
    },

    SET_USER_ID(state, userId) {
      state.userId = userId;
    },

    SET_NEARBY_USERS(state, users) {
      state.nearbyUsers = users;
    },

    ADD_NEARBY_USER(state, user) {
      const existingIndex = state.nearbyUsers.findIndex(u => u._id === user._id);
      if (existingIndex >= 0) {
        state.nearbyUsers[existingIndex] = user;
      } else {
        state.nearbyUsers.push(user);
      }
    },

    REMOVE_NEARBY_USER(state, userId) {
      state.nearbyUsers = state.nearbyUsers.filter(u => u._id !== userId);
    },

    CLEAR_USER_DATA(state) {
      state.userInfo = null;
      state.userId = null;
      state.isLoggedIn = false;
      state.nearbyUsers = [];
    }
  },

  actions: {
    // 初始化用户
    async initUser({ commit, dispatch }) {
      try {
        const userId = wx.getStorageSync('userId');
        if (userId) {
          commit('SET_USER_ID', userId);
          await dispatch('fetchUserInfo', userId);
        } else {
          await dispatch('createAnonymousUser');
        }
      } catch (error) {
        console.error('初始化用户失败:', error);
        throw error;
      }
    },

    // 获取用户信息
    async fetchUserInfo({ commit }, userId) {
      try {
        const db = wx.cloud.database();
        const res = await db.collection('users').doc(userId).get();
        if (res.data) {
          commit('SET_USER_INFO', res.data);
        }
        return res.data;
      } catch (error) {
        console.error('获取用户信息失败:', error);
        throw error;
      }
    },

    // 创建匿名用户
    async createAnonymousUser({ commit }) {
      try {
        const db = wx.cloud.database();
        const userInfo = {
          nickname: generateRandomNickname(),
          avatarUrl: generateRandomAvatar(),
          createdAt: new Date(),
          isAnonymous: true
        };
        
        const res = await db.collection('users').add({
          data: userInfo
        });
        
        const userId = res._id;
        wx.setStorageSync('userId', userId);
        
        commit('SET_USER_ID', userId);
        commit('SET_USER_INFO', { ...userInfo, _id: userId });
        
        return userId;
      } catch (error) {
        console.error('创建匿名用户失败:', error);
        throw error;
      }
    },

    // 获取附近用户
    async fetchNearbyUsers({ commit }, { latitude, longitude, radius = 1000 }) {
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
          .get();
        
        commit('SET_NEARBY_USERS', res.data);
        return res.data;
      } catch (error) {
        console.error('获取附近用户失败:', error);
        throw error;
      }
    }
  }
};

// 工具函数
function generateRandomNickname() {
  const adjectives = ['快乐的', '神秘的', '勇敢的', '温柔的', '聪明的'];
  const nouns = ['小鸟', '小鱼', '小猫', '小狗', '小兔'];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return adj + noun;
}

function generateRandomAvatar() {
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
  return colors[Math.floor(Math.random() * colors.length)];
}