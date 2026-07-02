import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProviderKeysService } from '../integrations/provider-keys.service';

/**
 * Notificações via Telegram (Bot API). Config em provider_keys('telegram')
 * no formato `BOT_TOKEN|CHAT_ID`, com fallback p/ env TELEGRAM_BOT_TOKEN/CHAT_ID.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  constructor(
    private readonly keys: ProviderKeysService,
    private readonly config: ConfigService,
  ) {}

  private async creds(): Promise<{ token: string; chatId: string } | null> {
    const stored = await this.keys.getKey('telegram');
    if (stored && stored.includes('|')) {
      const [token, chatId] = stored.split('|');
      if (token && chatId) return { token: token.trim(), chatId: chatId.trim() };
    }
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID');
    if (token && chatId) return { token, chatId };
    return null;
  }

  async status(): Promise<{ configured: boolean }> {
    return { configured: !!(await this.creds()) };
  }

  async setConfig(token: string, chatId: string): Promise<void> {
    await this.keys.setKey('telegram', `${token.trim()}|${chatId.trim()}`);
  }

  async clear(): Promise<void> {
    await this.keys.setKey('telegram', null);
  }

  /** Envia uma mensagem (HTML). Retorna {ok} ou {ok:false,error}. */
  async send(text: string): Promise<{ ok: boolean; error?: string }> {
    const c = await this.creds();
    if (!c) return { ok: false, error: 'Telegram não configurado' };
    try {
      const res = await fetch(`https://api.telegram.org/bot${c.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: c.chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      });
      const j = (await res.json().catch(() => null)) as any;
      if (res.ok && j?.ok) return { ok: true };
      return { ok: false, error: j?.description ?? `HTTP ${res.status}` };
    } catch (e) {
      return { ok: false, error: String((e as Error)?.message ?? e) };
    }
  }

  /** Notificação de mudança/alerta (fire-and-forget, não quebra o fluxo). */
  notify(title: string, body: string): void {
    void this.send(`🔔 <b>RedNest — ${this.esc(title)}</b>\n${this.esc(body)}`).then((r) => {
      if (!r.ok && r.error !== 'Telegram não configurado') this.logger.warn(`Telegram falhou: ${r.error}`);
    });
  }

  private esc(s: string): string {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
