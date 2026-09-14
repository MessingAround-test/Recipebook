// Shared kitchen alarm helpers. Both the Quick Tools timers and the recipe
// cooking timers ring the same three-beep pattern and (when permitted) raise a
// browser notification, so they live here rather than being duplicated.

export function playAlarm() {
    if (typeof window === 'undefined') return
    try {
        const Ctor = (window as any).AudioContext || (window as any).webkitAudioContext
        if (!Ctor) return
        const ctx = new Ctor()
        const playBeep = (freq: number, startTime: number) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.frequency.value = freq
            osc.type = 'sine'
            gain.gain.setValueAtTime(0.3, startTime)
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3)
            osc.start(startTime)
            osc.stop(startTime + 0.3)
        }
        const now = ctx.currentTime
        playBeep(880, now)
        playBeep(880, now + 0.35)
        playBeep(1100, now + 0.7)
    } catch (e) {
        console.error('Audio alarm failed:', e)
    }
}

export function sendNotification(title: string, body: string) {
    try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification(title, { body, icon: '/favicon.ico' })
        }
    } catch (e) {
        console.error('Notification failed:', e)
    }
}

export function requestNotificationPermission() {
    try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission()
        }
    } catch {}
}
