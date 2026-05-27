import React, { useState, useEffect } from 'react';
import { BarChart2 } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import SectionHeader from '../../components/SectionHeader';
import EmptyState from '../../components/EmptyState';
import api from '../../utils/api';
import { formatPeso, formatDate } from '../../utils/format';

const TEAL = '#277571';
const GOLD = '#C9A84C';

const labelStyle = {
  fontFamily: 'Inter', fontWeight: 700, fontSize: 10,
  color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4,
};

const statCard = (label, value, accent) => (
  <div style={{
    flex: 1, background: accent ? TEAL : '#F0EEEB', borderRadius: 10,
    padding: '14px 16px', textAlign: 'center',
  }}>
    <p style={{ ...labelStyle, color: accent ? 'rgba(255,255,255,0.7)' : GOLD }}>{label}</p>
    <p style={{
      fontFamily: 'Inter', fontWeight: 800, fontSize: 22,
      color: accent ? '#fff' : '#4A4A4A',
    }}>{value}</p>
  </div>
);

function StatusPill({ status, isLate }) {
  const map = {
    verified:         { bg: '#E8F5F3', color: '#2E7D72', label: 'VERIFIED' },
    paid:             { bg: '#E8F5F3', color: '#2E7D72', label: 'VERIFIED' },
    partial:          { bg: '#EEF1FA', color: '#3A5BA0', label: 'PARTIAL' },
    pending_approval: { bg: '#FEF3EC', color: '#E07B39', label: 'PENDING' },
    not_verified:     { bg: '#FDEEEE', color: '#D64045', label: 'NOT VERIFIED' },
    rejected:         { bg: '#FDEEEE', color: '#D64045', label: 'NOT VERIFIED' },
    pending:          { bg: '#FEF3EC', color: '#E07B39', label: 'PENDING' },
    in_progress:      { bg: '#EEF1FA', color: '#3A5BA0', label: 'IN PROGRESS' },
    completed:        { bg: '#E8F5F3', color: '#2E7D72', label: 'COMPLETED' },
  };
  const cfg = map[status] || { bg: '#F0EEEB', color: '#888', label: status?.toUpperCase() || '—' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <span style={{
        background: cfg.bg, color: cfg.color,
        fontFamily: 'Inter', fontWeight: 700, fontSize: 10,
        borderRadius: 4, padding: '2px 7px', letterSpacing: '0.06em',
      }}>{cfg.label}</span>
      {isLate && (
        <span style={{
          background: '#FEF3EC', color: '#E07B39',
          fontFamily: 'Inter', fontWeight: 700, fontSize: 10,
          borderRadius: 4, padding: '2px 7px', letterSpacing: '0.06em',
        }}>LATE</span>
      )}
    </span>
  );
}

function TableHead({ cols }) {
  return (
    <thead>
      <tr>
        {cols.map(c => (
          <th key={c} style={{
            padding: '8px 12px', textAlign: 'left',
            fontFamily: 'Inter', fontWeight: 700, fontSize: 10,
            color: GOLD, textTransform: 'uppercase', letterSpacing: '0.08em',
            background: '#FAF8F5', borderBottom: '1px solid #E0DDD8',
          }}>{c}</th>
        ))}
      </tr>
    </thead>
  );
}

