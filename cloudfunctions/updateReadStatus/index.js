const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const { targetUserId, timestamp } = event;
  const { OPENID } = cloud.getWXContext();

  try {
    // 更新消息的已读状态
    const result = await db.collection('messages')
      .where({
        // 查找发送给当前用户且来自目标用户的未读消息
        receiverId: OPENID,
        senderId: targetUserId,
        readStatus: 'unread'
      })
      .update({
        data: {
          readStatus: 'read',
          readTime: timestamp
        }
      });

    // 发送已读回执给发送方
    await db.collection('readReceipts').add({
      data: {
        senderId: targetUserId,
        receiverId: OPENID,
        timestamp: timestamp,
        createTime: db.serverDate()
      }
    });

    return {
      success: true,
      updatedCount: result.stats.updated,
      message: '已读状态更新成功'
    };
  } catch (error) {
    console.error('更新已读状态失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};