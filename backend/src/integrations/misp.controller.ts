import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsInt, IsOptional, IsString } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { MispService } from './misp.service';

class PushDto {
  @ApiProperty()
  @IsString()
  operationId: string;
}

class PullDto {
  @ApiProperty()
  @IsString()
  operationId: string;

  @ApiPropertyOptional({ description: 'Filtrar por tipo MISP (ex: domain, ip-dst)' })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiPropertyOptional({ description: 'Filtrar por valor (suporta % como curinga no MISP)' })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ default: 200 })
  @IsOptional()
  @IsInt()
  limit?: number;
}

@ApiTags('misp')
@ApiBearerAuth()
@Roles(Role.admin, Role.analyst)
@Controller('misp')
export class MispController {
  constructor(
    private readonly misp: MispService,
    private readonly audit: AuditService,
  ) {}

  /** Exporta os IOCs da operação como um evento MISP. */
  @Post('push')
  async push(@Body() dto: PushDto, @CurrentUser() user: AuthUser) {
    const res = await this.misp.pushOperation(dto.operationId);
    await this.audit.log({
      userId: user.id, action: 'misp.push', entityType: 'operation', entityId: dto.operationId, newValue: res,
    });
    return res;
  }

  /** Importa atributos do MISP como IOCs na operação. */
  @Post('pull')
  async pull(@Body() dto: PullDto, @CurrentUser() user: AuthUser) {
    const res = await this.misp.pullToOperation(dto.operationId, { type: dto.type, value: dto.value, limit: dto.limit });
    await this.audit.log({
      userId: user.id, action: 'misp.pull', entityType: 'operation', entityId: dto.operationId, newValue: res,
    });
    return res;
  }
}
