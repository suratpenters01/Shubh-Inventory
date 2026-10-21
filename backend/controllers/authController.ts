import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { storageService } from '../services/storageService.js';
import { generateToken, AuthRequest } from '../middleware/auth.js';

export function getAdminEnvCredentials() {
  const phone = (
    process.env.INITIAL_ADMIN_PHONE ||
    process.env.ADMIN_PHONE ||
    '9408197990'
  ).toString().trim();

  const password = (
    process.env.INITIAL_ADMIN_PASSWORD ||
    process.env.ADMIN_PASSWORD ||
    'Shubh@123'
  ).toString().trim();

  return { phone, password };
}

export const authController = {
  // Public config endpoint so frontend can display the configured admin phone
  async getPublicConfig(req: Request, res: Response) {
    const admin = getAdminEnvCredentials();
    return res.json({
      adminPhone: admin.phone,
    });
  },

  async login(req: Request, res: Response) {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res.status(400).json({ error: 'Phone number and password are required.' });
      }

      const cleanPhone = phone.toString().trim();
      const adminCreds = getAdminEnvCredentials();

      // 1. Direct environment variable check for Admin
      // If phone matches configured admin phone from .env:
      if (cleanPhone === adminCreds.phone) {
        if (password !== adminCreds.password) {
          return res.status(401).json({ error: 'Invalid phone number or password.' });
        }

        // Credentials match .env! Ensure admin user exists in DB and is active
        let user = await storageService.findUserByPhone(cleanPhone);
        if (!user) {
          const passwordHash = await bcrypt.hash(adminCreds.password, 10);
          user = await storageService.createUser({
            name: process.env.ADMIN_NAME || 'Shubh Sales Administrator',
            phone: cleanPhone,
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

      // 2. Standard user / technician authentication via DB
      const user = await storageService.findUserByPhone(cleanPhone);
      if (!user) {
        return res.status(401).json({ error: 'Invalid phone number or password.' });
      }

      if (!user.isActive) {
        return res.status(403).json({ error: 'Account is deactivated. Please contact your manager.' });
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid phone number or password.' });
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
