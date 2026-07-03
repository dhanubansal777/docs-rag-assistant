// Questions that HAVE an answer in the docs, tagged with the expected source file.
export const answerable = [
  { question: "What attendance percentage is required to sit for exams?", expectedSource: "academic-ordinance.pdf" },
  { question: "How many credits are needed to graduate with a B.Tech?", expectedSource: "academic-ordinance.pdf" },
  { question: "How many re-examination attempts are allowed?", expectedSource: "academic-ordinance.pdf" },
  { question: "What CGPA is needed for promotion to the next year?", expectedSource: "academic-ordinance.pdf" },
  { question: "What CGPA do I need to be eligible for placements?", expectedSource: "placement-policy.pdf" },
  { question: "Can I sit for more companies after accepting a Tier 3 offer?", expectedSource: "placement-policy.pdf" },
  { question: "What is the eligibility for summer internships?", expectedSource: "placement-policy.pdf" },
  { question: "What is the late fee for paying fees late?", expectedSource: "student-handbook.pdf" },
  { question: "How many books can I borrow from the library?", expectedSource: "student-handbook.pdf" },
  { question: "What time does the hostel gate close?", expectedSource: "student-handbook.pdf" },
];

// Questions with NO answer in the docs — the system SHOULD refuse these.
export const unanswerable = [
  "What is the Wi-Fi password for the hostel?",
  "Who is the current director of the institute?",
  "What is the capital of France?",
  "How do I apply for a scholarship?",
];