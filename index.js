import Parser from 'rss-parser';
import { Resend } from 'resend';

// 从 GitHub Actions 环境变量读取密钥
const apiKey = process.env.RESEND_API_KEY;

console.log('--- 🔑 环境变量诊断 ---');
if (!apiKey) {
  console.error('❌ 结果: RESEND_API_KEY 环境变量未定义！请在 GitHub Secrets 中配置。');
  process.exit(1);
} else {
  const maskedKey = apiKey.length > 8 
    ? `${apiKey.substring(0, 5)}***${apiKey.substring(apiKey.length - 4)}` 
    : '***';
  console.log(`✅ 读取到的 Key 长度: ${apiKey.length}`);
  console.log(`✅ Key 脱敏形式: ${maskedKey}`);
  console.log(`✅ 格式检查: ${apiKey.startsWith('re_') ? '正确 (以 re_ 开头)' : '❌ 异常 (未以 re_ 开头)'}`);
}
console.log('----------------------\n');

const resend = new Resend(apiKey);

// 配置带有浏览器伪装的 RSS 解析器
const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Cache-Control': 'no-cache'
  },
  timeout: 15000
});

// 🌐 优化后的海内外 iOS 限免/折扣 RSS 监控源列表（使用稳定源与多节点备用）
const RSS_SOURCES = [
  // 1. Reddit (使用 old.reddit.com 或带参数绕过 403)
  { name: 'Reddit r/AppHookup', url: 'https://old.reddit.com/r/AppHookup/.rss' },

  // 2. 国际 App 优惠折扣社区 (验证最新可用 feed 地址)
  { name: 'AppSlice Free Feed', url: 'https://appslice.co/feed' },
  { name: 'MacRumors iOS Deals', url: 'https://www.macrumors.com/macrumors.xml' },
  { name: '9to5Mac Deals', url: 'https://9to5mac.com/feed/' },
  { name: 'iDownloadBlog Deals', url: 'https://www.idownloadblog.com/feed/' },
  { name: 'TouchArcade Sales', url: 'https://toucharcade.com/feed/' },

  // 3. 国内科技与限免社区 (优先使用原生官方 Feed)
  { name: '小众软件', url: 'https://www.appinn.com/feed/' },
  { name: '异次元软件世界', url: 'https://feed.iplaysoft.com/' },
  { name: '少数派 综合频道', url: 'https://sspai.com/feed' },
  { name: '威锋网 - Apple 资讯', url: 'https://www.feng.com/rss.xml' },

  // 4. 使用 RSSHub 节点转接的渠道 (带主/备节点自动重试机制)
  { 
    name: 'IT之家 - iOS限免', 
    urls: [
      'https://rsshub.rss3.io/ithome/tag/41',
      'https://rss.shab.fun/ithome/tag/41'
    ] 
  },
  { 
    name: 'AppRaven Deals (iOS社区)', 
    urls: [
      'https://rsshub.rss3.io/appstore/price-drop/us/ios',
      'https://rss.shab.fun/appstore/price-drop/us/ios'
    ] 
  },
  { 
    name: 'Apple App of The Day', 
    urls: [
      'https://rsshub.rss3.io/appstore/app-of-the-day/us',
      'https://rss.shab.fun/appstore/app-of-the-day/us'
    ] 
  }
];

