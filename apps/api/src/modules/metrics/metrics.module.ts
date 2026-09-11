import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from '../../common/interceptors/metrics.interceptor';
import { HttpLogInterceptor } from '../../common/interceptors/http-log.interceptor';

@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
    { provide: APP_INTERCEPTOR, useClass: HttpLogInterceptor },
  ],
  exports: [MetricsService],
})
export class MetricsModule {}
