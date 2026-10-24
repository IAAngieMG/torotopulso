/**
 * Envío de correo para las notificaciones de Pulso, vía la API HTTP de Resend (sin SDK: un
 * fetch). Si no hay `RESEND_API_KEY` configurada, no se envía nada — la notificación sigue
 * guardándose y mostrándose en la campanita del dashboard, solo no llega por correo. Así el
 * canal de correo queda apagado por default hasta que Angie agregue la API key como variable de
 * entorno en Netlify, sin que falte nada más del lado del código.
 */
export interface EmailButton {
  label: string;
  url: string;
}

export async function sendNotificationEmail(opts: { to: string; subject: string; heading: string; body: string; button?: EmailButton }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const from = process.env.EMAIL_FROM || 'Pulso Toroto <notificaciones@toroto.mx>';

  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #0b1c30;">
      <p style="font-size: 13px; color: #64748b; margin: 0 0 16px;">Pulso Toroto</p>
      <h1 style="font-size: 18px; margin: 0 0 12px;">${escapeHtml(opts.heading)}</h1>
      <p style="font-size: 14px; line-height: 1.5; margin: 0 0 20px;">${escapeHtml(opts.body)}</p>
      ${
        opts.button
          ? `<a href="${opts.button.url}" style="display: inline-block; background: #ff5a36; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 20px; border-radius: 8px;">${escapeHtml(opts.button.label)}</a>`
          : ''
      }
    </div>
  `.trim();

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html }),
    });
    if (!r.ok) {
      console.error('No fue posible enviar el correo de notificación:', r.status, await r.text());
    }
  } catch (error) {
    console.error('Error de red enviando el correo de notificación:', error);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}
