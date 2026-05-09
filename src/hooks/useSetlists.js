import { useState, useEffect, useMemo } from 'react'
import { annotateSongDebutDates, computeAlbumCoverage } from '../utils/stats.js'
import { extractDominantColor } from '../utils/colorExtract.js'
import excludedShows from '../../config/excluded-shows.json'
import albumData from '../../config/albums.json'

const excludedIds = new Set(excludedShows.map(s => s.id))

export function useSetlists() {
  const [state, setState] = useState({ loading: true, error: null, setlists: [], lastUpdated: null, totalWithSetlist: null })
  const [colorOverrides, setColorOverrides] = useState({})

  useEffect(() => {
    const base = import.meta.env.BASE_URL || '/'
    const url = `${base}data/setlists.json`.replace('//', '/')

    fetch(url)
      .then(r => {
        if (!r.ok) throw new Error(`Failed to load data (${r.status})`)
        return r.json()
      })
      .then(data => {
        const setlists = (data.setlists || []).filter(s => !excludedIds.has(s.id))
        setState({ loading: false, error: null, setlists, lastUpdated: data.lastUpdated, totalWithSetlist: data.totalWithSetlist != null ? data.totalWithSetlist - excludedIds.size : null })
      })
      .catch(err => setState({ loading: false, error: err.message, setlists: [], lastUpdated: null, totalWithSetlist: null }))
  }, [])

  useEffect(() => {
    albumData.forEach(album => {
      const imgUrl = album.imageUrl || (album.mbid
        ? `https://coverartarchive.org/release-group/${album.mbid}/front`
        : null)
      if (!imgUrl) return
      extractDominantColor(imgUrl)
        .then(color => setColorOverrides(prev => ({ ...prev, [album.id]: color })))
        .catch(() => {})
    })
  }, [])

  const debutMap = useMemo(() => state.setlists.length ? annotateSongDebutDates(state.setlists) : {}, [state.setlists])

  const albumCoverage = useMemo(() => {
    const coverage = state.setlists.length ? computeAlbumCoverage(state.setlists) : []
    return coverage.map(a => ({ ...a, color: colorOverrides[a.id] ?? a.color }))
  }, [state.setlists, colorOverrides])

  return { ...state, debutMap, albumCoverage }
}
