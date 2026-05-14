import { createFileRoute, useRouter } from '@tanstack/react-router'
import { signIn } from '#/lib/auth-client'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()

  async function handleGoogleSignIn() {
    await signIn.social({
      provider: 'google',
      callbackURL: '/dashboard',
    })
    await router.invalidate()
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-zinc-950">
      {/* Hero com vídeo */}
      <div className="relative flex-1 overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="h-full w-full object-cover"
        >
          <source src="/nexis-video.mp4" type="video/mp4" />
          <source src="/nexis-video.webm" type="video/webm" />
        </video>
        {/* Gradiente de fade para o fundo */}
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/30 via-transparent to-zinc-950" />
      </div>

      {/* Conteúdo inferior */}
      <div className="flex flex-col items-center gap-6 px-6 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-2">
        {/* Logo + subtítulo */}
        <div className="flex flex-col items-center gap-2">
          <img
            src="/nexis-logo-texto.webp"
            alt="Nexis"
            className="w-40 object-contain drop-shadow-lg"
          />
          <p className="text-sm text-zinc-400">Seu sistema financeiro pessoal</p>
        </div>

        {/* Botão */}
        <button
          onClick={handleGoogleSignIn}
          className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3.5 text-sm font-medium text-white transition-colors active:bg-zinc-800"
        >
          <GoogleIcon />
          Entrar com Google
        </button>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  )
}
