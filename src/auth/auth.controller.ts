import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  Query,
  UnauthorizedException,
  HttpCode,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Response, Request } from 'express';
import { RefreshTokenDto } from './dto/refresh.token.dto';
import { Public } from './decorators/public.decorator';
import { AuthService } from './auth.service';
import { UsersService } from 'src/users/users.service';

@Throttle({ default: { limit: 10, ttl: 6000 } })
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Public()
  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubLogin() {
    // Passport redirects automatically
  }

  @Public()
  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallBack(@Req() req: Request, @Res() res: Response) {
    const tokens = await this.authService.handleGithubCallback(req.user);

    // For web portal set HTTP only cookies
    res.cookie('access_token', tokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 3 * 60 * 1000,
    });
    res.cookie('refresh_token', tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });
    res.redirect(`${process.env.WEB_PORTAL_URL}/dashboard`);
  }

  @Public()
  @Get('github/cli')
  githubCliLogin(
    @Query('state') state: string,
    @Query('code_challenge') code_challenge: string,
    @Res() res: Response,
  ) {
    this.authService.storePkce(state, code_challenge);
    const params = new URLSearchParams({
      client_id: process.env.GITHUB_CLIENT_ID!,
      redirect_uri: process.env.GITHUB_CLI_CALLBACK_URL!,
      scope: 'user:email',
      state,
    });
    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
  }

  @Public()
  @Post('github/cli/token')
  @HttpCode(200)
  async cliToken(
    @Body('code') code: string,
    @Body('code_verifier') code_verifier: string,
    @Body('state') state: string,
  ) {
    if (!this.authService.validatePkce(state, code_verifier)) {
      throw new UnauthorizedException({
        status: 'error',
        message: 'PKCE validation failed',
      });
    }

    // Exchange code with GitHub
    const ghRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: process.env.GITHUB_CLI_CALLBACK_URL,
      }),
    });
    const ghData = (await ghRes.json()) as any;
    if (ghData.error) {
      throw new UnauthorizedException({
        status: 'error',
        message: ghData.error_description,
      });
    }

    const profileRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${ghData.access_token}`,
        'User-Agent': 'insighta-cli',
      },
    });
    const profile = (await profileRes.json()) as any;

    const emailRes = await fetch('https://api.github.com/user/emails', {
      headers: {
        Authorization: `Bearer ${ghData.access_token}`,
        'User-Agent': 'insighta-cli',
      },
    });
    const emails = (await emailRes.json()) as any[];
    const primaryEmail = emails?.find((e) => e.primary)?.email ?? null;

    const user = await this.authService['usersService'].upsertFromGithub({
      github_id: String(profile.id),
      username: profile.login,
      email: primaryEmail,
      avatar_url: profile.avatar_url,
    });

    const tokens = await this.authService.issueTokens(user);
    return { status: 'success', username: user.username, ...tokens };
  }

  @Public()
  @Get('github/cli/callback')
  cliCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ) {
    res.redirect(`http://localhost:9876/callback?code=${code}&state=${state}`);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenDto) {
    const tokens = await this.authService.refresh(dto.refresh_token);
    return { status: 'success', ...tokens };
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Body('refresh_token') refresh_token: string,
    @Res() res: Response,
  ) {
    if (refresh_token) await this.authService.logout(refresh_token);
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ status: 'success', message: 'Logged out' });
  }

  @Get('whoami')
  whoami(@Req() req: Request) {
    const u = req.user as any;
    return {
      status: 'success',
      data: {
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role,
        avatar_url: u.avatar_url,
      },
    };
  }
}
