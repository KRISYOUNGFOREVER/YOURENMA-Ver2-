<<<<<<< HEAD
# YOURENMA（有人吗）- 近距离社交小程序

## 项目简介
YOURENMA是一款基于微信小程序平台的近距离社交应用，让用户可以在物理距离范围内（默认100米）与陌生人进行即时聊天交流。项目旨在拉近物理上近距离的人们的心理距离，实现低门槛的即时交流。

## 核心功能
- 基于地理位置的用户匹配（100米范围内）
- 匿名私聊功能
- 公共广播消息
- 基础防骚扰机制

## 技术栈
- **前端**: 微信小程序原生开发
- **UI组件**: WeUI / Vant Weapp
- **地图服务**: 微信小程序内置地图组件
- **状态管理**: Mobx
- **后端服务**: 微信云开发
- **数据库**: 云开发数据库
- **通信**: 云开发实时数据库 + WebSocket

## 开发环境搭建

### 准备工作
1. 安装[微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 注册[微信小程序账号](https://mp.weixin.qq.com/)
3. 开通微信云开发

### 项目启动
```bash
# 克隆项目
git clone https://github.com/yourusername/YOURENMA.git

# 使用微信开发者工具打开项目目录

# 在微信开发者工具中配置AppID
# 开通云开发环境并创建数据库集合
```

## 项目结构
```
/miniprogram
├── /api                 # 云开发API调用
├── /components          # 可复用组件
├── /pages               # 主要页面
│   ├── map              # 地图主页面
│   └── chat             # 聊天对话页面
├── /utils               # 工具函数
├── /store               # 状态管理
├── app.js               # 应用入口
├── app.json             # 全局配置
└── app.wxss             # 全局样式
```

## 云开发配置
1. 创建以下数据库集合:
   - users: 用户信息
   - chats: 聊天记录
   - broadcasts: 广播消息
   - reports: 举报记录

2. 设置地理位置索引:
   ```
   在users和broadcasts集合中，为location字段创建地理位置索引
   ```

## 开发指南
- 地图页面是应用主入口，显示附近用户
- 点击用户头像进入聊天页面
- 长按地图发送广播消息
- 举报功能在聊天页面内实现

## 测试
- 使用微信开发者工具的模拟位置功能测试地理位置功能
- 多设备同时在线测试聊天功能

## 贡献指南
1. Fork本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 文档
- [项目背景](./program_idea.md)
- [MVP方案](./MVP_3.md)
- [小程序技术栈](./Development_plan/mvp_for_miniprogram.md)

## 许可证
[MIT](LICENSE)
=======
# YOURENMA-Ver2-
一款可以和身边人打招呼的工具
>>>>>>> 9bb2ab87199d70d3b859b3fc809e05149595662b
