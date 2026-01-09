import { NexxusApi, NexxusApiUser } from '../Api';

import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import {
  NexxusApplicationUser,
  NexxusFilterQuery,
  NexxusUserModelType
} from '@nexxus/core';

export interface NexxusBaseAuthStrategyConfig {
  jwtSecret: string;
  jwtExpiresIn?: string;
  [key: string]: any;
}

export type NexxusAuthProviders = 'local' | 'google' | string;

export default abstract class NexxusAuthStrategy<T extends NexxusBaseAuthStrategyConfig = NexxusBaseAuthStrategyConfig> {
  abstract readonly name: string;
  abstract readonly requiresCallback: boolean;
  protected config: T = {} as T;
  protected static jwtSecret: string;
  protected static jwtExpiresIn: string;

  abstract handleAuth(req: Request, res: Response): void | Promise<void>;
  abstract handleCallback(req: Request, res: Response): void | Promise<void>;

  initializePassport(): void {
    this.config = NexxusApi.instance.getAuthProviderConfig<T>(this.name);

    const apiConfig = NexxusApi.instance.getConfig();

    NexxusAuthStrategy.jwtSecret = apiConfig.auth?.jwtSecret as string;
    NexxusAuthStrategy.jwtExpiresIn = apiConfig.auth?.jwtExpiresIn || '7d';
  }

  /**
   * Generate JWT token from user object
   */
  protected generateToken(user: NexxusApiUser): string {
    return jwt.sign(user, NexxusAuthStrategy.jwtSecret,
      {
        expiresIn: NexxusAuthStrategy.jwtExpiresIn as any,
        issuer: 'localhost',
        audience: user.appId
      }
    );
  }

  /**
   * Send success response with token
   */
  protected sendTokenResponse(res: Response, user: NexxusApiUser): void {
    const token = this.generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username
      }
    });
  }

  /**
   * Find user by username (email)
   */
  public async findUserByUsername(appId: string, username: string): Promise<NexxusApplicationUser | null> {
    const app = NexxusApi.getStoredApp(appId);
    const fq = new NexxusFilterQuery({ username }, { modelType: 'user', userDetailsSchema: app?.getUserDetailSchema()});

    const res = await NexxusApi.database.searchItems({
      appId,
      type: 'user',
      filter: fq
    });

    return res.length > 0 ? res[0] : null;
  }

  /**
   * Create new user
   * For local strategy: includes password hash
   * For OAuth: password is null
   */
  public async createUser(appId: string, data: {
    username: string;
    password?: string;
    authProvider: NexxusAuthProviders;
    details?: Record<string, any>;
  }): Promise<NexxusApplicationUser> {
    const userData: NexxusUserModelType = {
      type: 'user',
      appId,
      username: data.username,
      password: data.password ? NexxusAuthStrategy.hashPassword(data.password) : null,
      authProvider: data.authProvider,
      devices: [],
      details: data.details || {}
    };
    const user = new NexxusApplicationUser(userData);

    await NexxusApi.database.createItems([ user ]);

    return user;
  }

  /**
   * Find user by username, create if doesn't exist (for OAuth)
   */
  protected async findOrCreateUser(appId: string, data: {
    username: string;
    authProvider: NexxusAuthProviders;
    details?: Record<string, any>;
  }): Promise<NexxusApplicationUser> {
    let user = await this.findUserByUsername(appId, data.username);

    if (!user) {
      user = await this.createUser(appId, {
        authProvider: data.authProvider,
        username: data.username,
        details: data.details
      });
    }

    return user;
  }

  protected static convertToApiUser(user: NexxusApplicationUser): NexxusApiUser {
    const data = user.getData();

    return {
      id: data.id!,
      username: data.username,
      authProvider: data.authProvider,
      details: data.details,
      appId: data.appId
    };
  }

  public static hashPassword(password: string): string {
    return bcrypt.hashSync(password, 10);
  }

  protected static verifyPassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
  }
}
