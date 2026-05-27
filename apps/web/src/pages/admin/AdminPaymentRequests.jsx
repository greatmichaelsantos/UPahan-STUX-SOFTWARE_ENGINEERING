import React, { useEffect, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckCircle, XCircle, Receipt, ExternalLink } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import SectionHeader from '../../components/SectionHeader';
import EmptyState from '../../components/EmptyState';
import ImageLightbox from '../../components/ImageLightbox';
import api from '../../utils/api';
import { formatPeso, formatDate } from '../../utils/format';

// Confirmation overlay
const Overlay = ({ children }) => (
  <div style={{
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
  }}>
    <div style={{
      background: 'white', borderRadius: 16, width: '100%', maxWidth: 420,
      boxShadow: '0 8px 40px rgba(0,0,0,0.18)', padding: 24,
    }}>
      {children}
    </div>
  </div>
);

const API_URL = import.meta.env.VITE_API_URL || '';

export default function AdminPaymentRequests() {
  const location = useLocation();
  const [declarations, setDeclarations] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [approveTarget, setApproveTarget] = useState(null);  // { payment, confirm }
  const [rejectTarget, setRejectTarget]   = useState(null);  // { payment }
  const [rejectReason, setRejectReason]   = useState('');
  const [customReason, setCustomReason]   = useState('');
  const [rejectError, setRejectError]     = useState('');
  const [processing, setProcessing]       = useState(false);
  const [toast, setToast]                 = useState('');
  const [lightboxSrc, setLightboxSrc]     = useState(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const r = await api.get('/payments');
      const all = r.data.data || [];
      const pending = all.filter(p =>
        (p.payment_status || p.status) === 'pending' ||
        (p.payment_status || p.status) === 'pending_approval'
      );
      setDeclarations(pending);
    } catch (err) {
      console.error('Failed to load payment declarations:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(false);
    const interval = setInterval(() => load(true), 30000);
    return () => clearInterval(interval);
  }, [load, location.key]);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const handleApprove = async () => {
    if (!approveTarget) return;
    setProcessing(true);
    try {
      await api.put(`/payments/${approveTarget.payment_id}/approve`);
      setApproveTarget(null);
      await load();
      showToast('Payment verified and recorded.');
    } catch (err) {
      setApproveTarget(null);
      showToast(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setProcessing(false);
    }
  };

  const REJECTION_REASONS = [
    'Proof of payment is unclear or unreadable',
    'Wrong payment amount',
    'Duplicate submission',
    'Invalid or missing reference number',
    'Payment not reflected in records',
    'Wrong month covered',
    'Other',
  ];

  const handleReject = async () => {
    if (!rejectTarget) return;
    const finalReason = rejectReason === 'Other' ? customReason.trim() : rejectReason;
    if (!finalReason) {
      setRejectError(rejectReason === 'Other' ? 'Please describe the reason.' : 'Please select a rejection reason.');
      return;
    }
    setProcessing(true);
    try {
      await api.put(`/payments/${rejectTarget.payment_id}/reject`, { rejectionReason: finalReason });
      setRejectTarget(null);
      setRejectReason('');
      setCustomReason('');
      setRejectError('');
      await load();
      showToast('Payment declaration rejected.');
    } catch (err) {
      setRejectError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
    <AdminLayout title="Payments">
      <SectionHeader label="Finance" title="Payment Requests" />

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="card" style={{ height: 140, background: '#F0EEEB', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : declarations.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No Pending Requests"
            message="All payment declarations have been reviewed."
          />
        ) : (
          declarations.map(d => (
            <div key={d.payment_id} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {/* Gold top bar */}
              <div style={{ height: 4, background: '#E07B39' }} />
              <div style={{ padding: '16px' }}>

                {/* Tenant + unit row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#E8F5F3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 16, color: '#2E7D72' }}>
                        {d.tenant_name?.[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: '#4A4A4A' }}>{d.tenant_name}</p>
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#888888' }}>Unit {d.unit_code}</p>
                      {d.is_late && (
                        <span style={{
                          display: 'inline-block', background: '#FEF3EC', color: '#E07B39',
                          fontFamily: 'Inter', fontWeight: 700, fontSize: 10,
                          borderRadius: 4, padding: '2px 7px', letterSpacing: '0.06em', marginTop: 3,
                        }}>
                          LATE
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: '#2E7D72' }}>
                      {formatPeso(d.amount)}
                    </p>
                    <p style={{ fontFamily: 'Inter', fontSize: 11, color: '#888888' }}>
                      of {formatPeso(d.monthly_price)} monthly
                    </p>
                  </div>
                </div>

                {/* Details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  {[
                    ['Method', d.payment_method],
                    ['Payment Date', formatDate(d.payment_date, 'medium')],
                    ['Reference', d.reference_number || '—'],
                    ['Submitted', formatDate(d.created_at, 'medium')],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p style={{ fontFamily: 'Inter', fontSize: 10, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{label}</p>
                      <p style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: '#4A4A4A' }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Proof of payment */}
                {(() => {
                  const proofs = d.proof_images?.length > 0
                    ? d.proof_images
                    : d.proof_of_payment ? [d.proof_of_payment] : [];
                  if (proofs.length === 0) return null;
                  return (
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontFamily: 'Inter', fontSize: 10, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                        PROOF OF PAYMENT {proofs.length > 1 ? `(${proofs.length})` : ''}
                      </p>
                      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
                        {proofs.map((src, idx) => {
                          const fullSrc = src.startsWith('http') ? src : `${API_URL}${src}`;
                          return src.endsWith('.pdf') ? (
                            <a key={idx} href={fullSrc} target="_blank" rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: '#3A7BD5', textDecoration: 'none', flexShrink: 0 }}>
                              <ExternalLink size={14} /> PDF {proofs.length > 1 ? idx + 1 : 'Receipt'}
                            </a>
                          ) : (
                            <img key={idx} src={fullSrc} alt={`Proof ${idx + 1}`}
                              onClick={() => setLightboxSrc(fullSrc)}
                              style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, cursor: 'zoom-in', border: '1px solid #E0DDD8', flexShrink: 0 }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Notes */}
                {d.notes && (
                  <div style={{ background: '#FAF8F5', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
                    <p style={{ fontFamily: 'Inter', fontSize: 10, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>TENANT NOTES</p>
                    <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#4A4A4A', lineHeight: 1.5 }}>{d.notes}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button
                    onClick={() => setApproveTarget(d)}
                    style={{
                      height: 44, borderRadius: 8, background: '#2E7D72', color: 'white',
                      border: 'none', fontFamily: 'Inter', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'background 150ms',
                    }}
                    onMouseOver={e => e.currentTarget.style.background = '#1F5C56'}
                    onMouseOut={e => e.currentTarget.style.background = '#2E7D72'}
                  >
                    <CheckCircle size={15} /> APPROVE
                  </button>
                  <button
                    onClick={() => { setRejectTarget(d); setRejectReason(''); setCustomReason(''); setRejectError(''); }}
                    style={{
                      height: 44, borderRadius: 8, background: 'transparent', color: '#D64045',
                      border: '1.5px solid #D64045', fontFamily: 'Inter', fontWeight: 700, fontSize: 13,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      transition: 'all 150ms',
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = '#FDEEEE'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <XCircle size={15} /> REJECT
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Approve confirmation */}
      {approveTarget && (
        <Overlay>
          <h3 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: '#4A4A4A', marginBottom: 8 }}>
            Approve Payment?
          </h3>
          <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#4A4A4A', lineHeight: 1.6, marginBottom: 20 }}>
            Approve this payment of{' '}
            <strong>{formatPeso(approveTarget.amount)}</strong> from{' '}
            <strong>{approveTarget.tenant_name}</strong>?
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleApprove} disabled={processing}
              style={{
                flex: 1, height: 48, borderRadius: 8, background: processing ? '#888888' : '#2E7D72',
                color: 'white', border: 'none', fontFamily: 'Inter', fontWeight: 700, fontSize: 14,
                cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.7 : 1,
              }}
            >
              {processing ? 'Approving...' : 'CONFIRM'}
            </button>
            <button
              onClick={() => setApproveTarget(null)} disabled={processing}
              style={{
                flex: 1, height: 48, borderRadius: 8, background: '#F0EEEB',
                color: '#4A4A4A', border: 'none', fontFamily: 'Inter', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              CANCEL
            </button>
          </div>
        </Overlay>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <Overlay>
          <h3 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: '#4A4A4A', marginBottom: 8 }}>
            Reject Payment
          </h3>
          <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#888888', marginBottom: 14 }}>
            Provide a reason so <strong>{rejectTarget.tenant_name}</strong> is informed.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, maxHeight: 280, overflowY: 'auto' }}>
            {REJECTION_REASONS.map(reason => {
              const active = rejectReason === reason;
              return (
                <button
                  key={reason}
                  type="button"
                  onClick={() => { setRejectReason(reason); setCustomReason(''); if (rejectError) setRejectError(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8,
                    border: `1.5px solid ${active ? '#D64045' : '#E0DDD8'}`,
                    background: active ? '#FFF5F5' : '#FAF8F5',
                    cursor: 'pointer', textAlign: 'left', width: '100%',
                    transition: 'all 150ms',
                  }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
                    border: `2px solid ${active ? '#D64045' : '#C0B8B0'}`,
                    background: active ? '#D64045' : 'white',
                    display: 'inline-block',
                  }} />
                  <span style={{ fontFamily: 'Inter', fontSize: 13, color: '#4A4A4A' }}>{reason}</span>
                </button>
              );
            })}
          </div>
          {rejectReason === 'Other' && (
            <textarea
              value={customReason}
              onChange={e => { setCustomReason(e.target.value); if (rejectError) setRejectError(''); }}
              rows={3}
              placeholder="Describe the reason..."
              style={{
                width: '100%', borderRadius: 8, background: '#F0EEEB', border: '1.5px solid transparent',
                fontFamily: 'Inter', fontSize: 14, color: '#4A4A4A', padding: '10px 12px', outline: 'none',
                resize: 'none', transition: 'all 150ms ease', marginBottom: 10, boxSizing: 'border-box',
              }}
              onFocus={e => { e.target.style.borderColor = '#D64045'; e.target.style.background = '#FDEEEE'; }}
              onBlur={e => { e.target.style.borderColor = 'transparent'; e.target.style.background = '#F0EEEB'; }}
            />
          )}
          {rejectError && (
            <p style={{ color: '#D64045', fontSize: 12, fontFamily: 'Inter', marginBottom: 10, marginTop: -4 }}>
              {rejectError}
            </p>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleReject} disabled={processing}
              style={{
                flex: 1, height: 48, borderRadius: 8, background: processing ? '#888888' : '#D64045',
                color: 'white', border: 'none', fontFamily: 'Inter', fontWeight: 700, fontSize: 14,
                cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.7 : 1,
              }}
            >
              {processing ? 'Rejecting...' : 'CONFIRM REJECTION'}
            </button>
            <button
              onClick={() => { setRejectTarget(null); setRejectReason(''); setCustomReason(''); setRejectError(''); }} disabled={processing}
              style={{
                flex: 1, height: 48, borderRadius: 8, background: '#F0EEEB',
                color: '#4A4A4A', border: 'none', fontFamily: 'Inter', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              CANCEL
            </button>
          </div>
        </Overlay>
      )}

      {/* Success toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)',
          background: '#2E7D72', color: 'white', borderRadius: 8, padding: '10px 20px',
          fontFamily: 'Inter', fontWeight: 600, fontSize: 13,
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 300, whiteSpace: 'nowrap',
        }}>
          {toast}
        </div>
      )}

    </AdminLayout>
    <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
  </>
  );
}
