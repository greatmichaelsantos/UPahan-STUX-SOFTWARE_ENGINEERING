import React, { useState, useEffect, useCallback } from 'react';
import { X, Camera, AlertTriangle, BedDouble, UserMinus } from 'lucide-react';
import api from '../utils/api';

const OVERLAY = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
  zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
};
const MODAL = {
  background: 'white', borderRadius: 16, width: '100%', maxWidth: 500,
  boxShadow: '0 8px 40px rgba(0,0,0,0.18)', maxHeight: '92vh', overflowY: 'auto',
};

const labelStyle = {
  display: 'block', fontFamily: 'Inter', fontWeight: 600, fontSize: 11,
  color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5,
};
const baseInput = {
  width: '100%', height: 44, borderRadius: 8, background: '#F0EEEB',
  border: '1.5px solid transparent', fontFamily: 'Inter', fontSize: 14,
  color: '#4A4A4A', padding: '0 12px', outline: 'none', transition: 'all 150ms ease',
};
const onFocus = (e) => { e.target.style.borderColor = '#2E7D72'; e.target.style.background = '#E8F5F3'; };
const onBlur  = (e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = '#F0EEEB'; };

function friendlyEditError(msg) {
  if (!msg) return 'Something went wrong. Please try again.';
  const lower = msg.toLowerCase();
  if (lower.includes('unit code already exists') || lower.includes('unique') || lower.includes('duplicate')) {
    return `Unit code already exists. Please use a different code.`;
  }
  return 'Something went wrong. Please try again.';
}

