import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class UpdatePageStepDto {
  @IsString()
  @MaxLength(120)
  stepId: string;

  @IsString()
  html: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsIn(['runtime', 'frozen'])
  renderMode?: 'runtime' | 'frozen';
}

export class UpdatePageContentDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  mainHtml?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePageStepDto)
  steps?: UpdatePageStepDto[];

  @IsOptional()
  @IsObject()
  customizationValues?: Record<string, string>;
}
