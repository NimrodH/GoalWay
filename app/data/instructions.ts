export interface InstructionContent {
  type: "text" | "image" | "video";
  content: string;
}

export interface Instruction {
  id: string;
  title: string;
  explanation: InstructionContent[];
  type?: "default" | "link";
  missionId?: string; // For link type instructions
}

export const instructions: Instruction[] = [
  {
    id: "1",
    title: "Getting Started with the Platform",
    explanation: [
      {
        type: "text",
        content:
          "Welcome to our comprehensive platform! This guide will walk you through the essential steps to begin your journey. First, ensure you have created an account and verified your email address. This is crucial for accessing all features and maintaining security.",
      },
      {
        type: "image",
        content: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&auto=format&fit=crop",
      },
      {
        type: "text",
        content:
          "Once logged in, take a moment to explore the dashboard. Familiarize yourself with the main navigation menu, which provides access to all key sections. The interface is designed to be intuitive, with clear labels and logical groupings of related functions.",
      },
    ],
  },
  {
    id: "2",
    title: "Configuring Your Profile Setting__s",
    explanation: [
      {
        type: "text",
        content:
          "You__r profile is the foundation of your personalized experience. Navigate to the settings panel by clicking on your avatar in the top-right corner. Here, you can customize various aspects of your account, including display preferences, notification settings, and privacy controls.",
      },
      {
        type: "image",
        content: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&auto=format&fit=crop",
      },
      {
        type: "text",
        content:
          "We recommend uploading a profile picture and completing all required fields in your bio section. This helps other users recognize you and builds trust within the community. Don't forget to save your changes before navigating away from the settings page.",
      },
    ],
  },
  {
    id: "3",
    title: "Creating Your First Project",
    explanation: [
      {
        type: "text",
        content:
          'Projects are the core organizational unit within our platform. To create a new project, click the "New Project" button located in the main dashboard. You\'ll be prompted to enter a project name, description, and select relevant tags for categorization.',
      },
      {
        type: "video",
        content: "https://www.w3schools.com/html/mov_bbb.mp4",
      },
      {
        type: "text",
        content:
          "After creating your project, you can begin adding content, inviting collaborators, and setting up workflows. The project dashboard provides a centralized view of all activities, making it easy to track progress and manage tasks efficiently.",
      },
    ],
  },
  {
    id: "4",
    title: "Collaborating with Team Members",
    explanation: [
      {
        type: "text",
        content:
          'Collaboration is seamless with our built-in team features. To invite team members, navigate to your project settings and select the "Team" tab. Enter the email addresses of the people you wish to invite, and assign appropriate roles and permissions.',
      },
      {
        type: "image",
        content: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop",
      },
      {
        type: "text",
        content:
          "Team members will receive an invitation email with instructions to join. Once they accept, they'll have access to the project based on their assigned role. You can modify permissions at any time to ensure the right level of access for each team member.",
      },
      {
        type: "text",
        content:
          "Use the built-in messaging and comment features to communicate effectively. Real-time notifications keep everyone informed of important updates and changes, fostering a productive collaborative environment.",
      },
    ],
  },
  {
    id: "5",
    title: "Understanding Analytics and Reports",
    explanation: [
      {
        type: "text",
        content:
          "Our analytics dashboard provides comprehensive insights into your project performance. Access it from the main navigation menu to view detailed metrics, trends, and visualizations that help you make data-driven decisions.",
      },
      {
        type: "image",
        content: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop",
      },
      {
        type: "text",
        content:
          "The reports section allows you to generate custom reports based on specific date ranges and criteria. Export options include PDF, CSV, and Excel formats, making it easy to share insights with stakeholders or integrate data into other tools.",
      },
      {
        type: "text",
        content:
          "Set up automated report delivery to receive regular updates via email. This ensures you stay informed without having to manually check the dashboard, saving time and maintaining consistent oversight of your projects.",
      },
    ],
  },
  {
    id: "6",
    title: "Troubleshooting Common Issues",
    explanation: [
      {
        type: "text",
        content:
          "Encountering issues? Don't worry—most common problems have simple solutions. First, try refreshing your browser or clearing your cache. Many display or loading issues are resolved through these basic steps.",
      },
      {
        type: "text",
        content:
          "If you're experiencing login difficulties, verify that you're using the correct email address and password. Use the \"Forgot Password\" link to reset your credentials if needed. Ensure that cookies are enabled in your browser settings, as they are required for authentication.",
      },
      {
        type: "image",
        content: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=800&auto=format&fit=crop",
      },
      {
        type: "text",
        content:
          "For persistent issues, consult our comprehensive help documentation or contact our support team. We're available 24/7 to assist you and ensure your experience is smooth and productive. Include relevant details such as error messages, screenshots, and steps to reproduce the issue for faster resolution.",
      },
    ],
  },
  {
    id: "7",
    title: "Advanced Features and Integrations",
    explanation: [
      {
        type: "text",
        content:
          "Unlock the full potential of our platform by exploring advanced features and third-party integrations. Connect with popular tools like Slack, Google Drive, and Trello to streamline your workflow and centralize your operations.",
      },
      {
        type: "video",
        content: "https://www.w3schools.com/html/movie.mp4",
      },
      {
        type: "text",
        content:
          "Access the integrations marketplace from your account settings. Browse available integrations, read descriptions and reviews, and enable the ones that best fit your needs. Most integrations require simple OAuth authentication and can be set up in minutes.",
      },
      {
        type: "text",
        content:
          "Advanced users can leverage our API to build custom integrations and automate complex workflows. Comprehensive API documentation is available in the developer portal, complete with code examples and interactive testing tools.",
      },
    ],
  },
  {
    id: "8",
    title: "Security Best Practices",
    explanation: [
      {
        type: "text",
        content:
          "Protecting your account and data is paramount. Always use a strong, unique password that combines uppercase and lowercase letters, numbers, and special characters. Avoid using the same password across multiple platforms.",
      },
      {
        type: "image",
        content: "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop",
      },
      {
        type: "text",
        content:
          "Enable two-factor authentication (2FA) for an additional layer of security. This requires a verification code from your mobile device in addition to your password when logging in. We support authenticator apps like Google Authenticator and Authy.",
      },
      {
        type: "text",
        content:
          "Regularly review your account activity and connected devices. If you notice any suspicious activity, immediately change your password and revoke access from unrecognized devices. Our security team monitors for unusual patterns and will alert you to potential threats.",
      },
    ],
  },
  {
    "id": "9",
    "title": "כותרת המשימ",
    "explanation": [
      {
        "type": "text",
        "content": "טקסט בעברית"
      },
      {
        "type": "text",
        "content": ""
      }
    ]
  },
  {
    id: "10",
    title: "Placeholder",
    type: "link",
    missionId: "beginner-setup",
    explanation: [],
  },
];
