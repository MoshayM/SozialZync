import { Module } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { VoiceController } from './voice.controller';
import { CharacterCastService } from './character-cast.service';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [MediaModule],
  providers: [VoiceService, CharacterCastService],
  controllers: [VoiceController],
  exports: [VoiceService, CharacterCastService],
})
export class VoiceModule {}
