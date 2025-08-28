// 应用常量定义
module.exports = {
  // 距离相关
  DISTANCE: {
    CHAT_RANGE: 1000,        // 聊天范围（米）
    NEARBY_RANGE: 2000,      // 附近用户范围（米）
    BROADCAST_RANGE: 1000    // 广播范围（米）
  },

  // 时间相关
  TIME: {
    LOCATION_UPDATE_INTERVAL: 10000,  // 位置更新间隔（毫秒）
    MESSAGE_EXPIRE_TIME: 24 * 60 * 60 * 1000,  // 消息过期时间（24小时）
    BROADCAST_EXPIRE_TIME: 2 * 60 * 60 * 1000   // 广播过期时间（2小时）
  },

  // 限制相关
  LIMITS: {
    MESSAGE_MAX_LENGTH: 500,     // 消息最大长度
    BROADCAST_MAX_LENGTH: 200,   // 广播最大长度
    NEARBY_USERS_LIMIT: 50,      // 附近用户数量限制
    CHAT_HISTORY_LIMIT: 100      // 聊天记录限制
  },

  // 消息类型
  MESSAGE_TYPES: {
    TEXT: 'text',
    IMAGE: 'image',
    SYSTEM: 'system'
  },

  // 用户状态
  USER_STATUS: {
    ONLINE: 'online',
    OFFLINE: 'offline',
    AWAY: 'away'
  },

  // 举报原因
  REPORT_REASONS: {
    SPAM: 'spam',
    HARASSMENT: 'harassment',
    INAPPROPRIATE: 'inappropriate',
    FAKE: 'fake',
    OTHER: 'other'
  },

  // 错误码
  ERROR_CODES: {
    NETWORK_ERROR: 'NETWORK_ERROR',
    PERMISSION_DENIED: 'PERMISSION_DENIED',
    USER_NOT_FOUND: 'USER_NOT_FOUND',
    CHAT_NOT_FOUND: 'CHAT_NOT_FOUND',
    OUT_OF_RANGE: 'OUT_OF_RANGE'
  }
};