const app = getApp();
const { throttle, calculateDistance } = require('../../core/utils/location.js');
const { DISTANCE, LIMITS } = require('../../core/utils/constants.js');

Page({
  data: {
    latitude: 23.099994,
    longitude: 113.324520,
    scale: 16,
    markers: [],
    nearbyUsers: [],
    showBroadcastModal: false,
    broadcastContent: '',
    refreshing: false,
    mockUser: null,
    mockUserActive: false
  },

  // 状态订阅取消函数
  unsubscribers: [],

  onLoad: function (options) {
    console.log('地图页面开始加载');
    console.log('初始数据:', this.data);
    this.initPage();
  },

  async initPage() {
    try {
      console.log('开始初始化页面');
      
      // 订阅状态变化
      this.subscribeToStore();
      console.log('状态订阅完成');
      
      // 初始化位置服务
      await this.initLocation();
      console.log('位置初始化完成');
      
      // 初始化模拟用户
      this.initMockUser();
      console.log('模拟用户初始化完成');
      
      console.log('地图页面初始化成功');
    } catch (error) {
      console.error('地图页面初始化失败:', error);
    }
  },

  onShow: function () {
    this.refreshNearbyUsers();
  },

  onUnload: function () {
    this.cleanup();
  },

  /**
   * 订阅状态管理器
   */
  subscribeToStore() {
    const store = app.getStore();
    
    // 订阅位置状态变化
    const unsubscribeLocation = store.subscribe('location', (locationState) => {
      if (locationState.currentLocation) {
        this.setData({
          latitude: locationState.currentLocation.latitude,
          longitude: locationState.currentLocation.longitude
        });
      }
    });
    
    // 订阅用户状态变化
    const unsubscribeUser = store.subscribe('user', (userState) => {
      this.setData({
        nearbyUsers: userState.nearbyUsers
      });
      this.updateMarkers();
    });
    
    this.unsubscribers.push(unsubscribeLocation, unsubscribeUser);
  },

  /**
   * 初始化位置服务
   */
  async initLocation() {
    const store = app.getStore();
    
    try {
      await store['location/initLocation']();
      
      // 获取当前位置状态
      const locationState = store.getState('location');
      if (locationState.currentLocation) {
        this.setData({
          latitude: locationState.currentLocation.latitude,
          longitude: locationState.currentLocation.longitude
        });
        
        // 获取附近用户
        await this.fetchNearbyUsers();
      }
    } catch (error) {
      console.error('位置服务初始化失败:', error);
      wx.showToast({
        title: '获取位置失败，请检查授权',
        icon: 'none'
      });
    }
  },

  /**
   * 获取附近用户
   */
  async fetchNearbyUsers() {
    const store = app.getStore();
    const locationState = store.getState('location');
    
    if (!locationState.currentLocation) {
      return;
    }
    
    try {
      await store['user/fetchNearbyUsers']({
        latitude: locationState.currentLocation.latitude,
        longitude: locationState.currentLocation.longitude,
        radius: DISTANCE.NEARBY_RANGE
      });
    } catch (error) {
      console.error('获取附近用户失败:', error);
    }
  },

  /**
   * 手动刷新附近用户
   */
  async refreshNearbyUsers() {
    this.setData({ refreshing: true });
    
    try {
      const store = app.getStore();
      const locationState = store.getState('location');
      
      // 检查是否需要重新获取位置（避免频繁调用）
      const lastLocationTime = locationState.lastUpdateTime;
      const now = Date.now();
      const LOCATION_CACHE_TIME = 30000; // 30秒缓存
      
      if (!locationState.currentLocation || !lastLocationTime || (now - lastLocationTime) > LOCATION_CACHE_TIME) {
        // 只有在缓存过期时才重新获取位置
        await store['location/getCurrentLocation']();
      }
      
      await this.fetchNearbyUsers();
    } catch (error) {
      console.error('刷新失败:', error);
    } finally {
      this.setData({ refreshing: false });
    }
  },

  /**
   * 更新地图标记
   */
  updateMarkers() {
    const store = app.getStore();
    // 修复：正确获取 nearbyUsers 数组
    const userState = store.getState('user') || {};
    const nearbyUsers = userState.nearbyUsers || [];
    
    console.log('附近用户数据:', nearbyUsers);
    
    // 检查数据结构
    if (nearbyUsers.length > 0) {
      console.log('第一个用户的位置数据:', nearbyUsers[0].location);
    }
    
    // 确保 nearbyUsers 是数组
    if (!Array.isArray(nearbyUsers)) {
      console.error('nearbyUsers 不是数组:', nearbyUsers);
      return;
    }
    
    const markers = this.generateMarkersFromUsers(nearbyUsers);
    
    // 添加模拟用户标记
    if (this.data.mockUser && this.data.mockUserActive) {
      const mockUserMarker = {
        id: 999,
        latitude: this.data.mockUser.location.coordinates[1],
        longitude: this.data.mockUser.location.coordinates[0],
        width: 50,
        height: 50,
        callout: {
          content: this.data.mockUser.nickname,
          color: '#000000',
          fontSize: 12,
          borderRadius: 4,
          padding: 5,
          display: 'ALWAYS',
          bgColor: '#4ECDC4'
        },
        iconPath: '/images/mock_avatar.png',
        userId: this.data.mockUser._id
      };
      markers.push(mockUserMarker);
    }
    
    this.setData({ markers });
  },

  /**
   * 生成头像路径
   */
  generateAvatarPath(avatarUrl) {
    // 如果是颜色值（以#开头），返回默认头像
    if (avatarUrl && avatarUrl.startsWith('#')) {
      return '/images/mock_avatar.png';
    }
    
    // 如果是有效的图片URL，返回该URL
    if (avatarUrl && (avatarUrl.startsWith('http') || avatarUrl.startsWith('/'))) {
      return avatarUrl;
    }
    
    // 默认返回模拟头像
    return '/images/mock_avatar.png';
  },

  /**
   * 从用户数据生成地图标记
   */
  generateMarkersFromUsers(users) {
    // 1) 先按距离最近优先，限制最多展示数量，避免一次性显示过多标记
    const store = app.getStore();
    const locationState = store.getState('location') || {};
    const center = locationState.currentLocation || { latitude: this.data.latitude, longitude: this.data.longitude };
  
    const withDistance = users
      .map(u => {
        const c = this.extractCoordinates(u.location);
        if (!c) return null;
        const dist = calculateDistance(
          { latitude: center.latitude, longitude: center.longitude },
          { latitude: c.latitude, longitude: c.longitude }
        );
        return { user: u, coords: c, dist };
      })
      .filter(Boolean)
      .sort((a, b) => a.dist - b.dist);
  
    const MAX_MARKERS = 60; // 限制最大展示数量，避免密集
    const limited = withDistance.slice(0, MAX_MARKERS);
  
    // 2) 简单聚合：当数据仍然较多时，做网格聚类，显示“x人”
    const NEED_CLUSTER = limited.length > 40; // 简单阈值
    if (NEED_CLUSTER) {
      const cellSize = 0.01; // 粗略网格大小（度），可按需求调整
      const grid = new Map();
      limited.forEach(item => {
        const { latitude, longitude } = item.coords;
        const key = `${Math.floor(latitude / cellSize)}_${Math.floor(longitude / cellSize)}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key).push(item);
      });
  
      const markers = [];
      let clusterId = 10000;
      grid.forEach(list => {
        if (list.length === 1) {
          const { user, coords } = list[0];
          markers.push({
            id: markers.length + 1,
            userId: user._id || user.id,
            latitude: coords.latitude,
            longitude: coords.longitude,
            iconPath: this.generateAvatarPath(user.avatarUrl),
            width: 40,
            height: 40,
            callout: {
              content: user.nickname || '匿名用户',
              color: '#000000',
              fontSize: 14,
              borderRadius: 8,
              bgColor: '#ffffff',
              padding: 8,
              display: 'BYCLICK'
            }
          });
        } else {
          // 生成聚合点：用平均坐标，也可以用第一个
          const lat = list.reduce((sum, i) => sum + i.coords.latitude, 0) / list.length;
          const lon = list.reduce((sum, i) => sum + i.coords.longitude, 0) / list.length;
          markers.push({
            id: clusterId++,
            isCluster: true,
            count: list.length,
            latitude: lat,
            longitude: lon,
            // 使用统一图标，配合 callout 高亮人数
            iconPath: '/images/mock_avatar.png',
            width: 48,
            height: 48,
            callout: {
              content: `${list.length}人`,
              color: '#ffffff',
              fontSize: 16,
              borderRadius: 24,
              bgColor: '#4ECDC4',
              padding: 10,
              display: 'ALWAYS'
            }
          });
        }
      });
      return markers;
    }
  
    // 3) 非聚合：直接渲染（最近的前 MAX_MARKERS 个）
    return limited.map((item, index) => ({
      id: index + 1,
      userId: item.user._id || item.user.id || String(index + 1),
      latitude: item.coords.latitude,
      longitude: item.coords.longitude,
      iconPath: this.generateAvatarPath(item.user.avatarUrl),
      width: 40,
      height: 40,
      callout: {
        content: item.user.nickname || '匿名用户',
        color: '#000000',
        fontSize: 14,
        borderRadius: 8,
        bgColor: '#ffffff',
        padding: 8,
        display: 'BYCLICK'
      }
    }));
  },

  onMarkerTap(e) {
    const markerId = e.detail.markerId;
    const marker = this.data.markers.find(item => item.id === markerId);
    
    if (!marker) {
      console.error('找不到标记:', markerId);
      return;
    }
    
    // 如果是聚合点，点击后放大并居中，提示用户放大查看
    if (marker.isCluster) {
      this.setData({
        latitude: marker.latitude,
        longitude: marker.longitude,
        scale: Math.min(this.data.scale + 2, 20)
      });
      wx.showToast({ title: '放大查看附近的人', icon: 'none' });
      return;
    }
    
    // 单个用户：跳转聊天
    wx.navigateTo({
      url: `/pages/chat/chat?targetUserId=${marker.userId}`
    });
  },

  /**
   * 长按地图显示广播对话框
   */
  /**
   * Handle map long tap
   */
  onMapLongTap() {
    // Handle long tap if needed
  },
  
  /**
   * Show broadcast modal
   */
  showBroadcastModal() {
    this.setData({
      showBroadcastModal: true,
      broadcastContent: ''
    });
  },
  
  /**
   * Close broadcast modal
   */
  closeBroadcastModal() {
    this.setData({
      showBroadcastModal: false,
      broadcastContent: ''
    });
  },

  /**
   * 输入广播内容
   */
  onBroadcastInput(e) {
    this.setData({
      broadcastContent: e.detail.value
    });
  },

  /**
   * 发送广播消息
   */
  async sendBroadcast() {
    const content = this.data.broadcastContent.trim();
    
    if (!content) {
      wx.showToast({
        title: '请输入广播内容',
        icon: 'none'
      });
      return;
    }
    
    if (content.length > LIMITS.BROADCAST_MAX_LENGTH) {
      wx.showToast({
        title: `广播内容不能超过${LIMITS.BROADCAST_MAX_LENGTH}字`,
        icon: 'none'
      });
      return;
    }
    
    try {
      const store = app.getStore();
      const api = app.getApi();
      const locationState = store.getState('location');
      
      if (!locationState.currentLocation) {
        wx.showToast({
          title: '获取位置失败',
          icon: 'none'
        });
        return;
      }
      
      // 检查 API 是否可用
      if (!api || !api.broadcast || !api.broadcast.sendBroadcast) {
        console.warn('广播API不可用，使用模拟模式');
        // 模拟广播发送成功
        wx.showToast({
          title: '广播发送成功（模拟）',
          icon: 'success'
        });
        
        this.closeBroadcastModal();
        
        // 模拟用户自动回复
        if (this.data.mockUserActive) {
          setTimeout(() => {
            wx.showModal({
              title: '收到回复',
              content: `小凼: 收到您的广播"${content}"，我在附近喔`,
              showCancel: false,
              success: () => {
                if (this.data.mockUser) {
                  wx.navigateTo({
                    url: `/pages/chat/chat?targetUserId=${this.data.mockUser._id}`
                  });
                }
              }
            });
          }, 1500);
        }
        return;
      }
      
      // 发送广播
      await api.broadcast.sendBroadcast(content, locationState.currentLocation);
      
      wx.showToast({
        title: '广播发送成功',
        icon: 'success'
      });
      
      this.closeBroadcastModal();
      
      // 模拟用户自动回复
      if (this.data.mockUserActive) {
        setTimeout(() => {
          wx.showModal({
            title: '收到回复',
            content: `小凼: 收到您的广播"${content}"，我在附近喔`,
            showCancel: false,
            success: () => {
              if (this.data.mockUser) {
                wx.navigateTo({
                  url: `/pages/chat/chat?targetUserId=${this.data.mockUser._id}`
                });
              }
            }
          });
        }, 1500);
      }
      
    } catch (error) {
      console.error('发送广播失败:', error);
      wx.showToast({
        title: '发送失败',
        icon: 'none'
      });
    }
  },

  /**
   * 初始化模拟用户
   */
  async initMockUser() {
    try {
      const store = app.getStore();
      const locationState = store.getState('location');
      
      if (!locationState.currentLocation) {
        // 如果还没有位置信息，等待一下再试
        setTimeout(() => this.initMockUser(), 1000);
        return;
      }
      
      // 在用户100米范围内随机生成位置
      const randomOffset = () => (Math.random() - 0.5) * 0.002; // 约±100米
      
      const mockUser = {
        _id: 'mock_user_001',
        nickname: '小凼',
        avatarUrl: '#4ECDC4',
        location: {
          type: 'Point',
          coordinates: [
            locationState.currentLocation.longitude + randomOffset(),
            locationState.currentLocation.latitude + randomOffset()
          ]
        },
        lastActive: Date.now(),
        isMock: true
      };
      
      this.setData({
        mockUser,
        mockUserActive: true
      });
      
      this.updateMarkers();
      
      console.log('模拟用户已创建:', mockUser);
    } catch (error) {
      console.error('初始化模拟用户失败:', error);
    }
  },

  /**
   * 清理资源
   */
  cleanup() {
    // 取消状态订阅
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    
    // 停止位置监听
    const store = app.getStore();
    store['location/stopLocationWatch']();
  }
});