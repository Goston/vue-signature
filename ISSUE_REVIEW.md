# Issues 修复与代码审查

日期：2026-09-06。基线：`936ef28a93951e7f36f7cd61fc964cd92079f6f5`。

已排查此次维护开始时 GitHub 全部 8 个 open issues。本报告记录 2.7.0 的修复与验证；PR 处理依据见 `MAINTENANCE_2.7.0.md`，实际发布状态以 GitHub Releases/npm registry 为准。

## Issue 处理结果

| Issue | 结果 | 实现或说明 |
| --- | --- | --- |
| [#71](https://github.com/WangShayne/vue-signature/issues/71) Bootstrap Modal 初始宽度为零 | 已修复对应布局场景 | 观察画布尺寸变化；隐藏容器显示后自动调整。重复 `draw()` 复用实例。 |
| [#65](https://github.com/WangShayne/vue-signature/issues/65) 百分比尺寸变零 | 已修复延迟布局场景，补充配置说明 | 零尺寸时保留内容；布局有效后恢复。百分比高度仍需要可测量的父容器。 |
| [#47](https://github.com/WangShayne/vue-signature/issues/47) Ionic 页面尺寸为零 | 已修复对应布局场景 | 同上；没有 `ResizeObserver` 的浏览器提供窗口 resize 和手动 `draw()` 回退。 |
| [#27](https://github.com/WangShayne/vue-signature/issues/27) 缺少卸载清理 | 已修复 | 关闭 SignaturePad 输入、移除事件转发和窗口监听、断开观察器、取消待加载图片；避免销毁后 nextTick 重新初始化。 |
| [#61](https://github.com/WangShayne/vue-signature/issues/61) Jest 无法加载 ES module/SFC 入口 | 已修复包入口 | `main` 指向编译后的 UMD 组件；无需 DOM 或 SFC 转换即可 CommonJS/ES module 导入。实际挂载仍需 DOM 和 Canvas 支持。 |
| [#73](https://github.com/WangShayne/vue-signature/issues/73) 回填保存的 SVG | 已补全并验证 | 文档提供 SVG data URL/原始 SVG 示例；导入返回 Promise；图片保持为背景层，可跨 resize 和新笔画 undo 保留。 |
| [#59](https://github.com/WangShayne/vue-signature/issues/59) 调整笔宽 | 已补充说明并验证 | 原有 `sigOption.minWidth/maxWidth` 已支持；记录初始化与运行时调整方式。 |
| [#54](https://github.com/WangShayne/vue-signature/issues/54) Safari 画布宽度翻倍 | 已明确 DPR 行为并验证尺寸逻辑 | Retina 位图像素翻倍是正常行为；CSS 尺寸保持不变。按实际画布尺寸设置位图，覆盖 DPR=2 和带内边距场景。 |

## 代码修复与优化

- 修正立即执行 resize 回调导致实际未注册监听的问题。
- 使用组件自身的 canvas ref，避免全局 ID 查询影响多实例。
- 缩放后保留笔画数据，撤销和笔画 SVG 导出继续有效；尺寸未变化时跳过重绘。
- 隐藏时加载图片，延后到首次有效布局计算默认尺寸；首次布局不被 `clearOnResize` 清空。
- 消除带内边距容器的落笔偏移；用实际指针事件和像素检查验证。
- 图片加载支持错误回传、后发请求优先，以及清空/销毁后的取消。
- 水印允许零坐标，通过 Canvas save/restore 隔离绘图样式；不再修改 SignaturePad 私有 `_isEmpty`。
- 移除全局 canvas CSS，避免影响宿主页面中的其他画布。
- 更新 Webpack/Babel/Vue loader，移除未使用的 Sass 等构建依赖；保留 Vue 2 组件 API。
- 使用 npm lockfile，删除过期的 Yarn lockfile；构建入口与本地示例一致。
- 构建文件从 21,933 字节缩小至 16,980 字节。锁文件包条目从 1,024 降至 498，包含开发依赖。

## Standards

独立审查未发现文档标准违规或需要处理的代码异味。审查指出的隐藏图片尺寸、容器内边距坐标问题均已修复并回归验证；复查无剩余发现。

## Spec

独立审查确认上述 issue 要求得到代码修复或已有功能的明确说明，无剩余发现，无无关范围扩张。

## 验证

| 检查 | 结果 |
| --- | --- |
| 初始复现 | 原代码 10 个用例中 9 个失败，覆盖监听、尺寸、清理、水印、导入及包入口。 |
| 生产构建 | Webpack 构建成功。 |
| 自动回归 | 15/15 通过；包含 CommonJS、ES module 和无 DOM 导入。 |
| 真实浏览器回归 | 桌面 1280×720、移动端 390×844，各 12/12 通过。使用真实 Vue、SignaturePad、Canvas；包含多实例和 SSR hydration 回归。 |
| 手动交互 | 绘制、事件通知、缩放、撤销、PNG 导出和 SVG 回填通过。 |
| npm 打包 | 打包成功；包含构建产物、许可证声明、源码、README 和 package.json，无测试/开发目录。 |
| 包内入口 | 从压缩包提取入口并在无 DOM 环境加载，组件名称与 render 函数正确。 |
| 差异检查 | `git diff --check` 通过。 |

## 验证边界

- 浏览器验证使用 Codex 内置浏览器；未在原生 Safari、真实 iOS/Android、Bootstrap Vue 或 Ionic 完整应用中逐一复测。隐藏容器和 DPR 对应机制已有回归覆盖。
- 验证了 Jest 报错对应的包导入边界；没有运行完整 Jest/Nuxt 消费者工程。
- Vue 2 已结束维护，本次保留原有主版本；没有执行 Vue 3 迁移。
- 导入图片和水印不是可编辑笔画。PNG/JPEG 包含它们；SVG 导出仍只包含 SignaturePad 记录的笔画。

## 本地运行

使用 Node.js 18.12+ 和 npm：`npm ci`、`npm test`、`npm run dev`。

- 当前示例：http://127.0.0.1:4173/
- 浏览器回归：http://127.0.0.1:4173/test/browser.html
- 实现：`src/components/vueSignature.vue`
- 自动回归：`test/component.test.js`、`test/package.test.js`
- 浏览器回归：`test/browser.html`、`test/browser.js`
- API 和使用说明：`README.md`
