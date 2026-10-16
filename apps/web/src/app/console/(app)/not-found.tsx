import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageContainer } from "@/components/ui/page-header";

export default function ConsoleNotFound() {
  return (
    <PageContainer width="3xl" centered className="py-16 lg:py-24">
      <EmptyState
        icon={FileQuestion}
        title="Questa pagina della console non esiste"
        action={
          <Button asChild>
            <Link href="/console">Torna alle pratiche</Link>
          </Button>
        }
      >
        Se arrivi da un link a una pratica, potrebbe essere stata eliminata o appartenere a un altro
        CAF. Puoi cercarla con ⌘K.
      </EmptyState>
    </PageContainer>
  );
}
