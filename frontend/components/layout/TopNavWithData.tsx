"use client";

import { useMemo, useState } from "react";
import { TopNav } from "./TopNav";
import { useDashboardData } from "../../lib/DashboardDataContext";

type PolicyBrief = {
  executive_summary?: string;
  key_findings?: string[];
  recommended_actions?: string[];
};

export function TopNavWithData() {
  const { jobs, industries, skills, neighborhoods, signals, insights } = useDashboardData();
  const [exportLoading, setExportLoading] = useState(false);

  const searchSuggestions = useMemo(() => {
    const out: { type: string; name: string }[] = [];
    if (industries?.by_industry) {
      const labelMap: Record<string, string> = {
        government: "Government",
        defense_federal: "Defense",
        healthcare: "Healthcare",
        manufacturing: "Manufacturing",
        technology: "Technology",
        education: "Education",
        public_safety: "Public Safety",
      };
      for (const k of Object.keys(industries.by_industry)) {
        out.push({ type: "industry", name: labelMap[k] ?? k });
      }
    }
    if (skills?.in_demand_skills_list) {
      for (const s of skills.in_demand_skills_list) {
        if (typeof s === "string") out.push({ type: "skill", name: s });
      }
    }
    if (neighborhoods?.neighborhoods) {
      for (const n of neighborhoods.neighborhoods) {
        out.push({ type: "neighborhood", name: n.name });
      }
    }
    if (jobs?.jobs) {
      const companies = new Set<string>();
      for (const j of jobs.jobs.slice(0, 100)) {
        const c = j.company ?? j.title;
        if (c && typeof c === "string" && c.length > 2) companies.add(c);
      }
      for (const c of companies) out.push({ type: "company", name: c });
    }
    return out;
  }, [industries, skills, neighborhoods, jobs]);

  const handleExportPdf = async () => {
    try {
      setExportLoading(true);

      const [{ jsPDF }, { default: html2canvas }, briefRes, scenarioRes] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
        fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/api/policy-brief`).catch(
          () => null
        ),
        fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/api/scenario`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario:
              "If current hiring and economic signal patterns continue in Montgomery over the next 6-12 months",
          }),
        }).catch(() => null),
      ]);

      let brief: PolicyBrief = {};
      if (briefRes && briefRes.ok) {
        brief = (await briefRes.json()) as PolicyBrief;
      }

      let forecast: { [key: string]: string } | null = null;
      if (scenarioRes && scenarioRes.ok) {
        const data = (await scenarioRes.json()) as { projected?: Record<string, string> };
        if (data.projected) {
          forecast = data.projected;
        }
      }

      const doc = new jsPDF();
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      const addPageIfNeeded = (y: number, minSpace = 20) => {
        if (y + minSpace > pageH - 15) {
          doc.addPage();
          return 20;
        }
        return y;
      };

      const addTitle = (title: string, subtitle?: string) => {
        let y = 24;
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(title, 20, y);
        y += 8;
        doc.setFontSize(11);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 100, 100);
        if (subtitle) {
          doc.text(subtitle, 20, y);
          y += 5;
        }
        doc.text("Prepared for Montgomery city leadership", 20, y);
        y += 5;
        doc.text(`Generated: ${new Date().toLocaleString()}`, 20, y);
        y += 10;
        doc.setTextColor(0, 0, 0);
        return y;
      };

      const addSectionHeading = (title: string, y: number) => {
        y = addPageIfNeeded(y);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(title, 20, y);
        y += 7;
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        return y;
      };

      const addBulletLines = (lines: string[], y: number) => {
        for (const line of lines) {
          y = addPageIfNeeded(y);
          const wrapped = doc.splitTextToSize(line, pageW - 36);
          wrapped.forEach((ln) => {
            doc.text(`• ${ln}`, 24, y);
            y += 5;
          });
        }
        y += 3;
        return y;
      };

      // Cover page
      let y = addTitle("Workforce Pulse Workforce Report", "Montgomery, Alabama");
      y = addSectionHeading("Workforce at a glance", y);
      const total = jobs?.summary.total_active_postings ?? 0;
      const publicPct = jobs ? Math.round((jobs.summary.public_ratio ?? 0) * 100) : null;
      const topIndustry = jobs?.summary.top_growing_industry ?? "—";
      const newBiz = jobs?.summary.new_businesses_this_month ?? 0;
      const coverLines = [
        `Total active postings detected: ${total}`,
        publicPct !== null ? `Public sector share of jobs: ${publicPct}%` : "Public sector share of jobs: —",
        `Top growing industry: ${topIndustry}`,
        `New businesses registered this month: ${newBiz}`,
      ];
      y = addBulletLines(coverLines, y);
      doc.addPage();

      // 1. Key Workforce Insights (from policy brief)
      y = addSectionHeading("Key Workforce Insights", 24);
      const findings = brief.key_findings && brief.key_findings.length > 0 ? brief.key_findings : insights ?? [];
      (findings.slice(0, 5) as string[]).forEach((f, idx) => {
        y = addPageIfNeeded(y);
        const title = `Insight ${idx + 1}`;
        doc.setFont("helvetica", "bold");
        doc.text(title, 20, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        const wrapped = doc.splitTextToSize(f, pageW - 36);
        wrapped.forEach((ln) => {
          doc.text(ln, 24, y);
          y += 5;
        });
        y += 3;
      });

      // 2. Workforce Trend Narrative
      doc.addPage();
      y = addSectionHeading("Workforce Trend Narrative", 24);
      const narrative =
        brief.executive_summary ??
        (insights && insights.length
          ? `Montgomery’s workforce activity shows: ${insights.slice(0, 3).join(" ")}`
          : "Montgomery’s workforce activity remains strong, with private sector hiring leading overall demand.");
      const narrativeWrapped = doc.splitTextToSize(narrative, pageW - 36);
      narrativeWrapped.forEach((ln) => {
        y = addPageIfNeeded(y);
        doc.text(ln, 20, y);
        y += 5;
      });

      // 3. Signal → Impact analysis
      y += 5;
      y = addSectionHeading("Economic Signals – From Signal to Workforce Impact", y);
      if (signals?.signals?.length) {
        const grouped: Record<string, number> = {};
        (signals.signals as any[]).forEach((s) => {
          const key = s.signal_type ?? "other";
          grouped[key] = (grouped[key] ?? 0) + 1;
        });
        Object.entries(grouped)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 4)
          .forEach(([signalType, count]) => {
            y = addPageIfNeeded(y);
            doc.setFont("helvetica", "bold");
            doc.text(`Signal detected: ${signalType} (${count})`, 20, y);
            y += 5;
            doc.setFont("helvetica", "normal");
            const impacts: string[] = [];
            if (signalType === "data_center") {
              impacts.push(
                "Increased demand for cloud engineers and infrastructure specialists.",
                "Growth in construction, electrical trades, and data center operations roles."
              );
            } else if (signalType === "defense_contract" || signalType === "company_profile") {
              impacts.push(
                "Higher demand for defense, aerospace, and cyber roles near Maxwell–Gunter.",
                "Opportunity to expand federal contracting and support services talent pipelines."
              );
            } else if (signalType === "new_business" || signalType === "expansion") {
              impacts.push(
                "Net job creation across retail, services, and logistics.",
                "Need for small business support and training in operations and management."
              );
            } else {
              impacts.push("Additional workforce demand in the corresponding industry segment.");
            }
            y = addBulletLines(
              ["Potential workforce impact:", ...impacts.map((i) => `- ${i}`)],
              y
            );
          });
      } else {
        y = addBulletLines(
          ["No economic signals are available yet. Run the deep data collection pipeline to populate this section."],
          y
        );
      }

      // 4. Workforce Gap Score
      doc.addPage();
      y = addSectionHeading("Workforce Gap Score", 24);
      let gapScore = 50;
      if (skills?.skills_gap_list?.length) {
        const totalGaps = skills.skills_gap_list.length;
        const withoutTraining = skills.skills_gap_list.filter((g) => !g.local_training_available).length;
        const severity = totalGaps ? withoutTraining / totalGaps : 0;
        gapScore = Math.min(100, Math.max(0, Math.round(40 + severity * 60)));
      }
      const interpretation =
        gapScore < 40
          ? "Balanced workforce – most in-demand skills have adequate local training supply."
          : gapScore < 70
            ? "Moderate skill gaps – targeted interventions needed in key growth sectors."
            : "Critical shortages – systemic workforce constraints in priority sectors.";
      y = addBulletLines(
        [
          `Workforce Gap Score: ${gapScore} / 100`,
          "Scale: 0–40 → Balanced, 40–70 → Moderate gaps, 70–100 → Critical shortage.",
          interpretation,
          "Montgomery shows emerging shortages in cloud computing, cybersecurity, and advanced healthcare roles.",
        ],
        y
      );

      // 5. Skills by sector clusters
      doc.addPage();
      y = addSectionHeading("Skills by Sector Cluster", 24);
      const techSkills: string[] = [];
      const healthSkills: string[] = [];
      const bizSkills: string[] = [];
      (skills?.in_demand_skills_list ?? []).forEach((s) => {
        if (typeof s !== "string") return;
        const lower = s.toLowerCase();
        if (
          lower.includes("cloud") ||
          lower.includes("aws") ||
          lower.includes("python") ||
          lower.includes("data") ||
          lower.includes("cyber")
        ) {
          techSkills.push(s);
        } else if (
          lower.includes("nurs") ||
          lower.includes("clinic") ||
          lower.includes("medical") ||
          lower.includes("patient")
        ) {
          healthSkills.push(s);
        } else {
          bizSkills.push(s);
        }
      });
      const addCluster = (title: string, list: string[], yStart: number) => {
        let yy = addSectionHeading(title, yStart);
        if (!list.length) {
          yy = addBulletLines(["No prominent skills identified in this cluster."], yy);
        } else {
          yy = addBulletLines(list.map((s) => s), yy);
        }
        return yy;
      };
      y = addCluster("Technology Skills", y);
      doc.addPage();
      y = addCluster("Healthcare Skills", 24);
      y = addCluster("Business & Management Skills", y);

      // 6. Geographic workforce insights
      doc.addPage();
      y = addSectionHeading("Geographic Workforce Insights", 24);
      const areas = neighborhoods?.neighborhoods ?? [];
      if (areas.length) {
        const sorted = [...areas].sort((a, b) => b.job_density_score - a.job_density_score);
        const topArea = sorted[0];
        const defenseArea = sorted.find((a) => a.top_sector === "federal") ?? topArea;
        const geoLines = [
          `Highest job density observed in: ${topArea.name} (top sector: ${topArea.top_sector}).`,
          `Defense and federal employment is most concentrated around: ${defenseArea.name}.`,
          "Hiring activity clusters around central Montgomery and areas adjacent to Maxwell–Gunter Air Force Base.",
        ];
        y = addBulletLines(geoLines, y);
      } else {
        y = addBulletLines(
          ["Neighborhood-level insights are unavailable until the data pipeline has been run at least once."],
          y
        );
      }

      // 7. Policy recommendations
      doc.addPage();
      y = addSectionHeading("Recommended Workforce Actions", 24);
      const recs =
        brief.recommended_actions && brief.recommended_actions.length
          ? brief.recommended_actions
          : [
              "Expand cybersecurity and cloud training programs at Alabama State University and Trenholm State.",
              "Partner with major cloud providers to co-develop cloud certification pathways.",
              "Invest in workforce pipelines for healthcare and emergency services to meet growing demand.",
            ];
      y = addBulletLines(recs as string[], y);

      // 8. Workforce Outlook (Next 6–12 Months)
      doc.addPage();
      y = addSectionHeading("Workforce Outlook (Next 6–12 Months)", 24);
      if (forecast) {
        const keys = Object.keys(forecast);
        const lines = keys.map((k) => `${k.replace(/_/g, " ")}: ${forecast![k]}`);
        y = addBulletLines(lines, y);
      } else {
        y = addBulletLines(
          [
            "If current hiring patterns persist, demand is expected to grow in technology, healthcare, and public safety.",
            "Data center and defense-related investments could materially increase the need for cloud, cyber, and advanced technical roles.",
          ],
          y
        );
      }

      // 9. Charts – high quality exports of key visuals
      const chartIds = [
        { id: "section-hiring-trends", title: "Hiring Trends by Industry" },
        { id: "section-industry-breakdown", title: "Top Industries by Job Volume" },
        { id: "section-skills-gap", title: "Skills Demand and Training Alignment" },
      ];
      for (const { id, title } of chartIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        doc.addPage();
        let yy = addSectionHeading(title, 24);
        const canvas = await html2canvas(el, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#020617",
        });
        const imgData = canvas.toDataURL("image/png");
        const imgWidth = pageW - 24;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        yy = addPageIfNeeded(yy, imgHeight + 10);
        doc.addImage(imgData, "PNG", 12, yy, imgWidth, imgHeight);
      }

      // 10. Appendix – raw data snapshot
      doc.addPage();
      y = addSectionHeading("Appendix: Data Snapshot", 24);
      if (industries?.by_industry) {
        y = addSectionHeading("Industry counts (latest trends)", y);
        Object.entries(industries.by_industry)
          .sort((a, b) => (b[1] as number) - (a[1] as number))
          .forEach(([name, value]) => {
            y = addPageIfNeeded(y);
            doc.text(`${name}: ${value}`, 24, y);
            y += 5;
          });
      }
      if (signals?.signals?.length) {
        y += 5;
        y = addSectionHeading("Economic signal breakdown", y);
        const grouped: Record<string, number> = {};
        (signals.signals as any[]).forEach((s) => {
          const key = s.signal_type ?? "other";
          grouped[key] = (grouped[key] ?? 0) + 1;
        });
        Object.entries(grouped)
          .sort((a, b) => b[1] - a[1])
          .forEach(([type, count]) => {
            y = addPageIfNeeded(y);
            doc.text(`${type}: ${count}`, 24, y);
            y += 5;
          });
      }
      if (skills?.skills_gap_list?.length) {
        y += 5;
        y = addSectionHeading("Skills gaps (raw)", y);
        skills.skills_gap_list.slice(0, 20).forEach((g) => {
          const label = `${g.skill} – training available: ${g.local_training_available ? "yes" : "no"}`;
          y = addPageIfNeeded(y);
          doc.text(label, 24, y);
          y += 5;
        });
      }

      doc.save("workforce-pulse-report.pdf");
    } catch (e) {
      if (typeof window !== "undefined") window.print();
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <TopNav
      searchSuggestions={searchSuggestions}
      onExportPdf={handleExportPdf}
      exportLoading={exportLoading}
    />
  );
}


