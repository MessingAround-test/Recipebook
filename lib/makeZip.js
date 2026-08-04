import zlib from 'zlib'

let crcTable = null

function crc32(buf) {
    if (!crcTable) {
        crcTable = new Int32Array(256)
        for (let n = 0; n < 256; n++) {
            let c = n
            for (let k = 0; k < 8; k++) {
                c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
            }
            crcTable[n] = c
        }
    }
    let c = 0xFFFFFFFF
    for (let i = 0; i < buf.length; i++) {
        c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8)
    }
    return (c ^ 0xFFFFFFFF) >>> 0
}

function buildFileEntry(f) {
    const nameBuf = Buffer.from(f.name, 'utf8')
    const compressed = zlib.deflateRawSync(f.data, { level: 9 })
    const crc = crc32(f.data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(8, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0, 12)
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(compressed.length, 18)
    local.writeUInt32LE(f.data.length, 22)
    local.writeUInt16LE(nameBuf.length, 26)
    local.writeUInt16LE(0, 28)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt16LE(8, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0, 14)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(compressed.length, 20)
    central.writeUInt32LE(f.data.length, 24)
    central.writeUInt16LE(nameBuf.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(f.localOffset, 42)

    return {
        local: Buffer.concat([local, nameBuf, compressed]),
        central: Buffer.concat([central, nameBuf]),
        size: 30 + nameBuf.length + compressed.length
    }
}

export default function makeZip(files) {
    let offset = 0
    const entries = files.map(f => {
        f.localOffset = offset
        const entry = buildFileEntry(f)
        offset += entry.size
        return entry
    })

    const chunks = []
    let centralSize = 0
    for (const entry of entries) {
        chunks.push(entry.local)
        centralSize += entry.central.length
    }
    for (const entry of entries) {
        chunks.push(entry.central)
    }

    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0)
    eocd.writeUInt16LE(0, 4)
    eocd.writeUInt16LE(0, 6)
    eocd.writeUInt16LE(files.length, 8)
    eocd.writeUInt16LE(files.length, 10)
    eocd.writeUInt32LE(centralSize, 12)
    eocd.writeUInt32LE(offset, 16)
    eocd.writeUInt16LE(0, 20)

    return Buffer.concat([...chunks, eocd])
}
