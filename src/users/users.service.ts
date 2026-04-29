import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import { uuidv7 } from 'uuidv7';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async upsertFromGithub(profile: {
    github_id: string;
    username: string;
    email: string | null;
    avatar_url: string | null;
  }): Promise<User> {
    let user = await this.userRepo.findOne({
      where: { github_id: profile.github_id },
    });

    if (!user) {
      user = await this.userRepo.save({
        id: uuidv7(),
        github_id: profile.github_id,
        username: profile.username,
        email: profile.email,
        avatar_url: profile.avatar_url,
        role: 'analyst' as 'admin' | 'analyst',
        is_active: true,
        last_login_at: new Date(),
      } as User);
      return user;
    } else {
      user.username = profile.username;
      user.email = profile.email ?? user.email;
      user.avatar_url = profile.avatar_url ?? user.avatar_url;
      user.last_login_at = new Date();
      return this.userRepo.save(user);
    }
  }
}
