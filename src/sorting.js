function* bubbleSort(arr) {
  const a = arr.slice(),
    n = a.length,
    sorted = new Set();
  let cmp = 0,
    swp = 0,
    wrt = 0;
  const out = [];
  const step = (id, o) => {
    o.a = a.slice();
    o.step = id;
    out.push(o);
  };
  for (let pass = 0; pass < n - 1; pass++) {
    let swapped = false;
    for (let i = 0; i < n - 1 - pass; i++) {
      cmp++;
      step("compare", {
        cmp,
        swp,
        wrt,
        sorted: new Set(sorted),
        i,
        j: i + 1,
        hint: "比较 a[" + i + "] 与 a[" + (i + 1) + "]",
      });
      if (a[i] > a[i + 1]) {
        const t = a[i];
        a[i] = a[i + 1];
        a[i + 1] = t;
        swp++;
        wrt += 2;
        swapped = true;
        step("swap", {
          cmp,
          swp,
          wrt,
          sorted: new Set(sorted),
          i,
          j: i + 1,
          swap: true,
          hint: "逆序 → 交换",
        });
      }
    }
    sorted.add(n - 1 - pass);
    step("mark", {
      cmp,
      swp,
      wrt,
      sorted: new Set(sorted),
      hint: "第 " + (pass + 1) + " 轮结束 · 最大值就位",
    });
    if (!swapped) {
      for (let x = 0; x < n; x++) sorted.add(x);
      break;
    }
  }
  for (let x = 0; x < n; x++) sorted.add(x);
  yield* out;
  yield {
    a: a.slice(),
    sorted: new Set(sorted),
    cmp,
    swp,
    wrt,
    fin: true,
    step: null,
    hint: "排序完成 · 全部有序",
  };
}

function* insertionSort(arr) {
  const a = arr.slice(),
    n = a.length,
    sorted = new Set();
  let cmp = 0,
    swp = 0,
    wrt = 0;
  const out = [];
  const step = (id, o) => {
    o.a = a.slice();
    o.step = id;
    out.push(o);
  };
  if (n < 1) {
    yield {
      a: [],
      sorted: new Set(),
      cmp: 0,
      swp: 0,
      wrt: 0,
      fin: true,
      step: null,
      line: null,
      hint: "空数组无需排序",
    };
    return;
  }
  step(null, {
    cmp,
    swp,
    wrt,
    sorted: new Set([0]),
    i: 0,
    hint: "首元素视为已排序前缀",
  });
  for (let i = 1; i < n; i++) {
    step("key", {
      cmp,
      swp,
      wrt,
      sorted: new Set(),
      i,
      j: i,
      hint: "把 a[" + i + "] 向左挪到正确位置",
    });
    let j = i;
    while (j > 0) {
      cmp++;
      step("shift", {
        cmp,
        swp,
        wrt,
        sorted: new Set(),
        i: i,
        j: j,
        hint: "比较 a[" + (j - 1) + "] 与 a[" + j + "]",
      });
      if (a[j - 1] > a[j]) {
        const t = a[j];
        a[j] = a[j - 1];
        a[j - 1] = t; /* 相邻交换：动画可平移 */
        swp++;
        wrt += 2;
        step("shift", {
          cmp,
          swp,
          wrt,
          sorted: new Set(),
          i: i,
          j: j - 1,
          swap: true,
          hint: "逆序 → 相邻交换，继续左移",
        });
        j--;
      } else break;
    }
    step("place", {
      cmp,
      swp,
      wrt,
      sorted: new Set(),
      i: i,
      j: j,
      hint: "已到正确位置",
    });
  }
  yield* out;
  yield {
    a: a.slice(),
    sorted: new Set(a.map((_, x) => x)),
    cmp,
    swp,
    wrt,
    fin: true,
    step: null,
    hint: "排序完成 · 全部有序",
  };
}

