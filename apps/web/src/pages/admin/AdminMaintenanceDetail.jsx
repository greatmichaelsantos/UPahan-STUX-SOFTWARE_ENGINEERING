import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { CheckCircle, User, MapPin, Clock, Calendar, UserCog, MessageSquare } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import StatusBadge from '../../components/StatusBadge';
import ImageLightbox from '../../components/ImageLightbox';
import api from '../../utils/api';
import { formatDateTime, timeAgo, categoryLabel } from '../../utils/format';

const InfoCard = ({ icon: Icon, iconColor, iconBg, label, value }) => (
  <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <div style={{ width: 40, height: 40, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={20} color={iconColor} aria-hidden="true" />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</p>
      <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: '#4A4A4A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
    </div>
  </div>
);

export default function AdminMaintenanceDetail() {
  const { id } = useParams();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [req, setReq]             = useState(null);
  const [loading, setLoading]     = useState(true);
  const [resolving, setResolving] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const load = async () => {
    try {
      const res = await api.get(`/maintenance/${id}`);
      setReq(res.data.data);
    } catch (e) { navigate('/admin/maintenance'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id, location.key]);

  const handleResolve = async () => {
    setResolving(true);
    try { await api.put(`/maintenance/${id}`, { status: 'completed' }); load(); }
    catch (e) { console.error(e); }
    finally { setResolving(false); }
  };

  const handleAssign = async () => {
    try { await api.put(`/maintenance/${id}`, { status: 'in_progress' }); load(); }
    catch (e) { console.error(e); }
  };

  if (loading) return (
    <AdminLayout title="Maintenance">
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, border: '4px solid #E8F5F3', borderTopColor: '#2E7D72', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    </AdminLayout>
  );
  if (!req) return null;

  return (
    <AdminLayout title="Maintenance">
      {/* Back link */}
      <div style={{ padding: '16px 20px 0' }}>
        <button
          onClick={() => navigate('/admin/maintenance')}
          style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#2E7D72', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
        >
          ← Back to List
        </button>
      </div>

      {/* Title row */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 26, color: '#4A4A4A', marginBottom: 4 }}>
            {req.subject}
          </h1>
          <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#888888' }}>{categoryLabel(req.issue_category)}</p>
        </div>
        <StatusBadge status={req.priority_level} />
      </div>

      <div style={{ padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Status + Time */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="card">
            <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>STATUS</p>
            <StatusBadge status={req.status} />
          </div>
          <div className="card">
            <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>TIME OPEN</p>
            <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: '#4A4A4A' }}>{timeAgo(req.report_date)}</p>
          </div>
        </div>

        {/* Resident + Area */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <InfoCard icon={User}   iconColor="#2E7D72" iconBg="#E8F5F3" label="Resident" value={req.tenant_name} />
          <InfoCard icon={MapPin} iconColor="#2E7D72" iconBg="#E8F5F3" label="Area"     value={`Unit ${req.unit_code}`} />
        </div>

        {/* Description */}
        {req.description && (
          <div className="card" style={{ background: '#FAF8F5' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <MessageSquare size={16} color="#C9A84C" aria-hidden="true" />
              <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Description</p>
            </div>
            <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#4A4A4A', lineHeight: 1.6 }}>{req.description}</p>
          </div>
        )}

        {/* Reported on */}
        <InfoCard icon={Calendar} iconColor="#2E7D72" iconBg="#E8F5F3" label="Reported On" value={formatDateTime(req.report_date)} />

        {/* Resolved on */}
        {req.resolved_date && (
          <InfoCard icon={CheckCircle} iconColor="#2E7D72" iconBg="#E8F5F3" label="Resolved On" value={formatDateTime(req.resolved_date)} />
        )}

        {/* Photos */}
        {req.photos?.length > 0 && (
          <div className="card">
            <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 10, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              PHOTO EVIDENCE
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {req.photos.map((photo, i) => (
                <img
                  key={i} src={photo} alt="Evidence"
                  onClick={() => setLightboxSrc(photo)}
                  style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8, background: '#F0EEEB', cursor: 'zoom-in' }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {req.status !== 'completed' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
            <button
              onClick={handleResolve} disabled={resolving}
              style={{
                height: 52, borderRadius: 8, background: resolving ? '#888888' : '#2E7D72',
                color: 'white', border: 'none', width: '100%',
                fontFamily: 'Inter', fontWeight: 600, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                cursor: resolving ? 'not-allowed' : 'pointer', opacity: resolving ? 0.6 : 1,
                transition: 'all 150ms ease',
              }}
              onMouseOver={e => { if (!resolving) e.currentTarget.style.background = '#1F5C56'; }}
              onMouseOut={e => { if (!resolving) e.currentTarget.style.background = '#2E7D72'; }}
            >
              <CheckCircle size={18} aria-hidden="true" />
              {resolving ? 'Updating...' : 'MARK AS RESOLVED'}
            </button>
            {req.status === 'pending' && (
              <button
                onClick={handleAssign}
                style={{
                  height: 52, borderRadius: 8, background: 'transparent',
                  color: '#888888', border: '1.5px solid #E0DDD8', width: '100%',
                  fontFamily: 'Inter', fontWeight: 600, fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  cursor: 'pointer', transition: 'all 150ms ease',
                }}
                onMouseOver={e => e.currentTarget.style.background = '#F0EEEB'}
                onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              >
                <UserCog size={18} aria-hidden="true" /> ASSIGN TO STAFF
              </button>
            )}
          </div>
        )}
      </div>

      <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />
    </AdminLayout>
  );
}
