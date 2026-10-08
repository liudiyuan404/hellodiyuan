# Sorting Atlas · 排序算法图鉴

一个可逐帧探索的排序算法实验室。九种算法、四种代码语言，用同一组数据观察不同排序路径。

## 功能

- 动画与代码执行位置同步，展示当前帧的比较、交换和写入次数。
- 可拖动时间轴、前后单步、暂停与重播；切换算法保留原始输入。
- 随机、近乎有序、逆序、重复值四种数据分布，以及 2–180 个正整数的自定义数组。
- 算法对照使用同一数组实际执行后的操作统计，并标明复杂度、额外空间和稳定性。
- JavaScript、Python、C、Java 核心代码片段，支持复制、全屏及滚动阅读。
- 浅蓝与深灰蓝主题、手机布局、键盘操作和减少动态效果偏好。

## 本地开发

需要 Node.js 22 或更新版本（云环境已使用 Node.js 24 验证）。

```bash
npm ci --registry=https://registry.npmjs.org --replace-registry-host=always
npm run dev
```

锁文件中的镜像地址通过 npm 的官方注册表覆盖选项解析，保留锁定版本和完整性校验，不修改锁文件。

```bash
npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

GitHub Actions 在推送至 `main` 后构建 `dist` 并发布至 GitHub Pages。线上域名为 `hellodiyuan.xin`。

## 验证

```bash
node --test tests/sorting.test.js
python tests/browser_smoke.py
python tests/browser_smoke.py http://127.0.0.1:4173
```

单元测试覆盖排序结果、重复值、多位数、输入不变性、操作计数和代码映射。浏览器测试需要 Python Playwright 与 Chromium（云镜像已提供），并分别需要运行中的开发服务或生产预览；可通过 `CHROMIUM_PATH` 指定浏览器路径。

浏览器测试通过真实界面验证输入校验、九种算法、对照、播放与时间轴、代码语言、剪贴板、快捷键和 320–1440 像素的响应式布局。

## 源码结构

- `index.html`：工作台与对话框的语义结构。
- `src/atlas.css`：视觉、布局和响应式样式。
- `src/atlas.js`：动画渲染、状态同步与交互。
- `src/sorting.js`：排序轨迹生成器。
- `src/algorithms.js`：算法元数据与复杂度说明。
- `src/code-samples.js`：四种语言的核心代码与执行位置映射。

快捷键：空格播放/暂停，左右方向键单步，R 重新生成数据，C 显示代码，F 全屏代码，L 切换语言，M 声音。表单输入和对话框内不会触发全局快捷键。