function* selectionSort(arr) {
  const a = arr.slice(),
    n = a.length,
    sorted = new Set();
  let cmp = 0,
    swp = 0,
    wrt = 0;
  const out = [];
  const step = (id, o) => {
    o.a = a.slice();
    o.step = id;
    out.push(o);
  };
  for (let i = 0; i < n - 1; i++) {
    let m = i;
    for (let j = i + 1; j < n; j++) {
      cmp++;
      step("compare", {
        cmp,
        swp,
        wrt,
        sorted: new Set(sorted),
        i: j,
        j: m,
        k: i,
        hint: "比较 a[" + j + "] 与当前最小 a[" + m + "]",
      });
      if (a[j] < a[m]) m = j;
    }
    if (m !== i) {
      const t = a[i];
      a[i] = a[m];
      a[m] = t;
      swp++;
      wrt += 2;
      step("swap", {
        cmp,
        swp,
        wrt,
        sorted: new Set(sorted),
        i: i,
        j: m,
        swap: true,
        k: i,
        hint: "最小值换到区间首位",
      });
    }
    sorted.add(i);
    step("mark", {
      cmp,
      swp,
      wrt,
      sorted: new Set(sorted),
      hint: "第 " + (i + 1) + " 位就位",
    });
  }
  for (let x = 0; x < n; x++) sorted.add(x);
  yield* out;
  yield {
    a: a.slice(),
    sorted: new Set(sorted),
    cmp,
    swp,
    wrt,
    fin: true,
    step: null,
    hint: "排序完成 · 全部有序",
  };
}

function* shellSort(arr) {
  const a = arr.slice(),
    n = a.length,
    sorted = new Set();
  let cmp = 0,
    swp = 0,
    wrt = 0;
  const out = [];
  const step = (id, o) => {
    o.a = a.slice();
    o.step = id;
    out.push(o);
  };
  const GAPS = [701, 301, 132, 57, 23, 10, 4, 1];
  for (let g = 0; g < GAPS.length; g++) {
    const gap = GAPS[g];
    if (gap >= n) continue;
    step("gap", {
      cmp,
      swp,
      wrt,
      sorted: new Set(),
      hint: "当前增量 gap = " + gap,
    });
    for (let i = gap; i < n; i++) {
      let j = i;
      while (j >= gap) {
        cmp++;
        step("compare", {
          cmp,
          swp,
          wrt,
          sorted: new Set(),
          i: j,
          j: j - gap,
          hint: "gap=" + gap + " · 比较相隔 " + gap + " 的两项",
        });
        if (a[j - gap] > a[j]) {
          const t = a[j];
          a[j] = a[j - gap];
          a[j - gap] = t; /* 跨 gap 交换：两根柱子横向换位 */
          swp++;
          wrt += 2;
          step("shift", {
            cmp,
            swp,
            wrt,
            sorted: new Set(),
            i: j,
            j: j - gap,
            swap: true,
            hint: "相隔 " + gap + " 逆序 → 交换",
          });
          j -= gap;
        } else break;
      }
      step("put", {
        cmp,
        swp,
        wrt,
        sorted: new Set(),
        i: j,
        j: j,
        hint: "该组内已就位",
      });
    }
  }
  yield* out;
  yield {
    a: a.slice(),
    sorted: new Set(a.map((_, x) => x)),
    cmp,
    swp,
    wrt,
    fin: true,
    step: null,
    hint: "排序完成 · 全部有序",
  };
}

