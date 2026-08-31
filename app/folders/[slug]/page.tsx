"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CaretLeft,
  FileText,
  Trash,
  CircleNotch,
  FolderOpen,
} from "@phosphor-icons/react/dist/ssr";
import AppShellV2 from "@/app/components/v2/AppShellV2";
import { ToolTile } from "@/app/components/v2/Squircle";
import { listToolRuns, deleteToolRun, type ToolRun } from "@/app/lib/toolRuns";
import { v2ToolForSlug, toolSolid } from "@/app/lib/tools";
import { typeLabel, formatDate } from "@/app/lib/toolRunDisplay";
import app from "@/app/components/v2/app.module.css";
import styles from "./folder.module.css";

export default function FolderDetailPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const [runs, setRuns] = useState<ToolRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const tool = v2ToolForSlug(slug);

  useEffect(() => {
    listToolRuns(slug)
      .then(setRuns)
      .catch(() => setRuns([]))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setDeletingId(id);
    try {
      await deleteToolRun(id);
      setRuns((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // Leave the row in place if the delete fails, rather than removing it
      // optimistically and having it reappear on the next load.
    } finally {
      setDeletingId(null);
    }
  };

  const name = tool?.name ?? typeLabel(slug);

  return (
    <AppShellV2 title="Library">
      <p className={styles.crumbs}>
        <Link href="/folders" className={styles.crumbLink}>
          <CaretLeft className={styles.crumbIcon} />
          Library
        </Link>
        <span className={styles.crumbSep}>/</span>
        <span>{name}</span>
      </p>

      <div className={styles.head}>
        <ToolTile icon={tool?.icon ?? "folder"} solid={toolSolid(tool)} size="lg" />
        <div className={styles.headText}>
          <h1>{name}</h1>
          <p className={app.helloSub}>
            {loading
              ? " "
              : `${runs.length} ${runs.length === 1 ? "resource" : "resources"}`}
          </p>
        </div>
        {tool && (
          <Link href={tool.href} className={`${app.btn} ${app.btnP} ${styles.headBtn}`}>
            Make another
          </Link>
        )}
      </div>

      <section className={app.panel}>
        {loading ? (
          <p className={styles.quiet}>Loading…</p>
        ) : runs.length === 0 ? (
          <div className={app.empty}>
            <span className={app.emptyIcon}>
              <FolderOpen weight="fill" />
            </span>
            <p className={app.emptyTitle}>This folder is empty</p>
            <p className={app.emptyBody}>
              {tool
                ? `Anything you make with ${tool.name} lands here.`
                : "Nothing has been filed here."}
            </p>
          </div>
        ) : (
          <div className={app.rows}>
            {runs.map((run) => {
              const input = run.input as Record<string, unknown>;
              const subject = (input.subject as string) || null;
              const year = (input.yearGroup as string) || null;
              // Subject and year are optional on most tools, so the meta line is
              // assembled from whatever is actually there rather than printing a
              // row of em dashes.
              const meta = [year, subject, formatDate(run.created_at)]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={run.id}
                  className={app.row}
                  role="button"
                  tabIndex={0}
                  onClick={() => tool && router.push(`${tool.href}?run=${run.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (tool) router.push(`${tool.href}?run=${run.id}`);
                    }
                  }}
                >
                  {/* Every resource in this folder came from the same tool, so a
                      per-tool tile here would carry no information. Neutral
                      keeps the eye on the title. */}
                  <span className={styles.fileIcon}>
                    <FileText weight="fill" />
                  </span>
                  <span className={app.rowMain}>
                    <span className={app.rowTitle}>{run.title?.trim() || "Untitled"}</span>
                    <span className={app.rowMeta}>{meta}</span>
                  </span>
                  <button
                    type="button"
                    aria-label={`Delete ${run.title?.trim() || "this resource"}`}
                    onClick={(e) => handleDelete(e, run.id)}
                    disabled={deletingId === run.id}
                    className={styles.del}
                  >
                    {deletingId === run.id ? (
                      <CircleNotch className={`${styles.delIcon} ${styles.spin}`} />
                    ) : (
                      <Trash className={styles.delIcon} />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </AppShellV2>
  );
}
