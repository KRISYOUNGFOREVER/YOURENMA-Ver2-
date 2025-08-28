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
    const { reportedUser } = event
    
    if (!reportedUser) {
      return {
        success: false,
        message: '缺少必要参数'
      }
    }
    
    // 查询该用户被举报的次数
    const reportsRes = await db.collection('reports')
      .where({
        reportedUser: reportedUser
      })
      .count()
    
    const reportCount = reportsRes.total
    
    // 如果被举报次数超过3次，则封禁用户
    if (reportCount >= 3) {
      await db.collection('users').doc(reportedUser).update({
        data: {
          isBlocked: true,
          blockedAt: Date.now()
        }
      })
      
      return {
        success: true,
        message: '用户已被封禁',
        reportCount: reportCount,
        userBlocked: true
      }
    }
    
    return {
      success: true,
      message: '举报已记录',
      reportCount: reportCount,
      userBlocked: false
    }
  } catch (error) {
    console.error('处理举报失败', error)
    return {
      success: false,
      message: '处理举报失败',
      error: error
    }
  }
} 