function* mergeSort(arr) {
  const a = arr.slice(),
    n = a.length,
    sorted = new Set();
  let cmp = 0,
    swp = 0,
    wrt = 0;
  const out = [];
  const step = (id, o) => {
    o.a = a.slice();
    o.step = id;
    out.push(o);
  };
  const buf = new Array(Math.max(n, 1)).fill(0);
  function* sort(lo, hi) {
    if (hi - lo < 2) return;
    const mid = (lo + hi) >> 1;
    step("split", {
      cmp,
      swp,
      wrt,
      sorted: new Set(),
      i: lo,
      k: lo,
      hint: "拆分 [" + lo + "," + hi + ") → 两半",
    });
    step("left", {
      cmp,
      swp,
      wrt,
      sorted: new Set(),
      i: lo,
      k: lo,
      hint: "递归排序左半 [" + lo + "," + mid + ")",
    });
    yield* sort(lo, mid);
    step("right", {
      cmp,
      swp,
      wrt,
      sorted: new Set(),
      i: mid,
      k: mid,
      hint: "递归排序右半 [" + mid + "," + hi + ")",
    });
    yield* sort(mid, hi);
    let i = lo,
      j = mid,
      k = lo;
    while (i < mid && j < hi) {
      cmp++;
      step("pick", {
        cmp,
        swp,
        wrt,
        sorted: new Set(),
        i,
        j,
        k,
        aux: buf.slice(0, n),
        auxLabel: "合并 [" + lo + "," + hi + ")",
        hint: "比较左段头与右段头",
      });
      if (a[i] <= a[j]) buf[k++] = a[i++];
      else buf[k++] = a[j++];
      wrt++;
      step("back", {
        cmp,
        swp,
        wrt,
        sorted: new Set(),
        i,
        k,
        aux: buf.slice(0, n),
        auxLabel: "辅助缓冲区",
        hint: "较小者写入缓冲区",
      });
    }
    while (i < mid) {
      buf[k++] = a[i++];
      wrt++;
    }
    while (j < hi) {
      buf[k++] = a[j++];
      wrt++;
    }
    for (let t = lo; t < hi; t++) {
      if (a[t] === buf[t]) {
        wrt++;
        continue;
      } /* 已在正确位置，画不出位移 */
      a[t] = buf[t];
      wrt++;
      step("back", {
        cmp,
        swp,
        wrt,
        sorted: new Set(),
        i: t,
        k: t,
        aux: buf.slice(0, n),
        auxLabel: "辅助缓冲区",
        hint: "写回 a[" + t + "]",
      });
    }
  }
  if (n > 1) yield* sort(0, n);
  yield* out;
  yield {
    a: a.slice(),
    sorted: new Set(a.map((_, x) => x)),
    cmp,
    swp,
    wrt,
    fin: true,
    step: null,
    hint: "排序完成 · 全部有序",
  };
}

function* quickSort(arr) {
  const a = arr.slice(),
    n = a.length,
    sorted = new Set();
  let cmp = 0,
    swp = 0,
    wrt = 0;
  const out = [];
  const step = (id, o) => {
    o.a = a.slice();
    o.step = id;
    out.push(o);
  };
  function* qs(lo, hi) {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1;
    if (a[mid] < a[lo]) {
      const t = a[mid];
      a[mid] = a[lo];
      a[lo] = t;
      swp++;
      wrt += 2;
    }
    if (a[hi] < a[lo]) {
      const t = a[hi];
      a[hi] = a[lo];
      a[lo] = t;
      swp++;
      wrt += 2;
    }
    if (a[hi] < a[mid]) {
      const t = a[hi];
      a[hi] = a[mid];
      a[mid] = t;
      swp++;
      wrt += 2;
    }
    const p = a[mid];
    step("pivot", {
      cmp,
      swp,
      wrt,
      sorted: new Set(),
      i: mid,
      j: lo,
      k: hi,
      hint: "三数取中 → pivot = " + p,
    });
    let i = lo,
      j = hi;
    while (i <= j) {
      cmp++;
      while (a[i] < p) {
        cmp++;
        step("left", {
          cmp,
          swp,
          wrt,
          sorted: new Set(),
          i,
          j,
          k: mid,
          hint: "a[" + i + "] < pivot → i 右移",
        });
        i++;
      }
      cmp++;
      while (a[j] > p) {
        cmp++;
        step("right", {
          cmp,
          swp,
          wrt,
          sorted: new Set(),
          i,
          j,
          k: mid,
          hint: "a[" + j + "] > pivot → j 左移",
        });
        j--;
      }
      cmp++;
      if (i <= j) {
        const t = a[i];
        a[i] = a[j];
        a[j] = t;
        swp++;
        wrt += 2;
        step("swap", {
          cmp,
          swp,
          wrt,
          sorted: new Set(),
          i,
          j,
          swap: true,
          k: mid,
          hint: "左右互换，继续向中间收拢",
        });
        i++;
        j--;
      }
    }
    step("recurse", {
      cmp,
      swp,
      wrt,
      sorted: new Set(),
      i,
      j,
      k: mid,
      hint: "划分完成 · 左侧全部 ≤ pivot",
    });
    step("split", {
      cmp,
      swp,
      wrt,
      sorted: new Set(),
      i: lo,
      j: j,
      k: mid,
      hint: "递归左段 [" + lo + "," + j + "] 与右段 [" + i + "," + hi + "]",
    });
    yield* qs(lo, j);
    yield* qs(i, hi);
  }
  if (n > 1) yield* qs(0, n - 1);
  yield* out;
  yield {
    a: a.slice(),
    sorted: new Set(a.map((_, x) => x)),
    cmp,
    swp,
    wrt,
    fin: true,
    step: null,
    hint: "排序完成 · 全部有序",
  };
}

