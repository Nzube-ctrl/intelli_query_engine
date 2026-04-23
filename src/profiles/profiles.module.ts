import { Module } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { NlpParserService } from 'src/nlp/nlp.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Profile } from 'src/entity/profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Profile])],
  controllers: [ProfilesController],
  providers: [ProfilesService, NlpParserService],
})
export class ProfilesModule {}
