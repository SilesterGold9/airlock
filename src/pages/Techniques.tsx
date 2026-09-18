import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Problem, Technique, TechniqueStatus } from "../lib/types";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Textarea } from "../components/ui/textarea";
import { useT } from "../lib/i18n";

const STATUSES: TechniqueStatus[] = ["NotStarted", "Learning", "Assimilated", "Rusty"];

const DOT: Record<TechniqueStatus, string> = {
  NotStarted: "bg-muted-foreground/50",
  Learning: "bg-tle",
  Assimilated: "bg-ac",
  Rusty: "bg-re",
};

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function TechniqueRow({
  technique,
  linked,
  selected,
  onToggleSelect,
  onStatusChange,
  t,
}: {
  technique: Technique;
  linked: Problem[];
  selected: boolean;
  onToggleSelect: () => void;
  onStatusChange: (status: TechniqueStatus) => void;
  t: (k: string) => string;
}) {
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(technique.notes_md || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setNotes(technique.notes_md || "");
  }, [technique.id, technique.notes_md]);

  const dirty = notes !== (technique.notes_md || "");

  async function handleSaveNotes() {
    setSaving(true);
    try {
      await api.updateTechniqueNotes(technique.id, notes);
      technique.notes_md = notes;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-3 hover:bg-white/[0.02] transition-colors duration-150">
      <div className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4 rounded border-input bg-input accent-current"
          aria-label={technique.name}
        />
        <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${DOT[technique.status]}`} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{technique.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {t("techniques.updated").replace("{date}", formatDate(technique.status_updated_at))}
            {" · "}
            {t("techniques.linked").replace("{count}", String(linked.length))}
          </div>
        </div>
        <Select
          size="sm"
          className="w-32"
          value={technique.status}
          onChange={(e) => onStatusChange(e.target.value as TechniqueStatus)}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`techniques.status.${s}`)}
            </option>
          ))}
        </Select>
        <Button variant="secondary" size="sm" onClick={() => setNotesOpen((v) => !v)}>
          {notesOpen ? t("techniques.hideNotes") : t("techniques.showNotes")}
        </Button>
      </div>
      {linked.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 ml-7">
          {linked.map((p) => (
            <Badge key={p.id} variant="outline">
              {p.title}
            </Badge>
          ))}
        </div>
      )}
      {notesOpen && (
        <div className="mt-2 ml-7 grid gap-2 animate-fade-in">
          <Textarea
            className="min-h-[80px] font-sans"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("techniques.notesPlaceholder")}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleSaveNotes} disabled={saving || !dirty}>
              {saving ? t("common.saving") : t("common.save")}
            </Button>
            {saved && !dirty && <span className="text-xs text-muted-foreground">{t("common.saved")}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function Techniques() {
  const t = useT();
  const [techniques, setTechniques] = useState<Technique[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<TechniqueStatus>("Rusty");
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    api.listTechniques().then(setTechniques).catch(console.error);
    api.listProblems().then(setProblems).catch(console.error);
  }, []);

  const linkedByTechnique = useMemo(() => {
    const map = new Map<string, Problem[]>();
    for (const p of problems) {
      if (!p.primary_technique_id) continue;
      const arr = map.get(p.primary_technique_id) || [];
      arr.push(p);
      map.set(p.primary_technique_id, arr);
    }
    return map;
  }, [problems]);

  const counts = useMemo(() => {
    const c: Record<TechniqueStatus, number> = { NotStarted: 0, Learning: 0, Assimilated: 0, Rusty: 0 };
    for (const tech of techniques) c[tech.status] += 1;
    return c;
  }, [techniques]);

  const allSelected = techniques.length > 0 && selectedIds.size === techniques.length;

  async function handleAdd() {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    try {
      const created = await api.saveTechnique(name);
      setTechniques((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
    } catch (e) {
      console.error(e);
    } finally {
      setAdding(false);
    }
  }

  async function handleStatusChange(id: string, status: TechniqueStatus) {
    try {
      await api.updateTechniqueStatus(id, status);
      const fresh = await api.listTechniques();
      setTechniques(fresh);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleBulkApply() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const ok = window.confirm(
      t("techniques.bulkConfirm").replace("{count}", String(ids.length)).replace("{status}", t(`techniques.status.${bulkStatus}`))
    );
    if (!ok) return;
    setBulkBusy(true);
    try {
      await api.bulkUpdateTechniqueStatus(ids, bulkStatus);
      const fresh = await api.listTechniques();
      setTechniques(fresh);
      setSelectedIds(new Set());
    } catch (e) {
      console.error(e);
    } finally {
      setBulkBusy(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(techniques.map((tech) => tech.id)));
  }

  return (
    <div className="max-w-3xl mx-auto p-6 animate-fade-in">
      <h1 className="text-xl font-semibold">{t("techniques.title")}</h1>
      <p className="text-xs text-muted-foreground mt-1">{t("techniques.subtitle")}</p>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {STATUSES.map((s) => (
          <Badge key={s} variant="outline">
            <span className={`h-2 w-2 rounded-full mr-1.5 ${DOT[s]}`} />
            {t(`techniques.status.${s}`)} · {counts[s]}
          </Badge>
        ))}
      </div>

      <Card className="p-3 mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
        <div className="flex gap-2 flex-1">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("techniques.addPlaceholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
          />
          <Button size="sm" onClick={handleAdd} disabled={adding || !newName.trim()}>
            {t("techniques.add")}
          </Button>
        </div>
      </Card>

      {techniques.length > 0 && (
        <Card className="p-3 mt-3 flex flex-col sm:flex-row gap-2 sm:items-center">
          <label className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="h-4 w-4 rounded border-input bg-input accent-current" />
            {t("techniques.selected").replace("{count}", String(selectedIds.size))}
          </label>
          <div className="flex gap-2 sm:ml-auto">
            <Select size="sm" className="w-32" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as TechniqueStatus)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`techniques.status.${s}`)}
                </option>
              ))}
            </Select>
            <Button size="sm" onClick={handleBulkApply} disabled={bulkBusy || selectedIds.size === 0}>
              {bulkBusy ? t("common.saving") : t("techniques.reassess")}
            </Button>
          </div>
        </Card>
      )}

      <div className="grid gap-2 mt-3">
        {techniques.map((tech) => (
          <TechniqueRow
            key={tech.id}
            t={t}
            technique={tech}
            linked={linkedByTechnique.get(tech.id) || []}
            selected={selectedIds.has(tech.id)}
            onToggleSelect={() => toggleSelect(tech.id)}
            onStatusChange={(s) => handleStatusChange(tech.id, s)}
          />
        ))}
        {techniques.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground border-dashed">{t("techniques.empty")}</Card>
        )}
      </div>
    </div>
  );
}
