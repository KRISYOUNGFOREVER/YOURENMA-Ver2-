/**
 * 本地存储工具函数
 */

// 设置存储
function setStorage(key, data) {
  try {
    wx.setStorageSync(key, data);
    return true;
  } catch (error) {
    console.error('设置存储失败:', error);
    return false;
  }
}

// 获取存储
function getStorage(key, defaultValue = null) {
  try {
    const data = wx.getStorageSync(key);
    return data !== '' ? data : defaultValue;
  } catch (error) {
    console.error('获取存储失败:', error);
    return defaultValue;
  }
}

// 删除存储
function removeStorage(key) {
  try {
    wx.removeStorageSync(key);
    return true;
  } catch (error) {
    console.error('删除存储失败:', error);
    return false;
  }
}

// 清空存储
function clearStorage() {
  try {
    wx.clearStorageSync();
    return true;
  } catch (error) {
    console.error('清空存储失败:', error);
    return false;
  }
}

// 获取存储信息
function getStorageInfo() {
  try {
    return wx.getStorageInfoSync();
  } catch (error) {
    console.error('获取存储信息失败:', error);
    return null;
  }
}

// 缓存管理
class CacheManager {
  constructor(prefix = 'app_cache_') {
    this.prefix = prefix;
  }

  // 设置缓存（带过期时间）
  set(key, data, expireTime = 0) {
    const cacheData = {
      data,
      timestamp: Date.now(),
      expireTime
    };
    return setStorage(this.prefix + key, cacheData);
  }

  // 获取缓存
  get(key) {
    const cacheData = getStorage(this.prefix + key);
    if (!cacheData) {
      return null;
    }

    // 检查是否过期
    if (cacheData.expireTime > 0 && Date.now() > cacheData.timestamp + cacheData.expireTime) {
      this.remove(key);
      return null;
    }

    return cacheData.data;
  }

  // 删除缓存
  remove(key) {
    return removeStorage(this.prefix + key);
  }

  // 清空所有缓存
  clear() {
    try {
      const info = getStorageInfo();
      if (info && info.keys) {
        info.keys.forEach(key => {
          if (key.startsWith(this.prefix)) {
            removeStorage(key);
          }
        });
      }
      return true;
    } catch (error) {
      console.error('清空缓存失败:', error);
      return false;
    }
  }
}

// 创建默认缓存管理器
const cache = new CacheManager();

module.exports = {
  setStorage,
  getStorage,
  removeStorage,
  clearStorage,
  getStorageInfo,
  CacheManager,
  cache
};