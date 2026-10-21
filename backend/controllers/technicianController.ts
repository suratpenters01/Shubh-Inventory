import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { storageService } from '../services/storageService.js';

export const technicianController = {
  async getTechnicians(req: Request, res: Response) {
    try {
      const technicians = await storageService.listTechnicians();
      
      // Calculate live total held stock quantity for each technician
      const safeTechs = await Promise.all(
        technicians.map(async ({ passwordHash, ...tech }) => {
          const balances = await storageService.getBalancesForTechnician(tech._id.toString());
          const totalHeldQty = balances.reduce((sum, b) => sum + b.quantity, 0);
          return {
            ...tech,
            totalHeldQty,
          };
        })
      );

      return res.json({ technicians: safeTechs });
    } catch (err: any) {
      console.error('Error fetching technicians:', err);
      return res.status(500).json({ error: 'Failed to retrieve technicians.' });
    }
  },

  async addTechnician(req: Request, res: Response) {
    try {
      const { name, phone, password, area, employeeCode, email, notes } = req.body;

      if (!name || !phone || !password) {
        return res.status(400).json({ error: 'Name, phone number, and password are required.' });
      }

      const cleanPhone = phone.trim();
      const existing = await storageService.findUserByPhone(cleanPhone);
      if (existing) {
        return res.status(400).json({ error: `A user with phone number '${cleanPhone}' already exists.` });
      }

      if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const newTech = await storageService.createUser({
        name: name.trim(),
        phone: cleanPhone,
        passwordHash,
        role: 'technician',
        isActive: true,
        area: area ? area.trim() : undefined,
        employeeCode: employeeCode ? employeeCode.trim() : undefined,
        email: email ? email.trim() : undefined,
        notes: notes ? notes.trim() : undefined,
      });

      const { passwordHash: _, ...safeTech } = newTech;
      return res.status(201).json({
        message: 'Technician created successfully',
        technician: { ...safeTech, totalHeldQty: 0 },
      });
    } catch (err: any) {
      console.error('Error creating technician:', err);
      return res.status(500).json({ error: 'Failed to create technician.' });
    }
  },

  async updateTechnician(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { name, phone, area, employeeCode, email, notes, isActive, password } = req.body;

      const existing = await storageService.findUserById(id);
      if (!existing) {
        return res.status(404).json({ error: 'Technician not found.' });
      }

      const updates: any = {};
      if (name !== undefined) updates.name = name.trim();
      if (area !== undefined) updates.area = area.trim();
      if (employeeCode !== undefined) updates.employeeCode = employeeCode.trim();
      if (email !== undefined) updates.email = email.trim();
      if (notes !== undefined) updates.notes = notes.trim();
      if (isActive !== undefined) updates.isActive = Boolean(isActive);

      if (phone && phone.trim() !== existing.phone) {
        const cleanPhone = phone.trim();
        const conflict = await storageService.findUserByPhone(cleanPhone);
        if (conflict && conflict._id.toString() !== id) {
          return res.status(400).json({ error: `Phone number '${cleanPhone}' is already in use by another user.` });
        }
        updates.phone = cleanPhone;
      }

      if (password && password.trim().length >= 6) {
        const salt = await bcrypt.genSalt(10);
        updates.passwordHash = await bcrypt.hash(password.trim(), salt);
      }

      const updated = await storageService.updateUser(id, updates);
      if (!updated) {
        return res.status(500).json({ error: 'Failed to update technician.' });
      }

      const { passwordHash: _, ...safeTech } = updated;
      const balances = await storageService.getBalancesForTechnician(id);
      const totalHeldQty = balances.reduce((sum, b) => sum + b.quantity, 0);

      return res.json({
        message: 'Technician profile updated successfully',
        technician: { ...safeTech, totalHeldQty },
      });
    } catch (err: any) {
      console.error('Error updating technician:', err);
      return res.status(500).json({ error: 'Failed to update technician.' });
    }
  },

  async resetPassword(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      const user = await storageService.findUserById(id);
      if (!user) {
        return res.status(404).json({ error: 'Technician not found.' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      await storageService.updateUser(id, { passwordHash });

      return res.json({
        message: `Password reset successfully for ${user.name}.`,
      });
    } catch (err: any) {
      console.error('Error resetting password:', err);
      return res.status(500).json({ error: 'Failed to reset password.' });
    }
  },

  async toggleStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await storageService.findUserById(id);
      if (!user) {
        return res.status(404).json({ error: 'Technician not found.' });
      }

      const newStatus = !user.isActive;
      const updated = await storageService.updateUser(id, { isActive: newStatus });

      return res.json({
        message: `Technician account has been ${newStatus ? 'activated' : 'deactivated'}.`,
        isActive: newStatus,
        technician: updated,
      });
    } catch (err: any) {
      console.error('Error toggling technician status:', err);
      return res.status(500).json({ error: 'Failed to toggle status.' });
    }
  },

  async deleteTechnician(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = await storageService.findUserById(id);
      if (!user) {
        return res.status(404).json({ error: 'Technician not found.' });
      }

      // 1. Check if holding active stock
      const balances = await storageService.getBalancesForTechnician(id);
      const totalHeld = balances.reduce((sum, b) => sum + b.quantity, 0);
      if (totalHeld > 0) {
        return res.status(400).json({
          error: `Cannot delete technician '${user.name}'. They currently hold ${totalHeld} unit(s) of physical stock. Please return all stock to warehouse first or deactivate the account.`,
        });
      }

      // 2. Check if there are past stock transactions in immutable ledger
      const txs = await storageService.listStockTransactions({ technicianId: id });
      if (txs.length > 0) {
        // Soft deactivate to preserve immutable audit trail
        await storageService.updateUser(id, { isActive: false });
        return res.json({
          message: `Technician has ${txs.length} transaction entries in the immutable ledger. To preserve audit integrity, their account has been deactivated rather than deleted.`,
          deactivated: true,
        });
      }

      // 3. No stock, no transactions -> can safely hard delete
      await storageService.deleteUser(id);
      return res.json({
        message: `Technician '${user.name}' has been permanently deleted.`,
        deleted: true,
      });
    } catch (err: any) {
      console.error('Error deleting technician:', err);
      return res.status(500).json({ error: 'Failed to delete technician.' });
    }
  },
};
