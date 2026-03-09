"use client";

import { useState } from "react";
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

  const handleExportPdf = async () => {
    setExportLoading(true);
    try {
      const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
      const { default: jsPDF } = await import("jspdf");
      const { default: html2canvas } = await import("html2canvas");

      // Fetch AI-generated brief and forecast in parallel
      let brief: { executive_summary?: string; key_findings?: string[]; recommended_actions?: string[] } = {};
      let forecast: Record<string, string> = {};
      try {
        const [briefRes, forecastRes] = await Promise.all([
          fetch(`${API_BASE}/api/policy-brief`).catch(() => null),
          fetch(`${API_BASE}/api/scenario`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scenario: "If current hiring and economic signal patterns continue in Montgomery over the next 6-12 months",
            }),
          }).catch(() => null),
        ]);
        if (briefRes?.ok) brief = await briefRes.json();
        if (forecastRes?.ok) {
          const fd = await forecastRes.json();
          forecast = fd.projected ?? {};
        }
      } catch { /* proceed without AI data */ }

      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 40;
      const contentW = pageW - margin * 2;
      let pageNum = 0;

      // --- Helper functions ---
      let pageNumbered = false;

      const addPageNumber = () => {
        if (pageNumbered) return; // prevent double-numbering
        pageNumbered = true;
        pageNum++;
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${pageNum}`, pageW - margin, pageH - 20, { align: "right" });
        doc.text("CONFIDENTIAL \u2014 Prepared for Montgomery City Leadership", margin, pageH - 20);
      };

      const newPage = (): number => {
        addPageNumber();
        doc.addPage();
        pageNumbered = false;
        return 50;
      };

      const addPageIfNeeded = (y: number, space: number): number => {
        if (y + space > pageH - 40) {
          return newPage();
        }
        return y;
      };

      /** Start a new section with heading — continues on same page if room, breaks if not */
      const startSection = (num: number, title: string, y: number): number => {
        // Need ~80pt minimum for heading + some content
        if (y + 80 > pageH - 40) {
          y = newPage();
        } else {
          y += 20; // spacing between sections
        }
        return addSectionHeading(num, title, y);
      };

      const addSectionHeading = (num: number, title: string, y: number): number => {
        y = addPageIfNeeded(y, 40);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text(`${num}. ${title}`, margin, y);
        y += 6;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margin, y, pageW - margin, y);
        y += 14;
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        return y;
      };

      const addBody = (text: string, y: number): number => {
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        const lines = doc.splitTextToSize(text, contentW);
        for (const line of lines) {
          y = addPageIfNeeded(y, 14);
          doc.text(line, margin, y);
          y += 13;
        }
        return y;
      };

      const addBullet = (text: string, y: number): number => {
        const lines = doc.splitTextToSize(text, contentW - 16);
        for (let i = 0; i < lines.length; i++) {
          y = addPageIfNeeded(y, 14);
          if (i === 0) {
            doc.text("\u2022", margin + 4, y);
          }
          doc.text(lines[i], margin + 16, y);
          y += 13;
        }
        return y + 2;
      };

      const addSubheading = (text: string, y: number): number => {
        y = addPageIfNeeded(y, 24);
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(30, 41, 59);
        doc.text(text, margin, y);
        y += 16;
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(51, 65, 85);
        return y;
      };

      // =====================================================
      // COVER PAGE
      // =====================================================
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageW, pageH, "F");

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(32);
      doc.setTextColor(248, 250, 252);
      doc.text("Workforce Pulse", pageW / 2, 200, { align: "center" });

      doc.setFontSize(18);
      doc.setTextColor(148, 163, 184);
      doc.text("Workforce Intelligence Report", pageW / 2, 240, { align: "center" });

      doc.setFontSize(14);
      doc.setTextColor(56, 189, 248);
      doc.text("Montgomery, Alabama", pageW / 2, 280, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(148, 163, 184);
      doc.text("Prepared for Montgomery city leadership", pageW / 2, 340, { align: "center" });

      const now = new Date();
      doc.text(`Generated: ${now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} at ${now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`, pageW / 2, 370, { align: "center" });

      const totalJobs = jobs?.summary?.total_active_postings ?? 0;
      doc.text(`Reporting period: Last 90 days | ${totalJobs} monitored positions`, pageW / 2, 400, { align: "center" });

      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text("Powered by Bright Data + Azure AI", pageW / 2, pageH - 60, { align: "center" });
      doc.text("Workforce Pulse \u2014 wwv.commit.ai", pageW / 2, pageH - 45, { align: "center" });

      // =====================================================
      // 1. EXECUTIVE SUMMARY
      // =====================================================
      doc.addPage();
      doc.setFillColor(255, 255, 255);
      doc.rect(0, 0, pageW, pageH, "F");
      let y = 50;

      y = addSectionHeading(1, "Executive Summary", y);

      const publicPct = jobs?.summary?.public_ratio != null ? Math.round(jobs.summary.public_ratio * 100) : 41;
      const privatePct = 100 - publicPct;
      const _industryLabelMap: Record<string, string> = {
        government: "Government", defense_federal: "Defense & Federal",
        public_safety: "Public Safety", healthcare: "Healthcare",
        manufacturing: "Manufacturing", technology: "Technology",
        education: "Education", construction_trades: "Construction & Trades",
        retail_hospitality: "Retail & Hospitality", transportation: "Transportation",
      };
      const rawTopIndustry = jobs?.summary?.top_growing_industry ?? "healthcare";
      const topIndustry = _industryLabelMap[rawTopIndustry] ?? rawTopIndustry.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      const gapCount = skills?.skills_gap_list?.filter((g: any) => g.gap)?.length ?? 0;
      const totalGaps = skills?.skills_gap_list?.length ?? 1;
      const gapScore = Math.round((gapCount / Math.max(totalGaps, 1)) * 100);

      const execSummary = brief.executive_summary ??
        `Montgomery’s labor market currently shows ${totalJobs > 200 ? "active" : "moderate"} hiring activity across ${Object.keys(industries?.by_industry ?? {}).length} tracked sectors. ` +
        `The public sector accounts for approximately ${publicPct}% of monitored positions, reflecting Montgomery’s role as Alabama’s state capital and home to Maxwell\u2013Gunter Air Force Base. ` +
        `Private-sector hiring represents ${privatePct}% of activity, with ${topIndustry} emerging as the leading growth sector. ` +
        `The workforce readiness index stands at ${gapScore}/100, indicating ${gapScore < 40 ? "a relatively balanced" : gapScore < 70 ? "moderate skill shortages requiring" : "critical gaps demanding"} ` +
        `${gapScore >= 40 ? "targeted training investment" : "ongoing monitoring"}. ` +
        `Economic signals from data center investments and defense contracting suggest increasing demand for cloud computing, cybersecurity, and infrastructure-related skills.`;

      y = addBody(execSummary, y);
      y += 10;

      // Key metrics box
      y = addPageIfNeeded(y, 60);
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentW, 50, 4, 4, "S");
      doc.setFont("Helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      const metricSpacing = contentW / 4;
      const metrics = [
        { label: "Active Positions", value: totalJobs.toLocaleString() },
        { label: "Public Sector", value: `${publicPct}%` },
        { label: "Readiness Index", value: `${gapScore}/100` },
        { label: "Leading Sector", value: topIndustry },
      ];
      metrics.forEach((m, i) => {
        const center = margin + metricSpacing * (i + 0.5);
        doc.text(m.label, center, y + 18, { align: "center" });
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(30, 41, 59);
        doc.text(m.value, center, y + 36, { align: "center" });
        doc.setFont("Helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(100, 116, 139);
      });
      y += 65;

      // =====================================================
      // 2. KEY WORKFORCE INSIGHTS
      // =====================================================
      y = startSection(2, "Key Workforce Insights", y);

      // Pre-compute signal groups and gap data (needed for insights)
      const signalGroups: Record<string, number> = {};
      for (const sig of signals?.signals ?? []) {
        const t = (sig as any).signal_type ?? (sig as any).source ?? "general";
        signalGroups[t] = (signalGroups[t] ?? 0) + 1;
      }
      const sortedSignals = Object.entries(signalGroups).sort(([, a], [, b]) => b - a);
      const topGaps = (skills?.skills_gap_list ?? []).filter((g: any) => g.gap).slice(0, 8);
      const industryEntries = Object.entries(industries?.by_industry ?? {})
        .sort(([, a], [, b]) => (b as number) - (a as number));

      const findings = brief.key_findings ?? insights ?? [];
      // Build consulting-quality insights from data if raw insights are too basic
      const synthesizedInsights: string[] = [];
      if (totalJobs > 0) {
        synthesizedInsights.push(
          `Montgomery's labor market is tracking ${totalJobs} active positions across ${Object.keys(industries?.by_industry ?? {}).length} industry sectors, indicating ${totalJobs > 300 ? "robust" : totalJobs > 150 ? "moderate" : "early-stage"} hiring activity for the region.`
        );
      }
      if (industryEntries.length > 0) {
        const [topInd, topCount] = industryEntries[0];
        const topLabel = _industryLabelMap[topInd] ?? topInd.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        const topShare = totalJobs > 0 ? Math.round(((topCount as number) / totalJobs) * 100) : 0;
        synthesizedInsights.push(
          `${topLabel} leads hiring with ${topCount} positions (${topShare}% of total), reflecting Montgomery's strategic importance as ${topInd === "public_safety" ? "a public safety employment center" : topInd === "technology" ? "an emerging technology hub driven by data center investments" : topInd === "defense_federal" ? "a defense employment hub anchored by Maxwell-Gunter AFB" : `a center for ${topLabel.toLowerCase()} employment`}.`
        );
      }
      const dcSignals = signalGroups["data_center"] ?? 0;
      const defSignals = signalGroups["defense_contract"] ?? 0;
      if (dcSignals > 0 || defSignals > 0) {
        synthesizedInsights.push(
          `Economic intelligence detected ${dcSignals > 0 ? `${dcSignals} data center investment signals` : ""}${dcSignals > 0 && defSignals > 0 ? " and " : ""}${defSignals > 0 ? `${defSignals} defense contract signals` : ""}, suggesting significant near-term workforce demand in cloud infrastructure, cybersecurity, and skilled trades.`
        );
      }
      if (publicPct > 0) {
        synthesizedInsights.push(
          `Public and federal sector positions account for ${publicPct}% of monitored activity, underscoring Montgomery's dual role as state capital and military installation host. Private-sector hiring (${privatePct}%) is diversifying across healthcare, technology, and manufacturing.`
        );
      }
      if (gapScore > 0) {
        const gapTopSkills = topGaps.slice(0, 3).map((g: any) => g.skill).join(", ");
        synthesizedInsights.push(
          `Workforce readiness index stands at ${gapScore}/100${gapScore >= 40 ? `, with critical skill gaps in ${gapTopSkills || "multiple areas"}. Targeted training partnerships with local institutions are recommended to close these gaps` : ", indicating adequate alignment between employer demand and local training capacity"}.`
        );
      }
      const insightItems = (findings.length > 2 ? findings : synthesizedInsights).slice(0, 5);

      if (insightItems.length > 0) {
        insightItems.forEach((finding: string, idx: number) => {
          y = addPageIfNeeded(y, 60);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(30, 41, 59);
          doc.text(`Insight ${idx + 1}`, margin, y);
          y += 16;
          doc.setFont("Helvetica", "normal");
          doc.setFontSize(10);
          doc.setTextColor(51, 65, 85);
          const wrapped = doc.splitTextToSize(finding, contentW);
          for (const line of wrapped) {
            y = addPageIfNeeded(y, 14);
            doc.text(line, margin, y);
            y += 13;
          }
          y += 8;
        });
      } else {
        y = addBody("Run the data pipeline to generate AI-powered workforce insights.", y);
      }

      // =====================================================
      // 3. INDUSTRY HIRING OVERVIEW
      // =====================================================
      y = startSection(3, "Industry Hiring Overview", y);

      const industryDrivers: Record<string, string> = {
        government: "Montgomery serves as Alabama’s state capital, driving strong government employment across municipal, state, and legislative roles.",
        defense_federal: "Maxwell\u2013Gunter Air Force Base anchors defense employment, creating demand for cleared positions and aerospace roles.",
        healthcare: "Healthcare demand reflects regional population needs and expansion of medical services across Montgomery’s hospital systems.",
        manufacturing: "Hyundai’s automotive plant and its supplier network sustain manufacturing employment in the region.",
        technology: "Data center investments from AWS, Google, and Meta are driving new demand for cloud and IT infrastructure roles.",
        education: "Alabama State University, AUM, and Trenholm State anchor education employment and workforce training programs.",
        public_safety: "Montgomery PD and fire departments are actively recruiting to address staffing shortfalls in public safety.",
        retail_hospitality: "Retail and hospitality reflect Montgomery’s growing downtown revitalization and tourism economy.",
        transportation: "Logistics and transportation employment is tied to Montgomery’s position as a regional distribution hub.",
        construction_trades: "Construction activity reflects both data center builds and ongoing urban development projects.",
      };

      if (industryEntries.length > 0) {
        industryEntries.forEach(([ind, count], idx) => {
          y = addPageIfNeeded(y, 30);
          doc.setFont("Helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(30, 41, 59);
          doc.text(`${idx + 1}. ${ind.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`, margin, y);
          doc.setFont("Helvetica", "normal");
          doc.text(`  \u2014 ${count} positions`, margin + doc.getTextWidth(`${idx + 1}. ${ind.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}`), y);
          y += 14;
          const driver = industryDrivers[ind];
          if (driver) {
            y = addBody(driver, y);
          }
          y += 4;
        });
      } else {
        y = addBody("No industry data available. Run the data pipeline to populate industry signals.", y);
      }

      // =====================================================
      // 4. ECONOMIC SIGNALS ANALYSIS
      // =====================================================
      y = startSection(4, "Economic Signals Analysis", y);

      const signalImpacts: Record<string, string> = {
        data_center: "Data center investments may increase demand for cloud engineers, electrical infrastructure specialists, network technicians, and construction trades. These projects typically create 100-200 direct jobs with a 3x indirect multiplier.",
        defense_contract: "Defense contracts near Maxwell\u2013Gunter AFB drive demand for security-cleared professionals, cybersecurity experts, systems engineers, and aerospace roles.",
        company_profile: "Key employer monitoring tracks workforce stability. Major employers include state government agencies, Hyundai, Baptist Health, and Maxwell AFB operations.",
        new_business: "New business registrations indicate economic diversification. Growing small business formation supports retail, services, and logistics employment.",
        expansion: "Business expansion signals suggest capacity increases in existing Montgomery operations, potentially creating mid-skill positions in operations and management.",
        real_estate: "Commercial real estate activity correlates with future employment nodes. New developments create construction jobs and eventual permanent positions.",
        company_funding: "Company funding rounds indicate growth-stage employers likely to increase headcount over the next 6-12 months.",
        hiring_surge: "Hiring surge signals indicate acute talent demand, often in healthcare and public safety where staffing gaps affect service delivery.",
      };

      if (sortedSignals.length > 0) {
        y = addBody(`${(signals?.signals ?? []).length} economic signals detected across ${sortedSignals.length} categories.`, y);
        y += 6;
        for (const [type, count] of sortedSignals.slice(0, 6)) {
          y = addSubheading(`${type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} (${count} signals)`, y);
          const impact = signalImpacts[type] ?? `${count} signals detected in this category may indicate emerging workforce demand patterns.`;
          y = addBody(impact, y);
          y += 6;
        }
      } else {
        y = addBody("No economic signals collected. Run the data pipeline.", y);
      }

      // =====================================================
      // 5. WORKFORCE SKILLS ANALYSIS
      // =====================================================
      y = startSection(5, "Workforce Skills Analysis", y);

      // 6-cluster classification matching the dashboard
      const skillClusters: Record<string, string[]> = {
        "Technology Skills": [],
        "Healthcare Skills": [],
        "Defense & Cybersecurity": [],
        "Government & Administration": [],
        "Manufacturing & Trades": [],
        "Education": [],
      };

      function classifySkillPdf(s: string): string {
        const sl = s.toLowerCase();
        if (/(python|ai|ml|machine|cloud|aws|azure|gcp|data|sql|devops|kubernetes|react|node|javascript|typescript)/.test(sl)) return "Technology Skills";
        if (/(nurs|medical|patient|clinical|health|pharma|radiolog|emt|care|cna)/.test(sl)) return "Healthcare Skills";
        if (/(cyber|security|infosec|intel|intelligence|clearance|defense)/.test(sl)) return "Defense & Cybersecurity";
        if (/(policy|regulation|compliance|legislative|municipal|civic|budget|procurement|government)/.test(sl)) return "Government & Administration";
        if (/(weld|cnc|machin|assembly|forklift|hvac|plumb|electri|carpent|construct|manufactur|mechanic|logist|warehouse)/.test(sl)) return "Manufacturing & Trades";
        if (/(teach|curriculum|tutor|student|instruction|classroom|education|academic)/.test(sl)) return "Education";
        return "";
      }

      for (const sk of skills?.in_demand_skills_list ?? []) {
        if (typeof sk !== "string") continue;
        const cat = classifySkillPdf(sk);
        if (cat && skillClusters[cat]) {
          skillClusters[cat].push(sk);
        }
      }

      for (const [cluster, items] of Object.entries(skillClusters)) {
        if (items.length === 0) continue;
        y = addSubheading(cluster, y);
        for (const sk of items.slice(0, 8)) {
          y = addBullet(sk, y);
        }
        y += 4;
      }

      // =====================================================
      // 6. WORKFORCE GAP SCORE
      // =====================================================
      y = startSection(6, "Workforce Gap Score", y);

      y = addBody(`Current Score: ${gapScore} / 100`, y);
      y += 6;
      y = addBody("Interpretation scale:", y);
      y = addBullet("0\u201340: Balanced workforce \u2014 local training programs adequately match employer demand", y);
      y = addBullet("40\u201370: Moderate skill shortages \u2014 targeted training investment recommended", y);
      y = addBullet("70\u2013100: Critical shortage \u2014 urgent intervention needed across multiple skill areas", y);
      y += 6;

      const interpretation = gapScore < 40
        ? "Montgomery’s workforce is relatively balanced with current employer needs."
        : gapScore < 70
          ? "Montgomery shows moderate skill shortages. Training programs should prioritize the highest-gap skills listed below."
          : "Montgomery faces critical workforce gaps. Immediate action is recommended to expand training capacity.";
      y = addBody(interpretation, y);
      y += 8;

      y = addSubheading("Top Skills Contributing to Gap", y);
      for (const gap of topGaps) {
        const trainingNote = gap.local_training_available ? "(local training available)" : "(no local training identified)";
        y = addBullet(`${gap.skill} ${trainingNote}`, y);
      }

      // =====================================================
      // 7. GEOGRAPHIC WORKFORCE INSIGHTS
      // =====================================================
      y = startSection(7, "Geographic Workforce Insights", y);

      const sortedNeighborhoods = [...(neighborhoods?.neighborhoods ?? [])].sort((a: any, b: any) => (b.job_density_score ?? 0) - (a.job_density_score ?? 0));

      if (sortedNeighborhoods.length > 0) {
        const topArea = sortedNeighborhoods[0];
        y = addBody(`Highest job density: ${topArea.name} (density score: ${topArea.job_density_score})`, y);
        y += 4;

        const defenseArea = sortedNeighborhoods.find((n: any) => n.top_sector === "federal");
        if (defenseArea) {
          y = addBody(`Defense employment hub: ${defenseArea.name} \u2014 concentrated around Maxwell\u2013Gunter Air Force Base corridor.`, y);
          y += 4;
        }

        const deserts = sortedNeighborhoods.filter((n: any) => (n.job_density_score ?? 0) < 30);
        if (deserts.length > 0) {
          y = addBody(`Workforce access concerns: ${deserts.length} area${deserts.length > 1 ? "s" : ""} identified with low job density (score < 30), potentially indicating workforce deserts requiring transportation or economic development intervention.`, y);
          y += 4;
          for (const d of deserts.slice(0, 5)) {
            y = addBullet(`${d.name} (density: ${d.job_density_score})`, y);
          }
        }
      } else {
        y = addBody("Geographic data unavailable. Run pipeline for neighborhood-level analysis.", y);
      }

      // =====================================================
      // 8. WORKFORCE OUTLOOK
      // =====================================================
      y = startSection(8, "Workforce Outlook (Next 6\u201312 Months)", y);

      y = addBody("The following projections are AI-generated estimates based on current data patterns. They should be treated as scenario indicators, not certainties.", y);
      y += 8;

      const forecastEntries = Object.entries(forecast).filter(([k]) => !k.startsWith("_"));
      if (forecastEntries.length > 0) {
        for (const [key, value] of forecastEntries) {
          y = addBullet(`${key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}: ${value}`, y);
        }
      } else {
        y = addBullet("Technology and defense sectors expected to show continued demand growth driven by data center investments and federal contracting.", y);
        y = addBullet("Healthcare hiring likely to remain elevated due to regional population growth and facility expansion.", y);
        y = addBullet("Public safety recruitment expected to intensify as Montgomery addresses staffing shortfalls.", y);
        y = addBullet("Manufacturing employment stable, with potential growth tied to supplier network expansion around automotive plants.", y);
      }

      // =====================================================
      // 9. RECOMMENDED WORKFORCE ACTIONS
      // =====================================================
      y = startSection(9, "Recommended Workforce Actions", y);

      const actions = brief.recommended_actions ?? [
        "Expand cloud computing and cybersecurity training programs at Trenholm State and ASU to align with data center employer demand.",
        "Strengthen partnerships with AWS, Google, and Meta to develop local hiring pipelines and apprenticeship programs for data center operations.",
        "Increase public safety academy capacity and implement lateral hiring programs to address law enforcement staffing gaps.",
        "Develop skilled trades pipeline (electrical, HVAC, welding) through community college partnerships to support infrastructure construction.",
        "Create a workforce mobility program addressing transportation access gaps in low-density employment areas identified in the geographic analysis.",
      ];

      for (const action of actions) {
        y = addBullet(action, y);
      }

      // =====================================================
      // CHART SCREENSHOTS (these need full pages for images)
      // =====================================================
      const chartSections = [
        { id: "section-hiring-trends", title: "Sector Hiring Velocity \u2014 Decision Intelligence", context: "Multi-sector hiring trends over the past 90 days. Gradient fills indicate volume by industry. This chart powers the Employment Growth Velocity KPI." },
        { id: "section-industry-breakdown", title: "Sector Employment Share", context: "Relative distribution of job postings across Montgomery’s key economic sectors. Color-coded by industry taxonomy." },
        { id: "section-skills-gap", title: "Skills Demand Analysis", context: "Critical skills ranked by posting frequency. The reference line indicates market average demand across all tracked skills." },
      ];

      for (const cs of chartSections) {
        const el = document.getElementById(cs.id);
        if (!el) continue;
        try {
          const canvas = await html2canvas(el, {
            scale: 2,
            backgroundColor: "#020617",
            useCORS: true,
            logging: false,
          });
          const imgData = canvas.toDataURL("image/png");
          y = newPage();

          doc.setFont("Helvetica", "bold");
          doc.setFontSize(12);
          doc.setTextColor(30, 41, 59);
          doc.text(cs.title, margin, y);
          y += 6;
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.line(margin, y, pageW - margin, y);
          y += 12;

          doc.setFont("Helvetica", "normal");
          doc.setFontSize(9);
          doc.setTextColor(100, 116, 139);
          const contextLines = doc.splitTextToSize(cs.context, contentW);
          for (const line of contextLines) {
            doc.text(line, margin, y);
            y += 11;
          }
          y += 6;

          const imgW = contentW;
          const ratio = canvas.height / canvas.width;
          const imgH = Math.min(imgW * ratio, pageH - y - 60);
          doc.addImage(imgData, "PNG", margin, y, imgW, imgH);
          y += imgH + 10;

          addPageNumber();
        } catch { /* skip chart if capture fails */ }
      }

      // =====================================================
      // 10. APPENDIX
      // =====================================================
      y = startSection(10, "Appendix: Data Snapshot", y);

      // Industry counts
      y = addSubheading("Industry Hiring Counts", y);
      for (const [ind, count] of industryEntries.slice(0, 12)) {
        y = addBullet(`${ind.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}: ${count} positions`, y);
      }
      y += 8;

      // Signal breakdown
      y = addSubheading("Economic Signal Categories", y);
      for (const [type, count] of sortedSignals) {
        y = addBullet(`${type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}: ${count} signals`, y);
      }
      y += 8;

      // Skills gap
      y = addSubheading("Workforce Gap Indicators (Top 20)", y);
      const gapItems = (skills?.skills_gap_list ?? []).slice(0, 20);
      for (const g of gapItems) {
        const status = g.gap
          ? g.local_training_available ? "[GAP - training available]" : "[GAP - no local training]"
          : "[ALIGNED]";
        y = addBullet(`${g.skill}: ${status}`, y);
      }

      addPageNumber();

      // Save
      doc.save("workforce-pulse-report.pdf");
    } catch (err) {
      console.error("PDF export failed:", err);
      window.print();
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <TopNav
      onExportPdf={handleExportPdf}
      exportLoading={exportLoading}
    />
  );
}


