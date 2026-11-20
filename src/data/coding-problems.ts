export const codingLanguages = [
  { id: 71, name: 'Python', starter: 'import sys\nvalues = list(map(int, sys.stdin.read().split()))\n# Read the problem and print your answer.\n' },
  { id: 63, name: 'JavaScript', starter: "const fs = require('fs');\nconst values = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\n// Read the problem and print your answer.\n" },
  { id: 74, name: 'TypeScript', starter: "const fs = require('fs');\nconst values: number[] = fs.readFileSync(0, 'utf8').trim().split(/\\s+/).map(Number);\n// Read the problem and print your answer.\n" },
  { id: 54, name: 'C++', starter: '#include <iostream>\nusing namespace std;\nint main() {\n    // Read input and print your answer.\n    return 0;\n}\n' },
  { id: 62, name: 'Java', starter: 'import java.util.*;\npublic class Main {\n    public static void main(String[] args) {\n        Scanner input = new Scanner(System.in);\n        // Read input and print your answer.\n    }\n}\n' },
];

export const codingProblems = [
  { id: 'sum-of-readings', title: 'Sum of readings', topic: 'Arrays', difficulty: 'beginner',
    description: 'Read an integer n followed by n signed integers. Print their sum. The input contains 1 to 1000 readings, each between -1000000 and 1000000.',
    tests: [{ input: '4\n3 -2 8 1\n', output: '10\n' }, { input: '1\n-7\n', output: '-7\n' }, { input: '5\n0 0 0 0 0\n', output: '0\n' }],
  },
  { id: 'count-rises', title: 'Count the rises', topic: 'Arrays', difficulty: 'beginner',
    description: 'Read an integer n followed by n integers. Count how many readings are strictly greater than the immediately preceding reading. Print the count. There are 1 to 1000 readings between -1000000 and 1000000.',
    tests: [{ input: '5\n2 5 5 1 4\n', output: '2\n' }, { input: '1\n9\n', output: '0\n' }, { input: '4\n4 3 2 1\n', output: '0\n' }],
  },
  { id: 'distinct-readings', title: 'Distinct readings', topic: 'Sets', difficulty: 'intermediate',
    description: 'Read an integer n followed by n integers. Print the number of distinct integers. There are 1 to 10000 integers, each between -1000000 and 1000000.',
    tests: [{ input: '6\n3 1 3 2 1 4\n', output: '4\n' }, { input: '4\n0 0 0 0\n', output: '1\n' }, { input: '5\n-1 -2 0 1 2\n', output: '5\n' }],
  },
];
