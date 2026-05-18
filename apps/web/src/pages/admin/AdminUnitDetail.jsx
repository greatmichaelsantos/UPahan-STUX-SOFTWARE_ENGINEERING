import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { Edit2, UserPlus, FileText, CreditCard, Upload, CheckCircle, XCircle, UserMinus, AlertTriangle } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import StatusBadge from '../../components/StatusBadge';
import AssignTenantModal from '../../components/AssignTenantModal';
import EditUnitModal from '../../components/EditUnitModal';
import UploadContractModal from '../../components/UploadContractModal';
import api from '../../utils/api';
import { formatPeso, formatDate } from '../../utils/format';

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function AdminUnitDetail() {
  const { id } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [unit, setUnit]         = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [modal, setModal]       = useState(null); // null | 'assign' | 'edit' | 'contract' | 'remove'
  const [documents, setDocuments] = useState([]);
  const [rejectingDoc, setRejectingDoc] = useState(null); // document_id
  const [rejectReason, setRejectReason] = useState('');
  const [docActionLoading, setDocActionLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [removing, setRemoving]       = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const load = async () => {
    try {
      const [uRes, pRes] = await Promise.all([api.get(`/units/${id}`), api.get(`/payments?unitId=${id}`)]);
      setUnit(uRes.data.data);
      setPayments(pRes.data.data?.slice(0, 5) || []);
    } catch { navigate('/admin/units'); }
    finally { setLoading(false); }
  };

  const loadDocuments = useCallback(() => {
    api.get(`/documents/unit/${id}`).then(r => setDocuments(r.data.data || [])).catch(() => {});
  }, [id]);

  const handleDeleteUnit = async () => {
    try {
      await api.delete(`/units/${id}`);
      setShowDeleteModal(false);
      navigate('/admin/units');
    } catch (err) {
      alert('Failed to delete unit.');
    }
  };

  useEffect(() => { load(); loadDocuments(); }, [id, location.key]);

  if (loading) return (
    <AdminLayout title="Unit Detail">
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '4px solid #E8F5F3', borderTopColor: '#2E7D72', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    </AdminLayout>
  );
  if (!unit) return null;

  return (
    <AdminLayout title="Unit Detail">
      {/* Back */}
      <div style={{ padding: '16px 20px 0' }}>
        <button
          onClick={() => navigate('/admin/units')}
          style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#2E7D72', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back to Units
        </button>
      </div>

      {/* Header */}
      <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ background: '#2E7D72', color: 'white', fontFamily: 'Inter', fontWeight: 700, fontSize: 14, padding: '4px 12px', borderRadius: 8, letterSpacing: '0.04em' }}>
              {unit.unit_code}
            </span>
            <StatusBadge status={unit.vacancy_status} />
          </div>
          <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#888888' }}>{unit.floor_plan || 'Unit Details'}</p>
        </div>
        <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 22, color: '#4A4A4A' }}>
          {formatPeso(unit.monthly_price)}
        </p>
      </div>

      <div style={{ padding: '14px 16px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Photos */}
        {unit.photos?.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {unit.photos.slice(0, 4).map((p, i) => (
              <img key={i} src={p} alt="" style={{ borderRadius: 10, objectFit: 'cover', width: '100%', height: i === 0 ? 160 : 110, gridColumn: i === 0 ? 'span 2' : 'span 1' }} />
            ))}
          </div>
        )}

        {/* Unit info */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['Location',    unit.location || '—'],
            ['Floor Plan',  unit.floor_plan || '—'],
            ['Bedrooms',    unit.bedrooms || '—'],
            ['Due Day',     `${ordinal(unit.due_day || 5)} of every month`],
            ['Monthly Rent', formatPeso(unit.monthly_price)],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 11, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: label === 'Monthly Rent' ? '#2E7D72' : '#4A4A4A' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* Tenant */}
        {unit.tenant_name ? (
          <>
            <div className="card">
              <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>CURRENT TENANT</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#E8F5F3', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 18, color: '#2E7D72' }}>{unit.tenant_name?.[0]}</span>
                </div>
                <div>
                  <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 15, color: '#4A4A4A' }}>{unit.tenant_name}</p>
                  <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#888888' }}>{unit.tenant_email}</p>
                  <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#888888', marginTop: 2 }}>
                    Lease: {formatDate(unit.lease_start_date, 'medium')} – {formatDate(unit.lease_end_date, 'medium')}
                  </p>
                </div>
              </div>
            </div>

            {/* Remove Tenant button */}
            <button
              onClick={() => { setRemoveError(''); setModal('remove'); }}
              style={{
                width: '100%', height: 44, borderRadius: 8, background: 'transparent',
                border: '1.5px solid #D64045', color: '#D64045',
                fontFamily: 'Inter', fontWeight: 600, fontSize: 13,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                cursor: 'pointer', transition: 'all 150ms ease',
              }}
              onMouseOver={e => { e.currentTarget.style.background = '#FEF2F2'; }}
              onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
            >
              <UserMinus size={15} aria-hidden="true" /> REMOVE TENANT
            </button>
          </>
        ) : (
          <button
            onClick={() => setModal('assign')}
            className="card"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              border: '2px dashed #F0EEEB', padding: 20, cursor: 'pointer',
              fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: '#888888', background: 'white',
              transition: 'all 150ms ease',
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = '#2E7D72'; e.currentTarget.style.color = '#2E7D72'; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = '#F0EEEB'; e.currentTarget.style.color = '#888888'; }}
          >
            <UserPlus size={18} aria-hidden="true" /> Assign Tenant
          </button>
        )}

        {/* Recent payments */}
        {payments.length > 0 && (
          <div className="card">
            <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>RECENT PAYMENTS</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {payments.map((p, idx) => (
                <div key={p.payment_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: idx < payments.length - 1 ? '1px solid #F0EEEB' : 'none' }}>
                  <div>
                    <p style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: '#4A4A4A' }}>{formatDate(p.payment_date, 'medium')}</p>
                    <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#888888', textTransform: 'capitalize', marginTop: 2 }}>{p.payment_type} payment</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: '#4A4A4A', marginBottom: 4 }}>{formatPeso(p.amount)}</p>
                    <StatusBadge status={p.payment_status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents section (only if tenant assigned) */}
        {unit.tenant_name && (() => {
          const idDoc = documents.find(d => d.document_type === 'valid_id');
          const contract = documents.find(d => d.document_type === 'contract');
          return (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em' }}>TENANT DOCUMENTS</p>
                {!contract && (
                  <button
                    onClick={() => setModal('contract')}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#2E7D72', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'Inter', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                  >
                    <Upload size={13} /> Upload Contract
                  </button>
                )}
              </div>

              {/* Valid ID */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <CreditCard size={16} color="#555" />
                  <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: '#4A4A4A' }}>Valid ID</span>
                  {idDoc && <StatusBadge status={idDoc.status === 'under_review' ? 'pending' : idDoc.status} />}
                </div>
                {idDoc ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                      <a href={`${import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:5000'}/uploads/documents/${idDoc.front_image}`} target="_blank" rel="noopener noreferrer">
                        <img src={`${import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:5000'}/uploads/documents/${idDoc.front_image}`} alt="Front" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #EEE' }} />
                      </a>
                      <a href={`${import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:5000'}/uploads/documents/${idDoc.back_image}`} target="_blank" rel="noopener noreferrer">
                        <img src={`${import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:5000'}/uploads/documents/${idDoc.back_image}`} alt="Back" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid #EEE' }} />
                      </a>
                    </div>
                    <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#888', marginBottom: 8 }}>
                      {idDoc.id_type} · Submitted {formatDate(idDoc.created_at, 'medium')}
                    </p>
                    {idDoc.status === 'under_review' && (
                      rejectingDoc === idDoc.document_id ? (
                        <div style={{ background: '#FEF2F2', borderRadius: 10, padding: 12 }}>
                          <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            placeholder="Enter rejection reason..."
                            rows={2}
                            style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #F5C6C6', borderRadius: 8, fontFamily: 'Inter', fontSize: 13, resize: 'none', boxSizing: 'border-box' }}
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button
                              disabled={docActionLoading}
                              onClick={async () => {
                                if (!rejectReason.trim()) return;
                                setDocActionLoading(true);
                                try {
                                  await api.put(`/documents/${idDoc.document_id}/reject`, { rejection_reason: rejectReason });
                                  showToast('ID rejected.');
                                  setRejectingDoc(null); setRejectReason('');
                                  loadDocuments();
                                } catch { showToast('Action failed.'); }
                                finally { setDocActionLoading(false); }
                              }}
                              style={{ flex: 1, padding: '8px', background: '#D64045', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'Inter', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                            >
                              Confirm Reject
                            </button>
                            <button onClick={() => { setRejectingDoc(null); setRejectReason(''); }}
                              style={{ padding: '8px 14px', background: '#EEE', border: 'none', borderRadius: 8, fontFamily: 'Inter', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            disabled={docActionLoading}
                            onClick={async () => {
                              setDocActionLoading(true);
                              try {
                                await api.put(`/documents/${idDoc.document_id}/verify`);
                                showToast('ID verified!');
                                loadDocuments();
                              } catch { showToast('Action failed.'); }
                              finally { setDocActionLoading(false); }
                            }}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: '#2E7D72', color: 'white', border: 'none', borderRadius: 8, fontFamily: 'Inter', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                          >
                            <CheckCircle size={14} /> Verify
                          </button>
                          <button
                            onClick={() => setRejectingDoc(idDoc.document_id)}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: '#FEF2F2', color: '#D64045', border: '1px solid #F5C6C6', borderRadius: 8, fontFamily: 'Inter', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        </div>
                      )
                    )}
                    {idDoc.status === 'verified' && (
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#2E7D72', fontWeight: 600 }}>✓ ID verified</p>
                    )}
                    {idDoc.status === 'rejected' && (
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#D64045' }}>Rejected: {idDoc.rejection_reason}</p>
                    )}
                  </div>
                ) : (
                  <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#AAAAAA' }}>No ID submitted yet</p>
                )}
              </div>

              <div style={{ height: 1, background: '#F0EEEB', margin: '4px 0 12px' }} />

              {/* Contract */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} color="#555" />
                <span style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: '#4A4A4A' }}>Lease Contract</span>
              </div>
              {contract ? (
                <div style={{ marginTop: 8 }}>
                  <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#888', marginBottom: 6 }}>
                    Uploaded {formatDate(contract.created_at, 'medium')}
                    {contract.contract_start_date && ` · ${formatDate(contract.contract_start_date, 'short')} – ${contract.contract_end_date ? formatDate(contract.contract_end_date, 'short') : 'ongoing'}`}
                  </p>
                  <a
                    href={`${import.meta.env.VITE_API_URL?.replace('/api','') || 'http://localhost:5000'}/uploads/documents/${contract.contract_file}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', background: '#F0F9F7', color: '#2E7D72', borderRadius: 8, fontFamily: 'Inter', fontWeight: 600, fontSize: 12, textDecoration: 'none' }}
                  >
                    <FileText size={13} /> View Contract
                  </a>
                </div>
              ) : (
                <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#AAAAAA', marginTop: 6 }}>No contract uploaded yet</p>
              )}
            </div>
          );
        })()}

        {/* Edit button */}
        <div style={{ marginTop: 4 }}>
          <button
            onClick={() => setModal('edit')}
            style={{
              width: '100%', height: 48, borderRadius: 8, background: 'transparent',
              border: '1px solid #F0EEEB', color: '#4A4A4A',
              fontFamily: 'Inter', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              cursor: 'pointer', transition: 'all 150ms ease',
            }}
            onMouseOver={e => e.currentTarget.style.background = '#F0EEEB'}
            onMouseOut={e => e.currentTarget.style.background = 'transparent'}
          >
            <Edit2 size={15} aria-hidden="true" /> EDIT UNIT
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            style={{
              width: '100%', height: 48, borderRadius: 8, background: 'transparent',
              border: '1.5px solid #D64045', color: '#D64045',
              fontFamily: 'Inter', fontWeight: 600, fontSize: 13,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              cursor: 'pointer', transition: 'all 150ms ease', marginTop: 12,
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#FEF2F2'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            🗑 Delete Unit
          </button>
        </div>
      </div>

      {/* Modals */}
      {modal === 'assign' && (
        <AssignTenantModal
          unit={unit}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); load(); }}
        />
      )}
      {modal === 'edit' && (
        <EditUnitModal
          unit={unit}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); load(); }}
        />
      )}
      {modal === 'contract' && (
        <UploadContractModal
          unit={unit}
          tenant={{ user_id: unit.tenant_user_id, first_name: unit.tenant_name?.split(' ')[0], last_name: unit.tenant_name?.split(' ').slice(1).join(' ') }}
          onClose={() => setModal(null)}
          onSuccess={() => { setModal(null); loadDocuments(); }}
        />
      )}

      {/* Remove Tenant modal */}
      {modal === 'remove' && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => { if (!removing) setModal(null); }}
          onKeyDown={e => { if (e.key === 'Escape' && !removing) setModal(null); }}
          tabIndex={-1}
        >
          <div
            style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 400, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{ background: '#D64045', padding: '18px 20px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <UserMinus size={20} color="white" aria-hidden="true" />
              <h2 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: 'white', margin: 0 }}>Remove Tenant</h2>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#FEF2F2', borderRadius: 10, padding: '12px 14px' }}>
                <AlertTriangle size={18} color="#D64045" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#4A4A4A', lineHeight: 1.6, margin: 0 }}>
                  Are you sure you want to remove <strong>{unit.tenant_name}</strong> from Unit <strong>{unit.unit_code}</strong>? The unit will be marked as vacant and any pending payment declarations will be cancelled.
                </p>
              </div>

              {removeError && (
                <div style={{ background: '#FDEEEE', border: '1px solid #D64045', borderRadius: 8, padding: '10px 14px', color: '#D64045', fontSize: 13, fontFamily: 'Inter' }}>
                  {removeError}
                </div>
              )}

              <button
                disabled={removing}
                onClick={async () => {
                  setRemoving(true);
                  setRemoveError('');
                  try {
                    await api.put(`/units/${id}/remove-tenant`);
                    setModal(null);
                    showToast(`${unit.tenant_name} has been removed from Unit ${unit.unit_code}.`);
                    load();
                  } catch (err) {
                    setRemoveError(err.response?.data?.message || 'Something went wrong. Please try again.');
                  } finally {
                    setRemoving(false);
                  }
                }}
                style={{
                  width: '100%', height: 48, borderRadius: 8,
                  background: removing ? '#E0A0A0' : '#D64045',
                  color: 'white', border: 'none',
                  fontFamily: 'Inter', fontWeight: 700, fontSize: 14,
                  cursor: removing ? 'not-allowed' : 'pointer',
                  transition: 'background 150ms',
                }}
              >
                {removing ? 'Removing...' : 'CONFIRM REMOVAL'}
              </button>

              <button
                disabled={removing}
                onClick={() => setModal(null)}
                style={{
                  width: '100%', height: 48, borderRadius: 8,
                  background: 'transparent', border: '1.5px solid #E0DDD8', color: '#888888',
                  fontFamily: 'Inter', fontWeight: 600, fontSize: 14,
                  cursor: removing ? 'not-allowed' : 'pointer', transition: 'all 150ms',
                }}
                onMouseOver={e => { if (!removing) e.currentTarget.style.background = '#F0EEEB'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Unit modal */}
      {showDeleteModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowDeleteModal(false)}
        >
          <div
            style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 384, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, fontSize: 24 }}>
              🗑
            </div>
            <h3 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 20, color: '#1A1A1A', marginBottom: 8 }}>Delete Unit?</h3>
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#888888', textAlign: 'center', marginBottom: 24, lineHeight: 1.5 }}>
              This will permanently delete this unit and cannot be undone.
            </p>
            <button
              onClick={handleDeleteUnit}
              style={{ width: '100%', height: 48, borderRadius: 10, background: '#D64045', color: 'white', border: 'none', fontFamily: 'Inter', fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}
            >
              DELETE UNIT
            </button>
            <button
              onClick={() => setShowDeleteModal(false)}
              style={{ width: '100%', height: 48, borderRadius: 10, background: '#F0EEEB', color: '#4A4A4A', border: 'none', fontFamily: 'Inter', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              CANCEL
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: '#2E7D72', color: 'white', padding: '10px 20px', borderRadius: 10,
          fontFamily: 'Inter', fontWeight: 600, fontSize: 13, zIndex: 100, boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        }}>
          {toast}
        </div>
      )}
    </AdminLayout>
  );
}
