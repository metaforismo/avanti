import { describe, expect, it } from "vitest";
import { readZip } from "./test-zip";
import { crc32, dosDateTime, zipLength, zipStream, type ZipSource } from "./zip";

const bytes = (text: string) => new TextEncoder().encode(text);
const collect = async (stream: ReadableStream<Uint8Array>) =>
  new Uint8Array(await new Response(stream).arrayBuffer());
const source = (name: string, data: Uint8Array, at = "2027-01-12T09:00:00Z"): ZipSource => ({
  name,
  modified: new Date(at),
  size: data.length,
  read: async () => data,
});

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(bytes("123456789"))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("dosDateTime", () => {
  it("writes the hour as it was in Rome, in winter and in summer time", () => {
    // 09:00 UTC is 10:00 in January and 11:00 in July.
    const winter = dosDateTime(new Date("2027-01-12T09:00:04Z"));
    expect(winter.time >> 11).toBe(10);
    expect(winter.time & 0x1f).toBe(2);
    expect(winter.date).toBe(((2027 - 1980) << 9) | (1 << 5) | 12);
    expect(dosDateTime(new Date("2027-07-12T09:00:00Z")).time >> 11).toBe(11);
    // Midnight in Rome is still the previous day in UTC.
    expect(dosDateTime(new Date("2026-12-31T23:30:00Z")).date & 0x1f).toBe(1);
  });

  it("clamps dates a DOS timestamp cannot hold", () => {
    expect(dosDateTime(new Date("1970-01-01T12:00:00Z")).date >> 9).toBe(0);
  });
});

describe("zipStream", () => {
  it("writes an archive an unzip tool reads back, UTF-8 names and stored data intact", async () => {
    const photo = new Uint8Array(70_000).map((_, n) => (n * 31) % 256);
    const archive = await collect(
      zipStream([
        source("01 محمد رحمن - Documento d’identità.jpg", photo),
        source("02 Nucleo familiare - Contratto.pdf", bytes("%PDF-1.4 esempio")),
        source("03 Vuoto.pdf", new Uint8Array()),
      ]),
    );
    const entries = readZip(archive);
    expect(entries.map((entry) => entry.name)).toEqual([
      "01 محمد رحمن - Documento d’identità.jpg",
      "02 Nucleo familiare - Contratto.pdf",
      "03 Vuoto.pdf",
    ]);
    expect(entries[0]!.data).toEqual(photo);
    expect(new TextDecoder().decode(entries[1]!.data)).toBe("%PDF-1.4 esempio");
    expect(entries[2]!.data).toHaveLength(0);
    for (const entry of entries) {
      expect(entry.method).toBe(0);
      expect(entry.flags & 0x0800).toBe(0x0800);
      // Info-ZIP Unicode Path: version 1, CRC of the name, then the same UTF-8 name.
      const extra = new DataView(entry.extra.buffer);
      expect(extra.getUint16(0, true)).toBe(0x7075);
      expect(extra.getUint8(4)).toBe(1);
      const name = new TextEncoder().encode(entry.name);
      expect(extra.getUint32(5, true)).toBe(crc32(name));
      expect(entry.extra.subarray(9)).toEqual(name);
    }
  });

  it("announces its exact length before reading any file", async () => {
    const sources = [
      source("01 Mario Rossi - Documento d’identità.jpg", new Uint8Array(1234)),
      source("02 محمد - Contratto.pdf", bytes("%PDF")),
    ];
    expect((await collect(zipStream(sources))).length).toBe(zipLength(sources));
    expect(zipLength([])).toBe(22);
  });

  it("fails rather than write a file whose size is not the recorded one", async () => {
    const shorter = { ...source("01 a.pdf", bytes("abc")), size: 4 };
    await expect(collect(zipStream([shorter]))).rejects.toThrow("Stored size differs");
  });

  it("writes a valid empty archive", async () => {
    expect(readZip(await collect(zipStream([])))).toEqual([]);
  });

  it("reads one file at a time, only when the reader asks for more", async () => {
    const reads: string[] = [];
    const lazy = (name: string): ZipSource => ({
      name,
      modified: new Date("2027-01-12T09:00:00Z"),
      size: name.length,
      read: async () => {
        reads.push(name);
        return bytes(name);
      },
    });
    const reader = zipStream([lazy("a"), lazy("b"), lazy("c")]).getReader();
    // Nothing is read before the client asks.
    await Promise.resolve();
    expect(reads).toEqual([]);
    await reader.read(); // header of a
    await reader.read(); // data of a
    expect(reads).toEqual(["a"]);
    await reader.cancel();
  });

  it("stops the storage read in flight when the client goes away", async () => {
    let seen: AbortSignal | undefined;
    const hanging: ZipSource = {
      name: "01 lento.pdf",
      modified: new Date("2027-01-12T09:00:00Z"),
      size: 1,
      read: (signal) => {
        seen = signal;
        return new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(signal.reason), { once: true }),
        );
      },
    };
    const reader = zipStream([hanging]).getReader();
    const pending = reader.read().catch(() => null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await reader.cancel();
    await pending;
    expect(seen?.aborted).toBe(true);
  });

  it("fails the download instead of writing a truncated archive when a file cannot be read", async () => {
    const broken: ZipSource = {
      name: "02 rotto.pdf",
      modified: new Date("2027-01-12T09:00:00Z"),
      size: 10,
      read: () => Promise.reject(new Error("storage down")),
    };
    await expect(collect(zipStream([source("01 ok.pdf", bytes("ok")), broken]))).rejects.toThrow(
      "storage down",
    );
  });
});
