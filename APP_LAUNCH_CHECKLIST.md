# NoMoreBets 上线清单（build 22）

代码已功能完整（build 19–22）。能不能上线，现在卡的是下面 4 个**外部配置**（只有你能做）。
做完 + 真机测通 = 可上线。

---

## ✅ 我已经做好的（Supabase 侧）
- 用户数据表 `profiles` / `user_kv` + RLS（按用户隔离）
- 登录：邮箱(免确认)、匿名(访客)、Apple、Google（含 skip_nonce）
- Resend SMTP 接入（发件人暂为 `onboarding@resend.dev`）
- 重置密码邮件模板（发验证码）
- `delete-account` 边缘函数（真删账号，已部署）

---

## 🧑 你要做的 4 件（按重要性）

### #1 🔴 Resend 验证域名（否则验证码邮件只能发到你自己）
1. Resend 后台 → **Domains** → **Add Domain** → 填 `nezha2capital.com`
2. Resend 会显示几条 DNS（SPF 的 TXT、DKIM 的 CNAME/TXT 等）
3. 到 **Cloudflare** 把这些记录照抄进去
4. Resend 显示 **Verified** 后告诉我 → 我把 Supabase 发件人切成 `noreply@nezha2capital.com`

### #2 🔴 App Store Connect 订阅商品 + RevenueCat
在 **App Store Connect** 建 4 个内购（都带 7 天免费试用）：
| 商品 ID | 类型 | 对应 |
|---|---|---|
| `com.nomorebets.app.monthly` | 自动续订(月) | 个人自救版 |
| `com.nomorebets.app.yearly` | 自动续订(年) | 家庭守护版 |
| `com.nomorebets.app.mutual_yearly` | 自动续订(年) | 互相守护版 |
| `nomorebets_ai_addon_999` | 消耗型 | AI 加购包 |

在 **RevenueCat**：
- Entitlement 命名 `NO MORE BETS Pro`（要和代码里一致）
- 把上面 3 个订阅挂到这个 entitlement
- 建一个 Offering，含 monthly / annual(yearly) / mutual 三个 package
- 确认 iOS API key = `appl_cARPBxsGcMQCnDXFWPDSKMGjWkK`（已在代码里）

> 没配好 → 付费墙空白、无法订阅。

### #3 🔴 Render AI 代理环境变量（否则 AI 和"被邀请人 AI"失效）
Render 服务 `nomorebets-app.onrender.com` → Environment：
- `USE_SUPABASE_AI_GROUPS=true`
- `SUPABASE_URL=https://ibqmukrxtlimsuvnfrud.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=`（见 `LOCAL_SECRETS_DO_NOT_COMMIT.txt`）
- 以及 LLM 的 API key（代理本身要用）
- `MONTHLY_PRODUCT_IDS` / `ANNUAL_PRODUCT_IDS` / `MUTUAL_PRODUCT_IDS` 填上面的商品 ID
- 确认服务在运行

### #4 🟡 RevenueCat webhook 关 verify_jwt
Supabase → Edge Functions → `revenuecat-webhook` → 把 verify JWT 关掉（RevenueCat 发不了 JWT）。

---

## 📱 真机测试计划（build 22 进 TestFlight 后）
- [ ] 邮箱注册 → 记几天数据 → 删 App 重装 → 登录 → 数据回来
- [ ] Apple 登录 → 重装 → 登录 → 数据回来
- [ ] Google 登录能进
- [ ] 忘记密码（用你注册 Resend 的邮箱）
- [ ] 订阅（需 #2）→ 付费墙显示方案 → 能购买
- [ ] AI 冲动倾诉（需订阅/守护 + #3）
- [ ] 守护邀请/接受（需两个账号）
- [ ] 删除账号 → 账号真的没了

---

## 🔭 之后的专项（需真机 + 外部配置，不能盲做）
- **守护远程推送(b2)**：APNs key `FD6JZ88LC2`(Team SK2FKVF4KW) + 重新生成带 Push 的描述文件 + 加回 entitlement + 设备 token + 服务器推。会动到签名，必须真机迭代。
- **社区/守护 JWT 加固**：把传 userId 改成验 JWT；要重部署两个函数、改多处客户端。
- **头像跨设备**：传 Supabase Storage（要先建 avatars 桶 + 上传代码，需你单独同意建桶）。
- **访客升级保留数据**：匿名账号转正式（有邮箱确认的坑）。
