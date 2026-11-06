'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useWorkshopOverview } from '@/hooks/use-workshop-overview';
import { useStepDetail } from '@/hooks/use-step-detail';
import { useEnrollment } from '@/hooks/use-enrollment';
import { StepsRail } from '@/components/workshop/StepsRail';
import { StepContentPanel } from '@/components/workshop/StepContentPanel';
import { VerificationPanelPlaceholder } from '@/components/workshop/VerificationPanelPlaceholder';
import { StarterDownloadModal } from '@/components/workshop/StarterDownloadModal';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';

export default function StepWorkspacePage() {
  const params = useParams();
  const workshopSlug = String(params.workshop);
  const chapterSlug = String(params.chapter);
  const stepSlug = String(params.step);

  const { workshop, isLoading: isWorkshopLoading } = useWorkshopOverview(workshopSlug);
  const {
    progress,
    starterInfo,
    fetchStarter,
    isDownloadModalOpen,
    setDownloadModalOpen,
  } = useEnrollment(workshopSlug);

  const {
    step,
    isLoading: isStepLoading,
    isError,
    error,
    level,
    activeTaskMdx,
    activeTheoryMdx,
    activeHintsMdx,
    tests,
  } = useStepDetail(workshopSlug, stepSlug);

  if (isWorkshopLoading || isStepLoading) {
    return (
      <div className="flex flex-col lg:flex-row gap-6 py-4">
        <Skeleton className="w-full lg:w-72 h-[600px] rounded-2xl" />
        <Skeleton className="flex-1 h-[600px] rounded-2xl" />
        <Skeleton className="w-full xl:w-80 h-[300px] rounded-2xl hidden xl:block" />
      </div>
    );
  }

  if (isError || !step || !workshop) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 text-center bg-red-950/40 border border-red-800 rounded-2xl space-y-4">
        <h2 className="text-xl font-bold text-red-200">Step Not Found</h2>
        <p className="text-sm text-red-300">
          {error?.message || `Unable to load step "${stepSlug}"`}
        </p>
        <Link href={`/workshops/${workshopSlug}`}>
          <Button variant="outline" size="sm">
            Back to Workshop Overview
          </Button>
        </Link>
      </div>
    );
  }

  // Calculate real step statuses
  const stepStatuses: Record<string, 'LOCKED' | 'AVAILABLE' | 'COMPLETED'> = {};
  if (progress?.steps && progress.steps.length > 0) {
    for (const s of progress.steps) {
      stepStatuses[s.stepSlug] = s.status;
    }
  } else {
    // If not enrolled yet, first step is available, remainder locked
    let first = true;
    for (const ch of workshop.chapters) {
      for (const st of ch.steps) {
        stepStatuses[st.slug] = first ? 'AVAILABLE' : 'LOCKED';
        first = false;
      }
    }
  }

  const handleOpenStarterModal = async () => {
    if (starterInfo) {
      setDownloadModalOpen(true);
    } else {
      const lang = progress?.language || workshop.languages[0] || 'go';
      await fetchStarter(lang);
    }
  };

  return (
    <div className="space-y-4 py-2">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-xs text-slate-400 font-mono">
        <Link href="/workshops" className="hover:text-white transition">
          Workshops
        </Link>
        <span>/</span>
        <Link href={`/workshops/${workshopSlug}`} className="hover:text-white transition">
          {workshop.title}
        </Link>
        <span>/</span>
        <span className="text-emerald-400">Step {step.globalOrder}: {step.title}</span>
      </nav>

      {/* 3-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left: Steps Rail */}
        <StepsRail
          workshopSlug={workshopSlug}
          chapters={workshop.chapters}
          activeStepSlug={stepSlug}
          stepStatuses={stepStatuses}
        />

        {/* Center: Step Task & Theory Content with Live Level Switcher */}
        <StepContentPanel
          step={step}
          workshopSlug={workshopSlug}
          activeLevel={level}
          taskMdx={activeTaskMdx}
          theoryMdx={activeTheoryMdx}
          hintsMdx={activeHintsMdx}
          tests={tests}
        />

        {/* Right: Verification Engine Panel */}
        <VerificationPanelPlaceholder
          stepSlug={stepSlug}
          workshopSlug={workshopSlug}
          onOpenStarterModal={handleOpenStarterModal}
        />
      </div>

      {/* Starter Download Modal */}
      <StarterDownloadModal
        isOpen={isDownloadModalOpen}
        onClose={() => setDownloadModalOpen(false)}
        starterInfo={starterInfo}
      />
    </div>
  );
}
