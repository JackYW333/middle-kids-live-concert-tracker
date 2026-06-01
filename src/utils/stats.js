import albumData from '../../config/albums.json'

// Build a flat song → release lookup, preferring album > ep > single > compilation > unreleased
const TYPE_PRIORITY = { album: 0, ep: 1, single: 2, compilation: 3, unreleased: 4, unknown: 5 }

// Normalize curly/smart apostrophes to straight apostrophe for reliable matching
// against setlist.fm data which uses U+2019 curly quotes
function normalizeTitle(s) {
  return s.replace(/[‘’‛]/g, "'").toLowerCase()
}

const songAlbumMap = {};
[...albumData]
  .sort((a, b) => (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99))
  .forEach(album => {
    album.songs.forEach(song => {
      const key = normalizeTitle(song)
      if (!(key in songAlbumMap)) songAlbumMap[key] = album
    })
  })

export function getAlbum(songName) {
  return songAlbumMap[normalizeTitle(songName)] || null
}

export function luminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

export function computeSongStats(setlists) {
  const map = {}
  setlists.forEach(show => {
    show.songs.forEach(song => {
      if (song.tape) return
      const key = song.name
      if (!map[key]) map[key] = { name: song.name, count: 0, dates: [], album: getAlbum(song.name) }
      map[key].count++
      map[key].dates.push(show.date)
    })
  })
  return Object.values(map).sort((a, b) => b.count - a.count)
}

export function computeShowsPerYear(setlists) {
  const map = {}
  setlists.forEach(show => {
    const year = show.date.slice(0, 4)
    map[year] = (map[year] || 0) + 1
  })
  return Object.entries(map)
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year.localeCompare(b.year))
}

export function computeCountryStats(setlists) {
  const map = {}
  setlists.forEach(show => {
    const key = show.country
    if (!map[key]) map[key] = { name: show.country, code: show.countryCode, count: 0 }
    map[key].count++
  })
  return Object.values(map).sort((a, b) => b.count - a.count)
}

export function computeCityStats(setlists) {
  const map = {}
  setlists.forEach(show => {
    const key = `${show.city}||${show.country}`
    if (!map[key]) map[key] = { city: show.city, country: show.country, countryCode: show.countryCode, count: 0 }
    map[key].count++
  })
  return Object.values(map).sort((a, b) => b.count - a.count)
}

export function computeVenueStats(setlists) {
  const map = {}
  setlists.forEach(show => {
    const key = `${show.venue}||${show.city}`
    if (!map[key]) map[key] = { venue: show.venue, city: show.city, country: show.country, countryCode: show.countryCode, count: 0 }
    map[key].count++
  })
  return Object.values(map).sort((a, b) => b.count - a.count)
}

export function computeTourStats(setlists) {
  const map = {}
  setlists.forEach(show => {
    const tourName = show.tour || 'Unknown / Standalone'
    if (!map[tourName]) {
      map[tourName] = { name: tourName, count: 1, from: show.date, to: show.date }
    } else {
      map[tourName].count++
      if (show.date < map[tourName].from) map[tourName].from = show.date
      if (show.date > map[tourName].to) map[tourName].to = show.date
    }
  })
  return Object.values(map).sort((a, b) => b.from.localeCompare(a.from))
}

export function computeAlbumCoverage(setlists) {
  // Count every performance of each song (not unique songs)
  let totalPlays = 0
  const playsByAlbum = {}
  albumData.forEach(a => { playsByAlbum[a.id] = 0 })

  setlists.forEach(show => {
    show.songs.forEach(song => {
      if (song.tape) return
      totalPlays++
      const album = getAlbum(song.name)
      if (album) playsByAlbum[album.id] = (playsByAlbum[album.id] || 0) + 1
    })
  })

  return albumData.map(album => {
    const plays = playsByAlbum[album.id] || 0
    return {
      id: album.id,
      name: album.name,
      year: album.year,
      color: album.color,
      plays,
      pct: totalPlays ? Math.round((plays / totalPlays) * 100) : 0,
    }
  }).sort((a, b) => b.plays - a.plays)
}

export function computeOpeners(setlists) {
  return computePositionStat(setlists, show => {
    const live = show.songs.filter(s => !s.tape && s.encore === 0)
    return live[0]?.name
  })
}

