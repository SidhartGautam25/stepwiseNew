import React from 'react';
import Link from 'next/link';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { WorkshopSummaryDto } from '@app/contracts';

interface WorkshopCardProps {
  workshop: WorkshopSummaryDto;
}

export function WorkshopCard({ workshop }: WorkshopCardProps) {
  return (
    <Card className="hover:border-slate-700 hover:shadow-xl hover:shadow-emerald-950/20 group flex flex-col justify-between">
      <div>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="emerald">{workshop.difficulty}</Badge>
            <span className="text-xs font-mono text-slate-500">
              {workshop.totalSteps} steps • {workshop.estimatedTime}
            </span>
          </div>
          <CardTitle className="group-hover:text-emerald-400 transition-colors">
            {workshop.title}
          </CardTitle>
          <CardDescription className="line-clamp-2">
            {workshop.summary}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Languages
            </div>
            <div className="flex flex-wrap gap-1.5">
              {workshop.languages.map((lang) => (
                <span
                  key={lang}
                  className="px-2 py-0.5 rounded-md text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700/60"
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </div>

      <CardFooter className="justify-between">
        <Link href={`/workshops/${workshop.slug}`} className="w-full">
          <Button variant="primary" className="w-full">
            View Workshop Overview →
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
