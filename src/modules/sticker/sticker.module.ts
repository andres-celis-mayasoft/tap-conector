import { Module } from '@nestjs/common';
import { StickerService } from './sticker.service';
import { StickerController } from './sticker.controller';
import { StickerCron } from './sticker.cron';
import { StickerClientRepository } from './repositories/sticker-client.repo';
import { StickerOwnRepository } from './repositories/sticker-own.repo';

@Module({
  controllers: [StickerController],
  providers: [
    StickerClientRepository,
    StickerOwnRepository,
    StickerService,
    StickerCron,
  ],
  exports: [StickerService],
})
export class StickerModule {}
