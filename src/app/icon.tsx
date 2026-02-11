import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default async function Icon() {
  const iconData = await readFile(join(process.cwd(), 'public', 'dorothy-without-text.png'))
  const base64 = iconData.toString('base64')

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          overflow: 'hidden',
        }}
      >
        <img
          src={`data:image/png;base64,${base64}`}
          width={32}
          height={32}
          style={{ objectFit: 'cover' }}
        />
      </div>
    ),
    {
      ...size,
    }
  )
}
