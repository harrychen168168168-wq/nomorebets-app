# NO MORE BETS 1.1.0 Build 3 订阅测试清单

## RevenueCat / App Store Connect
- App Store Connect 中自动续订订阅产品已处于可测试状态。
- 3天免费试用已在 App Store Connect 对应产品中配置。
- RevenueCat entitlement 建议使用 `NO MORE BETS Pro`；如果后台实际使用 `pro` 或 `premium`，Build 3 也做了兼容。
- RevenueCat Offering 必须包含 monthly / annual 或对应月付/年付产品。

## TestFlight / Sandbox 测试
1. 安装 TestFlight Build 3。
2. 打开 App，使用邮箱登录或访客模式进入。
3. 到“我的”页面查看订阅状态卡。
4. 点击“查看订阅”，确认 Paywall 能显示月付/年付方案和价格。
5. 点击开始3天免费试用，确认 Apple 系统购买窗口弹出。
6. 完成 Sandbox 购买后，确认“高级会员已激活”。
7. 退出 App 重开，确认高级会员状态仍然存在。
8. 删除 App 重装或换账号后，点击“恢复购买”，确认可以恢复。
9. 点击“管理订阅”，确认能进入 Apple 订阅管理。
10. 非 Pro 状态下点击 AI 倾诉、更多联系人、联系人照片、更多目标，确认弹出 Paywall，且关闭 Paywall 后不会进入 Pro 功能。

## AI 聊天
- `src/config.ts` 中 `AI_PROXY_URL` 为空时，AI 倾诉会使用本机急救回复，不会泄露 API Key。
- 配置真实后端代理后，后端应返回 `{ "reply": "..." }`。
- 输入自伤/伤人等危机词时，应直接提示 988 / 911 / 联系真人。

## 审核注意
- 审核账号可使用任意邮箱登录，无密码。
- 订阅资金走 Apple，不走 RevenueCat 收款。
- 删除本地账号不会自动取消 Apple 订阅，App 内已明确提示。
