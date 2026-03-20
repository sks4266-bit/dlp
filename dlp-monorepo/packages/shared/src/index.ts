export type UrgentPrayer = {
  id: string;
  authorName: string;
  content: string;
  createdAt: number;
  expiresAt: number;
};

export type McheyneDayPlan = {
  month: number;
  day: number;
  reading1: string;
  reading2: string;
  reading3: string;
  reading4: string;
};
