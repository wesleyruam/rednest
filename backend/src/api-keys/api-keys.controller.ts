import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(
    private readonly apiKeys: ApiKeysService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.apiKeys.list(user.id);
  }

  @Post()
  async create(@Body() dto: CreateApiKeyDto, @CurrentUser() user: AuthUser) {
    const result = await this.apiKeys.create(user.id, dto);
    await this.audit.log({
      userId: user.id,
      action: 'api_key.create',
      entityType: 'api_key',
      entityId: result.apiKey.id,
      newValue: { name: result.apiKey.name },
    });
    return result;
  }

  @Patch(':id/revoke')
  async revoke(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    const key = await this.apiKeys.revoke(user.id, id);
    await this.audit.log({
      userId: user.id,
      action: 'api_key.revoke',
      entityType: 'api_key',
      entityId: id,
    });
    return key;
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.apiKeys.remove(user.id, id);
    await this.audit.log({
      userId: user.id,
      action: 'api_key.delete',
      entityType: 'api_key',
      entityId: id,
    });
  }
}