async function fetchFeedWithFallback(source) {
  const urls = source.urls || [source.url];
  let lastError = null;

  for (const url of urls) {
    try {
      const feed = await parser.parseURL(url);
      return feed;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function fetchAllVPNDeals() {
  console.log(`🌐 开始扫描 ${RSS_SOURCES.length} 个海内外 iOS 限免/折扣 RSS 订阅源...`);
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const allDeals = [];

  for (const source of RSS_SOURCES) {
    try {
      console.log(`🔍 正在抓取: ${source.name}...`);
      const feed = await fetchFeedWithFallback(source);

      const matchedItems = (feed.items || []).filter((item) => {
        const pubDate = new Date(item.pubDate || item.isoDate || Date.now());
        const title = (item.title || '').toLowerCase();
        const content = (item.contentSnippet || item.content || '').toLowerCase();
        
        const isWithin3Days = pubDate >= threeDaysAgo;
        
        const isVPNRelated = 
          title.includes('vpn') || 
          title.includes('proxy') || 
          title.includes('wireguard') ||
          title.includes('shadowsocks') ||
          title.includes('surge') ||
          title.includes('stash') ||
          title.includes('quantumult') ||
          title.includes('shadowrocket') ||
          content.includes('vpn') ||
          content.includes('网络加速') ||
          content.includes('加速器');

        return isWithin3Days && isVPNRelated;
      }).map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        source: source.name
      }));

      console.log(`   └─ 找到 ${matchedItems.length} 条相关线索`);
      allDeals.push(...matchedItems);
    } catch (err) {
      console.warn(`⚠️ 抓取源 [${source.name}] 失败: ${err.message}`);
    }
  }

  // 去重
  const uniqueDeals = [];
  const seenTitles = new Set();

  for (const deal of allDeals) {
    const cleanTitle = deal.title.toLowerCase().trim();
    if (!seenTitles.has(cleanTitle)) {
      seenTitles.add(cleanTitle);
      uniqueDeals.push(deal);
    }
  }

  return uniqueDeals;
}

function buildHtmlBody(deals) {
  const dateStr = new Date().toISOString().split('T')[0];

  let dealsHtml = '';
  if (deals.length > 0) {
    dealsHtml = '<ul>' + deals.map(item => `
      <li style="margin-bottom: 14px;">
        <a href="${item.link}" style="color: #0066cc; font-weight: bold; font-size: 15px;">${item.title}</a><br/>
        <span style="font-size: 12px; color: #888;">来源: ${item.source} | 发布时间: ${new Date(item.pubDate).toLocaleString('zh-CN')}</span>
      </li>
    `).join('') + '</ul>';
  } else {
    dealsHtml = `
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #17a2b8;">
        <p style="margin: 0; color: #555;">全网扫描完成：近 3 天内未检索到原价付费 VPN / 网络代理工具的 100% 买断限免或重大折扣动态。</p>
      </div>
      <h4 style="margin-top: 20px;">💡 常用高品质/应急 VPN 备用方案：</h4>
      <ul>
        <li><strong>Proton VPN</strong>：App Store 保持提供无流量限制的免费节点（零日志、无广告）。</li>
        <li><strong>FlowVPN</strong>：iOS 端提供 3 天原生免费试用。</li>
        <li><strong>AdGuard VPN</strong>：5 年期长周期折上折特惠进行中。</li>
      </ul>
    `;
  }

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 8px;">
      <h2 style="color: #333; border-bottom: 2px solid #0070f3; padding-bottom: 8px;">📱 iOS App Store 限免/优惠 VPN 全球日报</h2>
      <p style="color: #666; font-size: 14px;">报告日期：${dateStr}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      ${dealsHtml}
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #999; text-align: center;">本邮件由 GitHub Actions & Resend 自动监控派送</p>
    </div>
  `;
}

async function main() {
  const deals = await fetchAllVPNDeals();
  const htmlContent = buildHtmlBody(deals);

  console.log('\n📧 正在调用 Resend 发送全球日报邮件...');
  
  const { data, error } = await resend.emails.send({
    from: 'VPN Monitor <onboarding@resend.dev>',
    to: ['cai.shen@icloud.com'],
    subject: `[iOS App Store] 全球 VPN 限免/优惠日报 (${new Date().toLocaleDateString('zh-CN')})`,
    html: htmlContent,
  });

  if (error) {
    console.error('❌ Resend API 发送失败:', error);
    process.exit(1);
  }

  console.log('✅ 邮件发送成功！返回结果:', data);
}

main();
