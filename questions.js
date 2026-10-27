(function (global) {
  "use strict";

  var MAX = 30;
  var DEFAULT_TIME = 30; // Seconds per question for the arithmetic topics

  // Seconds per question for each Simplification level. Change these freely.
  var SIMP_TIME = { clerk: 40, po: 50, sbi: 60 };

  // How many questions each generated topic has per session.
  var SIMP_COUNT = 100;
  var COMPARE_COUNT = 150;

  // ---------- small helpers ----------

  function rand(a, b) {
    return Math.floor(Math.random() * (b - a + 1)) + a;
  }

  function pick(arr) {
    return arr[rand(0, arr.length - 1)];
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rand(0, i);
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
  }

  function divisorsOf(v, lo, hi) {
    var out = [];
    for (var i = lo; i <= hi; i++) if (v % i === 0) out.push(i);
    return out;
  }

  // Builds the four options. Everything is a text label, so numbers, percentages
  // and fractions all work the same way. `fallback(i)` supplies extra wrong
  // options if there are not enough candidates.
  function pickOptions(answer, candidates, fallback) {
    var seen = {};
    seen[answer] = true;
    var wrong = [];
    candidates.forEach(function (c) {
      if (!seen[c]) {
        seen[c] = true;
        wrong.push(c);
      }
    });
    var chosen = shuffle(wrong).slice(0, 3);
    var i = 1;
    while (chosen.length < 3) {
      var c = fallback(i++);
      if (!seen[c]) {
        seen[c] = true;
        chosen.push(c);
      }
    }
    return shuffle([answer].concat(chosen));
  }

  function numOptions(answer, candidates) {
    var labels = candidates
      .filter(function (c) {
        return c > 0 && c !== answer;
      })
      .map(String);
    return pickOptions(String(answer), labels, function (i) {
      return String(answer + i);
    });
  }

  // ---------- fractions and percentages ----------

  // All proper fractions with denominators 2 to 12, plus 1/13 to 1/20.
  var FRACTIONS = [];
  (function () {
    var d, n;
    for (d = 2; d <= 12; d++) {
      for (n = 1; n < d; n++) if (gcd(n, d) === 1) FRACTIONS.push([n, d]);
    }
    for (d = 13; d <= 20; d++) FRACTIONS.push([1, d]);
  })();

  function fracLabel(n, d) {
    var g = gcd(n, d);
    return n / g + "/" + d / g;
  }

  // Percentage cut off (not rounded) at 2 decimals, as in standard charts:
  // 1/7 = 14.28%, 1/6 = 16.66%, 1/8 = 12.5%.
  function pctLabel(n, d) {
    var hundredths = Math.floor((n * 10000) / d);
    var s = (hundredths / 100).toFixed(2).replace(/\.?0+$/, "");
    return s + "%";
  }

  function nearbyFractions(n, d) {
    return [
      [n, d + 1], [n, d + 2], [n, d - 1], [n, d - 2],
      [n + 1, d], [n - 1, d], [n + 2, d], [n - 2, d],
      [n + 1, d + 1], [n + 1, d - 1],
    ].filter(function (p) {
      return p[0] >= 1 && p[1] >= 2 && p[0] < p[1] && p[1] <= 20;
    });
  }

  // ---------- fraction comparison ----------

  function buildCompare(count) {
    var out = [];
    var seen = {};
    var tries = 0;
    while (out.length < count && tries < 20000) {
      tries++;
      var fr = [];
      while (fr.length < 4) {
        var d = rand(3, 20);
        var n = rand(1, d - 1);
        if (gcd(n, d) !== 1) continue;
        fr.push([n, d]);
      }
      // Keep the values clearly apart so there is one fair answer.
      var vals = fr
        .map(function (f) {
          return f[0] / f[1];
        })
        .sort(function (a, b) {
          return a - b;
        });
      var ok = true;
      for (var i = 0; i < 3; i++) if (vals[i + 1] - vals[i] < 0.02) ok = false;
      if (!ok) continue;
      var key = fr
        .map(function (f) {
          return f[0] + "/" + f[1];
        })
        .sort()
        .join(",");
      if (seen[key]) continue;
      seen[key] = true;
      out.push({ fr: fr, mode: Math.random() < 0.5 ? "largest" : "smallest" });
    }
    return out;
  }

  // ---------- Simplification ----------

  var P5 = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75]; // easy percentages
  var FD = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]; // fraction denominators

  function E(text, answer) {
    return { text: text + " = ?", answer: answer };
  }

  function M(text, answer) {
    return { text: text, answer: answer };
  }

  // Approximation questions show numbers that are slightly off (like 24.98).
  // The answer is the neat value, and the options are spaced far enough apart
  // that only one is close.
  function noise(n) {
    var d = pick([-0.04, -0.03, -0.02, 0.02, 0.03, 0.04]);
    return Math.round((n + d) * 100) / 100;
  }

  function approxItem(nums, f, build) {
    var disp = nums.map(noise);
    return {
      text:
        build(
          disp.map(function (x) {
            return x.toFixed(2);
          })
        ) + " ≈ ?",
      answer: f(nums),
      real: f(disp),
      approx: true,
    };
  }

  function approxStep(answer) {
    return Math.max(10, Math.round(answer * 0.07));
  }

  var SIMP_GENS = {
    // Easier: two to four steps, familiar numbers.
    clerk: [
      function () {
        var a = rand(12, 45), b = rand(3, 12), c = rand(20, 200), d = rand(10, 120);
        return E(a + " × " + b + " + " + c + " − " + d, a * b + c - d);
      },
      function () {
        var n = rand(12, 30), b = rand(3, 12), c = rand(3, 12);
        return E(n + "² − " + b + " × " + c, n * n - b * c);
      },
      function () {
        var s = rand(12, 30), a = rand(3, 12), b = rand(20, 150);
        return E("√" + s * s + " × " + a + " + " + b, s * a + b);
      },
      function () {
        var p = pick(P5), q = pick(P5), X = 20 * rand(5, 50), Y = 20 * rand(5, 50);
        var sub = Math.random() < 0.5;
        return E(
          p + "% of " + X + (sub ? " − " : " + ") + q + "% of " + Y,
          (p * X) / 100 + (sub ? -1 : 1) * ((q * Y) / 100)
        );
      },
      function () {
        var d = rand(3, 12), m = rand(2, 12), c = rand(3, 12);
        var s = d * m, a = rand(1, s - 1), b = s - a;
        return E("(" + a + " + " + b + ") × " + c + " ÷ " + d, m * c);
      },
      function () {
        var b = rand(3, 15), q = rand(5, 40), c = rand(3, 15), d = rand(3, 15);
        return E(b * q + " ÷ " + b + " + " + c + " × " + d, q + c * d);
      },
      function () {
        var b = rand(3, 15), k = rand(5, 40), c = rand(10, 80);
        return M("? ÷ " + b + " + " + c + " = " + (k + c), b * k);
      },
      function () {
        var a = rand(12, 40), b = rand(3, 12), c = rand(5, 20), d = rand(3, 12);
        return E(a + " × " + b + " − " + c + " × " + d, a * b - c * d);
      },
      function () {
        var a = rand(8, 25), b = rand(8, 25), c = rand(10, 100);
        return E(a + "² + " + b + "² − " + c, a * a + b * b - c);
      },
    ],

    // Medium: squares, cubes, roots, fractions, percentages and approximations.
    po: [
      function () {
        var s = rand(14, 30), a = rand(3, 15), b = rand(8, 25), c = rand(20, 200);
        return E("√" + s * s + " × " + a + " + " + b + "² − " + c, s * a + b * b - c);
      },
      function () {
        var d1 = pick(FD), d2 = pick(FD), n1 = rand(1, d1 - 1), n2 = rand(1, d2 - 1);
        var k1 = rand(4, 30), k2 = rand(4, 30), sub = Math.random() < 0.5;
        return E(
          "(" + n1 + "/" + d1 + ") of " + d1 * k1 + (sub ? " − " : " + ") + "(" + n2 + "/" + d2 + ") of " + d2 * k2,
          n1 * k1 + (sub ? -1 : 1) * n2 * k2
        );
      },
      function () {
        var p = pick(P5), q = pick(P5), X = 20 * rand(10, 100), Y = 20 * rand(10, 100), c = rand(10, 150);
        return E(
          p + "% of " + X + " − " + q + "% of " + Y + " + " + c,
          (p * X) / 100 - (q * Y) / 100 + c
        );
      },
      function () {
        var a = rand(15, 40), b = rand(5, a - 1), v = a * a - b * b;
        var ds = divisorsOf(v, 3, 30);
        if (!ds.length) return null;
        var c = pick(ds);
        return E("(" + a + "² − " + b + "²) ÷ " + c, v / c);
      },
      function () {
        var c = rand(3, 12), a = c * rand(2, 12), b = rand(3, 25), d = rand(5, 25);
        return E(a + " × " + b + " ÷ " + c + " + " + d + "²", (a / c) * b + d * d);
      },
      function () {
        var a = rand(4, 15), ds = divisorsOf(a * a * a, 4, 60);
        if (!ds.length) return null;
        var b = pick(ds), s = rand(12, 30), c = rand(3, 12);
        return E(a + "³ ÷ " + b + " + √" + s * s + " × " + c, (a * a * a) / b + s * c);
      },
      function () {
        var p = pick(P5), X = 20 * rand(5, 40), a = rand(12, 45), b = rand(11, 35);
        return approxItem(
          [p, X, a, b],
          function (v) { return (v[0] * v[1]) / 100 + v[2] * v[3]; },
          function (t) { return t[0] + "% of " + t[1] + " + " + t[2] + " × " + t[3]; }
        );
      },
      function () {
        var s = rand(12, 30), a = rand(4, 20), b = rand(12, 30);
        return approxItem(
          [s * s, a, b],
          function (v) { return Math.sqrt(v[0]) * v[1] + v[2] * v[2]; },
          function (t) { return "√" + t[0] + " × " + t[1] + " + " + t[2] + "²"; }
        );
      },
      function () {
        var a = rand(2, 15), b = rand(2, 15), k = rand(1, 10), c = rand(10, 80);
        return M("(? × " + a + ") ÷ " + b + " + " + c + " = " + (a * k + c), b * k);
      },
    ],

    // Harder: bigger numbers, longer chains, brackets, cubes and approximations.
    sbi: [
      function () {
        var p = pick(P5), X = 20 * rand(20, 100), a = rand(15, 40), s = rand(20, 45), c = rand(3, 20);
        return E(
          p + "% of " + X + " + " + a + "² − √" + s * s + " × " + c,
          (p * X) / 100 + a * a - s * c
        );
      },
      function () {
        var a = rand(11, 60), b = rand(11, 60), c = rand(3, 15), d = rand(8, 30);
        var v = (a + b) * c - d * d;
        if (v <= 0) return null;
        var ds = divisorsOf(v, 3, 25);
        if (!ds.length) return null;
        var e = pick(ds);
        return E("[(" + a + " + " + b + ") × " + c + " − " + d + "²] ÷ " + e, v / e);
      },
      function () {
        var c = rand(5, 15), ds = divisorsOf(c * c * c, 3, 60);
        if (!ds.length) return null;
        var d = pick(ds), a = rand(15, 60), b = rand(6, 25), e = rand(10, 200);
        return E(a + " × " + b + " − " + c + "³ ÷ " + d + " + " + e, a * b - (c * c * c) / d + e);
      },
      function () {
        var d1 = pick(FD), d2 = pick(FD), n1 = rand(1, d1 - 1), n2 = rand(1, d2 - 1);
        var k1 = rand(10, 60), k2 = rand(5, 40), c = rand(8, 25);
        return E(
          "(" + n1 + "/" + d1 + ") of " + d1 * k1 + " − (" + n2 + "/" + d2 + ") of " + d2 * k2 + " + " + c + "²",
          n1 * k1 - n2 * k2 + c * c
        );
      },
      function () {
        var a = rand(12, 45), b = rand(11, 35), p = pick(P5), X = 20 * rand(5, 40), s = rand(12, 30);
        return approxItem(
          [a, b, p, X, s * s],
          function (v) { return v[0] * v[1] - (v[2] * v[3]) / 100 + Math.sqrt(v[4]); },
          function (t) { return t[0] + " × " + t[1] + " − " + t[2] + "% of " + t[3] + " + √" + t[4]; }
        );
      },
      function () {
        var a = rand(20, 45), b = rand(8, a - 1), v = a * a - b * b;
        var ds = divisorsOf(v, 5, 40);
        if (!ds.length) return null;
        var c = pick(ds), p = pick(P5), X = 20 * rand(5, 40);
        return approxItem(
          [a, b, c, p, X],
          function (w) { return (w[0] * w[0] - w[1] * w[1]) / w[2] + (w[3] * w[4]) / 100; },
          function (t) { return "(" + t[0] + "² − " + t[1] + "²) ÷ " + t[2] + " + " + t[3] + "% of " + t[4]; }
        );
      },
      function () {
        var a = rand(2, 15), b = rand(2, 15), k = rand(1, 10), c = rand(8, 25);
        return M("(? × " + a + ") ÷ " + b + " + " + c + "² = " + (a * k + c * c), b * k);
      },
      function () {
        var a = rand(10, 40), b = rand(10, 40), v = a * a + b * b;
        var ds = divisorsOf(v, 5, 50);
        if (!ds.length) return null;
        var c = pick(ds), d = rand(5, 25), e = rand(5, 25);
        return E("(" + a + "² + " + b + "²) ÷ " + c + " + " + d + " × " + e, v / c + d * e);
      },
    ],
  };

  // Builds a fresh set of unique Simplification questions for one level.
  function buildSimp(level, count) {
    var gens = SIMP_GENS[level];
    var out = [];
    var seen = {};
    var tries = 0;
    while (out.length < count && tries < 50000) {
      tries++;
      var item = pick(gens)();
      if (!item || seen[item.text]) continue;
      if (!(Number.isInteger(item.answer) && item.answer > 0 && item.answer <= 20000)) continue;
      if (item.approx && Math.abs(item.real - item.answer) > approxStep(item.answer) * 0.3) continue;
      seen[item.text] = true;
      item.time = SIMP_TIME[level];
      out.push(item);
    }
    return out;
  }

  function simpOptions(item) {
    var answer = item.answer;
    var cands = [];
    var step = approxStep(answer);
    if (item.approx) {
      [1, 2, 3].forEach(function (k) {
        cands.push(answer + k * step, answer - k * step);
      });
    } else {
      var limit = Math.max(10, Math.round(answer * 0.3));
      [1, 2, 3, 5, 10, 20, 50, 100].forEach(function (d) {
        if (d <= limit) cands.push(answer + d, answer - d);
      });
    }
    var labels = cands
      .filter(function (c) {
        return c > 0 && c !== answer;
      })
      .map(String);
    return pickOptions(String(answer), labels, function (i) {
      return String(answer + (item.approx ? step * (3 + i) : 100 + i));
    });
  }

  // ---------- the question pool ----------

  var BUILDERS = {
    // 12 x 27 and 27 x 12 count as one question, so pairs are stored once.
    mul: function () {
      var list = [];
      for (var a = 1; a <= MAX; a++) for (var b = a; b <= MAX; b++) list.push([a, b]);
      return list;
    },
    // dividend = a x b, divisor = b, answer = a
    div: function () {
      var list = [];
      for (var a = 1; a <= MAX; a++) for (var b = 1; b <= MAX; b++) list.push([a * b, b]);
      return list;
    },
    square: function () { return range(1, 30); },
    bigsq: function () { return range(31, 50); },
    cube: function () { return range(1, 30); },
    sqrt: function () { return range(1, 30); },
    cbrt: function () { return range(1, 30); },
    pctfrac: function () {
      var list = [];
      FRACTIONS.forEach(function (f) {
        list.push([f[0], f[1], "f2p"]);
        list.push([f[0], f[1], "p2f"]);
      });
      return list;
    },
    compare: function () { return buildCompare(COMPARE_COUNT); },
    simp_clerk: function () { return buildSimp("clerk", SIMP_COUNT); },
    simp_po: function () { return buildSimp("po", SIMP_COUNT); },
    simp_sbi: function () { return buildSimp("sbi", SIMP_COUNT); },
  };

  function range(lo, hi) {
    var list = [];
    for (var i = lo; i <= hi; i++) list.push(i);
    return list;
  }

  // Every question for a session, for the chosen topics. A question is removed
  // from the pool when it is asked, so nothing repeats within a session.
  function buildPool(keys) {
    var pool = {};
    keys.forEach(function (k) {
      pool[k] = BUILDERS[k]();
    });
    return pool;
  }

  function poolSize(pool) {
    return Object.keys(pool).reduce(function (n, t) {
      return n + pool[t].length;
    }, 0);
  }

  function makeQuestion(type, item) {
    var q = { type: type, plain: false, time: DEFAULT_TIME };
    var n;

    if (type === "mul") {
      var a = item[0], b = item[1];
      var ans = a * b;
      q.answer = String(ans);
      q.options = numOptions(ans, [
        ans + a, ans - a, ans + b, ans - b,
        ans + 10, ans - 10, ans + 1, ans - 1,
        ans + 2, ans - 2, ans + 20, ans - 20,
      ]);
      if (Math.random() < 0.5) {
        var t = a;
        a = b;
        b = t;
      }
      q.text = a + " × " + b;
    } else if (type === "div") {
      var dividend = item[0], divisor = item[1];
      var quo = dividend / divisor;
      q.answer = String(quo);
      q.options = numOptions(
        quo,
        [-3, -2, -1, 1, 2, 3, 10, -10].map(function (d) { return quo + d; }).concat([divisor])
      );
      q.text = dividend + " ÷ " + divisor;
    } else if (type === "square" || type === "bigsq") {
      n = item;
      q.answer = String(n * n);
      q.options = numOptions(n * n, [-3, -2, -1, 1, 2, 3].map(function (d) { return Math.pow(n + d, 2); }));
      q.text = n + "²";
    } else if (type === "cube") {
      n = item;
      q.answer = String(n * n * n);
      q.options = numOptions(n * n * n, [-3, -2, -1, 1, 2, 3].map(function (d) { return Math.pow(n + d, 3); }));
      q.text = n + "³";
    } else if (type === "sqrt") {
      n = item;
      q.answer = String(n);
      q.options = numOptions(n, [-4, -3, -2, -1, 1, 2, 3, 4].map(function (d) { return n + d; }));
      q.text = "√" + n * n;
    } else if (type === "cbrt") {
      n = item;
      q.answer = String(n);
      q.options = numOptions(n, [-4, -3, -2, -1, 1, 2, 3, 4].map(function (d) { return n + d; }));
      q.text = "∛" + n * n * n;
    } else if (type === "pctfrac") {
      var fn = item[0], fd = item[1];
      var near = nearbyFractions(fn, fd);
      var fallback = function () {
        var f = pick(FRACTIONS);
        return item[2] === "f2p" ? pctLabel(f[0], f[1]) : fracLabel(f[0], f[1]);
      };
      if (item[2] === "f2p") {
        q.text = fn + "/" + fd;
        q.answer = pctLabel(fn, fd);
        q.options = pickOptions(
          q.answer,
          near.map(function (p) { return pctLabel(p[0], p[1]); }),
          fallback
        );
      } else {
        q.text = pctLabel(fn, fd);
        q.answer = fracLabel(fn, fd);
        q.options = pickOptions(
          q.answer,
          near.map(function (p) { return fracLabel(p[0], p[1]); }),
          fallback
        );
      }
    } else if (type === "compare") {
      var labels = item.fr.map(function (f) { return f[0] + "/" + f[1]; });
      var best = item.fr[0];
      item.fr.forEach(function (f) {
        var better = item.mode === "largest" ? f[0] / f[1] > best[0] / best[1] : f[0] / f[1] < best[0] / best[1];
        if (better) best = f;
      });
      q.plain = true;
      q.text = item.mode === "largest" ? "Largest fraction?" : "Smallest fraction?";
      q.answer = best[0] + "/" + best[1];
      q.options = shuffle(labels);
    } else {
      // Simplification (simp_clerk, simp_po, simp_sbi)
      q.plain = true;
      q.text = item.text;
      q.answer = String(item.answer);
      q.options = simpOptions(item);
      q.time = item.time;
    }
    return q;
  }

  // Picks a topic evenly among those with questions left, then a random question.
  function drawQuestion(pool) {
    var types = Object.keys(pool).filter(function (t) {
      return pool[t].length > 0;
    });
    if (types.length === 0) return null;
    var type = types[rand(0, types.length - 1)];
    var idx = rand(0, pool[type].length - 1);
    var item = pool[type].splice(idx, 1)[0];
    return makeQuestion(type, item);
  }

  // ---------- the topic menu ----------

  var ARITH_KEYS = ["mul", "div", "square", "bigsq", "cube", "sqrt", "cbrt", "pctfrac", "compare"];
  var SIMP_KEYS = ["simp_clerk", "simp_po", "simp_sbi"];

  var TOPICS = [
    { id: "mixed", section: "Arithmetic", label: "Mixed", hint: "All arithmetic topics shuffled", keys: ARITH_KEYS },
    { id: "mul", section: "Arithmetic", label: "Multiplication", hint: "12 × 27 (tables to 30)", keys: ["mul"] },
    { id: "div", section: "Arithmetic", label: "Division", hint: "324 ÷ 27 (tables to 30)", keys: ["div"] },
    { id: "square", section: "Arithmetic", label: "Squares to 30", hint: "17²", keys: ["square"] },
    { id: "square50", section: "Arithmetic", label: "Squares to 50", hint: "43²", keys: ["square", "bigsq"] },
    { id: "cube", section: "Arithmetic", label: "Cubes to 30", hint: "21³", keys: ["cube"] },
    { id: "sqrt", section: "Arithmetic", label: "Square Roots", hint: "√625", keys: ["sqrt"] },
    { id: "cbrt", section: "Arithmetic", label: "Cube Roots", hint: "∛12167", keys: ["cbrt"] },
    { id: "pctfrac", section: "Arithmetic", label: "Fractions And Percentages", hint: "1/7 = 14.28%", keys: ["pctfrac"] },
    { id: "compare", section: "Arithmetic", label: "Fraction Comparison", hint: "Pick the Largest or Smallest", keys: ["compare"] },
    { id: "simp_clerk", section: "Simplification", label: "Easier Mixes", hint: "Bank Clerk Level, \n" + SIMP_TIME.clerk + " seconds each", keys: ["simp_clerk"] },
    { id: "simp_po", section: "Simplification", label: "Medium Mixes", hint: "Bank PO Level, SO Level, \n" + SIMP_TIME.po + " seconds each", keys: ["simp_po"] },
    { id: "simp_sbi", section: "Simplification", label: "Harder Mixes", hint: "Bank PO Level, SBI PO Level, \n" + SIMP_TIME.sbi + " seconds each", keys: ["simp_sbi"] },
    { id: "simp_all", section: "Simplification", label: "All Three Levels", hint: "Easier, Medium and Harder Mixes shuffled", keys: SIMP_KEYS },
  ];

  global.LemmariseQuestions = {
    TOPICS: TOPICS,
    DEFAULT_TIME: DEFAULT_TIME,
    buildPool: buildPool,
    poolSize: poolSize,
    drawQuestion: drawQuestion,
  };
})(typeof window !== "undefined" ? window : globalThis);
