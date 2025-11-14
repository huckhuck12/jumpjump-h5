# 跳一跳 H5 游戏

基于 Three.js 和 Cannon.js 开发的 3D 跳一跳小游戏，完美复刻微信跳一跳玩法。

> 🤖 本项目由 [Qoder AI](https://qoder.bytedance.net/) 辅助开发生成  
> 📦 复刻自 Unity 版本：[Unity-JumpJump](https://github.com/zhenghongzhi/Unity-JumpJump)

## 🎮 游戏特性

- ✨ 完整的 3D 场景渲染
- 🎯 精准的物理引擎模拟
- 🎨 蓄力跳跃机制
- 📊 精准落点加分系统（落点越靠近中心，分数翻倍）
- 🎭 压缩动画效果
- ⭐ 粒子特效
- 📱 支持鼠标和触摸屏操作
- 🏆 实时分数统计

## 🚀 快速开始

### 环境要求

- Node.js 18.x 或更高版本
- npm 或 yarn

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

然后在浏览器中打开 `http://localhost:5173`

### 构建生产版本

```bash
npm run build
```

构建后的文件会在 `dist` 目录下。

### 预览生产版本

```bash
npm run preview
```

## 🌐 在线演示

访问 GitHub Pages 在线体验游戏：
**https://huckhuck12.github.io/jumpjump-h5/**

### 手动启用 GitHub Pages

如果在线演示未生效，请按以下步骤手动启用：

1. 访问仓库的 Settings 页面
2. 左侧菜单选择 "Pages"
3. Source 选择 "Deploy from a branch"
4. Branch 选择 "gh-pages" 分支，文件夹选择 "/(root)"
5. 点击 Save，等待几分钟部署完成

### 本地部署到 GitHub Pages

```bash
npm run deploy
```

## 🎯 游戏玩法

1. 点击"开始游戏"按钮
2. **按住鼠标**或触摸屏幕开始蓄力
3. 蓄力时间越长，跳跃距离越远
4. 松开鼠标/手指，角色跳跃
5. 尽量落在台子中心获得高分！
6. 落点越精准，分数倍数越高（1x → 2x → 4x → 8x...）

## 🛠️ 技术栈

- **渲染引擎**: [Three.js](https://threejs.org/) - 3D 图形渲染
- **物理引擎**: [Cannon-es](https://github.com/pmndrs/cannon-es) - 物理模拟
- **构建工具**: [Vite](https://vitejs.dev/) - 快速开发构建
- **测试框架**: [Vitest](https://vitest.dev/) - 单元测试

## 🧪 运行测试

运行所有测试：
```bash
npm test
```

打开测试 UI 界面：
```bash
npm run test:ui
```

生成测试覆盖率报告：
```bash
npm run test:coverage
```

## 📁 项目结构

```
jumpjump-h5/
├── src/
│   ├── main.js          # 游戏核心逻辑
│   ├── style.css        # 样式文件
│   └── game.test.js     # 测试文件
├── public/              # 静态资源
├── index.html           # 入口 HTML
├── package.json         # 项目配置
├── vite.config.js       # Vite 配置
└── vitest.config.js     # Vitest 配置
```

## 🎨 核心功能实现

### 物理引擎
- 使用 Cannon.js 实现真实的物理碰撞和重力模拟
- 玩家和台子都有对应的物理体
- 支持方形和圆形台子的碰撞检测

### 蓄力系统
- 按住时间越长，跳跃力度越大
- 蓄力时有视觉压缩反馈
- 粒子特效提示

### 精准加分
- 计算落点到台子中心的距离
- 距离小于阈值触发分数翻倍
- 连续精准落点可持续翻倍

### 游戏结束判定
- 掉落到地面以下
- 碰撞到台子侧面
- 落在两个台子之间

## 🤝 致谢

- **原始项目**：本项目完整复刻自 [Unity-JumpJump](https://github.com/zhenghongzhi/Unity-JumpJump)，感谢原作者 [@zhenghongzhi](https://github.com/zhenghongzhi) 的优秀作品
- **开发工具**：使用 [Qoder AI](https://qoder.bytedance.net/) 进行代码生成和开发辅助
- **技术参考**：Unity C# 代码逻辑完整转换为 JavaScript + Three.js 实现

## 📄 开源协议

MIT License

## 👨‍💻 开发说明

### 游戏配置参数

可在 `src/main.js` 中调整游戏参数：

```javascript
const config = {
  jumpFactor: 5,       // 跳跃力度系数
  maxDistance: 5,      // 台子最大距离
  minDistance: 1.5,    // 台子最小距离
  gravity: -30,        // 重力加速度
  playerSize: 0.5,     // 玩家大小
  playerMass: 1,       // 玩家质量
}
```

### 添加新功能

1. 音效系统
2. 更多台子样式
3. 特殊道具
4. 排行榜功能
5. 多人对战模式

## 🐛 已知问题

- 某些情况下玩家可能卡在两个台子中间（已添加防抖机制）
- 物理引擎在极端情况下可能出现异常

## 📝 更新日志

### v1.0.0 (2024-11-14)
- ✅ 完成基础游戏功能
- ✅ 实现蓄力跳跃系统
- ✅ 添加精准加分机制
- ✅ 完善碰撞检测
- ✅ 添加粒子特效
- ✅ 实现相机跟随
- ✅ 添加单元测试（31个测试用例全部通过）

## 🎯 TODO

- [ ] 添加音效和背景音乐
- [ ] 实现排行榜功能
- [ ] 添加更多台子类型
- [ ] 优化移动端性能
- [ ] 添加游戏暂停功能
- [ ] 支持键盘操作

---

**Enjoy the game! 🎮**
