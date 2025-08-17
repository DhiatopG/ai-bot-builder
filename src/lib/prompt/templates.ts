export function getFallbackTemplate(intent: string, biz: any) {
  const email = biz?.email || 'not available';
  const phone = biz?.phone || 'not available';
  const address = biz?.address || 'not available';
  if (/(emergency|urgent)/i.test(intent)) {
    return 'I can help right away with urgent dental issues. I can get you the soonest appointment.';
  }
  if (/(pricing)/i.test(intent)) {
    return 'I don’t have that exact price here. I can connect you with our team or help you book a quick consult.';
  }
  if (/(services)/i.test(intent)) {
    return 'I don’t see that in the knowledge base. I can connect you with our team or help you book a consult.';
  }
  if (/(hours)/i.test(intent)) {
    return `Our contact details:\n- Email: ${email}\n- Phone: ${phone}\n- Location: ${address}`;
  }
  return 'I don’t have that in this bot’s knowledge base. I can still help you get the right appointment or connect you with our team.';
}
