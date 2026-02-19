export interface MailRecipient {
  nombre: string;
  correo: string;
  inviteLink: string;
  eventName: string;
}

export interface MailSendResult {
  sent: number;
  failed: number;
  failures: Array<{ correo: string; error: string }>;
}

export interface MailProvider {
  sendInvitationBatch(recipients: MailRecipient[]): Promise<MailSendResult>;
}

class StubInstitutionalMailProvider implements MailProvider {
  async sendInvitationBatch(recipients: MailRecipient[]): Promise<MailSendResult> {
    return {
      sent: recipients.length,
      failed: 0,
      failures: [],
    };
  }
}

export function getMailProvider(): MailProvider {
  return new StubInstitutionalMailProvider();
}
