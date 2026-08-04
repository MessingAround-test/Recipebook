export default async function downloadDatabaseBackup(): Promise<void> {
    const token = localStorage.getItem('Token') || ''
    const res = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'edgetoken': token
        }
    })

    if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.message || "Backup failed")
    }

    const blob = await res.blob()
    const disposition = res.headers.get('Content-Disposition') || ''
    const match = disposition.match(/filename="?([^"]+)"?/)
    const filename = match ? match[1] : `recipebook-backup-${new Date().toISOString().slice(0, 10)}.zip`

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}
