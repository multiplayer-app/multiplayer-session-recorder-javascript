export const isGzip = (buf: Buffer | Uint8Array) => {
  if (!buf || buf.length < 3) {
    return false
  }

  return buf[0] === 0x1F && buf[1] === 0x8B && buf[2] === 0x08
}
