import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Profile } from 'src/entity/profile.entity';
import { uuidv7 } from 'uuidv7';
import * as fs from 'fs';
import * as path from 'path';

function getAgeGroup(age: number): string {
  if (age <= 12) return 'child';
  if (age <= 17) return 'teenager';
  if (age <= 64) return 'adult';
  return 'senior';
}

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    private readonly dataSource: DataSource,
  ) {}

  async seed(jsonFilePath?: string) {
    const filePath = jsonFilePath || path.join(process.cwd(), 'seed-data.json');

    if (!fs.existsSync(filePath)) {
      this.logger.error(`Seed file not found at: ${filePath}`);
      this.logger.log(
        'Place your seed JSON file at the project root as seed-data.json',
      );
      return;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const profiles: any[] = JSON.parse(raw);

    this.logger.log(`Seeding ${profiles.length} profiles...`);

    const chunkSize = 100;
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < profiles.length; i += chunkSize) {
      const chunk = profiles.slice(i, i + chunkSize);

      const entities = chunk.map((p) => {
        const profile = new Profile();
        profile.id = uuidv7();
        profile.name = p.name?.toLowerCase?.() ?? p.name;
        profile.gender = p.gender;
        profile.gender_probability =
          p.gender_probability ?? p.genderProbability ?? 0;
        profile.age = p.age;
        profile.age_group = p.age_group ?? getAgeGroup(p.age);
        profile.country_id = p.country_id ?? p.countryId ?? p.country?.id ?? '';
        profile.country_name =
          p.country_name ?? p.countryName ?? p.country?.name ?? '';
        profile.country_probability =
          p.country_probability ??
          p.countryProbability ??
          p.country?.probability ??
          0;
        return profile;
      });

      const result = await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(Profile)
        .values(entities)
        .orIgnore()
        .execute();

      inserted += result.raw?.length ?? chunk.length;
    }

    this.logger.log(
      `Seed complete. Profiles in DB: ${await this.profileRepo.count()}`,
    );
  }
}
