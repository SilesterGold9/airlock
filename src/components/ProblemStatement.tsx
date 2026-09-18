import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

interface Props {
  content: string;
}

function preprocess(content: string): string {
  let s = content;
  // Make Input/Output bold markers into headings for premium look
  s = s.replace(/^\*\*Input\*\*/gm, "### Input");
  s = s.replace(/^\*\*Output\*\*/gm, "### Output");
  // Light LaTeX polish when not already in $...$: wrap |a_i| and 10^9 style
  // Only if not already inside $...$
  if (!s.includes("$")) {
    s = s.replace(/\|a_i\|/g, "$|a_i|$");
    s = s.replace(/10\^9/g, "$10^9$");
    s = s.replace(/10\^9/g, "$10^9$");
    s = s.replace(/<=\s*10\^9/g, "\\\\le 10^9");
    // Wrap the whole math expression if it contains a_i
    s = s.replace(/\$\|a_i\|\s*\\le\s*\$10\^9\$/g, "$|a_i| \\\\le 10^9$");
  }
  return s;
}

function isInputOutput(text: string) {
  const t = text.trim().toLowerCase();
  return t === "input" || t === "output";
}

export default function ProblemStatement({ content }: Props) {
  const processed = preprocess(content);
  return (
    <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-p:text-foreground/80 prose-p:text-sm prose-p:mb-3 prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground prose-strong:text-foreground prose-strong:font-semibold prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-code:text-brand prose-code:bg-white/[0.06] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs prose-code:font-medium prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#0a0f1f] prose-pre:border prose-pre:border-white/[0.06] prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-pre:text-xs prose-blockquote:border-l-2 prose-blockquote:border-brand/50 prose-blockquote:bg-brand/5 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-r-lg prose-blockquote:text-muted-foreground prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-muted-foreground prose-li:text-sm prose-li:mb-1 prose-table:border-collapse prose-th:bg-white/[0.04] prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:border prose-th:border-white/[0.06] prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-white/[0.06] prose-td:text-sm prose-hr:border-white/[0.06] prose-h3:mt-6 prose-h3:mb-3">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h3({ children }) {
            const text = String(children);
            if (isInputOutput(text)) {
              return (
                <div className="not-prose flex items-center gap-2 mt-6 mb-2 px-3 py-1.5 rounded-md bg-white/[0.015] border border-white/[0.04]">
                  <span className="w-5 h-5 rounded flex items-center justify-center text-xs bg-white/[0.04] text-muted-foreground">
                    {text.toLowerCase() === "input" ? "→" : "←"}
                  </span>
                  <span className="text-xs font-medium tracking-wide uppercase text-muted-foreground">{text}</span>
                  <span className="text-xs text-muted-foreground/60 ml-1">{text.toLowerCase() === "input" ? "· stdin" : "· stdout"}</span>
                </div>
              );
            }
            return <h3>{children}</h3>;
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
