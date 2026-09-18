import { useT } from "../lib/i18n";

interface DiffViewerProps {
  expected: string;
  actual: string;
}

function splitLines(s: string): string[] {
  if (s === "") return [""];
  return s.split("\n");
}

function highlightLine(line: string, other: string, isExpected: boolean, t: (k: string) => string) {
  if (line === other) return <span>{line || "∅"}</span>;
  let prefixLen = 0;
  const minLen = Math.min(line.length, other.length);
  while (prefixLen < minLen && line[prefixLen] === other[prefixLen]) prefixLen++;
  let suffixLen = 0;
  while (
    suffixLen < minLen - prefixLen &&
    line[line.length - 1 - suffixLen] === other[other.length - 1 - suffixLen]
  )
    suffixLen++;

  const before = line.slice(0, prefixLen);
  const middle = line.slice(prefixLen, line.length - suffixLen);
  const after = suffixLen ? line.slice(line.length - suffixLen) : "";

  return (
    <span>
      <span>{before}</span>
      <span className={isExpected ? "bg-wa/20 text-wa" : "bg-ac/20 text-ac"}>{middle || "∅"}</span>
      <span>{after}</span>
      {line.length === 0 && <span className="text-muted-foreground italic">{t("diff.emptyLine")}</span>}
    </span>
  );
}

export default function DiffViewer({ expected, actual }: DiffViewerProps) {
  const t = useT();
  const expLines = splitLines(expected);
  const actLines = splitLines(actual);
  const maxLines = Math.max(expLines.length, actLines.length);
  const hasDiff = expected !== actual;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="grid grid-cols-2 text-xs font-semibold bg-card border-b border-border">
        <div className="px-3 py-1.5 border-r border-border flex items-center gap-2">
          <span>{t("diff.expected")}</span>
          <span className="text-muted-foreground font-normal">{expLines.length} {t("diff.lines")}</span>
        </div>
        <div className="px-3 py-1.5 flex items-center gap-2">
          <span>{t("diff.yourOutput")}</span>
          <span className="text-muted-foreground font-normal">{actLines.length} {t("diff.lines")}</span>
          {hasDiff && <span className="ml-auto text-wa">{t("diff.diffBadge")}</span>}
        </div>
      </div>
      <div className="grid grid-cols-2 max-h-64 overflow-auto text-xs font-mono">
        <div className="border-r border-border">
          {Array.from({ length: maxLines }).map((_, i) => {
            const exp = expLines[i] ?? "";
            const act = actLines[i] ?? "";
            const isDiff = exp !== act;
            const exists = i < expLines.length;
            return (
              <div key={i} className={`flex px-2 py-0.5 ${isDiff ? "bg-wa/10" : ""} ${!exists ? "opacity-30" : ""}`}>
                <span className="w-6 text-muted-foreground select-none text-right mr-2">{i + 1}</span>
                <span className="flex-1 whitespace-pre-wrap break-words">
                  {exists ? (isDiff ? highlightLine(exp, act, true, t) : <span>{exp || " "}</span>) : <span className="text-muted-foreground italic">{t("diff.noLine")}</span>}
                </span>
              </div>
            );
          })}
        </div>
        <div>
          {Array.from({ length: maxLines }).map((_, i) => {
            const exp = expLines[i] ?? "";
            const act = actLines[i] ?? "";
            const isDiff = exp !== act;
            const exists = i < actLines.length;
            return (
              <div key={i} className={`flex px-2 py-0.5 ${isDiff ? "bg-ac/10" : ""} ${!exists ? "opacity-30" : ""}`}>
                <span className="w-6 text-muted-foreground select-none text-right mr-2">{i + 1}</span>
                <span className="flex-1 whitespace-pre-wrap break-words">
                  {exists ? (isDiff ? highlightLine(act, exp, false, t) : <span>{act || " "}</span>) : <span className="text-muted-foreground italic">{t("diff.noLine")}</span>}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="px-3 py-2 bg-card/50 border-t border-border text-xs text-muted-foreground">
        {t("diff.comparisonHint")}
      </div>
    </div>
  );
}
