import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Plus, CheckCircle, ChevronDown, AlertCircle, X } from 'lucide-react';
import TenantLayout from '../../components/TenantLayout';
import api from '../../utils/api';

const CATEGORIES = [
  { value: 'plumbing',   label: 'Plumbing',   sub: 'Tulo ng Tubig', emoji: '🚰' },
  { value: 'electrical', label: 'Electrical', sub: 'Kuryente',      emoji: '⚡' },
  { value: 'structural', label: 'Structural', sub: 'Sira sa Bahay', emoji: '🧱' },
  { value: 'others',     label: 'Others',     sub: 'Iba pa',        emoji: '🔧' },
];

const PRIORITIES = [
  { value: 'low',    label: 'Low',    color: '#888888' },
  { value: 'medium', label: 'Medium', color: '#E07B39' },
  { value: 'high',   label: 'High',   color: '#D64045' },
];

const Label = ({ children }) => (
  <p style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 12, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
    {children}
  </p>
);

const FieldError = ({ msg }) => msg ? (
  <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#D64045', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
    <AlertCircle size={13} /> {msg}
  </p>
) : null;

export default function TenantMaintenanceRequest() {
  const navigate = useNavigate();
  const [category, setCategory]       = useState('');
  const [subject, setSubject]         = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority]       = useState('');
  const [photos, setPhotos]           = useState([]);
  const [previews, setPreviews]       = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [dropOpen, setDropOpen]       = useState(false);
  const [loading, setLoading]         = useState(false);
  const [success, setSuccess]         = useState(false);
  const [submitError, setSubmitError] = useState('');
  const fileInputRef = useRef(null);

  const MAX_PHOTOS = 5;
  const MIN_PHOTOS = 3;

  const clearError = (key) => setFieldErrors(prev => ({ ...prev, [key]: undefined }));

  const handlePhoto = (e) => {
    const incoming = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!incoming.length) return;
    clearError('photos');
    setPhotos(prev => {
      const combined = [...prev, ...incoming].slice(0, MAX_PHOTOS);
      setPreviews(combined.map(f => URL.createObjectURL(f)));
      return combined;
    });
  };

  const removePhoto = (idx) => {
    setPhotos(prev => {
      const next = prev.filter((_, i) => i !== idx);
      setPreviews(next.map(f => URL.createObjectURL(f)));
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const errors = {};
    if (!category)          errors.category    = 'Please select an issue category.';
    if (!subject.trim())    errors.subject     = 'Please enter a subject.';
    if (!description.trim()) errors.description = 'Please describe the issue.';
    if (!priority)          errors.priority    = 'Please select a priority level.';
    if (photos.length < MIN_PHOTOS) errors.photos = 'Please attach at least 3 photos.';
    if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
    setFieldErrors({});
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('issueCategory', category);
      fd.append('subject', subject.trim());
      fd.append('description', description.trim());
      fd.append('priorityLevel', priority);
      photos.forEach(f => fd.append('maintenance_images', f));
      await api.post('/maintenance', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setSuccess(true);
      setTimeout(() => navigate('/tenant/maintenance'), 1800);
    } catch (err) {
      setSubmitError(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setLoading(false);
    }
  };

  const selected = CATEGORIES.find(c => c.value === category);

  if (success) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FAF8F5', gap: 16 }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#EBF4FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CheckCircle size={40} color="#4A90D9" />
        </div>
        <h2 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 24, color: '#4A4A4A' }}>Request Submitted!</h2>
        <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#888888' }}>We'll notify you when it's addressed.</p>
      </div>
    );
  }

  const inputStyle = {
    width: '100%', height: 52, borderRadius: 8, background: '#F0EEEB',
    border: '1.5px solid transparent', fontFamily: 'Inter', fontSize: 14, color: '#4A4A4A',
    paddingLeft: 14, paddingRight: 14, outline: 'none', transition: 'all 150ms ease', boxSizing: 'border-box',
  };
  const onFocus = (e) => { e.target.style.borderColor = '#3A7BD5'; e.target.style.background = '#EBF2FC'; };
  const onBlur  = (e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = '#F0EEEB'; };

  return (
    <TenantLayout title="New Request">
    <div style={{ minHeight: '100vh', background: '#FAF8F5' }}>
      <div className="md:hidden" style={{ background: 'white', padding: '16px 20px 16px', borderBottom: '1px solid #F0EEEB' }}>
        <button
          onClick={() => navigate('/tenant/maintenance')}
          style={{ fontFamily: 'Inter', fontWeight: 500, fontSize: 13, color: '#3A7BD5', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}
        >
          ← Back
        </button>
        <h1 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 26, color: '#4A4A4A' }}>New Request</h1>
        <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#888888', marginTop: 4 }}>Report a maintenance issue in your unit</p>
      </div>

      <form onSubmit={handleSubmit} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {submitError && (
          <div style={{ background: '#FDEEEE', border: '1px solid #D64045', borderRadius: 8, padding: '10px 14px', color: '#D64045', fontSize: 13, fontFamily: 'Inter', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={15} /> {submitError}
          </div>
        )}

        {/* Category */}
        <div className="card">
          <Label>Issue Category *</Label>
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setDropOpen(!dropOpen)}
              style={{
                width: '100%', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 14px', borderRadius: 8,
                background: fieldErrors.category ? '#FDEEEE' : '#F0EEEB',
                border: `1.5px solid ${fieldErrors.category ? '#D64045' : dropOpen ? '#3A7BD5' : 'transparent'}`,
                cursor: 'pointer', fontFamily: 'Inter', fontSize: 14, transition: 'all 150ms',
              }}
              aria-expanded={dropOpen} aria-haspopup="listbox"
            >
              <span style={{ color: selected ? '#4A4A4A' : '#888888' }}>
                {selected ? `${selected.emoji} ${selected.label} (${selected.sub})` : 'Select a category...'}
              </span>
              <ChevronDown size={16} color="#888888" style={{ transform: dropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }} aria-hidden="true" />
            </button>

            {dropOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', borderRadius: 8, boxShadow: '0 4px 20px rgba(46,125,114,0.15)', marginTop: 4, zIndex: 10, overflow: 'hidden' }} role="listbox">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.value} type="button" role="option" aria-selected={category === cat.value}
                    onClick={() => { setCategory(cat.value); setDropOpen(false); clearError('category'); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 14px', cursor: 'pointer', textAlign: 'left',
                      background: category === cat.value ? '#EBF2FC' : 'white',
                      border: 'none', borderBottom: '1px solid #F0EEEB', transition: 'background 100ms',
                    }}
                    onMouseOver={e => { if (category !== cat.value) e.currentTarget.style.background = '#FAF8F5'; }}
                    onMouseOut={e => { if (category !== cat.value) e.currentTarget.style.background = 'white'; }}
                  >
                    <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                    <div>
                      <p style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: category === cat.value ? '#3A7BD5' : '#4A4A4A', marginBottom: 2 }}>{cat.label}</p>
                      <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#888888' }}>{cat.sub}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <FieldError msg={fieldErrors.category} />
        </div>

        {/* Subject + Description */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <Label>Subject *</Label>
            <div style={{ position: 'relative' }}>
              <AlertCircle size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#888888' }} aria-hidden="true" />
              <input
                type="text" value={subject}
                onChange={e => { setSubject(e.target.value); clearError('subject'); }}
                placeholder="Ex. Sira ang Gripo" maxLength={150}
                style={{
                  ...inputStyle, paddingLeft: 42,
                  border: fieldErrors.subject ? '1.5px solid #D64045' : '1.5px solid transparent',
                  background: fieldErrors.subject ? '#FDEEEE' : '#F0EEEB',
                }}
                onFocus={onFocus} onBlur={onBlur}
              />
            </div>
            <FieldError msg={fieldErrors.subject} />
          </div>

          <div>
            <Label>Description *</Label>
            <textarea
              value={description}
              onChange={e => { setDescription(e.target.value); clearError('description'); }}
              placeholder="Describe the issue in detail..."
              rows={3}
              style={{
                ...inputStyle, height: 'auto', paddingTop: 12, paddingBottom: 12, resize: 'none',
                border: fieldErrors.description ? '1.5px solid #D64045' : '1.5px solid transparent',
                background: fieldErrors.description ? '#FDEEEE' : '#F0EEEB',
              }}
              onFocus={onFocus} onBlur={onBlur}
            />
            <FieldError msg={fieldErrors.description} />
          </div>

          <div>
            <Label>Priority *</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {PRIORITIES.map(p => {
                const active = priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => { setPriority(p.value); clearError('priority'); }}
                    style={{
                      flex: 1, height: 44, borderRadius: 8, cursor: 'pointer',
                      border: `1.5px solid ${active ? p.color : '#E0DDD8'}`,
                      background: active ? p.color : '#FAF8F5',
                      color: active ? '#fff' : '#4A4A4A',
                      fontFamily: 'Inter', fontWeight: 600, fontSize: 13,
                      transition: 'all 150ms',
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <FieldError msg={fieldErrors.priority} />
          </div>
        </div>

        {/* Photo upload */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <Label>Photos * (3–5 required)</Label>
            {photos.length > 0 && (
              <span style={{ fontFamily: 'Inter', fontSize: 11, fontWeight: 700, color: photos.length >= MIN_PHOTOS ? '#3A7BD5' : '#D64045' }}>
                {photos.length}/{MAX_PHOTOS}
              </span>
            )}
          </div>

          {previews.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 8, paddingBottom: 4 }}>
              {previews.map((src, idx) => (
                <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                  <img src={src} alt={`Photo ${idx + 1}`} style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 8, border: '1px solid #E0DDD8' }} />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    style={{ position: 'absolute', top: -6, right: -6, background: '#D64045', border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                    aria-label={`Remove photo ${idx + 1}`}
                  >
                    <X size={12} color="#fff" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {photos.length < MAX_PHOTOS && (
            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
              border: `2px dashed ${fieldErrors.photos ? '#D64045' : '#3A7BD5'}`,
              borderRadius: 10, padding: '20px 16px',
              background: fieldErrors.photos ? '#FDEEEE' : '#EBF2FC',
              cursor: 'pointer',
            }}>
              <Camera size={28} color={fieldErrors.photos ? '#D64045' : '#3A7BD5'} aria-hidden="true" />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: fieldErrors.photos ? '#D64045' : '#4A4A4A', marginBottom: 2 }}>
                  {photos.length === 0 ? 'Click to add photos' : 'Add more photos'}
                </p>
                <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#888888' }}>Minimum 3 required · JPG, PNG up to 5MB</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhoto} className="hidden" />
            </label>
          )}

          <FieldError msg={fieldErrors.photos} />
        </div>

        <button
          type="submit" disabled={loading}
          style={{
            height: 52, borderRadius: 8, background: loading ? '#888888' : '#3A7BD5',
            color: 'white', border: 'none', width: '100%',
            fontFamily: 'Inter', fontWeight: 600, fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            transition: 'all 150ms ease',
          }}
          onMouseOver={e => { if (!loading) e.currentTarget.style.background = '#2f6abf'; }}
          onMouseOut={e => { if (!loading) e.currentTarget.style.background = '#3A7BD5'; }}
        >
          <Plus size={18} aria-hidden="true" />
          {loading ? 'Submitting...' : 'SUBMIT REQUEST'}
        </button>
      </form>

    </div>
    </TenantLayout>
  );
}
