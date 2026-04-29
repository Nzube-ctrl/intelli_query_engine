import { IsOptional, IsIn, IsInt, IsString, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class QueryProfilesDto {
  @IsOptional()
  @IsIn(['male', 'female'])
  gender?: string;

  @IsOptional()
  @IsIn(['child', 'teenager', 'adult', 'senior'])
  age_group?: string;

  @IsOptional()
  @IsString()
  country_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  min_age?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  max_age?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  min_gender_probability?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  min_country_probability?: number;

  @IsOptional()
  @IsIn(['age', 'created_at', 'gender_probability'])
  sort_by?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
