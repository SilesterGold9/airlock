export interface TrackStep {
  title: string;
  tag: string;
  description: string;
}

export interface SkillTrack {
  id: string;
  title: string;
  description: string;
  steps: TrackStep[];
}

export const tracks: SkillTrack[] = [
  {
    id: "graphs-week1",
    title: "Graphs week 1",
    description: "BFS → shortest path → bipartite check",
    steps: [
      { title: "BFS", tag: "graphs", description: "Traverse level by level" },
      { title: "Shortest path", tag: "graphs", description: "Dijkstra or BFS on weighted" },
      { title: "Bipartite check", tag: "graphs", description: "2-coloring with BFS" },
    ],
  },
  {
    id: "dp-week1",
    title: "DP week 1",
    description: "Recursion → memo → tabulation",
    steps: [
      { title: "Knapsack", tag: "dp", description: "0/1 knapsack" },
      { title: "LIS", tag: "dp", description: "Longest increasing subsequence" },
      { title: "Edit distance", tag: "dp", description: "String DP" },
    ],
  },
  {
    id: "arrays-week1",
    title: "Arrays week 1",
    description: "Two pointers → sliding window → prefix sums",
    steps: [
      { title: "Two pointers", tag: "arrays", description: "Pair sum" },
      { title: "Sliding window", tag: "arrays", description: "Max subarray" },
      { title: "Prefix sums", tag: "arrays", description: "Range sum" },
    ],
  },
];
