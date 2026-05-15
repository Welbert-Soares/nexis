import { useState, useEffect } from 'react'
import { cn } from '#/lib/utils'

interface AvatarProps {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
}

function dicebearUrl(name: string) {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=3b82f6&fontFamily=Arial&fontSize=38`
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const [imgSrc, setImgSrc] = useState(src || dicebearUrl(name))

  useEffect(() => {
    setImgSrc(src || dicebearUrl(name))
  }, [src, name])

  return (
    <img
      src={imgSrc}
      alt={name}
      onError={() => setImgSrc(dicebearUrl(name))}
      className={cn('rounded-full object-cover', sizes[size], className)}
    />
  )
}
