import { IsString, IsOptional } from 'class-validator';

export class CreateStickerDto {
  @IsString()
  submissionId: string;

  @IsOptional()
  @IsString()
  photoType?: string;

  @IsOptional()
  @IsString()
  photoLink?: string;
}
