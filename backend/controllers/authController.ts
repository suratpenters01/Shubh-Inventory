import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { storageService } from '../services/storageService.js';
import { generateToken, AuthRequest } from '../middleware/auth.js';

export const authController = {
  async login(req: Request, res: Response) {
    try {
      const { phone, password } = req.body;
      if (!phone || !password) {
        return res.status(400).json({ error: 'Phone number and password are required.' });
      }

      const user = await storageService.findUserByPhone(phone.trim());
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
