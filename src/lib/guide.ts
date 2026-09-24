// Methodology primer for the Guide page. Bilingual pairs, same shape as
// the changelog: add pairs, never one side only.

export interface GuideSection {
  title: { en: string; pt: string };
  body: { en: string[]; pt: string[] };
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    title: { en: "How a session flows", pt: "Como funciona uma sessão" },
    body: {
      en: [
        "Pick a problem and read it fully before touching the keyboard. The editor opens with an analysis scaffold: what is asked, what matters, what is noise, and the observation.",
        "Write the solution, Run it quietly, then Submit. The verdict console shows per-test results with diffs on wrong answers.",
        "A miss is data. Classify it with a failure chip while it is fresh: conceptual, implementation, or misread.",
      ],
      pt: [
        "Escolha um problema e leia tudo antes de tocar no teclado. O editor abre com um roteiro de análise: o que é pedido, o que importa, o que é ruído, e a observação.",
        "Escreva a solução, Execute em silêncio, depois Submeta. O console de veredito mostra cada teste com diff nos erros.",
        "Um erro é dado. Classifique com um chip de falha enquanto está fresco: conceitual, implementação ou leitura.",
      ],
    },
  },
  {
    title: { en: "What the statuses mean", pt: "O que os status significam" },
    body: {
      en: [
        "Techniques move from NotStarted to Learning to Assimilated. Rusty means it slipped and needs reassessment, not a reset of your progress.",
        "Recall sessions reimplement a technique from memory against a timer. Marking Assimilated again is the proof, not the practice itself.",
        "Journey stars are suggested from data but confirmed by you with a short reflection. Nothing promotes silently.",
      ],
      pt: [
        "Técnicas vão de Não iniciada para Aprendendo até Assimilada. Enferrujada significa que escapou e precisa de reavaliação, não um reset do progresso.",
        "Sessões de recall reimplementam uma técnica de memória contra o relógio. Marcar Assimilada de novo é a prova, não a prática em si.",
        "Estrelas da jornada são sugeridas pelos dados mas confirmadas por você com uma reflexão curta. Nada promove sozinho.",
      ],
    },
  },
  {
    title: { en: "Getting started", pt: "Começando" },
    body: {
      en: [
        "Submit anything on A+B and read the verdict console end to end.",
        "Classify your first miss, then open the Techniques tab and set honest statuses.",
        "Finish one recall session, then run one short contest to feel the timer.",
      ],
      pt: [
        "Submeta qualquer coisa no A+B e leia o console de veredito até o fim.",
        "Classifique seu primeiro erro, depois abra Técnicas e marque status honestos.",
        "Conclua uma sessão de recall, depois rode um contest curto para sentir o relógio.",
      ],
    },
  },
];
