import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { storageService } from '../services/storageService.js';
import { generateToken, AuthRequest } from '../middleware/auth.js';
import { isMongoConnected } from '../db/index.js';
import { isProdEnvironment } from '../utils/env.js';

export function getAdminEnvCredentials() {
  const isProd = isProdEnvironment();
  const phone = (
    process.env.INITIAL_ADMIN_PHONE ||
    process.env.ADMIN_PHONE ||
    (isProd ? '' : '9408197990')
  ).toString().trim();

  const password = (
    process.env.INITIAL_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    (isProd ? '' : 'Shubh@123')
  ).toString().trim();

  const email = (process.env.ADMIN_EMAIL || '').toString().trim();

  return { phone, password, email };
}

export const authController = {
  // Public config endpoint so frontend can display the configured admin phone & DB status
  async getPublicConfig(req: Request, res: Response) {
    const admin = getAdminEnvCredentials();
    return res.json({
      adminPhone: admin.phone || admin.email || 'Admin',
      isMongoConnected: isMongoConnected(),
      databaseType: isMongoConnected() ? 'MongoDB Atlas' : 'Persistent Storage',
    });
  },

  async login(req: Request, res: Response) {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res.status(400).json({ error: 'Phone number or email and password are required.' });
      }

      const identifier = phone.toString().trim();
      const adminCreds = getAdminEnvCredentials();

      // 1. Direct environment variable check for Admin if explicitly configured
      if (
        adminCreds.password &&
        ((adminCreds.phone && identifier === adminCreds.phone) ||
          (adminCreds.email && identifier.toLowerCase() === adminCreds.email.toLowerCase()))
      ) {
        if (password !== adminCreds.password) {
          return res.status(401).json({ error: 'Invalid phone number/email or password.' });
        }

        // Credentials match .env! Ensure admin user exists in DB and is active
        let user = await storageService.findUserByPhoneOrEmail(identifier);
        if (!user) {
          const passwordHash = await bcrypt.hash(adminCreds.password, 10);
          user = await storageService.createUser({
            name: process.env.ADMIN_NAME || 'Shubh Sales Administrator',
            phone: adminCreds.phone || '9999999999',
            email: adminCreds.email || undefined,
            passwordHash,
            role: 'admin',
            isActive: true,
          });
        } else {
          // If password was updated in .env or role needs sync, update user in DB
          const isHashMatch = await bcrypt.compare(adminCreds.password, user.passwordHash).catch(() => false);
          if (!isHashMatch || user.role !== 'admin' || !user.isActive) {
            const newHash = await bcrypt.hash(adminCreds.password, 10);
            await storageService.updateUser(user._id, {
              passwordHash: newHash,
              role: 'admin',
              isActive: true,
            });
            user.role = 'admin';
            user.isActive = true;
          }
        }

        const token = generateToken(user);
        return res.json({
          message: 'Admin login successful',
          token,
          user: {
            id: user._id,
            _id: user._id,
            name: user.name,
            phone: user.phone,
            role: 'admin',
          },
        });
      }

      // 2. Standard user / technician / created admin authentication via DB hashed password
      const user = await storageService.findUserByPhoneOrEmail(identifier);
      if (!user) {
        return res.status(401).json({ error: 'Invalid phone number/email or password.' });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is deactivated. Please contact your manager.' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid phone number/email or password.' });
      }

      const token = generateToken(user);
      const userSafe = {
        id: user._id,
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      };

      return res.json({
        message: 'Login successful',
        token,
        user: userSafe,
      });
    } catch (err: any) {
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Internal server error during authentication.' });
    }
  },



  async getMe(req: AuthRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const { passwordHash, ...userSafe } = req.user;
    return res.json({ user: userSafe });
  },
};
