import Editor from "@monaco-editor/react";

interface CodeEditorProps {
  language: "cpp" | "java";
  value: string;
  onChange: (value: string) => void;
  onLanguageChange: (language: "cpp" | "java") => void;
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

export default function CodeEditor({
  language,
  value,
  onChange,
  onLanguageChange,
}: CodeEditorProps) {
  return (
    <div className="flex flex-col h-full border border-slate-800 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between bg-slate-900 px-3 py-2 border-b border-slate-800">
        <select
          className="bg-slate-800 text-sm rounded px-2 py-1"
          value={language}
          onChange={(e) => {
            const lang = e.target.value as "cpp" | "java";
            onLanguageChange(lang);
            if (!value.trim()) onChange(TEMPLATES[lang]);
          }}
        >
          <option value="cpp">C++17</option>
          <option value="java">Java</option>
        </select>
        <button
          className="text-xs text-slate-400 hover:text-slate-200"
          onClick={() => onChange(TEMPLATES[language])}
        >
          Reset template
        </button>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          theme="vs-dark"
          language={language === "cpp" ? "cpp" : "java"}
          value={value || TEMPLATES[language]}
          onChange={(v) => onChange(v ?? "")}
          options={{
            fontSize: 14,
            minimap: { enabled: false },
            tabSize: 4,
            wordWrap: "on",
          }}
        />
      </div>
    </div>
  );
}
