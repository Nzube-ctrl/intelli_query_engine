import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ unique: true })
  github_id!: string;

  @Column()
  username!: string;

  @Column({ nullable: true })
  email!: string;

  @Column({ nullable: true })
  avatar_url!: string;

  @Column({ default: 'analyst' })
  role!: 'admin' | 'analyst';

  @Column({ default: true })
  is_active!: boolean;

  @Column({ nullable: true, type: 'timestamp' })
  last_login_at!: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
