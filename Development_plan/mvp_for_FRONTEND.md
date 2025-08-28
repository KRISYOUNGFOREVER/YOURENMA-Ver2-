技术选型
框架: React Native (跨平台，同时支持Android/iOS)
开发语言: TypeScript (提供类型安全)
UI组件: React Native Paper (轻量级UI库)
地图: react-native-amap3d (高德地图React Native封装)
状态管理: Redux Toolkit (简化版Redux)
导航: React Navigation (仅需简单Stack导航)


/src
├── /api                 # Firebase API调用
├── /components          # 可复用组件
│   ├── UserAvatar.tsx   # 用户头像组件
│   ├── ChatBubble.tsx   # 聊天气泡组件
│   └── BroadcastCard.tsx # 广播消息卡片
├── /screens             # 主要页面
│   ├── MapScreen.tsx    # 地图主页面
│   └── ChatScreen.tsx   # 聊天对话页面
├── /hooks               # 自定义钩子
│   ├── useLocation.ts   # 位置获取钩子
│   └── useNearbyUsers.ts # 附近用户查询
├── /redux               # 状态管理
│   ├── store.ts
│   └── slices/          # 各功能切片
├── /utils               # 工具函数
│   ├── distance.ts      # 距离计算
│   └── anonymous.ts     # 匿名ID生成
└── App.tsx              # 应用入口