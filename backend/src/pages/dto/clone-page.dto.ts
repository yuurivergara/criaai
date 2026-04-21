import {
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ClonePageDto {
  @IsUrl({
    require_protocol: true,
  })
  sourceUrl: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  objective?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  workspaceId?: string;
}
