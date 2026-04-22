import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GeneratePageDto {
  /** Free-form product description — the core prompt the LLM works from. */
  @IsString()
  @MinLength(8)
  @MaxLength(4000)
  prompt: string;

  /** Display title / meta title. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  /** Primary CTA label (e.g. "Quero garantir meu acesso"). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cta?: string;

  /** Product name shown in hero + footer. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  productName?: string;

  /** Target audience description. */
  @IsOptional()
  @IsString()
  @MaxLength(320)
  audience?: string;

  /** Niche / category. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  niche?: string;

  /** Big promise / main transformation in one sentence. */
  @IsOptional()
  @IsString()
  @MaxLength(280)
  promise?: string;

  /** Unique mechanism / why this one is different. */
  @IsOptional()
  @IsString()
  @MaxLength(600)
  uniqueMechanism?: string;

  /** Objections / hesitations to proactively handle (list). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  objections?: string[];

  /** Proof points / credibility markers (list). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  proofPoints?: string[];

  /** Bonuses included in the offer (list). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  bonuses?: string[];

  /** Author / expert bio (for authority-led layouts). */
  @IsOptional()
  @IsString()
  @MaxLength(800)
  authorBio?: string;

  /** Author name. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  authorName?: string;

  /** Author role / credential. */
  @IsOptional()
  @IsString()
  @MaxLength(160)
  authorRole?: string;

  /** Urgency / scarcity hook (e.g. "Turma fecha sexta-feira"). */
  @IsOptional()
  @IsString()
  @MaxLength(280)
  urgencyHook?: string;

  /** Price / offer line. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  priceOffer?: string;

  /** Guarantee line. */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  guarantee?: string;

  /** Tone. */
  @IsOptional()
  @IsIn([
    'confident',
    'friendly',
    'urgent',
    'empathetic',
    'authoritative',
    'playful',
  ])
  tone?:
    | 'confident'
    | 'friendly'
    | 'urgent'
    | 'empathetic'
    | 'authoritative'
    | 'playful';

  /** Output language. */
  @IsOptional()
  @IsIn(['pt-BR', 'en-US', 'es-ES'])
  language?: 'pt-BR' | 'en-US' | 'es-ES';

  /** Preferred layout variant. */
  @IsOptional()
  @IsIn(['vsl-hero', 'story-driven', 'authority-led'])
  layoutPreference?: 'vsl-hero' | 'story-driven' | 'authority-led';

  /** Preferred palette id. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  palettePreference?: string;

  /** Preferred typography id. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  typographyPreference?: string;

  /** Optional initial VSL URL. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  vslUrl?: string;

  /** Optional initial checkout URL. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  checkoutUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  workspaceId?: string;
}
