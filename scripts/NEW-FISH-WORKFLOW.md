# 新增普通鱼的固定流程

本流程只改善开发工具和验收，不改变钓鱼规则，不增加 GitHub Actions。

1. **先核对基线。** 查看 `git status --short`、当前分支和 `git worktree list`，保护已有未提交工作。执行一次 `node scripts/git-network.cjs fetch`，比较 `HEAD` 与 `origin/main`；若只是合并提交不同，用 `git diff HEAD origin/main --stat` 确认文件差异，再基于最新主分支建立或更新工作分支。不要重置其他聊天正在使用的目录。同步失败先看错误；网络、认证、分支冲突分别处理，不能无休止重试。API 导入提交只作必要的备用方案，并核对 SHA。
2. **只加本次鱼种。** 核对力量间隔/点数、速度、耐力、休息、角度、每段时间、特殊属性、颜色和高宽。普通鱼优先只追加 `fish-data.js`，复用钓鱼、背包、选鱼、帮助和图鉴机制。
3. **先检查素材。** 保留用户原图；已有可用透明图直接复用。白底图只做必要的一次背景处理。怀疑杂色时，先检查透明度，再在该鱼背包底色上观察，不能凭黑底预览反复抠图。下面的 `--inspect` 输出 alpha 范围和 alpha≥8 的可见包围框，辅助定位近透明留白；它不自动判断美术质量。
4. **默认配备缩略图。** 有图的新鱼必须同时提交轻量 WebP，背包/鱼堆/图鉴列表优先用缩略图，展开后才用大图。只处理本次鱼，不批量覆盖旧图。最大512×384，等比、原色、保留透明背景；只有留白影响展示时才使用裁剪选项。缺图就明确标记缺图，不能报告素材完成。
5. **一次规则测试和专项验收。** 用 `node scripts/check-new-fish.cjs ID或名称` 一次完成依赖预检、素材检查、完整 Node 规则测试及浏览器专项。失败立即停止，输出 `.qa/new-fish/ID-acceptance.json`（包含实际配置、资源指纹、阶段结果/耗时/错误），部分通过不算完成。规则测试直接执行与 `npm test` 相同的 `tests/*.test.js`，无需再重复跑一次。浏览器读取真实配置，使用临时本地服务和独立上下文，覆盖选鱼、帮助、未钓获锁定、背包/鱼堆缩略图、占格/底色、图鉴两色块、展开加载大图以及刷新保存。先滚动到图片，再检查实际 URL，不接受悄悄回退大图。它不会模拟真正钓获；鱼的挣扎和钓获规则仍应在规则测试中核对用户要求。只有失败或涉及公共机制改动时扩大回归；修复后重跑受影响检查。
6. **一次完成核对。** 核实实际参数符合用户要求、素材完整、只改本次范围、测试通过，创建独立 PR。记录基线、执行命令和结果，供审查复用。得到用户批准后才合并上线。仅开发工具/文档变更无需提升游戏版本；运行时配置/素材变更仍遵守现有版本管理。

## 命令示例

从项目根目录执行，ID 或名称均可，`--fish` 可重复指定多个鱼种：

```powershell
python scripts/build-inventory-thumbnails.py --fish AMERICAN_EEL --inspect
python scripts/build-inventory-thumbnails.py --fish AMERICAN_EEL --crop-transparent
node scripts/check-new-fish.cjs AMERICAN_EEL
```

无 `--fish` 保留原来处理全部配置图片的功能；普通新增任务应指定鱼种。`--check`、`--inspect` 只读，不生成或覆盖图。原图不会被缩略图工具修改。`--check` 检查存在性、可解码、WebP、尺寸、比例和透明通道；不能替代人工核对鱼的身份、颜色与细节。

开发工具需要 Python/Pillow、Node.js；浏览器脚本复用本地 Playwright，可用 `PLAYWRIGHT_MODULE` 指定已有安装，`CHROME_PATH` 指定本机 Chrome。不设置 `CHROME_PATH` 时使用 Playwright 默认浏览器。工具自身回归：`python scripts/test-inventory-thumbnails.py`。没有新增游戏运行依赖。

## 有界网络操作

`node scripts/git-network.cjs fetch` 同步远端 main；`node scripts/git-network.cjs push` 推送当前工作分支。每个命令默认20秒，可用 `--timeout-ms 10000` 调整（100–60000毫秒），超时清理进程及子进程；若系统权限阻止清理，最多另等5秒便报告 PID 和错误并停止，不进入备用上传。整个流程预算180秒（另留清理时间）。禁止交互式凭据等待，不修改全局 Git 配置。认证失败或分支冲突直接退出；网络失败才通过 `gh api` 检查 GitHub API，并返回明确诊断，默认不通过 API 写入。

确认诊断后可加 `--api-fallback`：fetch 只在远端提交已完整存在本地时更新 `origin/main`；缺少对象就失败，必须另行取得完整提交后再开发。push 只允许干净工作区的普通工作分支，远端必须是本地祖先，最多20个无签名线性提交；逐一核对 blob/tree/commit SHA，复查远端与主分支未变化后以 `force:false` 向前更新并核对最终 SHA。不支持的提交格式、并发变化、超时均停止，不覆盖分支。备用写入需要已配置的 GitHub CLI 权限；这不能根治网络连接问题，但能限制无效等待。

在限制进程管理的沙箱中，超时/清理测试需要允许终止本任务子进程的执行环境；不能忽略权限错误后继续上传。验收报告和截图只保存在被 Git 忽略的 `.qa/`，不作为游戏存档。
