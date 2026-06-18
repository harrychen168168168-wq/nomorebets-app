export const APP_VERSION = '1.1.0';

export const REVENUECAT_IOS_KEY = 'appl_cARPBxsGcMQCnDXFWPDSKMGjWkK';
export const REVENUECAT_ENTITLEMENT_ID = 'NO MORE BETS Pro';

// 管理员账号列表。正式接后端后，应由服务器/数据库角色判断替代。
export const ADMIN_EMAILS = ['harrychen168168168@gmail.com'];
export const ADMIN_LOCAL_PIN = '168168';

// Google OAuth Client ID。未配置前会显示入口，但不会假装登录成功。
export const GOOGLE_IOS_CLIENT_ID = '564022564634-kvotavoqdnqaf9f98arrom80be6qvi34.apps.googleusercontent.com';
export const GOOGLE_WEB_CLIENT_ID = '';

// AI 不能把 API Key 放在 App 前端。这里填写你自己的后端代理地址。
// 后端负责保存 Groq/OpenAI Key，并返回 { reply: string }。
export const AI_PROXY_URL = '';

export const PRIVACY_POLICY_URL = 'https://nezha2capital.com/privacy-policy';
export const TERMS_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
export const SUPPORT_EMAIL = 'harrychen168168168@gmail.com';
