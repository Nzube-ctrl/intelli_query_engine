/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Profile } from 'src/entity/profile.entity';
import { uuidv7 } from 'uuidv7';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

function getAgeGroup(age: number): string {
  if (age <= 12) return 'child';
  if (age <= 17) return 'teenager';
  if (age <= 64) return 'adult';
  return 'senior';
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    console.error('DATABASE_URL is not set in environment variables.');
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    url: dbUrl,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false,
    entities: [Profile],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Database connected.');

  await dataSource.synchronize();

  const filePath =
    process.argv[2] || path.join(process.cwd(), 'seed-data.json');

  if (!fs.existsSync(filePath)) {
    console.error(`Seed file not found: ${filePath}`);
    console.log('Usage: npx ts-node src/seed/run-seed.ts [path-to-json]');
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const profiles: any[] = JSON.parse(raw);

  console.log(`Seeding ${profiles.length} profiles...`);

  const chunkSize = 100;

  for (let i = 0; i < profiles.length; i += chunkSize) {
    const chunk = profiles.slice(i, i + chunkSize);

    const entities = chunk.map((p) => ({
      id: uuidv7(),
      name: (p.name ?? '').toLowerCase(),
      gender: p.gender ?? '',
      gender_probability: p.gender_probability ?? p.genderProbability ?? 0,
      age: p.age ?? 0,
      age_group: p.age_group ?? getAgeGroup(p.age ?? 0),
      country_id: p.country_id ?? p.countryId ?? p.country?.id ?? '',
      country_name: p.country_name ?? p.countryName ?? p.country?.name ?? '',
      country_probability:
        p.country_probability ??
        p.countryProbability ??
        p.country?.probability ??
        0,
    }));

    await dataSource
      .createQueryBuilder()
      .insert()
      .into(Profile)
      .values(entities)
      .orIgnore()
      .execute();

    process.stdout.write(
      `\rProgress: ${Math.min(i + chunkSize, profiles.length)}/${profiles.length}`,
    );
  }

  const count = await dataSource.getRepository(Profile).count();
  console.log(`\nSeed complete. Total profiles in DB: ${count}`);

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
