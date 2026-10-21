import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { stockApi } from '../services/api';
import { IReturnRequest } from '../types';
import { ReturnStatusBadge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  AlertCircle,
  Warehouse,
  User,
} from 'lucide-react';

export const ReturnRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [returnRequests, setReturnRequests] = useState<IReturnRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');
  const [isLoading, setIsLoading] = useState(true);

  // New Request Modal (for tech or admin)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [techHeldItems, setTechHeldItems] = useState<any[]>([]);
  const [returnIdempotencyKey, setReturnIdempotencyKey] = useState(() => 'ret_' + crypto.randomUUID());
  const [newRequestData, setNewRequestData] = useState({
    itemId: '',
    quantity: '',
    reason: '',
  });

  // Reject Modal (for admin)
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchRequests = async () => {
    try {
      setIsLoading(true);
      const data = await stockApi.getReturnRequests(
        filterStatus === 'ALL' ? undefined : filterStatus
      );
      setReturnRequests(data);
    } catch (err) {
      console.error('Failed to load return requests', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filterStatus]);

  // Load technician's stock when opening request modal
  const openNewRequestModal = async () => {
    setActionError(null);
    setReturnIdempotencyKey('ret_' + crypto.randomUUID());
    if (!user) return;
    try {
      const res = await stockApi.getTechnicianBalance(user._id);
      const withStock = res.balances.filter((b) => b.quantity > 0);
      setTechHeldItems(withStock);
      if (withStock.length > 0) {
        setNewRequestData({
          itemId: withStock[0].item._id,
          quantity: '1',
          reason: 'Excess stock return to central warehouse',
        });
      } else {
        setNewRequestData({
          itemId: '',
          quantity: '',
          reason: '',
        });
      }
      setIsNewModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setIsProcessing(true);
    try {
      await stockApi.submitReturnRequest(
        {
          itemId: newRequestData.itemId,
          quantity: Number(newRequestData.quantity),
          reason: newRequestData.reason.trim(),
        },
        returnIdempotencyKey
      );
      setIsNewModalOpen(false);
      setReturnIdempotencyKey('ret_' + crypto.randomUUID());
      setActionSuccess('Return request submitted successfully. Awaiting warehouse confirmation.');
      fetchRequests();
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Failed to submit return request.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirmation modal for admin
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const handleConfirmReturn = async (requestId: string) => {
    setActionError(null);
    setIsProcessing(true);
    setConfirmingId(null);
    try {
      await stockApi.confirmReturnRequest(requestId);
      setActionSuccess(
        'Return confirmed! Stock has been moved from technician back to warehouse balance inside atomic session.'
      );
      fetchRequests();
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Failed to confirm return.');
    } finally {
      setIsProcessing(false);
    }
  };

  const openRejectModal = (id: string) => {
    setRejectingId(id);
    setRejectionReason('Item damaged or incorrect model returned.');
    setRejectModalOpen(true);
  };

  const handleRejectReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId) return;
    setActionError(null);
    setIsProcessing(true);
    try {
      await stockApi.rejectReturnRequest(rejectingId, rejectionReason);
      setRejectModalOpen(false);
      setActionSuccess('Return request marked as rejected.');
      fetchRequests();
    } catch (err: any) {
      setActionError(err.response?.data?.error || 'Failed to reject return request.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_-4px_rgba(0,0,0,0.02)]">
        <div>
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-700 text-white flex items-center justify-center font-bold shadow-md shadow-sky-500/20">
              <RotateCcw className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-display font-extrabold tracking-tight text-slate-900">
                Spare Parts Return Requests
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Manage hand-over of unused filters or parts back into central warehouse custody
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons: Technician submits, Admin can also trigger bulk return */}
        <div className="flex items-center space-x-2.5">
          <Link
            to="/return-stock"
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 transition shadow-md shadow-teal-600/20 active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Bulk Return from Technician
          </Link>
          <button
            id="btn-open-return-modal"
            onClick={openNewRequestModal}
            className="inline-flex items-center px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 transition shadow-md shadow-sky-600/25 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Single Item Request
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionError && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start space-x-2 font-medium">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start space-x-2 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-slate-200/90 pb-2">
        {['PENDING', 'CONFIRMED', 'REJECTED', 'ALL'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              filterStatus === status
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100/90 hover:text-slate-900'
            }`}
          >
            {status === 'PENDING' && 'Pending Verification'}
            {status === 'CONFIRMED' && 'Confirmed In-Warehouse'}
            {status === 'REJECTED' && 'Rejected Requests'}
            {status === 'ALL' && 'All Requests'}
          </button>
        ))}
      </div>

      {/* Return Requests List */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Request Date</th>
                <th className="py-3 px-4">Technician</th>
                <th className="py-3 px-4">Item &amp; Quantity</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Confirmation Details</th>
                {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-10 text-center text-zinc-400">
                    <div className="flex justify-center items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin"></div>
                      <span>Loading return requests...</span>
                    </div>
                  </td>
                </tr>
              ) : returnRequests.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-8 text-center text-zinc-400">
                    No return requests found for this filter.
                  </td>
                </tr>
              ) : (
                returnRequests.map((req) => (
                  <tr key={req._id} className="hover:bg-zinc-50/70 transition">
                    <td className="py-3.5 px-4 font-mono text-zinc-600">
                      {new Date(req.requestedAt).toLocaleDateString()}{' '}
                      <span className="text-[10px] text-zinc-400">
                        {new Date(req.requestedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center space-x-1.5">
                        <User className="w-3.5 h-3.5 text-zinc-400" />
                        <div>
                          <p className="font-semibold text-zinc-900">{req.technician?.name}</p>
                          <p className="text-[10px] text-zinc-400">{req.technician?.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-zinc-900">{req.item?.itemName}</p>
                      <p className="font-mono text-[11px] text-zinc-500">
                        [{req.item?.itemCode}] •{' '}
                        <span className="font-bold text-teal-700">
                          {req.quantity} {req.item?.unit}
                        </span>
                      </p>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs text-zinc-600">
                      {req.reason}
                      {req.rejectionReason && (
                        <p className="text-[11px] text-red-600 mt-1">
                          Reject Reason: {req.rejectionReason}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <ReturnStatusBadge status={req.status} />
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-zinc-500">
                      {req.status === 'CONFIRMED' && (
                        <div>
                          <p className="text-emerald-700 font-medium">Confirmed by {req.confirmedBy?.name || 'Admin'}</p>
                          <p className="text-zinc-400">
                            {req.confirmedAt ? new Date(req.confirmedAt).toLocaleDateString() : ''}
                          </p>
                        </div>
                      )}
                      {req.status === 'PENDING' && (
                        <span className="text-amber-600 flex items-center">
                          <Clock className="w-3 h-3 mr-1" /> Awaiting warehouse physical check
                        </span>
                      )}
                      {req.status === 'REJECTED' && (
                        <span className="text-red-500 flex items-center">
                          <XCircle className="w-3 h-3 mr-1" /> Returned rejected
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3.5 px-4 text-right">
                        {req.status === 'PENDING' ? (
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              id={`confirm-return-${req._id}`}
                              onClick={() => handleConfirmReturn(req._id)}
                              disabled={isProcessing}
                              className="px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition cursor-pointer flex items-center"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Confirm
                            </button>
                            <button
                              id={`reject-return-${req._id}`}
                              onClick={() => openRejectModal(req._id)}
                              disabled={isProcessing}
                              className="px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50 border border-red-200 rounded-md transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-zinc-400">Processed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: New Return Request */}
      <Modal
        id="modal-request-return"
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        title="Submit Stock Return Request"
        subtitle="Hand-over excess filters or spare parts back into warehouse custody"
        maxWidth="md"
      >
        <form onSubmit={handleCreateRequest} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">
              Select Item from Your Held Stock *
            </label>
            {techHeldItems.length === 0 ? (
              <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs text-zinc-500">
                You currently have 0 units of stock registered in your hand. Stock must be issued to you before returning.
              </div>
            ) : (
              <select
                required
                value={newRequestData.itemId}
                onChange={(e) => setNewRequestData({ ...newRequestData, itemId: e.target.value })}
                className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
              >
                {techHeldItems.map((entry) => (
                  <option key={entry.item._id} value={entry.item._id}>
                    [{entry.item.itemCode}] {entry.item.itemName} — In Bag: {entry.quantity} {entry.item.unit}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Quantity to Return *</label>
            <input
              type="number"
              min="1"
              required
              value={newRequestData.quantity}
              onChange={(e) => setNewRequestData({ ...newRequestData, quantity: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Reason for Return *</label>
            <textarea
              rows={2}
              required
              placeholder="e.g. Job cancelled by customer; returning seal-intact sediment filter."
              value={newRequestData.reason}
              onChange={(e) => setNewRequestData({ ...newRequestData, reason: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setIsNewModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="submit-return-request-btn"
              type="submit"
              disabled={isProcessing || techHeldItems.length === 0}
              className="px-4 py-2 text-xs font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? 'Submitting...' : 'Submit Return Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Admin Reject Reason */}
      <Modal
        id="modal-reject-return"
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Reject Return Request"
        subtitle="Explain why this return cannot be accepted into warehouse"
        maxWidth="md"
      >
        <form onSubmit={handleRejectReturn} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-700 mb-1">Rejection Reason *</label>
            <textarea
              rows={3}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-zinc-50 border border-zinc-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-zinc-900"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-zinc-100">
            <button
              type="button"
              onClick={() => setRejectModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="confirm-reject-btn"
              type="submit"
              disabled={isProcessing}
              className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition disabled:opacity-50 cursor-pointer"
            >
              Confirm Rejection
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
