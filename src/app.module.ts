import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { MeikoModule } from './modules/meiko/meiko.module';
import { TapModule } from './modules/tap/tap.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { OcrModule } from './modules/ocr/ocr.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    MeikoModule,
    TapModule,
    InvoiceModule,
    ExtractionModule,
    OcrModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
