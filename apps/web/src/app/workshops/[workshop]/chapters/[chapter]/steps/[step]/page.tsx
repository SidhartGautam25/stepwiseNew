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
import { NeoCard } from '@/components/ui/NeoCard';
import { NeoButton } from '@/components/ui/NeoButton';
import { NeoBadge } from '@/components/ui/NeoBadge';

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
      <div className="flex flex-col lg:flex-row gap-6 py-6">
        <NeoCard shadow="md" className="w-full lg:w-72 h-[600px] p-4">
          <Skeleton className="h-full w-full" />
        </NeoCard>
        <NeoCard shadow="xl" className="flex-1 h-[600px] p-6">
          <Skeleton className="h-full w-full" />
        </NeoCard>
        <NeoCard shadow="md" className="w-full xl:w-80 h-[300px] p-4 hidden xl:block">
          <Skeleton className="h-full w-full" />
        </NeoCard>
      </div>
    );
  }

  if (isError || !step || !workshop) {
    return (
      <NeoCard shadow="xl" className="max-w-xl mx-auto my-12 p-8 text-center space-y-4 bg-[#FEE2E2]">
        <h2 className="text-xl font-extrabold text-black">Step Not Found</h2>
        <p className="text-sm text-theme-muted font-sans">
          {error?.message || `Unable to load step "${stepSlug}"`}
        </p>
        <Link href={`/workshops/${workshopSlug}`}>
          <NeoButton variant="yellow" size="sm">
            ← Back to Workshop Overview
          </NeoButton>
        </Link>
      </NeoCard>
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
    <div className="space-y-6 py-4">
      {/* Breadcrumb Navigation */}
      <nav className="flex items-center space-x-2 text-xs font-mono font-bold text-black flex-wrap">
        <Link href="/workshops" className="hover:underline decoration-2">
          Workshops
        </Link>
        <span>/</span>
        <Link href={`/workshops/${workshopSlug}`} className="hover:underline decoration-2">
          {workshop.title}
        </Link>
        <span>/</span>
        <NeoBadge variant="yellow" className="text-[11px] font-bold py-0.5">
          Step {step.globalOrder}: {step.title}
        </NeoBadge>
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
