import type { PatientDetail } from '../../../domain/models';
import type { PatientChart, TimelineEvent } from '../types';

function timelineTitle(event: Omit<TimelineEvent, 'title'>): string {
  switch (event.type) {
    case 'Encounter':
      return 'Encounter';
    case 'Condition':
      return 'Condition';
    case 'DocumentReference':
      return 'Document';
    case 'DiagnosticReport':
      return 'Diagnostic report';
    case 'ImagingStudy':
      return 'Imaging study';
  }
}

function buildTimeline(detail: PatientDetail): TimelineEvent[] {
  const encounterEvents: TimelineEvent[] = detail.encounters
    .filter((item) => Boolean(item.start))
    .map((item) => ({
      id: `encounter:${item.id}`,
      date: item.start!,
      type: 'Encounter',
      source: 'healthlake',
      title: item.classDisplay || timelineTitle({
        id: '',
        date: '',
        type: 'Encounter',
        source: 'healthlake',
      }),
    }));

  const conditionEvents: TimelineEvent[] = detail.conditions
    .filter((item) => Boolean(item.onsetDate))
    .map((item) => ({
      id: `condition:${item.id}`,
      date: item.onsetDate!,
      type: 'Condition',
      source: 'healthlake',
      title: item.display || timelineTitle({
        id: '',
        date: '',
        type: 'Condition',
        source: 'healthlake',
      }),
    }));

  const documentEvents: TimelineEvent[] = detail.documents
    .filter((item) => Boolean(item.date))
    .map((item) => ({
      id: `document:${item.id}`,
      date: item.date!,
      type: 'DocumentReference',
      source: 'healthlake',
      title: item.typeDisplay || item.description || timelineTitle({
        id: '',
        date: '',
        type: 'DocumentReference',
        source: 'healthlake',
      }),
    }));

  return [...encounterEvents, ...conditionEvents, ...documentEvents].sort((a, b) =>
    b.date.localeCompare(a.date),
  );
}

export function assemblePatientChart(detail: PatientDetail): PatientChart {
  return {
    ...detail,
    timeline: buildTimeline(detail),
  };
}
