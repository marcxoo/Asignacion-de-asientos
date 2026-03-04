export interface MailRecipient {
  nombre: string;
  correo: string;
  inviteLink: string;
  eventName: string;
}

export interface SeatAssignmentRecipient {
  nombre: string;
  correo: string;
  eventName: string;
  seatLabel: string;
  viewLink: string;
  previousSeatLabel?: string;
}

export interface MailSendResult {
  sent: number;
  failed: number;
  failures: Array<{ correo: string; error: string }>;
}

export interface MailProvider {
  sendInvitationBatch(recipients: MailRecipient[]): Promise<MailSendResult>;
  sendSeatAssignment(recipient: SeatAssignmentRecipient): Promise<void>;
}

class StubInstitutionalMailProvider implements MailProvider {
  async sendInvitationBatch(recipients: MailRecipient[]): Promise<MailSendResult> {
    return {
      sent: recipients.length,
      failed: 0,
      failures: [],
    };
  }

  async sendSeatAssignment(recipient: SeatAssignmentRecipient): Promise<void> {
    void recipient;
    return;
  }
}

class ResendMailProvider implements MailProvider {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  private async send(params: { to: string; subject: string; html: string; text?: string }) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Resend error (${response.status}): ${detail}`);
    }
  }

  async sendInvitationBatch(recipients: MailRecipient[]): Promise<MailSendResult> {
    const failures: Array<{ correo: string; error: string }> = [];
    let sent = 0;

    for (const recipient of recipients) {
      try {
        await this.send({
          to: recipient.correo,
          subject: `Invitacion - ${recipient.eventName}`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
              <h2>Hola ${recipient.nombre},</h2>
              <p>Tienes una invitacion para <strong>${recipient.eventName}</strong>.</p>
              <p>
                Ingresa aqui para seleccionar tu asiento:<br/>
                <a href="${recipient.inviteLink}">${recipient.inviteLink}</a>
              </p>
            </div>
          `,
          text: `Hola ${recipient.nombre},\n\nTienes una invitacion para ${recipient.eventName}.\nIngresa aqui para seleccionar tu asiento:\n${recipient.inviteLink}`,
        });
        sent += 1;
      } catch (error) {
        failures.push({
          correo: recipient.correo,
          error: error instanceof Error ? error.message : 'Error enviando correo',
        });
      }
    }

    return {
      sent,
      failed: failures.length,
      failures,
    };
  }

  async sendSeatAssignment(recipient: SeatAssignmentRecipient): Promise<void> {
    const isSeatChange = Boolean(recipient.previousSeatLabel && recipient.previousSeatLabel !== recipient.seatLabel);

    await this.send({
      to: recipient.correo,
      subject: isSeatChange
        ? `Tu asiento fue actualizado - ${recipient.eventName}`
        : `Tu asiento asignado - ${recipient.eventName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
          <h2>Hola ${recipient.nombre},</h2>
          <p>
            ${isSeatChange
              ? `Tu asiento fue <strong>cambiado</strong> para <strong>${recipient.eventName}</strong>.`
              : `Ya tienes un asiento asignado para <strong>${recipient.eventName}</strong>.`}
          </p>
          ${isSeatChange && recipient.previousSeatLabel
            ? `<p><strong>Asiento anterior:</strong> ${recipient.previousSeatLabel}</p>`
            : ''}
          <p><strong>Asiento:</strong> ${recipient.seatLabel}</p>
          <p>
            Puedes consultar tu asignacion aqui:<br/>
            <a href="${recipient.viewLink}" style="display:inline-block;padding:10px 14px;background:#FF6900;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;margin-top:8px;">Ver mi asiento</a>
          </p>
          <p style="font-size:12px;color:#555;margin-top:14px;">
            Si el boton no funciona, copia este enlace en tu navegador:<br/>
            <span style="word-break:break-all;">${recipient.viewLink}</span>
          </p>
        </div>
      `,
      text: `${isSeatChange ? 'Tu asiento fue actualizado' : 'Tu asiento fue asignado'} para ${recipient.eventName}.\n${recipient.previousSeatLabel ? `Asiento anterior: ${recipient.previousSeatLabel}\n` : ''}Asiento actual: ${recipient.seatLabel}\nVer detalle: ${recipient.viewLink}`,
    });
  }
}

export function getMailProvider(): MailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;

  if (apiKey && from) {
    return new ResendMailProvider(apiKey, from);
  }

  return new StubInstitutionalMailProvider();
}

export function isRealMailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}
