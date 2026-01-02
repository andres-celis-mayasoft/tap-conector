import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { MeikoModule } from './modules/meiko/meiko.module';
import { InvoiceModule } from './modules/invoice/invoice.module';
import { ExtractionModule } from './modules/extraction/extraction.module';
import { OcrModule } from './modules/ocr/ocr.module';
import { ValidatorModule } from './modules/validator/validator.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { ExcludedModule } from './modules/excluded/excluded.module';
import { ProductModule } from './modules/product/product.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    MeikoModule,
    InvoiceModule,
    ExtractionModule,
    OcrModule,
    ValidatorModule,
    ExcludedModule,
    ProductModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
