import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@vercel/blob", () => ({ put: vi.fn(), get: vi.fn(), del: vi.fn() }));
import { put, get, del } from "@vercel/blob";
import { BlobStorage } from "./storage";
beforeEach(() => {
  vi.resetAllMocks();
});
it("pilot: Blob operations are private and receive abort signals; downloads are bounded", async () => {
  const storage = new BlobStorage("synthetic-token");
  vi.mocked(put).mockResolvedValue({
    url: "https://synthetic.private.blob.vercel-storage.com/key",
  } as Awaited<ReturnType<typeof put>>);
  await storage.put("key", new Uint8Array([1]), "application/pdf");
  expect(put).toHaveBeenCalledWith(
    "key",
    expect.any(Uint8Array),
    expect.objectContaining({ access: "private", abortSignal: expect.any(AbortSignal) }),
  );
  vi.mocked(get).mockResolvedValue({
    statusCode: 200,
    stream: new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(4 * 1024 * 1024 + 1));
        c.close();
      },
    }),
  } as Awaited<ReturnType<typeof get>>);
  await expect(storage.get("key")).rejects.toThrow("Invalid storage size");
  expect(get).toHaveBeenCalledWith(
    "key",
    expect.objectContaining({ access: "private", abortSignal: expect.any(AbortSignal) }),
  );
  vi.mocked(del).mockResolvedValue(undefined);
  await storage.delete("key");
  expect(del).toHaveBeenCalledWith(
    "key",
    expect.objectContaining({ abortSignal: expect.any(AbortSignal) }),
  );
});
it("pilot: SDK retry sleeps cannot exceed the adapter deadline; late confirmed writes are cleaned up", async () => {
  vi.useFakeTimers();
  try {
    let resolve: (value: Awaited<ReturnType<typeof put>>) => void = () => {};
    vi.mocked(put).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    vi.mocked(del).mockResolvedValue(undefined);
    const storage = new BlobStorage("synthetic-token");
    const work = storage.put("key", new Uint8Array([1]), "application/pdf");
    const rejected = expect(work).rejects.toMatchObject({ name: "TimeoutError" });
    await vi.advanceTimersByTimeAsync(15001);
    await rejected;
    resolve({ url: "https://synthetic.private.blob.vercel-storage.com/key" } as Awaited<
      ReturnType<typeof put>
    >);
    await vi.advanceTimersByTimeAsync(1);
    expect(del).toHaveBeenCalledTimes(1);
  } finally {
    vi.useRealTimers();
  }
});
