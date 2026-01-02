import { Module } from '@nestjs/common';
import { ExcludedService } from './excluded.service';
import { ExcludedController } from './excluded.controller';

@Module({
  controllers: [ExcludedController],
  providers: [ExcludedService],
})
export class ExcludedModule {}
