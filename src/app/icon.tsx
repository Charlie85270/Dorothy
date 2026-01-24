import { ImageResponse } from 'next/og'

export const size = {
  width: 32,
  height: 32,
}

export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        }}
      >
        {/* Bot head */}
        <div
          style={{
            width: 24,
            height: 24,
            background: 'white',
            borderRadius: 6,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
          }}
        >
          {/* Antenna */}
          <div
            style={{
              position: 'absolute',
              top: -4,
              width: 2,
              height: 4,
              background: 'white',
              display: 'flex',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: -6,
              width: 4,
              height: 4,
              background: 'white',
              borderRadius: '50%',
              display: 'flex',
            }}
          />

          {/* Eyes */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              marginTop: 4,
            }}
          >
            <div
              style={{
                width: 5,
                height: 5,
                background: '#667eea',
                borderRadius: '50%',
                display: 'flex',
              }}
            />
            <div
              style={{
                width: 5,
                height: 5,
                background: '#667eea',
                borderRadius: '50%',
                display: 'flex',
              }}
            />
          </div>

          {/* Smile */}
          <div
            style={{
              width: 10,
              height: 5,
              borderBottom: '2px solid #667eea',
              borderLeft: '2px solid #667eea',
              borderRight: '2px solid #667eea',
              borderRadius: '0 0 8px 8px',
              marginTop: 2,
              display: 'flex',
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
