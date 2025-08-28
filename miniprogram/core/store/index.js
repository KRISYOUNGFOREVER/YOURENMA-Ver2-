/**
 * 轻量级状态管理系统
 * 基于观察者模式实现响应式状态管理
 */
class Store {
  constructor() {
    this.state = {};
    this.listeners = {};
    this.modules = {};
  }

  // 注册模块
  registerModule(name, module) {
    this.modules[name] = module;
    this.state[name] = module.state || {};
    
    // 绑定模块的 mutations 和 actions
    if (module.mutations) {
      Object.keys(module.mutations).forEach(key => {
        const mutationName = `${name}/${key}`;
        this[mutationName] = (...args) => {
          module.mutations[key](this.state[name], ...args);
          this.notify(name);
        };
      });
    }
    
    if (module.actions) {
      Object.keys(module.actions).forEach(key => {
        const actionName = `${name}/${key}`;
        this[actionName] = (...args) => {
          return module.actions[key]({
            state: this.state[name],
            commit: (mutation, ...payload) => {
              const mutationName = `${name}/${mutation}`;
              this[mutationName](...payload);
            },
            dispatch: (action, ...payload) => {
              // 处理跨模块调用
              if (action.includes('/')) {
                const [moduleName, actionName] = action.split('/');
                const fullActionName = `${moduleName}/${actionName}`;
                if (this[fullActionName]) {
                  return this[fullActionName](...payload.filter(p => p !== undefined && typeof p !== 'object' || !p.root));
                }
              } else {
                // 同模块内调用
                const actionName = `${name}/${action}`;
                return this[actionName](...payload);
              }
            }
          }, ...args);
        };
      });
    }
  }

  // 获取状态
  getState(moduleName) {
    return moduleName ? this.state[moduleName] : this.state;
  }

  // 订阅状态变化
  subscribe(moduleName, callback) {
    if (!this.listeners[moduleName]) {
      this.listeners[moduleName] = [];
    }
    this.listeners[moduleName].push(callback);
    
    // 返回取消订阅函数
    return () => {
      const index = this.listeners[moduleName].indexOf(callback);
      if (index > -1) {
        this.listeners[moduleName].splice(index, 1);
      }
    };
  }

  // 通知订阅者
  notify(moduleName) {
    if (this.listeners[moduleName]) {
      this.listeners[moduleName].forEach(callback => {
        callback(this.state[moduleName]);
      });
    }
  }
}

// 创建全局store实例
const store = new Store();

// 导入并注册模块
const userModule = require('./modules/user.js');
const locationModule = require('./modules/location.js');
const chatModule = require('./modules/chat.js');

store.registerModule('user', userModule);
store.registerModule('location', locationModule);
store.registerModule('chat', chatModule);

module.exports = store;