import { PriorityEmail, PriorityRule, VipPerson, AppSettings, ConnectedAccount } from '../types';

export const mockConnectedAccounts: ConnectedAccount[] = [
  { id: 'personal', email: 'personal@gmail.com', displayName: 'Tiesha Personal', isPrimary: true, status: 'demo' },
  { id: 'college', email: 'college@gmail.com', displayName: 'College', isPrimary: false, status: 'demo' },
  { id: 'work', email: 'work@gmail.com', displayName: 'Work', isPrimary: false, status: 'demo' },
];

export const initialMockEmails: PriorityEmail[] = [
  {
    id: 'email-1',
    accountId: 'college',
    accountEmail: 'college@gmail.com',
    gmailMessageId: 'mock-message-1',
    gmailThreadId: '18de921b714fa01',
    senderName: 'Placement Cell',
    senderEmail: 'placement@sies.edu.in',
    subject: 'AI Engineer Internship — Application Closes Tomorrow',
    snippet: 'Final reminder: The application portal for the Summer 2026 AI Research & Engineering internship will close tomorrow at 5:00 PM IST.',
    body: `Dear Tiesha,

This is a high-priority reminder from the Central Placement Office regarding the AI Engineer Internship at DeepLogic Labs.

Role: AI / Machine Learning Engineering Intern
Stipend: $2,500 / month
Location: Hybrid (Campus / Remote)
Application Deadline: Tomorrow, 5:00 PM IST

Requirements:
1. Updated resume with GitHub & project links.
2. Statement of purpose (max 250 words).
3. Transcripts through Semester 6.

Please submit via the placement portal immediately. Late applications will not be forwarded to the company recruiter.

Best regards,
Placement Cell Coordinator
SIES Graduate School of Technology`,
    category: 'internship',
    priority: 'urgent',
    actionRequired: true,
    reason: 'College sender • Internship keyword • Application closes tomorrow',
    reasons: ['College sender', 'Internship keyword', 'Deadline detected'],
    receivedAt: '12 min ago',
    deadline: 'Tomorrow, 5:00 PM',
    isRead: false,
    isCompleted: false,
  },
  {
    id: 'email-2',
    accountId: 'work',
    accountEmail: 'work@gmail.com',
    gmailMessageId: 'mock-message-2',
    gmailThreadId: '18de8f99e4bca02',
    senderName: 'Google Staffing',
    senderEmail: 'tech-interviews@google.com',
    subject: 'Google Interview Schedule Confirmed — Technical Round 1 & 2',
    snippet: 'Your upcoming technical interviews for the Systems Engineering role have been scheduled for Wednesday, Oct 18. Please confirm your availability.',
    body: `Hi Tiesha,

Thank you for your patience. We have finalized your interview loop for the Associate Software Engineer / Systems role.

Schedule:
• Round 1: Coding & Data Structures (45 mins) — Wednesday at 2:00 PM EST
• Round 2: Architecture & Problem Solving (45 mins) — Wednesday at 3:15 PM EST

Please reply directly to this email or click the link below to confirm your attendance within 24 hours. If you require any accommodations or need to reschedule, let us know as soon as possible.

We look forward to speaking with you!

Warmly,
Marcus Vance
University Programs Staffing Lead, Google`,
    category: 'work',
    priority: 'urgent',
    actionRequired: true,
    reason: 'Interview schedule confirmed • Action required: Reply within 24 hours',
    reasons: ['Interview schedule', 'Action required', 'VIP recruiter'],
    receivedAt: '45 min ago',
    deadline: 'Wednesday, 2:00 PM',
    isRead: false,
    isCompleted: false,
  },
  {
    id: 'email-3',
    accountId: 'college',
    accountEmail: 'college@gmail.com',
    gmailMessageId: 'mock-message-3',
    gmailThreadId: '18de7ac1283ea03',
    senderName: 'Dr. Vikram Sharma',
    senderEmail: 'v.sharma@sies.edu.in',
    subject: 'LOR Draft Document Review — Feedback & Edits Attached',
    snippet: 'I reviewed your Letter of Recommendation draft for graduate school applications. Please review the highlighted paragraphs and send the revised version.',
    body: `Hello Tiesha,

I have reviewed the draft of the recommendation letter you shared for your MS applications. Overall it highlights your research contributions very effectively.

I added specific comments in the margin regarding your contributions to the distributed systems paper. Please check paragraphs 3 and 4 where I suggested emphasizing your benchmark methodology.

Send me the final PDF by Thursday evening so I can upload it directly to the Stanford and CMU application portals.

Best,
Dr. Vikram Sharma
Professor & Head of Dept, Computer Science`,
    category: 'academic',
    priority: 'high',
    actionRequired: true,
    reason: 'VIP sender: Professor Sharma • Document review requested',
    reasons: ['VIP sender', 'Document review', 'Academic recommendation'],
    receivedAt: '1 hr ago',
    deadline: 'Thursday, 6:00 PM',
    isRead: false,
    isCompleted: false,
  },
  {
    id: 'email-4',
    accountId: 'college',
    accountEmail: 'college@gmail.com',
    gmailMessageId: 'mock-message-4',
    gmailThreadId: '18de644f19bca04',
    senderName: 'WCC Launchpad',
    senderEmail: 'organizers@wcclaunchpad.org',
    subject: 'Team Confirmation Pending: Launchpad National Hackathon 2026',
    snippet: 'Action required: Your team "NeuralSync" is currently pending RSVP. Two members have accepted, one confirmation is still required to secure your slot.',
    body: `Hey NeuralSync team!

Congratulations on advancing to the Top 30 Finalist tier of the WCC Launchpad 2026 Hackathon!

Your team registration status is currently PENDING.
Accepted: 3/4 members.
Missing confirmation: 1 member.

To lock in your in-person finalist booth and hardware kits, all team members must accept the invitation in the dashboard before tonight at 11:59 PM.

Click the confirmation link to secure your invitation immediately.

Cheers,
The WCC Launchpad Committee`,
    category: 'college',
    priority: 'high',
    actionRequired: true,
    reason: 'Team confirmation pending • You need to accept or decline RSVP',
    reasons: ['Confirmation required', 'Hackathon finalist', 'RSVP deadline tonight'],
    receivedAt: '2 hrs ago',
    deadline: 'Tonight, 11:59 PM',
    isRead: false,
    isCompleted: false,
  },
  {
    id: 'email-5',
    accountId: 'work',
    accountEmail: 'work@gmail.com',
    gmailMessageId: 'mock-message-5',
    gmailThreadId: '18de509b552fa05',
    senderName: 'Sarah Chen',
    senderEmail: 'sarah.chen@techcorp.io',
    subject: 'Sprint Deliverable Sync & Client Demo Preparation',
    snippet: 'Can you please push the latest API contract changes and provide a quick status update before our 4 PM engineering standup?',
    body: `Hi Tiesha,

Hope your day is going well!

Before we do the client walkthrough on Friday, we need the authentication flow mockups and the updated API endpoints deployed to the staging environment.

Could you drop a quick 3-bullet status update on Slack or reply here before 4:00 PM today? Specifically:
1. Has the token refresh bug been patched?
2. Are the Expo demo builds passing on iOS?
3. Anything blocking you for tomorrow's demo?

Thanks for your hard work on this!

Sarah Chen
Engineering Team Lead, TechCorp`,
    category: 'work',
    priority: 'high',
    actionRequired: true,
    reason: 'VIP Contact: Sarah Chen (Internship Manager) • Update requested',
    reasons: ['VIP Manager', 'Sprint deliverable', 'Reply needed today'],
    receivedAt: '3 hrs ago',
    deadline: 'Today, 4:00 PM',
    isRead: false,
    isCompleted: false,
  },
  {
    id: 'email-6',
    accountId: 'college',
    accountEmail: 'college@gmail.com',
    gmailMessageId: 'mock-message-6',
    gmailThreadId: '18de33887caca06',
    senderName: 'Dr. Angela Martinez',
    senderEmail: 'a.martinez@sies.edu.in',
    subject: 'CS502 Final Project Submission Portal Open — Due Friday',
    snippet: 'The submission link for the Distributed Systems Capstone is now active on Canvas. Please verify your team repo link and report.',
    body: `Students of CS502,

The final capstone submission portal is now open on the department portal.

Key milestones:
• Code repository & README: Due Friday at 11:59 PM
• Video demonstration link (max 5 minutes)
• Individual contribution logs

Late submissions will incur a 10% penalty per 24 hours. Ensure your team lead submits the primary artifact.

Dr. Angela Martinez`,
    category: 'academic',
    priority: 'high',
    actionRequired: true,
    reason: 'College academic assignment • Deadline Friday 11:59 PM',
    reasons: ['College sender', 'Assignment deadline', 'Course requirement'],
    receivedAt: '5 hrs ago',
    deadline: 'Friday, 11:59 PM',
    isRead: true,
    isCompleted: false,
  },
  {
    id: 'email-7',
    accountId: 'college',
    accountEmail: 'college@gmail.com',
    gmailMessageId: 'mock-message-7',
    gmailThreadId: '18de11887a0ca07',
    senderName: 'Campus Central Library',
    senderEmail: 'circulation@sies.edu.in',
    subject: 'Book Due Reminder: "Designing Data-Intensive Applications"',
    snippet: 'The item borrowed on Sept 01 is due for return or renewal in 2 days. You can renew online via OPAC.',
    body: `Dear Student,

This is a courtesy reminder that the following library item is due soon:
Title: Designing Data-Intensive Applications (Kleppmann)
Due Date: Wednesday, Sept 17

Please visit the library desk to return the book or renew online via OPAC if there are no holds.

SIES Central Library`,
    category: 'college',
    priority: 'normal',
    actionRequired: false,
    reason: 'College service reminder • Informational',
    reasons: ['College sender', 'Library notice'],
    receivedAt: 'Yesterday',
    deadline: 'Sept 17',
    isRead: true,
    isCompleted: false,
  },
  {
    id: 'email-8',
    accountId: 'personal',
    accountEmail: 'personal@gmail.com',
    gmailMessageId: 'mock-message-8',
    gmailThreadId: '18ddf998811ca08',
    senderName: 'GitHub Weekly Digest',
    senderEmail: 'notifications@github.com',
    subject: 'Trending in TypeScript and React Native this week',
    snippet: 'Explore this week’s top repositories: expo/expo, facebook/react-native, and trpc/trpc.',
    body: `Here are the top open source repositories trending this week in TypeScript and mobile engineering:
1. expo/expo (+820 stars)
2. shadcn/ui (+1.2k stars)
3. zustand (+450 stars)

You can manage your notification subscriptions in your GitHub profile settings.`,
    category: 'personal',
    priority: 'fyi',
    actionRequired: false,
    reason: 'Automated newsletter • Downweighted by PriorityMail',
    reasons: ['Newsletter', 'FYI only'],
    receivedAt: '2 days ago',
    isRead: true,
    isCompleted: false,
  },
  {
    id: 'email-9',
    accountId: 'college',
    accountEmail: 'college@gmail.com',
    gmailMessageId: 'mock-message-9',
    gmailThreadId: '18dde221199ca09',
    senderName: 'Student Council Secretariat',
    senderEmail: 'council@sies.edu.in',
    subject: 'September Cultural Fest "Pratibimb" Volunteer Registrations',
    snippet: 'Want to be a coordinator for the annual cultural extravaganza? Sign up sheet for stage, logistics, and sponsorships is now live.',
    body: `Greetings students!

Pratibimb 2026 is right around the corner. If you are passionate about event management, technical stage operations, or hospitality, sign up to join one of our committees!

Meeting this Friday in the Main Auditorium at 4:30 PM.

Secretariat, SIES Student Council`,
    category: 'college',
    priority: 'fyi',
    actionRequired: false,
    reason: 'Campus announcement • General bulletin',
    reasons: ['Campus newsletter', 'Optional activity'],
    receivedAt: '3 days ago',
    isRead: true,
    isCompleted: false,
  },
  {
    id: 'email-10',
    accountId: 'work',
    accountEmail: 'work@gmail.com',
    gmailMessageId: 'mock-message-10',
    gmailThreadId: '18ddc003344ca10',
    senderName: 'Vercel Billing',
    senderEmail: 'billing@vercel.com',
    subject: 'Your monthly invoice for August 2026 is ready',
    snippet: 'Your invoice for $0.00 (Hobby Plan) has been generated and paid automatically.',
    body: `Thanks for building on Vercel!

Your monthly statement for period Aug 1 - Aug 31 has been generated.
Amount Paid: $0.00 (Hobby Plan)
Status: Paid in full

You can view past invoices and usage metrics anytime in your dashboard.`,
    category: 'work',
    priority: 'fyi',
    actionRequired: false,
    reason: 'Automated invoice receipt • Zero balance',
    reasons: ['Automated receipt', 'No action needed'],
    receivedAt: '4 days ago',
    isRead: true,
    isCompleted: false,
  },
];

