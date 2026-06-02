import { Sparkle } from '@phosphor-icons/react/dist/ssr';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-col items-center gap-6 max-w-xl">
        <Sparkle size={48} weight="bold" className="text-foreground" aria-hidden />

        <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight text-foreground">
          Triador AI
        </h1>

        <h2 className="text-xl md:text-2xl font-medium text-muted-foreground">
          Em construção
        </h2>

        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          Despeje o caos. A IA organiza em 5 buckets acionáveis: Prioridade, ROI Alto, Delega,
          Depois, Descarta.
        </p>
      </div>
    </main>
  );
}
