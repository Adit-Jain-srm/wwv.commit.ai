"use client";

import { useState } from "react";
import { ScenarioSimulator } from "../../../components/dashboard/ScenarioSimulator";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Zap } from "lucide-react";

const PRESET_CARDS = [
  {
    title: "New Data Center",
    desc: "What happens if a new data center opens in Montgomery?",
    scenario: "A major cloud provider (AWS, Google, or Meta) opens a new data center campus in Montgomery, AL.",
  },
  {
    title: "Defense Contract Increase",
    desc: "What if defense contracts at Maxwell-Gunter increase by 20%?",
    scenario: "Defense contracts at Maxwell-Gunter AFB increase by 20%, expanding operations and hiring.",
  },
  {
    title: "New Manufacturing Plant",
    desc: "A new manufacturing plant opens near Hyundai HMMA.",
    scenario: "A new advanced manufacturing plant opens near the Hyundai facility in Montgomery, creating assembly and skilled trades positions.",
  },
  {
    title: "University Expansion",
    desc: "ASU or AUM launches new workforce-aligned programs.",
    scenario: "Alabama State University and Auburn University Montgomery launch new degree programs in cybersecurity, AI, and healthcare informatics.",
  },
  {
    title: "Data Center Expansion Impact",
    desc: "Model infrastructure strain and job creation from new data center campus.",
    scenario: "AWS or Google opens a 500MW data center campus in Montgomery. Model the impact on local hiring, utility infrastructure strain, housing demand, and workforce skills requirements.",
  },
];

export default function ScenariosPage() {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  return (
    <div className="mx-auto w-full max-w-[1600px] gap-3 px-3 py-4 laptop:px-4 desktop:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Workforce Digital Twin — Scenario Engine</h1>
        <p className="text-sm text-slate-400">
          Model the workforce impact of policy changes, industry shifts, and infrastructure investments before committing resources.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ScenarioSimulator
          initialScenario={activeScenario ?? undefined}
          autoRun={activeScenario != null}
          key={activeScenario}
        />
        <Card className="border-violet-900/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold text-slate-200">
              <Zap className="h-4 w-4 text-violet-400" />
              Quick scenarios
            </CardTitle>
            <p className="text-[11px] text-slate-500">
              Click a card to run it through AI simulation.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {PRESET_CARDS.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => setActiveScenario(card.scenario)}
                className={`w-full text-left rounded-lg border px-4 py-3 transition-colors ${
                  activeScenario === card.scenario
                    ? "border-violet-600 bg-violet-950/30"
                    : "border-slate-800/80 bg-slate-950/50 hover:border-violet-700 hover:bg-violet-950/20"
                }`}
              >
                <h3 className="text-sm font-semibold text-slate-100">{card.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{card.desc}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
