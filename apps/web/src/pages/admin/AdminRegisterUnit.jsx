import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Layers, MapPin, Camera, CheckCircle, BedDouble } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import SectionHeader from '../../components/SectionHeader';
import api from '../../utils/api';

const Label = ({ children }) => (
  <p style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 12, color: '#C9A84C', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
    {children}
  </p>
);

const inputStyle = {
  width: '100%', height: 52, borderRadius: 8, background: '#F0EEEB',
  border: '1.5px solid transparent', fontFamily: 'Inter', fontSize: 14, color: '#4A4A4A',
  paddingLeft: 44, outline: 'none', transition: 'all 150ms ease',
};

export default function AdminRegisterUnit() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ unitCode: '', monthlyPrice: '', vacancyStatus: 'vacant', floorPlan: '', location: '', description: '', bedrooms: '', dueDay: 5 });
  const [photos, setPhotos]   = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  const set = (f) => (e) => setForm(p => ({ ...p, [f]: e.target.value }));

  const handlePhotos = (e) => {
    const files = Array.from(e.target.files);
    setPhotos(files);
    setPreviews(files.map(f => URL.createObjectURL(f)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.unitCode || !form.monthlyPrice) { setError('Unit code and monthly price are required.'); return; }
    if (!form.bedrooms) { setError('Please select a bedroom count.'); return; }
    const parsedDueDay = parseInt(form.dueDay);
    if (isNaN(parsedDueDay) || parsedDueDay < 1 || parsedDueDay > 31) { setError('Payment due day must be between 1 and 31.'); return; }
    setLoading(true);
    try {
      const res = await api.post('/units', { ...form, dueDay: parsedDueDay });
      const unitId = res.data.data.unit_id;
      if (photos.length > 0) {
        const fd = new FormData();
        photos.forEach(p => fd.append('photos', p));
        await api.post(`/units/${unitId}/photos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setSuccess(true);
      setTimeout(() => navigate('/admin/units'), 1800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save unit.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <AdminLayout title="Add New Unit">
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#E8F5F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle size={40} color="#2E7D72" />
          </div>
          <h2 style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 24, color: '#4A4A4A' }}>Unit Saved!</h2>
          <p style={{ fontFamily: 'Inter', fontSize: 14, color: '#888888' }}>Redirecting to unit list...</p>
        </div>
      </AdminLayout>
    );
  }

  const iStyle = { ...inputStyle };
  const onFocus = (e) => { e.target.style.borderColor = '#2E7D72'; e.target.style.background = '#E8F5F3'; };
  const onBlur  = (e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = '#F0EEEB'; };

  return (
    <AdminLayout title="Add New Unit">
      <SectionHeader label="Inventory Intake" title="Register New Unit" onBack={() => navigate('/admin/units')} backLabel="Back to Units" />

      <form onSubmit={handleSubmit} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {error && (
          <div style={{ background: '#FDEEEE', border: '1px solid #D64045', borderRadius: 8, padding: '10px 14px', color: '#D64045', fontSize: 13, fontFamily: 'Inter' }}>
            {error}
          </div>
        )}

        {/* Unit info card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Code + Price side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>Unit Code</Label>
              <div style={{ position: 'relative' }}>
                <Home size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#888888' }} aria-hidden="true" />
                <input value={form.unitCode} onChange={set('unitCode')} placeholder="e.g., 4C"
                  style={{ ...iStyle, textTransform: 'uppercase' }} maxLength={5} onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>
            <div>
              <Label>Monthly Price</Label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#2E7D72', fontFamily: 'Inter', fontWeight: 700, fontSize: 15 }}>₱</span>
                <input type="number" value={form.monthlyPrice} onChange={set('monthlyPrice')} placeholder="15000"
                  style={{ ...iStyle, paddingLeft: 32 }} min="0" onFocus={onFocus} onBlur={onBlur} />
              </div>
            </div>
          </div>

          {/* Vacancy toggle */}
          <div>
            <Label>Current Vacancy</Label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[['vacant','VACANT','#C9A84C'],['occupied','OCCUPIED','#2E7D72']].map(([val, lbl, col]) => (
                <button
                  key={val} type="button"
                  onClick={() => setForm(f => ({ ...f, vacancyStatus: val }))}
                  style={{
                    flex: 1, height: 44, borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontFamily: 'Inter', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em',
                    background: form.vacancyStatus === val ? col : '#F0EEEB',
                    color: form.vacancyStatus === val ? 'white' : '#888888',
                    transition: 'all 150ms ease',
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          {/* Floor plan */}
          <div>
            <Label>Floor Plan / Type</Label>
            <div style={{ position: 'relative' }}>
              <Layers size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#888888' }} aria-hidden="true" />
              <input value={form.floorPlan} onChange={set('floorPlan')} placeholder="e.g., Studio, 24sqm Open Plan"
                style={iStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>

          {/* Bedrooms */}
          <div>
            <Label>Bedrooms *</Label>
            <div style={{ position: 'relative' }}>
              <BedDouble size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#888888', pointerEvents: 'none', zIndex: 1 }} aria-hidden="true" />
              <select
                value={form.bedrooms}
                onChange={set('bedrooms')}
                onFocus={onFocus} onBlur={onBlur}
                style={{ ...iStyle, appearance: 'none', paddingRight: 14, cursor: 'pointer' }}
              >
                <option value="">Select bedroom count...</option>
                <option value="Studio">Studio</option>
                <option value="1 Bedroom">1 Bedroom</option>
                <option value="2 Bedrooms">2 Bedrooms</option>
                <option value="3 Bedrooms">3 Bedrooms</option>
                <option value="4+ Bedrooms">4+ Bedrooms</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <Label>Location / City</Label>
            <div style={{ position: 'relative' }}>
              <MapPin size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#888888' }} aria-hidden="true" />
              <input value={form.location} onChange={set('location')} placeholder="e.g., Olongapo City, Zambales"
                style={iStyle} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>

          {/* Due Day */}
          <div>
            <Label>Payment Due Day (1–31)</Label>
            <div style={{ position: 'relative' }}>
              <input type="number" min="1" max="31" value={form.dueDay} onChange={set('dueDay')} placeholder="5"
                style={{ ...iStyle, paddingLeft: 14 }} onFocus={onFocus} onBlur={onBlur} />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <textarea value={form.description} onChange={set('description')} placeholder="Brief description of the unit..."
              rows={3}
              style={{ ...iStyle, height: 'auto', paddingTop: 12, paddingBottom: 12, paddingLeft: 14, resize: 'none' }}
              onFocus={onFocus} onBlur={onBlur}
            />
          </div>
        </div>

        {/* Photo upload */}
        <div className="card">
          <Label>Unit Photos</Label>
          <label style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
            border: '2px dashed #2E7D72', borderRadius: 12, padding: '24px 16px',
            background: '#E8F5F3', cursor: 'pointer',
          }}>
            <Camera size={28} color="#2E7D72" aria-hidden="true" />
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'Inter', fontWeight: 600, fontSize: 14, color: '#4A4A4A', marginBottom: 2 }}>Click to upload or drag & drop</p>
              <p style={{ fontFamily: 'Inter', fontSize: 12, color: '#888888' }}>JPG, PNG, WEBP up to 5MB each</p>
            </div>
            <input type="file" multiple accept="image/*" onChange={handlePhotos} className="hidden" />
          </label>
          {previews.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 12 }}>
              {previews.map((url, i) => (
                <img key={i} src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: 8 }} />
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit" disabled={loading}
          style={{
            height: 52, borderRadius: 8, background: loading ? '#888888' : '#2E7D72',
            color: 'white', border: 'none', width: '100%',
            fontFamily: 'Inter', fontWeight: 600, fontSize: 14,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
            transition: 'all 150ms ease',
          }}
          onMouseOver={e => { if (!loading) e.currentTarget.style.background = '#1F5C56'; }}
          onMouseOut={e => { if (!loading) e.currentTarget.style.background = '#2E7D72'; }}
        >
          {loading ? 'Saving...' : 'SAVE UNIT INFORMATION'}
        </button>
      </form>
    </AdminLayout>
  );
}
