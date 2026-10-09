import * as T from 'three'

// Deterministic canvas textures work offline and need no licensed image assets.
export function surfaceTexture(kind: 'wood' | 'stone') {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const ctx = canvas.getContext('2d')!
  let seed = 431
  const random = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296
  ctx.fillStyle = kind === 'wood' ? '#ddc69f' : '#e8e3d8'
  ctx.fillRect(0, 0, 512, 512)
  if (kind === 'wood') {
    for (let row = 0; row < 260; row++) {
      const y = random() * 512,
        wave = random() * 3 + 1
      ctx.strokeStyle = `rgba(131, 98, 56, ${random() * 0.14 + 0.05})`
      ctx.lineWidth = random() * 1.6 + 0.3
      ctx.beginPath()
      for (let x = 0; x <= 512; x += 8) {
        const offset = Math.sin((x / 512) * Math.PI * 4 + row) * wave
        if (x === 0) ctx.moveTo(x, y + offset)
        else ctx.lineTo(x, y + offset)
      }
      ctx.stroke()
    }
  } else {
    for (let n = 0; n < 9000; n++) {
      ctx.fillStyle = `rgba(123, 114, 94, ${random() * 0.045})`
      ctx.fillRect(random() * 512, random() * 512, 1.5, 1.5)
    }
    ctx.strokeStyle = '#cdc7ba'
    ctx.lineWidth = 2
    ctx.strokeRect(0, 0, 512, 512)
  }
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  texture.wrapS = texture.wrapT = T.RepeatWrapping
  texture.repeat.set(kind === 'wood' ? 1 : 10, kind === 'wood' ? 1 : 7)
  texture.anisotropy = 4
  return texture
}
