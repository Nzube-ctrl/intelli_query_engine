import {
  Controller,
  Get,
  Query,
  BadRequestException,
  UnprocessableEntityException,
  HttpException,
  HttpStatus,
  Body,
  HttpCode,
  Post,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { QueryProfilesDto } from 'src/dto/query.profile.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt.auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Roles('admin')
  @Post()
  @HttpCode(201)
  async create(@Body() body: any) {
    if (!body) {
      return { status: 'error', message: 'Missing body' };
    }
    try {
      let input: any[];
      if (Array.isArray(body)) {
        input = body;
      } else if (body.profiles && Array.isArray(body.profiles)) {
        input = body.profiles;
      } else {
        input = [body];
      }
      const result = await this.profilesService.bulkUpsert(input);
      return { status: 'success', inserted: result };
    } catch (err) {
      return { status: 'error', message: err.message || 'Server error' };
    }
  }

  @Get('search')
  async search(
    @Query('q') q: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    if (q === undefined || q === null || q.trim() === '') {
      return { status: 'error', message: 'Missing or empty parameter' };
    }

    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    if (
      isNaN(pageNum) ||
      isNaN(limitNum) ||
      pageNum < 1 ||
      limitNum < 1 ||
      limitNum > 50
    ) {
      return { status: 'error', message: 'Invalid query parameters' };
    }

    const result = await this.profilesService.searchNaturalLanguage(
      q.trim(),
      pageNum,
      limitNum,
    );

    if ('status' in result && result.status === 'error') {
      return result;
    }

    return {
      status: 'success',
      page: (result as any).page,
      limit: (result as any).limit,
      total: (result as any).total,
      data: (result as any).data,
    };
  }

  @Get()
  async findAll(@Query() rawQuery: Record<string, string>) {
    const allowedParams = [
      'gender',
      'age_group',
      'country_id',
      'min_age',
      'max_age',
      'min_gender_probability',
      'min_country_probability',
      'sort_by',
      'order',
      'page',
      'limit',
    ];

    const unknownParams = Object.keys(rawQuery).filter(
      (k) => !allowedParams.includes(k),
    );
    if (unknownParams.length > 0) {
      return { status: 'error', message: 'Invalid query parameters' };
    }

    const validGenders = ['male', 'female'];
    const validAgeGroups = ['child', 'teenager', 'adult', 'senior'];
    const validSortBy = ['age', 'created_at', 'gender_probability'];
    const validOrders = ['asc', 'desc'];

    if (rawQuery.gender && !validGenders.includes(rawQuery.gender)) {
      return { status: 'error', message: 'Invalid query parameters' };
    }
    if (rawQuery.age_group && !validAgeGroups.includes(rawQuery.age_group)) {
      return { status: 'error', message: 'Invalid query parameters' };
    }
    if (rawQuery.sort_by && !validSortBy.includes(rawQuery.sort_by)) {
      return { status: 'error', message: 'Invalid query parameters' };
    }
    if (rawQuery.order && !validOrders.includes(rawQuery.order)) {
      return { status: 'error', message: 'Invalid query parameters' };
    }

    const numericFields = [
      'min_age',
      'max_age',
      'min_gender_probability',
      'min_country_probability',
      'page',
      'limit',
    ];
    for (const field of numericFields) {
      if (rawQuery[field] !== undefined) {
        const val = Number(rawQuery[field]);
        if (isNaN(val)) {
          return { status: 'error', message: 'Invalid query parameters' };
        }
      }
    }

    if (rawQuery.limit && Number(rawQuery.limit) > 50) {
      return { status: 'error', message: 'Invalid query parameters' };
    }

    const dto = plainToInstance(QueryProfilesDto, rawQuery);

    try {
      const result = await this.profilesService.findAll(dto);
      return {
        status: 'success',
        page: result.page,
        limit: result.limit,
        total: result.total,
        data: result.data,
      };
    } catch (err) {
      return { status: 'error', message: 'Server error' };
    }
  }
}
