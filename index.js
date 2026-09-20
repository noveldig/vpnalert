import { Resend } from 'resend';

// 初始化 Resend 客户端
const resend = new Resend('re_5QunnSTP_KA6qy9ydiazomW5Rn98P7gea');

async function sendNotification(vpnDeals) {
  try {
    const data = await resend.emails.send({
      from: 'VPN Monitor <onboarding@resend.dev>', // 注册 Resend 后的默认发信域名
      to: ['cai.shen@icloud.com'],
      subject: `[iOS App Store] 近 3 天限免/优惠 VPN 每日日报`,
      html: `
        <h2>iOS 限免/优惠 VPN 监控日报</h2>
        <p>以下是过去 3 天内监控到的最新 iOS App Store VPN 动态：</p>
        <div>${vpnDeals}</div>
        <hr />
        <p style="font-size: 12px; color: #888;">本邮件由 Resend 自动监控脚本发送</p>
      `
    });

    console.log('邮件发送成功:', data);
  } catch (error) {
    console.error('邮件发送失败:', error);
  }
}

// 模拟获取或爬取到的 VPN 动态信息
const currentDeals = `
  <ul>
    <li><strong>Proton VPN</strong>: App Store 免费层持续生效（无限流量，无日志）。</li>
    <li><strong>FlowVPN</strong>: 提供 3 天免费试用。</li>
    <li><strong>AdGuard VPN</strong>: 5 年期长周期折上折特惠（约 $34.97）。</li>
  </ul>
`;

sendNotification(currentDeals);