function* heapSort(arr) {
  const a = arr.slice(),
    n = a.length,
    sorted = new Set();
  let cmp = 0,
    swp = 0,
    wrt = 0;
  const out = [];
  const step = (id, o) => {
    o.a = a.slice();
    o.step = id;
    out.push(o);
  };
  function* sift(root, end) {
    while (true) {
      let child = root * 2 + 1;
      if (child > end) break;
      if (child + 1 <= end) {
        cmp++;
        if (a[child] < a[child + 1]) child++;
      }
      cmp++;
      step("siftcmp", {
        cmp,
        swp,
        wrt,
        sorted: new Set(sorted),
        i: root,
        j: child,
        hint: "父节点与较大子节点比较",
      });
      if (a[root] < a[child]) {
        const t = a[root];
        a[root] = a[child];
        a[child] = t;
        swp++;
        wrt += 2;
        step("swap", {
          cmp,
          swp,
          wrt,
          sorted: new Set(sorted),
          i: root,
          j: child,
          swap: true,
          hint: "父 < 子 → 交换后继续下沉",
        });
        root = child;
      } else break;
    }
    step("siftend", {
      cmp,
      swp,
      wrt,
      sorted: new Set(sorted),
      i: root,
      j: -1,
      hint: "该子树已满足大顶堆",
    });
  }
  for (let i = (n - 2) >> 1; i >= 0; i--) {
    step("build", {
      cmp,
      swp,
      wrt,
      sorted: new Set(sorted),
      i: i,
      hint: "阶段一：从 a[" + i + "] 开始建堆",
    });
    yield* sift(i, n - 1);
  }
  for (let end = n - 1; end > 0; end--) {
    const t = a[0];
    a[0] = a[end];
    a[end] = t;
    swp++;
    wrt += 2;
    sorted.add(end);
    step("mark", {
      cmp,
      swp,
      wrt,
      sorted: new Set(sorted),
      i: 0,
      j: end,
      swap: true,
      hint: "堆顶最大值归位到 a[" + end + "]",
    });
    if (end - 1 > 0) yield* sift(0, end - 1);
  }
  if (n > 0) sorted.add(0);
  yield* out;
  yield {
    a: a.slice(),
    sorted: new Set(sorted),
    cmp,
    swp,
    wrt,
    fin: true,
    step: null,
    hint: "排序完成 · 全部有序",
  };
}

