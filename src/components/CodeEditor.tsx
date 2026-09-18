import Editor from "@monaco-editor/react";
import { Select } from "./ui/select";
import { useT } from "../lib/i18n";

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
  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center justify-between bg-card px-3 h-9 border-b border-border shrink-0">
        <div className="w-24">
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
          className="text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
          onClick={() => onChange(templates[language])}
        >
          {t("editor.resetTemplate")}
        </button>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          theme="vs-dark"
          language={language === "cpp" ? "cpp" : "java"}
          value={value || templates[language]}
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
