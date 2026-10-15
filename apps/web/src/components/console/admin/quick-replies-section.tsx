"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { QuickReply } from "@avanti/contracts";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { apiFetch, ApiRequestError } from "@/lib/api";
import { useResource } from "@/lib/console/use-resource";

const MAX_REPLIES = 50;

/** The sentences operators send all day, written once by the admin and reused in one click. */
export function QuickRepliesSection() {
  const list = useResource<QuickReply[]>("/api/quick-replies");
  const [editing, setEditing] = useState<QuickReply | "new" | null>(null);
  const [removing, setRemoving] = useState<QuickReply | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const replies = list.data ?? [];

  async function act(key: string, run: () => Promise<unknown>) {
    setPending(key);
    setError(null);
    try {
      await run();
      list.reload();
      return true;
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Operazione non riuscita. Riprova.");
      return false;
    } finally {
      setPending(null);
    }
  }

  const move = (index: number, by: -1 | 1) => {
    const ids = replies.map((r) => r.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + by, 0, moved!);
    // Optimistic: the order changes under the pointer, and the server's answer confirms it.
    list.setData(ids.map((id) => replies.find((r) => r.id === id)!));
    void act(`move:${moved}`, () =>
      apiFetch("/api/quick-replies/reorder", { method: "PUT", body: { ids } }),
    );
  };

  return (
    <section aria-labelledby="replies-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h2 id="replies-title" className="font-display text-xl font-semibold">
            Risposte rapide
          </h2>
          <p className="mt-1 text-ink-2">
            Le frasi che gli operatori scrivono più spesso quando chiedono un&apos;integrazione:
            compaiono come pulsanti sopra il messaggio. Il cittadino le riceve tradotte.
          </p>
        </div>
        <Button
          onClick={() => setEditing("new")}
          disabled={replies.length >= MAX_REPLIES || !list.data}
        >
          <Plus className="size-4" aria-hidden />
          Aggiungi
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-md bg-danger-wash px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {list.status === "error" && !list.data ? (
        <p className="mt-4 text-danger">Risposte non disponibili: {list.error.message}</p>
      ) : !list.data ? (
        <div className="mt-4 h-32 animate-pulse rounded-lg bg-sunk" aria-hidden />
      ) : replies.length === 0 ? (
        <p className="mt-4 rounded-lg bg-surface p-5 text-ink-2 ring-1 ring-line">
          Nessuna risposta rapida. Aggiungi le richieste che fate più spesso, per esempio «Foto
          illeggibile» o «Manca la pagina con la firma».
        </p>
      ) : (
        <ol className="mt-4 divide-y divide-line rounded-lg bg-surface ring-1 ring-line">
          {replies.map((reply, index) => (
            <li key={reply.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-4 py-3">
              <div className="min-w-0 flex-1 basis-64">
                <p className="font-semibold">{reply.title}</p>
                <p className="line-clamp-2 text-sm text-ink-2">{reply.text}</p>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Sposta su: ${reply.title}`}
                  disabled={index === 0 || pending !== null}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Sposta giù: ${reply.title}`}
                  disabled={index === replies.length - 1 || pending !== null}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Modifica: ${reply.title}`}
                  onClick={() => setEditing(reply)}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Elimina: ${reply.title}`}
                  onClick={() => setRemoving(reply)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
      {replies.length >= MAX_REPLIES && (
        <p className="mt-2 text-sm text-ink-3">
          Hai raggiunto il massimo di {MAX_REPLIES}: eliminane una per aggiungerne altre.
        </p>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? "Nuova risposta rapida" : "Modifica risposta rapida"}
        description="Scrivi in italiano: Avanti la traduce nella lingua del cittadino quando la invii."
      >
        {editing !== null && (
          <ReplyForm
            initial={editing === "new" ? null : editing}
            onSave={async (input) => {
              const saved = await act("save", () =>
                editing === "new"
                  ? apiFetch("/api/quick-replies", { method: "POST", body: input })
                  : apiFetch(`/api/quick-replies/${editing.id}`, { method: "PATCH", body: input }),
              );
              if (saved) setEditing(null);
              return saved;
            }}
            saving={pending === "save"}
          />
        )}
      </Dialog>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title="Eliminare la risposta rapida?"
        description="Sparisce per tutti gli operatori. I messaggi già inviati non cambiano."
      >
        {removing && (
          <div className="flex flex-wrap gap-3">
            <Button
              variant="danger"
              loading={pending === "delete"}
              onClick={async () => {
                const done = await act("delete", () =>
                  apiFetch(`/api/quick-replies/${removing.id}`, { method: "DELETE" }),
                );
                if (done) setRemoving(null);
              }}
            >
              Elimina «{removing.title}»
            </Button>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Annulla
            </Button>
          </div>
        )}
      </Dialog>
    </section>
  );
}

function ReplyForm({
  initial,
  onSave,
  saving,
}: {
  initial: QuickReply | null;
  onSave: (input: { title: string; text: string }) => Promise<boolean>;
  saving: boolean;
}) {
  const [errors, setErrors] = useState<{ title?: string; text?: string }>({});
  const [length, setLength] = useState(initial?.text.length ?? 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const text = String(data.get("text") ?? "").trim();
    const next = {
      title: title ? undefined : "Dai un titolo breve, è il testo del pulsante.",
      text: text ? undefined : "Scrivi il messaggio per il cittadino.",
    };
    setErrors(next);
    if (next.title || next.text) {
      (form.elements.namedItem(next.title ? "title" : "text") as HTMLElement | null)?.focus();
      return;
    }
    await onSave({ title, text });
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label="Titolo" hint="Breve: diventa il pulsante." error={errors.title}>
        {(p) => (
          <Input {...p} name="title" defaultValue={initial?.title} maxLength={80} autoFocus />
        )}
      </Field>
      <Field label="Messaggio" error={errors.text}>
        {(p) => (
          <Textarea
            {...p}
            name="text"
            defaultValue={initial?.text}
            maxLength={1000}
            rows={5}
            onChange={(e) => setLength(e.target.value.length)}
          />
        )}
      </Field>
      <p className="tabular -mt-3 text-right text-xs text-ink-3">{length}/1000</p>
      <Button type="submit" loading={saving} className="w-fit">
        Salva
      </Button>
    </form>
  );
}
