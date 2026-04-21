import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class GeneratePageDto {
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  prompt: string;

  @IsOptional()
  @IsString()
  @MaxLength(140)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  cta?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  workspaceId?: string;
}
