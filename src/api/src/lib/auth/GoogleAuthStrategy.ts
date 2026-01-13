import NexxusAuthStrategy, { NexxusBaseAuthStrategyConfig } from './AuthStrategy';
import {
  NexxusApi,
  NexxusApiUser,
  NexxusApiRequest,
  NexxusApiResponse
} from '../Api';

import type { Request, Response } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { UserAuthenticationFailedException } from '../Exceptions';
import { NexxusJsonPatch } from '@nexxus/core';

export interface NexxusGoogleAuthConfig extends NexxusBaseAuthStrategyConfig {
  clientID: string;
  clientSecret: string;
  callbackURL: string; // e.g., "http://localhost:3000/auth/google/callback"
}

export default class NexxusGoogleAuthStrategy extends NexxusAuthStrategy<NexxusGoogleAuthConfig> {
  readonly name = 'google';
  readonly requiresCallback = true;

  initializePassport(): void {
    super.initializePassport();

    passport.use('google', new GoogleStrategy(
      {
        clientID: this.config.clientID,
        clientSecret: this.config.clientSecret,
        callbackURL: this.config.callbackURL,
        scope: ['profile', 'email'],
        passReqToCallback: true
      },
      async (req, accessToken, refreshToken, profile, done) => {
        try {
          const appId = req.query.state as string;
          const email = profile.emails?.[0]?.value;
          const app = NexxusApi.getStoredApp(appId);

          if (!email) {
            return done(new Error('No email found in Google profile'));
          }

          // Find or create user
          const [user, status] = await this.findOrCreateUser(appId, {
            username: email,
            authProvider: 'google',
            details: {
              name: profile.displayName,
              googleId: profile.id
            }
          });

          if (status === 'found') {
            const hasGoogleAuth = user.getData().authProviders.includes('google');

            if (hasGoogleAuth) {
              return done(null, NexxusAuthStrategy.convertToApiUser(user));
            }

            if (app?.getData().allowMultipleLogin === false) {
              return done(new UserAuthenticationFailedException(
                'User not registered for google authentication and multiple login is disabled'
              ));
            }

            NexxusApi.logger.debug(`status: ${status}; user: ${JSON.stringify(user.getData())}`, 'GoogleAuthStrategy');

            // update user with additional auth provider
            const patch = new NexxusJsonPatch({
              op: 'append',
              path: ['authProviders'],
              value: ['google'],
              metadata: {
                appId,
                id: user.getData().id!,
                type: 'user'
              }
            });

            const updatedAtPatch = new NexxusJsonPatch({
              op: 'replace',
              path: ['updatedAt'],
              value: [new Date()],
              metadata: {
                appId,
                id: user.getData().id!,
                type: 'user'
              }
            });

            patch.validate({ modelType: 'user', userDetailsSchema: app?.getUserDetailSchema() });
            updatedAtPatch.validate({ modelType: 'user', userDetailsSchema: app?.getUserDetailSchema() });

            await NexxusApi.database.updateItems([patch, updatedAtPatch]);
          }

          return done(null, NexxusAuthStrategy.convertToApiUser(user));
        } catch (error) {
          return done(error);
        }
      }
    ));
  }

  async handleAuth(req: NexxusApiRequest, res: NexxusApiResponse): Promise<void> {
    const appId = req.headers['nxx-app-id'] as string;
    // const deviceId = req.headers['nxx-device-id'] as string;

    // Initiate Google OAuth flow (redirects browser to Google)
    passport.authenticate('google', {
      session: false,
      scope: ['profile', 'email'],
      state: appId // Pass appId and deviceId via state
    })(req, res);
  }

  async handleCallback(req: Request, res: Response): Promise<void> {
    // Handle Google's callback (browser was redirected here by Google)
    passport.authenticate('google', { session: false }, (err: any, user: NexxusApiUser, info: any) => {
      if (err) {
        throw err;
      }

      // NexxusApi.logger.debug(`Google authentication callback invoked: ${JSON.stringify(user)}`, 'GoogleAuthStrategy');

      if (!user) {
        return res.status(401).json({ error: info?.message || 'Authentication failed' });
      }

      this.sendTokenResponse(res, user);
    })(req, res);
  }
}
