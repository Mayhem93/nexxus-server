import NexxusAuthStrategy from './AuthStrategy';
import { NexxusApiUser, NexxusApi } from '../Api';
import { UserAuthenticationFailedException } from '../Exceptions';

import passport from 'passport';
import { Strategy as PassportLocalStrategy } from 'passport-local';
import type { Request, Response } from 'express';

export default class NexxusLocalAuthStrategy extends NexxusAuthStrategy {
  readonly name = 'local';
  readonly requiresCallback = false;

  initializePassport(): void {
    super.initializePassport();

    passport.use('local', new PassportLocalStrategy(
      {
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true
      },
      async (req, username, password, done) => {
        try {
          const appId = req.headers['nxx-app-id'] as string;
          const app = NexxusApi.getStoredApp(appId);
          const user = await this.findUserByUsername(appId, username);

          if (!user) {
            return done(null, false, new UserAuthenticationFailedException('Invalid credentials'));
          }

          if (!user.getData().authProviders.includes('local') && app?.getData().allowMultipleLogin === false) {
            return done(null, false, new UserAuthenticationFailedException(
              'User not registered for local authentication and multiple login is disabled'
            ));
          }

          const passwordHash = user.getData().password;

          // Verify password
          if (!passwordHash || !NexxusLocalAuthStrategy.verifyPassword(password, passwordHash)) {
            return done(null, false, new UserAuthenticationFailedException('Invalid credentials'));
          }

          return done(null, NexxusAuthStrategy.convertToApiUser(user));
        } catch (error) {
          return done(error);
        }
      }
    ));
  }

  async handleAuth(req: Request, res: Response): Promise<void> {
    passport.authenticate('local', { session: false }, (err: any, user?: NexxusApiUser, info?: any) => {
      if (err) {
        throw err;
      }

      if (!user) {
        NexxusApi.logger.debug(`Local authentication failed: ${info.message}`, 'AuthStrategy');

        if (info.message === 'Missing credentials') {
          throw new UserAuthenticationFailedException('Username and password are required');
        }

        throw new UserAuthenticationFailedException('Authentication failed');
      }

      this.sendTokenResponse(res, user);
    })(req, res);
  }

  handleCallback(req: Request, res: Response): void {}
}
