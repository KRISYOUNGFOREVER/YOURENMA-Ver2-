/**
 * API层统一封装
 * 提供统一的请求接口和错误处理
 */
class ApiClient {
  constructor() {
    this.db = null;
    this._ = null;
    this.initialized = false;
  }

  // 延迟初始化云API
  init() {
    if (!this.initialized) {
      this.db = wx.cloud.database();
      this._ = this.db.command;
      this.initialized = true;
    }
  }

  // 确保在使用前已初始化
  ensureInit() {
    if (!this.initialized) {
      this.init();
    }
  }

  // 统一错误处理
  handleError(error, context = '') {
    console.error(`${context} 错误:`, error);
    
    // 根据错误类型显示不同提示
    let message = '操作失败，请重试';
    if (error.errCode === -1) {
      message = '网络连接失败';
    } else if (error.errCode === 'PERMISSION_DENIED') {
      message = '权限不足';
    }
    
    wx.showToast({
      title: message,
      icon: 'none'
    });
    
    throw error;
  }

  // 通用数据库操作
  async get(collection, docId = null, options = {}) {
    this.ensureInit();
    try {
      const col = this.db.collection(collection);
      if (docId) {
        const res = await col.doc(docId).get();
        return res.data;
      } else {
        const res = await col.limit(options.limit || 20).get();
        return res.data;
      }
    } catch (error) {
      this.handleError(error, `获取${collection}数据`);
    }
  }

  async add(collection, data) {
    this.ensureInit();
    try {
      const res = await this.db.collection(collection).add({ data });
      return res;
    } catch (error) {
      this.handleError(error, `添加${collection}数据`);
    }
  }

  async update(collection, docId, data) {
    this.ensureInit();
    try {
      const res = await this.db.collection(collection).doc(docId).update({ data });
      return res;
    } catch (error) {
      this.handleError(error, `更新${collection}数据`);
    }
  }

  async delete(collection, docId) {
    this.ensureInit();
    try {
      const res = await this.db.collection(collection).doc(docId).remove();
      return res;
    } catch (error) {
      this.handleError(error, `删除${collection}数据`);
    }
  }

  async callFunction(name, data = {}) {
    this.ensureInit();
    try {
      const res = await wx.cloud.callFunction({
        name,
        data
      });
      return res.result;
    } catch (error) {
      this.handleError(error, `调用云函数${name}`);
    }
  }
}

// 创建API客户端实例
const apiClient = new ApiClient();

// 导入各模块API
const userApi = require('./user.js')(apiClient);
const locationApi = require('./location.js')(apiClient);
const chatApi = require('./chat.js')(apiClient);
const broadcastApi = require('./broadcast.js')(apiClient);

module.exports = {
  user: userApi,
  location: locationApi,
  chat: chatApi,
  broadcast: broadcastApi,
  client: apiClient
};