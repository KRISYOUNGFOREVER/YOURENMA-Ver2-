// 云函数入口文件
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 使用火山方舟 Ark 豆包 API
const https = require('https');

// 建议改为环境变量，以下为优先取环境变量，回退为您提供的 Key
const ARK_API_KEY = process.env.ARK_API_KEY || 'c17b47dd-2797-4c31-83c0-ab5e5b215461';
// Ark v3 Chat Completions 端点
const ARK_ENDPOINT = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
// 使用 Endpoint ID 通过 model 字段直连您的接入点（更易限流和计费管理）
// 更新模型ID为豆包1.6
const ARK_MODEL = 'doubao-seed-1-6-250615'; // 替换原有的 Endpoint ID

// 简单缓存
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

// 统一的 POST JSON 请求
function postJson(url, body, headers) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(url);
      const data = JSON.stringify(body);
      
      const options = {
        method: 'POST',
        hostname: urlObj.hostname,
        path: urlObj.pathname + (urlObj.search || ''),
        headers: Object.assign({
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        }, headers || {}),
        timeout: 6000 // 调整为6秒
      };

      const req = https.request(options, (res) => {
        let raw = '';
        res.on('data', (chunk) => raw += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(raw);
            resolve({ statusCode: res.statusCode, data: json });
          } catch (e) {
            reject(new Error('解析响应失败: ' + e.message + '; 原始响应: ' + raw));
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      
      req.write(data);
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

// 调用豆包 Ark Chat Completions
async function chatWithDoubao(message, history, userLocation) {
  // 生成缓存键
  const cacheKey = JSON.stringify({ message, history: history.slice(-2) });
  const cached = responseCache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('使用缓存回复');
    return cached.response;
  }
  
  // 检测是否询问附近商户
  const isAskingNearby = /附近|旁边|周围|附近有什么|有什么.*店|.*饭店|.*餐厅|.*美食|吃.*的|哪里.*吃/.test(message)
  let merchantInfo = ''
  
  if (isAskingNearby && userLocation) {
    console.log('检测到位置相关查询，获取附近商户')
    try {
      const nearbyMerchants = await getNearbyMerchants(userLocation, message)
      if (nearbyMerchants.length > 0) {
        merchantInfo = '\n\n📍 附近商户推荐:\n' + 
          nearbyMerchants.slice(0, 5).map((m, index) => 
            `${index + 1}. ${m.name}${m.category ? `(${m.category})` : ''}\n   📍 ${m.address}${m.distance ? ` - ${m.distance}米` : ''}${m.rating > 0 ? ` - ⭐${m.rating}分` : ''}`
          ).join('\n')
        
        console.log('找到商户信息:', nearbyMerchants.length, '个')
      }
    } catch (error) {
      console.error('获取附近商户失败:', error)
    }
    // 关键补充：有定位但当前数据库暂无数据时，引导模型给出通用建议，而不是说“无法获取位置”
    if (!merchantInfo) {
      merchantInfo = '\n\n[系统提示] 已获取用户位置信息，但当前数据库暂无附近商户数据。请给出不超过100字的通用建议（如提示稍后再试、放宽范围或打开地图App），不要说“无法获取位置”。'
    }
  }
  
  // 构造消息
  const messages = [
    { role: 'system', content: '你是小凼，出行陪伴助手。回答要简洁友好，不超过100字。如果用户询问附近商户，要结合提供的商户信息给出具体推荐。' }
  ];
  
  if (Array.isArray(history)) {
    const recentHistory = history.slice(-6);
    for (let i = 0; i < recentHistory.length; i++) {
      const h = recentHistory[i] || {};
      const role = (h.role === 'assistant') ? 'assistant' : 'user';
      const content = h.content || h.text || '';
      if (content) {
        messages.push({ role, content });
      }
    }
  }
  
  // 将商户信息添加到用户消息中
  const userMessage = message + merchantInfo
  messages.push({ role: 'user', content: userMessage });

  // 优化请求体
  const body = {
    model: ARK_MODEL,
    messages: messages,
    temperature: 0.7,
    max_tokens: 800,  // 增加输出长度限制，原来是150
    thinking: {
      type: "disabled"  // 对于简短回复，禁用深度思考以提升速度
    }
  };

  const headers = {
    'Authorization': 'Bearer ' + ARK_API_KEY
  };

  try {
    // API调用超时设置为6秒
    const resp = await Promise.race([
      postJson(ARK_ENDPOINT, body, headers),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('API调用超时')), 6000)
      )
    ]);
    
    if (resp && resp.data && resp.data.choices && resp.data.choices[0]
        && resp.data.choices[0].message && resp.data.choices[0].message.content) {
      const response = resp.data.choices[0].message.content;
      
      // 添加到缓存
      responseCache.set(cacheKey, {
        response: response,
        timestamp: Date.now()
      });
      
      return response;
    }
  } catch (error) {
    console.error('豆包API调用失败:', error.message);
    throw error;
  }

  return null;
}

