# 数据云同步 —— 你要在 Supabase 后台做的几步

代码我已经写好（Supabase Auth 登录 + 个人数据上云 + 重装找回）。要让它真正生效，你需要在 Supabase 后台点几下。项目是 **nomorebets**（ref `ibqmukrxtlimsuvnfrud`）。

---

## 第 1 步：建数据表（必做）

1. 打开 Supabase 后台 → 左边 **SQL Editor** → New query
2. 把仓库里 `supabase/user_data.sql` 的内容整段贴进去 → 点 **Run**
3. 看到成功（无红字）即可。它建了两张表 `profiles`、`user_kv`，并按用户隔离（RLS）。

> 这一步是数据能不能存云端的根本，**必须做**。

---

## 第 2 步：打开登录方式（Auth 设置）

左边 **Authentication** → **Sign In / Providers**（或 Settings）：

| 登录方式 | 怎么做 | 必要性 |
|---|---|---|
| **邮箱 Email** | 确认 Email 是开启的；并把 **“Confirm email”（邮箱确认）关掉** | 必做。不关的话，新用户注册后要去邮箱点确认链接才能进，体验差 |
| **匿名 Anonymous** | 打开 **“Allow anonymous sign-ins”** | 必做（“访客”用的就是它） |
| **Apple** | 打开 Apple provider；在 **Authorized Client IDs**（客户端 ID）里填 `com.nomorebets.app` | 做了 Apple 登录才同步 |
| **Google** | 打开 Google provider；在 **Authorized Client IDs** 里填 iOS 客户端 ID：`564022564634-kvotavoqdnqaf9f98arrom80be6qvi34.apps.googleusercontent.com` | 做了 Google 登录才同步 |

> Apple / Google 这里填的是“允许哪个 App 的令牌”，不是开 OAuth 跳转，所以很简单，填 ID 就行。

---

## 第 3 步：装 App 真机测试

数据同步、登录这些**在网页预览里测不了**，必须真机 / TestFlight：

1. **邮箱**：注册一个新账号 → 记几天数据 → 删除 App 重装 → 用同一邮箱登录 → 数据应自动回来 ✅
2. **Apple**：用 Apple 登录 → 重装 → 再用 Apple 登录 → 数据回来 ✅
3. **访客**：访客模式的数据**重装会清空**（这是设计如此，访客=本机保存）

---

## 已知限制（以后再优化，不影响主流程）

- **头像**：现在头像存的是手机本地路径，换手机后图片本身不在新机上 → 会回退成默认 🌱 表情。以后可以把头像传到 Supabase Storage 解决。
- **彻底删除账号**：App 里“删除账号”会清空你的云端数据并退出登录，但 Supabase 里的登录记录本身需要一个管理函数才能彻底删（上架前补一个 edge function 即可）。
- **社区/守护功能**：仍用旧的 anon-key 模式（这部分是另一块安全债，和“个人数据同步”分开，以后单独加固）。

---

## 一句话总结

跑 SQL（第 1 步）+ 开 4 个登录方式（第 2 步）→ 重装不再清零。Apple/Google 要真机验证；邮箱/访客最稳。
