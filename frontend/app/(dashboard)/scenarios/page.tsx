"use client";

import { ScenarioSimulator } from "../../../components/dashboard/ScenarioSimulator";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";

const PRESET_CARDS = [
  {
    title: "New Data Center",
    desc: "If a new data center opens in Montgomery",
    impact: ["+1200 tech jobs", "+18% cloud computing demand", "+35% electricity infrastructure demand"],
  },
  {
    title: "Defense Contract",
    desc: "If defense contracts increase by 20%",
    impact: ["+800 defense jobs", "+12% systems engineering demand"],
  },
  {
    title: "New Factory",
    desc: "New manufacturing plant",
    impact: ["+600 manufacturing jobs", "+15% skilled trades demand"],
  },
  {
    title: "University Expansion",
    desc: "University expansion program",
    impact: ["+400 education jobs", "+25% teaching & research demand"],
  },
];

export default function ScenariosPage() {
  return (
    <div className="mx-auto w-full max-w-[1600px] gap-3 px-3 py-4 laptop:px-4 desktop:px-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-100">Scenario Simulation</h1>
        <p className="text-sm text-slate-400">
          Simulate policy or economic changes. Use AI to project impact on jobs and skills demand.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ScenarioSimulator />
        <Card className="border-violet-900/50 shadow-lg">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-slate-200">
              Example scenarios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {PRESET_CARDS.map((card) => (
              <div
                key={card.title}
                className="rounded-lg border border-slate-800/80 bg-slate-950/50 p-4"
              >
                <h3 className="text-sm font-semibold text-slate-100">{card.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5">{card.desc}</p>
                <ul className="mt-2 space-y-1">
                  {card.impact.map((i) => (
                    <li key={i} className="text-xs text-emerald-400">
                      • {i}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
