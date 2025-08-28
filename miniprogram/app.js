// app.js
const store = require('./core/store/index.js');
const storage = require('./core/utils/storage.js'); // 修复：使用默认导出

// 声明全局变量
let api;

App({
  onLaunch: function () {
    // 初始化云开发
    this.initCloud();
    
    // 初始化API（在云开发初始化后）
    this.initApi();
    
    // 初始化全局状态
    this.initGlobalState();
    
    // 初始化用户
    this.initUser();
  },

  /**
   * 初始化云开发
   */
  initCloud: function() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    
    wx.cloud.init({
      env: 'cloud1-7g6hjsku71e977d6', // 确认这个环境ID是否正确
      traceUser: true,
    });
    
    console.log('云开发初始化成功');
  },

  /**
   * 初始化API
   */
  initApi: function() {
    api = require('./core/api/index.js');
    this.api = api;
    // 确保API客户端已初始化
    if (api.client && api.client.init) {
      api.client.init();
    }
    console.log('API初始化成功');
  },

  /**
   * 初始化全局状态
   */
  initGlobalState: function() {
    // 保留原有的globalData以兼容现有代码
    this.globalData = {
      userInfo: null,
      userId: null,
      location: null,
      nearbyUsers: [],
    };
    
    // 订阅状态变化，同步到globalData
    this.subscribeToStore();
  },

  /**
   * 订阅状态管理器的变化
   */
  subscribeToStore: function() {
    const that = this;
    
    // 订阅用户状态变化
    store.subscribe('user', (userState) => {
      that.globalData.userInfo = userState.userInfo;
      that.globalData.userId = userState.userId;
      that.globalData.nearbyUsers = userState.nearbyUsers;
    });
    
    // 订阅位置状态变化
    store.subscribe('location', (locationState) => {
      that.globalData.location = locationState.currentLocation;
    });
  },

  /**
   * 初始化用户
   */
  async initUser() {
    try {
      await store['user/initUser']();
      console.log('用户初始化成功');
    } catch (error) {
      console.error('用户初始化失败:', error);
      wx.showToast({
        title: '初始化失败，请重启应用',
        icon: 'none'
      });
    }
  },

  /**
   * 获取状态管理器
   */
  getStore: function() {
    return store;
  },

  /**
   * 获取API客户端
   */
  getApi: function() {
    return api;
  },

  /**
   * 应用显示时
   */
  onShow: function() {
    // 重新初始化位置服务
    if (store.getState('user').userId) {
      store['location/initLocation']().catch(error => {
        console.error('位置服务初始化失败:', error);
      });
    }
  },

  /**
   * 应用隐藏时
   */
  onHide: function() {
    // 停止位置监听以节省电量
    store['location/stopLocationWatch']();
  }
});