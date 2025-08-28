// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

// 云函数入口函数
exports.main = async (event, context) => {
  try {
    const now = Date.now()
    
    // 查询过期的聊天记录
    const expiredChatsRes = await db.collection('chats')
      .where({
        expireAt: _.lt(now)
      })
      .get()
    
    const expiredChats = expiredChatsRes.data
    
    if (expiredChats.length === 0) {
      return {
        success: true,
        message: '没有需要清理的过期聊天记录',
        cleaned: 0
      }
    }
    
    // 批量删除过期的聊天记录
    const deletePromises = expiredChats.map(chat => {
      return db.collection('chats').doc(chat._id).remove()
    })
    
    await Promise.all(deletePromises)
    
    // 查询过期的广播消息
    const expiredBroadcastsRes = await db.collection('broadcasts')
      .where({
        expireAt: _.lt(now)
      })
      .get()
    
    const expiredBroadcasts = expiredBroadcastsRes.data
    
    // 批量删除过期的广播消息
    if (expiredBroadcasts.length > 0) {
      const deleteBroadcastPromises = expiredBroadcasts.map(broadcast => {
        return db.collection('broadcasts').doc(broadcast._id).remove()
      })
      
      await Promise.all(deleteBroadcastPromises)
    }
    
    return {
      success: true,
      message: '成功清理过期数据',
      cleaned: {
        chats: expiredChats.length,
        broadcasts: expiredBroadcasts.length
      }
    }
  } catch (error) {
    console.error('清理过期数据失败', error)
    return {
      success: false,
      message: '清理过期数据失败',
      error: error
    }
  }
} 