const printStyles = `
  @media print {
    aside, header, .no-print { display: none !important; }
    body { background: white; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

export default function AdminReports() {
  const today = new Date().toISOString().split('T')[0];
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString().split('T')[0];

  const [period, setPeriod]       = useState('monthly');
  const [startDate, setStartDate] = useState(monthStart);
  const [endDate, setEndDate]     = useState(today);
  const [report, setReport]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const handleDownload = () => window.print();

  const handleExportCSV = () => {
    if (!report) return;
    const rows = [
      ['Unit', 'Tenant', 'Amount', 'Month Covered', 'Status', 'Late'],
      ...report.payments.breakdown.map(p => [
        p.unit_code, p.tenant, p.amount, p.month_covered, p.status, p.is_late ? 'Yes' : 'No',
      ]),
    ];
    const csv = rows.map(r => r.map(v => `"${v ?? ''}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `upahan-report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fetchReport = async (p) => {
    setError('');
    setLoading(true);
    try {
      const params = p === 'custom'
        ? `period=custom&start_date=${startDate}&end_date=${endDate}`
        : `period=${p}`;
      const res = await api.get(`/reports/landlord?${params}`);
      setReport(res.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = () => fetchReport(period);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchReport('monthly');
    const interval = setInterval(() => fetchReport(period), 30000);
    return () => clearInterval(interval);
  }, []);

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <AdminLayout title="Reports">
      <style>{printStyles}</style>
      <SectionHeader label="Reports" title="Reports" />

      <div style={{ padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Period selector */}
        <div className="card no-print" style={{ padding: 16 }}>
          <p style={labelStyle}>Select Period</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: period === 'custom' ? 12 : 0 }}>
            {[
              { key: 'weekly',  label: 'This Week' },
              { key: 'monthly', label: 'This Month' },
              { key: 'custom',  label: 'Custom Range' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                style={{
                  padding: '9px 18px', borderRadius: 999, border: '1.5px solid',
                  borderColor: period === key ? TEAL : '#E0DDD8',
                  background: period === key ? TEAL : 'white',
                  color: period === key ? 'white' : '#4A4A4A',
                  fontFamily: 'Inter', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  transition: 'all 150ms',
                }}
              >{label}</button>
            ))}
          </div>
          {period === 'custom' && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
              <div>
                <p style={{ ...labelStyle, marginBottom: 4 }}>Start Date</p>
                <input type="date" value={startDate} max={endDate}
                  onChange={e => setStartDate(e.target.value)}
                  style={{
                    height: 40, borderRadius: 8, border: '1.5px solid #E0DDD8',
                    fontFamily: 'Inter', fontSize: 13, padding: '0 10px', outline: 'none',
                  }}
                />
              </div>
              <div>
                <p style={{ ...labelStyle, marginBottom: 4 }}>End Date</p>
                <input type="date" value={endDate} min={startDate} max={today}
                  onChange={e => setEndDate(e.target.value)}
                  style={{
                    height: 40, borderRadius: 8, border: '1.5px solid #E0DDD8',
                    fontFamily: 'Inter', fontSize: 13, padding: '0 10px', outline: 'none',
                  }}
                />
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 12 }}>
            <button
              onClick={handleGenerate} disabled={loading}
              style={{
                height: 44, borderRadius: 8, background: loading ? '#888' : TEAL,
                color: 'white', border: 'none', fontFamily: 'Inter', fontWeight: 700, fontSize: 14,
                padding: '0 28px', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1, transition: 'all 150ms',
              }}
            >{loading ? 'Generating…' : 'Generate Report'}</button>
            {report && (
              <>
                <button
                  onClick={handleDownload}
                  style={{
                    height: 44, borderRadius: 8, background: '#4A4A4A',
                    color: 'white', border: 'none', fontFamily: 'Inter', fontWeight: 700, fontSize: 13,
                    padding: '0 20px', cursor: 'pointer', transition: 'all 150ms',
                  }}
                >⬇ Download PDF</button>
                <button
                  onClick={handleExportCSV}
                  style={{
                    height: 44, borderRadius: 8, background: 'white',
                    color: TEAL, border: `1.5px solid ${TEAL}`, fontFamily: 'Inter', fontWeight: 700, fontSize: 13,
                    padding: '0 20px', cursor: 'pointer', transition: 'all 150ms',
                  }}
                >⬇ Export CSV</button>
              </>
            )}
          </div>
          {error && (
            <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#D64045', marginTop: 8 }}>{error}</p>
          )}
        </div>

        {!report && !loading && (
          <EmptyState icon={BarChart2} title="No Report Yet" message="Select a period and click Generate Report." />
        )}

        {report && (
          <>
            {/* Period header */}
            <div style={{ background: TEAL, borderRadius: 10, padding: '12px 16px' }}>
              <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 11, color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 2 }}>
                Report Period
              </p>
              <p style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 16, color: '#fff' }}>
                {fmtDate(report.period.start)} — {fmtDate(report.period.end)}
              </p>
            </div>

            {/* Unit Status */}
            <div className="card" style={{ padding: 16 }}>
              <p style={{ ...labelStyle, marginBottom: 12 }}>Unit Occupancy</p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                {statCard('Occupied', report.units.occupied, true)}
                {statCard('Vacant', report.units.vacant, false)}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {statCard('Total Units', report.units.total, false)}
                {statCard('Occupancy Rate', report.units.occupancy_rate, false)}
              </div>
            </div>

            {/* Payments */}
            <div className="card" style={{ padding: 16 }}>
              <p style={{ ...labelStyle, marginBottom: 8 }}>Payments</p>
              <p style={{ fontFamily: 'Inter', fontWeight: 800, fontSize: 28, color: TEAL, marginBottom: 12 }}>
                {formatPeso(report.payments.total_collected)}
              </p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {statCard('Transactions', report.payments.total_transactions, false)}
                {statCard('Late', report.payments.late_payments, false)}
                {statCard('Not Verified', report.payments.not_verified, false)}
              </div>
              {report.payments.breakdown.length === 0 ? (
                <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#888' }}>No payment data for the selected period.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <TableHead cols={['Unit', 'Tenant', 'Amount', 'Month Covered', 'Status']} />
                    <tbody>
                      {report.payments.breakdown.map((p, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F0EEEB' }}>
                          <td style={{ padding: '9px 12px', fontFamily: 'Inter', fontWeight: 600, color: '#4A4A4A' }}>{p.unit_code}</td>
                          <td style={{ padding: '9px 12px', fontFamily: 'Inter', color: '#4A4A4A' }}>{p.tenant}</td>
                          <td style={{ padding: '9px 12px', fontFamily: 'Inter', fontWeight: 700, color: TEAL }}>{formatPeso(p.amount)}</td>
                          <td style={{ padding: '9px 12px', fontFamily: 'Inter', color: '#4A4A4A' }}>{p.month_covered}</td>
                          <td style={{ padding: '9px 12px' }}><StatusPill status={p.status} isLate={p.is_late} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Maintenance */}
            <div className="card" style={{ padding: 16 }}>
              <p style={{ ...labelStyle, marginBottom: 12 }}>Maintenance</p>
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {statCard('Total', report.maintenance.total_requests, false)}
                {statCard('Resolved', report.maintenance.resolved, true)}
                {statCard('Pending', report.maintenance.pending, false)}
              </div>
              {report.maintenance.breakdown.length === 0 ? (
                <p style={{ fontFamily: 'Inter', fontSize: 13, color: '#888' }}>No maintenance data for the selected period.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <TableHead cols={['Unit', 'Tenant', 'Category', 'Status', 'Date']} />
                    <tbody>
                      {report.maintenance.breakdown.map((m, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #F0EEEB' }}>
                          <td style={{ padding: '9px 12px', fontFamily: 'Inter', fontWeight: 600, color: '#4A4A4A' }}>{m.unit_code}</td>
                          <td style={{ padding: '9px 12px', fontFamily: 'Inter', color: '#4A4A4A' }}>{m.tenant}</td>
                          <td style={{ padding: '9px 12px', fontFamily: 'Inter', color: '#4A4A4A', textTransform: 'capitalize' }}>{m.category}</td>
                          <td style={{ padding: '9px 12px' }}><StatusPill status={m.status} /></td>
                          <td style={{ padding: '9px 12px', fontFamily: 'Inter', color: '#888', fontSize: 12 }}>{fmtDate(m.date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
