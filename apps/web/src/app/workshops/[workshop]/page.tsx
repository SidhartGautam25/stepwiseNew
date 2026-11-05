'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useWorkshopOverview } from '../../../hooks/use-workshop-overview';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/Card';
import { Skeleton } from '../../../components/ui/Skeleton';

export default function WorkshopOverviewPage() {
  const params = useParams();
  const workshopSlug = String(params.workshop);
  const { workshop, isLoading, isError, error, refetch } = useWorkshopOverview(workshopSlug);

  const [selectedLanguage, setSelectedLanguage] = useState<string>('go');

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto py-6">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !workshop) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 text-center bg-red-950/40 border border-red-800 rounded-2xl space-y-4">
        <h2 className="text-xl font-bold text-red-200">Workshop Not Found</h2>
        <p className="text-sm text-red-300">
          {error?.message || `Unable to load workshop "${workshopSlug}"`}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const firstChapter = workshop.chapters[0];
  const firstStep = firstChapter?.steps[0];

  return (
    <div className="space-y-10 max-w-5xl mx-auto py-6">
      {/* Hero Header */}
      <div className="space-y-4 border-b border-slate-800 pb-8">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="emerald">{workshop.difficulty}</Badge>
          <span className="text-xs font-mono text-slate-400">
            {workshop.totalSteps} Total Steps • {workshop.estimatedTime}
          </span>
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight text-white">
          {workshop.title}
        </h1>
        <p className="text-lg text-slate-400 max-w-3xl leading-relaxed">
          {workshop.summary}
        </p>

        {/* Language Picker & Start CTA */}
        <div className="pt-4 flex flex-wrap items-center gap-6">
          <div className="space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Select Language Option:
            </span>
            <div className="flex gap-2">
              {workshop.languages.map((lang) => {
                const isSelected = selectedLanguage === lang;
                return (
                  <Button
                    key={lang}
                    size="sm"
                    variant={isSelected ? 'emerald' : 'secondary'}
                    onClick={() => setSelectedLanguage(lang)}
                    className="capitalize font-mono"
                  >
                    {lang}
                  </Button>
                );
              })}
            </div>
          </div>

          {firstStep && firstChapter && (
            <div className="pt-5 sm:pt-0">
              <Link
                href={`/workshops/${workshop.slug}/chapters/${firstChapter.slug}/steps/${firstStep.slug}`}
              >
                <Button variant="primary" size="lg" className="shadow-lg shadow-emerald-500/20">
                  Start Step 1: {firstStep.title} →
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Grid: What We Build & What You'll Learn */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg">What We Build</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-300 leading-relaxed">
              {workshop.whatWeBuild}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg">What You Will Learn</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-slate-300">
              {workshop.whatYouLearn.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Prerequisites & Limitations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-lg">Prerequisites</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-xs text-slate-400">
              {workshop.prerequisites.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-slate-500">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/40">
          <CardHeader>
            <CardTitle className="text-lg">Limitations & Scope</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-xs text-slate-400">
              {workshop.limitations.map((l, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-slate-500">•</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Syllabus: Chapters and Steps */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            Workshop Syllabus ({workshop.totalSteps} Steps)
          </h2>
          <p className="text-sm text-slate-400">
            Chapters group steps only. Steps are unlocked sequentially across chapters.
          </p>
        </div>

        <div className="space-y-6">
          {workshop.chapters.map((chapter) => (
            <div
              key={chapter.id}
              className="border border-slate-800 rounded-2xl bg-slate-900/30 overflow-hidden"
            >
              <div className="p-4 bg-slate-900/80 border-b border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono text-emerald-400 uppercase">
                    Chapter {chapter.orderIndex}
                  </span>
                  <h3 className="text-base font-bold text-slate-100">
                    {chapter.title}
                  </h3>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  {chapter.steps.length} Steps
                </span>
              </div>

              <div className="divide-y divide-slate-800/60 p-2">
                {chapter.steps.map((step) => (
                  <Link
                    key={step.id}
                    href={`/workshops/${workshop.slug}/chapters/${chapter.slug}/steps/${step.slug}`}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-800/40 rounded-xl transition group"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="h-6 w-6 rounded-md bg-slate-800 text-slate-300 font-mono text-xs flex items-center justify-center font-semibold group-hover:bg-emerald-500 group-hover:text-slate-950 transition">
                        {step.globalOrder}
                      </span>
                      <span className="text-sm font-medium text-slate-200 group-hover:text-white transition">
                        {step.title}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3">
                      <span className="text-xs text-slate-500 font-mono">
                        {step.testCount} tests
                      </span>
                      <span className="text-slate-500 group-hover:text-emerald-400 transition">
                        →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