export const defaultMockRules: PriorityRule[] = [
  { id: 'rule-1', type: 'label', value: 'work', weight: 3, enabled: true, description: 'Work related emails' },
  { id: 'rule-2', type: 'label', value: 'college', weight: 3, enabled: true, description: 'College announcements' },
  { id: 'rule-3', type: 'sender', value: 'manager@company.com', weight: 5, enabled: true, description: 'Engineering Manager direct' },
  { id: 'rule-4', type: 'domain', value: 'sies.edu.in', weight: 4, enabled: true, description: 'College domain emails' },
  { id: 'rule-5', type: 'keyword', value: 'deadline', weight: 5, enabled: true, description: 'Any task or portal deadline' },
  { id: 'rule-6', type: 'keyword', value: 'interview', weight: 4, enabled: true, description: 'Job & internship interview schedules' },
];

export const defaultVipPeople: VipPerson[] = [
  {
    id: 'vip-1',
    name: 'Aditi Nandoskar',
    email: 'aditi.n@placement.edu',
    category: 'Placement Coordinator',
    createdAt: '2026-09-01',
  },
  {
    id: 'vip-2',
    name: 'Sarah Chen',
    email: 'sarah.chen@techcorp.io',
    category: 'Internship Manager',
    createdAt: '2026-09-02',
  },
  {
    id: 'vip-3',
    name: 'Dr. Vikram Sharma',
    email: 'v.sharma@sies.edu.in',
    category: 'Professor & Project Mentor',
    createdAt: '2026-09-03',
  },
];

export const defaultSettings: AppSettings = {
  userName: 'Tiesha',
  pushNotifications: true,
  aiClassification: true,
  deadlineAlerts: true,
  vipAlerts: true,
  quietHours: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  prioritySensitivity: 'Balanced',
  googleAccountConnected: false,
  connectedEmail: 'tiesha.work@gmail.com',
};
