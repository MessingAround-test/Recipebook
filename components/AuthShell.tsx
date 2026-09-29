import { ReactNode } from 'react'
import Head from 'next/head'
import Link from 'next/link'

interface AuthShellProps {
    title: string
    subtitle: string
    children: ReactNode
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
    return (
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-12 text-foreground">
            <Head>
                <title>{`${title} | Bryns Garbage`}</title>
                <link rel="icon" href="/avo.ico" />
            </Head>

            {/* Ambient emerald glow */}
            <div
                aria-hidden
                className="pointer-events-none absolute -top-48 left-1/2 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[130px]"
            />
            <div
                aria-hidden
                className="pointer-events-none absolute -bottom-32 -right-16 h-80 w-80 rounded-full bg-emerald-500/[0.07] blur-[120px]"
            />

            <main className="relative w-full max-w-md">
                <header className="mb-8 text-center">
                    <Link
                        href="/"
                        className="text-xl font-black uppercase tracking-[0.18em] text-foreground transition-opacity hover:opacity-70 sm:text-2xl"
                    >
                        Bryns Garbage
                    </Link>
                </header>

                <div className="rounded-2xl border border-border bg-card/60 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-8">
                    <div className="mb-6 text-center">
                        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
                        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                    </div>
                    {children}
                </div>

                <p className="mt-8 text-center text-xs text-muted-foreground">
                    Private kitchen ledger &mdash; your recipes, kept in order.
                </p>
            </main>
        </div>
    )
}