function* radixSort(arr) {
  const a = arr.slice(),
    n = a.length;
  let cmp = 0,
    swp = 0,
    wrt = 0;
  const out = [];
  const step = (id, o) => {
    o.a = a.slice();
    o.step = id;
    out.push(o);
  };
  let max = 0;
  for (let i = 0; i < n; i++) if (a[i] > max) max = a[i];
  let digits = 1;
  while (Math.pow(10, digits) <= max) digits++;
  for (let d = 0; d < digits; d++) {
    const buckets = Array.from({ length: 10 }, () => []);
    const dump = () => buckets.map((b) => b.slice());
    for (let i = 0; i < n; i++) {
      const dig = Math.floor(a[i] / Math.pow(10, d)) % 10;
      wrt++;
      buckets[dig].push(a[i]);
      step("bucket", {
        cmp,
        swp,
        wrt,
        sorted: new Set(),
        i,
        j: -1,
        dig,
        buckets: dump(),
        hint: "取出第 " + d + " 位 → 桶 " + dig,
      });
      step("digit", {
        cmp,
        swp,
        wrt,
        sorted: new Set(),
        i,
        j: -1,
        dig,
        buckets: dump(),
        hint: "第 " + (d + 1) + " 位（" + dig + "）→ 桶 " + dig,
      });
    }
    // Stable collection follows the displayed source and keeps radix linear
    // per digit. Intermediate overwrites are rendered by height interpolation.
    let k = 0;
    for (let b = 0; b < 10; b++) {
      for (let q = 0; q < buckets[b].length; q++) {
        a[k] = buckets[b][q];
        wrt++;
        step("gather", {
          cmp,
          swp,
          wrt,
          sorted: new Set(),
          i: k,
          j: -1,
          dig: b,
          buckets: dump(),
          hint: "从桶 " + b + " 顺序写回 a[" + k + "]",
        });
        k++;
      }
    }
    step("pass", {
      cmp,
      swp,
      wrt,
      sorted: new Set(),
      j: -1,
      buckets: dump(),
      hint: "第 " + (d + 1) + " 位分发完成",
    });
  }
  yield* out;
  yield {
    a: a.slice(),
    sorted: new Set(a.map((_, x) => x)),
    cmp,
    swp,
    wrt,
    fin: true,
    step: null,
    hint: "排序完成（全程没有比较）",
  };
}

function* cocktailSort(arr) {
  const a = arr.slice(),
    n = a.length,
    sorted = new Set();
  let cmp = 0,
    swp = 0,
    wrt = 0;
  const out = [];
  const step = (id, o) => {
    o.a = a.slice();
    o.step = id;
    out.push(o);
  };
  let lo = 0,
    hi = n - 1;
  while (lo < hi) {
    let swapped = false;
    for (let i = lo; i < hi; i++) {
      cmp++;
      step("fwd", {
        cmp,
        swp,
        wrt,
        sorted: new Set(sorted),
        i,
        j: i + 1,
        hint: "→ 向右扫描 · 把最大值推向 hi",
      });
      if (a[i] > a[i + 1]) {
        const t = a[i];
        a[i] = a[i + 1];
        a[i + 1] = t;
        swp++;
        wrt += 2;
        swapped = true;
        step("fwd", {
          cmp,
          swp,
          wrt,
          sorted: new Set(sorted),
          i,
          j: i + 1,
          swap: true,
          hint: "逆序 → 交换",
        });
      }
    }
    sorted.add(hi);
    hi--;
    for (let i = hi; i > lo; i--) {
      cmp++;
      step("markhi", {
        cmp,
        swp,
        wrt,
        sorted: new Set(sorted),
        i,
        j: i - 1,
        hint: "← 向左扫描 · 把最小值推向 lo",
      });
      if (a[i] < a[i - 1]) {
        const t = a[i];
        a[i] = a[i - 1];
        a[i - 1] = t;
        swp++;
        wrt += 2;
        swapped = true;
        step("bwd", {
          cmp,
          swp,
          wrt,
          sorted: new Set(sorted),
          i,
          j: i - 1,
          swap: true,
          hint: "逆序 → 交换",
        });
      }
    }
    sorted.add(lo);
    lo++;
    step("marklo", {
      cmp,
      swp,
      wrt,
      sorted: new Set(sorted),
      hint: "一次往返完成 · 两端各就位一个",
    });
    if (!swapped) {
      for (let x = 0; x < n; x++) sorted.add(x);
      break;
    }
  }
  for (let x = 0; x < n; x++) sorted.add(x);
  yield* out;
  yield {
    a: a.slice(),
    sorted: new Set(sorted),
    cmp,
    swp,
    wrt,
    fin: true,
    step: null,
    hint: "排序完成 · 全部有序",
  };
}

const GEN = {
  bubble: bubbleSort,
  insertion: insertionSort,
  selection: selectionSort,
  shell: shellSort,
  merge: mergeSort,
  quick: quickSort,
  heap: heapSort,
  radix: radixSort,
  cocktail: cocktailSort,
};

export { GEN };
