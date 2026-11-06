'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useWorkshopOverview } from '../../../hooks/use-workshop-overview';
import { useEnrollment } from '../../../hooks/use-enrollment';
import { NeoBadge } from '../../../components/ui/NeoBadge';
import { NeoButton } from '../../../components/ui/NeoButton';
import { NeoCard } from '../../../components/ui/NeoCard';
import { Skeleton } from '../../../components/ui/Skeleton';
import { StarterDownloadModal } from '../../../components/workshop/StarterDownloadModal';

export default function WorkshopOverviewPage() {
  const params = useParams();
  const workshopSlug = String(params.workshop);
  const { workshop, isLoading, isError, error, refetch } = useWorkshopOverview(workshopSlug);

  const {
    progress,
    isEnrolled,
    enrolledLanguage,
    enroll,
    isEnrolling,
    starterInfo,
    fetchStarter,
    isDownloadModalOpen,
    setDownloadModalOpen,
  } = useEnrollment(workshopSlug);

  const [selectedLanguage, setSelectedLanguage] = useState<string>('go');

  useEffect(() => {
    if (enrolledLanguage) {
      setSelectedLanguage(enrolledLanguage);
    } else if (workshop?.languages && workshop.languages.length > 0) {
      setSelectedLanguage(workshop.languages[0]);
    }
  }, [enrolledLanguage, workshop?.languages]);

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto py-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-14 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      </div>
    );
  }

  if (isError || !workshop) {
    return (
      <NeoCard shadow="xl" className="max-w-xl mx-auto my-12 p-8 text-center space-y-4 bg-[#FEE2E2]">
        <h2 className="text-xl font-extrabold text-black">Workshop Not Found</h2>
        <p className="text-sm text-theme-muted">
          {error?.message || `Unable to load workshop "${workshopSlug}"`}
        </p>
        <NeoButton variant="yellow" size="sm" onClick={() => refetch()}>
          Retry Loading
        </NeoButton>
      </NeoCard>
    );
  }

  const firstChapter = workshop.chapters[0];
  const firstStep = firstChapter?.steps[0];
  const firstStepUrl =
    firstStep && firstChapter
      ? `/workshops/${workshop.slug}/chapters/${firstChapter.slug}/steps/${firstStep.slug}`
      : undefined;

  // Compute step statuses from enrollment progress
  const stepStatusMap: Record<string, string> = {};
  if (progress?.steps) {
    for (const s of progress.steps) {
      stepStatusMap[s.stepSlug] = s.status;
    }
  }

  const handleEnrollOrDownload = async () => {
    if (isEnrolled && starterInfo) {
      setDownloadModalOpen(true);
    } else if (isEnrolled) {
      await fetchStarter(selectedLanguage);
    } else {
      await enroll(selectedLanguage);
    }
  };

  return (
    <div className="space-y-12 max-w-5xl mx-auto py-6">
      {/* Hero Header Section */}
      <div className="space-y-6 border-b-2 border-black pb-10">
        <div>
          <NeoBadge
            variant="pink"
            hasShadow
            className="font-mono text-xs font-bold px-3 py-1 tracking-tight mb-3"
          >
            HANDRAIL WORKSHOP • SYSTEMS ENGINE
          </NeoBadge>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <NeoBadge variant="white" className="font-mono text-xs font-bold uppercase py-0.5 px-2.5">
            {workshop.difficulty}
          </NeoBadge>
          <span className="text-xs font-mono font-bold text-black tracking-tight">
            {workshop.totalSteps} Total Steps • {workshop.estimatedTime}
          </span>
          {isEnrolled && enrolledLanguage && (
            <NeoBadge variant="yellow" hasShadow className="font-mono text-xs font-bold uppercase">
              Enrolled ({enrolledLanguage.toUpperCase()})
            </NeoBadge>
          )}
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-black">
          {workshop.title}
        </h1>
        <p className="text-base sm:text-lg text-theme-muted max-w-3xl leading-relaxed">
          {workshop.summary}
        </p>

        {/* Language Picker & Action CTA */}
        <div className="pt-4 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="space-y-1.5">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-black">
              Select Language Option:
            </span>
            <div className="flex gap-2">
              {workshop.languages.map((lang) => {
                const isSelected = selectedLanguage === lang;
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-3 py-1.5 text-xs font-mono font-bold border-2 border-black rounded-[2px] uppercase transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-theme-yellow text-black shadow-hard-sm'
                        : 'bg-white hover:bg-slate-100 text-black'
                    }`}
                  >
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 sm:pt-4 flex flex-wrap items-center gap-4">
            <NeoButton
              variant="yellow"
              size="lg"
              onClick={handleEnrollOrDownload}
              disabled={isEnrolling}
            >
              {isEnrolling
                ? 'Preparing Starter...'
                : isEnrolled
                ? '⬇ Download Starter Package'
                : `Enroll & Download Starter (${selectedLanguage.toUpperCase()}) →`}
            </NeoButton>

            {firstStepUrl && (
              <Link href={firstStepUrl}>
                <NeoButton variant="white" size="lg">
                  Go to Step 1 →
                </NeoButton>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Grid: What We Build & What You'll Learn */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <NeoCard shadow="lg" className="overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-theme-blue border-b-2 border-black px-5 py-3">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-black">
                What We Build
              </h3>
            </div>
            <div className="p-6 text-sm text-black leading-relaxed font-sans">
              {workshop.whatWeBuild}
            </div>
          </div>
        </NeoCard>

        <NeoCard shadow="lg" className="overflow-hidden flex flex-col justify-between">
          <div>
            <div className="bg-theme-yellow border-b-2 border-black px-5 py-3">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-black">
                What You Will Learn
              </h3>
            </div>
            <div className="p-6">
              <ul className="space-y-3 text-sm text-black font-sans">
                {workshop.whatYouLearn.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="shrink-0 bg-theme-green text-black border-2 border-black rounded-[2px] font-mono font-bold text-[10px] px-1 py-0.5 leading-none">
                      ✓
                    </span>
                    <span className="leading-snug">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </NeoCard>
      </div>

      {/* Grid: Prerequisites & Limitations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <NeoCard shadow="md" className="overflow-hidden">
          <div className="bg-white border-b-2 border-black px-5 py-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-black">
              Prerequisites
            </h3>
          </div>
          <div className="p-6">
            <ul className="space-y-2 text-xs text-theme-muted font-sans">
              {workshop.prerequisites.map((p, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-black font-bold">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </NeoCard>

        <NeoCard shadow="md" className="overflow-hidden">
          <div className="bg-white border-b-2 border-black px-5 py-3">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-black">
              Limitations & Scope
            </h3>
          </div>
          <div className="p-6">
            <ul className="space-y-2 text-xs text-theme-muted font-sans">
              {workshop.limitations.map((l, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="text-black font-bold">•</span>
                  <span>{l}</span>
                </li>
              ))}
            </ul>
          </div>
        </NeoCard>
      </div>

      {/* Syllabus: Chapters and Steps */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-black">
              Workshop Syllabus ({workshop.totalSteps} Steps)
            </h2>
            <p className="text-sm text-theme-muted">
              Steps are sequential. Complete each step by pushing to GitHub to unlock subsequent steps.
            </p>
          </div>
          {isEnrolled && (
            <NeoBadge variant="pink" hasShadow className="font-mono text-xs font-bold uppercase self-start sm:self-auto">
              Progression Active
            </NeoBadge>
          )}
        </div>

        <div className="space-y-6">
          {workshop.chapters.map((chapter) => (
            <NeoCard key={chapter.id} shadow="lg" className="overflow-hidden">
              {/* Chapter Header */}
              <div className="bg-theme-yellow border-b-2 border-black p-4 sm:px-6 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-black">
                    Chapter {chapter.orderIndex}
                  </span>
                  <h3 className="text-base sm:text-lg font-extrabold text-black">
                    {chapter.title}
                  </h3>
                </div>
                <NeoBadge variant="white" className="font-mono text-xs font-bold">
                  {chapter.steps.length} Steps
                </NeoBadge>
              </div>

              {/* Steps List */}
              <div className="divide-y-2 divide-black">
                {chapter.steps.map((step) => {
                  const status =
                    stepStatusMap[step.slug] ||
                    (step.globalOrder === 1 ? 'AVAILABLE' : 'LOCKED');
                  const isLocked = status === 'LOCKED';

                  return (
                    <div
                      key={step.id}
                      className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-stone-50 transition"
                    >
                      <div className="flex items-center space-x-3.5">
                        <span className="flex items-center justify-center h-7 w-7 rounded-[2px] bg-black text-white text-xs font-mono font-bold border-2 border-black shrink-0">
                          {step.globalOrder}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-black">
                            {step.title}
                          </div>
                          <div className="text-xs text-theme-muted font-mono">
                            {step.testCount} automated test{step.testCount === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        {status === 'COMPLETED' ? (
                          <NeoBadge variant="pink">Completed ✓</NeoBadge>
                        ) : status === 'AVAILABLE' ? (
                          <NeoBadge variant="blue">Available</NeoBadge>
                        ) : (
                          <NeoBadge variant="neutral">Locked 🔒</NeoBadge>
                        )}

                        <Link
                          href={`/workshops/${workshop.slug}/chapters/${chapter.slug}/steps/${step.slug}`}
                        >
                          <NeoButton
                            variant={isLocked ? 'white' : 'yellow'}
                            size="sm"
                            className={isLocked ? 'opacity-80' : ''}
                          >
                            View Step →
                          </NeoButton>
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </NeoCard>
          ))}
        </div>
      </div>

      {/* Starter Download Modal */}
      <StarterDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        starterInfo={starterInfo}
        firstStepUrl={firstStepUrl}
        firstStepTitle={firstStep ? `Start Step 1: ${firstStep.title}` : 'Start Step 1'}
      />
    </div>
  );
}
