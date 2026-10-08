const ALGOS = {
  bubble: {
    name: "冒泡排序",
    en: "Bubble Sort",
    ac: "#88baf0",
    ac2: "#d2e8ff",
    short: "Bubble",
    note: "O(n²) · 相邻比较 · 稳定",
    about:
      "反复走访数列，比较相邻两项并交换逆序对。每一轮结束，当前最大值如气泡般浮到末尾。带提前退出：整轮无交换即已有序。",
    cmpHint: "两两相邻比较 · 逆序即交换",
  },
  insertion: {
    name: "插入排序",
    en: "Insertion Sort",
    ac: "#88baf0",
    ac2: "#d2e8ff",
    short: "Insertion",
    note: "O(n²) 最坏 · O(n) 近有序 · 稳定",
    about:
      "像整理扑克牌：把当前元素向左插入到已排序前缀的正确位置，右侧元素依次右移。近乎有序时几乎是线性时间。",
    cmpHint: "与前缀元素逐个比较 · 记录待插入值",
  },
  selection: {
    name: "选择排序",
    en: "Selection Sort",
    ac: "#88baf0",
    ac2: "#d2e8ff",
    short: "Selection",
    note: "O(n²) · 每轮仅一次交换 · 不稳定",
    about:
      "每轮在未排序区间中扫描最小值，与区间首元素交换。比较次数固定为 n(n−1)/2，但交换次数最少（最多 n−1 次）。",
    cmpHint: "扫描未排序区间 · 追踪最小值下标",
  },
  shell: {
    name: "希尔排序",
    en: "Shell Sort",
    ac: "#88baf0",
    ac2: "#d2e8ff",
    short: "Shell",
    note: "O(n^1.3) 经验 · Ciura 增量 · 不稳定",
    about:
      "插入排序的加强版：先用较大的增量做远距离插入，让元素大步跳到大致位置，再逐步缩小增量做精细整理。",
    cmpHint: "按增量 gap 分组跳跃式插入",
  },
  merge: {
    name: "归并排序",
    en: "Merge Sort",
    ac: "#88baf0",
    ac2: "#d2e8ff",
    short: "Merge",
    note: "O(n log n) 稳定 · O(n) 辅助空间",
    about:
      "分治：把数组一分为二递归排序，再把两个有序序列线性合并。下方细条是正在合并的临时缓冲区。",
    cmpHint: "比较两段有序序列的头部 · 取较小者",
  },
  quick: {
    name: "快速排序",
    en: "Quick Sort",
    ac: "#88baf0",
    ac2: "#d2e8ff",
    short: "Quick",
    note: "O(n log n) 平均 · 三数取中 · 不稳定",
    about:
      "选定基准 pivot，把小于它的元素扫到左侧，再对左右两段递归。采用三数取中法降低在有序数据上退化的风险。",
    cmpHint: "围绕 pivot 划分 · 双指针向内收拢",
  },
  heap: {
    name: "堆排序",
    en: "Heap Sort",
    ac: "#88baf0",
    ac2: "#d2e8ff",
    short: "Heap",
    note: "O(n log n) · 原地 · 不稳定",
    about:
      "先把数组原地建成大顶堆（父节点 ≥ 子节点），然后反复把堆顶最大值换到末尾并重新下沉调整。",
    cmpHint: "父子节点比较 · 逐层下沉",
  },
  radix: {
    name: "基数排序",
    en: "Radix LSD",
    ac: "#88baf0",
    ac2: "#d2e8ff",
    short: "Radix",
    note: "O(d·n) · 非比较排序 · 稳定",
    about:
      "不比较元素：按个位、十位、百位依次把数字分发进 10 个桶，再按桶序收回。底部光条即当前正在使用的桶。",
    cmpHint: "按位分发入桶 · 桶内保持原序",
  },
  cocktail: {
    name: "鸡尾酒排序",
    en: "Cocktail Shaker",
    ac: "#88baf0",
    ac2: "#d2e8ff",
    short: "Shaker",
    note: "O(n²) 最坏 · 双向冒泡 · 稳定",
    about:
      "双向冒泡：先从左往右把最大值送到右端，再从右往左把最小值送到左端，每次往返把未排序区间两端各收紧一格。",
    cmpHint: "往返双向扫描 · 区间两端同时收缩",
  },
};
const ORDER = [
  "bubble",
  "insertion",
  "selection",
  "shell",
  "merge",
  "quick",
  "heap",
  "radix",
  "cocktail",
];
const META = {
  bubble: {
    time: "O(n²)",
    space: "O(1)",
    stable: true,
    title: "从相邻的两项开始。",
  },
  insertion: {
    time: "O(n²)",
    space: "O(1)",
    stable: true,
    title: "为每一个数字，找到它的位置。",
  },
  selection: {
    time: "O(n²)",
    space: "O(1)",
    stable: false,
    title: "每一轮，只寻找最小的那个。",
  },
  shell: {
    time: "取决于增量序列",
    space: "O(1)",
    stable: false,
    title: "先跨越远方，再整理身旁。",
  },
  merge: {
    time: "O(n log n)",
    space: "O(n)",
    stable: true,
    title: "拆成小问题，再合成一个答案。",
  },
  quick: {
    time: "O(n log n)",
    space: "O(log n) 平均",
    stable: false,
    title: "一个基准，把问题一分为二。",
  },
  heap: {
    time: "O(n log n)",
    space: "O(1)",
    stable: false,
    title: "从堆顶，取出下一个最大值。",
  },
  radix: {
    time: "O(d · n)",
    space: "O(n + b)",
    stable: true,
    title: "不比较大小，只关注每一位。",
  },
  cocktail: {
    time: "O(n²)",
    space: "O(1)",
    stable: true,
    title: "往返之间，让两端逐渐有序。",
  },
};

export { ALGOS, ORDER, META };