export function computeClosers(setlists) {
  return computePositionStat(setlists, show => {
    const allLive = show.songs.filter(s => !s.tape)
    return allLive[allLive.length - 1]?.name
  })
}

function computePositionStat(setlists, picker) {
  const map = {}
  setlists.forEach(show => {
    const name = picker(show)
    if (!name) return
    map[name] = (map[name] || 0) + 1
  })
  return Object.entries(map)
    .map(([name, count]) => ({ name, count, album: getAlbum(name) }))
    .sort((a, b) => b.count - a.count)
}

// Returns sorted shows with debut info attached to each song
export function annotateSongDebutDates(setlists) {
  const sortedShows = [...setlists].sort((a, b) => a.date.localeCompare(b.date))
  const firstSeen = {}
  sortedShows.forEach(show => {
    show.songs.forEach(song => {
      if (song.tape) return
      if (!firstSeen[song.name]) firstSeen[song.name] = show.date
    })
  })
  return firstSeen
}

export function getDebutsForShow(show, debutMap) {
  return show.songs.filter(s => !s.tape && debutMap[s.name] === show.date).map(s => s.name)
}

function daysBetween(dateA, dateB) {
  return Math.round((new Date(dateB) - new Date(dateA)) / 86400000)
}

export function findLongestGap(sortedDates) {
  let longestGap = 0, longestGapFrom = null, longestGapTo = null
  for (let i = 1; i < sortedDates.length; i++) {
    const gap = daysBetween(sortedDates[i - 1], sortedDates[i])
    if (gap > longestGap) {
      longestGap = gap
      longestGapFrom = sortedDates[i - 1]
      longestGapTo = sortedDates[i]
    }
  }
  return { longestGap, longestGapFrom, longestGapTo }
}

export function computeSongGaps(allSetlists, songName) {
  const plays = allSetlists
    .filter(s => s.songs.some(song => !song.tape && song.name === songName))
    .map(s => s.date)
    .sort()

  if (plays.length === 0) return null

  const { longestGap, longestGapFrom, longestGapTo } = findLongestGap(plays)

  // Current gap: shows since last play (in the full sorted setlist)
  const sorted = [...allSetlists].sort((a, b) => a.date.localeCompare(b.date))
  const lastPlayDate = plays[plays.length - 1]
  const showsSinceLast = sorted.filter(s => s.date > lastPlayDate).length
  const daysSinceLast = daysBetween(lastPlayDate, new Date().toISOString().slice(0, 10))

  return {
    lastPlayDate,
    showsSinceLast,
    daysSinceLast,
    longestGap,
    longestGapFrom,
    longestGapTo,
  }
}

export function countShowsWithSetlist(setlists) {
  return setlists.filter(s => s.songs.some(song => !song.tape)).length
}

export function countUniqueSongs(setlists) {
  const seen = new Set()
  setlists.forEach(show => show.songs.forEach(s => { if (!s.tape) seen.add(s.name) }))
  return seen.size
}

export function computeSetLengthByYear(setlists) {
  const byYear = {}
  setlists.forEach(show => {
    const year = show.date.slice(0, 4)
    const count = show.songs.filter(s => !s.tape).length
    if (!count) return
    if (!byYear[year]) byYear[year] = { total: 0, shows: 0 }
    byYear[year].total += count
    byYear[year].shows++
  })
  return Object.entries(byYear)
    .map(([year, { total, shows }]) => ({ year, avg: Math.round((total / shows) * 10) / 10 }))
    .sort((a, b) => a.year.localeCompare(b.year))
}

export function computeEncoreStats(setlists) {
  let showsWithEncore = 0
  const encoreSongs = {}

  setlists.forEach(show => {
    const hasEncore = show.songs.some(s => !s.tape && s.encore > 0)
    if (hasEncore) showsWithEncore++
    show.songs.forEach(s => {
      if (s.tape || s.encore === 0) return
      encoreSongs[s.name] = (encoreSongs[s.name] || 0) + 1
    })
  })

  return {
    showsWithEncore,
    encorePct: setlists.length ? Math.round((showsWithEncore / setlists.length) * 100) : 0,
    topEncoreSongs: Object.entries(encoreSongs)
      .map(([name, count]) => ({ name, count, album: getAlbum(name) }))
      .sort((a, b) => b.count - a.count),
  }
}

export function sortKey(name) {
  return name.replace(/^[^a-zA-Z0-9]+/, '')
}

export function formatDate(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

