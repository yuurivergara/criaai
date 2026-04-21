import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class PublishPageDto {
  @IsString()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/)
  subdomain: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  workspaceId?: string;
}
