import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKey } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

/** Public view of an API key — never exposes the hash or the secret. */
export type ApiKeyView = Omit<ApiKey, 'keyHash'>;

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  list(userId: string): Promise<ApiKeyView[]> {
    return this.prisma.apiKey.findMany({
      where: { userId },
      omit: { keyHash: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Creates a key and returns the plaintext secret exactly once. */
  async create(
    userId: string,
    dto: CreateApiKeyDto,
  ): Promise<{ apiKey: ApiKeyView; key: string }> {
    const envPrefix = this.config.get<string>('API_KEY_PREFIX') ?? 'rn_live_';
    const secret = randomBytes(24).toString('hex');
    const fullKey = `${envPrefix}${secret}`;
    const prefix = fullKey.slice(0, envPrefix.length + 4); // e.g. rn_live_a1b2

    const keyHash = await argon2.hash(fullKey, { type: argon2.argon2id });

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        prefix,
        keyHash,
        scopes: dto.scopes ?? [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
      omit: { keyHash: true },
    });

    return { apiKey, key: fullKey };
  }

  async revoke(userId: string, id: string): Promise<ApiKeyView> {
    await this.ensureOwned(userId, id);
    return this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
      omit: { keyHash: true },
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.ensureOwned(userId, id);
    await this.prisma.apiKey.delete({ where: { id } });
  }

  /** Verifies a presented key for external (x-api-key) auth. */
  async verify(presented: string): Promise<ApiKey | null> {
    const envPrefix = this.config.get<string>('API_KEY_PREFIX') ?? 'rn_live_';
    const prefix = presented.slice(0, envPrefix.length + 4);
    const candidates = await this.prisma.apiKey.findMany({
      where: { prefix, revokedAt: null },
    });
    for (const candidate of candidates) {
      if (candidate.expiresAt && candidate.expiresAt < new Date()) continue;
      if (await argon2.verify(candidate.keyHash, presented)) {
        await this.prisma.apiKey.update({
          where: { id: candidate.id },
          data: { lastUsedAt: new Date() },
        });
        return candidate;
      }
    }
    return null;
  }

  private async ensureOwned(userId: string, id: string): Promise<ApiKey> {
    const key = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!key || key.userId !== userId) {
      throw new NotFoundException('Chave de API não encontrada');
    }
    return key;
  }
}
