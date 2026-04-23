import {
  Entity,
  Column,
  PrimaryColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('profiles')
export class Profile {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', unique: true })
  name!: string;

  @Column({ type: 'varchar' })
  @Index()
  gender!: string;

  @Column({ type: 'float' })
  gender_probability!: number;

  @Column({ type: 'int' })
  @Index()
  age!: number;

  @Column({ type: 'varchar' })
  @Index()
  age_group!: string;

  @Column({ type: 'varchar', length: 2 })
  @Index()
  country_id!: string;

  @Column({ type: 'varchar' })
  country_name!: string;

  @Column({ type: 'float' })
  country_probability!: number;

  @CreateDateColumn({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at!: Date;
}
