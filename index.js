import Parser from 'rss-parser';
import { Resend } from 'resend';

// 从 GitHub Actions 环境变量读取密钥
const apiKey = process.env.RESEND_API_KEY;

// 🔍 环境变量与 Key 格式诊断打印
console.log('--- 🔑 环境变量诊断 ---');
if (!apiKey) {
  console.error('❌ 结果: RESEND_API_KEY 环境变量未定义 (undefined / empty)！请检查 GitHub Repo -> Settings -> Secrets 是否已配置。');
} else {
  const maskedKey = apiKey.length > 8 
    ? `${apiKey.substring(0, 5)}***${apiKey.substring(apiKey.length - 4)}` 
    : '***';
  console.log(`✅ 读取到的 Key 长度: ${apiKey.length}`);
  console.log(`✅ Key 的脱敏形式: ${maskedKey}`);
  console.log(`✅ 前缀格式检查: ${apiKey.startsWith('re_') ? '正确 (以 re_ 开头)' : '❌ 异常 (未以 re_ 开头，请检查复制时是否夹带空格/引号)'}`);
}
console.log('----------------------\n');

if (!apiKey) {
  process.exit(1);
}

const resend = new Resend(apiKey);
const parser = new Parser();

// RSS 源：Reddit r/AppHookup RSS 订阅地址
const RSS_URL = 'https://www.reddit.com/r/AppHookup/.rss';

async function fetchVPNDeals() {
  console.log('🔍 开始获取 Reddit r/AppHookup RSS 动态...');
  try {
    const feed = await parser.parseURL(RSS_URL);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // 筛选 3 天以内且标题包含 VPN 相关关键词的帖子
    const matchedItems = feed.items.filter((item) => {
      const pubDate = new Date(item.pubDate || item.isoDate);
      const title = (item.title || '').toLowerCase();
      
      const isWithin3Days = pubDate >= threeDaysAgo;
      const isVPNRelated = title.includes('vpn') || title.includes('proxy') || title.includes('wireguard');

      return isWithin3Days && isVPNRelated;
    });

    return matchedItems;
  } catch (err) {
    console.error('⚠️ 抓取 RSS 失败或超时，生成备用汇总模板:', err.message);
    return [];
  }
}

function buildHtmlBody(deals) {
  const dateStr = new Date().toISOString().split('T')[0];

  let dealsHtml = '';
  if (deals.length > 0) {
    dealsHtml = '<ul>' + deals.map(item => `
      <li style="margin-bottom: 12px;">
        <a href="${item.link}" style="color: #0066cc; font-weight: bold; font-size: 16px;">${item.title}</a><br/>
        <span style="font-size: 12px; color: #666;">发布时间: ${new Date(item.pubDate).toLocaleString('zh-CN')}</span>
      </li>
    `).join('') + '</ul>';
  } else {
    dealsHtml = `
      <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #17a2b8;">
        <p style="margin: 0; color: #555;">过去 3 天内未检索到原价付费 VPN 的 100% 买断限免信息。</p>
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
      <h2 style="color: #333; border-bottom: 2px solid #0070f3; padding-bottom: 8px;">📱 iOS App Store 限免 VPN 每日监控</h2>
      <p style="color: #666; font-size: 14px;">报告日期：${dateStr}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      ${dealsHtml}
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #999; text-align: center;">本邮件由 GitHub Actions & Resend 自动派送</p>
    </div>
  `;
}

async function main() {
  const deals = await fetchVPNDeals();
  const htmlContent = buildHtmlBody(deals);

  console.log('📧 正在调用 Resend 发送邮件...');
  
  const { data, error } = await resend.emails.send({
    from: 'VPN Monitor <onboarding@resend.dev>',
    to: ['cai.shen@icloud.com'],
    subject: `[iOS App Store] VPN 限免/优惠每日日报 (${new Date().toLocaleDateString('zh-CN')})`,
    html: htmlContent,
  });

  if (error) {
    console.error('❌ Resend API 发送失败:', error);
    process.exit(1);
  }

  console.log('✅ 邮件发送成功！返回结果:', data);
}

main();
