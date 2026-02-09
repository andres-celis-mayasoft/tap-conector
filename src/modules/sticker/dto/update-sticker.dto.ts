import { IsOptional, IsEnum } from 'class-validator';
import { StickerStatus } from '../domain/sticker.types';

export class UpdateStickerDto {
  @IsOptional()
  @IsEnum(StickerStatus)
  status?: StickerStatus;
}
