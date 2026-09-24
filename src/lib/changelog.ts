// Curated highlights per version, shown in the What's New modal after an
// update. Add one entry per release (en + pt) when bumping the version.
// Entries older than the previous release can be dropped.

export const RELEASES_URL = "https://github.com/SilesterGold9/airlock/releases";

export interface ChangelogEntry {
  version: string;
  en: string[];
  pt: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.4.0",
    en: [
      "Starter vault: 15 problems and 6 techniques load in one click",
      "New onboarding flow, starting with language choice",
      "Grouped sidebar navigation with Alt+1…9 shortcuts",
      "Editor bundled locally: mounts offline, keeps drafts, CP snippets",
      "Silent judge on Windows, no console flash; working window controls",
      "Update check shows the real version and recovers from failures",
    ],
    pt: [
      "Cofre inicial: 15 problemas e 6 técnicas em um clique",
      "Novo fluxo de boas-vindas, começando pelo idioma",
      "Navegação lateral em grupos com atalhos Alt+1…9",
      "Editor embutido: abre offline, guarda rascunhos, snippets de CP",
      "Judge silencioso no Windows, sem console piscando; controles da janela funcionando",
      "Verificação de updates mostra a versão real e se recupera de falhas",
    ],
  },
];

export function entryFor(version: string): ChangelogEntry | null {
  return CHANGELOG.find((e) => e.version === version) ?? null;
}
