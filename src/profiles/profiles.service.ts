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
import { SelectQueryBuilder } from 'typeorm';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    private readonly nlpParser: NlpParserService,
  ) {}

  private applyFilters(
    qb: SelectQueryBuilder<Profile>,
    query: QueryProfilesDto,
  ): void {
    const {
      gender,
      country_id,
      min_age,
      max_age,
      age_group,
      min_gender_probability,
      min_country_probability,
    } = query;

    if (gender) qb.andWhere('profile.gender = :gender', { gender });
    if (country_id)
      qb.andWhere('UPPER(profile.country_id) = :country_id', {
        country_id: country_id.toUpperCase(),
      });
    if (min_age !== undefined)
      qb.andWhere('profile.age >= :min_age', { min_age });
    if (max_age !== undefined)
      qb.andWhere('profile.age <= :max_age', { max_age });
    if (age_group) qb.andWhere('profile.age_group = :age_group', { age_group });
    if (min_gender_probability !== undefined)
      qb.andWhere('profile.gender_probability >= :mgp', {
        mgp: min_gender_probability,
      });
    if (min_country_probability !== undefined)
      qb.andWhere('profile.country_probability >= :mcp', {
        mcp: min_country_probability,
      });
  }

  private applySort(
    qb: SelectQueryBuilder<Profile>,
    query: QueryProfilesDto,
  ): void {
    const ALLOWED_SORT_FIELDS = [
      'age',
      'name',
      'gender',
      'country_id',
      'created_at',
      'gender_probability',
    ];
    const sortBy =
      query.sort_by && ALLOWED_SORT_FIELDS.includes(query.sort_by)
        ? query.sort_by
        : 'created_at';
    const order = query.order?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

    qb.orderBy(`profile.${sortBy}`, order);
  }

  async bulkUpsert(input: any[]): Promise<number> {
    const profiles: any[] = Array.isArray(input)
      ? input
      : ((input as any).profiles ?? []);
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
        created_at: new Date(),
      }));

      await this.profileRepo
        .createQueryBuilder()
        .insert()
        .into(Profile)
        .values(entities)
        .orIgnore()
        .execute();
    }

    return profiles.length;
  }

  async findAll(query: QueryProfilesDto) {
    const { page = 1, limit = 10 } = query;
    const qb = this.profileRepo.createQueryBuilder('profile');

    this.applyFilters(qb, query);
    this.applySort(qb, query);

    const total = await qb.getCount();
    const profiles = await qb
      .skip((+page - 1) * +limit)
      .take(+limit)
      .getMany();

    return {
      status: 'success',
      page: +page,
      limit: +limit,
      total,
      total_pages: Math.ceil(total / +limit),
      links: {
        self: `/api/profiles?page=${page}&limit=${limit}`,
        next:
          +page < Math.ceil(total / +limit)
            ? `/api/profiles?page=${+page + 1}&limit=${limit}`
            : null,
        prev:
          +page > 1 ? `/api/profiles?page=${+page - 1}&limit=${limit}` : null,
      },
      data: profiles,
    };
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

  //Reusing same filter/sort logic from private helpers
  async exportAll(query: QueryProfilesDto): Promise<Profile[]> {
    const qb = this.profileRepo.createQueryBuilder('profile');
    this.applyFilters(qb, query);
    this.applySort(qb, query);
    return qb.getMany();
  }
}
