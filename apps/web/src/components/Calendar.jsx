import React, { useState } from 'react';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function Calendar({ color = '#4A90D9', hoverBg }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const cells = [];

  // Empty leading cells
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`e-${i}`} />);
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday =
      d === today.getDate() &&
      month === today.getMonth() &&
      year === today.getFullYear();

    cells.push(
      <div
        key={d}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: 30,
          borderRadius: '50%',
          background: isToday ? color : 'transparent',
          color: isToday ? '#fff' : '#4A4A4A',
          fontFamily: 'Inter',
          fontWeight: isToday ? 700 : 400,
          fontSize: 13,
          cursor: 'default',
          userSelect: 'none',
        }}
      >
        {d}
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Month header with prev/next */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button
          onClick={prevMonth}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, color: '#888', fontSize: 16, lineHeight: 1 }}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span style={{ fontFamily: 'Inter', fontWeight: 700, fontSize: 14, color: color }}>
          {monthName}
        </span>
        <button
          onClick={nextMonth}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 6, color: '#888', fontSize: 16, lineHeight: 1 }}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAY_LABELS.map(d => (
          <div
            key={d}
            style={{ textAlign: 'center', fontFamily: 'Inter', fontSize: 11, color: '#AAAAAA', fontWeight: 600, padding: '2px 0' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells}
      </div>
    </div>
  );
}
