export interface BusinessTypeData {
  id: string;
  name: string;
  standardFeatures: string[];
  addOns: {
    id: string;
    title: string;
    description: string;
    includes?: string[];
  }[];
}

export const businessTypesData: Record<string, BusinessTypeData> = {
  'barbershops-salons': {
    id: 'barbershops-salons',
    name: 'Barbershops & Salons',
    standardFeatures: [
      '24/7 Call Handling',
      'Instant Missed-Call Text Back',
      'All Inquiries & FAQs',
      'Client Intake',
      'Booking Inside Your Existing System',
      'Calendar Updates',
      'Client Preference Memory',
      'Call Forwarding',
    ],
    addOns: [
      {
        id: 'reminder-confirmation',
        title: 'Reminder & Confirmation Setup (No-Show Killer)',
        description: 'Automatically reduce no-shows with smart reminders and confirmations.',
        includes: [
          'Automatic appointment confirmations',
          'Automated reminders before the appointment',
          'Follow-up messages for unconfirmed clients',
        ],
      },
      {
        id: 'post-appointment',
        title: 'Post-Appointment Engagement',
        description: 'Keep clients engaged and coming back with automated follow-ups.',
        includes: [
          'Review request messages',
          "Outreach if the client hasn't visited in a while",
          'Personalized offers or referral incentives',
        ],
      },
      {
        id: 'waitlist-autofill',
        title: 'Waitlist Auto-Fill',
        description: 'Automatically fill cancellations and newly opened slots from your waitlist.',
        includes: [
          'Automatically contact waitlist clients',
          'Offer newly opened slots',
          'Fill cancellations automatically',
        ],
      },
    ],
  },
  'med-spas': {
    id: 'med-spas',
    name: 'Med Spas',
    standardFeatures: [
      '24/7 Call Handling',
      'Instant Missed-Call Text Back',
      'All Inquiries & FAQs',
      'Treatment-Specific Intake',
      'Eligibility & Safety Screening',
      'Pre- & Post-Care Guidance',
      'Treatment Workflows',
      'Client Management (Packages, Memberships, VIPs)',
      'Sales & Conversion Support (Bundles, Savings)',
      'Client Preference Memory',
      'Call Forwarding',
    ],
    addOns: [
      {
        id: 'consultation-prescreening',
        title: 'Consultation Pre-Screening',
        description: 'Pre-qualify clients before consultations to maximize conversion.',
      },
      {
        id: 'high-ticket-nurture',
        title: 'High-Ticket Lead Nurture',
        description: 'Automated follow-up sequences for high-value treatments.',
      },
    ],
  },
  'clinics-wellness': {
    id: 'clinics-wellness',
    name: 'Clinics & Wellness',
    standardFeatures: [
      '24/7 Call Handling',
      'Instant Missed-Call Text Back',
      'All Inquiries & FAQs',
      'Reason-For-Visit Intake',
      'Insurance/Payment Questions',
      'Provider/Service Routing',
      'Patient Onboarding & Forms',
      'Scheduling Intelligence',
      'Logistical Guidance (ID, Insurance, Parking)',
      'Client Preference Memory',
      'Call Forwarding',
    ],
    addOns: [
      {
        id: 'canceled-appointment-recovery',
        title: 'Canceled Appointment Recovery',
        description: 'Automatically fill canceled slots and recover lost revenue.',
      },
    ],
  },
  'hvac-home-services': {
    id: 'hvac-home-services',
    name: 'Home Services',
    standardFeatures: [
      '24/7 Call Handling',
      'Instant Missed-Call Text Back',
      'All Inquiries & FAQs',
      'Issue-Type Intake',
      'Technician/Service Routing',
      'Service Area Confirmation',
      'Job Qualification Workflows (Details/Photos/Video)',
      'Emergency Logic (Urgency, Fee Expectations)',
      'Operational Updates (Dispatch, Delays, Completion)',
      'Service Continuity (Recurring Visits, Seasonal Maintenance)',
      'Client Preference Memory',
      'Call Forwarding',
    ],
    addOns: [
      {
        id: 'maintenance-plan-upsell',
        title: 'Maintenance Plan Upsell',
        description: 'Automatically offer maintenance plans to increase recurring revenue.',
      },
    ],
  },
  'fitness-studios': {
    id: 'fitness-studios',
    name: 'Fitness Studios',
    standardFeatures: [
      '24/7 Call Handling',
      'Instant Missed-Call Text Back',
      'All Inquiries & FAQs',
      'Class Booking Intake',
      'Membership/Class Pass Questions',
      'Instructor-Specific Routing',
      'Client Management (Packages, Memberships, VIPs)',
      'Scheduling Optimization',
      'Behavior Insights (Frequent Attendees, Upgrade Suggestions)',
      'Client Preference Memory',
      'Call Forwarding',
    ],
    addOns: [
      {
        id: 'class-reminder-system',
        title: 'Class Reminder System',
        description: 'Reduce no-shows with automated class reminders and confirmations.',
      },
      {
        id: 'dormant-member-reengagement',
        title: 'Dormant Member Re-Engagement',
        description: 'Automatically re-engage members who haven\'t visited recently.',
      },
    ],
  },
};

export const businessTypeIds = Object.keys(businessTypesData);
export const getBusinessTypeData = (id: string | null): BusinessTypeData | null => {
  if (!id) return null;
  return businessTypesData[id] || null;
};

