import { Module } from '@nestjs/common';
import { CharacterController } from './character.controller';
import { CharacterService } from './character.service';
import { CharacterVoiceService } from './character-voice.service';
import { PrismaModule } from '../../common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CharacterController],
  providers: [CharacterService, CharacterVoiceService],
  exports: [CharacterService],
})
export class CharacterModule {}
