# AGENTS.md

本文件适用于仓库根目录及所有子目录。开始工作前先阅读 `PROJECT_STATUS.md` 和 `HANDOFF.md`。

## 项目目标

这是一个微信原生小程序 Demo，根据吃饭场合、人数和上海片区，从用户维护的餐厅数据中给出少量、带判断的推荐。产品重点是快速做决定，不是展示大众点评式的全量列表。

## 技术边界

- 保持微信原生小程序结构；当前没有 npm 运行时依赖、后端或数据库。
- 页面顺序是 `occasion` → `preferences` → `results`。
- 用户选择同时保存在 `App.globalData.selection` 和 `wx` 本地存储的 `selection` 中。
- 推荐算法必须保持可离线运行，入口为 `miniprogram/utils/recommend.js`。
- 页面视觉继续沿用奶油纸张、酒红、淡蓝和手绘线稿风格；不要随意替换现有图标。
- 片区支持多选；“不限区域”与其他片区互斥。
- 结果应保持少量推荐。目前实现每批最多 4 家。

## 数据与生成物

- 餐厅源数据真源：`outputs/大众点评_合并_带经纬度.csv`。该目录被 `.gitignore` 忽略，通常只存在于项目所有者本机。
- 小程序数据：`miniprogram/data/restaurants.js`，由 `tools/build_miniprogram_data.py` 生成，禁止手工修改。
- 只导入“评价”不为空的行。当前生成结果为 87 家，均有高德 GCJ-02 经纬度。
- `miniprogram/styles/fonts.wxss` 是内嵌的乐米小奶泡体字体子集，由 `tools/build_font_asset.py` 生成，禁止手工修改。
- 新增或修改小程序中文文案后，应重新生成字体子集，否则新字符可能退回系统字体。
- 图标资产位于 `miniprogram/assets/icons/`；重新裁图时优先使用 `tools/split_icon_atlas.py`，并检查透明背景和红/白双版本。

## 常用命令

```bash
python3 tools/build_miniprogram_data.py
/usr/bin/python3 tools/build_font_asset.py "/Users/aaaa/Downloads/乐米小奶泡体.ttf"
node tests/recommend.test.js
git diff --check
```

字体源文件是本机文件，不在仓库中。路径变化时使用实际 `.ttf` 路径。

## 实现约定

- 首页场合 ID 是稳定的数据契约：`date`、`guest`、`friends`、`parents`、`birthday`、`talk`、`solo`、`casual`、`explore`。
- `talk` 和 `guest` 的数据标签都可落到“商务”，但展示判断文案不同。
- 首页保留“一人食”旁的“随便吃点”，底部浏览入口是“看看我都吃了什么 →”。
- 片区定义集中在 `miniprogram/config/regions.js`；不要在页面中复制另一份 mapping。
- 点菜卡只能使用 CSV 的“点菜”字段；不从评价提取，不补齐，不生成兜底建议。数量不足时就按实际数量显示。
- 忌口字段目前只是启发式初筛，不得表述为过敏原保证。
- 大众点评 URL 已保留在餐厅数据中，但尚未实现可靠的小程序跳转。没有确认目标 AppID 和页面 path 前，不要硬编码猜测值。

## 验证要求

- 改推荐、片区或数据构建逻辑后运行 `node tests/recommend.test.js`。
- 改点菜卡后至少验证：点空白处关闭、长店名换行、按人数最多取 3 / 4 / 6 / 7 道但不补齐、同色两列网格、空点菜/避雷/普通订位隐藏、生成 PNG 和保存相册。
- `wx.saveImageToPhotosAlbum` 和 `wx.openLocation` 的最终验证必须在真机完成；模拟器结果不能替代真机权限与地图落点测试。
- 微信开发者工具自动打开需要有效 AppID。不要重新写入 `touristappid`；如缺少 AppID，应记录阻塞并由项目所有者提供测试号或正式 AppID。

## Git 与安全

- 远端为 `git@github.com:tangpeiwen/penguin-picks.git`，当前主分支是 `main`。
- 保留 `.gitignore` 中的私有配置、源 CSV、临时目录和本地工具状态规则。
- 不提交 `project.private.config.json`、`.env`、原始导出数据或本机临时文件。
- 不覆盖用户未提交的修改。提交前先读 `PROJECT_STATUS.md` 并检查 `git status`。
