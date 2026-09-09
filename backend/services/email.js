const nodemailer = require('nodemailer');
const { email, isProduction } = require('../config/env');

let transporter = null;

const envioEmailConfigurado = () => Boolean(email.enabled && (email.smtpUrl || email.host));

const escaparHtml = (valor) =>
  String(valor || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const criarTransporter = () => {
  if (transporter) return transporter;

  if (email.smtpUrl) {
    transporter = nodemailer.createTransport(email.smtpUrl);
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: email.host,
    port: email.port,
    secure: email.secure,
    auth: email.user || email.pass
      ? { user: email.user, pass: email.pass }
      : undefined,
  });
  return transporter;
};

const enviarEmailRecuperacaoSenha = async ({ destino, nome, resetUrl, expiraMinutos }) => {
  if (!envioEmailConfigurado()) {
    if (!isProduction) {
      console.log(`[DEV] Link de recuperacao de senha para ${destino}: ${resetUrl}`);
    }
    return { enviado: false };
  }

  const nomeSeguro = escaparHtml(nome || 'usuário');
  const resetUrlSeguro = escaparHtml(resetUrl);

  await criarTransporter().sendMail({
    from: email.from,
    to: destino,
    subject: 'Recuperacao de senha - FinControl',
    text: [
      `Olá, ${nome || 'usuário'}.`,
      '',
      'Recebemos uma solicitação para redefinir sua senha no FinControl.',
      `Acesse o link abaixo em até ${expiraMinutos} minutos:`,
      '',
      resetUrl,
      '',
      'Se você não solicitou essa alteração, ignore este e-mail.',
    ].join('\n'),
    html: `
      <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
        <h2 style="margin: 0 0 12px;">Recuperacao de senha</h2>
        <p>Olá, ${nomeSeguro}.</p>
        <p>Recebemos uma solicitação para redefinir sua senha no FinControl.</p>
        <p>O link abaixo expira em <strong>${expiraMinutos} minutos</strong>.</p>
        <p>
          <a href="${resetUrlSeguro}" style="display: inline-block; background: #6366F1; color: #fff; padding: 10px 16px; border-radius: 8px; text-decoration: none; font-weight: 700;">
            Redefinir senha
          </a>
        </p>
        <p style="font-size: 13px; color: #64748b;">Se você não solicitou essa alteração, ignore este e-mail.</p>
      </div>
    `,
  });

  return { enviado: true };
};

module.exports = {
  envioEmailConfigurado,
  enviarEmailRecuperacaoSenha,
};
