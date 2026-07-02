import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SetKeyDto {
  @ApiPropertyOptional({ description: 'Chave do provedor; vazio remove' })
  @IsOptional()
  @IsString()
  value?: string;
}

export class IpDto {
  @ApiProperty({ example: '8.8.8.8' })
  @IsString()
  ip: string;
}

export class DomainDto {
  @ApiProperty({ example: 'example.com' })
  @IsString()
  domain: string;
}

export class CveDto {
  @ApiProperty({ example: 'CVE-2024-3094' })
  @IsString()
  cve: string;
}

export class EmailDto {
  @ApiProperty({ example: 'alvo@example.com' })
  @IsString()
  email: string;
}

export class LeakLookupDto {
  @ApiProperty({ example: 'alvo@example.com' })
  @IsString()
  query: string;

  @ApiPropertyOptional({ default: 'email_address' })
  @IsOptional()
  @IsString()
  type?: string;
}

export class CombDto {
  @ApiProperty({ example: 'jrubin' })
  @IsString()
  query: string;
}

export class GodaddyAbuseDto {
  @ApiProperty({ example: 'PHISHING' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'URL/IP/domínio alvo da denúncia', example: 'http://site-malicioso.com' })
  @IsString()
  source: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  target?: string;
}

export class CheckHostDto {
  @ApiProperty({ example: 'example.com' })
  @IsString()
  target: string;

  @ApiPropertyOptional({ enum: ['ping', 'http', 'tcp', 'dns'], default: 'ping' })
  @IsOptional()
  @IsIn(['ping', 'http', 'tcp', 'dns'])
  kind?: string;

  @ApiPropertyOptional({ default: 12, minimum: 1, maximum: 40 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(40)
  maxNodes?: number;
}

export class ServiceScanDto {
  @ApiProperty({ example: 'example.com' })
  @IsString()
  host: string;

  @ApiPropertyOptional({ type: [Number], example: [80, 443, 22] })
  @IsOptional()
  ports?: number[];
}
