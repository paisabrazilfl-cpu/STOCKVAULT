import { describe, it, expect, beforeAll } from "vitest";
import { encrypt, decrypt, maskKey } from "../crypto";

beforeAll(() => {
  process.env.ENCRYPTION_SECRET = "test-secret-for-vitest-only";
});

describe("encrypt / decrypt (AES-256-GCM)", () => {
  it("round-trips plaintext", () => {
    const secret = "alpaca-key-AK1234567890";
    expect(decrypt(encrypt(secret))).toBe(secret);
  });

  it("round-trips unicode and empty-ish payloads", () => {
    for (const s of ["", " ", "ключ-密钥-�clave", JSON.stringify({ a: 1, b: [true, null] })]) {
      expect(decrypt(encrypt(s))).toBe(s);
    }
  });

  it("uses a random IV — same plaintext yields different ciphertext", () => {
    const a = encrypt("same-input");
    const b = encrypt("same-input");
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(decrypt(b));
  });

  it("rejects tampered ciphertext (GCM auth tag)", () => {
    const ct = encrypt("integrity-matters");
    const buf = Buffer.from(ct, "base64");
    buf[buf.length - 1] ^= 0xff; // flip a bit in the encrypted payload
    expect(() => decrypt(buf.toString("base64"))).toThrow();
  });

  it("rejects ciphertext decrypted under a different secret", () => {
    const ct = encrypt("tenant-a-secret");
    const original = process.env.ENCRYPTION_SECRET;
    process.env.ENCRYPTION_SECRET = "a-completely-different-secret";
    try {
      expect(() => decrypt(ct)).toThrow();
    } finally {
      process.env.ENCRYPTION_SECRET = original;
    }
  });

  it("throws a clear error when ENCRYPTION_SECRET is missing", () => {
    const original = process.env.ENCRYPTION_SECRET;
    delete process.env.ENCRYPTION_SECRET;
    try {
      expect(() => encrypt("x")).toThrow(/ENCRYPTION_SECRET/);
    } finally {
      process.env.ENCRYPTION_SECRET = original;
    }
  });
});

describe("maskKey", () => {
  it("returns null for empty input", () => {
    expect(maskKey(null)).toBeNull();
    expect(maskKey(undefined)).toBeNull();
    expect(maskKey("")).toBeNull();
  });
  it("fully masks short keys", () => {
    expect(maskKey("abcd")).toBe("****");
  });
  it("shows only the last 4 characters of long keys", () => {
    expect(maskKey("nvapi-SECRETSECRET1234")).toBe("****1234");
  });
});
