export type VisitorStatus = 'New' | 'In follow up' | 'Converted';

export interface FollowUp {
  id: number;
  visitorId: number;
  date: string;
  interactionType: 'Phone Call' | 'Home Visit' | 'Text Message' | 'Email';
  notes: string;
  nextFollowUpDate?: string;
  outcome: string;
}

export interface Visitor {
  id: number;
  name: string;
  initials: string;
  phone: string;
  email?: string;
  heardFrom: string;
  firstVisit: string;
  registeredDate: string;
  status: VisitorStatus;
  followUps?: FollowUp[];
}

export const initialVisitors: Visitor[] = [
  {
    id: 1,
    name: 'jannis sarpong',
    initials: 'JS',
    phone: '0246670114',
    firstVisit: '2025-04-16',
    registeredDate: '2025-04-16',
    status: 'In follow up',
    heardFrom: 'Family',
    followUps: [
      {
        id: 1,
        visitorId: 1,
        date: '2025-04-18',
        interactionType: 'Phone Call',
        notes:
          'Called to welcome them to the church. Had a pleasant conversation and invited them for the next service.',
        outcome: 'Positive response',
        nextFollowUpDate: '2025-04-25',
      },
    ],
  },
  {
    id: 2,
    name: 'selina owusu',
    initials: 'SO',
    phone: '050905721',
    email: 'selmaudione@gmail.com',
    firstVisit: '2025-04-10',
    registeredDate: '2025-04-10',
    status: 'Converted',
    heardFrom: 'Friend',
  },
];
