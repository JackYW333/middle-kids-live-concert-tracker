function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
    case g: h = ((b - r) / d + 2) / 6; break
    default: h = ((r - g) / d + 4) / 6
  }
  return [h, s, l]
}

function hslToHex(h, s, l) {
  const a = s * Math.min(l, 1 - l)
  const f = n => {
    const k = (n + h * 12) % 12
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)))
      .toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

// Loads an image onto a canvas and returns the dominant colour as a hex string.
// Skips near-black, near-white, and near-grey pixels, then boosts saturation
// slightly so the result looks vivid rather than washed out.
export function extractDominantColor(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const size = 64
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        canvas.getContext('2d').drawImage(img, 0, 0, size, size)
        const { data } = canvas.getContext('2d').getImageData(0, 0, size, size)
        let totalH = 0, totalS = 0, totalL = 0, count = 0
        for (let i = 0; i < data.length; i += 4) {
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2])
          if (l > 0.08 && l < 0.92 && s > 0.12) {
            totalH += h; totalS += s; totalL += l; count++
          }
        }
        if (count === 0) { reject(new Error('no colourful pixels')); return }
        const avgS = Math.min((totalS / count) * 1.4, 1)
        const avgL = Math.min(Math.max(totalL / count, 0.35), 0.58)
        resolve(hslToHex(totalH / count, avgS, avgL))
      } catch {
        reject(new Error('canvas read failed — likely a CORS restriction'))
      }
    }
    img.onerror = () => reject(new Error('image failed to load'))
    img.src = imageUrl
  })
}