// 简单的备用回复
function getSimpleBackupReply() {
  const backupReplies = [
    '网络似乎不太顺畅，请再发一次你的问题吧',
    '我需要休息一下，稍后再聊',
    '服务暂时不可用，请稍候'
  ];
  return backupReplies[Math.floor(Math.random() * backupReplies.length)];
}

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('接收到请求:', JSON.stringify(event));

  try {
    const message = (event && typeof event.message === 'string') ? event.message : '';
    const userId = (event && event.userId) ? event.userId : '';
    const history = (event && Array.isArray(event.history)) ? event.history : [];
    const userLocation = event.userLocation || null; // 新增位置参数

    if (!message) {
      throw new Error('无效的请求消息');
    }

    const db = cloud.database();
    let replyText = '';

    // 规范化历史消息（保证 role/content 均存在）
    const formattedHistory = [];
    for (let i = 0; i < history.length; i++) {
      const msg = history[i] || {};
      const roleValue = (msg.role === 'assistant' || msg.role === 'user') ? msg.role : 'user';
      const contentValue = msg.content || msg.text || '';
      if (contentValue) {
        formattedHistory.push({
          role: roleValue,
          content: contentValue
        });
      }
    }

    // 调用豆包 Ark（传递位置信息）
    try {
      replyText = await chatWithDoubao(message, formattedHistory, userLocation);
      console.log('API返回:', replyText || '空回复');
    
      // 🚀 立即返回回复，不等待数据库操作
      if (replyText) {
        // 将所有数据库操作都改为异步，不阻塞返回
        setImmediate(() => {
          // API成功日志
          db.collection('apiLogs').add({
            data: {
              userId: userId,
              success: true,
              query: message,
              result: replyText,
              timestamp: Date.now()
            }
          }).catch(e => console.error('API日志保存失败:', e));
          
          // 对话记录
          db.collection('mockChats').add({
            data: {
              userId: userId,
              userMessage: message,
              aiReply: replyText,
              timestamp: Date.now()
            }
          }).catch(dbError => console.error('对话记录保存失败:', dbError));
        });
        
        // 🎯 立即返回，不等待数据库操作完成
        return { reply: replyText };
      }
    } catch (apiError) {
      console.error('API调用失败:', apiError);
      
      // 🚀 错误日志也改为异步，不阻塞返回
      setImmediate(() => {
        db.collection('apiLogs').add({
          data: {
            userId: userId,
            success: false,
            query: message,
            result: (apiError && apiError.message) ? apiError.message : String(apiError),
            timestamp: Date.now()
          }
        }).catch(function (e) { console.error('API错误日志保存失败:', e); });
      });
    }

    if (!replyText) {
      replyText = getSimpleBackupReply();
      console.log('使用备用回复:', replyText);
    }

    // 前端期望的返回结构：{ reply: string }
    return { reply: replyText };
  } catch (error) {
    console.error('云函数执行失败:', error);
    return {
      reply: '抱歉，我现在遇到了一点问题，无法正常回复。请稍后再试。'
    };
  }
}

// 新增：获取附近商户函数
async function getNearbyMerchants(location, query = '') {
  try {
    const db = cloud.database()
    const _ = db.command
    
    // 简单的地理位置查询（范围约1公里）
    const latRange = 0.009 // 约1公里
    const lngRange = 0.009
    
    let dbQuery = db.collection('merchants')
      .where({
        'location.latitude': _.gte(location.latitude - latRange).and(_.lte(location.latitude + latRange)),
        'location.longitude': _.gte(location.longitude - lngRange).and(_.lte(location.longitude + lngRange))
      })
    
    // 如果查询中包含特定关键词，进行筛选
    if (/火锅|川菜|湘菜|粤菜|东北菜/.test(query)) {
      // 可以根据category进一步筛选
    }
    
    const result = await dbQuery
      .orderBy('rating', 'desc')
      .limit(10)
      .get()
      
    return result.data || []
  } catch (error) {
    console.error('查询附近商户失败:', error)
    return []
  }
}

async function getNearbyMerchants(userLocation) {
  try {
    const db = cloud.database()
    const { latitude, longitude } = userLocation
    
    // 暂时使用简单查询，后续可以优化为地理位置查询
    const result = await db.collection('merchants')
      .limit(10)
      .get()
    
    console.log(`查询到${result.data.length}个商户`)
    
    // 简单的距离计算和排序（可选）
    if (result.data.length > 0) {
      const merchantsWithDistance = result.data.map(merchant => {
        if (merchant.location && merchant.location.longitude && merchant.location.latitude) {
          // 简单的距离计算（近似）
          const deltaLng = Math.abs(merchant.location.longitude - longitude)
          const deltaLat = Math.abs(merchant.location.latitude - latitude)
          const distance = Math.sqrt(deltaLng * deltaLng + deltaLat * deltaLat)
          return { ...merchant, calculatedDistance: distance }
        }
        return merchant
      })
      
      // 按距离排序
      merchantsWithDistance.sort((a, b) => (a.calculatedDistance || 999) - (b.calculatedDistance || 999))
      return merchantsWithDistance.slice(0, 10)
    }
    
    return result.data
  } catch (error) {
    console.error('查询附近商户失败:', error)

    // 如果是集合不存在，尝试初始化
    if (error.errCode === -502005) {
      try {
        console.log('merchants 集合不存在，尝试初始化...')
        await cloud.callFunction({
          name: 'getMerchants',
          data: {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            radius: 1000,
            types: '050000'
          }
        })
        
        // 重试查询
        const retryResult = await db.collection('merchants')
          .limit(10)
          .get()
        
        return retryResult.data
      } catch (initError) {
        console.error('初始化失败:', initError)
        return []
      }
    }
    
    return []
  }
}