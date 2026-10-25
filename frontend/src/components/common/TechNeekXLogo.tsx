import React from 'react'
import './TechNeekXLogo.css'

export interface TechNeekXLogoProps {
  size?: number | string
  showText?: boolean
  subtitle?: string
  className?: string
  alt?: string
}

export const TechNeekXLogo: React.FC<TechNeekXLogoProps> = ({
  size = 32,
  showText = false,
  subtitle,
  className = '',
  alt = 'TechNeekX Logo'
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size

  return (
    <div className={`techneekx-logo-container ${className}`}>
      <img
        src="/tnxlogo.jpg"
        alt={alt}
        className="techneekx-logo-mark"
        style={{ width: pixelSize, height: pixelSize }}
        loading="eager"
      />
      {showText && (
        <div className="techneekx-logo-text-group">
          <span className="techneekx-logo-brand">TechNeekX</span>
          {subtitle && <span className="techneekx-logo-sub">{subtitle}</span>}
        </div>
      )}
    </div>
  )
}
