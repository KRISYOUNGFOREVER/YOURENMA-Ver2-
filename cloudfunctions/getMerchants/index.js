const cloud = require('wx-server-sdk')
const https = require('https')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 高德地图API Key
// 使用 Web服务 Key（推荐将 Key 配置为云函数环境变量 AMAP_KEY）
// 若未配置环境变量，将回退到你提供的 Key
const AMAP_KEY = process.env.AMAP_KEY || 'e4ccab4de30749289ba2722f255d5af6';

exports.main = async (event, context) => {
  const { latitude, longitude, radius = 1000, types = '050000', keyword = '' } = event
  
  console.log('获取商户信息请求:', { latitude, longitude, radius, types, keyword })
  
  try {
    // 构建高德API URL
    let url = `https://restapi.amap.com/v3/place/around?key=${AMAP_KEY}&location=${longitude},${latitude}&radius=${radius}&types=${types}&extensions=all&offset=20`
    
    if (keyword) {
      url += `&keywords=${encodeURIComponent(keyword)}`
    }
    
    console.log('调用高德API:', url.replace(AMAP_KEY, '***'))
    
    const response = await fetchFromAmap(url)
    
    if (response.status !== '1') {
      throw new Error(`高德API错误: ${response.info}`)
    }
    
    const merchants = response.pois || []
    console.log(`获取到${merchants.length}个商户`)
    
    // 存储到数据库（去重）
    const db = cloud.database()
    const _ = db.command
    let savedCount = 0
    
    // 确保 merchants 集合存在
    try {
      await db.createCollection('merchants')
      console.log('merchants 集合创建成功或已存在')
    } catch (collectionError) {
      // 集合已存在/不可重复创建会抛错，这里忽略即可，仅打印以便排查
      console.warn('createCollection 返回:', collectionError && collectionError.errCode, collectionError && collectionError.errMsg)
    }
    
    for (const merchant of merchants) {
      if (!merchant.name || !merchant.location) continue
      
      const locationParts = merchant.location.split(',')
      if (locationParts.length !== 2) continue
      
      const lng = parseFloat(locationParts[0])
      const lat = parseFloat(locationParts[1])
      
      // 验证经纬度有效性
      if (isNaN(lng) || isNaN(lat) || lng < -180 || lng > 180 || lat < -90 || lat > 90) {
        console.warn('无效的经纬度:', merchant.name, lng, lat)
        continue
      }
      
      // 清洗数据，避免特殊字符和空值
      const merchantData = {
        name: String(merchant.name || '').trim(),
        address: String(merchant.address || '').trim(),
        // 暂时使用普通对象存储位置，避免 GeoPoint 格式问题
        location: {
          longitude: lng,
          latitude: lat
        },
        category: String(merchant.type || '').trim(),
        phone: String(merchant.tel || '').trim(),
        rating: parseFloat(merchant.biz_ext?.rating || '0') || 0,
        distance: parseInt(merchant.distance || '0') || 0,
        updateTime: Date.now(),
        source: 'amap',
        amapId: String(merchant.id || '').trim()
      }
      
      // 验证必要字段
      if (!merchantData.name || !merchantData.amapId) {
        console.warn('缺少必要字段:', merchantData)
        continue
      }
      
      try {
        // 检查是否已存在（基于amapId去重）
        const existing = await db.collection('merchants')
          .where({ amapId: merchantData.amapId })
          .limit(1)
          .get()
          
        if (existing.data.length === 0) {
          await db.collection('merchants').add({ data: merchantData })
          savedCount++
          console.log('成功保存商户:', merchantData.name)
        } else {
          // 更新现有记录
          await db.collection('merchants')
            .where({ amapId: merchantData.amapId })
            .update({ data: { ...merchantData, updateTime: Date.now() } })
          console.log('更新商户:', merchantData.name)
        }
      } catch (dbError) {
        console.error('保存商户失败:', merchantData.name, dbError)
        // 打印详细的商户数据以便调试
        console.error('商户数据:', JSON.stringify(merchantData, null, 2))
      }
    }
    
    return { 
      success: true, 
      total: merchants.length,
      saved: savedCount,
      merchants: merchants.slice(0, 10) // 返回前10个用于预览
    }
  } catch (error) {
    console.error('获取商户信息失败:', error)
    return { success: false, error: error.message }
  }
}

function fetchFromAmap(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          resolve(result)
        } catch (e) {
          reject(new Error('解析高德API响应失败: ' + e.message))
        }
      })
    })
    
    request.on('error', reject)
    request.setTimeout(10000, () => {
      request.destroy()
      reject(new Error('高德API请求超时'))
    })
  })
}