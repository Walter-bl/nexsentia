import { IsString, IsOptional, IsNumber, IsArray } from 'class-validator';

export class ScanRequestDto {
  @IsString()
  sourceType: string;

  @IsString()
  sourceId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  fieldsToScan?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  piiTypesToDetect?: string[];
}

export class AnonymizeRequestDto {
  @IsString()
  sourceType: string;

  @IsString()
  sourceId: string;

  @IsString()
  fieldName: string;

  @IsString()
  method: 'hash' | 'tokenize' | 'encrypt' | 'mask';

  @IsOptional()
  @IsString()
  piiType?: string;
}

export class DetokenizeRequestDto {
  @IsString()
  tokenId: string;
}
