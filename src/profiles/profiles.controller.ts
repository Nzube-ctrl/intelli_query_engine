/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Controller,
  Get,
  Query,
  BadRequestException,
  UnprocessableEntityException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { QueryProfilesDto } from 'src/dto/query.profile.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

@Controller('api/profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('search')
  async search(
    @Query('q') q: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    if (!q || !q.trim()) {
      return {
        status: 'error',
        message: 'Missing or empty parameter',
      };
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
      q,
      pageNum,
      limitNum,
    );

    if ('status' in result && result.status === 'error') {
      return result;
    }

    return {
      status: 'success',
      ...result,
    };
  }

  @Get()
  async findAll(@Query() rawQuery: Record<string, string>) {
    const dto = plainToInstance(QueryProfilesDto, rawQuery);
    const errors = await validate(dto, {
      whitelist: true,
      forbidNonWhitelisted: false,
    });

    if (errors.length > 0) {
      const hasTypeError = errors.some((e) =>
        Object.keys(e.constraints || {}).some(
          (k) =>
            k.includes('isInt') ||
            k.includes('isFloat') ||
            k.includes('isNumber'),
        ),
      );

      if (hasTypeError) {
        return {
          status: 'error',
          message: 'Invalid query parameters',
        };
      }

      return {
        status: 'error',
        message: 'Invalid query parameters',
      };
    }

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
