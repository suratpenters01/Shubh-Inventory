import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { technicianApi } from '../services/api';
import { IUser } from '../types';
import { Modal } from '../components/common/Modal';
import {
  Users,
  Plus,
  Phone,
  Wrench,
  ArrowUpRight,
  RotateCcw,
  Scale,
  CheckCircle2,
  XCircle,
  Search,
  Edit2,
  KeyRound,
  Trash2,
  MapPin,
  Package,
  AlertCircle,
  Copy,
  Eye,
  EyeOff,
  UserCheck,
  UserX,
  Send,
  IdCard,
  Mail,
  FileText,
} from 'lucide-react';

interface ITechFormData {
  name: string;
  phone: string;
  password?: string;
  area: string;
  employeeCode: string;
  email: string;
  notes: string;
  isActive: boolean;
}

const INITIAL_FORM: ITechFormData = {
  name: '',
  phone: '',
  password: '',
  area: '',
  employeeCode: '',
  email: '',
  notes: '',
  isActive: true,
};

export const TechnicianMasterPage: React.FC = () => {
  const [technicians, setTechnicians] = useState<IUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'withStock'>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPwdModalOpen, setIsResetPwdModalOpen] = useState(false);
  const [selectedTech, setSelectedTech] = useState<IUser | null>(null);

  // Form states
  const [formData, setFormData] = useState<ITechFormData>(INITIAL_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Password reset state
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isResettingPwd, setIsResettingPwd] = useState(false);
  const [resetPwdError, setResetPwdError] = useState<string | null>(null);

  const fetchTechnicians = async () => {
    try {
      setIsLoading(true);
      const list = await technicianApi.getTechnicians();
      setTechnicians(list);
    } catch (err) {
      console.error('Failed to load technicians', err);
      setFeedback({ type: 'error', message: 'Failed to load technician profiles.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTechnicians();
  }, []);

  // Filter logic
  const filteredTechs = useMemo(() => {
    return technicians.filter((t) => {
      const q = search.toLowerCase();
      const matchesSearch =
        t.name.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q) ||
        (t.area && t.area.toLowerCase().includes(q)) ||
        (t.employeeCode && t.employeeCode.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === 'active') return t.isActive !== false;
      if (statusFilter === 'inactive') return t.isActive === false;
      if (statusFilter === 'withStock') return (t.totalHeldQty || 0) > 0;

      return true;
    });
  }, [technicians, search, statusFilter]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormData(INITIAL_FORM);
    setFormError(null);
    setShowPassword(false);
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (tech: IUser) => {
    setSelectedTech(tech);
    setFormData({
      name: tech.name,
      phone: tech.phone,
      password: '',
      area: tech.area || '',
      employeeCode: tech.employeeCode || '',
      email: tech.email || '',
      notes: tech.notes || '',
      isActive: tech.isActive !== false,
    });
    setFormError(null);
    setShowPassword(false);
    setIsEditModalOpen(true);
  };

  // Open Reset Password Modal
  const handleOpenResetPwd = (tech: IUser) => {
    setSelectedTech(tech);
    setNewPassword('tech123');
    setResetPwdError(null);
    setShowPassword(false);
    setIsResetPwdModalOpen(true);
  };

  // Submit Add Technician
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      await technicianApi.addTechnician({
        name: formData.name,
        phone: formData.phone,
        password: formData.password || 'tech123',
        area: formData.area || undefined,
        employeeCode: formData.employeeCode || undefined,
        email: formData.email || undefined,
        notes: formData.notes || undefined,
      });
      setIsAddModalOpen(false);
      setFeedback({
        type: 'success',
        message: `✓ Technician profile for '${formData.name}' created successfully. Login Phone: ${formData.phone}`,
      });
      await fetchTechnicians();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to add technician.');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Edit Technician
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTech) return;
    setFormError(null);
    setIsSaving(true);
    try {
      await technicianApi.updateTechnician(selectedTech._id, {
        name: formData.name,
        phone: formData.phone,
        area: formData.area,
        employeeCode: formData.employeeCode,
        email: formData.email,
        notes: formData.notes,
        isActive: formData.isActive,
        password: formData.password ? formData.password : undefined,
      });
      setIsEditModalOpen(false);
      setFeedback({
        type: 'success',
        message: `✓ Profile updated for '${formData.name}' successfully.`,
      });
      await fetchTechnicians();
    } catch (err: any) {
      setFormError(err.response?.data?.error || 'Failed to update technician.');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Reset Password
  const handleResetPwdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTech) return;
    setResetPwdError(null);
    setIsResettingPwd(true);
    try {
      await technicianApi.resetPassword(selectedTech._id, newPassword);
      setIsResetPwdModalOpen(false);
      setFeedback({
        type: 'success',
        message: `✓ Password reset successfully for ${selectedTech.name}. New password: ${newPassword}`,
      });
    } catch (err: any) {
      setResetPwdError(err.response?.data?.error || 'Failed to reset password.');
    } finally {
      setIsResettingPwd(false);
    }
  };

  // Toggle Active / Inactive Status
  const handleToggleStatus = async (tech: IUser) => {
    try {
      const res = await technicianApi.toggleStatus(tech._id);
      setFeedback({
        type: 'success',
        message: `✓ ${tech.name} account is now ${res.isActive ? 'Active' : 'Inactive'}.`,
      });
      await fetchTechnicians();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to change technician status.',
      });
    }
  };

  // Delete Technician Profile
  const handleDelete = async (tech: IUser) => {
    if (!window.confirm(`Are you sure you want to remove or deactivate technician profile: ${tech.name}?`)) {
      return;
    }
    try {
      const res = await technicianApi.deleteTechnician(tech._id);
      setFeedback({
        type: 'success',
        message: `✓ ${res.message}`,
      });
      await fetchTechnicians();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.response?.data?.error || 'Failed to delete technician.',
      });
    }
  };

  const activeCount = technicians.filter((t) => t.isActive !== false).length;
  const inactiveCount = technicians.filter((t) => t.isActive === false).length;
  const withStockCount = technicians.filter((t) => (t.totalHeldQty || 0) > 0).length;

  return (
    <div className="space-y-6">
      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between shadow-2xs border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs font-semibold underline hover:opacity-75 cursor-pointer ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-zinc-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900">Technician Profiles</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                Admin can directly create, edit, activate/deactivate, and manage technician profiles and login credentials
              </p>
            </div>
          </div>
        </div>

        <button
          id="add-tech-modal-btn"
          onClick={handleOpenAdd}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition cursor-pointer shadow-xs"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Create New Technician
        </button>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
          <input
            id="search-technician-input"
            type="text"
            placeholder="Search by name, phone, area, code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-zinc-900 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            All ({technicians.length})
          </button>
          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-emerald-700 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              statusFilter === 'inactive'
                ? 'bg-zinc-700 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            Inactive ({inactiveCount})
          </button>
          <button
            onClick={() => setStatusFilter('withStock')}
            className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
              statusFilter === 'withStock'
                ? 'bg-blue-700 text-white'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            Holding Stock ({withStockCount})
          </button>
        </div>
      </div>

      {/* Technician Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-zinc-400 bg-white rounded-xl border border-zinc-200">
            <div className="flex justify-center items-center space-x-2">
              <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-medium">Loading technician profiles...</span>
            </div>
          </div>
        ) : filteredTechs.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-zinc-500 bg-white rounded-xl border border-zinc-200 p-6 space-y-2">
            <p className="font-semibold text-zinc-700">No technician profiles found</p>
            <p className="text-zinc-400">
              {search || statusFilter !== 'all'
                ? 'Try adjusting your search query or status filter.'
                : 'Click "Create New Technician" above to create your first field technician account.'}
            </p>
          </div>
        ) : (
          filteredTechs.map((tech) => {
            const isActive = tech.isActive !== false;
            const heldQty = tech.totalHeldQty || 0;

            return (
              <div
                key={tech._id}
                className={`bg-white rounded-xl border p-5 shadow-xs flex flex-col justify-between space-y-4 transition ${
                  isActive ? 'border-zinc-200 hover:border-zinc-300' : 'border-zinc-200 bg-zinc-50/60 opacity-80'
                }`}
              >
                {/* Top Row: Avatar, Name, Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isActive
                          ? 'bg-blue-50 text-blue-700 border border-blue-100'
                          : 'bg-zinc-100 text-zinc-500 border border-zinc-200'
                      }`}
                    >
                      {tech.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-sm font-bold text-zinc-900 truncate">{tech.name}</h3>
                        {tech.employeeCode && (
                          <span className="px-1.5 py-0.5 bg-zinc-100 text-zinc-600 rounded text-[10px] font-mono font-medium">
                            {tech.employeeCode}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600 flex items-center mt-0.5 font-medium">
                        <Phone className="w-3 h-3 mr-1 text-zinc-400 shrink-0" />
                        {tech.phone}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(tech)}
                    title={isActive ? 'Click to deactivate technician' : 'Click to activate technician'}
                    className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                      isActive
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100'
                        : 'text-zinc-600 bg-zinc-100 border border-zinc-200 hover:bg-zinc-200'
                    }`}
                  >
                    {isActive ? (
                      <>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Active
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3 h-3 mr-1" /> Inactive
                      </>
                    )}
                  </button>
                </div>

                {/* Details info */}
                <div className="space-y-1.5 text-xs text-zinc-600 bg-zinc-50/80 p-2.5 rounded-lg border border-zinc-100">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center">
                      <MapPin className="w-3 h-3 mr-1" /> Area / Hub:
                    </span>
                    <span className="font-medium text-zinc-800 text-right truncate max-w-[170px]">
                      {tech.area || <span className="text-zinc-400 italic">Not Assigned</span>}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 flex items-center">
                      <Package className="w-3 h-3 mr-1" /> Held Stock:
                    </span>
                    <span
                      className={`font-semibold ${
                        heldQty > 0 ? 'text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded' : 'text-zinc-600'
                      }`}
                    >
                      {heldQty} {heldQty === 1 ? 'unit' : 'units'} in custody
                    </span>
                  </div>

                  {tech.email && (
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400 flex items-center">
                        <Mail className="w-3 h-3 mr-1" /> Email:
                      </span>
                      <span className="text-zinc-700 truncate max-w-[170px]">{tech.email}</span>
                    </div>
                  )}

                  {tech.notes && (
                    <div className="pt-1 text-[11px] text-zinc-500 line-clamp-1 italic">
                      "{tech.notes}"
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-1.5">
                    <button
                      id={`edit-tech-${tech._id}`}
                      onClick={() => handleOpenEdit(tech)}
                      className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition cursor-pointer"
                      title="Edit Profile"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      id={`reset-pwd-${tech._id}`}
                      onClick={() => handleOpenResetPwd(tech)}
                      className="p-1.5 rounded-md hover:bg-amber-50 text-zinc-600 hover:text-amber-700 transition cursor-pointer"
                      title="Reset Password"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                    </button>

                    <button
                      id={`delete-tech-${tech._id}`}
                      onClick={() => handleDelete(tech)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-zinc-400 hover:text-red-600 transition cursor-pointer"
                      title="Delete / Deactivate Profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    <Link
                      to={`/issue?techId=${tech._id}`}
                      className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-zinc-900 text-white hover:bg-zinc-800 transition"
                      title="Issue Stock to this technician"
                    >
                      <Send className="w-3 h-3 mr-1" />
                      Issue
                    </Link>

                    <Link
                      to={`/return-stock?techId=${tech._id}`}
                      className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-teal-100 text-teal-900 hover:bg-teal-200 transition"
                      title="Bulk Stock Return from this technician"
                    >
                      <RotateCcw className="w-3 h-3 mr-1 text-teal-700" />
                      Return
                    </Link>

                    <Link
                      to={`/stock-cycle?techId=${tech._id}`}
                      className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
                      title="View Stock Cycle & Field Settlement for this technician"
                    >
                      <Scale className="w-3 h-3 mr-1 text-indigo-600" />
                      Settlement
                    </Link>

                    <Link
                      to={`/technician-stock?techId=${tech._id}`}
                      className="inline-flex items-center px-2 py-1 rounded-md text-[11px] font-semibold bg-zinc-100 text-zinc-700 hover:bg-zinc-200 transition"
                      title="View technician held stock"
                    >
                      Stock
                      <ArrowUpRight className="w-3 h-3 ml-0.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create Technician */}
      <Modal
        id="modal-add-technician"
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create Technician Profile"
        subtitle="Admin can register a new field service technician with login credentials & service territory"
        maxWidth="md"
      >
        <form onSubmit={handleAddSubmit} className="space-y-3.5">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kumar"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">Phone Number (Login ID) *</label>
              <input
                type="text"
                required
                placeholder="e.g. 9876500005"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-zinc-700">Default Password *</label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, password: 'tech' + Math.floor(100 + Math.random() * 900) })}
                  className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                >
                  Generate
                </button>
              </div>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  placeholder="Minimum 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 pr-8 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">Employee Code / ID</label>
              <input
                type="text"
                placeholder="e.g. PUR-TECH-05"
                value={formData.employeeCode}
                onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700">Service Area / Territory</label>
              <input
                type="text"
                placeholder="e.g. South Delhi Hub, Noida Sec 62"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">Email Address (Optional)</label>
              <input
                type="email"
                placeholder="e.g. ramesh@pureitservice.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700">Notes / Address / Remarks</label>
            <textarea
              rows={2}
              placeholder="e.g. Pureit RO Certified, Emergency Contact: 9811122233"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-new-tech-btn"
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSaving ? 'Creating...' : 'Create Technician Profile'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Technician */}
      <Modal
        id="modal-edit-technician"
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Profile: ${selectedTech?.name || ''}`}
        subtitle="Update technician information, assigned territory, active status, or credentials"
        maxWidth="md"
      >
        <form onSubmit={handleEditSubmit} className="space-y-3.5">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700">Full Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">Phone Number (Login ID) *</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700">Service Area / Territory</label>
              <input
                type="text"
                placeholder="e.g. South Delhi Hub"
                value={formData.area}
                onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">Employee Code / ID</label>
              <input
                type="text"
                placeholder="e.g. PUR-TECH-01"
                value={formData.employeeCode}
                onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700">Email Address</label>
              <input
                type="email"
                placeholder="e.g. technician@pureitservice.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700">Set New Password (Leave blank to keep current)</label>
              <input
                type="password"
                minLength={6}
                placeholder="Optional (min 6 chars)"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700">Notes / Remarks</label>
            <textarea
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="mt-1 w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="pt-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
              />
              <span className="text-xs font-medium text-zinc-800">
                Active Account (Technician can log in and receive inventory issues)
              </span>
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-edit-tech-btn"
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Quick Reset Password */}
      <Modal
        id="modal-reset-password"
        isOpen={isResetPwdModalOpen}
        onClose={() => setIsResetPwdModalOpen(false)}
        title="Reset Technician Password"
        subtitle={`Set a new login password for ${selectedTech?.name || 'Technician'} (${selectedTech?.phone || ''})`}
        maxWidth="sm"
      >
        <form onSubmit={handleResetPwdSubmit} className="space-y-4">
          {resetPwdError && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs border border-red-200 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{resetPwdError}</span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-700">New Password *</label>
              <button
                type="button"
                onClick={() => setNewPassword('tech123')}
                className="text-[10px] text-blue-600 hover:underline cursor-pointer"
              >
                Set to 'tech123'
              </button>
            </div>
            <div className="relative mt-1">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                placeholder="Enter minimum 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 pr-8 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600"
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-zinc-500 mt-1">
              After resetting, inform the technician of their new password so they can log in.
            </p>
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsResetPwdModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-reset-pwd-btn"
              type="submit"
              disabled={isResettingPwd}
              className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition disabled:opacity-50 cursor-pointer shadow-xs"
            >
              {isResettingPwd ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
