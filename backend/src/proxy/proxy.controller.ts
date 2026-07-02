import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProxyProtocol, Role } from '@prisma/client';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { ProxyService } from './proxy.service';

class ListQuery {
  @IsOptional() @IsInt() @Min(1) page?: number;
  @IsOptional() @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsIn(['alive', 'dead', 'all']) status?: 'alive' | 'dead' | 'all';
  @IsOptional() @IsIn(['http', 'socks4', 'socks5']) protocol?: ProxyProtocol;
  @IsOptional() @IsString() country?: string;
  @IsOptional() @IsString() q?: string;
}

class GeoCheckDto {
  @IsString() target: string;
  @IsOptional() @IsInt() @Min(2) @Max(20) max?: number;
}

class TestDto {
  @IsString() proxy: string;
}

class ImportDto {
  @IsString() text: string;
}

@ApiTags('proxies')
@ApiBearerAuth()
@Controller('proxies')
export class ProxyController {
  constructor(private readonly proxy: ProxyService) {}

  /** Lista paginada (20/página por padrão) com status, país e anonimato. */
  @Get()
  list(@Query() q: ListQuery) {
    return this.proxy.list(q);
  }

  @Get('stats')
  stats() {
    return this.proxy.stats();
  }

  @Roles(Role.admin, Role.analyst)
  @Post('refresh')
  async refresh() {
    return this.proxy.refreshFromSource();
  }

  @Roles(Role.admin, Role.analyst)
  @Post('validate')
  async validate() {
    return this.proxy.validatePool();
  }

  /** Testa um único proxy colado pelo operador (não adiciona ao pool). */
  @Roles(Role.admin, Role.analyst)
  @Post('test')
  async test(@Body() dto: TestDto) {
    return this.proxy.testProxy(dto.proxy);
  }

  /** Re-testa um proxy do pool por id. */
  @Roles(Role.admin, Role.analyst)
  @Post(':id/test')
  async testById(@Param('id') id: string) {
    return this.proxy.testById(id);
  }

  /** Importa lista colada / arquivo (parseia, deduplica, insere, valida). */
  @Roles(Role.admin, Role.analyst)
  @Post('import')
  async import(@Body() dto: ImportDto) {
    return this.proxy.importList(dto.text);
  }

  @Roles(Role.admin, Role.analyst)
  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.proxy.removeOne(id);
    return { ok: true };
  }

  /** Checagem geo-distribuída de um alvo (anti-cloaking). */
  @Roles(Role.admin, Role.analyst)
  @Post('geo-check')
  async geoCheck(@Body() dto: GeoCheckDto) {
    return this.proxy.geoCheck(dto.target, { max: dto.max });
  }
}
