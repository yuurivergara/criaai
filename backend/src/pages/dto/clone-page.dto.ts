import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
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

  /** Upper bound on total quiz states per walk run. */
  @IsOptional()
  @IsInt()
  @Min(20)
  @Max(800)
  quizMaxSteps?: number;

  /** Upper bound on fan-out fork attempts. */
  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(300)
  quizMaxForks?: number;

  /**
   * When true (default), classifier-ambiguous buttons are cross-checked with
   * the local Ollama LLM; a heuristic fallback is used when Ollama is down.
   */
  @IsOptional()
  @IsBoolean()
  useLlmAssist?: boolean;
}
