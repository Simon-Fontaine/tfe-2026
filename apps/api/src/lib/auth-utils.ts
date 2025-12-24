export function generateVerificationCode(length = 6): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  const mod = 10 ** length;
  return ((buf[0] ?? 0) % mod).toString().padStart(length, "0");
}

export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return Bun.password.verify(password, hash);
}
