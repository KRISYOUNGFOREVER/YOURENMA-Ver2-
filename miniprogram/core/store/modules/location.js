module.exports = {
  state: {
    currentLocation: null,
    isLocationEnabled: false,
    locationWatcher: null,
    lastUpdateTime: null,
    locationHistory: []
  },

  mutations: {
    SET_CURRENT_LOCATION(state, location) {
      state.currentLocation = location;
      state.lastUpdateTime = Date.now();
      
      // 保存位置历史（最多保存10个）
      state.locationHistory.unshift(location);
      if (state.locationHistory.length > 10) {
        state.locationHistory.pop();
      }
    },

    SET_LOCATION_ENABLED(state, enabled) {
      state.isLocationEnabled = enabled;
    },

    SET_LOCATION_WATCHER(state, watcher) {
      state.locationWatcher = watcher;
    },

    CLEAR_LOCATION_DATA(state) {
      state.currentLocation = null;
      state.isLocationEnabled = false;
      state.locationWatcher = null;
      state.lastUpdateTime = null;
      state.locationHistory = [];
    }
  },

  actions: {
    // 初始化位置服务
    async initLocation({ commit, dispatch }) {
      try {
        const hasPermission = await dispatch('checkLocationPermission');
        if (hasPermission) {
          await dispatch('getCurrentLocation');
          dispatch('startLocationWatch');
        }
      } catch (error) {
        console.error('初始化位置服务失败:', error);
        throw error;
      }
    },

    // 检查位置权限
    async checkLocationPermission({ commit }) {
      return new Promise((resolve) => {
        wx.getSetting({
          success: (res) => {
            if (res.authSetting['scope.userLocation']) {
              commit('SET_LOCATION_ENABLED', true);
              resolve(true);
            } else {
              wx.authorize({
                scope: 'scope.userLocation',
                success: () => {
                  commit('SET_LOCATION_ENABLED', true);
                  resolve(true);
                },
                fail: () => {
                  commit('SET_LOCATION_ENABLED', false);
                  resolve(false);
                }
              });
            }
          },
          fail: () => {
            commit('SET_LOCATION_ENABLED', false);
            resolve(false);
          }
        });
      });
    },

    // 获取当前位置
    async getCurrentLocation({ commit }) {
      return new Promise((resolve, reject) => {
        wx.getLocation({
          type: 'gcj02',
          success: (res) => {
            const location = {
              latitude: res.latitude,
              longitude: res.longitude,
              accuracy: res.accuracy,
              timestamp: Date.now()
            };
            commit('SET_CURRENT_LOCATION', location);
            resolve(location);
          },
          fail: reject
        });
      });
    },

    // 开始位置监听
    startLocationWatch({ commit, dispatch, state }) {
      if (state.locationWatcher) {
        return; // 已经在监听
      }

      wx.startLocationUpdate({
        success: () => {
          const watcher = wx.onLocationChange((res) => {
            const location = {
              latitude: res.latitude,
              longitude: res.longitude,
              accuracy: res.accuracy,
              timestamp: Date.now()
            };
            commit('SET_CURRENT_LOCATION', location);
            
            // 触发位置更新事件
            dispatch('onLocationUpdate', location);
          });
          commit('SET_LOCATION_WATCHER', watcher);
        },
        fail: (error) => {
          console.error('开始位置监听失败:', error);
        }
      });
    },

    // 停止位置监听
    stopLocationWatch({ commit, state }) {
      if (state.locationWatcher) {
        wx.stopLocationUpdate();
        wx.offLocationChange(state.locationWatcher);
        commit('SET_LOCATION_WATCHER', null);
      }
    },

    // 位置更新处理
    async onLocationUpdate({ dispatch }, location) {
      try {
        const store = require('../index.js');
        
        // 正确的方法调用方式
        if (store['user/updateUserLocation']) {
          await store['user/updateUserLocation'](location);
        }
        
        if (store['user/fetchNearbyUsers']) {
          await store['user/fetchNearbyUsers']({
            latitude: location.latitude,
            longitude: location.longitude
          });
        }
      } catch (error) {
        console.error('位置更新处理失败:', error);
      }
    }
  }
};