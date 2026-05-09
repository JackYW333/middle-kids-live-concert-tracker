import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import Breadcrumb from '../components/Breadcrumb.jsx'
import membersConfig from '../../config/members.json'

function isInPeriod(date, periods) {
  return periods.some(p => {
    const from = p.from
    const to = p.to || '9999-12-31'
    return date >= from && date <= to
  })
}

export default function MembersPage({ data }) {
  const { loading, error, setlists } = data

  const memberStats = useMemo(() => {
    const sorted = [...setlists].sort((a, b) => a.date.localeCompare(b.date))

    const stats = membersConfig.members.map(member => {
      const shows = sorted.filter(show => isInPeriod(show.date, member.periods))
      const isCurrent = member.periods.some(p => p.to === null)
      const isTouring = member.role.toLowerCase().includes('touring')
      const earliest = member.periods.reduce((min, p) => p.from < min ? p.from : min, member.periods[0].from)
      return {
        ...member,
        showCount: shows.length,
        firstShow: shows[0] || null,
        lastShow: shows[shows.length - 1] || null,
        isCurrent,
        isTouring,
        earliest,
      }
    })

    return stats.sort((a, b) => {
      const rank = m => m.isTouring ? 2 : m.isCurrent ? 0 : 1
      if (rank(a) !== rank(b)) return rank(a) - rank(b)
      return a.earliest.localeCompare(b.earliest)
    })
  }, [setlists])

  const formatPeriods = (periods) => {
    const fromYear = periods.reduce((min, p) => p.from < min ? p.from : min, periods[0].from).slice(0, 4)
    const isCurrent = periods.some(p => p.to === null)
    const toYear = isCurrent ? 'present' : periods.reduce((max, p) => p.to > max ? p.to : max, periods[0].to ?? periods[0].from).slice(0, 4)
    return `${fromYear} – ${toYear}`
  }

  if (loading) return <div className="loading">Loading…</div>
  if (error) return <div className="loading">Error: {error}</div>

  return (
    <div className="page-container">
      <Breadcrumb items={[{ label: 'Overview', to: '/' }, { label: 'Members' }]} />
      <div className="page-heading">
        <h1>Band Members</h1>
        <p className="sub">Show counts calculated from membership date ranges</p>
      </div>

      {[
        { label: 'Current Members', filter: m => !m.isTouring && m.isCurrent },
        { label: 'Former Members', filter: m => !m.isTouring && !m.isCurrent },
        { label: 'Touring Members', filter: m => m.isTouring },
      ].map(({ label, filter }) => {
        const group = memberStats.filter(filter)
        if (!group.length) return null
        return (
          <div key={label} className="section">
            <div className="section-title">{label}</div>
            <div className="member-grid">
              {group.map(member => (
          <Link key={member.id} to={`/member/${member.id}`} className="member-card" style={{ display: 'block', textDecoration: 'none' }}
            onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
            onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
          >
            <div
              style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'var(--bg-hover)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 0.75rem',
                fontSize: '1.25rem', color: 'var(--text-muted)', fontWeight: 700,
              }}
            >
              {member.name.charAt(0)}
            </div>
            <div className="member-card__name">{member.name}</div>
            <div className="member-card__role">{member.role}</div>
            <div className="member-card__shows">{member.showCount.toLocaleString()}</div>
            <div className="member-card__shows-label">shows</div>
            <div className="member-card__period">{formatPeriods(member.periods)}</div>
          </Link>
              ))}
            </div>
          </div>
        )
      })}

    </div>
  )
}
