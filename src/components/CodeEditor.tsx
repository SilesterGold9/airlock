import { useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { Select } from "./ui/select";
import { useT } from "../lib/i18n";
import { handleEditorBeforeMount } from "../lib/editorTheme";

interface CodeEditorProps {
  language: "cpp" | "java";
  value: string;
  onChange: (value: string) => void;
  onLanguageChange: (language: "cpp" | "java") => void;
  // Practice mode seeds the analysis scaffold (what is asked / signal vs noise / OBS)
  // instead of the bare template. Contest and Stress keep "standard".
  templateSet?: "standard" | "analysis";
}

const TEMPLATES: Record<"cpp" | "java", string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    // your solution here

    return 0;
}
`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

        // your solution here
    }
}
`,
};

// Same boilerplate, but the solution slot is replaced with the analysis
// scaffold: state what is asked, separate signal from noise, write the
// observation before any code. Both languages use line comments.
const ANALYSIS_TEMPLATES: Record<"cpp" | "java", string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    // What is the problem asking?
    //
    // What info actually matters? What is noise?
    //
    // OBS:
    //

    return 0;
}
`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));

        // What is the problem asking?
        //
        // What info actually matters? What is noise?
        //
        // OBS:
        //
    }
}
`,
};

export default function CodeEditor({
  language,
  value,
  onChange,
  onLanguageChange,
  templateSet = "standard",
}: CodeEditorProps) {
  const t = useT();
  const templates = templateSet === "analysis" ? ANALYSIS_TEMPLATES : TEMPLATES;
  const [cursor, setCursor] = useState({ line: 1, column: 1 });

  const handleMount: OnMount = (editor) => {
    editor.onDidChangeCursorPosition((e) =>
      setCursor({ line: e.position.lineNumber, column: e.position.column })
    );
  };

  return (
    <div className="flex flex-col h-full rounded-lg overflow-hidden bg-card">
      <div className="flex items-center gap-2 bg-card px-3 h-10 border-b border-border shrink-0">
        <span className="text-ac font-mono text-sm font-semibold select-none">{"</>"}</span>
        <span className="text-sm font-medium">{t("editor.code")}</span>
        <div className="w-24 ml-1">
          <Select
            size="sm"
            value={language}
            onChange={(e) => {
              const lang = e.target.value as "cpp" | "java";
              onLanguageChange(lang);
              onChange(templates[lang]);
            }}
          >
            <option value="cpp">C++17</option>
            <option value="java">Java</option>
          </Select>
        </div>
        <button
          className="ml-auto w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors duration-150"
          onClick={() => onChange(templates[language])}
          title={t("editor.resetTemplate")}
          aria-label={t("editor.resetTemplate")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12a9 9 0 1 0 2.6-6.4" />
            <path d="M3 4v5h5" />
          </svg>
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          theme="airlock-dark"
          language={language === "cpp" ? "cpp" : "java"}
          value={value || templates[language]}
          beforeMount={handleEditorBeforeMount}
          onMount={handleMount}
          onChange={(v) => onChange(v ?? "")}
          options={{
            fontSize: 14,
            lineHeight: 20,
            minimap: { enabled: false },
            tabSize: 4,
            wordWrap: "on",
            padding: { top: 8 },
            scrollBeyondLastLine: false,
            renderLineHighlight: "all",
          }}
        />
      </div>
      <div className="flex items-center justify-between px-3 h-7 border-t border-border shrink-0 text-[11px] text-muted-foreground select-none">
        <span>{t("editor.spaces")}</span>
        <span className="tabular-nums">
          Ln {cursor.line}, Col {cursor.column}
        </span>
      </div>
    </div>
  );
}
