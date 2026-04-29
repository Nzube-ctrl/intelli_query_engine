import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { RefreshToken } from './refresh.token.entity';
import { UsersService } from 'src/users/users.service';
import { uuidv7 } from 'uuidv7';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  private pkceStore = new Map<
    string,
    { code_challenge: string; expires: number }
  >();
  constructor(
    private jwtService: JwtService,
    private userService: UsersService,
    @InjectRepository(RefreshToken)
    private refreshTokenRepo: Repository<RefreshToken>,
  ) {}

  storePkce(state: string, code_challenge: string) {
    this.pkceStore.set(state, {
      code_challenge,
      expires: Date.now() + 5 * 60 * 1000,
    });
  }

  validatePkce(state: string, code_verifier: string): boolean {
    const entry = this.pkceStore.get(state);
    if (!entry || Date.now() > entry.expires) return false;
    this.pkceStore.delete(state);
    const computed = createHash('sha256')
      .update(code_verifier)
      .digest('base64url');
    return computed === entry.code_challenge;
  }

  async issueTokens(user: { id: string; role: string }) {
    const access_token = this.jwtService.sign(
      { sub: user.id, role: user.role },
      { expiresIn: '3m' },
    );

    const raw = randomBytes(32).toString('hex');
    const token_hash = createHash('sha256').update(raw).digest('hex');

    const expires_at = new Date(Date.now() + 5 * 60 * 1000);
    await this.refreshTokenRepo.save({
      token_hash,
      user_id: user.id,
      expires_at,
    });

    return { access_token, refresh_token: raw };
  }

  async refresh(raw_token: string) {
    const token_hash = createHash('sha256').update(raw_token).digest('hex');
    const stored = await this.refreshTokenRepo.findOne({
      where: { token_hash, revoked: false },
      relations: ['user'],
    });

    if (!stored || stored.expires_at < new Date()) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Invalid or expired refresh token',
      });
    }
    await this.refreshTokenRepo.update(stored.id, { revoked: true });

    if (!stored.user.is_active) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'Account is inactive',
      });
    }

    return this.issueTokens(stored.user);
  }

  async logout(raw_token: string) {
    const token_hash = createHash('sha256').update(raw_token).digest('hex');
    await this.refreshTokenRepo.update({ token_hash }, { revoked: true });
  }

  async handleGithubCallback(githubProfile: any) {
    const user = await this.userService.upsertFromGithub(githubProfile);
    return this.issueTokens(user);
  }
}
