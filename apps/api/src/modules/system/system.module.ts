import { Module } from '@nestjs/common';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { StorageService } from './storage.service';

@Module({
  controllers: [SystemController],
  providers: [SystemService, StorageService],
  exports: [SystemService, StorageService],
})
export class SystemModule {}
