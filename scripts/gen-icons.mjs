import { readFileSync } from 'fs'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dir, '..', 'public')

const svgLogo = readFileSync(join(publicDir, 'logo.svg'))

async function generate(svgBuffer, outPath, size) {
  // Cria fundo branco e compõe o SVG por cima
  const bg = await sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer()
  const logo = await sharp(svgBuffer).resize(size, size).png().toBuffer()
  await sharp(bg).composite([{ input: logo }]).png().toFile(outPath)
  console.log(`✓ ${outPath} (${size}x${size})`)
}

await generate(svgLogo, join(publicDir, 'icon-192.png'), 192)
await generate(svgLogo, join(publicDir, 'icon-512.png'), 512)
await generate(svgLogo, join(publicDir, 'icon.jpeg'),    512)
await generate(svgLogo, join(publicDir, 'apple-touch-icon.png'), 180)

// logo.png: fundo transparente para casar com qualquer cor de tela
await sharp(svgLogo).resize(800, 800).png().toFile(join(publicDir, 'logo.png'))
console.log(`✓ ${join(publicDir, 'logo.png')} (800x800 transparente)`)

console.log('\nTodos os ícones gerados com sucesso.')
