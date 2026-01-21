export interface Mission {
  id: string;
  title: string;
  description: string;
  instructions: Array<[string, string?]>; // [instructionId, customTitle?]
}

export const missions: Mission[] = [
  {
    id: "beginner-setup",
    title: "Beginner Setup Guide",
    description:
      "Complete walkthrough for new users to get started with the platform. Follow these five essential steps to set up your account and begin working effectively.",
    instructions: [["11"], ["2"], ["3"], ["4"], ["5"]],
  },
  {
    id: "advanced-config",
    title: "Advanced Configuration",
    description:
      "Learn advanced profile settings and analytics to optimize your workflow and gain insights into your project performance.",
    instructions: [["2"], ["5"], ["10"]],
  },
];
