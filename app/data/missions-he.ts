export interface Mission {
  id: string;
  title: string;
  description: string;
  instructionIds: string[];
}

export const missionsHe: Mission[] = [
  {
    id: "beginner-setup",
    title: "מדריך התקנה למתחילים",
    description:
      "הדרכה מלאה למשתמשים חדשים להתחיל לעבוד עם הפלטפורמה. עקבו אחר חמשת השלבים החיוניים הללו כדי להגדיר את החשבון שלכם ולהתחיל לעבוד ביעילות.",
    instructionIds: ["1", "2", "3", "4", "5"],
  },
  {
    id: "advanced-config",
    title: "תצורה מתקדמת",
    description:
      "למדו הגדרות פרופיל מתקדמות וניתוחים כדי לבצע אופטימיזציה של זרימת העבודה שלכם ולקבל תובנות על ביצועי הפרויקט שלכם.",
    instructionIds: ["2", "5"],
  },
];
