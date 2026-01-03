import NexxusAuthStrategy from './AuthStrategy';
import { NexxusDecodedApiUser, NexxusApi } from '../Api';

import passport from 'passport';
import { Strategy as PassportLocalStrategy } from 'passport-local';
import type { Request, Response } from 'express';
import { UserAuthenticationFailedException } from '../Exceptions';

export default class NexxusLocalAuthStrategy extends NexxusAuthStrategy {
  readonly name = 'local';
  readonly requiresCallback = false;

  initializePassport(): void {
    super.initializePassport();

    passport.use('local', new PassportLocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
        passReqToCallback: true
      },
      async (req, email, password, done) => {
        try {
          const appId = req.headers['nxx-app-id'] as string;
          // Find user by username
          const user = await this.findUserByUsername(appId, email);

          if (!user) {
            return done(null, false, new UserAuthenticationFailedException('Invalid credentials'));
          }

          // Verify password
          if (!user.getData().password || !NexxusLocalAuthStrategy.verifyPassword(password, user.getData().password as string)) {
            return done(null, false, new UserAuthenticationFailedException('Invalid credentials'));
          }

          return done(null, user.getData());
        } catch (error) {
          return done(error);
        }
      }
    ));
  }

  async handleAuth(req: Request, res: Response): Promise<void> {
    passport.authenticate('local', { session: false }, (err: any, user: NexxusDecodedApiUser | undefined, info: any) => {
      if (err) {
        throw err;
      }

      if (!user) {
        NexxusApi.logger.debug(`Local authentication failed: ${info.message}`, 'AuthStrategy');

        throw new UserAuthenticationFailedException('Authentication failed');
      }

      // Convert to API user format
      const apiUser: NexxusDecodedApiUser = {
        id: user.id as string,
        username: user.username
      };

      this.sendTokenResponse(res, apiUser);
    })(req, res);
  }

  handleCallback(req: Request, res: Response): void {}
}