export default function EditUnitModal({ unit, onClose, onSuccess }) {
  const [form, setForm] = useState({
    unitCode:      unit?.unit_code      || '',
    monthlyPrice:  unit?.monthly_price  || '',
    vacancyStatus: unit?.vacancy_status || 'vacant',
    floorPlan:     unit?.floor_plan     || '',
    location:      unit?.location       || '',
    description:   unit?.description    || '',
    bedrooms:      unit?.bedrooms       || '',
    dueDay:        unit?.due_day        || 5,
  });
  const [newPhotos, setNewPhotos]     = useState([]);
  const [previews, setPreviews]       = useState([]);
  const [submitting, setSubmitting]   = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [removing, setRemoving]       = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');

  // Close on Escape
  const handleKey = useCallback((e) => { if (e.key === 'Escape') onClose(); }, [onClose]);
  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [handleKey]);

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files);
    setNewPhotos(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.unitCode.trim()) { setError('Unit code is required.'); return; }
    if (!form.monthlyPrice)    { setError('Monthly price is required.'); return; }
    const parsedDueDay = parseInt(form.dueDay);
    if (isNaN(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31) { setError('Must be between 1 and 31.'); return; }

    setSubmitting(true);
    try {
      await api.put(`/units/${unit.unit_id}`, {
        unitCode:      form.unitCode.trim().toUpperCase(),
        monthlyPrice:  parseFloat(form.monthlyPrice),
        vacancyStatus: form.vacancyStatus,
        floorPlan:     form.floorPlan  || null,
        location:      form.location   || null,
        description:   form.description || null,
        bedrooms:      form.bedrooms   || null,
        dueDay:        parsedDueDay,
      });

      // Upload new photos if any
      if (newPhotos.length > 0) {
        const fd = new FormData();
        newPhotos.forEach(p => fd.append('photos', p));
        await api.post(`/units/${unit.unit_id}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      setSuccess(`Unit ${form.unitCode.toUpperCase()} has been updated successfully.`);
      setTimeout(() => onSuccess(), 1500);
    } catch (err) {
      setError(friendlyEditError(err.response?.data?.message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={OVERLAY} onClick={onClose} role="dialog" aria-modal="true" aria-label="Edit Unit">
      <div style={MODAL} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: '#2E7D72', borderRadius: '16px 16px 0 0', padding: '20px 20px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 22, color: 'white' }}>
              Edit Unit {unit?.unit_code}
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white' }} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {error && (
            <div style={{ background: '#FDEEEE', border: '1px solid #D64045', borderRadius: 8, padding: '10px 14px', color: '#D64045', fontSize: 13, fontFamily: 'Inter' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#E8F5F3', border: '1px solid #2E7D72', borderRadius: 8, padding: '10px 14px', color: '#2E7D72', fontSize: 13, fontFamily: 'Inter', fontWeight: 600 }}>
              {success}
            </div>
          )}

          {/* Code + Price */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Unit Code</label>
              <input value={form.unitCode} onChange={set('unitCode')} maxLength={5}
                style={{ ...baseInput, textTransform: 'uppercase' }} onFocus={onFocus} onBlur={onBlur} />
            </div>
            <div>
              <label style={labelStyle}>Monthly Price</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontFamily: 'Inter', fontWeight: 700, color: '#2E7D72', fontSize: 15 }}>₱</span>
                <input type="number" value={form.monthlyPrice} onChange={set('monthlyPrice')} min="0"
                  style={{ ...baseInput, paddingLeft: 26 }} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>
          </div>

          {/* Vacancy toggle */}
          <div>
            <label style={labelStyle}>Vacancy Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['vacant','VACANT','#C9A84C'],['occupied','OCCUPIED','#2E7D72']].map(([val, lbl, col]) => (
                <button key={val} type="button"
                  onClick={() => setForm(f => ({ ...f, vacancyStatus: val }))}
                  style={{
                    flex: 1, height: 40, borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontFamily: 'Inter', fontWeight: 700, fontSize: 12, letterSpacing: '0.04em',
                    background: form.vacancyStatus === val ? col : '#F0EEEB',
                    color: form.vacancyStatus === val ? 'white' : '#888888',
                    transition: 'all 150ms ease',
                  }}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Floor plan */}
          <div>
            <label style={labelStyle}>Floor Plan / Type</label>
            <input value={form.floorPlan} onChange={set('floorPlan')}
              placeholder="e.g., Studio, 24sqm Open Plan"
              style={baseInput} onFocus={onFocus} onBlur={onBlur} />
          </div>

          {/* Bedrooms */}
          <div>
            <label style={labelStyle}>Bedrooms</label>
            <select value={form.bedrooms} onChange={set('bedrooms')}
              style={{ ...baseInput, appearance: 'none', cursor: 'pointer' }}
              onFocus={onFocus} onBlur={onBlur}>
              <option value="">Select bedroom count...</option>
              <option value="Studio">Studio</option>
              <option value="1 Bedroom">1 Bedroom</option>
              <option value="2 Bedrooms">2 Bedrooms</option>
              <option value="3 Bedrooms">3 Bedrooms</option>
              <option value="4+ Bedrooms">4+ Bedrooms</option>
            </select>
          </div>

          {/* Location */}
          <div>
            <label style={labelStyle}>Location / City</label>
            <input value={form.location} onChange={set('location')}
              placeholder="e.g., Olongapo City, Zambales"
              style={baseInput} onFocus={onFocus} onBlur={onBlur} />
          </div>

          {/* Due Day */}
          <div>
            <label style={labelStyle}>Payment Due Day (1–31)</label>
            <input type="number" min="1" max="31" value={form.dueDay} onChange={set('dueDay')}
              placeholder="5" style={baseInput} onFocus={onFocus} onBlur={onBlur} />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={form.description} onChange={set('description')}
              placeholder="Brief description of the unit..." rows={3}
              style={{ ...baseInput, height: 'auto', paddingTop: 10, paddingBottom: 10, resize: 'none' }}
              onFocus={onFocus} onBlur={onBlur}
            />
          </div>

          {/* Existing photos */}
          {unit?.photos?.filter(Boolean).length > 0 && (
            <div>
              <label style={labelStyle}>Current Photos</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
                {unit.photos.filter(Boolean).map((p, i) => (
                  <img key={i} src={p} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6 }} />
                ))}
              </div>
            </div>
          )}

          {/* Upload new photos */}
          <div>
            <label style={labelStyle}>Add More Photos</label>
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: '2px dashed #2E7D72', borderRadius: 10, padding: '16px', background: '#E8F5F3', cursor: 'pointer' }}>
              <Camera size={22} color="#2E7D72" aria-hidden="true" />
              <span style={{ fontFamily: 'Inter', fontSize: 13, color: '#4A4A4A' }}>Click to upload photos</span>
              <input type="file" multiple accept="image/*" onChange={handlePhotos} className="hidden" />
            </label>
            {previews.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6, marginTop: 8 }}>
                {previews.map((p, i) => <img key={i} src={p} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 6 }} />)}
              </div>
            )}
          </div>

          {/* Save / Cancel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
            <button type="submit" disabled={submitting || !!success}
              style={{
                height: 52, borderRadius: 8, background: (submitting || success) ? '#888888' : '#2E7D72',
                color: 'white', border: 'none', width: '100%',
                fontFamily: 'Inter', fontWeight: 600, fontSize: 14,
                cursor: (submitting || success) ? 'not-allowed' : 'pointer',
                opacity: (submitting || success) ? 0.7 : 1, transition: 'all 150ms ease',
              }}
              onMouseOver={e => { if (!submitting && !success) e.currentTarget.style.background = '#1F5C56'; }}
              onMouseOut={e => { if (!submitting && !success) e.currentTarget.style.background = '#2E7D72'; }}
            >
              {submitting ? 'Saving...' : 'SAVE CHANGES'}
            </button>
            <button type="button" onClick={onClose} disabled={submitting}
              style={{
                height: 52, borderRadius: 8, background: 'transparent',
                color: '#888888', border: '1.5px solid #E0DDD8', width: '100%',
                fontFamily: 'Inter', fontWeight: 600, fontSize: 14,
                cursor: submitting ? 'not-allowed' : 'pointer', transition: 'all 150ms ease',
              }}
              onMouseOver={e => { if (!submitting) e.currentTarget.style.background = '#F0EEEB'; }}
              onMouseOut={e => { if (!submitting) e.currentTarget.style.background = 'transparent'; }}
            >
              CANCEL
            </button>
          </div>

          {/* Remove Tenant section — only shown when unit is occupied */}
          {unit?.vacancy_status === 'occupied' && (
            <div style={{ borderTop: '1px solid #F0EEEB', paddingTop: 14, marginTop: 4 }}>
              {!confirmRemove ? (
                <button type="button" onClick={() => { setError(''); setConfirmRemove(true); }}
                  style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 13, color: '#D64045', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, width: '100%', justifyContent: 'center' }}>
                  <UserMinus size={14} /> Remove Tenant
                </button>
              ) : (
                <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <AlertTriangle size={18} color="#D64045" style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#4A4A4A', lineHeight: 1.5, margin: 0 }}>
                      Remove the current tenant from Unit <strong>{unit?.unit_code}</strong>? The unit will be marked as vacant.
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" disabled={removing}
                      onClick={async () => {
                        setRemoving(true);
                        setError('');
                        try {
                          await api.put(`/units/${unit.unit_id}/remove-tenant`);
                          setConfirmRemove(false);
                          setSuccess('Tenant removed. Unit is now vacant.');
                          setTimeout(() => onSuccess(), 1500);
                        } catch (err) {
                          setError(err.response?.data?.message || 'Something went wrong. Please try again.');
                          setConfirmRemove(false);
                        } finally {
                          setRemoving(false);
                        }
                      }}
                      style={{ flex: 1, height: 40, borderRadius: 8, background: '#D64045', color: 'white', border: 'none', fontFamily: 'Inter', fontWeight: 700, fontSize: 13, cursor: removing ? 'not-allowed' : 'pointer', opacity: removing ? 0.6 : 1 }}>
                      {removing ? 'Removing...' : 'CONFIRM REMOVAL'}
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(false)} disabled={removing}
                      style={{ flex: 1, height: 40, borderRadius: 8, background: '#E0DDD8', color: '#4A4A4A', border: 'none', fontFamily: 'Inter', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                      GO BACK
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </form>
      </div>
    </div>
  );
}
