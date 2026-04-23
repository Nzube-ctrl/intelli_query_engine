/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  BadRequestException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Profile } from 'src/entity/profile.entity';
import { QueryProfilesDto } from 'src/dto/query.profile.dto';
import { uuidv7 } from 'uuidv7';
import { NlpParserService } from 'src/nlp/nlp.service';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    private readonly nlpParser: NlpParserService,
    private readonly dataSource: DataSource,
  ) {}

  async bulkUpsert(profiles: any[]): Promise<number> {
    if (!profiles.length) return 0;

    function getAgeGroup(age: number): string {
      if (age <= 12) return 'child';
      if (age <= 17) return 'teenager';
      if (age <= 64) return 'adult';
      return 'senior';
    }

    const chunkSize = 100;
    for (let i = 0; i < profiles.length; i += chunkSize) {
      const chunk = profiles.slice(i, i + chunkSize);
      const entities = chunk.map((p: any) => ({
        id: p.id || uuidv7(),
        name: (p.name ?? '').toLowerCase(),
        gender: p.gender ?? '',
        gender_probability: p.gender_probability ?? p.genderProbability ?? 0,
        age: p.age ?? 0,
        age_group: p.age_group ?? p.ageGroup ?? getAgeGroup(p.age ?? 0),
        country_id: p.country_id ?? p.countryId ?? p.country?.id ?? '',
        country_name: p.country_name ?? p.countryName ?? p.country?.name ?? '',
        country_probability:
          p.country_probability ??
          p.countryProbability ??
          p.country?.probability ??
          0,
      }));

      await this.dataSource
        .createQueryBuilder()
        .insert()
        .into(Profile)
        .values(entities)
        .orIgnore()
        .execute();
    }

    return profiles.length;
  }

  async findAll(dto: QueryProfilesDto) {
    const page = dto.page ?? 1;
    const limit = Math.min(dto.limit ?? 10, 50);
    const sortBy = dto.sort_by ?? 'created_at';
    const order = (dto.order ?? 'asc').toUpperCase() as 'ASC' | 'DESC';

    const qb = this.profileRepo.createQueryBuilder('profile');

    if (dto.gender) {
      qb.andWhere('profile.gender = :gender', { gender: dto.gender });
    }
    if (dto.age_group) {
      qb.andWhere('profile.age_group = :age_group', {
        age_group: dto.age_group,
      });
    }
    if (dto.country_id) {
      qb.andWhere('UPPER(profile.country_id) = :country_id', {
        country_id: dto.country_id.toUpperCase(),
      });
    }
    if (dto.min_age !== undefined) {
      qb.andWhere('profile.age >= :min_age', { min_age: dto.min_age });
    }
    if (dto.max_age !== undefined) {
      qb.andWhere('profile.age <= :max_age', { max_age: dto.max_age });
    }
    if (dto.min_gender_probability !== undefined) {
      qb.andWhere('profile.gender_probability >= :mgp', {
        mgp: dto.min_gender_probability,
      });
    }
    if (dto.min_country_probability !== undefined) {
      qb.andWhere('profile.country_probability >= :mcp', {
        mcp: dto.min_country_probability,
      });
    }

    qb.orderBy(`profile.${sortBy}`, order);

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return { page, limit, total, data };
  }

  async searchNaturalLanguage(q: string, page: number = 1, limit: number = 10) {
    if (!q || !q.trim()) {
      throw new BadRequestException('Missing or empty parameter');
    }

    const parsed = this.nlpParser.parse(q);

    if (!parsed.success) {
      return { status: 'error', message: 'Unable to interpret query' };
    }

    const dto: QueryProfilesDto = {
      ...parsed.filters,
      page,
      limit: Math.min(limit, 50),
    };

    const result = await this.findAll(dto);
    return result;
  }
}
