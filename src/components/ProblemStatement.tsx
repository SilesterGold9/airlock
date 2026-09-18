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

export default function ProblemStatement({ content }: Props) {
  const processed = preprocess(content);
  return (
    <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-p:text-foreground/90 prose-p:text-sm prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground prose-strong:text-foreground prose-strong:font-semibold prose-a:text-brand prose-a:no-underline hover:prose-a:underline prose-code:text-brand prose-code:bg-white/[0.06] prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:font-mono prose-code:text-xs prose-code:font-medium prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#0a0f1f] prose-pre:border prose-pre:border-border prose-pre:rounded-lg prose-pre:p-4 prose-pre:overflow-x-auto prose-pre:text-xs prose-blockquote:border-l-2 prose-blockquote:border-brand/50 prose-blockquote:bg-brand/5 prose-blockquote:px-4 prose-blockquote:py-2 prose-blockquote:rounded-r-lg prose-blockquote:text-muted-foreground prose-ul:list-disc prose-ol:list-decimal prose-li:marker:text-muted-foreground prose-li:text-sm prose-table:border-collapse prose-th:bg-white/[0.04] prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:text-xs prose-th:font-semibold prose-th:border prose-th:border-border prose-td:px-3 prose-td:py-2 prose-td:border prose-td:border-border prose-td:text-sm prose-hr:border-white/[0.06]">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {processed}
      </ReactMarkdown>
    </div>
  );
}
